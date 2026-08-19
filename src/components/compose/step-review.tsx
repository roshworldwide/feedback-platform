"use client";

/**
 * Step 4 · Review.
 *
 * Both previews are the output of `renderReportEmail` — the same function the
 * sender calls, reached through one server action. There is no second
 * renderer, so nothing here can be true of the preview and false of the send.
 *
 * The checklist below is `preflight()` from the compose vocabulary, and the
 * send action re-runs exactly the same function against the recipients the
 * database returns. A send cannot pass a rule this list showed as failing.
 */

import * as React from "react";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Download,
  RotateCw,
  Send,
  X,
} from "lucide-react";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Field,
  Segmented,
  Spinner,
  TextInput,
  useToast,
} from "@/components/ui";
import { previewEmailAction, sendTestAction } from "@/app/(app)/compose/actions";
import { slugify } from "@/lib/utils";
import { DeviceFrame } from "./email-frame";
import {
  preflight,
  type ComposeDoc,
  type ComposeStep,
  type PreflightCheck,
  type RecipientChoice,
} from "./vocabulary";

export type StepReviewProps = {
  doc: ComposeDoc;
  chosen: RecipientChoice[];
  clientName: string | null;
  onGo: (step: ComposeStep) => void;
};

/** "DL-098-thyrocare.html" — the report number as typed, the client as a slug. */
function htmlFilename(reportNumber: string, clientName: string | null): string {
  const number = reportNumber.trim() || "draft";
  const client = slugify(clientName ?? "") || "client";
  return `${number}-${client}.html`;
}

type Surface = "both" | "desktop" | "mobile";

const TONE_ROLE = {
  pass: "var(--signal-nominal)",
  warn: "var(--signal-caution)",
  fail: "var(--signal-abort)",
} as const;

function CheckRow({ check, onGo }: { check: PreflightCheck; onGo: (step: ComposeStep) => void }) {
  const Icon = check.tone === "pass" ? Check : check.tone === "warn" ? AlertTriangle : X;
  return (
    <li
      className="flex items-start"
      style={{
        gap: "var(--space-3)",
        paddingBlock: "var(--space-3)",
        borderTop: "1px solid var(--stroke-hairline)",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          flex: "none",
          width: "22px",
          height: "22px",
          marginTop: "1px",
          display: "grid",
          placeItems: "center",
          borderRadius: "var(--radius-capsule)",
          background: "var(--fill-quiet)",
          color: TONE_ROLE[check.tone],
        }}
      >
        <Icon size={13} strokeWidth={2.5} />
      </span>

      <span style={{ minWidth: 0, flex: "1 1 auto" }}>
        <span
          className="t-subhead"
          style={{ display: "block", color: "var(--content-primary)" }}
        >
          {check.label}
          <span className="sr-only">
            {check.tone === "pass" ? " — passed" : check.tone === "warn" ? " — warning" : " — failed"}
          </span>
        </span>
        <span
          className="t-caption prose-measure"
          style={{
            display: "block",
            color: check.tone === "pass" ? "var(--content-tertiary)" : TONE_ROLE[check.tone],
          }}
        >
          {check.detail}
        </span>
      </span>

      {check.tone === "pass" ? null : (
        <Button
          size="s"
          variant="plain"
          trailingIcon={ArrowRight}
          onClick={() => onGo(check.fix)}
        >
          Fix
        </Button>
      )}
    </li>
  );
}

