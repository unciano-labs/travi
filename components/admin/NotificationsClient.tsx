'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { 
  Bell, Check, Map, Users, CreditCard, Bus, UserPlus, FileCheck 
} from 'lucide-react';
import { markNotificationAsRead, markAllNotificationsAsRead } from '@/actions/notifications';

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
      case 'account_created': return <UserPlus className="w-5 h-5 text-indigo-500" />;
      case 'organizer_created': return <Users className="w-5 h-5 text-blue-500" />;
      case 'transporter_created': return <Bus className="w-5 h-5 text-emerald-500" />;
      case 'tour_created': return <Map className="w-5 h-5 text-orange-500" />;
      case 'booking_created': return <CreditCard className="w-5 h-5 text-green-500" />;
      default: return <Bell className="w-5 h-5 text-slate-500" />;
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Notifications</h1>
          <p className="text-slate-500 mt-1">You have {unreadCount} unread message{unreadCount !== 1 ? 's' : ''}</p>
        </div>
        
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllAsRead}
            disabled={isMarkingAll}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 hover:text-slate-900 transition-colors disabled:opacity-50"
          >
            <Check className="w-4 h-4" />
            Mark all as read
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Bell className="w-8 h-8 text-slate-300" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-1">All Caught Up!</h3>
          <p className="text-slate-500">You don't have any notifications yet.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <ul className="divide-y divide-slate-100">
            {notifications.map((notification) => (
              <li key={notification.id}>
                <button
                  onClick={() => handleNotificationClick(notification)}
                  className={`w-full text-left p-4 sm:p-6 transition-colors hover:bg-slate-50 flex items-start gap-4 ${!notification.is_read ? 'bg-sky-50/30' : ''}`}
                >
                  <div className={`mt-1 flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${!notification.is_read ? 'bg-white shadow-sm ring-1 ring-slate-200/50' : 'bg-slate-100'}`}>
                    {getIcon(notification.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className={`text-sm font-bold truncate ${!notification.is_read ? 'text-slate-900' : 'text-slate-700'}`}>
                        {notification.title}
                      </p>
                      <span className="text-xs font-medium text-slate-400 whitespace-nowrap">
                        {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    <p className={`text-sm line-clamp-2 ${!notification.is_read ? 'text-slate-600 font-medium' : 'text-slate-500'}`}>
                      {notification.message}
                    </p>
                  </div>
                  {!notification.is_read && (
                    <div className="flex-shrink-0 w-2.5 h-2.5 rounded-full bg-sky-500 mt-2.5"></div>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
