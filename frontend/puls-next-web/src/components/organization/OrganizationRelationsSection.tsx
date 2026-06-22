import React, { useMemo } from 'react';
import type {
  OrganizationAttachmentDto,
  OrganizationContactDto,
  OrganizationContractDto,
  OrganizationDetailsDto,
  OrganizationParusLicenseDto,
  OrganizationParusOrderDto,
  OrganizationRealizationDto
} from '../../app/types';
import type { PreviewCardItem } from './RelationPreviewCard';
import {
  OrganizationRelationsOverview,
  type OrganizationRelationTab,
  type OrganizationRelationsOverviewItem
} from './OrganizationRelationsOverview';
import { OrganizationRelationsWorkspace, type OrganizationRelationsTableSettings } from './OrganizationRelationsWorkspace';

function formatMoney(value?: number | null) {
  return new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value ?? 0);
}

function formatDateOnly(value?: string | null) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat('ru-RU').format(date);
}

function renderDateOnly(value?: string | null) {
  const formatted = formatDateOnly(value);
  return formatted ? <time dateTime={value ?? undefined}>{formatted}</time> : undefined;
}

function buildCaption(parts: Array<React.ReactNode | undefined | null | false>) {
  const visibleParts = parts.filter(Boolean);
  if (!visibleParts.length) {
    return undefined;
  }

  return (
    <>
      {visibleParts.map((part, index) => (
        <React.Fragment key={index}>
          {index > 0 ? ' • ' : null}
          {part}
        </React.Fragment>
      ))}
    </>
  );
}

function buildContactPreviewItems(items: OrganizationContactDto[]): PreviewCardItem[] {
  return items.slice(0, 3).map((item) => ({
    key: String(item.id),
    title: item.fio || `Контакт #${item.id}`,
    caption: buildCaption([item.position, item.phone || item.email])
  }));
}

function buildAttachmentPreviewItems(items: OrganizationAttachmentDto[]): PreviewCardItem[] {
  return items.slice(0, 3).map((item) => ({
    key: String(item.id),
    title: item.name || item.fileName || item.number || `Документ #${item.id}`,
    caption: buildCaption([item.attachDocumentTypeName, renderDateOnly(item.dateUtc)])
  }));
}

function buildContractPreviewItems(items: OrganizationContractDto[]): PreviewCardItem[] {
  return items.slice(0, 3).map((item) => ({
    key: String(item.id),
    title: item.name || item.fileName || item.number || `Договор #${item.id}`,
    caption: buildCaption([renderDateOnly(item.dateUtc), item.summa === undefined || item.summa === null ? undefined : formatMoney(item.summa)])
  }));
}

function buildRealizationPreviewItems(items: OrganizationRealizationDto[]): PreviewCardItem[] {
  return items.slice(0, 3).map((item) => ({
    key: String(item.id),
    title: item.contractName || item.number || `Реализация #${item.id}`,
    caption: buildCaption([renderDateOnly(item.dateUtc), item.summa === undefined || item.summa === null ? undefined : formatMoney(item.summa)])
  }));
}

function buildLicensePreviewItems(items: OrganizationParusLicenseDto[]): PreviewCardItem[] {
  return items.slice(0, 3).map((item) => ({
    key: String(item.id),
    title: item.modification || item.nomenclature || `Лицензия #${item.id}`,
    caption: buildCaption([item.regNumberClient, renderDateOnly(item.dateToUtc)])
  }));
}

function buildOrderPreviewItems(items: OrganizationParusOrderDto[]): PreviewCardItem[] {
  return items.slice(0, 3).map((item) => ({
    key: String(item.id),
    title: item.payer || item.mnemoOrg || `Заказ #${item.id}`,
    caption: buildCaption([renderDateOnly(item.dateUtc), formatMoney(item.summa)])
  }));
}

function buildRelationCards(details: OrganizationDetailsDto | null): OrganizationRelationsOverviewItem[] {
  return [
    {
      key: 'contacts' as const,
      title: 'Контакты',
      count: details?.contacts.length ?? 0,
      description: 'Люди, должности и способы связи',
      items: buildContactPreviewItems(details?.contacts ?? [])
    },
    {
      key: 'documents' as const,
      title: 'Документы',
      count: details?.attachments.length ?? 0,
      description: 'Вложения и сопроводительные файлы',
      items: buildAttachmentPreviewItems(details?.attachments ?? [])
    },
    {
      key: 'contracts' as const,
      title: 'Договоры',
      count: details?.contracts.length ?? 0,
      description: 'Договорные записи и статусы',
      items: buildContractPreviewItems(details?.contracts ?? [])
    },
    {
      key: 'realizations' as const,
      title: 'Реализации',
      count: details?.realizations.length ?? 0,
      description: 'Финансовые документы по организации',
      items: buildRealizationPreviewItems(details?.realizations ?? [])
    },
    {
      key: 'licenses' as const,
      title: 'Лицензии Парус',
      count: details?.parusLicenses.length ?? 0,
      description: 'История лицензий и модификаций',
      items: buildLicensePreviewItems(details?.parusLicenses ?? [])
    },
    {
      key: 'orders' as const,
      title: 'Заказы Парус',
      count: details?.parusOrders.length ?? 0,
      description: 'Заказы, поставщики и суммы',
      items: buildOrderPreviewItems(details?.parusOrders ?? [])
    }
  ];
}

export function OrganizationRelationsSection({
  activeTab,
  details,
  onChange,
  tableSettings
}: {
  activeTab: OrganizationRelationTab;
  details: OrganizationDetailsDto | null;
  onChange: (tab: OrganizationRelationTab) => void;
  tableSettings: OrganizationRelationsTableSettings;
}) {
  const cards = useMemo(() => buildRelationCards(details), [details]);

  return (
    <>
      <OrganizationRelationsOverview cards={cards} activeTab={activeTab} onChange={onChange} />

      <OrganizationRelationsWorkspace activeTab={activeTab} details={details} tableSettings={tableSettings} />
    </>
  );
}
