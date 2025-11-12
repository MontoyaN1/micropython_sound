import numpy as np
from scipy.optimize import minimize
from functools import lru_cache



def calcular_epicentro(x, y, z):
    """Calcular epicentro usando optimización - Mismo código"""

    def error_function(point):
        px, py = point
        error = 0
        for i in range(len(x)):
            dist = np.sqrt((px - x[i]) ** 2 + (py - y[i]) ** 2)
            expected_value = z[i] * np.exp(-dist / 10.0)
            error += (z[i] - expected_value) ** 2
        return error

    initial_guess = [np.mean(x), np.mean(y)]
    bounds = [(min(x), max(x)), (min(y), max(y))]
    result = minimize(error_function, initial_guess, bounds=bounds, method="L-BFGS-B")
    return result.x[0], result.x[1] if result.success else (
        x[np.argmax(z)],
        y[np.argmax(z)],
    )
@lru_cache(maxsize=5)  # ← Cache para 5 resultados diferentes  
def calcular_epicentro_cached(x_tuple, y_tuple, z_tuple):
    """
    Versión cacheada del cálculo de epicentro
    """
    x = np.array(x_tuple)
    y = np.array(y_tuple)
    z = np.array(z_tuple)
    
    return calcular_epicentro(x, y, z)