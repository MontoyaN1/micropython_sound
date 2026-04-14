"""Sensor ESP32 - Reconexion automatica"""

import math
import time

import espnow
import network
from machine import I2S, WDT, Pin

# ========== CONFIGURACION ==========
SCK_PIN = 14
WS_PIN = 25
SD_PIN = 34
SAMPLE_RATE = 16000
MICRO_ID = "E1"
LED_PIN = 2
GATEWAY_MAC = b"\x00\x4b\x12\x20\x9e\x84"
MAX_FALLOS_TX = 5
MAX_FALLOS_HB = 2
CICLOS_ENVIO = 50
CICLOS_HBEAT = 100
TIMEOUT_HB = 1.0
ESCANEO_FORZADO_SEG = 300
# ========== HARDWARE ==========
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
sta = network.WLAN(network.STA_IF)
sta.active(True)
sta.disconnect()
time.sleep(0.5)
esp = espnow.ESPNow()
esp.active(True)


# ========== UTILIDADES ==========
def blink(times=1):
    for _ in range(times):
        led.on()
        time.sleep(0.05)
        led.off()
        if times > 1:
            time.sleep(0.05)


def set_channel(ch):
    try:
        sta.config(channel=ch)
        return True
    except Exception:
        return False


def enviar_con_ack(payload, reintentos=3):
    for intento in range(1, reintentos + 1):
        try:
            esp.send(GATEWAY_MAC, payload, True)
            return True
        except OSError as err:
            print(f"[TX] Intento {intento}/{reintentos} fallido: {err}")
            time.sleep(0.1 * intento)
    return False


# ========== BUSQUEDA DE GATEWAY ==========
def find_gateway(wdt):
    print("\n[SCAN] Buscando gateway...")
    for ch in range(1, 12):
        wdt.feed()
        print(f"\n[SCAN] Probando canal {ch}...")
        canal_encontrado = None
        try:
            if not set_channel(ch):
                print(f"  -> No se pudo configurar canal {ch}")
                continue
            esp.active(False)
            time.sleep(0.2)
            esp.active(True)
            try:
                esp.add_peer(GATEWAY_MAC)
            except OSError:
                pass
            for ping_num in range(1, 6):
                wdt.feed()
                try:
                    esp.send(GATEWAY_MAC, b"PING", False)
                    print(f"  PING {ping_num}/5 en canal {ch}")
                    blink(1)
                except Exception:
                    print(f"  Error enviando PING")
                    break
                start = time.time()
                while time.time() - start < 0.5:
                    try:
                        host, msg = esp.recv(0)
                        if host == GATEWAY_MAC and msg and msg.startswith(b"PONG"):
                            try:
                                canal_gw = (
                                    int(msg.split(b":")[1]) if b":" in msg else ch
                                )
                            except:
                                canal_gw = ch
                            print(f"  OK PONG recibido - gateway en canal {canal_gw}")
                            blink(3)
                            return canal_gw
                    except (OSError, ValueError):
                        pass
                    time.sleep(0.01)
                time.sleep(0.05)
            blink(2)
        except Exception as ex:
            print(f"  Error grave en canal {ch}: {ex}")
            continue
    print("[SCAN] Gateway no encontrado en ningun canal.")
    blink(2)
    return None


# ========== CALCULO DE dB ==========
def calcular_db(suma_cuadrados, muestras):
    if muestras == 0:
        return 0.0
    rms = math.sqrt(suma_cuadrados / muestras)
    if rms < 2:
        return 0.0
    voltaje = (rms / 32767) * 3.3
    factor = 10 ** (-3.0 / 20)
    presion = voltaje / factor
    if presion < 0.00002:
        return 0.0
    db = 20 * math.log10(presion / 0.00002)
    return max(0.0, db)


