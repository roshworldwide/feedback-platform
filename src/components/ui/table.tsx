"use client";

/**
 * DataTable.
 *
 * A list never truncates silently. The footer always states the true total —
 * "Showing 1–25 of 160" — and the rows-per-page control is next to it, so the
 * shape of the data is never hidden by the shape of the page.
 *
 * Sticky header, sortable columns, tabular numerals, hover but no zebra: the
 * stripe is decoration and decoration in a table is noise.
 */

import * as React from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronsUpDown,
  Columns3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { Checkbox } from "./toggle";
import { Select } from "./field";
import { Skeleton } from "./skeleton";

export type SortDirection = "asc" | "desc";
export type SortState = { id: string; direction: SortDirection };

export type Column<Row> = {
  /** Stable key — also the sort identifier. */
  id: string;
  header: string;
  render: (row: Row) => React.ReactNode;
  /** Provide to make the column sortable. null sorts last, always. */
  sortValue?: (row: Row) => string | number | null;
  /** Right-aligns and keeps figures tabular. */
  numeric?: boolean;
  width?: string;
  /** Starts hidden but can be switched on. */
  defaultHidden?: boolean;
  /** May never be hidden — the row would stop identifying itself. */
  required?: boolean;
};

export type DataTableProps<Row> = {
  rows: Row[];
  columns: Column<Row>[];
  rowKey: (row: Row) => string;
  /** Read by screen readers before the table. Sentence case. */
  caption: string;
  /**
   * The TRUE total. Give this whenever `rows` is a server-side page; without
   * it the footer would state the page size as if it were the whole set.
   */
  total?: number;
  /** Controlled (1-based) page. Supplying both switches off client slicing. */
  page?: number;
  onPageChange?: (page: number) => void;
  pageSize?: number;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  sort?: SortState | null;
  onSortChange?: (sort: SortState | null) => void;
  loading?: boolean;
  /** Shown in place of the body when there is nothing to show. */
  emptyState?: React.ReactNode;
  onRowClick?: (row: Row) => void;
  stickyHeader?: boolean;
  /** Set to cap the scroll area; the header stays put inside it. */
  maxHeight?: string;
  columnToggle?: boolean;
  className?: string;
};

function compare(a: string | number | null, b: string | number | null): number {
  // Unknown values sort last in both directions — an absence is not a low score.
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true });
}

