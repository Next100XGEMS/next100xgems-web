import type { Permission, RoleKey } from "@/lib/auth/authorization";

export type AdminNavItem = {
  label: string;
  href: string;
  permissions: readonly Permission[];
  planned?: boolean;
  operatorOnly?: boolean;
};

export type AdminNavGroup = {
  label?: string;
  items: readonly AdminNavItem[];
};

const operatorRoles: readonly RoleKey[] = ["owner", "admin"];

const navigationGroups: readonly (AdminNavGroup & { operatorOnly?: boolean })[] = [
  {
    items: [{ label: "Overview", href: "/admin", permissions: [] }],
  },
  {
    label: "Content",
    items: [
      {
        label: "Research",
        href: "/admin/research",
        permissions: ["research.read.all", "research.read.own_draft", "research.read.published"],
      },
    ],
  },
  {
    label: "Intelligence",
    items: [
      {
        label: "Radar",
        href: "/admin/radar",
        permissions: ["radar.read.analysis", "radar.read.review"],
      },
    ],
  },
  {
    label: "Commercial",
    items: [
      { label: "Featured Partners", href: "/admin/partners", permissions: ["partners.read.all", "partners.read.active"] },
      { label: "Sponsors", href: "/admin/sponsors", permissions: ["commercial.read"] },
      { label: "Advertising", href: "/admin/advertising", permissions: ["commercial.read"] },
      { label: "Campaigns", href: "/admin/campaigns", permissions: ["commercial.read"] },
    ],
  },
  {
    label: "Operations",
    items: [
      { label: "Leads", href: "/admin/leads", permissions: ["leads.read"] },
      { label: "Bookings", href: "/admin/bookings", permissions: [], planned: true, operatorOnly: true },
      { label: "Network", href: "/admin/network", permissions: [], planned: true, operatorOnly: true },
    ],
  },
  {
    label: "System",
    items: [
      { label: "Feature Flags", href: "/admin/feature-flags", permissions: ["configuration.read"] },
      { label: "Site Settings", href: "/admin/settings", permissions: ["configuration.read"] },
      { label: "Navigation", href: "/admin/navigation", permissions: ["configuration.read"] },
      { label: "Users & Roles", href: "/admin/users", permissions: ["identity.read.directory"] },
      { label: "Audit Logs", href: "/admin/audit", permissions: [], planned: true, operatorOnly: true },
    ],
  },
];

export const roleLabels: Record<RoleKey, string> = {
  owner: "Owner",
  admin: "Admin",
  editor: "Editor",
  radar_reviewer: "Radar Reviewer",
  ad_manager: "Ad Manager",
  analyst: "Analyst",
  viewer: "Viewer",
};

export function getAdminNavigation(
  permissions: readonly Permission[],
  roles: readonly RoleKey[],
): AdminNavGroup[] {
  const isOperator = roles.some((role) => operatorRoles.includes(role));

  return navigationGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (item.operatorOnly && !isOperator) {
          return false;
        }

        if (item.planned) {
          return true;
        }

        return item.permissions.length === 0 || item.permissions.some((permission) => permissions.includes(permission));
      }),
    }))
    .filter((group) => group.items.length > 0);
}
