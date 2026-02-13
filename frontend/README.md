# Frontend React - Monitoreo Acústico

Frontend moderno para visualización en tiempo real de sensores de ruido, construido con React, Leaflet y TailwindCSS.

## Características

- **Mapa interactivo** con Leaflet y heatmap en tiempo real
- **WebSocket** para actualizaciones automáticas cada 5 segundos
- **Estilo GTK/Gnome** con TailwindCSS personalizado
- **Datos históricos** consultados desde API REST
- **Filtros avanzados** por tiempo, agregación y sensores
- **Exportación** de datos a CSV
- **Responsive design** para móviles y escritorio

## Estructura

```
src/
├── components/
│   ├── Map/              # Componentes de mapa (Leaflet)
│   ├── Controls/         # Paneles de filtro y control
│   ├── Charts/          # Gráficos (Recharts)
│   └── Layout/          # Header, Sidebar, etc.
├── pages/
│   ├── RealTimePage.jsx # Página principal (tiempo real)
│   └── HistoricalPage.jsx # Página de datos históricos
├── services/
│   └── api.js           # Cliente API REST
├── hooks/
│   └── useWebSocket.js  # Hook para WebSocket
├── styles/
│   └── index.css        # Estilos globales (Tailwind)
└── App.jsx              # Aplicación principal
```

## Configuración

### Variables de entorno

Crear archivo `.env` en la raíz del frontend:

```bash
VITE_API_URL=http://localhost:8000
```

### Instalación y ejecución

```bash
# Instalar dependencias
npm install

# Ejecutar en desarrollo
npm run dev

# Construir para producción
npm run build

# Vista previa de producción
npm run preview
```

## Integración con Backend

El frontend se conecta al backend mediante:

1. **WebSocket** (`/ws/realtime`) para datos en tiempo real
2. **API REST** (`/api/*`) para datos históricos y estadísticas

### Endpoints utilizados

- `GET /api/sensores` → Lista de sensores configurados
- `GET /api/ultimos` → Últimos datos en tiempo real
- `POST /api/historicos` → Datos históricos con filtros
- `GET /api/historicos/recientes?hours=5` → Datos recientes
- `GET /api/estadisticas/{micro_id}/0?hours=24` → Estadísticas de sensor
- `GET /health` → Estado del sistema

## Estilo Visual

### Tema GTK/Gnome

El tema utiliza la paleta de colores de GNOME/GTK:

- **Colores primarios**: Tonos grises azulados (`slate`, `gray`)
- **Acentos**: `indigo`, `purple` para elementos interactivos
- **Tipografía**: `Inter` o `Roboto` (sans-serif)
- **Bordes redondeados**: `rounded-xl`, `rounded-2xl`
- **Sombras sutiles**: `shadow-lg`, `shadow-xl`

### Componentes personalizados

- **Cards**: Fondo blanco con bordes redondeados y sombras
- **Botones**: Gradientes y transiciones suaves
- **Inputs**: Bordes sutiles con focus rings
- **Mapa**: Estilo limpio con controles personalizados

## Desarrollo

### Tecnologías principales

- **React 18** con componentes funcionales y hooks
- **React Router 6** para navegación
- **React Leaflet** para mapas interactivos
- **Leaflet.heat** para heatmaps
- **Recharts** para gráficos (pendiente)
- **Socket.io-client** para WebSocket
- **Axios** para peticiones HTTP
- **TailwindCSS** para estilos
- **Vite** como bundler

### Estructura de componentes

#### RealTimeMap
- Mapa principal con Leaflet
- Heatmap basado en datos IDW del backend
- Marcadores de sensores con colores según nivel de ruido
- Marcador de epicentro animado
- Controles de visualización (heatmap, epicentro)

#### FilterPanel
- Filtros por rango de tiempo y agregación
- Selección de sensores específicos
- Opciones de visualización
- Botón de restablecimiento

#### Header y Sidebar
- Estado del sistema en tiempo real
- Navegación entre páginas
- Información de conexión

### Hooks personalizados

#### useWebSocket
- Conexión automática al WebSocket
- Manejo de reconexión
- Actualización de estado con datos recibidos
- Exposición de estado de conexión y datos

## Despliegue

### Docker

El frontend está configurado para ejecutarse en Docker:

```bash
# Construir imagen
docker build -t frontend-monitoreo .

# Ejecutar
docker run -p 3000:3000 frontend-monitoreo
```

### Docker Compose

Usar el archivo `docker-compose.yml` en la raíz del proyecto:

```bash
# Levantar todos los servicios
docker-compose up -d

# Acceder al frontend
http://localhost:3000
```

### Producción

Para producción, construir la aplicación y servir los archivos estáticos:

```bash
npm run build
# Los archivos estarán en /dist
```

## Notas

- El frontend asume que el backend está disponible en `VITE_API_URL`
- Los datos en tiempo real se actualizan cada 5 segundos vía WebSocket
- Los datos históricos se cachean en el backend (DragonflyDB)
- El mapa usa OpenStreetMap como base (gratuito)
- Los heatmaps se generan en el backend y se visualizan en el frontend