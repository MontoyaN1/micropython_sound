import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

import numpy as np

from app.utils.epicentro import calcular_epicentro

logger = logging.getLogger(__name__)


def calculate_epicenter(
    x: np.ndarray,
    y: np.ndarray,
    z: np.ndarray,
    sensor_info: Optional[List[Dict[str, Any]]] = None,
) -> Optional[Dict[str, Any]]:
    """
    Calcular epicentro extendido basado en los 3 sensores con mayor ruido.

    Args:
        x: Array de coordenadas X (longitudes)
        y: Array de coordenadas Y (latitudes)
        z: Array de valores (niveles de ruido)
        sensor_info: Lista opcional de información de sensores con micro_id

    Returns:
        Diccionario con datos de epicentro extendido, o None en caso de error
    """
    if len(x) < 1:
        logger.warning("Se necesitan al menos 1 punto para calcular epicentro")
        return None

    try:
        # Identificar los 3 sensores con mayor ruido (top 3)
        top_indices = []
        if len(z) >= 3:
            # Obtener índices de los 3 valores más altos
            top_indices = np.argsort(z)[-3:][::-1]  # Orden descendente
        else:
            # Si hay menos de 3 sensores, usar todos
            top_indices = np.argsort(z)[::-1]

        # Crear arrays solo con los sensores top
        top_x = x[top_indices]
        top_y = y[top_indices]
        top_z = z[top_indices]

        # Calcular epicentro tradicional usando solo los sensores top
        try:
            epicentro_x, epicentro_y = calcular_epicentro(top_x, top_y, top_z)
        except Exception as e:
            logger.warning(
                f"Error en cálculo de epicentro tradicional, usando fallback: {e}"
            )
            max_idx_top = np.argmax(top_z)
            epicentro_x, epicentro_y = top_x[max_idx_top], top_y[max_idx_top]

        # Calcular sensor con valor máximo (global)
        max_idx = np.argmax(z)
        max_sensor_x = x[max_idx]
        max_sensor_y = y[max_idx]
        max_value = z[max_idx]

        # Preparar datos de top sensores
        top_sensors = []
        for rank, idx in enumerate(top_indices, start=1):
            # Obtener micro_id real si está disponible en sensor_info
            micro_id = f"sensor_{idx}"
            location_name = None
            if sensor_info is not None and idx < len(sensor_info):
                micro_id = sensor_info[idx].get("micro_id", micro_id)
                location_name = sensor_info[idx].get("location_name")

            sensor_data = {
                "micro_id": micro_id,
                "latitude": float(y[idx]),
                "longitude": float(x[idx]),
                "value": float(z[idx]),
                "rank": rank,
            }

            if location_name:
                sensor_data["location_name"] = location_name

            top_sensors.append(sensor_data)

        # Calcular zona circular basada en los 3 sensores con mayor ruido
        zone_center_x = 0.0
        zone_center_y = 0.0
        zone_radius = 0.0

        if len(top_x) > 0:
            # Centro de zona: promedio de coordenadas de los top sensores
            zone_center_x = float(np.mean(top_x))
            zone_center_y = float(np.mean(top_y))

            # Radio: distancia máxima desde el centro a cualquier sensor top, más margen
            distances = np.sqrt(
                (top_x - zone_center_x) ** 2 + (top_y - zone_center_y) ** 2
            )
            if len(distances) > 0:
                zone_radius = float(np.max(distances)) + 0.2  # +0.2 metros de margen
            else:
                zone_radius = 1.0  # Radio por defecto

        # Construir respuesta con todos los campos extendidos
        result = {
            "latitude": float(epicentro_y),
            "longitude": float(epicentro_x),
            "max_sensor_latitude": float(max_sensor_y),
            "max_sensor_longitude": float(max_sensor_x),
            "max_value": float(max_value),
            "sensor_count": len(x),
            "calculated_at": datetime.now().isoformat(),
            # Campos extendidos para zona epicentral
            "top_sensors": top_sensors,
            "zone_type": "circle",
            "zone_radius": zone_radius,
            "zone_center_latitude": zone_center_y,
            "zone_center_longitude": zone_center_x,
            "zone_vertices": None,  # No necesario para círculo
        }

        logger.info(
            f"Epicentro extendido calculado: top_sensors={len(top_sensors) if top_sensors else 0}, zone_type={result['zone_type']}, zone_radius={result['zone_radius']}, zone_center=({result['zone_center_latitude']}, {result['zone_center_longitude']})"
        )
        logger.info(f"Resultado completo: {result}")
        return result

    except Exception as e:
        logger.error(f"Error calculando epicentro extendido: {e}")

        # Fallback mínimo: usar el sensor con valor máximo
        try:
            max_idx = np.argmax(z)
            # Obtener micro_id real si está disponible
            micro_id = f"sensor_{max_idx}"
            if sensor_info is not None and max_idx < len(sensor_info):
                micro_id = sensor_info[max_idx].get("micro_id", micro_id)

            return {
                "latitude": float(y[max_idx]),
                "longitude": float(x[max_idx]),
                "max_sensor_latitude": float(y[max_idx]),
                "max_sensor_longitude": float(x[max_idx]),
                "max_value": float(z[max_idx]),
                "sensor_count": len(x),
                "calculated_at": datetime.now().isoformat(),
                "fallback": True,
                "top_sensors": [
                    {
                        "micro_id": micro_id,
                        "latitude": float(y[max_idx]),
                        "longitude": float(x[max_idx]),
                        "value": float(z[max_idx]),
                        "rank": 1,
                    }
                ],
                "zone_type": "circle",
                "zone_radius": 1.0,
                "zone_center_latitude": float(y[max_idx]),
                "zone_center_longitude": float(x[max_idx]),
                "zone_vertices": None,
            }
        except Exception as e2:
            logger.error(f"Error en fallback de epicentro: {e2}")
            return None
