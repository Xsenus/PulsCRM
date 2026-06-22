import type { OrganizationRaionDto } from './types';

export const WITHOUT_RAION_ID = -1;

export function getRaionSelectionId(raion: Pick<OrganizationRaionDto, 'id'>) {
  return raion.id ?? WITHOUT_RAION_ID;
}

export function buildOrganizationFilterPanelClassName(expandedOnSmallScreens: boolean) {
  return `panel organizations-sidebar ${expandedOnSmallScreens ? 'expanded-on-small' : 'collapsed-on-small'}`;
}

export function buildRaionSelectionSummary(
  raions: Array<Pick<OrganizationRaionDto, 'id' | 'name'>>,
  selectedIds: number[],
  visibleNameLimit = 2
) {
  if (selectedIds.length === 0) {
    return 'Все районы';
  }

  const selectedSet = new Set(selectedIds);
  const names = raions
    .filter((raion) => selectedSet.has(getRaionSelectionId(raion)))
    .map((raion) => raion.name)
    .filter(Boolean);

  if (names.length === 0) {
    return `Выбрано районов: ${selectedIds.length}`;
  }

  const safeLimit = Math.max(1, visibleNameLimit);

  if (names.length <= safeLimit) {
    return names.join(', ');
  }

  return `${names.slice(0, safeLimit).join(', ')} и еще ${names.length - safeLimit}`;
}

export function buildOrganizationListFilterSummary(
  raions: Array<Pick<OrganizationRaionDto, 'id' | 'name'>>,
  selectedRaionIds: number[],
  appliedSearch: string
) {
  const selectedRaionSummary = buildRaionSelectionSummary(raions, selectedRaionIds);
  const search = appliedSearch.trim();
  const activeFilterCount = (search ? 1 : 0) + selectedRaionIds.length;
  const description = activeFilterCount > 0
    ? `${selectedRaionSummary}${search ? `; поиск: "${search}"` : ''}`
    : 'Показаны все организации';

  return {
    activeFilterCount,
    description,
    selectedRaionSummary,
    toggleLabel: `Фильтры${activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}`
  };
}

export function buildOrganizationPickerFilterSummary(totalCount: number, onlyWithEmail: boolean) {
  const normalizedTotal = Math.max(0, Math.trunc(totalCount));
  return onlyWithEmail
    ? `Найдено с email: ${normalizedTotal}`
    : `Найдено: ${normalizedTotal}`;
}
