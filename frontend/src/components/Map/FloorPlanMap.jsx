import { useState, useEffect, useRef } from 'react'
import { Activity, Target, Map, Grid } from 'lucide-react'

// Configuración del plano
const PLAN_WIDTH = 5  // metros
const PLAN_HEIGHT = 14 // metros
const PLAN_IMAGE_WIDTH = 202  // píxeles
const PLAN_IMAGE_HEIGHT = 562 // píxeles

// Sin márgenes - la imagen ocupa todo el espacio
const IMAGE_MARGIN_LEFT = 0  // píxeles
const IMAGE_MARGIN_TOP = 0   // píxeles
const VISIBLE_WIDTH = PLAN_IMAGE_WIDTH   // 202px
const VISIBLE_HEIGHT = PLAN_IMAGE_HEIGHT // 562px

// Factor de conversión para toda la imagen
const METERS_TO_PIXELS_X = VISIBLE_WIDTH / PLAN_WIDTH   // 202px / 5m = 40.4 px/m
const METERS_TO_PIXELS_Y = VISIBLE_HEIGHT / PLAN_HEIGHT // 562px / 14m = 40.14 px/m

// Componente de sensor para plano interior
const SensorMarker = ({ x, y, value, micro_id, location_name, last_update }) => {
  const getSensorColor = (val) => {
    if (val >= 85) return 'bg-red-500 border-red-600 text-red-600'
    if (val >= 70) return 'bg-orange-500 border-orange-600 text-orange-600'
    if (val >= 50) return 'bg-yellow-500 border-yellow-600 text-yellow-600'
    return 'bg-green-500 border-green-600 text-green-600'
  }
  
  const colorClasses = getSensorColor(value)
  const [showPopup, setShowPopup] = useState(false)
  
  // Calcular posición en metros
  const metersX = (PLAN_IMAGE_WIDTH - x) / METERS_TO_PIXELS_X
  const metersY = (PLAN_IMAGE_HEIGHT - y) / METERS_TO_PIXELS_Y
  
  return (
    <div 
      className="absolute cursor-pointer group"
      style={{ 
        left: `${x}px`, 
        top: `${y}px`,
        transform: 'translate(-50%, -50%)' // Centrar en la posición
      }}
      onMouseEnter={() => setShowPopup(true)}
      onMouseLeave={() => setShowPopup(false)}
    >
      {/* Punto del sensor */}
      <div className={`relative w-10 h-10 rounded-full bg-white border-2 ${colorClasses.split(' ')[1]} flex items-center justify-center shadow-lg`}>
        {/* ID del sensor en el centro */}
        <div className={`text-xs font-bold ${colorClasses.split(' ')[2]}`}>
          {micro_id.replace('E', '')}
        </div>
        
        {/* Valor dB en esquina */}
        <div className={`absolute -top-3 -right-3 ${colorClasses.split(' ')[0]} text-white text-xs font-bold rounded-full w-8 h-8 flex items-center justify-center shadow-md`}>
          {Math.round(value)}
        </div>
      </div>
      
      {/* Tooltip al pasar el mouse */}
      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50">
        <div className="bg-black/90 text-white text-xs rounded-lg py-2 px-3 shadow-xl whitespace-nowrap">
          <div className="font-bold">{micro_id}: {value.toFixed(1)} dB</div>
          <div className="text-gray-300">{location_name}</div>
          <div className="text-gray-400">{metersX.toFixed(1)}m, {metersY.toFixed(1)}m</div>
        </div>
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-black/90"></div>
      </div>
      
      {/* Popup detallado (click/touch) */}
      {showPopup && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-8 w-64 bg-white rounded-lg shadow-xl p-4 z-50 border border-gray-200">
          <div className="space-y-2">
            <div className="font-bold text-lg flex items-center justify-between">
              <span>{micro_id}</span>
              <span className={`text-sm px-2 py-1 rounded ${colorClasses.split(' ')[0]} text-white`}>
                {value.toFixed(1)} dB
              </span>
            </div>
            <div className="text-sm text-gray-600">{location_name}</div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <div className="text-gray-500">Coordenadas</div>
                <div>{metersX.toFixed(1)}m, {metersY.toFixed(1)}m</div>
              </div>
              <div>
                <div className="text-gray-500">Nivel</div>
                <div className={colorClasses.split(' ')[2]}>
                  {value >= 85 ? 'Crítico' : value >= 70 ? 'Alto' : value >= 50 ? 'Moderado' : 'Bajo'}
                </div>
              </div>
            </div>
            <div className="text-xs text-gray-500 border-t pt-2">
              Actualizado: {new Date(last_update).toLocaleTimeString('es-ES')}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Componente de epicentro
const EpicenterMarker = ({ x, y, calculated_at, frontend_calculated = false, max_sensor = null }) => {
  const [showPopup, setShowPopup] = useState(false)
  
  // Calcular posición en metros
  const metersX = (PLAN_IMAGE_WIDTH - x) / METERS_TO_PIXELS_X
  const metersY = (PLAN_IMAGE_HEIGHT - y) / METERS_TO_PIXELS_Y
  
  return (
    <div 
      className="absolute cursor-pointer group"
      style={{ 
        left: `${x}px`, 
        top: `${y}px`,
        transform: 'translate(-50%, -50%)' // Centrar en la posición
      }}
      onMouseEnter={() => setShowPopup(true)}
      onMouseLeave={() => setShowPopup(false)}
    >
      {/* Icono de epicentro */}
      <div className="w-14 h-14 rounded-full bg-red-500 border-4 border-white flex items-center justify-center shadow-xl animate-pulse">
        <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clipRule="evenodd"/>
        </svg>
      </div>
      
      {/* Tooltip al pasar el mouse */}
      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50">
        <div className="bg-black/90 text-white text-xs rounded-lg py-2 px-3 shadow-xl whitespace-nowrap">
          <div className="font-bold">Epicentro de Ruido</div>
          <div className="text-gray-300">{metersX.toFixed(1)}m, {metersY.toFixed(1)}m</div>
          {frontend_calculated && <div className="text-yellow-300">Calculado localmente</div>}
          {max_sensor && <div className="text-gray-400">Basado en {max_sensor}</div>}
        </div>
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-black/90"></div>
      </div>
      
      {/* Popup detallado */}
      {showPopup && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-8 w-64 bg-white rounded-lg shadow-xl p-4 z-50 border border-gray-200">
          <div className="space-y-2">
            <div className="font-bold text-lg flex items-center space-x-2">
              <Target className="h-5 w-5 text-red-500" />
              <span>Epicentro de Ruido</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <div className="text-gray-500">Coordenadas</div>
                <div>{metersX.toFixed(1)}m, {metersY.toFixed(1)}m</div>
              </div>
              <div>
                <div className="text-gray-500">Fuente</div>
                <div className={frontend_calculated ? 'text-yellow-600' : 'text-green-600'}>
                  {frontend_calculated ? 'Frontend' : 'Backend'}
                </div>
              </div>
            </div>
            {max_sensor && (
              <div className="text-sm">
                <div className="text-gray-500">Sensor de referencia</div>
                <div className="font-medium">{max_sensor}</div>
              </div>
            )}
            <div className="text-xs text-gray-500 border-t pt-2">
              Calculado: {new Date(calculated_at).toLocaleTimeString('es-ES')}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Componente para cuadrícula
const GridOverlay = ({ showGrid }) => {
  if (!showGrid) return null
  
  const gridLines = []
  const cellSizeMeters = 1
  
  // Líneas verticales (cada 1 metro) - derecha a izquierda
  for (let x = 0; x <= PLAN_WIDTH; x += cellSizeMeters) {
    // X: 0-5m (derecha=0, izquierda=5) -> píxeles: derecha=202, izquierda=0
    const xPx = PLAN_IMAGE_WIDTH - (x * METERS_TO_PIXELS_X)
    gridLines.push(
      <div
        key={`v-${x}`}
        className="absolute top-0 bottom-0 border-l border-white/30 border-dashed"
        style={{ left: `${xPx}px` }}
      />
    )
  }
  
  // Líneas horizontales (cada 1 metro) - abajo a arriba
  for (let y = 0; y <= PLAN_HEIGHT; y += cellSizeMeters) {
    // Y: 0-14m (abajo=0, arriba=14) -> píxeles: abajo=562, arriba=0
    const yPx = PLAN_IMAGE_HEIGHT - (y * METERS_TO_PIXELS_Y)
    gridLines.push(
      <div
        key={`h-${y}`}
        className="absolute left-0 right-0 border-t border-white/30 border-dashed"
        style={{ top: `${yPx}px` }}
      />
    )
  }
  
  return <>{gridLines}</>
}

// Función para calcular epicentro en frontend (fallback)
const calculateEpicenterFrontend = (sensors) => {
  if (sensors.length === 0) return null
  
  // Método 1: Ponderado por valor (más ruido = más peso)
  let totalWeight = 0
  let weightedX = 0
  let weightedY = 0
  
  sensors.forEach(sensor => {
    const weight = Math.max(sensor.value - 40, 0) // Solo valores > 40dB tienen peso
    weightedX += sensor.longitude * weight
    weightedY += sensor.latitude * weight
    totalWeight += weight
  })
  
  if (totalWeight > 0) {
    return {
      longitude: weightedX / totalWeight,
      latitude: weightedY / totalWeight,
      calculated_at: new Date().toISOString(),
      frontend_calculated: true
    }
  }
  
  // Método 2: Sensor con valor máximo
  const maxSensor = sensors.reduce((max, sensor) => 
    sensor.value > max.value ? sensor : max, sensors[0])
  
  return {
    longitude: maxSensor.longitude,
    latitude: maxSensor.latitude,
    calculated_at: new Date().toISOString(),
    frontend_calculated: true,
    max_sensor: maxSensor.micro_id
  }
}

const FloorPlanMap = ({ sensorData, idwData, epicenter, showHeatmap = true, showEpicenter = true }) => {
  const [showGrid, setShowGrid] = useState(true)
  const containerRef = useRef(null)
  
  // Calcular epicentro local si el del backend es inválido
  const effectiveEpicenter = (() => {
    if (epicenter && epicenter.longitude !== undefined && epicenter.latitude !== undefined) {
      // Verificar si el epicentro del backend es razonable
      const isReasonable = 
        epicenter.longitude >= 0 && epicenter.longitude <= 5 &&
        epicenter.latitude >= 0 && epicenter.latitude <= 14
      
      if (isReasonable) {
        console.log('Usando epicentro del backend:', epicenter)
        return epicenter
      }
    }
    
    // Calcular epicentro local como fallback
    const frontendEpicenter = calculateEpicenterFrontend(sensorData)
    console.log('Usando epicentro calculado en frontend:', frontendEpicenter)
    return frontendEpicenter
  })()
  
  // Convertir coordenadas en metros a píxeles
  // NOTA: El sistema de coordenadas tiene (0,0) en la esquina INFERIOR DERECHA
  // X: 0-5 metros (derecha a izquierda) -> en píxeles: derecha a izquierda
  // Y: 0-14 metros (abajo a arriba) -> en píxeles: abajo a arriba
  const metersToPixels = (xMeters, yMeters, microId = null) => {
    // Convertir metros a píxeles
    // X: 0-5m (derecha=0, izquierda=5) -> píxeles: derecha=202, izquierda=0
    const xPx = PLAN_IMAGE_WIDTH - (xMeters * METERS_TO_PIXELS_X)
    
    // Y: 0-14m (abajo=0, arriba=14) -> píxeles: abajo=562, arriba=0
    const yPx = PLAN_IMAGE_HEIGHT - (yMeters * METERS_TO_PIXELS_Y)
    
    console.log(`Coordenadas ${microId || ''}: ${xMeters}m, ${yMeters}m -> ${xPx}px, ${yPx}px (sistema: 0,0=esquina inferior derecha)`)
    return { x: xPx, y: yPx }
  }

  // Debug: verificar coordenadas de sensores
  useEffect(() => {
    console.log('FloorPlanMap - Props recibidas:', {
      sensorData_count: sensorData.length,
      idwData: !!idwData,
      epicenter: !!epicenter,
      showHeatmap,
      showEpicenter
    })
    
    if (sensorData.length > 0) {
      console.log('Coordenadas de sensores en FloorPlanMap:', sensorData.map(s => ({
        micro_id: s.micro_id,
        latitude: s.latitude,
        longitude: s.longitude,
        pixels: metersToPixels(s.longitude, s.latitude),
        value: s.value
      })))
    } else {
      console.log('FloorPlanMap - sensorData vacío')
    }
  }, [sensorData, idwData, epicenter, showHeatmap, showEpicenter])

  return (
    <div className="relative h-full" ref={containerRef}>
      {/* Controles flotantes */}
      <div className="absolute top-4 right-4 z-[1000] space-y-2">
        <div className="card p-3 space-y-3">
          <div className="flex items-center justify-between">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showHeatmap}
                onChange={(e) => {}}
                className="rounded text-accent-500"
                disabled
              />
              <span className="text-sm font-medium">Mapa de Calor</span>
            </label>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
              <div className="w-3 h-3 rounded-full bg-cyan-500"></div>
              <div className="w-3 h-3 rounded-full bg-lime-500"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showEpicenter}
                onChange={(e) => {}}
                className="rounded text-accent-500"
                disabled
              />
              <span className="text-sm font-medium">Epicentro</span>
            </label>
            <Target className="h-4 w-4 text-red-500" />
          </div>
          
          <div className="flex items-center justify-between">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showGrid}
                onChange={(e) => setShowGrid(e.target.checked)}
                className="rounded text-accent-500"
              />
              <span className="text-sm font-medium">Cuadrícula</span>
            </label>
            <Grid className="h-4 w-4 text-primary-600" />
          </div>
        </div>
        
        <div className="card p-3">
          <div className="flex items-center space-x-2 mb-2">
            <Map className="h-4 w-4 text-primary-600" />
            <span className="text-sm font-semibold">Plano Interior</span>
          </div>
          <div className="space-y-1 text-xs">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span>&lt; 50 dB (Bajo)</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <span>50-70 dB (Moderado)</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-orange-500"></div>
              <span>70-85 dB (Alto)</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <span>&gt; 85 dB (Crítico)</span>
            </div>
          </div>
        </div>
        
        <div className="card p-3">
          <div className="text-xs text-primary-600">
            <div className="font-medium mb-1">Escala:</div>
            <div>5m × 14m</div>
            <div>Cuadrícula: 1m × 1m</div>
            <div>Imagen: {PLAN_IMAGE_WIDTH}×{PLAN_IMAGE_HEIGHT}px</div>
            <div>Escala: {METERS_TO_PIXELS_X.toFixed(1)} px/m</div>
          </div>
        </div>
      </div>

      {/* Contenedor del plano */}
      <div className="relative h-full rounded-2xl shadow-lg bg-gray-800 overflow-hidden">
        {/* Imagen del plano como fondo - MOSTRAR A TAMAÑO NATURAL */}
        <div className="relative w-full h-full flex items-center justify-center overflow-auto">
          <div className="relative" style={{ width: `${PLAN_IMAGE_WIDTH}px`, height: `${PLAN_IMAGE_HEIGHT}px` }}>
            <img
              src="/plano.png"
              alt="Plano interior"
              className="w-full h-full"
              onLoad={() => console.log('Plano cargado correctamente')}
              onError={() => console.error('Error cargando plano.png')}
            />
            
            {/* Contenedor para superposiciones (sensores, cuadrícula) */}
            <div className="absolute inset-0">
              {/* Cuadrícula superpuesta */}
              <div className="absolute inset-0 pointer-events-none">
                <GridOverlay showGrid={showGrid} />
              </div>
              
              {/* Sensores */}
              <div className="absolute inset-0">
                {sensorData.map((sensor, index) => {
                  const { x, y } = metersToPixels(sensor.longitude, sensor.latitude, sensor.micro_id)
                  console.log(`Sensor ${sensor.micro_id}:`, {
                    meters: { lon: sensor.longitude, lat: sensor.latitude },
                    pixels: { x, y },
                    value: sensor.value,
                    location_name: sensor.location_name
                  })
                  
                  return (
                    <SensorMarker
                      key={`${sensor.micro_id}-${index}`}
                      x={x}
                      y={y}
                      value={sensor.value}
                      micro_id={sensor.micro_id}
                      location_name={sensor.location_name}
                      last_update={sensor.last_update}
                    />
                  )
                })}
                
                {/* Marcadores de referencia para debugging con nuevo sistema de coordenadas */}
                <div className="absolute w-2 h-2 bg-blue-500 rounded-full" style={{ left: `${PLAN_IMAGE_WIDTH}px`, top: `${PLAN_IMAGE_HEIGHT}px`, transform: 'translate(-50%, -50%)' }} title="Esquina inferior derecha (0,0)"></div>
                <div className="absolute w-2 h-2 bg-blue-500 rounded-full" style={{ left: '0px', top: `${PLAN_IMAGE_HEIGHT}px`, transform: 'translate(-50%, -50%)' }} title="Esquina inferior izquierda (5,0)"></div>
                <div className="absolute w-2 h-2 bg-blue-500 rounded-full" style={{ left: `${PLAN_IMAGE_WIDTH}px`, top: '0px', transform: 'translate(-50%, -50%)' }} title="Esquina superior derecha (0,14)"></div>
                <div className="absolute w-2 h-2 bg-blue-500 rounded-full" style={{ left: '0px', top: '0px', transform: 'translate(-50%, -50%)' }} title="Esquina superior izquierda (5,14)"></div>
              </div>
              
              {/* Epicentro - usar posición efectiva (backend o frontend) */}
              {showEpicenter && effectiveEpicenter && (
                <div className="absolute inset-0">
                  <EpicenterMarker
                    x={metersToPixels(effectiveEpicenter.longitude, effectiveEpicenter.latitude).x}
                    y={metersToPixels(effectiveEpicenter.longitude, effectiveEpicenter.latitude).y}
                    calculated_at={effectiveEpicenter.calculated_at}
                    frontend_calculated={effectiveEpicenter.frontend_calculated}
                    max_sensor={effectiveEpicenter.max_sensor}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default FloorPlanMap