; Instalador de CoffeeWorks para Windows (Inno Setup 6).
;
; Instala el Launcher (CoffeeWorks.exe) y deja los paquetes de CoffeeDoc,
; CoffeeCalc, CoffeeView, CoffeePDF, CoffeePage, CoffeeBooks, CoffeeDataBase, CoffeeEdit,
; CoffeeLive, CoffeeUI/UX, CoffeeUML, CoffeePhoto, CoffeeVector, CoffeePaint, CoffeeLens, CoffeeMotion, CoffeeSound, CoffeeEncoder, CoffeeAnimate, CoffeePuppet y CoffeeAnimate3D en la carpeta "packages". Las aplicaciones se instalan
; y desinstalan después desde la Tienda de Apps del propio Launcher.
;
; Antes de compilar este script hay que generar los ejecutables con
;   node scripts/build.mjs
; que los deja en installer\build. Para hacerlo todo de una vez:
;   powershell -ExecutionPolicy Bypass -File scripts\build-windows.ps1

#define AppName "CoffeeWorks"
#define AppVersion "2.11.0"
#define AppPublisher "CoffeeWorks OpenSource Team"
#define AppExeName "CoffeeWorks.exe"

; Carpeta con los ejecutables ya compilados (se puede cambiar con /DSourceDir=...)
#ifndef SourceDir
  #define SourceDir "build"
#endif

