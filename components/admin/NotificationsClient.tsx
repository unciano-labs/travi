'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { 
  Bell, Check, Map, Users, CreditCard, Bus, UserPlus 
} from 'lucide-react';
import { markNotificationAsRead, markAllNotificationsAsRead } from '@/actions/notifications';
import PageHeader from '@/components/ui/PageHeader';
import CardBox from '@/components/ui/CardBox';
import EmptyState from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/button';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

export default function NotificationsClient({ initialData }: { initialData: Notification[] }) {
  const [notifications, setNotifications] = useState(initialData);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const router = useRouter();

  const handleMarkAllAsRead = async () => {
    setIsMarkingAll(true);
    const result = await markAllNotificationsAsRead();
    if (result.success) {
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    }
    setIsMarkingAll(false);
  };

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.is_read) {
      // Optimistic update
      setNotifications(prev => prev.map(n => n.id === notification.id ? { ...n, is_read: true } : n));
      await markNotificationAsRead(notification.id);
    }
    
    if (notification.link) {
      router.push(notification.link);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'account_created': return <UserPlus className="size-5 text-info" />;
      case 'organizer_created': return <Users className="size-5 text-primary" />;
      case 'transporter_created': return <Bus className="size-5 text-success" />;
      case 'tour_created': return <Map className="size-5 text-warning" />;
      case 'booking_created': return <CreditCard className="size-5 text-secondary" />;
      default: return <Bell className="size-5 text-muted-foreground" />;
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <>
      <PageHeader
        title="Notifications"
        description={`You have ${unreadCount} unread message${unreadCount !== 1 ? 's' : ''}`}
        breadcrumbs={[{ title: 'Admin', href: '/admin' }, { title: 'Notifications' }]}
        actions={unreadCount > 0 && (
          <Button
            type="button"
            variant="neutral"
            onClick={handleMarkAllAsRead}
            disabled={isMarkingAll}
          >
            <Check />
            Mark all as read
          </Button>
        )}
      />

      <CardBox className="gap-0 overflow-hidden p-0">
        {notifications.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="All Caught Up!"
            description="You don't have any notifications yet."
          />
        ) : (
          <ul className="divide-y divide-border">
            {notifications.map((notification) => (
              <li key={notification.id}>
                <button
                  type="button"
                  onClick={() => handleNotificationClick(notification)}
                  className={`flex w-full items-start gap-4 p-4 text-left transition-colors hover:bg-lightprimary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40 sm:p-6 ${!notification.is_read ? 'bg-lightprimary/30' : ''}`}
                >
                  <div className={`mt-1 flex size-10 flex-shrink-0 items-center justify-center rounded-full ${!notification.is_read ? 'bg-white ring-1 ring-border' : 'bg-muted'}`}>
                    {getIcon(notification.type)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <p className={`truncate text-sm font-semibold ${!notification.is_read ? 'text-foreground' : 'text-bodytext'}`}>
                        {notification.title}
                      </p>
                      <span className="whitespace-nowrap text-xs font-medium text-muted-foreground">
                        {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    <p className={`line-clamp-2 text-sm ${!notification.is_read ? 'font-medium text-bodytext' : 'text-muted-foreground'}`}>
                      {notification.message}
                    </p>
                  </div>
                  {!notification.is_read && (
                    <span className="mt-2.5 size-2.5 flex-shrink-0 rounded-full bg-primary"><span className="sr-only">Unread</span></span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardBox>
    </>
  );
}
