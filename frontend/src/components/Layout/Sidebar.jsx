import { NavLink } from 'react-router-dom'
import { Map, History } from 'lucide-react'

const Sidebar = () => {
  const navItems = [
    { path: '/', icon: Map, label: 'Mapa en Tiempo Real' },
    { path: '/historico', icon: History, label: 'Datos Históricos' },
  ]
  
  return (
    <aside className="w-64 border-r border-primary-200 bg-white p-4">
      <nav className="space-y-2">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center space-x-3 px-4 py-3 rounded-xl transition-colors ${
                isActive
                  ? 'bg-accent-500 text-white'
                  : 'text-primary-700 hover:bg-primary-100'
              }`
            }
          >
            <item.icon className="h-5 w-5" />
            <span className="font-medium">{item.label}</span>
          </NavLink>
        ))}
      </nav>
      
      <div className="mt-8 p-4 bg-primary-50 rounded-xl border border-primary-200">
        <h3 className="font-semibold text-primary-900 mb-2">Estado del Sistema</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-primary-600">Backend</span>
            <span className="font-medium text-green-600">Online</span>
          </div>
          <div className="flex justify-between">
            <span className="text-primary-600">MQTT</span>
            <span className="font-medium text-green-600">Conectado</span>
          </div>
          <div className="flex justify-between">
            <span className="text-primary-600">InfluxDB</span>
            <span className="font-medium text-green-600">Activo</span>
          </div>
          <div className="flex justify-between">
            <span className="text-primary-600">Cache</span>
            <span className="font-medium text-green-600">Operativo</span>
          </div>
        </div>
      </div>
      
      <div className="mt-6 p-4 bg-gradient-to-r from-accent-500 to-accent-600 rounded-xl text-white">
        <h3 className="font-semibold mb-2">Actualización Automática</h3>
        <p className="text-sm opacity-90">
          Los datos se actualizan cada 5 segundos mediante WebSocket
        </p>
        <div className="mt-3 flex items-center space-x-2">
          <div className="h-2 flex-1 bg-white/30 rounded-full overflow-hidden">
            <div className="h-full bg-white w-3/4 animate-pulse"></div>
          </div>
          <span className="text-xs font-medium">En vivo</span>
        </div>
      </div>
    </aside>
  )
}

export default Sidebar