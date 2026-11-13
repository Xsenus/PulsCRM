# Puls Next Mailing

Готовый стартовый проект для миграции legacy WinForms/DevExpress приложения на современный стек:

- backend: ASP.NET Core Web API на .NET 9;
- ORM: DevExpress XPO;
- frontend: React 18 + TypeScript + Vite, маршрутизация на React Router;
- фоновые процессы рассылки: hosted services внутри ASP.NET Core API;
- рассылка: MailKit + персистентная очередь + статистика;
- legacy-интеграция: авторизация и чтение сотрудников / организаций / вкладки «Работа» из текущей БД;
- аналитика лицензий Парус 10 и Парус Торнадо: импорт данных о лицензиях, годовая аналитика, Excel-отчёт;
- чат сотрудников: личные и групповые чаты, вложения, реакции, оповещения со звуком (отдельная БД PostgreSQL, SignalR) — см. `docs/chat.md`.

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
- `set_ZPParusLicenseInfo` → `LegacyZPParusLicenseInfo`
- `set_ZPParusOrder` → `LegacyZPParusOrder`

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

3. **ChatDb** — отдельная база **PostgreSQL** для чата сотрудников (таблицы `Chat*`: диалоги, участники, сообщения, вложения, реакции, настройки оповещений). Подключается, только если заданы `Chat:Enabled=true` и строка `ConnectionStrings:ChatDb`; без них API к PostgreSQL не обращается. Подробности — `docs/chat.md`.

## Структура

```text
backend/
  PulsNextMailing.sln
  src/
    PulsNext.Domain.Legacy/
    PulsNext.Domain.Mailing/
    PulsNext.Domain.Chat/
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
- ручной запуск кампании;
- аналитика лицензий Парус (`/api/analytics/parus-licenses`) за период с фильтрами по статусу, поиску и зарплатным организациям;
- скачивание файла лицензии из карточки организации;
- импорт данных Парус с режимом проверки без записи (`dryRun`).
- чат сотрудников (`/api/chat/*`) и SignalR-хаб `/hubs/chat` для событий в реальном времени.

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
- управление SMTP-профилями;
- аналитика «Парус Торнадо» (`/analytics/parus-tornado`) и импорт Парус в настройках (см. раздел ниже).
- чат (`/chat` и плавающее окно справа внизу на любой странице): личные и групповые диалоги, ответы, редактирование, реакции, эмодзи, вложения с предпросмотром изображений, «печатает», «в сети», оповещения со звуком.

## Аналитика лицензий Парус

Раздел «Аналитика → Парус Торнадо» строит отчёт по лицензиям Парус 10 и Парус Торнадо по данным legacy-БД.

- **Период.** По умолчанию берётся текущий год; можно задать даты начала и конца.
- **Годовая аналитика.** Сводка по лицензиям и клиентам: действуют, просрочены, продлены, без продления, заканчиваются, новые, ушли.
- **Группы лицензий.** Таблица по организациям: поиск, фильтр по статусу и фильтр «Только ЗП» (организации на зарплатном сопровождении). Учитывается продление лицензии при смене карточки организации.
- **Файлы лицензий.** Сохранённый файл лицензии можно скачать прямо из таблицы.
- **Excel-отчёт.** Выгрузка в `.xlsx` с печатной формой, файл собирается в браузере.

API: `GET /api/analytics/parus-licenses` (параметры `from`/`to` или `dateFromUtc`/`dateToUtc`, `search`, `status`, `salaryOnly`, `skip`/`take`) и `GET /api/analytics/parus-licenses/{clientId}/file`.

### Импорт Парус

Импорт находится в «Настройки → Парус». Файлы можно выбрать или перетащить; сначала стоит запустить проверку: она показывает, что будет добавлено и обновлено, ничего не записывая в базу. Общий импорт (`POST /api/analytics/parus-licenses/import-batch`) принимает:

- `.xml` — сведения о лицензиях, пишутся в `set_ZPParusLicenseInfo`;
- `.lic` — файлы лицензий, сохраняются в карточки организаций (`set_OrgInfoOther`);
- `.zip` — архив с такими файлами, распаковывается на сервере.

Файлы `.mdb`, `.accdb`, `.csv` и `.txt` с карточками организаций общий импорт принимает, но пропускает: обновление карточек в нём отключено. Отдельные endpoint'ы: `import-info` (XML), `import-files` (лицензии) и `import-cards` (карточки организаций). Импорт пишет в рабочую legacy-БД, поэтому на проде запускайте сначала проверку.

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
