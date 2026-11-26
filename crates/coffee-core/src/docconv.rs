//! Documentos científicos: compilar LaTeX a PDF (complemento «Motor LaTeX») y convertir entre
//! LaTeX, Markdown, Word, ODT y HTML (complemento «Pandoc»). Lo usan CoffeeLatex y CoffeeConvert.

use std::fs;
use std::path::{Component, Path, PathBuf};
use std::process::{Command, Stdio};

use base64::Engine as _;
use serde::Serialize;

use crate::addons::{addon_executable, hidden};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Motor {
    Tectonic,
    Xelatex,
}

#[derive(Debug, Clone, Serialize)]
pub struct ErrorCompilacion {
    pub mensaje: String,
    pub registro: String,
}

fn en_path(nombre: &str) -> Option<PathBuf> {
    let exe = if cfg!(windows) {
        format!("{nombre}.exe")
    } else {
        nombre.to_string()
    };
    std::env::var_os("PATH").and_then(|p| {
        std::env::split_paths(&p)
            .map(|d| d.join(&exe))
            .find(|c| c.is_file())
    })
}

fn motor_de(ruta: &Path) -> Motor {
    let nombre = ruta
        .file_stem()
        .map(|s| s.to_string_lossy().to_lowercase())
        .unwrap_or_default();
    if nombre.contains("xelatex") {
        Motor::Xelatex
    } else {
        Motor::Tectonic
    }
}

/// El motor instalado: el complemento, o `tectonic` / `xelatex` del sistema.
pub fn motor_latex() -> Option<(PathBuf, Motor)> {
    if let Some(p) = addon_executable("latex") {
        return Some((p.clone(), motor_de(&p)));
    }
    en_path("tectonic")
        .map(|p| (p, Motor::Tectonic))
        .or_else(|| en_path("xelatex").map(|p| (p, Motor::Xelatex)))
}

/// Pandoc: el complemento o el del sistema.
pub fn pandoc() -> Option<PathBuf> {
    addon_executable("pandoc").or_else(|| en_path("pandoc"))
}

/// Versión «mayor.menor» de la primera línea de `pandoc --version` («pandoc 3.1.3»).
fn version_pandoc(salida: &str) -> Option<(u32, u32)> {
    let v = salida.lines().next()?.split_whitespace().nth(1)?;
    let mut partes = v.split('.').map(|p| p.parse::<u32>().ok());
    Some((partes.next()??, partes.next().flatten().unwrap_or(0)))
}

/// `--sandbox` (Pandoc 2.15 o posterior) impide que el documento lea otros archivos del equipo.
fn admite_sandbox(exe: &Path) -> bool {
    static CACHE: std::sync::OnceLock<std::sync::Mutex<std::collections::HashMap<PathBuf, bool>>> =
        std::sync::OnceLock::new();
    let cache = CACHE.get_or_init(Default::default);
    if let Some(v) = cache.lock().ok().and_then(|c| c.get(exe).copied()) {
        return v;
    }
    let mut cmd = Command::new(exe);
    cmd.arg("--version").stdin(Stdio::null());
    let v = hidden(&mut cmd)
        .output()
        .ok()
        .and_then(|o| version_pandoc(&String::from_utf8_lossy(&o.stdout)))
        .is_some_and(|v| v >= (2, 15));
    if let Ok(mut c) = cache.lock() {
        c.insert(exe.to_path_buf(), v);
    }
    v
}

/// Carpeta temporal propia que se borra al terminar.
struct Temporal(PathBuf);

impl Temporal {
    fn nueva(prefijo: &str) -> Result<Self, String> {
        let mut r = [0u8; 6];
        let _ = getrandom::fill(&mut r);
        let sufijo: String = r.iter().map(|b| format!("{b:02x}")).collect();
        let dir = std::env::temp_dir().join(format!("{prefijo}-{}-{sufijo}", crate::now_millis()));
        fs::create_dir_all(&dir)
            .map_err(|e| format!("No se pudo crear la carpeta temporal: {e}"))?;
        Ok(Self(dir))
    }
}

impl Drop for Temporal {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}

/// Una ruta relativa segura dentro de la carpeta de trabajo (sin `..` ni raíz).
fn ruta_segura(base: &Path, nombre: &str) -> Option<PathBuf> {
    let rel = Path::new(nombre);
    if nombre.is_empty() || !rel.components().all(|c| matches!(c, Component::Normal(_))) {
        return None;
    }
    Some(base.join(rel))
}

