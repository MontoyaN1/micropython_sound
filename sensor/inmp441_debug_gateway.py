"""
Gateway ESP-NOW para depuración de sensores INMP441

Este código recibe datos de múltiples sensores vía ESP-NOW y muestra
los resultados en consola para depuración. NO envía datos a MQTT.

Funcionalidades:
1. Recibe datos vía ESP-NOW de múltiples emisores
2. Lee datos de 2 sensores INMP441 locales del gateway
3. Muestra todos los datos en consola para verificación
4. Limpia datos antiguos automáticamente

"""

import network
import espnow
import time
import json
import gc
import math
from machine import I2S, Pin

# ============================================================================
# CONFIGURACIÓN ESP-NOW
# ============================================================================
PMK = b'pmk1234567890123'
WIFI_CHANNEL = 0

# ============================================================================
# CONFIGURACIÓN DE SENSORES LOCALES DEL GATEWAY
# ============================================================================
GATEWAY_MICRO_ID = 255
GATEWAY_SENSOR_IDS = [101, 102]

# Configuración de pines I2S para sensores locales
SCK_PIN = 14   # Clock compartido
WS_PIN = 25    # Word select compartido
SD_PIN_1 = 35  # Data del sensor 1 local
SD_PIN_2 = 34  # Data del sensor 2 local

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
# INICIALIZACIÓN DE INTERFACES I2S PARA SENSORES LOCALES
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


datos_recibidos = {}

# ============================================================================
# INICIALIZACIÓN ESP-NOW (RECEPTOR)
# ============================================================================
def inicializar_espnow_receptor():
    """Configura ESP-NOW para recibir datos de múltiples emisores."""
    print("Inicializando ESP-NOW en modo receptor...")

    sta = network.WLAN(network.STA_IF)
    sta.active(True)
    sta.disconnect()


    if WIFI_CHANNEL > 0:
        sta.config(channel=WIFI_CHANNEL)
        print(f"Canal WiFi configurado: {WIFI_CHANNEL}")

    e = espnow.ESPNow()
    e.active(True)

    e.config(pmk=PMK)

    print(f"MAC del gateway: {sta.config('mac').hex()}")
    print("ESP-NOW receptor listo. Esperando datos...")
    print("NOTA: Configure esta MAC en los emisores (inmp441_espnow_sender.py)")
    print("=" * 60)

    return e

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

def leer_sensores_locales():
    """Lee datos de los sensores locales del gateway y devuelve valores en dB."""
    try:
        bytes_read1 = audio_in1.readinto(samples1)
        bytes_read2 = audio_in2.readinto(samples2)

        if bytes_read1 > 0 and bytes_read2 > 0:
            amplitud1 = calcular_RMS(samples1, bytes_read1)
            amplitud2 = calcular_RMS(samples2, bytes_read2)

            dB1 = amplitud_a_dB(amplitud1)
            dB2 = amplitud_a_dB(amplitud2)

            return dB1, dB2
    except Exception as e:
        print(f"Error leyendo sensores locales: {e}")

    return 0.0, 0.0

# ============================================================================
# PROCESAMIENTO DE DATOS ESP-NOW
# ============================================================================
def procesar_datos_espnow(espnow_obj):
    """Procesa datos recibidos via ESP-NOW y los almacena."""
    global datos_recibidos

    try:

        mac_emisor, mensaje = espnow_obj.recv(0)

        if mensaje:
            try:
                # Decodificar mensaje JSON
                datos = json.loads(mensaje.decode('utf-8'))

                # Validar estructura de datos
                if "micro_id" in datos and "sensors" in datos:
                    micro_id = datos["micro_id"]
                    timestamp = datos.get("timestamp", time.ticks_ms())

                    # Inicializar entrada para este micro si no existe
                    if micro_id not in datos_recibidos:
                        datos_recibidos[micro_id] = {}

                    # Procesar cada sensor
                    for sensor in datos["sensors"]:
                        if "sensor_id" in sensor and "value" in sensor:
                            sensor_id = sensor["sensor_id"]

                            # Almacenar datos del sensor
                            datos_recibidos[micro_id][sensor_id] = {
                                "value": sensor["value"],
                                "timestamp": timestamp,
                                "mac_emisor": mac_emisor.hex(),
                                "received_at": time.ticks_ms()
                            }

                    print(f"✓ Datos recibidos de micro {micro_id} (MAC: {mac_emisor.hex()})")

                else:
                    print(f"✗ Estructura inválida de datos de {mac_emisor.hex()}")

            except (ValueError, KeyError) as e:
                print(f"✗ Error procesando datos de {mac_emisor.hex()}: {e}")

    except Exception as e:
        # Error general, continuar sin interrumpir
        pass

