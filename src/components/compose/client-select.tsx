"use client";

/**
 * The client select.
 *
 * This is the single most important control in the rebuild. In v1 the client
 * was a free-text box, which is how "cleartrip" and "Cleartrip" became two
 * accounts, how DL-034 existed three times at once, and how roughly a third of
 * the send history lost its attribution entirely. Here the only way to set a
 * client is to choose a row: the value this component emits is a `clients.id`
 * or it is null, and there is no third possibility.
 *
 * The text box filters the list. It never becomes the value.
 */

import * as React from "react";
import { Building2, Check, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ClientOption } from "./vocabulary";

export type ClientSelectProps = {
  clients: ClientOption[] | null;
  /** Stated verbatim when the list itself could not be read. */
  clientsReason?: string | null;
  value: string | null;
  onChange: (clientId: string | null) => void;
  /** Wired to the surrounding <Field> so the label points at the input. */
  id: string;
  describedBy?: string;
  disabled?: boolean;
  invalid?: boolean;
};

function matches(client: ClientOption, term: string): boolean {
  if (term === "") return true;
  const needle = term.toLowerCase();
  return (
    client.name.toLowerCase().includes(needle) ||
    client.slug.toLowerCase().includes(needle)
  );
}

export function ClientSelect({
  clients,
  clientsReason,
  value,
  onChange,
  id,
  describedBy,
  disabled = false,
  invalid = false,
}: ClientSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [term, setTerm] = React.useState("");
  const [active, setActive] = React.useState(0);
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const listId = `${id}-listbox`;

  const selected = React.useMemo(
    () => (clients ?? []).find((client) => client.id === value) ?? null,
    [clients, value],
  );

  const visible = React.useMemo(
    () => (clients ?? []).filter((client) => matches(client, term.trim())),
    [clients, term],
  );

  // The highlight must never point past the end of a list the term just shrank.
  const clamped = visible.length === 0 ? 0 : Math.min(active, visible.length - 1);

  React.useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function choose(client: ClientOption) {
    onChange(client.id);
    setTerm("");
    setOpen(false);
    inputRef.current?.focus();
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      if (visible.length === 0) return;
      const delta = event.key === "ArrowDown" ? 1 : -1;
      setActive((current) => {
        const base = Math.min(current, visible.length - 1);
        return (base + delta + visible.length) % visible.length;
      });
      return;
    }
    if (event.key === "Enter") {
      if (open && visible.length > 0) {
        event.preventDefault();
        choose(visible[clamped]);
      }
      return;
    }
    if (event.key === "Escape") {
      if (open) {
        event.preventDefault();
        setOpen(false);
      }
      return;
    }
    if (event.key === "Home" && open) {
      event.preventDefault();
      setActive(0);
    }
    if (event.key === "End" && open) {
      event.preventDefault();
      setActive(Math.max(0, visible.length - 1));
    }
  }

  if (!clients) {
    return (
      <div className="flex flex-col" style={{ gap: "var(--space-2)" }}>
        <div
          role="alert"
          className="t-subhead"
          style={{
            minHeight: "var(--cap-m-h)",
            display: "flex",
            alignItems: "center",
            padding: "var(--space-3) var(--space-4)",
            borderRadius: "var(--radius-capsule)",
            border: "1px solid var(--signal-abort)",
            color: "var(--content-secondary)",
            background: "var(--surface-raised)",
          }}
        >
          Couldn&rsquo;t load clients
        </div>
        <p className="t-caption" style={{ margin: 0, color: "var(--signal-abort)" }}>
          {clientsReason ?? "The client list did not come back from the database."}{" "}
          Nothing was changed. Reload the page — a report cannot be attributed
          without one.
        </p>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="relative">
      <div
        className="flex items-center"
        style={{
          gap: "var(--space-2)",
          minHeight: "var(--cap-m-h)",
          padding: "var(--space-1) var(--space-2) var(--space-1) var(--space-4)",
          borderRadius: "var(--radius-capsule)",
          background: "var(--surface-raised)",
          border: `1px solid ${
            invalid
              ? "var(--signal-abort)"
              : open
                ? "var(--stroke-focus)"
                : "var(--stroke-rim)"
          }`,
          boxShadow: "var(--e1)",
          opacity: disabled ? 0.5 : 1,
          transition: "border-color var(--dur-glide) var(--ease-glide)",
        }}
      >
        <Building2
          size={16}
          strokeWidth={1.75}
          aria-hidden="true"
          style={{ flex: "none", color: "var(--content-tertiary)" }}
        />

        {selected && term === "" ? (
          <span
            className="t-subhead"
            style={{
              flex: "1 1 auto",
              minWidth: 0,
              color: "var(--content-primary)",
              fontWeight: 600,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {selected.name}
          </span>
        ) : null}

        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          autoComplete="off"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          aria-activedescendant={
            open && visible.length > 0 ? `${id}-option-${clamped}` : undefined
          }
          disabled={disabled}
          value={term}
          placeholder={selected ? "" : "Search clients…"}
          onChange={(event) => {
            setTerm(event.currentTarget.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className={cn("t-subhead")}
          style={{
            flex: selected && term === "" ? "0 1 var(--space-16)" : "1 1 auto",
            minWidth: 0,
            background: "transparent",
            border: 0,
            outline: "none",
            color: "var(--content-primary)",
            fontFamily: "var(--font-text)",
            padding: "var(--space-2) 0",
          }}
        />

        {selected ? (
          <button
            type="button"
            aria-label={`Clear ${selected.name}`}
            disabled={disabled}
            onClick={() => {
              onChange(null);
              setTerm("");
              inputRef.current?.focus();
            }}
            className="relative"
            style={{
              flex: "none",
              width: "36px",
              height: "36px",
              display: "grid",
              placeItems: "center",
              borderRadius: "var(--radius-capsule)",
              background: "transparent",
              border: 0,
              color: "var(--content-tertiary)",
              cursor: "pointer",
            }}
          >
            <span
              aria-hidden="true"
              style={{
                position: "absolute",
                inset: "50% auto auto 50%",
                width: "44px",
                height: "44px",
                transform: "translate(-50%, -50%)",
              }}
            />
            <X size={16} strokeWidth={1.75} aria-hidden="true" />
          </button>
        ) : null}

        <button
          type="button"
          aria-label={open ? "Close the client list" : "Open the client list"}
          disabled={disabled}
          onClick={() => {
            setOpen((current) => !current);
            inputRef.current?.focus();
          }}
          className="relative"
          style={{
            flex: "none",
            width: "36px",
            height: "36px",
            display: "grid",
            placeItems: "center",
            borderRadius: "var(--radius-capsule)",
            background: "transparent",
            border: 0,
            color: "var(--content-tertiary)",
            cursor: "pointer",
          }}
        >
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: "50% auto auto 50%",
              width: "44px",
              height: "44px",
              transform: "translate(-50%, -50%)",
            }}
          />
          <ChevronDown
            size={16}
            strokeWidth={1.75}
            aria-hidden="true"
            style={{
              transform: open ? "rotate(180deg)" : "none",
              transition: "transform var(--dur-glide) var(--ease-glide)",
            }}
          />
        </button>
      </div>

      {/* The listbox stays mounted only while open — an unlabelled empty
          listbox in the accessibility tree is noise, not a control. */}
      {open ? (
        <ul
          id={listId}
          role="listbox"
          aria-label="Clients"
          style={{
            position: "absolute",
            zIndex: 40,
            top: "calc(100% + var(--space-2))",
            left: 0,
            right: 0,
            margin: 0,
            padding: "var(--space-2)",
            listStyle: "none",
            maxHeight: "320px",
            overflowY: "auto",
            background: "var(--surface-raised)",
            border: "1px solid var(--stroke-rim)",
            // Concentric: the popover is radius-lg, its rows radius-lg minus
            // the space-2 padding.
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--e3)",
          }}
        >
          {visible.length === 0 ? (
            <li
              className="t-subhead"
              style={{
                padding: "var(--space-3) var(--space-4)",
                color: "var(--content-secondary)",
              }}
            >
              No client matches “{term.trim()}”. Add the client on the Clients
              screen first — a report cannot be attributed to a name that has no
              record.
            </li>
          ) : (
            visible.map((client, index) => {
              const isSelected = client.id === value;
              const isActive = index === clamped;
              return (
                <li key={client.id} role="presentation">
                  <button
                    id={`${id}-option-${index}`}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onPointerEnter={() => setActive(index)}
                    onClick={() => choose(client)}
                    className="flex w-full items-center text-left"
                    style={{
                      gap: "var(--space-3)",
                      minHeight: "44px",
                      padding: "var(--space-2) var(--space-3)",
                      borderRadius: "calc(var(--radius-lg) - var(--space-2))",
                      background: isActive ? "var(--fill-quiet)" : "transparent",
                      border: 0,
                      color: "var(--content-primary)",
                      cursor: "pointer",
                    }}
                  >
                    <span style={{ flex: "1 1 auto", minWidth: 0 }}>
                      <span
                        className="t-subhead"
                        style={{ display: "block", fontWeight: 600 }}
                      >
                        {client.name}
                      </span>
                      <span
                        className="t-caption"
                        style={{ display: "block", color: "var(--content-tertiary)" }}
                      >
                        {client.slug}
                        {client.status !== "active" ? ` · ${client.status}` : ""}
                      </span>
                    </span>
                    {isSelected ? (
                      <Check
                        size={16}
                        strokeWidth={2}
                        aria-hidden="true"
                        style={{ flex: "none", color: "var(--content-accent)" }}
                      />
                    ) : null}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      ) : null}
    </div>
  );
}
