# Puls Next Mailing

Готовый стартовый проект для миграции legacy WinForms/DevExpress приложения на современный стек:

- backend: ASP.NET Core Web API на .NET 9;
- ORM: DevExpress XPO;
- frontend: React + Vite + DevExtreme React;
- фоновые процессы рассылки: hosted services внутри ASP.NET Core API;
- рассылка: MailKit + персистентная очередь + статистика;
- legacy-интеграция: авторизация и чтение сотрудников / организаций / вкладки «Работа» из текущей БД.

## Что взято из существующего кода

По исходному архиву были выделены и перенесены ключевые сущности:

- `set_User` → `LegacyUser`
- `set_UserInfo` → `LegacyUserInfo`
- `set_Org` → `LegacyOrg`
- `set_OrgInfo` → `LegacyOrgInfo`
- `set_OrgInfoOther` → `LegacyOrgInfoOther`
- `set_Contact` → `LegacyContact`
- `set_Job` → `LegacyJob`
- `set_Task` → `LegacyTask`
- `set_SprEnumeration` → `LegacySprEnumeration`

Совместимость по паролям сохранена: используется старый алгоритм `MD5(Encoding.Unicode.GetBytes(password))`.

## Архитектура

Проект использует одну основную БД SQL Server, но две логические области данных:

1. **LegacyDb** — текущая рабочая БД существующего приложения. Из неё читаются и при необходимости обновляются:
   - пользователи;
   - организации;
   - контакты;
   - данные вкладки «Работа» (`set_Job`).
2. **MailingDb** — логическое подключение к той же SQL Server БД для таблиц сервиса рассылки. В таблицах `Mail*` хранятся:
   - кампании;
   - вложения;
   - очереди отправки;
   - истории запусков;
   - статистика;
   - SMTP-профили.

Такой подход не требует SQLite: legacy-таблицы `set_*` и новые таблицы рассылок `Mail*` находятся в одном каталоге SQL Server.

## Структура

```text
backend/
  PulsNextMailing.sln
  src/
    PulsNext.Domain.Legacy/
    PulsNext.Domain.Mailing/
    PulsNext.Infrastructure/
    PulsNext.Api/
frontend/
  puls-next-web/
storage/
```

## Запуск

### 1) Настройте строки подключения

Скопируйте example-конфиги и подставьте connection string legacy БД из старого `settings/XpoSettingsDB.xml`:

```bash
copy backend\src\PulsNext.Api\appsettings.Development.example.json backend\src\PulsNext.Api\appsettings.Development.json
```

Далее отредактируйте:

- `backend/src/PulsNext.Api/appsettings.Development.json`

Пример:

```json
{
  "ConnectionStrings": {
    "LegacyDb": "XpoProvider=MSSqlServer;data source=SERVER;integrated security=SSPI;initial catalog=DXPulsBase;TrustServerCertificate=true",
    "MailingDb": "XpoProvider=MSSqlServer;data source=SERVER;integrated security=SSPI;initial catalog=DXPulsBase;TrustServerCertificate=true"
  }
}
```

### 2) Проверьте сборку backend

```bash
cd backend
dotnet build PulsNextMailing.sln
```

Если во время сборки появляется `DX1001`, см. `docs/devexpress-license.md`.

### 3) Поднимите backend

```bash
cd backend
dotnet run --project src/PulsNext.Api
```

### 4) Поднимите frontend

```bash
cd frontend/puls-next-web
npm install
npm run build
npm run dev
```

После этого будут доступны:

- frontend: `http://localhost:5173`
- backend api: `http://localhost:5185`
- swagger: `http://localhost:5185/swagger`

## Что уже реализовано в коде

### Backend API

- JWT-авторизация по legacy пользователям;
- список сотрудников;
- список организаций;
- данные вкладки «Работа»;
- CRUD кампаний рассылки;
- CRUD SMTP-профилей;
- загрузка файлов;
- предпросмотр расписания;
- статистика по отправкам;
- ручной запуск кампании.

### Фоновые задачи в API

- поиск кампаний, у которых наступило время запуска;
- расчёт следующего времени отправки;
- генерация очереди отправки по организациям и email-адресам;
- конкурентная обработка очереди;
- ретраи;
- запись статусов и ошибок.

### Frontend

- современная shell-навигация;
- логин;
- страницы сотрудников, организаций и вкладки «Работа»;
- список кампаний;
- мастер редактирования кампании;
- загрузка вложений и картинок;
- просмотр статистики;
- управление SMTP-профилями.

## Поддерживаемые сценарии расписания

- **OneTime** — отложенная разовая отправка;
- **FixedInterval** — каждые N минут;
- **RandomInterval** — случайный интервал от X до Y минут;
- **Cron** — произвольное расписание Quartz Cron (например, по понедельникам, по будням, в определённые часы и т.п.).

## Важные замечания

1. Локальная сборка проверена командами `dotnet build backend/PulsNextMailing.sln` и `npm run build` в `frontend/puls-next-web`.
2. Frontend и backend настроены как production-ready scaffold: после подстановки актуальных connection strings проект должен быть близок к боевому запуску.
3. Для реального продакшена рекомендовано:
   - вынести файловое хранилище в S3/MinIO/Azure Blob;
   - подключить Redis/RabbitMQ для распределённой очереди;
   - добавить OpenTelemetry/Prometheus;
   - включить reverse proxy и TLS.

## Следующий шаг

Если будете внедрять это в текущую БД, сначала поднимите проект на копии базы и прогоните сценарии:

- логин;
- чтение сотрудников;
- чтение организаций;
- чтение вкладки «Работа»;
- создание тестовой кампании;
- отправка на тестовый SMTP.
