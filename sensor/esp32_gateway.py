"""Gateway ESP32 - PING/PONG conexión con Sender mediante ESPNOW y MQTT para envió de datos."""

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
from machine import WDT, Pin
from umqtt.simple import MQTTClient

# ── LED ────────────────────────────────────────────────────────────────────────
led = Pin(LED_PIN, Pin.OUT)
led.off()


def blink(times=1):
    for _ in range(times):
        led.on()
        time.sleep(0.05)
        led.off()
        if times > 1:
            time.sleep(0.05)


# ── WiFi: reconexión SIN tocar wifi.active() ───────────────────────────────────
def reconectar_wifi(wifi, canal_anterior, ssid, password, intentos=10):
    """Reconecta WiFi sin desactivar la interfaz (ESP-NOW sobrevive).

    Returns:
        (bool, int): (éxito, canal_actual)
    """
    print("[WiFi] Desconectado — reconectando sin bajar interfaz...")
    try:
        wifi.connect(ssid, password)
    except Exception as e:
        print(f"[WiFi] Error al llamar connect(): {e}")
        return False, canal_anterior

    for _ in range(intentos):
        if wifi.isconnected():
            try:
                canal = wifi.config("channel")
            except Exception:
                canal = canal_anterior
            print(f"[WiFi] Reconectado. Canal: {canal}")
            return True, canal
        time.sleep(0.5)

    print("[WiFi] No se pudo reconectar en el tiempo límite.")
    return False, canal_anterior


# ── MQTT con timeout ──────────────────────────────────────────────────────────
def enviar_mqtt(broker, port, client_id, user, password, topic, payload):
    """Intenta publicar en MQTT. Retorna True si tuvo éxito."""
    import usocket as socket

    # Configurar socket timeout antes de conectar
    # umqtt.simple abre el socket internamente, pero podemos parchear el timeout
    # usando la constante IPPROTO_TCP disponible en MicroPython.
    client = MQTTClient(
        client_id,
        broker,
        port,
        user if user else None,
        password if password else None,
        keepalive=10,
    )
    # MicroPython expone el socket en client.sock después de connect(),
    # pero podemos setear SO_TIMEOUT antes si accedemos al socket directamente.
    # Como alternativa segura usamos keepalive=10 y confiamos en el WDT global.
    client.connect()
    client.publish(topic, payload)
    client.disconnect()
    return True


