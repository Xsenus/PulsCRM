# Автодеплой на Windows Server 2016 и IIS

Для этого проекта используется `pull-based` схема деплоя:

- GitHub хранит репозиторий и workflow.
- На Windows Server ставится self-hosted GitHub Actions runner.
- После `push` в `main` runner сам получает задачу, собирает проект на сервере и раскладывает артефакты в IIS и каталог worker-сервиса.

Такая схема подходит для изолированного сервера, потому что ему нужен только исходящий доступ в интернет.

## 1. Структура production-каталогов

Рекомендуемая структура:

```text
C:\Apps\PulsCRM\Api
C:\Apps\PulsCRM\Web
C:\Apps\PulsCRM\Worker
C:\PulsCRMData
C:\PulsCRMConfig\Api
C:\PulsCRMConfig\Worker
```

Назначение каталогов:

- `C:\Apps\PulsCRM\Api` - опубликованный ASP.NET Core API для IIS
- `C:\Apps\PulsCRM\Web` - собранный Vite frontend
- `C:\Apps\PulsCRM\Worker` - файлы worker-сервиса
- `C:\PulsCRMData` - SQLite БД, загрузки, ключи Data Protection
- `C:\PulsCRMConfig\...` - реальные `appsettings.Production.json`, которые не хранятся в Git

Изменяемые данные нельзя хранить внутри папок деплоя, потому что workflow использует `robocopy /MIR`, а значит лишние файлы в целевой папке могут быть удалены при следующем деплое.

## 2. Что установить на сервер

Все команды ниже выполняй из PowerShell от имени администратора.

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

### ASP.NET Core Hosting Bundle

Установи `ASP.NET Core Hosting Bundle` для `.NET 9`. Без него IIS не сможет запускать `PulsNext.Api`.

### IIS URL Rewrite

Установи `IIS URL Rewrite Module 2.x`. Он нужен для SPA-маршрутов фронтенда. В репозитории уже добавлен файл `frontend/puls-next-web/public/web.config`, который делает fallback на `index.html`.

Без URL Rewrite:

- корневая страница откроется
- прямое открытие `/campaigns`, `/employees` и других SPA-маршрутов вернет `404`

### Инструменты сборки

Установи:

- Git for Windows
- Node.js 20 LTS
- .NET 9 SDK

Проверка:

```powershell
git --version
node --version
npm --version
dotnet --info
```

### Лицензия DevExpress на сервере

Если сервер только запускает уже опубликованные файлы, лицензия DevExpress на нем не нужна.

Если этот же сервер сам делает `dotnet build` или `dotnet publish` через self-hosted runner, лицензия нужна именно для учетной записи, под которой работает runner service.

Коротко:

- не копируй `DevExpress_License.txt` в папки IIS-сайта и в артефакты публикации;
- не коммить ключ в Git;
- храни ключ в `%AppData%\DevExpress\DevExpress_License.txt` учетной записи сборки или настрой `DevExpress_License` / `DevExpress_LicensePath`.

Подробная инструкция: `docs/devexpress-license.md`.

## 3. Создание каталогов

```powershell
New-Item -ItemType Directory -Force -Path C:\Apps\PulsCRM\Api
New-Item -ItemType Directory -Force -Path C:\Apps\PulsCRM\Web
New-Item -ItemType Directory -Force -Path C:\Apps\PulsCRM\Worker
New-Item -ItemType Directory -Force -Path C:\PulsCRMData
New-Item -ItemType Directory -Force -Path C:\PulsCRMData\uploads
New-Item -ItemType Directory -Force -Path C:\PulsCRMData\keys
New-Item -ItemType Directory -Force -Path C:\PulsCRMConfig\Api
New-Item -ItemType Directory -Force -Path C:\PulsCRMConfig\Worker
```

## 4. Production-конфиги на сервере

В репозитории уже есть шаблоны:

- `backend/src/PulsNext.Api/appsettings.Production.example.json`
- `backend/src/PulsNext.Worker/appsettings.Production.example.json`
- `frontend/puls-next-web/.env.production.example`

Создай реальные конфиги на сервере:

