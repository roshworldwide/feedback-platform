"use client";

/**
 * The people.
 *
 * v1 had seventeen four-digit PINs in a public repository, seven of them
 * belonging to people who had left, and no way to revoke one. Deactivation is
 * the control that was missing: it is a real, audited state change, it is
 * confirmed before it happens, and the row stays in the table afterwards so
 * the history of who had access is never quietly erased.
 */

import * as React from "react";
import { UserPlus } from "lucide-react";
import {
  Alert,
  Button,
  DataTable,
  Field,
  Pill,
  Select,
  Sheet,
  TextInput,
  type Column,
} from "@/components/ui";
import { roleLabel } from "@/components/shell";
import { fmtDate, fmtDateTime } from "@/lib/utils";
import { IDLE_ACTION, type ActionState, type TeamMember } from "./vocabulary";

export type InviteAction = (
  state: ActionState,
  formData: FormData,
) => Promise<ActionState>;

export type SetMemberActive = (
  id: string,
  active: boolean,
) => Promise<ActionState>;

export type TeamPanelProps = {
  members: TeamMember[];
  /** True when the signed-in person is an admin. */
  canManage: boolean;
  invite: InviteAction;
  setActive: SetMemberActive;
};

export function TeamPanel({
  members,
  canManage,
  invite,
  setActive,
}: TeamPanelProps) {
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [target, setTarget] = React.useState<TeamMember | null>(null);
  const [pending, startTransition] = React.useTransition();
  const [result, setResult] = React.useState<ActionState>(IDLE_ACTION);
  const [inviteState, inviteAction, invitePending] = React.useActionState(
    invite,
    IDLE_ACTION,
  );
  const formId = React.useId();

  const columns: Column<TeamMember>[] = [
    {
      id: "person",
      header: "Person",
      required: true,
      sortValue: (row) => row.name || row.email,
      render: (row) => (
        <div className="flex flex-col" style={{ gap: "2px" }}>
          <span style={{ color: "var(--content-primary)", fontWeight: 600 }}>
            {row.name || "Name not set"}
          </span>
          <span className="t-caption" style={{ color: "var(--content-tertiary)" }}>
            {row.email}
          </span>
        </div>
      ),
    },
    {
      id: "role",
      header: "Role",
      sortValue: (row) => row.role,
      render: (row) => <Pill tone="neutral">{roleLabel(row.role)}</Pill>,
    },
    {
      id: "last",
      header: "Last active",
      sortValue: (row) => row.lastSeenAt,
      render: (row) =>
        row.lastSeenAt ? (
          <span className="tabular">{fmtDateTime(row.lastSeenAt)}</span>
        ) : (
          <span style={{ color: "var(--content-tertiary)" }}>Never signed in</span>
        ),
    },
    {
      id: "joined",
      header: "Added",
      defaultHidden: true,
      sortValue: (row) => row.createdAt,
      render: (row) => <span className="tabular">{fmtDate(row.createdAt)}</span>,
    },
    {
      id: "status",
      header: "Status",
      sortValue: (row) => (row.isActive ? "active" : "deactivated"),
      render: (row) =>
        row.isActive ? (
          <Pill tone="nominal" dot>
            Active
          </Pill>
        ) : (
          <Pill tone="caution" dot>
            Deactivated
          </Pill>
        ),
    },
    {
      id: "actions",
      header: "Access",
      render: (row) => (
        <Button
          size="s"
          variant={row.isActive ? "plain" : "tinted"}
          disabled={!canManage}
          onClick={() => {
            setResult(IDLE_ACTION);
            setTarget(row);
          }}
        >
          {row.isActive ? "Deactivate" : "Reactivate"}
        </Button>
      ),
    },
  ];

  return (
    <div className="flex flex-col" style={{ gap: "var(--space-4)" }}>
      <div
        className="flex flex-wrap items-center justify-between"
        style={{ gap: "var(--space-3)" }}
      >
        <p
          className="t-footnote prose-measure"
          style={{ margin: 0, color: "var(--content-secondary)" }}
        >
          Everyone who can sign in. A deactivated account keeps its history and
          loses its access immediately, even while its session token is still
          valid.
        </p>
        <Button
          variant="tinted"
          leadingIcon={UserPlus}
          disabled={!canManage}
          onClick={() => setInviteOpen(true)}
        >
          Invite someone
        </Button>
      </div>

      {canManage ? null : (
        <p className="t-caption" style={{ margin: 0, color: "var(--content-tertiary)" }}>
          You can see the team but not change it — inviting and deactivating are
          admin actions.
        </p>
      )}

      {result.message ? (
        <p
          role="status"
          className="t-footnote"
          style={{
            margin: 0,
            color: result.ok ? "var(--signal-nominal)" : "var(--signal-abort)",
          }}
        >
          {result.message}
        </p>
      ) : null}

      <DataTable
        rows={members}
        columns={columns}
        rowKey={(row) => row.id}
        caption="Everyone with an account, their role, when they were last active and whether they still have access"
      />

      {/* ── Invite ──────────────────────────────────────────────────────── */}
      <Sheet
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title="Invite someone"
        description="They receive an email invitation. Nobody gets access until they accept it and sign in."
        side="right"
        footer={
          <div className="flex items-center" style={{ gap: "var(--space-3)" }}>
            <Button variant="plain" onClick={() => setInviteOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              form={formId}
              variant="tinted"
              loading={invitePending}
            >
              Send invitation
            </Button>
          </div>
        }
      >
        <form
          id={formId}
          action={inviteAction}
          className="flex flex-col"
          style={{ gap: "var(--space-4)" }}
        >
          <Field label="Work email" required hint="A Convin address, so the account is internal.">
            <TextInput
              name="email"
              type="email"
              required
              autoComplete="off"
              placeholder="name@convin.ai"
            />
          </Field>

          <Field label="Full name" hint="Used on the audit log and on assignments.">
            <TextInput name="full_name" autoComplete="off" placeholder="Priya Nair" />
          </Field>

          <Field
            label="Role"
            hint="Analyst reads and authors. Team lead can delete. Admin manages people."
          >
            <Select
              name="role"
              defaultValue="analyst"
              options={[
                { value: "analyst", label: "Analyst" },
                { value: "team_lead", label: "Team lead" },
                { value: "admin", label: "Admin" },
              ]}
            />
          </Field>

          {inviteState.message ? (
            <p
              role="status"
              className="t-footnote"
              style={{
                margin: 0,
                color: inviteState.ok
                  ? "var(--signal-nominal)"
                  : "var(--signal-abort)",
              }}
            >
              {inviteState.message}
            </p>
          ) : null}
        </form>
      </Sheet>

      {/* ── Deactivate ──────────────────────────────────────────────────── */}
      <Alert
        open={target !== null}
        onClose={() => setTarget(null)}
        title={
          target?.isActive
            ? `Deactivate ${target.name || target.email}?`
            : `Reactivate ${target?.name || target?.email || "this account"}?`
        }
        body={
          target?.isActive
            ? "They lose access on their next request, even though their session token stays valid until it expires. Their history stays exactly where it is."
            : "They can sign in again from their next request. Everything they did before is unchanged."
        }
        safeAction={{ label: "Cancel", onClick: () => setTarget(null) }}
        dangerAction={{
          label: target?.isActive ? "Deactivate" : "Reactivate",
          destructive: target?.isActive ?? false,
          loading: pending,
          onClick: () => {
            const member = target;
            if (!member) return;
            startTransition(async () => {
              const outcome = await setActive(member.id, !member.isActive);
              setResult(outcome);
              setTarget(null);
            });
          },
        }}
      />
    </div>
  );
}
