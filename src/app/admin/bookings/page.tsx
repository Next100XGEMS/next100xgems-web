import AdminPlaceholderPage from "@/components/admin/admin-placeholder-page";

export default function BookingsAdminPage() {
  return <AdminPlaceholderPage eyebrow="Operations · Bookings" title="Bookings" description="Booking provider and operational workflows remain undecided and deferred." permissions={["configuration.read", "identity.read.directory"]} path="/admin/bookings" />;
}
