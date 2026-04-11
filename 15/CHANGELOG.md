# Registro de Actualizaciones - Directorio Santa Ana

## [Versión 11.1.0] - Seguridad y Optimización Base (En progreso)

### 🔒 Seguridad (Crítico)
- [ ] **Reglas de Firestore actualizadas:** Se restringió la escritura de la base de datos para que solo usuarios autenticados puedan crear/editar sus propios anuncios. Lectura pública habilitada.
- [ ] **Sanitización de URLs implementada:** Se agregó validación estricta de protocolos (`http`, `https`, `mailto`, `tel`) para evitar inyección de código (XSS) en los enlaces de redes sociales y WhatsApp.
- [ ] **Refactor de Eventos (DOM):** Se eliminaron los atributos `onclick` en línea del HTML inyectado. Se reemplazó por "Delegación de Eventos" mediante `data-attributes` para cerrar brechas de seguridad.

### ⚡ Rendimiento (Próximos pasos)
- [ ] Implementar `DocumentFragment` para renderizado eficiente.
- [ ] Migrar el estado global (`window.directorioData`) a un patrón módulo.

### 🎨 UX & Copy (Próximos pasos)
- [ ] Mejorar mensajes de "búsqueda sin resultados" con enfoque comunitario.
- [ ] Accesibilidad: atributos ARIA para soporte de teclado y lectores de pantalla.