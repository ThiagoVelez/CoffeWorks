//! Catálogo de aplicaciones de la suite y su ciclo de vida:
//! instalar, desinstalar y ejecutar.
//!
//! El instalador de CoffeWorks deja los paquetes de cada aplicación en la
//! carpeta `packages` junto al Launcher. "Instalar" copia el paquete a
//! `%LOCALAPPDATA%\CoffeWorks\Apps\<App>`, crea su acceso directo en el menú
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
}

pub const CATALOG: &[CatalogApp] = &[
    CatalogApp {
        id: "coffedoc",
        aliases: &[],
        name: "CoffeDoc",
        subtitle: "Procesador de textos con formato enriquecido",
        description: "Documentos con estilos, tablas, imágenes y esquema automático. Abre y guarda Word (.docx), Markdown, HTML y PDF.",
        version: "v1.4",
        color_badge: "primary",
        icon_name: "file-text",
        icon_url: "/icons/CoffeText.ico",
        category: "Office",
        file_type: ("cfd", "Documento de CoffeDoc"),
        extra_extensions: &["docx", "doc", "md", "txt", "html", "htm"],
    },
    CatalogApp {
        id: "coffecalc",
        aliases: &["coffesheet"],
        name: "CoffeCalc",
        subtitle: "Hoja de cálculo con fórmulas y gráficos",
        description: "Libros con varias hojas, más de 80 funciones, formato de celdas, filtros y gráficos. Compatible con Excel (.xlsx) y CSV.",
        version: "v1.0",
        color_badge: "secondary",
        icon_name: "table",
        icon_url: "/icons/CoffeSheet.ico",
        category: "Office",
        file_type: ("cfs", "Libro de CoffeCalc"),
        extra_extensions: &["xlsx", "xls", "csv"],
    },
    CatalogApp {
        id: "coffeview",
        aliases: &["coffeslides"],
        name: "CoffeView",
        subtitle: "Presentaciones y diapositivas",
        description: "Diseñador de diapositivas con temas, formas, imágenes, transiciones, notas del orador y exportación a PowerPoint (.pptx) y PDF.",
        version: "v1.0",
        color_badge: "tertiary",
        icon_name: "presentation",
        icon_url: "/icons/CoffeSlides.ico",
        category: "Office",
        file_type: ("csl", "Presentación de CoffeView"),
        extra_extensions: &["pptx"],
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
    let id = id.to_ascii_lowercase();
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
    format!("{}{}", app.name, std::env::consts::EXE_SUFFIX)
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
    coffe_core::apps_dir().join(app.name)
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
        install_path: coffe_core::display_path(&installed_path),
    }
}

pub fn list_apps() -> Vec<SuiteApp> {
    CATALOG.iter().map(describe).collect()
}

/// Instala (o reinstala) una aplicación a partir de su paquete.
pub fn install(id: &str) -> Result<SuiteApp, String> {
    let app = find_app(id).ok_or_else(|| format!("Aplicación desconocida: {id}"))?;
    let package = package_path(app).ok_or_else(|| {
        format!(
            "No se encontró el paquete de {} en {}. Reinstala CoffeWorks para restaurarlo.",
            app.name,
            coffe_core::display_path(&packages_dir())
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

    // Las compilaciones MinGW necesitan el cargador de WebView2 junto al ejecutable.
    if let Some(package_dir) = package.parent() {
        let loader = package_dir.join("WebView2Loader.dll");
        if loader.is_file() {
            let _ = fs::copy(&loader, dir.join("WebView2Loader.dll"));
        }
    }

    // La integración con el sistema es opcional: si falla, la aplicación sigue
    // instalada y se puede abrir desde el Launcher.
    platform::create_shortcut(app.name, &target, app.subtitle);
    platform::register_file_type(app.name, app.file_type.0, app.file_type.1, &target);

    Ok(describe(app))
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

    platform::remove_shortcut(app.name);
    platform::unregister_file_type(app.name, app.file_type.0);

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
