def registrar_callbacks_dash(app):
    from .actualizar_datos import registrar_callback_datos
    from .actualizar_metricas import registrar_callbacks_metricas
    from .actualizar_panel import registrar_callback_panel
    from .actualizar_mapa import registrar_callback_mapa

    registrar_callback_datos(app=app)

    registrar_callback_panel(app=app)
    registrar_callbacks_metricas(app=app)
    registrar_callback_mapa(app=app)
