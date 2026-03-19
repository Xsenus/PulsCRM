import React, { useEffect, useMemo, useRef, useState } from 'react';
import { showToast } from '../app/toast';
import type { OrganizationListItemDto } from '../app/types';
import { Modal } from './Modal';

type OrganizationColumnId =
  | 'name'
  | 'fullName'
  | 'inn'
  | 'raion'
  | 'orgType'
  | 'openWorkItems'
  | 'emailCount'
  | 'contactCount'
  | 'visible'
  | 'isManager';

interface OrganizationColumnSetting {
  id: OrganizationColumnId;
  visible: boolean;
  width: number;
}

interface OrganizationTableSettings {
  columns: OrganizationColumnSetting[];
}

interface OrganizationColumnDefinition {
  id: OrganizationColumnId;
  title: string;
  defaultWidth: number;
  minWidth: number;
  headerClassName?: string;
  cellClassName?: string;
  render: (row: OrganizationListItemDto) => React.ReactNode;
}

interface OrganizationsTableProps {
  rows: OrganizationListItemDto[];
  loading?: boolean;
  emptyText?: string;
  selectedRowId?: number;
  settingsKey: string;
  actions?: React.ReactNode;
  onRowClick?: (row: OrganizationListItemDto) => void;
  onRowDoubleClick?: (row: OrganizationListItemDto) => void;
  onRowContextMenu?: (row: OrganizationListItemDto, event: React.MouseEvent<HTMLTableRowElement>) => void;
}

interface ColumnDragState {
  sourceId: OrganizationColumnId;
  targetId: OrganizationColumnId;
}

type PendingTableSettingsAction = 'reset' | 'save';

const EMPTY_VALUE = '—';

const COLUMN_DEFINITIONS: Record<OrganizationColumnId, OrganizationColumnDefinition> = {
  name: {
    id: 'name',
    title: 'Название',
    defaultWidth: 320,
    minWidth: 220,
    render: (row) => row.name || EMPTY_VALUE
  },
  fullName: {
    id: 'fullName',
    title: 'Полное название',
    defaultWidth: 420,
    minWidth: 260,
    render: (row) => row.fullName || EMPTY_VALUE
  },
  inn: {
    id: 'inn',
    title: 'ИНН',
    defaultWidth: 150,
    minWidth: 130,
    render: (row) => row.inn || EMPTY_VALUE
  },
  raion: {
    id: 'raion',
    title: 'Район',
    defaultWidth: 220,
    minWidth: 180,
    render: (row) => row.raion || EMPTY_VALUE
  },
  orgType: {
    id: 'orgType',
    title: 'Тип',
    defaultWidth: 220,
    minWidth: 180,
    render: (row) => row.orgType || EMPTY_VALUE
  },
  openWorkItems: {
    id: 'openWorkItems',
    title: 'Открытых задач',
    defaultWidth: 150,
    minWidth: 130,
    headerClassName: 'organization-cell-right',
    cellClassName: 'organization-cell-right',
    render: (row) => row.openWorkItems
  },
  emailCount: {
    id: 'emailCount',
    title: 'Адресов',
    defaultWidth: 110,
    minWidth: 96,
    headerClassName: 'organization-cell-right',
    cellClassName: 'organization-cell-right',
    render: (row) => row.emailCount
  },
  contactCount: {
    id: 'contactCount',
    title: 'Контактов',
    defaultWidth: 120,
    minWidth: 100,
    headerClassName: 'organization-cell-right',
    cellClassName: 'organization-cell-right',
    render: (row) => row.contactCount
  },
  visible: {
    id: 'visible',
    title: 'Видимость',
    defaultWidth: 130,
    minWidth: 110,
    render: (row) => row.visible ? 'Видима' : 'Скрыта'
  },
  isManager: {
    id: 'isManager',
    title: 'Управленческая',
    defaultWidth: 150,
    minWidth: 130,
    render: (row) => row.isManager ? 'Да' : 'Нет'
  }
};

