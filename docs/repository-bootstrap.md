# Подготовка репозитория

Проект уже подготовлен к первому коммиту. `gitignore` настроен так, чтобы в Git не попадали сборочные артефакты, локальные БД, секреты и машинозависимые файлы.

## 1. Инициализация локального репозитория

Выполни из корня проекта:

```powershell
git init -b main
git add .
git status
git commit -m "Initial import"
```

Что не попадет в репозиторий:

- `node_modules`, `dist`, `bin`, `obj`, `artifacts`
- содержимое `storage` и локальные файлы данных
- `appsettings.Development.json` и `appsettings.Production.json`
- локальные файлы Visual Studio и `launchSettings.json`

## 2. Создание удаленного репозитория на GitHub

Вариант A: через веб-интерфейс GitHub

1. Создай новый пустой private-репозиторий.
2. Не добавляй из GitHub `README`, `.gitignore` и `LICENSE`, потому что они уже есть локально.
3. Скопируй URL репозитория.

Далее привяжи локальный репозиторий:

```powershell
git remote add origin https://github.com/<owner>/<repo>.git
git push -u origin main
```

Вариант B: через GitHub CLI

```powershell
gh auth login
gh repo create <repo-name> --private --source . --remote origin --push
```

## 3. Что нужно коммитить

Нужно коммитить:

- исходный код
- `.github/workflows/deploy.yml`
- `scripts/deploy-iis.ps1`
- example-конфиги production
- документацию из `docs`

Не нужно коммитить:

- реальные production-конфиги
- сертификаты
- базы данных из `storage`
- загруженные пользователями файлы
- production-ключи Data Protection

## 4. Как будет срабатывать деплой

Workflow уже настроен на:

- каждый `push` в `main`
- ручной запуск через `Actions -> Deploy Production -> Run workflow`

Обычный рабочий процесс будет таким:

1. создаешь feature-ветку
2. открываешь Pull Request
3. мерджишь в `main`
4. GitHub запускает deploy workflow на self-hosted runner на Windows-сервере
