import { useState, useEffect } from "react";
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

  const [stats, setStats] = useState({
    avgNoise: 0,
    maxNoise: 0,
    minNoise: 0,
    criticalSensors: 0,
  });

  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showEpicenter, setShowEpicenter] = useState(true);

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

      {/* Mapa */}
      <div className="card p-0 overflow-hidden">
        <div className="p-4 border-b border-primary-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div
                className={`w-3 h-3 rounded-full ${connected ? "bg-green-500 animate-pulse" : "bg-red-500"}`}
              ></div>
              <h2 className="text-xl font-bold">Mapa en Tiempo Real</h2>
            </div>
            <div className="flex items-center space-x-4 text-sm">
              <span className="text-primary-600">
                {sensorData.length} sensores • 5m × 14m
              </span>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                <span>Mapa de calor</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                <span>Epicentro</span>
              </div>
            </div>
          </div>
        </div>

        <div className="h-[600px]">
          {connected ? (
            <FloorPlanMap
              sensorData={sensorData}
              idwData={showHeatmap ? idwData : null}
              epicenter={showEpicenter ? epicenter : null}
              showHeatmap={showHeatmap}
              showEpicenter={showEpicenter}
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
