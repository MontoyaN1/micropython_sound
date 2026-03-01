"""Gateway ESP32 minimalista - PING/PONG para sincronización de canales
Basado en el ejemplo simple del usuario. Responde PING, recibe datos, envía MQTT.
WiFi se reconecta solo cuando es necesario para MQTT.
"""

import json
import time

import espnow
import network
from config import (
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

# LED para feedback
led = Pin(LED_PIN, Pin.OUT)
led.off()


def blink(times=1):
    """Parpadeo simple."""
    for _ in range(times):
        led.on()
        time.sleep(0.05)
        led.off()
        if times > 1:
            time.sleep(0.05)


def main():
    print("=" * 40)
    print("GATEWAY MINIMAL")
    print("=" * 40)
    print(f"WiFi: {WIFI_SSID}")
    print(f"MQTT: {MQTT_BROKER}:{MQTT_PORT}")
    print("=" * 40)

    # 1. Conectar WiFi
    wifi = network.WLAN(network.STA_IF)
    wifi.active(True)
    wifi.connect(WIFI_SSID, WIFI_PASSWORD)

    for _ in range(20):  # 10 segundos máximo
        if wifi.isconnected():
            break
        time.sleep(0.5)

    if not wifi.isconnected():
        print("Error WiFi")
        return

    ip = wifi.ifconfig()[0]
    try:
        canal = wifi.config("channel")
        print(f"Canal: {canal}")
    except:
        canal = 1  # Canal por defecto si hay error
        print(f"Canal: {canal} (por defecto, error al obtener)")
    print(f"WiFi OK: {ip}")

    # Mostrar MAC
    mac = wifi.config("mac").hex()
    mac_fmt = ":".join(mac[i : i + 2] for i in range(0, 12, 2))
    print(f"MAC: {mac_fmt}")

    # 2. Inicializar ESP-NOW
    e = espnow.ESPNow()
    e.active(True)
    print("ESP-NOW listo (responde PING)")
    print("=" * 40)

    # 3. Variables
    datos = {}  # micro_id: [valores]
    ultimo_envio = 0
    mensajes = 0

    # 4. Bucle principal
    try:
        while True:
            # Recibir mensajes (non-blocking)
            try:
                host, msg = e.recv(0)
                if msg:
                    mensajes += 1
                    # Asegurar que el host está agregado como peer para poder responder
                    try:
                        e.add_peer(host)
                    except OSError:
                        pass  # Ya está agregado o error, continuar

                    # Siempre imprimir mensajes recibidos para debugging
                    print(f"RCV[{mensajes}]: {msg}")

                    # Responder PING
                    if msg == b"PING" or msg.startswith(b"PING"):
                        try:
                            current_channel = wifi.config("channel")
                        except:
                            current_channel = canal
                        respuesta = f"PONG:{current_channel}".encode()
                        try:
                            e.send(host, respuesta)
                            print(
                                f"✓ PONG enviado a {host.hex()[:8]}... canal {current_channel}"
                            )
                        except Exception as send_err:
                            print(f"✗ Error enviando PONG: {send_err}")

                    # Datos de sensor (formato "E1:45.2")
                    try:
                        texto = msg.decode().strip()
                        if ":" in texto and not texto.startswith("PING"):
                            micro, valor = texto.split(":")
                            if valor not in ["INICIO", "FIN"]:
                                try:
                                    db = float(valor)
                                    if micro not in datos:
                                        datos[micro] = []
                                    datos[micro].append(db)
                                    # Máximo 3 muestras
                                    if len(datos[micro]) > 3:
                                        datos[micro] = datos[micro][-3:]
                                    # Siempre imprimir datos de sensores
                                    print(f"  {micro}: {db:.1f} dB")
                                    blink(1)
                                except ValueError:
                                    pass
                    except UnicodeDecodeError:
                        pass  # No es texto
            except (OSError, ValueError):
                pass  # No hay mensajes

            # Enviar MQTT cada 10 segundos (si hay datos)
            ahora = time.time()
            if ahora - ultimo_envio >= MQTT_SEND_INTERVAL and datos:
                print(f"\n[MQTT] {len(datos)} sensores con datos")

                # Verificar WiFi antes de enviar
                wifi_ok = wifi.isconnected()
                if not wifi_ok:
                    print("[WiFi] Desconectado, intentando reconectar...")
                    try:
                        # Resetear interfaz si está en estado de error
                        wifi.active(False)
                        time.sleep(0.5)
                        wifi.active(True)
                        time.sleep(0.5)
                        wifi.connect(WIFI_SSID, WIFI_PASSWORD)

                        # Esperar conexión
                        for _ in range(10):
                            if wifi.isconnected():
                                wifi_ok = True
                                try:
                                    canal = wifi.config("channel")
                                    print(f"[WiFi] Reconectado, canal {canal}")
                                except:
                                    print(f"[WiFi] Reconectado, canal anterior {canal}")
                                break
                            time.sleep(0.5)
                    except Exception as w_err:
                        print(f"[WiFi] Error reconectando: {w_err}")

                if not wifi_ok:
                    print("[WiFi] No se pudo reconectar, datos guardados")
                    print(f"[MQTT] {len(datos)} muestras pendientes")
                    # No limpiar datos, intentar en próximo ciclo
                    time.sleep(1)
                    continue

                # Preparar JSON (usar canal actual o anterior si hay error)
                try:
                    current_channel = wifi.config("channel")
                except:
                    current_channel = canal

                mensaje = {
                    "timestamp": int(ahora),
                    "gateway_mac": mac_fmt,
                    "gateway_channel": current_channel,
                    "sensors": [],
                }

                for micro, muestras in datos.items():
                    for i, db in enumerate(muestras):
                        mensaje["sensors"].append(
                            {
                                "micro_id": micro,
                                "value": round(db, 1),
                                "sample": i + 1,
                            }
                        )

                print(f"Enviando {len(mensaje['sensors'])} muestras...")

                # Enviar
                try:
                    mqtt = MQTTClient(
                        MQTT_CLIENT_ID,
                        MQTT_BROKER,
                        MQTT_PORT,
                        MQTT_USER if MQTT_USER else None,
                        MQTT_PASSWORD if MQTT_PASSWORD else None,
                    )
                    mqtt.connect()
                    mqtt.publish(MQTT_TOPIC, json.dumps(mensaje))
                    print(f"✓ MQTT enviado")
                    blink(2)

                    # Limpiar datos enviados
                    datos = {}
                    ultimo_envio = ahora

                    mqtt.disconnect()
                except Exception as err:
                    print(f"✗ MQTT error: {err}")
                    print(f"Datos guardados para próximo intento")

                time.sleep(1)  # Pausa post-envío

            time.sleep(0.1)  # Pausa para CPU

    except KeyboardInterrupt:
        print("\n\nInterrupción por usuario")
    finally:
        e.active(False)
        led.off()
        print("Hasta luego!")


if __name__ == "__main__":
    main()
