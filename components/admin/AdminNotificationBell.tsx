'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import { createClient } from '@/lib/supabase/browser';
import { getUnreadNotifications } from '@/actions/notifications';

export default function AdminNotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [isPulsing, setIsPulsing] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    // Initial fetch
    const fetchInitialCount = async () => {
      const data = await getUnreadNotifications();
      setUnreadCount(data.length);
    };
    fetchInitialCount();

    // Subscribe to realtime changes
    const setupRealtime = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const channelName = `admin-notifications-bell-${Date.now()}`;
      const channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${session.user.id}`
          },
          (payload: any) => {
            setUnreadCount((prev) => prev + 1);
            
            // Trigger animation
            setIsPulsing(true);
            setTimeout(() => setIsPulsing(false), 3000);
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${session.user.id}`
          },
          (payload: any) => {
            // Re-fetch to get accurate count if items are marked as read
            fetchInitialCount();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    };

    const cleanup = setupRealtime();
    return () => {
      cleanup.then(fn => fn && fn());
    };
  }, [supabase]);

  return (
    <Link 
      href="/admin/notifications" 
      className="relative flex size-10 items-center justify-center rounded-full text-foreground transition-colors hover:bg-lightprimary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      title="Notifications"
      aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
    >
      <div className={`${isPulsing ? 'animate-bounce' : ''}`}>
        <Bell className="size-5" />
      </div>
      
      {unreadCount > 0 && (
        <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white ring-2 ring-white">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </Link>
  );
}
