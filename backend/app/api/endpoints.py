import logging
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query

from app.api.schemas import (
    CurrentState,
    HealthResponse,
    HistoricalData,
    HistoricalQuery,
    SensorInfo,
    StatisticsQuery,
    StatisticsResponse,
)
from app.mqtt.client import mqtt_client
from app.services.data_service import data_service
from app.utils.config_loader import get_all_sensors, load_sensors_config
from app.utils.influxdb import influxdb_client
from app.websocket.manager import websocket_manager

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/sensores", response_model=List[SensorInfo])
async def get_sensors():
    """Obtener lista de todos los sensores configurados"""
    sensors = get_all_sensors()
    result = []

    for sensor_key, sensor_info in sensors.items():
        result.append(
            SensorInfo(
                micro_id=sensor_info["micro_id"],
                sample=sensor_info["sample"],
                latitude=sensor_info["latitude"],
                longitude=sensor_info["longitude"],
                location_name=sensor_info["location_name"],
                micro_name=sensor_info["micro_name"],
            )
        )

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
            aggregation_window=query.aggregation_window,
        )

        if not data:
            raise HTTPException(
                status_code=404, detail="No se encontraron datos históricos"
            )

        return [HistoricalData(**item) for item in data]

    except Exception as e:
        logger.error(f"Error obteniendo datos históricos: {e}")
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")


@router.get("/historicos/recientes", response_model=List[HistoricalData])
async def get_recent_historical_data(hours: int = Query(5, ge=1, le=2160)):
    """Obtener datos históricos recientes (últimas N horas)"""
    try:
        data = influxdb_client.get_recent_data(hours=hours)

        if not data:
            raise HTTPException(
                status_code=404, detail="No se encontraron datos recientes"
            )

        return [HistoricalData(**item) for item in data]

    except Exception as e:
        logger.error(f"Error obteniendo datos recientes: {e}")
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")


@router.get("/estadisticas/{micro_id}", response_model=StatisticsResponse)
async def get_sensor_statistics_get(
    micro_id: str,
    hours: int = Query(24, ge=1, le=8760),
):
    """Obtener estadísticas de un micro específico (GET con hours)"""
    try:
        stats = influxdb_client.get_sensor_statistics(micro_id=micro_id, hours=hours)

        if not stats:
            return StatisticsResponse(
                micro_id=micro_id,
                sample=0,
                count=0,
                mean=0,
                min=0,
                max=0,
                std=0,
                data_points=[],
            )

        data_points = []
        if "data_points" in stats:
            for point in stats["data_points"]:
                try:
                    data_points.append(HistoricalData(**point))
                except Exception:
                    pass

        return StatisticsResponse(
            micro_id=stats["micro_id"],
            sample=stats.get("sample", 0),
            count=stats["count"],
            mean=stats["mean"],
            min=stats["min"],
            max=stats["max"],
            std=stats["std"],
            data_points=data_points,
        )

    except Exception as e:
        logger.error(f"Error obteniendo estadísticas GET: {e}")
        return StatisticsResponse(
            micro_id=micro_id,
            sample=0,
            count=0,
            mean=0,
            min=0,
            max=0,
            std=0,
            data_points=[],
        )


@router.post("/estadisticas/{micro_id}", response_model=StatisticsResponse)
async def get_sensor_statistics_post(
    micro_id: str,
    query: StatisticsQuery,
    hours: int = Query(None, ge=1, le=8760),
):
    """
    Obtener estadísticas de un micro específico (POST con rango de fechas).

    Puede usar start_time y end_time para rango exacto.
    Default: aggregation_window=1m
    """
    try:
        if query.start_time:
            start_time = query.start_time
            end_time = query.end_time if query.end_time else datetime.now()
            stats = influxdb_client.get_sensor_statistics(
                micro_id=micro_id,
                start_time=start_time,
                end_time=end_time,
                aggregation_window=query.aggregation_window,
            )
        elif hours:
            stats = influxdb_client.get_sensor_statistics(
                micro_id=micro_id, hours=hours, aggregation_window="1m"
            )
        else:
            stats = influxdb_client.get_sensor_statistics(
                micro_id=micro_id, hours=24, aggregation_window="1m"
            )

        if not stats:
            return StatisticsResponse(
                micro_id=micro_id,
                sample=0,
                count=0,
                mean=0,
                min=0,
                max=0,
                std=0,
                data_points=[],
            )

        data_points = []
        if "data_points" in stats:
            for point in stats["data_points"]:
                try:
                    data_points.append(HistoricalData(**point))
                except Exception:
                    pass

        return StatisticsResponse(
            micro_id=stats["micro_id"],
            sample=stats.get("sample", 0),
            count=stats["count"],
            mean=stats["mean"],
            min=stats["min"],
            max=stats["max"],
            std=stats["std"],
            data_points=data_points,
        )

    except Exception as e:
        logger.error(f"Error obteniendo estadísticas POST: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/estadisticas/{micro_id}/raw")
