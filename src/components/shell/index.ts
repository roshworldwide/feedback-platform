/**
 * The application frame. Everything here is chrome — no screen owns any of it,
 * and no screen may re-implement any of it.
 */

export { AppShell } from "./app-shell";
export type { AppShellProps } from "./app-shell";

export { Sidebar, RAIL_WIDTH, RAIL_WIDTH_COLLAPSED } from "./sidebar";
export type { SidebarProps } from "./sidebar";

export { TopBar } from "./top-bar";
export type { TopBarProps } from "./top-bar";

export { ThemeScript } from "./theme-script";

export {
  NAV_ITEMS,
  ROLE_LABEL,
  roleLabel,
  activeItem,
  trailFor,
} from "./nav";
export type { NavItem, Crumb, ShellProfile, UserRole } from "./nav";

export { useMediaQuery, RAIL_COLLAPSE, RAIL_DRAWER } from "./use-media-query";
