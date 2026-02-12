# Sistema de Monitoreo de Sonido con MicroPython

Proyecto de IoT que utiliza MicroPython para la lógica del sensor de sonido y Streamlit para el frontend.

## Descripción del Proyecto

Este sistema permite monitorear niveles de sonido en tiempo real utilizando:
- Sensores de sonido con MicroPython (ESP32/ESP8266)
- Node-RED para procesamiento de datos
- InfluxDB para almacenamiento de series temporales
- Streamlit/Dash para visualización

## Estructura del Proyecto

```
micropython_sound/
├── sensor/                 # Código MicroPython para sensores
├── src/                   # Código fuente de la aplicación
├── node_red/              # Flujos de Node-RED (configuración)
├── config/                # Archivos de configuración
├── doc/                   # Documentación
├── app_dash.py           # Aplicación Dash/Streamlit
├── docker-compose.yml    # Configuración Docker
├── Dockerfile            # Dockerfile para la aplicación
└── requirements.txt      # Dependencias Python
```

## Configuración Rápida

### 1. Clonar el repositorio
```bash
git clone <repositorio>
cd micropython_sound
```

### 2. Configurar variables de entorno
```bash
# Copiar el archivo de ejemplo
cp config/env.example.txt .env

# Editar .env con tus credenciales
# (Ver config/env.example.txt para detalles)
```

### 3. Instalar dependencias
```bash
pip install -r requirements.txt
```

### 4. Configurar Node-RED
1. Importar los flujos desde `node_red/flow.json`
2. Configurar las credenciales según `node_red/README.md`
3. Reemplazar placeholders (`TU_*`) con valores reales

### 5. Ejecutar con Docker (recomendado)
```bash
docker-compose up -d
```

### 6. Acceder a la aplicación
- **Aplicación Dash**: http://localhost:8050
- **Node-RED**: http://localhost:1880 (si está configurado)
- **InfluxDB**: http://localhost:8086 (si está configurado)

## Configuración Detallada

### Variables de Entorno
Crea un archivo `.env` en la raíz del proyecto con:

```bash
# InfluxDB
INFLUXDB_TOKEN=tu_token_aqui
INFLUXDB_URL=http://localhost:8086
INFLUXDB_ORG=tu_organizacion
INFLUXDB_BUCKET=tu_bucket

# MQTT/EMQX
MQTT_BROKER_URL=http://localhost:1883
MQTT_TOPIC=sensors/espnow/grouped_data

# Aplicación
DASH_PORT=8050
DEBUG_MODE=false
```

### Node-RED
Los flujos de Node-RED están en `node_red/`. Para usarlos:

1. **Importar flujo**: En Node-RED, importa `node_red/flow.json`
2. **Configurar credenciales**: Reemplazar:
   - `TU_BROKER_MQTT_AQUI` → URL de tu broker MQTT
   - `TU_TOKEN_INFLUXDB_AQUI` → Token de InfluxDB
   - `TU_ORGANIZACION` → Organización de InfluxDB
   - `TU_BUCKET` → Bucket de InfluxDB
3. **Desplegar**: Activar el flujo

### MicroPython (Sensores)
El código para los sensores está en `sensor/`. Configura:
- Conexión WiFi
- Broker MQTT
- Tópico de publicación (`sensors/espnow/grouped_data`)

## Flujo de Datos

1. **Sensores MicroPython** → Publican datos en MQTT
2. **Node-RED** → Recibe, procesa y envía a InfluxDB
3. **InfluxDB** → Almacena datos de series temporales
4. **Aplicación Dash** → Consulta y visualiza datos

## Seguridad

⚠️ **IMPORTANTE**: Información sensible está protegida:

- **`.env`**: Excluido de Git (ver `.gitignore`)
- **`node_red/`**: Contiene placeholders, no credenciales reales
- **Tokens/URLs**: Usar variables de entorno en producción

## Solución de Problemas

### Datos no aparecen en la aplicación
1. Verificar conexión MQTT en Node-RED
2. Comprobar que InfluxDB recibe datos (logs de Node-RED)
3. Verificar consultas en la aplicación Dash

### Error de conexión a InfluxDB
1. Validar token y permisos
2. Verificar que organización y bucket existen
3. Comprobar URL y puerto

### Sensores no envían datos
1. Verificar conexión WiFi
2. Comprobar configuración MQTT
3. Revisar tópico de publicación

## Desarrollo

### Ejecutar en modo desarrollo
```bash
python app_dash.py
```

### Estructura de código
- `app_dash.py`: Aplicación principal de visualización
- `src/`: Módulos de procesamiento y utilidades
- `sensor/`: Código para dispositivos MicroPython

### Contribuir
1. Fork el repositorio
2. Crear rama de características
3. Commit cambios
4. Push a la rama
5. Abrir Pull Request

## Licencia

Este proyecto es parte de una tesis universitaria. Consultar `LICENSE` para detalles.

## Contacto

Para preguntas o soporte, contactar al autor del proyecto.