async def get_sensor_raw_data(
    micro_id: str,
    query: StatisticsQuery,
):
    """
    Obtener datos RAW (sin agregación) para un micro específico.
    Útil para exportar datos crudos para análisis.

    Limitado a máximo 50000 registros para evitar sobrecarga.
    """
    try:
        start_time = query.start_time
        end_time = query.end_time if query.end_time else datetime.now()

        logger.info(
            f"Raw data request: micro_id={micro_id}, start={start_time}, end={end_time}"
        )

        raw_data = influxdb_client.query_raw_data(
            start_time=start_time,
            end_time=end_time,
            micro_ids=[micro_id],
            limit=50000,
        )

        logger.info(f"Raw data returned: {len(raw_data)} registros")

        return {
            "micro_id": micro_id,
            "count": len(raw_data),
            "start_time": start_time.isoformat()
            if hasattr(start_time, "isoformat")
            else str(start_time),
            "end_time": end_time.isoformat()
            if hasattr(end_time, "isoformat")
            else str(end_time),
            "data": raw_data,
        }
    except Exception as e:
        logger.error(f"Error obteniendo datos raw: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/export/csv/{micro_id}")
async def export_sensor_csv(
    micro_id: str,
    hours: int = Query(24, ge=1, le=8760),
):
    """
    Exportar datos de un sensor como CSV.
    Útil para descargar directamente desde el navegador.
    """
    import csv
    import io

    from fastapi.responses import StreamingResponse

    try:
        stats = influxdb_client.get_sensor_statistics(micro_id=micro_id, hours=hours)

        if not stats or not stats.get("data_points"):
            raise HTTPException(status_code=404, detail="No hay datos para exportar")

        # Generar CSV
        output = io.StringIO()
        writer = csv.writer(output)

        # Header
        writer.writerow(
            ["Timestamp", "Micro ID", "Ubicacion", "Nivel (dB)", "Latitud", "Longitud"]
        )

        # Datos
        for point in stats["data_points"]:
            writer.writerow(
                [
                    point.get("time", ""),
                    point.get("micro_id", ""),
                    point.get("location_name", ""),
                    point.get("value", 0),
                    point.get("latitude", 0),
                    point.get("longitude", 0),
                ]
            )

        output.seek(0)

        filename = (
            f"sensor_{micro_id}_{hours}h_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        )

        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error exportando CSV: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/export/csv/{micro_id}")
async def export_sensor_csv_range(
    micro_id: str,
    query: StatisticsQuery,
):
    """
    Exportar datos de un sensor como CSV usando streaming.
    Soporta volúmenes grandes de datos sin límite.
    """
    import csv
    import io

    from fastapi.responses import StreamingResponse

    try:
        start_time = query.start_time
        end_time = query.end_time if query.end_time else datetime.now()

        logger.info(
            f"CSV export request (streaming): micro_id={micro_id}, start={start_time}, end={end_time}"
        )

        def generate_csv():
            """Generator que va leyendo datos y enviándolos en chunks"""
            output = io.StringIO()
            writer = csv.writer(output)

            # Header
            writer.writerow(
                [
                    "Timestamp",
                    "Micro ID",
                    "Ubicacion",
                    "Nivel (dB)",
                    "Latitud",
                    "Longitud",
                ]
            )
            yield output.getvalue()
            output.seek(0)
            output.truncate(0)

            # Streaming de datos - leer en batches de 10000
            batch_size = 10000
            offset = 0

            while True:
                batch_data = influxdb_client.query_raw_data_paged(
                    start_time=start_time,
                    end_time=end_time,
                    micro_ids=[micro_id],
                    limit=batch_size,
                    offset=offset,
                )

                if not batch_data:
                    break

                for point in batch_data:
                    writer.writerow(
                        [
                            point.get("time", ""),
                            point.get("micro_id", ""),
                            point.get("location_name", ""),
                            point.get("value", 0),
                            point.get("latitude", 0),
                            point.get("longitude", 0),
                        ]
                    )

                yield output.getvalue()
                output.seek(0)
                output.truncate(0)
                offset += batch_size

                logger.info(f"CSV streaming: enviado batch offset={offset}")

            logger.info(f"CSV streaming completado")

        start_str = (
            start_time.strftime("%Y%m%d")
            if hasattr(start_time, "strftime")
            else str(start_time)[:10]
        )
        end_str = (
            end_time.strftime("%Y%m%d")
            if hasattr(end_time, "strftime")
            else str(end_time)[:10]
        )
        filename = f"sensor_{micro_id}_{start_str}_to_{end_str}.csv"

        return StreamingResponse(
            generate_csv(),
            media_type="text/csv",
            headers={
                "Content-Disposition": f"attachment; filename={filename}",
                "X-Accel-Buffering": "no",  # Disable nginx buffering
            },
        )

    except Exception as e:
        logger.error(f"Error exportando CSV: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health", response_model=HealthResponse)
async def health_check():
    """Verificar salud del sistema"""
    return HealthResponse(
        status="healthy",
        timestamp=datetime.now().isoformat(),
        mqtt_connected=mqtt_client.connected,
        websocket_clients=len(websocket_manager.active_connections),
        sensor_count=len(data_service.sensor_data),
    )


@router.post("/config/reload")
async def reload_config():
    """Recargar configuración de sensores desde disco"""
    try:
        from app.utils.config_loader import _config_cache, _config_last_loaded

        _config_cache = None
        _config_last_loaded = 0

        config = load_sensors_config()

        return {
            "status": "success",
            "message": "Configuración recargada correctamente",
            "timestamp": datetime.now().isoformat(),
            "sensor_count": len(
                config.get("sensores", config.get("microcontrollers", {}))
            ),
        }
    except Exception as e:
        logger.error(f"Error recargando configuración: {e}")
        raise HTTPException(
            status_code=500, detail=f"Error recargando configuración: {str(e)}"
        )
