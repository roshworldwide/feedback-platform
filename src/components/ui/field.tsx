"use client";

/**
 * Fields.
 *
 * The label sits ABOVE the control and stays there — a placeholder that
 * vanishes the moment you type is not a label. Validation runs on blur, never
 * per keystroke, so nobody is told they are wrong while they are still typing.
 * An error names the state and the next action, and the field keeps every
 * character the user typed.
 */

import * as React from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

type FieldContextValue = {
  id: string;
  describedBy?: string;
  invalid: boolean;
  disabled: boolean;
  /** Lets a control publish its own blur-time verdict to the Field. */
  setError: (message: string | null) => void;
};

const FieldContext = React.createContext<FieldContextValue | null>(null);

/** Controls work standalone too, so the context is optional by design. */
function useFieldContext(): FieldContextValue | null {
  return React.useContext(FieldContext);
}

export type FieldProps = Omit<React.ComponentProps<"div">, "children"> & {
  label: string;
  children: React.ReactNode;
  /** A steady explanation. Never a substitute for the label. */
  hint?: React.ReactNode;
  /** An externally-owned error. Takes precedence over blur validation. */
  error?: string | null;
  required?: boolean;
  disabled?: boolean;
  /** Stated on screen when a rule silently excludes data — never applied mutely. */
  note?: React.ReactNode;
};

export function Field({
  label,
  children,
  hint,
  error,
  required = false,
  disabled = false,
  note,
  className,
  style,
  ...rest
}: FieldProps) {
  const reactId = React.useId();
  const id = `${reactId}-control`;
  const hintId = `${reactId}-hint`;
  const errorId = `${reactId}-error`;
  const noteId = `${reactId}-note`;

  const [selfError, setSelfError] = React.useState<string | null>(null);
  const shown = error ?? selfError;

  const describedBy =
    [hint ? hintId : null, note ? noteId : null, shown ? errorId : null]
      .filter(Boolean)
      .join(" ") || undefined;

  const context = React.useMemo<FieldContextValue>(
    () => ({
      id,
      describedBy,
      invalid: Boolean(shown),
      disabled,
      setError: setSelfError,
    }),
    [id, describedBy, shown, disabled],
  );

  return (
    <div
      {...rest}
      className={cn("flex flex-col", className)}
      style={{ gap: "var(--space-2)", ...style }}
    >
      <label
        htmlFor={id}
        className="t-footnote"
        style={{
          color: "var(--content-secondary)",
          fontWeight: 600,
          opacity: disabled ? 0.5 : 1,
        }}
      >
        {label}
        {required ? (
          <span
            aria-hidden="true"
            style={{ color: "var(--signal-abort)", marginLeft: "var(--space-1)" }}
          >
            *
          </span>
        ) : null}
        {required ? <span className="sr-only"> (required)</span> : null}
      </label>

      <FieldContext.Provider value={context}>{children}</FieldContext.Provider>

      {hint ? (
        <p
          id={hintId}
          className="t-caption"
          style={{ margin: 0, color: "var(--content-tertiary)" }}
        >
          {hint}
        </p>
      ) : null}

      {note ? (
        <p
          id={noteId}
          className="t-caption"
          style={{ margin: 0, color: "var(--content-tertiary)" }}
        >
          {note}
        </p>
      ) : null}

      {shown ? (
        <p
          id={errorId}
          role="alert"
          className="t-caption"
          style={{ margin: 0, color: "var(--signal-abort)" }}
        >
          {shown}
        </p>
      ) : null}
    </div>
  );
}

/* ── Shared control chrome ────────────────────────────────────────────────── */

function controlStyle(
  invalid: boolean,
  focused: boolean,
  radius: string,
): React.CSSProperties {
  return {
    width: "100%",
    minHeight: "var(--cap-m-h)",
    padding: "var(--space-3) var(--space-4)",
    borderRadius: radius,
    background: "var(--surface-raised)",
    border: `1px solid ${
      invalid
        ? "var(--signal-abort)"
        : focused
          ? "var(--stroke-focus)"
          : "var(--stroke-rim)"
    }`,
    color: "var(--content-primary)",
    fontFamily: "var(--font-text)",
    fontSize: "var(--cap-m-label)",
    lineHeight: "22px",
    boxShadow: "var(--e1)",
    transition: "border-color var(--dur-glide) var(--ease-glide)",
  };
}

type ValidatingProps = {
  /** Runs on blur only. Return null when the value is acceptable. */
  validate?: (value: string) => string | null;
};

/* ── TextInput ────────────────────────────────────────────────────────────── */

export type TextInputProps = Omit<React.ComponentProps<"input">, "ref"> &
  ValidatingProps & { ref?: React.Ref<HTMLInputElement> };

export function TextInput({
  validate,
  className,
  style,
  onBlur,
  onFocus,
  id,
  ref,
  ...rest
}: TextInputProps) {
  const field = useFieldContext();
  const [focused, setFocused] = React.useState(false);
  const fallbackId = React.useId();

  return (
    <input
      {...rest}
      ref={ref}
      id={id ?? field?.id ?? fallbackId}
      aria-describedby={rest["aria-describedby"] ?? field?.describedBy}
      aria-invalid={field?.invalid || undefined}
      disabled={rest.disabled ?? field?.disabled}
      className={cn(className)}
      style={{
        ...controlStyle(Boolean(field?.invalid), focused, "var(--radius-sm)"),
        ...style,
      }}
      onFocus={(event) => {
        setFocused(true);
        onFocus?.(event);
      }}
      onBlur={(event) => {
        setFocused(false);
        // The value is never cleared, corrected or reformatted here.
        if (validate) field?.setError(validate(event.currentTarget.value));
        onBlur?.(event);
      }}
    />
  );
}

