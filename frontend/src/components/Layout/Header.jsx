import { Activity, Wifi, Battery, Clock, Satellite } from "lucide-react";
import { useWebSocket } from "../../hooks/useWebSocket";

const Header = () => {
  const { connected, sensorCount, lastUpdate } = useWebSocket();

  const formatTime = (timestamp) => {
    if (!timestamp) return "--:--:--";
    const date = new Date(timestamp);
    return date.toLocaleTimeString("es-ES", { hour12: false });
  };

  return (
    <header className="bg-white border-b border-primary-200 px-4 py-3 md:px-6 md:py-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-0">
        <div className="flex items-center space-x-2 md:space-x-4">
          <div className="flex items-center space-x-2">
            <Activity className="h-6 w-6 md:h-8 md:w-8 text-accent-500" />
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-primary-900">
                Monitoreo Acústico
              </h1>
              <p className="text-xs md:text-sm text-primary-600">
                Visualización en tiempo real de sensores de ruido
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 md:gap-4 md:space-x-4">
          <div className="flex items-center space-x-1 md:space-x-2">
            <Wifi
              className={`h-4 w-4 md:h-5 md:w-5 ${connected ? "text-green-500" : "text-red-500"}`}
            />
            <span className="text-xs md:text-sm font-medium">
              {connected ? "Conectado" : "Desconectado"}
            </span>
          </div>

          <div className="flex items-center space-x-1 md:space-x-2">
            <Battery className="h-4 w-4 md:h-5 md:w-5 text-primary-600" />
            <span className="text-xs md:text-sm font-medium">
              {sensorCount} sensores
            </span>
          </div>

          <div
            className="hidden md:flex items-center space-x-1 md:space-x-2"
            title="Tópico MQTT"
          >
            <Satellite className="h-4 w-4 md:h-5 md:w-5 text-blue-500" />
            <span className="text-xs md:text-sm font-medium bg-blue-50 text-blue-700 px-2 py-1 rounded">
              sensors/espnow/grouped_data
            </span>
          </div>

          <div className="px-3 py-1 md:px-4 md:py-2 bg-accent-500 text-white rounded-xl font-medium text-sm md:text-base">
            Tiempo Real
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
