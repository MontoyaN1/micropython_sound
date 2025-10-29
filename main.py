import streamlit as st
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from scipy.interpolate import griddata
from scipy.optimize import minimize
import influxdb_client
import os
from dotenv import load_dotenv

# Configuración de la página
st.set_page_config(
    page_title="Mapa de Contaminación Acústica", page_icon="🔊", layout="wide"
)

st.title("Sistema de Monitoreo de Contaminación Acústica")
st.markdown("---")

# Cargar variables de entorno
load_dotenv()

token = os.environ.get("INFLUXDB_TOKEN")
org = os.environ.get("INFLUXDB_ORG")
url = os.environ.get("INFLUXDB_URL")


@st.cache_data(ttl=300)
def obtener_datos_influxdb():
    """Obtener datos reales de InfluxDB de TODOS los sensores"""
    try:
        client = influxdb_client.InfluxDBClient(url=url, token=token, org=org)
        query_api = client.query_api()

        # CONSULTA MEJORADA - dinámica para cualquier sensor
        query = """
        from(bucket: "a")
          |> range(start: -12h)
          |> filter(fn: (r) => r._field == "value" or r._field == "latitude" or r._field == "longitude")
        """

        tables = query_api.query(query)

        # Reestructurar los datos manualmente
        sensores_dict = {}

        for table in tables:
            for record in table.records:
                # Obtener el nombre del sensor del measurement
                sensor_name = record.values.get("_measurement", "unknown")

                # Mapeo dinámico de nombres de sensor a IDs numéricos
                sensor_mapping = {
                    "sensor1": 1, "sensor2": 2, "sensor3": 3, "sensor4": 4,
                    "sensor5": 5, "sensor6": 6, "sensor7": 7, "sensor8": 8
                }
                sensor_id = sensor_mapping.get(sensor_name, 0)

                # Crear valores descriptivos basados en el sensor_id
                location_mapping = {
                    1: {"micro_id": "MIC001", "location_name": "Zona Norte"},
                    2: {"micro_id": "MIC001", "location_name": "Zona Sur"},
                    3: {"micro_id": "MIC003", "location_name": "Zona Este"},
                    4: {"micro_id": "MIC004", "location_name": "Zona Oeste"},
                    5: {"micro_id": "MIC005", "location_name": "Centro"},
                    6: {"micro_id": "MIC006", "location_name": "Periferia N"},
                    7: {"micro_id": "MIC007", "location_name": "Periferia S"},
                    8: {"micro_id": "MIC008", "location_name": "Periferia E"},
                }
                location_info = location_mapping.get(
                    sensor_id, {"micro_id": f"MIC{sensor_id:03d}", "location_name": f"Zona {sensor_id}"}
                )

                # Crear clave única (sensor + timestamp)
                key = f"{sensor_name}_{record.get_time().timestamp()}"

                # Si no existe esta clave, crear entrada
                if key not in sensores_dict:
                    sensores_dict[key] = {
                        "time": record.get_time(),
                        "sensor_id": sensor_id,
                        "micro_id": location_info["micro_id"],
                        "location_name": location_info["location_name"],
                        "measurement": sensor_name,
                        "value": None,
                        "latitude": None,
                        "longitude": None,
                    }

                # Actualizar los valores según el campo
                field = record.get_field()
                value = record.get_value()

                if field == "value":
                    sensores_dict[key]["value"] = value
                elif field == "latitude":
                    sensores_dict[key]["latitude"] = value
                elif field == "longitude":
                    sensores_dict[key]["longitude"] = value

        # Convertir a lista y filtrar registros completos
        sensores = []
        for key, data in sensores_dict.items():
            if (
                data["latitude"] is not None
                and data["longitude"] is not None
                and data["value"] is not None
            ):
                sensores.append(data)

        return pd.DataFrame(sensores)

    except Exception as e:
        st.error(f"Error conectando a InfluxDB: {e}")
        return pd.DataFrame()


def procesar_datos_para_mapa(df):
    """Procesar los datos de InfluxDB para el mapa"""
    if df.empty:
        st.warning("No hay datos disponibles de sensores")
        return pd.DataFrame()

    # Agrupar por sensor y tomar la última lectura de CADA sensor
    df_recent = (
        df.sort_values("time")
        .groupby(["sensor_id", "measurement"])
        .last()
        .reset_index()
    )

    # Crear estructura para el mapa
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


