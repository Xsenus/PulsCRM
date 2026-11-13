/** @vitest-environment jsdom */
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { HighlightedSnippet } from './ChatSearch';

describe('HighlightedSnippet', () => {
  it('highlights every match regardless of case', () => {
    const html = renderToStaticMarkup(<HighlightedSnippet text="Отчет готов, отчет отправлен" term="ОТЧЕТ" />);
    expect(html).toBe('<mark>Отчет</mark> готов, <mark>отчет</mark> отправлен');
  });

  it('cuts long text before the first match', () => {
    const text = `${'а'.repeat(100)} договор ${'б'.repeat(10)}`;
    const html = renderToStaticMarkup(<HighlightedSnippet text={text} term="договор" />);
    expect(html.startsWith('…')).toBe(true);
    expect(html).toContain('<mark>договор</mark>');
    expect(html.length).toBeLessThan(text.length);
  });

  it('treats ё and е as the same letter', () => {
    expect(renderToStaticMarkup(<HighlightedSnippet text="Отчёт готов" term="отчет" />)).toBe('<mark>Отчёт</mark> готов');
  });

  it('collapses line breaks', () => {
    expect(renderToStaticMarkup(<HighlightedSnippet text={'Первая\n\nвторая'} term="втор" />)).toBe('Первая <mark>втор</mark>ая');
  });
});
