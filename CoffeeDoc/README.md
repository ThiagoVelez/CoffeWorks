# CoffeeDoc

Procesador de textos de la suite **CoffeeWorks**. La documentación general, la compilación y la instalación están en el [README principal](../README.md).

- Interfaz: `src/` (React + TypeScript). Servidor de desarrollo en <http://localhost:1421> con `npm run dev`.
- Ventana nativa: `src-tauri/` (Tauri 2), que usa los comandos compartidos de `crates/coffee-core`.
- Formato propio `.cfd` (JSON con metadatos, configuración de página y pestañas). Importa Word, Markdown, HTML y texto; exporta a Word, Markdown, HTML, texto y PDF.
