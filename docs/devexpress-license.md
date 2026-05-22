# Лицензия DevExpress и предупреждение DX1001

`DX1001` означает, что проект собирается с пакетами DevExpress, но на текущей машине не найдена активированная лицензия DevExpress.

Для этого репозитория это относится к проектам, где используется `DevExpress.Xpo`.

## Когда файл лицензии нужен

- Нужен на любой машине, где выполняется `dotnet restore`, `dotnet build` или `dotnet publish` для проектов с DevExpress.
- Нужен на локальной машине разработчика.
- Нужен на build-agent, self-hosted runner и любом сервере, который сам собирает проект.
- Не нужен на IIS-сервере, если сервер только запускает уже опубликованные бинарники, собранные на другой машине.

Практическое правило:

- если сервер только хостит уже опубликованный `C:\Apps\PulsCRM\Api`, ключ на нем не нужен;
- если этот же сервер через GitHub Actions runner или вручную делает `dotnet publish`, ключ на нем нужен.

## Где должна лежать лицензия

Поддерживаемые варианты:

- файл `%AppData%\DevExpress\DevExpress_License.txt`;
- переменная окружения `DevExpress_License`;
- указание пути через переменную окружения `DevExpress_LicensePath`.

Для локальной разработки самый простой вариант: положить файл в `%AppData%\DevExpress\DevExpress_License.txt`.

## Локальная настройка на машине разработчика

1. Убедись, что у тебя есть активная лицензия DevExpress.
2. Получи персональный license key через DevExpress Installer или из личного кабинета DevExpress.
3. Создай каталог `%AppData%\DevExpress`, если его еще нет.
4. Положи файл `DevExpress_License.txt` в `%AppData%\DevExpress\DevExpress_License.txt`.
5. Перезапусти терминал, IDE и фоновые build-процессы.
6. Проверь сборку:

```powershell
dotnet build backend\PulsNextMailing.sln
```

Ожидаемый результат: предупреждение `DX1001` исчезает.

## Настройка на Windows Server с IIS и self-hosted runner

В этом репозитории деплой устроен так, что self-hosted runner сам выполняет сборку и публикацию на сервере. Значит лицензия должна быть доступна именно той учетной записи, под которой работает runner service.

### Шаг 1. Определи, под какой учетной записью работает runner

Открой `services.msc` и найди сервис GitHub Actions runner. Проверь вкладку `Log On`.

Рекомендуемый вариант: отдельная сервисная учетная запись, а не `LocalSystem`.

### Шаг 2. Настрой лицензию для этой учетной записи

Вариант A, через файл:

1. Войди под этой учетной записью хотя бы один раз, чтобы создался профиль пользователя.
2. Создай каталог `%AppData%\DevExpress` именно в профиле этой учетной записи.
3. Положи туда `DevExpress_License.txt`.

Вариант B, через переменную окружения:

1. Добавь machine-level переменную `DevExpress_License` со значением license key.
2. Или добавь machine-level переменную `DevExpress_LicensePath` с путем к защищенному файлу.
3. Ограничь доступ к секрету правами NTFS и списком администраторов.

Если runner работает под `LocalSystem`, `%AppData%` обычно указывает на:

```text
C:\Windows\System32\config\systemprofile\AppData\Roaming
```

В этом случае путь к файлу обычно такой:

```text
C:\Windows\System32\config\systemprofile\AppData\Roaming\DevExpress\DevExpress_License.txt
```

Но для production лучше перевести runner на отдельную сервисную учетную запись и хранить ключ уже в ее профиле.

### Шаг 3. Перезапусти runner service

После добавления файла или переменных окружения перезапусти сервис runner, иначе он может не увидеть новые настройки.

### Шаг 4. Проверь публикацию

Локально на сервере:

```powershell
dotnet build backend\PulsNextMailing.sln
dotnet publish backend\src\PulsNext.Api\PulsNext.Api.csproj -c Release
```

Или просто запусти GitHub Actions workflow деплоя и убедись, что в логе нет `DX1001`.

## Нужен ли файл лицензии при публикации на IIS

Короткий ответ:

- нет, если IIS только запускает уже собранное приложение;
- да, если этот же сервер сам выполняет сборку или `dotnet publish`.

Сам файл лицензии не нужно копировать:

- в `C:\Apps\PulsCRM\Api`;
- в `C:\Apps\PulsCRM\Web`;
- в репозиторий Git;
- в артефакты публикации.

Лицензия нужна build-окружению, а не опубликованному приложению.

## Как быстро проверить, что все настроено правильно

Проверка файла в текущем профиле:

```powershell
Test-Path "$env:APPDATA\DevExpress\DevExpress_License.txt"
```

Проверка текущей сборки:

```powershell
dotnet build backend\PulsNextMailing.sln
```

Если `DX1001` остался:

1. Проверь, под какой учетной записью реально идет сборка.
2. Проверь, что ключ доступен именно этой учетной записи.
3. Перезапусти terminal, IDE, runner service или сервер после изменения переменных окружения.
4. Убедись, что ключ не поврежден и соответствует активной лицензии DevExpress.

## Официальные материалы

- DevExpress Licensing FAQ: https://docs.devexpress.com/GeneralInformation/119004/nuget/obtain-your-nuget-feed-credentials/licensing-faq
- Specify a License Key for DevExpress NuGet Packages: https://docs.devexpress.com/GeneralInformation/403944/nuget/obtain-your-nuget-feed-credentials
