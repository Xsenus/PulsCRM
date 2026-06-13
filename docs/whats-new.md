# Что нового

## 2026-06-13 - предпросмотр изображений во вложениях кампании

Продолжен инкремент roadmap 4.6 по вложениям редактора письма:

- для вложений с `image/*` появился авторизованный blob-предпросмотр прямо в карточке файла;
- предпросмотр загружается через API-клиент с Bearer-токеном, поэтому не зависит от публичного доступа к файлам;
- object URL очищаются при размонтировании/смене вложений, чтобы не оставлять лишние ресурсы в браузере;
- добавлены helper-тесты определения изображений и компонентные тесты `AttachmentManager` на загрузку превью и игнорирование не-image файлов.

Проверки этого этапа включают frontend-тесты, Playwright smoke-тесты, production-сборку, backend-тесты, backend-сборку, `npm audit`, NuGet vulnerability scan, проверку кодировки и локальную E2E-проверку рассылки против SQL-БД.

## 2026-06-13 - стартовый шаблон письма кампании

Продолжен инкремент roadmap 4.5 по редактору письма:

- в редакторе письма появилась кнопка "Вставить шаблон" для пустой HTML/text версии;
- шаблон заполняет HTML и plain text согласованным стартовым текстом, чтобы письмо не начиналось с пустого textarea;
- кнопка блокируется, если письмо уже заполнено, чтобы не затереть пользовательский текст;
- добавлены unit-тесты helper'а шаблона и Playwright smoke на вставку шаблона в редакторе кампании.

Проверки этого этапа включают frontend-тесты, Playwright smoke-тесты, production-сборку, backend-тесты, backend-сборку, `npm audit`, NuGet vulnerability scan, проверку кодировки и локальную E2E-проверку рассылки против SQL-БД.

## 2026-06-13 - источники получателей в preview кампании

Продолжен инкремент roadmap 4.4 по получателям рассылки:

- предпросмотр получателей теперь группирует найденные адреса по источникам;
- оператор видит, сколько адресов пришло из ручного списка, основного email организации, контактов и других источников;
- добавлен helper `buildRecipientSourceSummary` с unit-тестами для порядка, счётчиков и неизвестных кодов источника;
- Playwright smoke редактора кампании проверяет реальные коды источников preview и наличие summary в интерфейсе.

Проверки этого этапа включают frontend-тесты, Playwright smoke-тесты, production-сборку, backend-тесты, backend-сборку, `npm audit`, NuGet vulnerability scan, проверку кодировки и локальную E2E-проверку рассылки против SQL-БД.

## 2026-06-13 - сводка получателей кампании

Продолжен инкремент roadmap 4.4 по получателям рассылки:

- блок выбора организаций в кампании теперь показывает сводку выбранных получателей;
- оператор сразу видит число выбранных организаций, известных email, организаций с email, организаций без email и контактов;
- расчёт сводки вынесен в отдельный helper, чтобы не смешивать UI и бизнес-логику;
- добавлены unit-тесты расчёта и компонентный тест отображения сводки в `OrganizationPicker`.

Проверки этого этапа включают frontend-тесты, Playwright smoke-тесты, production-сборку, backend-тесты, backend-сборку, `npm audit`, NuGet vulnerability scan, проверку кодировки и локальную E2E-проверку рассылки против SQL-БД.

## 2026-06-13 - быстрые фильтры рассылок

Продолжен инкремент roadmap 4.1 по списку рассылок:

- список рассылок получил быстрые кнопки фильтрации по статусам без обязательного нажатия "Применить";
- старый select статуса оставлен как дополнительный контрол для привычного сценария работы;
- responsive-разметка фильтров адаптирована под desktop, tablet и mobile без горизонтального overflow;
- Playwright smoke-тест проверяет, что быстрый фильтр отправляет в API корректный query-параметр `status` и очищает его при выборе "Все".

Проверки этого этапа включают frontend-тесты, Playwright smoke-тесты, production-сборку, backend-тесты, backend-сборку, `npm audit`, NuGet vulnerability scan, проверку кодировки и локальную E2E-проверку рассылки против SQL-БД.

## 2026-06-13 - предупреждение о несохраненных изменениях организации

Продолжен инкремент roadmap 3.5 по уточнению сценариев карточки организации:

- при попытке вернуться к списку организаций с измененным draft теперь открывается модальное предупреждение;
- пользователь может остаться в карточке или выйти без сохранения с явным подтверждением;
- добавлен `beforeunload` guard для обновления/закрытия вкладки браузера при несохраненных изменениях;
- Playwright smoke карточки организации расширен сценарием изменения поля, отмены выхода и подтвержденного выхода к списку.

Проверки этого этапа включают frontend-тесты, Playwright responsive smoke-тесты, production-сборку, backend-тесты, backend-сборку, `npm audit`, NuGet vulnerability scan, проверку кодировки и локальную E2E-проверку рассылки против SQL-БД.

## 2026-06-13 - layout карточки организации

Продолжен инкремент roadmap 3.4 по переработке layout карточки организации:

- вкладки карточки перенесены внутрь основной колонки, чтобы desktop-разметка работала как связка "форма 70% / summary 30%";
- sidebar организации на tablet/mobile поднимается над вкладками и больше не занимает боковую колонку рядом с формой;
- responsive CSS для карточки организации уплотнен на мобильной ширине без горизонтального overflow;
- добавлен Playwright smoke-тест карточки организации на desktop/tablet/mobile: проверяется 70/30 layout, порядок sidebar перед вкладками и отсутствие горизонтального overflow.

Проверки этого этапа включают frontend-тесты, Playwright responsive smoke-тесты, production-сборку, backend-тесты, backend-сборку, `npm audit`, NuGet vulnerability scan, проверку кодировки и локальную E2E-проверку рассылки против SQL-БД.

## 2026-06-13 - центральная область карточки организации

Продолжен инкремент roadmap 3.3 по разделению `OrganizationRecordWorkspace`:

- центральная область вкладок вынесена в `components/organization/OrganizationRecordMain.tsx`;
- profile, support, relations и history теперь выбираются в controlled-компоненте, а workspace только передает активные вкладки и callbacks;
- пустые состояния для связей и истории до сохранения организации перенесены из workspace в новый компонент;
- добавлены компонентные тесты на рендер profile/support-вкладок и пустые состояния relations/history.

Проверки этого этапа включают frontend-тесты, Playwright responsive smoke-тесты, production-сборку, backend-тесты, backend-сборку, `npm audit`, NuGet vulnerability scan, проверку кодировки и локальную E2E-проверку рассылки против SQL-БД.

## 2026-06-13 - профиль организации

Продолжен инкремент roadmap 3.3 по разделению `OrganizationRecordWorkspace`:

- profile-вкладка вынесена в `components/organization/OrganizationProfileSection.tsx`;
- основные реквизиты, контакты, данные руководителя и legacy-заметки больше не собираются напрямую в основном workspace;
- `OrganizationRecordWorkspace` оставлен композиционным слоем для переключения вкладок и боковой панели;
- добавлены компонентные тесты на рендер profile-вкладки и проброс изменений формы в родительский draft-handler.

Проверки этого этапа включают frontend-тесты, Playwright responsive smoke-тесты, production-сборку, backend-тесты, backend-сборку, `npm audit`, NuGet vulnerability scan, проверку кодировки и локальную E2E-проверку рассылки против SQL-БД.

## 2026-06-12 - секция поддержки организации

