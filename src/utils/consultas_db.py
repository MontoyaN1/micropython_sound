from ..config import INFLUXDB_TOKEN, INFLUXDB_URL, INFLUXDB_ORG
import influxdb_client
import pandas as pd


def obtener_datos_influxdb():
    """Obtener datos reales de InfluxDB - Mismo código"""
    try:
        client = influxdb_client.InfluxDBClient(
            url=INFLUXDB_URL, token=INFLUXDB_TOKEN, org=INFLUXDB_ORG
        )
        query_api = client.query_api()

        query = """
        from(bucket: "a")
          |> range(start: -5m)
          |> filter(fn: (r) => r._field == "value" or r._field == "latitude" or r._field == "longitude")
        """

        tables = query_api.query(query)
        sensores_dict = {}

        for table in tables:
            for record in table.records:
                sensor_name = record.values.get("_measurement", "unknown")

                sensor_mapping = {
                    "sensor1": 1,
                    "sensor2": 2,
                    "sensor3": 3,
                    "sensor4": 4,
                    "sensor5": 5,
                    "sensor6": 6,
                    "sensor7": 7,
                    "sensor8": 8,
                }
                sensor_id = sensor_mapping.get(sensor_name, 0)

                location_mapping = {
                    1: {"micro_id": "MIC001", "location_name": "Zona Norte"},
                    2: {"micro_id": "MIC001", "location_name": "Zona Sur"},
                    3: {"micro_id": "MIC003", "location_name": "Zona Este"},
                    4: {"micro_id": "MIC004", "location_name": "Zona Oeste"},
                    5: {"micro_id": "MIC005", "location_name": "Centro"},
                    6: {"micro_id": "MIC006", "location_name": "Periferia N"},
                    7: {"micro_id": "MIC007", "location_name": "Periferia S"},
                    8: {"micro_id": "MIC008", "location_name": "Periferia E"},
                }
                location_info = location_mapping.get(
                    sensor_id,
                    {
                        "micro_id": f"MIC{sensor_id:03d}",
                        "location_name": f"Zona {sensor_id}",
                    },
                )

                key = f"{sensor_name}_{record.get_time().timestamp()}"
                if key not in sensores_dict:
                    sensores_dict[key] = {
                        "time": record.get_time(),
                        "sensor_id": sensor_id,
                        "micro_id": location_info["micro_id"],
                        "location_name": location_info["location_name"],
                        "measurement": sensor_name,
                        "value": None,
                        "latitude": None,
                        "longitude": None,
                    }

                field = record.get_field()
                value = record.get_value()
                if field == "value":
                    sensores_dict[key]["value"] = value
                elif field == "latitude":
                    sensores_dict[key]["latitude"] = value
                elif field == "longitude":
                    sensores_dict[key]["longitude"] = value

        sensores = []
        for key, data in sensores_dict.items():
            if (
                data["latitude"] is not None
                and data["longitude"] is not None
                and data["value"] is not None
            ):
                sensores.append(data)

        return pd.DataFrame(sensores)

    except Exception as e:
        print(f"Error conectando a InfluxDB: {e}")
        return pd.DataFrame()
