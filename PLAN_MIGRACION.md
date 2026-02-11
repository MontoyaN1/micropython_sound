# Plan de Migración: Sistema de Monitoreo Acústico en Tiempo Real

## Resumen Ejecutivo
Migración del stack actual (Dash + InfluxDB) a una arquitectura moderna basada en **FastAPI** (backend) y **React** (frontend) con **WebSocket** para visualización en tiempo real de baja latencia. Se mantiene el flujo de datos IoT existente (ESPNOW → Gateway → MQTT/EMQX → Node‑Red → InfluxDB) y se añade un backend suscrito directamente a EMQX que sirve datos en tiempo real vía WebSocket a un frontend React, mientras conserva la capacidad de consulta histórica a InfluxDB.

## Arquitectura Propuesta

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (React)                               │
│  ┌─────────────────┐  ┌─────────────────┐  ┌────────────────────────────┐  │
│  │   Mapa en       │  │   Panel de      │  │   Históricos /             │  │
│  │   Tiempo Real   │  │   Control       │  │   Análisis Temporal        │  │
│  │   (WebSocket)   │  │   (Filtros)     │  │   (REST/GraphQL)           │  │
│  └─────────────────┘  └─────────────────┘  └────────────────────────────┘  │
│          │                         │                         │              │
└──────────┼─────────────────────────┼─────────────────────────┼──────────────┘
           │ WebSocket               │ REST/GraphQL            │
           ▼                         ▼                         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                             BACKEND (FastAPI)                               │
│  ┌─────────────────┐  ┌─────────────────┐  ┌────────────────────────────┐  │
│  │   WebSocket     │  │   REST API      │  │   Cliente MQTT             │  │
│  │   (/ws/realtime)│  │   (/api/hist)   │  │   (suscrito a EMQX)        │  │
│  └─────────────────┘  └─────────────────┘  └────────────────────────────┘  │
│          │                         │                         │              │
│          │                         │                         │              │
│          └─────────────────────────┼─────────────────────────┘              │
│                                    │                                        │
│                           ┌────────▼────────┐                               │
│                           │   Caché         │                               │
│                           │   (Redis /      │                               │
│                           │   DragonflyDB)  │                               │
│                           └─────────────────┘                               │
│                                    │                                        │
└────────────────────────────────────┼────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          INFRAESTRUCTURA EXISTENTE                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌────────────────────────────┐  │
│  │     Node‑Red    │  │     InfluxDB    │  │      EMQX (MQTT)           │  │
│  │   (transforma   │  │   (almacén      │  │   (broker)                 │  │
│  │    y almacena)  │  │    histórico)   │  │                            │  │
│  └─────────────────┘  └─────────────────┘  └────────────────────────────┘  │
│          │                         │                         │              │
│          └─────────────────────────┼─────────────────────────┘              │
│                                    │                                        │
│                           ┌────────▼────────┐                               │
│                           │   Gateway       │                               │
│                           │   (ESP32)       │                               │
│                           └─────────────────┘                               │
│                                    │                                        │
│                           ┌────────▼────────┐                               │
│                           │   Sensores      │                               │
│                           │   (ESPNOW)      │                               │
│                           └─────────────────┘                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Tecnologías

### Backend
- **FastAPI**: Framework ASGI de alto rendimiento para API REST y WebSocket.
- **Paho‑MQTT / asyncio‑mqtt**: Cliente MQTT para suscripción directa a EMQX.
- **InfluxDB Client**: Conexión a InfluxDB para consultas históricas (reutilización del módulo `consultas_db.py`).
- **NumPy / SciPy**: Cálculos de IDW y epicentro (reutilización de `distribucion_idw.py` y `epicentro.py`).
- **Redis / DragonflyDB**: Caché de consultas frecuentes (última hora, 24h) y posible almacenamiento temporal de datos en tiempo real.
- **Uvicorn**: Servidor ASGI para producción.