[Setup]
AppId={{26A1060F-CE35-4CE2-986C-410EC441ED8C}
AppName={#AppName}
AppVersion={#AppVersion}
AppVerName={#AppName} {#AppVersion}
AppPublisher={#AppPublisher}
VersionInfoVersion={#AppVersion}
DefaultDirName={autopf}\{#AppName}
DefaultGroupName={#AppName}
; Las versiones anteriores se instalaban en «CoffeWorks»: se instala en la carpeta nueva
UsePreviousAppDir=no
DisableProgramGroupPage=yes
; Instalación por usuario: no necesita permisos de administrador
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog
OutputDir=Output
OutputBaseFilename=CoffeeWorks-Setup-{#AppVersion}
SetupIconFile=..\CoffeeWorks_Icon\CoffeeWorks.ico
UninstallDisplayIcon={app}\{#AppExeName}
UninstallDisplayName={#AppName}
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
CloseApplications=yes
MinVersion=10.0

[Languages]
Name: "spanish"; MessagesFile: "compiler:Languages\Spanish.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[CustomMessages]
spanish.InstallApps=Instalar ahora todas las aplicaciones (Office, Multimedia y Desarrollador)
english.InstallApps=Install all apps now (Office, Multimedia and Developer)
spanish.SuiteApps=Aplicaciones de la suite:
english.SuiteApps=Suite applications:
spanish.InstallingApps=Instalando las aplicaciones de la suite...
english.InstallingApps=Installing the suite applications...
spanish.InstallingWebView=Instalando Microsoft Edge WebView2 (necesario para mostrar la interfaz)...
english.InstallingWebView=Installing Microsoft Edge WebView2 (required to display the interface)...
spanish.WebViewMissing=CoffeeWorks necesita Microsoft Edge WebView2 y no se pudo instalar automáticamente.%n%nDescárgalo desde https://developer.microsoft.com/microsoft-edge/webview2/ (Evergreen Bootstrapper) e instálalo antes de abrir CoffeeWorks.
english.WebViewMissing=CoffeeWorks requires Microsoft Edge WebView2 and it could not be installed automatically.%n%nDownload it from https://developer.microsoft.com/microsoft-edge/webview2/ (Evergreen Bootstrapper) and install it before opening CoffeeWorks.

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"
Name: "installapps"; Description: "{cm:InstallApps}"; GroupDescription: "{cm:SuiteApps}"; Flags: unchecked

[Files]
Source: "{#SourceDir}\{#AppExeName}"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#SourceDir}\packages\*"; DestDir: "{app}\packages"; Flags: ignoreversion recursesubdirs createallsubdirs
; Solo existe en compilaciones hechas con MinGW (las de MSVC lo llevan integrado)
Source: "{#SourceDir}\WebView2Loader.dll"; DestDir: "{app}"; Flags: ignoreversion skipifsourcedoesntexist
; Instalador del motor WebView2 para los equipos que aún no lo tienen
Source: "{#SourceDir}\MicrosoftEdgeWebview2Setup.exe"; DestDir: "{tmp}"; Flags: deleteafterinstall skipifsourcedoesntexist

[InstallDelete]
; Restos de la versión anterior, cuando la suite se llamaba «CoffeWorks». Las
; aplicaciones, los documentos y los recientes los migra el Launcher al abrirse.
Type: filesandordirs; Name: "{autopf}\CoffeWorks"
Type: files; Name: "{autoprograms}\CoffeWorks\CoffeWorks.lnk"
Type: dirifempty; Name: "{autoprograms}\CoffeWorks"
Type: files; Name: "{autodesktop}\CoffeWorks.lnk"

[Icons]
Name: "{autoprograms}\{#AppName}\{#AppName}"; Filename: "{app}\{#AppExeName}"
Name: "{autodesktop}\{#AppName}"; Filename: "{app}\{#AppExeName}"; Tasks: desktopicon

[Run]
Filename: "{tmp}\MicrosoftEdgeWebview2Setup.exe"; Parameters: "/silent /install"; StatusMsg: "{cm:InstallingWebView}"; Check: NeedsWebView2; Flags: waituntilterminated skipifdoesntexist
Filename: "{app}\{#AppExeName}"; Parameters: "--install-all"; StatusMsg: "{cm:InstallingApps}"; Tasks: installapps; Check: not IsAutoUpdate; Flags: waituntilterminated runasoriginaluser
Filename: "{app}\{#AppExeName}"; Description: "{cm:LaunchProgram,{#AppName}}"; Flags: nowait postinstall skipifsilent runasoriginaluser
; Actualización automática desde el Launcher («Reiniciar y actualizar»): se vuelve a abrir solo
Filename: "{app}\{#AppExeName}"; Check: RelaunchAfterUpdate; Flags: nowait runasoriginaluser

[UninstallRun]
; Quita las aplicaciones instaladas desde el Launcher, sus accesos directos y
; sus asociaciones de archivo. Los documentos del usuario no se tocan.
Filename: "{app}\{#AppExeName}"; Parameters: "--uninstall-all"; Flags: waituntilterminated; RunOnceId: "RemoveSuiteApps"

[UninstallDelete]
Type: filesandordirs; Name: "{localappdata}\CoffeeWorks\Apps"
Type: dirifempty; Name: "{localappdata}\CoffeeWorks"

[Code]
{ El Launcher ejecuta el instalador con /AUTOUPDATE=0 o /AUTOUPDATE=1 al actualizarse. }
function IsAutoUpdate: Boolean;
begin
  Result := ExpandConstant('{param:AUTOUPDATE|}') <> '';
end;

function RelaunchAfterUpdate: Boolean;
begin
  Result := ExpandConstant('{param:AUTOUPDATE|0}') = '1';
end;

const
  WebView2ClientKey = '{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}';

function HasWebView2Version(RootKey: Integer; const SubKey: String): Boolean;
var
  Version: String;
begin
  Result := RegQueryStringValue(RootKey, SubKey, 'pv', Version) and (Version <> '') and (Version <> '0.0.0.0');
end;

{ Indica si falta el motor WebView2 (Windows 11 y los Windows 10 actualizados ya lo incluyen). }
function NeedsWebView2: Boolean;
begin
  Result := not (
    HasWebView2Version(HKLM, 'SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\' + WebView2ClientKey) or
    HasWebView2Version(HKLM, 'SOFTWARE\Microsoft\EdgeUpdate\Clients\' + WebView2ClientKey) or
    HasWebView2Version(HKCU, 'Software\Microsoft\EdgeUpdate\Clients\' + WebView2ClientKey));
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  { Si tras la instalación sigue faltando WebView2, se avisa de cómo obtenerlo. }
  if (CurStep = ssDone) and NeedsWebView2 and not WizardSilent then
    MsgBox(CustomMessage('WebViewMissing'), mbInformation, MB_OK);
end;
