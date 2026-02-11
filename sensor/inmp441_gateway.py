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
MQTT_INTERVALO = 10  # Intervalo de envío MQTT (segundos)
MQTT_CLIENT_ID = "esp32_gateway_01"
MQTT_KEEPALIVE = 30

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

    return e, sta


def enviar_datos_mqtt(datos_acumulados):
    """Enviar datos acumulados via MQTT."""
    if not datos_acumulados:
        return

    sta = None
    client = None

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
            # Formato simplificado: solo id y dB
            datos_simplificados = {"id": datos["id"], "dB": datos["dB"]}
            mensaje_json = json.dumps(datos_simplificados)

            try:
                client.publish(MQTT_TOPIC, mensaje_json)
                mensajes_enviados += 1
                print(f"MQTT ENVIADO: {mensaje_json}")
                time.sleep(0.05)  # Pequeña pausa entre mensajes
            except Exception as e:
                print(f"Error enviando mensaje: {e}")

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
    ultimo_envio_mqtt = time.time()

    # Acumuladores de datos
    datos_acumulados = []
    mensajes_recibidos = 0
    dispositivos_vistos = set()

    print("\nIniciando...")

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
                        msg_str = msg.decode("utf-8")

                        # Procesar datos de sensores remotos
                        # Formato 1: "ID:dB" (ej: "E1:65.3")
                        # Formato 2: "ID:dB:valor" (ej: "E1:dB:65.3")
                        if ":" in msg_str:
                            partes = msg_str.split(":")

                            if len(partes) == 2:
                                # Formato "ID:dB"
                                sensor_id = partes[0]
                                try:
                                    dB_valor = float(partes[1])
                                    datos_acumulados.append(
                                        {"id": sensor_id, "dB": dB_valor}
                                    )
                                    print(f"ESPNOW: {sensor_id}:{dB_valor:.1f} dB")
                                except ValueError:
                                    print(f"Valor no convertible: '{partes[1]}'")

                            elif len(partes) == 3 and partes[1] == "dB":
                                # Formato "ID:dB:valor"
                                sensor_id = partes[0]
                                try:
                                    dB_valor = float(partes[2])
                                    datos_acumulados.append(
                                        {"id": sensor_id, "dB": dB_valor}
                                    )
                                    print(f"ESPNOW: {sensor_id}:{dB_valor:.1f} dB")
                                except ValueError:
                                    print(f"Valor no convertible: '{partes[2]}'")

                            else:
                                print(f"Formato desconocido: '{msg_str}'")

                        # Mensajes de control
                        elif msg_str.startswith("INICIO"):
                            print(f"Sensor conectado: {mac_origen_str}")
                        elif msg_str.startswith("FIN"):
                            print(f"Sensor desconectado: {mac_origen_str}")

                    except Exception:
                        print("Error decodificando mensaje")

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

            # 3. Calcular dB local cada 1 segundo
            if ciclo >= 20 and muestras > 0:  # 20 ciclos * 0.05s = 1s
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

                # Acumular datos locales
                datos_acumulados.append({"id": MICRO_ID, "dB": dB})
                print(f"LOCAL: {dB:.1f} dB")

                # Reiniciar contadores
                suma_cuadrados = 0
                muestras = 0
                ciclo = 0

            # 4. Enviar datos acumulados via MQTT periódicamente
            tiempo_actual = time.time()
            if tiempo_actual - ultimo_envio_mqtt >= MQTT_INTERVALO and datos_acumulados:
                print(f"\nEnviando {len(datos_acumulados)} datos via MQTT...")
                print(f"Topic: {MQTT_TOPIC}")
                enviar_datos_mqtt(datos_acumulados)
                datos_acumulados = []  # Limpiar lista
                ultimo_envio_mqtt = tiempo_actual

                # Reinicializar ESPNOW completamente después de usar WiFi
                # Asegurar que las variables se actualicen en el ámbito correcto
                e, sta = reinicializar_espnow()

            time.sleep(0.05)

    except KeyboardInterrupt:
        print("\nDeteniendo gateway...")

        # Enviar datos pendientes
        if datos_acumulados:
            print(f"Enviando {len(datos_acumulados)} datos pendientes...")
            enviar_datos_mqtt(datos_acumulados)
            # Reinicializar ESPNOW después del envío final
            e, sta = reinicializar_espnow()

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
