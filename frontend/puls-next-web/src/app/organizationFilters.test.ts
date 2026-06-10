import { describe, expect, it } from 'vitest';
import { buildRaionSelectionSummary, getRaionSelectionId, WITHOUT_RAION_ID } from './organizationFilters';

const raions = [
  { id: 1, name: 'Центральный' },
  { id: 2, name: 'Ленинский' },
  { id: 3, name: 'Октябрьский' },
  { id: null, name: 'Без района' }
];

describe('organization raion filter helpers', () => {
  it('uses sentinel id for organizations without raion', () => {
    expect(getRaionSelectionId({ id: null })).toBe(WITHOUT_RAION_ID);
    expect(getRaionSelectionId({ id: 10 })).toBe(10);
  });

  it('shows all raions summary when nothing is selected', () => {
    expect(buildRaionSelectionSummary(raions, [])).toBe('Все районы');
  });

  it('shows selected raion names with overflow counter', () => {
    expect(buildRaionSelectionSummary(raions, [1, 2])).toBe('Центральный, Ленинский');
    expect(buildRaionSelectionSummary(raions, [1, 2, 3])).toBe('Центральный, Ленинский и еще 1');
  });

  it('falls back to selected count when raions are not loaded yet', () => {
    expect(buildRaionSelectionSummary([], [1, 2, WITHOUT_RAION_ID])).toBe('Выбрано районов: 3');
  });
});
