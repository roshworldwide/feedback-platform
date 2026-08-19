import "server-only";

import { renderToBuffer } from "@react-pdf/renderer";
import { AuditReportPdf } from "@/components/audits/pdf/audit-report-pdf";
import type { ReportSection } from "./report-document";

export async function renderAuditReportPdf(input: {
  clientName: string;
  periodLabel: string;
  sections: ReportSection[];
}): Promise<Buffer> {
  // Calling the component as a plain function (rather than via createElement)
  // returns its actual <Document> element, which is what renderToBuffer's
  // narrower DocumentProps type expects — createElement's return type is too
  // generic to satisfy it.
  return renderToBuffer(AuditReportPdf(input));
}