def generar_distribucion_idw(x, y, z, x_min, x_max, y_min, y_max, power=2):
    """Generar distribución usando Inverse Distance Weighting (funciona para N sensores)"""
    # Crear grid
    xi = np.linspace(x_min, x_max, 50)
    yi = np.linspace(y_min, y_max, 50)
    xi, yi = np.meshgrid(xi, yi)
    
    zi = np.zeros_like(xi)
    
    for i in range(len(x)):
        # Distancia desde cada punto del grid al sensor i
        dist = np.sqrt((xi - x[i])**2 + (yi - y[i])**2)
        # Evitar división por cero
        dist = np.maximum(dist, 0.01)
        # Peso inverso a la distancia
        weight = 1.0 / (dist ** power)
        # Contribución ponderada
        zi += weight * z[i]
    
    # Normalizar por la suma de pesos
    weight_sum = np.zeros_like(xi)
    for i in range(len(x)):
        dist = np.sqrt((xi - x[i])**2 + (yi - y[i])**2)
        dist = np.maximum(dist, 0.01)
        weight_sum += 1.0 / (dist ** power)
    
    zi = zi / weight_sum
    
    return xi, yi, zi


def calcular_epicentro_optimizacion(x, y, z):
    """Calcular epicentro usando optimización para N sensores"""
    def error_function(point):
        px, py = point
        error = 0
        for i in range(len(x)):
            # Distancia del punto al sensor i
            dist = np.sqrt((px - x[i])**2 + (py - y[i])**2)
            # Error basado en la diferencia entre el valor medido y el esperado
            # Asumimos que el ruido decae con la distancia
            expected_value = z[i] * np.exp(-dist / 10.0)  # Ajustar constante de decaimiento
            error += (z[i] - expected_value)**2
        return error
    
    # Punto inicial (centroide de los sensores)
    initial_guess = [np.mean(x), np.mean(y)]
    
    # Límites del área de búsqueda
    bounds = [(min(x), max(x)), (min(y), max(y))]
    
    # Optimizar
    result = minimize(error_function, initial_guess, bounds=bounds, method='L-BFGS-B')
    
    if result.success:
        return result.x[0], result.x[1]
    else:
        # Fallback: usar el sensor con mayor lectura
        max_idx = np.argmax(z)
        return x[max_idx], y[max_idx]


# Obtener y procesar datos
with st.spinner("Cargando datos de sensores..."):
    datos_raw = obtener_datos_influxdb()
    datos_procesados = procesar_datos_para_mapa(datos_raw)

# Sidebar
with st.sidebar:
    st.header("Configuración")
    st.subheader("Parámetros de Visualización")

    tipo_visualizacion = st.radio(
        "Tipo de visualización:", ["Mapa de Calor", "Puntos de Sensor", "Contornos"], index=2
    )

    esquema_color = st.selectbox(
        "Esquema de color:", ["viridis", "plasma", "inferno", "magma", "coolwarm"], index=1
    )

    opacidad = st.slider("Opacidad del mapa de calor:", 0.1, 1.0, 0.6)
    
    # Nuevo parámetro para IDW
    potencia_idw = st.slider("Potencia de interpolación (IDW):", 1.0, 4.0, 2.0, 0.5,
                           help="Valores más altos dan más peso a los sensores cercanos")

    if st.button("Actualizar Datos"):
        st.cache_data.clear()
        st.rerun()

    # Mostrar info de datos reales
    st.subheader("Información de Datos")
    if not datos_procesados.empty:
        st.write(f"Sensores activos: {len(datos_procesados)}")
        st.write(f"Total de lecturas: {len(datos_raw)}")
        st.write(f"Última lectura: {datos_raw['time'].max().strftime('%H:%M:%S')}")

        # Mostrar sensores detectados
        st.write("Sensores encontrados:")
        for _, sensor in datos_procesados.iterrows():
            st.write(
                f"- {sensor['id']} ({sensor['measurement']}): {sensor['ruido']:.1f} dB"
            )
    else:
        st.write("No se encontraron datos de sensores")

# Layout principal
col1, col2 = st.columns([2, 1])