# ========== MAIN ==========
def main():
    print("=" * 40)
    print(f"SENSOR {MICRO_ID} - INICIANDO")
    print("=" * 40)
    print(f"Gateway MAC : {GATEWAY_MAC.hex()}")
    print(f"Max fallos TX: {MAX_FALLOS_TX}")
    print(f"Max fallos HB: {MAX_FALLOS_HB}")
    print(f"Escaneo forzado cada {ESCANEO_FORZADO_SEG}s")
    print("=" * 40)
    wdt = WDT(timeout=60000)
    while True:
        try:
            canal = None
            intentos = 0
            while canal is None:
                wdt.feed()
                canal = find_gateway(wdt)
                if canal is None:
                    intentos += 1
                    espera = min(5 * intentos, 30)
                    print(f"[SCAN] Reintento {intentos} en {espera}s...")
                    for _ in range(espera * 10):
                        wdt.feed()
                        time.sleep(0.1)
            print(f"[INFO] Gateway encontrado en canal {canal}")
            set_channel(canal)
            esp.active(False)
            time.sleep(0.3)
            esp.active(True)
            try:
                esp.add_peer(GATEWAY_MAC)
            except OSError:
                pass
            print(f"\n[OK] Conectado al gateway en canal {canal}")
            print("[OK] Enviando datos cada 5s, heartbeat cada 10s")
            print("=" * 40)
            try:
                esp.send(GATEWAY_MAC, f"{MICRO_ID}:INICIO", False)
            except:
                pass
            suma_cuadrados = 0.0
            n_muestras = 0
            ciclo = 0
            fallos_tx = 0
            fallos_hb = 0
            ultimo_escaneo = time.time()
            while True:
                wdt.feed()
                ahora = time.time()
                if ahora - ultimo_escaneo > ESCANEO_FORZADO_SEG:
                    print("[MAINT] Escaneo periodico forzado...")
                    break
                bytes_leidos = audio_in.readinto(samples)
                if bytes_leidos > 0:
                    count = bytes_leidos // 2
                    suma = 0
                    for i in range(0, count * 2, 2):
                        muestra = int.from_bytes(samples[i : i + 2], "little")
                        if muestra >= 32768:
                            muestra -= 65536
                        suma += muestra * muestra
                    rms = math.sqrt(suma / count)
                    suma_cuadrados += rms * rms
                    n_muestras += 1
                ciclo += 1
                if ciclo % CICLOS_ENVIO == 0 and n_muestras > 0:
                    db = calcular_db(suma_cuadrados, n_muestras)
                    mensaje = f"{MICRO_ID}:{db:.1f}"
                    if enviar_con_ack(mensaje):
                        print(f"[TX] OK {mensaje}")
                        blink(1)
                        fallos_tx = 0
                        fallos_hb = 0
                    else:
                        fallos_tx += 1
                        print(f"[TX] FALLO #{fallos_tx}/{MAX_FALLOS_TX}")
                        blink(2)
                        if fallos_tx >= MAX_FALLOS_TX:
                            print("[TX] Demasiados fallos - reconectando")
                            break
                    suma_cuadrados = 0.0
                    n_muestras = 0
                if ciclo % CICLOS_HBEAT == 0:
                    try:
                        esp.send(GATEWAY_MAC, b"PING", False)
                        t0 = time.time()
                        recibido = False
                        while time.time() - t0 < TIMEOUT_HB:
                            try:
                                host, resp = esp.recv(0)
                                if (
                                    host == GATEWAY_MAC
                                    and resp
                                    and resp.startswith(b"PONG")
                                ):
                                    recibido = True
                                    if b":" in resp:
                                        canal_resp = int(resp.split(b":")[1])
                                        if canal_resp != canal:
                                            print(
                                                f"[HB] Gateway cambio canal {canal} -> {canal_resp}"
                                            )
                                            break
                                    break
                            except (OSError, ValueError):
                                pass
                            time.sleep(0.02)
                        if not recibido:
                            fallos_hb += 1
                            print(f"[HB] Sin respuesta #{fallos_hb}/{MAX_FALLOS_HB}")
                            if fallos_hb >= MAX_FALLOS_HB:
                                print("[HB] Demasiados fallos - reconectando")
                                break
                        else:
                            fallos_hb = 0
                            print("[HB] Gateway vivo")
                    except Exception as ex:
                        print(f"[HB] Excepcion: {ex}")
                        fallos_hb += 1
                        if fallos_hb >= MAX_FALLOS_HB:
                            break
                time.sleep(0.1)
        except KeyboardInterrupt:
            print("\n[SENSOR] Interrupcion por usuario")
            try:
                esp.send(GATEWAY_MAC, f"{MICRO_ID}:FIN", False)
            except:
                pass
            break
        except Exception as ex:
            print(f"\n[ERROR] Inesperado: {ex}")
            import sys

            sys.print_exception(ex)
            print("[ERROR] Reintentando en 5s...")
            for _ in range(50):
                wdt.feed()
                time.sleep(0.1)
    audio_in.deinit()
    esp.active(False)
    sta.active(False)
    led.off()
    print("[SENSOR] Detenido")


if __name__ == "__main__":
    main()
