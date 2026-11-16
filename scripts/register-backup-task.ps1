<#
.SYNOPSIS
  Регистрирует ежедневную задачу планировщика Windows «Puls Next — резервная копия» (запуск от SYSTEM).

.DESCRIPTION
  Запускать от администратора на сервере. Копирует backup-puls.ps1 в <BackupRoot>\scripts (чтобы задача не
  зависела от каталога репозитория), сохраняет пароль PostgreSQL в <BackupRoot>\pg-password.txt с доступом
  только для администраторов и SYSTEM и создает задачу на ежедневный запуск.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\register-backup-task.ps1 -At 02:30
#>
[CmdletBinding()]
param(
    [string]$BackupRoot = 'C:\PulsCRMBackups',
    [string]$StorageRoot = 'C:\PulsCRMData',
    [string]$At = '02:30',
    [int]$KeepDays = 14,
    [string]$TaskName = 'Puls Next — резервная копия'
)

$ErrorActionPreference = 'Stop'

New-Item -ItemType Directory -Force -Path (Join-Path $BackupRoot 'scripts') | Out-Null
$scriptPath = Join-Path $BackupRoot 'scripts\backup-puls.ps1'
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'backup-puls.ps1') -Destination $scriptPath -Force

$passwordFile = Join-Path $BackupRoot 'pg-password.txt'
if (-not (Test-Path -LiteralPath $passwordFile)) {
    $secure = Read-Host 'Пароль пользователя PostgreSQL pulschat' -AsSecureString
    $plain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
    Set-Content -LiteralPath $passwordFile -Value $plain -Encoding ASCII -NoNewline
}

# Доступ к файлу пароля — только администраторы и SYSTEM.
& icacls $passwordFile /inheritance:r /grant:r '*S-1-5-32-544:(R,W)' '*S-1-5-18:(R)' | Out-Null

$arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`" -BackupRoot `"$BackupRoot`" -StorageRoot `"$StorageRoot`" -PgPasswordFile `"$passwordFile`" -KeepDays $KeepDays"
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $arguments
$trigger = New-ScheduledTaskTrigger -Daily -At $At
$principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 3)
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null

Write-Host "Задача «$TaskName» создана: ежедневно в $At. Проверить сейчас:"
Write-Host "  Start-ScheduledTask -TaskName '$TaskName'; Get-Content '$BackupRoot\backup.log' -Tail 20"
