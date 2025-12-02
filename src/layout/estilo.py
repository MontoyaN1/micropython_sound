estilo_interfaz = """
<!DOCTYPE html>
<html>
    <head>
        {%metas%}
        <title>{%title%}</title>
        {%favicon%}
        {%css%}
        <style>
            body {
                margin: 0;
                padding: 0;
                font-family: Arial, sans-serif;
                background-color: #f5f5f5;
            }
            
            /* Sidebar */
            .sidebar {
                position: fixed;
                left: 0;
                top: 0;
                width: 25%;
                height: 100vh;
                background: linear-gradient(135deg, #2c3e50 0%, #3498db 100%);
                padding: 20px;
                overflow-y: auto;
                box-shadow: 2px 0 10px rgba(0,0,0,0.1);
                z-index: 1000;
            }
            
            /* Contenido principal */
            .main-content {
                margin-left: 25%;
                width: 75%;
                padding: 20px;
                min-height: 100vh;
                background-color: white;
            }
            
            /* Métricas en sidebar */
            .metrics-container {
                display: flex;
                flex-direction: column;
                gap: 10px;
                margin-bottom: 20px;
            }
            
            .metric-card {
                background: rgba(255, 255, 255, 0.1);
                color: white;
                padding: 15px;
                border-radius: 8px;
                text-align: center;
                backdrop-filter: blur(10px);
                border: 1px solid rgba(255, 255, 255, 0.2);
            }
            
            .metric-label {
                font-size: 12px;
                opacity: 0.9;
                margin-bottom: 5px;
            }
            
            .metric-value {
                font-size: 20px;
                font-weight: bold;
            }
            
            /* Controles en sidebar */
            .controls-grid {
                display: flex;
                flex-direction: column;
                gap: 15px;
            }
            
            .control-group {
                margin-bottom: 15px;
            }
            
            .control-group label {
                display: block;
                margin-bottom: 8px;
                font-weight: bold;
                color: white;
                font-size: 14px;
            }
            
            /* Radio items personalizados */
            .radio-items {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            
            .radio-items .rc-radio {
                background: rgba(255, 255, 255, 0.1);
                padding: 8px 12px;
                border-radius: 6px;
                border: 1px solid rgba(255, 255, 255, 0.2);
            }
            
            .radio-items .rc-radio:hover {
                background: rgba(255, 255, 255, 0.2);
            }
            
            .radio-items .rc-radio input:checked + span {
                color: #3498db;
            }
            
            /* Dropdown personalizado */
            .Select-control {
                background: rgba(255, 255, 255, 0.1) !important;
                border: 1px solid rgba(255, 255, 255, 0.3) !important;
                border-radius: 6px !important;
            }
            
            .Select-value-label {
                color: white !important;
            }
            
            .Select-placeholder {
                color: rgba(255, 255, 255, 0.7) !important;
            }
            
            /* Sliders personalizados */
            .rc-slider-track {
                background-color: #3498db !important;
            }
            
            .rc-slider-handle {
                border: 2px solid #3498db !important;
            }
            
            .rc-slider-mark-text {
                color: white !important;
            }
            
            /* Contenedor del mapa */
            .map-container {
                background: white;
                padding: 20px;
                border-radius: 10px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                margin-bottom: 20px;
                position: relative;
                overflow: hidden;
            }
            
            /* Ajustes específicos para el gráfico Plotly */
            .js-plotly-plot .plotly .main-svg {
                border-radius: 8px;
            }
            
            
            
            /* Contenedor del gráfico con overflow controlado */
            .dash-graph {
                position: relative;
                width: 100% !important;
            }
            
            .dash-graph > div {
                width: 100% !important;
                overflow: visible !important;
            }
            
            /* Panel de datos */
            .data-container {
                background: #f8f9fa;
                padding: 20px;
                border-radius: 10px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            
            /* Responsive */
            @media (max-width: 768px) {
                .sidebar {
                    position: relative;
                    width: 100%;
                    height: auto;
                }
                
                .main-content {
                    margin-left: 0;
                    width: 100%;
                }
            }
            
            /* Scrollbar personalizado */
            .sidebar::-webkit-scrollbar {
                width: 6px;
            }
            
            .sidebar::-webkit-scrollbar-track {
                background: rgba(255, 255, 255, 0.1);
            }
            
            .sidebar::-webkit-scrollbar-thumb {
                background: rgba(255, 255, 255, 0.3);
                border-radius: 3px;
            }
            
            .sidebar::-webkit-scrollbar-thumb:hover {
                background: rgba(255, 255, 255, 0.5);
            }

            /* Asegurar que el contenedor del gráfico tenga espacio suficiente */
            .dash-graph {
                position: relative;
                
                margin-right: 40px;
            }

            
      
/* Asegura que el contenedor principal tenga espacio */
.main-svg {
    width: 100% !important;
    overflow: visible !important;
}


.dash-graph {
    
    box-sizing: border-box !important;
}

/* El gráfico en sí */
.js-plotly-plot .plotly .plot-container {
    width: 100% !important;
    margin-right: 80px !important;
}

        </style>
    </head>
    <body>
        {%app_entry%}
        <footer>
            {%config%}
            {%scripts%}
            {%renderer%}
        </footer>
    </body>
</html>
"""
