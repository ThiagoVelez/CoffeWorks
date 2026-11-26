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

/// Versión de un Pandoc (se pregunta una vez por ejecutable).
fn version_de(exe: &Path) -> Option<(u32, u32)> {
    type Cache = std::sync::Mutex<std::collections::HashMap<PathBuf, Option<(u32, u32)>>>;
    static CACHE: std::sync::OnceLock<Cache> = std::sync::OnceLock::new();
    let cache = CACHE.get_or_init(Default::default);
    if let Some(v) = cache.lock().ok().and_then(|c| c.get(exe).copied()) {
        return v;
    }
    let mut cmd = Command::new(exe);
    cmd.arg("--version").stdin(Stdio::null());
    let v = hidden(&mut cmd)
        .output()
        .ok()
        .and_then(|o| version_pandoc(&String::from_utf8_lossy(&o.stdout)));
    if let Ok(mut c) = cache.lock() {
        c.insert(exe.to_path_buf(), v);
    }
    v
}

/// Comandos de LaTeX que leen otros archivos, con cuántos argumentos {…} llevan.
const INCLUSIONES: &[(&str, usize)] = &[
    ("input", 1),
    ("include", 1),
    ("includeonly", 1),
    ("InputIfFileExists", 3),
    ("subfile", 1),
    ("import", 2),
    ("subimport", 2),
    ("includefrom", 2),
    ("subincludefrom", 2),
    ("lstinputlisting", 1),
    ("verbatiminput", 1),
    ("VerbatimInput", 1),
    ("inputminted", 2),
    ("includepdf", 1),
];

/// Quita del documento los comandos que leen otros archivos del equipo (\input, \include…),
/// para que una conversión nunca meta archivos ajenos al documento. Funciona con cualquier
/// versión de Pandoc; donde existe, `--sandbox` lo refuerza.
fn quitar_inclusiones(texto: &str) -> String {
    let b = texto.as_bytes();
    let mut out = String::with_capacity(texto.len());
    let mut copiado = 0;
    let mut i = 0;
    let saltar_espacios = |mut j: usize| {
        while j < b.len() && (b[j] == b' ' || b[j] == b'\t') {
            j += 1;
        }
        j
    };
    let saltar_grupo = |j: usize, abre: u8, cierra: u8| -> usize {
        let mut nivel = 0usize;
        let mut k = j;
        while k < b.len() {
            if b[k] == b'\\' {
                k += 2;
                continue;
            }
            if b[k] == abre {
                nivel += 1;
            } else if b[k] == cierra {
                nivel = nivel.saturating_sub(1);
                if nivel == 0 {
                    return k + 1;
                }
            }
            k += 1;
        }
        b.len()
    };
    while i < b.len() {
        if b[i] != b'\\' {
            i += 1;
            continue;
        }
        let mut j = i + 1;
        while j < b.len() && b[j].is_ascii_alphabetic() {
            j += 1;
        }
        let nombre = &texto[i + 1..j];
        let Some(&(_, args)) = INCLUSIONES.iter().find(|(n, _)| *n == nombre) else {
            i = if j == i + 1 { i + 2 } else { j };
            continue;
        };
        let mut k = saltar_espacios(j);
        if k < b.len() && b[k] == b'*' {
            k += 1;
        }
        while k < b.len() && b[k] == b'[' {
            k = saltar_espacios(saltar_grupo(k, b'[', b']'));
        }
        if k < b.len() && b[k] == b'{' {
            for _ in 0..args {
                k = saltar_espacios(k);
                if k < b.len() && b[k] == b'{' {
                    k = saltar_grupo(k, b'{', b'}');
                } else {
                    break;
                }
            }
        } else {
            // Forma de TeX: \input archivo
            while k < b.len() && !b[k].is_ascii_whitespace() && b[k] != b'}' {
                k += 1;
            }
        }
        out.push_str(&texto[copiado..i]);
        copiado = k.min(b.len());
        i = copiado;
    }
    out.push_str(&texto[copiado..]);
    out
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
    let limpio = quitar_inclusiones(&String::from_utf8_lossy(entrada));
    fs::write(&entrada_ruta, limpio).map_err(|e| e.to_string())?;
    let version = version_de(&exe);
    // `--sandbox` (Pandoc 2.15 o posterior) impide además leer cualquier otro archivo.
    let sandbox = version.is_some_and(|v| v >= (2, 15));
    // Antes de Pandoc 2.11 los títulos de Markdown salen subrayados («====») si no se pide «#».
    let titulos_atx = hacia == "markdown" && version.is_some_and(|v| v < (2, 11));
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
        if titulos_atx {
            cmd.arg("--atx-headers");
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

/// Archivos del complemento «latexocr» que la app puede pedir.
const ARCHIVOS_OCR: &[&str] = &[
    "encoder.onnx",
    "decoder.onnx",
    "image_resizer.onnx",
    "tokenizer.json",
];

/// Ruta de un archivo del complemento «latexocr» (solo los de la lista).
pub fn archivo_ocr(nombre: &str) -> Result<PathBuf, String> {
    if !ARCHIVOS_OCR.contains(&nombre) {
        return Err(format!("Archivo no permitido: {nombre}"));
    }
    let dir = addon_executable("latexocr")
        .and_then(|p| p.parent().map(Path::to_path_buf))
        .ok_or("Instala el complemento «Fórmulas desde foto» desde el Launcher › Complementos.")?;
    let ruta = dir.join(nombre);
    if ruta.is_file() {
        Ok(ruta)
    } else {
        Err(format!(
            "Falta {nombre} en el complemento «Fórmulas desde foto». Vuelve a instalarlo."
        ))
    }
}

/// Un modelo de «Desde foto», en binario (sin base64: son decenas de MB).
#[tauri::command]
pub async fn doc_ocr_modelo(nombre: String) -> Result<tauri::ipc::Response, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let ruta = archivo_ocr(&nombre)?;
        fs::read(&ruta)
            .map(tauri::ipc::Response::new)
            .map_err(|e| format!("No se pudo leer {nombre}: {e}"))
    })
    .await
    .map_err(|e| format!("La lectura se interrumpió: {e}"))?
}

