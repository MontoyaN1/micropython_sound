import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

import influxdb_client as influxdb_module
import numpy as np
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
            logger.warning(
                "Variables de entorno de InfluxDB no configuradas completamente"
            )

        self.client = None
        self.query_api = None

    def _ensure_client(self):
        """Asegurar que el cliente esté inicializado"""
        if not self.client and all([self.url, self.token, self.org]):
            try:
                self.client = influxdb_module.InfluxDBClient(
                    url=self.url, token=self.token, org=self.org
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
        aggregation_window: str = "1m",
        limit: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        """
        Consultar datos históricos de InfluxDB.
        Agrupa por micro_id y tiempo, promediando valores de diferentes sensor_id (samples).

        Args:
            start_time: Tiempo de inicio (se asume UTC si es naive)
            end_time: Tiempo de fin (default: ahora, se asume UTC si es naive)
            micro_ids: Lista de micro IDs a filtrar (default: todos)
            aggregation_window: Ventana de agregación (ej. "1m", "5m", "1h")
            limit: Límite máximo de registros a devolver (None = sin límite)

        Returns:
            Lista de diccionarios con datos de sensores (sample=0 para todos)
        """
        self._ensure_client()
        if not self.query_api:
            return []

        if end_time is None:
            end_time = datetime.now()

        # Normalizar fechas a UTC (asumir UTC si son naive)
        # InfluxDB siempre trabaja en UTC
        if start_time.tzinfo is None:
            start_time = start_time.replace(tzinfo=timezone.utc)
        if end_time.tzinfo is None:
            end_time = end_time.replace(tzinfo=timezone.utc)

        start_str = start_time.isoformat()
        end_str = end_time.isoformat()

        logger.info(
            f"Query InfluxDB: {start_str} -> {end_str}, window={aggregation_window}, limit={limit}"
        )

        # Construir filtro de micro_ids
        micro_filter = ""
        if micro_ids:
            micro_conditions = " or ".join(
                [f'r["micro_id"] == "{mid}"' for mid in micro_ids]
            )
            micro_filter = f"|> filter(fn: (r) => {micro_conditions})"

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
                            "time": time_key,
                        }
                    grouped[key]["sum"] += value
                    grouped[key]["count"] += 1

            results = []
            for key, data in grouped.items():
                micro_id = data["micro_id"]
                avg_value = data["sum"] / data["count"]

                # Obtener coordenadas (sample ignorado)
                lat, lon, location_name = get_sensor_coordinates(micro_id)

                results.append(
                    {
                        "time": data["time"],
                        "micro_id": micro_id,
                        "sensor_id": micro_id,  # Usar micro_id como sensor_id
                        "sample": 0,  # Sample fijo 0
                        "measurement": "sonido",
                        "value": avg_value,
                        "location_name": location_name,
                        "latitude": lat,
                        "longitude": lon,
                    }
                )

            logger.info(
                f"Consulta histórica completada: {len(results)} registros (agrupados de {len(grouped)} grupos)"
            )
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
        hours: int = 24,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        aggregation_window: str = "1m",
    ) -> Dict[str, Any]:
        """
        Obtener estadísticas de un micro específico.

        Args:
            micro_id: ID del micro
            hours: Horas hacia atrás (usado si no se especifican start/end_time)
            start_time: Tiempo de inicio (None = ahora - hours)
            end_time: Tiempo de fin (None = ahora)
            aggregation_window: Ventana de agregación para data_points
        """
        if start_time is None:
            start_time = datetime.now() - timedelta(hours=hours)
        if end_time is None:
            end_time = datetime.now()

        # Normalizar a UTC
        if start_time.tzinfo is None:
            start_time = start_time.replace(tzinfo=timezone.utc)
        if end_time.tzinfo is None:
            end_time = end_time.replace(tzinfo=timezone.utc)

        data = self.query_historical_data(
            start_time=start_time,
            end_time=end_time,
            micro_ids=[micro_id],
            aggregation_window=aggregation_window,
        )

        if not data:
            return {}

        values = [d["value"] for d in data if d.get("value") is not None]

        if not values:
            return {}

        return {
            "micro_id": micro_id,
            "sample": 0,
            "count": len(values),
            "mean": float(np.mean(values)),
            "min": float(np.min(values)),
            "max": float(np.max(values)),
            "std": float(np.std(values)),
            "data_points": data[:500],  # Limitar data_points
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat(),
            "aggregation_window": aggregation_window,
        }

    def query_raw_data(
        self,
        start_time: datetime,
        end_time: Optional[datetime] = None,
        micro_ids: Optional[List[str]] = None,
        limit: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        """
        Consultar datos RAW (sin agregación) de InfluxDB.

        Args:
            start_time: Tiempo de inicio
            end_time: Tiempo de fin (default: ahora)
            micro_ids: Lista de micro IDs a filtrar (default: todos)
            limit: Límite máximo de registros (default: 50000)

        Returns:
            Lista de diccionarios con datos crudos de sensores
        """
        self._ensure_client()
        if not self.query_api:
            return []

        if end_time is None:
            end_time = datetime.now()

        # Normalizar fechas a UTC
        if start_time.tzinfo is None:
            start_time = start_time.replace(tzinfo=timezone.utc)
        if end_time.tzinfo is None:
            end_time = end_time.replace(tzinfo=timezone.utc)

        start_str = start_time.isoformat()
        end_str = end_time.isoformat()

        logger.info(
            f"Query RAW InfluxDB: {start_str} -> {end_str}, micro_ids={micro_ids}, limit={limit}"
        )

        # Construir filtro de micro_ids
        micro_filter = ""
        if micro_ids:
            micro_conditions = " or ".join(
                [f'r["micro_id"] == "{mid}"' for mid in micro_ids]
            )
            micro_filter = f"|> filter(fn: (r) => {micro_conditions})"

        # Límite
        limit_clause = f"|> limit(n: {limit})" if limit else ""

        # Consulta Flux sin agregación
        query = f'''
        from(bucket: "{self.bucket}")
          |> range(start: {start_str}, stop: {end_str})
          |> filter(fn: (r) => r["_measurement"] == "sonido")
          |> filter(fn: (r) => r["_field"] == "valor")
          {micro_filter}
          |> sort(columns: ["_time"], desc: false)
          {limit_clause}
        '''

        logger.debug(f"Ejecutando consulta RAW InfluxDB: {query[:300]}...")

        try:
            tables = self.query_api.query(query)
            results = []

            for table in tables:
                for record in table.records:
                    micro_id = record.values.get("micro_id")
                    lat, lon, location_name = get_sensor_coordinates(micro_id)

                    results.append(
                        {
                            "time": record.get_time().isoformat(),
                            "micro_id": micro_id,
                            "sensor_id": micro_id,
                            "sample": record.values.get("sensor_id", 0),
                            "measurement": "sonido",
                            "value": float(record.get_value()),
                            "location_name": location_name,
                            "latitude": lat,
                            "longitude": lon,
                        }
                    )

            logger.info(f"Consulta RAW completada: {len(results)} registros")
            return results

        except Exception as e:
            logger.error(f"Error consultando InfluxDB RAW: {e}")
            return []

    def query_raw_data_paged(
        self,
        start_time: datetime,
        end_time: Optional[datetime] = None,
        micro_ids: Optional[List[str]] = None,
        limit: int = 10000,
        offset: int = 0,
    ) -> List[Dict[str, Any]]:
        """
        Consultar datos RAW con paginación (para streaming de grandes volúmenes).

        Args:
            start_time: Tiempo de inicio
            end_time: Tiempo de fin (default: ahora)
            micro_ids: Lista de micro IDs a filtrar (default: todos)
            limit: Tamaño del batch (default: 10000)
            offset: Offset para paginación

        Returns:
            Lista de diccionarios con datos crudos
        """
        self._ensure_client()
        if not self.query_api:
            return []

        if end_time is None:
            end_time = datetime.now()

        # Normalizar fechas a UTC
        if start_time.tzinfo is None:
            start_time = start_time.replace(tzinfo=timezone.utc)
        if end_time.tzinfo is None:
            end_time = end_time.replace(tzinfo=timezone.utc)

        start_str = start_time.isoformat()
        end_str = end_time.isoformat()

        logger.debug(
            f"Query RAW paged: {start_str} -> {end_str}, offset={offset}, limit={limit}"
        )

        # Construir filtro de micro_ids
        micro_filter = ""
        if micro_ids:
            micro_conditions = " or ".join(
                [f'r["micro_id"] == "{mid}"' for mid in micro_ids]
            )
            micro_filter = f"|> filter(fn: (r) => {micro_conditions})"

        # Consulta Flux con paginación usando limit y offset
        query = f'''
        from(bucket: "{self.bucket}")
          |> range(start: {start_str}, stop: {end_str})
          |> filter(fn: (r) => r["_measurement"] == "sonido")
          |> filter(fn: (r) => r["_field"] == "valor")
          {micro_filter}
          |> sort(columns: ["_time"], desc: false)
          |> limit(n: {limit}, offset: {offset})
        '''

        try:
            tables = self.query_api.query(query)
            results = []

            for table in tables:
                for record in table.records:
                    micro_id = record.values.get("micro_id")
                    lat, lon, location_name = get_sensor_coordinates(micro_id)

                    results.append(
                        {
                            "time": record.get_time().isoformat(),
                            "micro_id": micro_id,
                            "sensor_id": micro_id,
                            "sample": record.values.get("sensor_id", 0),
                            "measurement": "sonido",
                            "value": float(record.get_value()),
                            "location_name": location_name,
                            "latitude": lat,
                            "longitude": lon,
                        }
                    )

            return results

        except Exception as e:
            logger.error(f"Error consultando InfluxDB RAW paged: {e}")
            return []


# Instancia global del cliente InfluxDB
influxdb_client = InfluxDBService()
