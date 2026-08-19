/**
 * The PDF rendering of a `ReportSection[]` — literal colours only, since
 * `@react-pdf/renderer` has its own layout engine (no CSS custom properties,
 * no browser, no headless Chrome). Values are pulled from the existing
 * `paletteFor()` email palette rather than re-derived, so this and the email
 * layer read the same literal hex for the same AURUM role. The `01`-`07`
 * section numbers are the one place the accent colour is used; table headers
 * stay neutral, matching the on-screen and email renderers' same rule.
 */

import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { paletteFor } from "@/lib/email/palette";
import type { KeyValueSection, ReportSection, TableSection } from "@/lib/audits/report-document";

const palette = paletteFor("convin-premium");

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, fontFamily: "Helvetica", color: palette.ink },
  eyebrow: { fontSize: 8, letterSpacing: 1.2, color: palette.inkFaint, marginBottom: 4, textTransform: "uppercase" },
  title: { fontSize: 20, fontWeight: 700, color: palette.ink, marginBottom: 2 },
  subtitle: { fontSize: 10, color: palette.inkMuted, marginBottom: 24 },
  sectionHeading: { flexDirection: "row", alignItems: "center", marginTop: 18, marginBottom: 8 },
  sectionNumber: { fontSize: 12, fontWeight: 700, color: palette.accent, marginRight: 8 },
  sectionTitle: { fontSize: 12, fontWeight: 700, color: palette.ink },
  note: {
    fontSize: 9,
    color: palette.inkMuted,
    backgroundColor: palette.quoteBg,
    padding: 8,
    borderRadius: 4,
    marginBottom: 8,
  },
  kvRow: { flexDirection: "row", borderTopWidth: 1, borderTopColor: palette.hairline, paddingVertical: 6 },
  kvRowHighlight: { backgroundColor: palette.headerBg },
  kvLabel: { flex: 2, color: palette.inkMuted },
  kvLabelHighlight: { color: palette.headerInk, fontWeight: 700 },
  kvValue: { flex: 1, textAlign: "right", fontWeight: 700, color: palette.ink },
  kvValueHighlight: { color: palette.headerInk },
  tableHead: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: palette.hairline, paddingBottom: 4 },
  tableHeadCell: { fontSize: 8, fontWeight: 700, color: palette.inkMuted, textTransform: "uppercase" },
  tableRow: { flexDirection: "row", borderTopWidth: 1, borderTopColor: palette.hairline, paddingVertical: 6 },
  tableCell: { fontSize: 9, color: palette.ink, paddingRight: 6 },
});

function KeyValueBlock({ section }: { section: KeyValueSection }) {
  return (
    <View>
      {section.rows.map((row) => (
        <View key={row.label} style={[styles.kvRow, row.highlighted ? styles.kvRowHighlight : undefined]} wrap={false}>
          <Text style={[styles.kvLabel, row.highlighted ? styles.kvLabelHighlight : undefined]}>{row.label}</Text>
          <Text style={[styles.kvValue, row.highlighted ? styles.kvValueHighlight : undefined]}>{row.value}</Text>
        </View>
      ))}
    </View>
  );
}

/** Column widths favour the first (label-like) column; the rest share the remainder equally. */
function columnFlex(count: number, index: number): number {
  if (count <= 1) return 1;
  return index === 0 ? 2 : 1;
}

/**
 * The base-14 Helvetica this renderer uses has no glyph for "→" (U+2192) —
 * it silently substitutes a stray apostrophe instead of failing loudly. The
 * on-screen and hosted-page renderers are real browsers with a full Unicode
 * font stack and render the arrow correctly, so the fix lives here, local to
 * the one renderer that can't, rather than degrading the shared text.
 */
function pdfSafeText(text: string): string {
  return text.replace(/→/g, "->");
}

function TableBlock({ section }: { section: TableSection }) {
  return (
    <View>
      {section.note ? <Text style={styles.note}>{section.note}</Text> : null}
      {section.rows.length > 0 ? (
        <View>
          <View style={styles.tableHead}>
            {section.columns.map((column, i) => (
              <Text key={column} style={[styles.tableHeadCell, { flex: columnFlex(section.columns.length, i) }]}>
                {column}
              </Text>
            ))}
          </View>
          {section.rows.map((row, rowIdx) => (
            <View key={rowIdx} style={styles.tableRow} wrap={false}>
              {row.cells.map((c, cellIdx) => (
                <Text
                  key={cellIdx}
                  style={[
                    styles.tableCell,
                    { flex: columnFlex(section.columns.length, cellIdx), textAlign: cellIdx === 0 ? "left" : "right" },
                  ]}
                >
                  {pdfSafeText(c.text)}
                </Text>
              ))}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export type AuditReportPdfProps = {
  clientName: string;
  periodLabel: string;
  sections: ReportSection[];
};

export function AuditReportPdf({ clientName, periodLabel, sections }: AuditReportPdfProps) {
  return (
    <Document title={`${clientName} — Call Audit Performance Report`}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.eyebrow}>Call Audit Performance Report</Text>
        <Text style={styles.title}>{clientName}</Text>
        {periodLabel ? <Text style={styles.subtitle}>{periodLabel}</Text> : null}

        {sections.map((section) => (
          <View key={section.number}>
            <View style={styles.sectionHeading}>
              <Text style={styles.sectionNumber}>{section.number}</Text>
              <Text style={styles.sectionTitle}>{section.title}</Text>
            </View>
            {section.kind === "key-value" ? <KeyValueBlock section={section} /> : <TableBlock section={section} />}
          </View>
        ))}
      </Page>
    </Document>
  );
}
