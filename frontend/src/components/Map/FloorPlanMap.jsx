import { useState, useEffect, useRef, useMemo, memo } from "react";
import { Activity, Target, Map, Grid } from "lucide-react";

// Configuración del plano
const PLAN_WIDTH = 5; // metros
const PLAN_HEIGHT = 14; // metros
const PLAN_IMAGE_WIDTH = 202; // píxeles
const PLAN_IMAGE_HEIGHT = 562; // píxeles

// Sin márgenes - la imagen ocupa todo el espacio
const IMAGE_MARGIN_LEFT = 0; // píxeles
const IMAGE_MARGIN_TOP = 0; // píxeles
const VISIBLE_WIDTH = PLAN_IMAGE_WIDTH; // 202px
const VISIBLE_HEIGHT = PLAN_IMAGE_HEIGHT; // 562px

// Factor de conversión para toda la imagen
const METERS_TO_PIXELS_X = VISIBLE_WIDTH / PLAN_WIDTH; // 202px / 5m = 40.4 px/m
const METERS_TO_PIXELS_Y = VISIBLE_HEIGHT / PLAN_HEIGHT; // 562px / 14m = 40.14 px/m

// Paletas de colores profesionales (compatibles con Plotly)
const colorPalettes = {
  viridis: [
    [0.267, 0.005, 0.329], // Morado oscuro
    [0.283, 0.141, 0.458],
    [0.263, 0.244, 0.533],
    [0.227, 0.343, 0.576],
    [0.196, 0.43, 0.596],
    [0.17, 0.515, 0.596],
    [0.157, 0.592, 0.577],
    [0.165, 0.664, 0.537],
    [0.208, 0.732, 0.479],
    [0.287, 0.791, 0.403],
    [0.403, 0.837, 0.312],
    [0.552, 0.868, 0.217],
    [0.722, 0.879, 0.159],
    [0.893, 0.865, 0.16],
    [0.993, 0.906, 0.144], // Amarillo brillante
  ],
  plasma: [
    [0.05, 0.03, 0.528], // Azul oscuro
    [0.316, 0.016, 0.565],
    [0.481, 0.015, 0.556],
    [0.621, 0.085, 0.508],
    [0.735, 0.17, 0.434],
    [0.827, 0.271, 0.35],
    [0.895, 0.38, 0.271],
    [0.938, 0.5, 0.203],
    [0.962, 0.625, 0.153],
    [0.969, 0.752, 0.126],
    [0.957, 0.877, 0.137],
    [0.94, 0.976, 0.131], // Amarillo verdoso
  ],
  inferno: [
    [0.001, 0.0, 0.014], // Casi negro
    [0.112, 0.027, 0.215],
    [0.219, 0.062, 0.334],
    [0.329, 0.1, 0.37],
    [0.44, 0.139, 0.385],
    [0.552, 0.178, 0.381],
    [0.657, 0.222, 0.358],
    [0.761, 0.278, 0.32],
    [0.856, 0.351, 0.268],
    [0.926, 0.444, 0.204],
    [0.969, 0.556, 0.136],
    [0.988, 0.682, 0.092],
    [0.988, 0.816, 0.109],
    [0.961, 0.951, 0.242], // Amarillo claro
  ],
  magma: [
    [0.001, 0.0, 0.014], // Negro azulado
    [0.135, 0.027, 0.235], // Púrpura oscuro
    [0.245, 0.072, 0.354], // Púrpura
    [0.355, 0.115, 0.39], // Púrpura claro
    [0.466, 0.159, 0.405], // Magenta púrpura
    [0.578, 0.198, 0.401], // Magenta
    [0.683, 0.242, 0.378], // Rosa magenta
    [0.787, 0.298, 0.34], // Rosa anaranjado
    [0.882, 0.371, 0.288], // Naranja
    [0.952, 0.464, 0.224], // Naranja claro
    [0.995, 0.576, 0.156], // Amarillo anaranjado
    [1.0, 0.702, 0.112], // Amarillo
    [1.0, 0.836, 0.129], // Amarillo brillante
    [0.981, 0.971, 0.262], // Amarillo claro
  ],
  bluered: [
    [0.0, 0.0, 1.0], // Azul puro
    [0.25, 0.0, 0.75],
    [0.5, 0.0, 0.5],
    [0.75, 0.0, 0.25],
    [1.0, 0.0, 0.0], // Rojo puro
  ],
};

// Función utilitaria para obtener color de una paleta
const getColorFromPalette = (paletteName, normalizedValue, opacity = 1.0) => {
  const palette = colorPalettes[paletteName] || colorPalettes.viridis;
  const index = Math.floor(normalizedValue * (palette.length - 1));
  const color = palette[Math.max(0, Math.min(index, palette.length - 1))];
  return `rgba(${Math.round(color[0] * 255)}, ${Math.round(color[1] * 255)}, ${Math.round(color[2] * 255)}, ${opacity})`;
};

