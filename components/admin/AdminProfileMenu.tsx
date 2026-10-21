'use client';

import Link from 'next/link';
import { Bell, LogOut, Settings } from 'lucide-react';
import { logoutAdmin } from '@/actions/auth';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// The template's header Profile dropdown, for the admin console.
export default function AdminProfileMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-3 rounded-full p-1 pr-3 hover:bg-lightprimary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          aria-label="Open account menu"
        >
          <Avatar>
            <AvatarFallback className="bg-primary text-white">A</AvatarFallback>
          </Avatar>
          <span className="hidden text-left sm:block">
            <span className="block text-sm font-semibold text-foreground">Admin User</span>
            <span className="block text-xs text-muted-foreground">Superadmin</span>
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[220px] pb-4 pt-2">
        <DropdownMenuLabel className="px-4 text-xs uppercase tracking-wider text-muted-foreground">Admin Console</DropdownMenuLabel>
        <DropdownMenuItem asChild className="px-4 py-2">
          <Link href="/admin/notifications">
            <Bell className="text-muted-foreground" /> Notifications
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="px-4 py-2">
          <Link href="/admin/settings">
            <Settings className="text-muted-foreground" /> Platform Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator className="my-2" />
        <form action={logoutAdmin} className="px-4 pt-2">
          <Button type="submit" variant="outline" className="w-full">
            <LogOut /> Sign Out
          </Button>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
