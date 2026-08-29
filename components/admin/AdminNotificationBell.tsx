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
      className="relative p-2 text-slate-400 hover:text-slate-600 transition-colors"
      title="Notifications"
    >
      <div className={`${isPulsing ? 'animate-bounce' : ''}`}>
        <Bell className="w-6 h-6" />
      </div>
      
      {unreadCount > 0 && (
        <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </Link>
  );
}
