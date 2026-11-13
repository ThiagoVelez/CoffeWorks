//! Catálogo de aplicaciones de la suite y su ciclo de vida:
//! instalar, desinstalar y ejecutar.
//!
//! El instalador de CoffeeWorks deja los paquetes de cada aplicación en la
//! carpeta `packages` junto al Launcher. "Instalar" copia el paquete a
//! `%LOCALAPPDATA%\CoffeeWorks\Apps\<App>`, crea su acceso directo en el menú
//! Inicio y registra sus tipos de archivo; "desinstalar" deshace todo eso.

use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use serde::Serialize;

use crate::platform;

/// Descripción estática de una aplicación de la suite.
pub struct CatalogApp {
    pub id: &'static str,
    /// Identificadores antiguos que siguen apareciendo en documentos guardados.
    pub aliases: &'static [&'static str],
    pub name: &'static str,
    /// Nombre de archivo (ejecutable, carpeta y acceso directo): el nombre
    /// visible puede llevar caracteres no válidos, como «CoffeeUI/UX».
    pub stem: &'static str,
    pub subtitle: &'static str,
    pub description: &'static str,
    pub version: &'static str,
    pub color_badge: &'static str,
    pub icon_name: &'static str,
    pub icon_url: &'static str,
    pub category: &'static str,
    /// Extensión nativa (sin punto) y descripción del tipo de archivo.
    pub file_type: (&'static str, &'static str),
    /// Otras extensiones que la aplicación sabe abrir.
    pub extra_extensions: &'static [&'static str],
    /// Si se convierte en el programa predeterminado de su extensión. Los PDF
    /// suelen tener ya un lector elegido, así que CoffeePDF solo se ofrece en
    /// "Abrir con".
    pub claim_default: bool,
}

