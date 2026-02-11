"""Gateway ESP32 - Recibe dB via ESPNOW y envía datos via MQTT.
Envía al topic: sensors/espnow/grouped_data
Formato: {"id": "E1", "dB": 65.3}"""

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
MICRO_ID = "E255"  # ID del gateway, E - ESP
SCK_PIN = 14
WS_PIN = 25
SD_PIN = 34
SAMPLE_RATE = 16000

# Configuración MQTT
MQTT_TOPIC = "sensors/espnow/grouped_data"
# Nota: Ya no usamos intervalo fijo, enviamos cuando tenemos 2 muestras por sensor
MQTT_CLIENT_ID = "esp32_gateway_01"
MQTT_KEEPALIVE = 30

# LED integrado
LED_PIN = 2


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
    print("Reinicializando ESPNOW completamente...")

    # Crear nueva interfaz WiFi para ESPNOW
    sta = network.WLAN(network.STA_IF)
    sta.active(False)
    time.sleep(0.1)
    sta.active(True)
    sta.disconnect()
    time.sleep(1.0)

    # Crear nuevo objeto ESPNOW
    e = espnow.ESPNow()
    e.active(True)

    # Mostrar información de conexión
    mac_local = sta.config("mac")
    mac_str = ":".join(f"{b:02x}" for b in mac_local)
    print(f"MAC: {mac_str}")
    print("ESPNOW activo - Listo para recibir")

    # Pequeño delay para estabilizar conexión ESPNOW
    time.sleep(0.5)

    return e, sta


