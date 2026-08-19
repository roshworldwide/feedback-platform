"use client";

/**
 * Manage taxonomy parameters — editable in the app, per the spec, so a new
 * §5 parameter never waits on a developer. Deactivating is the everyday
 * action (staff can); a hard delete is gated to a manager, matching the
 * table's own RLS tier.
 */

import * as React from "react";
import { ListChecks, Plus, Trash2 } from "lucide-react";
import { Button, Field, Sheet, Switch, TextInput, useToast } from "@/components/ui";
import type { TaxonomyParameter } from "@/lib/audits/types";
import {
  deactivateTaxonomyParameterAction,
  deleteTaxonomyParameterAction,
  listTaxonomyAction,
  saveTaxonomyParameterAction,
} from "@/app/(app)/audits/actions";

export type TaxonomySheetProps = { canDelete: boolean };

export function TaxonomySheet({ canDelete }: TaxonomySheetProps) {
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [rows, setRows] = React.useState<TaxonomyParameter[]>([]);
  const [loading, setLoading] = React.useState(false);

  function load() {
    setLoading(true);
    void listTaxonomyAction().then((result) => {
      setLoading(false);
      if (!result.ok) {
        toast({ message: result.message, tone: "abort" });
        return;
      }
      setRows(result.data);
    });
  }

  function patch(id: string, change: Partial<TaxonomyParameter>) {
    setRows((current) => current.map((r) => (r.id === id ? { ...r, ...change } : r)));
  }

  async function save(row: TaxonomyParameter) {
    const result = await saveTaxonomyParameterAction({
      id: row.id.startsWith("new-") ? undefined : row.id,
      label: row.label,
      patterns: row.patterns,
      sortOrder: row.sortOrder,
      isActive: row.isActive,
    });
    if (!result.ok) {
      toast({ message: result.message, tone: "abort" });
      return;
    }
    toast({ message: `${row.label} saved.`, tone: "nominal" });
    load();
  }

  async function deactivate(id: string) {
    const result = await deactivateTaxonomyParameterAction(id);
    if (!result.ok) {
      toast({ message: result.message, tone: "abort" });
      return;
    }
    load();
  }

  async function hardDelete(id: string) {
    const result = await deleteTaxonomyParameterAction(id);
    if (!result.ok) {
      toast({ message: result.message, tone: "abort" });
      return;
    }
    load();
  }

  function addRow() {
    setRows((current) => [
      ...current,
      { id: `new-${Date.now()}`, label: "", patterns: [], sortOrder: current.length + 1, isActive: true },
    ]);
  }

  return (
    <>
      <Button
        variant="tinted"
        size="s"
        leadingIcon={ListChecks}
        onClick={() => {
          setOpen(true);
          load();
        }}
      >
        Manage parameters
      </Button>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="§5 taxonomy parameters"
        description="Each row is matched by keyword against a row's Observation and Improvement text — patterns are comma-separated substrings, matched case-insensitively."
        footer={
          <Button variant="glass" onClick={() => setOpen(false)}>
            Close
          </Button>
        }
      >
        <div className="flex flex-col" style={{ gap: "var(--space-4)" }}>
          {loading ? (
            <p className="t-subhead" style={{ color: "var(--content-secondary)" }}>
              Loading…
            </p>
          ) : (
            rows.map((row) => (
              <div
                key={row.id}
                className="flex flex-col"
                style={{ gap: "var(--space-2)", padding: "var(--space-3)", borderRadius: "var(--radius-sm)", background: "var(--fill-quiet)" }}
              >
                <Field label="Label">
                  <TextInput value={row.label} onChange={(e) => patch(row.id, { label: e.currentTarget.value })} />
                </Field>
                <Field label="Patterns" hint="Comma-separated.">
                  <TextInput
                    value={row.patterns.join(", ")}
                    onChange={(e) => patch(row.id, { patterns: e.currentTarget.value.split(",").map((p) => p.trim()) })}
                  />
                </Field>
                <div className="flex items-center justify-between" style={{ gap: "var(--space-3)" }}>
                  <Switch
                    id={`taxonomy-active-${row.id}`}
                    checked={row.isActive}
                    label="Active"
                    onCheckedChange={(checked) => patch(row.id, { isActive: checked })}
                  />
                  <div className="flex items-center" style={{ gap: "var(--space-2)" }}>
                    <Button size="s" variant="plain" onClick={() => save(row)}>
                      Save
                    </Button>
                    {!row.id.startsWith("new-") ? (
                      <Button size="s" variant="plain" onClick={() => deactivate(row.id)}>
                        Deactivate
                      </Button>
                    ) : null}
                    {!row.id.startsWith("new-") && canDelete ? (
                      <Button
                        size="s"
                        variant="plain"
                        leadingIcon={Trash2}
                        style={{ color: "var(--signal-abort)" }}
                        onClick={() => hardDelete(row.id)}
                      />
                    ) : null}
                  </div>
                </div>
              </div>
            ))
          )}

          <Button size="s" variant="tinted" leadingIcon={Plus} onClick={addRow} style={{ alignSelf: "flex-start" }}>
            Add parameter
          </Button>
        </div>
      </Sheet>
    </>
  );
}