pub const CATALOG: &[CatalogApp] = &[
    CatalogApp {
        id: "coffeedoc",
        aliases: &[],
        name: "CoffeeDoc",
        stem: "CoffeeDoc",
        subtitle: "Procesador de textos con formato enriquecido",
        description: "Documentos con estilos, tablas, imágenes y esquema automático. Abre y guarda Word (.docx), Markdown, HTML y PDF.",
        version: "v1.4",
        color_badge: "primary",
        icon_name: "file-text",
        icon_url: "/icons/CoffeeText.ico",
        category: "Office",
        file_type: ("cfd", "Documento de CoffeeDoc"),
        extra_extensions: &["docx", "doc", "md", "txt", "html", "htm"],
        claim_default: true,
    },
    CatalogApp {
        id: "coffeebooks",
        aliases: &[],
        name: "CoffeeBooks",
        stem: "CoffeeBooks",
        subtitle: "Notas, wikis y bases de datos",
        description: "Notas, wikis y bases de datos en páginas hechas de bloques: escribe con «/», crea subpáginas, tablas con vistas de tablero, lista y calendario, y plantillas.",
        version: "v1.0",
        color_badge: "notes",
        icon_name: "notebook-pen",
        icon_url: "/icons/CoffeeBooks.ico",
        category: "Office",
        file_type: ("cbk", "Espacio de CoffeeBooks"),
        extra_extensions: &[],
        claim_default: true,
    },
    CatalogApp {
        id: "coffeecalc",
        aliases: &["coffeesheet"],
        name: "CoffeeCalc",
        stem: "CoffeeCalc",
        subtitle: "Hoja de cálculo con fórmulas y gráficos",
        description: "Libros con varias hojas, más de 80 funciones, formato de celdas, filtros y gráficos. Compatible con Excel (.xlsx) y CSV.",
        version: "v1.0",
        color_badge: "secondary",
        icon_name: "table",
        icon_url: "/icons/CoffeeSheet.ico",
        category: "Office",
        file_type: ("cfs", "Libro de CoffeeCalc"),
        extra_extensions: &["xlsx", "xls", "csv"],
        claim_default: true,
    },
    CatalogApp {
        id: "coffeeview",
        aliases: &["coffeeslides"],
        name: "CoffeeView",
        stem: "CoffeeView",
        subtitle: "Presentaciones y diapositivas",
        description: "Diseñador de diapositivas con temas, formas, imágenes, transiciones, notas del orador y exportación a PowerPoint (.pptx) y PDF.",
        version: "v1.0",
        color_badge: "tertiary",
        icon_name: "presentation",
        icon_url: "/icons/CoffeeSlides.ico",
        category: "Office",
        file_type: ("csl", "Presentación de CoffeeView"),
        extra_extensions: &["pptx"],
        claim_default: true,
    },
    CatalogApp {
        id: "coffeepdf",
        aliases: &[],
        name: "CoffeePDF",
        stem: "CoffeePDF",
        subtitle: "Editor de documentos PDF",
        description: "Abre, anota y edita PDF: texto, resaltado, formas, firmas e imágenes, formularios, y organiza, gira, une o extrae páginas.",
        version: "v1.0",
        color_badge: "error",
        icon_name: "file-pen",
        icon_url: "/icons/CoffeePDF.ico",
        category: "Office",
        file_type: ("pdf", "Documento PDF"),
        extra_extensions: &[],
        claim_default: false,
    },
    CatalogApp {
        id: "coffeepage",
        aliases: &[],
        name: "CoffeePage",
        stem: "CoffeePage",
        subtitle: "Cuaderno digital de notas",
        description: "Notas en secciones y páginas: escribe en cualquier parte, dibuja a mano, pega imágenes, marca tareas y busca en todo el cuaderno.",
        version: "v1.0",
        color_badge: "notes",
        icon_name: "notebook",
        icon_url: "/icons/CoffeePage.ico",
        category: "Office",
        file_type: ("cpg", "Cuaderno de CoffeePage"),
        extra_extensions: &[],
        claim_default: true,
    },
    CatalogApp {
        id: "coffeedatabase",
        aliases: &[],
        name: "CoffeeDataBase",
        stem: "CoffeeDataBase",
        subtitle: "Bases de datos de escritorio",
        description: "Tablas, formularios, consultas SQL y visuales, relaciones con diagrama y asistente. Importa Excel, CSV y archivos .accdb/.mdb.",
        version: "v1.0",
        color_badge: "database",
        icon_name: "database",
        icon_url: "/icons/CoffeeDataBase.ico",
        category: "Office",
        file_type: ("cdb", "Base de datos de CoffeeDataBase"),
        extra_extensions: &["db", "sqlite", "sqlite3"],
        claim_default: true,
    },
    CatalogApp {
        id: "coffeeedit",
        // Proyectos de CoffeeCams (2.5), que se dividió en CoffeeEdit y CoffeeLive
        aliases: &["coffeecams"],
        name: "CoffeeEdit",
        stem: "CoffeeEdit",
        subtitle: "Editor de video",
        description: "Edita videos con varias pistas, cortes, velocidad, filtros, textos animados y transiciones, y exporta a MP4. Abre las grabaciones de CoffeeLive.",
        version: "v1.0",
        color_badge: "media",
        icon_name: "scissors",
        icon_url: "/icons/CoffeeEdit.ico",
        category: "Multimedia",
        file_type: ("ccm", "Proyecto de CoffeeEdit"),
        extra_extensions: &["mp4", "webm", "mov", "mkv"],
        claim_default: true,
    },
    CatalogApp {
        id: "coffeelive",
        aliases: &[],
        name: "CoffeeLive",
        stem: "CoffeeLive",
        subtitle: "Grabación de pantalla y transmisión en directo",
        description: "Escenas con pantalla, cámara, imágenes y textos; filtros, croma, transiciones, mezclador y atajos globales. Graba en MP4 o transmite a Twitch, YouTube y más.",
        version: "v1.0",
        color_badge: "live",
        icon_name: "radio",
        icon_url: "/icons/CoffeeLive.ico",
        category: "Multimedia",
        file_type: ("clv", "Colección de escenas de CoffeeLive"),
        extra_extensions: &[],
        claim_default: true,
    },
    CatalogApp {
        id: "coffeeuiux",
        aliases: &[],
        name: "CoffeeUI/UX",
        stem: "CoffeeUIUX",
        subtitle: "Diseño de interfaces y prototipos",
        description: "Diseña interfaces para móvil, escritorio y web: marcos con tamaños de dispositivo, formas, textos, componentes, diseño automático, prototipos navegables y exportación a PNG, SVG, PDF y HTML/CSS.",
        version: "v1.0",
        color_badge: "design",
        icon_name: "pen-tool",
        icon_url: "/icons/CoffeeUIUX.ico",
        category: "Desarrollador",
        file_type: ("cux", "Diseño de CoffeeUI/UX"),
        extra_extensions: &[],
        claim_default: true,
    },
    CatalogApp {
        id: "coffeeuml",
        aliases: &[],
        name: "CoffeeUML",
        stem: "CoffeeUML",
        subtitle: "Modelado UML y diagramas",
        description: "Diagramas UML de clases, casos de uso, secuencia, actividad, estados, componentes y despliegue; modelos entidad-relación y diagramas de flujo. Genera código y SQL y exporta a PNG, SVG y PDF.",
        version: "v1.0",
        color_badge: "diagram",
        icon_name: "workflow",
        icon_url: "/icons/CoffeeUML.ico",
        category: "Desarrollador",
        file_type: ("cuml", "Modelo de CoffeeUML"),
        extra_extensions: &[],
        claim_default: true,
    },
    CatalogApp {
        id: "coffeephoto",
        aliases: &[],
        name: "CoffeePhoto",
        stem: "CoffeePhoto",
        subtitle: "Edición de imágenes y retoque fotográfico",
        description: "Edición avanzada de imágenes: capas, máscaras, selecciones, pinceles, ajustes de color, filtros, texto y relleno según el contenido. Abre PNG, JPG y WebP y exporta a PNG, JPG, WebP y PDF.",
        version: "v1.0",
        color_badge: "art",
        icon_name: "image",
        icon_url: "/icons/CoffeePhoto.ico",
        category: "Ilustración",
        file_type: ("cph", "Imagen de CoffeePhoto"),
        extra_extensions: &["png", "jpg", "jpeg", "webp", "bmp", "gif"],
        claim_default: true,
    },
    CatalogApp {
        id: "coffeevector",
        aliases: &[],
        name: "CoffeeVector",
        stem: "CoffeeVector",
        subtitle: "Gráficos vectoriales e ilustración",
        description: "Gráficos vectoriales, logotipos e ilustraciones escalables: pluma Bézier, formas, buscatrazos, degradados, texto y mesas de trabajo. Abre y exporta SVG, y exporta a PNG y PDF.",
        version: "v1.0",
        color_badge: "art",
        icon_name: "pen-line",
        icon_url: "/icons/CoffeeVector.ico",
        category: "Ilustración",
        file_type: ("cvc", "Ilustración de CoffeeVector"),
        extra_extensions: &["svg"],
        claim_default: true,
    },
    CatalogApp {
        id: "coffeepaint",
        aliases: &[],
        name: "CoffeePaint",
        stem: "CoffeePaint",
        subtitle: "Pintura y dibujo digital",
        description: "Pintura y dibujo digital con presión del lápiz: pinceles de lápiz, tinta, acuarela, óleo, aerógrafo y marcador; capas, simetría, mezcla de colores y lienzos táctiles. Exporta a PNG, JPG, capas en ZIP y, con el complemento, a SVG vectorizado.",
        version: "v1.0",
        color_badge: "art",
        icon_name: "brush",
        icon_url: "/icons/CoffeePaint.ico",
        category: "Ilustración",
        file_type: ("cpt", "Pintura de CoffeePaint"),
        extra_extensions: &["png", "jpg", "jpeg"],
        claim_default: true,
    },
    CatalogApp {
        id: "coffeelens",
        aliases: &[],
        name: "CoffeeLens",
        stem: "CoffeeLens",
        subtitle: "Revelado y organización de fotografías",
        description: "Organiza y revela fotografías: catálogo con estrellas, colores y colecciones; ajustes de luz, color, curvas, HSL, nitidez y viñeta no destructivos; ajustes preestablecidos y exportación por lotes.",
        version: "v1.0",
        color_badge: "art",
        icon_name: "aperture",
        icon_url: "/icons/CoffeeLens.ico",
        category: "Ilustración",
        file_type: ("clc", "Catálogo de CoffeeLens"),
        extra_extensions: &[],
        claim_default: true,
    },
    CatalogApp {
        id: "coffeemotion",
        aliases: &[],
        name: "CoffeeMotion",
        stem: "CoffeeMotion",
        subtitle: "Gráficos en movimiento y efectos visuales",
        description: "Composiciones con capas de forma, texto, imagen y video animadas con fotogramas clave y curvas de suavizado; efectos, máscaras, plantillas de títulos y exportación a video WebM o MP4.",
        version: "v1.0",
        color_badge: "art",
        icon_name: "wand-sparkles",
        icon_url: "/icons/CoffeeMotion.ico",
        category: "Ilustración",
        file_type: ("cmo", "Composición de CoffeeMotion"),
        extra_extensions: &[],
        claim_default: true,
    },
    CatalogApp {
        id: "coffeesound",
        aliases: &[],
        name: "CoffeeSound",
        stem: "CoffeeSound",
        subtitle: "Edición, mezcla y restauración de audio",
        description: "Edita formas de onda (cortar, copiar, silencio, fundidos), mezcla varias pistas con volumen y panorama, aplica efectos (ecualizador, compresor, reverberación, eco, reducción de ruido, normalizar) y graba desde el micrófono. Exporta WAV y, con FFmpeg, MP3.",
        version: "v1.0",
        color_badge: "art",
        icon_name: "audio-waveform",
        icon_url: "/icons/CoffeeSound.ico",
        category: "Ilustración",
        file_type: ("csn", "Sesión de CoffeeSound"),
        extra_extensions: &["wav", "mp3", "ogg", "flac", "m4a", "aac", "webm"],
        claim_default: true,
    },
    CatalogApp {
        id: "coffeeencoder",
        aliases: &[],
        name: "CoffeeEncoder",
        stem: "CoffeeEncoder",
        subtitle: "Conversión de video y audio",
        description: "Cola de conversión de video y audio con ajustes preestablecidos (YouTube, redes sociales, móvil, web, solo audio, GIF): cambia formato, resolución, calidad y recorte, y procesa varios archivos seguidos con FFmpeg.",
        version: "v1.0",
        color_badge: "art",
        icon_name: "refresh-cw",
        icon_url: "/icons/CoffeeEncoder.ico",
        category: "Ilustración",
        file_type: ("cen", "Cola de CoffeeEncoder"),
        extra_extensions: &[],
        claim_default: true,
    },
    CatalogApp {
        id: "coffeeanimate",
        aliases: &[],
        name: "CoffeeAnimate",
        stem: "CoffeeAnimate",
        subtitle: "Animación 2D interactiva",
        description: "Animación cuadro a cuadro e interpolada con línea de tiempo, capas, fotogramas clave, papel cebolla, símbolos y botones interactivos; exporta a HTML5, GIF, video y secuencia PNG.",
        version: "v1.0",
        color_badge: "art",
        icon_name: "film",
        icon_url: "/icons/CoffeeAnimate.ico",
        category: "Ilustración",
        file_type: ("can", "Animación de CoffeeAnimate"),
        extra_extensions: &[],
        claim_default: true,
    },
    CatalogApp {
        id: "coffeepuppet",
        aliases: &[],
        name: "CoffeePuppet",
        stem: "CoffeePuppet",
        subtitle: "Animación de personajes en tiempo real",
        description: "Personajes 2D que imitan tu cara por la cámara (cabeza, ojos, cejas, boca y parpadeo) y se mueven con el teclado; graba la actuación con voz y exporta video.",
        version: "v1.0",
        color_badge: "art",
        icon_name: "smile",
        icon_url: "/icons/CoffeePuppet.ico",
        category: "Ilustración",
        file_type: ("cpup", "Personaje de CoffeePuppet"),
        extra_extensions: &[],
        claim_default: true,
    },
    CatalogApp {
        id: "coffeeanimate3d",
        aliases: &[],
        name: "CoffeeAnimate3D",
        stem: "CoffeeAnimate3D",
        subtitle: "Modelado y animación 3D por bloques",
        description: "Modelos 3D hechos de cubos con texturas pixeladas de 32×32, huesos y animación por fotogramas clave; plantillas de cuadrúpedo, bípedo, ave y araña, exporta a glTF (.glb) y Claude puede modelar y animar por MCP.",
        version: "v1.0",
        color_badge: "art",
        icon_name: "box",
        icon_url: "/icons/CoffeeAnimate3D.ico",
        category: "Ilustración",
        file_type: ("ca3d", "Modelo de CoffeeAnimate3D"),
        extra_extensions: &[],
        claim_default: true,
    },
];

