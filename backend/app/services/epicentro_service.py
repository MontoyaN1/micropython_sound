import numpy as np
from typing import Dict, Any, Optional, Tuple
import logging

from app.utils.epicentro import calcular_epicentro

logger = logging.getLogger(__name__)

def calculate_epicenter(
    x: np.ndarray,
    y: np.ndarray,
    z: np.ndarray
) -> Optional[Dict[str, Any]]:
    """
    Calcular epicentro (punto de mayor intensidad) basado en los datos de sensores.
    
    Args:
        x: Array de coordenadas X (longitudes)
        y: Array de coordenadas Y (latitudes)
        z: Array de valores (niveles de ruido)
    
    Returns:
        Diccionario con latitud y longitud del epicentro, o None en caso de error
    """
    if len(x) < 2:
        logger.warning("Se necesitan al menos 2 puntos para calcular epicentro")
        return None
    
    try:
        # Usar la función existente de epicentro
        try:
            epicentro_x, epicentro_y = calcular_epicentro(x, y, z)
        except Exception as e:
            logger.warning(f"Error en cálculo de epicentro, usando fallback: {e}")
            max_idx = np.argmax(z)
            epicentro_x, epicentro_y = x[max_idx], y[max_idx]
        
        # También calcular el sensor con valor máximo como alternativa
        max_idx = np.argmax(z)
        max_sensor_x = x[max_idx]
        max_sensor_y = y[max_idx]
        max_value = z[max_idx]
        
        return {
            "latitude": float(epicentro_y),
            "longitude": float(epicentro_x),
            "max_sensor_latitude": float(max_sensor_y),
            "max_sensor_longitude": float(max_sensor_x),
            "max_value": float(max_value),
            "sensor_count": len(x)
        }
        
    except Exception as e:
        logger.error(f"Error calculando epicentro: {e}")
        
        # Fallback: usar el sensor con valor máximo
        try:
            max_idx = np.argmax(z)
            return {
                "latitude": float(y[max_idx]),
                "longitude": float(x[max_idx]),
                "max_sensor_latitude": float(y[max_idx]),
                "max_sensor_longitude": float(x[max_idx]),
                "max_value": float(z[max_idx]),
                "sensor_count": len(x),
                "fallback": True
            }
        except Exception as e2:
            logger.error(f"Error en fallback de epicentro: {e2}")
            return None