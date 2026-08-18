"use client";

/**
 * Step 2 · Design.
 *
 * Six templates, each drawn from its own metadata rather than from a stock
 * screenshot, so the gallery cannot drift away from what the renderer actually
 * produces. Each carries one line saying what it is *for* — a person choosing
 * a template is choosing an occasion, not a colourway.
 *
 * "Preview at full size" renders the real email through `renderReportEmail`,
 * the same function the sender calls. The gallery never shows a mock.
 */

import * as React from "react";
import { Eye } from "lucide-react";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Pill,
  Sheet,
  Spinner,
} from "@/components/ui";
import { TEMPLATES, templateMeta, type TemplateKey } from "@/lib/email/templates";
import { previewEmailAction } from "@/app/(app)/compose/actions";
import { DeviceFrame } from "./email-frame";
import { TemplateThumbnail } from "./template-thumbnail";
import type { ComposeDoc } from "./vocabulary";

export type StepDesignProps = {
  doc: ComposeDoc;
  patch: (change: Partial<ComposeDoc>) => void;
};

const EMPHASIS_WORD: Record<string, string> = {
  accent: "Aurum",
  neutral: "no accent — weight carries the hierarchy",
  caution: "the alert signal, never gold",
};

export function StepDesign({ doc, patch }: StepDesignProps) {
  const [previewing, setPreviewing] = React.useState<TemplateKey | null>(null);
  const [html, setHtml] = React.useState<string | null>(null);
  const [reason, setReason] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  function openPreview(key: TemplateKey) {
    setPreviewing(key);
    setHtml(null);
    setReason(null);
    setLoading(true);
    void previewEmailAction({ ...doc, templateKey: key }).then((result) => {
      setLoading(false);
      if (result.ok) setHtml(result.data.html);
      else setReason(result.message);
    });
  }

  const chosen = templateMeta(doc.templateKey);

  return (
    <div className="flex flex-col" style={{ gap: "var(--space-5)" }}>
      <Card elevation="e1">
        <CardHeader>
          <CardTitle
            as="h2"
            description="Pick the one whose occasion matches this report. Every template renders the same anatomy in the same order — brand, prepared-for, body, call to action, signature, rating, footer."
          >
            Template
          </CardTitle>
        </CardHeader>
        <CardBody>
          <div
            role="radiogroup"
            aria-label="Email template"
            className="grid"
            style={{
              gap: "var(--space-4)",
              gridTemplateColumns: "repeat(auto-fill, minmax(268px, 1fr))",
            }}
          >
            {TEMPLATES.map((meta) => {
              const selected = meta.key === doc.templateKey;
              return (
                <div
                  key={meta.key}
                  className="flex flex-col"
                  style={{
                    gap: "var(--space-3)",
                    padding: "var(--space-3)",
                    borderRadius: "var(--radius-lg)",
                    background: selected ? "var(--fill-quiet)" : "transparent",
                    border: `1px solid ${
                      selected ? "var(--content-accent)" : "var(--stroke-hairline)"
                    }`,
                    transition:
                      "background-color var(--dur-glide) var(--ease-glide), " +
                      "border-color var(--dur-glide) var(--ease-glide)",
                  }}
                >
                  <button
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => patch({ templateKey: meta.key })}
                    className="flex w-full flex-col text-left"
                    style={{
                      gap: "var(--space-3)",
                      minHeight: "44px",
                      padding: 0,
                      background: "transparent",
                      border: 0,
                      color: "var(--content-primary)",
                      cursor: "pointer",
                    }}
                  >
                    <TemplateThumbnail meta={meta} width={244} selected={selected} />

                    <span>
                      <span
                        className="t-headline"
                        style={{ display: "block", color: "var(--content-primary)" }}
                      >
                        {meta.name}
                      </span>
                      <span
                        className="t-caption prose-measure"
                        style={{ display: "block", color: "var(--content-secondary)" }}
                      >
                        {meta.useCase}
                      </span>
                    </span>
                  </button>

                  <div
                    className="flex flex-wrap items-center"
                    style={{ gap: "var(--space-2)" }}
                  >
                    {selected ? <Pill tone="accent">Chosen</Pill> : null}
                    <Pill tone="neutral">{meta.mode === "dark" ? "Dark" : "Light"}</Pill>
                    <Button
                      size="s"
                      variant="plain"
                      leadingIcon={Eye}
                      style={{ marginLeft: "auto" }}
                      onClick={() => openPreview(meta.key)}
                    >
                      Full size
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </CardBody>
      </Card>

      <Card elevation="e1">
        <CardHeader>
          <CardTitle
            as="h2"
            description="Stated rather than offered, because the renderer does not take them as inputs."
          >
            Type size and accent
          </CardTitle>
        </CardHeader>
        <CardBody className="flex flex-col" style={{ gap: "var(--space-3)" }}>
          <p
            className="t-subhead prose-measure"
            style={{ margin: 0, color: "var(--content-secondary)" }}
          >
            <strong>{chosen.name}</strong> sets body copy at 15/24 and the
            headline at 24/30, on a{" "}
            {chosen.mode === "dark" ? "dark" : "light"} ground, with{" "}
            {EMPHASIS_WORD[chosen.sketch.emphasis] ?? "no accent"} carrying the
            furniture.
          </p>
          <p
            className="t-footnote prose-measure"
            style={{ margin: 0, color: "var(--content-tertiary)" }}
          >
            These are fixed per template. An email client strips custom
            properties and a great many strip a &lt;style&gt; block entirely, so
            every value is inlined at render time and the six palettes are the
            only place a size or a colour is decided. A slider here would change
            the preview and not the send, which is the one thing this screen must
            never do. Change the template to change the type.
          </p>
        </CardBody>
      </Card>

      <Sheet
        open={previewing !== null}
        onClose={() => setPreviewing(null)}
        title={previewing ? `${templateMeta(previewing).name} at full size` : "Preview"}
        description="Rendered through the same function that sends. Links inside are inert."
        footer={
          previewing ? (
            <>
              <Button variant="glass" onClick={() => setPreviewing(null)}>
                Close
              </Button>
              <Button
                variant="solid"
                onClick={() => {
                  patch({ templateKey: previewing });
                  setPreviewing(null);
                }}
              >
                Use {templateMeta(previewing).name}
              </Button>
            </>
          ) : null
        }
      >
        {loading ? (
          <div
            className="flex items-center"
            style={{ gap: "var(--space-3)", padding: "var(--space-6) 0" }}
          >
            <span style={{ color: "var(--content-tertiary)" }}>
              <Spinner size={16} />
            </span>
            <span className="t-subhead" style={{ color: "var(--content-secondary)" }}>
              Rendering the email…
            </span>
          </div>
        ) : null}

        {reason ? (
          <p
            role="alert"
            className="t-subhead prose-measure"
            style={{ margin: "var(--space-4) 0", color: "var(--signal-abort)" }}
          >
            Couldn&rsquo;t render the preview — {reason}
          </p>
        ) : null}

        {html ? (
          <DeviceFrame
            device="desktop"
            title={`${previewing ? templateMeta(previewing).name : "Template"} preview`}
            html={html}
            width={600}
            height={1600}
            scale={0.68}
            caption="600 px — the widest column Outlook renders without a scrollbar"
          />
        ) : null}
      </Sheet>
    </div>
  );
}