/// Estado de una aplicación tal como lo consume la interfaz del Launcher.
#[derive(Debug, Clone, Serialize)]
pub struct SuiteApp {
    pub id: String,
    pub name: String,
    pub subtitle: String,
    pub description: String,
    pub version: String,
    pub installed: bool,
    /// El paquete está presente y la aplicación puede instalarse.
    pub available: bool,
    pub size_mb: f64,
    pub status: String,
    pub color_badge: String,
    pub icon_name: String,
    pub icon_url: String,
    pub category: String,
    pub install_path: String,
}

pub fn find_app(id: &str) -> Option<&'static CatalogApp> {
    let id = coffee_core::canonical_app_id(id);
    CATALOG
        .iter()
        .find(|app| app.id == id || app.aliases.contains(&id.as_str()))
}

/// Determina qué aplicación abre un documento a partir de su `app_id` o,
/// en su defecto, de la extensión del archivo.
pub fn app_for_document(app_id: &str, file_name: &str) -> Option<&'static CatalogApp> {
    if let Some(app) = find_app(app_id) {
        return Some(app);
    }
    let extension = Path::new(file_name)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    CATALOG.iter().find(|app| {
        app.file_type.0 == extension || app.extra_extensions.contains(&extension.as_str())
    })
}

fn binary_name(app: &CatalogApp) -> String {
    format!("{}{}", app.stem, std::env::consts::EXE_SUFFIX)
}

