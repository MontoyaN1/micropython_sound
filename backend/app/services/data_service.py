import asyncio
import time
from typing import Dict, List, Optional, Any
import logging
from datetime import datetime, timedelta
import numpy as np

from app.utils.config_loader import get_sensor_coordinates
from app.services.idw_service import calculate_idw
from app.services.epicentro_service import calculate_epicenter

logger = logging.getLogger(__name__)

class DataService:
    """Servicio para gestionar el estado de los datos de sensores"""
    
    def __init__(self):
        self.sensor_data: Dict[str, Dict[str, Any]] = {}  # clave: "micro_id"
        self.last_calculation_time = 0
        self.calculation_interval = 10  # segundos entre cálculos de IDW/epicentro
        self.current_idw_data: Optional[Dict[str, Any]] = None
        self.current_epicenter: Optional[Dict[str, Any]] = None
        
    async def update_sensor_value(self, micro_id: str, value: float, timestamp: Optional[int] = None):
        """Actualizar valor de un sensor (ignora sample)"""
        sensor_key = micro_id  # Usar solo micro_id como clave
        
        # Obtener coordenadas (ignorar sample)
        lat, lon, location_name = get_sensor_coordinates(micro_id)
        
        # Actualizar o crear entrada
        if sensor_key not in self.sensor_data:
            self.sensor_data[sensor_key] = {
                "micro_id": micro_id,
                "sample": 0,  # Sample fijo 0
                "latitude": lat,
                "longitude": lon,
                "location_name": location_name,
                "last_value": value,
                "last_update": datetime.now().isoformat(),
                "history": []  # mantener últimos N valores para cálculos
            }
        
        self.sensor_data[sensor_key]["last_value"] = value
        self.sensor_data[sensor_key]["last_update"] = datetime.now().isoformat()
        
        # Agregar a historial (mantener últimos 60 valores ~5 minutos si llega cada 5s)
        self.sensor_data[sensor_key]["history"].append({
            "value": value,
            "timestamp": timestamp or int(time.time()),
            "received_at": datetime.now().isoformat()
        })
        
        # Mantener solo últimos 60 valores
        if len(self.sensor_data[sensor_key]["history"]) > 60:
            self.sensor_data[sensor_key]["history"] = self.sensor_data[sensor_key]["history"][-60:]
        
        logger.debug(f"Sensor {sensor_key} actualizado: {value} dB")
        
        # Verificar si es tiempo de recalcular IDW/epicentro
        current_time = time.time()
        if current_time - self.last_calculation_time >= self.calculation_interval:
            await self.recalculate_interpolations()
    
    async def recalculate_interpolations(self):
        """Recalcular interpolaciones IDW y epicentro"""
        if len(self.sensor_data) < 2:
            logger.debug("No hay suficientes sensores para calcular interpolaciones")
            return
        
        try:
            # Preparar datos para cálculos
            x_vals = []
            y_vals = []
            z_vals = []
            sensor_info = []
            
            for sensor_key, data in self.sensor_data.items():
                x_vals.append(data["longitude"])
                y_vals.append(data["latitude"])
                z_vals.append(data["last_value"])
                sensor_info.append({
                    "sensor_key": sensor_key,
                    "micro_id": data["micro_id"],
                    "sample": data["sample"],
                    "location_name": data["location_name"]
                })
            
            # Calcular IDW
            idw_result = calculate_idw(
                x=np.array(x_vals),
                y=np.array(y_vals),
                z=np.array(z_vals),
                grid_size=50
            )
            
            if idw_result:
                self.current_idw_data = {
                    "xi": idw_result["xi"].tolist(),
                    "yi": idw_result["yi"].tolist(),
                    "zi": idw_result["zi"].tolist(),
                    "x_min": float(idw_result["x_min"]),
                    "x_max": float(idw_result["x_max"]),
                    "y_min": float(idw_result["y_min"]),
                    "y_max": float(idw_result["y_max"]),
                    "calculated_at": datetime.now().isoformat()
                }
            
            # Calcular epicentro
            epicenter_result = calculate_epicenter(
                x=np.array(x_vals),
                y=np.array(y_vals),
                z=np.array(z_vals)
            )
            
            if epicenter_result:
                self.current_epicenter = {
                    "latitude": float(epicenter_result["latitude"]),
                    "longitude": float(epicenter_result["longitude"]),
                    "calculated_at": datetime.now().isoformat()
                }
            
            self.last_calculation_time = time.time()
            logger.info(f"Interpolaciones recalculadas: {len(self.sensor_data)} sensores")
            
        except Exception as e:
            logger.error(f"Error recalculando interpolaciones: {e}")
    
    def get_current_state(self) -> Dict[str, Any]:
        """Obtener estado actual para enviar a clientes"""
        sensor_list = []
        for sensor_key, data in self.sensor_data.items():
            sensor_list.append({
                "sensor_key": sensor_key,
                "micro_id": data["micro_id"],
                "sample": data["sample"],
                "latitude": data["latitude"],
                "longitude": data["longitude"],
                "location_name": data["location_name"],
                "value": data["last_value"],
                "last_update": data["last_update"]
            })
        
        return {
            "sensors": sensor_list,
            "idw": self.current_idw_data,
            "epicenter": self.current_epicenter,
            "timestamp": datetime.now().isoformat(),
            "sensor_count": len(self.sensor_data)
        }
    
    def get_sensor_history(self, sensor_key: str, limit: int = 60) -> List[Dict[str, Any]]:
        """Obtener historial de un sensor"""
        if sensor_key in self.sensor_data:
            return self.sensor_data[sensor_key]["history"][-limit:]
        return []
    
    def get_all_sensors_history(self, limit: int = 10) -> Dict[str, List[Dict[str, Any]]]:
        """Obtener historial de todos los sensores"""
        result = {}
        for sensor_key in self.sensor_data:
            result[sensor_key] = self.get_sensor_history(sensor_key, limit)
        return result

# Instancia global del servicio de datos
data_service = DataService()