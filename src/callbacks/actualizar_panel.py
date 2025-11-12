from dash import Input, Output, dash_table, html
import pandas as pd


def registrar_callback_panel(app):
    @app.callback(
        [Output("lista-sensores", "children"), Output("tabla-datos", "children")],
        Input("datos-procesados", "data"),
    )
    def actualizar_panel_datos(datos_procesados):
        """Actualizar el panel de datos"""
        df = pd.DataFrame(datos_procesados) if datos_procesados else pd.DataFrame()

        if df.empty:
            return [html.P("Esperando datos...")], dash_table.DataTable([])

        # Lista de sensores
        sensores_lista = []
        for _, sensor in df.iterrows():
            nivel = sensor["ruido"]
            if nivel < 50:
                icono, color = "🟢", "green"
            elif nivel < 70:
                icono, color = "🟡", "orange"
            elif nivel < 85:
                icono, color = "🟠", "darkorange"
            else:
                icono, color = "🔴", "red"

            sensores_lista.append(
                html.Div(
                    [
                        html.Strong(f"{icono} Sensor {sensor['id']}"),
                        html.Span(
                            f" - {sensor['ruido']:.1f} dB",
                            style={"color": color, "fontWeight": "bold"},
                        ),
                        html.Br(),
                        html.Small(
                            f"📍 {sensor['location']} | 🆔 {sensor['micro_id']}",
                            style={"color": "gray"},
                        ),
                    ],
                    style={
                        "marginBottom": "10px",
                        "padding": "10px",
                        "borderBottom": "1px solid #eee",
                    },
                )
            )

        # Tabla de datos
        display_df = df[["id", "ruido", "location", "x", "y"]].copy()
        display_df["ruido"] = display_df["ruido"].round(1)
        display_df["x"] = display_df["x"].round(6)
        display_df["y"] = display_df["y"].round(6)

        tabla = dash_table.DataTable(
            data=display_df.to_dict("records"),
            columns=[
                {"name": "ID", "id": "id"},
                {"name": "Ruido (dB)", "id": "ruido"},
                {"name": "Ubicación", "id": "location"},
                {"name": "Longitud", "id": "x"},
                {"name": "Latitud", "id": "y"},
            ],
            style_cell={"textAlign": "left", "padding": "10px"},
            style_header={
                "backgroundColor": "rgb(230, 230, 230)",
                "fontWeight": "bold",
            },
            style_data={"border": "1px solid lightgray"},
            page_size=10,
            style_table={"overflowX": "auto", "height": "400px", "overflowY": "auto"},
        )

        return sensores_lista, tabla
