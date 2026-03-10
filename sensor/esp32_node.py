"""
Sensor ESP32 con INMP441 - Captura dB y envía por MQTT
"""

import json
import math
import time

import network
from config import (
    LED_PIN,
    MQTT_BROKER,
    MQTT_CLIENT_ID,
    MQTT_PASSWORD,
    MQTT_PORT,
    MQTT_TOPIC,
    MQTT_USER,
    WIFI_PASSWORD,
    WIFI_SSID,
)
from machine import I2S, Pin
from umqtt.simple import MQTTClient

# ========== CONFIGURACIÓN ==========
SCK_PIN = 14
WS_PIN = 25
SD_PIN = 34
SAMPLE_RATE = 16000
MICRO_ID = "E1"
CAPTURE_INTERVAL = 5  # segundos entre lecturas dB
SEND_INTERVAL = 10  # segundos entre envíos MQTT
MAX_LECTURAS = 6  # máximo acumulado antes de descartar los más viejos

# ========== HARDWARE ==========
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
led = Pin(LED_PIN, Pin.OUT)
led.off()


# ========== UTILIDADES ==========
def parpadear(veces, intervalo=0.1):
    for i in range(veces):
        led.on()
        time.sleep(intervalo)
        led.off()
        if i < veces - 1:
            time.sleep(intervalo)


def wifi_conectar():
    sta = network.WLAN(network.STA_IF)
    sta.active(True)
    if sta.isconnected():
        return
    print("Conectando WiFi...")
    sta.connect(WIFI_SSID, WIFI_PASSWORD)
    for _ in range(20):
        parpadear(3, 0.15)  # 3 parpadeos = intentando conectar
        if sta.isconnected():
            print("WiFi OK:", sta.ifconfig()[0])
            return
    raise RuntimeError("WiFi falló")


def mqtt_publicar(payload):
    """Conecta fresco, publica y desconecta. Sin estado persistente."""
    sta = network.WLAN(network.STA_IF)
    if not sta.isconnected():
        try:
            wifi_conectar()
        except Exception as e:
            print("WiFi falló:", e)
            parpadear(3, 0.2)
            return False
    try:
        c = MQTTClient(
            MQTT_CLIENT_ID,
            MQTT_BROKER,
            MQTT_PORT,
            MQTT_USER or None,
            MQTT_PASSWORD or None,
        )
        c.connect()
        c.publish(MQTT_TOPIC, payload)
        c.disconnect()
        return True
    except Exception as e:
        print("MQTT falló:", e)
        parpadear(3, 0.2)
        return False


# ========== AUDIO ==========
def leer_db():
    suma, count = 0, 0
    for _ in range(10):  # ~10 bloques = ~320ms
        n = audio_in.readinto(samples)
        if n > 0:
            for i in range(0, (n // 2) * 2, 2):
                v = int.from_bytes(samples[i : i + 2], "little")
                if v >= 32768:
                    v -= 65536
                suma += v * v
                count += 1
    if count == 0 or suma == 0:
        return 0.0
    rms = math.sqrt(suma / count)
    if rms < 2:
        return 0.0
    voltaje = (rms / 32767) * 3.3
    presion = voltaje / (10 ** (-3.0 / 20))
    if presion < 0.00002:
        return 0.0
    return round(max(0.0, 20 * math.log10(presion / 0.00002)), 1)


# ========== MAIN ==========
def main():
    print("SENSOR MQTT -", MICRO_ID)

    wifi_conectar()

    lecturas = []
    t_lectura = time.ticks_ms()
    t_envio = time.ticks_ms()

    while True:
        ahora = time.ticks_ms()

        # Captura cada CAPTURE_INTERVAL
        if time.ticks_diff(ahora, t_lectura) >= CAPTURE_INTERVAL * 1000:
            db = leer_db()
            lecturas.append(db)
            if len(lecturas) > MAX_LECTURAS:
                lecturas = lecturas[-MAX_LECTURAS:]
            print(f"Lectura {len(lecturas)}: {db} dB")
            parpadear(1)
            t_lectura = ahora

        # Envío cada SEND_INTERVAL
        if time.ticks_diff(ahora, t_envio) >= SEND_INTERVAL * 1000 and lecturas:
            payload = json.dumps(
                {
                    "timestamp": int(time.time()),
                    "sensors": [
                        {"micro_id": MICRO_ID, "value": db, "sample": i + 1}
                        for i, db in enumerate(lecturas)
                    ],
                }
            )
            if mqtt_publicar(payload):
                print(f"Enviado {len(lecturas)} lecturas")
                parpadear(2)
                lecturas = []
            else:
                print("Reintentando en el próximo ciclo")
            t_envio = ahora

        time.sleep(0.05)


if __name__ == "__main__":
    main()