Продолжен инкремент roadmap 3.3 по разделению `OrganizationRecordWorkspace`:

- support-вкладка вынесена в `components/organization/OrganizationSupportSection.tsx`;
- вычисление статусов лицензий 1С/сайта и summary-карточек поддержки больше не находится в основном workspace;
- `OrganizationRecordWorkspace` больше не содержит JSX support-блоков и связанных helper'ов дат/лицензий;
- добавлены компонентные тесты на summary-карточки, статусы лицензий, все support-блоки и пустое состояние без сохранённых деталей.

Проверки этого этапа включают frontend-тесты, Playwright responsive smoke-тесты, production-сборку, backend-тесты, backend-сборку, `npm audit`, NuGet vulnerability scan, проверку кодировки и локальную E2E-проверку рассылки против SQL-БД.

## 2026-06-12 - секция связей организации

Продолжен инкремент roadmap 3.3 по разделению `OrganizationRecordWorkspace`:

- overview-карточки и таблица связанных записей объединены в `components/organization/OrganizationRelationsSection.tsx`;
- построение preview-данных контактов, документов, договоров, реализаций, лицензий и заказов вынесено из основного workspace;
- `OrganizationRecordWorkspace` больше не содержит helper'ы форматирования сумм и preview-элементов связей;
- добавлены компонентные тесты на preview-карточки, активную таблицу, переключение вкладок и пустое состояние.

Проверки этого этапа включают frontend-тесты, Playwright responsive smoke-тесты, production-сборку, backend-тесты, backend-сборку, `npm audit`, NuGet vulnerability scan, проверку кодировки и локальную E2E-проверку рассылки против SQL-БД.

## 2026-06-12 - история организации

Продолжен инкремент roadmap 3.3 по разделению `OrganizationRecordWorkspace`:

- вкладка истории вынесена в `components/organization/OrganizationHistoryWorkspace.tsx`;
- режим отображения событий и активный снимок 1С теперь управляются внутри компонента истории;
- основной workspace больше не содержит inline-таблицу событий, timeline/snapshot/audit ветвление и связанные импорты;
- добавлены компонентные тесты на переключение событий из ленты в таблицу, выбор снимка 1С, пустое состояние снимков и аудит.

Проверки этого этапа включают frontend-тесты, Playwright responsive smoke-тесты, production-сборку, backend-тесты, backend-сборку, `npm audit`, NuGet vulnerability scan, проверку кодировки и локальную E2E-проверку рассылки против SQL-БД.

## 2026-06-12 - таблицы связей организации

Продолжен инкремент roadmap 3.3 по разделению `OrganizationRecordWorkspace`:

- вкладка связанных данных вынесена в `components/organization/OrganizationRelationsWorkspace.tsx`;
- таблицы контактов, документов, договоров, реализаций, лицензий и заказов больше не находятся inline в основном workspace;
- тип настроек колонок вынесен рядом с компонентом связей и переиспользуется родителем;
- добавлены компонентные тесты на выбор активной таблицы, пустое состояние, даты, суммы, boolean-статусы и статус передачи договора в 1С.

Проверки этого этапа включают frontend-тесты, Playwright responsive smoke-тесты, production-сборку, backend-тесты, backend-сборку, `npm audit`, NuGet vulnerability scan, проверку кодировки и локальную E2E-проверку рассылки против SQL-БД.

## 2026-06-12 - поддержка 1С, сайта и программных блоков организации

Продолжен инкремент roadmap 3.3 по разделению `OrganizationRecordWorkspace`:

- блок `1С` вынесен в `components/organization/OrganizationOneCDetails.tsx`;
- блок `Сайт` вынесен в `components/organization/OrganizationSiteDetails.tsx`;
- блок `Блоки программ` вынесен в `components/organization/OrganizationProgramBlocks.tsx`;
- основной workspace больше не содержит JSX этих support-секций, их ссылочных helper'ов и вычисления programCards;
- добавлены компонентные тесты на заполненные данные, пустые состояния, boolean/zero-значения, статус лицензий и нестандартные программные блоки.

Проверки этого этапа включают frontend-тесты, Playwright responsive smoke-тесты, production-сборку, backend-тесты, backend-сборку, `npm audit`, NuGet vulnerability scan, проверку кодировки и локальную E2E-проверку рассылки против SQL-БД.

## 2026-06-12 - зарплатный блок организации

Продолжен инкремент roadmap 3.3 по разделению `OrganizationRecordWorkspace`:

- блок `Зарплата` вынесен в `components/organization/OrganizationSalaryDetails.tsx`;
- основной workspace больше не содержит JSX зарплатных реквизитов, контактных ссылок и комментариев;
- добавлены компонентные тесты на заполненные данные, пустое состояние, boolean-значения и нулевые счетчики.

Проверки этого этапа включают frontend-тесты, Playwright responsive smoke-тесты, production-сборку, backend-тесты, backend-сборку, `npm audit`, NuGet vulnerability scan, проверку кодировки и локальную E2E-проверку рассылки против SQL-БД.

## 2026-06-12 - банковские реквизиты организации

Продолжен инкремент roadmap 3.3 по разделению `OrganizationRecordWorkspace`:

- блок `ЭЦП и банковские реквизиты` вынесен в `components/organization/OrganizationBankDetails.tsx`;
- основной workspace больше не содержит JSX сетки банковских реквизитов и комментариев ЭЦП;
- добавлены компонентные тесты на заполненные реквизиты, пустое состояние и trim whitespace-only значений.

Проверки этого этапа включают frontend-тесты, Playwright responsive smoke-тесты, production-сборку, backend-тесты, backend-сборку, `npm audit`, NuGet vulnerability scan, проверку кодировки и локальную E2E-проверку рассылки против SQL-БД.

## 2026-06-12 - legacy-заметки организации

Продолжен инкремент roadmap 3.3 по разделению `OrganizationRecordWorkspace`:

- блок `Legacy-заметки` вынесен в `components/organization/OrganizationLegacyNotes.tsx`;
- основной workspace больше не содержит JSX списка legacy-комментариев профиля и только передает детали организации;
- добавлены компонентные тесты на заполненные заметки, пустое состояние и trim whitespace-only значений.

Проверки этого этапа включают frontend-тесты, Playwright responsive smoke-тесты, production-сборку, backend-тесты, backend-сборку, `npm audit`, NuGet vulnerability scan, проверку кодировки и локальную E2E-проверку рассылки против SQL-БД.

## 2026-06-12 - реквизиты руководителя организации

Продолжен инкремент roadmap 3.3 по разделению `OrganizationRecordWorkspace`:

- блок `Руководитель и служебные реквизиты` вынесен в `components/organization/OrganizationDirectorDetails.tsx`;
- основной workspace больше не содержит JSX карточек руководителя и только передает детали организации в профильную вкладку;
- добавлены компонентные тесты на заполненные реквизиты, fallback-значения, кликабельный телефон и email-ссылку.

Проверки этого этапа включают frontend-тесты, Playwright responsive smoke-тесты, production-сборку, backend-тесты, backend-сборку, `npm audit`, NuGet vulnerability scan, проверку кодировки и локальную E2E-проверку рассылки против SQL-БД.

## 2026-06-12 - аудит карточки организации

Продолжен инкремент roadmap 3.3 по разделению `OrganizationRecordWorkspace`:

