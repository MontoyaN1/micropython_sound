"""Versión para probar funcionamientos de loe sensores para el ESP32 y el INMP441."""

import math
import time

from machine import I2S, Pin

# Configuración
SCK_PIN = 14
WS_PIN = 25
SD_PIN = 34
SAMPLE_RATE = 16000
BITS = 16
FORMAT = I2S.MONO
BUFFER_SIZE = 20000

# Constantes para cálculo de dB
SENSIBILIDAD = -3.0
P_REF = 0.00002
VOLTAJE_REF = 3.3
MAX_AMPLITUD = 32767

# Inicialización I2S
audio_in = I2S(
    0,
    sck=Pin(SCK_PIN),
    ws=Pin(WS_PIN),
    sd=Pin(SD_PIN),
    mode=I2S.RX,
    bits=BITS,
    format=FORMAT,
    rate=SAMPLE_RATE,
    ibuf=BUFFER_SIZE,
)

samples = bytearray(512)


def bytes_to_signed(byte_data):
    """Convierte 2 bytes a valor con signo de 16 bits."""
    value = int.from_bytes(byte_data, "little")
    return value - 65536 if value >= 32768 else value


def calcular_RMS(samples, bytes_read):
    """Calcula el valor RMS de las muestras."""
    if bytes_read < 2:
        return 0

    suma = 0
    count = bytes_read // 2

    for j in range(0, count * 2, 2):
        sample = bytes_to_signed(samples[j : j + 2])
        suma += sample * sample

    return math.sqrt(suma / count) if count > 0 else 0


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


def main():
    print("INMP441 - dB cada 1 segundo")
    print("Ctrl+C para detener\n")

    try:
        suma_cuadrados = 0
        total_muestras = 0
        lecturas = 0

        while True:
            bytes_read = audio_in.readinto(samples)

            if bytes_read > 0:
                rms = calcular_RMS(samples, bytes_read)
                suma_cuadrados += rms * rms
                total_muestras += 1

            lecturas += 1

            # Cada 1 segundo (10 lecturas)
            if lecturas >= 10:
                if total_muestras > 0:
                    rms_promedio = math.sqrt(suma_cuadrados / total_muestras)
                    dB = amplitud_a_dB(rms_promedio)
                    print(f"{dB:.1f} dB")

                # Reiniciar
                suma_cuadrados = 0
                total_muestras = 0
                lecturas = 0

            time.sleep(0.1)

    except KeyboardInterrupt:
        print("\nMedición finalizada")
    finally:
        audio_in.deinit()


if __name__ == "__main__":
    main()
