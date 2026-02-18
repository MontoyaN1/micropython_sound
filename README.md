# Sistema de Monitoreo Acústico en Tiempo Real - Tesis de Grado

## Descripción del Proyecto

Sistema IoT para monitoreo y visualización de niveles de ruido en tiempo real, desarrollado como proyecto de tesis de grado. El sistema integra dispositivos MicroPython (ESP32/ESP8266) con micrófonos INMP441, procesamiento de datos con Node-RED, almacenamiento en InfluxDB, y visualización mediante una interfaz web React con mapas de calor interactivos.

### Objetivos Principales

1. **Monitoreo en tiempo real** de niveles de ruido ambiental
2. **Visualización espacial** mediante mapas de calor (heatmaps)
3. **Almacenamiento histórico** para análisis temporal
4. **Arquitectura escalable** que permita agregar nuevos sensores
5. **Interfaz intuitiva** para operadores y análisis de datos

## Arquitectura del Sistema

### Diagrama de Componentes

```
┌─────────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Sensores      │    │   Broker    │    │  Procesa-   │    │  Almacena-  │
│   MicroPython   │────│    MQTT     │────│   miento    │────│   miento    │
│   (ESP32/8266)  │    │   (EMQX)    │    │  Node-RED   │    │  InfluxDB   │
└─────────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
                                                      │              │
                                                      ▼              ▼
                                               ┌─────────────┐    ┌─────────────┐
                                               │    Cache    │    │   Backend   │
                                               │ DragonflyDB │    │   FastAPI   │
                                               └─────────────┘    └─────────────┘
                                                              │
                                                              ▼
                                                       ┌─────────────┐
                                                       │  Frontend   │
                                                       │    React    │
                                                       └─────────────┘
```

### Flujo de Datos

1. **Adquisición**: Sensores ESP32/ESP8266 con micrófonos INMP441 capturan niveles de sonido
2. **Transmisión**: Datos enviados vía WiFi al broker MQTT (EMQX)
3. **Procesamiento**: Node-RED recibe, valida y transforma los datos
4. **Almacenamiento**: Datos históricos guardados en InfluxDB (series temporales)
5. **Cache**: Datos frecuentes almacenados en DragonflyDB (compatible Redis)
6. **API**: Backend FastAPI proporciona REST API y WebSocket
7. **Visualización**: Frontend React muestra mapas de calor en tiempo real

## Estructura Completa del Proyecto

