import { EmptyState, Panel } from "@/components/ui";
import type { Permission } from "@/lib/auth/authorization";

import AdminAccessDenied from "./admin-access-denied";
import AdminPageHeader from "./admin-page-header";
import { getAdminPageAccess } from "./page-access";

export default async function AdminPlaceholderPage({ title, description, eyebrow, permissions, path }: { title: string; description: string; eyebrow: string; permissions: readonly Permission[]; path: string }) {
  const context = await getAdminPageAccess(permissions, path);

  if (!context) {
    return <AdminAccessDenied message="This Admin module is not available for the current application role." />;
  }

  return (
    <div className="space-y-8">
      <AdminPageHeader eyebrow={eyebrow} title={title} description={description} status="FOUNDATION ONLY" />
      <Panel family="admin">
        <EmptyState title="Planned for a later gate" description="The Admin shell is ready, but this module has no records, controls, or mutation paths in Gate 10." />
      </Panel>
    </div>
  );
}
