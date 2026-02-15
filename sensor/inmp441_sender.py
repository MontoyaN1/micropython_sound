"""Sensor ESP32 con INMP441 - Captura y envía dB via ESPNOW (versión simplificada)."""

import math
import time

import espnow
import network
from machine import I2S, Pin

# Configuración
SCK_PIN = 14
WS_PIN = 25
SD_PIN = 34
SAMPLE_RATE = 16000
PEER_MAC = b"\x88\x57\x21\x95\x4d\x44"
MICRO_ID = "E1"  # La idea es iterando de 1 a 254, es E por ESP
LED_PIN = 2  # LED integrado en la placa ESP32

# Inicializar I2S
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

# Inicializar LED
led = Pin(LED_PIN, Pin.OUT)
led.off()

# Inicializar ESPNOW
sta = network.WLAN(network.STA_IF)
sta.active(True)
sta.disconnect()
time.sleep(0.5)

e = espnow.ESPNow()
e.active(True)
e.add_peer(PEER_MAC)

print(f"Sensor {MICRO_ID} iniciado")

# Enviar mensaje de inicio
e.send(PEER_MAC, f"{MICRO_ID}:INICIO", False)
print("Inicio enviado")

try:
    suma_cuadrados = 0
    muestras = 0
    ciclo = 0

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

            # Formatear y enviar mensaje
            mensaje = f"{MICRO_ID}:{dB:.1f}"
            e.send(PEER_MAC, mensaje, False)

            # Encender LED para indicar envío
            led.on()
            time.sleep(0.1)
            led.off()

            # Mostrar datos enviados (esto es lo importante)
            print(f" ENVIADO: {mensaje}")

            # Reiniciar contadores
            suma_cuadrados = 0
            muestras = 0
            ciclo = 0

        time.sleep(0.1)

except KeyboardInterrupt:
    print("\n Deteniendo")
    e.send(PEER_MAC, f"{MICRO_ID}:FIN", False)

finally:
    audio_in.deinit()
    e.active(False)
    sta.active(False)
    print("Fin")
