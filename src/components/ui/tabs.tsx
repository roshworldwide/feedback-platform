"use client";

/**
 * Tabs — a real tablist with roving tabindex.
 *
 * Exactly one tab is in the tab order at a time; the arrow keys move between
 * them and Home/End jump to the ends. Panels are labelled by their tab and
 * tabs are controlled by their panel, both ways round.
 */

import * as React from "react";
import { cn } from "@/lib/utils";

type TabsContextValue = {
  value: string;
  setValue: (value: string) => void;
  baseId: string;
  register: (value: string, node: HTMLButtonElement | null) => void;
  order: React.RefObject<string[]>;
};

const TabsContext = React.createContext<TabsContextValue | null>(null);

function useTabs(component: string): TabsContextValue {
  const context = React.useContext(TabsContext);
  if (!context) throw new Error(`<${component}> must be used inside <Tabs>`);
  return context;
}

export type TabsProps = Omit<React.ComponentProps<"div">, "onChange"> & {
  value?: string;
  defaultValue: string;
  onValueChange?: (value: string) => void;
};

export function Tabs({
  value,
  defaultValue,
  onValueChange,
  className,
  style,
  children,
  ...rest
}: TabsProps) {
  const baseId = React.useId();
  const [internal, setInternal] = React.useState(defaultValue);
  const current = value ?? internal;
  const nodes = React.useRef(new Map<string, HTMLButtonElement>());
  const order = React.useRef<string[]>([]);

  const setValue = React.useCallback(
    (next: string) => {
      if (value === undefined) setInternal(next);
      onValueChange?.(next);
    },
    [value, onValueChange],
  );

  const register = React.useCallback(
    (tabValue: string, node: HTMLButtonElement | null) => {
      if (node) {
        nodes.current.set(tabValue, node);
        if (!order.current.includes(tabValue)) order.current.push(tabValue);
      } else {
        nodes.current.delete(tabValue);
        order.current = order.current.filter((item) => item !== tabValue);
      }
    },
    [],
  );

  const context = React.useMemo<TabsContextValue>(
    () => ({ value: current, setValue, baseId, register, order }),
    [current, setValue, baseId, register],
  );

  return (
    <TabsContext.Provider value={context}>
      <div
        {...rest}
        className={cn("flex flex-col", className)}
        style={{ gap: "var(--space-5)", ...style }}
        data-tabs-root={baseId}
      >
        {children}
      </div>
    </TabsContext.Provider>
  );
}

export type TabListProps = React.ComponentProps<"div"> & { label: string };

export function TabList({ label, className, style, children, ...rest }: TabListProps) {
  const { value, setValue, order } = useTabs("TabList");
  const listRef = React.useRef<HTMLDivElement | null>(null);

  function focusValue(next: string) {
    setValue(next);
    const node = listRef.current?.querySelector<HTMLButtonElement>(
      `[data-tab-value="${CSS.escape(next)}"]`,
    );
    node?.focus();
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const values = order.current.filter((item) => {
      const node = listRef.current?.querySelector<HTMLButtonElement>(
        `[data-tab-value="${CSS.escape(item)}"]`,
      );
      return node ? !node.disabled : false;
    });
    if (values.length === 0) return;
    const index = values.indexOf(value);

    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        event.preventDefault();
        focusValue(values[(index + 1) % values.length]);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        event.preventDefault();
        focusValue(values[(index - 1 + values.length) % values.length]);
        break;
      case "Home":
        event.preventDefault();
        focusValue(values[0]);
        break;
      case "End":
        event.preventDefault();
        focusValue(values[values.length - 1]);
        break;
      default:
        break;
    }
  }

  return (
    <div
      {...rest}
      ref={listRef}
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn("flex items-end overflow-x-auto", className)}
      style={{
        gap: "var(--space-5)",
        borderBottom: "1px solid var(--stroke-hairline)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export type TabProps = Omit<React.ComponentProps<"button">, "value" | "ref"> & {
  value: string;
  /** A count beside the label — always the true total. */
  count?: number | null;
  ref?: React.Ref<HTMLButtonElement>;
};

export function Tab({
  value,
  count,
  className,
  style,
  children,
  disabled,
  onClick,
  ref,
  ...rest
}: TabProps) {
  const { value: current, setValue, baseId, register } = useTabs("Tab");
  const selected = current === value;

  return (
    <button
      {...rest}
      ref={(node) => {
        register(value, node);
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
      }}
      type="button"
      role="tab"
      id={`${baseId}-tab-${value}`}
      data-tab-value={value}
      aria-selected={selected}
      aria-controls={`${baseId}-panel-${value}`}
      tabIndex={selected ? 0 : -1}
      disabled={disabled}
      onClick={(event) => {
        if (!disabled) setValue(value);
        onClick?.(event);
      }}
      className={cn("relative inline-flex items-center whitespace-nowrap", className)}
      style={{
        gap: "var(--space-2)",
        minHeight: "44px",
        paddingInline: "var(--space-1)",
        background: "transparent",
        border: 0,
        borderBottom: `2px solid ${selected ? "var(--content-accent)" : "transparent"}`,
        fontFamily: "var(--font-text)",
        fontSize: "var(--cap-s-label)",
        fontWeight: selected ? 600 : 400,
        letterSpacing: "var(--tr-subhead)",
        color: selected ? "var(--content-primary)" : "var(--content-secondary)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
        transition:
          "color var(--dur-glide) var(--ease-glide), " +
          "border-color var(--dur-glide) var(--ease-glide)",
        ...style,
      }}
    >
      {children}
      {count !== undefined && count !== null ? (
        <span className="t-micro tabular" style={{ color: "var(--content-tertiary)" }}>
          {count}
        </span>
      ) : null}
    </button>
  );
}

export type TabPanelProps = React.ComponentProps<"div"> & { value: string };

export function TabPanel({ value, className, style, children, ...rest }: TabPanelProps) {
  const { value: current, baseId } = useTabs("TabPanel");
  if (current !== value) return null;

  return (
    <div
      {...rest}
      role="tabpanel"
      id={`${baseId}-panel-${value}`}
      aria-labelledby={`${baseId}-tab-${value}`}
      tabIndex={0}
      className={cn(className)}
      style={style}
    >
      {children}
    </div>
  );
}