const DEFAULT_COLUMNS: OrganizationColumnSetting[] = [
  { id: 'name', visible: true, width: COLUMN_DEFINITIONS.name.defaultWidth },
  { id: 'inn', visible: true, width: COLUMN_DEFINITIONS.inn.defaultWidth },
  { id: 'raion', visible: true, width: COLUMN_DEFINITIONS.raion.defaultWidth },
  { id: 'orgType', visible: true, width: COLUMN_DEFINITIONS.orgType.defaultWidth },
  { id: 'openWorkItems', visible: true, width: COLUMN_DEFINITIONS.openWorkItems.defaultWidth },
  { id: 'emailCount', visible: true, width: COLUMN_DEFINITIONS.emailCount.defaultWidth },
  { id: 'contactCount', visible: true, width: COLUMN_DEFINITIONS.contactCount.defaultWidth },
  { id: 'fullName', visible: false, width: COLUMN_DEFINITIONS.fullName.defaultWidth },
  { id: 'visible', visible: false, width: COLUMN_DEFINITIONS.visible.defaultWidth },
  { id: 'isManager', visible: false, width: COLUMN_DEFINITIONS.isManager.defaultWidth }
];

function createDefaultSettings(): OrganizationTableSettings {
  return {
    columns: DEFAULT_COLUMNS.map((column) => ({ ...column }))
  };
}

function isOrganizationTableSettings(value: unknown): value is OrganizationTableSettings {
  if (!value || typeof value !== 'object' || !Array.isArray((value as OrganizationTableSettings).columns)) {
    return false;
  }

  return (value as OrganizationTableSettings).columns.every((column) => {
    if (!column || typeof column !== 'object') {
      return false;
    }

    return typeof column.id === 'string'
      && column.id in COLUMN_DEFINITIONS
      && typeof column.visible === 'boolean'
      && typeof column.width === 'number';
  });
}

function normalizeSettings(value: unknown): OrganizationTableSettings {
  if (!isOrganizationTableSettings(value)) {
    return createDefaultSettings();
  }

  const incomingColumns = value.columns
    .filter((column, index, source) => source.findIndex((item) => item.id === column.id) === index);
  const incoming = new Map(incomingColumns.map((column) => [column.id, column]));
  const missingDefaults = DEFAULT_COLUMNS.filter((column) => !incoming.has(column.id));

  return {
    columns: [...incomingColumns, ...missingDefaults].map((column) => {
      const stored = incoming.get(column.id);
      const definition = COLUMN_DEFINITIONS[column.id];

      return {
        id: column.id,
        visible: stored?.visible ?? column.visible,
        width: Math.max(definition.minWidth, Math.round(stored?.width ?? column.width))
      };
    })
  };
}

function loadSettings(settingsKey: string): OrganizationTableSettings {
  if (typeof window === 'undefined') {
    return createDefaultSettings();
  }

  try {
    const raw = window.localStorage.getItem(settingsKey);
    if (!raw) {
      return createDefaultSettings();
    }

    return normalizeSettings(JSON.parse(raw));
  } catch {
    return createDefaultSettings();
  }
}

function reorderColumns(columns: OrganizationColumnSetting[], sourceId: OrganizationColumnId, targetId: OrganizationColumnId) {
  if (sourceId === targetId) {
    return columns;
  }

  const next = [...columns];
  const fromIndex = next.findIndex((column) => column.id === sourceId);
  const toIndex = next.findIndex((column) => column.id === targetId);

  if (fromIndex < 0 || toIndex < 0) {
    return columns;
  }

  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

function TableActionIcon({ kind }: { kind: 'add' | 'columns' }) {
  if (kind === 'add') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="8" cy="7" r="1.6" fill="currentColor" />
      <circle cx="15" cy="12" r="1.6" fill="currentColor" />
      <circle cx="11" cy="17" r="1.6" fill="currentColor" />
    </svg>
  );
}