```
micropython_sound/
├── sensor/                 # Código para dispositivos ESP32/ESP8266
│   ├── esp32_sender.py    # Sensor emisor - Captura audio y envía via ESP-NOW
│   ├── esp32_gateway.py   # Gateway receptor - Recibe ESP-NOW y envía MQTT
│   ├── mac_gateway.py     # Utilidad para obtener dirección MAC del gateway
│   ├── config.py          # Configuración real (credenciales WiFi y MQTT)
│   ├── config.example.py  # Plantilla de configuración
│   └── README.md          # Documentación completa del sistema de sensores
│
├── backend/               # Backend FastAPI (Python)
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py        # Punto de entrada principal de FastAPI
│   │   ├── api/           # Endpoints REST
│   │   │   ├── __init__.py
│   │   │   ├── endpoints.py # Definición de endpoints
│   │   │   └── schemas.py   # Modelos Pydantic
│   │   ├── mqtt/          # Cliente MQTT
│   │   │   ├── __init__.py
│   │   │   ├── client.py   # Conexión a broker MQTT
│   │   │   └── handler.py  # Manejo de mensajes MQTT
│   │   ├── websocket/     # Comunicación en tiempo real
│   │   │   ├── __init__.py
│   │   │   ├── manager.py  # Gestión de conexiones WebSocket
│   │   │   └── socketio_manager.py # Alternativa con Socket.IO
│   │   ├── services/      # Lógica de negocio
│   │   │   ├── __init__.py
│   │   │   ├── data_service.py     # Servicio de datos
│   │   │   ├── epicentro_service.py # Cálculo de epicentro
│   │   │   └── idw_service.py      # Interpolación IDW
│   │   ├── utils/         # Utilidades
│   │   │   ├── __init__.py
│   │   │   ├── config_loader.py    # Carga de configuración
│   │   │   ├── distribucion_idw.py # Algoritmo IDW
│   │   │   ├── epicentro.py        # Cálculo de epicentro
│   │   │   └── influxdb.py         # Conexión a InfluxDB
│   │   └── models/        # Modelos de datos (Pydantic)
│   │       └── __init__.py
│   ├── requirements.txt   # Dependencias Python
│   ├── Dockerfile         # Docker para desarrollo
│   ├── Dockerfile.production # Docker para producción
│   └── README.md          # Documentación del backend
│
├── frontend/              # Frontend React (JavaScript/TypeScript)
│   ├── src/
│   │   ├── components/    # Componentes React
│   │   │   ├── Layout/    # Componentes de layout
│   │   │   │   ├── Header.jsx
│   │   │   │   └── Sidebar.jsx
│   │   │   └── Map/       # Componentes de mapa
│   │   │       ├── RealTimeMap.jsx      # Mapa en tiempo real
│   │   │       ├── RealTimeMap.jsx.backup
│   │   │       ├── FloorPlanMap.jsx     # Plano interior
│   │   │       └── FloorPlanMap.jsx.backup
│   │   ├── pages/         # Páginas principales
│   │   │   ├── RealTimePage.jsx   # Página de tiempo real
│   │   │   └── HistoricalPage.jsx # Página histórica
│   │   ├── services/      # Servicios de conexión
│   │   │   └── api.js     # Cliente API REST
│   │   ├── hooks/         # Hooks personalizados
│   │   │   └── useWebSocket.js # Hook para WebSocket
│   │   ├── styles/        # Estilos CSS
│   │   │   └── index.css  # Estilos globales
│   │   ├── utils/         # Utilidades frontend
│   │   ├── App.jsx        # Componente raíz de React
│   │   └── main.jsx       # Punto de entrada
│   ├── public/            # Archivos estáticos
│   │   ├── plano.png      # Imagen del plano interior
│   │   ├── favicon.svg    # Favicon
│   │   ├── map-config.json # Configuración del mapa
│   │   └── site.webmanifest # Web app manifest
│   ├── package.json       # Dependencias Node.js
│   ├── package-lock.json  # Lock de dependencias
│   ├── vite.config.js     # Configuración de Vite
│   ├── tailwind.config.js # Configuración de TailwindCSS
│   ├── postcss.config.js  # Configuración de PostCSS
│   ├── Dockerfile         # Docker para desarrollo
│   ├── Dockerfile.production # Docker para producción
│   ├── entrypoint.sh      # Script de entrada personalizado
│   ├── test_heatmap.html  # Página de prueba de heatmap
│   └── README.md          # Documentación del frontend
│
├── node_red/              # Flujos de Node-RED
│   ├── flow.json          # Flujo principal de Node-RED
│   ├── consultar_emqx.json # Configuración de nodo MQTT
│   ├── http_request.json  # Configuración de nodo HTTP
│   ├── procesamiento.json # Función de procesamiento
│   ├── procesamiento.js   # Módulo JavaScript de procesamiento
│   ├── error_catch.json   # Configuración de manejo de errores
│   ├── logs_emqx.json     # Configuración de logs MQTT
│   ├── logs_http.json     # Configuración de logs HTTP
│   └── README.md          # Documentación de Node-RED
│
├── location/              # Configuración de ubicaciones
│   ├── sensores.yaml      # Configuración de ubicaciones de sensores
│   └── README.md          # Documentación de configuración
│
├── doc/                   # Documentación académica
│   └── README.md          # Guía de documentación académica
│
├── .vscode/               # Configuración de VS Code
│   └── settings.json      # Configuración del editor
│
├── docker-compose.yml     # Configuración Docker para desarrollo
├── docker-compose.prod.yml # Configuración Docker para producción
├── docker-compose.prod-redis.yml # Alternativa con Redis
├── docker-compose.prod-dragonfly.yml # Alternativa con DragonflyDB
│
├── deploy.sh              # Script de despliegue automatizado
├── EASYPANEL_SETUP.md     # Guía de despliegue en EasyPanel
├── env-example-easypanel.txt # Plantilla de variables para EasyPanel
├── .env.example           # Variables de entorno de ejemplo
│
├── .gitignore             # Archivos ignorados por Git
├── LICENSE                # Licencia del proyecto
└── requirements.txt       # Dependencias Python (legacy)
```

