export type ProjectConsoleNavItem = {
  label: string;
  href: string;
  segment: string;
};

export function getProjectConsoleNav(projectId: string): readonly ProjectConsoleNavItem[] {
  const base = `/projects/${projectId}`;
  return [
    { label: "Overview", href: base, segment: "" },
    { label: "Profile", href: `${base}/profile`, segment: "profile" },
    { label: "Official Data", href: `${base}/official-data`, segment: "official-data" },
    { label: "Announcements", href: `${base}/announcements`, segment: "announcements" },
    { label: "Analytics", href: `${base}/analytics`, segment: "analytics" },
    { label: "Campaigns", href: `${base}/campaigns`, segment: "campaigns" },
    { label: "Team", href: `${base}/team`, segment: "team" },
    { label: "Media Kit", href: `${base}/media-kit`, segment: "media-kit" },
    { label: "Settings", href: `${base}/settings`, segment: "settings" },
  ] as const;
}