# ── Main ───────────────────────────────────────────────────────────────────────
def main():
    print("=" * 40)
    print("GATEWAY ROBUSTO")
    print("=" * 40)

    # Watchdog: si el bucle se congela >45 s, reinicia el ESP32
    wdt = WDT(timeout=45_000)

    # 1. WiFi (activar UNA SOLA VEZ)
    wifi = network.WLAN(network.STA_IF)
    wifi.active(True)
    wifi.connect(WIFI_SSID, WIFI_PASSWORD)

    for _ in range(20):
        wdt.feed()
        if wifi.isconnected():
            break
        time.sleep(0.5)

    if not wifi.isconnected():
        print("[WiFi] No conectó en el arranque — reiniciando...")
        # El WDT reiniciará si se congela; forzamos reinicio manual
        import machine

        machine.reset()

    try:
        canal = wifi.config("channel")
    except Exception:
        canal = 1

    ip = wifi.ifconfig()[0]
    mac = wifi.config("mac")
    mac_fmt = ":".join(f"{b:02x}" for b in mac)
    print(f"IP : {ip}")
    print(f"MAC: {mac_fmt}")
    print(f"CH : {canal}")
    print("=" * 40)

    # 2. ESP-NOW (la interfaz WiFi ya está activa; nunca se baja)
    e = espnow.ESPNow()
    e.active(True)
    print("ESP-NOW listo")

    # 3. Estado
    datos = {}  # micro_id -> [valores float]
    ultimo_envio = time.time()
    mensajes_rx = 0
    errores_mqtt = 0
    COOLDOWN_FALLO = 15  # segundos mínimos entre intentos si hay fallo MQTT

    # 4. Bucle principal
    try:
        while True:
            wdt.feed()  # ← siempre al inicio del bucle

            # ── Recibir ESP-NOW ────────────────────────────────────────────
            try:
                host, msg = e.recv(0)
            except (OSError, ValueError):
                host, msg = None, None

            if msg:
                mensajes_rx += 1

                # Asegurar peer para poder responder
                try:
                    e.add_peer(host)
                except OSError:
                    pass

                # ── PING → PONG ────────────────────────────────────────────
                if msg == b"PING" or msg.startswith(b"PING"):
                    try:
                        ch_actual = wifi.config("channel")
                    except Exception:
                        ch_actual = canal
                    respuesta = f"PONG:{ch_actual}".encode()
                    try:
                        e.send(host, respuesta)
                        print(f"[PONG] → {host.hex()[:8]} canal {ch_actual}")
                    except Exception as err:
                        print(f"[PONG] Error: {err}")

                # ── Datos de sensor ("E1:45.2") ────────────────────────────
                else:
                    try:
                        texto = msg.decode().strip()
                        if ":" in texto:
                            micro, valor = texto.split(":", 1)
                            if valor not in ("INICIO", "FIN"):
                                db = float(valor)
                                bucket = datos.setdefault(micro, [])
                                bucket.append(db)
                                if len(bucket) > 3:
                                    datos[micro] = bucket[-3:]
                                print(f"[RX] {micro}: {db:.1f} dB  (msg#{mensajes_rx})")
                                blink(1)
                    except (UnicodeDecodeError, ValueError):
                        pass

            # ── Envío MQTT ─────────────────────────────────────────────────
            ahora = time.time()
            tiempo_desde_ultimo = ahora - ultimo_envio

            if tiempo_desde_ultimo >= MQTT_SEND_INTERVAL and datos:
                print(
                    f"\n[MQTT] Ciclo — {len(datos)} sensores, {errores_mqtt} errores previos"
                )

                # Verificar/reconectar WiFi SIN bajar interfaz
                if not wifi.isconnected():
                    ok, canal = reconectar_wifi(wifi, canal, WIFI_SSID, WIFI_PASSWORD)
                    if not ok:
                        print("[MQTT] Sin WiFi — datos conservados, esperando cooldown")
                        ultimo_envio = (
                            ahora  # avanzar timer para no reintentar inmediatamente
                        )
                        time.sleep(0.1)
                        continue

                # Refrescar canal real
                try:
                    canal = wifi.config("channel")
                except Exception:
                    pass

                # Construir payload
                try:
                    ch_actual = wifi.config("channel")
                except Exception:
                    ch_actual = canal

                payload = {
                    "timestamp": int(ahora),
                    "gateway_mac": mac_fmt,
                    "gateway_channel": ch_actual,
                    "sensors": [
                        {"micro_id": mid, "value": round(db, 1), "sample": i + 1}
                        for mid, muestras in datos.items()
                        for i, db in enumerate(muestras)
                    ],
                }
                n_muestras = len(payload["sensors"])

                # Intentar envío
                try:
                    wdt.feed()
                    enviar_mqtt(
                        MQTT_BROKER,
                        MQTT_PORT,
                        MQTT_CLIENT_ID,
                        MQTT_USER,
                        MQTT_PASSWORD,
                        MQTT_TOPIC,
                        json.dumps(payload),
                    )
                    print(f"[MQTT] ✓ {n_muestras} muestras enviadas")
                    blink(2)
                    datos = {}  # limpiar solo en éxito
                    errores_mqtt = 0
                    ultimo_envio = ahora

                except Exception as err:
                    errores_mqtt += 1
                    print(f"[MQTT] ✗ Error #{errores_mqtt}: {err}")
                    print(
                        f"[MQTT] Datos conservados — próximo intento en {COOLDOWN_FALLO}s"
                    )
                    # Avanzar timer con cooldown para no martillar el broker
                    ultimo_envio = ahora - MQTT_SEND_INTERVAL + COOLDOWN_FALLO

                time.sleep(1)  # pausa post-ciclo MQTT

            time.sleep(0.05)  # CPU yield

    except KeyboardInterrupt:
        print("\n[GATEWAY] Interrupción por usuario")
    finally:
        e.active(False)
        led.off()
        print("[GATEWAY] Detenido")


if __name__ == "__main__":
    main()