### Frontend
- **React 18+**: Biblioteca UI con componentes funcionales y hooks.
- **TypeScript**: Tipado estático para mayor robustez.
- **Vite**: Bundler rápido y moderno.
- **TailwindCSS**: Framework de utilidades CSS para un estilo tipo GTK/Gnome.
- **React‑Leaflet**: Integración de Leaflet para mapas interactivos.
- **Leaflet.heat**: Plugin para visualización de heatmap (propagación de ruido).
- **Recharts / Chart.js**: Gráficos para análisis histórico.
- **Socket.io‑client**: Conexión WebSocket al backend (opcional, se puede usar WebSocket nativo).

### Infraestructura
- **Docker / Docker Compose**: Contenerización de todos los servicios.
- **Nginx**: Proxy inverso y servidor de archivos estáticos (opcional).
- **EasyPanel**: Panel de control para despliegue en VPS.

## Flujo de Datos

### Tiempo Real (WebSocket)
1. Los sensores envían datos vía ESPNOW al gateway (ESP32).
2. El gateway publica los datos en EMQX vía MQTT.
3. **FastAPI está suscrito al tópico MQTT correspondiente** (ej. `sensores/ruido/#`).
4. Al recibir un mensaje, FastAPI:
   - Procesa los datos (aplica offset de coordenadas según `config/sensores.yaml`).
   - Ejecuta los cálculos de IDW y epicentro (usando las funciones cacheadas existentes).
   - Actualiza la caché con los últimos datos.
   - Difunde el resultado a todos los clientes WebSocket conectados.
5. React recibe el paquete vía WebSocket y actualiza el mapa (heatmap, puntos de sensores, epicentro) **solo con los nuevos datos**, sin recargar toda la vista.

### Históricos (REST / GraphQL)
1. El frontend solicita datos históricos (rango de tiempo, agregación) a FastAPI.
2. FastAPI verifica la caché (Redis/DragonflyDB); si no hay hit, consulta InfluxDB.
3. Los datos se devuelven en formato JSON (o mediante GraphQL si se implementa).
4. React renderiza gráficos y mapas estáticos.

### Almacenamiento
- **InfluxDB**: Datos crudos y agregados a largo plazo (mantenido por Node‑Red).
- **Redis/DragonflyDB**: Caché de consultas frecuentes y posible buffer de datos en tiempo real (últimos 1000 mensajes).

## Backend FastAPI – Detalles Técnicos

### Estructura de Directorios
```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py                  # Punto de entrada FastAPI
│   ├── mqtt/                    # Cliente MQTT
│   │   ├── __init__.py
│   │   ├── client.py            # Suscripción a EMQX
│   │   └── handler.py           # Procesamiento de mensajes MQTT
│   ├── websocket/
│   │   ├── __init__.py
│   │   └── manager.py           # Gestión de conexiones WebSocket
│   ├── api/
│   │   ├── __init__.py
│   │   ├── endpoints.py         # Endpoints REST/GraphQL
│   │   └── schemas.py           # Pydantic schemas
│   ├── services/
│   │   ├── __init__.py
│   │   ├── data_service.py      # Lógica de negocio
│   │   ├── idw_service.py       # Reutiliza distribucion_idw.py
│   │   ├── epicentro_service.py # Reutiliza epicentro.py
│   │   └── cache_service.py     # Interacción con Redis/DragonflyDB
│   ├── utils/
│   │   ├── __init__.py
│   │   ├── consultas_db.py      # Adaptado del módulo actual
│   │   └── config_loader.py     # Carga de config/sensores.yaml
│   └── models/
│       └── __init__.py
├── requirements.txt
├── Dockerfile
└── docker-compose.backend.yml
```

### Endpoints Principales
- `GET /api/health` → Estado del servicio.
- `GET /api/sensores` → Lista de sensores (desde configuración YAML).
- `GET /api/historicos?start=...&end=...&aggregation=...` → Datos históricos (cacheados).
- `GET /api/ultimos` → Últimos datos (cacheados).
- `WS /ws/realtime` → WebSocket para datos en tiempo real.

### Cliente MQTT
- Suscripción a `sensores/ruido/#` (o tópico configurable).
- Parseo del payload (JSON esperado: `{micro_id, sensor_id, value, timestamp}`).
- Aplicación de offsets de coordenadas usando `config/sensores.yaml`.
- Cálculo en tiempo real de IDW y epicentro (con cache LRU para evitar recalcular con mismos datos).
- Difusión vía WebSocket.

