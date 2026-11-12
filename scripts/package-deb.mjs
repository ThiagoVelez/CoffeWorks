#!/usr/bin/env node
// Crea el paquete .deb de CoffeeWorks para Debian y Ubuntu a partir de
// installer/build (lo que deja `node scripts/build.mjs` en Linux).
//
//   node scripts/package-deb.mjs
//
// Resultado: installer/Output/coffeeworks_<versión>_amd64.deb (+ .sha256)
//
// Estructura instalada:
//   /opt/coffeeworks/CoffeeWorks            Launcher
//   /opt/coffeeworks/packages/<App>         paquetes que instala el Launcher
//   /opt/coffeeworks/icons/<App>.png        iconos de los menús
//   /usr/bin/coffeeworks                    enlace al Launcher
//   /usr/share/applications/coffeeworks.desktop
//   /usr/share/icons/hicolor/<n>x<n>/apps/coffeeworks.png

import { execSync } from "node:child_process";
import { chmodSync, copyFileSync, cpSync, createReadStream, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const build = path.join(root, "installer", "build");
const outDir = path.join(root, "installer", "Output");
const stageDir = path.join(root, "installer", "deb");

if (!existsSync(path.join(build, "CoffeeWorks"))) {
  console.error("Falta installer/build/CoffeeWorks: ejecuta antes node scripts/build.mjs en Linux.");
  process.exit(1);
}

const version = JSON.parse(readFileSync(path.join(root, "src-tauri", "tauri.conf.json"), "utf8")).version;
const stage = (readFileSync(path.join(root, "src-tauri", "src", "updater.rs"), "utf8").match(/pub const STAGE: &str = "([^"]*)"/) || [])[1] || "";
// Debian ordena «2.9.0~alpha» antes que «2.9.0»
const debVersion = stage ? `${version}~${stage}` : version;
const fileName = `coffeeworks_${version}_amd64.deb`;

rmSync(stageDir, { recursive: true, force: true });
const opt = path.join(stageDir, "opt", "coffeeworks");
mkdirSync(path.join(opt, "icons"), { recursive: true });

// Ejecutables y paquetes
copyFileSync(path.join(build, "CoffeeWorks"), path.join(opt, "CoffeeWorks"));
chmodSync(path.join(opt, "CoffeeWorks"), 0o755);
cpSync(path.join(build, "packages"), path.join(opt, "packages"), { recursive: true });
for (const f of readdirSync(path.join(opt, "packages"))) {
  const p = path.join(opt, "packages", f);
  if (statSync(p).isFile()) chmodSync(p, 0o755);
}

// Iconos de cada app (para las entradas del menú)
const apps = readdirSync(root).filter((d) => d.startsWith("Coffee") && existsSync(path.join(root, d, "src-tauri", "icons", "icon.png")));
for (const app of apps) copyFileSync(path.join(root, app, "src-tauri", "icons", "icon.png"), path.join(opt, "icons", `${app}.png`));
const launcherIcon = path.join(root, "src-tauri", "icons", "icon.png");
copyFileSync(launcherIcon, path.join(opt, "icons", "CoffeeWorks.png"));
for (const size of [128, 256, 512]) {
  const dir = path.join(stageDir, "usr", "share", "icons", "hicolor", `${size}x${size}`, "apps");
  mkdirSync(dir, { recursive: true });
  const sized = path.join(root, "src-tauri", "icons", `${size}x${size}.png`);
  copyFileSync(existsSync(sized) ? sized : launcherIcon, path.join(dir, "coffeeworks.png"));
}

// Enlace en el PATH y entrada del menú
mkdirSync(path.join(stageDir, "usr", "bin"), { recursive: true });
symlinkSync("../../opt/coffeeworks/CoffeeWorks", path.join(stageDir, "usr", "bin", "coffeeworks"));
mkdirSync(path.join(stageDir, "usr", "share", "applications"), { recursive: true });
writeFileSync(
  path.join(stageDir, "usr", "share", "applications", "coffeeworks.desktop"),
  `[Desktop Entry]
Type=Application
Name=CoffeeWorks
GenericName=Suite ofimática y creativa
Comment=Launcher de la suite CoffeeWorks: documentos, hojas de cálculo, presentaciones, diseño y video
Exec=/opt/coffeeworks/CoffeeWorks
Icon=coffeeworks
Terminal=false
Categories=Office;Graphics;AudioVideo;
Keywords=office;documentos;hoja;presentación;notas;diseño;video;
StartupWMClass=CoffeeWorks
`
);

// Metadatos del paquete
const installedKb = Math.ceil(Number(execSync(`du -sk "${stageDir}"`).toString().split(/\s+/)[0]));
mkdirSync(path.join(stageDir, "DEBIAN"), { recursive: true });
writeFileSync(
  path.join(stageDir, "DEBIAN", "control"),
  `Package: coffeeworks
Version: ${debVersion}
Section: editors
Priority: optional
Architecture: amd64
Maintainer: CoffeeWorks <coffeeworks@users.noreply.github.com>
Installed-Size: ${installedKb}
Depends: libwebkit2gtk-4.1-0, libgtk-3-0, libsoup-3.0-0, curl, unzip, xdg-utils
Recommends: pkexec | policykit-1
Suggests: ffmpeg, tesseract-ocr, tesseract-ocr-spa, potrace, libraw-bin
Homepage: https://github.com/ThiagoVelez/CoffeWorks
Description: Suite ofimática y creativa de escritorio, libre y sin conexión
 CoffeeWorks reúne un Launcher y veinte aplicaciones: documentos, hojas de
 cálculo, presentaciones, PDF, notas, bases de datos, video, diseño de
 interfaces, UML, edición de imágenes, ilustración vectorial, pintura,
 fotografía, gráficos en movimiento, audio, conversión de video,
 animación 2D y animación de personajes.
 .
 Los complementos opcionales (FFmpeg, OCR, RAW y calco vectorial) se
 instalan desde el Launcher con los paquetes del sistema.
`
);
writeFileSync(
  path.join(stageDir, "DEBIAN", "postinst"),
  `#!/bin/sh
set -e
if command -v update-desktop-database >/dev/null 2>&1; then update-desktop-database -q /usr/share/applications || true; fi
if command -v gtk-update-icon-cache >/dev/null 2>&1; then gtk-update-icon-cache -q -t /usr/share/icons/hicolor || true; fi
exit 0
`
);
chmodSync(path.join(stageDir, "DEBIAN", "postinst"), 0o755);

mkdirSync(outDir, { recursive: true });
const deb = path.join(outDir, fileName);
execSync(`dpkg-deb --root-owner-group -Zxz --build "${stageDir}" "${deb}"`, { stdio: "inherit" });

const hash = createHash("sha256");
await new Promise((resolve) => createReadStream(deb).on("data", (d) => hash.update(d)).on("end", resolve));
writeFileSync(`${deb}.sha256`, `${hash.digest("hex")}  ${fileName}`);
console.log(`\nPaquete: ${path.relative(root, deb)} (${(statSync(deb).size / 1048576).toFixed(1)} MB)`);
