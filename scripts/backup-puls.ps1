<#
.SYNOPSIS
  Резервная копия Puls Next: база чата (PostgreSQL), вложения чата, файлы рассылок и ключи.

.DESCRIPTION
  Каждый запуск создает папку <BackupRoot>\<yyyyMMdd-HHmmss> с:
    - chat.dump          — дамп базы чата (pg_dump, формат custom; восстановление — pg_restore);
    - keys\              — ключи Data Protection, VAPID и подписи входа (без них не расшифровать пароли SMTP,
                           не работают подписки на уведомления и все выходят из системы);
    - backup-info.txt    — что и откуда скопировано.
  Вложения чата и файлы рассылок копируются дозаписью в <BackupRoot>\files\ (новые и измененные файлы;
  удаленные из CRM файлы в копии остаются — удаление в чате мягкое).
  Папки старше KeepDays удаляются. Журнал — <BackupRoot>\backup.log. Код выхода 0 — успех, 1 — ошибка.

  Базы SQL Server (Пульс и рассылки) этот скрипт не копирует — их резервирует SQL Server (план обслуживания
  или задание агента); см. docs/backup.md.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\backup-puls.ps1 -PgPasswordFile C:\PulsCRMBackups\pg-password.txt
#>
[CmdletBinding()]
param(
    [string]$BackupRoot = 'C:\PulsCRMBackups',
    [string]$StorageRoot = 'C:\PulsCRMData',
    [string]$ChatFolder = 'chat',
    [string]$UploadsFolder = 'uploads',
    [string]$KeysFolder = 'keys',
    [string]$PgDump = '',
    [string]$PgHost = 'localhost',
    [int]$PgPort = 5432,
    [string]$PgUser = 'pulschat',
    [string]$PgDatabase = 'pulschat',
    # Файл с паролем пользователя PostgreSQL (одна строка). Ограничьте доступ к нему: только администраторы и SYSTEM.
    [string]$PgPasswordFile = '',
    [int]$KeepDays = 14,
    [switch]$SkipDatabase
)

$ErrorActionPreference = 'Stop'
New-Item -ItemType Directory -Force -Path $BackupRoot | Out-Null
$logPath = Join-Path $BackupRoot 'backup.log'

function Write-Log([string]$message) {
    $line = '{0:yyyy-MM-dd HH:mm:ss} {1}' -f (Get-Date), $message
    Write-Host $line
    Add-Content -Path $logPath -Value $line -Encoding UTF8
}

function Find-PgDump {
    if ($PgDump) { return $PgDump }
    $command = Get-Command pg_dump -ErrorAction SilentlyContinue
    if ($command) { return $command.Source }
    $candidates = Get-ChildItem -Path 'C:\Program Files\PostgreSQL\*\bin\pg_dump.exe' -ErrorAction SilentlyContinue |
        Sort-Object { [int]($_.Directory.Parent.Name -replace '\D', '') } -Descending
    if ($candidates) { return $candidates[0].FullName }
    throw 'Не найден pg_dump. Укажите путь параметром -PgDump (обычно C:\Program Files\PostgreSQL\<версия>\bin\pg_dump.exe).'
}

