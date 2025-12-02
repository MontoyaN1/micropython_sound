from ..config import INFLUXDB_TOKEN, INFLUXDB_URL, INFLUXDB_ORG
import influxdb_client
import pandas as pd
import yaml


def cargar_configuracion():
    """Cargar configuración de sensores desde YAML"""
    with open("config/sensores.yaml", "r") as file:
        return yaml.safe_load(file)


def obtener_datos_influxdb():
    """Obtener datos y añadir coordenadas desde configuración"""
    try:
        client = influxdb_client.InfluxDBClient(
            url=INFLUXDB_URL, token=INFLUXDB_TOKEN, org=INFLUXDB_ORG
        )
        query_api = client.query_api()

        # Consulta para TODOS los sensores
        query = """
        from(bucket: "sensores")
          |> range(start: -5h)
          |> filter(fn: (r) => r["_measurement"] == "sonido" and r["_field"] == "valor")
          |> aggregateWindow(every: 30s, fn: mean)
        """

        tables = query_api.query(query)
        config = cargar_configuracion()
        datos = []

        for table in tables:
            for record in table.records:
                micro_id = record.values.get("micro_id")
                sensor_id = record.values.get("sensor_id")

                # Buscar en configuración
                if micro_id in config["sensores"]:
                    micro_config = config["sensores"][micro_id]
                    base_lat, base_lon = micro_config["ubicacion_base"]

                    if sensor_id in micro_config["sensores"]:
                        sensor_config = micro_config["sensores"][sensor_id]
                        offset_lon, offset_lat = sensor_config["offset"]
                        lat = offset_lat
                        lon = offset_lon
                        location_name = (
                            f"{micro_config['nombre_zona']} - {sensor_config['nombre']}"
                        )
                        sensor_num = sensor_config["id"]
                    else:
                        lat, lon = base_lat, base_lon
                        location_name = f"{micro_config['nombre_zona']} - {sensor_id}"
                        sensor_num = 0
                else:
                    # Valores por defecto
                    lat, lon = 4.609710, -74.081749
                    location_name = f"Desconocido - {micro_id}"
                    sensor_num = 0

                datos.append(
                    {
                        "time": record.get_time(),
                        "micro_id": micro_id,
                        "sensor_id": sensor_id,
                        "measurement": "sonido",
                        "value": record.get_value(),
                        "location_name": location_name,
                        "latitude": lat,
                        "longitude": lon,
                        "sensor_numero": sensor_num,
                    }
                )

        return pd.DataFrame(datos)

    except Exception as e:
        print(f"Error: {e}")
        return pd.DataFrame()
