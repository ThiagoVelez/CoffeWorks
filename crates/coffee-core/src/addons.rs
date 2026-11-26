//! Complementos de la suite: herramientas opcionales que no vienen en el
//! instalador porque solo algunas personas las necesitan.
//!
//! Se descargan una sola vez en `%LOCALAPPDATA%\CoffeeWorks\Addons\<id>` y las
//! comparten todas las aplicaciones. El Launcher los muestra en
//! «Complementos»; una aplicación también puede instalarlos en el momento en
//! que hacen falta.

use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

use serde::Serialize;

use crate::local_dir;

/// Descripción estática de un complemento.
pub struct CatalogAddon {
    pub id: &'static str,
    pub name: &'static str,
    pub summary: &'static str,
    pub description: &'static str,
    /// Aplicaciones que lo usan.
    pub apps: &'static [&'static str],
    pub version: &'static str,
    /// Tamaño aproximado de la descarga.
    pub download_size: &'static str,
    pub publisher: &'static str,
    pub license: &'static str,
    /// Ejecutable principal (sin `.exe`). Vacío en los complementos de
    /// servicio (no se descarga nada: solo se activa).
    pub executable: &'static str,
    /// Descargas (.zip) que se prueban en orden.
    pub downloads: &'static [&'static str],
    /// Mensaje para sistemas sin descarga automática.
    pub manual_hint: &'static str,
}

