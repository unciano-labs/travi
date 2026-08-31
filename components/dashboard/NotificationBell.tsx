'use client';

import { useState, useEffect, useRef } from 'react';
import { Bell } from 'lucide-react';
import Link from 'next/link';
import { getUnreadNotifications, markNotificationAsRead } from '@/actions/notifications';
import { createClient } from '@/lib/supabase/browser';

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
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-slate-500 hover:text-slate-700 transition-colors focus:outline-none rounded-full hover:bg-slate-100"
      >
        <Bell className="w-6 h-6" />
        {notifications.length > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-sm ring-2 ring-white">
            {notifications.length > 99 ? '99+' : notifications.length}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-slate-200 z-50 max-h-96 overflow-y-auto">
          <div className="p-4 border-b border-slate-100">
            <h3 className="font-bold text-slate-900">Notifications</h3>
          </div>
          
          <div className="divide-y divide-slate-100">
            {notifications.length === 0 ? (
              <div className="p-4 text-center text-sm text-slate-500">
                You have no new notifications.
              </div>
            ) : (
              notifications.map((notification) => (
                <div key={notification.id} className="p-4 hover:bg-slate-50 transition-colors">
                  <Link 
                    href={notification.link || '#'} 
                    onClick={() => handleNotificationClick(notification.id)}
                    className="block"
                  >
                    <p className="text-sm font-bold text-slate-900 mb-1">{notification.title}</p>
                    <p className="text-sm text-slate-600 line-clamp-2">{notification.message}</p>
                    <p className="text-xs text-slate-400 mt-2">
                      {new Date(notification.created_at).toLocaleDateString()}
                    </p>
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
