import json
import logging
from datetime import datetime
from typing import Dict, Any

from app.services.data_service import data_service
from app.websocket.manager import websocket_manager

logger = logging.getLogger(__name__)

async def handle_mqtt_message(topic: str, payload: str):
    """
    Procesar mensaje MQTT recibido.
    
    Formato esperado del payload:
    {
        "message_id": "esp32_000033",
        "timestamp": 824224068,
        "sensors": [
            {"micro_id": "E255", "value": 43.2, "sample": 1},
            {"micro_id": "E255", "value": 41.6, "sample": 2},
            ...
        ]
    }
    """
    try:
        data = json.loads(payload)
        
        # Validar estructura básica
        if "sensors" not in data:
            logger.warning(f"Mensaje MQTT sin campo 'sensors': {data}")
            return
        
        message_id = data.get("message_id", "unknown")
        timestamp = data.get("timestamp")
        
        logger.info(f"Procesando mensaje {message_id} con {len(data['sensors'])} sensores")
        
        # Agrupar valores por micro_id (ignorar sample)
        micro_values = {}
        micro_counts = {}
        
        for sensor in data["sensors"]:
            micro_id = sensor.get("micro_id")
            value = sensor.get("value")
            sample = sensor.get("sample")  # Ignorado pero validado
            
            if micro_id is None or value is None or sample is None:
                logger.warning(f"Sensor con campos faltantes: {sensor}")
                continue
            
            # Acumular para promedio
            if micro_id not in micro_values:
                micro_values[micro_id] = 0.0
                micro_counts[micro_id] = 0
            
            micro_values[micro_id] += float(value)
            micro_counts[micro_id] += 1
        
        # Actualizar cada micro con el valor promedio
        for micro_id, total in micro_values.items():
            count = micro_counts[micro_id]
            avg_value = total / count
            
            # Actualizar en servicio de datos (ignora sample)
            await data_service.update_sensor_value(
                micro_id=micro_id,
                value=avg_value,
                timestamp=timestamp
            )
            
            logger.debug(f"Micro {micro_id}: {count} samples, promedio {avg_value:.2f} dB")
        
        # Notificar a clientes WebSocket sobre la actualización
        # (el servicio de datos manejará cuándo enviar actualizaciones completas)
        await websocket_manager.broadcast_update()
        
    except json.JSONDecodeError as e:
        logger.error(f"Error decodificando JSON: {e}, payload: {payload[:100]}")
    except Exception as e:
        logger.error(f"Error procesando mensaje MQTT: {e}")