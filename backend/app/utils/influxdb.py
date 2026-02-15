import os
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import numpy as np
import influxdb_client as influxdb_module
from influxdb_client.client.write_api import SYNCHRONOUS

from app.utils.config_loader import get_sensor_coordinates

logger = logging.getLogger(__name__)

class InfluxDBService:
    """Cliente para consultas a InfluxDB"""
    
    def __init__(self):
        self.url = os.getenv("INFLUXDB_URL")
        self.token = os.getenv("INFLUXDB_TOKEN")
        self.org = os.getenv("INFLUXDB_ORG")
        self.bucket = os.getenv("INFLUXDB_BUCKET", "sensores")
        
        if not all([self.url, self.token, self.org]):
            logger.warning("Variables de entorno de InfluxDB no configuradas completamente")
        
        self.client = None
        self.query_api = None
        
    def _ensure_client(self):
        """Asegurar que el cliente esté inicializado"""
        if not self.client and all([self.url, self.token, self.org]):
            try:
                self.client = influxdb_module.InfluxDBClient(
                    url=self.url,
                    token=self.token,
                    org=self.org
                )
                self.query_api = self.client.query_api()
                logger.info("Cliente InfluxDB inicializado")
            except Exception as e:
                logger.error(f"Error inicializando cliente InfluxDB: {e}")
                raise
    
    def query_historical_data(
        self,
        start_time: datetime,
        end_time: Optional[datetime] = None,
        micro_ids: Optional[List[str]] = None,
        aggregation_window: str = "1m"
    ) -> List[Dict[str, Any]]:
        """
        Consultar datos históricos de InfluxDB.
        Agrupa por micro_id y tiempo, promediando valores de diferentes sensor_id (samples).
        
        Args:
            start_time: Tiempo de inicio
            end_time: Tiempo de fin (default: ahora)
            micro_ids: Lista de micro IDs a filtrar (default: todos)
            aggregation_window: Ventana de agregación (ej. "1m", "5m", "1h")
            
        Returns:
            Lista de diccionarios con datos de sensores (sample=0 para todos)
        """
        self._ensure_client()
        if not self.query_api:
            return []
        
        if end_time is None:
            end_time = datetime.now()
        
        # Formatear tiempos para Flux
        start_str = start_time.isoformat() + "Z"
        end_str = end_time.isoformat() + "Z"
        
        # Construir filtro de micro_ids
        micro_filter = ""
        if micro_ids:
            micro_conditions = " or ".join([f'r["micro_id"] == "{mid}"' for mid in micro_ids])
            micro_filter = f'|> filter(fn: (r) => {micro_conditions})'
        
        # Consulta Flux (sin agrupar por sensor_id a nivel de Flux, lo haremos en Python)
        query = f'''
        from(bucket: "{self.bucket}")
          |> range(start: {start_str}, stop: {end_str})
          |> filter(fn: (r) => r["_measurement"] == "sonido")
          |> filter(fn: (r) => r["_field"] == "valor")
          {micro_filter}
          |> aggregateWindow(every: {aggregation_window}, fn: mean, createEmpty: false)
          |> yield(name: "mean")
        '''
        
        logger.debug(f"Ejecutando consulta InfluxDB: {query[:200]}...")
        
        try:
            tables = self.query_api.query(query)
            # Agrupar por (micro_id, time) para promediar sobre sensor_id
            grouped = {}
            
            for table in tables:
                for record in table.records:
                    micro_id = record.values.get("micro_id")
                    time_key = record.get_time().isoformat()
                    value = float(record.get_value())
                    
                    key = (micro_id, time_key)
                    if key not in grouped:
                        grouped[key] = {
                            "sum": 0.0,
                            "count": 0,
                            "micro_id": micro_id,
                            "time": time_key
                        }
                    grouped[key]["sum"] += value
                    grouped[key]["count"] += 1
            
            results = []
            for key, data in grouped.items():
                micro_id = data["micro_id"]
                avg_value = data["sum"] / data["count"]
                
                # Obtener coordenadas (sample ignorado)
                lat, lon, location_name = get_sensor_coordinates(micro_id)
                
                results.append({
                    "time": data["time"],
                    "micro_id": micro_id,
                    "sensor_id": micro_id,  # Usar micro_id como sensor_id
                    "sample": 0,  # Sample fijo 0
                    "measurement": "sonido",
                    "value": avg_value,
                    "location_name": location_name,
                    "latitude": lat,
                    "longitude": lon
                })
            
            logger.info(f"Consulta histórica completada: {len(results)} registros (agrupados de {len(grouped)} grupos)")
            return results
            
        except Exception as e:
            logger.error(f"Error consultando InfluxDB: {e}")
            return []
    
    def get_recent_data(self, hours: int = 5) -> List[Dict[str, Any]]:
        """Obtener datos recientes (últimas N horas)"""
        start_time = datetime.now() - timedelta(hours=hours)
        return self.query_historical_data(start_time=start_time)
    
    def get_sensor_statistics(
        self,
        micro_id: str,
        hours: int = 24
    ) -> Dict[str, Any]:
        """Obtener estadísticas de un micro específico (ignora sample)"""
        start_time = datetime.now() - timedelta(hours=hours)
        data = self.query_historical_data(
            start_time=start_time,
            micro_ids=[micro_id]
        )
        
        if not data:
            return {}
        
        values = [d["value"] for d in data]
        
        return {
            "micro_id": micro_id,
            "sample": 0,
            "count": len(values),
            "mean": float(np.mean(values)) if values else 0,
            "min": float(np.min(values)) if values else 0,
            "max": float(np.max(values)) if values else 0,
            "std": float(np.std(values)) if values else 0,
            "data_points": data[:100]  # Limitar para respuesta
        }

# Instancia global del cliente InfluxDB
influxdb_client = InfluxDBService()