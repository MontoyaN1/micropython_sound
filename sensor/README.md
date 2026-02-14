# Sensor MicroPython - Documentación de Hardware

## Descripción
Esta carpeta contiene el código MicroPython para los sensores de sonido basados en ESP32/ESP8266 con micrófonos INMP441. El sistema captura niveles de sonido en tiempo real y los transmite vía MQTT para procesamiento posterior.

## Hardware Requerido

### Componentes Principales
1. **Microcontrolador**: ESP32 o ESP8266
2. **Micrófono**: INMP441 (I2S digital)
3. **Fuente de alimentación**: 3.3V DC
4. **Conexiones**: Cables dupont, protoboard

### Especificaciones Técnicas
- **Rango dinámico**: 60 dB
- **Frecuencia de muestreo**: 16-44.1 kHz
- **Resolución**: 24-bit
- **Sensibilidad**: -26 dBFS
- **Consumo**: 1.4 mA @ 1.8V

## Esquema de Conexiones

### ESP32
```
INMP441  →  ESP32
-----------------
VDD      →  3.3V
GND      →  GND
SD       →  GPIO32
WS       →  GPIO25
SCK      →  GPIO33
```

### ESP8266
```
INMP441  →  ESP8266
-------------------
VDD      →  3.3V
GND      →  GND
SD       →  D3 (GPIO0)
WS       →  D4 (GPIO2)
SCK      →  D5 (GPIO14)
```

## Archivos Principales

### `inmp441.py`
Driver del micrófono INMP441. Contiene:
- Configuración del bus I2S
- Lectura de muestras de audio
- Cálculo de niveles RMS
- Calibración del micrófono

### `inmp441_sender.py`
Script principal para envío de datos:
- Conexión WiFi
- Configuración MQTT
- Lectura continua del micrófono
- Publicación periódica de datos

### `inmp441_gateway.py`
Gateway para múltiples sensores:
- Agregación de datos de varios ESP
- Envío consolidado vía MQTT
- Gestión de conexiones

### `config.example.py`
Plantilla de configuración:
- Credenciales WiFi
- Configuración MQTT
- Parámetros de medición

## Configuración

### 1. Preparar el Entorno
```bash
# Instalar esptool para flashear
pip install esptool

# Instalar ampy para transferencia de archivos
pip install adafruit-ampy
```

### 2. Flashear MicroPython
```bash
# Para ESP32
esptool.py --chip esp32 --port /dev/ttyUSB0 erase_flash
esptool.py --chip esp32 --port /dev/ttyUSB0 write_flash -z 0x1000 esp32-20220117-v1.18.bin

# Para ESP8266
esptool.py --chip esp8266 --port /dev/ttyUSB0 erase_flash
esptool.py --chip esp8266 --port /dev/ttyUSB0 write_flash -z 0x0 esp8266-20220117-v1.18.bin
```

### 3. Configurar Credenciales
```python
# Copiar y editar config.example.py
cp config.example.py config.py

# Editar config.py con tus credenciales
WIFI_SSID = "tu_red_wifi"
WIFI_PASSWORD = "tu_contraseña"
MQTT_BROKER = "192.168.1.100"
MQTT_PORT = 1883
```

### 4. Subir Código al ESP
```bash
# Subir archivos
ampy --port /dev/ttyUSB0 put inmp441.py
ampy --port /dev/ttyUSB0 put config.py
ampy --port /dev/ttyUSB0 put inmp441_sender.py

# Ejecutar script principal
ampy --port /dev/ttyUSB0 run inmp441_sender.py
```

## Parámetros de Medición

### Configuración por Defecto
```python
SAMPLE_RATE = 44100          # Hz
BUFFER_SIZE = 1024           # muestras
MEASUREMENT_INTERVAL = 5     # segundos
CALIBRATION_OFFSET = 0.0     # dB
```

### Ajustes Recomendados
- **Ambiente interior**: Ganancia media, intervalo 5s
- **Exterior ruidoso**: Ganancia baja, intervalo 2s
- **Precisión alta**: Buffer grande (2048), intervalo 10s

