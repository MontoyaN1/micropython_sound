import network
import time
import machine

SSID = 'JUAN_PABLO_2005'
SSID_PASS='13062005'

def connect_wifi():
    wlan = network.WLAN(network.STA_IF)
    wlan.active(True)
    
    if not wlan.isconnected():
        print('Conectando a WiFi...')
        wlan.connect(SSID, SSID_PASS)
        
        
        for i in range(15):
            if wlan.isconnected():
                break
            time.sleep(1)
    
    if wlan.isconnected():
        print('WiFi conectada:', wlan.ifconfig()[0])
        return True
    else:
        print('Error: No se pudo conectar a WiFi')
        return False


connect_wifi()