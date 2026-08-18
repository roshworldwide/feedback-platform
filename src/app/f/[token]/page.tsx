import { MailQuestion } from "lucide-react";
import { recordAudit } from "@/lib/audit";
import { parseRating, recordRating, resolveRecipient } from "@/lib/email/tracking";
import { FeedbackPanel } from "./feedback-panel";

/**
 * The public landing page for a star clicked inside an email.
 *
 * A star in the message links straight here with `?r=n`, so this render is
 * where that rating is written. That is a mutation on a GET, which is normally
 * wrong — but the alternative is a redirect chain that corporate mail proxies
 * routinely break, and the write is idempotent by construction: the upsert is
 * keyed on `recipient_id`, so a proxy that fetches the URL twice produces one
 * rating, not two.
 */

export const dynamic = "force-dynamic";

type PageParams = { params: Promise<{ token: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

function first(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function Shell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby="feedback-shell-heading"
      style={{
        background: "var(--surface-raised)",
        border: "1px solid var(--stroke-rim)",
        borderRadius: "var(--radius-xl)",
        boxShadow: "var(--e3)",
        padding: "var(--space-8) var(--space-6)",
        textAlign: "center",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          display: "inline-grid",
          placeItems: "center",
          width: "var(--space-12)",
          height: "var(--space-12)",
          borderRadius: "var(--radius-capsule)",
          background: "var(--fill-quiet)",
          color: "var(--content-tertiary)",
          marginBottom: "var(--space-4)",
        }}
      >
        <MailQuestion size={22} strokeWidth={1.5} />
      </span>
      <h1
        id="feedback-shell-heading"
        className="t-title-3"
        style={{ margin: "0 0 var(--space-2)", color: "var(--content-primary)" }}
      >
        {title}
      </h1>
      <div
        className="t-body prose-measure"
        style={{ margin: "0 auto", color: "var(--content-secondary)" }}
      >
        {children}
      </div>
    </section>
  );
}

function PreferencesNotice({ intent }: { intent: string }) {
  const copy: Record<string, { title: string; body: string }> = {
    unsubscribe: {
      title: "Unsubscribing from this series",
      body: "Report subscriptions are managed by your account lead so that nobody is removed from a report their team still relies on. Reply to the report email with the word “unsubscribe” and it is actioned the same working day.",
    },
    preferences: {
      title: "Changing what you receive",
      body: "Frequency, format and who else is copied are all adjustable. Reply to the report email describing what you would prefer and your account lead will confirm the change.",
    },
    privacy: {
      title: "What we record",
      body: "We record whether this email was opened, whether the report link was followed, and the rating and comment you choose to send. We store a one-way hash of your IP address, never the address itself, and we do not share any of it outside the reporting team.",
    },
  };
  const chosen = copy[intent];
  if (!chosen) return null;

  return (
    <div
      style={{
        marginTop: "var(--space-4)",
        padding: "var(--space-4) var(--space-5)",
        background: "var(--surface-grouped)",
        border: "1px solid var(--stroke-hairline)",
        borderRadius: "var(--radius-lg)",
      }}
    >
      <h2
        className="t-headline"
        style={{ margin: "0 0 var(--space-1)", color: "var(--content-primary)" }}
      >
        {chosen.title}
      </h2>
      <p
        className="t-subhead prose-measure"
        style={{ margin: 0, color: "var(--content-secondary)" }}
      >
        {chosen.body}
      </p>
    </div>
  );
}

export default async function PublicFeedbackPage({ params, searchParams }: PageParams) {
  const { token } = await params;
  const query = await searchParams;

  const requested = parseRating(first(query.r));
  const intent = first(query.a) ?? "";

  let recipient = await resolveRecipient(token);

  // (c) Invalid or expired token. Calm, not alarming: most of the time this is
  // a forwarded email or a link opened months later, and neither is a fault.
  if (!recipient) {
    return (
      <>
        <Shell title="This feedback link is no longer active">
          <p style={{ margin: 0 }}>
            Links expire when a report is archived, and a forwarded email carries
            a link that only works for the person it was addressed to.
          </p>
          <p style={{ margin: "var(--space-3) 0 0" }}>
            Replying to the report email still reaches the analyst who wrote it.
          </p>
        </Shell>
        <PreferencesNotice intent={intent} />
      </>
    );
  }

  // (a) A star was clicked in the email — record it before the first paint, so
  // the page the reader lands on already states what they did.
  let justSubmitted = false;
  if (requested !== null && requested !== recipient.rating) {
    const outcome = await recordRating(recipient, requested);
    if (outcome.ok) {
      justSubmitted = true;
      await recordAudit({
        actorEmail: recipient.email,
        action: outcome.created ? "feedback.rated" : "feedback.rating_changed",
        entityType: "feedback",
        entityId: recipient.recipient_id,
        summary: `${recipient.email} rated ${recipient.report_number ?? recipient.campaign_title} ${requested}/5 from the email`,
        diff: {
          campaign_id: recipient.campaign_id,
          rating: requested,
          previous_rating: recipient.rating,
          source: "email-star",
        },
      });
      recipient = { ...recipient, rating: requested };
    }
  } else if (requested !== null && requested === recipient.rating) {
    justSubmitted = true;
  }

  return (
    <>
      <FeedbackPanel
        token={token}
        reportTitle={recipient.campaign_title}
        clientName={recipient.client_name}
        reportNumber={recipient.report_number}
        periodLabel={recipient.period_label}
        question={recipient.feedback_question || "Was this report helpful?"}
        askComment={recipient.feedback_ask_comment}
        initialRating={recipient.rating}
        initialComment={recipient.comment ?? ""}
        justSubmitted={justSubmitted}
      />
      <PreferencesNotice intent={intent} />
    </>
  );
}
