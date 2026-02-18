# Sistema de Sensores de Sonido con MicroPython

## Descripción

Este sistema implementa una red de sensores de sonido basados en ESP32 que capturan niveles de decibelios (dB) en tiempo real y los transmiten mediante ESP-NOW a un gateway central, el cual agrega los datos y los envía a un broker MQTT para procesamiento y visualización.

## Arquitectura del Sistema

```
┌─────────────────┐     ESP-NOW     ┌─────────────────┐     MQTT     ┌─────────────────┐
│   Sensores      │ ──────────────► │     Gateway     │ ────────────► │     Broker      │
│   ESP32         │                 │     ESP32       │              │     MQTT        │
│   (emisores)    │                 │   (receptor)    │              │                 │
└─────────────────┘                 └─────────────────┘              └─────────────────┘
        │                                   │                                 │
        ▼                                   ▼                                 ▼
   Captura audio                      Agrega datos                     Almacena y
   (INMP441 I2S)                     (cada 10 segundos)               distribuye datos
```

## Archivos del Proyecto

### 1. `config.example.py` - Plantilla de configuración

```python
# ===================== CONFIGURACIÓN WIFI =====================
WIFI_SSID = "tu_ssid"
WIFI_PASSWORD = "clave_ssid"

# ===================== CONFIGURACIÓN MQTT =====================
MQTT_BROKER = "ip_broker"
MQTT_PORT = 1883
MQTT_USER = ""
MQTT_PASSWORD = ""
MQTT_CLIENT_ID = "id_gateway"
MQTT_TOPIC = "tu/topico"

# ===================== CONFIGURACIÓN ESP32 =====================
ESPNOW_CAPTURE_TIME = 5
MQTT_SEND_INTERVAL = 10
LED_PIN = 2

```

**Propósito**: Plantilla para crear el archivo de configuración real. Contiene las variables de configuración necesarias para WiFi y MQTT. Copialo quiental el .example y coloca tus variables reales.

### 2. `esp32_sender.py` - Sensor emisor (captura de audio)

**Propósito**: Código que se ejecuta en los ESP32 sensores. Captura audio del micrófono INMP441 vía I2S, calcula el nivel de decibelios y lo envía mediante ESP-NOW al gateway.

**Características principales**:

- Configuración del micrófono INMP441 (pines SCK=14, WS=25, SD=34)
- Cálculo RMS del audio cada 5 segundos
- Conversión a decibelios (dB)
- Envío mediante ESP-NOW al gateway
- LED indicador de envío (pin 2)

**Flujo de trabajo**:

1. Inicializa I2S para captura de audio
2. Calcula RMS de las muestras durante 5 segundos
3. Convierte RMS a dB usando referencia de 20 μPa
4. Envía datos al gateway mediante ESP-NOW
5. Repite cada 5 segundos

### 3. `esp32_gateway.py` - Gateway central (receptor y agregador)

**Propósito**: Código que se ejecuta en el ESP32 gateway. Recibe datos de múltiples sensores mediante ESP-NOW, los agrega y los envía al broker MQTT.

**Características principales**:

- Recepción de datos ESP-NOW de múltiples sensores
- Agregación de datos durante 5 segundos
- Envío consolidado cada 10 segundos vía MQTT
- Gestión de conexiones WiFi y MQTT
- LED indicador de estado (pin 2)

**Flujo de trabajo**:

1. Conecta a WiFi usando credenciales de `config.py`
2. Captura datos ESP-NOW durante 5 segundos
3. Agrega datos de todos los sensores detectados
4. Cada 10 segundos, envía datos consolidados al broker MQTT
5. Publica en el tópico `sensors/espnow/grouped_data`

### 4. `mac_gateway.py` - Utilidad para obtener dirección MAC

**Propósito**: Script auxiliar para obtener la dirección MAC del ESP32 gateway en formato compatible con ESP-NOW.

**Uso**:

1. Ejecutar en el ESP32 que será el gateway
2. Copiar la dirección MAC mostrada
3. Pegarla en el archivo `esp32_sender.py` como `PEER_MAC`

