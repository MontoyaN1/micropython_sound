"""Gateway ESP32 simple - Alterna entre ESPNOW y MQTT.
Captura datos 5 segundos, envía por MQTT cada 10 segundos.
Sincronizado con senders que envían cada 5 segundos.
"""

import json
import time

import espnow
import network
from config import (
    ESPNOW_CAPTURE_TIME,
    LED_PIN,
    MQTT_BROKER,
    MQTT_CLIENT_ID,
    MQTT_PASSWORD,
    MQTT_PORT,
    MQTT_SEND_INTERVAL,
    MQTT_TOPIC,
    MQTT_USER,
    WIFI_PASSWORD,
    WIFI_SSID,
)
from machine import Pin
from umqtt.simple import MQTTClient

# LED
led = Pin(LED_PIN, Pin.OUT)
led.off()


def blink(times=1):
    """Parpadeo rápido."""
    for _ in range(times):
        led.on()
        time.sleep(0.05)
        led.off()
        if times > 1:
            time.sleep(0.05)


def main():
    print("=" * 40)
    print("GATEWAY SIMPLE")
    print("=" * 40)
    print(f"WiFi: {WIFI_SSID}")
    print(f"MQTT: {MQTT_BROKER}:{MQTT_PORT}")
    print(f"Capture: {ESPNOW_CAPTURE_TIME}s, Send: {MQTT_SEND_INTERVAL}s")
    print("=" * 40)

    # Variables
    datos = {}  # {micro_id: [valor1, valor2, valor3]}
    ultimo_envio = 0

    # Conectar WiFi
    wifi = network.WLAN(network.STA_IF)
    wifi.active(True)

    if not wifi.isconnected():
        print(f"Conectando a {WIFI_SSID}...")
        wifi.connect(WIFI_SSID, WIFI_PASSWORD)
        for _ in range(20):
            if wifi.isconnected():
                break
            time.sleep(0.5)

    if not wifi.isconnected():
        print("Error WiFi")
        return

    print(f"WiFi OK: {wifi.ifconfig()[0]}")

    while True:
        # === 1. CAPTURAR ESPNOW ===
        print(f"\n[ESPNOW] Capturando por {ESPNOW_CAPTURE_TIME}s...")
        blink(1)

        # Activar ESPNOW
        e = espnow.ESPNow()
        e.active(True)

        # Capturar por el tiempo configurado
        iterations = int(ESPNOW_CAPTURE_TIME * 10)  # Cada 0.1 segundos
        for _ in range(iterations):
            try:
                host, msg = e.recv(0)
                if msg:
                    texto = msg.decode("utf-8", "ignore").strip()
                    if ":" in texto:
                        micro, valor = texto.split(":")
                        if valor not in ["INICIO", "FIN"]:
                            try:
                                db = float(valor)
                                if micro not in datos:
                                    datos[micro] = []
                                datos[micro].append(db)
                                # Solo 3 muestras máximo
                                if len(datos[micro]) > 3:
                                    datos[micro] = datos[micro][-3:]
                                print(f"  {micro}: {db:.1f} dB")
                            except ValueError:
                                pass
            except (OSError, ValueError) as exeption:
                print(exeption)
                pass
            time.sleep(0.1)

        # Desactivar ESPNOW
        e.active(False)
        time.sleep(1.0)  # Pausa para estabilización

        # === 2. ENVIAR MQTT ===
        ahora = time.time()

        if ahora - ultimo_envio >= MQTT_SEND_INTERVAL and datos:
            print("\n[MQTT] Enviando...")

            # Preparar mensaje con todos los datos
            mensaje = {"timestamp": int(ahora), "sensors": []}

            for micro, muestras in datos.items():
                for i, db in enumerate(muestras):
                    mensaje["sensors"].append(
                        {
                            "micro_id": micro,
                            "value": round(db, 1),
                            "sample": i + 1,
                        }
                    )

            # Enviar MQTT
            try:
                # Configurar cliente MQTT con credenciales opcionales
                mqtt = MQTTClient(
                    MQTT_CLIENT_ID,
                    MQTT_BROKER,
                    MQTT_PORT,
                    MQTT_USER if MQTT_USER else None,
                    MQTT_PASSWORD if MQTT_PASSWORD else None,
                )
                mqtt.connect()
                mqtt.publish(MQTT_TOPIC, json.dumps(mensaje))
                print(f"✓ Enviado: {len(mensaje['sensors'])} muestras")
                blink(2)

                # Limpiar datos después de enviar
                datos = {}
                ultimo_envio = ahora
                mqtt.disconnect()
                time.sleep(1.0)  # Pausa antes de reactivar ESPNOW

            except Exception as e:
                print(f"✗ Error MQTT: {e}")

        # === 3. ESPERAR ===
        time.sleep(1.0)


if __name__ == "__main__":
    main()
