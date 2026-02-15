import { useState, useEffect } from "react";
import {
  Calendar,
  BarChart3,
  Download,
  Filter,
  Clock,
  CalendarDays,
} from "lucide-react";
import {
  fetchRecentData,
  fetchSensorStatistics,
  fetchDateRangeData,
} from "../services/api";

const HistoricalPage = () => {
  const [historicalData, setHistoricalData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sensorStats, setSensorStats] = useState(null);
  const [timeRange, setTimeRange] = useState("24h");
  const [selectedSensor, setSelectedSensor] = useState("E1");
  const [dateMode, setDateMode] = useState("range"); // 'range' o 'specific'
  const [specificDate, setSpecificDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split("T")[0]; // Formato YYYY-MM-DD
  });

  const loadHistoricalData = async () => {
    setLoading(true);
    try {
      if (dateMode === "range") {
        // Modo rango predefinido
        const hoursMap = {
          "1h": 1,
          "5h": 5,
          "24h": 24,
          "7d": 168,
          "30d": 720,
        };
        const data = await fetchRecentData(hoursMap[timeRange]);
        setHistoricalData(data);
      } else {
        // Modo fecha específica - calcular horas desde la fecha seleccionada hasta ahora
        // Parsear la fecha en hora local (no UTC)
        const [year, month, day] = specificDate.split("-").map(Number);
        const selectedDate = new Date(year, month - 1, day);
        const startOfDay = new Date(selectedDate);
        startOfDay.setHours(0, 0, 0, 0);

        const now = new Date();
        const startOfToday = new Date(now);
        startOfToday.setHours(0, 0, 0, 0);

        // Calcular diferencia en horas desde el inicio del día seleccionado
        const diffMs = now - startOfDay;
        const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));

        // Si la fecha es hoy, usar 24 horas para obtener datos del día completo
        const hoursToFetch =
          startOfDay.getTime() === startOfToday.getTime()
            ? 24
            : Math.min(diffHours, 720); // Máximo 30 días (720 horas)

        console.log(
          `Consultando ${hoursToFetch} horas desde ${startOfDay.toLocaleDateString()}`,
        );
        const data = await fetchRecentData(hoursToFetch);

        // Filtrar para mostrar solo datos del día seleccionado
        // Usar comparación de fechas en UTC para evitar problemas de zona horaria
        const filteredData = data.filter((row) => {
          const rowDate = new Date(row.time);
          const rowUTCDate = new Date(
            Date.UTC(
              rowDate.getUTCFullYear(),
              rowDate.getUTCMonth(),
              rowDate.getUTCDate(),
            ),
          );
          const selectedUTCDate = new Date(
            Date.UTC(
              startOfDay.getUTCFullYear(),
              startOfDay.getUTCMonth(),
              startOfDay.getUTCDate(),
            ),
          );
          return rowUTCDate.getTime() === selectedUTCDate.getTime();
        });

        setHistoricalData(filteredData);
      }
    } catch (error) {
      console.error("Error loading historical data:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadSensorStatistics = async (microId) => {
    try {
      let hours = 24; // Por defecto 24 horas

      if (dateMode === "specific") {
        // Para fecha específica, calcular horas desde esa fecha
        const selectedDate = new Date(specificDate);
        const now = new Date();
        const diffMs = now - selectedDate;
        hours = Math.ceil(diffMs / (1000 * 60 * 60));

        // Si la fecha es hoy, usar 24 horas
        if (selectedDate.toDateString() === now.toDateString()) {
          hours = 24;
        }
      } else if (dateMode === "range") {
        // Para rango predefinido, usar el mapeo
        const hoursMap = {
          "1h": 1,
          "5h": 5,
          "24h": 24,
          "7d": 168,
          "30d": 720,
        };
        hours = hoursMap[timeRange];
      }

      const stats = await fetchSensorStatistics(microId, hours);
      setSensorStats(stats);
    } catch (error) {
      console.error("Error loading sensor statistics:", error);
    }
  };

  useEffect(() => {
    loadHistoricalData();
  }, [timeRange, dateMode, specificDate]);

  useEffect(() => {
    if (selectedSensor) {
      loadSensorStatistics(selectedSensor);
    }
  }, [selectedSensor]);

  const handleExportData = () => {
    const filteredData = historicalData.filter(
      (row) => row.micro_id === selectedSensor,
    );
    const periodLabel =
      dateMode === "range"
        ? timeRange === "1h"
          ? "1h"
          : timeRange === "5h"
            ? "5h"
            : timeRange === "24h"
              ? "24h"
              : timeRange === "7d"
                ? "7d"
                : "30d"
        : specificDate;

    const csvContent = [
      [
        "Timestamp",
        "Micro ID",
        "Ubicación",
        "Nivel de Ruido (dB)",
        "Latitud",
        "Longitud",
      ],
      ...filteredData.map((row) => [
        new Date(row.time).toLocaleString("es-ES"),
        row.micro_id,
        row.location_name,
        row.value.toFixed(2),
        row.latitude,
        row.longitude,
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `datos_${selectedSensor}_${periodLabel}_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const getTimeRangeLabel = () => {
    const labels = {
      "1h": "última hora",
      "5h": "últimas 5 horas",
      "24h": "últimas 24 horas",
      "7d": "últimos 7 días",
      "30d": "últimos 30 días",
    };
    return labels[filters.timeRange] || filters.timeRange;
  };

  const getAggregationLabel = () => {
    const labels = {
      "30s": "30 segundos",
      "1m": "1 minuto",
      "5m": "5 minutos",
      "15m": "15 minutos",
      "1h": "1 hora",
    };
    return labels[filters.aggregation] || filters.aggregation;
  };

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary-900">
            Datos Históricos
          </h1>
          <p className="text-primary-600">
            Consulta y análisis de datos almacenados en InfluxDB
          </p>
        </div>
        <button
          onClick={handleExportData}
          className="flex items-center space-x-2 px-4 py-2 bg-accent-500 text-white rounded-xl hover:bg-accent-600 transition-colors"
          disabled={historicalData.length === 0}
        >
          <Download className="h-5 w-5" />
          <span>Exportar CSV</span>
        </button>
      </div>

      {/* Controles básicos */}
      <div className="card">
        <div className="space-y-4">
          {/* Selector de modo */}
          <div className="space-y-2">
            <label className="flex items-center space-x-2 text-sm font-medium">
              <CalendarDays className="h-4 w-4 text-primary-600" />
              <span>Modo de Consulta</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setDateMode("range")}
                className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                  dateMode === "range"
                    ? "bg-accent-500 text-white"
                    : "bg-primary-100 text-primary-700 hover:bg-primary-200"
                }`}
              >
                Rango Predefinido
              </button>
              <button
                onClick={() => setDateMode("specific")}
                className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                  dateMode === "specific"
                    ? "bg-accent-500 text-white"
                    : "bg-primary-100 text-primary-700 hover:bg-primary-200"
                }`}
              >
                Fecha Específica
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Rango de tiempo (solo visible en modo range) */}
            {dateMode === "range" && (
              <div className="space-y-2">
                <label className="flex items-center space-x-2 text-sm font-medium">
                  <Calendar className="h-4 w-4 text-primary-600" />
                  <span>Rango de Tiempo</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: "1h", label: "1 hora" },
                    { value: "5h", label: "5 horas" },
                    { value: "24h", label: "24 horas" },
                    { value: "7d", label: "7 días" },
                    { value: "30d", label: "30 días" },
                  ].map((range) => (
                    <button
                      key={range.value}
                      onClick={() => setTimeRange(range.value)}
                      className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                        timeRange === range.value
                          ? "bg-accent-500 text-white"
                          : "bg-primary-100 text-primary-700 hover:bg-primary-200"
                      }`}
                    >
                      {range.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Fecha específica (solo visible en modo specific) */}
            {dateMode === "specific" && (
              <div className="space-y-2">
                <label className="flex items-center space-x-2 text-sm font-medium">
                  <Calendar className="h-4 w-4 text-primary-600" />
                  <span>Seleccionar Fecha</span>
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="date"
                    value={specificDate}
                    onChange={(e) => setSpecificDate(e.target.value)}
                    className="px-3 py-2 border border-primary-300 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent"
                  />
                  <button
                    onClick={() => {
                      const today = new Date();
                      setSpecificDate(today.toISOString().split("T")[0]);
                    }}
                    className="px-3 py-2 bg-primary-100 text-primary-700 rounded-lg hover:bg-primary-200 transition-colors text-sm"
                  >
                    Hoy
                  </button>
                </div>
                <div className="text-xs text-primary-500 mt-1">
                  Se mostrarán datos del día completo seleccionado
                </div>
              </div>
            )}

            {/* Selector de sensor (siempre visible) */}
            <div className="space-y-2">
              <label className="flex items-center space-x-2 text-sm font-medium">
                <Filter className="h-4 w-4 text-primary-600" />
                <span>Sensor para Estadísticas</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "E1", name: "E1" },
                  { id: "E2", name: "E2" },
                  { id: "E3", name: "E3" },
                  { id: "E4", name: "E4" },
                  { id: "E5", name: "E5" },
                  { id: "E255", name: "E255" },
                ].map((micro) => (
                  <button
                    key={micro.id}
                    onClick={() => setSelectedSensor(micro.id)}
                    className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                      selectedSensor === micro.id
                        ? "bg-accent-500 text-white"
                        : "bg-primary-100 text-primary-700 hover:bg-primary-200"
                    }`}
                  >
                    {micro.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <div className="flex items-center space-x-2 mb-3">
            <Calendar className="h-5 w-5 text-accent-500" />
            <h3 className="font-semibold">Período</h3>
          </div>
          <div className="text-2xl font-bold mb-1">
            {dateMode === "range"
              ? timeRange === "1h"
                ? "Última hora"
                : timeRange === "5h"
                  ? "Últimas 5 horas"
                  : timeRange === "24h"
                    ? "Últimas 24 horas"
                    : timeRange === "7d"
                      ? "Últimos 7 días"
                      : "Últimos 30 días"
              : new Date(specificDate).toLocaleDateString("es-ES", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  timeZone: "UTC",
                })}
          </div>
          <div className="text-sm text-primary-600">
            {dateMode === "range" ? "Rango predefinido" : "Fecha específica"}
          </div>
        </div>

        <div className="card">
          <div className="flex items-center space-x-2 mb-3">
            <BarChart3 className="h-5 w-5 text-accent-500" />
            <h3 className="font-semibold">Sensor Seleccionado</h3>
          </div>
          <div className="text-2xl font-bold mb-1">{selectedSensor}</div>
          <div className="text-sm text-primary-600">
            Estadísticas detalladas
          </div>
        </div>

        <div className="card">
          <div className="flex items-center space-x-2 mb-3">
            <Filter className="h-5 w-5 text-accent-500" />
            <h3 className="font-semibold">Datos del Sensor</h3>
          </div>
          <div className="text-2xl font-bold mb-1">
            {historicalData.filter((d) => d.micro_id === selectedSensor).length}
          </div>
          <div className="text-sm text-primary-600">
            Registros del {selectedSensor} en el período
          </div>
        </div>
      </div>

      {/* Estadísticas del sensor seleccionado */}
      <div className="card">
        <h3 className="font-semibold text-lg mb-4">
          Estadísticas del Sensor {selectedSensor}
        </h3>
        {sensorStats ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-primary-50 rounded-xl p-4">
              <div className="text-sm text-primary-600 mb-1">Promedio</div>
              <div className="text-2xl font-bold">
                {sensorStats.mean.toFixed(1)} dB
              </div>
            </div>
            <div className="bg-primary-50 rounded-xl p-4">
              <div className="text-sm text-primary-600 mb-1">Máximo</div>
              <div className="text-2xl font-bold">
                {sensorStats.max.toFixed(1)} dB
              </div>
            </div>
            <div className="bg-primary-50 rounded-xl p-4">
              <div className="text-sm text-primary-600 mb-1">Mínimo</div>
              <div className="text-2xl font-bold">
                {sensorStats.min.toFixed(1)} dB
              </div>
            </div>
            <div className="bg-primary-50 rounded-xl p-4">
              <div className="text-sm text-primary-600 mb-1">Registros</div>
              <div className="text-2xl font-bold">{sensorStats.count}</div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-primary-600">
            Cargando estadísticas...
          </div>
        )}
      </div>

      {/* Tabla de datos */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-lg">Datos Históricos</h3>
          <div className="flex items-center space-x-2 text-sm text-primary-600">
            <Clock className="h-4 w-4" />
            <span>Actualizado: {new Date().toLocaleTimeString("es-ES")}</span>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-primary-200 border-t-accent-500 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-primary-600">Cargando datos históricos...</p>
            </div>
          </div>
        ) : historicalData.length === 0 ? (
          <div className="text-center py-12 text-primary-600">
            No hay datos históricos disponibles para el período seleccionado
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-primary-200">
                  <th className="text-left py-3 px-4 text-sm font-medium text-primary-600">
                    Fecha y Hora
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-primary-600">
                    Micro ID
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-primary-600">
                    Ubicación
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-primary-600">
                    Nivel de Ruido (dB)
                  </th>
                </tr>
              </thead>
              <tbody>
                {historicalData
                  .filter((row) => row.micro_id === selectedSensor)
                  .sort((a, b) => new Date(b.time) - new Date(a.time))
                  .slice(0, 50)
                  .map((row, index) => (
                    <tr
                      key={index}
                      className="border-b border-primary-100 hover:bg-primary-50"
                    >
                      <td className="py-3 px-4">
                        <div className="text-sm">
                          {new Date(row.time).toLocaleString("es-ES")}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium">{row.micro_id}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-sm">{row.location_name}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div
                          className={`font-bold ${
                            row.value >= 85
                              ? "text-red-600"
                              : row.value >= 70
                                ? "text-orange-600"
                                : row.value >= 50
                                  ? "text-yellow-600"
                                  : "text-green-600"
                          }`}
                        >
                          {row.value.toFixed(1)} dB
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
            {historicalData.filter((row) => row.micro_id === selectedSensor)
              .length > 50 && (
              <div className="text-center py-4 text-primary-600 text-sm">
                Mostrando los 50 registros más recientes de{" "}
                {
                  historicalData.filter(
                    (row) => row.micro_id === selectedSensor,
                  ).length
                }{" "}
                registros del sensor {selectedSensor}.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default HistoricalPage;