### Arquitectura Tecnológica

#### Capa de Hardware

- **Microcontroladores**: ESP32 / ESP8266
- **Sensores**: Micrófonos INMP441 (I2S)
- **Comunicación**: WiFi 802.11n
- **Protocolo**: MQTT sobre TCP/IP

#### Capa de Middleware

- **Broker MQTT**: EMQX
- **Procesamiento**: Node-RED
- **Orquestación**: Docker Compose
- **Cache**: DragonflyDB (Redis-compatible)

#### Capa de Backend

- **Framework**: FastAPI (Python 3.9+)
- **Base de datos**: InfluxDB (series temporales)
- **Comunicación**: WebSocket, REST API
- **Algoritmos**: Interpolación IDW, cálculo de epicentro

#### Capa de Frontend

- **Framework**: React 18
- **Mapas**: Leaflet + Leaflet.heat
- **Estilos**: TailwindCSS
- **Build**: Vite
- **Estado**: React Hooks + Context

### Dependencias Principales

#### Backend (Python)

- FastAPI >= 0.104.0
- Pydantic >= 2.5.0
- InfluxDB-client >= 1.40.0
- Paho-MQTT >= 1.6.1
- Websockets >= 12.0
- NumPy >= 1.24.0 (para cálculos IDW)

#### Frontend (JavaScript)

- React >= 18.2.0
- React DOM >= 18.2.0
- React Leaflet >= 4.2.1
- Leaflet >= 1.9.4
- Leaflet.heat >= 0.2.0
- Axios >= 1.6.2
- TailwindCSS >= 3.3.6
- Vite >= 5.0.8

## Convenciones del Proyecto

### Nomenclatura

- **Archivos Python**: snake_case.py
- **Archivos JavaScript**: camelCase.js/jsx
- **Componentes React**: PascalCase.jsx
- **Variables**: descriptivas en inglés

### Estructura de Commits

```
feat: nueva funcionalidad
fix: corrección de bug
docs: documentación
style: formato (sin cambios funcionales)
refactor: refactorización de código
test: pruebas
chore: tareas de mantenimiento
```

### Documentación

- Cada carpeta principal tiene su README.md
- Comentarios en código explicando lógica compleja
- Documentación académica en `doc/`
- Guías de despliegue separadas

## Requisitos del Sistema

### Hardware

- **Sensores**: ESP32 o ESP8266 con micrófono INMP441
- **Servidor**: Mínimo 2GB RAM, 2 vCPU (recomendado 4GB RAM, 4 vCPU)
- **Red**: Conexión WiFi para sensores, red estable para servidor

### Software

- **Docker** y **Docker Compose** para despliegue
- **Python 3.9+** para desarrollo
- **Node.js 18+** para frontend
- **Git** para control de versiones

## Instalación y Configuración

### 1. Clonar el Repositorio

```bash
git clone <url-del-repositorio>
cd micropython_sound
```

### 2. Configurar Variables de Entorno

```bash
cp .env.example .env
# Editar .env con tus credenciales
```

Variables esenciales:

```env
# Configuracion de influxdb
INFLUXDB_TOKEN=tu_token
INFLUXDB_ORG=tu_org
INFLUXDB_BUCKET=tu_bucket


#Congiruacion de broker
MQTT_BROKER="ip_broker_host"
MQTT_PORT=1883
MQTT_TOPIC=tu/topico

# Frontend React
VITE_API_URL=/api

```