/* ── TextArea ─────────────────────────────────────────────────────────────── */

export type TextAreaProps = Omit<React.ComponentProps<"textarea">, "ref"> &
  ValidatingProps & { ref?: React.Ref<HTMLTextAreaElement> };

export function TextArea({
  validate,
  className,
  style,
  onBlur,
  onFocus,
  id,
  rows = 4,
  ref,
  ...rest
}: TextAreaProps) {
  const field = useFieldContext();
  const [focused, setFocused] = React.useState(false);
  const fallbackId = React.useId();

  return (
    <textarea
      {...rest}
      ref={ref}
      rows={rows}
      id={id ?? field?.id ?? fallbackId}
      aria-describedby={rest["aria-describedby"] ?? field?.describedBy}
      aria-invalid={field?.invalid || undefined}
      disabled={rest.disabled ?? field?.disabled}
      className={cn(className)}
      style={{
        ...controlStyle(Boolean(field?.invalid), focused, "var(--radius-sm)"),
        resize: "vertical",
        ...style,
      }}
      onFocus={(event) => {
        setFocused(true);
        onFocus?.(event);
      }}
      onBlur={(event) => {
        setFocused(false);
        if (validate) field?.setError(validate(event.currentTarget.value));
        onBlur?.(event);
      }}
    />
  );
}

/* ── Select ───────────────────────────────────────────────────────────────── */

export type SelectOption = { value: string; label: string; disabled?: boolean };

export type SelectProps = Omit<React.ComponentProps<"select">, "ref"> &
  ValidatingProps & {
    options: SelectOption[];
    /** Shown first and disabled — a chooser, not a value. */
    placeholder?: string;
    ref?: React.Ref<HTMLSelectElement>;
  };

export function Select({
  options,
  placeholder,
  validate,
  className,
  style,
  onBlur,
  onFocus,
  id,
  ref,
  ...rest
}: SelectProps) {
  const field = useFieldContext();
  const [focused, setFocused] = React.useState(false);
  const fallbackId = React.useId();

  return (
    <span className="relative block w-full">
      <select
        {...rest}
        ref={ref}
        id={id ?? field?.id ?? fallbackId}
        aria-describedby={rest["aria-describedby"] ?? field?.describedBy}
        aria-invalid={field?.invalid || undefined}
        disabled={rest.disabled ?? field?.disabled}
        className={cn("appearance-none", className)}
        style={{
          ...controlStyle(
            Boolean(field?.invalid),
            focused,
            "var(--radius-capsule)",
          ),
          paddingRight: "var(--space-8)",
          cursor: "pointer",
          ...style,
        }}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          if (validate) field?.setError(validate(event.currentTarget.value));
          onBlur?.(event);
        }}
      >
        {placeholder ? (
          <option value="" disabled>
            {placeholder}
          </option>
        ) : null}
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={16}
        strokeWidth={1.75}
        aria-hidden="true"
        style={{
          position: "absolute",
          right: "var(--space-4)",
          top: "50%",
          transform: "translateY(-50%)",
          color: "var(--content-tertiary)",
          pointerEvents: "none",
        }}
      />
    </span>
  );
}

/* ── SearchInput ──────────────────────────────────────────────────────────── */

export type SearchInputProps = Omit<
  React.ComponentProps<"input">,
  "type" | "ref"
> & {
  /** Fired on every change — search filters, it does not validate. */
  onSearch?: (value: string) => void;
  onClear?: () => void;
  ref?: React.Ref<HTMLInputElement>;
};

export function SearchInput({
  onSearch,
  onClear,
  className,
  style,
  onChange,
  onFocus,
  onBlur,
  id,
  value,
  defaultValue,
  ref,
  ...rest
}: SearchInputProps) {
  const field = useFieldContext();
  const [focused, setFocused] = React.useState(false);
  const [internal, setInternal] = React.useState(
    typeof defaultValue === "string" ? defaultValue : "",
  );
  const fallbackId = React.useId();
  const controlled = value !== undefined;
  const current = controlled ? String(value) : internal;
  const innerRef = React.useRef<HTMLInputElement | null>(null);

  return (
    <span className="relative block w-full">
      <Search
        size={16}
        strokeWidth={1.75}
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "var(--space-4)",
          top: "50%",
          transform: "translateY(-50%)",
          color: "var(--content-tertiary)",
          pointerEvents: "none",
        }}
      />
      <input
        {...rest}
        ref={(node) => {
          innerRef.current = node;
          if (typeof ref === "function") ref(node);
          else if (ref) ref.current = node;
        }}
        type="search"
        value={controlled ? value : internal}
        id={id ?? field?.id ?? fallbackId}
        aria-describedby={rest["aria-describedby"] ?? field?.describedBy}
        disabled={rest.disabled ?? field?.disabled}
        className={cn(className)}
        style={{
          ...controlStyle(false, focused, "var(--radius-capsule)"),
          paddingLeft: "var(--space-8)",
          paddingRight: "var(--space-8)",
          ...style,
        }}
        onChange={(event) => {
          if (!controlled) setInternal(event.currentTarget.value);
          onSearch?.(event.currentTarget.value);
          onChange?.(event);
        }}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
      />
      {current.length > 0 ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => {
            if (!controlled) setInternal("");
            onSearch?.("");
            onClear?.();
            innerRef.current?.focus();
          }}
          style={{
            position: "absolute",
            right: "var(--space-1)",
            top: "50%",
            transform: "translateY(-50%)",
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
    </span>
  );
}
