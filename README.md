# CoffeWorks - Suite Launcher Desktop

Launcher de escritorio modular y orquestador nativo para la suite ofimática de código abierto **CoffeWorks**.

## Arquitectura del Proyecto

El proyecto implementa una arquitectura híbrida de alto rendimiento basada en **Tauri (Rust + TypeScript)**, correspondiente al stack de desarrollo mostrado en la distribución del repositorio:
- **Rust (59.4%)**: Núcleo del sistema operativo, gestión de procesos de las aplicaciones ofimáticas, acceso al sistema de archivos local, bóveda cifrada P2P, y comandos IPC.
- **TypeScript & React (39.3%)**: Interfaz de usuario reactiva, diseño de precisión píxel por píxel derivado de Stitch, atajos globales de teclado (`Ctrl + K`), e integración con aceleración por hardware WebView2.
- **CSS / Tailwind (0.2%)**: Sistema de tokens de color "Espresso Roast" (`#161311`), tipografías Hanken Grotesk y JetBrains Mono.

## Aplicaciones de la Suite Ofimática (Ingeniería Inversa)

| Aplicación CoffeWorks | Equivalente Tradicional | Formato de Archivo | Propósito |
| :--- | :--- | :--- | :--- |
| **CoffeDoc** | Microsoft Word / Google Docs | `.cfd` / `.docx` | Procesador de texto enriquecido, Markdown y redacción contextual con IA. |
| **CoffeSheet** | Microsoft Excel / Google Sheets | `.cfs` / `.xlsx` | Motor de cálculo en memoria, tablas dinámicas y análisis financiero. |
| **CoffeSlides** | Microsoft PowerPoint | `.csl` / `.pptx` | Presentaciones dinámicas, diapositivas cinemáticas y exportación 4K. |
| **CoffeNotes** | Microsoft OneNote / Apple Notes | `.cfn` | Lienzo infinito, notas rápidas al vuelo y resúmenes de reuniones. |
| **CoffeFlow** | Microsoft Visio / Jira | `.cff` | Diagramas de flujo, tableros Kanban y cronogramas Gantt. |
| **CoffeMail & Meet** | Microsoft Outlook & Teams | N/A | Cliente de correo cifrado y videollamadas P2P sin servidor central. |

## Estructura de Directorios

```
CoffeWorks/
├── CoffeDoc/                  # Procesador de texto estilo Microsoft Word (React + Vite, puerto 1421)
├── CoffeCalc/                 # Hoja de cálculo con fórmulas y grilla interactiva estilo Excel (puerto 1422)
├── CoffeView/                 # Diseñador de presentaciones 16:9 estilo PowerPoint (puerto 1423)
├── CoffeWorks_Icon/           # Iconografía institucional de la suite (.ico)
├── package.json               # Dependencias del Launcher de escritorio
├── tailwind.config.js         # Tokens de diseño y paleta "Café Roast"
├── src/                       # Frontend TypeScript & React del Launcher (puerto 1420)
│   ├── components/            # TitleBar, Sidebar, AppGrid, RecentDocuments, WelcomeBanner, etc.
│   ├── services/              # tauriBridge.ts (Adaptador IPC y orquestador de apps)
│   ├── types/                 # Definiciones de tipo estrictas
│   └── App.tsx                # Orquestador visual
└── src-tauri/                 # Backend nativo en Rust (Tauri 2.0)
    ├── Cargo.toml             # Configuración del paquete Tauri
    ├── tauri.conf.json        # Ventana nativa frameless y permisos IPC
    └── src/main.rs            # Comandos IPC de lanzamiento de apps y control de ventanas
```

## Guía de Ejecución

### 1. Modo Desarrollo Web (Frontend)
Para probar la interfaz, micro-interacciones, atajos y lógica de creación de documentos inmediatamente:
```bash
npm install
npm run dev
```
Accede en tu navegador a `http://localhost:1420`.

### 2. Modo Aplicación de Escritorio Nativa (.exe)
Una vez instalado el compilador de Rust (`rustup` / `cargo`):
```bash
npm run tauri dev
```
Para generar el instalador de producción optimizado:
```bash
npm run tauri build
```
