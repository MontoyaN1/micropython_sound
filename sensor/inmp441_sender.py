"""
Emisor ESP-NOW para sensores INMP441
Lee datos de dos sensores INMP441 simultáneamente, calcula decibelios
y los envía via ESP-NOW a un gateway/receptor.

Configuración:
- MICRO_ID: Identificador del micro (1, 2, ...)
- SENSOR_IDS: Lista de IDs para cada sensor ([1, 2])
- GATEWAY_MAC: Dirección MAC del receptor ESP-NOW (formato bytes)
"""


from machine import I2S, Pin
import time
import math
import gc
import network
import espnow
import ujson

# ============================================================================
# CONFIGURACIÓN DE IDENTIFICADORES
# ============================================================================
MICRO_ID = 1
SENSOR_IDS = [1, 2]

# ============================================================================
# CONFIGURACIÓN ESP-NOW
# ============================================================================

GATEWAY_MAC = b'\x88\x57\x21\x95\x4d\x44'
PMK = b'pmk1234567890123'
WIFI_CHANNEL = 0

ENVIO_INTERVAL_MS = 1000
MAX_REINTENTOS = 3

# ============================================================================
# CONFIGURACIÓN DE PINES I2S PARA DOS SENSORES INMP441
# ============================================================================
SCK_PIN = 14   # Clock compartido
WS_PIN = 25    # Word select compartido
SD_PIN_1 = 35  # Data del sensor 1
SD_PIN_2 = 34  # Data del sensor 2

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

# ============================================================================
# INICIALIZACIÓN DE INTERFACES I2S
# ============================================================================
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

# ============================================================================
# FUNCIONES PARA PROCESAMIENTO DE AUDIO
# ============================================================================
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

# ============================================================================
# INICIALIZACIÓN ESP-NOW
# ============================================================================
def inicializar_espnow():
    """Configura ESP-NOW para enviar datos al gateway."""
    print("Inicializando ESP-NOW...")


    sta = network.WLAN(network.STA_IF)
    sta.active(True)
    sta.disconnect()


    if WIFI_CHANNEL > 0:
        sta.config(channel=WIFI_CHANNEL)
        print(f"Canal WiFi configurado: {WIFI_CHANNEL}")


    mac_emisor = sta.config('mac')
    print(f"MAC del emisor: {mac_emisor.hex()}")

    e = espnow.ESPNow()
    e.active(True)

    try:
        e.config(pmk=PMK)
        print("PMK configurado para seguridad")
    except Exception as err:
        print(f"Nota: PMK no configurado ({err})")

    try:
        e.add_peer(GATEWAY_MAC)
        print(f"Peer agregado: {GATEWAY_MAC.hex()}")
    except OSError as err:
        print(f"Error al agregar peer: {err}")

    return e

# ============================================================================
# FUNCIÓN PARA ENVIAR DATOS
# ============================================================================
def enviar_datos_espnow(espnow_obj, dB1, dB2):
    """Envía datos de sensores via ESP-NOW con reintentos."""
    datos = {
        "micro_id": MICRO_ID,
        "timestamp": time.ticks_ms(),
        "sensors": [
            {"sensor_id": SENSOR_IDS[0], "value": round(dB1, 1)},
            {"sensor_id": SENSOR_IDS[1], "value": round(dB2, 1)},
        ]
    }

    try:
        payload = ujson.dumps(datos)
        payload_bytes = payload.encode('utf-8')

        for intento in range(MAX_REINTENTOS + 1):
            try:
                espnow_obj.send(GATEWAY_MAC, payload_bytes)
                if intento > 0:
                    print(f"Datos enviados en intento {intento + 1}/{MAX_REINTENTOS + 1}")
                else:
                    print(f"Datos enviados: {payload}")
                return True
            except Exception as e:
                if intento < MAX_REINTENTOS:
                    print(f"Intento {intento + 1} fallado: {e}, reintentando...")
                    time.sleep(0.05)
                else:
                    print(f"Error enviando datos ESP-NOW después de {MAX_REINTENTOS + 1} intentos: {e}")
                    return False

        return False
    except Exception as e:
        print(f"Error preparando datos ESP-NOW: {e}")
        return False

# ============================================================================
# PROGRAMA PRINCIPAL
# ============================================================================
def main():
    print("========================================")
    print("  EMISOR ESP-NOW PARA SENSORES INMP441")
    print("========================================")
    print(f"Configuración:")
    print(f"  Micro ID: {MICRO_ID}")
    print(f"  Sensor IDs: {SENSOR_IDS}")
    print(f"  Gateway MAC: {GATEWAY_MAC.hex()}")
    print(f"  PMK: {PMK.hex() if len(PMK) <= 16 else PMK[:16].hex()+'...'}")
    print(f"  Canal WiFi: {WIFI_CHANNEL} (0=auto)")
    print(f"  Intervalo envío: {ENVIO_INTERVAL_MS} ms")
    print(f"  Máx. reintentos: {MAX_REINTENTOS}")
    print(f"  Pines I2S: SCK={SCK_PIN}, WS={WS_PIN}")
    print(f"              SD1={SD_PIN_1}, SD2={SD_PIN_2}")
    print("========================================")
    print("INSTRUCCIONES:")
    print("1. Verificar que la MAC del gateway sea correcta")
    print("2. Asegurar que el gateway esté ejecutándose")
    print("3. Comprobar que los sensores estén conectados")
    print("4. Los datos se enviarán cada {ENVIO_INTERVAL_MS}ms")
    print("5. Presione Ctrl+C para detener")
    print("========================================\n")
    print("NOTA: Si no se reciben datos en el gateway, verificar:")
    print("  - MAC del gateway configurada correctamente")
    print("  - Mismo canal WiFi en todos los dispositivos")
    print("  - PMK coincidente (si se usa seguridad)")
    print("  - Distancia entre dispositivos (máx ~100m)")
    print("========================================\n")


    e = inicializar_espnow()

    gc.collect()
    libre = gc.mem_free() / 1000
    usada = gc.mem_alloc() / 1000
    print(f"RAM inicial - Libre: {libre:.1f} KB | Usada: {usada:.1f} KB\n")

    contador = 0
    ultimo_envio = time.ticks_ms()

    try:
        while True:
            dB1, dB2 = leer_sensores()

            if contador % 5 == 0:
                print(f"[{contador}] Sensor 1: {dB1:.1f} dB | Sensor 2: {dB2:.1f} dB")

            ahora = time.ticks_ms()
            if time.ticks_diff(ahora, ultimo_envio) >= ENVIO_INTERVAL_MS:
                if enviar_datos_espnow(e, dB1, dB2):
                    ultimo_envio = ahora

                if contador % 20 == 0:
                    gc.collect()
                    libre = gc.mem_free() / 1000
                    usada = gc.mem_alloc() / 1000
                    print(f"RAM - Libre: {libre:.1f} KB | Usada: {usada:.1f} KB")

            contador += 1
            time.sleep(0.1)

    except KeyboardInterrupt:
        print("\n\nPrograma detenido por el usuario")
    except Exception as ex:
        print(f"\nError durante la ejecución: {ex}")
    finally:
        # Liberar recursos
        print("\nLiberando recursos...")
        e.active(False)
        audio_in1.deinit()
        audio_in2.deinit()
        print("Recursos liberados. ¡Hasta pronto!")

# ============================================================================
# PUNTO DE ENTRADA
# ============================================================================
if __name__ == "__main__":
    main()
