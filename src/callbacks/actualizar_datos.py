from datetime import datetime
from dash import Input, Output
import dash

from ..utils.consultas_db import obtener_datos_influxdb
from ..utils.procesar_mapa import procesar_datos_para_mapa


def registrar_callback_datos(app):
    @app.callback(
        [
            Output("datos-raw", "data"),
            Output("datos-procesados", "data"),
            Output("ultima-actualizacion", "data"),
        ],
        Input("interval-component", "n_intervals"),
    )
    def actualizar_datos(n):
        """Actualizar datos automáticamente cada 5 segundos"""
        try:
            datos_raw = obtener_datos_influxdb()
            datos_procesados = procesar_datos_para_mapa(datos_raw)
            ultima_actualizacion = datetime.now().strftime("%H:%M:%S")

            return (
                datos_raw.to_dict("records") if not datos_raw.empty else [],
                datos_procesados.to_dict("records")
                if not datos_procesados.empty
                else [],
                ultima_actualizacion,
            )
        except Exception as e:
            print(f"Error actualizando datos: {e}")
            return dash.no_update, dash.no_update, dash.no_update