fn primera_linea_de_error(registro: &str) -> String {
    registro
        .lines()
        .find(|l| l.starts_with("! ") || l.starts_with("error:"))
        .map(|l| {
            l.trim_start_matches("! ")
                .trim_start_matches("error:")
                .trim()
                .to_string()
        })
        .unwrap_or_else(|| "El documento no se pudo compilar.".into())
}

/// Compila `tex` a PDF. `archivos` son las imágenes y demás archivos que el documento usa.
pub fn compilar_latex(
    tex: &str,
    archivos: &[(String, Vec<u8>)],
) -> Result<Vec<u8>, ErrorCompilacion> {
    let err = |m: String| ErrorCompilacion {
        mensaje: m,
        registro: String::new(),
    };
    let (motor, tipo) = motor_latex().ok_or_else(|| {
        err("Instala el complemento «Motor LaTeX» desde el Launcher › Complementos.".into())
    })?;
    let tmp = Temporal::nueva("coffeelatex").map_err(err)?;
    let dir = &tmp.0;
    fs::write(dir.join("documento.tex"), tex).map_err(|e| err(e.to_string()))?;
    for (nombre, datos) in archivos {
        let destino = ruta_segura(dir, nombre)
            .ok_or_else(|| err(format!("Nombre de archivo no válido: {nombre}")))?;
        if let Some(p) = destino.parent() {
            fs::create_dir_all(p).map_err(|e| err(e.to_string()))?;
        }
        fs::write(&destino, datos).map_err(|e| err(e.to_string()))?;
    }
    let ejecutar = || -> Result<std::process::Output, ErrorCompilacion> {
        let mut cmd = Command::new(&motor);
        match tipo {
            Motor::Tectonic => {
                cmd.args(["-X", "compile", "--keep-logs", "documento.tex"]);
            }
            Motor::Xelatex => {
                cmd.args([
                    "-interaction=nonstopmode",
                    "-halt-on-error",
                    "-no-shell-escape",
                    "documento.tex",
                ]);
            }
        }
        cmd.current_dir(dir)
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        hidden(&mut cmd)
            .output()
            .map_err(|e| err(format!("No se pudo ejecutar el motor LaTeX: {e}")))
    };
    let mut salida = ejecutar()?;
    let registro = |s: &std::process::Output| {
        let log = fs::read_to_string(dir.join("documento.log")).unwrap_or_default();
        if log.is_empty() {
            format!(
                "{}{}",
                String::from_utf8_lossy(&s.stdout),
                String::from_utf8_lossy(&s.stderr)
            )
        } else {
            log
        }
    };
    if tipo == Motor::Xelatex && salida.status.success() {
        let log = registro(&salida);
        if log.contains("Rerun")
            || log.contains("undefined references")
            || tex.contains("\\ref")
            || tex.contains("\\tableofcontents")
        {
            salida = ejecutar()?;
        }
    }
    let pdf = dir.join("documento.pdf");
    if salida.status.success() && pdf.is_file() {
        return fs::read(&pdf).map_err(|e| err(e.to_string()));
    }
    let reg = registro(&salida);
    Err(ErrorCompilacion {
        mensaje: primera_linea_de_error(&reg),
        registro: reg,
    })
}

const DESDE: &[&str] = &["latex", "markdown"];
const HACIA: &[&str] = &["docx", "odt", "html", "markdown", "latex"];

