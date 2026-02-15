import yaml
import os
from typing import Dict, Any, Optional, Tuple
import logging

logger = logging.getLogger(__name__)

def micro_id_to_key(micro_id: str) -> str:
    """Convertir micro_id del payload (ej. 'E1') a clave del YAML (ej. 'micro_E1')"""
    if micro_id.startswith("micro_"):
        return micro_id
    return f"micro_{micro_id}"

def load_sensors_config() -> Dict[str, Any]:
    """Cargar configuración de sensores desde YAML"""
    # Buscar en múltiples ubicaciones posibles (prioridad: Docker -> desarrollo local)
    config_paths = [
        "/app/location/sensores.yaml",  # Docker (montado como volumen)
        "./location/sensores.yaml",      # Desarrollo local
        "../location/sensores.yaml",     # Desarrollo desde subdirectorio
        "location/sensores.yaml",        # Desarrollo desde raíz
    ]
    
    loaded_path = None
    config = None
    
    for config_path in config_paths:
        try:
            with open(config_path, "r") as file:
                config = yaml.safe_load(file)
                loaded_path = config_path
                logger.info(f"Configuración de sensores cargada desde {config_path}")
                break
        except FileNotFoundError:
            continue
        except Exception as e:
            logger.error(f"Error cargando configuración desde {config_path}: {e}")
            continue
    
    if config is None:
        logger.error("No se pudo cargar configuración de sensores desde ninguna ubicación")
        return {"microcontrollers": {}}
    
    # Normalizar formato: siempre usar 'microcontrollers'
    if "microcontrollers" in config:
        logger.debug(f"Formato 'microcontrollers' encontrado en {loaded_path}")
        return config
    elif "sensores" in config:
        logger.info(f"Convirtiendo formato 'sensores' a 'microcontrollers' desde {loaded_path}")
        # Convertir formato nuevo a antiguo
        new_config = {"microcontrollers": {}}
        for micro_key, micro_data in config["sensores"].items():
            new_config["microcontrollers"][micro_key] = {
                "location": micro_data["ubicacion_base"],
                "room": micro_data.get("nombre_zona", f"Zona - {micro_key.replace('micro_', '')}"),
                "coordinates_type": micro_data.get("coordinates_type", "relative")
            }
        return new_config
    else:
        logger.warning(f"Formato desconocido en {loaded_path}, usando vacío")
        return {"microcontrollers": {}}

# Cache para configuración con timeout
_config_cache = None
_config_last_loaded = 0
_CONFIG_CACHE_TIMEOUT = 5  # segundos

def get_sensor_coordinates(micro_id: str, sample: Optional[int] = None) -> Tuple[float, float, str]:
    """
    Obtener coordenadas y nombre de ubicación para un micro.
    Ignora el sample ya que cada micro tiene un solo sensor en la misma ubicación.
    
    Args:
        micro_id: ID del microcontrolador (ej. "E1", "E255")
        sample: Ignorado (mantenido por compatibilidad)
    
    Returns:
        Tuple (latitude, longitude, location_name)
        Para coordenadas relativas: (y, x, location_name) donde:
          - x: metros desde derecha (0-5) - 0=derecha, 5=izquierda
          - y: metros desde abajo (0-14) - 0=abajo, 14=arriba
    """
    global _config_cache, _config_last_loaded
    
    # Recargar configuración si ha pasado el timeout (5 segundos)
    import time
    current_time = time.time()
    if _config_cache is None or (current_time - _config_last_loaded) > _CONFIG_CACHE_TIMEOUT:
        _config_cache = load_sensors_config()
        _config_last_loaded = current_time
        logger.debug(f"Configuración recargada desde disco (cache timeout)")
    
    config = _config_cache
    micro_key = micro_id_to_key(micro_id)
    
    # Buscar en microcontrollers (formato normalizado)
    microcontrollers_config = config.get("microcontrollers", {})
    
    if micro_key not in microcontrollers_config:
        # Valores por defecto para coordenadas relativas (centro del plano)
        logger.warning(f"Micro {micro_id} no encontrado en configuración, usando valores por defecto")
        return 7.0, 2.5, f"Desconocido - {micro_id}"
    
    micro_config = microcontrollers_config[micro_key]
    coordinates_type = micro_config.get("coordinates_type", "relative")  # Default a relative
    
    if coordinates_type == "relative":
        # Formato: location = [x, y] en metros
        # x: 0-5m (derecha=0, izquierda=5)
        # y: 0-14m (abajo=0, arriba=14)
        x, y = micro_config["location"]
        location_name = micro_config.get("room", f"Zona - {micro_id}")
        
        # Devolvemos (y, x) para mantener compatibilidad con frontend
        # Frontend espera: latitude = y, longitude = x
        # Sistema: (0,0) = esquina inferior derecha
        return float(y), float(x), location_name
    else:
        # Coordenadas GPS tradicionales
        lat, lon = micro_config["location"]
        location_name = micro_config.get("room", f"Zona - {micro_id}")
        return float(lat), float(lon), location_name

def get_all_sensors() -> Dict[str, Dict[str, Any]]:
    """Obtener información de todos los sensores configurados"""
    config = load_sensors_config()
    result = {}
    
    for micro_key, micro_config in config.get("sensores", {}).items():
        # Extraer micro_id del key (micro_E1 -> E1)
        micro_id = micro_key.replace("micro_", "")
        
        lat, lon = micro_config["ubicacion_base"]
        
        # Un solo sensor por micro (sample 0)
        sensor_info = {
            "micro_id": micro_id,
            "micro_name": micro_key,
            "sensor_id": micro_id,
            "sample": 0,
            "latitude": lat,
            "longitude": lon,
            "location_name": micro_config["nombre_zona"],
            "base_latitude": lat,
            "base_longitude": lon,
        }
        result[micro_id] = sensor_info
    
    return result