## Frontend React – Detalles Técnicos

### Estructura de Directorios
```
frontend/
├── public/
├── src/
│   ├── components/
│   │   ├── Map/
│   │   │   ├── RealTimeMap.jsx   # Mapa principal con heatmap y WebSocket
│   │   │   ├── SensorMarker.jsx  # Marcador de sensor individual
│   │   │   ├── EpicenterMarker.jsx # Marcador de epicentro
│   │   │   └── HeatmapLayer.jsx  # Capa de heatmap (leaflet.heat)
│   │   ├── Controls/
│   │   │   ├── FilterPanel.jsx   # Filtros (tipo visualización, esquema de color)
│   │   │   └── TimeRangePicker.jsx # Selector de rango temporal
│   │   ├── Charts/
│   │   │   ├── HistoricalChart.jsx # Gráfico de series temporales
│   │   │   └── DistributionChart.jsx # Histograma de niveles
│   │   └── Layout/
│   │       ├── Header.jsx
│   │       ├── Sidebar.jsx
│   │       └── Footer.jsx
│   ├── pages/
│   │   ├── RealTimePage.jsx      # Vista de mapa en tiempo real
│   │   └── HistoricalPage.jsx    # Vista de históricos
│   ├── services/
│   │   ├── websocket.js          # Cliente WebSocket
│   │   └── api.js                # Cliente REST/GraphQL
│   ├── hooks/
│   │   ├── useWebSocket.js       # Hook personalizado para WebSocket
│   │   └── useHistoricalData.js  # Hook para datos históricos
│   ├── styles/
│   │   └── index.css             # Importa Tailwind y estilos globales
│   ├── App.jsx
│   └── main.jsx
├── tailwind.config.js            # Configuración de tema GTK/Gnome
├── vite.config.js
├── package.json
└── Dockerfile
```

### Componente de Mapa en Tiempo Real
- **Librería**: `react‑leaflet` + `leaflet.heat`.
- **Actualizaciones**: Recibe datos vía WebSocket y actualiza solo las capas afectadas (heatmap, marcadores).
- **Animación**: Transición suave de colores y opacidad para representar la propagación del ruido.
- **Interactividad**: Tooltips con detalles del sensor, zoom, pan.
- **Rendimiento**: Se usan `React.memo` y `useMemo` para evitar re‑renders innecesarios.

### Estilo Visual – GTK/Gnome con TailwindCSS
- **Paleta de colores**: Tonos grises azulados (`slate`, `gray`), acentos `blue`, `indigo`, `purple`.
- **Tipografía**: Font sans‑serif (`Inter`, `Roboto`, o sistema).
- **Componentes**: Bordes redondeados, sombras sutiles, espacios amplios.
- **Ejemplo de configuración Tailwind**:
```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
        },
        accent: {
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
        }
      },
      fontFamily: {
        sans: ['Inter', 'Roboto', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.5rem',
      }
    }
  }
}
```

## Cache y Almacenamiento

### Opciones Evaluadas
1. **Redis**: Maduro, ampliamente usado, pero monohilo y posible cuello de botella.
2. **DragonflyDB**: Compatible con Redis, multihilo, mejor uso de memoria, ideal para cargas altas.
3. **Valkey**: Fork de Redis con licencia BSD, en desarrollo activo.

**Recomendación**: **DragonflyDB** por su rendimiento multihilo y eficiencia de memoria, especialmente con 12 sensores @ 5 segundos (≈ 172,800 mensajes/día). Si prefieres una opción más sencilla, Redis también es viable.

### Esquema de Cache
- Clave `last_hour:sensor:{sensor_id}` → Últimos 60 minutos de datos (agregados por minuto).
- Clave `last_24h:sensor:{sensor_id}` → Últimas 24 horas (agregadas por hora).
- Clave `realtime_buffer` → Lista de los últimos 1000 mensajes crudos (para recuperación tras desconexión).
- TTL automático según la granularidad (1 hora, 24 horas, etc.).

## Plan de Migración (5 Fases)