/// Convierte con Pandoc. `desde`: latex o markdown. `hacia`: docx, odt, html, markdown o latex.
pub fn convertir_pandoc(entrada: &[u8], desde: &str, hacia: &str) -> Result<Vec<u8>, String> {
    if !DESDE.contains(&desde) || !HACIA.contains(&hacia) {
        return Err(format!("Conversión no disponible: {desde} → {hacia}"));
    }
    let exe = pandoc().ok_or("Instala el complemento «Conversor de documentos (Pandoc)» desde el Launcher › Complementos.")?;
    let tmp = Temporal::nueva("coffeepandoc")?;
    fn ext(f: &str) -> &str {
        match f {
            "latex" => "tex",
            "markdown" => "md",
            otro => otro,
        }
    }
    let entrada_ruta = tmp.0.join(format!("entrada.{}", ext(desde)));
    let salida_ruta = tmp.0.join(format!("salida.{}", ext(hacia)));
    fs::write(&entrada_ruta, entrada).map_err(|e| e.to_string())?;
    let sandbox = admite_sandbox(&exe);
    // Word y ODT: en algunos sistemas (Debian) Pandoc no puede leer sus propias plantillas en modo
    // aislado. Se lee el documento aislado a JSON y después se escribe el archivo sin aislar.
    let (lector_desde, lector_hacia, lector_salida) = if sandbox && matches!(hacia, "docx" | "odt")
    {
        ("json_intermedio", "json", tmp.0.join("intermedio.json"))
    } else {
        ("", hacia, salida_ruta.clone())
    };
    let ejecutar = |args: &mut dyn FnMut(&mut Command)| -> Result<(), String> {
        let mut cmd = Command::new(&exe);
        args(&mut cmd);
        cmd.current_dir(&tmp.0).stdin(Stdio::null());
        let out = hidden(&mut cmd)
            .output()
            .map_err(|e| format!("No se pudo ejecutar Pandoc: {e}"))?;
        if out.status.success() {
            Ok(())
        } else {
            let msg = String::from_utf8_lossy(&out.stderr).trim().to_string();
            Err(if msg.is_empty() {
                "Pandoc no pudo convertir el documento.".into()
            } else {
                format!("Pandoc: {msg}")
            })
        }
    };
    ejecutar(&mut |cmd| {
        if sandbox {
            cmd.arg("--sandbox");
        }
        cmd.arg("-f")
            .arg(desde)
            .arg("-t")
            .arg(lector_hacia)
            .arg("-o")
            .arg(&lector_salida);
        match lector_hacia {
            "html" => {
                cmd.args([
                    "--standalone",
                    "--mathml",
                    "--metadata",
                    "pagetitle=Documento",
                ]);
            }
            "latex" => {
                cmd.arg("--standalone");
            }
            _ => {}
        }
        cmd.arg(&entrada_ruta);
    })?;
    if !lector_desde.is_empty() {
        ejecutar(&mut |cmd| {
            cmd.args(["-f", "json", "-t", hacia, "-o"])
                .arg(&salida_ruta)
                .arg(&lector_salida);
        })?;
    }
    if salida_ruta.is_file() {
        fs::read(&salida_ruta).map_err(|e| e.to_string())
    } else {
        Err("Pandoc no pudo convertir el documento.".into())
    }
}

// ---------- Comandos de Tauri ----------

fn b64() -> base64::engine::general_purpose::GeneralPurpose {
    base64::engine::general_purpose::STANDARD
}

/// LaTeX → PDF. Devuelve el PDF en base64; si falla, un JSON `{mensaje, registro}`.
#[tauri::command]
pub async fn doc_latex_pdf(tex: String, archivos: Vec<(String, String)>) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut lista = Vec::with_capacity(archivos.len());
        for (n, d) in archivos {
            let datos = b64().decode(d).map_err(|e| serde_json::json!({ "mensaje": e.to_string(), "registro": "" }).to_string())?;
            lista.push((n, datos));
        }
        compilar_latex(&tex, &lista).map(|pdf| b64().encode(pdf)).map_err(|e| serde_json::to_string(&e).unwrap_or_default())
    })
    .await
    .map_err(|e| serde_json::json!({ "mensaje": format!("La compilación se interrumpió: {e}"), "registro": "" }).to_string())?
}

/// Conversión con Pandoc; entrada y salida en base64.
#[tauri::command]
pub async fn doc_pandoc(datos: String, desde: String, hacia: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let entrada = b64().decode(datos).map_err(|e| e.to_string())?;
        convertir_pandoc(&entrada, &desde, &hacia).map(|s| b64().encode(s))
    })
    .await
    .map_err(|e| format!("La conversión se interrumpió: {e}"))?
}

#[derive(Debug, Serialize)]
pub struct Herramientas {
    /// «tectonic», «xelatex» o nada.
    pub latex: Option<Motor>,
    pub pandoc: bool,
}

