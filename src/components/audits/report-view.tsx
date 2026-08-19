"use client";

/**
 * The on-screen rendering of a `ReportSection[]` — the same component used
 * both inside the app (Review step) and on the public hosted report page, so
 * there is exactly one AURUM renderer, not one per surface. Only semantic
 * tokens: the `01`-`07` section numbers are the one Aurum-accent element per
 * page, table headers stay neutral, every figure is tabular.
 */

import type { KeyValueSection, ReportSection, TableSection } from "@/lib/audits/report-document";

export type ReportViewProps = {
  clientName: string;
  periodLabel: string;
  sections: ReportSection[];
  /** Called with the audit_rows this cell traces back to, e.g. to filter a row table below. */
  onDrillThrough?: (rowIndexes: number[]) => void;
};

function SectionHeading({ number, title }: { number: string; title: string }) {
  return (
    <h3
      className="flex items-center t-title-3"
      style={{ margin: "0 0 var(--space-4)", gap: "var(--space-3)", color: "var(--content-primary)" }}
    >
      <span aria-hidden="true" className="tabular" style={{ color: "var(--content-accent)", fontWeight: 700 }}>
        {number}
      </span>
      {title}
    </h3>
  );
}

function Footnote({ text }: { text: string }) {
  return (
    <span className="t-footnote" style={{ display: "block", color: "var(--content-tertiary)", fontWeight: 400 }}>
      {text}
    </span>
  );
}

function KeyValueBlock({ section }: { section: KeyValueSection }) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <caption className="sr-only">{section.title}</caption>
      <tbody>
        {section.rows.map((row) => (
          <tr key={row.label} style={{ background: row.highlighted ? "var(--fill-quiet)" : undefined }}>
            <td
              className="t-subhead"
              style={{
                padding: "var(--space-3) var(--space-4)",
                borderTop: "1px solid var(--stroke-hairline)",
                color: "var(--content-secondary)",
                fontWeight: row.highlighted ? 600 : 400,
              }}
            >
              {row.label}
              {row.footnote ? <Footnote text={row.footnote} /> : null}
            </td>
            <td
              className="t-subhead tabular"
              style={{
                padding: "var(--space-3) var(--space-4)",
                borderTop: "1px solid var(--stroke-hairline)",
                textAlign: "right",
                fontWeight: 600,
                color: row.highlighted ? "var(--content-accent)" : "var(--content-primary)",
              }}
            >
              {row.value}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TableBlock({ section, onDrillThrough }: { section: TableSection; onDrillThrough?: (rowIndexes: number[]) => void }) {
  return (
    <div className="flex flex-col" style={{ gap: "var(--space-3)" }}>
      {section.note ? (
        <p
          role="status"
          className="t-footnote"
          style={{
            margin: 0,
            padding: "var(--space-3) var(--space-4)",
            borderRadius: "var(--radius-sm)",
            background: "var(--fill-quiet)",
            color: "var(--content-secondary)",
          }}
        >
          {section.note}
        </p>
      ) : null}

      {section.rows.length === 0 && !section.note ? (
        <p className="t-subhead" style={{ margin: 0, color: "var(--content-tertiary)" }}>
          Nothing to show for this section.
        </p>
      ) : null}

      {section.rows.length > 0 ? (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "480px" }}>
            <caption className="sr-only">{section.title}</caption>
            <thead>
              <tr>
                {section.columns.map((column, i) => (
                  <th
                    key={column}
                    scope="col"
                    className="t-overline"
                    style={{
                      textAlign: i === 0 ? "left" : "right",
                      padding: "var(--space-2) var(--space-4)",
                      borderBottom: "1px solid var(--stroke-rim)",
                      color: "var(--content-secondary)",
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {section.rows.map((row, rowIdx) => {
                const clickable = onDrillThrough && row.sourceRowIndexes && row.sourceRowIndexes.length > 0;
                const Wrapper = clickable ? "button" : "span";
                return (
                  <tr key={rowIdx}>
                    {row.cells.map((c, cellIdx) => (
                      <td
                        key={cellIdx}
                        className={cellIdx === 0 ? "t-subhead" : "t-subhead tabular"}
                        style={{
                          padding: "var(--space-3) var(--space-4)",
                          borderTop: "1px solid var(--stroke-hairline)",
                          textAlign: cellIdx === 0 ? "left" : "right",
                          color: "var(--content-primary)",
                          verticalAlign: "top",
                        }}
                      >
                        {cellIdx === section.columns.length - 1 && clickable ? (
                          <Wrapper
                            type={clickable ? "button" : undefined}
                            onClick={clickable ? () => onDrillThrough!(row.sourceRowIndexes!) : undefined}
                            className="t-subhead"
                            style={{
                              display: "inline",
                              padding: 0,
                              margin: 0,
                              background: "transparent",
                              border: 0,
                              textAlign: "left",
                              color: clickable ? "var(--signal-link)" : "var(--content-primary)",
                              textDecoration: clickable ? "underline" : undefined,
                              cursor: clickable ? "pointer" : undefined,
                            }}
                          >
                            {c.text}
                          </Wrapper>
                        ) : (
                          c.text
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

export function ReportView({ clientName, periodLabel, sections, onDrillThrough }: ReportViewProps) {
  return (
    <div className="flex flex-col" style={{ gap: "var(--space-8)" }}>
      <header>
        <p className="t-overline" style={{ margin: "0 0 var(--space-2)", color: "var(--content-tertiary)" }}>
          Call Audit Performance Report
        </p>
        <h2 className="t-title-1" style={{ margin: 0, color: "var(--content-primary)" }}>
          {clientName}
        </h2>
        {periodLabel ? (
          <p className="t-subhead" style={{ margin: "var(--space-1) 0 0", color: "var(--content-secondary)" }}>
            {periodLabel}
          </p>
        ) : null}
      </header>

      {sections.map((section) => (
        <section key={section.number}>
          <SectionHeading number={section.number} title={section.title} />
          {section.kind === "key-value" ? (
            <KeyValueBlock section={section} />
          ) : (
            <TableBlock section={section} onDrillThrough={onDrillThrough} />
          )}
        </section>
      ))}
    </div>
  );
}
