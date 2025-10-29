"""El siguiente código es la logica para capturar los datos del
sensor de sonido (INMP441), con el fin de determinar los decibelios
 y enviarlo a un servicio en la nube por MQTT. Además de contar con un apartado para ver el uso de RAM"""

from machine import I2S, Pin
import time
import math
import network
from umqtt.simple import MQTTClient
import json
import gc
from config import *

# Logica conexión con sensor y conversion a decibelios
# //////////////////////////////////////////////////////

audio_in = I2S(
    0,
    sck=Pin(14),
    ws=Pin(25),
    sd=Pin(35),
    mode=I2S.RX,
    bits=16,
    format=I2S.MONO,
    rate=16000,
    ibuf=5000,
)
audio_in2 = I2S(
    0,
    sck=Pin(14),
    ws=Pin(25),
    sd=Pin(34),
    mode=I2S.RX,
    bits=16,
    format=I2S.MONO,
    rate=16000,
    ibuf=5000,
)

samples = bytearray(512)
samples2 = bytearray(512)
SENSIBILIDAD = -3.0
P_REF = 0.00002
VOLTAJE_REF = 3.3
MAX_AMPLITUD = 32767


def amplitud_a_dB(amplitud):
    if amplitud < 2:
        return 0
    voltaje = (amplitud / MAX_AMPLITUD) * VOLTAJE_REF
    factor = 10 ** (SENSIBILIDAD / 20)
    presion = voltaje / factor
    if presion < P_REF:
        return 0
    return max(0, 20 * math.log10(presion / P_REF))


def bytes_to_signed(byte_data):
    value = int.from_bytes(byte_data, "little")
    return value - 65536 if value >= 32768 else value


def calcular_RMS(samples, bytes_read):
    suma, count = 0, min(100, bytes_read // 2)
    for j in range(0, count * 2, 2):
        sample = bytes_to_signed(samples[j : j + 2])
        suma += sample * sample
    return int(math.sqrt(suma / count)) if count > 0 else 0


# //////////////////////////////////////////////////////

# Logica de envió MQTT a servidor y conexión WIFi
# //////////////////////////////////////////////////////

SSID = WIFI_SSID
SSID_PASS = WIFI_PASSWORD
SERVER = MQTT_BROKER
SERVER_PORT = MQTT_PORT


def connect_wifi():
    wlan = network.WLAN(network.STA_IF)
    wlan.active(True)

    if not wlan.isconnected():
        print("Conectando a WiFi...")
        wlan.connect(SSID, SSID_PASS)

        for i in range(15):
            if wlan.isconnected():
                break
            time.sleep(1)

    if wlan.isconnected():
        print("WiFi conectada:", wlan.ifconfig()[0])
        return True
    else:
        print("Error: No se pudo conectar a WiFi")
        return False


def mqtt_callback(topic, msg):
    print(f"MQTT: {topic} -> {msg}")


def connect_mqtt():
    try:
        client = MQTTClient(
            client_id="micro_01", server=SERVER, port=SERVER_PORT, keepalive=30
        )
        client.set_callback(mqtt_callback)
        client.connect()
        print("Conectado a MQTT")
        return client
    except OSError as e:
        print(f"Error de red MQTT: {e}")
        return None
    except Exception as e:
        print(f"Error MQTT: {e}")
        return None


def publish_mqtt(sensor_data: dict, client: MQTTClient):
    """Publicar datos de sensores en formato JSON"""
    try:
        payload = json.dumps(sensor_data)
        client.publish("sensors/sound/data", payload)
        print(f"Datos publicados: {payload}")
    except Exception as e:
        print(f"Error publicando MQTT: {e}")


# //////////////////////////////////////////////////////

# Logica principal o main
# //////////////////////////////////////////////////////
try:
    print("SONÓMETRO INMP441")
    print("Ctrl+C para detener\n")

    gc.collect()
    client = None

    wifi = connect_wifi()
    dB: float = 0.0
    dB2: float = 0.0

    while True:
        if not wifi:
            print("Sin conexión WiFi, reintentando...")
            time.sleep(5)
            continue

        if client is None:
            try:
                client = connect_mqtt()
            except Exception as e:
                print(f"Error conectando MQTT: {e}")
                client = None
                time.sleep(3)
                continue

        bytes_read = audio_in.readinto(samples)
        bytes_read2 = audio_in2.readinto(samples2)

        if bytes_read > 0 and bytes_read2 > 0:
            amplitud = calcular_RMS(samples, bytes_read)
            amplitud2 = calcular_RMS(samples2, bytes_read2)
            dB = amplitud_a_dB(amplitud)
            dB2 = amplitud_a_dB(amplitud2)

            print(f"Sensor 1: {dB:.1f} dB")
            print(f"Sensor 2: {dB2:.1f} dB")

            # Payload
            sensor_data = {
                "micro_id": "micro_01",
                "sensors": [
                    {"sensor_id": "sound_01", "value": int(dB)},
                    {"sensor_id": "sound_02", "value": int(dB2)},
                ],
            }

        publish_mqtt(sensor_data, client)

        gc.collect()
        current_mem = gc.mem_free()
        used_mem = gc.mem_alloc()

        print(f"RAM libre: {current_mem / 1000} KB | RAM usada: {used_mem / 1000} KB")

        time.sleep(1)

except KeyboardInterrupt:
    print("\nMedición finalizada")
except Exception as e:
    print("Error en main:", e)
finally:
    if client:
        try:
            client.disconnect()
        except Exception as e:
            print(f"Error: {e}")

    audio_in.deinit()
    audio_in2.deinit()
# //////////////////////////////////////////////////////