export function StepReview({ doc, chosen, clientName, onGo }: StepReviewProps) {
  const { toast } = useToast();
  const [surface, setSurface] = React.useState<Surface>("both");
  const [testing, setTesting] = React.useState(false);
  const [testEmail, setTestEmail] = React.useState("");

  const checks = React.useMemo(() => preflight(doc, chosen), [doc, chosen]);
  const failures = checks.filter((check) => check.tone === "fail").length;
  const warnings = checks.filter((check) => check.tone === "warn").length;

  // `doc` is state in the editor above, so its identity changes only when the
  // document actually changes — never on a repaint of this step. Re-render is
  // therefore an explicit nonce rather than a debounce.
  const [nonce, setNonce] = React.useState(0);

  /**
   * The rendered document, tagged with the request it answers. "Loading" is the
   * absence of an answer for the current request rather than a flag flipped in
   * an effect body — one fact, derived, so a cancelled request cannot leave a
   * spinner running forever.
   */
  type Rendered = {
    doc: ComposeDoc;
    nonce: number;
    html: string | null;
    subject: string;
    scoreboardIncluded: boolean;
    reason: string | null;
  };
  const [rendered, setRendered] = React.useState<Rendered | null>(null);

  const settled = rendered !== null && rendered.doc === doc && rendered.nonce === nonce;
  const loading = !settled;
  const html = settled ? rendered.html : null;
  const subject = settled ? rendered.subject : "";
  const scoreboardIncluded = settled ? rendered.scoreboardIncluded : false;
  const reason = settled ? rendered.reason : null;

  React.useEffect(() => {
    let cancelled = false;
    void previewEmailAction(doc).then((result) => {
      if (cancelled) return;
      setRendered({
        doc,
        nonce,
        html: result.ok ? result.data.html : null,
        subject: result.ok ? result.data.subject : "",
        scoreboardIncluded: result.ok ? result.data.scoreboardIncluded : false,
        reason: result.ok ? null : result.message,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [doc, nonce]);

  const render = React.useCallback(() => setNonce((current) => current + 1), []);

  /**
   * Downloads the exact bytes already on screen — `html` came from
   * `previewEmailAction`, which calls the same `renderFor()` a real send
   * calls, so what's saved to disk is what would have gone out.
   */
  function downloadHtml() {
    if (!html) return;
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = htmlFilename(doc.reportNumber, clientName);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function sendTest() {
    setTesting(true);
    void sendTestAction(doc, testEmail).then((result) => {
      setTesting(false);
      toast({
        message: result.ok
          ? `Test copy sent to ${result.data}. It is marked as a test in the email and writes no campaign, so it cannot reach a reported figure.`
          : result.message,
        tone: result.ok ? "nominal" : "abort",
      });
    });
  }

  const showDesktop = surface !== "mobile";
  const showMobile = surface !== "desktop";

  return (
    <div className="flex flex-col" style={{ gap: "var(--space-5)" }}>
      <Card elevation="e1" accent={failures > 0 ? "abort" : warnings > 0 ? "caution" : "nominal"}>
        <CardHeader>
          <CardTitle
            as="h2"
            description={
              failures > 0
                ? `${failures} ${failures === 1 ? "check has" : "checks have"} to pass before this can be sent.`
                : warnings > 0
                  ? `Everything required passes. ${warnings} ${warnings === 1 ? "thing is" : "things are"} worth a second look.`
                  : "Every check passes. This is ready to send."
            }
          >
            Pre-flight
          </CardTitle>
        </CardHeader>
        <CardBody>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {checks.map((check) => (
              <CheckRow key={check.id} check={check} onGo={onGo} />
            ))}
          </ul>
        </CardBody>
      </Card>

      <Card elevation="e1">
        <CardHeader
          action={
            <div className="flex flex-wrap items-center" style={{ gap: "var(--space-3)" }}>
              <Segmented
                label="Which preview to show"
                size="s"
                value={surface}
                onValueChange={setSurface}
                options={[
                  { value: "both", label: "Both" },
                  { value: "desktop", label: "Desktop" },
                  { value: "mobile", label: "Mobile" },
                ]}
              />
              <Button size="s" variant="plain" leadingIcon={RotateCw} onClick={render}>
                Re-render
              </Button>
              <Button
                size="s"
                variant="plain"
                leadingIcon={Download}
                disabled={!html}
                onClick={downloadHtml}
              >
                Download HTML
              </Button>
            </div>
          }
        >
          <CardTitle
            as="h2"
            description={
              subject
                ? `Subject: ${subject}`
                : "Rendered through the same function that sends. Links inside are inert."
            }
          >
            Preview
          </CardTitle>
        </CardHeader>

        <CardBody>
          {loading ? (
            <p
              className="t-subhead flex items-center"
              style={{ margin: 0, gap: "var(--space-3)", color: "var(--content-secondary)" }}
            >
              <span style={{ color: "var(--content-tertiary)" }}>
                <Spinner size={16} />
              </span>
              Rendering both previews…
            </p>
          ) : reason ? (
            <p
              role="alert"
              className="t-subhead prose-measure"
              style={{ margin: 0, color: "var(--signal-abort)" }}
            >
              Couldn&rsquo;t render the preview — {reason} Nothing was changed.
            </p>
          ) : html ? (
            <>
              <div
                className="flex flex-wrap items-start justify-center"
                style={{ gap: "var(--space-6)" }}
              >
                {showDesktop ? (
                  <DeviceFrame
                    device="desktop"
                    title="Desktop preview of this email, 600 pixels wide"
                    html={html}
                    width={600}
                    height={440}
                    scale={0.62}
                    caption="Desktop · 600 px"
                  />
                ) : null}
                {showMobile ? (
                  <DeviceFrame
                    device="mobile"
                    title="Mobile preview of this email, 375 pixels wide"
                    html={html}
                    width={375}
                    height={640}
                    scale={0.62}
                    caption="Mobile · 375 px"
                  />
                ) : null}
              </div>

              <p
                className="t-caption prose-measure"
                style={{
                  margin: "var(--space-5) auto 0",
                  color: "var(--content-tertiary)",
                  textAlign: "center",
                }}
              >
                Both frames are the same document at two viewport widths, shrunk
                to fit this column — each one scrolls on its own past a
                comfortable height, rather than stretching the page. The
                greeting uses your own name here; each recipient receives
                theirs, and their own tracking token.
                {doc.scoreboardEnabled
                  ? scoreboardIncluded
                    ? " The performance scoreboard is included, from this client's real sent reports."
                    : " The performance scoreboard is on, but this client has no sent reports yet, so nothing was appended."
                  : ""}
              </p>
            </>
          ) : null}
        </CardBody>
      </Card>

      <Card elevation="e1">
        <CardHeader>
          <CardTitle
            as="h2"
            description="Marked as a test in the email itself. It writes no campaign and no recipient, so it can never reach a reported figure — send it to yourself, a colleague, or anyone you want to check it with."
          >
            Send a test
          </CardTitle>
        </CardHeader>
        <CardBody className="flex flex-col" style={{ gap: "var(--space-3)" }}>
          <Field label="Send test to" hint="Leave blank to send it to your own address.">
            <TextInput
              type="email"
              placeholder="you@company.com"
              value={testEmail}
              onChange={(event) => setTestEmail(event.currentTarget.value)}
            />
          </Field>
          <Button
            variant="tinted"
            leadingIcon={Send}
            loading={testing}
            onClick={sendTest}
            style={{ alignSelf: "flex-start" }}
          >
            Send test
          </Button>
        </CardBody>
      </Card>
    </div>
  );
}
