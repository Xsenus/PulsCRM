# Резервные копии и восстановление

## Что нужно сохранять

| Что | Где | Чем копируется |
|---|---|---|
| База Пульса и база рассылок (SQL Server) | SQL Server (`LegacyDb`, `MailingDb`) | SQL Server: план обслуживания или задание агента (см. ниже) |
| База чата (PostgreSQL) | `pulschat` | `scripts/backup-puls.ps1` → `chat.dump` |
| Вложения чата | `C:/PulsCRMData/chat` | `scripts/backup-puls.ps1` → `files\chat` (дозапись) |
| Файлы рассылок | `C:/PulsCRMData/uploads` | `scripts/backup-puls.ps1` → `files\uploads` (дозапись) |
| Ключи | `C:/PulsCRMData/keys` | `scripts/backup-puls.ps1` → `keys\` в каждой копии |

**Ключи обязательны**: Data Protection (без них не расшифровать сохраненные пароли SMTP), `webpush-vapid.json` (подписки на уведомления), `jwt-signing-key.txt` (без него все выйдут из системы).

## Настройка ежедневной копии (один раз)

На сервере, от администратора, из каталога репозитория:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\register-backup-task.ps1 -At 02:30
```

Скрипт спросит пароль PostgreSQL пользователя `pulschat`, сохранит его в `C:\PulsCRMBackups\pg-password.txt` (доступ — только администраторы и SYSTEM), скопирует `backup-puls.ps1` в `C:\PulsCRMBackups\scripts` и создаст задачу «Puls Next — резервная копия» (ежедневно, от SYSTEM). Проверить сразу:

```powershell
Start-ScheduledTask -TaskName 'Puls Next — резервная копия'
Get-Content C:\PulsCRMBackups\backup.log -Tail 20
```

Параметры: `-BackupRoot` (по умолчанию `C:\PulsCRMBackups`), `-StorageRoot` (`C:\PulsCRMData`), `-KeepDays` (14 — сколько дней хранить копии базы и ключей). `pg_dump` ищется в `C:\Program Files\PostgreSQL\<версия>\bin`. Копии лучше дополнительно уносить с сервера (сетевая папка, внешний диск): `-BackupRoot \\nas\backups\puls`.

Каждая копия — папка `C:\PulsCRMBackups\yyyyMMdd-HHmmss` с `chat.dump`, `keys\` и `backup-info.txt`; вложения и файлы рассылок — общая папка `files\`, куда докопируются новые и измененные файлы. Ошибки — в `backup.log` (строка `ОШИБКА:`) и код выхода 1 (задача планировщика покажет «Последний результат: 0x1»).

## SQL Server

Если резервного копирования баз SQL Server еще нет — план обслуживания в SQL Server Management Studio (Management → Maintenance Plans → Back Up Database Task, полная копия ежедневно) или задание агента:

```sql
BACKUP DATABASE [TestPulsBase] TO DISK = N'C:\PulsCRMBackups\sql\TestPulsBase.bak' WITH INIT, COMPRESSION, CHECKSUM;
```

## Восстановление

1. Остановить пул `PulsCRM.Api` (IIS).
2. **Ключи**: скопировать содержимое `keys\` из нужной копии в `C:\PulsCRMData\keys`.
3. **Вложения и файлы рассылок**: скопировать `files\chat` → `C:\PulsCRMData\chat`, `files\uploads` → `C:\PulsCRMData\uploads`.
4. **База чата** (под суперпользователем `postgres`, база будет пересоздана):

   ```powershell
   psql -U postgres -c "DROP DATABASE IF EXISTS pulschat"
   psql -U postgres -c "CREATE DATABASE pulschat OWNER pulschat ENCODING 'UTF8' TEMPLATE template0"
   pg_restore -U pulschat -d pulschat --no-owner C:\PulsCRMBackups\<папка>\chat.dump
   ```

5. Базы SQL Server — восстановить из `.bak` средствами SQL Server.
6. Запустить пул и проверить «Состояние системы» (меню администратора) и `docs/manual-smoke-test.md`.
