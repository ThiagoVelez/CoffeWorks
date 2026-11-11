//! Integración con el sistema operativo: accesos directos del menú Inicio y
//! asociaciones de tipos de archivo.
//!
//! Todo es por usuario (no requiere permisos de administrador) y opcional: un
//! fallo aquí nunca impide instalar o desinstalar una aplicación. Fuera de
//! Windows las funciones no hacen nada.

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
    use std::path::Path;

    pub fn create_shortcut(_name: &str, _target: &Path, _description: &str) {}
    pub fn remove_shortcut(_name: &str) {}
    pub fn register_file_type(
        _app: &str,
        _extension: &str,
        _description: &str,
        _exe: &Path,
        _claim_default: bool,
    ) {
    }
    pub fn unregister_file_type(_app: &str, _extension: &str) {}
    pub fn remove_legacy(_legacy_app: &str, _extension: &str) {}
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
