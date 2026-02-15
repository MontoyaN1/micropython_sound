import { useState, useEffect, useCallback, useRef } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

// Construir URL de WebSocket correctamente para producción (/api) y desarrollo
const getWebSocketUrl = () => {
  if (API_URL.startsWith("/")) {
    // Producción: /api -> ws://{host}/ws/realtime
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    return `${protocol}//${host}/ws/realtime`;
  } else {
    // Desarrollo: http://localhost:8000 -> ws://localhost:8000/ws/realtime
    return API_URL.replace("http", "ws") + "/ws/realtime";
  }
};

const WS_URL = getWebSocketUrl();

export const useWebSocket = () => {
  const [connected, setConnected] = useState(false);
  const [sensorData, setSensorData] = useState([]);
  const [idwData, setIdwData] = useState(null);
  const [epicenter, setEpicenter] = useState(null);
  const [sensorCount, setSensorCount] = useState(0);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [ws, setWs] = useState(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const pingIntervalRef = useRef(null);

  const connectWebSocket = useCallback(() => {
    const websocket = new WebSocket(WS_URL);

    websocket.onopen = () => {
      console.log("WebSocket conectado");
      setConnected(true);
      setReconnectAttempts(0);

      // Iniciar ping cada 25 segundos para mantener conexión activa
      pingIntervalRef.current = setInterval(() => {
        if (websocket.readyState === WebSocket.OPEN) {
          console.log("Enviando ping...");
          websocket.send("ping");
        }
      }, 25000);
    };

    websocket.onclose = () => {
      console.log("WebSocket desconectado");
      setConnected(false);

      // Limpiar intervalo de ping
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }

      // Reconectar después de 3 segundos
      setTimeout(() => {
        if (reconnectAttempts < 5) {
          console.log(`Reconectando... intento ${reconnectAttempts + 1}`);
          setReconnectAttempts((prev) => prev + 1);
          connectWebSocket();
        }
      }, 3000);
    };

    websocket.onerror = (error) => {
      console.error("Error en WebSocket:", error);
      setConnected(false);
    };

    websocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("Datos recibidos:", data);

        if (data.type === "full_update" || data.type === "update") {
          const state = data.type === "full_update" ? data.data : data.data;

          // Log detallado del epicentro
          console.log("📊 EPICENTRO RECIBIDO - RAW DATA:", {
            has_epicenter: !!state.epicenter,
            epicenter_raw: state.epicenter,
            epicenter_type: typeof state.epicenter,
            is_null: state.epicenter === null,
            is_undefined: state.epicenter === undefined,
            timestamp: state.timestamp || "no timestamp",
          });

          if (state.epicenter) {
            console.log("📍 EPICENTRO COORDENADAS:", {
              longitude: state.epicenter.longitude,
              latitude: state.epicenter.latitude,
              calculated_at: state.epicenter.calculated_at,
              isValidLongitude:
                state.epicenter.longitude >= 0 &&
                state.epicenter.longitude <= 5,
              isValidLatitude:
                state.epicenter.latitude >= 0 && state.epicenter.latitude <= 14,
              isValidOverall:
                state.epicenter.longitude >= 0 &&
                state.epicenter.longitude <= 5 &&
                state.epicenter.latitude >= 0 &&
                state.epicenter.latitude <= 14,
            });
          }

          console.log("Estado recibido:", {
            sensors_count: state.sensors?.length || 0,
            sensors: state.sensors?.map((s) => ({
              micro_id: s.micro_id,
              latitude: s.latitude,
              longitude: s.longitude,
              value: s.value,
            })),
            has_idw: !!state.idw,
            has_epicenter: !!state.epicenter,
            epicenter_data: state.epicenter,
          });

          // Log antes de actualizar estados
          console.log("🔄 ACTUALIZANDO ESTADOS:", {
            epicenter_prev: epicenter,
            epicenter_new: state.epicenter || null,
            setting_to_null: !state.epicenter,
          });

          setSensorData(state.sensors || []);
          setIdwData(state.idw || null);

          setEpicenter(state.epicenter || null);

          setSensorCount(state.sensor_count || 0);
          setLastUpdate(state.timestamp || new Date().toISOString());

          // Log después de actualizar (aunque setEpicenter es asíncrono)
          console.log(
            "✅ ESTADOS ACTUALIZADOS - epicenter set to:",
            state.epicenter || null,
          );
        } else if (data.type === "ping") {
          // Responder al ping del backend
          if (websocket.readyState === WebSocket.OPEN) {
            websocket.send(
              JSON.stringify({
                type: "pong",
                timestamp: new Date().toISOString(),
              }),
            );
          }
        }
      } catch (error) {
        // Si no es JSON, podría ser texto plano 'pong'
        if (event.data === "pong") {
          console.log("Received pong");
        } else {
          console.error(
            "Error parseando mensaje WebSocket:",
            error,
            "Data:",
            event.data,
          );
        }
      }
    };

    setWs(websocket);
    return websocket;
  }, [reconnectAttempts]);

  useEffect(() => {
    const websocket = connectWebSocket();

    return () => {
      if (websocket && websocket.readyState === WebSocket.OPEN) {
        websocket.close();
      }
    };
  }, [connectWebSocket]);

  const disconnect = useCallback(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.close();
      setConnected(false);
    }
  }, [ws]);

  const reconnect = useCallback(() => {
    disconnect();
    connectWebSocket();
  }, [disconnect, connectWebSocket]);

  return {
    connected,
    sensorData,
    idwData,
    epicenter,
    sensorCount,
    lastUpdate,
    disconnect,
    reconnect,
  };
};
