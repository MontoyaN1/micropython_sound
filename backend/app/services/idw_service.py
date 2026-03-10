import numpy as np
from typing import Dict, Any, Optional
import logging

from app.utils.distribucion_idw import generar_distribucion_idw

logger = logging.getLogger(__name__)

def calculate_idw(
    x: np.ndarray,
    y: np.ndarray,
    z: np.ndarray,
    grid_size: int = 60,
    power: float = 2.0,
    margin_percent: float = 0.0
) -> Optional[Dict[str, Any]]:
    """
    Calcular interpolación IDW para un conjunto de puntos.
    
    Args:
        x: Array de coordenadas X (longitudes)
        y: Array de coordenadas Y (latitudes)
        z: Array de valores (niveles de ruido)
        grid_size: Número de puntos en la grilla (grid_size x grid_size)
        power: Potencia para IDW (default 2)
        margin_percent: Porcentaje de margen alrededor de los puntos
    
    Returns:
        Diccionario con xi, yi, zi y límites, o None en caso de error
    """
    if len(x) < 2:
        logger.warning("Se necesitan al menos 2 puntos para interpolación IDW")
        return None
    
    try:
        # Usar el plano completo de baldosas (0-57 en X, 0-66 en Y)
        # para que el mapa de calor cubra toda el área
        x_min = 0.0
        x_max = 57.0
        y_min = 0.0
        y_max = 66.0
        
        # Generar distribución IDW
        xi, yi, zi = generar_distribucion_idw(
            x, y, z,
            x_min, x_max, y_min, y_max,
            power=int(power)
        )
        
        return {
            "xi": xi,
            "yi": yi,
            "zi": zi,
            "x_min": x_min,
            "x_max": x_max,
            "y_min": y_min,
            "y_max": y_max,
            "grid_size": grid_size,
            "power": power
        }
        
    except Exception as e:
        logger.error(f"Error calculando IDW: {e}")
        return None