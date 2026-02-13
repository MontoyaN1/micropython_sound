import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

export const fetchSensors = async () => {
  try {
    const response = await api.get('/api/sensores')
    return response.data
  } catch (error) {
    console.error('Error fetching sensors:', error)
    throw error
  }
}

export const fetchHistoricalData = async (params) => {
  try {
    const response = await api.post('/api/historicos', params)
    return response.data
  } catch (error) {
    console.error('Error fetching historical data:', error)
    throw error
  }
}

export const fetchDateRangeData = async (startDate, endDate, microIds = []) => {
  try {
    const params = {
      start_time: startDate.toISOString(),
      end_time: endDate.toISOString(),
      micro_ids: microIds,
      aggregation_window: '1h'
    }
    const response = await api.post('/api/historicos', params)
    return response.data
  } catch (error) {
    console.error('Error fetching date range data:', error)
    throw error
  }
}

export const fetchRecentData = async (hours = 5) => {
  try {
    const response = await api.get(`/api/historicos/recientes?hours=${hours}`)
    return response.data
  } catch (error) {
    console.error('Error fetching recent data:', error)
    throw error
  }
}

export const fetchSensorStatistics = async (microId, hours = 24) => {
  try {
    const response = await api.get(`/api/estadisticas/${microId}/0?hours=${hours}`)
    return response.data
  } catch (error) {
    console.error('Error fetching sensor statistics:', error)
    throw error
  }
}

export const fetchHealth = async () => {
  try {
    const response = await api.get('/health')
    return response.data
  } catch (error) {
    console.error('Error fetching health:', error)
    throw error
  }
}

export default api