pub const ADDONS: &[CatalogAddon] = &[
    CatalogAddon {
        id: "accdb",
        name: "Compatibilidad con Access",
        summary: "Guarda bases de CoffeeDataBase en formato .accdb y .mdb",
        description: "Exporta tablas, datos, claves principales y relaciones a archivos .accdb (Access 2010 o posterior) y .mdb. Es un programa pequeño que solo se ejecuta al exportar: no necesita Java ni deja nada abierto.",
        apps: &["coffeedatabase"],
        version: "1.0.0",
        download_size: "8 MB",
        publisher: "CoffeeWorks",
        license: "Apache 2.0 (Jackcess)",
        executable: "coffee-accdb",
        downloads: &["https://github.com/ThiagoVelez/CoffeWorks/releases/download/addons/coffee-accdb-win64.zip"],
        manual_hint: "Este complemento solo está disponible para Windows.",
    },
    CatalogAddon {
        id: "ffmpeg",
        name: "Motor de video FFmpeg",
        summary: "Codificación de video y audio: transmisión, cola de exportación y formatos MP4, MOV, MP3, FLAC...",
        description: "Codifica el video para Twitch, YouTube, Facebook o cualquier servidor RTMP/SRT, con aceleración NVIDIA NVENC, Intel Quick Sync o AMD AMF si el equipo la tiene. También es el motor de CoffeeEncoder (convertir a H.264, HEVC, ProRes, GIF...), de la exportación a MP4 de CoffeeEdit, CoffeeMotion y CoffeeAnimate, y de la exportación a MP3, OGG y FLAC de CoffeeSound.",
        apps: &["coffeelive", "coffeeencoder", "coffeeedit", "coffeemotion", "coffeeanimate", "coffeesound"],
        version: "7.x",
        download_size: "90 MB",
        publisher: "Proyecto FFmpeg",
        license: "GPL",
        executable: "ffmpeg",
        downloads: &[
            "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip",
            "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip",
        ],
        manual_hint: "Instala ffmpeg con el gestor de paquetes del sistema: sudo apt install ffmpeg",
    },
    CatalogAddon {
        id: "pdfcheck",
        name: "Revisión del PDF original",
        summary: "Revisa la ortografía del texto que ya trae el PDF, también si está escaneado",
        description: "CoffeePDF revisa por defecto solo los textos que agregas. Con este complemento también revisa el texto original del documento: lo subraya en rojo, lo cuenta en el indicador de faltas y lo corrige con clic derecho (tapa la palabra y escribe la corrección encima). En las páginas escaneadas reconoce el texto con OCR (Tesseract) en español e inglés.",
        apps: &["coffeepdf"],
        version: "5.4",
        download_size: "36 MB",
        publisher: "Proyecto Tesseract OCR",
        license: "Apache 2.0",
        executable: "tesseract",
        downloads: &["https://github.com/ThiagoVelez/CoffeWorks/releases/download/addons/coffee-pdfcheck-win64.zip"],
        manual_hint: "Instala Tesseract con el gestor de paquetes del sistema (por ejemplo: sudo apt install tesseract-ocr tesseract-ocr-spa).",
    },
    CatalogAddon {
        id: "aigen",
        name: "IA generativa",
        summary: "Relleno generativo y generar imágenes a partir de una descripción en CoffeePhoto",
        description: "Rellena una selección con lo que describas (quitar o añadir objetos, ampliar el fondo) y genera imágenes nuevas como capas. Usa un servicio compatible con la API de imágenes de OpenAI con tu propia clave, que solo se guarda en este equipo. Sin el complemento, CoffeePhoto ya incluye «Relleno según el contenido», que no necesita internet.",
        apps: &["coffeephoto"],
        version: "1.0",
        download_size: "Sin descarga",
        publisher: "CoffeeWorks",
        license: "Servicio externo (requiere clave de API)",
        executable: "",
        downloads: &[],
        manual_hint: "",
    },
    CatalogAddon {
        id: "raw",
        name: "Revelado RAW",
        summary: "Abre fotos RAW de cámara (CR2, CR3, NEF, ARW, DNG, RAF, ORF, RW2) en CoffeeLens y CoffeePhoto",
        description: "Decodifica los archivos RAW de casi todas las cámaras con LibRaw, con balance de blancos de la cámara y espacio de color sRGB, para revelarlos en CoffeeLens o retocarlos en CoffeePhoto.",
        apps: &["coffeelens", "coffeephoto"],
        version: "0.21",
        download_size: "4 MB",
        publisher: "Proyecto LibRaw",
        license: "LGPL 2.1 / CDDL",
        executable: "dcraw_emu",
        downloads: &["https://github.com/ThiagoVelez/CoffeWorks/releases/download/addons/coffee-raw-win64.zip"],
        manual_hint: "Instala LibRaw con el gestor de paquetes del sistema (por ejemplo: sudo apt install libraw-bin).",
    },
    CatalogAddon {
        id: "potrace",
        name: "Calco vectorial",
        summary: "Convierte imágenes y dibujos en trazados vectoriales en CoffeeVector y CoffeePaint",
        description: "Calca una imagen de mapa de bits (un logotipo escaneado, una foto o un dibujo de CoffeePaint) y la convierte en trazados vectoriales editables, en blanco y negro o por colores. Usa Potrace.",
        apps: &["coffeevector", "coffeepaint"],
        version: "1.16",
        download_size: "1 MB",
        publisher: "Peter Selinger (Potrace)",
        license: "GPL",
        executable: "potrace",
        downloads: &["https://github.com/ThiagoVelez/CoffeWorks/releases/download/addons/coffee-potrace-win64.zip"],
        manual_hint: "Instala Potrace con el gestor de paquetes del sistema (por ejemplo: sudo apt install potrace).",
    },
    CatalogAddon {
        id: "puppetcompat",
        name: "Compatibilidad para equipos antiguos",
        summary: "Seguimiento facial de CoffeePuppet en procesadores sin instrucciones SIMD",
        description: "CoffeePuppet sigue tu cara con un motor optimizado para los procesadores actuales. Este complemento añade la versión compatible con equipos muy antiguos, cuyo procesador no tiene instrucciones SIMD. Solo hace falta si CoffeePuppet te lo pide.",
        apps: &["coffeepuppet"],
        version: "0.10.21",
        download_size: "4 MB",
        publisher: "Google (MediaPipe)",
        license: "Apache 2.0",
        // Complemento de datos: el «ejecutable» es el archivo que se comprueba
        executable: "vision_wasm_nosimd_internal.wasm",
        downloads: &["https://github.com/ThiagoVelez/CoffeWorks/releases/download/addons/coffee-puppetcompat.zip"],
        manual_hint: "Este complemento se instala desde el Launcher de CoffeeWorks.",
    },
    CatalogAddon {
        id: "ca3d-modelado",
        name: "Modelado libre de CoffeeAnimate3D",
        summary: "Modela criaturas y personajes con formas libres: vértices, aristas, caras, simetría y suavizado",
        description: "Añade a CoffeeAnimate3D las piezas de tipo Malla para modelar formas libres y orgánicas: edición de vértices, aristas y caras (extruir, insertar cara, corte en bucle, biselar, unir, borrar, crear cara), edición proporcional, simetría en X y suavizado. También convierte piezas en malla conservando su pintura e importa .obj y .glb como mallas editables. Funciona sin conexión.",
        apps: &["coffeeanimate3d"],
        version: "1.0",
        download_size: "Sin descarga",
        publisher: "CoffeeWorks",
        license: "MIT",
        executable: "",
        downloads: &[],
        manual_hint: "",
    },
    CatalogAddon {
        id: "ca3d-render",
        name: "Render de CoffeeAnimate3D",
        summary: "Imágenes de calidad con luces, sombras y oclusión ambiental, y vueltas de 360° en video",
        description: "Añade a CoffeeAnimate3D el menú Ver › Render: luz de sol y cielo, sombras, oclusión ambiental, fondo de color o transparente, imágenes de hasta 3840×2160 y una vuelta de 360° alrededor del modelo en video WebM o GIF. Funciona sin conexión.",
        apps: &["coffeeanimate3d"],
        version: "1.0",
        download_size: "Sin descarga",
        publisher: "CoffeeWorks",
        license: "MIT",
        executable: "",
        downloads: &[],
        manual_hint: "",
    },
    CatalogAddon {
        id: "ca3d-piezas",
        name: "Pack de piezas para CoffeeAnimate3D",
        summary: "Árboles, plantas, rocas, bloques y muebles listos para insertar en tus modelos",
        description: "Más de 20 piezas con el estilo de SurvivalForest (roble, pino, palma de cera, frailejón, cafeto, setas, rocas, bloques de hierba, piedra, arena roja, nieve y madera, mesa, silla, cofre, cama, farol…) que se insertan como un grupo en el modelo abierto (Ver › Piezas) y se pueden pintar y modificar.",
        apps: &["coffeeanimate3d"],
        version: "1.0",
        download_size: "35 KB",
        publisher: "CoffeeWorks",
        license: "CC0",
        // Complemento de datos: el «ejecutable» es el índice que se comprueba
        executable: "piezas.json",
        downloads: &["https://github.com/ThiagoVelez/CoffeWorks/releases/download/addons/coffee-ca3d-piezas.zip"],
        manual_hint: "Este complemento se instala desde el Launcher de CoffeeWorks.",
    },
    CatalogAddon {
        id: "officeconv",
        name: "Motor de conversión (LibreOffice)",
        summary: "Convierte Word, Excel, PowerPoint, OpenDocument, RTF y EPUB a PDF en CoffeeConvert",
        description: "CoffeeConvert usa LibreOffice para pasar a PDF documentos de Word (.docx, .doc), Excel (.xlsx, .xls), PowerPoint (.pptx, .ppt), OpenDocument (.odt, .ods, .odp), RTF y EPUB con su formato. En Linux se instala aquí; en Windows se usa el LibreOffice que tengas instalado.",
        apps: &["coffeeconvert"],
        version: "24.x",
        download_size: "~300 MB",
        publisher: "The Document Foundation",
        license: "MPL 2.0",
        executable: "soffice",
        downloads: &[],
        manual_hint: "Instala LibreOffice desde https://www.libreoffice.org/download (gratis) y vuelve a CoffeeConvert: se detecta solo.",
    },
    CatalogAddon {
        id: "latex",
        name: "Motor LaTeX",
        summary: "Compila documentos LaTeX a PDF en CoffeeLatex y CoffeeConvert",
        description: "Convierte los documentos de CoffeeLatex en un PDF con el aspecto de LaTeX: fórmulas, ecuaciones numeradas, tablas, figuras y referencias. En Windows es Tectonic, que la primera vez descarga de internet los paquetes que el documento usa y después funciona sin conexión. En Linux se instala TeX Live (XeLaTeX) con los paquetes de español y de ciencias.",
        apps: &["coffeelatex", "coffeeconvert"],
        version: "0.15",
        download_size: "~25 MB (Windows) · ~400 MB (Linux, TeX Live)",
        publisher: "Proyecto Tectonic · TeX Live",
        license: "MIT (Tectonic) · LPPL (TeX Live)",
        executable: "tectonic",
        downloads: &["https://github.com/ThiagoVelez/CoffeWorks/releases/download/addons/coffee-latex-win64.zip"],
        manual_hint: "Instala TeX Live con el gestor de paquetes del sistema: sudo apt install texlive-xetex texlive-lang-spanish texlive-science",
    },
    CatalogAddon {
        id: "latexocr",
        name: "Fórmulas desde foto",
        summary: "Pasa fotos de notas y fórmulas a LaTeX en CoffeeLatex («Desde foto»)",
        description: "Reconoce fórmulas en fotos de tus apuntes y las convierte en LaTeX editable, con las dudas marcadas y sugerencias de un diccionario de física y matemáticas. Funciona sin internet, dentro de CoffeeLatex. Lee mejor la letra clara; con letra desordenada o páginas muy llenas comete más errores, y por eso marca lo dudoso. El texto de los renglones se lee con el complemento «Revisión del PDF original» (Tesseract), si está instalado.",
        apps: &["coffeelatex"],
        version: "pix2tex 0.1",
        download_size: "~165 MB",
        publisher: "pix2tex (Lukas Blecher) · RapidLaTeXOCR (RapidAI)",
        license: "MIT",
        // Complemento de datos: el «ejecutable» es el archivo que se comprueba
        executable: "encoder.onnx",
        downloads: &["https://github.com/ThiagoVelez/CoffeWorks/releases/download/addons/coffee-latexocr.zip"],
        manual_hint: "Este complemento se instala desde el Launcher de CoffeeWorks › Complementos.",
    },
    CatalogAddon {
        id: "pandoc",
        name: "Conversor de documentos (Pandoc)",
        summary: "Convierte LaTeX y Markdown a Word, ODT, HTML y entre sí, conservando las fórmulas",
        description: "CoffeeLatex lo usa para exportar a Word (.docx), OpenDocument (.odt) y para pasar de LaTeX a Markdown y al revés. CoffeeConvert lo usa en los apartados «Desde LaTeX» y «Desde Markdown». Las fórmulas se convierten en ecuaciones editables de Word.",
        apps: &["coffeelatex", "coffeeconvert"],
        version: "3.x",
        download_size: "~40 MB",
        publisher: "John MacFarlane y colaboradores",
        license: "GPL-2.0",
        executable: "pandoc",
        downloads: &["https://github.com/ThiagoVelez/CoffeWorks/releases/download/addons/coffee-pandoc-win64.zip"],
        manual_hint: "Instala Pandoc con el gestor de paquetes del sistema: sudo apt install pandoc",
    },
];

