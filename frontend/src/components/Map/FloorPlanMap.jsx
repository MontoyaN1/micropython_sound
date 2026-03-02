import { useState, useEffect, useRef, useMemo, memo } from "react";
import { Activity, Map, Grid } from "lucide-react";

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
          className={`absolute left-1/2 transform -translate-x-1/2 w-64 bg-white rounded-lg shadow-xl p-4 z-[100] border border-gray-200 ${
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
        let color;

        // Interpolación lineal para todos los esquemas
        const index = Math.floor(normalizedValue * (palette.length - 1));
        const colorIdx = Math.max(0, Math.min(index, palette.length - 1));
        color = palette[colorIdx];

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

      // Si no se encontraron límites válidos, usar plano completo
      if (!isFinite(minX) || !isFinite(maxX)) {
        minX = 0;
        maxX = PLAN_WIDTH;
      }
      if (!isFinite(minY) || !isFinite(maxY)) {
        minY = 0;
        maxY = PLAN_HEIGHT;
      }

      // Asegurar que haya rango positivo para evitar división por cero
      let xRange = maxX - minX;
      let yRange = maxY - minY;
      if (xRange <= 0) xRange = PLAN_WIDTH;
      if (yRange <= 0) yRange = PLAN_HEIGHT;

      // Paso en metros para cubrir todo el plano
      const xStep = PLAN_WIDTH / (targetCols - 1);
      const yStep = PLAN_HEIGHT / (targetRows - 1);

      // Crear grilla densa que cubra TODO el plano con interpolación bilineal
      for (let i = 0; i < targetRows; i++) {
        fullXi[i] = [];
        fullYi[i] = [];
        fullZi[i] = [];

        // Coordenada Y en el plano (0-14m)
        const yMeters = Math.max(0, Math.min(PLAN_HEIGHT, i * yStep));

        for (let j = 0; j < targetCols; j++) {
          // Coordenada X en el plano (0-5m)
          const xMeters = Math.max(0, Math.min(PLAN_WIDTH, j * xStep));

          fullXi[i][j] = xMeters;
          fullYi[i][j] = yMeters;

          // Convertir coordenadas del plano (0-5m, 0-14m) al rango de los datos del backend
          const xBackend = minX + (xMeters / PLAN_WIDTH) * xRange;
          const yBackend = minY + (yMeters / PLAN_HEIGHT) * yRange;

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
          console.log(
            `[${new Date().toISOString()}] HeatmapLayer - Canvas limpiado (sin datos o desactivado)`,
          );
        }
        return;
      }

      const canvas = canvasRef.current;
      if (!canvas) return;

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

          // Normalizar valor usando min/max dinámicos basados en datos reales
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

      console.log(
        `[${new Date().toISOString()}] HeatmapLayer - Mapa de calor completado`,
        {
          cubreTodoElPlano: true,
          dimensiones: `${rows}x${cols}`,
          esquemaColor: colorScheme,
          opacidad: opacity,
          potenciaIDW: idwPower,
          timestamp: new Date().toISOString(),
        },
      );
    }, [
      idwData,
      showHeatmap,
      metersToPixels,
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

const EpicenterZone = ({ epicenter, showEpicenter, metersToPixels }) => {
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

  const center = metersToPixels(
    epicenter.zone_center_longitude,
    epicenter.zone_center_latitude,
  );

  const avgPixelsPerMeter = (METERS_TO_PIXELS_X + METERS_TO_PIXELS_Y) / 2;

  // Limitar centro para que esté dentro del plano (0-5m, 0-14m)
  const centerX = Math.max(
    0,
    Math.min(epicenter.zone_center_longitude, PLAN_WIDTH),
  );
  const centerY = Math.max(
    0,
    Math.min(epicenter.zone_center_latitude, PLAN_HEIGHT),
  );

  // Aplicar factor de escala al radio original antes de limitar
  const scaledRadiusMeters = epicenter.zone_radius * 0.5; // Reducir a la mitad

  // Limitar radio para que no exceda los bordes del plano
  const maxRadiusX = Math.min(centerX, PLAN_WIDTH - centerX); // distancia a bordes horizontales
  const maxRadiusY = Math.min(centerY, PLAN_HEIGHT - centerY); // distancia a bordes verticales
  const maxRadiusMeters = Math.min(maxRadiusX, maxRadiusY);
  const limitedRadiusMeters = Math.min(scaledRadiusMeters, maxRadiusMeters);

  // Radio mínimo para que sea visible (0.5 metros)
  const minRadiusMeters = 0.5;
  const finalRadiusMeters = Math.max(minRadiusMeters, limitedRadiusMeters);

  const radiusPixels = finalRadiusMeters * avgPixelsPerMeter;

  console.log("EpicenterZone - Cálculos de visualización:", {
    METERS_TO_PIXELS_X,
    METERS_TO_PIXELS_Y,
    avgPixelsPerMeter,
    centerX,
    centerY,
    zone_radius_meters: epicenter.zone_radius,
    scaledRadiusMeters,
    maxRadiusX,
    maxRadiusY,
    maxRadiusMeters,
    limitedRadiusMeters,
    minRadiusMeters: 0.5,
    finalRadiusMeters,
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
          const sensorPos = metersToPixels(sensor.longitude, sensor.latitude);
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
  const [imageDimensions, setImageDimensions] = useState({
    width: PLAN_IMAGE_WIDTH,
    height: PLAN_IMAGE_HEIGHT,
  });
  const [displayDimensions, setDisplayDimensions] = useState({
    width: 0,
    height: 0,
  });
  const containerRef = useRef(null);
  const imageRef = useRef(null);

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

  // Medir dimensiones de la imagen cuando se carga y cuando cambia el tamaño de ventana
  useEffect(() => {
    const updateDisplayDimensions = () => {
      if (imageRef.current) {
        const rect = imageRef.current.getBoundingClientRect();
        setDisplayDimensions({
          width: rect.width,
          height: rect.height,
        });
      }
    };

    // Actualizar cuando la imagen se carga
    const img = imageRef.current;
    if (img) {
      if (img.complete) {
        updateDisplayDimensions();
      } else {
        img.addEventListener("load", updateDisplayDimensions);
      }
    }

    // Actualizar en redimensionamiento de ventana
    window.addEventListener("resize", updateDisplayDimensions);

    return () => {
      if (img) {
        img.removeEventListener("load", updateDisplayDimensions);
      }
      window.removeEventListener("resize", updateDisplayDimensions);
    };
  }, []);

  // No se calcula epicentro

  // Convertir coordenadas en metros a píxeles
  // NOTA: El sistema de coordenadas tiene (0,0) en la esquina INFERIOR DERECHA
  // X: 0-5 metros (derecha a izquierda) -> en píxeles: derecha a izquierda
  // Y: 0-14 metros (abajo a arriba) -> en píxeles: abajo a arriba
  const metersToPixels = (xMeters, yMeters, microId = null) => {
    // Ajustar coordenadas para manejar errores de precisión de punto flotante
    // JavaScript tiene problemas con 14.000000000000002 > 14
    const adjustedXMeters = Math.max(0, Math.min(5, xMeters));
    const adjustedYMeters = Math.max(0, Math.min(14, yMeters));

    // Log para debug de coordenadas (solo si hay ajuste significativo)
    if (
      microId === null &&
      (Math.abs(xMeters - adjustedXMeters) > 0.0001 ||
        Math.abs(yMeters - adjustedYMeters) > 0.0001)
    ) {
      console.warn(
        `⚠️ Coordenadas ajustadas en metersToPixels: x=${xMeters}->${adjustedXMeters}, y=${yMeters}->${adjustedYMeters}`,
      );
    }

    // Usar dimensiones actuales de la imagen para escalado
    const displayWidth = displayDimensions.width || PLAN_IMAGE_WIDTH;
    const displayHeight = displayDimensions.height || PLAN_IMAGE_HEIGHT;
    const scaleX = displayWidth / PLAN_IMAGE_WIDTH;
    const scaleY = displayHeight / PLAN_IMAGE_HEIGHT;

    // Convertir metros a píxeles
    // X: 0-5m (derecha=0, izquierda=5) -> píxeles: derecha=displayWidth, izquierda=0
    const xPx = displayWidth - adjustedXMeters * (METERS_TO_PIXELS_X * scaleX);

    // Y: 0-14m (abajo=0, arriba=14) -> píxeles: abajo=displayHeight, arriba=0
    const yPx = displayHeight - adjustedYMeters * (METERS_TO_PIXELS_Y * scaleY);

    return { x: xPx, y: yPx };
  };

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
          pixels: metersToPixels(s.longitude, s.latitude),
          value: s.value,
          received_time: new Date().toISOString(),
        })),
      );
    } else {
      console.log(
        `[${new Date().toISOString()}] FloorPlanMap - sensorData vacío`,
      );
    }
  }, [sensorData, idwData, showHeatmap]);

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
              width: "100%",
              height: "auto",
              maxWidth: `${PLAN_IMAGE_WIDTH}px`,
              maxHeight: `${PLAN_IMAGE_HEIGHT}px`,
            }}
          >
            <img
              ref={imageRef}
              src="/plano.png"
              alt="Plano interior"
              className="w-full h-auto"
              onLoad={(e) => {
                const img = e.target;
                setImageDimensions({
                  width: img.naturalWidth,
                  height: img.naturalHeight,
                });
                const rect = img.getBoundingClientRect();
                setDisplayDimensions({
                  width: rect.width,
                  height: rect.height,
                });
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

              {/* Zona Epicentro */}
              <EpicenterZone
                epicenter={epicenter}
                showEpicenter={showEpicenter}
                metersToPixels={metersToPixels}
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
                    left: `${displayDimensions.width || PLAN_IMAGE_WIDTH}px`,
                    top: `${displayDimensions.height || PLAN_IMAGE_HEIGHT}px`,
                    transform: "translate(-50%, -50%)",
                  }}
                  title="Esquina inferior derecha (0,0)"
                ></div>
                <div
                  className="absolute w-2 h-2 bg-blue-500 rounded-full"
                  style={{
                    left: "0px",
                    top: `${displayDimensions.height || PLAN_IMAGE_HEIGHT}px`,
                    transform: "translate(-50%, -50%)",
                  }}
                  title="Esquina inferior izquierda (5,0)"
                ></div>
                <div
                  className="absolute w-2 h-2 bg-blue-500 rounded-full"
                  style={{
                    left: `${displayDimensions.width || PLAN_IMAGE_WIDTH}px`,
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
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FloorPlanMap;