- блок аудита и сводных счетчиков карточки организации вынесен в `components/organization/OrganizationAuditSummary.tsx`;
- основной workspace больше не содержит JSX для audit-tab и только передает данные организации и число email-адресов;
- добавлены компонентные тесты на авторов аудита, счетчики связанных сущностей и пустое состояние без загруженных деталей.

Проверки этого этапа включают frontend-тесты, Playwright responsive smoke-тесты, production-сборку, backend-тесты, backend-сборку, `npm audit`, NuGet vulnerability scan, проверку кодировки и локальную E2E-проверку рассылки против SQL-БД.

## 2026-06-12 - детали снимка 1С организации

Продолжен инкремент roadmap 3.3 по разделению `OrganizationRecordWorkspace`:

- сетка реквизитов выбранного снимка 1С вынесена в `components/organization/OrganizationSnapshotDetails.tsx`;
- пустое состояние выбранного снимка теперь живет рядом с компонентом деталей, а основной workspace только выбирает активный снимок;
- добавлены компонентные тесты на заполненный снимок, частичные данные, кликабельный телефон и пустое состояние.

Проверки этого этапа включают frontend-тесты, Playwright responsive smoke-тесты, production-сборку, backend-тесты, backend-сборку, `npm audit`, NuGet vulnerability scan, проверку кодировки и локальную E2E-проверку рассылки против SQL-БД.

## 2026-06-12 - вкладки снимков 1С организации

Продолжен инкремент roadmap 3.3 по разделению `OrganizationRecordWorkspace`:

- переключатель снимков 1С вынесен в `components/organization/OrganizationSnapshotTabs.tsx`;
- для вкладок снимков добавлен отдельный UI-контракт `OrganizationSnapshotTabItem`;
- `OrganizationRecordWorkspace` больше не содержит JSX tab-кнопок снимков и только передает список, активный ключ и callback выбора;
- добавлены компонентные тесты на активное состояние, callback выбора снимка и пустой список вкладок.

Проверки этого этапа включают frontend-тесты, Playwright responsive smoke-тесты, production-сборку, backend-тесты, backend-сборку, `npm audit`, NuGet vulnerability scan, проверку кодировки и локальную E2E-проверку рассылки против SQL-БД.

## 2026-06-12 - режим просмотра событий организации

Продолжен инкремент roadmap 3.3 по разделению `OrganizationRecordWorkspace`:

- переключатель режима событий `Лента / Таблица` вынесен в `components/organization/OrganizationEventViewModeTabs.tsx`;
- тип `OrganizationEventViewMode` переехал рядом с UI-компонентом режима просмотра;
- `OrganizationRecordWorkspace` больше не содержит JSX tab-кнопок режима событий и только передает активный режим;
- добавлены компонентные тесты на активное состояние и callback выбора режима просмотра событий.

Проверки этого этапа включают frontend-тесты, Playwright responsive smoke-тесты, production-сборку, backend-тесты, backend-сборку, `npm audit`, NuGet vulnerability scan, проверку кодировки и локальную E2E-проверку рассылки против SQL-БД.

## 2026-06-12 - вкладки истории организации

Продолжен инкремент roadmap 3.3 по разделению `OrganizationRecordWorkspace`:

- переключатель `События / Снимки 1С / Аудит` вынесен в `components/organization/OrganizationHistoryTabs.tsx`;
- тип `OrganizationHistoryTab` переехал рядом с компонентом вкладок истории;
- `OrganizationRecordWorkspace` больше не содержит JSX верхнего переключателя истории и только передает активную вкладку;
- добавлены компонентные тесты на полный набор вкладок, активное состояние и callback выбора вкладки истории.

Проверки этого этапа включают frontend-тесты, Playwright responsive smoke-тесты, production-сборку, backend-тесты, backend-сборку, `npm audit`, NuGet vulnerability scan, проверку кодировки и локальную E2E-проверку рассылки против SQL-БД.

## 2026-06-12 - overview связанных данных организации

Продолжен инкремент roadmap 3.3 по разделению `OrganizationRecordWorkspace`:

- блок preview-карточек и tab-переключателя раздела `Связи` вынесен в `components/organization/OrganizationRelationsOverview.tsx`;
- тип `OrganizationRelationTab` переехал рядом с UI-контрактом связанных данных;
- `OrganizationRecordWorkspace` больше не содержит JSX сетки preview-карточек и inline tab-кнопок связанных записей;
- добавлены компонентные тесты на активное состояние, пустые preview-данные и callback выбора раздела через карточки и вкладки.

Проверки этого этапа включают frontend-тесты, Playwright responsive smoke-тесты, production-сборку, backend-тесты, backend-сборку, `npm audit`, NuGet vulnerability scan, проверку кодировки и локальную E2E-проверку рассылки против SQL-БД.

## 2026-06-11 - status bar карточки организации

Продолжен инкремент roadmap 3.3 по разделению `OrganizationRecordWorkspace`:

- верхняя status bar карточки организации вынесена в `components/organization/OrganizationStatusBar.tsx`;
- бейджи видимости, признака менеджера, района, типа, статуса, флага и состояния сохранения теперь изолированы от основного workspace;
- `OrganizationRecordWorkspace` передает в status bar только готовые значения и больше не содержит JSX этого блока;
- добавлены компонентные тесты на полный набор бейджей, скрытие необязательных бейджей и dirty-состояние формы.

Проверки этого этапа включают frontend-тесты, Playwright responsive smoke-тесты, production-сборку, backend-тесты, backend-сборку, `npm audit`, NuGet vulnerability scan, проверку кодировки и локальную E2E-проверку рассылки против SQL-БД.

## 2026-06-11 - summary сопровождения организации

Продолжен инкремент roadmap 3.3 по разделению `OrganizationRecordWorkspace`:

- summary-карточки раздела `Сопровождение` вынесены в `components/organization/OrganizationSupportSummary.tsx`;
- добавлен тип `OrganizationSupportSummaryItem` для UI-контракта карточек сопровождения;
- `OrganizationRecordWorkspace` оставляет расчет `supportCards`, но больше не содержит JSX summary-сетки;
- добавлены компонентные тесты на tone-классы, тексты карточек и пустой список summary.

Проверки этого этапа включают frontend-тесты, Playwright responsive smoke-тесты, production-сборку, backend-тесты, backend-сборку, `npm audit`, NuGet vulnerability scan, проверку кодировки и локальную E2E-проверку рассылки против SQL-БД.

## 2026-06-11 - навигация вкладок карточки организации

Продолжен инкремент roadmap 3.3 по разделению `OrganizationRecordWorkspace`:

- основная навигация вкладок карточки организации вынесена в `components/organization/OrganizationViewTabs.tsx`;
- тип `OrganizationViewTab` переехал рядом с компонентом навигации;
- `OrganizationRecordWorkspace` больше не содержит JSX основных tab-кнопок и остается координатором активной вкладки;
- добавлены компонентные тесты на полный набор вкладок, активное состояние и callback выбора вкладки;
- стабилизирован `smoke-mailing-e2e.ps1`: временная кампания создается в статусе `Paused`, чтобы ручной smoke-run не конкурировал с автоматическим планировщиком.

Проверки этого этапа включают frontend-тесты, Playwright responsive smoke-тесты, production-сборку, backend-тесты, backend-сборку, `npm audit`, NuGet vulnerability scan, проверку кодировки и локальную E2E-проверку рассылки против SQL-БД.

## 2026-06-11 - лента событий карточки организации

Продолжен инкремент roadmap 3.3 по разделению `OrganizationRecordWorkspace`:

- `EventTimeline` вынесен из workspace в компонент `components/organization/OrganizationEventTimeline.tsx`;
- форматирование дат, сумм, статусов и пустого состояния ленты событий теперь находится рядом с компонентом истории;
- `OrganizationRecordWorkspace` больше не содержит JSX ленты событий и использует новый компонент в режиме `Лента`;
- добавлены компонентные тесты на заполненную ленту, fallback-заголовки, метаданные, период, лицензионные чипы и empty state.

Проверки этого этапа включают frontend-тесты, Playwright responsive smoke-тесты, production-сборку, backend-тесты, backend-сборку, `npm audit`, NuGet vulnerability scan, проверку кодировки и локальную E2E-проверку рассылки против SQL-БД.

## 2026-06-11 - sidebar карточки организации

Продолжен инкремент roadmap 3.3 по разделению `OrganizationRecordWorkspace`:

- блок `organization-record-sidebar` вынесен в отдельный компонент `components/organization/OrganizationSidebar.tsx`;
- паспорт организации, статусы, финансовые метрики, быстрые переходы, почтовые адреса, задачи и контекст карточки теперь изолированы от координатора вкладок;
- `OrganizationRecordWorkspace` передает в sidebar только данные, email-чипы и обработчики переходов к связанным данным/истории;
- добавлены компонентные тесты sidebar на паспортные поля, нормализацию ссылок `tel`/`https`, email-чипы, быстрые действия и пустые состояния.

Проверки этого этапа включают frontend-тесты, Playwright responsive smoke-тесты, production-сборку, backend-тесты, backend-сборку, `npm audit`, NuGet vulnerability scan, проверку кодировки и локальную E2E-проверку рассылки против SQL-БД.

## 2026-06-11 - preview-карточка связей организации

Начат инкремент roadmap 3.3 по разделению большого `OrganizationRecordWorkspace`:

- `RelationPreviewCard` вынесен в отдельный компонент `components/organization/RelationPreviewCard.tsx`;
- тип `PreviewCardItem` переехал вместе с компонентом, чтобы workspace не хранил локальный UI-контракт;
- `OrganizationRecordWorkspace` остался координатором вкладок и использует новый компонент без изменения поведения карточек связей;
- добавлены компонентные тесты на активное состояние, формат счетчика, click-handler и пустое состояние preview-карточки.

Проверки этого этапа включают frontend-тесты, Playwright responsive smoke-тесты, production-сборку, backend-тесты, backend-сборку, `npm audit`, NuGet vulnerability scan, проверку кодировки и локальную E2E-проверку рассылки против SQL-БД.

## 2026-06-11 - badges и мобильные поля OrganizationsTable

Закрыт инкремент roadmap 3.2 по читаемости таблицы организаций:

- колонка `Видимость` теперь отображает состояние организации через общий `StatusBadge`;
- колонка `Управленческая` также переведена на badge-формат для включаемого desktop-поля;
- для мобильной карточки организаций явно заданы labels для `ИНН`, района, типа, email-счетчика и количества контактов;
- служебные desktop-поля `Видимость` и `Управленческая` не попадают в мобильную карточку, даже если пользователь включил их в настройках таблицы;
- добавлен компонентный тест `OrganizationsTable` на читаемую мобильную карточку, счетчики, действия и badge-рендер скрытых колонок.

Проверки этого этапа включают frontend-тесты, Playwright responsive smoke-тесты, production-сборку, backend-тесты, backend-сборку, `npm audit`, NuGet vulnerability scan, проверку кодировки и локальную E2E-проверку рассылки против SQL-БД.

## 2026-06-11 - режимы отображения DataTable

Закрыт инкремент roadmap 2.2 по mobile/tablet strategy для `DataTable`:

- добавлен явный `displayMode`: `auto`, `table`, `cards`;
- режим `auto` сохраняет текущее поведение: desktop показывает таблицу, мобильная ширина показывает карточки;
- режим `cards` больше не применяет пользовательские table-настройки видимости/ширины колонок к мобильной карточке;
- карточки строятся по `isPrimary`, `isActions`, `mobileLabel`, `mobileVisible` и `priority`, а настройки колонок остаются контрактом desktop-таблицы;
- добавлены компонентные тесты на принудительный `cards`/`table` режим и независимость карточек от сохраненной видимости колонок.

Проверки этого этапа включают frontend-тесты, Playwright responsive smoke-тесты, production-сборку, backend-тесты, backend-сборку, `npm audit`, NuGet vulnerability scan, проверку кодировки и локальную E2E-проверку рассылки против SQL-БД.

## 2026-06-11 - compact pagination для мобильных экранов

Закрыт инкремент roadmap 7.4 по компактной пагинации:

- `Pagination` получил отдельный мобильный режим с кнопками `Назад`, `Вперед` и стабильным счетчиком `N из M`;
- desktop-режим с быстрым переходом на первую/последнюю страницу и номерами страниц сохранен без изменения поведения;
- на мобильной ширине длинный список номеров страниц больше не участвует в раскладке и не распирает страницу;
- добавлен компонентный тест на compact-навигацию и отсутствие page-number кнопок внутри compact-блока.

Проверки этого этапа включают frontend-тесты, Playwright responsive smoke-тесты, production-сборку, backend-тесты, backend-сборку, `npm audit`, NuGet vulnerability scan, проверку кодировки и локальную E2E-проверку рассылки против SQL-БД.

## 2026-06-11 - понятная ошибка недоступности API на входе

Закрыта задача `UX: улучшить Network Error на LoginPage`:

- добавлен общий formatter API-ошибок `getApiErrorMessage`;
- `api.ts` и `LoginPage` используют единые тексты для сетевой недоступности, timeout и сообщений backend;
- форма входа больше не показывает технический `Network Error`, если API недоступен или запрос оборвался;
- добавлены unit-тесты formatter и Playwright smoke-сценарий для сетевой ошибки логина.

Проверки этого этапа включают backend-тесты, frontend-тесты, Playwright smoke-тесты, production-сборку, `npm audit`, NuGet vulnerability scan, проверку кодировки и локальную E2E-проверку рассылки против SQL-БД.

## 2026-06-11 - единые иконки действий

Закрыт следующий инкремент roadmap 7.3 по унификации action controls:

- добавлен общий компонент `ActionIcon` для поиска, сброса, обновления, возврата назад, меню действий, стрелок пагинации и раскрытия списка;
- `SearchPanel`, `RowActionsMenu`, `Pagination`, dashboard, карточки сотрудников и организаций переведены с локальных SVG на общий набор иконок;
- страницы больше не импортируют иконки из `SearchPanel` ради отдельных action-кнопок;
- добавлен unit-тест, который фиксирует декоративный SVG-контракт и поддержку всех вариантов иконок.

Проверки этого этапа включают backend-тесты, frontend-тесты, Playwright smoke-тесты, production-сборку, `npm audit`, NuGet vulnerability scan, проверку кодировки и локальную E2E-проверку рассылки против SQL-БД.

## 2026-06-11 - responsive smoke рабочих экранов

Закрыт следующий инкремент roadmap 7.2 по проверке основных экранов на типовых ширинах:

- добавлен Playwright smoke-тест `workspace-responsive-smoke.spec.ts` для dashboard, сотрудников, организаций, рассылок, очереди рассылок и настроек;
- каждый экран проверяется на 360, 390, 768, 1024, 1366 и 1920 px без горизонтального overflow документа;
- тест использует мокированные API-ответы и авторизованную сессию, поэтому не зависит от текущих данных пользователя;
- исправлен планшетный layout очереди рассылок: сводные карточки и панель фильтров перестраиваются до того, как начинают распирать страницу.

