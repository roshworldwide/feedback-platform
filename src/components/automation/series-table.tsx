"use client";

/**
 * The recurring series.
 *
 * The DL-nnn numbering was always a cadence; this is the cadence made
 * explicit — what goes out, to whom, how often, next when, from which template
 * and under whose name. The active switch is the only writing control on the
 * screen, and it reports its own failure in place rather than silently
 * reverting.
 */

import * as React from "react";
import { DataTable, EmptyState, Pill, Switch, type Column } from "@/components/ui";
import { fmtDateTime } from "@/lib/utils";
import { frequencyLabel, type ActionState } from "./vocabulary";
import { Workflow } from "lucide-react";

export type SeriesTableRow = {
  id: string;
  name: string;
  clientName: string | null;
  frequency: string;
  nextRunAt: string | null;
  templateKey: string;
  ownerName: string | null;
  isActive: boolean;
};

export type SetSeriesActive = (id: string, active: boolean) => Promise<ActionState>;

function ActiveSwitch({
  row,
  onToggle,
}: {
  row: SeriesTableRow;
  onToggle: SetSeriesActive;
}) {
  const [checked, setChecked] = React.useState(row.isActive);
  const [serverValue, setServerValue] = React.useState(row.isActive);
  const [message, setMessage] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  // The server is the source of truth; if it changes underneath us, follow it.
  // Adjusted during render rather than in an effect, so the switch never draws
  // one frame in the state the server has already left.
  if (serverValue !== row.isActive) {
    setServerValue(row.isActive);
    setChecked(row.isActive);
  }

  return (
    <div className="flex items-center" style={{ gap: "var(--space-2)" }}>
      <Switch
        checked={checked}
        disabled={pending}
        label={`${checked ? "Pause" : "Resume"} ${row.name}`}
        onCheckedChange={(next) => {
          setChecked(next);
          setMessage(null);
          startTransition(async () => {
            const result = await onToggle(row.id, next);
            if (!result.ok) {
              setChecked(!next);
              setMessage(result.message);
            }
          });
        }}
      />
      {message ? (
        <span role="status" className="t-caption" style={{ color: "var(--signal-abort)" }}>
          {message}
        </span>
      ) : null}
    </div>
  );
}

export type SeriesTableProps = {
  rows: SeriesTableRow[];
  setActive: SetSeriesActive;
};

export function SeriesTable({ rows, setActive }: SeriesTableProps) {
  const columns: Column<SeriesTableRow>[] = [
    {
      id: "name",
      header: "Series",
      required: true,
      sortValue: (row) => row.name,
      render: (row) => (
        <span style={{ color: "var(--content-primary)", fontWeight: 600 }}>
          {row.name}
        </span>
      ),
    },
    {
      id: "client",
      header: "Client",
      sortValue: (row) => row.clientName,
      render: (row) =>
        row.clientName ? (
          <Pill tone="neutral">{row.clientName}</Pill>
        ) : (
          <span style={{ color: "var(--content-tertiary)" }}>Not resolved</span>
        ),
    },
    {
      id: "frequency",
      header: "Frequency",
      sortValue: (row) => row.frequency,
      render: (row) => frequencyLabel(row.frequency),
    },
    {
      id: "next",
      header: "Next run",
      sortValue: (row) => row.nextRunAt,
      render: (row) => (
        <span className="tabular">
          {row.nextRunAt ? (
            fmtDateTime(row.nextRunAt)
          ) : (
            <span style={{ color: "var(--content-tertiary)" }}>Not scheduled</span>
          )}
        </span>
      ),
    },
    {
      id: "template",
      header: "Template",
      sortValue: (row) => row.templateKey,
      render: (row) => <Pill tone="neutral">{row.templateKey}</Pill>,
    },
    {
      id: "owner",
      header: "Owner",
      sortValue: (row) => row.ownerName,
      render: (row) =>
        row.ownerName ?? (
          <span style={{ color: "var(--content-tertiary)" }}>Unassigned</span>
        ),
    },
    {
      id: "active",
      header: "Active",
      render: (row) => <ActiveSwitch row={row} onToggle={setActive} />,
    },
  ];

  return (
    <DataTable
      rows={rows}
      columns={columns}
      rowKey={(row) => row.id}
      caption="Recurring report series, with their cadence, owner and next run"
      emptyState={
        <EmptyState
          icon={Workflow}
          title="No recurring series yet"
          description="A series turns a repeated report into a cadence with an owner and a next run. Create one from a client."
          action={{ label: "Open clients", href: "/clients" }}
        />
      }
    />
  );
}
