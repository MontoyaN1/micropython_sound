# AGENTS.md - Guía para Agentes de Código

Este documento proporciona directrices para agentes que trabajen en este proyecto.

## Visión General del Proyecto

Sistema IoT de monitoreo acústico en tiempo real que integra:
- Sensores MicroPython (ESP32) con micrófonos INMP441
- Broker MQTT (EMQX)
- Backend FastAPI (Python)
- Frontend React con mapas de calor
- Almacenamiento InfluxDB
- Cache DragonflyDB

---

## Comandos de Construcción, Lint y Pruebas

### Backend (Python/FastAPI)

```bash
# Instalar dependencias
cd backend
pip install -r requirements.txt

# Ejecutar servidor de desarrollo
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Ejecutar con Docker
docker-compose up backend

# Ejecutar todos los servicios con Docker
docker-compose up

# Ver logs
docker-compose logs -f backend
```

### Frontend (React/Vite)

```bash
# Instalar dependencias
cd frontend
npm install

# Ejecutar servidor de desarrollo
npm run dev

# Construir para producción
npm run build

# Vista previa de producción
npm run preview
```

### Pruebas

**Nota:** El proyecto actualmente NO tiene tests unitarios implementados.

```bash
# Backend (pytest) - No hay tests actualmente
cd backend
pytest

# Ejecutar un test específico (cuando existan)
pytest tests/test_file.py::test_function_name

# Frontend - No hay configuración de tests
# npm test no está configurado en package.json
```

### Docker Compose

```bash
# Desarrollo
docker-compose up

# Producción
docker-compose -f docker-compose.prod.yml up

# Con script de despliegue
./deploy.sh start dev
./deploy.sh start prod
./deploy.sh status prod
```

---

## Convenciones de Código

### Python (Backend)

#### Archivos y Nomenclatura
- **Archivos:** `snake_case.py`
- **Clases:** `PascalCase`
- **Funciones/variables:** `snake_case`
- **Constantes:** `UPPER_SNAKE_CASE`

#### Imports (orden específico)
1. Librerías estándar (`asyncio`, `logging`, `os`, `datetime`)
2. Librerías de terceros (`fastapi`, `pydantic`, `numpy`)
3. Imports locales (`from app.services...`, `from app.utils...`)

```python
# Correcto
import asyncio
import logging
from datetime import datetime

import numpy as np
from fastapi import FastAPI, WebSocket

from app.services.data_service import data_service
from app.mqtt.client import mqtt_client
```

#### Type Hints
- Usar siempre que sea posible
- Imports desde `typing` (`Dict`, `List`, `Optional`, `Tuple`, `Any`)

```python
from typing import Dict, List, Optional, Tuple, Any

def get_sensor_coordinates(micro_id: str, sample: Optional[int] = None) -> Tuple[float, float, str]:
    ...
```

#### Docstrings
- Usar español para comentarios explicativos
- Formato Google-style para funciones complejas

```python
def micro_id_to_key(micro_id: str) -> str:
    """Convertir micro_id del payload (ej. 'E1') a clave del YAML (ej. 'micro_E1')"""
    ...
```

#### Manejo de Errores
- Usar try/except con logging
- No ocultar excepciones silenciosamente
- Lanzar excepciones específicas cuando sea necesario

```python
try:
    with open(config_path, "r") as file:
        config = yaml.safe_load(file)
except FileNotFoundError:
    logger.warning(f"Archivo no encontrado: {config_path}")
except Exception as e:
    logger.error(f"Error cargando configuración: {e}")
    raise
```

#### Async/Await
- Preferir `async`/`await` para operaciones I/O
- Usar `asyncio.create_task()` para tareas en background
- Manejar `CancelledError` en cleanup

```python
async def startup_event():
    periodic_broadcast_task = asyncio.create_task(
        websocket_manager.start_periodic_broadcast(interval=5)
    )

async def shutdown_event():
    if periodic_broadcast_task:
        periodic_broadcast_task.cancel()
        try:
            await periodic_broadcast_task
        except asyncio.CancelledError:
            pass
```

