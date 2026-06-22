import React, { useEffect, useMemo, useRef, useState } from 'react';
import { showToast } from '../app/toast';
import { AppLoader } from './AppLoader';
import { Modal } from './Modal';

export interface DataTableColumn<T> {
  key: string;
  title: string;
  render: (row: T) => React.ReactNode;
  className?: string;
  headerClassName?: string;
  width?: number;
  minWidth?: number;
  visible?: boolean;
  canHide?: boolean;
  mobileLabel?: string;
  mobileVisible?: boolean;
  isPrimary?: boolean;
  isActions?: boolean;
  priority?: number;
}

export type DataTableDisplayMode = 'auto' | 'table' | 'cards';

interface DataTableProps<T> {
  rows: T[];
  columns: Array<DataTableColumn<T>>;
  getRowKey: (row: T) => string | number;
  emptyText?: string;
  loading?: boolean;
  onRowClick?: (row: T) => void;
  onRowDoubleClick?: (row: T) => void;
  onRowContextMenu?: (row: T, event: React.MouseEvent<HTMLTableRowElement>) => void;
  selectedRowKey?: string | number;
  settingsKey?: string;
  actions?: React.ReactNode;
  title?: React.ReactNode;
  className?: string;
  tableClassName?: string;
  mobileActions?: (row: T) => React.ReactNode;
  displayMode?: DataTableDisplayMode;
}

interface ResolvedDataTableColumn<T> extends Omit<DataTableColumn<T>, 'minWidth'> {
  minWidth: number;
  defaultWidth: number;
  initialVisible: boolean;
  canHide: boolean;
}

interface DataTableColumnSetting {
  key: string;
  visible: boolean;
  width: number;
}

interface DataTableSettings {
  columns: DataTableColumnSetting[];
}

interface ColumnDragState {
  sourceId: string;
  targetId: string;
}

type PendingTableSettingsAction = 'reset' | 'save';