# ============================================================================
# LIMPIEZA DE DATOS ANTIGUOS
# ============================================================================
def limpiar_datos_antiguos(max_age_ms=30000):
    """Elimina datos más antiguos que max_age_ms (30 segundos por defecto)."""
    global datos_recibidos

    ahora = time.ticks_ms()
    micros_a_eliminar = []

    for micro_id, sensores in datos_recibidos.items():
        sensores_a_eliminar = []

        for sensor_id, datos_sensor in sensores.items():
            edad = time.ticks_diff(ahora, datos_sensor.get("received_at", 0))
            if edad > max_age_ms:
                sensores_a_eliminar.append(sensor_id)

        # Eliminar sensores antiguos
        for sensor_id in sensores_a_eliminar:
            del sensores[sensor_id]

        # Si no quedan sensores en este micro, marcarlo para eliminar
        if not sensores:
            micros_a_eliminar.append(micro_id)

    # Eliminar micros vacíos
    for micro_id in micros_a_eliminar:
        del datos_recibidos[micro_id]

    if micros_a_eliminar:
        print(f"Limpiados {len(micros_a_eliminar)} micros sin datos recientes")

# ============================================================================
# FUNCIÓN PARA MOSTRAR DATOS DE DEPURACIÓN
# ============================================================================
def mostrar_datos_depuracion():
    """Muestra todos los datos recibidos en formato legible para depuración."""
    global datos_recibidos

    if not datos_recibidos:
        print("📭 No hay datos recibidos aún")
        return

    ahora = time.ticks_ms()
    print("\n" + "=" * 60)
    print("📊 DATOS DE DEPURACIÓN - RESUMEN")
    print("=" * 60)

    total_micros = len(datos_recibidos)
    total_sensores = sum(len(s) for s in datos_recibidos.values())

    # Contar sensores locales
    sensores_locales = 0
    if GATEWAY_MICRO_ID in datos_recibidos:
        sensores_locales = len(datos_recibidos[GATEWAY_MICRO_ID])

    print(f"Micros activos: {total_micros} | Sensores totales: {total_sensores}")
    print(f"Sensores locales: {sensores_locales} | Sensores remotos: {total_sensores - sensores_locales}")

    # Mostrar datos por micro
    for micro_id, sensores in sorted(datos_recibidos.items()):
        origen = "(LOCAL - Gateway)" if micro_id == GATEWAY_MICRO_ID else "(REMOTO)"
        print(f"\n📡 Micro {micro_id} {origen}")
        print("-" * 40)

        for sensor_id, datos_sensor in sorted(sensores.items()):
            edad_ms = time.ticks_diff(ahora, datos_sensor.get("received_at", 0))
            edad_seg = edad_ms / 1000

            if micro_id == GATEWAY_MICRO_ID:
                fuente = "Local"
            else:
                fuente = datos_sensor.get("mac_emisor", "desconocido")[:8] + "..."

            print(f"  Sensor {sensor_id}: {datos_sensor['value']:.1f} dB | "
                  f"Edad: {edad_seg:.1f}s | Fuente: {fuente}")

    # Mostrar valores actuales de sensores locales
    if GATEWAY_MICRO_ID in datos_recibidos:
        sensores_locales = datos_recibidos[GATEWAY_MICRO_ID]
        if sensores_locales:
            print(f"\n🎯 VALORES ACTUALES GATEWAY (ID:{GATEWAY_MICRO_ID}):")
            for sensor_id in sorted(sensores_locales.keys()):
                valor = sensores_locales[sensor_id]['value']
                print(f"  Sensor {sensor_id}: {valor:.1f} dB")

    # Mostrar memoria
    gc.collect()
    libre = gc.mem_free() / 1000
    usada = gc.mem_alloc() / 1000
    print(f"\n💾 RAM: Libre {libre:.1f} KB | Usada {usada:.1f} KB")
    print("=" * 60)

