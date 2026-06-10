# Автодеплой на Windows Server 2016 и IIS

Проект деплоится как два артефакта:

- `PulsNext.Api` — ASP.NET Core API под IIS. Внутри API работают фоновые hosted services рассылок.
- `puls-next-web` — собранный Vite frontend как статический IIS-сайт.

Отдельного Windows Service для рассылок больше нет.

## 1. Production-каталоги

```text
C:\Apps\PulsCRM\Api
C:\Apps\PulsCRM\Web
C:\PulsCRMData
C:\PulsCRMData\uploads
C:\PulsCRMData\keys
C:\PulsCRMConfig\Api
C:\actions-runner
```

Назначение:

- `C:\Apps\PulsCRM\Api` - опубликованный ASP.NET Core API для IIS
- `C:\Apps\PulsCRM\Web` - собранный Vite frontend
- `C:\PulsCRMData` - загрузки, ключи Data Protection и другие файловые данные
- `C:\PulsCRMConfig\Api` - реальный `appsettings.Production.json`, который не хранится в Git

Изменяемые данные нельзя хранить внутри `C:\Apps\PulsCRM\...`, потому что deploy-скрипт использует `robocopy /MIR`.

## 2. Установка компонентов

Выполнять из PowerShell администратора.

### IIS

```powershell
Install-WindowsFeature `
  Web-Server, `
  Web-Common-Http, `
  Web-Default-Doc, `
  Web-Static-Content, `
  Web-Http-Errors, `
  Web-Http-Logging, `
  Web-Request-Monitor, `
  Web-Stat-Compression, `
  Web-Filtering, `
  Web-Mgmt-Console, `
  Web-Scripting-Tools
```

Дополнительно установить:

- ASP.NET Core Hosting Bundle для `.NET 9`
- IIS URL Rewrite Module 2.x
- Git for Windows
- Node.js 20 LTS
- .NET 9 SDK
- DevExpress license для учетной записи GitHub runner, если сервер сам собирает проект

Проверка:

```powershell
git --version
node --version
npm --version
dotnet --info
```

## 3. Создание каталогов

```powershell
New-Item -ItemType Directory -Force -Path C:\Apps\PulsCRM\Api
New-Item -ItemType Directory -Force -Path C:\Apps\PulsCRM\Web
New-Item -ItemType Directory -Force -Path C:\PulsCRMData\uploads
New-Item -ItemType Directory -Force -Path C:\PulsCRMData\keys
New-Item -ItemType Directory -Force -Path C:\PulsCRMConfig\Api
New-Item -ItemType Directory -Force -Path C:\actions-runner
```

## 4. Production-конфиг API

Скопировать шаблон:

```powershell
Copy-Item backend\src\PulsNext.Api\appsettings.Production.example.json C:\PulsCRMConfig\Api\appsettings.Production.json
```

Настроить `C:\PulsCRMConfig\Api\appsettings.Production.json`.

Пример:

```json
{
  "ConnectionStrings": {
    "LegacyDb": "XpoProvider=MSSqlServer;data source=SQLSERVER01;integrated security=SSPI;initial catalog=DXPulsBase;TrustServerCertificate=true",
    "MailingDb": "XpoProvider=MSSqlServer;data source=SQLSERVER01;integrated security=SSPI;initial catalog=DXPulsBase;TrustServerCertificate=true"
  },
  "Jwt": {
    "Issuer": "PulsNext.Api",
    "Audience": "PulsNext.Web",
    "SigningKey": "REPLACE_WITH_A_LONG_RANDOM_SECRET_KEY_64_PLUS_CHARS",
    "AccessTokenMinutes": 480
  },
  "Dispatch": {
    "SchedulerPollSeconds": 15,
    "RecoveryPollSeconds": 5,
    "DueCampaignBatchSize": 10,
    "QueueBatchSize": 200,
    "ChannelCapacity": 4000,
    "SenderConcurrency": 4,
    "RetryBaseDelayMinutes": 3,
    "RetryMaxDelayMinutes": 30,
    "WorkerNode": "API"
  },
  "Storage": {
    "RootPath": "C:/PulsCRMData",
    "UploadsPath": "uploads",
    "KeysPath": "keys",
    "MaxFileSizeBytes": 26214400
  },
  "MailingDb": {
    "AutoCreateSchema": true
  },
  "Cors": {
    "Origins": [
      "https://crm.example.com"
    ]
  },
  "AllowedHosts": "*"
}
```

Важно:

- `LegacyDb` и `MailingDb` должны указывать на одну основную SQL Server БД.
- На первом запуске можно поставить `AutoCreateSchema: true`, чтобы XPO создал таблицы `Mail*`.
- После создания схемы лучше вернуть `AutoCreateSchema: false`.
- `SigningKey` должен быть длинным случайным секретом, не из примера.
- `Cors:Origins` должен содержать реальный URL frontend-сайта.

## 5. IIS

```powershell
Import-Module WebAdministration
```

Создать app pools:

```powershell
New-WebAppPool -Name "PulsCRM.Api"
Set-ItemProperty IIS:\AppPools\PulsCRM.Api -Name managedRuntimeVersion -Value ""