#### Logging
- Usar `logging.getLogger(__name__)` en cada módulo
- Niveles: `DEBUG` (detalles), `INFO` (general), `WARNING`, `ERROR`, `CRITICAL`

```python
logger = logging.getLogger(__name__)

logger.debug(f"Sensor {sensor_key} actualizado: {value} dB")
logger.info(f"Conectado a MQTT broker {self.broker}:{self.port}")
logger.error(f"Error procesando mensaje: {e}")
```

### JavaScript/React (Frontend)

#### Archivos y Nomenclatura
- **Archivos JS/JSX:** `camelCase.js` / `camelCase.jsx`
- **Componentes React:** `PascalCase.jsx`
- **Componentes:** `PascalCase`

#### Estructura de Componentes
- Componentes funcionales con hooks
- Usar arrow functions

```jsx
import { useState, useEffect } from 'react';

const RealTimeMap = ({ sensors }) => {
  const [data, setData] = useState([]);

  useEffect(() => {
    // Effect logic
  }, []);

  return (
    <div>...</div>
  );
};

export default RealTimeMap;
```

---

## Estructura del Proyecto

```
micropython_sound/
├── backend/                    # FastAPI
│   ├── app/
│   │   ├── main.py            # Entry point
│   │   ├── api/               # Endpoints REST
│   │   ├── mqtt/              # Cliente MQTT
│   │   ├── websocket/         # WebSocket manager
│   │   ├── services/          # Lógica de negocio
│   │   └── utils/             # Utilidades
│   └── requirements.txt
│
├── frontend/                   # React + Vite
│   ├── src/
│   │   ├── components/        # Componentes React
│   │   ├── pages/             # Páginas
│   │   ├── services/          # API client
│   │   └── hooks/             # Custom hooks
│   └── package.json
│
├── sensor/                    # MicroPython (ESP32)
│   ├── esp32_sender.py
│   ├── esp32_gateway.py
│   └── config.py
│
├── location/                  # Configuración de sensores
│   └── sensores.yaml
│
└── docker-compose.yml
```

---

## Variables de Entorno

Crear `.env` desde `.env.example`:

```env
# InfluxDB
INFLUXDB_TOKEN=tu_token
INFLUXDB_URL=http://influxdb:8086
INFLUXDB_ORG=tu_org
INFLUXDB_BUCKET=tu_bucket

# MQTT
MQTT_BROKER=broker_ip
MQTT_PORT=1883
MQTT_TOPIC=sensores/ruido

# Frontend
VITE_API_URL=/api
```

---

## Puntos de Acceso Importantes

| Servicio | URL |
|----------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| Health Check | http://localhost:8000/health |
| WebSocket | ws://localhost:8000/ws/realtime |
| Nginx Dev | http://localhost:8080 |

---

## Dependencias Principales

### Backend
- fastapi >= 0.104.0
- uvicorn[standard]
- pydantic >= 2.5.0
- paho-mqtt / aiomqtt
- influxdb-client
- numpy, scipy, pandas

### Frontend
- react >= 18.2.0
- react-leaflet >= 4.2.1
- leaflet, leaflet.heat
- axios
- tailwindcss
- vite >= 5.0.8

---

## Errores Comunes a Evitar

1. **No hacer commit de archivos con secrets** - No commitear `.env`, credenciales, o tokens
2. **No usar print para debugging** - Usar `logger.debug()` o `logger.info()`
3. **No omitir type hints** - Siempre usarlos para mejor mantenibilidad
4. **No hardcodear URLs** - Usar variables de entorno
5. **No olvidar manejo de errores** - Siempre usar try/except en operaciones de riesgo

---

## Git Workflow

Commits siguiendo Conventional Commits:
```
feat: nueva funcionalidad
fix: corrección de bug
docs: documentación
style: formato (sin cambios funcionales)
refactor: refactorización
test: pruebas
chore: tareas de mantenimiento
```
