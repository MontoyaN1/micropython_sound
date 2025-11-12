import pandas as pd
import plotly.graph_objects as go
import time
from dash import Input, Output

from ..utils.distribucion_idw import generar_distribucion_idw_cached
from ..utils.epicentro import calcular_epicentro_cached


def registrar_callback_mapa(app):
    @app.callback(
        Output("mapa-sensores", "figure"),
        [
            Input("datos-procesados", "data"),
            Input("tipo-visualizacion", "value"),
            Input("esquema-color", "value"),
            Input("opacidad", "value"),
            Input("potencia-idw", "value"),
        ],
    )
    def actualizar_mapa_sincronizado(
        datos_procesados, tipo_visualizacion, esquema_color, opacidad, potencia_idw
    ):
        time.sleep(0.2)  # Pequeño delay para sincronización
        return actualizar_mapa(
            datos_procesados, tipo_visualizacion, esquema_color, opacidad, potencia_idw
        )

    def actualizar_mapa(
        datos_procesados, tipo_visualizacion, esquema_color, opacidad, potencia_idw
    ):
        if esquema_color is None:
            esquema_color = "Plasma"
        if tipo_visualizacion is None:
            tipo_visualizacion = "contour"
        if opacidad is None:
            opacidad = 0.6
        if potencia_idw is None:
            potencia_idw = 2.0

        """Actualizar el mapa"""
        df = pd.DataFrame(datos_procesados) if datos_procesados else pd.DataFrame()

        if df.empty:
            return go.Figure().add_annotation(
                text="⏳ Esperando datos de sensores...",
                xref="paper",
                yref="paper",
                x=0.5,
                y=0.5,
                xanchor="center",
                yanchor="middle",
                showarrow=False,
                font=dict(size=20),
            )

        x = df["x"].values
        y = df["y"].values
        z = df["ruido"].values
        ids = df["id"].values

        # Configurar límites del mapa
        x_margin = (max(x) - min(x)) * 0.2 if len(x) > 1 else 0.1
        y_margin = (max(y) - min(y)) * 0.2 if len(y) > 1 else 0.1

        x_min, x_max = min(x) - x_margin, max(x) + x_margin
        y_min, y_max = min(y) - y_margin, max(y) + y_margin

        fig = go.Figure()

        # Interpolación IDW
        if len(df) >= 2 and tipo_visualizacion in ["heatmap", "contour"]:
            try:
                # CONVERTIR a tuples para cache - AGREGAR ESTAS 3 LÍNEAS
                x_tuple = tuple(x.round(6).tolist())
                y_tuple = tuple(y.round(6).tolist())
                z_tuple = tuple(z.round(2).tolist())

                xi, yi, zi = generar_distribucion_idw_cached(
                    x_tuple,
                    y_tuple,
                    z_tuple,
                    x_min,
                    x_max,
                    y_min,
                    y_max,
                    potencia_idw,  # ← Usar los tuples
                )

                if tipo_visualizacion == "heatmap":
                    fig.add_trace(
                        go.Heatmap(
                            x=xi[0],
                            y=yi[:, 0],
                            z=zi,
                            colorscale=esquema_color.lower(),
                            opacity=opacidad,
                            hoverinfo="none",
                        )
                    )
                elif tipo_visualizacion == "contour":
                    fig.add_trace(
                        go.Contour(
                            x=xi[0],
                            y=yi[:, 0],
                            z=zi,
                            colorscale=esquema_color.lower(),
                            opacity=opacidad,
                            contours=dict(showlabels=True),
                            hoverinfo="none",
                        )
                    )
            except Exception as e:
                print(f"Error en interpolación: {e}")

        # Puntos de sensores
        colors = []
        for nivel in z:
            if nivel < 50:
                colors.append("green")
            elif nivel < 70:
                colors.append("orange")
            elif nivel < 85:
                colors.append("darkorange")
            else:
                colors.append("red")

        fig.add_trace(
            go.Scatter(
                x=x,
                y=y,
                mode="markers+text",
                marker=dict(size=15, color=colors, line=dict(width=2, color="black")),
                text=[f"S{id}" for id in ids],
                textposition="top center",
                hovertemplate=(
                    "Sensor: S%{text}<br>"
                    + "Posición: (%{x:.4f}, %{y:.4f})<br>"
                    + "Ruido: %{customdata:.1f} dB<extra></extra>"
                ),
                customdata=z,
            )
        )

        if len(z) >= 2:
            # CONVERTIR a tuples para cache - AGREGAR ESTAS 3 LÍNEAS
            x_tuple = tuple(x.round(6).tolist())
            y_tuple = tuple(y.round(6).tolist())
            z_tuple = tuple(z.round(2).tolist())

            epicentro_x, epicentro_y = calcular_epicentro_cached(
                x_tuple, y_tuple, z_tuple
            )  # ← Usar los tuples

            fig.add_trace(
                go.Scatter(
                    x=[epicentro_x],
                    y=[epicentro_y],
                    mode="markers",
                    marker=dict(
                        size=20,
                        symbol="star",
                        color="red",
                        line=dict(width=2, color="darkred"),
                    ),
                    name="Epicentro Estimados",
                    hovertemplate=(
                        "Epicentro Estimado<br>"
                        + "Posición: (%{x:.4f}, %{y:.4f})<extra></extra>"
                    ),
                )
            )

        fig.update_layout(
            title=f"Mapa de {len(df)} Sensores - Niveles de Ruido",
            xaxis_title="Longitud",
            yaxis_title="Latitud",
            showlegend=True,
            hovermode="closest",
            xaxis=dict(range=[x_min, x_max], scaleanchor="y", scaleratio=1),
            yaxis=dict(range=[y_min, y_max]),
            height=600,
            coloraxis_colorbar=dict(
                x=0,  # Lado izquierdo
                xanchor="left",
                yanchor="middle",
                y=0.5,
                len=0.7,
                thickness=15,
                title=dict(text="dB", side="right"),
            ),
            margin=dict(l=80, r=50, t=50, b=50),
        )

        return fig
