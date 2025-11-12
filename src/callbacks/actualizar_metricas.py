from dash import Input, Output, html
import pandas as pd


def registrar_callbacks_metricas(app):
    @app.callback(
        [
            Output("metric-sensores", "children"),
            Output("metric-lecturas", "children"),
            Output("metric-actualizacion", "children"),
            Output("metric-ruido-max", "children"),
            Output("metric-ruido-prom", "children"),
        ],
        [
            Input("datos-procesados", "data"),
            Input("datos-raw", "data"),
            Input("ultima-actualizacion", "data"),
        ],
    )
    def actualizar_metricas(datos_procesados, datos_raw, ultima_actualizacion):
        """Actualizar las métricas"""
        df_procesados = (
            pd.DataFrame(datos_procesados) if datos_procesados else pd.DataFrame()
        )
        df_raw = pd.DataFrame(datos_raw) if datos_raw else pd.DataFrame()

        sensores_activos = len(df_procesados)
        total_lecturas = len(df_raw)

        if not df_procesados.empty and "ruido" in df_procesados.columns:
            ruido_max = f"{df_procesados['ruido'].max():.1f} dB"
            ruido_prom = f"{df_procesados['ruido'].mean():.1f} dB"
        else:
            ruido_max = "N/A"
            ruido_prom = "N/A"

        metricas = [
            # Sensores activos
            html.Div(
                [
                    html.Div("📡 Sensores Activos", className="metric-label"),
                    html.Div(str(sensores_activos), className="metric-value"),
                ]
            ),
            # Total lecturas
            html.Div(
                [
                    html.Div("📊 Total Lecturas", className="metric-label"),
                    html.Div(str(total_lecturas), className="metric-value"),
                ]
            ),
            # Última actualización
            html.Div(
                [
                    html.Div("🕐 Última Actualización", className="metric-label"),
                    html.Div(ultima_actualizacion, className="metric-value"),
                ]
            ),
            # Ruido máximo
            html.Div(
                [
                    html.Div("🔊 Ruido Máximo", className="metric-label"),
                    html.Div(ruido_max, className="metric-value"),
                ]
            ),
            # Ruido promedio
            html.Div(
                [
                    html.Div("📈 Ruido Promedio", className="metric-label"),
                    html.Div(ruido_prom, className="metric-value"),
                ]
            ),
        ]

        return metricas
