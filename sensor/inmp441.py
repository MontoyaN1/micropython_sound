"""El siguiente código es la logica para capturar los datos del
sensor de sonido (INMP441), con el fin de determinar los decibelios
 y enviarlo a un servicio en la nube"""

from machine import I2S, Pin
import math
import time

# Configuración del I2S (tu configuración actual)
sck_pin = Pin(14)
ws_pin = Pin(13)
sd_pin = Pin(12)

audio_in = I2S(
    2,
    sck=sck_pin,
    ws=ws_pin,
    sd=sd_pin,
    mode=I2S.RX,
    bits=32,
    format=I2S.STEREO,
    rate=22050,
    ibuf=20000,
)


samples = bytearray(1024)


def calculate_db(sample_data):
    """
    Calcula el nivel de decibelios RMS de las muestras
    """

    sample_count = len(sample_data) // 4
    values = []

    for i in range(sample_count):
        sample = int.from_bytes(sample_data[i * 4 : (i + 1) * 4], "little", signed=True)
        values.append(sample)

    sum_squares = 0
    for value in values:
        sum_squares += value * value

    if sum_squares == 0:
        return 0

    rms = math.sqrt(sum_squares / len(values))

    db = 20 * math.log10(rms / 2147483647) + 94 + 26

    return max(db, 0)


try:
    while True:
        # Leer muestras del micrófono
        num_bytes = audio_in.readinto(samples)

        if num_bytes > 0:
            db_level = calculate_db(samples[:num_bytes])

            print(f"Nivel de sonido: {db_level:.1f} dB")

            time.sleep(0.1)

except KeyboardInterrupt:
    audio_in.deinit()
    print("Medición detenida")
