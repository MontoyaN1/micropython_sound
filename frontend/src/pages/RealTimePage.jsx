import { useState, useEffect, useMemo } from "react";
import {
  Activity,
  AlertTriangle,
  TrendingUp,
  Clock,
  Map,
  Target,
} from "lucide-react";
import FloorPlanMap from "../components/Map/FloorPlanMap";
import { useWebSocket } from "../hooks/useWebSocket";
import { testSensorData, testIdwData, testEpicenter } from "../utils/testData";

const RealTimePage = () => {
  const {
    connected,
    sensorData: wsSensorData,
    idwData: wsIdwData,
    epicenter: wsEpicenter,
    sensorCount,
    lastUpdate,
  } = useWebSocket();

  // Usar datos de prueba si WebSocket no está conectado
  // NOTA: Los datos de prueba tienen coordenadas fijas que pueden no coincidir
  // con la configuración actual en location/sensores.yaml
  const sensorData = connected ? wsSensorData : testSensorData;
  const idwData = connected ? wsIdwData : testIdwData;
  const epicenter = connected ? wsEpicenter : testEpicenter;

  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showEpicenter, setShowEpicenter] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [colorScheme, setColorScheme] = useState("plasma");
  const [opacity, setOpacity] = useState(0.6);
  const [idwPower, setIdwPower] = useState(2);

  const [stats, setStats] = useState({
    avgNoise: 0,
    maxNoise: 0,
    minNoise: 0,
    criticalSensors: 0,
  });

  console.log("RealTimePage - Estado actual:", {
    connected,
    showHeatmap,
    showEpicenter,
    epicenterFromWS: wsEpicenter,
    epicenterToPass: showEpicenter ? epicenter : null,
    sensorCount: sensorData.length,
  });

  // Función para generar gradiente del heatmap basado en el esquema de color
  const heatmapGradientStyle = useMemo(() => {
    const getColorStops = (scheme) => {
      switch (scheme) {
        case "viridis":
          return [
            `rgba(68, 1, 84, ${opacity})`,
            `rgba(72, 35, 116, ${opacity})`,
            `rgba(64, 67, 135, ${opacity})`,
            `rgba(52, 94, 141, ${opacity})`,
            `rgba(41, 121, 135, ${opacity})`,
            `rgba(31, 146, 120, ${opacity})`,
            `rgba(53, 173, 96, ${opacity})`,
            `rgba(109, 199, 63, ${opacity})`,
            `rgba(180, 222, 44, ${opacity})`,
            `rgba(253, 231, 37, ${opacity})`,
          ];
        case "plasma":
          return [
            `rgba(13, 8, 135, ${opacity})`,
            `rgba(84, 2, 163, ${opacity})`,
            `rgba(139, 10, 165, ${opacity})`,
            `rgba(185, 50, 137, ${opacity})`,
            `rgba(219, 90, 104, ${opacity})`,
            `rgba(244, 136, 73, ${opacity})`,
            `rgba(254, 188, 43, ${opacity})`,
            `rgba(240, 249, 33, ${opacity})`,
          ];
        case "inferno":
          return [
            `rgba(0, 0, 4, ${opacity})`,
            `rgba(31, 12, 72, ${opacity})`,
            `rgba(85, 15, 109, ${opacity})`,
            `rgba(136, 34, 106, ${opacity})`,
            `rgba(186, 54, 85, ${opacity})`,
            `rgba(227, 89, 51, ${opacity})`,
            `rgba(249, 140, 10, ${opacity})`,
            `rgba(252, 201, 38, ${opacity})`,
            `rgba(252, 255, 164, ${opacity})`,
          ];
        case "magma":
          return [
            `rgba(0, 0, 4, ${opacity})`,
            `rgba(28, 16, 68, ${opacity})`,
            `rgba(79, 18, 123, ${opacity})`,
            `rgba(129, 37, 129, ${opacity})`,
            `rgba(181, 54, 122, ${opacity})`,
            `rgba(229, 80, 100, ${opacity})`,
            `rgba(251, 135, 97, ${opacity})`,
            `rgba(254, 194, 135, ${opacity})`,
            `rgba(252, 253, 191, ${opacity})`,
          ];
        case "bluered":
          return [
            `rgba(0, 0, 255, ${opacity})`,
            `rgba(64, 64, 255, ${opacity})`,
            `rgba(128, 128, 255, ${opacity})`,
            `rgba(192, 192, 255, ${opacity})`,
            `rgba(255, 192, 192, ${opacity})`,
            `rgba(255, 128, 128, ${opacity})`,
            `rgba(255, 64, 64, ${opacity})`,
            `rgba(255, 0, 0, ${opacity})`,
          ];
        default:
          return [
            `rgba(68, 1, 84, ${opacity})`,
            `rgba(72, 35, 116, ${opacity})`,
            `rgba(64, 67, 135, ${opacity})`,
            `rgba(52, 94, 141, ${opacity})`,
            `rgba(41, 121, 135, ${opacity})`,
            `rgba(31, 146, 120, ${opacity})`,
            `rgba(53, 173, 96, ${opacity})`,
            `rgba(109, 199, 63, ${opacity})`,
            `rgba(180, 222, 44, ${opacity})`,
            `rgba(253, 231, 37, ${opacity})`,
          ];
      }
    };

    const colorStops = getColorStops(colorScheme);
    const gradientStops = colorStops
      .map(
        (color, index) =>
          `${color} ${(index / (colorStops.length - 1)) * 100}%`,
      )
      .join(", ");

    return {
      background: `linear-gradient(to right, ${gradientStops})`,
    };
  }, [colorScheme, opacity]);

  // Calcular estadísticas cuando cambian los datos
  useEffect(() => {
    console.log("RealTimePage - sensorData actualizado:", {
      count: sensorData.length,
      data: sensorData.map((s) => ({
        micro_id: s.micro_id,
        latitude: s.latitude,
        longitude: s.longitude,
        value: s.value,
      })),
    });

    if (sensorData.length > 0) {
      const values = sensorData.map((s) => s.value);
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      const max = Math.max(...values);
      const min = Math.min(...values);
      const critical = values.filter((v) => v >= 85).length;

      setStats({
        avgNoise: avg,
        maxNoise: max,
        minNoise: min,
        criticalSensors: critical,
      });
    }
  }, [sensorData]);

  const formatTime = (timestamp) => {
    if (!timestamp) return "--:--:--";
    const date = new Date(timestamp);
    return date.toLocaleTimeString("es-ES", { hour12: false });
  };

  const getNoiseLevelColor = (value) => {
    if (value >= 85) return "text-red-600 bg-red-50 border-red-200";
    if (value >= 70) return "text-orange-600 bg-orange-50 border-orange-200";
    if (value >= 50) return "text-yellow-600 bg-yellow-50 border-yellow-200";
    return "text-green-600 bg-green-50 border-green-200";
  };

  const getNoiseLevelLabel = (value) => {
    if (value >= 85) return "Crítico";
    if (value >= 70) return "Alto";
    if (value >= 50) return "Moderado";
    return "Bajo";
  };

  return (
    <div className="space-y-6">
      {/* Advertencia si no hay conexión WebSocket */}
      {!connected && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-yellow-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                <strong>Modo demostración:</strong> Usando datos de prueba. Las
                coordenadas pueden no coincidir con la configuración actual.
                {sensorData.length > 0 && (
                  <span className="block mt-1">
                    E4 posición Y:{" "}
                    {sensorData.find((s) => s.micro_id === "E4")?.latitude ||
                      "N/A"}
                    m (configuración: 12m)
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Encabezado y estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <Activity className="h-5 w-5 text-accent-500" />
              <h3 className="font-semibold">Nivel Promedio</h3>
            </div>
            <span
              className={`px-2 py-1 text-xs font-medium rounded-lg ${getNoiseLevelColor(stats.avgNoise)}`}
            >
              {getNoiseLevelLabel(stats.avgNoise)}
            </span>
          </div>
          <div className="text-3xl font-bold mb-1">
            {stats.avgNoise.toFixed(1)} dB
          </div>
          <div className="text-sm text-primary-600">
            {sensorCount} sensores activos
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-orange-500" />
              <h3 className="font-semibold">Nivel Máximo</h3>
            </div>
            <span
              className={`px-2 py-1 text-xs font-medium rounded-lg ${getNoiseLevelColor(stats.maxNoise)}`}
            >
              {getNoiseLevelLabel(stats.maxNoise)}
            </span>
          </div>
          <div className="text-3xl font-bold mb-1">
            {stats.maxNoise.toFixed(1)} dB
          </div>
          <div className="text-sm text-primary-600">
            Punto más ruidoso detectado
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <h3 className="font-semibold">Sensores Críticos</h3>
            </div>
            <span className="px-2 py-1 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg">
              {stats.criticalSensors} críticos
            </span>
          </div>
          <div className="text-3xl font-bold mb-1">{stats.criticalSensors}</div>
          <div className="text-sm text-primary-600">
            &gt; 85 dB (límite recomendado)
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <Clock className="h-5 w-5 text-primary-600" />
              <h3 className="font-semibold">Última Actualización</h3>
            </div>
            <span
              className={`px-2 py-1 text-xs font-medium rounded-lg ${
                connected
                  ? "text-green-600 bg-green-50 border-green-200"
                  : "text-red-600 bg-red-50 border-red-200"
              }`}
            >
              {connected ? "En vivo" : "Desconectado"}
            </span>
          </div>
          <div className="text-3xl font-bold mb-1">
            {formatTime(lastUpdate)}
          </div>
          <div className="text-sm text-primary-600">
            Actualización cada 5 segundos
          </div>
        </div>
      </div>

      {/* Mapa y Controles */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Mapa - ocupa 2/3 del espacio */}
        <div className="lg:col-span-2">
          <div className="card p-0 overflow-hidden h-full">
            <div className="p-3 border-b border-primary-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div
                    className={`w-3 h-3 rounded-full ${connected ? "bg-green-500 animate-pulse" : "bg-red-500"}`}
                  ></div>
                  <h2 className="text-lg font-bold">Mapa en Tiempo Real</h2>
                </div>
                <div className="flex items-center space-x-3 text-xs">
                  <span className="text-primary-600">
                    {sensorData.length} sensores • 5m × 14m
                  </span>
                </div>
              </div>
            </div>

            <div className="h-[500px]">
              {connected ? (
                <FloorPlanMap
                  sensorData={sensorData}
                  idwData={showHeatmap ? idwData : null}
                  epicenter={showEpicenter ? epicenter : null}
                  showHeatmap={showHeatmap}
                  showEpicenter={showEpicenter}
                  showGrid={showGrid}
                  colorScheme={colorScheme}
                  opacity={opacity}
                  idwPower={idwPower}
                  key={`floorplan-${showEpicenter}-${showHeatmap}`}
                />
              ) : (
                <div className="h-full flex flex-col items-center justify-center space-y-4">
                  <div className="w-16 h-16 border-4 border-primary-200 border-t-accent-500 rounded-full animate-spin"></div>
                  <div className="text-center">
                    <h3 className="text-lg font-semibold text-primary-900 mb-1">
                      Conectando al servidor...
                    </h3>
                    <p className="text-primary-600">
                      Estableciendo conexión WebSocket con el backend
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Controles de Visualización - ocupa 1/3 del espacio */}
        <div className="lg:col-span-1">
          <div className="card h-full">
            <h3 className="font-semibold text-lg mb-4">
              Controles de Visualización
            </h3>
            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
              {/* Controles principales */}
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-primary-50 rounded-lg">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showHeatmap}
                      onChange={(e) => setShowHeatmap(e.target.checked)}
                      className="rounded text-accent-500"
                    />
                    <span className="text-sm font-medium">Mapa de Calor</span>
                    <span className="text-xs text-primary-500 ml-1">
                      {idwData ? "✓ Datos" : "✗ Sin datos"}
                    </span>
                  </label>
                  <div className="flex items-center space-x-1">
                    <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                    <div className="w-3 h-3 rounded-full bg-cyan-500"></div>
                    <div className="w-3 h-3 rounded-full bg-lime-500"></div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 bg-primary-50 rounded-lg">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showEpicenter}
                      onChange={(e) => {
                        console.log(
                          "Epicentro checkbox cambiado:",
                          e.target.checked,
                        );
                        setShowEpicenter(e.target.checked);
                      }}
                      className="rounded text-accent-500"
                    />
                    <span className="text-sm font-medium">Epicentro</span>
                  </label>
                  <div className="w-4 h-4 rounded-full bg-red-500 animate-pulse"></div>
                </div>

                <div className="flex items-center justify-between p-3 bg-primary-50 rounded-lg">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showGrid}
                      onChange={(e) => setShowGrid(e.target.checked)}
                      className="rounded text-accent-500"
                    />
                    <span className="text-sm font-medium">Cuadrícula</span>
                  </label>
                  <div className="w-4 h-4 text-primary-600">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="3" y="3" width="7" height="7"></rect>
                      <rect x="14" y="3" width="7" height="7"></rect>
                      <rect x="3" y="14" width="7" height="7"></rect>
                      <rect x="14" y="14" width="7" height="7"></rect>
                    </svg>
                  </div>
                </div>
              </div>

              {/* Información del plano */}
              <div className="p-3 bg-primary-50 rounded-lg">
                <div className="text-sm font-medium mb-2">
                  Información del Plano
                </div>
                <div className="space-y-1 text-xs text-primary-600">
                  <div className="flex justify-between">
                    <span>Dimensiones:</span>
                    <span className="font-medium">5m × 14m</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Cuadrícula:</span>
                    <span className="font-medium">1m × 1m</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Sensores activos:</span>
                    <span className="font-medium">{sensorData.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Escala:</span>
                    <span className="font-medium">40.4 px/m</span>
                  </div>
                </div>
              </div>

              {/* Leyenda de colores para sensores */}
              <div className="p-3 bg-primary-50 rounded-lg">
                <div className="text-sm font-medium mb-2">
                  Leyenda de Sensores
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

              {/* Configuración del mapa de calor (solo si está activo) */}
              {showHeatmap && idwData && (
                <div className="p-3 bg-primary-50 rounded-lg">
                  <div className="text-sm font-medium mb-2">
                    Configuración del Mapa de Calor
                  </div>
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span>Esquema de Color</span>
                        <select
                          value={colorScheme}
                          onChange={(e) => setColorScheme(e.target.value)}
                          className="text-xs bg-white border border-primary-200 rounded px-2 py-1"
                        >
                          <option value="viridis">Viridis</option>
                          <option value="plasma">Plasma</option>
                          <option value="inferno">Inferno</option>
                          <option value="magma">Magma</option>
                          <option value="bluered">Bluered</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span>Opacidad: {Math.round(opacity * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0.1"
                        max="1.0"
                        step="0.1"
                        value={opacity}
                        onChange={(e) => setOpacity(parseFloat(e.target.value))}
                        className="w-full h-2 bg-primary-200 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span>Potencia IDW: {idwPower.toFixed(1)}</span>
                      </div>
                      <input
                        type="range"
                        min="0.5"
                        max="5.0"
                        step="0.5"
                        value={idwPower}
                        onChange={(e) =>
                          setIdwPower(parseFloat(e.target.value))
                        }
                        className="w-full h-2 bg-primary-200 rounded-lg appearance-none cursor-pointer"
                      />
                      <div className="flex justify-between text-xs text-primary-500 mt-1">
                        <span>Suave</span>
                        <span>Pronunciado</span>
                      </div>
                    </div>

                    {/* Leyenda de colores del heatmap */}
                    <div className="pt-2">
                      <div className="flex justify-between text-xs mb-1">
                        <span>Bajo</span>
                        <span>Alto</span>
                      </div>
                      <div className="w-full h-3 rounded-lg overflow-hidden">
                        <div
                          className="w-full h-full"
                          style={heatmapGradientStyle}
                        ></div>
                      </div>
                      <div className="text-xs text-primary-600 text-center mt-1">
                        Escala{" "}
                        {colorScheme.charAt(0).toUpperCase() +
                          colorScheme.slice(1)}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Lista de sensores */}
      <div className="card">
        <h3 className="font-semibold text-lg mb-4">Sensores Activos</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-primary-200">
                <th className="text-left py-3 px-4 text-sm font-medium text-primary-600">
                  Micro ID
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-primary-600">
                  Ubicación
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-primary-600">
                  Nivel de Ruido
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-primary-600">
                  Estado
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-primary-600">
                  Última Actualización
                </th>
              </tr>
            </thead>
            <tbody>
              {sensorData.map((sensor) => (
                <tr
                  key={sensor.micro_id}
                  className="border-b border-primary-100 hover:bg-primary-50"
                >
                  <td className="py-3 px-4">
                    <div className="font-medium">{sensor.micro_id}</div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="text-sm">{sensor.location_name}</div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center space-x-2">
                      <div
                        className={`w-3 h-3 rounded-full ${
                          sensor.value >= 85
                            ? "bg-red-500"
                            : sensor.value >= 70
                              ? "bg-orange-500"
                              : sensor.value >= 50
                                ? "bg-yellow-500"
                                : "bg-green-500"
                        }`}
                      ></div>
                      <span
                        className={`font-bold ${
                          sensor.value >= 85
                            ? "text-red-600"
                            : sensor.value >= 70
                              ? "text-orange-600"
                              : sensor.value >= 50
                                ? "text-yellow-600"
                                : "text-green-600"
                        }`}
                      >
                        {sensor.value.toFixed(1)} dB
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-lg ${
                        sensor.value >= 85
                          ? "text-red-600 bg-red-50 border border-red-200"
                          : sensor.value >= 70
                            ? "text-orange-600 bg-orange-50 border border-orange-200"
                            : sensor.value >= 50
                              ? "text-yellow-600 bg-yellow-50 border border-yellow-200"
                              : "text-green-600 bg-green-50 border border-green-200"
                      }`}
                    >
                      {getNoiseLevelLabel(sensor.value)}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="text-sm text-primary-600">
                      {new Date(sensor.last_update).toLocaleTimeString("es-ES")}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default RealTimePage;