// Componente de sensor para plano interior
const SensorMarker = ({
  x,
  y,
  value,
  micro_id,
  location_name,
  last_update,
}) => {
  const getSensorColor = (val) => {
    if (val >= 85) return "bg-red-500 border-red-600 text-red-600";
    if (val >= 70) return "bg-orange-500 border-orange-600 text-orange-600";
    if (val >= 50) return "bg-yellow-500 border-yellow-600 text-yellow-600";
    return "bg-green-500 border-green-600 text-green-600";
  };

  const colorClasses = getSensorColor(value);
  const [showPopup, setShowPopup] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState("top"); // 'top' o 'bottom'
  const containerRef = useRef(null);

  // Calcular posición en metros
  const metersX = (PLAN_IMAGE_WIDTH - x) / METERS_TO_PIXELS_X;
  const metersY = (PLAN_IMAGE_HEIGHT - y) / METERS_TO_PIXELS_Y;

  // Determinar la mejor posición para el tooltip basado en la posición del sensor
  useEffect(() => {
    if (containerRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const sensorTop = containerRect.top;

      // Si el sensor está en la parte superior (menos de 150px desde el borde superior)
      // mostrar el tooltip abajo, de lo contrario arriba
      if (sensorTop < 150) {
        setTooltipPosition("bottom");
      } else {
        setTooltipPosition("top");
      }
    }
  }, [x, y]);

  return (
    <div
      ref={containerRef}
      className="absolute cursor-pointer group isolate"
      style={{
        left: `${x}px`,
        top: `${y}px`,
        transform: "translate(-50%, -50%)", // Centrar en la posición
        zIndex: 50,
      }}
      onMouseEnter={() => setShowPopup(true)}
      onMouseLeave={() => setShowPopup(false)}
    >
      {/* Punto del sensor */}
      <div
        className={`relative w-10 h-10 rounded-full bg-white border-2 ${colorClasses.split(" ")[1]} flex items-center justify-center shadow-lg`}
      >
        {/* ID del sensor en el centro */}
        <div className={`text-xs font-bold ${colorClasses.split(" ")[2]}`}>
          {micro_id.replace("E", "")}
        </div>

        {/* Valor dB en esquina */}
        <div
          className={`absolute -top-3 -right-3 ${colorClasses.split(" ")[0]} text-white text-xs font-bold rounded-full w-8 h-8 flex items-center justify-center shadow-md`}
        >
          {Math.round(value)}
        </div>
      </div>

      {/* Tooltip al pasar el mouse - posición dinámica */}
      <div
        className={`absolute left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-[100] isolate ${
          tooltipPosition === "top" ? "bottom-full mb-2" : "top-full mt-2"
        }`}
      >
        <div className="bg-black/90 text-white text-xs rounded-lg py-2 px-3 shadow-xl whitespace-nowrap">
          <div className="font-bold">
            {micro_id}: {value.toFixed(1)} dB
          </div>
          <div className="text-gray-300">{location_name}</div>
          <div className="text-gray-400">
            {metersX.toFixed(1)}m, {metersY.toFixed(1)}m
          </div>
        </div>
        <div
          className={`absolute left-1/2 transform -translate-x-1/2 w-0 h-0 ${
            tooltipPosition === "top"
              ? "top-full border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-black/90"
              : "bottom-full border-l-4 border-r-4 border-b-4 border-l-transparent border-r-transparent border-b-black/90"
          }`}
        ></div>
      </div>

      {/* Popup detallado (click/touch) - posición dinámica */}
      {showPopup && (
        <div
          className={`absolute left-1/2 transform -translate-x-1/2 w-64 bg-white rounded-lg shadow-xl p-4 z-50 border border-gray-200 ${
            tooltipPosition === "top" ? "bottom-full mb-12" : "top-full mt-12"
          }`}
        >
          <div className="space-y-2">
            <div className="font-bold text-lg flex items-center justify-between">
              <span>{micro_id}</span>
              <span
                className={`text-sm px-2 py-1 rounded ${colorClasses.split(" ")[0]} text-white`}
              >
                {value.toFixed(1)} dB
              </span>
            </div>
            <div className="text-sm text-gray-600">{location_name}</div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <div className="text-gray-500">Coordenadas</div>
                <div>
                  {metersX.toFixed(1)}m, {metersY.toFixed(1)}m
                </div>
              </div>
              <div>
                <div className="text-gray-500">Nivel</div>
                <div className={colorClasses.split(" ")[2]}>
                  {value >= 85
                    ? "Crítico"
                    : value >= 70
                      ? "Alto"
                      : value >= 50
                        ? "Moderado"
                        : "Bajo"}
                </div>
              </div>
            </div>
            <div className="text-xs text-gray-500 border-t pt-2">
              Actualizado: {new Date(last_update).toLocaleTimeString("es-ES")}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Componente de epicentro
const EpicenterMarker = ({
  x,
  y,
  calculated_at,
  frontend_calculated = false,
  max_sensor = null,
}) => {
  const [showPopup, setShowPopup] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState("top"); // 'top' o 'bottom'
  const containerRef = useRef(null);

  // Calcular posición en metros
  const metersX = (PLAN_IMAGE_WIDTH - x) / METERS_TO_PIXELS_X;
  const metersY = (PLAN_IMAGE_HEIGHT - y) / METERS_TO_PIXELS_Y;

  // Determinar la mejor posición para el tooltip basado en la posición del epicentro
  useEffect(() => {
    if (containerRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const epicenterTop = containerRect.top;

      // Si el epicentro está en la parte superior (menos de 150px desde el borde superior)
      // mostrar el tooltip abajo, de lo contrario arriba
      if (epicenterTop < 150) {
        setTooltipPosition("bottom");
      } else {
        setTooltipPosition("top");
      }
    }
  }, [x, y]);

  return (
    <div
      ref={containerRef}
      className="absolute cursor-pointer group isolate"
      style={{
        left: `${x}px`,
        top: `${y}px`,
        transform: "translate(-50%, -50%)", // Centrar en la posición
        zIndex: 60,
      }}
      onMouseEnter={() => setShowPopup(true)}
      onMouseLeave={() => setShowPopup(false)}
    >
      {/* Icono de epicentro */}
      <div className="w-14 h-14 rounded-full bg-red-500 border-4 border-white flex items-center justify-center shadow-xl animate-pulse">
        <svg
          className="w-8 h-8 text-white"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z"
            clipRule="evenodd"
          />
        </svg>
      </div>

      {/* Tooltip al pasar el mouse - posición dinámica */}
      <div
        className={`absolute left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-[100] isolate ${
          tooltipPosition === "top" ? "bottom-full mb-2" : "top-full mt-2"
        }`}
      >
        <div className="bg-black/90 text-white text-xs rounded-lg py-2 px-3 shadow-xl whitespace-nowrap">
          <div className="font-bold">Epicentro de Ruido</div>
          <div className="text-gray-300">
            {metersX.toFixed(1)}m, {metersY.toFixed(1)}m
          </div>
          {frontend_calculated && (
            <div className="text-yellow-300">Calculado localmente</div>
          )}
          {max_sensor && (
            <div className="text-gray-400">Basado en sensor {max_sensor}</div>
          )}
        </div>
        <div
          className={`absolute left-1/2 transform -translate-x-1/2 w-0 h-0 ${
            tooltipPosition === "top"
              ? "top-full border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-black/90"
              : "bottom-full border-l-4 border-r-4 border-b-4 border-l-transparent border-r-transparent border-b-black/90"
          }`}
        ></div>
      </div>

      {/* Popup detallado - posición dinámica */}
      {showPopup && (
        <div
          className={`absolute left-1/2 transform -translate-x-1/2 w-64 bg-white rounded-lg shadow-xl p-4 z-50 border border-gray-200 ${
            tooltipPosition === "top"
              ? "bottom-full mb-12" // Más espacio para no solaparse con tooltip
              : "top-full mt-12"
          }`}
        >
          <div className="space-y-2">
            <div className="font-bold text-lg flex items-center space-x-2">
              <Target className="h-5 w-5 text-red-500" />
              <span>Epicentro de Ruido</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <div className="text-gray-500">Coordenadas</div>
                <div>
                  {metersX.toFixed(1)}m, {metersY.toFixed(1)}m
                </div>
              </div>
            </div>
            {max_sensor && (
              <div>
                <div className="text-gray-500">Sensor de referencia</div>
                <div className="font-medium">{max_sensor}</div>
              </div>
            )}
            <div className="text-xs text-gray-500 border-t pt-2">
              Calculado: {new Date(calculated_at).toLocaleTimeString("es-ES")}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Componente para mapa de calor en plano interior
const HeatmapLayer = memo(
  ({
    idwData,
    showHeatmap,
    metersToPixels,
    colorScheme = "viridis",
    opacity = 0.6,
    idwPower = 2,
  }) => {
    const canvasRef = useRef(null);

    // Usar paletas globales definidas arriba

    // Función para obtener color de la paleta seleccionada (delega a utilidad global)
    const getColor = (normalizedValue) => {
      return getColorFromPalette(colorScheme, normalizedValue, opacity);
    };

    // Caché de colores para máxima velocidad (LUT - Look Up Table)
    const colorLUT = useMemo(() => {
      const lut = [];
      const palette = colorPalettes[colorScheme] || colorPalettes.viridis;
      const lutSize = 256; // 256 valores posibles (0-255)

      for (let i = 0; i < lutSize; i++) {
        const normalizedValue = i / (lutSize - 1);
        const index = Math.floor(normalizedValue * (palette.length - 1));
        const colorIdx = Math.max(0, Math.min(index, palette.length - 1));
        const color = palette[colorIdx];
        lut[i] =
          `rgba(${Math.round(color[0] * 255)}, ${Math.round(color[1] * 255)}, ${Math.round(color[2] * 255)}, ${opacity})`;
      }
      return lut;
    }, [colorScheme, opacity]);

    // Función optimizada para obtener color RGBA como string rgba() usando LUT
    const getColorFast = (normalizedValue) => {
      const lutIndex = Math.floor(normalizedValue * 255);
      const idx = Math.max(0, Math.min(lutIndex, 255));
      return colorLUT[idx];
    };

    // Función para obtener color base sin opacidad (para gradientes)
    const getColorBase = (normalizedValue) => {
      const palette = colorPalettes[colorScheme] || colorPalettes.viridis;
      const index = Math.floor(normalizedValue * (palette.length - 1));
      const colorIdx = Math.max(0, Math.min(index, palette.length - 1));
      const color = palette[colorIdx];
      const r = Math.round(color[0] * 255);
      const g = Math.round(color[1] * 255);
      const b = Math.round(color[2] * 255);
      return { r, g, b, rgb: `rgb(${r}, ${g}, ${b})` };
    };

    // Función para interpolar valores en una grilla densa que cubre todo el plano
    const createFullPlaneGrid = (
      xi,
      yi,
      zi,
      targetCols = 15,
      targetRows = 42,
    ) => {
      // Crear grilla que cubra TODO el plano (0-5m en X, 0-14m en Y)
      const fullXi = [];
      const fullYi = [];
      const fullZi = [];

      const startTime = performance.now();

      // Paso en metros para cubrir todo el plano
      const xStep = PLAN_WIDTH / (targetCols - 1);
      const yStep = PLAN_HEIGHT / (targetRows - 1);

      // Primero, necesitamos convertir los datos IDW existentes a un formato que podamos interpolar
      // Los datos IDW vienen como arrays 2D, los convertimos a arrays 1D de puntos
      const points = [];
      const values = [];

      for (let i = 0; i < zi.length; i++) {
        for (let j = 0; j < zi[i].length; j++) {
          const xVal = xi[i]?.[j] || xi[0]?.[j] || 0;
          const yVal = yi[i]?.[j] || yi[i]?.[0] || 0;
          const zVal = zi[i][j];

          if (zVal !== null && zVal !== undefined) {
            points.push([xVal, yVal]);
            values.push(zVal);
          }
        }
      }

      // Si no hay puntos suficientes, retornar grilla vacía
      if (points.length < 3) {
        // console.log(
        //   "HeatmapLayer - No hay suficientes puntos para interpolación bilineal",
        // );
        return { fullXi, fullYi, fullZi: [] };
      }

      // Preparar estructura para interpolación bilineal eficiente
      // Ordenar puntos por coordenadas para búsqueda más rápida
      const sortedPoints = points
        .map((point, index) => ({
          x: point[0],
          y: point[1],
          value: values[index],
        }))
        .sort((a, b) => {
          if (a.x !== b.x) return a.x - b.x;
          return a.y - b.y;
        });

      // Crear grid espacial local para búsqueda rápida de vecinos
      const gridCellSize = 0.5; // metros por celda
      const spatialGrid = {};

      // Preprocesar: asignar cada punto a una celda del grid
      for (const point of sortedPoints) {
        const cellX = Math.floor(point.x / gridCellSize);
        const cellY = Math.floor(point.y / gridCellSize);
        const cellKey = `${cellX},${cellY}`;

        if (!spatialGrid[cellKey]) {
          spatialGrid[cellKey] = [];
        }
        spatialGrid[cellKey].push(point);
      }

      // Crear grilla densa que cubre TODO el plano con interpolación bilineal
      // OPTIMIZACIÓN: Reducir iteraciones y usar grid espacial para búsqueda O(1)
      for (let i = 0; i < targetRows; i++) {
        fullXi[i] = [];
        fullYi[i] = [];
        fullZi[i] = [];

        // Asegurar que las coordenadas Y estén dentro del rango [0, 14]
        const yMeters = Math.max(0, Math.min(14, i * yStep));

        for (let j = 0; j < targetCols; j++) {
          // Coordenadas en metros que cubren TODO el plano
          // Asegurar que las coordenadas X estén dentro del rango [0, 5]
          const xMeters = Math.max(0, Math.min(5, j * xStep));

          fullXi[i][j] = xMeters;
          fullYi[i][j] = yMeters;

          // OPTIMIZACIÓN: Búsqueda rápida usando grid espacial local
          const cellX = Math.floor(xMeters / gridCellSize);
          const cellY = Math.floor(yMeters / gridCellSize);

          const neighbors = [];
          const searchRadius = 1; // Buscar solo en celdas adyacentes (radio 1)

          // Buscar en celdas vecinas (incluyendo la celda actual)
          for (let dx = -searchRadius; dx <= searchRadius; dx++) {
            for (let dy = -searchRadius; dy <= searchRadius; dy++) {
              const neighborCellKey = `${cellX + dx},${cellY + dy}`;
              const cellPoints = spatialGrid[neighborCellKey];

              if (cellPoints) {
                // Evaluar solo los puntos en esta celda
                for (const point of cellPoints) {
                  const distanceSquared =
                    (xMeters - point.x) ** 2 + (yMeters - point.y) ** 2;
                  const distance = Math.sqrt(distanceSquared);

                  // Mantener solo los 4 puntos más cercanos
                  if (neighbors.length < 4) {
                    neighbors.push({ distance, point });
                    // Ordenar cuando tenemos 4 puntos
                    if (neighbors.length === 4) {
                      neighbors.sort((a, b) => a.distance - b.distance);
                    }
                  } else if (distanceSquared < neighbors[3].distanceSquared) {
                    // Reemplazar el cuarto punto si encontramos uno más cercano
                    neighbors[3] = {
                      distance: Math.sqrt(distanceSquared),
                      distanceSquared,
                      point,
                    };
                    neighbors.sort((a, b) => a.distance - b.distance);
                  }
                }
              }
            }
          }

          // Si no encontramos suficientes vecinos, buscar en radio más amplio
          if (neighbors.length < 4) {
            // Búsqueda de emergencia en todo el conjunto de puntos
            // Pero limitada a los primeros 50 puntos más cercanos en coordenada X
            const searchWindow = Math.min(sortedPoints.length, 50);
            for (let k = 0; k < searchWindow; k++) {
              const point = sortedPoints[k];
              const distanceSquared =
                (xMeters - point.x) ** 2 + (yMeters - point.y) ** 2;
              const distance = Math.sqrt(distanceSquared);

              if (neighbors.length < 4) {
                neighbors.push({ distance, point });
              } else if (distance < neighbors[3].distance) {
                neighbors[3] = { distance, point };
              }
            }
            if (neighbors.length > 1) {
              neighbors.sort((a, b) => a.distance - b.distance);
            }
          }

          // Interpolación bilineal basada en los puntos más cercanos
          if (neighbors.length >= 4) {
            // Usar los 4 puntos más cercanos para interpolación bilineal
            let totalWeight = 0;
            let weightedSum = 0;

            for (const { distance, point } of neighbors.slice(0, 4)) {
              const safeDistance = Math.max(distance, 0.01);
              const weight = 1.0 / safeDistance ** idwPower;
              weightedSum += weight * point.value;
              totalWeight += weight;
            }

            fullZi[i][j] = totalWeight > 0 ? weightedSum / totalWeight : 0;
          } else if (neighbors.length > 0) {
            // Si hay menos de 4 puntos, usar interpolación con los disponibles
            let totalWeight = 0;
            let weightedSum = 0;

            for (const { distance, point } of neighbors) {
              const safeDistance = Math.max(distance, 0.01);
              const weight = 1.0 / safeDistance ** idwPower;
              weightedSum += weight * point.value;
              totalWeight += weight;
            }

            fullZi[i][j] = weightedSum / totalWeight;
          } else {
            // Sin puntos cercanos, usar valor predeterminado
            fullZi[i][j] = 40; // Valor de base para ruido ambiental
          }

          // Asegurar que el valor esté dentro de un rango razonable
          if (fullZi[i][j] < 30) fullZi[i][j] = 30;
          if (fullZi[i][j] > 120) fullZi[i][j] = 120;
        }
      }

      // console.log("HeatmapLayer - Grilla creada con interpolación bilineal:", {
      //   puntos: points.length,
      //   dimensiones: `${targetRows}x${targetCols}`,
      //   cubreTodoElPlano: true,
      //   metodo: "Grid Espacial Optimizado (15x42 celdas, búsqueda O(1))",
      //   tiempo: `${performance.now() - startTime}ms`,
      // });

      return { fullXi, fullYi, fullZi };
    };

    useEffect(() => {
      // console.log("HeatmapLayer - Props recibidas:", {
      //   showHeatmap,
      //   colorScheme,
      //   opacity,
      //   idwPower,
      //   hasIdwData: !!idwData,
      //   hasXi: !!(idwData && idwData.xi),
      //   hasYi: !!(idwData && idwData.yi),
      //   hasZi: !!(idwData && idwData.zi),
      // });

      if (
        !showHeatmap ||
        !idwData ||
        !idwData.xi ||
        !idwData.yi ||
        !idwData.zi ||
        !metersToPixels
      ) {
        // Limpiar canvas si no hay datos o está desactivado
        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext("2d");
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        return;
      }

      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Obtener datos de la grilla IDW
      const xi = idwData.xi;
      const yi = idwData.yi;
      const zi = idwData.zi;

      // Verificar estructura de datos
      let normalizedXi, normalizedYi;

      // Si xi es array 1D, convertirlo a 2D
      if (Array.isArray(xi) && xi.length > 0 && !Array.isArray(xi[0])) {
        normalizedXi = [];
        normalizedYi = [];
        for (let i = 0; i < yi.length; i++) {
          normalizedXi[i] = [];
          normalizedYi[i] = [];
          for (let j = 0; j < xi.length; j++) {
            normalizedXi[i][j] = xi[j];
            normalizedYi[i][j] = yi[i];
          }
        }
      } else {
        normalizedXi = xi;
        normalizedYi = yi;
      }

      // Crear grilla densa que cubre TODO el plano
      const { fullXi, fullYi, fullZi } = createFullPlaneGrid(
        normalizedXi,
        normalizedYi,
        zi,
      );

      if (fullZi.length === 0) {
        // console.log(
        //   "HeatmapLayer - No se pudo generar grilla para todo el plano",
        // );
        return;
      }

      // Encontrar valores mínimo y máximo
      let minVal = Infinity;
      let maxVal = -Infinity;

      for (let i = 0; i < fullZi.length; i++) {
        for (let j = 0; j < fullZi[i].length; j++) {
          const val = fullZi[i][j];
          if (val !== null && val !== undefined) {
            if (val < minVal) minVal = val;
            if (val > maxVal) maxVal = val;
          }
        }
      }

      if (maxVal <= minVal) {
        // console.log("HeatmapLayer - Sin variación en datos");
        return;
      }

      const valueRange = maxVal - minVal;
      const rows = fullZi.length;
      const cols = fullZi[0]?.length || 0;

      // console.log("HeatmapLayer - Grilla completa:", {
      //   rows,
      //   cols,
      //   minVal: minVal.toFixed(2),
      //   maxVal: maxVal.toFixed(2),
      //   cubreTodoElPlano: true,
      // });

      // DIFUMINADO MEJORADO: Usar ImageData con interpolación bilineal para transiciones suaves
      // Precalcular factores de conversión
      const cellWidth = PLAN_IMAGE_WIDTH / cols;
      const cellHeight = PLAN_IMAGE_HEIGHT / rows;

      // Crear un ImageData más grande para interpolación (2x la resolución)
      const scaleFactor = 2;
      const scaledWidth = Math.floor(PLAN_IMAGE_WIDTH * scaleFactor);
      const scaledHeight = Math.floor(PLAN_IMAGE_HEIGHT * scaleFactor);

      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = scaledWidth;
      tempCanvas.height = scaledHeight;
      const tempCtx = tempCanvas.getContext("2d");
      const imageData = tempCtx.createImageData(scaledWidth, scaledHeight);
      const data = imageData.data;

      // Primero: crear una grilla de valores interpolados más densa
      const denseRows = rows * 2;
      const denseCols = cols * 2;
      const denseValues = new Array(denseRows);

      for (let i = 0; i < denseRows; i++) {
        denseValues[i] = new Array(denseCols);
        for (let j = 0; j < denseCols; j++) {
          // Coordenadas en la grilla densa
          const denseY = i / (denseRows - 1);
          const denseX = j / (denseCols - 1);

          // Coordenadas en la grilla original
          const origRow = denseY * (rows - 1);
          const origCol = denseX * (cols - 1);

          // Interpolación bilineal
          const row1 = Math.floor(origRow);
          const row2 = Math.min(row1 + 1, rows - 1);
          const col1 = Math.floor(origCol);
          const col2 = Math.min(col1 + 1, cols - 1);

          const tRow = origRow - row1;
          const tCol = origCol - col1;

          // Valores de los 4 puntos más cercanos
          const v11 = fullZi[row1]?.[col1] || 0;
          const v12 = fullZi[row1]?.[col2] || 0;
          const v21 = fullZi[row2]?.[col1] || 0;
          const v22 = fullZi[row2]?.[col2] || 0;

          // Interpolación bilineal
          const v1 = v11 * (1 - tCol) + v12 * tCol;
          const v2 = v21 * (1 - tCol) + v22 * tCol;
          denseValues[i][j] = v1 * (1 - tRow) + v2 * tRow;
        }
      }

      // Segundo: aplicar un filtro de convolución gaussiano para suavizar
      const kernelSize = 3;
      const kernel = [
        [1, 2, 1],
        [2, 4, 2],
        [1, 2, 1],
      ];
      const kernelSum = 16;

      const smoothedValues = new Array(denseRows);
      for (let i = 0; i < denseRows; i++) {
        smoothedValues[i] = new Array(denseCols);
        for (let j = 0; j < denseCols; j++) {
          let sum = 0;
          let weightSum = 0;

          for (let ki = -1; ki <= 1; ki++) {
            for (let kj = -1; kj <= 1; kj++) {
              const ni = i + ki;
              const nj = j + kj;

              if (ni >= 0 && ni < denseRows && nj >= 0 && nj < denseCols) {
                const weight = kernel[ki + 1][kj + 1];
                sum += denseValues[ni][nj] * weight;
                weightSum += weight;
              }
            }
          }

          smoothedValues[i][j] = sum / weightSum;
        }
      }

      // Tercero: dibujar en el ImageData con interpolación suave
      for (let i = 0; i < scaledHeight; i++) {
        for (let j = 0; j < scaledWidth; j++) {
          // Coordenadas en la grilla suavizada
          const gridY = (i / (scaledHeight - 1)) * (denseRows - 1);
          const gridX = (j / (scaledWidth - 1)) * (denseCols - 1);

          const row1 = Math.floor(gridY);
          const row2 = Math.min(row1 + 1, denseRows - 1);
          const col1 = Math.floor(gridX);
          const col2 = Math.min(col1 + 1, denseCols - 1);

          const tRow = gridY - row1;
          const tCol = gridX - col1;

          // Valores interpolados de la grilla suavizada
          const v11 = smoothedValues[row1]?.[col1] || 0;
          const v12 = smoothedValues[row1]?.[col2] || 0;
          const v21 = smoothedValues[row2]?.[col1] || 0;
          const v22 = smoothedValues[row2]?.[col2] || 0;

          const v1 = v11 * (1 - tCol) + v12 * tCol;
          const v2 = v21 * (1 - tCol) + v22 * tCol;
          const finalValue = v1 * (1 - tRow) + v2 * tRow;

          // Normalizar valor
          const normalizedVal = (finalValue - minVal) / valueRange;

          // Obtener color
          const color = getColorFast(normalizedVal);

          // Extraer componentes RGBA
          const rgbaMatch = color.match(
            /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/,
          );
          if (rgbaMatch) {
            const idx = (i * scaledWidth + j) * 4;
            data[idx] = parseInt(rgbaMatch[1]); // R
            data[idx + 1] = parseInt(rgbaMatch[2]); // G
            data[idx + 2] = parseInt(rgbaMatch[3]); // B
            data[idx + 3] = rgbaMatch[4]
              ? Math.floor(parseFloat(rgbaMatch[4]) * 255)
              : 255; // A
          }
        }
      }

      // Poner ImageData en el canvas temporal
      tempCtx.putImageData(imageData, 0, 0);

      // Aplicar un blur sutil adicional
      tempCtx.filter = "blur(2px)";
      tempCtx.globalAlpha = 1.0;
      tempCtx.drawImage(tempCanvas, 0, 0);
      tempCtx.filter = "none";
      tempCtx.globalAlpha = 1.0;

      // Dibujar el canvas temporal escalado en el canvas principal
      ctx.globalAlpha = opacity;
      ctx.drawImage(
        tempCanvas,
        0,
        0,
        scaledWidth,
        scaledHeight,
        0,
        0,
        PLAN_IMAGE_WIDTH,
        PLAN_IMAGE_HEIGHT,
      );
      ctx.globalAlpha = 1.0;

      // console.log("HeatmapLayer - Mapa de calor completado", {
      //   cubreTodoElPlano: true,
      //   dimensiones: `${rows}x${cols}`,
      //   esquemaColor: colorScheme,
      //   opacidad: opacity,
      //   potenciaIDW: idwPower,
      // });
    }, [idwData, showHeatmap, metersToPixels, colorScheme, opacity, idwPower]);

    return (
      <canvas
        ref={canvasRef}
        width={PLAN_IMAGE_WIDTH}
        height={PLAN_IMAGE_HEIGHT}
        className="absolute inset-0 pointer-events-none"
        style={{ zIndex: 5 }}
      />
    );
  },
);

// Componente para cuadrícula
const GridOverlay = ({ showGrid }) => {
  if (!showGrid) return null;

  const gridLines = [];
  const cellSizeMeters = 1;

  // Líneas verticales (cada 1 metro) - derecha a izquierda
  for (let x = 0; x <= PLAN_WIDTH; x += cellSizeMeters) {
    // X: 0-5m (derecha=0, izquierda=5) -> píxeles: derecha=202, izquierda=0
    // Asegurar que x esté dentro del rango [0, 5] para evitar problemas de precisión
    const clampedX = Math.max(0, Math.min(5, x));
    const xPx = PLAN_IMAGE_WIDTH - clampedX * METERS_TO_PIXELS_X;
    gridLines.push(
      <div
        key={`v-${x}`}
        className="absolute top-0 bottom-0 border-l border-white/30 border-dashed"
        style={{ left: `${xPx}px` }}
      />,
    );
  }

  // Líneas horizontales (cada 1 metro) - abajo a arriba
  for (let y = 0; y <= PLAN_HEIGHT; y += cellSizeMeters) {
    // Y: 0-14m (abajo=0, arriba=14) -> píxeles: abajo=562, arriba=0
    // Asegurar que y esté dentro del rango [0, 14] para evitar problemas de precisión
    const clampedY = Math.max(0, Math.min(14, y));
    const yPx = PLAN_IMAGE_HEIGHT - clampedY * METERS_TO_PIXELS_Y;
    gridLines.push(
      <div
        key={`h-${y}`}
        className="absolute left-0 right-0 border-t border-white/30 border-dashed"
        style={{ top: `${yPx}px` }}
      />,
    );
  }

  return <>{gridLines}</>;
};

// Función para calcular epicentro en frontend (fallback)
const calculateEpicenterFrontend = (sensors) => {
  console.log("=== CALCULATING EPICENTER FRONTEND ===");
  console.log("Input sensors:", sensors);

  if (sensors.length === 0) {
    console.log("No sensors, returning null");
    return null;
  }

  // Método 1: Ponderado por valor (más ruido = más peso)
  let totalWeight = 0;
  let weightedX = 0;
  let weightedY = 0;

  sensors.forEach((sensor) => {
    // Usar un peso mínimo de 1 para todos los sensores con valor > 0
    // Esto evita que todos los pesos sean 0 cuando valores <= 40
    const baseWeight = Math.max(sensor.value - 40, 1);
    // Aplicar factor cuadrático para dar más peso a valores altos
    const weight = baseWeight * baseWeight;
    console.log(
      `Sensor ${sensor.micro_id}: value=${sensor.value}, weight=${weight}, lon=${sensor.longitude}, lat=${sensor.latitude}`,
    );
    weightedX += sensor.longitude * weight;
    weightedY += sensor.latitude * weight;
    totalWeight += weight;
  });

  console.log(
    `Total weight: ${totalWeight}, weightedX: ${weightedX}, weightedY: ${weightedY}`,
  );

  if (totalWeight > 0) {
    const epicenterX = weightedX / totalWeight;
    const epicenterY = weightedY / totalWeight;

    // Verificar que las coordenadas sean válidas y estén dentro del plano
    // con tolerancia para errores de punto flotante
    const EPSILON = 0.0001;
    if (
      isNaN(epicenterX) ||
      isNaN(epicenterY) ||
      epicenterX < 0 - EPSILON ||
      epicenterX > 5 + EPSILON ||
      epicenterY < 0 - EPSILON ||
      epicenterY > 14 + EPSILON
    ) {
      console.warn(
        "Epicentro calculado inválido, usando sensor con valor máximo",
      );
      // Fallback al método 2
    } else {
      // Ajustar coordenadas al rango válido si están cerca del límite
      const adjustedX = Math.max(0, Math.min(5, epicenterX));
      const adjustedY = Math.max(0, Math.min(14, epicenterY));

      const result = {
        longitude: adjustedX,
        latitude: adjustedY,
        calculated_at: new Date().toISOString(),
        frontend_calculated: true,
      };
      console.log("Weighted epicenter result:", result);
      return result;
    }
  }

  // Método 2: Sensor con valor máximo (fallback robusto)
  const maxSensor = sensors.reduce(
    (max, sensor) => (sensor.value > max.value ? sensor : max),
    sensors[0],
  );

  // Verificar que las coordenadas del sensor máximo sean válidas
  // con tolerancia para errores de punto flotante
  const EPSILON = 0.0001;
  if (
    isNaN(maxSensor.longitude) ||
    isNaN(maxSensor.latitude) ||
    maxSensor.longitude < 0 - EPSILON ||
    maxSensor.longitude > 5 + EPSILON ||
    maxSensor.latitude < 0 - EPSILON ||
    maxSensor.latitude > 14 + EPSILON
  ) {
    console.error("Coordenadas del sensor máximo inválidas:", maxSensor);
    // Último fallback: promedio de todas las posiciones de sensores
    const avgLongitude =
      sensors.reduce((sum, s) => sum + s.longitude, 0) / sensors.length;
    const avgLatitude =
      sensors.reduce((sum, s) => sum + s.latitude, 0) / sensors.length;

    const result = {
      longitude: Math.max(0, Math.min(5, avgLongitude)),
      latitude: Math.max(0, Math.min(14, avgLatitude)),
      calculated_at: new Date().toISOString(),
      frontend_calculated: true,
      fallback: "average_of_sensors",
    };
    console.log("Average fallback epicenter result:", result);
    return result;
  }

  const result = {
    longitude: maxSensor.longitude,
    latitude: maxSensor.latitude,
    calculated_at: new Date().toISOString(),
    frontend_calculated: true,
    max_sensor: maxSensor.micro_id,
  };

  console.log("Max sensor epicenter result:", result);
  return result;
};

// Función para calcular epicentro REAL desde el mapa de calor (IDW)
const calculateEpicenterFromHeatmap = (idwData) => {
  console.log("=== CALCULATING EPICENTER FROM HEATMAP ===");
  console.log("IDW data structure:", {
    hasXi: !!idwData?.xi,
    hasYi: !!idwData?.yi,
    hasZi: !!idwData?.zi,
    xiType: Array.isArray(idwData?.xi)
      ? Array.isArray(idwData.xi[0])
        ? "2D"
        : "1D"
      : "unknown",
    yiType: Array.isArray(idwData?.yi)
      ? Array.isArray(idwData.yi[0])
        ? "2D"
        : "1D"
      : "unknown",
    ziType: Array.isArray(idwData?.zi)
      ? Array.isArray(idwData.zi[0])
        ? "2D"
        : "1D"
      : "unknown",
    xiLength: idwData?.xi?.length,
    yiLength: idwData?.yi?.length,
    ziLength: idwData?.zi?.length,
  });

  if (!idwData || !idwData.xi || !idwData.yi || !idwData.zi) {
    console.log("No valid IDW data for heatmap epicenter calculation");
    return null;
  }

  const xi = idwData.xi;
  const yi = idwData.yi;
  const zi = idwData.zi;

  let maxValue = -Infinity;
  let maxX = 0;
  let maxY = 0;

  // Detectar estructura de datos: 1D o 2D
  const isZi2D = Array.isArray(zi) && zi.length > 0 && Array.isArray(zi[0]);
  const isXi2D = Array.isArray(xi) && xi.length > 0 && Array.isArray(xi[0]);
  const isYi2D = Array.isArray(yi) && yi.length > 0 && Array.isArray(yi[0]);

  console.log(
    `Data structure: zi is ${isZi2D ? "2D" : "1D"}, xi is ${isXi2D ? "2D" : "1D"}, yi is ${isYi2D ? "2D" : "1D"}`,
  );

  if (isZi2D) {
    // Estructura 2D: zi[i][j]
    for (let i = 0; i < zi.length; i++) {
      const row = zi[i];
      if (!Array.isArray(row)) continue;

      for (let j = 0; j < row.length; j++) {
        const value = row[j];
        if (value !== null && value !== undefined && value > maxValue) {
          maxValue = value;
          // Obtener coordenadas según estructura de xi/yi
          if (isXi2D && isYi2D) {
            maxX = xi[i][j];
            maxY = yi[i][j];
          } else if (!isXi2D && !isYi2D) {
            // xi y yi son 1D, usar índices
            maxX = xi[j] || xi[0] || 0;
            maxY = yi[i] || yi[0] || 0;
          } else {
            // Caso mixto - fallback
            maxX = (isXi2D ? xi[i][j] : xi[j]) || 0;
            maxY = (isYi2D ? yi[i][j] : yi[i]) || 0;
          }
        }
      }
    }
  } else {
    // Estructura 1D: zi[i]
    for (let i = 0; i < zi.length; i++) {
      const value = zi[i];
      if (value !== null && value !== undefined && value > maxValue) {
        maxValue = value;
        // Obtener coordenadas según estructura de xi/yi
        if (isXi2D && isYi2D) {
          // Encontrar el índice correspondiente en matrices 2D
          // Esto es complejo, mejor usar índices si xi/yi son 1D
          console.warn("zi es 1D pero xi/yi son 2D - estructura inesperada");
          maxX = xi[0]?.[i] || xi[i]?.[0] || 0;
          maxY = yi[0]?.[i] || yi[i]?.[0] || 0;
        } else {
          // xi y yi son 1D
          maxX = xi[i] || 0;
          maxY = yi[i] || 0;
        }
      }
    }
  }

  if (maxValue === -Infinity) {
    console.log("No valid values found in heatmap");
    return null;
  }

  // Validar que las coordenadas estén dentro del rango razonable del plano
  // con tolerancia para errores de punto flotante
  const isValidCoordinate = (x, y) => {
    const EPSILON = 0.0001;
    return (
      x >= 0 - EPSILON &&
      x <= 5 + EPSILON &&
      y >= 0 - EPSILON &&
      y <= 14 + EPSILON
    );
  };

  if (!isValidCoordinate(maxX, maxY)) {
    console.warn(
      `Coordenadas del epicentro fuera de rango: longitude=${maxX}, latitude=${maxY}`,
    );
    // Ajustar al rango válido
    maxX = Math.max(0, Math.min(5, maxX));
    maxY = Math.max(0, Math.min(14, maxY));
    console.log(`Coordenadas ajustadas: longitude=${maxX}, latitude=${maxY}`);
  }

  const result = {
    longitude: maxX,
    latitude: maxY,
    calculated_at: new Date().toISOString(),
    frontend_calculated: true,
    from_heatmap: true,
    max_value: maxValue,
    data_structure: isZi2D ? "2D" : "1D",
  };

  console.log("Heatmap epicenter result:", result);
  return result;
};

// Función helper para validar epicentro (con tolerancia para errores de punto flotante)
const isValidEpicenter = (epicenter) => {
  if (!epicenter) return false;
  if (epicenter.longitude === undefined || epicenter.latitude === undefined)
    return false;

  // Usar tolerancia para errores de precisión de punto flotante
  const EPSILON = 0.0001;
  const validLongitude =
    epicenter.longitude >= 0 - EPSILON && epicenter.longitude <= 5 + EPSILON;
  const validLatitude =
    epicenter.latitude >= 0 - EPSILON && epicenter.latitude <= 14 + EPSILON;

  return validLongitude && validLatitude;
};

const FloorPlanMap = ({
  sensorData,
  idwData,
  epicenter,
  showHeatmap: initialShowHeatmap = true,
  showEpicenter: initialShowEpicenter = true,
  showGrid: initialShowGrid = true,
  colorScheme: externalColorScheme = "bluered",
  opacity: externalOpacity = 0.7,
  idwPower: externalIdwPower = 2,
}) => {
  const [showGrid, setShowGrid] = useState(initialShowGrid);
  const [showHeatmap, setShowHeatmap] = useState(initialShowHeatmap);
  const [showEpicenter, setShowEpicenter] = useState(initialShowEpicenter);
  const [colorScheme, setColorScheme] = useState(externalColorScheme);
  const [opacity, setOpacity] = useState(externalOpacity);
  const [idwPower, setIdwPower] = useState(externalIdwPower);
  const [heatmapStats, setHeatmapStats] = useState({ min: null, max: null });
  const containerRef = useRef(null);
  const lastValidBackendEpicenterRef = useRef(null);
  const lastEpicenterCoordsRef = useRef(null);
  const staleEpicenterCountRef = useRef(0);
  const [frontendEpicenter, setFrontendEpicenter] = useState(null);
  const epicenterUpdateIntervalRef = useRef(null);

  // Generar estilo de gradiente para la leyenda del mapa de calor
  const gradientStyle = useMemo(() => {
    const stops = 10;
    const gradientStops = [];
    for (let i = 0; i <= stops; i++) {
      const normalizedValue = i / stops;
      const color = getColorFromPalette(colorScheme, normalizedValue, opacity);
      gradientStops.push(`${color} ${(i / stops) * 100}%`);
    }
    return {
      background: `linear-gradient(to right, ${gradientStops.join(", ")})`,
      height: "8px",
      borderRadius: "4px",
    };
  }, [colorScheme, opacity]);

  // Sincronizar props externos con estado interno
  useEffect(() => {
    setColorScheme(externalColorScheme);
  }, [externalColorScheme]);

  useEffect(() => {
    setOpacity(externalOpacity);
  }, [externalOpacity]);

  useEffect(() => {
    console.log(
      `🎯 FloorPlanMap - showEpicenter sync: ${initialShowEpicenter} (prop) -> ${showEpicenter} (state)`,
    );
    setShowEpicenter(initialShowEpicenter);
  }, [initialShowEpicenter]);

  useEffect(() => {
    setIdwPower(externalIdwPower);
  }, [externalIdwPower]);

  useEffect(() => {
    setShowGrid(initialShowGrid);
  }, [initialShowGrid]);

  // Actualizar ref con último epicentro válido del backend (independiente de showEpicenter)
  useEffect(() => {
    if (isValidEpicenter(epicenter)) {
      console.log(
        "💾 Guardando último epicentro válido del backend:",
        epicenter,
      );
      lastValidBackendEpicenterRef.current = {
        ...epicenter,
        saved_at: new Date().toISOString(),
      };

      // Detectar si el epicentro está estancado (no cambia)
      const currentCoords = `${epicenter.longitude.toFixed(6)},${epicenter.latitude.toFixed(6)}`;
      const lastCoords = lastEpicenterCoordsRef.current;

      if (lastCoords === currentCoords) {
        staleEpicenterCountRef.current += 1;
        console.log(
          `⚠️ Epicentro del backend estancado (mismas coordenadas ${staleEpicenterCountRef.current} veces seguidas):`,
          currentCoords,
        );
      } else {
        staleEpicenterCountRef.current = 0;
        console.log(
          "🔄 Epicentro del backend cambió:",
          lastCoords ? `${lastCoords} -> ${currentCoords}` : currentCoords,
        );
      }

      lastEpicenterCoordsRef.current = currentCoords;
    }
  }, [epicenter]);

  // Actualización periódica del epicentro en frontend cada 5 segundos
  useEffect(() => {
    const updateFrontendEpicenter = () => {
      if (!showEpicenter || sensorData.length === 0) {
        console.log(
          "⏸️ Actualización periódica del epicentro pausada: showEpicenter false o sin sensores",
        );
        return;
      }

      console.log("🔄 Actualización periódica del epicentro (cada 5s)");

      // Calcular epicentro desde sensores
      const calculatedEpicenter = calculateEpicenterFrontend(sensorData);

      if (calculatedEpicenter && isValidEpicenter(calculatedEpicenter)) {
        console.log("✅ Epicentro calculado en frontend:", calculatedEpicenter);
        setFrontendEpicenter(calculatedEpicenter);
      } else {
        console.log("❌ No se pudo calcular epicentro válido en frontend");
      }
    };

    // Iniciar intervalo de actualización cada 5 segundos
    if (showEpicenter) {
      console.log(
        "⏱️ Iniciando actualización periódica del epicentro (cada 5 segundos)",
      );
      updateFrontendEpicenter(); // Ejecutar inmediatamente
      epicenterUpdateIntervalRef.current = setInterval(
        updateFrontendEpicenter,
        5000,
      );
    }

    return () => {
      if (epicenterUpdateIntervalRef.current) {
        console.log("⏹️ Deteniendo actualización periódica del epicentro");
        clearInterval(epicenterUpdateIntervalRef.current);
        epicenterUpdateIntervalRef.current = null;
      }
    };
  }, [showEpicenter, sensorData]);

  // Limpiar intervalo cuando showEpicenter cambia a false
  useEffect(() => {
    if (!showEpicenter && epicenterUpdateIntervalRef.current) {
      console.log(
        "⏹️ Deteniendo actualización periódica del epicenter (showEpicenter = false)",
      );
      clearInterval(epicenterUpdateIntervalRef.current);
      epicenterUpdateIntervalRef.current = null;
      setFrontendEpicenter(null);
    }
  }, [showEpicenter]);

  // Calcular epicentro - Lógica independiente del heatmap
  const effectiveEpicenter = (() => {
    console.log("=== DEBUG EPICENTER CALCULATION ===");
    console.log("Epicenter prop recibido:", epicenter);
    console.log("showEpicenter state:", showEpicenter);
    console.log("showHeatmap state:", showHeatmap);
    console.log("IDW data available:", !!idwData);
    console.log("Sensor data count:", sensorData.length);
    console.log("showEpicenter es false?", showEpicenter === false);
    console.log("epicenter es null?", epicenter === null);
    console.log(
      "Último epicentro válido guardado:",
      lastValidBackendEpicenterRef.current,
    );
    console.log("initialShowEpicenter prop:", initialShowEpicenter);

    // Si el epicentro está desactivado, no calcular nada
    if (!showEpicenter) {
      console.log(
        "⚠️ EPICENTRO DESACTIVADO - showEpicenter es false, retornando null",
      );
      return null;
    }

    // Si no hay epicentro del backend (null), tampoco calcular
    if (epicenter === null) {
      console.log("Epicenter prop es null, no hay datos del backend");
    }

    // PRIORIDAD 1: Epicentro del backend (si es válido y está disponible Y NO ESTÁ ESTANCADO)
    if (epicenter && isValidEpicenter(epicenter)) {
      console.log("✅ Epicentro del backend disponible y válido:");
      console.log("Coords:", epicenter.longitude, epicenter.latitude);
      console.log("showEpicenter:", showEpicenter);
      console.log("IDW data available:", !!idwData);
      console.log("showHeatmap:", showHeatmap);
      console.log("Estancado count:", staleEpicenterCountRef.current);
      console.log("Frontend epicenter disponible:", !!frontendEpicenter);

      // Si el epicentro está estancado por más de 3 actualizaciones, usar epicentro del frontend
      if (staleEpicenterCountRef.current > 3 && frontendEpicenter) {
        console.log(
          `⚠️ Epicentro del backend estancado por ${staleEpicenterCountRef.current} actualizaciones, usando epicentro del frontend:`,
          frontendEpicenter,
        );
        return frontendEpicenter;
      } else if (showEpicenter) {
        console.log("✅ Usando epicentro del backend:", epicenter);
        return epicenter;
      } else {
        console.log(
          "❌ Epicentro del backend válido PERO showEpicenter es false, ignorando",
        );
      }
    } else if (epicenter) {
      console.log(
        "❌ Epicentro del backend no válido (fuera de rango):",
        epicenter,
      );
      console.log("Coords check:", {
        longitude: epicenter.longitude,
        validLongitude: epicenter.longitude >= 0 && epicenter.longitude <= 5,
        latitude: epicenter.latitude,
        validLatitude: epicenter.latitude >= 0 && epicenter.latitude <= 14,
      });
    }

    // PRIORIDAD 1B: Último epicentro válido del backend (si el prop actual es inválido o null)
    const lastValidEpicenter = lastValidBackendEpicenterRef.current;
    if (showEpicenter && lastValidEpicenter && !isValidEpicenter(epicenter)) {
      // Verificar si el último epicentro guardado no es demasiado viejo (menos de 60 segundos)
      const savedTime = new Date(lastValidEpicenter.saved_at);
      const currentTime = new Date();
      const secondsDiff = (currentTime - savedTime) / 1000;

      if (secondsDiff < 60) {
        console.log(
          `✅ CACHE HIT: Usando último epicentro válido guardado (hace ${secondsDiff.toFixed(1)}s, epicenter actual inválido):`,
          lastValidEpicenter,
        );
        return {
          longitude: lastValidEpicenter.longitude,
          latitude: lastValidEpicenter.latitude,
          calculated_at:
            lastValidEpicenter.calculated_at || lastValidEpicenter.saved_at,
          from_cached: true,
        };
      } else {
        console.log(
          `❌ CACHE EXPIRED: Último epicentro guardado es muy viejo (${secondsDiff.toFixed(1)}s > 60s), ignorando`,
        );
      }
    }

    // PRIORIDAD 2: Epicentro desde mapa de calor (solo si está activo, hay datos y no hay epicentro válido del backend O está estancado)
    const shouldCalculateFromHeatmap =
      showHeatmap &&
      idwData &&
      showEpicenter &&
      (!isValidEpicenter(epicenter) || staleEpicenterCountRef.current > 3);

    if (shouldCalculateFromHeatmap) {
      console.log(
        "Intentando calcular epicentro desde heatmap (backend inválido o estancado)...",
      );
      console.log("showHeatmap:", showHeatmap, "has IDW data:", !!idwData);
      console.log("Backend epicenter valid:", isValidEpicenter(epicenter));
      console.log("Stale count:", staleEpicenterCountRef.current);

      const heatmapEpicenter = calculateEpicenterFromHeatmap(idwData);
      if (heatmapEpicenter && isValidEpicenter(heatmapEpicenter)) {
        console.log("✅ Usando epicentro desde heatmap:", heatmapEpicenter);
        console.log("Comparación con backend epicenter:", epicenter);
        return heatmapEpicenter;
      } else if (heatmapEpicenter) {
        console.log(
          "❌ Epicentro calculado desde heatmap no válido (fuera de rango):",
          heatmapEpicenter,
        );
        console.log("Coords check:", {
          longitude: heatmapEpicenter.longitude,
          validLongitude:
            heatmapEpicenter.longitude >= 0 && heatmapEpicenter.longitude <= 5,
          latitude: heatmapEpicenter.latitude,
          validLatitude:
            heatmapEpicenter.latitude >= 0 && heatmapEpicenter.latitude <= 14,
        });
      }
      console.log(
        "No se pudo calcular epicentro válido desde heatmap, usando sensores...",
      );
    } else if (!showEpicenter) {
      console.log(
        "⚠️ Heatmap disponible PERO showEpicenter es false, ignorando heatmap",
      );
    } else if (!showHeatmap) {
      console.log(
        "⚠️ showEpicenter es true PERO showHeatmap es false, no se puede calcular desde heatmap",
      );
    } else if (
      staleEpicenterCountRef.current <= 3 &&
      isValidEpicenter(epicenter)
    ) {
      console.log(
        "⚠️ Backend epicenter is valid and not stale enough to override",
      );
    }

    // PRIORIDAD 3: Epicentro calculado en frontend (ya sea del intervalo o calculado ahora)
    if (
      showEpicenter &&
      frontendEpicenter &&
      isValidEpicenter(frontendEpicenter)
    ) {
      console.log(
        "✅ Usando epicentro del frontend (actualizado periódicamente):",
        frontendEpicenter,
      );
      return frontendEpicenter;
    }

    // Fallback: calcular epicentro desde sensores si no hay epicentro del frontend
    const shouldCalculateFromSensors =
      sensorData.length > 0 &&
      showEpicenter &&
      (!isValidEpicenter(epicenter) || staleEpicenterCountRef.current > 3);

    if (shouldCalculateFromSensors) {
      console.log(
        "Calculando epicentro desde sensores (backend y heatmap inválidos o estancados, sin epicentro del frontend)...",
      );
      console.log("Sensor count:", sensorData.length);
      console.log("Backend epicenter valid:", isValidEpicenter(epicenter));
      console.log("Stale count:", staleEpicenterCountRef.current);
      console.log("Frontend epicenter available:", !!frontendEpicenter);

      const calculatedEpicenter = calculateEpicenterFrontend(sensorData);
      if (calculatedEpicenter && isValidEpicenter(calculatedEpicenter)) {
        console.log(
          "✅ Usando epicentro calculado desde sensores (fallback):",
          calculatedEpicenter,
        );
        return calculatedEpicenter;
      } else if (calculatedEpicenter) {
        console.log(
          "❌ Epicentro calculado desde sensores no válido (fuera de rango):",
          calculatedEpicenter,
        );
      }
    } else if (!showEpicenter) {
      console.log(
        "⚠️ Sensores disponibles PERO showEpicenter es false, ignorando cálculo",
      );
    } else if (
      staleEpicenterCountRef.current <= 3 &&
      isValidEpicenter(epicenter)
    ) {
      console.log(
        "⚠️ Backend epicenter is valid and not stale enough to override with sensor calculation",
      );
    } else if (frontendEpicenter) {
      console.log(
        "⚠️ Frontend epicenter available but not valid or showEpicenter is false",
      );
    }

    // Si no hay datos para calcular epicentro
    console.log(
      "❌ No hay datos suficientes para calcular epicentro o showEpicenter es false",
    );
    console.log("Resumen final:", {
      showEpicenter,
      epicenterProp: epicenter,
      sensorDataLength: sensorData.length,
      idwDataAvailable: !!idwData,
      showHeatmap,
      hasLastValidEpicenter: !!lastValidBackendEpicenterRef.current,
      frontendEpicenterAvailable: !!frontendEpicenter,
    });
    return null;
  })();

  // Convertir coordenadas en metros a píxeles
  // NOTA: El sistema de coordenadas tiene (0,0) en la esquina INFERIOR DERECHA
  // X: 0-5 metros (derecha a izquierda) -> en píxeles: derecha a izquierda
  // Y: 0-14 metros (abajo a arriba) -> en píxeles: abajo a arriba
  const metersToPixels = (xMeters, yMeters, microId = null) => {
    // Ajustar coordenadas para manejar errores de precisión de punto flotante
    // JavaScript tiene problemas con 14.000000000000002 > 14
    const adjustedXMeters = Math.max(0, Math.min(5, xMeters));
    const adjustedYMeters = Math.max(0, Math.min(14, yMeters));

    // Log para debug de coordenadas de epicentro (solo si hay ajuste significativo)
    if (
      microId === null &&
      (Math.abs(xMeters - adjustedXMeters) > 0.0001 ||
        Math.abs(yMeters - adjustedYMeters) > 0.0001)
    ) {
      console.warn(
        `⚠️ Coordenadas ajustadas en metersToPixels: x=${xMeters}->${adjustedXMeters}, y=${yMeters}->${adjustedYMeters}`,
      );
    }

    // Convertir metros a píxeles
    // X: 0-5m (derecha=0, izquierda=5) -> píxeles: derecha=202, izquierda=0
    const xPx = PLAN_IMAGE_WIDTH - adjustedXMeters * METERS_TO_PIXELS_X;

    // Y: 0-14m (abajo=0, arriba=14) -> píxeles: abajo=562, arriba=0
    const yPx = PLAN_IMAGE_HEIGHT - adjustedYMeters * METERS_TO_PIXELS_Y;

    return { x: xPx, y: yPx };
  };

  // Debug: verificar coordenadas de sensores
  useEffect(() => {
    // console.log("FloorPlanMap - Props recibidas:", {
    //   sensorData_count: sensorData.length,
    //   idwData: idwData
    //     ? {
    //             hasData: true,
    //             xiType: Array.isArray(idwData.xi)
    //               ? Array.isArray(idwData.xi[0])
    //                 ? "2D"
    //                 : "1D"
    //               : "none",
    //             yiType: Array.isArray(idwData.yi)
    //               ? Array.isArray(idwData.yi[0])
    //                 ? "2D"
    //                 : "1D"
    //               : "none",
    //             ziShape: idwData.zi
    //               ? `${idwData.zi.length}x${idwData.zi[0]?.length || 0}`
    //               : "none",
    //           }
    //         : { hasData: false },
    //       epicenter: !!epicenter,
    //       showHeatmap,
    //       showEpicenter,
    //   });

    if (sensorData.length > 0) {
      // console.log(
      //   "Coordenadas de sensores en FloorPlanMap:",
      //   sensorData.map((s) => ({
      //     micro_id: s.micro_id,
      //     latitude: s.latitude,
      //     longitude: s.longitude,
      //     pixels: metersToPixels(s.longitude, s.latitude),
      //     value: s.value,
      //   })),
      // );
    } else {
      // console.log("FloorPlanMap - sensorData vacío");
    }
  }, [sensorData, idwData, epicenter, showHeatmap, showEpicenter]);

  // Calcular estadísticas del mapa de calor (mínimo y máximo)
  useEffect(() => {
    if (!showHeatmap || !idwData || !idwData.zi) {
      setHeatmapStats({ min: null, max: null });
      return;
    }

    const zi = idwData.zi;
    let minVal = Infinity;
    let maxVal = -Infinity;

    // Recorrer todos los valores de la matriz zi
    for (let i = 0; i < zi.length; i++) {
      const row = zi[i];
      if (!Array.isArray(row)) continue;

      for (let j = 0; j < row.length; j++) {
        const val = row[j];
        if (val !== null && val !== undefined) {
          if (val < minVal) minVal = val;
          if (val > maxVal) maxVal = val;
        }
      }
    }

    // Si no se encontraron valores válidos, usar valores por defecto
    if (minVal === Infinity || maxVal === -Infinity || maxVal <= minVal) {
      setHeatmapStats({ min: null, max: null });
    } else {
      setHeatmapStats({
        min: Math.round(minVal * 100) / 100, // Redondear a 2 decimales
        max: Math.round(maxVal * 100) / 100,
      });

      // console.log("Heatmap stats calculadas:", {
      //   min: minVal.toFixed(2),
      //   max: maxVal.toFixed(2),
      // });
    }
  }, [idwData, showHeatmap]);

  return (
    <div className="relative h-full" ref={containerRef}>
      {/* Contenedor del plano */}
      <div className="relative h-full rounded-2xl shadow-lg bg-gray-800 overflow-hidden">
        {/* Imagen del plano como fondo - MOSTRAR A TAMAÑO NATURAL */}
        <div className="relative w-full h-full flex items-center justify-center overflow-auto">
          <div
            className="relative"
            style={{
              width: `${PLAN_IMAGE_WIDTH}px`,
              height: `${PLAN_IMAGE_HEIGHT}px`,
            }}
          >
            <img
              src="/plano.png"
              alt="Plano interior"
              className="w-full h-full"
              onLoad={() => {
                /* console.log("Plano cargado correctamente") */
              }}
              onError={() => console.error("Error cargando plano.png")}
            />

            {/* Contenedor para superposiciones (sensores, cuadrícula, mapa de calor) */}
            <div className="absolute inset-0">
              {/* Mapa de calor */}
              <HeatmapLayer
                idwData={showHeatmap ? idwData : null}
                showHeatmap={showHeatmap}
                metersToPixels={metersToPixels}
                colorScheme={colorScheme}
                opacity={opacity}
                idwPower={idwPower}
              />

              {/* Cuadrícula superpuesta */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{ zIndex: 10 }}
              >
                <GridOverlay showGrid={showGrid} />
              </div>

              {/* Sensores */}
              <div className="absolute inset-0" style={{ zIndex: 20 }}>
                {sensorData.map((sensor, index) => {
                  const { x, y } = metersToPixels(
                    sensor.longitude,
                    sensor.latitude,
                    sensor.micro_id,
                  );

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
                  );
                })}

                {/* Marcadores de referencia para debugging con nuevo sistema de coordenadas */}
                <div
                  className="absolute w-2 h-2 bg-blue-500 rounded-full"
                  style={{
                    left: `${PLAN_IMAGE_WIDTH}px`,
                    top: `${PLAN_IMAGE_HEIGHT}px`,
                    transform: "translate(-50%, -50%)",
                  }}
                  title="Esquina inferior derecha (0,0)"
                ></div>
                <div
                  className="absolute w-2 h-2 bg-blue-500 rounded-full"
                  style={{
                    left: "0px",
                    top: `${PLAN_IMAGE_HEIGHT}px`,
                    transform: "translate(-50%, -50%)",
                  }}
                  title="Esquina inferior izquierda (5,0)"
                ></div>
                <div
                  className="absolute w-2 h-2 bg-blue-500 rounded-full"
                  style={{
                    left: `${PLAN_IMAGE_WIDTH}px`,
                    top: "0px",
                    transform: "translate(-50%, -50%)",
                  }}
                  title="Esquina superior derecha (0,14)"
                ></div>
                <div
                  className="absolute w-2 h-2 bg-blue-500 rounded-full"
                  style={{
                    left: "0px",
                    top: "0px",
                    transform: "translate(-50%, -50%)",
                  }}
                  title="Esquina superior izquierda (5,14)"
                ></div>
              </div>

              {/* Epicentro - usar posición efectiva (heatmap, backend o frontend) */}
              {effectiveEpicenter && (
                <div
                  className="absolute inset-0 isolate"
                  style={{ zIndex: 100 }}
                >
                  <EpicenterMarker
                    x={
                      metersToPixels(
                        effectiveEpicenter.longitude,
                        effectiveEpicenter.latitude,
                      ).x
                    }
                    y={
                      metersToPixels(
                        effectiveEpicenter.longitude,
                        effectiveEpicenter.latitude,
                      ).y
                    }
                    calculated_at={effectiveEpicenter.calculated_at}
                    frontend_calculated={
                      effectiveEpicenter.frontend_calculated ||
                      effectiveEpicenter.from_heatmap
                    }
                    max_sensor={effectiveEpicenter.max_sensor}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FloorPlanMap;