#[tauri::command]
pub fn doc_herramientas() -> Herramientas {
    Herramientas {
        latex: motor_latex().map(|(_, m)| m),
        pandoc: pandoc().is_some(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const DOC: &str = "\\documentclass{article}\n\\begin{document}\n\\section{Hola}\nTexto $x^2$.\n\\[F=ma\\]\n\\end{document}\n";

    #[test]
    fn convierte_latex_a_markdown_y_docx() {
        if pandoc().is_none() {
            eprintln!("sin pandoc: se omite");
            return;
        }
        let md = String::from_utf8(convertir_pandoc(DOC.as_bytes(), "latex", "markdown").unwrap())
            .unwrap();
        assert!(md.contains("# Hola"), "{md}");
        assert!(md.contains("x^2"));
        let docx = convertir_pandoc(DOC.as_bytes(), "latex", "docx").unwrap();
        assert_eq!(&docx[..2], b"PK");
        let html =
            String::from_utf8(convertir_pandoc(b"# T\n\n$E=mc^2$\n", "markdown", "html").unwrap())
                .unwrap();
        assert!(html.contains("<math"), "{html}");
        let tex =
            String::from_utf8(convertir_pandoc(b"# T\n\n$E=mc^2$\n", "markdown", "latex").unwrap())
                .unwrap();
        assert!(tex.contains("\\begin{document}"));
    }

    #[test]
    fn pandoc_no_lee_archivos_del_equipo() {
        if pandoc().is_none() {
            eprintln!("sin pandoc: se omite");
            return;
        }
        let tmp = Temporal::nueva("secreto").unwrap();
        let secreto = tmp.0.join("secreto.tex");
        fs::write(&secreto, "SECRETO123").unwrap();
        let ruta = secreto.to_string_lossy().replace('\\', "/");
        let tex = format!("\\documentclass{{article}}\n\\begin{{document}}\nAntes\n\\input{{{ruta}}}\n\\end{{document}}\n");
        let md = convertir_pandoc(tex.as_bytes(), "latex", "markdown")
            .map(|b| String::from_utf8_lossy(&b).to_string())
            .unwrap_or_default();
        assert!(!md.contains("SECRETO123"), "{md}");
        // Word: se lee de vuelta con Pandoc para buscar el texto.
        let docx = convertir_pandoc(tex.as_bytes(), "latex", "docx").unwrap();
        let ruta_docx = tmp.0.join("salida.docx");
        fs::write(&ruta_docx, docx).unwrap();
        let texto = Command::new(pandoc().unwrap())
            .args(["-f", "docx", "-t", "plain"])
            .arg(&ruta_docx)
            .output()
            .unwrap();
        let texto = String::from_utf8_lossy(&texto.stdout);
        assert!(
            texto.contains("Antes") && !texto.contains("SECRETO123"),
            "{texto}"
        );
    }

    #[test]
    fn lee_la_version_de_pandoc() {
        assert_eq!(
            version_pandoc("pandoc 3.1.3\nFeatures: +server"),
            Some((3, 1))
        );
        assert_eq!(version_pandoc("pandoc.exe 2.9.2.1"), Some((2, 9)));
        assert_eq!(version_pandoc(""), None);
    }

    #[test]
    fn rechaza_formatos_desconocidos() {
        assert!(convertir_pandoc(b"x", "html", "docx").is_err());
        assert!(convertir_pandoc(b"x", "latex", "exe").is_err());
    }

    #[test]
    fn rutas_de_archivos_seguras() {
        let base = Path::new("/tmp/x");
        assert!(ruta_segura(base, "Caída libre.png").is_some());
        assert!(ruta_segura(base, "informe-imagenes/a.png").is_some());
        assert!(ruta_segura(base, "../fuera.png").is_none());
        assert!(ruta_segura(base, "/etc/passwd").is_none());
        assert!(ruta_segura(base, "").is_none());
    }

    #[test]
    fn compila_un_documento() {
        if motor_latex().is_none() {
            eprintln!("sin motor LaTeX: se omite");
            return;
        }
        let pdf =
            compilar_latex(DOC, &[]).unwrap_or_else(|e| panic!("{}\n{}", e.mensaje, e.registro));
        assert_eq!(&pdf[..4], b"%PDF");
    }

    #[test]
    fn compila_con_nombre_con_espacios_y_tildes() {
        if motor_latex().is_none() {
            eprintln!("sin motor LaTeX: se omite");
            return;
        }
        // PNG de 1×1 píxel.
        let png = b64().decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==").unwrap();
        let tex = "\\documentclass{article}\n\\usepackage{graphicx}\n\\begin{document}\n\\includegraphics[width=2cm]{\"Caída libre.png\"}\n\\end{document}\n";
        let pdf = compilar_latex(tex, &[("Caída libre.png".into(), png)])
            .unwrap_or_else(|e| panic!("{}\n{}", e.mensaje, e.registro));
        assert_eq!(&pdf[..4], b"%PDF");
    }

    #[test]
    fn error_de_compilacion_trae_registro() {
        if motor_latex().is_none() {
            eprintln!("sin motor LaTeX: se omite");
            return;
        }
        let e = compilar_latex(
            "\\documentclass{article}\n\\begin{document}\n\\undefinedcommand\n\\end{document}\n",
            &[],
        )
        .unwrap_err();
        assert!(e.registro.contains("l."), "{}", e.registro);
        assert!(
            e.mensaje.contains("Undefined control sequence"),
            "{}",
            e.mensaje
        );
    }
}
