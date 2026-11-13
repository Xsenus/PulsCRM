-- Создание пользователя и базы PostgreSQL для чата Puls Next (ChatDb).
-- Запускать под суперпользователем PostgreSQL на сервере, где работает API:
--
--   psql -U postgres -f scripts/sql/create-chat-database.sql
--
-- psql спросит пароль для нового пользователя pulschat. Можно передать его сразу (без кавычек внутри):
--
--   psql -U postgres -v chat_password=ДлинныйПароль -f scripts/sql/create-chat-database.sql
--
-- Не используйте в пароле символ «;» — он ломает строку подключения ConnectionStrings:ChatDb.
--
-- Скрипт можно запускать повторно: существующие пользователь и база не пересоздаются,
-- у существующего пользователя только обновляется пароль. Таблицы Chat* создаст само API
-- при первом обращении (Chat:AutoCreateSchema=true) — здесь их создавать не нужно.

\set ON_ERROR_STOP on
-- Файл в UTF-8: на Windows psql по умолчанию работает в кодировке консоли (866/1251).
\encoding UTF8

\if :{?chat_password}
\else
  \prompt 'Пароль для пользователя pulschat: ' chat_password
\endif

SELECT format('CREATE ROLE pulschat LOGIN PASSWORD %L', :'chat_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pulschat')
\gexec

SELECT format('ALTER ROLE pulschat WITH LOGIN PASSWORD %L', :'chat_password')
WHERE EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pulschat')
\gexec

-- CREATE DATABASE нельзя выполнить внутри транзакции/функции, поэтому через \gexec.
SELECT 'CREATE DATABASE pulschat OWNER pulschat ENCODING ''UTF8'' TEMPLATE template0'
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'pulschat')
\gexec

\connect pulschat

-- Владелец базы создает таблицы в схеме public (PostgreSQL 15+ по умолчанию не дает этого обычным пользователям).
ALTER SCHEMA public OWNER TO pulschat;
GRANT ALL ON SCHEMA public TO pulschat;

\echo 'Готово: пользователь pulschat и база pulschat (UTF8). Теперь добавьте ConnectionStrings:ChatDb и Chat:Enabled=true (см. docs/chat.md).'