fn launcher_dir() -> PathBuf {
    std::env::current_exe()
        .ok()
        .and_then(|exe| exe.parent().map(Path::to_path_buf))
        .unwrap_or_else(|| PathBuf::from("."))
}

/// Carpeta de paquetes que el instalador deja junto al Launcher.
pub fn packages_dir() -> PathBuf {
    launcher_dir().join("packages")
}

/// Localiza el paquete de una aplicación. En desarrollo (`cargo run`) los
/// ejecutables de las aplicaciones quedan junto al del Launcher.
fn package_path(app: &CatalogApp) -> Option<PathBuf> {
    let binary = binary_name(app);
    [packages_dir().join(&binary), launcher_dir().join(&binary)]
        .into_iter()
        .find(|candidate| candidate.is_file())
}

fn install_dir(app: &CatalogApp) -> PathBuf {
    coffee_core::apps_dir().join(app.stem)
}

pub fn installed_exe(app: &CatalogApp) -> PathBuf {
    install_dir(app).join(binary_name(app))
}

pub fn is_installed(app: &CatalogApp) -> bool {
    installed_exe(app).is_file()
}

fn megabytes(path: &Path) -> f64 {
    let bytes = fs::metadata(path).map(|m| m.len()).unwrap_or(0) as f64;
    (bytes / 1_048_576.0 * 10.0).round() / 10.0
}

