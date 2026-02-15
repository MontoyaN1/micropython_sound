import numpy as np
from functools import lru_cache

def generar_distribucion_idw(x, y, z, x_min, x_max, y_min, y_max, power=2):
    """Generar distribución usando Inverse Distance Weighting - Mismo código"""
    xi = np.linspace(x_min, x_max, 50)
    yi = np.linspace(y_min, y_max, 50)
    xi, yi = np.meshgrid(xi, yi)

    zi = np.zeros_like(xi)
    weight_sum = np.zeros_like(xi)

    for i in range(len(x)):
        dist = np.sqrt((xi - x[i]) ** 2 + (yi - y[i]) ** 2)
        dist = np.maximum(dist, 0.01)
        weight = 1.0 / (dist**power)
        zi += weight * z[i]
        weight_sum += weight

    zi = zi / weight_sum
    return xi, yi, zi

@lru_cache(maxsize=10)  # ← Cache para 10 resultados diferentes
def generar_distribucion_idw_cached(x_tuple, y_tuple, z_tuple, x_min, x_max, y_min, y_max, power=2):
    """
    Versión cacheada - Convierte arrays a tuples para poder cachear
    """
    # Convertir tuples back a arrays numpy
    x = np.array(x_tuple)
    y = np.array(y_tuple) 
    z = np.array(z_tuple)
    
    return generar_distribucion_idw(x, y, z, x_min, x_max, y_min, y_max, power)