Проверки этого этапа включают backend-тесты, frontend-тесты, Playwright smoke-тесты, production-сборку, `npm audit`, NuGet vulnerability scan, проверку кодировки и локальную E2E-проверку рассылки против SQL-БД.

## 2026-06-11 - проверка Data Protection для SMTP-секретов

Закрыт следующий инкремент roadmap 5.5 по Data Protection и секретам:

- `GET /api/diagnostics/storage` теперь возвращает блок `Secrets` с результатом protect/unprotect round-trip через текущий Data Protection provider;
- общий статус диагностики становится `error`, если каталог ключей/загрузок доступен, но Data Protection не может корректно зашифровать и расшифровать probe-секрет;
- добавлен backend unit-тест, который защищает SMTP-пароль одним provider, пересоздает provider на той же папке ключей и проверяет расшифровку после условного restart/deploy.

Проверки этого этапа включают backend-тесты, frontend-тесты, Playwright smoke-тесты, production-сборку, `npm audit`, NuGet vulnerability scan, проверку кодировки и локальную E2E-проверку рассылки против SQL-БД.

## 2026-06-11 - recovery очереди без полного чтения dispatch items

Продолжена работа над roadmap 5.4 и оптимизацией очереди рассылок:

- `RecoverStuckItemsAsync` больше не читает всю таблицу `MailDispatchItem`: зависшие `Processing` и просроченные queue reservations выбираются через `XPQuery` по статусам и временным порогам;
- `QueueDueItemsAsync` переносит фильтр статуса и due-date ближе к БД, сохраняя in-memory проверку `ChannelQueuedAtUtc` только для sentinel-значения `DateTime.MinValue`;
- добавлен backend unit-тест `DispatchServiceRecoveryTests` на возврат зависшего `Processing`, освобождение просроченной reservation и постановку due items в in-memory channel без повторной резервации свежих/будущих элементов.

Проверки этого этапа включают backend-тесты, frontend-тесты, Playwright smoke-тесты, production-сборку, `npm audit`, NuGet vulnerability scan, проверку кодировки и локальную E2E-проверку рассылки против SQL-БД.

## 2026-06-11 - проверки удаления без полного чтения таблиц

Продолжена оптимизация backend-запросов из roadmap 5.2:

- проверки удаления SMTP-профиля, legacy-организации с задачами и legacy-организации, выбранной в целях кампаний, перенесены с `ToList().Any(...)` на query-level `XPQuery.Any(...)`;
- поведение защитных проверок сохранено: связанные SMTP-профили и организации по-прежнему нельзя удалить, пока они используются;
- добавлен backend unit-тест `DeletionGuardTests` для защитных сценариев удаления профиля и организации.

Проверки этого этапа включают backend-тесты, frontend-тесты, Playwright smoke-тесты, production-сборку, `npm audit`, NuGet vulnerability scan, проверку кодировки и локальную проверку API против SQL-БД.

## 2026-06-11 - dashboard-сводка без лишнего чтения таблиц

Продолжена оптимизация backend-запросов из roadmap 5.2:

- счетчики организаций, активных кампаний, глубины очереди, отправленных и ошибочных сообщений за 24 часа в dashboard перенесены на `XPQuery.Count`;
- фильтр сотрудников по legacy-группе "Уволенные" оставлен с прежней case-insensitive логикой, чтобы не менять бизнес-результат;
- добавлен backend unit-тест `OverviewServiceTests` на сводные показатели dashboard из legacy и mailing-хранилищ.

Проверки этого этапа включают backend-тесты, frontend-тесты, Playwright smoke-тесты, production-сборку, `npm audit`, NuGet vulnerability scan, проверку кодировки и локальную проверку API против SQL-БД.

## 2026-06-11 - статистика кампаний без полного чтения очереди

Продолжена оптимизация backend-запросов рассылок:

- статистика `/api/campaigns/{id}/stats` больше не выгружает все партии и элементы очереди перед фильтром кампании;
- фильтр `campaignId` для `MailDispatchBatch` и `MailDispatchItem` перенесен на `XPQuery`, а существующая логика счетчиков и последних записей сохранена;
- добавлены backend unit-тесты `StatisticsServiceTests`, которые проверяют, что статистика, failed/deferred списки и последние элементы не подмешивают данные другой кампании.

Проверки этого этапа включают backend-тесты, frontend-тесты, Playwright smoke-тесты, production-сборку, `npm audit`, NuGet vulnerability scan, проверку кодировки и локальный E2E smoke против API и SQL-БД.

## 2026-06-11 - фильтры списка кампаний ближе к БД

Продолжена оптимизация списков из roadmap 5.2:

- список `/api/campaigns` больше не выгружает все кампании перед обычной фильтрацией и пагинацией;
- фильтр статуса, `totalCount`, сортировка и `Skip/Take` для списка кампаний перенесены на `XPQuery`;
- текстовый поиск оставлен in-memory, чтобы сохранить case-insensitive поиск по названию, теме, cron и имени SMTP-профиля без риска SQL-трансляции;
- добавлены backend unit-тесты `CampaignServiceTests` на статусный фильтр, paging, `totalCount` и поиск по SMTP-профилю.

Проверки этого этапа включают backend-тесты, frontend-тесты, Playwright smoke-тесты, production-сборку, `npm audit`, NuGet vulnerability scan, проверку кодировки и локальную проверку API против SQL-БД.

## 2026-06-11 - фильтры диагностики очереди ближе к БД

Продолжена работа по снижению риска `ToList()` до фильтрации и пагинации:

- `/api/dispatch/items` теперь применяет простые фильтры по статусу, кампании и партии на `XPQuery` до материализации списка;
- `/api/dispatch/batches` применяет фильтр кампании, сортировку, `Skip/Take` и подсчет `totalCount` на запросе к хранилищу;
- текстовый поиск элементов очереди оставлен in-memory, чтобы сохранить case-insensitive поиск по нескольким nullable-полям без риска сломать SQL-трансляцию;
- добавлены backend unit-тесты `DispatchDiagnosticsServiceTests` на фильтрацию, paging и корректный `totalCount`.

Проверки этого этапа включают backend-тесты, frontend-тесты, Playwright smoke-тесты, production-сборку, `npm audit`, NuGet vulnerability scan, проверку кодировки и локальную проверку API против SQL-БД.

## 2026-06-11 - ручной smoke-чеклист после deploy

Добавлен `docs/manual-smoke-test.md` - единый ручной checklist для проверки PulsCRM после локального запуска, IIS deploy или rollback:

- зафиксированы фактические URL frontend/API, SQL Server, БД, commit и итог проверки;
- описаны шаги для healthcheck, логина, dashboard, сотрудников, организаций, SMTP-профилей, кампаний, очереди рассылок и адаптивности;
- добавлены команды для `smoke-iis.ps1`, `check-mailing-db.ps1` и `smoke-mailing-e2e.ps1`;
- отдельный блок проверяет desktop/tablet/mobile ширины и типовые проблемы верстки: горизонтальный скролл, наезд текста, меню действий и пагинацию;
- Playwright smoke больше не переиспользует случайный локальный сервер на тестовом порту и запускает собственный Vite с `--strictPort`;
- `docs/README.md` дополнен ссылкой на новый checklist.

