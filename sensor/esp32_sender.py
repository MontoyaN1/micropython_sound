"""Sensor ESP32 minimal - PING/PONG para sincronizar canal con gateway
Envía PING a MAC conocida del gateway (88:57:21:95:4d:44).
Si recibe PONG, usa ese canal para enviar datos cada 5 segundos.
"""

import math
import time

import espnow
import network
from machine import I2S, Pin

# === CONFIGURACIÓN ===
SCK_PIN = 14
WS_PIN = 25
SD_PIN = 34
SAMPLE_RATE = 16000
MICRO_ID = "E1"  # Cambiar por E2, E3, E4, E5
LED_PIN = 2

# Gateway conocido (MAC fija)
GATEWAY_MAC = b"\x88\x57\x21\x95\x4d\x44"

# === INICIALIZACIÓN ===
# I2S para captura de audio
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

# LED
led = Pin(LED_PIN, Pin.OUT)
led.off()

# WiFi y ESP-NOW
sta = network.WLAN(network.STA_IF)
sta.active(True)
sta.disconnect()
time.sleep(0.5)

e = espnow.ESPNow()
e.active(True)


def blink(times=1):
    """Parpadeo simple."""
    for _ in range(times):
        led.on()
        time.sleep(0.05)
        led.off()
        if times > 1:
            time.sleep(0.05)


def set_channel(ch):
    """Configurar canal WiFi."""
    try:
        sta.config(channel=ch)
        return True
    except:
        return False


def find_gateway():
    """Escanea canales 1-11, envía PING, espera PONG con canal."""
    print("\nBuscando gateway...")
    channels = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]

    for channel in channels:
        print(f"\n[CANAL {channel}] Escaneando...")
        if not set_channel(channel):
            print(f"  ✗ No se pudo configurar canal {channel}")
            continue

        # Pequeña pausa para estabilización del canal
        print(f"  Esperando estabilización del canal...")
        time.sleep(0.3)

        # Reiniciar ESP-NOW en nuevo canal
        print(f"  Reiniciando ESP-NOW en canal {channel}...")
        e.active(False)
        time.sleep(0.2)
        e.active(True)
        e.add_peer(GATEWAY_MAC)
        print(f"  ESP-NOW listo, peer agregado: {GATEWAY_MAC.hex()}")

        # Enviar múltiples PINGs (5 intentos)
        pings_enviados = 0
        start = time.time()
        print(f"  Enviando PINGs durante 3 segundos...")
        while time.time() - start < 3.0:  # Esperar hasta 3 segundos por canal
            # Enviar PING cada 0.5 segundos (máximo 5 PINGs)
            if pings_enviados < 5 and (time.time() - start) > (pings_enviados * 0.5):
                try:
                    e.send(GATEWAY_MAC, b"PING", False)
                    pings_enviados += 1
                    print(f"    ✓ PING #{pings_enviados} enviado en canal {channel}")
                    blink(1)  # PING enviado
                except Exception as send_err:
                    print(f"    ✗ Error enviando PING: {send_err}")
                    break  # Salir si hay error al enviar

            # Intentar recibir PONG
            try:
                host, msg = e.recv(0)
                if msg and msg.startswith(b"PONG"):
                    # Extraer canal de respuesta (PONG:6)
                    try:
                        text = msg.decode()
                        if ":" in text:
                            canal = int(text.split(":")[1])
                            print(
                                f"    🎯 ¡PONG recibido! Gateway encontrado en canal {canal}"
                            )
                            print(f"    Mensaje: {text}")
                            blink(3)  # PONG recibido (éxito)
                            return canal
                        else:
                            print(f"    🎯 ¡PONG recibido! Gateway en canal {channel}")
                            blink(3)  # PONG recibido (éxito)
                            return channel
                    except Exception as decode_err:
                        print(
                            f"    🎯 ¡PONG recibido! Gateway en canal {channel} (error parseo: {decode_err})"
                        )
                        blink(3)  # PONG recibido (éxito)
                        return channel
            except (OSError, ValueError):
                pass
            time.sleep(0.05)

        if pings_enviados == 0:
            print(f"  ✗ No se pudo enviar ningún PING en canal {channel}")
            blink(1)  # Error enviando PING
        else:
            print(
                f"  ✗ No hubo respuesta después de {pings_enviados} PINGs en canal {channel}"
            )
            blink(2)  # No hubo respuesta

    print("\n✗ Gateway no encontrado en este intento")
    blink(2)  # Gateway no encontrado
    return None


def main():
    print("=" * 40)
    print(f"SENSOR {MICRO_ID} - MINIMAL")
    print("=" * 40)
    print(f"Gateway MAC: {GATEWAY_MAC.hex()}")
    print("=" * 40)

    # Bucle principal infinito para reconexión
    while True:
        try:
            # Buscar gateway (reintentar infinitamente)
            print("\nBuscando gateway (reintentos infinitos hasta encontrar)...")
            intentos = 0
            canal = None
            while canal is None:
                canal = find_gateway()
                if canal is None:
                    intentos += 1
                    espera = min(5 * intentos, 30)  # Backoff exponencial, máximo 30s
                    print(f"Reintentando en {espera} segundos (intento {intentos})...")
                    blink(intentos)  # Parpadeo para indicar intento
                    time.sleep(espera)

            # Configurar en canal correcto
            set_channel(canal)
            e.active(False)
            time.sleep(0.2)
            e.active(True)
            e.add_peer(GATEWAY_MAC)

            print(f"\nConectado al gateway en canal {canal}")
            print("Enviando datos cada 5 segundos...")
            print("=" * 40)

            # Variables para captura de audio
            suma_cuadrados = 0
            muestras = 0
            ciclo = 0
            ultimo_envio = 0

            # Enviar inicio
            try:
                e.send(GATEWAY_MAC, f"{MICRO_ID}:INICIO", False)
                print("Inicio enviado")
            except:
                print("Error enviando inicio")

            # Bucle de envío de datos
            while True:
                # Capturar audio
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

                # Cada 5 segundos (50 ciclos de 0.1s)
                if ciclo >= 50 and muestras > 0:
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

                    # Enviar dato
                    mensaje = f"{MICRO_ID}:{dB:.1f}"
                    try:
                        e.send(GATEWAY_MAC, mensaje, False)
                        print(f" ENVIADO: {mensaje}")
                        blink(1)
                    except Exception as err:
                        print(f" ERROR de envío: {err}")
                        # Romper bucle interno para reconectar
                        break

                    # Reiniciar contadores
                    suma_cuadrados = 0
                    muestras = 0
                    ciclo = 0
                    ultimo_envio = time.time()

                time.sleep(0.1)

        except KeyboardInterrupt:
            print("\nDeteniendo sensor...")
            try:
                e.send(GATEWAY_MAC, f"{MICRO_ID}:FIN", False)
                print("Mensaje de fin enviado")
            except:
                pass
            break  # Salir del bucle principal

        except Exception as ex:
            print(f"\nError inesperado: {ex}")
            print("Reintentando conexión en 5 segundos...")
            time.sleep(5)
    # Limpiar recursos al salir
    audio_in.deinit()
    e.active(False)
    sta.active(False)
    led.off()
    print("Sensor detenido")


if __name__ == "__main__":
    main()
