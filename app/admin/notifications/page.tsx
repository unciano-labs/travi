import { requireSession, assertRole } from '@/lib/auth-helpers';
import { getAllNotifications } from '@/actions/notifications';
import NotificationsClient from '@/components/admin/NotificationsClient';

export const metadata = {
  title: 'Notifications | Admin',
};

export default async function AdminNotificationsPage() {
  const { user } = await requireSession();
  await assertRole(user.id, 'admin');

  const notifications = await getAllNotifications();

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <NotificationsClient initialData={notifications} />
    </div>
  );
}