def enviar_datos_mqtt(datos_acumulados):
    """Enviar datos acumulados via MQTT."""
    if not datos_acumulados:
        return

    sta = None
    client = None
    led = Pin(LED_PIN, Pin.OUT)

    try:
        # 1. Conectar WiFi
        sta = conectar_wifi()
        if not sta:
            return

        # 2. Crear y conectar cliente MQTT
        print(f"Conectando MQTT a {MQTT_BROKER}:{MQTT_PORT}...")
        client = MQTTClient(
            MQTT_CLIENT_ID, MQTT_BROKER, port=MQTT_PORT, keepalive=MQTT_KEEPALIVE
        )
        client.connect()
        print(f"MQTT conectado. Topic: {MQTT_TOPIC}")

        # 3. Enviar cada dato
        mensajes_enviados = 0
        for datos in datos_acumulados:
            # Formato simplificado: solo id y dB (redondeado a 1 decimal)
            datos_simplificados = {"id": datos["id"], "dB": round(datos["dB"], 1)}
            mensaje_json = json.dumps(datos_simplificados)

            try:
                client.publish(MQTT_TOPIC, mensaje_json)
                mensajes_enviados += 1
                print(f"MQTT ENVIADO: {mensaje_json}")
                time.sleep(0.05)  # Pequeña pausa entre mensajes
            except Exception as e:
                print(f"Error enviando mensaje: {e}")

        # Parpadear LED dos veces para indicar envío MQTT
        for _ in range(2):
            led.on()
            time.sleep(0.1)
            led.off()
            time.sleep(0.1)

        print(f"Total enviados: {mensajes_enviados}/{len(datos_acumulados)}")

        # 4. Dar tiempo para que se envíen todos los mensajes
        time.sleep(0.5)

        # 5. Desconectar MQTT
        client.disconnect()
        print("MQTT desconectado")

    except Exception as e:
        print(f"Error MQTT: {e}")
        import sys

        sys.print_exception(e)

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
    print("GATEWAY ESP32 - ESPNOW + MQTT")
    print(f"ID: {MICRO_ID}")
    print("=" * 50)

    # Inicializar ESPNOW usando función de reinicialización
    e, sta = reinicializar_espnow()

    # Variables para procesamiento
    suma_cuadrados = 0
    muestras = 0
    ciclo = 0

    # Sistema de generaciones
    generacion_actual = 0

    # Acumuladores de datos por generación
    # Estructura: {generacion: {sensor_id: [dB1, dB2, ...]}}
    datos_por_generacion = {generacion_actual: {}}
    mensajes_recibidos = 0
    dispositivos_vistos = set()
    sensores_en_generacion = set()  # Sensores activos en la generación actual

    print("\nIniciando...")
    print("Sistema de generaciones activado")
    print(f"Generación actual: {generacion_actual}")
    print("Esperando 2 muestras de TODOS los sensores en esta generación...")
    ultimo_estado = time.time()

    try:
        while True:
            # 1. Recibir mensajes ESPNOW
            try:
                host, msg = e.recv(0)  # Non-blocking
                if msg:
                    mensajes_recibidos += 1
                    mac_origen = bytes(host)
                    mac_origen_str = ":".join(f"{b:02x}" for b in mac_origen)
                    dispositivos_vistos.add(mac_origen_str)

                    try:
                        # Decodificar mensaje de forma robusta
                        try:
                            msg_str = msg.decode("utf-8")
                        except UnicodeError:
                            # Intentar decodificar ignorando errores
                            msg_str = msg.decode("utf-8", errors="ignore")
                            msg_str = msg_str.strip()

                        # Procesar datos de sensores remotos
                        # Formato esperado: "ID:dB" (ej: "E1:65.3")
                        if ":" in msg_str:
                            partes = msg_str.split(":")

                            # Mensajes de control: "ID:INICIO" o "ID:FIN"
                            if len(partes) == 2 and (
                                partes[1] == "INICIO" or partes[1] == "FIN"
                            ):
                                sensor_id = partes[0]
                                if partes[1] == "INICIO":
                                    print(
                                        f"Sensor conectado: {mac_origen_str} (ID: {sensor_id})"
                                    )
                                elif partes[1] == "FIN":
                                    print(
                                        f"Sensor desconectado: {mac_origen_str} (ID: {sensor_id})"
                                    )
                                    # Si un sensor se desconecta, lo removemos de la generación actual
                                    if sensor_id in sensores_en_generacion:
                                        sensores_en_generacion.remove(sensor_id)
                                        if (
                                            sensor_id
                                            in datos_por_generacion[generacion_actual]
                                        ):
                                            del datos_por_generacion[generacion_actual][
                                                sensor_id
                                            ]
                                        print(
                                            f"Sensor {sensor_id} removido de generación {generacion_actual}"
                                        )

                            # Formato simple "ID:dB" (datos de medición)
                            elif len(partes) == 2:
                                sensor_id = partes[0]
                                try:
                                    dB_valor = float(partes[1])

                                    # Verificar si el sensor ya está en la generación actual
                                    if sensor_id not in sensores_en_generacion:
                                        # Nuevo sensor - agregar a la generación actual
                                        sensores_en_generacion.add(sensor_id)
                                        datos_por_generacion[generacion_actual][
                                            sensor_id
                                        ] = []
                                        print(
                                            f"ESPNOW: Nuevo sensor {sensor_id} unido a generación {generacion_actual}"
                                        )

                                    # Solo acumular si tenemos menos de 2 datos para este sensor en esta generación
                                    if (
                                        len(
                                            datos_por_generacion[generacion_actual][
                                                sensor_id
                                            ]
                                        )
                                        < 2
                                    ):
                                        datos_por_generacion[generacion_actual][
                                            sensor_id
                                        ].append(dB_valor)
                                        print(
                                            f"ESPNOW: {sensor_id}:{dB_valor:.1f} dB (gen {generacion_actual}, dato {len(datos_por_generacion[generacion_actual][sensor_id])}/2)"
                                        )
                                    else:
                                        print(
                                            f"ESPNOW: {sensor_id}:{dB_valor:.1f} dB (ignorado, ya tiene 2 datos en gen {generacion_actual})"
                                        )
                                except ValueError:
                                    print(
                                        f"Valor no convertible a float: '{partes[1]}'"
                                    )
                            else:
                                print(f"Formato desconocido: '{msg_str}'")

                        # Mensajes de control ya manejados arriba
                        # (INICIO y FIN se manejan en la sección de formato "ID:INICIO" y "ID:FIN")
                        else:
                            print(f"Mensaje no reconocido: '{msg_str}'")

                    except Exception as e:
                        print(f"Error procesando mensaje: {e}")

            except Exception as recv_err:
                # Ignorar timeouts normales
                if "ETIMEDOUT" not in str(recv_err) and "ENODATA" not in str(recv_err):
                    print(f"Error recepción ESPNOW: {recv_err}")

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
                    muestras += 1

            ciclo += 1

            # 3. Calcular dB local cada 5 segundos
            if ciclo >= 100 and muestras > 0:  # 100 ciclos * 0.05s = 5s
                # Calcular dB
                rms_prom = math.sqrt(suma_cuadrados / muestras)

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

                # Redondear a 1 decimal como el sender
                dB = round(dB, 1)

                # Acumular datos locales (gateway siempre está en la generación actual)
                if MICRO_ID not in datos_por_generacion[generacion_actual]:
                    datos_por_generacion[generacion_actual][MICRO_ID] = []
                    sensores_en_generacion.add(MICRO_ID)

                # Solo acumular si tenemos menos de 2 datos para el gateway local en esta generación
                if len(datos_por_generacion[generacion_actual][MICRO_ID]) < 2:
                    datos_por_generacion[generacion_actual][MICRO_ID].append(dB)
                    print(
                        f"LOCAL: {dB:.1f} dB (gen {generacion_actual}, dato {len(datos_por_generacion[generacion_actual][MICRO_ID])}/2)"
                    )
                    # Parpadear LED una vez para indicar captura local
                    led.on()
                    time.sleep(0.1)
                    led.off()
                else:
                    print(
                        f"LOCAL: {dB:.1f} dB (ignorado, ya tiene 2 datos en gen {generacion_actual})"
                    )

                # Reiniciar contadores
                suma_cuadrados = 0
                muestras = 0
                ciclo = 0

            # 4. Verificar si tenemos 2 muestras para TODOS los sensores en la generación actual
            # Solo enviamos si TODOS los sensores en esta generación tienen al menos 2 muestras
            enviar_ahora = False
            sensores_completos = []
            sensores_incompletos = []

            if datos_por_generacion[
                generacion_actual
            ]:  # Solo verificar si hay sensores en esta generación
                enviar_ahora = True
                for sensor_id, mediciones in datos_por_generacion[
                    generacion_actual
                ].items():
                    if len(mediciones) >= 2:
                        sensores_completos.append(sensor_id)
                    else:
                        sensores_incompletos.append(sensor_id)
                        enviar_ahora = False

            if enviar_ahora and datos_por_generacion[generacion_actual]:
                # Convertir datos de la generación actual a lista plana para enviar
                datos_a_enviar = []
                for sensor_id, mediciones in datos_por_generacion[
                    generacion_actual
                ].items():
                    # Solo enviar las primeras 2 mediciones de cada sensor
                    for i, dB_valor in enumerate(mediciones[:2]):
                        datos_a_enviar.append({"id": sensor_id, "dB": dB_valor})

                if datos_a_enviar:
                    print(f"\n✓ GENERACIÓN {generacion_actual} COMPLETA")
                    print(f"Sensores en esta generación: {sensores_completos}")
                    print(
                        f"Total datos a enviar: {len(datos_a_enviar)} (2 por cada sensor)"
                    )
                    print(f"Topic: {MQTT_TOPIC}")
                    enviar_datos_mqtt(datos_a_enviar)

                # Crear nueva generación para nuevos sensores
                generacion_actual += 1
                datos_por_generacion[generacion_actual] = {}
                sensores_en_generacion.clear()

                # El gateway local siempre está en cada nueva generación
                datos_por_generacion[generacion_actual][MICRO_ID] = []
                sensores_en_generacion.add(MICRO_ID)

                print(f"\n🔄 Nueva generación iniciada: {generacion_actual}")
                print(
                    "Esperando 2 muestras de TODOS los sensores en esta nueva generación..."
                )

                # Reinicializar ESPNOW completamente después de usar WiFi
                e, sta = reinicializar_espnow()
                # Pequeño delay para dar tiempo a que sensores se reconecten
                time.sleep(1.0)

            # Mostrar estado periódicamente cada 30 segundos
            tiempo_actual = time.time()
            if tiempo_actual - ultimo_estado >= 30:
                print(f"\n[Estado] Generación actual: {generacion_actual}")
                print(
                    f"Sensores en generación {generacion_actual}: {len(datos_por_generacion[generacion_actual])}"
                )
                if datos_por_generacion[generacion_actual]:
                    for sensor_id, mediciones in datos_por_generacion[
                        generacion_actual
                    ].items():
                        print(f"  {sensor_id}: {len(mediciones)}/2 muestras")
                else:
                    print("  No hay sensores en esta generación")
                ultimo_estado = tiempo_actual

            time.sleep(0.05)

    except KeyboardInterrupt:
        print("\nDeteniendo gateway...")

        # Verificar si tenemos datos completos en la generación actual para enviar
        enviar_final = False
        sensores_completos_final = []
        sensores_incompletos_final = []

        if datos_por_generacion[generacion_actual]:
            enviar_final = True
            for sensor_id, mediciones in datos_por_generacion[
                generacion_actual
            ].items():
                if len(mediciones) >= 2:
                    sensores_completos_final.append(sensor_id)
                else:
                    sensores_incompletos_final.append(sensor_id)
                    enviar_final = False

        # Solo enviar si TODOS los sensores en la generación actual tienen 2 muestras
        if enviar_final and datos_por_generacion[generacion_actual]:
            # Convertir datos de la generación actual a lista plana para enviar
            datos_a_enviar = []
            for sensor_id, mediciones in datos_por_generacion[
                generacion_actual
            ].items():
                # Solo enviar las primeras 2 mediciones de cada sensor
                for i, dB_valor in enumerate(mediciones[:2]):
                    datos_a_enviar.append({"id": sensor_id, "dB": dB_valor})

            if datos_a_enviar:
                print(
                    f"Enviando {len(datos_a_enviar)} datos finales de generación {generacion_actual}..."
                )
                print(f"Sensores completos: {sensores_completos_final}")
                enviar_datos_mqtt(datos_a_enviar)
                # Reinicializar ESPNOW después del envío final
                e, sta = reinicializar_espnow()
                # Pequeño delay para dar tiempo a que sensores se reconecten
                time.sleep(1.0)
        else:
            print(
                f"No se envían datos finales: generación {generacion_actual} incompleta"
            )
            if datos_por_generacion[generacion_actual]:
                print("Estado actual:")
                for sensor_id, mediciones in datos_por_generacion[
                    generacion_actual
                ].items():
                    print(f"  {sensor_id}: {len(mediciones)}/2 muestras")
                if sensores_incompletos_final:
                    print(f"Sensores incompletos: {sensores_incompletos_final}")

        # Mostrar estadísticas
        print("\nEstadísticas finales:")
        print(f"  Mensajes ESPNOW recibidos: {mensajes_recibidos}")
        print(f"  Dispositivos detectados: {len(dispositivos_vistos)}")
        for dispositivo in dispositivos_vistos:
            print(f"    • {dispositivo}")

    except Exception as e:
        print(f"\nError: {e}")

    finally:
        # Limpiar recursos
        print("\nLimpiando recursos...")
        audio_in.deinit()
        e.active(False)
        sta.active(False)
        print("Recursos liberados")
        print("=" * 50)


# Ejecutar programa principal
if __name__ == "__main__":
    main()