export function DataTable<Row>({
  rows,
  columns,
  rowKey,
  caption,
  total,
  page,
  onPageChange,
  pageSize,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  sort,
  onSortChange,
  loading = false,
  emptyState,
  onRowClick,
  stickyHeader = true,
  maxHeight,
  columnToggle = true,
  className,
}: DataTableProps<Row>) {
  const serverPaged = page !== undefined && onPageChange !== undefined;
  const serverSorted = onSortChange !== undefined;

  const [internalPage, setInternalPage] = React.useState(1);
  const [internalSize, setInternalSize] = React.useState(pageSizeOptions[1] ?? 25);
  const [internalSort, setInternalSort] = React.useState<SortState | null>(null);
  const [hidden, setHidden] = React.useState<Set<string>>(
    () => new Set(columns.filter((column) => column.defaultHidden).map((c) => c.id)),
  );
  const [menuOpen, setMenuOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement | null>(null);
  const sizeSelectId = React.useId();

  const currentPage = serverPaged ? page : internalPage;
  const size = pageSize ?? internalSize;
  const currentSort = sort !== undefined ? sort : internalSort;

  const visibleColumns = columns.filter((column) => !hidden.has(column.id));

  const sortedRows = React.useMemo(() => {
    if (serverSorted || !currentSort) return rows;
    const column = columns.find((item) => item.id === currentSort.id);
    if (!column?.sortValue) return rows;
    const getValue = column.sortValue;
    const factor = currentSort.direction === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => compare(getValue(a), getValue(b)) * factor);
  }, [rows, columns, currentSort, serverSorted]);

  const trueTotal = total ?? sortedRows.length;
  const pageCount = Math.max(1, Math.ceil(trueTotal / size));
  const safePage = Math.min(Math.max(1, currentPage), pageCount);
  const start = (safePage - 1) * size;
  const pageRows = serverPaged ? rows : sortedRows.slice(start, start + size);
  const firstShown = trueTotal === 0 ? 0 : start + 1;
  const lastShown = trueTotal === 0 ? 0 : start + pageRows.length;

  function goTo(next: number) {
    const clamped = Math.min(Math.max(1, next), pageCount);
    if (serverPaged) onPageChange(clamped);
    else setInternalPage(clamped);
  }

  function changeSize(next: number) {
    if (onPageSizeChange) onPageSizeChange(next);
    else setInternalSize(next);
    goTo(1);
  }

  function toggleSort(column: Column<Row>) {
    if (!column.sortValue && !serverSorted) return;
    let next: SortState | null;
    if (currentSort?.id !== column.id) next = { id: column.id, direction: "asc" };
    else if (currentSort.direction === "asc")
      next = { id: column.id, direction: "desc" };
    else next = null;

    if (onSortChange) onSortChange(next);
    else setInternalSort(next);
    goTo(1);
  }

  // The column menu closes on an outside press and on Escape, like every menu.
  React.useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  const headCellStyle: React.CSSProperties = {
    position: stickyHeader ? "sticky" : undefined,
    top: stickyHeader ? 0 : undefined,
    zIndex: stickyHeader ? 1 : undefined,
    background: "var(--surface-raised)",
    borderBottom: "1px solid var(--stroke-rim)",
    padding: 0,
    textAlign: "left",
    whiteSpace: "nowrap",
  };

  return (
    <div className={cn("flex flex-col", className)} style={{ gap: "var(--space-3)" }}>
      {columnToggle ? (
        <div
          ref={menuRef}
          className="relative flex justify-end"
          style={{ zIndex: 3 }}
        >
          <Button
            size="s"
            variant="plain"
            leadingIcon={Columns3}
            aria-expanded={menuOpen}
            aria-haspopup="true"
            onClick={() => setMenuOpen((open) => !open)}
          >
            Columns
          </Button>
          {menuOpen ? (
            <div
              role="group"
              aria-label="Show columns"
              style={{
                position: "absolute",
                top: "calc(100% + var(--space-2))",
                right: 0,
                minWidth: "220px",
                padding: "var(--space-3)",
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-1)",
                background: "var(--surface-raised)",
                border: "1px solid var(--stroke-rim)",
                borderRadius: "var(--radius-lg)",
                boxShadow: "var(--e3)",
              }}
            >
              {columns.map((column) => (
                <Checkbox
                  key={column.id}
                  checked={!hidden.has(column.id)}
                  disabled={column.required}
                  label={column.header}
                  onCheckedChange={(checked) =>
                    setHidden((previous) => {
                      const next = new Set(previous);
                      if (checked) next.delete(column.id);
                      else next.add(column.id);
                      return next;
                    })
                  }
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <div
        style={{
          overflow: "auto",
          maxHeight,
          background: "var(--surface-raised)",
          border: "1px solid var(--stroke-rim)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--e1)",
        }}
      >
        <table
          style={{
            width: "100%",
            borderCollapse: "separate",
            borderSpacing: 0,
            fontFamily: "var(--font-text)",
          }}
        >
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              {visibleColumns.map((column) => {
                const sortable = Boolean(column.sortValue) || serverSorted;
                const active = currentSort?.id === column.id;
                const SortIcon = !active
                  ? ChevronsUpDown
                  : currentSort.direction === "asc"
                    ? ChevronUp
                    : ChevronDown;
                return (
                  <th
                    key={column.id}
                    scope="col"
                    style={{ ...headCellStyle, width: column.width }}
                    aria-sort={
                      active
                        ? currentSort.direction === "asc"
                          ? "ascending"
                          : "descending"
                        : sortable
                          ? "none"
                          : undefined
                    }
                  >
                    {sortable ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(column)}
                        className="t-overline"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "var(--space-1)",
                          width: "100%",
                          minHeight: "44px",
                          padding: "var(--space-2) var(--space-4)",
                          justifyContent: column.numeric ? "flex-end" : "flex-start",
                          background: "transparent",
                          border: 0,
                          color: active
                            ? "var(--content-primary)"
                            : "var(--content-secondary)",
                          cursor: "pointer",
                        }}
                      >
                        {column.header}
                        <SortIcon size={12} strokeWidth={2} aria-hidden="true" />
                      </button>
                    ) : (
                      <span
                        className="t-overline"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          minHeight: "44px",
                          padding: "var(--space-2) var(--space-4)",
                          justifyContent: column.numeric ? "flex-end" : "flex-start",
                          color: "var(--content-secondary)",
                        }}
                      >
                        {column.header}
                      </span>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {loading
              ? Array.from({ length: Math.min(size, 6) }, (_, rowIndex) => (
                  <tr key={`skeleton-${rowIndex}`}>
                    {visibleColumns.map((column) => (
                      <td
                        key={column.id}
                        style={{
                          padding: "var(--space-3) var(--space-4)",
                          borderTop: "1px solid var(--stroke-hairline)",
                        }}
                      >
                        <Skeleton height="var(--space-4)" />
                      </td>
                    ))}
                  </tr>
                ))
              : pageRows.map((row) => (
                  <tr
                    key={rowKey(row)}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    tabIndex={onRowClick ? 0 : undefined}
                    onKeyDown={
                      onRowClick
                        ? (event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              onRowClick(row);
                            }
                          }
                        : undefined
                    }
                    className={cn(
                      // Hover, never zebra.
                      "hover:bg-quiet",
                      onRowClick && "cursor-pointer",
                    )}
                    style={{
                      transition: "background-color var(--dur-glide) var(--ease-glide)",
                    }}
                  >
                    {visibleColumns.map((column) => (
                      <td
                        key={column.id}
                        className={cn("t-subhead", column.numeric && "tabular")}
                        style={{
                          padding: "var(--space-3) var(--space-4)",
                          borderTop: "1px solid var(--stroke-hairline)",
                          textAlign: column.numeric ? "right" : "left",
                          color: "var(--content-primary)",
                          verticalAlign: "middle",
                          // Content wraps. It is never cut off without saying so.
                          whiteSpace: "normal",
                        }}
                      >
                        {column.render(row)}
                      </td>
                    ))}
                  </tr>
                ))}
          </tbody>
        </table>

        {!loading && pageRows.length === 0 ? (
          <div style={{ borderTop: "1px solid var(--stroke-hairline)" }}>
            {emptyState ?? (
              <p
                className="t-subhead"
                style={{
                  margin: 0,
                  padding: "var(--space-12) var(--space-6)",
                  textAlign: "center",
                  color: "var(--content-secondary)",
                }}
              >
                Nothing to show yet.
              </p>
            )}
          </div>
        ) : null}
      </div>

      {/* The footer states the true total, always. */}
      <div
        className="flex flex-wrap items-center justify-between"
        style={{ gap: "var(--space-3)" }}
      >
        <p
          className="t-footnote tabular"
          aria-live="polite"
          style={{ margin: 0, color: "var(--content-secondary)" }}
        >
          Showing {firstShown}–{lastShown} of {trueTotal}
        </p>

        <div className="flex items-center" style={{ gap: "var(--space-3)" }}>
          <label
            className="t-footnote"
            style={{ color: "var(--content-secondary)" }}
            htmlFor={sizeSelectId}
          >
            Rows
          </label>
          <Select
            id={sizeSelectId}
            aria-label="Rows per page"
            value={String(size)}
            onChange={(event) => changeSize(Number(event.currentTarget.value))}
            options={pageSizeOptions.map((option) => ({
              value: String(option),
              label: String(option),
            }))}
            style={{ width: "auto", minWidth: "96px" }}
          />

          <div className="flex items-center" style={{ gap: "var(--space-1)" }}>
            <Button
              size="s"
              variant="plain"
              leadingIcon={ChevronLeft}
              aria-label="Previous page"
              disabled={safePage <= 1}
              onClick={() => goTo(safePage - 1)}
            />
            <span
              className="t-footnote tabular"
              style={{ color: "var(--content-secondary)" }}
            >
              Page {safePage} of {pageCount}
            </span>
            <Button
              size="s"
              variant="plain"
              leadingIcon={ChevronRight}
              aria-label="Next page"
              disabled={safePage >= pageCount}
              onClick={() => goTo(safePage + 1)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
