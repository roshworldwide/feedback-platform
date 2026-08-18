"use client";

/**
 * Sign in.
 *
 * Identity is an email and a password held in `auth.users`. There are no PINs
 * anywhere in this product: v1 shipped seventeen four-digit codes in a public
 * repository, seven of them belonging to people who had left.
 *
 * The error rules, from the voice sheet: name the state, name the cause, name
 * the next action, keep every character the user typed, never blame them. The
 * fields are controlled and are never cleared on failure.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CircleAlert } from "lucide-react";
import { Button, Card, Field, TextInput } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { env } from "@/lib/env";

type Props = {
  /** Where to land once the session exists. Already validated server-side. */
  next: string;
  /** Why the person is looking at this screen, if they did not choose to. */
  reason?: "inactive" | "oauth" | null;
  /** The provider's own words, when there are any. Never paraphrased. */
  detail?: string | null;
};

const REASON_COPY: Record<NonNullable<Props["reason"]>, string> = {
  inactive:
    "This account is deactivated, so it can sign in but cannot read anything. Ask an admin to restore it.",
  oauth:
    "Google sign-in did not finish, so no session was created. Try again, or use your email and password below.",
};

/** Supabase speaks in codes. A person needs the cause and the next move. */
function explain(code: string | undefined, message: string): string {
  switch (code) {
    case "invalid_credentials":
      return "That email and password do not match an account. Check the password, or ask an admin to send a reset.";
    case "email_not_confirmed":
      return "This address has not been confirmed yet. Open the confirmation email, then sign in.";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "Too many attempts in a short window. Wait a minute, then try the same details again.";
    case "user_banned":
      return "This account is suspended. An admin has to lift it before you can sign in.";
    default:
      return message ||
        "Sign-in failed and the service did not say why. Try again — nothing you typed has been lost.";
  }
}

export function SignInForm({ next, reason = null, detail = null }: Props) {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState<"password" | "google" | null>(null);
  const emailRef = React.useRef<HTMLInputElement>(null);

  // A stale session that resolves to no readable profile is worse than none:
  // it loops the guard. Clear it the moment this screen is reached that way.
  React.useEffect(() => {
    if (reason !== "inactive") return;
    void createClient().auth.signOut();
  }, [reason]);

  React.useEffect(() => {
    emailRef.current?.focus();
  }, []);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    if (!email.trim() || !password) {
      setError(
        "Both the email and the password are needed. Fill the empty one and try again.",
      );
      return;
    }

    setError(null);
    setPending("password");
    try {
      const { error: authError } = await createClient().auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (authError) {
        setError(explain(authError.code, authError.message));
        setPending(null);
        return;
      }
      // Server Components hold the session; refresh so the guard sees it.
      router.replace(next);
      router.refresh();
    } catch {
      setError(
        "Could not reach the sign-in service. Check your connection and press Sign in again — nothing you typed has been lost.",
      );
      setPending(null);
    }
  }

  async function onGoogle() {
    if (pending) return;
    setError(null);
    setPending("google");
    try {
      const redirectTo = new URL("/auth/callback", env.NEXT_PUBLIC_APP_URL);
      redirectTo.searchParams.set("next", next);
      const { error: authError } = await createClient().auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: redirectTo.toString() },
      });
      if (authError) {
        setError(
          `Google sign-in could not start: ${authError.message}. Use your email and password instead.`,
        );
        setPending(null);
      }
      // On success the browser is already navigating to Google.
    } catch {
      setError(
        "Could not reach Google. Use your email and password instead, or try again in a moment.",
      );
      setPending(null);
    }
  }

  const notice = reason ? REASON_COPY[reason] : null;

  return (
    <Card elevation="e1">
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-6)",
          padding: "var(--space-8)",
        }}
      >
        <header
          style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}
        >
          {/* The one Aurum element on this screen. */}
          <span
            className="metal-mark t-display-2"
            style={{ display: "block", lineHeight: 1 }}
          >
            CDL
          </span>
          <h1 className="t-title-3" style={{ margin: 0 }}>
            Convin Data Labs
          </h1>
          <p
            className="t-subhead"
            style={{ margin: 0, color: "var(--content-secondary)" }}
          >
            Sign in to see delivery, engagement and satisfaction.
          </p>
        </header>

        {notice ? (
          <p
            role="status"
            className="t-footnote"
            style={{
              margin: 0,
              padding: "var(--space-3) var(--space-4)",
              borderRadius: "var(--radius-sm)",
              background: "var(--fill-quiet)",
              border: "1px solid var(--stroke-hairline)",
              color: "var(--content-secondary)",
            }}
          >
            {notice}
            {detail ? (
              <span style={{ display: "block", color: "var(--content-tertiary)" }}>
                {detail}
              </span>
            ) : null}
          </p>
        ) : null}

        <form
          onSubmit={onSubmit}
          noValidate
          style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}
        >
          <Field label="Work email" required>
            <TextInput
              ref={emailRef}
              type="email"
              name="email"
              autoComplete="email"
              inputMode="email"
              placeholder="you@convin.ai"
              value={email}
              onChange={(event) => setEmail(event.currentTarget.value)}
              disabled={pending !== null}
            />
          </Field>

          <Field label="Password" required>
            <TextInput
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.currentTarget.value)}
              disabled={pending !== null}
            />
          </Field>

          {error ? (
            <p
              role="alert"
              className="t-footnote"
              style={{
                margin: 0,
                display: "flex",
                gap: "var(--space-2)",
                alignItems: "flex-start",
                padding: "var(--space-3) var(--space-4)",
                borderRadius: "var(--radius-sm)",
                background:
                  "color-mix(in oklab, var(--signal-abort) 12%, transparent)",
                border:
                  "1px solid color-mix(in oklab, var(--signal-abort) 34%, transparent)",
                color: "var(--signal-abort)",
              }}
            >
              <CircleAlert
                size={16}
                strokeWidth={1.75}
                aria-hidden="true"
                style={{ flex: "none", marginTop: "1px" }}
              />
              <span>{error}</span>
            </p>
          ) : null}

          <Button
            type="submit"
            variant="solid"
            size="l"
            fullWidth
            loading={pending === "password"}
            trailingIcon={ArrowRight}
          >
            Sign in
          </Button>
        </form>

        <div
          aria-hidden="true"
          style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}
        >
          <span style={{ flex: 1, height: "1px", background: "var(--stroke-hairline)" }} />
          <span className="t-overline" style={{ color: "var(--content-tertiary)" }}>
            or
          </span>
          <span style={{ flex: 1, height: "1px", background: "var(--stroke-hairline)" }} />
        </div>

        <Button
          type="button"
          variant="glass"
          size="l"
          fullWidth
          loading={pending === "google"}
          onClick={() => void onGoogle()}
        >
          Continue with Google
        </Button>

        <p
          className="t-caption"
          style={{ margin: 0, color: "var(--content-tertiary)" }}
        >
          Accounts are created by an admin. There are no shared codes — every
          action is recorded against the person who took it.
        </p>
      </div>
    </Card>
  );
}
