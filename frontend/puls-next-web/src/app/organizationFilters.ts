import type { OrganizationRaionDto } from './types';

export const WITHOUT_RAION_ID = -1;

export function getRaionSelectionId(raion: Pick<OrganizationRaionDto, 'id'>) {
  return raion.id ?? WITHOUT_RAION_ID;
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