function ColumnsActionIcon() {
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

function createDefaultSettings<T>(columns: ResolvedDataTableColumn<T>[]): DataTableSettings {
  const normalizedColumns = columns.map((column) => ({
    key: column.key,
    visible: column.canHide ? column.initialVisible : true,
    width: Math.max(column.minWidth ?? 96, Math.round(column.defaultWidth))
  }));

  if (normalizedColumns.length > 0 && normalizedColumns.every((column) => !column.visible)) {
    normalizedColumns[0] = { ...normalizedColumns[0], visible: true };
  }

  return { columns: normalizedColumns };
}

function normalizeSettings<T>(value: unknown, columns: ResolvedDataTableColumn<T>[]): DataTableSettings {
  if (!value || typeof value !== 'object' || !Array.isArray((value as DataTableSettings).columns)) {
    return createDefaultSettings(columns);
  }

  const knownKeys = new Set(columns.map((column) => column.key));
  const incomingColumns = (value as DataTableSettings).columns
    .filter((column): column is DataTableColumnSetting => {
      if (!column || typeof column !== 'object') {
        return false;
      }

      return typeof column.key === 'string'
        && knownKeys.has(column.key)
        && typeof column.visible === 'boolean'
        && typeof column.width === 'number';
    })
    .filter((column, index, source) => source.findIndex((item) => item.key === column.key) === index);

  const incoming = new Map(incomingColumns.map((column) => [column.key, column]));
  const normalizedColumns = columns.map((column) => {
    const stored = incoming.get(column.key);

    return {
      key: column.key,
      visible: column.canHide ? (stored?.visible ?? column.initialVisible) : true,
      width: Math.max(column.minWidth ?? 96, Math.round(stored?.width ?? column.defaultWidth))
    };
  });

  if (normalizedColumns.length > 0 && normalizedColumns.every((column) => !column.visible)) {
    normalizedColumns[0] = { ...normalizedColumns[0], visible: true };
  }

  return { columns: normalizedColumns };
}

function loadSettings<T>(settingsKey: string | undefined, columns: ResolvedDataTableColumn<T>[]): DataTableSettings {
  if (!settingsKey || typeof window === 'undefined') {
    return createDefaultSettings(columns);
  }

  try {
    const raw = window.localStorage.getItem(settingsKey);
    if (!raw) {
      return createDefaultSettings(columns);
    }

    return normalizeSettings(JSON.parse(raw), columns);
  } catch {
    return createDefaultSettings(columns);
  }
}

function reorderColumns(columns: DataTableColumnSetting[], sourceId: string, targetId: string) {
  if (sourceId === targetId) {
    return columns;
  }

  const next = [...columns];
  const fromIndex = next.findIndex((column) => column.key === sourceId);
  const toIndex = next.findIndex((column) => column.key === targetId);

  if (fromIndex < 0 || toIndex < 0) {
    return columns;
  }

  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

export function DataTable<T>({
  rows,
  columns,
  getRowKey,
  emptyText = 'Нет данных',
  loading = false,
  onRowClick,
  onRowDoubleClick,
  onRowContextMenu,
  selectedRowKey,
  settingsKey,
  actions,
  title,
  className,
  tableClassName,
  mobileActions,
  displayMode = 'auto'
}: DataTableProps<T>) {
  const resolvedColumns = useMemo(() => {
    const seen = new Set<string>();

    return columns
      .filter((column) => {
        if (seen.has(column.key)) {
          return false;
        }

        seen.add(column.key);
        return true;
      })
      .map((column) => {
        const minWidth = Math.max(72, Math.round(column.minWidth ?? 96));
        const canHide = column.canHide !== false;
        const defaultWidth = Math.max(minWidth, Math.round(column.width ?? Math.max(minWidth, 180)));

        return {
          ...column,
          minWidth,
          defaultWidth,
          canHide,
          initialVisible: canHide ? column.visible !== false : true
        };
      });
  }, [columns]);

  const resolvedColumnMap = useMemo(
    () => new Map(resolvedColumns.map((column) => [column.key, column])),
    [resolvedColumns]
  );

  const columnsSignature = useMemo(
    () => resolvedColumns
      .map((column) => `${column.key}:${column.initialVisible ? 1 : 0}:${column.defaultWidth}:${column.minWidth}:${column.canHide ? 1 : 0}`)
      .join('|'),
    [resolvedColumns]
  );

  const tableEnabled = displayMode !== 'cards';
  const cardsEnabled = displayMode !== 'table';
  const configurable = tableEnabled && !!settingsKey && resolvedColumns.length > 0;
  const [settings, setSettings] = useState<DataTableSettings>(() => loadSettings(settingsKey, resolvedColumns));
  const [draftSettings, setDraftSettings] = useState<DataTableSettings>(() => loadSettings(settingsKey, resolvedColumns));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingTableSettingsAction | null>(null);
  const [dragState, setDragState] = useState<ColumnDragState | null>(null);
  const dragSessionRef = useRef<{
    sourceId: string;
    startX: number;
    startY: number;
    active: boolean;
  } | null>(null);

  useEffect(() => {
    const loaded = loadSettings(settingsKey, resolvedColumns);
    setSettings(loaded);
    setDraftSettings(loaded);
  }, [columnsSignature, settingsKey]);

  useEffect(() => {
    if (!configurable || typeof window === 'undefined' || !settingsKey) {
      return;
    }

    window.localStorage.setItem(settingsKey, JSON.stringify(settings));
  }, [configurable, settings, settingsKey]);

  const visibleColumns = useMemo(
    () => settings.columns
      .filter((column) => column.visible)
      .map((column) => {
        const definition = resolvedColumnMap.get(column.key);

        return definition
          ? { ...definition, width: column.width }
          : null;
      })
      .filter((column): column is ResolvedDataTableColumn<T> & { width: number } => !!column),
    [resolvedColumnMap, settings.columns]
  );

  const cardColumns = useMemo(
    () => resolvedColumns.filter((column) => column.initialVisible),
    [resolvedColumns]
  );

  const tableMinWidth = useMemo(
    () => Math.max(
      configurable ? 920 : 640,
      visibleColumns.reduce((total, column) => total + column.width, 0)
    ),
    [configurable, visibleColumns]
  );

  const visibleDraftColumnCount = useMemo(
    () => draftSettings.columns.filter((column) => column.visible).length,
    [draftSettings.columns]
  );

  const primaryCardColumn = useMemo(
    () => cardColumns.find((column) => column.isPrimary)
      ?? cardColumns.find((column) => !column.isActions)
      ?? cardColumns[0],
    [cardColumns]
  );

  const actionCardColumns = useMemo(
    () => cardColumns.filter((column) => column.isActions),
    [cardColumns]
  );

  const detailCardColumns = useMemo(
    () => cardColumns
      .filter((column) => column.key !== primaryCardColumn?.key)
      .filter((column) => !column.isActions)
      .filter((column) => column.mobileVisible !== false)
      .sort((left, right) => (left.priority ?? 100) - (right.priority ?? 100)),
    [cardColumns, primaryCardColumn?.key]
  );

  const shellClassName = [
    'table-shell',
    `data-table-mode-${displayMode}`,
    configurable ? 'data-table-shell-configurable' : null,
    className
  ]
    .filter(Boolean)
    .join(' ');

  const resolvedTableClassName = ['data-table', configurable ? 'data-table-configurable' : null, tableClassName]
    .filter(Boolean)
    .join(' ');

  const updateSettings = (updater: (current: DataTableSettings) => DataTableSettings) => {
    setSettings((current) => normalizeSettings(updater(current), resolvedColumns));
  };

  const updateDraftSettings = (updater: (current: DataTableSettings) => DataTableSettings) => {
    setDraftSettings((current) => normalizeSettings(updater(current), resolvedColumns));
  };

  const moveCommittedColumn = (sourceId: string, targetId: string) => {
    updateSettings((current) => ({
      columns: reorderColumns(current.columns, sourceId, targetId)
    }));
  };

  const moveDraftColumnByOffset = (columnKey: string, offset: -1 | 1) => {
    updateDraftSettings((current) => {
      const index = current.columns.findIndex((column) => column.key === columnKey);
      const nextIndex = index + offset;

      if (index < 0 || nextIndex < 0 || nextIndex >= current.columns.length) {
        return current;
      }

      const nextColumns = [...current.columns];
      const [moved] = nextColumns.splice(index, 1);
      nextColumns.splice(nextIndex, 0, moved);
      return { columns: nextColumns };
    });
  };

  const setDraftColumnVisibility = (columnKey: string, visible: boolean) => {
    updateDraftSettings((current) => ({
      columns: current.columns.map((column) => {
        if (column.key !== columnKey) {
          return column;
        }

        return { ...column, visible };
      })
    }));
  };

  const setCommittedColumnWidth = (columnKey: string, width: number) => {
    const minWidth = resolvedColumnMap.get(columnKey)?.minWidth ?? 96;

    updateSettings((current) => ({
      columns: current.columns.map((column) => column.key === columnKey
        ? { ...column, width: Math.max(minWidth, Math.round(width)) }
        : column)
    }));
  };

  const setDraftColumnWidth = (columnKey: string, width: number) => {
    const minWidth = resolvedColumnMap.get(columnKey)?.minWidth ?? 96;

    updateDraftSettings((current) => ({
      columns: current.columns.map((column) => column.key === columnKey
        ? { ...column, width: Math.max(minWidth, Math.round(width)) }
        : column)
    }));
  };

  const openSettings = () => {
    setDraftSettings(settings);
    setSettingsOpen(true);
  };

  const startResize = (event: React.MouseEvent<HTMLButtonElement>, columnKey: string, width: number) => {
    event.preventDefault();
    event.stopPropagation();

    const startX = event.clientX;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      setCommittedColumnWidth(columnKey, width + delta);
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const startColumnDrag = (event: React.MouseEvent<HTMLTableCellElement>, columnKey: string) => {
    if (!configurable || event.button !== 0) {
      return;
    }

    dragSessionRef.current = {
      sourceId: columnKey,
      startX: event.clientX,
      startY: event.clientY,
      active: false
    };

    const resolveTargetId = (clientX: number, clientY: number) => {
      const target = document.elementFromPoint(clientX, clientY)?.closest('th[data-column-id]');
      const targetId = target?.getAttribute('data-column-id');

      return targetId && resolvedColumnMap.has(targetId) ? targetId : null;
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

  const showHeader = !!title || !!actions || configurable;
  const renderedTitle = typeof title === 'string' ? <h3>{title}</h3> : title;

  return (
    <>
      {showHeader ? (
        <div className="section-header-inline">
          <div>{renderedTitle}</div>

          <div className="row-actions">
            {actions}

            {configurable ? (
              <button
                type="button"
                className="secondary-button button-inline icon-button data-table-action-button"
                onClick={openSettings}
                aria-label="Колонки"
                title="Колонки"
              >
                <ColumnsActionIcon />
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className={shellClassName}>
        {tableEnabled ? (
        <table className={resolvedTableClassName} style={{ minWidth: `${tableMinWidth}px` }}>
          {visibleColumns.length > 0 ? (
            <colgroup>
              {visibleColumns.map((column) => (
                <col key={column.key} style={{ width: `${column.width}px` }} />
              ))}
            </colgroup>
          ) : null}

          <thead>
            <tr>
              {visibleColumns.map((column) => {
                const titleText = column.title.trim() || column.key;

                return (
                  <th
                    key={column.key}
                    data-column-id={column.key}
                    className={[
                      column.headerClassName,
                      configurable ? 'data-table-configurable-header' : null,
                      dragState?.sourceId === column.key ? 'data-table-column-dragging' : null,
                      dragState?.targetId === column.key ? 'data-table-column-drop-target' : null
                    ].filter(Boolean).join(' ')}
                    onMouseDown={configurable ? (event) => startColumnDrag(event, column.key) : undefined}
                  >
                    <div className="data-table-header-cell">
                      <span>{column.title}</span>

                      {configurable ? (
                        <button
                          type="button"
                          className="data-table-resize-handle"
                          aria-label={`Изменить ширину колонки ${titleText}`}
                          onMouseDown={(event) => startResize(event, column.key, column.width)}
                        />
                      ) : null}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={Math.max(visibleColumns.length, 1)}>
                  <div className="table-empty">{loading ? null : emptyText}</div>
                </td>
              </tr>
            ) : rows.map((row) => {
              const rowKey = getRowKey(row);
              const isSelected = selectedRowKey !== undefined && String(selectedRowKey) === String(rowKey);

              return (
                <tr
                  key={String(rowKey)}
                  className={`${onRowClick || onRowDoubleClick || onRowContextMenu ? 'table-row-clickable' : ''}${isSelected ? ' table-row-selected' : ''}`}
                  onClick={() => onRowClick?.(row)}
                  onDoubleClick={() => onRowDoubleClick?.(row)}
                  onContextMenu={(event) => {
                    if (!onRowContextMenu) {
                      return;
                    }

                    event.preventDefault();
                    onRowContextMenu(row, event);
                  }}
                >
                  {visibleColumns.map((column) => (
                    <td key={column.key} className={column.className}>{column.render(row)}</td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
        ) : null}

        {loading ? (
          <div className="table-loading-overlay">
            <AppLoader variant="inline" label={rows.length > 0 ? 'Обновляем таблицу' : 'Загружаем таблицу'} />
          </div>
        ) : null}

        {cardsEnabled ? (
        <div className="data-table-card-list">
          {rows.length === 0 ? (
            <div className="data-table-card-empty">{loading ? null : emptyText}</div>
          ) : rows.map((row) => {
            const rowKey = getRowKey(row);
            const isSelected = selectedRowKey !== undefined && String(selectedRowKey) === String(rowKey);

            const openRow = () => onRowClick?.(row);

            return (
              <div
                key={String(rowKey)}
                role={onRowClick || onRowDoubleClick ? 'button' : undefined}
                tabIndex={onRowClick || onRowDoubleClick ? 0 : undefined}
                className={`data-table-card${isSelected ? ' selected' : ''}`}
                onClick={openRow}
                onDoubleClick={() => onRowDoubleClick?.(row)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    onRowDoubleClick?.(row);
                    return;
                  }

                  if (event.key === ' ') {
                    event.preventDefault();
                    openRow();
                  }
                }}
              >
                <div className="data-table-card-head">
                  <div className="data-table-card-title">
                    {primaryCardColumn ? primaryCardColumn.render(row) : String(rowKey)}
                  </div>

                  {mobileActions || actionCardColumns.length > 0 ? (
                    <div className="data-table-card-actions" onClick={(event) => event.stopPropagation()}>
                      {mobileActions
                        ? mobileActions(row)
                        : actionCardColumns.map((column) => (
                          <React.Fragment key={column.key}>{column.render(row)}</React.Fragment>
                        ))}
                    </div>
                  ) : null}
                </div>

                {detailCardColumns.length > 0 ? (
                  <div className="data-table-card-fields">
                    {detailCardColumns.map((column) => (
                      <div key={column.key} className="data-table-card-field">
                        <span>{column.mobileLabel ?? column.title}</span>
                        <strong>{column.render(row)}</strong>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
        ) : null}
      </div>

      <Modal
        open={configurable && settingsOpen}
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
              const definition = resolvedColumnMap.get(column.key);
              if (!definition) {
                return null;
              }

              const titleText = definition.title.trim() || definition.key;

              return (
                <div key={column.key} className="table-settings-item">
                  <label className="checkbox-option table-settings-toggle">
                    <input
                      type="checkbox"
                      aria-label={`Показать колонку ${titleText}`}
                      checked={definition.canHide ? column.visible : true}
                      disabled={!definition.canHide || (column.visible && visibleDraftColumnCount === 1)}
                      onChange={(event) => setDraftColumnVisibility(column.key, event.target.checked)}
                    />

                    <span>
                      <strong>{titleText}</strong>
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
                      onClick={() => moveDraftColumnByOffset(column.key, -1)}
                      aria-label={`Переместить ${titleText} выше`}
                      title="Выше"
                    >
                      <SettingsActionIcon kind="up" />
                    </button>
                    <button
                      type="button"
                      className="secondary-button button-inline icon-button table-settings-icon-button"
                      disabled={index === draftSettings.columns.length - 1}
                      onClick={() => moveDraftColumnByOffset(column.key, 1)}
                      aria-label={`Переместить ${titleText} ниже`}
                      title="Ниже"
                    >
                      <SettingsActionIcon kind="down" />
                    </button>
                    <button
                      type="button"
                      className="secondary-button button-inline icon-button table-settings-icon-button"
                      onClick={() => setDraftColumnWidth(column.key, definition.defaultWidth)}
                      aria-label={`Сбросить ширину колонки ${titleText}`}
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
        open={configurable && pendingAction !== null}
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
                  const defaults = createDefaultSettings(resolvedColumns);
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