/// Dónde está LibreOffice en Windows (se usa el instalado en el equipo).
fn windows_soffice() -> Option<PathBuf> {
    let mut roots: Vec<PathBuf> = ["ProgramFiles", "ProgramFiles(x86)", "ProgramW6432"]
        .iter()
        .filter_map(|v| std::env::var_os(v).map(PathBuf::from))
        .collect();
    roots.push(PathBuf::from(r"C:\Program Files"));
    roots
        .into_iter()
        .map(|r| r.join("LibreOffice").join("program").join("soffice.exe"))
        .find(|p| p.is_file())
}

/// Archivo que marca como activado un complemento de servicio.
const SERVICE_MARKER: &str = "activado.txt";

/// Carpeta común de los complementos.
pub fn addons_dir() -> PathBuf {
    local_dir().join("Addons")
}

pub fn find_addon(id: &str) -> Option<&'static CatalogAddon> {
    ADDONS.iter().find(|a| a.id == id)
}

/// Los complementos de datos indican un archivo con extensión, que se usa tal cual.
fn is_data_file(base: &str) -> bool {
    base.contains('.')
}

fn exe_name(base: &str) -> String {
    if is_data_file(base) {
        base.to_string()
    } else if cfg!(windows) {
        format!("{base}.exe")
    } else {
        base.to_string()
    }
}

