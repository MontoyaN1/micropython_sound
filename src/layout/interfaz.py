from dash import html, dcc

# Layout de la aplicación
interfaz_principal = html.Div(
    [
        # CSS personalizado
        html.Link(
            rel="stylesheet",
            href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css",
        ),
        # Layout principal con sidebar
        html.Div(
            [
                # SIDEBAR (25%)
                html.Div(
                    [
                        # Header del sidebar
                        html.H2(
                            "🎯 Control Panel",
                            style={
                                "textAlign": "center",
                                "marginBottom": "20px",
                                "color": "white",
                            },
                        ),
                        # Métricas en el sidebar
                        html.Div(
                            [
                                html.Div(id="metric-sensores", className="metric-card"),
                                html.Div(id="metric-lecturas", className="metric-card"),
                                html.Div(
                                    id="metric-actualizacion", className="metric-card"
                                ),
                                html.Div(
                                    id="metric-ruido-max", className="metric-card"
                                ),
                                html.Div(
                                    id="metric-ruido-prom", className="metric-card"
                                ),
                            ],
                            className="metrics-container",
                        ),
                        html.Hr(style={"borderColor": "#555", "margin": "20px 0"}),
                        # Controles en el sidebar
                        html.H3(
                            "🎨 Configuración",
                            style={"marginBottom": "15px", "color": "white"},
                        ),
                        html.Div(
                            [
                                html.Div(
                                    [
                                        html.Label(
                                            "Tipo de Visualización",
                                            style={"color": "white"},
                                        ),
                                        dcc.RadioItems(
                                            id="tipo-visualizacion",
                                            options=[
                                                {
                                                    "label": "Mapa de Calor",
                                                    "value": "heatmap",
                                                },
                                                {
                                                    "label": "Puntos de Sensor",
                                                    "value": "scatter",
                                                },
                                                {
                                                    "label": "Contornos",
                                                    "value": "contour",
                                                },
                                            ],
                                            value="contour",
                                            className="radio-items",
                                        ),
                                    ],
                                    className="control-group",
                                ),
                                html.Div(
                                    [
                                        html.Label(
                                            "Esquema de Color", style={"color": "white"}
                                        ),
                                        dcc.Dropdown(
                                            id="esquema-color",
                                            options=[
                                                {
                                                    "label": "Viridis",
                                                    "value": "Viridis",
                                                },
                                                {"label": "Plasma", "value": "Plasma"},
                                                {
                                                    "label": "Inferno",
                                                    "value": "Inferno",
                                                },
                                                {"label": "Magma", "value": "Magma"},
                                                {
                                                    "label": "Bluered",
                                                    "value": "bluered",
                                                },
                                            ],
                                            value="Plasma",
                                            clearable=False,
                                        ),
                                    ],
                                    className="control-group",
                                ),
                                html.Div(
                                    [
                                        html.Label(
                                            "Opacidad", style={"color": "white"}
                                        ),
                                        dcc.Slider(
                                            id="opacidad",
                                            min=0.1,
                                            max=1.0,
                                            step=0.1,
                                            value=0.6,
                                            marks={
                                                i / 10: str(i / 10)
                                                for i in range(1, 11)
                                            },
                                        ),
                                    ],
                                    className="control-group",
                                ),
                                html.Div(
                                    [
                                        html.Label(
                                            "Potencia IDW", style={"color": "white"}
                                        ),
                                        dcc.Slider(
                                            id="potencia-idw",
                                            min=1.0,
                                            max=4.0,
                                            step=0.5,
                                            value=2.0,
                                            marks={i: str(i) for i in range(1, 5)},
                                        ),
                                    ],
                                    className="control-group",
                                ),
                            ],
                            className="controls-grid",
                        ),
                    ],
                    className="sidebar",
                    style={
                        "width": "25%",
                        "backgroundColor": "#2c3e50",
                        "padding": "20px",
                        "height": "100vh",
                        "overflowY": "auto",
                        "position": "fixed",
                    },
                ),
                # CONTENIDO PRINCIPAL (75%)
                html.Div(
                    [
                        # Header principal
                        html.Div(
                            [
                                html.H1(
                                    "Sistema de Monitoreo de Contaminación Acústica",
                                    style={
                                        "textAlign": "center",
                                        "marginBottom": "10px",
                                    },
                                ),
                            ],
                            className="header",
                        ),
                        # Mapa principal
                        html.Div(
                            [
                                dcc.Graph(
                                    id="mapa-sensores",
                                    style={"height": "70vh", "borderRadius": "10px"},
                                ),
                            ],
                            className="map-container",
                        ),
                        # Panel de datos debajo del mapa
                        html.Div(
                            [
                                html.H3("📊 Datos en Tiempo Real"),
                                html.Div(
                                    [
                                        html.Div(
                                            id="lista-sensores",
                                            style={
                                                "width": "45%",
                                                "display": "inline-block",
                                                "verticalAlign": "top",
                                                "paddingRight": "20px",
                                            },
                                        ),
                                        html.Div(
                                            [
                                                html.H4("📋 Datos Detallados"),
                                                html.Div(id="tabla-datos"),
                                            ],
                                            style={
                                                "width": "55%",
                                                "display": "inline-block",
                                                "verticalAlign": "top",
                                            },
                                        ),
                                    ]
                                ),
                            ],
                            className="data-container",
                            style={
                                "marginTop": "30px",
                                "padding": "20px",
                                "backgroundColor": "#f8f9fa",
                                "borderRadius": "10px",
                            },
                        ),
                    ],
                    className="main-content",
                    style={
                        "width": "75%",
                        "marginLeft": "25%",
                        "padding": "20px",
                        "minHeight": "100vh",
                    },
                ),
            ],
            style={"display": "flex"},
        ),
        # Intervalo para actualización automática
        dcc.Interval(
            id="interval-component",
            interval=5 * 1000,
            n_intervals=0,
        ),
        # Almacenamiento de datos
        dcc.Store(id="datos-raw"),
        dcc.Store(id="datos-procesados"),
        dcc.Store(id="ultima-actualizacion", data="Nunca"),
    ],
    style={"fontFamily": "Arial, sans-serif", "margin": "0", "padding": "0"},
)