### Fase 1 – Backend FastAPI (2‑3 semanas)
1. **Setup del proyecto FastAPI** con estructura de directorios.
2. **Integración de módulos existentes** (`consultas_db.py`, `distribucion_idw.py`, `epicentro.py`).
3. **Cliente MQTT** que se suscribe a EMQX y procesa mensajes.
4. **WebSocket manager** que difunde datos a clientes conectados.
5. **Endpoints REST básicos** para salud y listado de sensores.
6. **Configuración de Docker** para FastAPI + DragonflyDB.
7. **Pruebas unitarias** y de integración.

### Fase 2 – Adaptar Node‑Red (1 semana)
1. **Asegurar que Node‑Red continúe** transformando y almacenando en InfluxDB.
2. **Opcional**: Añadir flujo que reenvíe datos a FastAPI vía HTTP POST (backup hasta que el cliente MQTT esté estable).
3. **Validar** que no se pierden datos durante la migración.

### Fase 3 – Frontend React (2‑3 semanas)
1. **Setup de proyecto React** con Vite + TypeScript + TailwindCSS.
2. **Componente de mapa** con Leaflet y heatmap.
3. **Conexión WebSocket** al backend.
4. **Vista de históricos** con gráficos y filtros.
5. **Estilo GTK/Gnome** con Tailwind.
6. **Pruebas de usabilidad** y rendimiento.

### Fase 4 – Migración Gradual (1‑2 semanas)
1. **Desplegar backend y frontend** en staging (junto a Dash actual).
2. **Conectar frontend React** al WebSocket de FastAPI.
3. **Validar funcionalidad completa**: mapa en tiempo real, históricos, cálculos de IDW/epicentro.
4. **Monitorear latencia y recursos** (comparar con Dash).
5. **Feedback de usuarios** (si aplica).

### Fase 5 – Retirar Dash (1 semana)
1. **Confirmar estabilidad** del nuevo sistema.
2. **Redirigir tráfico** a la nueva aplicación React.
3. **Apagar contenedor de Dash** (mantener código por si acaso).
4. **Documentación final** y ajustes menores.

## Consideraciones de Despliegue

### EasyPanel (VPS)
- Cada servicio en contenedor Docker separado.
- Nginx como proxy inversio (opcional, EasyPanel puede manejar rutas).
- Configurar dominios/subdominios:
  - `mapa.tudominio.com` → React (frontend estático)
  - `api.tudominio.com` → FastAPI (backend)
  - `mqtt.tudominio.com` → EMQX
  - `grafana.tudominio.com` → Grafana (si se usa)

### Monitoreo
- **FastAPI**: Logs estructurados, métricas con Prometheus (opcional).
- **React**: Monitoreo de errores con Sentry o similar.
- **Infraestructura**: Uptime, uso de CPU/memoria (EasyPanel incluye monitoreo básico).

### Escalabilidad
- **FastAPI**: Puede escalar horizontalmente con múltiples workers (Uvicorn + Gunicorn).
- **WebSocket**: Usar Redis Pub/Sub o similar para sincronizar estados entre workers si se escala.
- **DragonflyDB**: Maneja conexiones concurrentes eficientemente.

## Riesgos y Mitigaciones
| Riesgo | Mitigación |
|--------|------------|
| Pérdida de datos durante la migración | Mantener Node‑Red escribiendo en InfluxDB; FastAPI solo lee/calcula. |
| Alta latencia en cálculos IDW/epicentro | Cache LRU + limitar frecuencia de cálculo (ej. cada 10 segundos). |
| Problemas de memoria con DragonflyDB/Redis | Monitorear uso y ajustar maxmemory policy; considerar agregación más agresiva. |
| Complejidad de desarrollo React | Usar componentes pre‑construidos (Leaflet, Recharts) y hooks personalizados. |
| Despliegue en EasyPanel | Probar primero en entorno local con Docker Compose. |

## Conclusión
La arquitectura propuesta resuelve los problemas de latencia y actualización de Dash al separar el flujo en tiempo real (WebSocket) del almacenamiento histórico (InfluxDB). La reutilización de los módulos Python existentes reduce el riesgo y tiempo de desarrollo. React + TailwindCSS permitirá una interfaz profesional, fluida y mantenible.

**Próximo paso**: Iniciar la Fase 1 (Backend FastAPI) con un prototipo que se suscriba a EMQX y exponga un WebSocket básico.