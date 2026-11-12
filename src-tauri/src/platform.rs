//! Integración con el sistema operativo: accesos directos del menú Inicio y
//! asociaciones de tipos de archivo.
//!
//! Todo es por usuario (no requiere permisos de administrador) y opcional: un
//! fallo aquí nunca impide instalar o desinstalar una aplicación. En Linux se
//! usan las entradas .desktop y los tipos MIME de freedesktop.

use std::path::Path;

#[cfg(windows)]
mod imp {
    use std::os::windows::process::CommandExt;
    use std::path::{Path, PathBuf};
    use std::process::Command;

    use winreg::enums::HKEY_CURRENT_USER;
    use winreg::RegKey;

    /// Evita que aparezca una ventana de consola al invocar PowerShell.
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;

    fn start_menu_dir() -> Option<PathBuf> {
        std::env::var_os("APPDATA").map(|appdata| {
            PathBuf::from(appdata)
                .join("Microsoft")
                .join("Windows")
                .join("Start Menu")
                .join("Programs")
                .join(coffee_core::SUITE_DIR)
        })
    }

    fn shortcut_path(name: &str) -> Option<PathBuf> {
        start_menu_dir().map(|dir| dir.join(format!("{name}.lnk")))
    }

    /// Escapa una cadena para usarla entre comillas simples en PowerShell.
    fn ps_quote(value: &str) -> String {
        format!("'{}'", value.replace('\'', "''"))
    }

    pub fn create_shortcut(name: &str, target: &Path, description: &str) {
        let Some(link) = shortcut_path(name) else {
            return;
        };
        if let Some(dir) = link.parent() {
            if std::fs::create_dir_all(dir).is_err() {
                return;
            }
        }
        let working_dir = target.parent().unwrap_or_else(|| Path::new("."));
        let script = format!(
            "$s = (New-Object -ComObject WScript.Shell).CreateShortcut({link}); \
             $s.TargetPath = {target}; $s.WorkingDirectory = {dir}; \
             $s.Description = {description}; $s.IconLocation = {icon}; $s.Save()",
            link = ps_quote(&link.to_string_lossy()),
            target = ps_quote(&target.to_string_lossy()),
            dir = ps_quote(&working_dir.to_string_lossy()),
            description = ps_quote(description),
            icon = ps_quote(&format!("{},0", target.to_string_lossy())),
        );
        let _ = Command::new("powershell.exe")
            .args([
                "-NoProfile",
                "-NonInteractive",
                "-ExecutionPolicy",
                "Bypass",
                "-Command",
                &script,
            ])
            .creation_flags(CREATE_NO_WINDOW)
            .status();
    }

    pub fn remove_shortcut(name: &str) {
        if let Some(link) = shortcut_path(name) {
            let _ = std::fs::remove_file(&link);
            if let Some(dir) = link.parent() {
                // Solo se borra la carpeta si quedó vacía.
                let _ = std::fs::remove_dir(dir);
            }
        }
    }

    fn prog_id(app_name: &str, extension: &str) -> String {
        format!("CoffeeWorks.{app_name}.{extension}")
    }

    fn notify_shell() {
        use windows_sys::Win32::UI::Shell::{SHChangeNotify, SHCNE_ASSOCCHANGED, SHCNF_IDLIST};
        // SAFETY: llamada documentada sin punteros; solo avisa al Explorador
        // de que cambiaron las asociaciones de archivo.
        unsafe {
            SHChangeNotify(
                SHCNE_ASSOCCHANGED as _,
                SHCNF_IDLIST,
                std::ptr::null(),
                std::ptr::null(),
            );
        }
    }

    pub fn register_file_type(
        app_name: &str,
        extension: &str,
        description: &str,
        exe: &Path,
        claim_default: bool,
    ) {
        let classes = match RegKey::predef(HKEY_CURRENT_USER).create_subkey("Software\\Classes") {
            Ok((key, _)) => key,
            Err(_) => return,
        };
        let id = prog_id(app_name, extension);
        let exe_text = exe.to_string_lossy();

        let result: std::io::Result<()> = (|| {
            let (ext_key, _) = classes.create_subkey(format!(".{extension}"))?;
            if claim_default {
                ext_key.set_value("", &id)?;
            }
            // Siempre aparece en "Abrir con" sin quitarle el tipo a otro programa.
            let (open_with, _) = ext_key.create_subkey("OpenWithProgids")?;
            open_with.set_value(&id, &"")?;

            let (prog_key, _) = classes.create_subkey(&id)?;
            prog_key.set_value("", &description)?;

            let (icon_key, _) = prog_key.create_subkey("DefaultIcon")?;
            icon_key.set_value("", &format!("\"{exe_text}\",0"))?;

            let (command_key, _) = prog_key.create_subkey("shell\\open\\command")?;
            command_key.set_value("", &format!("\"{exe_text}\" \"%1\""))?;
            Ok(())
        })();

        if result.is_ok() {
            notify_shell();
        }
    }

