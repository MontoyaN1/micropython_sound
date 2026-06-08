import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

export const fetchSensors = async () => {
  try {
    const response = await api.get("/sensores");
    return response.data;
  } catch (error) {
    console.error("Error fetching sensors:", error);
    throw error;
  }
};

export const fetchHistoricalData = async (params) => {
  try {
    const response = await api.post("/historicos", params);
    return response.data;
  } catch (error) {
    console.error("Error fetching historical data:", error);
    throw error;
  }
};

export const fetchDateRangeData = async (
  startDate,
  endDate,
  microIds = [],
  aggWindow = null,
) => {
  try {
    // Si no se especifica aggWindow, calcular automáticamente basado en el rango
    let aggregation_window = aggWindow;
    if (!aggregation_window) {
      const rangeHours = (endDate - startDate) / (1000 * 60 * 60);
      if (rangeHours <= 24) {
        aggregation_window = "1m"; // Para 1 día o menos: 1 minuto
      } else if (rangeHours <= 168) {
        aggregation_window = "1m"; // Para 7 días o menos: 1 minuto
      } else if (rangeHours <= 720) {
        aggregation_window = "1m"; // Para 30 días o menos: 1 minuto
      } else {
        aggregation_window = "1m"; // Para rangos mayores: 1 minuto
      }
    }

    const params = {
      start_time: startDate.toISOString(),
      end_time: endDate.toISOString(),
      micro_ids: microIds,
      aggregation_window: aggregation_window,
    };
    console.log(
      `fetchDateRangeData: aggWindow=${aggregation_window}, rangeHours=${((endDate - startDate) / (1000 * 60 * 60)).toFixed(1)}`,
    );
    const response = await api.post("/historicos", params);
    return response.data;
  } catch (error) {
    console.error("Error fetching date range data:", error);
    throw error;
  }
};

export const fetchRecentData = async (hours = 5) => {
  try {
    const response = await api.get(`/historicos/recientes?hours=${hours}`);
    return response.data;
  } catch (error) {
    console.error("Error fetching recent data:", error);
    throw error;
  }
};

export const fetchSensorRawData = async (microId, startDate, endDate) => {
  try {
    const params = {
      start_time: startDate.toISOString(),
      end_time: endDate.toISOString(),
    };
    const response = await api.post(`/estadisticas/${microId}/raw`, params);
    return response.data;
  } catch (error) {
    console.error("Error fetching sensor raw data:", error);
    throw error;
  }
};

export const fetchSensorStatistics = async (microId, options = {}) => {
  try {
    // Si hay start_time y end_time, usar POST con body
    if (options.start_time && options.end_time) {
      const params = {
        start_time: options.start_time,
        end_time: options.end_time,
        aggregation_window: options.aggregation_window || "1m",
      };
      const response = await api.post(`/estadisticas/${microId}`, params);
      return response.data;
    }
    // Si solo hay hours, usar GET con query param
    const hours = options.hours || 24;
    const response = await api.get(`/estadisticas/${microId}?hours=${hours}`);
    return response.data;
  } catch (error) {
    console.error("Error fetching sensor statistics:", error);
    throw error;
  }
};

export const fetchHealth = async () => {
  try {
    const response = await api.get("/health");
    return response.data;
  } catch (error) {
    console.error("Error fetching health:", error);
    throw error;
  }
};

export default api;
