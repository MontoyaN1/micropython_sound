"""
mac_gateway.py - Script simple para obtener la dirección MAC del ESP32

Este script obtiene y muestra la dirección MAC del ESP32 gateway
en el formato necesario para configurar los emisores ESP-NOW.
"""

import network

def main():
    """Función principal - Obtiene y muestra la MAC."""

    print("=" * 50)
    print("OBTENER MAC DEL GATEWAY ESP32")
    print("=" * 50)

    try:
        sta = network.WLAN(network.STA_IF)
        sta.active(True)

        mac_bytes = sta.config('mac')

        mac_hex = mac_bytes.hex()
        mac_formateada = ':'.join(mac_hex[i:i+2] for i in range(0, 12, 2))

        print(f"✅ MAC obtenida exitosamente")
        print()
        print(f"📡 Dirección MAC del gateway:")
        print(f"   Formato legible: {mac_formateada}")
        print(f"   Formato hex:     {mac_hex}")
        print()
        print("📋 PARA USAR EN CÓDIGO ESP-NOW:")
        print()

        mac_code = f"GATEWAY_MAC = b'\\x{mac_hex[0:2]}\\x{mac_hex[2:4]}\\x{mac_hex[4:6]}\\x{mac_hex[6:8]}\\x{mac_hex[8:10]}\\x{mac_hex[10:12]}'"
        print(f"   {mac_code}")
        print()
        print("📝 INSTRUCCIONES:")
        print("   1. Copiar la línea de arriba")
        print("   2. Pegar en inmp441_espnow_sender.py")
        print("   3. Reemplazar la línea GATEWAY_MAC actual")
        print("=" * 50)

    except Exception as e:
        print(f"❌ Error: {e}")
        print("=" * 50)

if __name__ == "__main__":
    main()
