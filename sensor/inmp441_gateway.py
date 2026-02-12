"""Gateway ESP32 - Recibe dB via ESPNOW y envía datos via MQTT en lotes pequeños.
Envía lotes de 2-3 micros cuando tienen 2 muestras cada uno.
Formato: {"sensors": [{"micro_id": "E1", "value": 65.3}], "timestamp": 1234567890}
"""

import gc
import json
import math
import time

import espnow
import network
from machine import I2S, Pin
from umqtt.simple import MQTTClient

# Importar configuración MQTT
from config import MQTT_BROKER, MQTT_PORT, WIFI_PASSWORD, WIFI_SSID

# Configuración del gateway
MICRO_ID = "E255"  # ID del gateway (sensor local)
SCK_PIN = 14
WS_PIN = 25
SD_PIN = 34
SAMPLE_RATE = 16000

# Configuración MQTT
MQTT_TOPIC = "sensors/espnow/grouped_data"
MQTT_CLIENT_ID = "esp32_gateway_01"
MQTT_KEEPALIVE = 30

# LED integrado
LED_PIN = 2

# Contadores globales
MESSAGE_COUNTER = 0
BATCH_SIZE = 3  # Micros por lote MQTT

# Inicializar I2S para micrófono local
audio_in = I2S(
    0,
    sck=Pin(SCK_PIN),
    ws=Pin(WS_PIN),
    sd=Pin(SD_PIN),
    mode=I2S.RX,
    bits=16,
    format=I2S.MONO,
    rate=SAMPLE_RATE,
    ibuf=20000,
)
samples = bytearray(512)

# Inicializar LED
led = Pin(LED_PIN, Pin.OUT)
led.off()


def conectar_wifi():
    """Conectar a WiFi y devolver objeto sta."""
    sta = network.WLAN(network.STA_IF)
    sta.active(True)

    if not sta.isconnected():
        print(f"Conectando WiFi a {WIFI_SSID}...")
        sta.connect(WIFI_SSID, WIFI_PASSWORD)
        for i in range(30):  # Esperar hasta 15 segundos
            if sta.isconnected():
                print(f"WiFi conectado: {sta.ifconfig()[0]}")
                return sta
            time.sleep(0.5)

        print("Error: No se pudo conectar WiFi")
        return None

    print(f"WiFi ya conectado: {sta.ifconfig()[0]}")
    return sta


def reinicializar_espnow():
    """Reinicializa completamente ESPNOW después de usar WiFi."""
    print("Reinicializando ESPNOW...")

    # Crear nueva interfaz WiFi para ESPNOW
    sta = network.WLAN(network.STA_IF)
    sta.active(False)
    time.sleep(0.2)
    sta.active(True)
    sta.disconnect()
    time.sleep(0.5)

    # Crear nuevo objeto ESPNOW
    e = espnow.ESPNow()
    e.active(True)

    # Mostrar información de conexión
    mac_local = sta.config("mac")
    mac_str = ":".join(f"{b:02x}" for b in mac_local)
    print(f"MAC: {mac_str}")
    print("ESPNOW activo - Listo para recibir")

    return e, sta


