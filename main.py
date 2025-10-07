import streamlit as st
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from scipy.interpolate import griddata


st.set_page_config(
    page_title="Mapa de Contaminación Acústica", page_icon="🔊", layout="wide"
)


st.title("Sistema de Monitoreo de Contaminación Acústica")
st.markdown("---")


def generar_datos_sensores(num_sensores=6):
    sensores = []
    for i in range(num_sensores):
        x = np.random.uniform(1, 9)
        y = np.random.uniform(1, 9)
        ruido = np.random.normal(65, 15)
        sensores.append(
            {"id": f"Sensor {i + 1}", "x": x, "y": y, "ruido": max(40, min(ruido, 100))}
        )
    return pd.DataFrame(sensores)


if "datos_sensores" not in st.session_state:
    st.session_state.datos_sensores = generar_datos_sensores()


with st.sidebar:
    st.header("Configuración")
    st.subheader("Parámetros de Visualización")

    tipo_visualizacion = st.radio(
        "Tipo de visualización:", ["Mapa de Calor", "Puntos de Sensor", "Contornos"]
    )

    esquema_color = st.selectbox(
        "Esquema de color:", ["viridis", "plasma", "inferno", "magma", "coolwarm"]
    )

    opacidad = st.slider("Opacidad del mapa de calor:", 0.1, 1.0, 0.6)

    if st.button("Actualizar Datos"):
        st.session_state.datos_sensores = generar_datos_sensores()
        st.rerun()


col1, col2 = st.columns([2, 1])

with col1:
    st.subheader("Mapa de la Sala - Niveles de Ruido (dB)")

    # Crear figura
    fig, ax = plt.subplots(figsize=(10, 8))

    # Dibujar sala
    ax.set_xlim(0, 10)
    ax.set_ylim(0, 10)
    ax.add_patch(
        plt.Rectangle((0, 0), 10, 10, fill=False, edgecolor="black", linewidth=2)
    )
    ax.set_xlabel("Ancho (m)")
    ax.set_ylabel("Largo (m)")
    ax.set_aspect("equal")

    # Obtener datos
    sensores = st.session_state.datos_sensores
    x = sensores["x"].values
    y = sensores["y"].values
    z = sensores["ruido"].values

    # Crear grid para interpolación
    xi = np.linspace(0, 10, 100)
    yi = np.linspace(0, 10, 100)
    xi, yi = np.meshgrid(xi, yi)

    # Interpolar datos
    zi = griddata((x, y), z, (xi, yi), method="cubic")

    if tipo_visualizacion == "Mapa de Calor":
        # Dibujar mapa de calor
        heatmap = ax.imshow(
            zi,
            extent=[0, 10, 0, 10],
            origin="lower",
            cmap=esquema_color,
            alpha=opacidad,
            aspect="auto",
        )
        fig.colorbar(heatmap, ax=ax, label="Nivel de Ruido (dB)")
    elif tipo_visualizacion == "Contornos":
        # Dibujar contornos
        contour = ax.contourf(xi, yi, zi, levels=15, cmap=esquema_color, alpha=opacidad)
        fig.colorbar(contour, ax=ax, label="Nivel de Ruido (dB)")

    # Dibujar puntos de sensores
    scatter = ax.scatter(x, y, c=z, cmap=esquema_color, s=200, edgecolors="black")

    # Añadir etiquetas a los sensores
    for i, row in sensores.iterrows():
        ax.annotate(
            f"{row['id']}\n{row['ruido']:.1f} dB",
            (row["x"], row["y"]),
            xytext=(5, 5),
            textcoords="offset points",
            bbox=dict(boxstyle="round,pad=0.3", fc="white", ec="gray", alpha=0.8),
        )

    # Añadir epicentros (áreas con mayor nivel de ruido)
    max_ruido_idx = np.argmax(z)
    ax.scatter(
        x[max_ruido_idx],
        y[max_ruido_idx],
        s=300,
        facecolors="none",
        edgecolors="red",
        linewidths=2,
        label="Epicentro",
    )

    ax.legend()
    plt.tight_layout()
    st.pyplot(fig)

with col2:
    st.subheader("Datos en Tiempo Real")

    st.dataframe(
        sensores.style.highlight_max(axis=0, color="#ffcc80"), use_container_width=True
    )

    st.metric("Nivel Máximo de Ruido", f"{max(z):.1f} dB")
    st.metric("Nivel Promedio de Ruido", f"{np.mean(z):.1f} dB")
    st.metric("Número de Sensores", len(sensores))

    st.subheader("Distribución de Niveles de Ruido")
    fig2, ax2 = plt.subplots(figsize=(8, 4))
    ax2.bar(
        sensores["id"], sensores["ruido"], color=plt.cm.viridis(sensores["ruido"] / 100)
    )
    ax2.set_ylabel("Nivel de Ruido (dB)")
    plt.xticks(rotation=45)
    plt.tight_layout()
    st.pyplot(fig2)

    st.subheader("Leyenda de Niveles")
    st.markdown("""
    - < 50 dB: 🟢 Tranquilo
    - 50-70 dB: 🟡 Moderado
    - 70-85 dB: 🟠 Alto
    - > 85 dB: 🔴 Peligroso
    """)


st.markdown("---")
st.markdown(
    "Sistema de monitoreo de contaminación acústica | Desarrollado con Streamlit y MicroPython"
)
