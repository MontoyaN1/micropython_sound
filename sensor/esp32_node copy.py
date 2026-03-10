"""
Sensor ESP32 con INMP441 - Captura dB y envía por MQTT (versión robusta)
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

CAPTURE_INTERVAL = 5  # segundos entre lecturas
SEND_INTERVAL = 10  # segundos entre envíos MQTT
MAX_RETRIES = 3  # reintentos de publicación
RETRY_DELAY = 1  # segundos entre reintentos

# ========== INICIALIZACIÓN HARDWARE ==========
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


# ========== FUNCIONES AUXILIARES ==========
def conectar_wifi():
    sta = network.WLAN(network.STA_IF)
    sta.active(True)
    if not sta.isconnected():
        print(f"Conectando WiFi '{WIFI_SSID}'...")
        sta.connect(WIFI_SSID, WIFI_PASSWORD)
        for _ in range(30):
            if sta.isconnected():
                break
            time.sleep(0.5)
    if sta.isconnected():
        print("WiFi OK, IP:", sta.ifconfig()[0])
        return sta
    else:
        raise RuntimeError("No se pudo conectar WiFi")


def verificar_wifi():
    """Verifica que WiFi siga conectado, si no, reconecta."""
    sta = network.WLAN(network.STA_IF)
    if not sta.isconnected():
        print("WiFi perdido, reconectando...")
        try:
            conectar_wifi()
        except Exception as e:
            print("Error reconectando WiFi:", e)
            return False
    return True


def conectar_mqtt():
    """Crea y conecta un cliente MQTT, retorna el cliente o None si falla."""
    try:
        cliente = MQTTClient(
            MQTT_CLIENT_ID,
            MQTT_BROKER,
            MQTT_PORT,
            MQTT_USER if MQTT_USER else None,
            MQTT_PASSWORD if MQTT_PASSWORD else None,
        )
        cliente.connect()
        print("MQTT conectado")
        return cliente
    except Exception as e:
        print("Error conectando MQTT:", e)
        return None


def publicar_con_reintentos(cliente, topic, payload, max_retries=MAX_RETRIES):
    """Intenta publicar, con reintentos y reconexión si es necesario."""
    for intento in range(max_retries + 1):
        try:
            # Verificar que el cliente existe y está conectado (ping)
            if cliente:
                cliente.ping()  # Lanza excepción si no responde
            else:
                raise Exception("Cliente MQTT no inicializado")

            cliente.publish(topic, payload)
            return True
        except Exception as e:
            print(f"Intento {intento + 1}/{max_retries + 1} falló: {e}")
            if intento < max_retries:
                # Reintentar después de una pausa
                time.sleep(RETRY_DELAY * (intento + 1))  # espera creciente
                # Intentar reconectar si el cliente existe pero falló
                if cliente:
                    try:
                        cliente.disconnect()
                    except:
                        pass
                # Reconectar MQTT (y WiFi si es necesario)
                if not verificar_wifi():
                    continue
                cliente = conectar_mqtt()
            else:
                # Último intento fallido
                return False
    return False


def parpadear(veces=1, intervalo=0.05):
    for _ in range(veces):
        led.on()
        time.sleep(intervalo)
        led.off()
        if veces > 1:
            time.sleep(intervalo)


# ========== PROGRAMA PRINCIPAL ==========
def main():
    print("=" * 40)
    print("SENSOR MQTT (INMP441) - VERSIÓN ROBUSTA")
    print("=" * 40)
    print(f"ID: {MICRO_ID}")
    print(f"MQTT: {MQTT_BROKER}:{MQTT_PORT} -> {MQTT_TOPIC}")
    print(f"Captura c/{CAPTURE_INTERVAL}s, Envío c/{SEND_INTERVAL}s")
    print("=" * 40)

    # Conectar WiFi inicial
    try:
        conectar_wifi()
    except Exception as e:
        print("Error fatal WiFi:", e)
        return

    mqtt_cliente = None
    lecturas = []  # lista de valores dB (float)
    ultimo_envio_ms = time.ticks_ms()
    ultima_lectura_ms = time.ticks_ms()
    suma_cuadrados = 0
    muestras = 0

    try:
        while True:
            ahora_ms = time.ticks_ms()

            # --- Captura de audio (cada ~100ms) ---
            bytes_leidos = audio_in.readinto(samples)
            if bytes_leidos > 0:
                # Calcular RMS del bloque
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

            # --- Cada 5 segundos calcular dB ---
            if time.ticks_diff(ahora_ms, ultima_lectura_ms) >= CAPTURE_INTERVAL * 1000:
                if muestras > 0:
                    rms_prom = math.sqrt(suma_cuadrados / muestras)
                    # Convertir a dB
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

                    lecturas.append(round(dB, 1))
                    print(f"📊 Lectura {len(lecturas)}: {dB:.1f} dB")
                    parpadear(1, 0.1)  # destello corto por lectura

                # Reiniciar acumuladores
                suma_cuadrados = 0
                muestras = 0
                ultima_lectura_ms = ahora_ms

            # --- Envío MQTT cada SEND_INTERVAL segundos ---
            tiempo_desde_envio = time.ticks_diff(ahora_ms, ultimo_envio_ms)
            if tiempo_desde_envio >= SEND_INTERVAL * 1000 and lecturas:
                # Verificar WiFi
                if not verificar_wifi():
                    print("WiFi no disponible, se pospone envío")
                    # Esperar un poco y continuar
                    time.sleep(1)
                    continue

                # Asegurar cliente MQTT
                if mqtt_cliente is None:
                    mqtt_cliente = conectar_mqtt()

                if mqtt_cliente:
                    # Preparar payload
                    timestamp = int(time.time())
                    sensores = []
                    for i, db in enumerate(lecturas):
                        sensores.append(
                            {"micro_id": MICRO_ID, "value": db, "sample": i + 1}
                        )
                    payload = json.dumps({"timestamp": timestamp, "sensors": sensores})

                    # Publicar con reintentos
                    exito = publicar_con_reintentos(mqtt_cliente, MQTT_TOPIC, payload)

                    if exito:
                        print(f"✅ Enviado {len(lecturas)} lecturas")
                        parpadear(2)
                        lecturas = []
                        ultimo_envio_ms = ahora_ms
                    else:
                        print("❌ Falló el envío después de reintentos")
                        # No vaciamos lecturas, intentaremos de nuevo en el próximo ciclo
                        # Pero para evitar acumulación infinita, si la lista crece demasiado, podríamos descartar las más viejas
                        if len(lecturas) > 10:
                            print(
                                "⚠️ Demasiadas lecturas acumuladas, descartando las más antiguas"
                            )
                            lecturas = lecturas[-5:]  # conserva las 5 más recientes
                        # Marcar cliente como muerto para reconectar en el próximo intento
                        try:
                            mqtt_cliente.disconnect()
                        except:
                            pass
                        mqtt_cliente = None
                else:
                    print("No se pudo conectar MQTT, se reintentará después")

                # Pequeña pausa para no saturar
                time.sleep(0.5)

            # Pequeña espera para no saturar CPU
            time.sleep(0.05)

    except KeyboardInterrupt:
        print("\n⏹️ Interrupción por usuario")
    finally:
        if mqtt_cliente:
            try:
                mqtt_cliente.disconnect()
            except:
                pass
        audio_in.deinit()
        print("Recursos liberados")


if __name__ == "__main__":
    main()
