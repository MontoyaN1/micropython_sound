"""
Gateway ESP-NOW para recepción de datos de sensores INMP441 y envío a MQTT.

Este código recibe datos de múltiples sensores vía ESP-NOW, los agrupa
y los envía periódicamente a un broker MQTT.

Funcionalidades:
1. Recibe datos vía ESP-NOW de múltiples emisores
2. Agrupa datos por micro ID y sensor ID
3. Conecta a WiFi y broker MQTT usando config.py
4. Envía un solo mensaje MQTT con todos los datos agrupados
"""

import network
import espnow
import time
import json
import gc
import math
from machine import I2S, Pin
from umqtt.simple import MQTTClient
from config import WIFI_SSID, WIFI_PASSWORD, MQTT_BROKER, MQTT_PORT

# ============================================================================
# CONFIGURACIÓN
# ============================================================================
MQTT_CLIENT_ID = "espnow_gateway"
MQTT_TOPIC = "sensors/espnow/grouped_data"
SEND_INTERVAL_MS = 5000  # 5 segundos entre envíos MQTT

# Configuración ESP-NOW
PMK = b'pmk1234567890123'  # PMK para seguridad (debe coincidir con emisores)
WIFI_CHANNEL = 0           # Canal WiFi para ESP-NOW (1-14, 0=auto)

# Configuración de sensores locales del gateway
GATEWAY_MICRO_ID = 255  # ID reservado para el gateway (255 o diferente de los emisores)
GATEWAY_SENSOR_IDS = [101, 102]  # IDs únicos para sensores locales

# Configuración de pines I2S para sensores locales
SCK_PIN = 14   # Clock compartido
WS_PIN = 25    # Word select compartido
SD_PIN_1 = 35  # Data del sensor 1 local
SD_PIN_2 = 34  # Data del sensor 2 local

# Configuración de audio
SAMPLE_RATE = 16000
BITS = 16
FORMAT = I2S.MONO
BUFFER_SIZE = 5000

# Constantes para cálculo de dB
SENSIBILIDAD = -3.0        # Sensibilidad del micrófono en dBV/Pa
P_REF = 0.00002            # Presión de referencia (20 μPa)
VOLTAJE_REF = 3.3          # Voltaje de referencia del ADC
MAX_AMPLITUD = 32767       # Máxima amplitud para 16 bits con signo

# ============================================================================
# INICIALIZACIÓN DE INTERFACES I2S PARA SENSORES LOCALES
# ============================================================================
audio_in1 = I2S(
    0,
    sck=Pin(SCK_PIN),
    ws=Pin(WS_PIN),
    sd=Pin(SD_PIN_1),
    mode=I2S.RX,
    bits=BITS,
    format=FORMAT,
    rate=SAMPLE_RATE,
    ibuf=BUFFER_SIZE,
)

audio_in2 = I2S(
    1,
    sck=Pin(SCK_PIN),
    ws=Pin(WS_PIN),
    sd=Pin(SD_PIN_2),
    mode=I2S.RX,
    bits=BITS,
    format=FORMAT,
    rate=SAMPLE_RATE,
    ibuf=BUFFER_SIZE,
)

samples1 = bytearray(512)
samples2 = bytearray(512)

# Almacenamiento de datos recibidos
# Estructura: datos_recibidos[micro_id][sensor_id] = {"value": dB, "timestamp": ms}
datos_recibidos = {}
ultimo_envio_mqtt = time.ticks_ms()

# ============================================================================
# INICIALIZACIÓN ESP-NOW (RECEPTOR)
# ============================================================================
def inicializar_espnow_receptor():
    """Configura ESP-NOW para recibir datos de múltiples emisores."""
    print("Inicializando ESP-NOW en modo receptor...")

    # Activar interfaz WiFi en modo STA
    sta = network.WLAN(network.STA_IF)
    sta.active(True)
    sta.disconnect()  # No conectamos a WiFi todavía

    # Configurar canal WiFi si se especifica
    if WIFI_CHANNEL > 0:
        sta.config(channel=WIFI_CHANNEL)
        print(f"Canal WiFi configurado: {WIFI_CHANNEL}")

    # Inicializar ESP-NOW
    e = espnow.ESPNow()
    e.active(True)

    # Configurar para recibir de cualquier peer
    e.config(pmk=PMK)  # PMK para seguridad (debe coincidir con emisores)

    print(f"MAC del gateway: {sta.config('mac').hex()}")
    print("ESP-NOW receptor listo. Esperando datos...")

    return e

