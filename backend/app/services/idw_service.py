import numpy as np
from typing import Dict, Any, Optional
import logging

from app.utils.distribucion_idw import generar_distribucion_idw

logger = logging.getLogger(__name__)

def calculate_idw(
    x: np.ndarray,
    y: np.ndarray,
    z: np.ndarray,
    grid_size: int = 50,
    power: float = 2.0,
    margin_percent: float = 0.1
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
        # Calcular límites con margen
        x_min, x_max = x.min(), x.max()
        y_min, y_max = y.min(), y.max()
        
        x_range = x_max - x_min
        y_range = y_max - y_min
        
        # Añadir margen
        x_margin = x_range * margin_percent
        y_margin = y_range * margin_percent
        
        x_min -= x_margin
        x_max += x_margin
        y_min -= y_margin
        y_max += y_margin
        
        # Para coordenadas relativas, limitar al tamaño del plano (0-5, 0-14)
        # Pero mantener margen para visualización
        x_min = max(x_min, -1.0)  # Permitir margen negativo
        x_max = min(x_max, 6.0)   # Permitir margen positivo
        y_min = max(y_min, -2.0)  # Permitir margen negativo
        y_max = min(y_max, 16.0)  # Permitir margen positivo
        
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