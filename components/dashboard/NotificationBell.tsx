'use client';

import { useState, useEffect, useRef } from 'react';
import { Bell } from 'lucide-react';
import Link from 'next/link';
import { getUnreadNotifications, markNotificationAsRead } from '@/actions/notifications';
import { createClient } from '@/lib/supabase/browser';
import { formatDateOfInstant } from '@/lib/format';

function playNotificationSound() {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime); 
    osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  } catch (err) {
    // ignore
  }
}

export function NotificationBell() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  async function fetchNotifications() {
    const unread = await getUnreadNotifications();
    setNotifications(unread);
  }

  useEffect(() => {
    Promise.resolve().then(() => fetchNotifications());
    const interval = setInterval(() => fetchNotifications(), 60000); // 1m fallback poll

    
    const supabase = createClient();
    let channel: any;

    async function setupRealtime() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      channel = supabase
        .channel(`user-notifications-${Date.now()}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
          (payload: any) => {
            setNotifications((prev) => {
              // Prevent duplicates if multiple channels or events fire
              if (prev.some((n) => n.id === payload.new.id)) return prev;
              playNotificationSound();
              return [payload.new, ...prev];
            });
          }
        )
        .subscribe();
    }
    setupRealtime();

    return () => {
      clearInterval(interval);
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);


  async function handleNotificationClick(notificationId: string) {
    await markNotificationAsRead(notificationId);
    setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
    setIsOpen(false);
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex size-10 items-center justify-center rounded-full text-foreground transition-colors hover:bg-lightprimary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        aria-label={notifications.length > 0 ? `Notifications, ${notifications.length} unread` : 'Notifications'}
        aria-expanded={isOpen}
      >
        <Bell className="size-5" />
        {notifications.length > 0 && (
          <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white ring-2 ring-white">
            {notifications.length > 99 ? '99+' : notifications.length}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white rounded-md shadow-dashboard border border-border z-50 max-h-96 overflow-y-auto">
          <div className="flex items-center justify-between px-6 py-4">
            <h3 className="text-lg font-semibold text-foreground">Notifications</h3>
            {notifications.length > 0 && (
              <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-medium text-white">{notifications.length} new</span>
            )}
          </div>
          
          <div>
            {notifications.length === 0 ? (
              <div className="px-6 pb-6 text-center text-sm text-muted-foreground">
                You have no new notifications.
              </div>
            ) : (
              notifications.map((notification) => (
                <div key={notification.id} className="px-6 py-3 hover:bg-lightprimary transition-colors">
                  <Link 
                    href={notification.link || '#'} 
                    onClick={() => handleNotificationClick(notification.id)}
                    className="flex items-start gap-3"
                  >
                    <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-lightprimary text-primary">
                      <Bell className="size-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-foreground mb-0.5">{notification.title}</span>
                      <span className="block text-sm text-muted-foreground line-clamp-2">{notification.message}</span>
                      <span className="block text-xs text-muted-foreground/80 mt-1">
                        {formatDateOfInstant(notification.created_at)}
                      </span>
                    </span>
                  </Link>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