Проверки этого этапа включают backend-тесты, frontend-тесты, Playwright smoke-тесты, production-сборку, parser-проверку PowerShell-скриптов, `npm audit`, NuGet vulnerability scan, проверку кодировки и локальный E2E smoke против API и SQL-БД.

## 2026-06-11 - E2E smoke реальной отправки рассылки

Добавлен проверяемый сценарий ручной end-to-end приемки рассылок:

- новый `scripts/smoke-mailing-e2e.ps1` поднимает локальный SMTP-catcher на loopback-порту;
- скрипт создает временный SMTP-профиль, временную кампанию с ручным получателем и запускает manual run через API;
- проверяется readiness кампании, создание dispatch batch, получение письма SMTP-catcher'ом и статистика кампании `sent >= 1`;
- после успешной проверки временная кампания, SMTP-профиль и captured `.eml` удаляются, чтобы локальная тестовая БД не засорялась;
- для разбора неуспешного сценария добавлен `-KeepArtifacts`;
- IIS-гайд дополнен командами запуска E2E smoke локально через dev JWT и на сервере через логин/пароль.

Проверки этого этапа включают parser-проверку PowerShell-скрипта, локальный E2E smoke против API и SQL-БД, backend-тесты, frontend-тесты, Playwright smoke-тесты, production-сборку, `npm audit`, NuGet vulnerability scan и проверку кодировки.

## 2026-06-10 - проверка БД после IIS deploy

Добавлен read-only SQL-check для проверки состояния модуля рассылок после деплоя:

- новый `scripts/check-mailing-db.ps1` читает `MailingDb` из `appsettings.Production.json` или принимает строку подключения напрямую;
- XPO-префикс `XpoProvider=...` автоматически убирается перед подключением через SQL Server provider;
- проверяется наличие ожидаемых таблиц `Mail*`, количество строк в каждой таблице, SMTP-профили, глубина очереди и failed-сообщения;
- workflow `Deploy Production` запускает DB-check после API/frontend smoke;
- IIS-гайд дополнен ручным запуском DB-check и опцией `-RequireTransportProfile` для строгой приемки SMTP-профиля.

Проверки этого этапа включают parser-проверку PowerShell-скриптов, локальный запуск DB-check против SQL-БД, backend-тесты, frontend-тесты, production-сборку, `npm audit`, NuGet vulnerability scan, проверку кодировки и локальную проверку API против SQL-БД.

## 2026-06-10 - backup и rollback IIS deploy

Деплой на IIS получил безопасный путь отката:

- `scripts/deploy-iis.ps1` перед `robocopy /MIR` сохраняет текущие публикации API и frontend в backup-папку;
- backup хранится в формате `yyyyMMdd-HHmmss` с подпапками `Api`, `Web` и `manifest.json`;
- workflow `Deploy Production` использует `DEPLOY_BACKUP_PATH` или значение по умолчанию `C:\Apps\PulsCRM\Backups`;
- добавлен `scripts/rollback-iis.ps1` для ручного восстановления API/Web из выбранного backup;
- backup retention ограничивает хранение пятью последними публикациями;
- IIS-гайд дополнен командами поиска backup-папок и ручного rollback.

Проверки этого этапа включают parser-проверку PowerShell-скриптов, локальный dry-run backup/rollback на временных каталогах, backend-тесты, frontend-тесты, production-сборку, `npm audit`, NuGet vulnerability scan, проверку кодировки и локальную проверку API против SQL-БД.

## 2026-06-10 - smoke-проверка IIS deploy

Добавлена отдельная post-deploy проверка для IIS-публикации:

- новый `scripts/smoke-iis.ps1` проверяет API `/health`, frontend root, frontend bundle и опционально публичный `/api/auth/users?take=1`;
- workflow `Deploy Production` запускает smoke после копирования API/frontend и использует `FRONTEND_URL` для warmup;
- smoke выводит фактические `PRODUCTION_API_URL`, `HEALTHCHECK_URL`, `FRONTEND_URL` и проверяет наличие production-конфига API;
- IIS-гайд дополнен переменной `FRONTEND_URL` и примером ручного запуска smoke-скрипта;
- скрипт локально проверен против API на SQL-БД и frontend dev-сервера.

Проверки этого этапа включают backend-тесты, frontend-тесты, Playwright smoke-тесты, production-сборку, `npm audit`, NuGet vulnerability scan, проверку кодировки и локальную проверку API против SQL-БД.

## 2026-06-10 - e2e smoke формы кампании

Добавлен браузерный smoke-тест для ключевого сценария подготовки рассылки в форме кампании:

- новая кампания открывается с авторизованной сессией и доступным SMTP-профилем;
- заполняются название, тема, SMTP-профиль, HTML/plain text письмо и ручной получатель;
- проверяется API-предпросмотр получателей и отображение найденного email;
- проверяется readiness-блок кампании с положительным результатом готовности;
- проверяется предпросмотр расписания и отсутствие горизонтального overflow страницы;
- общий мок SMTP-профиля вынесен в e2e helpers и переиспользуется в тестах настроек.

Проверки этого этапа включают backend-тесты, frontend-тесты, Playwright smoke-тесты, production-сборку, `npm audit`, NuGet vulnerability scan, проверку кодировки и локальную проверку API против SQL-БД.

## 2026-06-10 - e2e smoke операционных разделов

Расширено браузерное покрытие рабочих разделов, которые критичны для сценария рассылок и эксплуатации:

- добавлен Playwright smoke для списка рассылок `/campaigns` с моками кампании, темы и SMTP-профиля;
- добавлен smoke для `/dispatch`, который проверяет сообщения очереди и переключение на вкладку партий;
- добавлен mobile smoke для `/settings` со списком SMTP-профилей в карточном режиме;
- для SMTP-карточки проверяется отсутствие горизонтального overflow на viewport 390px;
- покрытие Playwright выросло до 11 smoke-сценариев.

Проверки этого этапа включают backend-тесты, frontend-тесты, Playwright smoke-тесты, production-сборку, `npm audit`, NuGet vulnerability scan, проверку кодировки и локальную проверку API против SQL-БД.

## 2026-06-10 - e2e smoke авторизованных списков

Расширены Playwright smoke-тесты для проверки не только страницы входа, но и рабочих CRM-экранов после авторизации:

- добавлены общие e2e helpers для моков авторизации, JSON-ответов и проверки горизонтального переполнения страницы;
- проверяется открытие `/employees` с авторизованной сессией, оболочкой приложения и данными сотрудника;
- проверяется открытие `/organizations` на мобильном viewport с карточным режимом таблицы;
- проверяется, что мобильный список организаций не создает горизонтальный overflow страницы;
- Playwright-артефакты `test-results`, `playwright-report` и `blob-report` исключены из git.

Проверки этого этапа включают backend-тесты, frontend-тесты, Playwright smoke-тесты, production-сборку, `npm audit`, NuGet vulnerability scan, проверку кодировки и локальную проверку API против SQL-БД.

## 2026-06-10 - Playwright smoke-тесты

Добавлен браузерный smoke-слой для проверки критичных фронтенд-сценариев до ручной приемки:

- добавлен `@playwright/test` и npm-скрипт `test:e2e`;
- добавлена проверка страницы входа, ручного ввода логина и пароля;
- защищенный маршрут `/employees` проверяется на редирект неавторизованного пользователя к `/login`;
- ошибка авторизации из API показывается пользователю в форме входа;
- форма входа проверяется на mobile, tablet и desktop viewport без горизонтального переполнения;
- сетевые ответы мокируются в браузере, поэтому smoke-тесты не требуют поднятого API и не меняют локальную SQL-БД.