    pub fn unregister_file_type(app_name: &str, extension: &str) {
        unregister_prog_id(&prog_id(app_name, extension), extension);
    }

    /// Quita lo que dejó instalado la versión anterior (CoffeWorks) de una
    /// aplicación: su acceso directo y su asociación de archivo.
    pub fn remove_legacy(legacy_app: &str, extension: &str) {
        if let Some(dir) =
            start_menu_dir().and_then(|d| d.parent().map(|p| p.join(coffee_core::LEGACY_SUITE_DIR)))
        {
            let _ = std::fs::remove_file(dir.join(format!("{legacy_app}.lnk")));
            let _ = std::fs::remove_dir(&dir);
        }
        unregister_prog_id(
            &format!("{}.{legacy_app}.{extension}", coffee_core::LEGACY_SUITE_DIR),
            extension,
        );
    }

    fn unregister_prog_id(id: &str, extension: &str) {
        let Ok(classes) = RegKey::predef(HKEY_CURRENT_USER).open_subkey("Software\\Classes") else {
            return;
        };
        let id = id.to_string();
        let ext_name = format!(".{extension}");

        // Solo se retira la extensión si sigue apuntando a esta aplicación.
        let owned = classes
            .open_subkey(&ext_name)
            .and_then(|key| key.get_value::<String, _>(""))
            .map(|value| value == id)
            .unwrap_or(false);
        if owned {
            let _ = classes.delete_subkey_all(&ext_name);
        } else if let Ok(open_with) = classes.open_subkey_with_flags(
            format!("{ext_name}\\OpenWithProgids"),
            winreg::enums::KEY_SET_VALUE,
        ) {
            let _ = open_with.delete_value(&id);
        }
        let _ = classes.delete_subkey_all(&id);
        notify_shell();
    }
}

#[cfg(not(windows))]
mod imp {
    //! Linux (escritorios compatibles con freedesktop: GNOME, KDE, XFCE...):
    //! entradas .desktop en ~/.local/share/applications y tipos MIME propios
    //! en ~/.local/share/mime.

    use std::fs;
    use std::path::{Path, PathBuf};
    use std::process::{Command, Stdio};

    fn data_home() -> Option<PathBuf> {
        std::env::var_os("XDG_DATA_HOME").map(PathBuf::from).or_else(|| std::env::var_os("HOME").map(PathBuf::from).map(|h| h.join(".local").join("share")))
    }

    fn slug(name: &str) -> String {
        name.chars().filter(|c| c.is_ascii_alphanumeric()).collect::<String>().to_lowercase()
    }

    fn desktop_path(name: &str) -> Option<PathBuf> {
        data_home().map(|d| d.join("applications").join(format!("coffeeworks-{}.desktop", slug(name))))
    }

    /// Icono PNG que el paquete deja junto al Launcher (icons/<App>.png).
    fn icon_for(name: &str, target: &Path) -> String {
        let stem = target.file_stem().map(|s| s.to_string_lossy().to_string()).unwrap_or_else(|| name.to_string());
        // Junto al Launcher (/opt/coffeeworks/icons) o cerca del ejecutable
        if let Some(launcher) = std::env::current_exe().ok().and_then(|e| e.parent().map(Path::to_path_buf)) {
            let candidate = launcher.join("icons").join(format!("{stem}.png"));
            if candidate.is_file() {
                return candidate.to_string_lossy().to_string();
            }
        }
        let mut dir = target.parent();
        for _ in 0..3 {
            if let Some(d) = dir {
                let candidate = d.join("icons").join(format!("{stem}.png"));
                if candidate.is_file() {
                    return candidate.to_string_lossy().to_string();
                }
                dir = d.parent();
            }
        }
        "coffeeworks".into()
    }

    fn quote_exec(path: &Path) -> String {
        let p = path.to_string_lossy();
        if p.contains(' ') { format!("\"{p}\"") } else { p.to_string() }
    }

    fn refresh() {
        if let Some(d) = data_home() {
            let _ = Command::new("update-desktop-database").arg(d.join("applications")).stdout(Stdio::null()).stderr(Stdio::null()).status();
            let _ = Command::new("update-mime-database").arg(d.join("mime")).stdout(Stdio::null()).stderr(Stdio::null()).status();
        }
    }

    pub fn create_shortcut(name: &str, target: &Path, description: &str) {
        let Some(path) = desktop_path(name) else { return };
        if let Some(dir) = path.parent() {
            if fs::create_dir_all(dir).is_err() {
                return;
            }
        }
        // Conserva los tipos de archivo ya registrados
        let mime = fs::read_to_string(&path).ok().and_then(|t| t.lines().find(|l| l.starts_with("MimeType=")).map(str::to_string)).unwrap_or_default();
        let text = format!(
            "[Desktop Entry]\nType=Application\nName={name}\nComment={description}\nExec={exec} %f\nIcon={icon}\nTerminal=false\nCategories=Office;Graphics;AudioVideo;\nStartupWMClass={name}\n{mime}\n",
            exec = quote_exec(target),
            icon = icon_for(name, target),
        );
        let _ = fs::write(&path, text.trim_end().to_string() + "\n");
        refresh();
    }

