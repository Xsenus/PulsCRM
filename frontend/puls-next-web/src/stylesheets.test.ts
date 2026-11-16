import { describe, expect, it } from 'vitest';

// Тесты идут в Node: читаем исходные файлы стилей с диска (через Vite импорт CSS в тестах приходит пустым).
// Модуль подключается динамически, чтобы проверка типов приложения не требовала типов Node.
const fsModule = 'node:fs';
const fs: { readdirSync(path: URL): string[]; readFileSync(path: URL, encoding: 'utf8'): string } = await import(/* @vite-ignore */ fsModule);
const directory = new URL('./', import.meta.url);
const stylesheets: Record<string, string> = Object.fromEntries(
  fs.readdirSync(directory)
    .filter((name) => name.endsWith('.css'))
    .map((name) => [`./${name}`, fs.readFileSync(new URL(name, directory), 'utf8')])
);

/**
 * Незакрытая скобка в CSS не ломает сборку, но все правила после нее браузер считает вложенными в
 * предыдущее (CSS nesting) или отбрасывает — так однажды пропали стили блока системных уведомлений чата.
 */
function findUnbalancedBrace(css: string) {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '));
  let depth = 0;
  let line = 1;
  let topLevelRuleLine = 1;
  for (const char of withoutComments) {
    if (char === '\n') {
      line += 1;
    } else if (char === '{') {
      if (depth === 0) {
        topLevelRuleLine = line;
      }

      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth < 0) {
        return `лишняя «}» в строке ${line}`;
      }
    }
  }

  return depth === 0 ? null : `не закрыто правило из строки ${topLevelRuleLine}`;
}

describe('stylesheets', () => {
  const files = Object.keys(stylesheets).map((path) => path.replace('./', ''));

  it('finds the stylesheets', () => {
    expect(files).toEqual(expect.arrayContaining(['styles.css', 'chat.css']));
  });

  it.each(files)('%s has balanced braces', (name) => {
    expect(findUnbalancedBrace(stylesheets[`./${name}`])).toBeNull();
  });

  it('reports an unclosed rule', () => {
    expect(findUnbalancedBrace('.a { color: red; }\n.b {\n  color: blue;\n\n.c { color: green; }')).toBe('не закрыто правило из строки 2');
  });
});
