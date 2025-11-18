import pandas as pd


def procesar_datos_para_mapa(df):
    """Procesar los datos para el mapa - Mismo código"""
    if df.empty:
        return pd.DataFrame()

    df_recent = (
        df.sort_values("time")
        .groupby(["sensor_id", "measurement"])
        .last()
        .reset_index()
    )

    datos_mapa = []
    for _, row in df_recent.iterrows():
        datos_mapa.append(
            {
                "id": row["sensor_id"],
                "measurement": row["measurement"],
                "x": float(row["longitude"]),
                "y": float(row["latitude"]),
                "ruido": float(row["value"]),
                "micro_id": row["micro_id"],
                "location": row["location_name"],
            }
        )

    return pd.DataFrame(datos_mapa)