def enviar_lote_mqtt(micros_completos, datos_micros):
    """Enviar un lote de micros completos via MQTT."""
    global MESSAGE_COUNTER

    if not micros_completos:
        print("No hay micros completos para enviar")
        return False

    sta = None
    client = None
    exitos = 0

    try:
        # 1. Conectar WiFi
        sta = conectar_wifi()
        if not sta:
            print("✗ Falló conexión WiFi")
            return False

        # 2. Conectar MQTT
        client = MQTTClient(
            MQTT_CLIENT_ID,
            MQTT_BROKER,
            port=MQTT_PORT,
            keepalive=MQTT_KEEPALIVE,
        )
        client.connect()
        print(f"✓ MQTT conectado para lote de {len(micros_completos)} micros")

        timestamp = int(time.time())
        micros_por_lote = min(BATCH_SIZE, len(micros_completos))

        # Enviar en lotes pequeños
        for i in range(0, len(micros_completos), micros_por_lote):
            lote_micros = micros_completos[i : i + micros_por_lote]

            # Crear mensaje para este lote
            MESSAGE_COUNTER += 1
            mensaje = {
                "message_id": f"esp32_{MESSAGE_COUNTER:06d}",
                "timestamp": timestamp,
                "sensors": [],
            }

            # Agregar datos de cada micro en el lote
            for micro_id in lote_micros:
                if micro_id in datos_micros and len(datos_micros[micro_id]) >= 2:
                    # Tomar las 2 muestras más recientes
                    muestras = datos_micros[micro_id][-2:]
                    for j, dB_valor in enumerate(muestras):
                        mensaje["sensors"].append(
                            {
                                "micro_id": micro_id,
                                "value": round(dB_valor, 1),
                                "sample": j + 1,
                            }
                        )

            # Enviar lote
            if mensaje["sensors"]:
                json_msg = json.dumps(mensaje)
                client.publish(MQTT_TOPIC, json_msg)
                exitos += 1
                print(
                    f"✓ Lote enviado: {len(mensaje['sensors'])} muestras de {len(lote_micros)} micros"
                )

                # Pequeño delay entre lotes
                if i + micros_por_lote < len(micros_completos):
                    time.sleep(0.1)

        # Feedback visual
        for _ in range(2):
            led.on()
            time.sleep(0.1)
            led.off()
            time.sleep(0.1)

        print(f"✓ Envío completo: {exitos} lotes enviados")
        return exitos > 0

    except Exception as e:
        print(f"✗ Error MQTT: {e}")
        return False

    finally:
        # Limpiar recursos
        if client:
            try:
                client.disconnect()
            except:
                pass

        if sta:
            try:
                sta.disconnect()
                sta.active(False)
                print("WiFi desconectado")
            except:
                pass