/// Ruta del ejecutable del complemento si está instalado.
pub fn addon_executable(id: &str) -> Option<PathBuf> {
    let addon = find_addon(id)?;
    if addon.executable.is_empty() {
        let marker = addons_dir().join(addon.id).join(SERVICE_MARKER);
        return marker.is_file().then_some(marker);
    }
    if addon.id == "officeconv" && cfg!(windows) {
        return windows_soffice();
    }
    let path = addons_dir().join(addon.id).join(exe_name(addon.executable));
    if path.is_file() {
        return Some(path);
    }
    // Fuera de Windows se usa el programa instalado con el gestor de paquetes.
    if cfg!(windows) || is_data_file(addon.executable) {
        return None;
    }
    // En Linux el «Motor LaTeX» es el XeLaTeX de TeX Live (Tectonic no está en apt).
    let alternativos: &[&str] = if addon.id == "latex" {
        &["xelatex"]
    } else {
        &[]
    };
    std::env::var_os("PATH").and_then(|paths| {
        let dirs: Vec<PathBuf> = std::env::split_paths(&paths).collect();
        std::iter::once(addon.executable)
            .chain(alternativos.iter().copied())
            .flat_map(|exe| dirs.iter().map(move |dir| dir.join(exe)))
            .find(|candidate| candidate.is_file())
    })
}

