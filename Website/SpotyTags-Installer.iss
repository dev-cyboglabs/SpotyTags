; Inno Setup Script for SpotyTags
; Requires Inno Setup 6.x (install from jrsoftware.org/isdl.php)
; Build steps:
;   1. npm run build (frontend)
;   2. pyinstaller launcher.spec --clean
;   3. Compile this script in Inno Setup Compiler

#define MyAppName "SpotyTags"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "SpotyTags"
#define MyAppURL "http://localhost:3001"
#define MyAppExeName "SpotyTags-Server.exe"

[Setup]
AppId={{SPOTYTAGS-001-LOCAL-SERVER-ONLY}}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\SpotyTags
DisableProgramGroupPage=yes
LicenseFile=backend\LICENSE.txt
OutputDir=installer-output
OutputBaseFilename=SpotyTags-Setup
Compression=lzma
SolidCompression=yes
WizardStyle=modern
SetupIconFile=NONE
PrivilegesRequiredOverridesAllowed=dialog

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked
Name: "startup"; Description: "Start SpotyTags automatically on Windows login"; GroupDescription: "Startup"; Flags: unchecked

[Files]
; Main executable built by PyInstaller
Source: "dist\SpotyTags-Server.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "dist\_internal\*"; DestDir: "{app}\_internal"; Flags: ignoreversion recursesubdirs

[Icons]
Name: "{autoprograms}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon
Name: "{userstartup}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: startup

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent
