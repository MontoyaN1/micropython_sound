import { Activity, Wifi, Battery, Clock, Satellite } from 'lucide-react'
import { useWebSocket } from '../../hooks/useWebSocket'

const Header = () => {
  const { connected, sensorCount, lastUpdate } = useWebSocket()
  
  const formatTime = (timestamp) => {
    if (!timestamp) return '--:--:--'
    const date = new Date(timestamp)
    return date.toLocaleTimeString('es-ES', { hour12: false })
  }
  
  return (
    <header className="bg-white border-b border-primary-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Activity className="h-8 w-8 text-accent-500" />
            <div>
              <h1 className="text-2xl font-bold text-primary-900">Monitoreo Acústico</h1>
              <p className="text-sm text-primary-600">Visualización en tiempo real de sensores de ruido</p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2">
            <Wifi className={`h-5 w-5 ${connected ? 'text-green-500' : 'text-red-500'}`} />
            <span className="text-sm font-medium">
              {connected ? 'Conectado' : 'Desconectado'}
            </span>
          </div>
          
          <div className="flex items-center space-x-2">
            <Battery className="h-5 w-5 text-primary-600" />
            <span className="text-sm font-medium">
              {sensorCount} sensores
            </span>
          </div>
          
          <div className="flex items-center space-x-2">
            <Clock className="h-5 w-5 text-primary-600" />
            <span className="text-sm font-medium">
              {formatTime(lastUpdate)}
            </span>
          </div>
          
          <div className="flex items-center space-x-2" title="Tópico MQTT">
            <Satellite className="h-5 w-5 text-blue-500" />
            <span className="text-sm font-medium bg-blue-50 text-blue-700 px-2 py-1 rounded">
              sensors/espnow/grouped_data
            </span>
          </div>
          
          <div className="px-4 py-2 bg-accent-500 text-white rounded-xl font-medium">
            Tiempo Real
          </div>
        </div>
      </div>
    </header>
  )
}

export default Header