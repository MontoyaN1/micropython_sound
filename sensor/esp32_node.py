"""
Sensor ESP32 con INMP441 - Captura dB y envía por MQTT
Versión robusta con reconexión automática y buffer de emergencia
"""

import json
import math
import random
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
from machine import I2S, Pin, unique_id
from umqtt.simple import MQTTClient

# ========== CONFIGURACIÓN ==========
SCK_PIN, WS_PIN, SD_PIN = 14, 25, 34
SAMPLE_RATE = 16000
MICRO_ID = "E1"
CAPTURE_INTERVAL = 5
SEND_INTERVAL = 10
MAX_LECTURAS = 12
MAX_BUFFER = 50
WIFI_MAX_RETRIES = 30
MQTT_TIMEOUT = 10

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

# ========== ESTADO GLOBAL ==========
wifi_ok = mqtt_ok = False
buffer_emerg = []
ultimo_envio = 0
retry_wifi = retry_mqtt = 0


# ========== UTILIDADES ==========
def parpadear(n, t=0.1):
    for i in range(n):
        led.on()
        time.sleep(t)
        led.off()
        if i < n - 1:
            time.sleep(t)


def mac():
    try:
        return "{:02X}".format(unique_id()[-1])
    except:
        return MICRO_ID


# ========== WIFI ROBUSTO ==========
def wifi_conectar():
    global wifi_ok, retry_wifi
    sta = network.WLAN(network.STA_IF)
    sta.active(True)
    if sta.isconnected():
        wifi_ok = True
        retry_wifi = 0
        return True
    print("WiFi desconectado, conectando...")
    parpadear(3, 0.15)
    sta.connect(WIFI_SSID, WIFI_PASSWORD)
    inicio = time.time()
    while not sta.isconnected() and (time.time() - inicio) < WIFI_MAX_RETRIES:
        parpadear(2, 0.1)
        time.sleep(0.5)
    if sta.isconnected():
        print("WiFi OK:", sta.ifconfig()[0])
        wifi_ok = True
        retry_wifi = 0
        return True
    wifi_ok = False
    retry_wifi += 1
    delay = min(1 * (2**retry_wifi) + random.random(), 60)
    print(f"WiFi reintento {retry_wifi} en {delay:.1f}s")
    return False


def wifi_verificar():
    global wifi_ok
    sta = network.WLAN(network.STA_IF)
    wifi_ok = sta.isconnected()
    return wifi_ok


# ========== MQTT ROBUSTO ==========
def mqtt_conectar():
    global mqtt_ok, retry_mqtt
    try:
        c = MQTTClient(
            MQTT_CLIENT_ID + "_" + mac(),
            MQTT_BROKER,
            MQTT_PORT,
            MQTT_USER or None,
            MQTT_PASSWORD or None,
            keepalive=60,
        )
        c.connect()
        mqtt_ok = True
        retry_mqtt = 0
        print("MQTT conectado")
        return c
    except Exception as e:
        mqtt_ok = False
        retry_mqtt += 1
        print(f"MQTT error: {e}, reintento {retry_mqtt}")
        return None


def mqtt_enviar(client, payload):
    global mqtt_ok
    try:
        client.publish(MQTT_TOPIC, payload)
        return True
    except Exception as e:
        print(f"MQTT publish error: {e}")
        mqtt_ok = False
        return False


# ========== AUDIO ==========
def leer_db():
    suma = count = 0
    for _ in range(10):
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


# ========== BUFFER EMERGENCIA ==========
def guardar_emergencia(lecturas):
    global buffer_emerg
    if not lecturas:
        return
    buffer_emerg.append(
        {
            "timestamp": int(time.time()),
            "sensors": [
                {"micro_id": MICRO_ID, "value": db, "sample": i + 1}
                for i, db in enumerate(lecturas)
            ],
        }
    )
    if len(buffer_emerg) > MAX_BUFFER:
        buffer_emerg = buffer_emerg[-MAX_BUFFER:]


def flush_emergencia(client):
    global buffer_emerg, ultimo_envio
    ok = []
    for i, e in enumerate(buffer_emerg):
        if mqtt_enviar(client, json.dumps(e)):
            ok.append(i)
            ultimo_envio = time.time()
    for i in reversed(ok):
        buffer_emerg.pop(i)
    if ok:
        print(f"Emergencia enviada: {len(ok)}")


# ========== MAIN ==========
def main():
    global ultimo_envio
    print("SENSOR MQTT -", MICRO_ID, "| Mac:", mac())
    mqtt_client = None
    lecturas = []
    t_lect = time.ticks_ms()
    t_env = time.ticks_ms()
    t_wifi = time.ticks_ms()

    while True:
        ahora = time.ticks_ms()

        # Verificar WiFi cada 5s
        if time.ticks_diff(ahora, t_wifi) >= 5000:
            if not wifi_verificar():
                wifi_conectar()
            t_wifi = ahora

        # Reconectar MQTT si necesario
        if wifi_ok and not mqtt_ok:
            mqtt_client = mqtt_conectar()

        # Captura de audio
        if time.ticks_diff(ahora, t_lect) >= CAPTURE_INTERVAL * 1000:
            db = leer_db()
            lecturas.append(db)
            if len(lecturas) > MAX_LECTURAS:
                lecturas = lecturas[-MAX_LECTURAS:]
            print(f"Lectura {len(lecturas)}: {db} dB")
            parpadear(1)
            t_lect = ahora

        # Envío programado
        if time.ticks_diff(ahora, t_env) >= SEND_INTERVAL * 1000 and lecturas:
            if mqtt_client and mqtt_ok:
                payload = json.dumps(
                    {
                        "timestamp": int(time.time()),
                        "sensors": [
                            {"micro_id": MICRO_ID, "value": db, "sample": i + 1}
                            for i, db in enumerate(lecturas)
                        ],
                    }
                )
                if mqtt_enviar(mqtt_client, payload):
                    print(f"Enviado {len(lecturas)} lecturas")
                    parpadear(2)
                    lecturas = []
                    ultimo_envio = time.time()
                    flush_emergencia(mqtt_client)
                else:
                    guardar_emergencia(lecturas)
                    lecturas = []
            else:
                guardar_emergencia(lecturas)
                lecturas = []
            t_env = ahora

        # Reconectar MQTT tras inactividad prolongada
        if (
            ultimo_envio > 0
            and (time.time() - ultimo_envio) > 300
            and wifi_ok
            and not mqtt_ok
        ):
            print("Reconectando MQTT tras inactividad...")
            mqtt_client = mqtt_conectar()

        time.sleep(0.1)


if __name__ == "__main__":
    main()