# ============================================================================
# FUNCIÓN PRINCIPAL
# ============================================================================
def main():
    global datos_recibidos

    print("=" * 60)
    print("   GATEWAY ESP-NOW - MODO DEPURACIÓN")
    print("=" * 60)
    print("Este gateway SOLO muestra datos en consola.")
    print("NO se conecta a WiFi ni envía datos por MQTT.")
    print("=" * 60)
    print(f"PMK: {PMK.hex() if len(PMK) <= 16 else PMK[:16].hex()+'...'}")
    print(f"Canal WiFi: {WIFI_CHANNEL} (0=auto)")
    print(f"Gateway Micro ID: {GATEWAY_MICRO_ID}")
    print(f"Gateway Sensor IDs: {GATEWAY_SENSOR_IDS}")
    print(f"Pines I2S: SCK={SCK_PIN}, WS={WS_PIN}")
    print(f"           SD1={SD_PIN_1}, SD2={SD_PIN_2}")
    print("=" * 60)
    print("Presione Ctrl+C para detener")
    print("=" * 60 + "\n")

    # Inicializar ESP-NOW
    espnow_obj = inicializar_espnow_receptor()

    contador_ciclos = 0
    ultimo_mostrar = time.ticks_ms()
    INTERVALO_MOSTRAR_MS = 2000  # Mostrar datos cada 2 segundos

    try:
        while True:

            procesar_datos_espnow(espnow_obj)


            if contador_ciclos % 5 == 0:
                try:
                    dB1, dB2 = leer_sensores_locales()
                    if GATEWAY_MICRO_ID not in datos_recibidos:
                        datos_recibidos[GATEWAY_MICRO_ID] = {}

                    timestamp_local = time.ticks_ms()
                    datos_recibidos[GATEWAY_MICRO_ID][GATEWAY_SENSOR_IDS[0]] = {
                        "value": round(dB1, 1),
                        "timestamp": timestamp_local,
                        "mac_emisor": "local",
                        "received_at": timestamp_local
                    }
                    datos_recibidos[GATEWAY_MICRO_ID][GATEWAY_SENSOR_IDS[1]] = {
                        "value": round(dB2, 1),
                        "timestamp": timestamp_local,
                        "mac_emisor": "local",
                        "received_at": timestamp_local
                    }


                    if contador_ciclos % 50 == 0:
                        print(f"📡 Lectura local - Sensor 1: {dB1:.1f} dB | Sensor 2: {dB2:.1f} dB")

                except Exception as e:
                    print(f"Error procesando sensores locales: {e}")


            ahora = time.ticks_ms()
            if time.ticks_diff(ahora, ultimo_mostrar) >= INTERVALO_MOSTRAR_MS:
                mostrar_datos_depuracion()
                ultimo_mostrar = ahora


            if contador_ciclos % 20 == 0:
                limpiar_datos_antiguos()

            time.sleep(0.1)
            contador_ciclos += 1

    except KeyboardInterrupt:
        print("\n\n🔴 Programa detenido por el usuario")
    except Exception as e:
        print(f"\n❌ Error en main: {e}")
        import sys
        sys.print_exception(e)
    finally:
        # Limpieza
        print("\n🔄 Liberando recursos...")
        espnow_obj.active(False)
        try:
            audio_in1.deinit()
            audio_in2.deinit()
        except Exception as e:
            print(f"⚠️ Error liberando recursos I2S: {e}")
        print("✅ Recursos liberados. ¡Hasta pronto!")

# ============================================================================
# PUNTO DE ENTRADA
# ============================================================================
if __name__ == "__main__":
    main()