New-WebAppPool -Name "PulsCRM.Web"
Set-ItemProperty IIS:\AppPools\PulsCRM.Web -Name managedRuntimeVersion -Value ""
```

Для API желательно отключить idle timeout и включить always running, потому что внутри API работают фоновые задачи рассылки:

```powershell
Set-ItemProperty IIS:\AppPools\PulsCRM.Api -Name processModel.idleTimeout -Value ([TimeSpan]::Zero)
Set-ItemProperty IIS:\AppPools\PulsCRM.Api -Name startMode -Value AlwaysRunning
```

Создать сайты:

```powershell
New-Website -Name "PulsCRM.Api" -PhysicalPath "C:\Apps\PulsCRM\Api" -Port 80 -HostHeader "api.example.com" -ApplicationPool "PulsCRM.Api"
New-Website -Name "PulsCRM.Web" -PhysicalPath "C:\Apps\PulsCRM\Web" -Port 80 -HostHeader "crm.example.com" -ApplicationPool "PulsCRM.Web"
```

Для API можно включить preload:

```powershell
Set-ItemProperty "IIS:\Sites\PulsCRM.Api" -Name applicationDefaults.preloadEnabled -Value True
```

После этого добавить HTTPS binding и сертификаты через IIS Manager.

## 6. Права и SQL Server

Если используется `integrated security=SSPI`, identity пула `PulsCRM.Api` должна иметь права:

- на чтение/запись в SQL Server БД
- на чтение/запись в `C:\PulsCRMData`
- на чтение опубликованного API

Для production лучше использовать отдельную сервисную учетную запись, например `DOMAIN\PulsCRMService`.

Права на папки:

```powershell
icacls C:\Apps\PulsCRM\Api /grant "DOMAIN\PulsCRMService:(OI)(CI)RX"
icacls C:\Apps\PulsCRM\Web /grant "IIS AppPool\PulsCRM.Web:(OI)(CI)RX"
icacls C:\PulsCRMData /grant "DOMAIN\PulsCRMService:(OI)(CI)M"
```

SQL пример:

```sql
USE [DXPulsBase];
CREATE USER [DOMAIN\PulsCRMService] FOR LOGIN [DOMAIN\PulsCRMService];
ALTER ROLE db_owner ADD MEMBER [DOMAIN\PulsCRMService];
```

`db_owner` нужен только для первого автосоздания `Mail*` таблиц. После этого права можно сузить.

## 7. Self-hosted GitHub Actions runner

В GitHub открыть:

```text
Settings -> Actions -> Runners -> New self-hosted runner
```

На сервере:

```powershell
Set-Location C:\actions-runner
.\config.cmd --url https://github.com/<owner>/<repo> --token <temporary-token> --labels iis-prod
.\svc install
.\svc start
```

Runner должен иметь labels:

```text
self-hosted, windows, x64, iis-prod
```

## 8. GitHub Actions Variables

В GitHub:

```text
Settings -> Secrets and variables -> Actions -> Variables
```

Добавить:

```text
PRODUCTION_API_URL = https://api.example.com
API_SITE_PATH = C:\Apps\PulsCRM\Api
WEB_SITE_PATH = C:\Apps\PulsCRM\Web
API_CONFIG_PATH = C:\PulsCRMConfig\Api\appsettings.Production.json
HEALTHCHECK_URL = https://api.example.com/health
FRONTEND_URL = https://app.example.com
DEPLOY_BACKUP_PATH = C:\Apps\PulsCRM\Backups
```

`FRONTEND_URL` можно не задавать, если frontend доступен с IIS-сервера на `http://localhost:8080/`. `PRODUCTION_API_URL` используется при сборке frontend и для smoke-проверки публичного `/api/auth/users?take=1`.

`DEPLOY_BACKUP_PATH` можно не задавать, тогда workflow использует `C:\Apps\PulsCRM\Backups`. В этой папке хранятся пять последних публикаций API/Web для ручного отката.

## 9. Как работает workflow

`.github/workflows/deploy.yml` делает:

1. checkout репозитория
2. setup `.NET 9`
3. setup Node.js 20
4. `dotnet restore`
5. `npm ci && npm run build`
6. `dotnet publish` API в `artifacts\api`
7. копирование production-конфига API
8. `app_offline.htm` для остановки API
9. backup текущих каталогов API/Web в `DEPLOY_BACKUP_PATH\yyyyMMdd-HHmmss`
10. `robocopy /MIR` API в `C:\Apps\PulsCRM\Api`
11. `robocopy /MIR` frontend в `C:\Apps\PulsCRM\Web`
12. healthcheck `/health`
13. post-deploy smoke API/frontend
14. read-only проверка `Mail*` таблиц, SMTP-профилей и очереди в SQL

Запуск деплоя:

```powershell
git push origin main
```

Или вручную:

```text
GitHub -> Actions -> Deploy Production -> Run workflow
```

## 10. Ручной rollback

Перед заменой файлов `scripts\deploy-iis.ps1` сохраняет предыдущую публикацию в папку вида:

```text
C:\Apps\PulsCRM\Backups\20260610-184500
```

Внутри лежат:

```text
Api\
Web\
manifest.json
```

Чтобы вернуть предыдущую версию:

```powershell
cd C:\actions-runner\_work\PulsCRM\PulsCRM

$backup = "C:\Apps\PulsCRM\Backups\20260610-184500"

.\scripts\rollback-iis.ps1 `
  -BackupPath $backup `
  -ApiTargetPath C:\Apps\PulsCRM\Api `
  -WebTargetPath C:\Apps\PulsCRM\Web `
  -HealthcheckUrl http://localhost:8081/health `
  -WarmupUrls @("http://localhost:8081/health", "http://localhost:8080/") `
  -ApiAppPoolName "PulsCRM.Api"
```

Если нужно посмотреть доступные backup-папки:

```powershell
Get-ChildItem C:\Apps\PulsCRM\Backups -Directory | Sort-Object Name -Descending
```

В publish-каталогах `C:\Apps\PulsCRM\Api` и `C:\Apps\PulsCRM\Web` не нужно хранить пользовательские uploads, ключи, логи и другие mutable data. Для этого используется `C:\PulsCRMData`, который не попадает под `robocopy /MIR`.

## 11. Проверки после деплоя

```powershell
Invoke-WebRequest https://api.example.com/health -UseBasicParsing
.\scripts\smoke-iis.ps1 `
  -HealthcheckUrl https://api.example.com/health `
  -FrontendUrl https://app.example.com `
  -AuthUsersUrl https://api.example.com/api/auth/users?take=1 `
  -ApiConfigPath C:\PulsCRMConfig\Api\appsettings.Production.json `
  -ProductionApiUrl https://api.example.com

.\scripts\check-mailing-db.ps1 `
  -ApiConfigPath C:\PulsCRMConfig\Api\appsettings.Production.json
```

SQL:

```sql
USE [DXPulsBase];

SELECT name
FROM sys.tables
WHERE name LIKE 'Mail%'
ORDER BY name;
```

Ожидаемые таблицы:

```text
MailCampaign
MailCampaignAttachment
MailCampaignTargetOrganization
MailDispatchBatch
MailDispatchItem
MailStoredFile
MailTransportProfile
```

`check-mailing-db.ps1` выполняет только read-only запросы. Скрипт проверяет наличие `Mail*` таблиц, выводит количество строк в каждой таблице, количество SMTP-профилей, глубину очереди и количество failed-элементов. Если нужно сделать SMTP-профиль обязательным условием приемки, запустите:

```powershell
.\scripts\check-mailing-db.ps1 `
  -ApiConfigPath C:\PulsCRMConfig\Api\appsettings.Production.json `
  -RequireTransportProfile
```

## 12. Типовые проблемы

### API не стартует, IIS 500.30

Проверить:

- установлен ли `.NET 9 Hosting Bundle`
- скопировался ли `appsettings.Production.json`
- есть ли права к SQL Server
- есть ли права к `C:\PulsCRMData`

### Рассылки не уходят

Проверить:

- app pool `PulsCRM.Api` не уходит в idle timeout
- `PulsCRM.Api` настроен `AlwaysRunning`
- SMTP-профиль создан и включен
- в таблице `MailDispatchItem` есть queued/deferred записи

### Frontend маршруты дают 404

Проверить:

- установлен ли IIS URL Rewrite
- есть ли `web.config` в `C:\Apps\PulsCRM\Web`

### Нет подключения к SQL Server

Проверить:

- под какой учетной записью работает app pool
- есть ли SQL login/user для этой учетной записи
- правильный ли `data source`
- доступен ли SQL Server с IIS-сервера