Проверки этого этапа включают backend-тесты, frontend-тесты, Playwright smoke-тесты, production-сборку, `npm audit`, NuGet vulnerability scan, проверку кодировки и локальную проверку API против SQL-БД.

## 2026-06-10 - тесты настроек таблиц

Расширено frontend-покрытие `DataTable`, чтобы настройки рабочих таблиц не ломались при дальнейшей полировке интерфейса:

- добавлены DOM-тесты открытия панели настроек колонок;
- проверяется загрузка сохраненной видимости колонок из `localStorage`;
- проверяется защита от состояния, где все колонки скрыты;
- покрыто сохранение draft-настроек только после подтверждения;
- покрыт сброс настроек к значениям по умолчанию.

Проверки этого этапа включают backend-тесты, frontend-тесты, production-сборку, `npm audit`, NuGet vulnerability scan, проверку кодировки и локальную проверку API против SQL-БД.

## 2026-06-10 - компонентные frontend-тесты

Расширено frontend-покрытие критичных рабочих контролов CRM:

- добавлен `jsdom` для DOM-тестов Vitest без запуска браузера;
- добавлены компонентные тесты `Pagination` для перехода по страницам и выбора количества строк;
- добавлены компонентные тесты `SearchPanel` для debounce-поиска, сброса и запуска поиска по Enter/кнопке;
- тесты проверяют реальные React-события через `react-dom` render и synthetic events;
- покрытие фронтенда выросло до 10 test files и 35 tests.

Проверки этого этапа включают backend-тесты, frontend-тесты, production-сборку, `npm audit`, NuGet vulnerability scan, проверку кодировки и локальную проверку API против SQL-БД.

## 2026-06-10 - unit-тесты выбора получателей

Расширено backend-покрытие логики формирования аудитории рассылки:

- добавлены unit-тесты `RecipientResolver` для ручного списка email;
- проверяется разбор email через `;`, перенос строки и табуляцию;
- невалидные адреса отбрасываются до постановки в очередь;
- дубликаты email внутри одной организации или ручного списка не попадают в результат повторно;
- покрыт выбор источников организации: основной email, руководитель, зарплата, контакты;
- тесты используют in-memory XPO UnitOfWork и не обращаются к реальной SQL-БД.

Проверки этого этапа включают backend-тесты, frontend-тесты, production-сборку, `npm audit`, NuGet vulnerability scan, проверку кодировки и локальную проверку API против SQL-БД.

## 2026-06-10 - unit-тесты сборки писем

Расширено backend-покрытие сценариев рассылки перед реальной SMTP-отправкой:

- добавлены unit-тесты `MailComposer` для HTML-письма и автоматической plain text версии;
- проверяется формирование отправителя, получателя, reply-to, темы и message id;
- покрыты обычные файловые вложения из `IFileStorageService`;
- покрыты inline-вложения с `Content-ID` для `cid:` изображений;
- XPO-объекты в тестах создаются в изолированной in-memory session, чтобы не загрязнять `Session.DefaultSession`.

Проверки этого этапа включают backend-тесты, frontend-тесты, production-сборку, `npm audit`, NuGet vulnerability scan, проверку кодировки и локальную проверку API против SQL-БД.

## 2026-06-10 - диагностика Data Protection и storage

Добавлена защищенная backend-диагностика серверных каталогов, чтобы после деплоя быстро проверять права API на ключи и файлы:

- появился маршрут `GET /api/diagnostics/storage` под Bearer JWT;
- диагностика проверяет каталоги Data Protection keys и uploads через create/write/read/delete probe-файл;
- публичный `/health` не раскрывает абсолютные пути сервера;
- общий helper путей используется и для диагностики, и для конфигурации Data Protection;
- добавлены unit-тесты на нормализацию путей и проверку записи;
- документация описывает, что потеря ключей Data Protection может сделать сохраненные SMTP-пароли нечитаемыми.

Проверки этого этапа включают backend-тесты, frontend-тесты, production-сборку, `npm audit`, NuGet vulnerability scan, проверку кодировки и локальную проверку API против SQL-БД.

## 2026-06-10 - hardening recovery очереди рассылок

Усилена устойчивость очереди рассылок при рестартах IIS/API и повторной работе scheduler:

- правила retry delay, recovery processing и сброса queue reservation вынесены в тестируемый `DispatchRecoveryPolicy`;
- таймауты `ProcessingTimeoutMinutes` и `QueueReservationTimeoutMinutes` добавлены в конфигурацию `Dispatch`;
- recovery больше не держит магические значения таймаутов внутри сервиса;
- scheduled scheduler перед созданием партии проверяет, нет ли уже партии для той же кампании и того же времени запуска;
- ключ `DispatchKey` формируется через единый helper с нормализацией email;
- добавлены backend unit-тесты для retry backoff, recovery thresholds, queue reservation и scheduled batch guard.

Проверки этого этапа включают backend-тесты, frontend-тесты, production-сборку, `npm audit`, NuGet vulnerability scan, проверку кодировки и локальную проверку API против SQL-БД.

## 2026-06-10 - интерфейс диагностики очереди рассылок

Добавлена операторская страница `/dispatch` для диагностики очереди без прямого доступа к SQL:

- в боковое меню добавлен раздел "Очередь";
- страница показывает сообщения очереди и партии отправки отдельными вкладками;
- добавлены фильтры по статусу, ID кампании, ID партии и поиску по email/организации/ошибке/SMTP-ответу;
- для failed/deferred сообщений доступна повторная постановка в очередь, для неотправленных сообщений - отмена;
- таблицы получили настройки колонок, пагинацию и мобильное карточное отображение;
- добавлены frontend unit-тесты для правил статусов, retry/cancel и построения query.

Проверки этого этапа включают backend-тесты, frontend-тесты, production-сборку, `npm audit`, NuGet vulnerability scan, проверку кодировки, browser smoke и локальную проверку API против SQL-БД.

## 2026-06-10 - админская диагностика очереди рассылок

Добавлен backend API для диагностики очереди рассылок без прямого доступа к SQL:

- появился защищенный контроллер `/api/dispatch`;
- добавлены списки элементов очереди и партий отправки с фильтрами и пагинацией;
- для элементов очереди добавлены операции `retry` и `cancel`;
- frontend API-клиент получил типы и функции для новых диагностических маршрутов;
- обновлена документация `docs/backend-api.md`.

Проверки этого этапа включают backend-тесты, frontend-тесты, production-сборку, `npm audit`, NuGet vulnerability scan, проверку кодировки и локальную проверку API против SQL-БД.

## 2026-06-10 - улучшение статистики очереди рассылок

Продолжена доработка вкладки "Статистика" в карточке кампании:

- stats API теперь отдельно возвращает последние failed и deferred сообщения;
- во вкладку статистики добавлена кнопка ручного обновления;
- добавлена сводка последних проблемных сообщений с текстом ошибки или SMTP-ответом;
- таблица последних сообщений получила фильтры по статусам очереди;
- в таблицу добавлены время постановки в очередь, следующая попытка и SMTP-ответ/message id.

Проверки этого этапа включают backend-тесты, frontend-тесты, production-сборку, `npm audit`, NuGet vulnerability scan, проверку кодировки, browser smoke и локальную проверку API против SQL-БД.

## 2026-06-10 - валидация письма и inline-вложений

