import { useState, useEffect, useMemo } from "react";
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
  const [dateMode, setDateMode] = useState("range"); // 'range' o 'specific' o 'custom'
  const [specificDate, setSpecificDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split("T")[0]; // Formato YYYY-MM-DD
  });
  // Custom date range state
  const [customStartDate, setCustomStartDate] = useState(() => {
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);
    return thirtyDaysAgo.toISOString().split("T")[0];
  });
  const [customEndDate, setCustomEndDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });

  const loadHistoricalData = async () => {
    setLoading(true);
    try {
      if (dateMode === "range") {
        const hoursMap = {
          "1h": 1,
          "5h": 5,
          "24h": 24,
          "7d": 168,
          "30d": 720,
        };

        // Para 30 días, usar rango de fechas explícito para mejor control
        if (timeRange === "30d") {
          const endDate = new Date();
          const startDate = new Date(
            endDate.getTime() - 30 * 24 * 60 * 60 * 1000,
          );
          // No pasar aggWindow para que se calcule automáticamente
          const data = await fetchDateRangeData(startDate, endDate, []);
          setHistoricalData(data);
        } else {
          const data = await fetchRecentData(hoursMap[timeRange]);
          setHistoricalData(data);
        }
      } else if (dateMode === "specific") {
        // Modo fecha específica - usar rango exacto de fechas
        const [year, month, day] = specificDate.split("-").map(Number);
        // Crear fechas en UTC para evitar problemas de timezone
        const startOfDay = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
        const endOfDay = new Date(
          Date.UTC(year, month - 1, day, 23, 59, 59, 999),
        );

        console.log(
          `Consultando rango específico: ${startOfDay.toISOString()} a ${endOfDay.toISOString()}`,
        );

        const data = await fetchDateRangeData(startOfDay, endOfDay, []);
        setHistoricalData(data || []);
      } else if (dateMode === "custom") {
        // Modo rango custom - usar fechas específicas
        const [startYear, startMonth, startDay] = customStartDate
          .split("-")
          .map(Number);
        const [endYear, endMonth, endDay] = customEndDate
          .split("-")
          .map(Number);

        // Crear fechas en UTC para evitar problemas de timezone
        const startDateTime = new Date(
          Date.UTC(startYear, startMonth - 1, startDay, 0, 0, 0, 0),
        );
        const endDateTime = new Date(
          Date.UTC(endYear, endMonth - 1, endDay, 23, 59, 59, 999),
        );

        console.log(
          `Consultando rango custom: ${startDateTime.toISOString()} a ${endDateTime.toISOString()}`,
        );

        const data = await fetchDateRangeData(startDateTime, endDateTime, []);
        setHistoricalData(data || []);
      }
    } catch (error) {
      console.error("Error loading historical data:", error);
      setHistoricalData([]);
    } finally {
      setLoading(false);
    }
  };

  const loadSensorStatistics = async (microId) => {
    try {
      let options = { hours: 24 }; // Por defecto 24 horas

      if (dateMode === "range") {
        const hoursMap = {
          "1h": 1,
          "5h": 5,
          "24h": 24,
          "7d": 168,
          "30d": 720,
        };
        options = { hours: hoursMap[timeRange] };
      } else if (dateMode === "specific") {
        // Para modo specific, usar el rango exacto de fecha
        const [year, month, day] = specificDate.split("-").map(Number);
        // Crear fechas en UTC para evitar problemas de timezone
        const startOfDay = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
        const endOfDay = new Date(
          Date.UTC(year, month - 1, day, 23, 59, 59, 999),
        );

        options = {
          start_time: startOfDay.toISOString(),
          end_time: endOfDay.toISOString(),
          aggregation_window: "5m", // Más resolución para un día
        };
      } else if (dateMode === "custom") {
        // Para modo custom, usar las fechas exactas
        const [startYear, startMonth, startDay] = customStartDate
          .split("-")
          .map(Number);
        const [endYear, endMonth, endDay] = customEndDate
          .split("-")
          .map(Number);

        // Crear fechas en UTC para evitar problemas de timezone
        const startDateTime = new Date(
          Date.UTC(startYear, startMonth - 1, startDay, 0, 0, 0, 0),
        );
        const endDateTime = new Date(
          Date.UTC(endYear, endMonth - 1, endDay, 23, 59, 59, 999),
        );

        // Calcular duración para determinar aggregation_window adecuada
        const durationHours = Math.ceil(
          (endDateTime - startDateTime) / (1000 * 60 * 60),
        );
        let aggWindow = "5m";
        if (durationHours > 168) aggWindow = "1h"; // > 7 días
        if (durationHours > 720) aggWindow = "6h"; // > 30 días

        options = {
          start_time: startDateTime.toISOString(),
          end_time: endDateTime.toISOString(),
          aggregation_window: aggWindow,
        };
      }

      const stats = await fetchSensorStatistics(microId, options);
      setSensorStats(stats);
    } catch (error) {
      console.error("Error loading sensor statistics:", error);
      setSensorStats({
        micro_id: microId,
        count: 0,
        mean: 0,
        min: 0,
        max: 0,
        std: 0,
        data_points: [],
      });
    }
  };

  // Debounce helper to prevent rapid-fire requests
  const debounce = (func, wait) => {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  };

  // Create debounced version of loadHistoricalData
  const debouncedLoadHistoricalData = useMemo(
    () => debounce(loadHistoricalData, 500),
    [loadHistoricalData],
  );

  // Use debounced version in effect
  useEffect(() => {
    debouncedLoadHistoricalData();
  }, [timeRange, dateMode, specificDate, customStartDate, customEndDate]);

  useEffect(() => {
    if (selectedSensor) {
      loadSensorStatistics(selectedSensor);
    }
  }, [selectedSensor, historicalData]);

  const handleExportData = () => {
    const filteredData = historicalData.filter(
      (row) => row.micro_id === selectedSensor,
    );
    let periodLabel = "";

    if (dateMode === "range") {
      periodLabel = timeRange;
    } else if (dateMode === "specific") {
      periodLabel = specificDate;
    } else if (dateMode === "custom") {
      periodLabel = `${customStartDate}_to_${customEndDate}`;
    }

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
    return labels[timeRange] || timeRange;
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
            <div className="flex space-x-2 mb-3 sm:mb-4">
              <button
                onClick={() => setDateMode("range")}
                className={`px-3 py-1.5 sm:px-4 sm:py-2 text-sm sm:text-base rounded-lg transition-colors ${
                  dateMode === "range"
                    ? "bg-accent-500 text-white"
                    : "bg-primary-100 text-primary-700 hover:bg-primary-200"
                }`}
              >
                Rango Predefinido
              </button>
              <button
                onClick={() => setDateMode("specific")}
                className={`px-3 py-1.5 sm:px-4 sm:py-2 text-sm sm:text-base rounded-lg transition-colors ${
                  dateMode === "specific"
                    ? "bg-accent-500 text-white"
                    : "bg-primary-100 text-primary-700 hover:bg-primary-200"
                }`}
              >
                Fecha Específica
              </button>
              <button
                onClick={() => setDateMode("custom")}
                className={`px-3 py-1.5 sm:px-4 sm:py-2 text-sm sm:text-base rounded-lg transition-colors ${
                  dateMode === "custom"
                    ? "bg-accent-500 text-white"
                    : "bg-primary-100 text-primary-700 hover:bg-primary-200"
                }`}
              >
                Rango Custom
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            {/* Rango de tiempo (solo visible en modo range) */}
            {dateMode === "range" && (
              <div className="space-y-2">
                <label className="flex items-center space-x-1 sm:space-x-2 text-sm font-medium">
                  <Calendar className="h-3 w-3 sm:h-4 sm:w-4 text-primary-600" />
                  <span>Rango de Tiempo</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 sm:gap-2">
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
                      className={`px-2 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm rounded-lg transition-colors ${
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
                <label className="flex items-center space-x-1 sm:space-x-2 text-sm font-medium">
                  <Calendar className="h-3 w-3 sm:h-4 sm:w-4 text-primary-600" />
                  <span>Seleccionar Fecha</span>
                </label>
                <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-2">
                  <input
                    type="date"
                    value={specificDate}
                    onChange={(e) => setSpecificDate(e.target.value)}
                    className="px-2 py-1.5 sm:px-3 sm:py-2 border border-primary-300 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent text-sm sm:text-base"
                  />
                  <button
                    onClick={() => {
                      const today = new Date();
                      setSpecificDate(today.toISOString().split("T")[0]);
                    }}
                    className="px-2 py-1.5 sm:px-3 sm:py-2 bg-primary-100 text-primary-700 rounded-lg hover:bg-primary-200 transition-colors text-xs sm:text-sm"
                  >
                    Hoy
                  </button>
                </div>
                <div className="text-xs text-primary-500 mt-1">
                  Se mostrarán datos del día completo seleccionado
                </div>
              </div>
            )}

            {/* Rango custom (solo visible en modo custom) */}
            {dateMode === "custom" && (
              <div className="space-y-2">
                <label className="flex items-center space-x-1 sm:space-x-2 text-sm font-medium">
                  <CalendarDays className="h-3 w-3 sm:h-4 sm:w-4 text-primary-600" />
                  <span>Rango de Fechas</span>
                </label>
                <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-2">
                  <div className="flex flex-col">
                    <span className="text-xs text-primary-500 mb-1">Desde</span>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="px-2 py-1.5 sm:px-3 sm:py-2 border border-primary-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent text-sm sm:text-base"
                    />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs text-primary-500 mb-1">Hasta</span>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="px-2 py-1.5 sm:px-3 sm:py-2 border border-primary-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent text-sm sm:text-base"
                    />
                  </div>
                </div>
                <div className="text-xs text-primary-500 mt-1">
                  Selecciona un rango de fechas específico para consultar
                </div>
              </div>
            )}

            {/* Selector de sensor (siempre visible) */}
            <div className="space-y-2">
              <label className="flex items-center space-x-1 sm:space-x-2 text-sm font-medium">
                <Filter className="h-3 w-3 sm:h-4 sm:w-4 text-primary-600" />
                <span>Sensor para Estadísticas</span>
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-3 gap-1.5 sm:gap-2">
                {[
                  { id: "E1", name: "E1" },
                  { id: "E2", name: "E2" },
                  { id: "E3", name: "E3" },
                  { id: "E4", name: "E4" },
                  { id: "E5", name: "E5" },
                  { id: "E6", name: "E6" },
                  { id: "E7", name: "E7" },
                  { id: "E8", name: "E8" },
                  { id: "E9", name: "E9" },
                ].map((micro) => (
                  <button
                    key={micro.id}
                    onClick={() => setSelectedSensor(micro.id)}
                    className={`px-2 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm rounded-lg transition-colors ${
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
        <div className="card">
          <div className="flex items-center space-x-1 sm:space-x-2 mb-2 sm:mb-3">
            <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-accent-500" />
            <h3 className="font-semibold text-sm sm:text-base">Período</h3>
          </div>
          <div className="text-xl sm:text-2xl font-bold mb-1">
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
          <div className="text-xs sm:text-sm text-primary-600">
            {dateMode === "range" ? "Rango predefinido" : "Fecha específica"}
          </div>
        </div>

        <div className="card">
          <div className="flex items-center space-x-1 sm:space-x-2 mb-2 sm:mb-3">
            <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5 text-accent-500" />
            <h3 className="font-semibold text-sm sm:text-base">
              Sensor Seleccionado
            </h3>
          </div>
          <div className="text-xl sm:text-2xl font-bold mb-1">
            {selectedSensor}
          </div>
          <div className="text-xs sm:text-sm text-primary-600">
            Estadísticas detalladas
          </div>
        </div>

        <div className="card">
          <div className="flex items-center space-x-1 sm:space-x-2 mb-2 sm:mb-3">
            <Filter className="h-4 w-4 sm:h-5 sm:w-5 text-accent-500" />
            <h3 className="font-semibold text-sm sm:text-base">
              Datos del Sensor
            </h3>
          </div>
          <div className="text-xl sm:text-2xl font-bold mb-1">
            {historicalData.filter((d) => d.micro_id === selectedSensor).length}
          </div>
          <div className="text-xs sm:text-sm text-primary-600">
            Registros del {selectedSensor} en el período
          </div>
        </div>
      </div>

      {/* Estadísticas del sensor seleccionado */}
      <div className="card">
        <h3 className="font-semibold text-base sm:text-lg mb-3 sm:mb-4">
          Estadísticas del Sensor {selectedSensor}
        </h3>
        {sensorStats && sensorStats.count > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
            <div className="bg-primary-50 rounded-xl p-3 sm:p-4">
              <div className="text-xs sm:text-sm text-primary-600 mb-1">
                Promedio
              </div>
              <div className="text-xl sm:text-2xl font-bold">
                {sensorStats.mean?.toFixed(1) || "0.0"} dB
              </div>
            </div>
            <div className="bg-primary-50 rounded-xl p-3 sm:p-4">
              <div className="text-xs sm:text-sm text-primary-600 mb-1">
                Máximo
              </div>
              <div className="text-xl sm:text-2xl font-bold">
                {sensorStats.max?.toFixed(1) || "0.0"} dB
              </div>
            </div>
            <div className="bg-primary-50 rounded-xl p-3 sm:p-4">
              <div className="text-xs sm:text-sm text-primary-600 mb-1">
                Mínimo
              </div>
              <div className="text-xl sm:text-2xl font-bold">
                {sensorStats.min?.toFixed(1) || "0.0"} dB
              </div>
            </div>
            <div className="bg-primary-50 rounded-xl p-3 sm:p-4">
              <div className="text-xs sm:text-sm text-primary-600 mb-1">
                Registros
              </div>
              <div className="text-xl sm:text-2xl font-bold">
                {sensorStats.count || 0}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-6 sm:py-8 text-primary-500">
            No hay datos para el sensor {selectedSensor} en el período
            seleccionado
          </div>
        )}
      </div>

      {/* Tabla de datos */}
      <div className="card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 sm:mb-4 gap-2 sm:gap-0">
          <h3 className="font-semibold text-base sm:text-lg">
            Datos Históricos
          </h3>
          <div className="flex items-center space-x-2 text-xs sm:text-sm text-primary-600">
            <Clock className="h-4 w-4" />
            <span>
              Actualizado:{" "}
              {(() => {
                const date = new Date();
                date.setHours(date.getHours() - 5);
                return date.toLocaleTimeString("es-CO", {
                  timeZone: "America/Bogota",
                  hour12: false,
                });
              })()}
            </span>
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
        ) : historicalData.filter((row) => row.micro_id === selectedSensor)
            .length === 0 ? (
          <div className="text-center py-12 text-primary-600">
            No hay datos para el sensor {selectedSensor} en el período
            seleccionado
          </div>
        ) : (
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="w-full min-w-[640px] sm:min-w-0">
              <thead>
                <tr className="border-b border-primary-200">
                  <th className="text-left py-2 px-2 sm:py-3 sm:px-4 text-xs sm:text-sm font-medium text-primary-600">
                    Fecha y Hora
                  </th>
                  <th className="text-left py-2 px-2 sm:py-3 sm:px-4 text-xs sm:text-sm font-medium text-primary-600">
                    Micro ID
                  </th>
                  <th className="text-left py-2 px-2 sm:py-3 sm:px-4 text-xs sm:text-sm font-medium text-primary-600">
                    Ubicación
                  </th>
                  <th className="text-left py-2 px-2 sm:py-3 sm:px-4 text-xs sm:text-sm font-medium text-primary-600">
                    Nivel (dB)
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
                      <td className="py-2 px-2 sm:py-3 sm:px-4">
                        <div className="text-xs sm:text-sm">
                          {new Date(row.time).toLocaleString("es-ES")}
                        </div>
                      </td>
                      <td className="py-2 px-2 sm:py-3 sm:px-4">
                        <div className="font-medium text-xs sm:text-sm">
                          {row.micro_id}
                        </div>
                      </td>
                      <td className="py-2 px-2 sm:py-3 sm:px-4">
                        <div className="text-xs sm:text-sm">
                          {row.location_name}
                        </div>
                      </td>
                      <td className="py-2 px-2 sm:py-3 sm:px-4">
                        <div
                          className={`font-bold text-xs sm:text-sm ${
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