**Salida ejemplo**:

```
MAC legible: 88:57:21:95:4d:44
MAC hex:     885721954d44

Para código ESP-NOW:
PEER_MAC = b'\x88\x57\x21\x95\x4d\x44'
```

## Configuración del Hardware

### Componentes Requeridos

1. **ESP32** (tanto para sensores como gateway)
2. **Micrófono INMP441** (solo para sensores)
3. **Fuente de alimentación 3.3V**
4. **Cables dupont**

### Esquema de Conexiones para Sensor

```
INMP441  →  ESP32 Sensor
-----------------
VDD      →  3.3V
GND      →  GND
SD       →  GPIO34 (entrada de datos)
WS       →  GPIO25 (selección de palabra)
SCK      →  GPIO14 (reloj serial)
LED      →  GPIO2 (indicador visual)
```

### Esquema de Conexiones para Gateway

```
ESP32 Gateway
-------------
LED      →  GPIO2 (indicador de estado)
         (No requiere micrófono INMP441)
```

## Instalación y Configuración

### Paso 1: Preparar el entorno

```bash
# Instalar herramientas necesarias
pip install esptool adafruit-ampy

# Flashear MicroPython en ESP32
esptool.py --chip esp32 --port /dev/ttyUSB0 erase_flash
esptool.py --chip esp32 --port /dev/ttyUSB0 write_flash -z 0x1000 esp32-20220117-v1.18.bin
```

### Paso 2: Configurar el Gateway

1. **Subir archivos al gateway**:

   ```bash
   ampy --port /dev/ttyUSB0 put config.py
   ampy --port /dev/ttyUSB0 put esp32_gateway.py
   ampy --port /dev/ttyUSB0 put mac_gateway.py
   ```

2. **Obtener dirección MAC del gateway**:
   ```bash
   ampy --port /dev/ttyUSB0 run mac_gateway.py
   ```
   Copiar la dirección MAC mostrada.

### Paso 3: Configurar los Sensores

1. **Actualizar dirección MAC en sensores**:
   Editar `esp32_sender.py` y actualizar `PEER_MAC` con la dirección obtenida del gateway.

2. **Subir archivos a cada sensor**:

   ```bash
   ampy --port /dev/ttyUSB1 put esp32_sender.py
   ```

3. **Para cada sensor, asignar un ID único**:
   Editar `MICRO_ID` en `esp32_sender.py` (ej: "E1", "E2", "E3", etc.)

### Paso 4: Ejecutar el Sistema

1. **Iniciar gateway primero**:

   ```bash
   ampy --port /dev/ttyUSB0 run esp32_gateway.py
   ```

2. **Iniciar sensores después**:
   ```bash
   ampy --port /dev/ttyUSB1 run esp32_sender.py
   ```

## Formato de Datos

### Mensaje ESP-NOW (sensor → gateway)

```
E1:65.5
```

Donde:

- `E1`: ID del sensor
- `65.5`: Valor en decibelios

### Mensaje MQTT (gateway → broker)

```json
{
  "timestamp": 1676543210,
  "sensors": [
    { "micro_id": "E1", "value": 65.5, "sample": 1 },
    { "micro_id": "E1", "value": 64.8, "sample": 2 },
    { "micro_id": "E2", "value": 62.3, "sample": 1 }
  ]
}
```

### Tópicos MQTT

- **Datos agrupados**: `sensors/espnow/grouped_data`

## Calibración del Sistema

### Calibración de decibelios

El cálculo de dB se basa en:

1. Voltaje RMS de la señal de audio
2. Referencia de presión sonora: 20 μPa (umbral de audición humana)
3. Sensibilidad del INMP441: -26 dBFS

### Ajuste de sensibilidad

Para calibrar el sistema:

1. Usar un calibrador acústico de 94 dB
2. Medir el valor reportado por el sensor
3. Ajustar la fórmula de conversión en `esp32_sender.py`