```powershell
Copy-Item backend\src\PulsNext.Api\appsettings.Production.example.json C:\PulsCRMConfig\Api\appsettings.Production.json
Copy-Item backend\src\PulsNext.Worker\appsettings.Production.example.json C:\PulsCRMConfig\Worker\appsettings.Production.json
```

Что обязательно отредактировать:

- `ConnectionStrings:LegacyDb`
- `ConnectionStrings:MailingDb`
- `Jwt:SigningKey`
- `Storage:RootPath`
- `Cors:Origins`

Важно:

- `Storage:RootPath` должен указывать на `C:\PulsCRMData`
- `MailingDb` должен указывать на `C:\PulsCRMData\mailing.db`
- production-конфиги не должны жить в репозитории

Пример:

```json
{
  "ConnectionStrings": {
    "LegacyDb": "XpoProvider=MSSqlServer;data source=SQLSERVER01;integrated security=SSPI;initial catalog=DXPulsBase",
    "MailingDb": "XpoProvider=SQLite;Data Source=C:/PulsCRMData/mailing.db"
  },
  "Storage": {
    "RootPath": "C:/PulsCRMData",
    "UploadsPath": "uploads",
    "KeysPath": "keys"
  }
}
```

## 5. Настройка IIS

Подключи модуль управления IIS:

```powershell
Import-Module WebAdministration
```

Создай app pools:

```powershell
New-WebAppPool -Name "PulsCRM.Api"
Set-ItemProperty IIS:\AppPools\PulsCRM.Api -Name managedRuntimeVersion -Value ""

New-WebAppPool -Name "PulsCRM.Web"
Set-ItemProperty IIS:\AppPools\PulsCRM.Web -Name managedRuntimeVersion -Value ""
```

Создай сайты:

```powershell
New-Website -Name "PulsCRM.Api" -PhysicalPath "C:\Apps\PulsCRM\Api" -Port 80 -HostHeader "api.example.com" -ApplicationPool "PulsCRM.Api"
New-Website -Name "PulsCRM.Web" -PhysicalPath "C:\Apps\PulsCRM\Web" -Port 80 -HostHeader "crm.example.com" -ApplicationPool "PulsCRM.Web"
```

После этого добавь HTTPS binding и сертификаты через IIS Manager.

## 6. Права и учетные записи

У проекта есть:

- файловое хранилище
- `Integrated Security=SSPI` в примерах подключения к SQL Server
- отдельный worker-сервис

Значит нужно правильно настроить права.

Минимум:

- identity пула `PulsCRM.Api` должна иметь доступ на чтение и запись в `C:\PulsCRMData`
- учетная запись worker-сервиса должна иметь доступ на чтение и запись в `C:\PulsCRMData`
- обе учетные записи должны иметь доступ к SQL Server, если используется Windows-аутентификация

Важный момент:

- если SQL Server удаленный, не стоит оставлять `ApplicationPoolIdentity` и `LocalSystem` без осознанной настройки прав
- для production лучше использовать отдельную сервисную учетную запись для IIS и worker

## 7. Установка worker как Windows Service

`PulsNext.Worker` уже доработан для нормального запуска как Windows Service.

После первой публикации установи его так:

```powershell
.\scripts\install-worker-service.ps1 `
  -ServiceName "PulsCRM.Worker" `
  -DisplayName "PulsCRM Worker" `
  -ExecutablePath "C:\Apps\PulsCRM\Worker\PulsNext.Worker.exe"
