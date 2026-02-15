from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime

class SensorInfo(BaseModel):
    """Información de un sensor"""
    micro_id: str
    sample: int
    latitude: float
    longitude: float
    location_name: str
    micro_name: Optional[str] = None

class SensorValue(BaseModel):
    """Valor de sensor con timestamp"""
    sensor_key: str
    micro_id: str
    sample: int
    value: float
    latitude: float
    longitude: float
    location_name: str
    last_update: str

class HistoricalQuery(BaseModel):
    """Parámetros para consulta histórica"""
    start_time: datetime = Field(..., description="Tiempo de inicio (ISO 8601)")
    end_time: Optional[datetime] = Field(None, description="Tiempo de fin (ISO 8601), default ahora")
    micro_ids: Optional[List[str]] = Field(None, description="Lista de micro IDs a filtrar")
    aggregation_window: str = Field("1m", description="Ventana de agregación (1m, 5m, 1h, etc.)")

class HistoricalData(BaseModel):
    """Dato histórico"""
    time: str
    micro_id: str
    sensor_id: str
    sample: int
    measurement: str
    value: float
    location_name: str
    latitude: float
    longitude: float

class IDWData(BaseModel):
    """Datos de interpolación IDW"""
    xi: List[List[float]]
    yi: List[List[float]]
    zi: List[List[float]]
    x_min: float
    x_max: float
    y_min: float
    y_max: float
    calculated_at: str

class EpicenterData(BaseModel):
    """Datos de epicentro"""
    latitude: float
    longitude: float
    max_sensor_latitude: float
    max_sensor_longitude: float
    max_value: float
    sensor_count: int
    calculated_at: str
    fallback: Optional[bool] = None

class CurrentState(BaseModel):
    """Estado actual del sistema"""
    sensors: List[SensorValue]
    idw: Optional[IDWData] = None
    epicenter: Optional[EpicenterData] = None
    timestamp: str
    sensor_count: int

class StatisticsResponse(BaseModel):
    """Estadísticas de un sensor"""
    micro_id: str
    sample: int
    count: int
    mean: float
    min: float
    max: float
    std: float
    data_points: List[HistoricalData]

class HealthResponse(BaseModel):
    """Respuesta de salud del sistema"""
    status: str
    timestamp: str
    mqtt_connected: bool
    websocket_clients: int
    sensor_count: int