/// Estado de un complemento para mostrarlo en la interfaz.
#[derive(Debug, Clone, Serialize)]
pub struct AddonInfo {
    pub id: String,
    pub name: String,
    pub summary: String,
    pub description: String,
    pub apps: Vec<String>,
    pub version: String,
    pub download_size: String,
    pub publisher: String,
    pub license: String,
    pub installed: bool,
    /// Espacio ocupado en disco (bytes) si está instalado.
    pub installed_bytes: u64,
    /// Si se puede instalar automáticamente en este sistema.
    pub can_install: bool,
    pub manual_hint: String,
}

fn dir_size(path: &Path) -> u64 {
    fs::read_dir(path)
        .map(|entries| {
            entries
                .flatten()
                .map(|e| {
                    let p = e.path();
                    if p.is_dir() {
                        dir_size(&p)
                    } else {
                        e.metadata().map(|m| m.len()).unwrap_or(0)
                    }
                })
                .sum()
        })
        .unwrap_or(0)
}

pub fn addon_info(addon: &CatalogAddon) -> AddonInfo {
    let installed = addon_executable(addon.id).is_some();
    AddonInfo {
        id: addon.id.into(),
        name: addon.name.into(),
        summary: addon.summary.into(),
        description: addon.description.into(),
        apps: addon.apps.iter().map(|a| a.to_string()).collect(),
        version: addon.version.into(),
        download_size: addon.download_size.into(),
        publisher: addon.publisher.into(),
        license: addon.license.into(),
        installed,
        installed_bytes: if installed {
            dir_size(&addons_dir().join(addon.id))
        } else {
            0
        },
        can_install: (cfg!(windows) && !addon.downloads.is_empty())
            || addon.executable.is_empty()
            || is_data_file(addon.executable)
            || !linux_packages(addon.id).is_empty(),
        manual_hint: addon.manual_hint.into(),
    }
}

pub fn list_addons() -> Vec<AddonInfo> {
    ADDONS.iter().map(addon_info).collect()
}

/// Evita que aparezca una consola al lanzar procesos en Windows.
pub fn hidden(cmd: &mut Command) -> &mut Command {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    cmd
}

/// Cita un texto para PowerShell.
pub fn ps_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "''"))
}

/// Windows PowerShell oculto, listo para ejecutar `script`. No hereda `PSModulePath`:
/// si CoffeeWorks se abrió desde PowerShell 7, esas rutas hacen que Windows PowerShell
/// cargue módulos incompatibles (por ejemplo, un Expand-Archive que falla).
pub fn powershell_command(script: &str) -> Command {
    let mut cmd = Command::new("powershell");
    hidden(&mut cmd)
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            script,
        ])
        .env_remove("PSModulePath")
        .stdin(Stdio::null());
    cmd
}

/// Script de PowerShell que descomprime `zip` en `dest` con .NET (sin Expand-Archive),
/// sobrescribiendo lo que exista y sin dejar escribir fuera de `dest`.
pub fn ps_unzip_script(zip: &str, dest: &str) -> String {
    format!(
        "Add-Type -AssemblyName System.IO.Compression.FileSystem; \
         $dest = [IO.Path]::GetFullPath({dest}); New-Item -ItemType Directory -Force $dest | Out-Null; \
         $raiz = $dest.TrimEnd('\\') + '\\'; \
         $z = [IO.Compression.ZipFile]::OpenRead({zip}); \
         try {{ foreach ($e in $z.Entries) {{ \
           $p = [IO.Path]::GetFullPath([IO.Path]::Combine($dest, $e.FullName)); \
           if (-not $p.StartsWith($raiz, [StringComparison]::OrdinalIgnoreCase)) {{ throw ('Ruta no válida en el paquete: ' + $e.FullName) }}; \
           if ($e.FullName.EndsWith('/') -or $e.FullName.EndsWith('\\')) {{ New-Item -ItemType Directory -Force $p | Out-Null }} \
           else {{ New-Item -ItemType Directory -Force ([IO.Path]::GetDirectoryName($p)) | Out-Null; \
                  [IO.Compression.ZipFileExtensions]::ExtractToFile($e, $p, $true) }} }} }} \
         finally {{ $z.Dispose() }}",
        zip = ps_quote(zip),
        dest = ps_quote(dest),
    )
}

/// Ejecuta un script de PowerShell oculto y devuelve su salida.
pub fn run_powershell(script: &str) -> Result<String, String> {
    let output = powershell_command(script)
        .output()
        .map_err(|e| format!("No se pudo iniciar PowerShell: {e}"))?;
    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    } else {
        let err = String::from_utf8_lossy(&output.stderr).trim().to_string();
        Err(err
            .lines()
            .last()
            .unwrap_or("Error desconocido")
            .to_string())
    }
}