fn describe(app: &CatalogApp) -> SuiteApp {
    let installed_path = installed_exe(app);
    let installed = installed_path.is_file();
    let package = package_path(app);
    let size_mb = if installed {
        megabytes(&installed_path)
    } else {
        package.as_deref().map(megabytes).unwrap_or(0.0)
    };
    let status = if installed {
        format!("Instalada ({size_mb} MB)")
    } else if package.is_some() {
        format!("Disponible para instalar ({size_mb} MB)")
    } else {
        "Paquete no disponible".to_string()
    };

    SuiteApp {
        id: app.id.to_string(),
        name: app.name.to_string(),
        subtitle: app.subtitle.to_string(),
        description: app.description.to_string(),
        version: app.version.to_string(),
        installed,
        available: package.is_some(),
        size_mb,
        status,
        color_badge: app.color_badge.to_string(),
        icon_name: app.icon_name.to_string(),
        icon_url: app.icon_url.to_string(),
        category: app.category.to_string(),
        install_path: coffee_core::display_path(&installed_path),
    }
}

/// Archivo con la marca del paquete del que se copió cada app instalada.
const STAMP_FILE: &str = ".package";

/// Tamaño y fecha del paquete: cambian cuando una actualización trae uno nuevo.
fn package_stamp(package: &Path) -> String {
    let meta = fs::metadata(package).ok();
    let len = meta.as_ref().map(|m| m.len()).unwrap_or(0);
    let modified = meta
        .and_then(|m| m.modified().ok())
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs())
        .unwrap_or(0);
    format!("{len}-{modified}")
}