### 3. Configurar Ubicación de Sensores

Editar `location/sensores.yaml` con las coordenadas de tus sensores:

```yaml
microcontrollers:
  micro_E1:
    location: [1.5, 3] # [x, y] en metros
    coordinates_type: "relative"
    room: "Exterior 1"
  # ... más sensores
```

### 4. Desplegar con Docker Compose

```bash
# Desarrollo
./deploy.sh start dev

# Producción
./deploy.sh start prod
```

### 5. Acceder a la Aplicación

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **Health Check**: http://localhost:8000/health
- **WebSocket**: ws://localhost:8000/ws/realtime

## Configuración de Sensores

### Hardware Requerido

1. **ESP32** (tanto para sensores como para gateway)
2. **Micrófono INMP441** (solo para sensores emisores)
3. **Conexiones para sensores**:
   - VDD: 3.3V
   - GND: Tierra
   - SD: GPIO34 (entrada de datos)
   - WS: GPIO25 (selección de palabra)
   - SCK: GPIO14 (reloj serial)
   - LED: GPIO2 (indicador visual)
4. **Conexiones para gateway**:
   - LED: GPIO2 (indicador de estado)
   - (No requiere micrófono INMP441)

### Configuración del Sistema

1. **Configurar gateway**:
   - Subir `sensor/config.py` y `sensor/esp32_gateway.py` al ESP32 gateway
   - Ejecutar `sensor/mac_gateway.py` para obtener dirección MAC del gateway
   - Copiar la dirección MAC mostrada

2. **Configurar sensores**:
   - Editar `sensor/esp32_sender.py` y actualizar `PEER_MAC` con la dirección del gateway
   - Asignar un `MICRO_ID` único a cada sensor (ej: "E1", "E2", "E3")
   - Subir `sensor/esp32_sender.py` a cada ESP32 sensor

3. **Archivo config.py en gateway**:
   - **IMPORTANTE**: El archivo `sensor/config.py` con los datos del broker MQTT DEBE estar presente en el ESP32 gateway
   - Contiene credenciales WiFi: `WIFI_SSID` y `WIFI_PASSWORD`
   - Contiene configuración MQTT: `MQTT_BROKER` y `MQTT_PORT`
   - Opcionalmente puede incluir autenticación MQTT: `MQTT_USER` y `MQTT_PASSWORD`

### Protocolo de Comunicación

1. **ESP-NOW**: Sensores envían datos al gateway cada 5 segundos
2. **MQTT**: Gateway agrega datos y los envía al broker cada 10 segundos
3. **Tópico MQTT**: `sensors/espnow/grouped_data`

### Verificación

1. Ejecutar gateway primero: `ampy --port /dev/ttyUSB0 run esp32_gateway.py`
2. Ejecutar sensores después: `ampy --port /dev/ttyUSB1 run esp32_sender.py`
3. Verificar datos en broker MQTT usando MQTT Explorer

## Procesamiento con Node-RED

### Flujo Principal

1. **Recepción MQTT**: Suscripción a `sensors/espnow/grouped_data`
2. **Validación**: Verificar formato y rangos de datos
3. **Transformación**: Convertir a formato InfluxDB Line Protocol
4. **Envío**: Almacenar en InfluxDB
5. **Logging**: Registrar eventos para monitoreo

### Configuración

1. Importar `node_red/flow.json` en Node-RED
2. Configurar credenciales MQTT e InfluxDB
3. Ajustar tópicos según configuración de sensores
4. Desplegar flujo

## Backend FastAPI

### Características

- **API REST** para datos históricos
- **WebSocket** para datos en tiempo real
- **Cliente MQTT** integrado
- **Cache** con DragonflyDB
- **Interpolación IDW** para mapas de calor

### Endpoints Principales

- `GET /health` - Estado del sistema
- `GET /api/sensors` - Lista de sensores
- `GET /api/data/recent` - Datos recientes
- `GET /api/data/historical` - Datos históricos
- `WS /ws/realtime` - WebSocket para tiempo real