def main():
    print("=" * 50)
    print("GATEWAY ESP32 - ENVÍO POR LOTES PEQUEÑOS")
    print(f"ID: {MICRO_ID}")
    print(f"Lotes de {BATCH_SIZE} sensores")
    print("=" * 50)

    # Inicializar ESPNOW
    e, sta_espnow = reinicializar_espnow()

    # Variables de procesamiento de audio local
    suma_cuadrados = 0
    muestras_audio = 0
    ciclo = 0

    # Almacenamiento de datos por micro
    # Estructura: {micro_id: [dB1, dB2, ...]} - máximo 4 muestras por micro
    datos_micros = {}
    MAX_MUESTRAS_POR_MICRO = 4  # Mantener solo últimas 4 muestras

    # El gateway local siempre está presente
    datos_micros[MICRO_ID] = []

    # Contadores de estadísticas
    mensajes_recibidos = 0
    envios_exitosos = 0
    envios_fallidos = 0
    micros_activos = set([MICRO_ID])
    ultimo_estado = time.time()
    ultimo_envio = time.time()

    print("\nIniciando...")
    print("Acumulando datos y enviando en lotes pequeños")
    print("No se espera a todos los micros")

    try:
        while True:
            # 1. Recibir mensajes ESPNOW (no bloqueante)
            try:
                host, msg = e.recv(0)
                if msg:
                    mensajes_recibidos += 1
                    mac_origen = bytes(host)
                    mac_origen_str = ":".join(f"{b:02x}" for b in mac_origen)

                    try:
                        # Decodificar mensaje
                        try:
                            msg_str = msg.decode("utf-8")
                        except:
                            # Si falla UTF-8, usar latin-1
                            msg_str = msg.decode("latin-1")
                        msg_str = msg_str.strip()

                        if not msg_str:
                            continue

                        # Procesar formato "ID:dB" o "ID:INICIO/FIN"
                        if ":" in msg_str:
                            partes = msg_str.split(":")

                            if len(partes) == 2:
                                micro_id = partes[0]

                                # Mensajes de control
                                if partes[1] == "INICIO":
                                    print(
                                        f"Micro conectado: {micro_id} (MAC: {mac_origen_str})"
                                    )
                                    micros_activos.add(micro_id)
                                    continue
                                elif partes[1] == "FIN":
                                    print(
                                        f"Micro desconectado: {micro_id} (MAC: {mac_origen_str})"
                                    )
                                    if micro_id in micros_activos:
                                        micros_activos.remove(micro_id)
                                    if micro_id in datos_micros:
                                        del datos_micros[micro_id]
                                    continue

                                # Datos de medición
                                try:
                                    dB_valor = float(partes[1])

                                    # Asegurar que el micro está en el diccionario
                                    if micro_id not in datos_micros:
                                        datos_micros[micro_id] = []
                                        print(f"Nuevo micro detectado: {micro_id}")

                                    # Agregar dato (mantener máximo MAX_MUESTRAS_POR_MICRO)
                                    datos_micros[micro_id].append(dB_valor)
                                    if (
                                        len(datos_micros[micro_id])
                                        > MAX_MUESTRAS_POR_MICRO
                                    ):
                                        datos_micros[micro_id] = datos_micros[micro_id][
                                            -MAX_MUESTRAS_POR_MICRO:
                                        ]

                                    muestras_actuales = len(datos_micros[micro_id])
                                    print(
                                        f"ESPNOW: {micro_id}:{dB_valor:.1f} dB ({muestras_actuales}/{MAX_MUESTRAS_POR_MICRO})"
                                    )

                                except ValueError:
                                    print(f"Valor no numérico: '{partes[1]}'")
                    except Exception as e:
                        print(f"Error procesando mensaje: {e}")

            except Exception as recv_err:
                # Ignorar timeouts normales
                if "ETIMEDOUT" not in str(recv_err) and "ENODATA" not in str(recv_err):
                    pass

            # 2. Procesar audio local
            bytes_leidos = audio_in.readinto(samples)
            if bytes_leidos > 0:
                # Calcular RMS
                suma = 0
                count = bytes_leidos // 2

                for i in range(0, count * 2, 2):
                    valor = int.from_bytes(samples[i : i + 2], "little")
                    if valor >= 32768:
                        valor -= 65536
                    suma += valor * valor

                if count > 0:
                    rms = math.sqrt(suma / count)
                    suma_cuadrados += rms * rms
                    muestras_audio += 1

            ciclo += 1

            # 3. Calcular dB local cada 5 segundos (100 ciclos * 0.05s = 5s)
            if ciclo >= 100 and muestras_audio > 0:
                # Calcular dB
                rms_prom = math.sqrt(suma_cuadrados / muestras_audio)

                if rms_prom >= 2:
                    voltaje = (rms_prom / 32767) * 3.3
                    factor = 10 ** (-3.0 / 20)
                    presion = voltaje / factor

                    if presion >= 0.00002:
                        dB = 20 * math.log10(presion / 0.00002)
                        dB = max(0.0, dB)
                    else:
                        dB = 0.0
                else:
                    dB = 0.0

                dB = round(dB, 1)

                # Agregar dato local del gateway
                datos_micros[MICRO_ID].append(dB)
                if len(datos_micros[MICRO_ID]) > MAX_MUESTRAS_POR_MICRO:
                    datos_micros[MICRO_ID] = datos_micros[MICRO_ID][
                        -MAX_MUESTRAS_POR_MICRO:
                    ]

                muestras_actuales = len(datos_micros[MICRO_ID])
                print(
                    f"LOCAL: {dB:.1f} dB ({muestras_actuales}/{MAX_MUESTRAS_POR_MICRO})"
                )

                # LED feedback para captura local
                led.on()
                time.sleep(0.1)
                led.off()

                # Reiniciar contadores
                suma_cuadrados = 0
                muestras_audio = 0
                ciclo = 0

            # 4. Verificar si hay sensores completos para enviar
            tiempo_actual = time.time()

            # Enviar si:
            # 1. Han pasado al menos 10 segundos desde el último envío
            # 2. Y tenemos al menos BATCH_SIZE micros con 2+ muestras
            if tiempo_actual - ultimo_envio >= 10:
                micros_completos = []
                for micro_id in list(datos_micros.keys()):
                    if len(datos_micros.get(micro_id, [])) >= 2:
                        micros_completos.append(micro_id)

                if len(micros_completos) >= BATCH_SIZE:
                    print(
                        f"\n📦 Preparando lote de {len(micros_completos)} micros completos..."
                    )

                    if enviar_lote_mqtt(micros_completos, datos_micros):
                        envios_exitosos += 1
                        ultimo_envio = tiempo_actual

                        # Limpiar datos de micros enviados (mantener solo 1 muestra por si acaso)
                        for micro_id in micros_completos:
                            if (
                                micro_id in datos_micros
                                and len(datos_micros[micro_id]) > 0
                            ):
                                datos_micros[micro_id] = datos_micros[micro_id][-1:]

                        # Reinicializar ESPNOW después de MQTT
                        e, sta_espnow = reinicializar_espnow()
                        print("ESPNOW reinicializado después de envío MQTT")

                        # Limpiar memoria
                        gc.collect()
                        print(f"Memoria libre: {gc.mem_free()} bytes")
                    else:
                        envios_fallidos += 1

            # 5. Mostrar estado periódicamente cada 30 segundos
            if tiempo_actual - ultimo_estado >= 30:
                print(f"\n[Estado]")
                print(f"Micros activos: {len(micros_activos)}")
                print(f"Datos en memoria: {len(datos_micros)} micros")
                print(f"Memoria libre: {gc.mem_free()} bytes")

                # Mostrar micros con datos
                micros_con_datos = 0
                micros_completos_actual = 0
                for micro_id in micros_activos:
                    muestras_micro = len(datos_micros.get(micro_id, []))
                    if muestras_micro > 0:
                        micros_con_datos += 1
                    if muestras_micro >= 2:
                        micros_completos_actual += 1
                    if muestras_micro > 0:
                        print(
                            f"  {micro_id}: {muestras_micro}/{MAX_MUESTRAS_POR_MICRO}"
                        )

                print(f"Micros con datos: {micros_con_datos}/{len(micros_activos)}")
                print(f"Micros completos (2+): {micros_completos_actual}")

                total_envios = envios_exitosos + envios_fallidos
                if total_envios > 0:
                    tasa = envios_exitosos / total_envios * 100
                    print(
                        f"MQTT: {envios_exitosos} éxitos, {envios_fallidos} fallos ({tasa:.1f}%)"
                    )
                else:
                    print(f"MQTT: Sin envíos aún")

                # Limpiar memoria periódicamente
                gc.collect()
                print(f"Memoria después de GC: {gc.mem_free()} bytes")

                ultimo_estado = tiempo_actual

            time.sleep(0.05)  # 20 Hz loop

    except KeyboardInterrupt:
        print("\nDeteniendo gateway...")

        # Intentar enviar datos pendientes
        print("Verificando datos pendientes...")
        micros_completos_final = []
        for micro_id in list(datos_micros.keys()):
            if len(datos_micros.get(micro_id, [])) >= 2:
                micros_completos_final.append(micro_id)

        if micros_completos_final:
            print(f"Enviando datos finales de {len(micros_completos_final)} micros...")
            if enviar_lote_mqtt(micros_completos_final, datos_micros):
                envios_exitosos += 1
            else:
                envios_fallidos += 1

        # Mostrar estadísticas finales
        print("\n" + "=" * 50)
        print("ESTADÍSTICAS FINALES")
        print("=" * 50)

        print(f"\n📡 ESPNOW:")
        print(f"  • Mensajes recibidos: {mensajes_recibidos}")
        print(f"  • Micros activos: {len(micros_activos)}")

        print(f"\n📤 MQTT:")
        print(f"  • Envíos exitosos: {envios_exitosos}")
        print(f"  • Envíos fallidos: {envios_fallidos}")
        total = envios_exitosos + envios_fallidos
        if total > 0:
            print(f"  • Tasa éxito: {envios_exitosos / total * 100:.1f}%")

        print(f"\n⚙️  Sistema:")
        print(f"  • Gateway ID: {MICRO_ID}")
        print(f"  • Memoria libre final: {gc.mem_free()} bytes")

    except Exception as e:
        print(f"\nError crítico: {e}")
        import sys

        sys.print_exception(e)

    finally:
        # Limpiar recursos
        print("\nLimpiando recursos...")
        audio_in.deinit()
        e.active(False)
        sta_espnow.active(False)
        print("Recursos liberados")
        print("=" * 50)


# Ejecutar programa principal
if __name__ == "__main__":
    main()
