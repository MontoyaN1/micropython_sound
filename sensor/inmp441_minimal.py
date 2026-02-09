"""Versión minimalista del lector INMP441 para ESP32
Lee datos de dos sensores INMP441 simultáneamente y muestra los decibelios.
Sin dependencias de red (WiFi/MQTT)."""

from machine import I2S, Pin
import time
import math
import gc


SCK_PIN = 14   # Clock compartido
WS_PIN = 25    # Word select compartido
SD_PIN_1 = 35
SD_PIN_2 = 34

# Configuración de audio
SAMPLE_RATE = 16000
BITS = 16
FORMAT = I2S.MONO
BUFFER_SIZE = 5000

# Constantes para cálculo de dB
SENSIBILIDAD = -3.0        # Sensibilidad del micrófono en dBV/Pa
P_REF = 0.00002            # Presión de referencia (20 μPa)
VOLTAJE_REF = 3.3          # Voltaje de referencia del ADC
MAX_AMPLITUD = 32767       # Máxima amplitud para 16 bits con signo

# Inicialización de interfaces I2S
audio_in1 = I2S(
    0,
    sck=Pin(SCK_PIN),
    ws=Pin(WS_PIN),
    sd=Pin(SD_PIN_1),
    mode=I2S.RX,
    bits=BITS,
    format=FORMAT,
    rate=SAMPLE_RATE,
    ibuf=BUFFER_SIZE,
)

audio_in2 = I2S(
    1,
    sck=Pin(SCK_PIN),
    ws=Pin(WS_PIN),
    sd=Pin(SD_PIN_2),
    mode=I2S.RX,
    bits=BITS,
    format=FORMAT,
    rate=SAMPLE_RATE,
    ibuf=BUFFER_SIZE,
)

samples1 = bytearray(512)
samples2 = bytearray(512)


def bytes_to_signed(byte_data):
    """Convierte 2 bytes (little-endian) a valor con signo de 16 bits."""
    value = int.from_bytes(byte_data, "little")
    return value - 65536 if value >= 32768 else value


def calcular_RMS(samples, bytes_read):
    """Calcula el valor RMS de las muestras de audio."""
    suma = 0
    count = min(100, bytes_read // 2)

    for j in range(0, count * 2, 2):
        sample = bytes_to_signed(samples[j:j + 2])
        suma += sample * sample

    return int(math.sqrt(suma / count)) if count > 0 else 0


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


def leer_sensores():
    """Lee datos de ambos sensores y devuelve valores en dB."""
    bytes_read1 = audio_in1.readinto(samples1)
    bytes_read2 = audio_in2.readinto(samples2)

    if bytes_read1 > 0 and bytes_read2 > 0:
        amplitud1 = calcular_RMS(samples1, bytes_read1)
        amplitud2 = calcular_RMS(samples2, bytes_read2)

        dB1 = amplitud_a_dB(amplitud1)
        dB2 = amplitud_a_dB(amplitud2)

        return dB1, dB2

    return 0.0, 0.0


def mostrar_estado_memoria():
    """Muestra el estado de la memoria RAM."""
    gc.collect()
    libre = gc.mem_free() / 1000
    usada = gc.mem_alloc() / 1000
    return libre, usada


# Programa principal
def main():
    print("========================================")
    print("  SONÓMETRO INMP441 - VERSIÓN MINIMAL")
    print("========================================")
    print(f"Configuración:")
    print(f"  SCK: {SCK_PIN}, WS: {WS_PIN}")
    print(f"  SD1: {SD_PIN_1}, SD2: {SD_PIN_2}")
    print(f"  Frecuencia: {SAMPLE_RATE} Hz")
    print("========================================")
    print("Presione Ctrl+C para detener")
    print("========================================\n")

    try:
        contador = 0

        while True:
            dB1, dB2 = leer_sensores()

            if contador % 10 == 0:
                print(f"\n--- Medición {contador} ---")
                print(f"Sensor 1: {dB1:.1f} dB")
                print(f"Sensor 2: {dB2:.1f} dB")
                print(f"Diferencia: {abs(dB1 - dB2):.1f} dB")

                libre, usada = mostrar_estado_memoria()
                print(f"RAM libre: {libre:.1f} KB | RAM usada: {usada:.1f} KB")

            contador += 1
            time.sleep(0.1)

    except KeyboardInterrupt:
        print("\n\nMedición finalizada por el usuario")
    except Exception as e:
        print(f"\nError durante la medición: {e}")
    finally:
        print("\nLiberando recursos...")
        audio_in1.deinit()
        audio_in2.deinit()
        print("Recursos liberados. ¡Hasta pronto!")


if __name__ == "__main__":
    main()
