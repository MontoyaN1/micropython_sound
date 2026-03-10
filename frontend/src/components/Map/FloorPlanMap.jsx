import { useState, useEffect, useRef, useMemo, useCallback, memo } from "react";
import { Activity, Map, Grid } from "lucide-react";

// Configuración del plano
// 57 baldosas × 0.3 metros = 17.1 metros de ancho
// 66 baldosas × 0.3 metros = 19.8 metros de profundidad
const TILE_SIZE_METERS = 0.3; // 30 cm por baldosa
const TILES_WIDTH = 57; // número de baldosas en X (ancho)
const TILES_HEIGHT = 66; // número de baldosas en Y (alto)
const PLAN_WIDTH_TILES = TILES_WIDTH; // 57 baldosas (eje X)
const PLAN_HEIGHT_TILES = TILES_HEIGHT; // 66 baldosas (eje Y)

// Dimensiones base en píxeles (escalable)
const BASE_TILE_PIXELS = 20; // píxeles por baldosa base
const PLAN_IMAGE_WIDTH = TILES_WIDTH * BASE_TILE_PIXELS; // 1140px
const PLAN_IMAGE_HEIGHT = TILES_HEIGHT * BASE_TILE_PIXELS; // 1320px

// Factores de conversión de baldosas a píxeles
const TILES_TO_PIXELS = BASE_TILE_PIXELS; // 20px por baldosa

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
  redyellowgreen: [
    [0.8, 1.0, 0.8], // Verde muy claro (valores más bajos)
    [0.6, 1.0, 0.6], // Verde claro
    [0.0, 0.9, 0.0], // Verde medio
    [0.5, 1.0, 0.0], // Verde amarillento
    [1.0, 1.0, 0.0], // Amarillo puro (valores medios)
    [1.0, 0.7, 0.0], // Naranja
    [1.0, 0.4, 0.0], // Naranja-rojo
    [1.0, 0.0, 0.0], // Rojo puro (valores más altos)
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
  mapContainerRef,
  displayDimensions = { width: PLAN_IMAGE_WIDTH, height: PLAN_IMAGE_HEIGHT },
}) => {
  const getSensorColor = (val) => {
    if (val >= 85) return "bg-red-500 border-red-600 text-red-600";
    if (val >= 70) return "bg-orange-500 border-orange-600 text-orange-600";
    if (val >= 50) return "bg-yellow-500 border-yellow-600 text-yellow-600";
    return "bg-green-500 border-green-600 text-green-600";
  };

  const colorClasses = getSensorColor(value);
  const [showPopup, setShowPopup] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState("top"); // 'top', 'bottom', 'left', 'right'
  const containerRef = useRef(null);

  // Calcular posición en baldosas usando dimensiones actuales de visualización
  const displayWidth = displayDimensions?.width || PLAN_IMAGE_WIDTH;
  const displayHeight = displayDimensions?.height || PLAN_IMAGE_HEIGHT;
  const scaleX = displayWidth / PLAN_IMAGE_WIDTH;
  const scaleY = displayHeight / PLAN_IMAGE_HEIGHT;

  const tilesX = (displayWidth - x) / (TILES_TO_PIXELS * scaleX);
  const tilesY = (displayHeight - y) / (TILES_TO_PIXELS * scaleY);

  // Determinar la mejor posición para el tooltip basado en la posición del sensor
  useEffect(() => {
    if (containerRef.current && mapContainerRef?.current) {
      const sensorRect = containerRef.current.getBoundingClientRect();
      const mapRect = mapContainerRef.current.getBoundingClientRect();

      // Calcular espacio disponible dentro del contenedor del mapa
      const spaceAbove = sensorRect.top - mapRect.top;
      const spaceBelow = mapRect.bottom - sensorRect.bottom;
      const spaceLeft = sensorRect.left - mapRect.left;
      const spaceRight = mapRect.right - sensorRect.right;

      // Umbral mínimo para considerar espacio suficiente (200px para tooltip)
      const minSpace = 200;

      // Determinar la mejor posición basada en el espacio disponible dentro del mapa
      if (spaceBelow >= minSpace) {
        // Espacio suficiente abajo dentro del mapa
        setTooltipPosition("bottom");
      } else if (spaceAbove >= minSpace) {
        // Espacio suficiente arriba dentro del mapa
        setTooltipPosition("top");
      } else if (spaceRight >= minSpace) {
        // Espacio suficiente a la derecha dentro del mapa
        setTooltipPosition("right");
      } else if (spaceLeft >= minSpace) {
        // Espacio suficiente a la izquierda dentro del mapa
        setTooltipPosition("left");
      } else {
        // Si no hay suficiente espacio en ninguna dirección, usar la que tenga más espacio
        const spaces = [
          { dir: "bottom", space: spaceBelow },
          { dir: "top", space: spaceAbove },
          { dir: "right", space: spaceRight },
          { dir: "left", space: spaceLeft },
        ];
        const bestPosition = spaces.reduce((best, current) =>
          current.space > best.space ? current : best,
        );
        setTooltipPosition(bestPosition.dir);
      }
    }
  }, [x, y, mapContainerRef]);

  return (
    <div
      ref={containerRef}
      className="absolute cursor-pointer group"
      style={{
        left: `${x}px`,
        top: `${y}px`,
        transform: "translate(-50%, -50%)",
        zIndex: showPopup ? 1000 : 10,
      }}
      onMouseEnter={() => setShowPopup(true)}
      onMouseLeave={() => setShowPopup(false)}
    >
      {/* Punto del sensor */}
      <div
        className={`relative w-10 h-10 rounded-full bg-white border-2 ${colorClasses.split(" ")[1]} flex items-center justify-center shadow-lg z-10`}
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

      {/* Popup detallado (hover) - posición dinámica */}
      {showPopup && (
        <div
          className={`absolute w-64 bg-white rounded-lg shadow-xl p-4 z-[100] border border-gray-200 ${
            tooltipPosition === "top"
              ? "left-1/2 transform -translate-x-1/2 bottom-full mb-12"
              : tooltipPosition === "bottom"
                ? "left-1/2 transform -translate-x-1/2 top-full mt-12"
                : tooltipPosition === "right"
                  ? "top-1/2 transform -translate-y-1/2 left-full ml-12"
                  : "top-1/2 transform -translate-y-1/2 right-full mr-12"
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
                  {tilesX.toFixed(1)} baldosas, {tilesY.toFixed(1)} baldosas
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
              Actualizado:{" "}
              {(() => {
                const date = new Date(last_update);
                date.setHours(date.getHours() - 5);
                return date.toLocaleTimeString("es-CO", {
                  hour12: false,
                });
              })()}
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
    tilesToPixels,
    colorScheme = "viridis",
    opacity = 0.6,
    idwPower = 2,
    displayDimensions = { width: PLAN_IMAGE_WIDTH, height: PLAN_IMAGE_HEIGHT },
  }) => {
    const canvasRef = useRef(null);
    const animationFrameRef = useRef(null);
    const prevDataHashRef = useRef("");

    // Usar paletas globales definidas arriba

    // Función para obtener color de la paleta seleccionada (delega a utilidad global)
    const getColor = (normalizedValue) => {
      return getColorFromPalette(colorScheme, normalizedValue, opacity);
    };

    // Caché de colores optimizada para máxima velocidad (LUT - Look Up Table)
    // Almacena componentes RGBA como arrays [R, G, B, A] para acceso directo
    const colorLUT = useMemo(() => {
      const lut = new Array(256); // 256 valores posibles (0-255)
      const palette = colorPalettes[colorScheme] || colorPalettes.viridis;
      const alpha = Math.round(opacity * 255);

      for (let i = 0; i < 256; i++) {
        const normalizedValue = i / 255;

        // Interpolación lineal para todos los esquemas
        const index = Math.floor(normalizedValue * (palette.length - 1));
        const colorIdx = Math.max(0, Math.min(index, palette.length - 1));
        const color = palette[colorIdx];

        // Almacenar como array [R, G, B, A] para acceso ultra rápido
        lut[i] = [
          Math.round(color[0] * 255), // R
          Math.round(color[1] * 255), // G
          Math.round(color[2] * 255), // B
          alpha, // A (opacidad precalculada)
        ];
      }
      return lut;
    }, [colorScheme, opacity]);

    // Función optimizada para obtener color RGBA como array [R, G, B, A] usando LUT
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
      targetCols = 57,
      targetRows = 66,
    ) => {
      // Crear grilla que cubra TODO el plano (0-57 baldosas en X, 0-66 baldosas en Y)
      const fullXi = [];
      const fullYi = [];
      const fullZi = [];

      const startTime = performance.now();

      // Calcular límites reales de los datos del backend a partir de xi, yi
      let minX = Infinity,
        maxX = -Infinity;
      let minY = Infinity,
        maxY = -Infinity;

      for (let i = 0; i < xi.length; i++) {
        for (let j = 0; j < xi[i].length; j++) {
          const xVal = xi[i][j];
          const yVal = yi[i][j];
          if (xVal !== null && xVal !== undefined) {
            minX = Math.min(minX, xVal);
            maxX = Math.max(maxX, xVal);
          }
          if (yVal !== null && yVal !== undefined) {
            minY = Math.min(minY, yVal);
            maxY = Math.max(maxY, yVal);
          }
        }
      }

      // Si no se encontraron límites válidos, usar plano completo en baldosas
      if (!isFinite(minX) || !isFinite(maxX)) {
        minX = 0;
        maxX = PLAN_WIDTH_TILES;
      }
      if (!isFinite(minY) || !isFinite(maxY)) {
        minY = 0;
        maxY = PLAN_HEIGHT_TILES;
      }

      // Asegurar que haya rango positivo para evitar división por cero
      let xRange = maxX - minX;
      let yRange = maxY - minY;
      if (xRange <= 0) xRange = PLAN_WIDTH_TILES;
      if (yRange <= 0) yRange = PLAN_HEIGHT_TILES;

      // Paso en baldosas para cubrir todo el plano
      const xStep = PLAN_WIDTH_TILES / (targetCols - 1);
      const yStep = PLAN_HEIGHT_TILES / (targetRows - 1);

      // Crear grilla densa que cubra TODO el plano con interpolación bilineal
      for (let i = 0; i < targetRows; i++) {
        fullXi[i] = [];
        fullYi[i] = [];
        fullZi[i] = [];

        // Coordenada Y en baldosas (0-66)
        const yTiles = Math.max(0, Math.min(PLAN_HEIGHT_TILES, i * yStep));

        for (let j = 0; j < targetCols; j++) {
          // Coordenada X en baldosas (0-57)
          const xTiles = Math.max(0, Math.min(PLAN_WIDTH_TILES, j * xStep));

          fullXi[i][j] = xTiles;
          fullYi[i][j] = yTiles;

          // Convertir coordenadas del plano (0-57 baldosas, 0-66 baldosas) al rango de los datos del backend
          const xBackend = minX + (xTiles / PLAN_WIDTH_TILES) * xRange;
          const yBackend = minY + (yTiles / PLAN_HEIGHT_TILES) * yRange;

          // INTERPOLACIÓN BILINEAL DIRECTA de la grilla original
          const origGridCols = zi[0]?.length || 0;
          const origGridRows = zi.length || 0;

          if (origGridCols > 0 && origGridRows > 0) {
            // Mapear coordenadas del backend a índices en la grilla original
            // Clamping de índices para evitar valores fuera de rango
            const colIndex = Math.max(
              0,
              Math.min(
                origGridCols - 1,
                ((xBackend - minX) / xRange) * (origGridCols - 1),
              ),
            );
            const rowIndex = Math.max(
              0,
              Math.min(
                origGridRows - 1,
                ((yBackend - minY) / yRange) * (origGridRows - 1),
              ),
            );

            const col1 = Math.floor(colIndex);
            const col2 = Math.min(col1 + 1, origGridCols - 1);
            const row1 = Math.floor(rowIndex);
            const row2 = Math.min(row1 + 1, origGridRows - 1);

            const tCol = colIndex - col1;
            const tRow = rowIndex - row1;

            // Obtener valores de los 4 puntos más cercanos en la grilla original
            const v11 = zi[row1]?.[col1] || 0;
            const v12 = zi[row1]?.[col2] || 0;
            const v21 = zi[row2]?.[col1] || 0;
            const v22 = zi[row2]?.[col2] || 0;

            // Interpolación bilineal
            const v1 = v11 * (1 - tCol) + v12 * tCol;
            const v2 = v21 * (1 - tCol) + v22 * tCol;
            fullZi[i][j] = v1 * (1 - tRow) + v2 * tRow;
          } else {
            fullZi[i][j] = null; // Sin datos
          }
        }
      }

      return { fullXi, fullYi, fullZi };
    };

    // Memoizar datos normalizados y grilla completa para evitar recálculos costosos
    const { normalizedXi, normalizedYi, normalizedZi } = useMemo(() => {
      if (!idwData || !idwData.xi || !idwData.yi || !idwData.zi) {
        return { normalizedXi: null, normalizedYi: null, normalizedZi: null };
      }

      const xi = idwData.xi;
      const yi = idwData.yi;
      const zi = idwData.zi;

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

      return { normalizedXi, normalizedYi, normalizedZi: zi };
    }, [idwData]);

    // Memoizar grilla completa para evitar recálculos en cada render
    const { fullXi, fullYi, fullZi } = useMemo(() => {
      if (!normalizedXi || !normalizedYi || !normalizedZi) {
        return { fullXi: [], fullYi: [], fullZi: [] };
      }

      console.log(
        `[${new Date().toISOString()}] HeatmapLayer - Creando grilla densa`,
      );

      return createFullPlaneGrid(normalizedXi, normalizedYi, normalizedZi);
    }, [normalizedXi, normalizedYi, normalizedZi]);

    // Memoizar estadísticas de la grilla (min/max) basado en datos reales
    const { minVal, maxVal, valueRange } = useMemo(() => {
      if (!fullZi || fullZi.length === 0) {
        return { minVal: 0, maxVal: 0, valueRange: 0 };
      }

      let minVal = Infinity;
      let maxVal = -Infinity;

      for (let i = 0; i < fullZi.length; i++) {
        for (let j = 0; j < fullZi[i].length; j++) {
          const val = fullZi[i][j];
          if (val !== null && val !== undefined && !isNaN(val)) {
            if (val < minVal) minVal = val;
            if (val > maxVal) maxVal = val;
          }
        }
      }

      // Si no hay variación, establecer un rango mínimo
      if (maxVal <= minVal) {
        maxVal = minVal + 1;
      }

      const valueRange = maxVal - minVal;

      return { minVal, maxVal, valueRange };
    }, [fullZi]);

    useEffect(() => {
      console.log(
        `[${new Date().toISOString()}] HeatmapLayer - Props recibidas:`,
        {
          showHeatmap,
          colorScheme,
          opacity,
          idwPower,
          hasIdwData: !!idwData,
          hasXi: !!(idwData && idwData.xi),
          hasYi: !!(idwData && idwData.yi),
          hasZi: !!(idwData && idwData.zi),
          timestamp: new Date().toISOString(),
        },
      );

      console.log(
        `[${new Date().toISOString()}] HeatmapLayer - Estado showHeatmap: ${showHeatmap}, idwData presente: ${!!idwData}`,
      );

      if (
        !showHeatmap ||
        !idwData ||
        !idwData.xi ||
        !idwData.yi ||
        !idwData.zi
      ) {
        // Limpiar canvas si no hay datos o está desactivado
        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext("2d");
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          console.log(
            `[${new Date().toISOString()}] HeatmapLayer - Canvas limpiado (showHeatmap=${showHeatmap}, idwData válido=${!!idwData})`,
          );
        }
        return;
      }

      console.log(
        `[${new Date().toISOString()}] HeatmapLayer - Condiciones OK: showHeatmap=true, idwData válido`,
      );

      const canvas = canvasRef.current;
      if (!canvas) return;

      // Cancelar animation frame anterior si existe
      if (animationFrameRef.current) {
        console.log(
          `[${new Date().toISOString()}] HeatmapLayer - Cancelando animation frame anterior`,
        );
        cancelAnimationFrame(animationFrameRef.current);
      }

      console.log(
        `[${new Date().toISOString()}] HeatmapLayer - Programando nuevo animation frame`,
      );

      // Usar requestAnimationFrame para renderizado no bloqueante
      animationFrameRef.current = requestAnimationFrame(() => {
        console.log(
          `[${new Date().toISOString()}] HeatmapLayer - Animation frame ejecutándose`,
        );
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        console.log(
          `[${new Date().toISOString()}] HeatmapLayer - Iniciando renderizado del mapa de calor`,
        );

        if (!fullXi || !fullYi || !fullZi || fullZi.length === 0) {
          console.log(
            `[${new Date().toISOString()}] HeatmapLayer - No hay grilla válida para renderizar`,
          );
          return;
        }

        console.log(
          `[${new Date().toISOString()}] HeatmapLayer - Estructura de datos:`,
          {
            fullXi_length: fullXi.length,
            fullYi_length: fullYi.length,
            fullZi_rows: fullZi.length,
            fullZi_cols: fullZi[0]?.length || 0,
            minVal,
            maxVal,
            valueRange,
          },
        );

        // Usar valores memoizados minVal, maxVal, valueRange
        const rows = fullZi.length;
        const cols = fullZi[0]?.length || 0;

        // console.log("HeatmapLayer - Grilla completa:", {
        //   rows,
        //   cols,
        //   minVal: minVal.toFixed(2),
        //   maxVal: maxVal.toFixed(2),
        //   cubreTodoElPlano: true,
        // });

        // RENDERIZADO OPTIMIZADO: Interpolación bilineal directa en la grilla original
        const width = displayDimensions.width || PLAN_IMAGE_WIDTH;
        const height = displayDimensions.height || PLAN_IMAGE_HEIGHT;

        // ESCALADO DINÁMICO DE RESOLUCIÓN para mejorar rendimiento en pantallas grandes
        // Calcular factor de escala basado en área total (reducir resolución si área > 500,000px)
        const targetMaxPixels = 500000; // Límite para rendimiento óptimo
        const currentPixels = width * height;
        let scaleFactor = 1.0;

        if (currentPixels > targetMaxPixels) {
          scaleFactor = Math.max(
            0.5,
            Math.sqrt(targetMaxPixels / currentPixels),
          );
        }

        const scaledWidth = Math.floor(width * scaleFactor);
        const scaledHeight = Math.floor(height * scaleFactor);

        // Crear canvas temporal para renderizado a resolución reducida
        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = scaledWidth;
        tempCanvas.height = scaledHeight;
        const tempCtx = tempCanvas.getContext("2d");

        // Crear ImageData del tamaño escalado para mejor rendimiento
        const imageData = tempCtx.createImageData(scaledWidth, scaledHeight);
        const data = imageData.data;

        // Precalcular factores para convertir coordenadas de píxeles escaladas a la grilla
        const xScale = (cols - 1) / (scaledWidth - 1);
        const yScale = (rows - 1) / (scaledHeight - 1);

        // Renderizar cada píxel con interpolación bilineal directa (a resolución escalada)
        for (let y = 0; y < scaledHeight; y++) {
          // Invertir eje Y para coincidir con sistema de coordenadas (0,0) inferior derecha
          const invertedY = scaledHeight - 1 - y;

          for (let x = 0; x < scaledWidth; x++) {
            // Convertir coordenadas de píxeles escalados a coordenadas en la grilla
            const gridX = x * xScale;
            const gridY = invertedY * yScale;

            // Índices de la celda en la grilla original
            const col1 = Math.floor(gridX);
            const col2 = Math.min(col1 + 1, cols - 1);
            const row1 = Math.floor(gridY);
            const row2 = Math.min(row1 + 1, rows - 1);

            // Factores de interpolación
            const tCol = gridX - col1;
            const tRow = gridY - row1;

            // Valores de los 4 puntos más cercanos en la grilla original
            const v11 = fullZi[row1]?.[col1] || 0;
            const v12 = fullZi[row1]?.[col2] || 0;
            const v21 = fullZi[row2]?.[col1] || 0;
            const v22 = fullZi[row2]?.[col2] || 0;

            // Interpolación bilineal
            const v1 = v11 * (1 - tCol) + v12 * tCol;
            const v2 = v21 * (1 - tCol) + v22 * tCol;
            const finalValue = v1 * (1 - tRow) + v2 * tRow;

            // Normalizar valor usando min/max dinámicos basados en datos reales
            const normalizedVal = (finalValue - minVal) / valueRange;

            // Obtener color de la LUT
            const lutIndex = Math.floor(normalizedVal * 255);
            const idx = Math.max(0, Math.min(lutIndex, 255));
            const color = colorLUT[idx];

            // Acceso directo a componentes RGBA desde la LUT optimizada
            const rgba = color; // color ya es array [R, G, B, A]
            const pixelIdx = (y * scaledWidth + x) * 4;
            data[pixelIdx] = rgba[0]; // R
            data[pixelIdx + 1] = rgba[1]; // G
            data[pixelIdx + 2] = rgba[2]; // B
            data[pixelIdx + 3] = rgba[3]; // A
          }
        }

        // Aplicar ImageData al canvas temporal
        tempCtx.putImageData(imageData, 0, 0);

        // Dibujar el canvas temporal escalado al canvas principal
        // Usar alta calidad de escalado (smooth) para mejor apariencia
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(
          tempCanvas,
          0,
          0,
          scaledWidth,
          scaledHeight,
          0,
          0,
          width,
          height,
        );

        console.log(
          `[${new Date().toISOString()}] HeatmapLayer - Mapa de calor completado`,
          {
            cubreTodoElPlano: true,
            dimensiones: `${rows}x${cols}`,
            esquemaColor: colorScheme,
            opacidad: opacity,
            potenciaIDW: idwPower,
            timestamp: new Date().toISOString(),
            escalaDinamica: {
              factor: scaleFactor,
              resolucionOriginal: `${width}x${height}`,
              resolucionRender: `${scaledWidth}x${scaledHeight}`,
              pixelesOriginales: currentPixels,
              pixelesRender: scaledWidth * scaledHeight,
              optimizacion: `${((1 - scaleFactor) * 100).toFixed(1)}%`,
            },
          },
        );
      });
    }, [
      idwData,
      showHeatmap,
      tilesToPixels,
      colorScheme,
      opacity,
      idwPower,
      fullXi,
      fullYi,
      fullZi,
      minVal,
      maxVal,
      valueRange,
    ]);

    // Cleanup animation frame on unmount
    useEffect(() => {
      return () => {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      };
    }, []);

    return (
      <canvas
        ref={canvasRef}
        width={displayDimensions.width || PLAN_IMAGE_WIDTH}
        height={displayDimensions.height || PLAN_IMAGE_HEIGHT}
        className="absolute inset-0 pointer-events-none"
        style={{
          zIndex: 5,
          position: "absolute",
          top: 0,
          left: 0,
          width: `${displayDimensions.width || PLAN_IMAGE_WIDTH}px`,
          height: `${displayDimensions.height || PLAN_IMAGE_HEIGHT}px`,
        }}
      />
    );
  },
);

// Componente para cuadrícula de baldosas
const GridOverlay = ({
  showGrid,
  displayDimensions = { width: PLAN_IMAGE_WIDTH, height: PLAN_IMAGE_HEIGHT },
}) => {
  if (!showGrid) return null;

  const tiles = [];

  // Usar dimensiones actuales de visualización
  const displayWidth = displayDimensions.width || PLAN_IMAGE_WIDTH;
  const displayHeight = displayDimensions.height || PLAN_IMAGE_HEIGHT;

  // Calcular tamaño de cada baldosa para cubrir exactamente el área disponible
  const tileWidth = displayWidth / TILES_WIDTH;
  const tileHeight = displayHeight / TILES_HEIGHT;

  // Crear baldosas individuales
  // Recorrer en coordenadas del plano (derecha a izquierda, abajo a arriba)
  // Sistema de coordenadas: (0,0) = esquina inferior derecha
  for (let tileY = 0; tileY < TILES_HEIGHT; tileY++) {
    for (let tileX = 0; tileX < TILES_WIDTH; tileX++) {
      // Coordenadas en baldosas: tileX=0 derecha, tileX=TILES_WIDTH-1 izquierda
      // tileY=0 abajo, tileY=TILES_HEIGHT-1 arriba
      const xBaldosas = TILES_WIDTH - 1 - tileX; // 0 derecha, TILES_WIDTH-1 izquierda
      const yBaldosas = tileY; // 0 abajo, TILES_HEIGHT-1 arriba

      // Convertir a píxeles: posición de la esquina superior izquierda de la baldosa
      const leftPx = xBaldosas * tileWidth;
      const topPx = (TILES_HEIGHT - 1 - yBaldosas) * tileHeight; // invertir Y

      // Alternar colores para crear efecto de tablero
      const isLightTile = (tileX + tileY) % 2 === 0;
      const tileColor = isLightTile
        ? "rgba(200, 200, 200, 0.15)"
        : "rgba(150, 150, 150, 0.15)";

      tiles.push(
        <div
          key={`tile-${tileX}-${tileY}`}
          className="absolute border border-gray-400/20"
          style={{
            left: `${leftPx}px`,
            top: `${topPx}px`,
            width: `${tileWidth}px`,
            height: `${tileHeight}px`,
            backgroundColor: tileColor,
          }}
        />,
      );
    }
  }

  return <>{tiles}</>;
};

const EpicenterZone = ({
  epicenter,
  showEpicenter,
  tilesToPixels,
  displayDimensions = { width: PLAN_IMAGE_WIDTH, height: PLAN_IMAGE_HEIGHT },
}) => {
  console.log("EpicenterZone - Props recibidas:", {
    showEpicenter,
    epicenter,
    zone_type: epicenter?.zone_type,
    has_epicenter: !!epicenter,
    epicenter_keys: epicenter ? Object.keys(epicenter) : [],
    epicenter_full: epicenter,
  });

  if (!showEpicenter || !epicenter || epicenter.zone_type !== "circle") {
    console.log("EpicenterZone - No se renderiza porque:", {
      showEpicenter,
      has_epicenter: !!epicenter,
      zone_type: epicenter?.zone_type,
      fails_showEpicenter: !showEpicenter,
      fails_epicenter: !epicenter,
      fails_zone_type: epicenter && epicenter.zone_type !== "circle",
    });
    return null;
  }

  console.log("EpicenterZone - Datos de zona:", {
    zone_center_longitude: epicenter.zone_center_longitude,
    zone_center_latitude: epicenter.zone_center_latitude,
    zone_radius: epicenter.zone_radius,
    top_sensors_count: epicenter.top_sensors ? epicenter.top_sensors.length : 0,
    top_sensors: epicenter.top_sensors,
  });

  const center = tilesToPixels(
    epicenter.zone_center_longitude,
    epicenter.zone_center_latitude,
  );

  // Usar dimensiones actuales de visualización
  const displayWidth = displayDimensions.width || PLAN_IMAGE_WIDTH;
  const displayHeight = displayDimensions.height || PLAN_IMAGE_HEIGHT;
  const scaleX = displayWidth / PLAN_IMAGE_WIDTH;
  const scaleY = displayHeight / PLAN_IMAGE_HEIGHT;

  const avgPixelsPerTile =
    (TILES_TO_PIXELS * scaleX + TILES_TO_PIXELS * scaleY) / 2;

  // Limitar centro para que esté dentro del plano (0-57 baldosas, 0-66 baldosas)
  const centerX = Math.max(
    0,
    Math.min(epicenter.zone_center_longitude, PLAN_WIDTH_TILES),
  );
  const centerY = Math.max(
    0,
    Math.min(epicenter.zone_center_latitude, PLAN_HEIGHT_TILES),
  );

  // Aplicar factor de escala al radio original antes de limitar
  const scaledRadiusTiles = epicenter.zone_radius * 0.5; // Reducir a la mitad

  // Limitar radio para que no exceda los bordes del plano
  const maxRadiusX = Math.min(centerX, PLAN_WIDTH_TILES - centerX); // distancia a bordes horizontales
  const maxRadiusY = Math.min(centerY, PLAN_HEIGHT_TILES - centerY); // distancia a bordes verticales
  const maxRadiusTiles = Math.min(maxRadiusX, maxRadiusY);
  const limitedRadiusTiles = Math.min(scaledRadiusTiles, maxRadiusTiles);

  // Radio mínimo para que sea visible (0.5 baldosas = 0.15m)
  const minRadiusTiles = 0.5;
  const finalRadiusTiles = Math.max(minRadiusTiles, limitedRadiusTiles);

  const radiusPixels = finalRadiusTiles * avgPixelsPerTile;

  console.log("EpicenterZone - Cálculos de visualización:", {
    TILES_TO_PIXELS,
    avgPixelsPerTile,
    centerX,
    centerY,
    zone_radius_tiles: epicenter.zone_radius,
    scaledRadiusTiles,
    maxRadiusX,
    maxRadiusY,
    maxRadiusTiles,
    limitedRadiusTiles,
    minRadiusTiles: 0.5,
    finalRadiusTiles,
    radiusPixels,
    center_pixels: center,
  });

  console.log("EpicenterZone - Renderizando zona epicentro");

  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 15 }}
    >
      {/* Zona epicentro principal */}
      <div
        className="absolute rounded-full border-4 border-red-800/70 bg-red-900/20"
        style={{
          left: `${center.x}px`,
          top: `${center.y}px`,
          width: `${radiusPixels * 2}px`,
          height: `${radiusPixels * 2}px`,
          transform: "translate(-50%, -50%)",
          boxShadow: "0 0 20px rgba(220, 38, 38, 0.5)",
        }}
      />

      {/* Líneas a sensores top */}
      {epicenter.top_sensors &&
        epicenter.top_sensors.map((sensor) => {
          const sensorPos = tilesToPixels(sensor.longitude, sensor.latitude);
          return (
            <div
              key={sensor.micro_id}
              className="absolute bg-red-600/50"
              style={{
                left: `${center.x}px`,
                top: `${center.y}px`,
                width: `${Math.sqrt(Math.pow(sensorPos.x - center.x, 2) + Math.pow(sensorPos.y - center.y, 2))}px`,
                height: "2px",
                transform: `translate(0, -50%) rotate(${Math.atan2(sensorPos.y - center.y, sensorPos.x - center.x)}rad)`,
                transformOrigin: "0 50%",
              }}
            />
          );
        })}
    </div>
  );
};

const FloorPlanMap = ({
  sensorData,
  idwData,
  epicenter = null,
  showHeatmap: initialShowHeatmap = true,
  showEpicenter: initialShowEpicenter = true,
  showGrid: initialShowGrid = true,
  colorScheme: externalColorScheme = "redyellowgreen",
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
  const [autoScale, setAutoScale] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef(null);
  const mapContentRef = useRef(null);

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

  // Dimensiones base del plano (sin zoom, solo autoScale)
  const baseWidth = useMemo(
    () => Math.floor(PLAN_IMAGE_WIDTH * autoScale),
    [autoScale],
  );
  const baseHeight = useMemo(
    () => Math.floor(PLAN_IMAGE_HEIGHT * autoScale),
    [autoScale],
  );

  // Dimensiones escaladas con zoom
  const scaledWidth = useMemo(
    () => Math.floor(baseWidth * zoom),
    [baseWidth, zoom],
  );
  const scaledHeight = useMemo(
    () => Math.floor(baseHeight * zoom),
    [baseHeight, zoom],
  );

  // Convertir coordenadas de baldosas a píxeles (sin zoom/pan, solo autoScale)
  // NOTA: El sistema de coordenadas tiene (0,0) en la esquina INFERIOR DERECHA
  // X: 0-57 baldosas (derecha=0, izquierda=57) -> en píxeles: derecha a izquierda
  // Y: 0-66 baldosas (abajo=0, arriba=66) -> en píxeles: abajo a arriba
  const tilesToPixels = useCallback(
    (xTiles, yTiles, microId = null) => {
      // Ajustar coordenadas para manejar errores de precisión
      const adjustedXTiles = Math.max(0, Math.min(PLAN_WIDTH_TILES, xTiles));
      const adjustedYTiles = Math.max(0, Math.min(PLAN_HEIGHT_TILES, yTiles));

      // Píxeles por baldosa (escalado base)
      const pixelsPerTile = TILES_TO_PIXELS * autoScale;

      // Convertir baldosas a píxeles directamente usando la escala
      // X: 0-57 baldosas -> píxeles: derecha=baseWidth, izquierda=0
      const xPx = baseWidth - adjustedXTiles * pixelsPerTile;

      // Y: 0-66 baldosas -> píxeles: abajo=baseHeight, arriba=0
      const yPx = baseHeight - adjustedYTiles * pixelsPerTile;

      return { x: xPx, y: yPx };
    },
    [autoScale, baseWidth, baseHeight],
  );

  // Debug: verificar coordenadas de sensores
  useEffect(() => {
    console.log(
      `[${new Date().toISOString()}] FloorPlanMap - Props recibidas:`,
      {
        sensorData_count: sensorData.length,
        idwData: idwData
          ? {
              hasData: true,
              xiType: Array.isArray(idwData.xi)
                ? Array.isArray(idwData.xi[0])
                  ? "2D"
                  : "1D"
                : "none",
              yiType: Array.isArray(idwData.yi)
                ? Array.isArray(idwData.yi[0])
                  ? "2D"
                  : "1D"
                : "none",
              ziShape: idwData.zi
                ? `${idwData.zi.length}x${idwData.zi[0]?.length || 0}`
                : "none",
            }
          : { hasData: false },
        showHeatmap,
        timestamp: new Date().toISOString(),
      },
    );

    if (sensorData.length > 0) {
      console.log(
        `[${new Date().toISOString()}] Coordenadas de sensores en FloorPlanMap:`,
        sensorData.map((s) => ({
          micro_id: s.micro_id,
          latitude: s.latitude,
          longitude: s.longitude,
          pixels: tilesToPixels(s.longitude, s.latitude),
          value: s.value,
          received_time: new Date().toISOString(),
        })),
      );
    } else {
      console.log(
        `[${new Date().toISOString()}] FloorPlanMap - sensorData vacío`,
      );
    }
  }, [sensorData, idwData, showHeatmap, tilesToPixels]);

  // Sincronizar props externos con estado interno
  useEffect(() => {
    setColorScheme(externalColorScheme);
  }, [externalColorScheme]);

  useEffect(() => {
    setOpacity(externalOpacity);
  }, [externalOpacity]);

  useEffect(() => {
    setIdwPower(externalIdwPower);
  }, [externalIdwPower]);

  useEffect(() => {
    setShowGrid(initialShowGrid);
  }, [initialShowGrid]);

  useEffect(() => {
    setShowHeatmap(initialShowHeatmap);
  }, [initialShowHeatmap]);

  useEffect(() => {
    setShowEpicenter(initialShowEpicenter);
  }, [initialShowEpicenter]);

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

  // Calcular escala automática basada en el contenedor
  const getAutoScale = () => {
    if (!containerRef.current) return 1;
    const containerWidth = containerRef.current.clientWidth || 800;
    const containerHeight = containerRef.current.clientHeight || 600;

    // Dejar margen para controles y leyenda
    const availableWidth = containerWidth - 180; // espacio para controles
    const availableHeight = containerHeight - 100; // espacio para leyenda

    const scaleX = availableWidth / PLAN_IMAGE_WIDTH;
    const scaleY = availableHeight / PLAN_IMAGE_HEIGHT;

    const scale = Math.max(0.8, Math.min(scaleX, scaleY)); // Permitir reducción a 0.8x para caber mejor
    console.log(
      `[${new Date().toISOString()}] FloorPlanMap - Calculando escala: scaleX=${scaleX.toFixed(2)}, scaleY=${scaleY.toFixed(2)}, escalaFinal=${scale.toFixed(2)}`,
    );
    return Math.min(scale, 2); // máximo 2x
  };

  // Calcular dimensiones del viewport disponible para el mapa (restando padding)
  const getViewportDimensions = () => {
    if (!containerRef.current) {
      return { width: baseWidth, height: baseHeight };
    }
    const containerRect = containerRef.current.getBoundingClientRect();
    // El contenedor interno tiene p-4 (16px de padding en todos lados)
    const padding = 16;
    const viewportWidth = Math.max(0, containerRect.width - padding * 2);
    const viewportHeight = Math.max(0, containerRect.height - padding * 2);
    return { width: viewportWidth, height: viewportHeight };
  };

  // Actualizar escala automáticamente cuando cambie el tamaño
  useEffect(() => {
    const updateScale = () => {
      setAutoScale(getAutoScale());
    };

    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      {/* Contenedor del plano con scroll */}
      <div
        className="relative rounded-2xl shadow-lg bg-gray-900 overflow-auto"
        style={{ maxHeight: "70vh" }}
      >
        {/* Contenedor del mapa con scroll interno */}
        <div
          className="w-full h-full p-4 bg-gray-900"
          style={{
            minHeight: "400px",
          }}
        >
          {/* Contenedor del mapa con zoom y pan */}
          <div
            ref={mapContentRef}
            className="relative mx-auto overflow-hidden bg-gray-900"
            style={{
              width: `${baseWidth}px`,
              height: `${baseHeight}px`,
              maxWidth: `${baseWidth}px`,
              maxHeight: `${baseHeight}px`,
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: "0 0",
              cursor: isDragging ? "grabbing" : "grab",
            }}
            onMouseDown={(e) => {
              if (e.button === 0) {
                // Botón izquierdo
                setIsDragging(true);
                setDragStart({
                  x: e.clientX - pan.x,
                  y: e.clientY - pan.y,
                });
                e.currentTarget.style.cursor = "grabbing";
              }
            }}
            onMouseMove={(e) => {
              if (isDragging) {
                // Calcular nuevo pan con límites
                const newPanX = e.clientX - dragStart.x;
                const newPanY = e.clientY - dragStart.y;

                // Límites del pan: no permitir mover el mapa fuera de los bordes
                const scaledWidth = baseWidth * zoom;
                const scaledHeight = baseHeight * zoom;
                const { width: viewportWidth, height: viewportHeight } =
                  getViewportDimensions();

                // Calcular límites basados en el tamaño del contenido escalado vs el viewport
                const maxPanX = Math.max(0, scaledWidth - viewportWidth);
                const maxPanY = Math.max(0, scaledHeight - viewportHeight);
                const minPanX = Math.min(0, -maxPanX);
                const minPanY = Math.min(0, -maxPanY);

                setPan({
                  x: Math.max(minPanX, Math.min(maxPanX, newPanX)),
                  y: Math.max(minPanY, Math.min(maxPanY, newPanY)),
                });
              }
            }}
            onMouseUp={() => {
              setIsDragging(false);
              if (mapContentRef.current) {
                mapContentRef.current.style.cursor = "grab";
              }
            }}
            onMouseLeave={() => {
              setIsDragging(false);
              if (mapContentRef.current) {
                mapContentRef.current.style.cursor = "grab";
              }
            }}
            onWheel={(e) => {
              e.preventDefault();
              const rect = e.currentTarget.getBoundingClientRect();
              const mouseX = e.clientX - rect.left;
              const mouseY = e.clientY - rect.top;

              const oldZoom = zoom;
              const newZoom = Math.max(
                0.5,
                Math.min(5, zoom - e.deltaY * 0.001),
              );

              // Zoom centrado en el cursor del mouse
              const scaleFactor = newZoom / oldZoom;
              // Calcular el punto relativo al contenido transformado
              // mouseX/Y son coordenadas de pantalla, pan es en píxeles de pantalla
              const relativeX = (mouseX - pan.x) / oldZoom;
              const relativeY = (mouseY - pan.y) / oldZoom;

              // Nuevo pan para mantener el punto bajo el cursor
              // Primero calcular donde estaría el punto con el nuevo zoom
              const newX = relativeX * newZoom;
              const newY = relativeY * newZoom;

              // Ajustar pan para que mouseX/Y coincida con newX/Y
              let newPanX = mouseX - newX;
              let newPanY = mouseY - newY;

              // Aplicar límites después del zoom
              const scaledWidth = baseWidth * newZoom;
              const scaledHeight = baseHeight * newZoom;
              const { width: viewportWidth, height: viewportHeight } =
                getViewportDimensions();

              const maxPanX = Math.max(0, scaledWidth - viewportWidth);
              const maxPanY = Math.max(0, scaledHeight - viewportHeight);
              const minPanX = Math.min(0, -maxPanX);
              const minPanY = Math.min(0, -maxPanY);

              newPanX = Math.max(minPanX, Math.min(maxPanX, newPanX));
              newPanY = Math.max(minPanY, Math.min(maxPanY, newPanY));

              setZoom(newZoom);
              setPan({ x: newPanX, y: newPanY });
            }}
          >
            {/* Fondo de cuadrícula de baldosas */}
            <GridOverlay
              showGrid={showGrid}
              displayDimensions={{ width: baseWidth, height: baseHeight }}
            />

            {/* Mapa de calor */}
            <HeatmapLayer
              idwData={showHeatmap ? idwData : null}
              showHeatmap={showHeatmap}
              tilesToPixels={tilesToPixels}
              colorScheme={colorScheme}
              opacity={opacity}
              idwPower={idwPower}
              displayDimensions={{ width: baseWidth, height: baseHeight }}
            />

            {/* Zona Epicentro */}
            <EpicenterZone
              epicenter={epicenter}
              showEpicenter={showEpicenter}
              tilesToPixels={tilesToPixels}
              displayDimensions={{ width: baseWidth, height: baseHeight }}
            />

            {/* Sensores */}
            {sensorData.map((sensor, index) => {
              const { x, y } = tilesToPixels(
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
                  mapContainerRef={containerRef}
                  displayDimensions={{
                    width: baseWidth,
                    height: baseHeight,
                  }}
                />
              );
            })}
          </div>
          {/* Controles de zoom */}
          <div className="absolute top-4 right-4 z-50 flex flex-col gap-2">
            <div className="flex flex-col gap-2 p-2 bg-gray-800/80 backdrop-blur-sm rounded-lg border border-gray-700">
              <div className="flex justify-center gap-2">
                <button
                  className="bg-gray-700 hover:bg-gray-600 text-white w-8 h-8 rounded-full flex items-center justify-center shadow-lg transition-colors"
                  onClick={() => {
                    const newZoom = Math.min(5, zoom * 1.2);
                    // Centrar el zoom en el viewport
                    const { width: viewportWidth, height: viewportHeight } =
                      getViewportDimensions();
                    const centerX = viewportWidth / 2;
                    const centerY = viewportHeight / 2;

                    const scaleFactor = newZoom / zoom;
                    const relativeX = (centerX - pan.x) / zoom;
                    const relativeY = (centerY - pan.y) / zoom;

                    const newX = relativeX * newZoom;
                    const newY = relativeY * newZoom;

                    const newPanX = centerX - newX;
                    const newPanY = centerY - newY;

                    setZoom(newZoom);
                    setPan({ x: newPanX, y: newPanY });
                  }}
                  title="Acercar (Ctrl + Scroll)"
                >
                  +
                </button>
                <button
                  className="bg-gray-700 hover:bg-gray-600 text-white w-8 h-8 rounded-full flex items-center justify-center shadow-lg transition-colors"
                  onClick={() => {
                    const newZoom = Math.max(0.5, zoom / 1.2);
                    // Centrar el zoom en el viewport
                    const { width: viewportWidth, height: viewportHeight } =
                      getViewportDimensions();
                    const centerX = viewportWidth / 2;
                    const centerY = viewportHeight / 2;

                    const scaleFactor = newZoom / zoom;
                    const relativeX = (centerX - pan.x) / zoom;
                    const relativeY = (centerY - pan.y) / zoom;

                    const newX = relativeX * newZoom;
                    const newY = relativeY * newZoom;

                    const newPanX = centerX - newX;
                    const newPanY = centerY - newY;

                    setZoom(newZoom);
                    setPan({ x: newPanX, y: newPanY });
                  }}
                  title="Alejar (Ctrl + Scroll)"
                >
                  -
                </button>
              </div>
              <div className="flex justify-center gap-2">
                <button
                  className="bg-gray-700 hover:bg-gray-600 text-white w-8 h-8 rounded-full flex items-center justify-center shadow-lg transition-colors"
                  onClick={() => {
                    setZoom(1);
                    setPan({ x: 0, y: 0 });
                  }}
                  title="Restablecer a 100%"
                >
                  ↻
                </button>
                <button
                  className="bg-gray-700 hover:bg-gray-600 text-white w-8 h-8 rounded-full flex items-center justify-center shadow-lg transition-colors"
                  onClick={() => {
                    // Calcular zoom para que el mapa quepa completamente en el viewport
                    const { width: viewportWidth, height: viewportHeight } =
                      getViewportDimensions();

                    const scaleX = viewportWidth / baseWidth;
                    const scaleY = viewportHeight / baseHeight;
                    const fitZoom = Math.min(scaleX, scaleY, 2); // Máximo 2x para no perder calidad

                    // Centrar el mapa en el viewport
                    const scaledWidth = baseWidth * fitZoom;
                    const scaledHeight = baseHeight * fitZoom;
                    const newPanX = (viewportWidth - scaledWidth) / 2;
                    const newPanY = (viewportHeight - scaledHeight) / 2;

                    setZoom(fitZoom);
                    setPan({ x: newPanX, y: newPanY });
                  }}
                  title="Ajustar a la vista"
                >
                  ⤢
                </button>
              </div>
              <div className="text-xs text-gray-300 text-center mt-1 pt-2 border-t border-gray-700">
                <div className="font-medium">
                  Zoom: {(zoom * 100).toFixed(0)}%
                </div>
                <div className="text-gray-400 text-[10px] mt-1">
                  Arrastre para mover • Rueda para zoom
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FloorPlanMap;