/// Paquetes de Debian/Ubuntu que dan el programa de cada complemento en Linux.
pub fn linux_packages(id: &str) -> &'static [&'static str] {
    match id {
        "ffmpeg" => &["ffmpeg"],
        "pdfcheck" => &["tesseract-ocr", "tesseract-ocr-spa", "tesseract-ocr-eng"],
        "raw" => &["libraw-bin"],
        "potrace" => &["potrace"],
        "officeconv" => &[
            "libreoffice-writer",
            "libreoffice-calc",
            "libreoffice-impress",
        ],
        "latex" => &["texlive-xetex", "texlive-lang-spanish", "texlive-science"],
        "pandoc" => &["pandoc"],
        _ => &[],
    }
}

/// Instala paquetes del sistema con apt; pkexec muestra la ventana de contraseña.
fn apt_install(packages: &[&str]) -> Result<(), String> {
    let output = Command::new("pkexec")
        .args(["apt-get", "install", "-y"])
        .args(packages)
        .stdin(Stdio::null())
        .output()
        .map_err(|e| format!("No se pudo pedir permiso para instalar (pkexec): {e}"))?;
    if output.status.success() {
        Ok(())
    } else if output.status.code() == Some(126) || output.status.code() == Some(127) {
        Err("Se canceló la instalación (no se dio la contraseña).".into())
    } else {
        let err = String::from_utf8_lossy(&output.stderr).trim().to_string();
        Err(format!(
            "apt no pudo instalar {}: {}",
            packages.join(", "),
            err.lines().last().unwrap_or("error desconocido")
        ))
    }
}

/// Descarga un archivo (HTTPS) a la ruta indicada.
pub fn download_file(url: &str, target: &Path) -> Result<(), String> {
    if !cfg!(windows) {
        let output = Command::new("curl")
            .args(["-fsSL", "--retry", "3", "-A", "CoffeeWorks", "-o"])
            .arg(target)
            .arg(url)
            .stdin(Stdio::null())
            .output()
            .map_err(|e| format!("No se pudo ejecutar curl: {e}"))?;
        return if output.status.success() {
            Ok(())
        } else {
            Err(format!(
                "No se pudo descargar {url}: {}",
                String::from_utf8_lossy(&output.stderr).trim()
            ))
        };
    }
    let script = format!(
        "$ErrorActionPreference='Stop'; $ProgressPreference='SilentlyContinue'; \
         [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; \
         Invoke-WebRequest -UseBasicParsing -Headers @{{ 'User-Agent'='CoffeeWorks' }} -Uri {url} -OutFile {out}",
        url = ps_quote(url),
        out = ps_quote(&target.to_string_lossy()),
    );
    run_powershell(&script)
        .map(|_| ())
        .map_err(|e| format!("No se pudo descargar {url}: {e}"))
}