## Frontend React

### Componentes Principales

1. **RealTimeMap** - Mapa con heatmap en tiempo real
2. **FloorPlanMap** - Plano interior con visualización detallada
3. **HistoricalPage** - Análisis de datos históricos
4. **ControlPanel** - Controles de visualización

### Tecnologías Utilizadas

- **React 18** con hooks
- **Leaflet** para mapas interactivos
- **Leaflet.heat** para heatmaps
- **TailwindCSS** para estilos
- **Vite** para build y desarrollo
- **Axios** para llamadas API
- **WebSocket** para actualizaciones en tiempo real

## Algoritmo de Interpolación IDW

### Descripción

Inverse Distance Weighting (IDW) es un método de interpolación espacial que asigna valores a puntos no muestreados basándose en la distancia a puntos conocidos.

### Implementación

```python
def idw_interpolation(points, grid_resolution=0.5, power=2):
    """
    points: [(x, y, value), ...]
    grid_resolution: metros entre puntos de la grilla
    power: factor de ponderación (mayor = más influencia local)
    """
    # Crear grilla regular
    # Calcular valores interpolados
    # Aplicar ponderación por distancia inversa
    return grid_values
```

### Parámetros Ajustables

- **Power (p)**: Controla la influencia de puntos distantes (p=2 recomendado)
- **Radio de influencia**: Distancia máxima para considerar un punto
- **Resolución de grilla**: Detalle del mapa de calor

## Despliegue en Producción

### Opción 1: Docker Compose (Autónomo)

```bash
./deploy.sh start prod
./deploy.sh status prod
```

### Opción 2: EasyPanel (Recomendado)

Ver guía completa en [EASYPANEL_SETUP.md](EASYPANEL_SETUP.md)

### Requisitos de Recursos

| Servicio  | CPU  | RAM    | Disco |
| --------- | ---- | ------ | ----- |
| Backend   | 0.5  | 512MB  | 100MB |
| Frontend  | 0.25 | 256MB  | 50MB  |
| Cache     | 0.5  | 512MB  | 100MB |
| **Total** | 1.25 | 1.25GB | 250MB |

## Pruebas y Validación

### Pruebas Unitarias

```bash
# Backend
cd backend
pytest tests/

# Frontend
cd frontend
npm test
```

### Validación de Datos

1. **Rangos**: 40-120 dB (audible)
2. **Frecuencia**: Muestreo cada 100ms
3. **Precisión**: ±2 dB
4. **Latencia**: < 5 segundos end-to-end

### Pruebas de Integración

1. **Flujo completo**: Sensor → MQTT → Node-RED → InfluxDB → Frontend
2. **WebSocket**: Conexión y actualizaciones en tiempo real
3. **API REST**: Consultas históricas y estado

## Mantenimiento y Monitoreo

### Métricas Clave

1. **Disponibilidad**: Uptime > 99.5%
2. **Latencia**: < 5s sensor a visualización
3. **Precisión**: Error < ±3 dB
4. **Capacidad**: Hasta 50 sensores simultáneos

### Logs y Monitoreo

- **Backend**: Logs en `backend/app.log`
- **Frontend**: Console del navegador
- **Docker**: `docker-compose logs`
- **Health Checks**: Endpoint `/health`

### Backup

1. **Configuración**: Script `./deploy.sh backup`
2. **Datos**: Export periódico de InfluxDB
3. **Código**: Repositorio Git

## Solución de Problemas

### Problemas Comunes

#### Sensores no envían datos

1. Verificar conexión WiFi
2. Comprobar broker MQTT
3. Revisar tópicos de publicación
4. Verificar alimentación y conexiones hardware

#### Datos no aparecen en frontend

1. Verificar conexión WebSocket
2. Comprobar API backend (`/health`)
3. Revisar consola del navegador
4. Verificar datos en InfluxDB

#### Mapa de calor no se muestra

1. Verificar carga de `plano.png`
2. Comprobar datos IDW del backend
3. Revisar configuración de sensores
4. Verificar interpolación IDW

