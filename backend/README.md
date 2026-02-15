# Backend FastAPI - Monitoreo Acústico

Backend para visualización en tiempo real de sensores de ruido, suscrito a MQTT y con WebSocket para actualizaciones en vivo.

## Características

- **API REST** para consultas históricas a InfluxDB
- **WebSocket** (`/ws/realtime`) para datos en tiempo real
- **Suscripción MQTT** a EMQX (broker)
- **Cálculos en tiempo real**: interpolación IDW y epicentro de ruido
- **Cache** con DragonflyDB (compatible Redis)

## Estructura

```
app/
├── main.py                 # Punto de entrada FastAPI
├── mqtt/                   # Cliente MQTT
├── websocket/              # Gestor de conexiones WebSocket
├── api/                    # Endpoints REST
├── services/               # Lógica de negocio
├── utils/                  # Utilidades (config, influxdb, cálculos)
└── models/                 # Modelos de datos (Pydantic)
```

## Configuración

### Variables de entorno

Copiar `.env.example` a `.env` y configurar:

```bash
INFLUXDB_TOKEN=tu_token
INFLUXDB_URL=https://tu-influxdb.easypanel.host
INFLUXDB_ORG=tu_org
INFLUXDB_BUCKET=sensores
MQTT_BROKER=213.199.37.1
MQTT_PORT=1883
MQTT_TOPIC=sensores/ruido
```

### Mapeo de dispositivos

El backend necesita saber cómo relacionar los `micro_id` del payload MQTT (ej. "E255", "E1") con los nombres de micro en `config/sensores.yaml` (ej. "micro_01").

Por defecto se usa el siguiente mapeo (editar en `app/utils/config_loader.py`):

```python
DEVICE_MAPPING = {
    "E1": "micro_01",
    "E2": "micro_02",
    "E3": "micro_03",
    "E4": "micro_04",
    "E5": "micro_05",
    "E255": "micro_06",
}
```

## Ejecución con Docker Compose

```bash
docker-compose up -d backend cache
```

El backend estará disponible en `http://localhost:8000`.

## Endpoints principales

- `GET /` → Información del API
- `GET /health` → Estado del sistema
- `GET /api/sensores` → Lista de sensores configurados
- `GET /api/ultimos` → Últimos datos en tiempo real
- `POST /api/historicos` → Datos históricos (parámetros en JSON)
- `GET /api/historicos/recientes?hours=5` → Datos recientes
- `GET /api/estadisticas/{micro_id}/{sample}?hours=24` → Estadísticas de sensor
- `WS /ws/realtime` → WebSocket para datos en tiempo real

## Pruebas

### Verificar conexión MQTT

1. Asegurarse que EMQX esté accesible en `MQTT_BROKER:MQTT_PORT`.
2. El backend intentará conectarse al arrancar y suscribirse al tópico `sensores/ruido`.
3. Ver logs: `docker-compose logs -f backend`.

### Probar WebSocket

Usar herramienta como `websocat`:

```bash
websocat ws://localhost:8000/ws/realtime
```

Debería recibir actualizaciones cada 5 segundos con el estado actual de los sensores.

### Probar API REST

```bash
curl http://localhost:8000/api/sensores
curl http://localhost:8000/api/ultimos
```

## Desarrollo

### Instalar dependencias localmente

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Ejecutar localmente (sin Docker)

```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

### Variables de entorno necesarias

Asegurarse de que las variables de entorno estén definidas (copiar de `.env` del proyecto raíz).

## Notas

- El backend **no almacena datos**; InfluxDB se encarga del almacenamiento histórico.
- Los cálculos de IDW y epicentro se realizan cada 10 segundos (configurable en `app/services/data_service.py`).
- El cache DragonflyDB almacena consultas frecuentes para mejorar rendimiento.

---
*Última actualización: Febrero 2026*