#[derive(Debug, Serialize)]
pub struct Herramientas {
    /// «tectonic», «xelatex» o nada.
    pub latex: Option<Motor>,
    pub pandoc: bool,
    /// Modelos de «Desde foto» (complemento «latexocr»).
    pub ocr: bool,
    /// Tesseract para el texto de los renglones (complemento «pdfcheck»).
    pub tesseract: bool,
}

#[tauri::command]
pub fn doc_herramientas() -> Herramientas {
    Herramientas {
        latex: motor_latex().map(|(_, m)| m),
        pandoc: pandoc().is_some(),
        ocr: addon_executable("latexocr").is_some(),
        tesseract: addon_executable("pdfcheck").is_some(),
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
    fn quita_los_comandos_que_incluyen_archivos() {
        let t = "A \\input{/etc/x} B \\include{c} C \\lstinputlisting[language=C]{/s.c} D \\import{/a/}{b} E \\inputx{y} F \\input /etc/y\nG";
        let r = quitar_inclusiones(t);
        for prohibido in ["/etc/x", "{c}", "/s.c", "/a/", "/etc/y"] {
            assert!(!r.contains(prohibido), "{r}");
        }
        for queda in ["A ", " B ", " C ", " D ", " E ", "\\inputx{y}", " F ", "G"] {
            assert!(r.contains(queda), "{queda} en {r}");
        }
        assert_eq!(
            quitar_inclusiones("sin nada \\textbf{x}"),
            "sin nada \\textbf{x}"
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
    fn ocr_solo_entrega_sus_archivos() {
        for malo in [
            "../secreto",
            "/etc/passwd",
            "encoder.onnx/../x",
            "otro.onnx",
            "",
        ] {
            assert!(
                archivo_ocr(malo).unwrap_err().contains("no permitido"),
                "{malo}"
            );
        }
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
