import {
  Building2,
  ClipboardCheck,
  LayoutDashboard,
  MessageSquareQuote,
  Send,
  Settings,
  SquarePen,
  Workflow,
  type LucideIcon,
} from "lucide-react";

/**
 * The eight destinations, stated once.
 *
 * Order is the order of the working day: look at the numbers, then the sends,
 * then the people they went to, then write the next one. Audits sits last —
 * its own upload-to-send flow, reached for less often than a daily report.
 */
export type NavItem = {
  href: string;
  /** The label in the rail and the page title in the top bar. */
  label: string;
  icon: LucideIcon;
  /** Announced to a screen reader in the collapsed rail. */
  hint: string;
};

export const NAV_ITEMS: readonly NavItem[] = [
  {
    href: "/overview",
    label: "Overview",
    icon: LayoutDashboard,
    hint: "Delivery, engagement and satisfaction for a period",
  },
  {
    href: "/campaigns",
    label: "Campaigns",
    icon: Send,
    hint: "Every report that has been sent or is queued",
  },
  {
    href: "/clients",
    label: "Clients",
    icon: Building2,
    hint: "Accounts, contacts and health",
  },
  {
    href: "/compose",
    label: "Compose",
    icon: SquarePen,
    hint: "Write and schedule the next report",
  },
  {
    href: "/feedback",
    label: "Feedback",
    icon: MessageSquareQuote,
    hint: "Ratings and comments, with the report each belongs to",
  },
  {
    href: "/automation",
    label: "Automation",
    icon: Workflow,
    hint: "Rules that watch for silence and low ratings",
  },
  {
    href: "/settings",
    label: "Settings",
    icon: Settings,
    hint: "People, finishes and delivery configuration",
  },
  {
    href: "/audits",
    label: "Audits",
    icon: ClipboardCheck,
    hint: "Upload a call-audit CSV, review the report, send it as a campaign",
  },
] as const;

export type UserRole = "admin" | "team_lead" | "analyst";

export const ROLE_LABEL: Record<UserRole, string> = {
  admin: "Admin",
  team_lead: "Team lead",
  analyst: "Analyst",
};

export function roleLabel(role: string): string {
  return role in ROLE_LABEL ? ROLE_LABEL[role as UserRole] : "Member";
}

/** The signed-in person, as the shell needs them. */
export type ShellProfile = {
  id: string;
  email: string;
  full_name: string;
  role: string;
};

/** The nav item that owns a path — `/campaigns/abc` still lights Campaigns. */
export function activeItem(pathname: string): NavItem | null {
  return (
    NAV_ITEMS.find(
      (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
    ) ?? null
  );
}

export type Crumb = { label: string; href?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function humanise(segment: string): string {
  if (UUID.test(segment)) return "Detail";
  const words = segment.replace(/-/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * The trail, and the title as its last step. `/campaigns/<uuid>` reads
 * "Convin Data Labs · Campaigns" over the title "Detail".
 */
export function trailFor(pathname: string): { crumbs: Crumb[]; title: string } {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return { crumbs: [], title: "Convin Data Labs" };

  const owner = activeItem(pathname);
  const crumbs: Crumb[] = [{ label: "Convin Data Labs", href: "/overview" }];

  if (!owner) {
    return {
      crumbs,
      title: humanise(segments[segments.length - 1]),
    };
  }

  const rest = segments.slice(1);
  if (rest.length > 0) crumbs.push({ label: owner.label, href: owner.href });

  return {
    crumbs,
    title: rest.length === 0 ? owner.label : humanise(rest[rest.length - 1]),
  };
}
