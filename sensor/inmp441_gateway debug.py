"""Gateway ESP32 - Recibe dB via ESPNOW y captura audio local (Debugging)."""

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

# Inicializar ESPNOW
sta = network.WLAN(network.STA_IF)
sta.active(True)
sta.disconnect()
time.sleep(0.5)

e = espnow.ESPNow()
e.active(True)

mac_local = sta.config("mac")
mac_str = ":".join(f"{b:02x}" for b in mac_local)

print("=" * 40)
print("GATEWAY ESPNOW")
print(f"MAC: {mac_str}")
print("=" * 40)
time.sleep(1)

try:
    # Variables
    mensajes = 0
    dispositivos = set()
    suma_cuadrados = 0
    muestras = 0
    ciclo = 0

    print("\n Inicio")

    while True:
        # 1. Recibir mensajes ESPNOW
        try:
            host, msg = e.recv(0)
            if msg:
                mensajes += 1
                mac_origen = bytes(host)
                mac_origen_str = ":".join(f"{b:02x}" for b in mac_origen)
                dispositivos.add(mac_origen_str)

                try:
                    msg_str = msg.decode("utf-8")

                    # Procesar tipos de mensaje
                    if msg_str.startswith("INICIO"):
                        print(f"\nNUEVO: {mac_origen_str}")
                        print(f"   {msg_str}")

                    elif msg_str.startswith("FIN"):
                        print(f"\n FIN: {mac_origen_str}")

                    elif ":" in msg_str:  # Formato "ID:dB"
                        partes = msg_str.split(":")
                        if len(partes) >= 2:
                            print(f"\n DATOS: {mac_origen_str}")
                            print(f"    ID: {partes[0]}")
                            print(f"    dB: {partes[1]}")

                    else:
                        print(f"\n MSG: {mac_origen_str}")
                        print(f"    {msg_str}")

                except:
                    print(f"\n⚠️ MSG NO DECOD: {mac_origen_str}")

                # Estadísticas cada 5 mensajes
                if mensajes % 5 == 0:
                    print("\n Estadísticas:")
                    print(f"    Msgs: {mensajes}")
                    print(f"    Disps: {len(dispositivos)}")
                    for d in dispositivos:
                        print(f"     • {d}")
                    print("-" * 20)

        except:
            pass

        # 2. Procesar audio local
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

        # 3. Mostrar dB local cada 1 segundo
        if ciclo >= 20 and muestras > 0:  # 20 ciclos * 0.05s = 1s
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

            print(f"\n LOCAL: {dB:.1f} dB")
            print(f"    Muestras: {muestras}")

            # Reiniciar
            suma_cuadrados = 0
            muestras = 0
            ciclo = 0

        time.sleep(0.05)

except KeyboardInterrupt:
    print("\n\n DETENIDO")

    print("\nFINAL:")
    print(f"    Total mensajes: {mensajes}")
    print(f"    Dispositivos: {len(dispositivos)}")
    for d in dispositivos:
        print(f"     • {d}")

except Exception as err:
    print(f"\n❌ ERROR: {err}")

finally:
    audio_in.deinit()
    e.active(False)
    sta.active(False)
    print("Fin")