```

Если сервис должен работать не под `LocalSystem`:

1. открой `services.msc`
2. найди `PulsCRM Worker`
3. зайди в `Properties -> Log On`
4. укажи нужную учетную запись
5. сохрани изменения

Запуск:

```powershell
Start-Service PulsCRM.Worker
```

## 8. Установка self-hosted runner

После создания репозитория на GitHub:

1. открой `Settings -> Actions -> Runners`
2. нажми `New self-hosted runner`
3. выбери `Windows`
4. выполни на сервере команды, которые покажет GitHub

Рекомендуемый каталог:

```powershell
New-Item -ItemType Directory -Force -Path C:\actions-runner
Set-Location C:\actions-runner
```

При настройке runner:

- добавь label `iis-prod`
- установи runner как Windows Service

Типовой сценарий:

```powershell
.\config.cmd --url https://github.com/<owner>/<repo> --token <temporary-token> --labels iis-prod
.\svc install
.\svc start
```

## 9. GitHub Actions Variables

В `Settings -> Secrets and variables -> Actions -> Variables` добавь:

```text
PRODUCTION_API_URL = https://api.example.com
API_SITE_PATH = C:\Apps\PulsCRM\Api
WEB_SITE_PATH = C:\Apps\PulsCRM\Web
WORKER_PATH = C:\Apps\PulsCRM\Worker
API_CONFIG_PATH = C:\PulsCRMConfig\Api\appsettings.Production.json
WORKER_CONFIG_PATH = C:\PulsCRMConfig\Worker\appsettings.Production.json
WORKER_SERVICE_NAME = PulsCRM.Worker
HEALTHCHECK_URL = https://api.example.com/health
```

Назначение переменных:

- `PRODUCTION_API_URL` - попадет во frontend как `VITE_API_URL`
- `API_SITE_PATH` - физический путь API-сайта IIS
- `WEB_SITE_PATH` - физический путь frontend-сайта IIS
- `WORKER_PATH` - каталог публикации worker
- `API_CONFIG_PATH` - локальный production-конфиг API
- `WORKER_CONFIG_PATH` - локальный production-конфиг worker
- `WORKER_SERVICE_NAME` - сервис, который будет остановлен и запущен заново при деплое
- `HEALTHCHECK_URL` - URL для проверки после деплоя

## 10. Как работает workflow

Файл `.github/workflows/deploy.yml` делает следующее:

1. запускается по `push` в `main`
2. забирает код на Windows runner
3. ставит `.NET 9` и `Node.js 20`
4. делает `dotnet restore`
5. собирает frontend через `npm ci` и `npm run build`
6. публикует API в `artifacts\api`
7. публикует worker в `artifacts\worker`
8. вызывает `scripts/deploy-iis.ps1`

Сам скрипт деплоя:

1. копирует локальные production-конфиги из `C:\PulsCRMConfig`
2. останавливает worker-сервис, если он установлен
3. создает `app_offline.htm` в IIS-папке API
4. копирует API в `C:\Apps\PulsCRM\Api`
5. удаляет `app_offline.htm`
6. копирует frontend в `C:\Apps\PulsCRM\Web`
7. копирует worker в `C:\Apps\PulsCRM\Worker`
8. запускает worker-сервис обратно
9. проверяет `/health`

## 11. Первый запуск деплоя

Когда репозиторий уже на GitHub и runner онлайн:

```powershell
git add .
git commit -m "Add GitHub Actions IIS deployment"
git push origin main
```

После этого зайди в `Actions` и проверь выполнение workflow `Deploy Production`.

## 12. Типовые проблемы

### При обновлении страницы на вложенном маршруте фронтенда получаю 404

Проверь:

- установлен ли `IIS URL Rewrite Module`
- есть ли `web.config` в `C:\Apps\PulsCRM\Web`

### IIS отдает 500.30 или API не стартует

Проверь:

- установлен ли `.NET 9 Hosting Bundle`
- скопировался ли `appsettings.Production.json` из `C:\PulsCRMConfig\Api`
- есть ли у app pool права на сайт и `C:\PulsCRMData`

### Во время сборки или публикации на сервере вижу DX1001

Проверь:

- действительно ли сервер сам выполняет `dotnet build` или `dotnet publish`
- есть ли ключ у учетной записи, под которой работает GitHub Actions runner
- не положен ли ключ ошибочно в папку публикации вместо `%AppData%\DevExpress`
- был ли перезапущен runner service после добавления ключа

Подробная инструкция: `docs/devexpress-license.md`.

### После деплоя исчезают загруженные файлы или SQLite база

Проверь:

- `Storage:RootPath` указывает на `C:\PulsCRMData`
- `MailingDb` указывает на `C:\PulsCRMData\mailing.db`
- изменяемые данные не лежат внутри `C:\Apps\PulsCRM\...`

### После деплоя нет подключения к SQL Server

Проверь:

- есть ли права на SQL Server у identity app pool
- есть ли права на SQL Server у учетной записи worker-сервиса
- если используется Windows-аутентификация к удаленному SQL Server, лучше запускать API и worker под отдельной сервисной учетной записью