# Копирует новые и измененные файлы (по размеру и времени изменения), ничего не удаляя в копии.
function Sync-Folder([string]$source, [string]$target) {
    if (-not (Test-Path -LiteralPath $source)) {
        Write-Log "Пропуск: нет каталога $source"
        return 0
    }

    New-Item -ItemType Directory -Force -Path $target | Out-Null
    $robocopy = Get-Command robocopy -ErrorAction SilentlyContinue
    if ($robocopy) {
        & robocopy $source $target /E /XO /R:2 /W:5 /NFL /NDL /NP /NJH /NJS | Out-Null
        # robocopy: 0–7 — успех (8 и выше — ошибки копирования).
        if ($LASTEXITCODE -ge 8) { throw "robocopy вернул код $LASTEXITCODE при копировании $source" }
        return -1
    }

    $copied = 0
    $sourceRoot = (Resolve-Path -LiteralPath $source).Path.TrimEnd([IO.Path]::DirectorySeparatorChar)
    foreach ($file in Get-ChildItem -LiteralPath $source -Recurse -File) {
        $relative = $file.FullName.Substring($sourceRoot.Length).TrimStart([IO.Path]::DirectorySeparatorChar)
        $destination = Join-Path $target $relative
        $existing = Get-Item -LiteralPath $destination -ErrorAction SilentlyContinue
        if ($existing -and $existing.Length -eq $file.Length -and $existing.LastWriteTimeUtc -ge $file.LastWriteTimeUtc) { continue }
        New-Item -ItemType Directory -Force -Path (Split-Path $destination -Parent) | Out-Null
        Copy-Item -LiteralPath $file.FullName -Destination $destination -Force
        $copied++
    }

    return $copied
}

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$snapshot = Join-Path $BackupRoot $stamp
$exitCode = 0

try {
    Write-Log "=== Резервная копия $stamp ==="
    New-Item -ItemType Directory -Force -Path $snapshot | Out-Null

    if (-not $SkipDatabase) {
        $pgDumpPath = Find-PgDump
        if ($PgPasswordFile) {
            $env:PGPASSWORD = (Get-Content -LiteralPath $PgPasswordFile -Raw).Trim()
        }

        $dumpPath = Join-Path $snapshot 'chat.dump'
        & $pgDumpPath --host $PgHost --port $PgPort --username $PgUser --format custom --no-password --file $dumpPath $PgDatabase
        if ($LASTEXITCODE -ne 0) { throw "pg_dump завершился с кодом $LASTEXITCODE (проверьте пароль: -PgPasswordFile)" }
        Write-Log ("База чата: {0} ({1:N1} МБ)" -f $dumpPath, ((Get-Item $dumpPath).Length / 1MB))
    }

    $keysSource = Join-Path $StorageRoot $KeysFolder
    if (Test-Path -LiteralPath $keysSource) {
        Copy-Item -LiteralPath $keysSource -Destination (Join-Path $snapshot 'keys') -Recurse -Force
        Write-Log "Ключи: $keysSource"
    } else {
        Write-Log "Внимание: нет каталога ключей $keysSource"
    }

    $chatCopied = Sync-Folder (Join-Path $StorageRoot $ChatFolder) (Join-Path $BackupRoot "files\$ChatFolder")
    $uploadsCopied = Sync-Folder (Join-Path $StorageRoot $UploadsFolder) (Join-Path $BackupRoot "files\$UploadsFolder")
    Write-Log ("Файлы: вложения чата — {0}, файлы рассылок — {1}" -f $(if ($chatCopied -lt 0) { 'robocopy' } else { "новых $chatCopied" }), $(if ($uploadsCopied -lt 0) { 'robocopy' } else { "новых $uploadsCopied" }))

    @(
        "Резервная копия Puls Next $stamp",
        "Компьютер: $env:COMPUTERNAME",
        "База чата: $PgDatabase@$($PgHost):$PgPort (chat.dump)",
        "Ключи: $keysSource (keys\)",
        "Файлы (дозапись): $(Join-Path $BackupRoot 'files')",
        "Восстановление: docs/backup.md"
    ) | Set-Content -Path (Join-Path $snapshot 'backup-info.txt') -Encoding UTF8

    $limit = (Get-Date).AddDays(-$KeepDays)
    foreach ($old in Get-ChildItem -LiteralPath $BackupRoot -Directory | Where-Object { $_.Name -match '^\d{8}-\d{6}$' -and $_.CreationTime -lt $limit }) {
        Remove-Item -LiteralPath $old.FullName -Recurse -Force
        Write-Log "Удалена старая копия $($old.Name)"
    }

    Write-Log "Готово: $snapshot"
}
catch {
    $exitCode = 1
    Write-Log "ОШИБКА: $($_.Exception.Message)"
}
finally {
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
}

exit $exitCode
