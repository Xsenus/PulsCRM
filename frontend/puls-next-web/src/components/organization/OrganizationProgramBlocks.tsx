import React, { useMemo } from 'react';
import { formatDateTime } from '../../app/format';
import type { OrganizationInfoTaskDto } from '../../app/types';

const EMPTY_VALUE = '-';
const PROGRAM_VARIANTS = [
  { variant: 0, shortLabel: 'Бух', title: 'Бухгалтерия' },
  { variant: 1, shortLabel: 'ЗП', title: 'Зарплата' },
  { variant: 2, shortLabel: 'ПХУ', title: 'Похозяйственный учет' },
  { variant: 3, shortLabel: 'РМИ', title: 'Реестр муниципального имущества' },
  { variant: 4, shortLabel: 'ЗУМО', title: 'Реестр земельных участков' },
  { variant: 5, shortLabel: 'ЖКХ', title: 'Жилищно-коммунальное хозяйство' },
  { variant: 6, shortLabel: 'Сайт', title: 'Представительство в интернете' },
  { variant: 7, shortLabel: 'ЭЦП', title: 'Сдача отчетности' },
  { variant: 8, shortLabel: 'ГМЗ', title: 'Государственное муниципальное задание' },
  { variant: 9, shortLabel: 'БО', title: 'Бюджетная отчетность' }
] as const;
const PROGRAM_VARIANT_SET = new Set<number>(PROGRAM_VARIANTS.map((item) => item.variant));

function formatCount(value?: number | null) {
  return new Intl.NumberFormat('ru-RU').format(value ?? 0);
}

function formatAuditValue(date?: string, author?: string) {
  const value = [formatDateTime(date), author].filter(Boolean).join(' • ');
  return value || EMPTY_VALUE;
}

function getProgramVariantMeta(variant: number) {
  return PROGRAM_VARIANTS.find((item) => item.variant === variant);
}

export function OrganizationProgramBlocks({ items }: { items?: OrganizationInfoTaskDto[] | null }) {
  const programCards = useMemo(() => {
    const values = items ?? [];
    const itemByVariant = new Map(values.map((item) => [item.variant, item] as const));
    const knownItems = PROGRAM_VARIANTS.map((meta) => ({
      meta,
      item: itemByVariant.get(meta.variant)
    }));
    const extraItems = values.filter((item) => !PROGRAM_VARIANT_SET.has(item.variant));
    return { knownItems, extraItems, total: values.length };
  }, [items]);

  return (
    <div className="panel-subsection">
      <div className="section-header-inline">
        <h4>Блоки программ</h4>
        <span className="field-hint">{formatCount(programCards.total)} записей</span>
      </div>
      <div className="detail-grid organization-program-grid">
        {programCards.knownItems.map(({ meta, item }) => (
          <div
            key={meta.variant}
            className={`detail-card organization-program-card${item ? '' : ' organization-program-card-empty'}`}
          >
            <div className="organization-program-card-heading">
              <strong>{meta.shortLabel}</strong>
              <span>{item?.fullName || item?.name || meta.title}</span>
            </div>
            <span>{item?.organizationCreatorName || 'Производитель не указан'}</span>
            <span className="field-hint">Рабочих мест: {formatCount(item?.places ?? 0)}</span>
            <span className="field-hint">
              {item?.updatedAtUtc
                ? `Обновлено: ${formatAuditValue(item.updatedAtUtc, item.updatedByName)}`
                : item?.updatedByName
                  ? `Автор: ${item.updatedByName}`
                  : 'Запись пока не заполнена'}
            </span>
            <span>{item?.comment?.trim() || 'Комментарий не заполнен'}</span>
          </div>
        ))}
      </div>

      {programCards.extraItems.length ? (
        <div className="detail-grid organization-program-grid">
          {programCards.extraItems.map((item) => {
            const meta = getProgramVariantMeta(item.variant);
            return (
              <div key={item.id} className="detail-card organization-program-card">
                <div className="organization-program-card-heading">
                  <strong>{meta?.shortLabel || `#${item.variant}`}</strong>
                  <span>{item.fullName || item.name || `Блок #${item.id}`}</span>
                </div>
                <span>{item.organizationCreatorName || 'Производитель не указан'}</span>
                <span className="field-hint">Рабочих мест: {formatCount(item.places)}</span>
                <span className="field-hint">
                  {item.updatedAtUtc ? `Обновлено: ${formatAuditValue(item.updatedAtUtc, item.updatedByName)}` : `Автор: ${item.updatedByName || EMPTY_VALUE}`}
                </span>
                <span>{item.comment?.trim() || 'Комментарий не заполнен'}</span>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