    pub fn remove_shortcut(name: &str) {
        if let Some(path) = desktop_path(name) {
            let _ = fs::remove_file(path);
            refresh();
        }
    }

    /// Tipos MIME estándar de las extensiones que también abren las apps.
    fn standard_mime(ext: &str) -> Option<&'static str> {
        Some(match ext {
            "docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "doc" => "application/msword",
            "xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "xls" => "application/vnd.ms-excel",
            "pptx" => "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            "pdf" => "application/pdf",
            "md" => "text/markdown",
            "txt" => "text/plain",
            "csv" => "text/csv",
            "html" | "htm" => "text/html",
            "svg" => "image/svg+xml",
            "png" => "image/png",
            "jpg" | "jpeg" => "image/jpeg",
            "webp" => "image/webp",
            "mp4" => "video/mp4",
            "webm" => "video/webm",
            "mov" => "video/quicktime",
            "mkv" => "video/x-matroska",
            "wav" => "audio/x-wav",
            "mp3" => "audio/mpeg",
            "ogg" => "audio/ogg",
            "flac" => "audio/flac",
            "m4a" => "audio/mp4",
            "db" | "sqlite" => "application/vnd.sqlite3",
            _ => return None,
        })
    }

    fn custom_mime(ext: &str) -> String {
        format!("application/x-coffeeworks-{ext}")
    }

    fn set_mime_list(app: &str, mime: &str, add: bool) {
        let Some(path) = desktop_path(app) else { return };
        let Ok(text) = fs::read_to_string(&path) else { return };
        let mut list: Vec<String> = text.lines().find(|l| l.starts_with("MimeType=")).map(|l| l["MimeType=".len()..].split(';').filter(|s| !s.is_empty()).map(str::to_string).collect()).unwrap_or_default();
        list.retain(|m| m != mime);
        if add {
            list.push(mime.to_string());
        }
        let mut lines: Vec<String> = text.lines().filter(|l| !l.starts_with("MimeType=")).map(str::to_string).collect();
        if !list.is_empty() {
            lines.push(format!("MimeType={};", list.join(";")));
        }
        let _ = fs::write(&path, lines.join("\n") + "\n");
    }

    pub fn register_file_type(app: &str, extension: &str, description: &str, _exe: &Path, claim_default: bool) {
        let Some(data) = data_home() else { return };
        let mime = match standard_mime(extension) {
            Some(m) => m.to_string(),
            None => {
                // Tipo propio de la suite (.cfd, .cbk, .cmo...)
                let m = custom_mime(extension);
                let dir = data.join("mime").join("packages");
                if fs::create_dir_all(&dir).is_ok() {
                    let xml = format!(
                        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<mime-info xmlns=\"http://www.freedesktop.org/standards/shared-mime-info\">\n  <mime-type type=\"{m}\">\n    <comment>{}</comment>\n    <glob pattern=\"*.{extension}\"/>\n  </mime-type>\n</mime-info>\n",
                        description.replace('&', "&amp;").replace('<', "&lt;")
                    );
                    let _ = fs::write(dir.join(format!("coffeeworks-{extension}.xml")), xml);
                }
                m
            }
        };
        set_mime_list(app, &mime, true);
        refresh();
        if claim_default {
            if let Some(path) = desktop_path(app) {
                if let Some(file) = path.file_name() {
                    let _ = Command::new("xdg-mime").args(["default", &file.to_string_lossy(), &mime]).stdout(Stdio::null()).stderr(Stdio::null()).status();
                }
            }
        }
    }

    pub fn unregister_file_type(app: &str, extension: &str) {
        let mime = standard_mime(extension).map(str::to_string).unwrap_or_else(|| custom_mime(extension));
        set_mime_list(app, &mime, false);
        if standard_mime(extension).is_none() {
            if let Some(data) = data_home() {
                let _ = fs::remove_file(data.join("mime").join("packages").join(format!("coffeeworks-{extension}.xml")));
            }
        }
        refresh();
    }

    pub fn remove_legacy(legacy_app: &str, _extension: &str) {
        remove_shortcut(legacy_app);
    }
}

pub fn create_shortcut(name: &str, target: &Path, description: &str) {
    imp::create_shortcut(name, target, description);
}

pub fn remove_shortcut(name: &str) {
    imp::remove_shortcut(name);
}

/// Registra el tipo de archivo. Con `claim_default` la aplicación pasa a ser
/// la predeterminada; sin él solo se ofrece en "Abrir con".
pub fn register_file_type(
    app_name: &str,
    extension: &str,
    description: &str,
    exe: &Path,
    claim_default: bool,
) {
    imp::register_file_type(app_name, extension, description, exe, claim_default);
}

pub fn unregister_file_type(app_name: &str, extension: &str) {
    imp::unregister_file_type(app_name, extension);
}

pub fn remove_legacy(legacy_app: &str, extension: &str) {
    imp::remove_legacy(legacy_app, extension);
}