Продолжена доработка редактора письма в кампаниях:

- добавлена диагностика HTML/текстовой версии письма прямо во вкладке "Письмо";
- проверяется пустое письмо, отсутствие текстовой версии и слишком короткий plain text;
- проверяются встроенные изображения: пустой `Content-ID`, неиспользованный `cid:` и ссылка на `cid:` без matching inline-файла;
- readiness API теперь тоже учитывает ошибки встроенных изображений и предупреждает о неиспользованных inline-файлах;
- менеджер вложений получил pre-upload проверку размера, понятное отображение `cid:...` и кнопку копирования токена.

Проверки этого этапа включают backend-тесты, frontend-тесты, production-сборку, `npm audit`, NuGet vulnerability scan, проверку кодировки, browser smoke и локальную проверку API против SQL-БД.

## 2026-06-10 - улучшение конструктора расписания кампаний

Продолжена доработка сценария подготовки рассылки:

- часовой пояс новой кампании изменен на `Asia/Novosibirsk`, чтобы дефолт соответствовал локальному окружению проекта;
- выбор типа расписания переведен с выпадающего списка на сегментированные вкладки с кратким описанием режима;
- добавлена inline-валидация расписания: некорректный старт, конец раньше старта, неверные интервалы и базовая форма cron;
- предпросмотр ближайших запусков получил loading state и inline-ошибку рядом с формой;
- логика валидации расписания вынесена в unit-тестируемый helper.

Проверки этого этапа включают backend-тесты, frontend-тесты, production-сборку, `npm audit`, NuGet vulnerability scan, проверку кодировки, browser smoke и локальную проверку API против SQL-БД.

## 2026-06-10 - вкладки и dirty-state карточки кампании

Продолжена реализация roadmap по разделу рассылок:

- карточка кампании разделена на вкладки "Основное", "Получатели", "Письмо", "Расписание", "Проверка и запуск", "Статистика";
- добавлен индикатор несохраненных изменений и стандартное предупреждение браузера при закрытии страницы с измененным черновиком;
- кнопки проверки получателей и готовности теперь автоматически открывают соответствующую вкладку с результатом;
- логика сравнения черновика кампании вынесена в тестируемый helper с нормализацией выбранных организаций и сохранением порядка вложений;
- вкладки адаптированы для узких экранов через горизонтальную прокрутку без поломки ширины формы.

Проверки этого этапа включают frontend-тесты, production-сборку, проверку кодировки, browser smoke на desktop/mobile и локальную проверку API против SQL-БД.

## 2026-06-10 - улучшение CRM-интерфейса и контроль рассылок

В этом пакете исправлений начата практическая реализация roadmap по доведению разделов CRM до стабильного состояния:

- добавлены мобильные карточки для таблиц, чтобы данные организаций, сотрудников, кампаний и SMTP-профилей читались на телефонах и планшетах без горизонтального скролла;
- унифицированы действия в строках таблиц через компактное меню, чтобы кнопки не ломали верстку и не наезжали на текст;
- добавлены общие бейджи статусов для кампаний и транспортных профилей;
- исправлено отображение ошибки входа при недоступном API: вместо общего `Network Error` пользователь получает понятное сообщение;
- удаление кампаний и SMTP-профилей переведено с браузерного `confirm` на единый модальный диалог приложения;
- добавлены модульные тесты расчета расписаний рассылок, чтобы фиксировать поведение одноразовых, интервальных и cron-запусков;
- сохранены подробные документы анализа и roadmap для следующих этапов доработки.

Следующие крупные блоки остаются в roadmap: полноценная проверка сценариев рассылок, доработка фильтров и пагинации во всех таблицах, визуальное выравнивание форм редактирования, расширение E2E-проверок и проверка доступности интерфейса.

## 2026-06-10 - второй проход по спискам, фильтрам и frontend-тестам

Продолжена стабилизация интерфейса списков:

- раздел "Работа" получил сброс фильтров, статусные бейджи и корректный порядок полей в мобильных карточках;
- справочник выбора организаций в кампании переведен на общие настройки page size и получил мобильное действие "Выбрать/Выбрано";
- таблицы предпросмотра получателей, последних пакетов и последних сообщений в карточке кампании получили приоритеты мобильного отображения;
- статусы последних сообщений рассылки теперь отображаются бейджами, а не простым текстом;
- добавлен `npm test` на Vitest и unit-тесты для нормализации и загрузки размера страницы из `localStorage`.
- обновлены frontend-зависимости `axios`, `react-router-dom`, `vite`, `@vitejs/plugin-react` и `vitest`; `npm audit` теперь не показывает уязвимостей.

Проверки этого этапа включают backend-тесты, frontend-тесты, production-сборку, browser smoke на desktop/mobile и локальную проверку API против SQL-БД.

## 2026-06-10 - третий проход по организациям и backend-зависимостям

Продолжена работа по roadmap для раздела организаций и технической чистоты backend:

- обновлен `MailKit` до версии `4.17.0`, после чего `dotnet list package --vulnerable` больше не показывает уязвимых NuGet-пакетов;
- добавлена явная проверка SMTP-сервера перед подключением в отправке писем и тесте SMTP-профиля, чтобы новые nullable-требования MailKit не оставляли предупреждений сборки;
- фильтры районов организаций получили верхнюю summary-панель над таблицей: видно активный районный фильтр, поисковую строку, количество найденных организаций и кнопку сброса;
- логика формирования summary выбранных районов вынесена в тестируемый helper;
- добавлены unit-тесты для выбора района без значения и для текста summary выбранных районов.

Проверки этого этапа включают backend-тесты, frontend-тесты, production-сборку, `npm audit`, NuGet vulnerability scan, browser smoke и локальную проверку API против SQL-БД.

## 2026-06-10 - readiness checklist кампаний

Добавлена диагностика готовности кампании перед запуском:

- появился API `POST /api/campaigns/readiness`, который проверяет название, тему, тело письма, SMTP-профиль, источники получателей, фактическое количество email и расписание;
- ручной запуск кампании в UI теперь сначала выполняет readiness-проверку и не ставит кампанию в очередь, если есть блокирующие ошибки;
- карточка кампании получила блок "Готовность к запуску" со сводкой, количеством организаций/получателей и списком пунктов проверки;
- предупреждение о SMTP-профиле по умолчанию не блокирует запуск, но явно показывается оператору;
- добавлены frontend unit-тесты для отображения summary и статусов readiness checklist.

Проверки этого этапа включают backend-тесты, frontend-тесты, production-сборку, `npm audit`, NuGet vulnerability scan, browser smoke и локальную проверку API против SQL-БД.

## 2026-06-10 - фильтр организаций с email для рассылок

Продолжена доработка сценария подготовки кампании к реальной отправке:

- API списка организаций получил параметр `hasEmail`, который фильтрует организации с email до пагинации и корректно считает `totalCount`;
- API районов организаций учитывает `hasEmail`, чтобы счетчики районов в справочнике получателей соответствовали активному фильтру;
- справочник выбора организаций в кампании получил включенный по умолчанию фильтр "Только организации с email";
- в таблицу выбора организаций добавлена колонка количества email;
- summary справочника показывает, сколько организаций найдено с учетом email-фильтра;
- добавлен unit-тест для текста summary email-фильтра.

Проверки этого этапа включают backend-тесты, frontend-тесты, production-сборку, `npm audit`, NuGet vulnerability scan, browser smoke и локальную проверку API против SQL-БД.
