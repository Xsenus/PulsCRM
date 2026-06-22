import { describe, expect, it } from 'vitest';
import {
  buildOrganizationFilterPanelClassName,
  buildOrganizationListFilterSummary,
  buildOrganizationPickerFilterSummary,
  buildRaionSelectionSummary,
  getRaionSelectionId,
  WITHOUT_RAION_ID
} from './organizationFilters';

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

  it('formats organization picker summary with email-only mode', () => {
    expect(buildOrganizationPickerFilterSummary(12, true)).toBe('Найдено с email: 12');
    expect(buildOrganizationPickerFilterSummary(12, false)).toBe('Найдено: 12');
    expect(buildOrganizationPickerFilterSummary(-1, true)).toBe('Найдено с email: 0');
  });

  it('builds organization list filter summary for search and raions', () => {
    expect(buildOrganizationListFilterSummary(raions, [], '')).toEqual({
      activeFilterCount: 0,
      description: 'Показаны все организации',
      selectedRaionSummary: 'Все районы',
      toggleLabel: 'Фильтры'
    });

    expect(buildOrganizationListFilterSummary(raions, [1, WITHOUT_RAION_ID], '  школа  ')).toEqual({
      activeFilterCount: 3,
      description: 'Центральный, Без района; поиск: "школа"',
      selectedRaionSummary: 'Центральный, Без района',
      toggleLabel: 'Фильтры (3)'
    });
  });

  it('marks organization filter panel visibility for compact layouts', () => {
    expect(buildOrganizationFilterPanelClassName(false)).toBe('panel organizations-sidebar collapsed-on-small');
    expect(buildOrganizationFilterPanelClassName(true)).toBe('panel organizations-sidebar expanded-on-small');
  });
});