function SettingsActionIcon({ kind }: { kind: 'up' | 'down' | 'reset' }) {
  if (kind === 'up') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 17V7M12 7l-4 4M12 7l4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (kind === 'down') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 7v10M12 17l-4-4M12 17l4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M19 7v5h-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18.4 12a6.4 6.4 0 10-1.88 4.53L19 14.8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function OrganizationsTable({
  rows,
  loading = false,
  emptyText = 'Нет данных',
  selectedRowId,
  settingsKey,
  actions,
  onRowClick,
  onRowDoubleClick,
  onRowContextMenu
}: OrganizationsTableProps) {
  const [settings, setSettings] = useState<OrganizationTableSettings>(() => loadSettings(settingsKey));
  const [draftSettings, setDraftSettings] = useState<OrganizationTableSettings>(() => loadSettings(settingsKey));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingTableSettingsAction | null>(null);
  const [dragState, setDragState] = useState<ColumnDragState | null>(null);
  const dragSessionRef = useRef<{
    sourceId: OrganizationColumnId;
    startX: number;
    startY: number;
    active: boolean;
  } | null>(null);

  useEffect(() => {
    const loaded = loadSettings(settingsKey);
    setSettings(loaded);
    setDraftSettings(loaded);
  }, [settingsKey]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(settingsKey, JSON.stringify(settings));
  }, [settings, settingsKey]);

  const draftVisibleCount = useMemo(
    () => draftSettings.columns.filter((column) => column.visible).length,
    [draftSettings.columns]
  );

  const visibleColumns = useMemo(
    () => settings.columns
      .filter((column) => column.visible)
      .map((column) => ({
        ...COLUMN_DEFINITIONS[column.id],
        width: column.width
      })),
    [settings.columns]
  );

  const updateSettings = (updater: (current: OrganizationTableSettings) => OrganizationTableSettings) => {
    setSettings((current) => normalizeSettings(updater(current)));
  };

  const updateDraftSettings = (updater: (current: OrganizationTableSettings) => OrganizationTableSettings) => {
    setDraftSettings((current) => normalizeSettings(updater(current)));
  };

  const moveCommittedColumn = (sourceId: OrganizationColumnId, targetId: OrganizationColumnId) => {
    updateSettings((current) => ({
      columns: reorderColumns(current.columns, sourceId, targetId)
    }));
  };

  const moveDraftColumnByOffset = (columnId: OrganizationColumnId, offset: -1 | 1) => {
    updateDraftSettings((current) => {
      const index = current.columns.findIndex((column) => column.id === columnId);
      const nextIndex = index + offset;

      if (index < 0 || nextIndex < 0 || nextIndex >= current.columns.length) {
        return current;
      }

      const columns = [...current.columns];
      const [moved] = columns.splice(index, 1);
      columns.splice(nextIndex, 0, moved);
      return { columns };
    });
  };

  const setDraftColumnVisibility = (columnId: OrganizationColumnId, visible: boolean) => {
    updateDraftSettings((current) => ({
      columns: current.columns.map((column) => {
        if (column.id !== columnId) {
          return column;
        }

        return { ...column, visible };
      })
    }));
  };

  const setCommittedColumnWidth = (columnId: OrganizationColumnId, width: number) => {
    const minWidth = COLUMN_DEFINITIONS[columnId].minWidth;

    updateSettings((current) => ({
      columns: current.columns.map((column) => column.id === columnId
        ? { ...column, width: Math.max(minWidth, Math.round(width)) }
        : column)
    }));
  };

  const setDraftColumnWidth = (columnId: OrganizationColumnId, width: number) => {
    const minWidth = COLUMN_DEFINITIONS[columnId].minWidth;

    updateDraftSettings((current) => ({
      columns: current.columns.map((column) => column.id === columnId
        ? { ...column, width: Math.max(minWidth, Math.round(width)) }
        : column)
    }));
  };

  const openSettings = () => {
    setDraftSettings(settings);
    setSettingsOpen(true);
  };

  const startResize = (event: React.MouseEvent<HTMLButtonElement>, columnId: OrganizationColumnId, width: number) => {
    event.preventDefault();
    event.stopPropagation();

    const startX = event.clientX;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      setCommittedColumnWidth(columnId, width + delta);
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const startColumnDrag = (event: React.MouseEvent<HTMLTableCellElement>, columnId: OrganizationColumnId) => {
    if (event.button !== 0) {
      return;
    }

    dragSessionRef.current = {
      sourceId: columnId,
      startX: event.clientX,
      startY: event.clientY,
      active: false
    };

    const resolveTargetId = (clientX: number, clientY: number) => {
      const target = document.elementFromPoint(clientX, clientY)?.closest('th[data-column-id]');
      const targetId = target?.getAttribute('data-column-id');

      return targetId && targetId in COLUMN_DEFINITIONS ? targetId as OrganizationColumnId : null;
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const session = dragSessionRef.current;
      if (!session) {
        return;
      }

      if (!session.active) {
        const distanceX = Math.abs(moveEvent.clientX - session.startX);
        const distanceY = Math.abs(moveEvent.clientY - session.startY);

        if (distanceX < 6 && distanceY < 6) {
          return;
        }

        session.active = true;
        document.body.classList.add('is-dragging-column');
        setDragState({ sourceId: session.sourceId, targetId: session.sourceId });
      }

      const targetId = resolveTargetId(moveEvent.clientX, moveEvent.clientY);
      if (!targetId) {
        return;
      }

      setDragState((current) => current && current.targetId === targetId
        ? current
        : { sourceId: session.sourceId, targetId });
    };

    const handleMouseUp = () => {
      const session = dragSessionRef.current;
      document.body.classList.remove('is-dragging-column');

      if (session?.active) {
        setDragState((current) => {
          if (current && current.sourceId !== current.targetId) {
            moveCommittedColumn(current.sourceId, current.targetId);
          }

          return null;
        });
      } else {
        setDragState(null);
      }

      dragSessionRef.current = null;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <>
      <div className="section-header-inline">
        <h3>Список организаций</h3>
        <div className="row-actions">
          {React.isValidElement(actions)
            ? React.cloneElement(actions as React.ReactElement<{ className?: string; children?: React.ReactNode; 'aria-label'?: string; title?: string }>, {
              className: `${(actions.props as { className?: string }).className ?? ''} icon-button organization-table-action-button`.trim(),
              children: <TableActionIcon kind="add" />,
              'aria-label': 'Новая организация',
              title: 'Новая организация'
            })
            : actions}
          <button
            type="button"
            className="secondary-button button-inline icon-button organization-table-action-button"
            onClick={openSettings}
            aria-label="Колонки"
            title="Колонки"
          >
            <TableActionIcon kind="columns" />
          </button>
        </div>
      </div>

      <div className="table-shell organization-table-shell">
        <table className="data-table organization-data-table">
          <colgroup>
            {visibleColumns.map((column) => (
              <col key={column.id} style={{ width: `${column.width}px` }} />
            ))}
          </colgroup>

          <thead>
            <tr>
              {visibleColumns.map((column) => (
                <th
                  key={column.id}
                  data-column-id={column.id}
                  className={`${column.headerClassName ?? ''}${dragState?.sourceId === column.id ? ' organization-column-dragging' : ''}${dragState?.targetId === column.id ? ' organization-column-drop-target' : ''}`}
                  onMouseDown={(event) => startColumnDrag(event, column.id)}
                >
                  <div className="organization-table-header-cell">
                    <span>{column.title}</span>
                    <button
                      type="button"
                      className="organization-table-resize-handle"
                      aria-label={`Изменить ширину колонки ${column.title}`}
                      onMouseDown={(event) => startResize(event, column.id, column.width)}
                    />
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={visibleColumns.length}>
                  <div className="table-empty">{loading ? 'Загрузка...' : emptyText}</div>
                </td>
              </tr>
            ) : rows.map((row) => {
              const isSelected = selectedRowId !== undefined && row.id === selectedRowId;

              return (
                <tr
                  key={row.id}
                  className={`${onRowClick || onRowDoubleClick || onRowContextMenu ? 'table-row-clickable' : ''}${isSelected ? ' table-row-selected' : ''}`}
                  onClick={() => onRowClick?.(row)}
                  onDoubleClick={() => onRowDoubleClick?.(row)}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    onRowContextMenu?.(row, event);
                  }}
                >
                  {visibleColumns.map((column) => (
                    <td key={column.id} className={column.cellClassName}>{column.render(row)}</td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal
        open={settingsOpen}
        title="Настройка таблицы"
        onClose={() => setSettingsOpen(false)}
        actions={(
          <>
            <button type="button" className="primary-button action-button" onClick={() => setPendingAction('save')}>
              Обновить
            </button>
            <button type="button" className="secondary-button" onClick={() => setPendingAction('reset')}>
              Сбросить
            </button>
          </>
        )}
      >
        <div className="table-settings-shell">
          <div className="table-settings-list">
            {draftSettings.columns.map((column, index) => {
              const definition = COLUMN_DEFINITIONS[column.id];

              return (
                <div key={column.id} className="table-settings-item">
                  <label className="checkbox-option table-settings-toggle">
                    <input
                      type="checkbox"
                      checked={column.visible}
                      disabled={column.visible && draftVisibleCount === 1}
                      onChange={(event) => setDraftColumnVisibility(column.id, event.target.checked)}
                    />

                    <span>
                      <strong>{definition.title}</strong>
                      <span className="table-settings-meta">
                        Ширина: {column.width}px
                      </span>
                    </span>
                  </label>

                  <div className="table-settings-actions">
                    <button
                      type="button"
                      className="secondary-button button-inline icon-button table-settings-icon-button"
                      disabled={index === 0}
                      onClick={() => moveDraftColumnByOffset(column.id, -1)}
                      aria-label={`Переместить ${definition.title} выше`}
                      title="Выше"
                    >
                      <SettingsActionIcon kind="up" />
                    </button>
                    <button
                      type="button"
                      className="secondary-button button-inline icon-button table-settings-icon-button"
                      disabled={index === draftSettings.columns.length - 1}
                      onClick={() => moveDraftColumnByOffset(column.id, 1)}
                      aria-label={`Переместить ${definition.title} ниже`}
                      title="Ниже"
                    >
                      <SettingsActionIcon kind="down" />
                    </button>
                    <button
                      type="button"
                      className="secondary-button button-inline icon-button table-settings-icon-button"
                      onClick={() => setDraftColumnWidth(column.id, definition.defaultWidth)}
                      aria-label={`Сбросить ширину колонки ${definition.title}`}
                      title="Ширина по умолчанию"
                    >
                      <SettingsActionIcon kind="reset" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Modal>

      <Modal
        open={pendingAction !== null}
        title={pendingAction === 'reset' ? 'Подтверждение сброса' : 'Подтверждение сохранения'}
        onClose={() => setPendingAction(null)}
        maxWidth={520}
        actions={(
          <>
            <button type="button" className="secondary-button" onClick={() => setPendingAction(null)}>
              Отмена
            </button>
            <button
              type="button"
              className="primary-button action-button"
              onClick={() => {
                if (pendingAction === 'reset') {
                  const defaults = createDefaultSettings();
                  setSettings(defaults);
                  setDraftSettings(defaults);
                  setPendingAction(null);
                  showToast('Настройки сброшены.', 'info');
                  return;
                }

                setSettings(draftSettings);
                setSettingsOpen(false);
                setPendingAction(null);
                showToast('Настройки сохранены.', 'update');
              }}
            >
              Подтвердить
            </button>
          </>
        )}
      >
        <div className="empty-state">
          {pendingAction === 'reset'
            ? 'Сбросить настройки таблицы к значениям по умолчанию?'
            : 'Применить и сохранить изменения настроек таблицы?'}
        </div>
      </Modal>
    </>
  );
}