### Herramientas de Diagnóstico

- **MQTT**: Mosquitto client o MQTT Explorer
- **InfluxDB**: CLI o Chronograf
- **Red**: `curl` para API, `websocat` para WebSocket
- **Docker**: `docker-compose logs -f`

## Contribución al Proyecto

### Para Desarrolladores

1. Fork del repositorio
2. Crear rama de características
3. Implementar cambios
4. Ejecutar pruebas
5. Crear Pull Request

### Estándares de Código

- **Python**: PEP 8, type hints
- **JavaScript**: ESLint, Prettier
- **Commits**: Conventional Commits
- **Documentación**: Actualizar READMEs correspondientes

### Roadmap de Desarrollo

1. **Fase 1**: Sistema básico funcional ✓
2. **Fase 2**: Optimización y escalabilidad ✓
3. **Fase 3**: Análisis avanzado (ML) ⏳
4. **Fase 4**: Integración con sistemas externos ⏳

## Aspectos Académicos

### Contribución a la Investigación

1. **Metodología**: Sistema IoT para monitoreo ambiental
2. **Innovación**: Interpolación IDW para visualización espacial
3. **Aplicación**: Monitoreo de contaminación acústica urbana
4. **Escalabilidad**: Arquitectura modular para expansión

### Aplicaciones Prácticas

1. **Monitoreo urbano**: Contaminación acústica en ciudades
2. **Industrial**: Niveles de ruido en fábricas
3. **Educacional**: Concienciación ambiental
4. **Investigación**: Estudios de acústica ambiental

### Limitaciones y Trabajo Futuro

1. **Calibración automática** de sensores
2. **Análisis predictivo** con machine learning
3. **Integración** con sistemas de alerta temprana
4. **Movilidad** con sensores portátiles

## Licencia y Atribución

### Licencia

Este proyecto se distribuye bajo la licencia MIT. Ver archivo [LICENSE](LICENSE) para detalles.

### Atribución

- **MicroPython**: https://micropython.org
- **INMP441**: Infineon Technologies
- **React**: Facebook Open Source
- **FastAPI**: Sebastián Ramírez
- **Leaflet**: Vladimir Agafonkin
- **InfluxDB**: InfluxData

### Cita Académica

```
[Sistema de Monitoreo Acústico en Tiempo Real]. (2024).
Proyecto de Tesis de Grado. Universidad [Nombre de la Universidad].
```

## Mantenimiento y Escalabilidad

### Monitoreo

- Health checks: `GET /health`
- Logs estructurados por servicio
- Métricas de rendimiento en backend

### Escalabilidad Horizontal

- Sensores: Agregar nuevos en `sensores.yaml`
- Backend: Replicar con balanceador de carga
- Base de datos: InfluxDB clustering
- Cache: DragonflyDB en cluster

### Backup y Recuperación

- Configuración: Script `./deploy.sh backup`
- Datos: Export periódico de InfluxDB
- Código: Repositorio Git con tags

## Contribución al Proyecto

### Para Desarrolladores

1. Fork del repositorio
2. Crear rama de características
3. Implementar cambios con pruebas
4. Actualizar documentación
5. Crear Pull Request

### Para Investigadores Académicos

1. Revisar documentación en `doc/`
2. Replicar sistema siguiendo guías
3. Extender según necesidades de investigación
4. Contribuir con hallazgos y mejoras

### Para Usuarios Finales

1. Seguir guía de despliegue en `README.md`
2. Configurar según entorno específico
3. Reportar issues en el repositorio
4. Contribuir con casos de uso

## Contacto y Soporte

### Autor

Juan Pablo Montoya Valencia - juanpablomontoyajpmv@gmail.com

### Supervisión

Anderson Páez Chanagá

### Repositorio

https://github.com/MontoyaN1/micropython_sound.git

---

_Este proyecto fue desarrollado como parte de los requisitos para la obtención del título de Técnologo en Desarrollo de Sistemas Informáticos en nombre de Unidades Tecnológicas de Santander._
