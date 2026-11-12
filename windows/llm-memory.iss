; llm-memory setup wizard (Inno Setup 6). Per-user install, no elevation.
; Build: ISCC.exe /DMyAppVersion=0.1.0 llm-memory.iss   (output in ..\dist)

#ifndef MyAppVersion
  #define MyAppVersion "0.0.0"
#endif
#define MyAppName "llm-memory"
#define MyAppPublisher "Guilherme Ditzel Patriota"
#define MyAppURL "https://github.com/guipatriota/llm-memory"

[Setup]
AppId={{7E1D3C2A-5B8F-4C6E-9A1B-2F3D4E5A6B7C}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppVerName={#MyAppName} {#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
DefaultDirName={localappdata}\Programs\{#MyAppName}
DisableProgramGroupPage=yes
DisableDirPage=no
PrivilegesRequired=lowest
OutputDir=..\dist
OutputBaseFilename={#MyAppName}-setup-{#MyAppVersion}
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
ChangesEnvironment=yes
ShowLanguageDialog=yes
UninstallDisplayName={#MyAppName}
SetupLogging=yes
LicenseFile=..\LICENSE

[Languages]
Name: "en"; MessagesFile: "compiler:Default.isl"
Name: "fr"; MessagesFile: "compiler:Languages\French.isl"

[CustomMessages]
en.PrereqCaption=Prerequisites
en.PrereqDescription=llm-memory needs Git, Node.js, the GitHub CLI and Claude Code.
en.PrereqIntro=Status of the required tools on this computer:
en.PrereqInstall=Install the missing tools (winget)
en.PrereqCheck=Check again
en.PrereqMissing=Some prerequisites are still missing. Install them, then click "Check again".
en.PrereqAllOk=All prerequisites are installed.
en.PrereqClaudeHint=After installing Claude Code, open a terminal and run "claude" once to sign in before continuing.
en.GitHubCaption=GitHub account
en.GitHubDescription=Your memory will live in private repositories of your GitHub account.
en.GitHubIntro=Click the button below. A console opens, shows a one-time code and opens your browser. Sign in to GitHub and confirm the code; then come back here.
en.GitHubButton=Sign in with GitHub (browser)
en.GitHubNotSigned=Not signed in yet.
en.GitHubSigned=Signed in as %1
en.GitHubRequired=You must sign in to GitHub to continue.
en.LangCaption=Language of the memory
en.LangDescription=In which language should the memory pages be written?
en.LangIntro=The agents will write summaries and reports in this language. You can change it later in memory.config.json.
en.LangEnglish=English
en.LangFrench=French
en.OptCaption=Memory vault
en.OptDescription=Where the memory lives on this computer and on GitHub.
en.OptIntro=Keep the defaults unless you know why to change them. If the repository already exists in your account (second computer), it is cloned instead of created.
en.OptVault=Folder of the memory vault:
en.OptRepo=Name of the private GitHub repository:
en.OptIngest=Daily ingest times (HH:MM, comma separated):
en.OptLint=Weekly lint (Day@HH:MM, e.g. Thu@11:00):
en.SrcCaption=Transcript backup
en.SrcDescription=Back up the raw session transcripts to a second private repository?
en.SrcIntro=Raw transcripts may contain secrets in plain text (tokens, passwords, file contents). The repository is private, but it leaves this computer. Without the backup, transcripts stay only on this computer.
en.SrcCheck=Back up raw transcripts to a private GitHub repository (name: <repository>-sources)
en.RunInit=Setting up the memory vault (a console window shows the progress)...
en.FinishText=The memory vault is set up. Open a NEW terminal to use the "llm-memory" command (status, ingest, lint).%n%nIf the setup console reported an error, run "llm-memory init" again in a new terminal.
fr.PrereqCaption=Prérequis
fr.PrereqDescription=llm-memory a besoin de Git, Node.js, GitHub CLI et Claude Code.
fr.PrereqIntro=État des outils requis sur cet ordinateur :
fr.PrereqInstall=Installer les outils manquants (winget)
fr.PrereqCheck=Vérifier de nouveau
fr.PrereqMissing=Des prérequis manquent encore. Installez-les, puis cliquez sur « Vérifier de nouveau ».
fr.PrereqAllOk=Tous les prérequis sont installés.
fr.PrereqClaudeHint=Après l'installation de Claude Code, ouvrez un terminal et lancez « claude » une fois pour vous connecter avant de continuer.
fr.GitHubCaption=Compte GitHub
fr.GitHubDescription=Votre mémoire vivra dans des dépôts privés de votre compte GitHub.
fr.GitHubIntro=Cliquez sur le bouton ci-dessous. Une console s'ouvre, affiche un code à usage unique et ouvre votre navigateur. Connectez-vous à GitHub et confirmez le code ; puis revenez ici.
fr.GitHubButton=Se connecter avec GitHub (navigateur)
fr.GitHubNotSigned=Pas encore connecté.
fr.GitHubSigned=Connecté en tant que %1
fr.GitHubRequired=Vous devez vous connecter à GitHub pour continuer.
fr.LangCaption=Langue de la mémoire
fr.LangDescription=Dans quelle langue les pages de mémoire doivent-elles être écrites ?
fr.LangIntro=Les agents écriront les résumés et les rapports dans cette langue. Vous pourrez la changer plus tard dans memory.config.json.
fr.LangEnglish=Anglais
fr.LangFrench=Français
fr.OptCaption=Coffre de mémoire
fr.OptDescription=Où la mémoire vit sur cet ordinateur et sur GitHub.
fr.OptIntro=Gardez les valeurs par défaut sauf raison précise. Si le dépôt existe déjà dans votre compte (second ordinateur), il est cloné au lieu d'être créé.
fr.OptVault=Dossier du coffre de mémoire :
fr.OptRepo=Nom du dépôt GitHub privé :
fr.OptIngest=Heures d'ingest quotidien (HH:MM, séparées par des virgules) :
fr.OptLint=Lint hebdomadaire (Jour@HH:MM, ex. Thu@11:00) :
fr.SrcCaption=Sauvegarde des transcriptions
fr.SrcDescription=Sauvegarder les transcriptions brutes des sessions dans un second dépôt privé ?
fr.SrcIntro=Les transcriptions brutes peuvent contenir des secrets en clair (jetons, mots de passe, contenus de fichiers). Le dépôt est privé, mais elles quittent cet ordinateur. Sans la sauvegarde, elles restent uniquement sur cet ordinateur.
fr.SrcCheck=Sauvegarder les transcriptions brutes dans un dépôt GitHub privé (nom : <dépôt>-sources)
fr.RunInit=Configuration du coffre de mémoire (une console affiche la progression)...
fr.FinishText=Le coffre de mémoire est configuré. Ouvrez un NOUVEAU terminal pour utiliser la commande « llm-memory » (status, ingest, lint).%n%nSi la console de configuration a signalé une erreur, relancez « llm-memory init » dans un nouveau terminal.

[Files]
Source: "..\app\*"; DestDir: "{app}\app"; Flags: recursesubdirs ignoreversion
Source: "llm-memory.cmd"; DestDir: "{app}"; Flags: ignoreversion
Source: "prereqs.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\README.md"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\README.fr.md"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\LICENSE"; DestDir: "{app}"; Flags: ignoreversion

[Registry]
Root: HKCU; Subkey: "Environment"; ValueType: expandsz; ValueName: "Path"; ValueData: "{olddata};{app}"; Check: NeedsAddPath(ExpandConstant('{app}'))

[Run]
Filename: "{cmd}"; Parameters: "{code:InitCommandLine}"; StatusMsg: "{cm:RunInit}"; Flags: waituntilterminated

[UninstallRun]
Filename: "{cmd}"; Parameters: "/c ""{app}\llm-memory.cmd"" uninstall"; Flags: runhidden; RunOnceId: "llm-memory-uninstall"

[Code]
var
  PrereqPage: TWizardPage;
  PrereqMemo: TNewMemo;
  PrereqHint: TNewStaticText;
  GitHubPage: TWizardPage;
  GitHubStatus: TNewStaticText;
  GitHubUser: String;
  LangPage: TInputOptionWizardPage;
  OptPage: TInputQueryWizardPage;
  SrcPage: TInputOptionWizardPage;

{ ---------------------------------------------------------------- PATH helpers }

function RegistryPath(): String;
var
  M, U: String;
begin
  RegQueryStringValue(HKLM, 'SYSTEM\CurrentControlSet\Control\Session Manager\Environment', 'Path', M);
  RegQueryStringValue(HKCU, 'Environment', 'Path', U);
  Result := ExpandConstant(M) + ';' + ExpandConstant(U);
end;

function SearchDirs(): String;
begin
  Result := GetEnv('PATH') + ';' + RegistryPath()
    + ';' + ExpandConstant('{%USERPROFILE}\.local\bin')
    + ';' + ExpandConstant('{pf}\nodejs')
    + ';' + ExpandConstant('{localappdata}\Programs\nodejs')
    + ';' + ExpandConstant('{pf}\GitHub CLI')
    + ';' + ExpandConstant('{pf}\Git\cmd');
end;

function FindTool(Exe: String): String;
begin
  Result := FileSearch(Exe, SearchDirs());
end;

function NeedsAddPath(Dir: String): Boolean;
var
  P: String;
begin
  if not RegQueryStringValue(HKCU, 'Environment', 'Path', P) then
  begin
    Result := True;
    exit;
  end;
  Result := Pos(';' + Uppercase(Dir) + ';', ';' + Uppercase(P) + ';') = 0;
end;

{ Runs a console tool, waits, returns the exit code. }
function RunTool(Exe, Params: String; Show: Integer): Integer;
var
  Code: Integer;
begin
  if not Exec(Exe, Params, '', Show, ewWaitUntilTerminated, Code) then Code := -1;
  Result := Code;
end;

{ Runs "cmd /c <command line>" with the registry PATH prepended, so tools installed
  a minute ago are found. }
function RunWithFreshPath(CommandLine: String; Show: Integer): Integer;
begin
  Result := RunTool(ExpandConstant('{cmd}'),
    '/d /s /c "set "PATH=' + RegistryPath() + ';%PATH%" && ' + CommandLine + '"', Show);
end;

{ ---------------------------------------------------------------- prerequisites }

procedure RefreshPrereqs();
var
  Missing: String;
  procedure Line(Name, Exe: String);
  var
    Found: String;
  begin
    Found := FindTool(Exe);
    if Found <> '' then
      PrereqMemo.Lines.Add('[ok]      ' + Name + '   ' + Found)
    else
    begin
      PrereqMemo.Lines.Add('[MISSING] ' + Name);
      Missing := Missing + Name + ' ';
    end;
  end;
begin
  PrereqMemo.Lines.Clear();
  Missing := '';
  Line('Git', 'git.exe');
  Line('Node.js', 'node.exe');
  Line('GitHub CLI', 'gh.exe');
  Line('Claude Code', 'claude.exe');
  if Missing = '' then
    PrereqHint.Caption := CustomMessage('PrereqAllOk')
  else
    PrereqHint.Caption := CustomMessage('PrereqMissing');
end;

function PrereqsOk(): Boolean;
begin
  Result := (FindTool('git.exe') <> '') and (FindTool('node.exe') <> '')
    and (FindTool('gh.exe') <> '') and (FindTool('claude.exe') <> '');
end;

procedure PrereqInstallClick(Sender: TObject);
begin
  ExtractTemporaryFile('prereqs.ps1');
  RunTool('powershell.exe', '-NoProfile -ExecutionPolicy Bypass -File "' + ExpandConstant('{tmp}\prereqs.ps1') + '"', SW_SHOW);
  RefreshPrereqs();
end;

procedure PrereqCheckClick(Sender: TObject);
begin
  RefreshPrereqs();
end;

{ ---------------------------------------------------------------- GitHub }

function GhExe(): String;
begin
  Result := FindTool('gh.exe');
  if Result = '' then Result := 'gh';
end;

procedure RefreshGitHub();
var
  Tmp: String;
  Lines: TArrayOfString;
begin
  GitHubUser := '';
  Tmp := ExpandConstant('{tmp}\gh-user.txt');
  DeleteFile(Tmp);
  RunWithFreshPath('"' + GhExe() + '" api user -q .login > "' + Tmp + '"', SW_HIDE);
  if LoadStringsFromFile(Tmp, Lines) and (GetArrayLength(Lines) > 0) then
    GitHubUser := Trim(Lines[0]);
  if GitHubUser <> '' then
    GitHubStatus.Caption := FmtMessage(CustomMessage('GitHubSigned'), [GitHubUser])
  else
    GitHubStatus.Caption := CustomMessage('GitHubNotSigned');
end;

procedure GitHubLoginClick(Sender: TObject);
begin
  RunWithFreshPath('"' + GhExe() + '" auth login --web --git-protocol https --hostname github.com', SW_SHOW);
  RefreshGitHub();
end;

{ ---------------------------------------------------------------- wizard }

procedure InitializeWizard();
var
  B: TNewButton;
  L: TNewStaticText;
begin
  { Prerequisites }
  PrereqPage := CreateCustomPage(wpLicense, CustomMessage('PrereqCaption'), CustomMessage('PrereqDescription'));
  L := TNewStaticText.Create(PrereqPage);
  L.Parent := PrereqPage.Surface;
  L.Caption := CustomMessage('PrereqIntro');
  L.Top := 0;
  PrereqMemo := TNewMemo.Create(PrereqPage);
  PrereqMemo.Parent := PrereqPage.Surface;
  PrereqMemo.Top := L.Top + L.Height + ScaleY(6);
  PrereqMemo.Width := PrereqPage.SurfaceWidth;
  PrereqMemo.Height := ScaleY(90);
  PrereqMemo.ReadOnly := True;
  PrereqMemo.ScrollBars := ssHorizontal;
  B := TNewButton.Create(PrereqPage);
  B.Parent := PrereqPage.Surface;
  B.Caption := CustomMessage('PrereqInstall');
  B.Top := PrereqMemo.Top + PrereqMemo.Height + ScaleY(8);
  B.Width := ScaleX(220);
  B.OnClick := @PrereqInstallClick;
  B := TNewButton.Create(PrereqPage);
  B.Parent := PrereqPage.Surface;
  B.Caption := CustomMessage('PrereqCheck');
  B.Top := PrereqMemo.Top + PrereqMemo.Height + ScaleY(8);
  B.Left := ScaleX(230);
  B.Width := ScaleX(140);
  B.OnClick := @PrereqCheckClick;
  PrereqHint := TNewStaticText.Create(PrereqPage);
  PrereqHint.Parent := PrereqPage.Surface;
  PrereqHint.Top := B.Top + B.Height + ScaleY(10);
  PrereqHint.Width := PrereqPage.SurfaceWidth;
  PrereqHint.WordWrap := True;
  L := TNewStaticText.Create(PrereqPage);
  L.Parent := PrereqPage.Surface;
  L.Caption := CustomMessage('PrereqClaudeHint');
  L.Top := PrereqHint.Top + ScaleY(36);
  L.Width := PrereqPage.SurfaceWidth;
  L.WordWrap := True;

  { GitHub }
  GitHubPage := CreateCustomPage(PrereqPage.ID, CustomMessage('GitHubCaption'), CustomMessage('GitHubDescription'));
  L := TNewStaticText.Create(GitHubPage);
  L.Parent := GitHubPage.Surface;
  L.Caption := CustomMessage('GitHubIntro');
  L.Top := 0;
  L.Width := GitHubPage.SurfaceWidth;
  L.WordWrap := True;
  B := TNewButton.Create(GitHubPage);
  B.Parent := GitHubPage.Surface;
  B.Caption := CustomMessage('GitHubButton');
  B.Top := L.Top + L.Height + ScaleY(14);
  B.Width := ScaleX(260);
  B.OnClick := @GitHubLoginClick;
  GitHubStatus := TNewStaticText.Create(GitHubPage);
  GitHubStatus.Parent := GitHubPage.Surface;
  GitHubStatus.Top := B.Top + B.Height + ScaleY(12);
  GitHubStatus.Width := GitHubPage.SurfaceWidth;

  { Language of the memory }
  LangPage := CreateInputOptionPage(GitHubPage.ID, CustomMessage('LangCaption'), CustomMessage('LangDescription'), CustomMessage('LangIntro'), True, False);
  LangPage.Add(CustomMessage('LangEnglish'));
  LangPage.Add(CustomMessage('LangFrench'));
  if ActiveLanguage() = 'fr' then LangPage.SelectedValueIndex := 1 else LangPage.SelectedValueIndex := 0;

  { Vault options }
  OptPage := CreateInputQueryPage(LangPage.ID, CustomMessage('OptCaption'), CustomMessage('OptDescription'), CustomMessage('OptIntro'));
  OptPage.Add(CustomMessage('OptVault'), False);
  OptPage.Add(CustomMessage('OptRepo'), False);
  OptPage.Add(CustomMessage('OptIngest'), False);
  OptPage.Add(CustomMessage('OptLint'), False);
  OptPage.Values[0] := ExpandConstant('{%USERPROFILE}\llm-memory');
  OptPage.Values[1] := 'llm-memory';
  OptPage.Values[2] := '10:20,14:20';
  OptPage.Values[3] := 'Thu@11:00';

  { Sources backup }
  SrcPage := CreateInputOptionPage(OptPage.ID, CustomMessage('SrcCaption'), CustomMessage('SrcDescription'), CustomMessage('SrcIntro'), False, False);
  SrcPage.Add(CustomMessage('SrcCheck'));
  SrcPage.Values[0] := True;
end;

procedure CurPageChanged(CurPageID: Integer);
begin
  if CurPageID = PrereqPage.ID then RefreshPrereqs();
  if CurPageID = GitHubPage.ID then RefreshGitHub();
  if CurPageID = wpFinished then
    WizardForm.FinishedLabel.Caption := CustomMessage('FinishText');
end;

function NextButtonClick(CurPageID: Integer): Boolean;
begin
  Result := True;
  if CurPageID = PrereqPage.ID then
  begin
    if not PrereqsOk() then
    begin
      MsgBox(CustomMessage('PrereqMissing'), mbError, MB_OK);
      Result := False;
    end;
  end;
  if CurPageID = GitHubPage.ID then
  begin
    if GitHubUser = '' then RefreshGitHub();
    if GitHubUser = '' then
    begin
      MsgBox(CustomMessage('GitHubRequired'), mbError, MB_OK);
      Result := False;
    end;
  end;
  if CurPageID = OptPage.ID then
  begin
    if (Trim(OptPage.Values[0]) = '') or (Trim(OptPage.Values[1]) = '') then Result := False;
  end;
end;

{ ---------------------------------------------------------------- init command }

function MemoryLanguage(): String;
begin
  if LangPage.SelectedValueIndex = 1 then Result := 'fr' else Result := 'en';
end;

function SourcesFlag(): String;
begin
  if SrcPage.Values[0] then Result := 'on' else Result := 'off';
end;

function InitCommandLine(Param: String): String;
var
  LogFile: String;
begin
  LogFile := ExpandConstant('{userappdata}\llm-memory\init.log');
  ForceDirectories(ExtractFileDir(LogFile));
  Result := '/d /s /c "set "PATH=' + RegistryPath() + ';%PATH%" && "' + ExpandConstant('{app}\llm-memory.cmd') + '" init'
    + ' --language ' + MemoryLanguage()
    + ' --vault "' + Trim(OptPage.Values[0]) + '"'
    + ' --repo "' + Trim(OptPage.Values[1]) + '"'
    + ' --sources ' + SourcesFlag()
    + ' --ingest "' + Trim(OptPage.Values[2]) + '"'
    + ' --lint "' + Trim(OptPage.Values[3]) + '"'
    + ' --lang ' + ActiveLanguage()
    + ' --yes'
    + ' --log "' + LogFile + '"'
    + ' & pause"';
end;

{ Remove {app} from the user PATH on uninstall. }
procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  P, App: String;
  I: Integer;
begin
  if CurUninstallStep = usPostUninstall then
  begin
    if RegQueryStringValue(HKCU, 'Environment', 'Path', P) then
    begin
      App := ExpandConstant('{app}');
      I := Pos(';' + Uppercase(App), Uppercase(P));
      if I > 0 then
      begin
        Delete(P, I, Length(App) + 1);
        RegWriteExpandStringValue(HKCU, 'Environment', 'Path', P);
      end;
    end;
  end;
end;