/// Descarga e instala un complemento. Prueba cada descarga en orden.
pub fn install_addon(id: &str) -> Result<AddonInfo, String> {
    let addon = find_addon(id).ok_or_else(|| format!("Complemento desconocido: {id}"))?;
    if addon.executable.is_empty() {
        // Complemento de servicio: solo se activa
        let dir = addons_dir().join(addon.id);
        fs::create_dir_all(&dir)
            .map_err(|e| format!("No se pudo activar «{}»: {e}", addon.name))?;
        fs::write(dir.join(SERVICE_MARKER), addon.description)
            .map_err(|e| format!("No se pudo activar «{}»: {e}", addon.name))?;
        return Ok(addon_info(addon));
    }
    // Programas que se usan ya instalados en Windows (LibreOffice): solo se comprueban.
    if cfg!(windows) && addon.downloads.is_empty() {
        return if addon_executable(addon.id).is_some() {
            Ok(addon_info(addon))
        } else {
            Err(addon.manual_hint.to_string())
        };
    }
    if !cfg!(windows) {
        // Linux: los programas vienen de apt; los complementos de datos se descargan
        let packages = linux_packages(addon.id);
        if !packages.is_empty() {
            apt_install(packages)?;
            return if addon_executable(addon.id).is_some() {
                Ok(addon_info(addon))
            } else {
                Err(addon.manual_hint.to_string())
            };
        }
        if !is_data_file(addon.executable) {
            return Err(addon.manual_hint.to_string());
        }
        let target_dir = addons_dir().join(addon.id);
        fs::create_dir_all(&target_dir)
            .map_err(|e| format!("No se pudo preparar la carpeta: {e}"))?;
        let zip = std::env::temp_dir().join(format!("coffeeworks-addon-{}.zip", addon.id));
        let mut last = String::new();
        for url in addon.downloads {
            if let Err(e) = download_file(url, &zip) {
                last = e;
                continue;
            }
            let out = Command::new("unzip")
                .args(["-o", "-j", "-q"])
                .arg(&zip)
                .arg("-d")
                .arg(&target_dir)
                .stdin(Stdio::null())
                .output();
            let _ = fs::remove_file(&zip);
            match out {
                Ok(o) if o.status.success() && addon_executable(addon.id).is_some() => {
                    return Ok(addon_info(addon))
                }
                Ok(o) => last = String::from_utf8_lossy(&o.stderr).trim().to_string(),
                Err(e) => last = format!("No se pudo ejecutar unzip: {e}"),
            }
        }
        return Err(format!("No se pudo instalar «{}». {last}", addon.name));
    }
    let target_dir = addons_dir().join(addon.id);
    fs::create_dir_all(&target_dir).map_err(|e| format!("No se pudo preparar la carpeta: {e}"))?;
    let exe = exe_name(addon.executable);
    let temp = std::env::temp_dir();
    let zip = temp.join(format!("coffeeworks-addon-{}.zip", addon.id));
    let unpack = temp.join(format!("coffeeworks-addon-{}", addon.id));
    let mut last_error = String::new();
    for url in addon.downloads {
        // Se copia la carpeta del ejecutable completa (algunos traen DLL al lado).
        let script = format!(
            "$ErrorActionPreference='Stop'; $ProgressPreference='SilentlyContinue'; \
             [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; \
             Invoke-WebRequest -UseBasicParsing -Uri {url} -OutFile {zip}; \
             if (Test-Path {unpack}) {{ Remove-Item {unpack} -Recurse -Force }}; \
             {unzip}; \
             $exe = Get-ChildItem {unpack} -Recurse -Filter {exe} | Select-Object -First 1; \
             if (-not $exe) {{ throw ('El paquete no contiene ' + {exe}) }}; \
             Get-ChildItem $exe.DirectoryName -File | Copy-Item -Destination {target} -Force",
            url = ps_quote(url),
            zip = ps_quote(&zip.to_string_lossy()),
            unpack = ps_quote(&unpack.to_string_lossy()),
            exe = ps_quote(&exe),
            target = ps_quote(&target_dir.to_string_lossy()),
            unzip = ps_unzip_script(&zip.to_string_lossy(), &unpack.to_string_lossy()),
        );
        let output = powershell_command(&script)
            .output()
            .map_err(|e| format!("No se pudo iniciar PowerShell: {e}"))?;
        let _ = fs::remove_file(&zip);
        let _ = fs::remove_dir_all(&unpack);
        if output.status.success() && target_dir.join(&exe).is_file() {
            return Ok(addon_info(addon));
        }
        last_error = String::from_utf8_lossy(&output.stderr).trim().to_string();
    }
    Err(format!(
        "No se pudo descargar «{}». Revisa la conexión a Internet e inténtalo de nuevo.\n{}",
        addon.name,
        last_error.lines().last().unwrap_or_default()
    ))
}

pub fn uninstall_addon(id: &str) -> Result<AddonInfo, String> {
    let addon = find_addon(id).ok_or_else(|| format!("Complemento desconocido: {id}"))?;
    let dir = addons_dir().join(addon.id);
    if dir.exists() {
        fs::remove_dir_all(&dir).map_err(|e| {
            format!(
                "No se pudo quitar «{}» (¿se está usando ahora mismo?): {e}",
                addon.name
            )
        })?;
    }
    Ok(addon_info(addon))
}

/// Ejecuta un complemento instalado. Si se da `input`, se escribe en un archivo
/// temporal y su ruta sustituye a `{input}` en los argumentos.
pub fn run_addon(id: &str, args: &[String], input: Option<&str>) -> Result<String, String> {
    run_addon_with(id, args, input.map(|t| t.as_bytes()), "json")
}

/// Como [`run_addon`], pero con una entrada binaria (por ejemplo, una imagen)
/// que se guarda con la extensión indicada.
pub fn run_addon_with(
    id: &str,
    args: &[String],
    input: Option<&[u8]>,
    extension: &str,
) -> Result<String, String> {
    let addon = find_addon(id).ok_or_else(|| format!("Complemento desconocido: {id}"))?;
    let exe = addon_executable(id)
        .ok_or_else(|| format!("El complemento «{}» no está instalado.", addon.name))?;
    let extension: String = extension
        .chars()
        .filter(|c| c.is_ascii_alphanumeric())
        .take(8)
        .collect();
    let input_path = std::env::temp_dir().join(format!(
        "coffeeworks-{}-{}.{}",
        addon.id,
        crate::now_millis(),
        extension
    ));
    if let Some(data) = input {
        fs::write(&input_path, data)
            .map_err(|e| format!("No se pudo preparar el archivo temporal: {e}"))?;
    }
    let path_text = input_path.to_string_lossy().to_string();
    // `{output}`: el programa escribe un archivo y se devuelve su contenido en base64
    let output_path = std::env::temp_dir().join(format!(
        "coffeeworks-{}-{}-out",
        addon.id,
        crate::now_millis()
    ));
    let wants_output = args.iter().any(|a| a.contains("{output}"));
    // `{stdout-base64}`: no se pasa al programa; su salida estándar se devuelve en base64
    let stdout_binary = args.iter().any(|a| a == "{stdout-base64}");
    let out_text = output_path.to_string_lossy().to_string();
    let args: Vec<String> = args
        .iter()
        .filter(|a| *a != "{stdout-base64}")
        .map(|a| {
            a.replace("{input}", &path_text)
                .replace("{output}", &out_text)
        })
        .collect();
    let mut command = Command::new(&exe);
    // Los datos que acompañan al programa (p. ej., los idiomas del OCR) van a su lado.
    if let Some(dir) = exe.parent() {
        let has_data = fs::read_dir(dir)
            .map(|entries| {
                entries
                    .flatten()
                    .any(|e| e.path().extension().is_some_and(|x| x == "traineddata"))
            })
            .unwrap_or(false);
        if has_data {
            command.env("TESSDATA_PREFIX", dir);
        }
    }
    let output = hidden(command.args(&args))
        .stdin(Stdio::null())
        .output()
        .map_err(|e| format!("No se pudo ejecutar «{}»: {e}", addon.name));
    let _ = fs::remove_file(&input_path);
    let output = output?;
    if output.status.success() && wants_output {
        use base64::Engine as _;
        let bytes = fs::read(&output_path)
            .map_err(|_| format!("«{}» no generó ningún resultado.", addon.name))?;
        let _ = fs::remove_file(&output_path);
        Ok(base64::engine::general_purpose::STANDARD.encode(bytes))
    } else if output.status.success() && stdout_binary {
        use base64::Engine as _;
        Ok(base64::engine::general_purpose::STANDARD.encode(&output.stdout))
    } else if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    } else {
        let _ = fs::remove_file(&output_path);
        let err = String::from_utf8_lossy(&output.stderr).trim().to_string();
        Err(if err.is_empty() {
            format!("«{}» terminó con un error.", addon.name)
        } else {
            err
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn powershell_no_hereda_las_rutas_de_modulos() {
        // Si se hereda PSModulePath de PowerShell 7, Windows PowerShell carga un
        // Expand-Archive incompatible (MethodCountCouldNotFindBest).
        let cmd = powershell_command("Write-Output 1");
        assert!(cmd
            .get_envs()
            .any(|(k, v)| k == "PSModulePath" && v.is_none()));
        assert_eq!(cmd.get_program(), "powershell");
    }

    #[test]
    fn descomprimir_no_usa_expand_archive_y_frena_rutas_fuera() {
        let s = ps_unzip_script("C:\\tmp\\a.zip", "C:\\tmp\\destino");
        assert!(!s.contains("Expand-Archive"));
        assert!(s.contains("System.IO.Compression"));
        assert!(
            s.contains("StartsWith"),
            "comprueba que nada se escriba fuera del destino"
        );
        assert!(s.contains("'C:\\tmp\\a.zip'") && s.contains("'C:\\tmp\\destino'"));
    }

    #[test]
    fn catalogo_modelado_libre_es_de_servicio() {
        let a = find_addon("ca3d-modelado").expect("ca3d-modelado en el catálogo");
        assert_eq!(a.name, "Modelado libre de CoffeeAnimate3D");
        assert_eq!(a.executable, "");
        assert_eq!(a.download_size, "Sin descarga");
        assert_eq!(a.apps, &["coffeeanimate3d"]);
        assert_eq!(a.license, "MIT");
        assert!(addon_info(a).can_install);
    }
}
