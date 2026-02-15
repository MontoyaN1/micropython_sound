from fastapi import APIRouter, Query, HTTPException
from typing import List, Optional
from datetime import datetime, timedelta
import logging

from app.api.schemas import (
    SensorInfo, HistoricalQuery, HistoricalData, CurrentState,
    StatisticsResponse, HealthResponse
)
from app.services.data_service import data_service
from app.utils.influxdb import influxdb_client
from app.utils.config_loader import get_all_sensors, load_sensors_config
from app.mqtt.client import mqtt_client
from app.websocket.manager import websocket_manager

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/sensores", response_model=List[SensorInfo])
async def get_sensors():
    """Obtener lista de todos los sensores configurados"""
    sensors = get_all_sensors()
    result = []
    
    for sensor_key, sensor_info in sensors.items():
        result.append(SensorInfo(
            micro_id=sensor_info["micro_id"],
            sample=sensor_info["sample"],
            latitude=sensor_info["latitude"],
            longitude=sensor_info["longitude"],
            location_name=sensor_info["location_name"],
            micro_name=sensor_info["micro_name"]
        ))
    
    return result

@router.get("/ultimos", response_model=CurrentState)
async def get_last_data():
    """Obtener los últimos datos en tiempo real"""
    state = data_service.get_current_state()
    return CurrentState(**state)

@router.post("/historicos", response_model=List[HistoricalData])
async def get_historical_data(query: HistoricalQuery):
    """Obtener datos históricos desde InfluxDB"""
    try:
        data = influxdb_client.query_historical_data(
            start_time=query.start_time,
            end_time=query.end_time,
            micro_ids=query.micro_ids,
            aggregation_window=query.aggregation_window
        )
        
        if not data:
            raise HTTPException(status_code=404, detail="No se encontraron datos históricos")
        
        return [HistoricalData(**item) for item in data]
        
    except Exception as e:
        logger.error(f"Error obteniendo datos históricos: {e}")
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")

@router.get("/historicos/recientes", response_model=List[HistoricalData])
async def get_recent_historical_data(hours: int = Query(5, ge=1, le=168)):
    """Obtener datos históricos recientes (últimas N horas)"""
    try:
        data = influxdb_client.get_recent_data(hours=hours)
        
        if not data:
            raise HTTPException(status_code=404, detail="No se encontraron datos recientes")
        
        return [HistoricalData(**item) for item in data]
        
    except Exception as e:
        logger.error(f"Error obteniendo datos recientes: {e}")
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")

@router.get("/estadisticas/{micro_id}/{sample}", response_model=StatisticsResponse)
async def get_sensor_statistics(
    micro_id: str,
    sample: int,  # Mantenido por compatibilidad, ignorado
    hours: int = Query(24, ge=1, le=720)
):
    """Obtener estadísticas de un micro específico (sample ignorado)"""
    try:
        stats = influxdb_client.get_sensor_statistics(
            micro_id=micro_id,
            hours=hours
        )
        
        if not stats:
            raise HTTPException(status_code=404, detail=f"No se encontraron datos para micro {micro_id}")
        
        # Convertir data_points a HistoricalData
        data_points = []
        if "data_points" in stats:
            for point in stats["data_points"]:
                data_points.append(HistoricalData(**point))
        
        return StatisticsResponse(
            micro_id=stats["micro_id"],
            sample=stats["sample"],  # Siempre 0
            count=stats["count"],
            mean=stats["mean"],
            min=stats["min"],
            max=stats["max"],
            std=stats["std"],
            data_points=data_points
        )
        
    except Exception as e:
        logger.error(f"Error obteniendo estadísticas: {e}")
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")

@router.get("/health", response_model=HealthResponse)
async def health_check():
    """Verificar salud del sistema"""
    return HealthResponse(
        status="healthy",
        timestamp=datetime.now().isoformat(),
        mqtt_connected=mqtt_client.connected,
        websocket_clients=len(websocket_manager.active_connections),
        sensor_count=len(data_service.sensor_data)
    )

@router.post("/config/reload")
async def reload_config():
    """Recargar configuración de sensores desde disco"""
    try:
        # Forzar recarga del cache
        from app.utils.config_loader import _config_cache, _config_last_loaded
        import time
        
        _config_cache = None
        _config_last_loaded = 0
        
        # Cargar configuración
        config = load_sensors_config()
        
        return {
            "status": "success",
            "message": "Configuración recargada correctamente",
            "timestamp": datetime.now().isoformat(),
            "sensor_count": len(config.get("sensores", config.get("microcontrollers", {})))
        }
    except Exception as e:
        logger.error(f"Error recargando configuración: {e}")
        raise HTTPException(status_code=500, detail=f"Error recargando configuración: {str(e)}")