## Protocolo de Datos MQTT

### Estructura del Mensaje
```json
{
  "micro_id": "E1",
  "timestamp": "2024-01-15T10:30:00Z",
  "value": 65.5,
  "unit": "dB",
  "location": "Exterior 1",
  "battery": 3.7
}
```

### Tópicos
- **Datos individuales**: `sensors/espnow/E1/data`
- **Datos agrupados**: `sensors/espnow/grouped_data`
- **Estado**: `sensors/espnow/E1/status`

## Calibración

### Método de Calibración
1. **Medición de línea base**: Ambiente silencioso (30-40 dB)
2. **Fuente de referencia**: Calibrador acústico a 94 dB
3. **Ajuste de ganancia**: Modificar `CALIBRATION_OFFSET`

### Script de Calibración
```python
# Ejecutar en REPL de MicroPython
import inmp441
mic = inmp441.INMP441()

# Medir nivel de referencia
reference_level = mic.measure_reference(94.0)

# Calcular offset
calibration_offset = 94.0 - reference_level
print(f"Offset de calibración: {calibration_offset:.2f} dB")
```

## Solución de Problemas

### Problemas Comunes

#### No hay conexión WiFi
1. Verificar SSID y contraseña
2. Comprobar señal WiFi
3. Reiniciar ESP

#### No se envían datos MQTT
1. Verificar broker MQTT
2. Comprobar tópicos
3. Revisar formato JSON

#### Lecturas inconsistentes
1. Verificar conexiones hardware
2. Calibrar micrófono
3. Ajustar ganancia

### Diagnóstico
```python
# Script de diagnóstico
import network
import time

# Verificar WiFi
wlan = network.WLAN(network.STA_IF)
print(f"WiFi conectado: {wlan.isconnected()}")
print(f"IP: {wlan.ifconfig()[0]}")

# Verificar memoria
import gc
print(f"Memoria libre: {gc.mem_free()} bytes")
```

## Optimización

### Consumo de Energía
```python
# Modo bajo consumo
import machine
import esp

# Dormir entre mediciones
esp.sleep_type(esp.SLEEP_LIGHT)
machine.deepsleep(5000)  # 5 segundos
```

### Almacenamiento Local
```python
# Guardar datos en SPIFFS en caso de desconexión
import uos
import json

def save_to_spiffs(data):
    with open('/data/backup.json', 'a') as f:
        f.write(json.dumps(data) + '\n')
```

## Seguridad

### Recomendaciones
1. **WiFi**: WPA2 o superior
2. **MQTT**: Autenticación con usuario/contraseña
3. **Datos**: Encriptación TLS si es posible
4. **Actualizaciones**: Firmware actualizado

### Configuración Segura
```python
# Usar MQTT con TLS
import ssl
ssl_context = ssl.create_default_context()

# Autenticación MQTT
MQTT_USER = "usuario"
MQTT_PASSWORD = "contraseña_segura"
```

## Contribución

### Desarrollo
1. Clonar repositorio
2. Crear rama de características
3. Implementar cambios
4. Probar en hardware real
5. Crear Pull Request

### Pruebas
- Verificar en diferentes ESP32/ESP8266
- Probar en diversos entornos acústicos
- Validar consumo de energía
- Verificar estabilidad a largo plazo

## Referencias

### Documentación
- [MicroPython Documentation](https://docs.micropython.org/)
- [ESP32 Datasheet](https://www.espressif.com/en/products/socs/esp32)
- [INMP441 Datasheet](https://www.infineon.com/cms/en/product/sensor/mems-microphones/mems-microphones-for-consumer/inmp441/)

### Herramientas
- [Thonny IDE](https://thonny.org/)
- [MQTT Explorer](http://mqtt-explorer.com/)
- [esptool](https://github.com/espressif/esptool)

### Comunidad
- [MicroPython Forum](https://forum.micropython.org/)
- [ESP32 Forum](https://www.esp32.com/)
- [Home Assistant Community](https://community.home-assistant.io/)

---
*Última actualización: Enero 2024*