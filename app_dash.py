import dash
from src.layout.interfaz import interfaz_principal
from src.layout.estilo import estilo_interfaz
from src.callbacks import registrar_callbacks_dash


# ========== INICIALIZAR DASH ==========
app = dash.Dash(__name__)
app.title = "Mapa de Contaminación Acústica"

app.layout = interfaz_principal

app.index_string = estilo_interfaz
# ===========================================


# ========== REGISTRAR CALLBACKS ==========
registrar_callbacks_dash(app=app)
# ===========================================


# ========== EJECUCIÓN ==========
if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=8050)
# ===========================================