## Solución de Problemas

### Problemas Comunes

#### 1. No hay comunicación ESP-NOW

- Verificar que `PEER_MAC` en sensores coincida con la MAC real del gateway
- Asegurar que los dispositivos estén dentro del rango (≈100m en espacio abierto)
- Verificar que el gateway esté ejecutándose antes que los sensores

#### 2. No se envían datos MQTT

- Verificar conexión WiFi en gateway
- Confirmar que `config.py` tiene las credenciales correctas
- Verificar que el broker MQTT esté accesible desde la red

#### 3. Lecturas inconsistentes

- Verificar conexiones del micrófono INMP441
- Asegurar alimentación estable de 3.3V
- Verificar pines I2S configurados correctamente

### Diagnóstico

```python
# En REPL de MicroPython
import network
import time

# Verificar WiFi
wlan = network.WLAN(network.STA_IF)
print(f"Conectado: {wlan.isconnected()}")
print(f"IP: {wlan.ifconfig()[0]}")

# Verificar memoria
import gc
print(f"Memoria libre: {gc.mem_free()} bytes")
```

## Optimizaciones

### Consumo de Energía

Para aplicaciones con batería:

```python
# En esp32_sender.py, agregar después del envío
import machine
machine.deepsleep(5000)  # Dormir 5 segundos entre mediciones
```

### Almacenamiento en Fallo

Para manejar desconexiones del gateway:

```python
# En esp32_sender.py, agregar buffer local
buffer_datos = []
MAX_BUFFER = 100  # Máximo de lecturas en buffer

def guardar_en_buffer(dato):
    if len(buffer_datos) >= MAX_BUFFER:
        buffer_datos.pop(0)
    buffer_datos.append(dato)
```

## Seguridad

### Recomendaciones

1. **WiFi**: Usar red WPA2 o superior
2. **MQTT**: Implementar autenticación si el broker lo soporta
3. **Datos**: Considerar encriptación TLS para MQTT en producción
4. **IDs**: Usar IDs únicos para cada sensor

### Configuración Segura MQTT

```python
# En config.py para producción
MQTT_USER = "usuario_seguro"
MQTT_PASSWORD = "contraseña_fuerte"
# Considerar broker con TLS
MQTT_BROKER = "mqtts://broker.seguro.com"
MQTT_PORT = 8883
```

## Escalabilidad

### Máximo número de sensores

- **ESP-NOW**: Soporta hasta 20 pares simultáneos
- **Gateway**: Puede manejar múltiples sensores (limitado por ancho de banda ESP-NOW)
- **Intervalos**: Ajustar `MEASUREMENT_INTERVAL` según número de sensores

### Para más de 10 sensores

1. Aumentar intervalo de envío a 10 segundos
2. Usar múltiples gateways
3. Implementar canales ESP-NOW diferentes

## Referencias

### Documentación Técnica

- [MicroPython ESP-NOW](https://docs.micropython.org/en/latest/esp32/quickref.html#esp-now)
- [INMP441 Datasheet](https://www.infineon.com/cms/en/product/sensor/mems-microphones/mems-microphones-for-consumer/inmp441/)
- [ESP32 Technical Reference](https://www.espressif.com/en/products/socs/esp32)

### Herramientas

- [Thonny IDE](https://thonny.org/) - IDE recomendado para MicroPython
- [MQTT Explorer](http://mqtt-explorer.com/) - Cliente MQTT para debugging
- [esptool](https://github.com/espressif/esptool) - Herramienta oficial para flashear

### Comunidades

- [MicroPython Forum](https://forum.micropython.org/)
- [ESP32 Official Forum](https://www.esp32.com/)
- [Home Assistant Community](https://community.home-assistant.io/)

---

**Nota Importante**: El archivo `config.py` con los datos del broker MQTT **DEBE** estar presente en el ESP32 gateway para que el sistema funcione correctamente. Este archivo contiene las credenciales WiFi y la configuración MQTT necesaria para la comunicación.

**Última actualización**: Marzo 2024
