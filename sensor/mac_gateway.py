"""
mac_gateway.py - Obtener dirección MAC del ESP32 gateway
Muestra la MAC en formatos para configurar emisores ESP-NOW.
"""

import network


def main():

    print("=" * 40)
    print("MAC DEL GATEWAY ESP32")
    print("=" * 40)

    try:
        # Obtener MAC
        sta = network.WLAN(network.STA_IF)
        sta.active(True)
        mac_bytes = sta.config("mac")

        # Formatear MAC
        mac_hex = mac_bytes.hex()
        mac_formateada = ":".join(mac_hex[i : i + 2] for i in range(0, 12, 2))

        # Mostrar resultados
        print(f"MAC legible: {mac_formateada}")
        print(f"MAC hex:     {mac_hex}")
        print()
        print("Para código ESP-NOW:")
        print()

        # Generar código para ESP-NOW
        mac_code = f"PEER_MAC = b'\\x{mac_hex[0:2]}\\x{mac_hex[2:4]}\\x{mac_hex[4:6]}\\x{mac_hex[6:8]}\\x{mac_hex[8:10]}\\x{mac_hex[10:12]}'"
        print(mac_code)
        print()
        print("=" * 40)

    except Exception as e:
        print(f"Error: {e}")
        print("=" * 40)


if __name__ == "__main__":
    main()
