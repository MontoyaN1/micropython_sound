# Sistema de Monitoreo Acústico en Tiempo Real

Sistema IoT para monitoreo de niveles de ruido en tiempo real utilizando sensores MicroPython y visualización con React + Leaflet.

## Características Principales

- **Monitoreo en tiempo real**: Datos actualizados cada 5 segundos vía WebSocket
- **Mapa interactivo**: Heatmap de propagación de ruido con Leaflet
- **Sensores distribuidos**: Múltiples dispositivos MicroPython (ESP32/ESP8266)
- **Backend escalable**: FastAPI con WebSocket y API REST
- **Almacenamiento eficiente**: InfluxDB para series temporales
- **Procesamiento flexible**: Node-RED para flujos de datos
- **Cache de alto rendimiento**: DragonflyDB (compatible con Redis)

## Arquitectura del Sistema

El sistema está compuesto por los siguientes componentes:

### Componentes Principales:
1. **Sensores MicroPython**: Dispositivos ESP32/ESP8266 con micrófonos INMP441
2. **Backend FastAPI**: API REST + WebSocket para comunicación en tiempo real
3. **Frontend React**: Interfaz web con mapa interactivo y heatmap
4. **Cache DragonflyDB**: Almacenamiento en memoria para datos frecuentes
5. **InfluxDB**: Base de datos de series temporales para datos históricos
6. **Node-RED**: Procesamiento y transformación de datos MQTT
7. **EMQX**: Broker MQTT para comunicación con sensores

### Flujo de Datos:
```
Sensores → MQTT → Node-RED → InfluxDB → Backend → WebSocket → Frontend
                              ↓
                           DragonflyDB (cache)
```

## Estructura del Proyecto

```
micropython_sound/
├── sensor/                 # Código MicroPython para sensores ESP32/ESP8266
├── backend/               # Backend FastAPI (WebSocket + API REST + MQTT)
├── frontend/              # Frontend React (Leaflet + TailwindCSS + Vite)
├── node_red/              # Flujos de Node-RED (configuración)
├── location/              # Configuración de ubicaciones de sensores
├── doc/                   # Documentación
├── docker-compose.yml     # Configuración Docker para desarrollo
├── docker-compose.prod.yml # Configuración Docker para producción
├── deploy.sh              # Script de despliegue automatizado
├── EASYPANEL_SETUP.md     # Guía de despliegue en EasyPanel
├── env-example-easypanel.txt # Plantilla de variables para EasyPanel
└── .env.example           # Variables de entorno de ejemplo
```

## Despliegue Rápido

### Opción 1: Desarrollo Local con Docker Compose

```bash
# 1. Clonar el repositorio
git clone <repositorio>
cd micropython_sound

# 2. Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales

# 3. Iniciar servicios
./deploy.sh start dev

# 4. Acceder a la aplicación
# Frontend: http://localhost:3000
# Backend API: http://localhost:8000
# Backend Health: http://localhost:8000/health
```

### Opción 2: Producción con Docker Compose

```bash
# 1. Configurar variables de producción
cp .env.example .env
# Editar .env con valores de producción

# 2. Iniciar servicios de producción
./deploy.sh start prod

# 3. Verificar estado
./deploy.sh status prod
```

### Opción 3: Despliegue en EasyPanel (Recomendado para producción)

EasyPanel es un panel de control para Docker que simplifica el despliegue. Consulta el archivo [EASYPANEL_SETUP.md](EASYPANEL_SETUP.md) para instrucciones detalladas.

**Pasos básicos:**
1. Crear proyecto en EasyPanel
2. Configurar variables de entorno usando `env-example-easypanel.txt`
3. Copiar contenido de `docker-compose.prod.yml` en el editor de Docker Compose
4. Subir código vía Git o manualmente
5. Hacer deploy

**Variables clave para EasyPanel:**
- `VITE_API_URL`: URL del backend (usar `http://localhost:8000` para mismo proyecto)
- Credenciales de InfluxDB y MQTT
1. Importar los flujos desde `node_red/flow.json`
2. Configurar las credenciales según `node_red/README.md`
3. Reemplazar placeholders (`TU_*`) con valores reales

### 5. Ejecutar con Docker (recomendado)
```bash
docker-compose up -d
```

### 6. Acceder a la aplicación
- **Aplicación React**: http://localhost:3000
- **API Backend**: http://localhost:8000
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
FRONTEND_PORT=3000
BACKEND_PORT=8000
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
4. **Aplicación React** → Visualiza datos en tiempo real vía WebSocket

## Seguridad

⚠️ **IMPORTANTE**: Información sensible está protegida:

- **`.env`**: Excluido de Git (ver `.gitignore`)
- **`node_red/`**: Contiene placeholders, no credenciales reales
- **Tokens/URLs**: Usar variables de entorno en producción

## Solución de Problemas

### Datos no aparecen en la aplicación
1. Verificar conexión MQTT en Node-RED
2. Comprobar que InfluxDB recibe datos (logs de Node-RED)
3. Verificar conexión WebSocket en la aplicación React

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
./deploy.sh start
```

### Estructura de código
- `backend/`: Backend FastAPI con WebSocket y API REST
- `frontend/`: Frontend React con mapa Leaflet
- `deploy.sh`: Script de despliegue automatizado
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

## Migración en Curso

Actualmente se está migrando el sistema a una arquitectura moderna con **FastAPI (backend)** y **React (frontend)** para mejorar el rendimiento en tiempo real.

### Nueva arquitectura
- **Backend**: FastAPI con WebSocket y suscripción MQTT directa a EMQX
- **Frontend**: React con Leaflet para mapas interactivos
- **Cache**: DragonflyDB para consultas frecuentes
- **Dashboard en tiempo real**: Actualizaciones de baja latencia vía WebSocket (implementado)

### Migración completada
Ver archivo [PLAN_MIGRACION.md](PLAN_MIGRACION.md) para detalles.

### Estado actual
- **Fase 1 (Backend FastAPI)**: Implementación en progreso (código en `/backend`)
- **Fase 2 (Node-RED)**: Mantener flujo existente
- **Fase 3 (Frontend React)**: Por implementar
- **Fase 4 (Migración gradual)**: Pendiente
- **Fase 5 (Retirar Dash)**: ✅ Completado

### Arquitectura actual
```bash
# Levantar backend y cache
docker-compose up -d backend cache

# Acceder a API
curl http://localhost:8000
curl http://localhost:8000/health

# WebSocket
ws://localhost:8000/ws/realtime
```

La aplicación Dash original sigue disponible en puerto 8050 durante la migración.