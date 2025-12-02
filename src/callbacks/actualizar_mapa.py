import pandas as pd
import plotly.graph_objects as go
import time
from dash import Input, Output
import numpy as np
import traceback

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
        time.sleep(0.2)
        return actualizar_mapa(
            datos_procesados, tipo_visualizacion, esquema_color, opacidad, potencia_idw
        )

    def actualizar_mapa(
        datos_procesados, tipo_visualizacion, esquema_color, opacidad, potencia_idw
    ):
        print(f"\n{'='*60}")
        print("DEBUG: INICIANDO ACTUALIZACIÓN DE MAPA")
        print(f"{'='*60}")
        
        try:
            if esquema_color is None:
                esquema_color = "Plasma"
            if tipo_visualizacion is None:
                tipo_visualizacion = "contour"
            if opacidad is None:
                opacidad = 0.6
            if potencia_idw is None:
                potencia_idw = 2.0

            print(f"Parámetros recibidos: tipo={tipo_visualizacion}, color={esquema_color}, "
                  f"opacidad={opacidad}, potencia_idw={potencia_idw}")

            """Actualizar el mapa"""
            df = pd.DataFrame(datos_procesados) if datos_procesados else pd.DataFrame()

            print(f"Datos recibidos: {len(df)} registros")
            if not df.empty:
                print(f"Columnas disponibles: {df.columns.tolist()}")
                print(f"Primeras 3 filas:")
                print(df.head(3).to_string())

            if df.empty:
                print("DataFrame vacío, retornando mapa vacío")
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

            # Asegurar nombres de columnas (mantener compatibilidad)
            if "x" not in df.columns and "longitude" in df.columns:
                print("Renombrando 'longitude' a 'x'")
                df = df.rename(columns={"longitude": "x"})
            if "y" not in df.columns and "latitude" in df.columns:
                print("Renombrando 'latitude' a 'y'")
                df = df.rename(columns={"latitude": "y"})
            if "ruido" not in df.columns:
                if "value" in df.columns:
                    print("Renombrando 'value' a 'ruido'")
                    df = df.rename(columns={"value": "ruido"})
                elif "valor" in df.columns:
                    print("Renombrando 'valor' a 'ruido'")
                    df = df.rename(columns={"valor": "ruido"})

            # Verificar columnas requeridas
            required_columns = ['x', 'y', 'ruido']
            missing_columns = [col for col in required_columns if col not in df.columns]
            if missing_columns:
                print(f"ERROR: Faltan columnas requeridas: {missing_columns}")
                return crear_figura_error(f"Faltan columnas: {missing_columns}")

            x = df["x"].values.astype(float)
            y = df["y"].values.astype(float)
            z = df["ruido"].values.astype(float)

            print(f"\nDatos numéricos extraídos:")
            print(f"x: shape={x.shape}, valores={x}")
            print(f"y: shape={y.shape}, valores={y}")
            print(f"z: shape={z.shape}, valores={z}")
            print(f"Rango x: [{x.min():.4f}, {x.max():.4f}]")
            print(f"Rango y: [{y.min():.4f}, {y.max():.4f}]")
            print(f"Rango z: [{z.min():.2f}, {z.max():.2f}]")

            # IDs - mantener tu formato original
            if "id" in df.columns:
                ids = df["id"].values
            else:
                ids = range(1, len(df) + 1)

            MARGIN_PERCENT = 0.9
            print(f"\nCalculando límites con margen del {MARGIN_PERCENT*100}%")

            # Configurar límites del mapa
            if len(x) > 1:
                x_margin = (max(x) - min(x)) * MARGIN_PERCENT
            else:
                x_margin = 0.1

            if len(y) > 1:
                y_margin = (max(y) - min(y)) * MARGIN_PERCENT
            else:
                y_margin = 0.1

            x_min, x_max = min(x) - x_margin, max(x) + x_margin
            y_min, y_max = min(y) - y_margin, max(y) + y_margin

            print(f"Límites iniciales: x=[{x_min:.4f}, {x_max:.4f}], y=[{y_min:.4f}, {y_max:.4f}]")

            x_range = x_max - x_min
            y_range = y_max - y_min
            print(f"Rangos iniciales: x_range={x_range:.4f}, y_range={y_range:.4f}")

            # Ajustar para hacer cuadrado
            if x_range > y_range:
                diff = (x_range - y_range) / 2
                y_min -= diff
                y_max += diff
                print(f"Expandido Y en {diff:.4f} para hacer cuadrado")
            elif y_range > x_range:
                diff = (y_range - x_range) / 2
                x_min -= diff
                x_max += diff
                print(f"Expandido X en {diff:.4f} para hacer cuadrado")

            print(f"Límites finales (cuadrado): x=[{x_min:.4f}, {x_max:.4f}], y=[{y_min:.4f}, {y_max:.4f}]")

            fig = go.Figure()

            # Interpolación IDW
            if len(df) >= 2 and tipo_visualizacion in ["heatmap", "contour"]:
                print(f"\n=== INICIANDO INTERPOLACIÓN IDW ===")
                print(f"Condición: len(df)={len(df)} >= 2 y tipo={tipo_visualizacion} en ['heatmap','contour']")
                
                try:
                    # CONVERTIR a tuples para cache
                    x_tuple = tuple(x.round(6).tolist())
                    y_tuple = tuple(y.round(6).tolist())
                    z_tuple = tuple(z.round(2).tolist())

                    print(f"Datos para IDW:")
                    print(f"  x_tuple (primeros 3): {x_tuple[:3]}")
                    print(f"  y_tuple (primeros 3): {y_tuple[:3]}")
                    print(f"  z_tuple (primeros 3): {z_tuple[:3]}")
                    print(f"  x_min: {x_min}, x_max: {x_max}")
                    print(f"  y_min: {y_min}, y_max: {y_max}")
                    print(f"  potencia_idw: {potencia_idw}")

                    print("\nLlamando a generar_distribucion_idw_cached...")
                    xi, yi, zi = generar_distribucion_idw_cached(
                        x_tuple,
                        y_tuple,
                        z_tuple,
                        x_min,
                        x_max,
                        y_min,
                        y_max,
                        potencia_idw,
                    )

                    print(f"Resultado IDW recibido:")
                    print(f"  xi tipo: {type(xi)}, shape: {xi.shape if hasattr(xi, 'shape') else 'No shape'}")
                    print(f"  yi tipo: {type(yi)}, shape: {yi.shape if hasattr(yi, 'shape') else 'No shape'}")
                    print(f"  zi tipo: {type(zi)}, shape: {zi.shape if hasattr(zi, 'shape') else 'No shape'}")

                    if xi is not None and yi is not None and zi is not None:
                        if hasattr(xi, 'shape'):
                            print(f"  xi shape: {xi.shape}")
                        if hasattr(yi, 'shape'):
                            print(f"  yi shape: {yi.shape}")
                        if hasattr(zi, 'shape'):
                            print(f"  zi shape: {zi.shape}")
                            print(f"  zi valores min/max: {zi.min():.2f}/{zi.max():.2f}")

                        # Preparar datos para Plotly
                        if hasattr(xi, 'shape') and len(xi.shape) == 2:
                            x_plot = xi[0]
                            y_plot = yi[:, 0]
                            print(f"Usando xi[0] y yi[:,0] para plot")
                        else:
                            x_plot = xi
                            y_plot = yi
                            print(f"Usando xi y yi directamente para plot")

                        print(f"Datos para plot: x_plot shape={len(x_plot)}, y_plot shape={len(y_plot)}")

                        if tipo_visualizacion == "heatmap":
                            print("Creando Heatmap...")
                            fig.add_trace(
                                go.Heatmap(
                                    x=x_plot,
                                    y=y_plot,
                                    z=zi,
                                    colorscale=esquema_color.lower(),
                                    opacity=opacidad,
                                    hoverinfo="none",
                                    colorbar=dict(
                                        title="dB",
                                        thickness=20,
                                        len=0.8,
                                        x=0.80,
                                        y=0.4,
                                        yanchor="middle",
                                    ),
                                )
                            )
                            print("✓ Heatmap creado exitosamente")
                            
                        elif tipo_visualizacion == "contour":
                            print("Creando Contour...")
                            fig.add_trace(
                                go.Contour(
                                    x=x_plot,
                                    y=y_plot,
                                    z=zi,
                                    colorscale=esquema_color.lower(),
                                    opacity=opacidad,
                                    contours=dict(showlabels=True),
                                    hoverinfo="none",
                                    colorbar=dict(
                                        title="dB",
                                        thickness=20,
                                        len=0.8,
                                        x=0.80,
                                        y=0.4,
                                        yanchor="middle",
                                    ),
                                )
                            )
                            print("✓ Contour creado exitosamente")
                    else:
                        print("✗ La función IDW devolvió valores None")
                        
                except Exception as e:
                    print(f"✗ ERROR en interpolación IDW: {str(e)}")
                    print("Traceback completo:")
                    traceback.print_exc()
                    print("Continuando sin interpolación...")

            else:
                print(f"\nNo se realizará interpolación:")
                print(f"  - ¿len(df) >= 2? {len(df) >= 2}")
                print(f"  - ¿tipo_visualizacion en ['heatmap','contour']? {tipo_visualizacion in ['heatmap', 'contour']}")

            # Puntos de sensores
            print(f"\nAgregando {len(x)} puntos de sensores...")
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
                    name="Sensores",
                )
            )
            print("✓ Puntos de sensores agregados")

            # Epicentro
            if len(z) >= 2:
                print(f"\nCalculando epicentro...")
                try:
                    x_tuple = tuple(x.round(6).tolist())
                    y_tuple = tuple(y.round(6).tolist())
                    z_tuple = tuple(z.round(2).tolist())

                    epicentro_x, epicentro_y = calcular_epicentro_cached(
                        x_tuple, y_tuple, z_tuple
                    )

                    print(f"Epicentro calculado: ({epicentro_x:.4f}, {epicentro_y:.4f})")

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
                            name="Epicentro",
                            hovertemplate=(
                                "Epicentro Estimado<br>"
                                + "Posición: (%{x:.4f}, %{y:.4f})<extra></extra>"
                            ),
                        )
                    )
                    print("✓ Epicentro agregado")
                    
                except Exception as e:
                    print(f"✗ Error calculando epicentro: {str(e)}")
                    traceback.print_exc()
            else:
                print(f"\nNo se calcula epicentro: solo {len(z)} sensores")

            # Actualizar layout
            print(f"\nConfigurando layout...")
            fig.update_layout(
                title=f"Mapa de {len(df)} Sensores - Niveles de Ruido",
                xaxis_title="Coordenada X",
                yaxis_title="Coordenada Y",
                showlegend=True,
                hovermode="closest",
                xaxis=dict(
                    range=[x_min, x_max],
                    scaleanchor="y",
                    scaleratio=1,
                    constrain="domain",
                    showgrid=True,
                    gridcolor="lightgray",
                ),
                yaxis=dict(
                    range=[y_min, y_max],
                    showgrid=True,
                    gridcolor="lightgray",
                ),
                height=600,
                margin=dict(l=80, r=120, t=50, b=50),
                legend=dict(
                    x=0.80,
                    y=1,
                    xanchor="left",
                    yanchor="top",
                    bgcolor="rgba(255, 255, 255, 0.8)",
                    bordercolor="black",
                    borderwidth=1,
                ),
                plot_bgcolor="white",
                paper_bgcolor="white",
            )
            print("✓ Layout configurado")

            print(f"\n{'='*60}")
            print("DEBUG: FIN ACTUALIZACIÓN DE MAPA - ÉXITO")
            print(f"{'='*60}\n")

            return fig

        except Exception as e:
            print(f"\n{'='*60}")
            print("DEBUG: ERROR CRÍTICO EN ACTUALIZACIÓN DE MAPA")
            print(f"{'='*60}")
            print(f"Error: {str(e)}")
            print("Traceback completo:")
            traceback.print_exc()
            print(f"{'='*60}\n")
            
            # Retornar figura de error
            return crear_figura_error(f"Error: {str(e)}")

def crear_figura_error(mensaje):
    """Crear figura de error"""
    fig = go.Figure()
    fig.add_annotation(
        text=f"❌ ERROR<br>{mensaje}",
        xref="paper", yref="paper",
        x=0.5, y=0.5, showarrow=False,
        font=dict(size=14, color="red")
    )
    fig.update_layout(
        xaxis=dict(showgrid=False, zeroline=False, showticklabels=False),
        yaxis=dict(showgrid=False, zeroline=False, showticklabels=False),
        plot_bgcolor="white",
        height=400
    )
    return fig