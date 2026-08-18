/**
 * The email module.
 *
 * `./templates` is the only member safe to import from a client component — it
 * carries names and use cases and no colour. `./palette`, `./render`, `./send`
 * and `./tracking` are server-side: the first holds the product's only colour
 * literals, the last reaches the database with the service role.
 */

export {
  TEMPLATES,
  TEMPLATE_KEYS,
  DEFAULT_TEMPLATE,
  isTemplateKey,
  toTemplateKey,
  templateMeta,
} from "./templates";
export type { TemplateKey, TemplateMeta, TemplateSketch } from "./templates";

export {
  renderReportEmail,
  SUBJECT_SOFT_LIMIT,
  SUBJECT_HARD_LIMIT,
} from "./render";
export type { ReportEmailInput, ReportEmailImage, RenderedEmail } from "./render";

export { sendEmail, emailProvider } from "./send";
export type { EmailMessage, SendResult } from "./send";

export {
  applyVariables,
  markdownToPlainText,
  reportOrdinalOf,
  safeUrl,
  isHttpUrl,
  VARIABLE_TOKENS,
  VARIABLE_LABEL,
} from "./markdown";
export type { TemplateVariables, VariableToken } from "./markdown";
