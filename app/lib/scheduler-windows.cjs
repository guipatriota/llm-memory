'use strict';
// Windows Task Scheduler, per user, no elevation. Triggers are written with a fixed
// local time (no UTC offset): -At records the offset of the day the task is created
// and a DST change would shift the run by one hour. StartWhenAvailable replaces the
// boot trigger (which needs an elevated shell): a run missed while the machine was
// off starts as soon as it is on.
const path = require('path');
const { run } = require('./exec.cjs');

const TASK_INGEST = 'llm-memory ingest';
const TASK_LINT = 'llm-memory lint';
const DAY_NAMES = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday' };

function powershell(script) {
  const encoded = Buffer.from(script, 'utf16le').toString('base64');
  return run('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded], { timeout: 120000 });
}

const psq = (s) => `'${String(s).replace(/'/g, "''")}'`;

function actionFor(appDir, kind) {
  const cli = path.join(appDir, 'cli.cjs');
  return `New-ScheduledTaskAction -Execute ${psq(process.execPath)} -Argument ${psq(`"${cli}" ${kind}`)} -WorkingDirectory ${psq(appDir)}`;
}

function register(appDir, schedule) {
  const ingestTriggers = schedule.ingest.map((t) => `(New-LocalTrigger ${psq(t)})`).join(', ');
  const lintTrigger = `New-LocalTrigger ${psq(schedule.lint.time)} ${psq(DAY_NAMES[schedule.lint.day])}`;
  const script = `
$ErrorActionPreference = 'Stop'
function New-LocalTrigger {
  param([string]$Time, [string]$Weekday)
  $t = if ($Weekday) { New-ScheduledTaskTrigger -Weekly -DaysOfWeek $Weekday -At $Time } else { New-ScheduledTaskTrigger -Daily -At $Time }
  $t.StartBoundary = '{0}T{1}:00' -f (Get-Date).ToString('yyyy-MM-dd'), $Time
  return $t
}
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Hours 72) -MultipleInstances IgnoreNew
$ingestAction = ${actionFor(appDir, 'ingest')}
$lintAction = ${actionFor(appDir, 'lint')}
Register-ScheduledTask -TaskName ${psq(TASK_INGEST)} -Action $ingestAction -Trigger @(${ingestTriggers}) -Settings $settings -Force | Out-Null
Register-ScheduledTask -TaskName ${psq(TASK_LINT)} -Action $lintAction -Trigger (${lintTrigger}) -Settings $settings -Force | Out-Null
'ok'
`;
  const r = powershell(script);
  if (!r.ok) throw new Error(`Task Scheduler: ${(r.stderr || r.stdout).split('\n')[0]}`);
  return [TASK_INGEST, TASK_LINT];
}

function unregister() {
  const script = `
foreach ($t in @(${psq(TASK_INGEST)}, ${psq(TASK_LINT)})) {
  Unregister-ScheduledTask -TaskName $t -Confirm:$false -ErrorAction SilentlyContinue
}
'ok'
`;
  return powershell(script).ok;
}

// { 'llm-memory ingest': 'Ready' | 'Running' | 'Disabled' | null, ... }
function status() {
  const script = `
$out = @{}
foreach ($t in @(${psq(TASK_INGEST)}, ${psq(TASK_LINT)})) {
  $task = Get-ScheduledTask -TaskName $t -ErrorAction SilentlyContinue
  $out[$t] = if ($task) { [string]$task.State } else { $null }
}
$out | ConvertTo-Json -Compress
`;
  const r = powershell(script);
  if (!r.ok) return { [TASK_INGEST]: null, [TASK_LINT]: null };
  try {
    return JSON.parse(r.stdout);
  } catch {
    return { [TASK_INGEST]: null, [TASK_LINT]: null };
  }
}

module.exports = { register, unregister, status, TASK_INGEST, TASK_LINT };