/// Tras una actualización de la suite, copia los paquetes nuevos sobre las
/// apps instaladas. Las que estén abiertas se actualizan la próxima vez.
pub fn refresh_installed() -> Vec<String> {
    let mut updated = Vec::new();
    for app in CATALOG {
        if !is_installed(app) {
            continue;
        }
        let Some(package) = package_path(app) else { continue };
        let stamp = fs::read_to_string(install_dir(app).join(STAMP_FILE)).unwrap_or_default();
        if stamp.trim() != package_stamp(&package) && install(app.id).is_ok() {
            updated.push(app.name.to_string());
        }
    }
    updated
}

pub fn list_apps() -> Vec<SuiteApp> {
    CATALOG.iter().map(describe).collect()
}

/// Instala (o reinstala) una aplicación a partir de su paquete.
pub fn install(id: &str) -> Result<SuiteApp, String> {
    let app = find_app(id).ok_or_else(|| format!("Aplicación desconocida: {id}"))?;
    let package = package_path(app).ok_or_else(|| {
        format!(
            "No se encontró el paquete de {} en {}. Reinstala CoffeeWorks para restaurarlo.",
            app.name,
            coffee_core::display_path(&packages_dir())
        )
    })?;

    let dir = install_dir(app);
    fs::create_dir_all(&dir)
        .map_err(|e| format!("No se pudo crear la carpeta de instalación: {e}"))?;

    let target = installed_exe(app);
    fs::copy(&package, &target).map_err(|e| {
        if target.is_file() {
            format!(
                "No se pudo actualizar {}: ciérrala y vuelve a intentarlo ({e})",
                app.name
            )
        } else {
            format!("No se pudo copiar {}: {e}", app.name)
        }
    })?;

    // Marca del paquete copiado: si el instalador trae uno nuevo, se actualiza
    let _ = fs::write(dir.join(STAMP_FILE), package_stamp(&package));

    // Las compilaciones MinGW necesitan el cargador de WebView2 junto al ejecutable.
    if let Some(package_dir) = package.parent() {
        let loader = package_dir.join("WebView2Loader.dll");
        if loader.is_file() {
            let _ = fs::copy(&loader, dir.join("WebView2Loader.dll"));
        }
    }

    // La integración con el sistema es opcional: si falla, la aplicación sigue
    // instalada y se puede abrir desde el Launcher.
    platform::create_shortcut(app.stem, &target, app.subtitle);
    platform::register_file_type(
        app.stem,
        app.file_type.0,
        app.file_type.1,
        &target,
        app.claim_default,
    );

    Ok(describe(app))
}

/// Las aplicaciones instaladas con la versión anterior (llamadas «Coffe…»)
/// se sustituyen por las nuevas: se quita la copia antigua, su acceso directo
/// y su asociación, y se instala la nueva si su paquete está disponible.
/// Aplicaciones que ya no existen: (nombre, extensión, aplicaciones que las sustituyen).
const RETIRED: &[(&str, &str, &[&str])] = &[("CoffeeCams", "ccm", &["coffeeedit", "coffeelive"])];

pub fn migrate_legacy_apps() {
    let legacy_apps = coffee_core::local_dir()
        .parent()
        .map(|p| p.join(coffee_core::LEGACY_SUITE_DIR).join("Apps"));
    for app in CATALOG {
        let legacy = coffee_core::legacy_name(app.name);
        let mut was_installed = false;
        for dir in [Some(coffee_core::apps_dir()), legacy_apps.clone()]
            .into_iter()
            .flatten()
        {
            let old = dir.join(&legacy);
            if old.is_dir() {
                was_installed |= old
                    .join(format!("{legacy}{}", std::env::consts::EXE_SUFFIX))
                    .is_file();
                let _ = fs::remove_dir_all(&old);
            }
        }
        if was_installed {
            platform::remove_legacy(&legacy, app.file_type.0);
            if is_installed(app) {
                // La asociación pudo apuntar a la copia antigua: se restaura
                let target = installed_exe(app);
                platform::register_file_type(
                    app.name,
                    app.file_type.0,
                    app.file_type.1,
                    &target,
                    app.claim_default,
                );
            } else if package_path(app).is_some() {
                let _ = install(app.id);
            }
        }
    }
    // CoffeeCams (2.5) se dividió en CoffeeEdit y CoffeeLive: se instalan las dos
    for (retired, extension, replacements) in RETIRED {
        let dir = coffee_core::apps_dir().join(retired);
        if !dir.is_dir() {
            continue;
        }
        let _ = fs::remove_dir_all(&dir);
        platform::remove_shortcut(retired);
        platform::unregister_file_type(retired, extension);
        for id in *replacements {
            if let Some(app) = find_app(id) {
                if is_installed(app) {
                    let target = installed_exe(app);
                    platform::register_file_type(
                        app.name,
                        app.file_type.0,
                        app.file_type.1,
                        &target,
                        app.claim_default,
                    );
                } else if package_path(app).is_some() {
                    let _ = install(app.id);
                }
            }
        }
    }

    // La carpeta antigua de aplicaciones se borra si quedó vacía
    if let Some(dir) = legacy_apps {
        let _ = fs::remove_dir(&dir);
        if let Some(parent) = dir.parent() {
            let _ = fs::remove_dir(parent);
        }
    }
}

/// Desinstala una aplicación: borra sus archivos, su acceso directo y sus
/// asociaciones de archivo. Los documentos del usuario no se tocan.
pub fn uninstall(id: &str) -> Result<SuiteApp, String> {
    let app = find_app(id).ok_or_else(|| format!("Aplicación desconocida: {id}"))?;
    let dir = install_dir(app);

    if dir.exists() {
        // Si el ejecutable está en uso Windows impide borrarlo: se comprueba
        // primero para no dejar una instalación a medias.
        let target = installed_exe(app);
        if target.is_file() {
            fs::remove_file(&target).map_err(|e| {
                format!(
                    "No se pudo desinstalar {}: ciérrala y vuelve a intentarlo ({e})",
                    app.name
                )
            })?;
        }
        fs::remove_dir_all(&dir)
            .map_err(|e| format!("No se pudieron borrar los archivos de {}: {e}", app.name))?;
    }

    platform::remove_shortcut(app.stem);
    platform::unregister_file_type(app.stem, app.file_type.0);

    Ok(describe(app))
}

/// Ejecuta una aplicación instalada, opcionalmente abriendo un archivo o
/// creando un documento nuevo con el título indicado.
pub fn launch(id: &str, file: Option<&str>, new_title: Option<&str>) -> Result<String, String> {
    let app = find_app(id).ok_or_else(|| format!("Aplicación desconocida: {id}"))?;
    let exe = installed_exe(app);
    if !exe.is_file() {
        return Err(format!(
            "{} no está instalada. Instálala desde la Tienda de Apps.",
            app.name
        ));
    }

    let mut command = Command::new(&exe);
    if let Some(dir) = exe.parent() {
        command.current_dir(dir);
    }
    if let Some(file) = file {
        command.arg(file);
    }
    if let Some(title) = new_title {
        command.arg("--new").arg(title);
    }
    command
        .spawn()
        .map_err(|e| format!("No se pudo iniciar {}: {e}", app.name))?;

    Ok(format!("{} iniciada", app.name))
}
