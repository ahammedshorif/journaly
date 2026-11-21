import { BarChart3, CandlestickChart, LayoutDashboard, Settings, Target, Wallet, type LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** shown in the mobile bottom bar (max 5); the rest live in the user menu on mobile */
  mobile: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, mobile: true },
  { href: "/trades", label: "Trades", icon: CandlestickChart, mobile: true },
  { href: "/analytics", label: "Analytics", icon: BarChart3, mobile: true },
  { href: "/accounts", label: "Accounts", icon: Wallet, mobile: true },
  { href: "/goals", label: "Goals", icon: Target, mobile: true },
  { href: "/settings", label: "Settings", icon: Settings, mobile: false },
];

export const MOBILE_NAV_ITEMS = NAV_ITEMS.filter((i) => i.mobile);

export function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
