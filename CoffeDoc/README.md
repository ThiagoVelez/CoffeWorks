# CoffeDoc - Procesador de Textos de CoffeWorks

Procesador de textos colaborativo, enriquecido y modular para la suite de código abierto **CoffeWorks**.

## Características Principales

- **Lienzo de Redacción A4 / Carta**: Vista de página física con márgenes estándar y sombras ambientales.
- **Alternancia de Temas**:
  - Modo Oscuro *Espresso Roast* (`#161311`) para largas sesiones sin fatiga visual.
  - Modo Papel Blanco físico para contraste clásico de oficina y preparación de impresión.
- **Cinta de Herramientas de Edición**:
  - Títulos H1, H2, H3, subtítulos y párrafos.
  - Negrita, cursiva, subrayado, tachado, código inline y resaltador ámbar.
  - Alineación de párrafos: izquierda, centrado, derecha y justificado.
  - Listas ordenadas, viñetas y listas de tareas con casillas de verificación interactivas.
  - Inserción de tablas estructuradas, citas en bloque (*blockquotes*), divisores e hipervínculos.
- **Esquema de Documento Inteligente**:
  - Panel lateral que detecta automáticamente los títulos del documento para navegación inmediata entre secciones.
- **Barra de Métricas en Tiempo Real**:
  - Conteo de palabras, recuento de caracteres, cálculo de tiempo estimado de lectura y cálculo de páginas.
  - Control de zoom interactivo (de 60% a 150%).
- **Persistencia & Sincronización Automática**:
  - Autoguardado silencioso con retardo de 800ms.
  - Sincronización inmediata con la bóveda de documentos recientes del Launcher de CoffeWorks.
- **Formatos y Exportación**:
  - Formato nativo estructurado `.cfd` (JSON con metadatos de autor, fechas y árbol de contenido).
  - Exportación a Markdown (`.md`).
  - Exportación a HTML limpio y autocontenido (`.html`).
  - Vista previa de impresión y exportación a PDF nativo del sistema (`Ctrl + P` / `window.print`).

## Comandos de Ejecución

### Desarrollo Web (Frontend)
```powershell
cd c:\Users\santi\OneDrive\Desktop\suite\launcher\CoffeDoc
npm install
npm run dev
```
Acceso en navegador local: `http://localhost:1421`.

### Escritorio Nativo (.exe con Tauri)
```powershell
npm run tauri dev
```
