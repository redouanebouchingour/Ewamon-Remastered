import type { KeyboardEvent, ReactNode } from 'react';
import s from './Table.module.css';
import { cssVars } from './cssVars';
import { cx } from './cx';
import { Icon } from './Icon';

export interface TableColumn<Row> {
  readonly key: string;
  readonly header: string;
  /** px */
  readonly width?: number;
  readonly align?: 'start' | 'end';
  readonly render: (row: Row) => ReactNode;
  readonly sortValue?: (row: Row) => number | string;
}

export interface TableProps<Row> {
  readonly columns: readonly TableColumn<Row>[];
  readonly rows: readonly Row[];
  readonly rowKey: (r: Row) => string;
  readonly sort?: { readonly key: string; readonly dir: 'asc' | 'desc' };
  readonly onSort?: (key: string) => void;
  readonly empty: ReactNode;
  readonly onRowClick?: (r: Row) => void;
  readonly className?: string;
  readonly selectedKey?: string | null;
  readonly caption?: string;
}

/** Client-side ordering by a column's sortValue (the caller decides whether the server already sorted). */
export function sortRows<Row>(rows: readonly Row[], columns: readonly TableColumn<Row>[], sort: TableProps<Row>['sort']): readonly Row[] {
  if (sort === undefined) return rows;
  const col = columns.find((c) => c.key === sort.key);
  if (col?.sortValue === undefined) return rows;
  const value = col.sortValue;
  const dir = sort.dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const va = value(a);
    const vb = value(b);
    return (va < vb ? -1 : va > vb ? 1 : 0) * dir;
  });
}

export function Table<Row>({ columns, rows, rowKey, sort, onSort, empty, onRowClick, className, selectedKey = null, caption }: TableProps<Row>) {
  const ordered = sortRows(rows, columns, sort);
  const onRowKey = (e: KeyboardEvent<HTMLTableRowElement>, r: Row): void => {
    if (onRowClick !== undefined && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onRowClick(r);
    }
  };
  return (
    <div data-testid="table" className={cx(s.wrap, className)}>
      <table className={s.table}>
        {caption !== undefined && <caption className="visually-hidden">{caption}</caption>}
        <colgroup>
          {columns.map((c) => (
            <col key={c.key} className={c.width !== undefined ? s.fixed : undefined} style={cssVars(c.width !== undefined ? { '--col-w': `${c.width}px` } : {})} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {columns.map((c) => {
              const active = sort?.key === c.key;
              const sortable = c.sortValue !== undefined && onSort !== undefined;
              return (
                <th
                  key={c.key}
                  scope="col"
                  className={cx(s.th, c.align === 'end' && s.end)}
                  aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                >
                  {sortable ? (
                    <button type="button" className={cx(s.sortBtn, active && s.sortActive)} onClick={() => onSort(c.key)}>
                      {c.header}
                      <Icon name={active && sort.dir === 'asc' ? 'arrowUp' : 'arrowDown'} size="sm" className={s.sortIcon} />
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {ordered.map((r) => {
            const key = rowKey(r);
            return (
              <tr
                key={key}
                className={cx(s.tr, onRowClick !== undefined && s.clickable, selectedKey === key && s.selected)}
                onClick={onRowClick !== undefined ? () => onRowClick(r) : undefined}
                onKeyDown={onRowClick !== undefined ? (e) => onRowKey(e, r) : undefined}
                tabIndex={onRowClick !== undefined ? 0 : undefined}
                aria-selected={onRowClick !== undefined ? selectedKey === key : undefined}
              >
                {columns.map((c) => (
                  <td key={c.key} className={cx(s.td, c.align === 'end' && s.end)}>
                    {c.render(r)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      {ordered.length === 0 && <div className={s.empty}>{empty}</div>}
    </div>
  );
}