with col1:
    st.subheader("Mapa de Sensores - Niveles de Ruido (dB)")

    if datos_procesados.empty:
        st.error("❌ No se encontraron datos de sensores. Verifica:")
        st.write("1. Que los sensores estén enviando datos a InfluxDB")
        st.write("2. Que las coordenadas (latitude/longitude) estén incluidas")
        st.write("3. Que los measurements sean correctos")

        st.stop()

    # Crear figura
    fig, ax = plt.subplots(figsize=(12, 8))

    # Usar coordenadas REALES de los sensores
    x = datos_procesados["x"].values
    y = datos_procesados["y"].values
    z = datos_procesados["ruido"].values

    # Configurar límites del mapa basado en los datos REALES
    x_margin = (max(x) - min(x)) * 0.2 if len(x) > 1 else 0.1
    y_margin = (max(y) - min(y)) * 0.2 if len(y) > 1 else 0.1

    x_min = min(x) - x_margin
    x_max = max(x) + x_margin
    y_min = min(y) - y_margin
    y_max = max(y) + y_margin

    ax.set_xlim(x_min, x_max)
    ax.set_ylim(y_min, y_max)
    ax.set_xlabel("Longitud")
    ax.set_ylabel("Latitud")
    ax.set_aspect("equal")
    ax.grid(True, alpha=0.3)

    # INTERPOLACIÓN MEJORADA PARA CUALQUIER NÚMERO DE SENSORES
    if len(datos_procesados) >= 3:
        # Usar IDW para cualquier número de sensores
        xi, yi, zi = generar_distribucion_idw(x, y, z, x_min, x_max, y_min, y_max, power=potencia_idw)
        
        try:
            if tipo_visualizacion == "Mapa de Calor":
                heatmap = ax.imshow(
                    zi,
                    extent=[x_min, x_max, y_min, y_max],
                    origin="lower",
                    cmap=esquema_color,
                    alpha=opacidad,
                    aspect="auto",
                )
                fig.colorbar(heatmap, ax=ax, label="Nivel de Ruido (dB)")
            elif tipo_visualizacion == "Contornos":
                contour = ax.contourf(
                    xi, yi, zi, levels=15, cmap=esquema_color, alpha=opacidad
                )
                fig.colorbar(contour, ax=ax, label="Nivel de Ruido (dB)")
                
            st.success(f"🎯 Visualizando {len(datos_procesados)} sensores con interpolación IDW")
            
        except Exception as e:
            st.warning(f"No se pudo generar la interpolación: {e}")

    elif len(datos_procesados) == 2:
        # Para 2 sensores también usar IDW
        xi, yi, zi = generar_distribucion_idw(x, y, z, x_min, x_max, y_min, y_max, power=potencia_idw)
        
        if zi is not None:
            try:
                if tipo_visualizacion == "Mapa de Calor":
                    heatmap = ax.imshow(
                        zi,
                        extent=[x_min, x_max, y_min, y_max],
                        origin="lower",
                        cmap=esquema_color,
                        alpha=opacidad,
                        aspect="auto",
                    )
                    fig.colorbar(heatmap, ax=ax, label="Nivel de Ruido Estimado (dB)")
                elif tipo_visualizacion == "Contornos":
                    contour = ax.contourf(
                        xi, yi, zi, levels=10, cmap=esquema_color, alpha=opacidad
                    )
                    fig.colorbar(contour, ax=ax, label="Nivel de Ruido Estimado (dB)")
                    
                
                
            except Exception as e:
                st.warning(f"No se pudo generar la distribución estimada: {e}")
    
    else:  # Para 1 sensor
        st.info("🔊 Solo se detectó 1 sensor. Se necesitan al menos 2 para interpolación")

    # Dibujar puntos de sensores REALES
    scatter = ax.scatter(
        x, y, c=z, cmap=esquema_color, s=200, edgecolors="black", linewidth=2
    )

    # Añadir etiquetas a los sensores REALES
    for i, row in datos_procesados.iterrows():
        ax.annotate(
            f"{row['id']}\n{row['ruido']:.1f} dB",
            (row["x"], row["y"]),
            xytext=(10, 10),
            textcoords="offset points",
            bbox=dict(boxstyle="round,pad=0.3", fc="white", ec="black", alpha=0.9),
            fontsize=9,
        )

    # CÁLCULO DE EPICENTRO PARA CUALQUIER NÚMERO DE SENSORES
    if len(z) >= 2:
        # Calcular epicentro usando optimización
        epicentro_x, epicentro_y = calcular_epicentro_optimizacion(x, y, z)
        
        # Dibujar epicentro estimado
        ax.scatter(
            epicentro_x,
            epicentro_y,
            s=400,
            facecolors="red",
            edgecolors="darkred",
            linewidths=3,
            label="Epicentro Estimado",
            marker="*",
            alpha=0.8
        )
        
        # Dibujar líneas desde el epicentro a los sensores
        for i in range(len(x)):
            ax.plot([epicentro_x, x[i]], [epicentro_y, y[i]], 'r--', alpha=0.3, linewidth=0.8)
        
        # Mostrar información del cálculo en el sidebar
        distancia_promedio = np.mean([np.sqrt((epicentro_x - x[i])**2 + (epicentro_y - y[i])**2) for i in range(len(x))])
        st.sidebar.info(f"**Cálculo de Epicentro:**\n"
                       f"- Sensores activos: {len(z)}\n"
                       f"- Distancia promedio a sensores: {distancia_promedio:.2f} unidades\n"
                       f"- Método: Optimización por mínimos cuadrados")

    elif len(z) == 1:
        # Para 1 sensor, marcar como único punto de medición
        ax.scatter(
            x[0],
            y[0],
            s=400,
            facecolors="none",
            edgecolors="red",
            linewidths=3,
            label="Único Sensor",
        )

    ax.legend()
    plt.tight_layout()
    st.pyplot(fig)

