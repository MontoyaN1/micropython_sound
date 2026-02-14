import { useEffect, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Circle,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet.heat";
import { Activity, Volume2, MapPin, Target } from "lucide-react";

const DEFAULT_CENTER = [4.60971, -74.081749]; // Bogotá
const DEFAULT_ZOOM = 14;

// Iconos personalizados
const createSensorIcon = (value) => {
  let colorClass = "green";
  let borderClass = "border-green-500";
  let textClass = "text-green-500";
  let bgClass = "bg-green-500";

  if (value >= 85) {
    colorClass = "red";
    borderClass = "border-red-500";
    textClass = "text-red-500";
    bgClass = "bg-red-500";
  } else if (value >= 70) {
    colorClass = "orange";
    borderClass = "border-orange-500";
    textClass = "text-orange-500";
    bgClass = "bg-orange-500";
  } else if (value >= 50) {
    colorClass = "yellow";
    borderClass = "border-yellow-500";
    textClass = "text-yellow-500";
    bgClass = "bg-yellow-500";
  }

  return L.divIcon({
    html: `
      <div class="relative">
        <div class="w-8 h-8 rounded-full bg-white border-2 ${borderClass} flex items-center justify-center shadow-lg">
          <svg class="w-4 h-4 ${textClass}" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z" clip-rule="evenodd"/>
          </svg>
        </div>
        <div class="absolute -top-2 -right-2 ${bgClass} text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
          ${Math.round(value)}
        </div>
      </div>
    `,
    className: "",
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
};

const createEpicenterIcon = () => {
  return L.divIcon({
    html: `
      <div class="relative">
        <div class="w-10 h-10 rounded-full bg-red-500 border-4 border-white flex items-center justify-center shadow-xl animate-pulse">
          <svg class="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clip-rule="evenodd"/>
          </svg>
        </div>
      </div>
    `,
    className: "",
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
};

const HeatmapLayer = ({ idwData }) => {
  const map = useMap();
  const heatLayerRef = useRef(null);

  useEffect(() => {
    if (!idwData || !idwData.xi || !idwData.yi || !idwData.zi) return;

    // Limpiar capa anterior
    if (heatLayerRef.current) {
      map.removeLayer(heatLayerRef.current);
    }

    // Convertir datos IDW a puntos de calor
    const heatPoints = [];
    const xi = idwData.xi;
    const yi = idwData.yi;
    const zi = idwData.zi;

    // Asumimos que xi, yi son arrays 2D y zi es array 2D
    for (let i = 0; i < zi.length; i++) {
      for (let j = 0; j < zi[i].length; j++) {
        const lat = yi[i][j] || yi[i]?.[0] || DEFAULT_CENTER[0];
        const lng = xi[i][j] || xi[0]?.[j] || DEFAULT_CENTER[1];
        const intensity = zi[i][j] || 0;

        if (intensity > 0) {
          // Normalizar intensidad para heatmap (0-1)
          const normalizedIntensity = Math.min(intensity / 100, 1);
          heatPoints.push([lat, lng, normalizedIntensity]);
        }
      }
    }

    if (heatPoints.length > 0) {
      heatLayerRef.current = L.heatLayer(heatPoints, {
        radius: 25,
        blur: 15,
        maxZoom: 17,
        gradient: {
          0.0: "#0d0887", // Azul oscuro profundo
          0.2: "#5601a3", // Púrpura oscuro
          0.4: "#8b0aa5", // Púrpura magenta
          0.6: "#b93289", // Rosa magenta
          0.8: "#db5a68", // Rosa anaranjado
          1.0: "#f89441", // Naranja amarillento
        },
        opacity: 0.6,
      }).addTo(map);
    }

    return () => {
      if (heatLayerRef.current) {
        map.removeLayer(heatLayerRef.current);
      }
    };
  }, [map, idwData]);

  return null;
};

const MapBoundsUpdater = ({ sensors }) => {
  const map = useMap();

  useEffect(() => {
    if (sensors.length > 0) {
      const bounds = L.latLngBounds(
        sensors.map((sensor) => [sensor.latitude, sensor.longitude]),
      );
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [map, sensors]);

  return null;
};

const RealTimeMap = ({ sensorData, idwData, epicenter }) => {
  const mapRef = useRef(null);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showEpicenter, setShowEpicenter] = useState(true);

  const handleMapCreated = (map) => {
    mapRef.current = map;
  };

  return (
    <div className="relative h-full">
      <div className="absolute top-4 right-4 z-[1000] space-y-2">
        <div className="card p-3 space-y-3">
          <div className="flex items-center justify-between">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showHeatmap}
                onChange={(e) => setShowHeatmap(e.target.checked)}
                className="rounded text-accent-500"
              />
              <span className="text-sm font-medium">Mapa de Calor</span>
            </label>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 rounded-full bg-[#0d0887]"></div>
              <div className="w-3 h-3 rounded-full bg-[#5601a3]"></div>
              <div className="w-3 h-3 rounded-full bg-[#8b0aa5]"></div>
              <div className="w-3 h-3 rounded-full bg-[#b93289]"></div>
              <div className="w-3 h-3 rounded-full bg-[#db5a68]"></div>
              <div className="w-3 h-3 rounded-full bg-[#f89441]"></div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showEpicenter}
                onChange={(e) => setShowEpicenter(e.target.checked)}
                className="rounded text-accent-500"
              />
              <span className="text-sm font-medium">Epicentro</span>
            </label>
            <Target className="h-4 w-4 text-red-500" />
          </div>
        </div>

        <div className="card p-3">
          <div className="flex items-center space-x-2 mb-2">
            <Activity className="h-4 w-4 text-primary-600" />
            <span className="text-sm font-semibold">Leyenda</span>
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
      </div>

      <MapContainer
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        className="h-full rounded-2xl shadow-lg"
        whenCreated={handleMapCreated}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {showHeatmap && idwData && <HeatmapLayer idwData={idwData} />}

        <MapBoundsUpdater sensors={sensorData} />

        {sensorData.map((sensor) => (
          <Marker
            key={sensor.micro_id}
            position={[sensor.latitude, sensor.longitude]}
            icon={createSensorIcon(sensor.value)}
          >
            <Popup>
              <div className="p-2">
                <div className="flex items-center space-x-2 mb-2">
                  <MapPin className="h-4 w-4 text-accent-500" />
                  <h3 className="font-bold">{sensor.location_name}</h3>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-primary-600">ID:</span>
                    <span className="font-medium">{sensor.micro_id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-primary-600">Nivel:</span>
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
                  <div className="flex justify-between">
                    <span className="text-primary-600">Actualizado:</span>
                    <span className="text-sm">
                      {new Date(sensor.last_update).toLocaleTimeString("es-ES")}
                    </span>
                  </div>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        {showEpicenter && epicenter && (
          <Marker
            position={[epicenter.latitude, epicenter.longitude]}
            icon={createEpicenterIcon()}
          >
            <Popup>
              <div className="p-2">
                <div className="flex items-center space-x-2 mb-2">
                  <Target className="h-4 w-4 text-red-500" />
                  <h3 className="font-bold">Epicentro Estimado</h3>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-primary-600">Latitud:</span>
                    <span className="font-medium">
                      {epicenter.latitude.toFixed(6)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-primary-600">Longitud:</span>
                    <span className="font-medium">
                      {epicenter.longitude.toFixed(6)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-primary-600">Calculado:</span>
                    <span className="text-sm">
                      {new Date(epicenter.calculated_at).toLocaleTimeString(
                        "es-ES",
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
};

export default RealTimeMap;
