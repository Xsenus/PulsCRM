# Анализ legacy-кода

## Что найдено в архиве

- WinForms + DevExpress 19.1
- .NET Framework 4.5.2
- ORM: DevExpress XPO
- Авторизация: `formLogin.cs`
- Подключение к БД: `cls_Xpo.cs`, `cls_XpoSettings.cs`, `Form2.cs`
- Почта: `Others/form_Mail.cs`
- Вкладка «Работа»: `set_Job`, `formEdit_UserJob.cs`, `form_UsersJob.cs`, `formMain_Orgs.cs`

## Важные выводы

### Авторизация

Legacy login сверяет пароль так:

```csharp
if (o_u.Password != cls_App.GetHashString(txtPassword.Text))
```

А `GetHashString` использует:

```csharp
Encoding.Unicode.GetBytes(password)
MD5CryptoServiceProvider
```

Значит новый сервис должен сохранять полную совместимость с этим алгоритмом.

### Сотрудники

Сотрудники находятся в `set_User`, расширение профиля — в `set_UserInfo`.
Из формы логина также видно, что исключаются уволенные:

- `UserGroup.Name != "Уволенные"`

### Организации

Организации — `set_Org`.
Основные поля email находятся как минимум в:

- `set_OrgInfo.Email`
- `set_OrgInfoOther.ZpEmail`
- `set_OrgInfoOther.F1cEmail`
- `set_OrgInfoOther.SiteEmail`
- `set_OrgInfoOther.RukEmail`
- `set_Contact.Email`

### Вкладка «Работа"

Фактическая сущность — `set_Job`:

- `UserFrom`
- `UserTo`
- `CategoryJob`
- `Task`
- `Org`
- `DateFrom`
- `DateTo`
- `DateCompleted`
- `Message`
- `Comment`

Именно она используется для построения списка заданий по организациям.

### Почта

Текущая реализация крайне базовая:

- `System.Net.Mail`
- SMTP параметры в коде
- без очереди
- без ретраев
- без статистики
- без планировщика

Поэтому новый сервис рассылки нужно было строить как отдельный современный подсервис.