with col2:
    st.subheader("Datos en Tiempo Real")

    # Mostrar datos procesados
    display_df = datos_procesados[
        ["id", "measurement", "ruido", "micro_id", "location", "x", "y"]
    ].copy()
    display_df["ruido"] = display_df["ruido"].round(1)
    display_df["x"] = display_df["x"].round(6)
    display_df["y"] = display_df["y"].round(6)
    display_df.columns = [
        "Sensor ID",
        "Measurement",
        "Ruido (dB)",
        "Micro ID",
        "Location",
        "Longitud",
        "Latitud",
    ]

    st.dataframe(display_df, use_container_width=True)

    # Métricas
    if len(z) > 0:
        st.metric("Nivel Máximo de Ruido", f"{max(z):.1f} dB")
        st.metric("Nivel Promedio de Ruido", f"{np.mean(z):.1f} dB")
        st.metric("Número de Sensores", len(datos_procesados))
        
        # Mostrar epicentro estimado si hay al menos 2 sensores
        if len(z) >= 2:
            st.metric("Epicentro Estimado", "Calculado")
            st.metric("Método", "Optimización IDW")
    else:
        st.metric("Nivel Máximo de Ruido", "N/A")
        st.metric("Nivel Promedio de Ruido", "N/A")
        st.metric("Número de Sensores", 0)

    # Distribución
    st.subheader("Distribución de Niveles de Ruido")
    fig2, ax2 = plt.subplots(figsize=(8, 4))
    if len(datos_procesados) > 0:
        bars = ax2.bar(
            [f"Sensor {id}" for id in datos_procesados["id"]],
            datos_procesados["ruido"],
            color=plt.cm.viridis(datos_procesados["ruido"] / 100),
        )
        # Añadir valores en las barras
        for bar in bars:
            height = bar.get_height()
            ax2.text(
                bar.get_x() + bar.get_width() / 2.0,
                height,
                f"{height:.1f}",
                ha="center",
                va="bottom",
            )
    ax2.set_ylabel("Nivel de Ruido (dB)")
    plt.xticks(rotation=45)
    plt.tight_layout()
    st.pyplot(fig2)

    # Leyenda
    st.subheader("Leyenda de Niveles")
    st.markdown("""
    - < 50 dB: 🟢 Tranquilo
    - 50-70 dB: 🟡 Moderado  
    - 70-85 dB: 🟠 Alto
    - > 85 dB: 🔴 Peligroso
    """)

st.markdown("---")
st.markdown(
    "Sistema de monitoreo de contaminación acústica | Desarrollado con Streamlit y InfluxDB"
)