# ============================================================================
# FUNCIONES PARA PROCESAMIENTO DE AUDIO
# ============================================================================
def bytes_to_signed(byte_data):
    """Convierte 2 bytes (little-endian) a valor con signo de 16 bits."""
    value = int.from_bytes(byte_data, "little")
    return value - 65536 if value >= 32768 else value

def calcular_RMS(samples, bytes_read):
    """Calcula el valor RMS de las muestras de audio."""
    suma = 0
    count = min(100, bytes_read // 2)

    for j in range(0, count * 2, 2):
        sample = bytes_to_signed(samples[j:j + 2])
        suma += sample * sample

    return int(math.sqrt(suma / count)) if count > 0 else 0

def amplitud_a_dB(amplitud):
    """Convierte amplitud RMS a decibelios."""
    if amplitud < 2:
        return 0.0

    voltaje = (amplitud / MAX_AMPLITUD) * VOLTAJE_REF
    factor = 10 ** (SENSIBILIDAD / 20)
    presion = voltaje / factor

    if presion < P_REF:
        return 0.0

    dB = 20 * math.log10(presion / P_REF)
    return max(0.0, dB)

def leer_sensores_locales():
    """Lee datos de los sensores locales del gateway y devuelve valores en dB."""
    try:
        bytes_read1 = audio_in1.readinto(samples1)
        bytes_read2 = audio_in2.readinto(samples2)

        if bytes_read1 > 0 and bytes_read2 > 0:
            amplitud1 = calcular_RMS(samples1, bytes_read1)
            amplitud2 = calcular_RMS(samples2, bytes_read2)

            dB1 = amplitud_a_dB(amplitud1)
            dB2 = amplitud_a_dB(amplitud2)

            return dB1, dB2
    except Exception as e:
        print(f"Error leyendo sensores locales: {e}")

    return 0.0, 0.0

# ============================================================================
# CALLBACK PARA RECEPCIÓN ESP-NOW
# ============================================================================
def procesar_datos_espnow(espnow_obj):
    """Procesa datos recibidos via ESP-NOW y los almacena."""
    global datos_recibidos

    try:
        # Leer datos disponibles
        mac_emisor, mensaje = espnow_obj.recv(0)  # Non-blocking

        if mensaje:
            try:
                # Decodificar mensaje JSON
                datos = json.loads(mensaje.decode('utf-8'))

                # Validar estructura de datos
                if "micro_id" in datos and "sensors" in datos:
                    micro_id = datos["micro_id"]
                    timestamp = datos.get("timestamp", time.ticks_ms())

                    # Inicializar entrada para este micro si no existe
                    if micro_id not in datos_recibidos:
                        datos_recibidos[micro_id] = {}

                    # Procesar cada sensor
                    for sensor in datos["sensors"]:
                        if "sensor_id" in sensor and "value" in sensor:
                            sensor_id = sensor["sensor_id"]

                            # Almacenar datos del sensor
                            datos_recibidos[micro_id][sensor_id] = {
                                "value": sensor["value"],
                                "timestamp": timestamp,
                                "mac_emisor": mac_emisor.hex(),
                                "received_at": time.ticks_ms()
                            }

                    print(f"✓ Datos recibidos de micro {micro_id} (MAC: {mac_emisor.hex()})")

                else:
                    print(f"✗ Estructura inválida de datos de {mac_emisor.hex()}")

            except (ValueError, KeyError) as e:
                print(f"✗ Error procesando datos de {mac_emisor.hex()}: {e}")

    except Exception as e:
        # Error general, continuar sin interrumpir
        pass

# ============================================================================
# CONEXIÓN WiFi y MQTT
# ============================================================================
def conectar_wifi():
    """Conecta a la red WiFi."""
    wlan = network.WLAN(network.STA_IF)
    wlan.active(True)

    if not wlan.isconnected():
        print(f"Conectando a WiFi: {WIFI_SSID}...")
        wlan.connect(WIFI_SSID, WIFI_PASSWORD)

        for i in range(15):
            if wlan.isconnected():
                break
            time.sleep(1)

    if wlan.isconnected():
        print(f"WiFi conectada: {wlan.ifconfig()[0]}")
        return True
    else:
        print("Error: No se pudo conectar a WiFi")
        return False

def conectar_mqtt():
    """Conecta al broker MQTT."""
    try:
        client = MQTTClient(
            client_id=MQTT_CLIENT_ID,
            server=MQTT_BROKER,
            port=MQTT_PORT,
            keepalive=60
        )
        client.connect()
        print(f"Conectado a MQTT: {MQTT_BROKER}:{MQTT_PORT}")
        return client
    except OSError as e:
        print(f"Error conectando MQTT: {e}")
        return None
    except Exception as e:
        print(f"Error MQTT inesperado: {e}")
        return None

def enviar_mqtt(client, datos):
    """Envía datos agrupados al broker MQTT."""
    if not client:
        print("Error: Cliente MQTT no disponible")
        return False

    try:
        # Preparar payload para MQTT
        payload = {
            "timestamp": time.ticks_ms(),
            "gateway_id": MQTT_CLIENT_ID,
            "micros": []
        }

        # Agrupar datos por micro
        for micro_id, sensores in datos.items():
            micro_data = {
                "micro_id": micro_id,
                "sensors": []
            }

            for sensor_id, datos_sensor in sensores.items():
                micro_data["sensors"].append({
                    "sensor_id": sensor_id,
                    "value": datos_sensor["value"],
                    "timestamp": datos_sensor["timestamp"],
                    "mac_emisor": datos_sensor.get("mac_emisor", "unknown")
                })

            payload["micros"].append(micro_data)

        # Convertir a JSON y enviar
        json_payload = json.dumps(payload)
        client.publish(MQTT_TOPIC, json_payload)

        print(f"✓ Datos MQTT enviados: {len(payload['micros'])} micros, {sum(len(m['sensors']) for m in payload['micros'])} sensores")
        return True

    except Exception as e:
        print(f"✗ Error enviando MQTT: {e}")
        return False

# ============================================================================
# LIMPIEZA DE DATOS ANTIGUOS
# ============================================================================
def limpiar_datos_antiguos(max_age_ms=30000):
    """Elimina datos más antiguos que max_age_ms (30 segundos por defecto)."""
    global datos_recibidos

    ahora = time.ticks_ms()
    micros_a_eliminar = []

    for micro_id, sensores in datos_recibidos.items():
        sensores_a_eliminar = []

        for sensor_id, datos_sensor in sensores.items():
            edad = time.ticks_diff(ahora, datos_sensor.get("received_at", 0))
            if edad > max_age_ms:
                sensores_a_eliminar.append(sensor_id)

        # Eliminar sensores antiguos
        for sensor_id in sensores_a_eliminar:
            del sensores[sensor_id]

        # Si no quedan sensores en este micro, marcarlo para eliminar
        if not sensores:
            micros_a_eliminar.append(micro_id)

    # Eliminar micros vacíos
    for micro_id in micros_a_eliminar:
        del datos_recibidos[micro_id]

    if micros_a_eliminar:
        print(f"Limpiados {len(micros_a_eliminar)} micros sin datos recientes")

# ============================================================================
# FUNCIÓN PRINCIPAL
# ============================================================================
def main():
    global datos_recibidos, ultimo_envio_mqtt

    print("========================================")
    print("   GATEWAY ESP-NOW + MQTT (CON SENSORES LOCALES)")
    print("========================================")
    print(f"WiFi SSID: {WIFI_SSID}")
    print(f"MQTT Broker: {MQTT_BROKER}:{MQTT_PORT}")
    print(f"Topic: {MQTT_TOPIC}")
    print(f"Intervalo envío: {SEND_INTERVAL_MS/1000} segundos")
    print(f"PMK: {PMK.hex() if len(PMK) <= 16 else PMK[:16].hex()+'...'}")
    print(f"Canal WiFi: {WIFI_CHANNEL} (0=auto)")
    print(f"Gateway Micro ID: {GATEWAY_MICRO_ID}")
    print(f"Gateway Sensor IDs: {GATEWAY_SENSOR_IDS}")
    print(f"Pines I2S: SCK={SCK_PIN}, WS={WS_PIN}, SD1={SD_PIN_1}, SD2={SD_PIN_2}")
    print("========================================\n")

    # Inicializar ESP-NOW
    espnow_obj = inicializar_espnow_receptor()

    # Conectar WiFi y MQTT
    wifi_conectado = False
    mqtt_client = None

    contador_ciclos = 0

    try:
        while True:
            # 1. Mantener conexión WiFi
            if not wifi_conectado:
                wifi_conectado = conectar_wifi()

            # 2. Mantener conexión MQTT
            if wifi_conectado and mqtt_client is None:
                mqtt_client = conectar_mqtt()

            # 3. Procesar datos ESP-NOW
            procesar_datos_espnow(espnow_obj)

            # 4. Leer sensores locales cada 500ms (ajustable)
            if contador_ciclos % 5 == 0:  # Cada ~500ms (0.1s * 5)
                try:
                    dB1, dB2 = leer_sensores_locales()
                    if GATEWAY_MICRO_ID not in datos_recibidos:
                        datos_recibidos[GATEWAY_MICRO_ID] = {}

                    timestamp_local = time.ticks_ms()
                    datos_recibidos[GATEWAY_MICRO_ID][GATEWAY_SENSOR_IDS[0]] = {
                        "value": round(dB1, 1),
                        "timestamp": timestamp_local,
                        "mac_emisor": "local",
                        "received_at": timestamp_local
                    }
                    datos_recibidos[GATEWAY_MICRO_ID][GATEWAY_SENSOR_IDS[1]] = {
                        "value": round(dB2, 1),
                        "timestamp": timestamp_local,
                        "mac_emisor": "local",
                        "received_at": timestamp_local
                    }

                    if contador_ciclos % 50 == 0:  # Cada ~5 segundos
                        print(f"📡 Gateway local - Sensor 1: {dB1:.1f} dB | Sensor 2: {dB2:.1f} dB")
                except Exception as e:
                    print(f"Error procesando sensores locales: {e}")

            # 5. Enviar datos MQTT periódicamente
            ahora = time.ticks_ms()
            if (time.ticks_diff(ahora, ultimo_envio_mqtt) >= SEND_INTERVAL_MS and
                datos_recibidos and mqtt_client):

                if enviar_mqtt(mqtt_client, datos_recibidos):
                    ultimo_envio_mqtt = ahora
                    # Limpiar datos después de enviar (opcional)
                    # datos_recibidos = {}

            # 6. Limpiar datos antiguos cada 10 ciclos
            if contador_ciclos % 10 == 0:
                limpiar_datos_antiguos()

                # Mostrar estadísticas
                total_micros = len(datos_recibidos)
                total_sensores = sum(len(s) for s in datos_recibidos.values())

                # Contar sensores locales
                sensores_locales = 0
                if GATEWAY_MICRO_ID in datos_recibidos:
                    sensores_locales = len(datos_recibidos[GATEWAY_MICRO_ID])

                print(f"📊 Estado: {total_micros} micros, {total_sensores} sensores ({sensores_locales} locales)")

                # Mostrar estado de memoria
                gc.collect()
                libre = gc.mem_free() / 1000
                usada = gc.mem_alloc() / 1000
                print(f"RAM: Libre {libre:.1f} KB | Usada {usada:.1f} KB")

            # 7. Pequeña pausa
            time.sleep(0.1)
            contador_ciclos += 1

    except KeyboardInterrupt:
        print("\n\nPrograma detenido por el usuario")
    except Exception as e:
        print(f"\nError en main: {e}")
        import sys
        sys.print_exception(e)
    finally:
        # Limpieza
        print("\nLiberando recursos...")
        if mqtt_client:
            try:
                mqtt_client.disconnect()
            except:
                pass

        espnow_obj.active(False)
        try:
            audio_in1.deinit()
            audio_in2.deinit()
        except Exception as e:
            print(f"Error liberando recursos I2S: {e}")
        print("Recursos liberados")

# ============================================================================
# PUNTO DE ENTRADA
# ============================================================================
if __name__ == "__main__":
    main()
