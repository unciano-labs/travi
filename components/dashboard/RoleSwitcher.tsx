'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getUserRoles, addAccountType, logoutUser } from '@/actions/auth';
import { ChevronDown, Loader2, Compass, Briefcase, Car, Plus, Check, User, LogOut } from 'lucide-react';
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

const ALL_ROLES = [
  { id: 'traveler', label: 'Traveler', icon: Compass, description: 'Explore & book tours' },
  { id: 'organizer', label: 'Organizer', icon: Briefcase, description: 'Manage tour packages' },
  { id: 'transporter', label: 'Transporter', icon: Car, description: 'Manage fleet & vehicles' },
];

// The template's header Profile dropdown, extended with Travi's account switching.
export function RoleSwitcher({ currentRole }: { currentRole: string }) {
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingRole, setAddingRole] = useState<string | null>(null);

  useEffect(() => {
    async function fetchRoles() {
      const userRoles = await getUserRoles();
      setRoles(userRoles);
      setLoading(false);
    }
    fetchRoles();
  }, []);

  const handleAddRole = async (roleId: string) => {
    setAddingRole(roleId);
    await addAccountType(roleId);
    // Note: addAccountType redirects automatically, so we don't clear loading state manually here.
  };

  const ownedRoles = ALL_ROLES.filter((r) => roles.includes(r.id));
  const missingRoles = ALL_ROLES.filter((r) => !roles.includes(r.id));

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-3 rounded-full p-1 pr-3 hover:bg-lightprimary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          aria-label="Open account menu"
        >
          <Avatar>
            <AvatarFallback className="bg-primary text-white">{currentRole[0]}</AvatarFallback>
          </Avatar>
          <span className="hidden text-left sm:block">
            <span className="block text-sm font-semibold capitalize text-foreground">{currentRole}</span>
            <span className="block text-xs text-muted-foreground">Account</span>
          </span>
          <ChevronDown className="size-4 text-muted-foreground" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-72 pb-4 pt-2">
        <DropdownMenuItem asChild className="px-4 py-2">
          <Link href={`/dashboard/${currentRole}/profile`}>
            <User className="text-muted-foreground" /> My Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator className="my-2" />
        <DropdownMenuLabel className="px-4 text-[11px] uppercase tracking-wider text-muted-foreground">Switch Account</DropdownMenuLabel>

        {loading ? (
          <div className="flex justify-center px-4 py-6">
            <Loader2 className="size-5 animate-spin text-muted-foreground" aria-label="Loading accounts" />
          </div>
        ) : (
          <>
            {ownedRoles.map((roleDef) => {
              const isActive = currentRole === roleDef.id;
              const Icon = roleDef.icon;
              return (
                <DropdownMenuItem key={roleDef.id} asChild className={`mx-1 px-3 py-2 ${isActive ? 'bg-lightprimary' : ''}`}>
                  <Link href={`/dashboard/${roleDef.id}`} className="flex items-center justify-between">
                    <span className="flex items-center gap-3">
                      <span className={`rounded-md p-2 ${isActive ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>
                        <Icon />
                      </span>
                      <span>
                        <span className={`block text-sm font-semibold ${isActive ? 'text-primary' : 'text-foreground'}`}>{roleDef.label}</span>
                        <span className="mt-0.5 block text-[11px] leading-none text-muted-foreground">{roleDef.description}</span>
                      </span>
                    </span>
                    {isActive && <Check className="text-primary" />}
                  </Link>
                </DropdownMenuItem>
              );
            })}

            {missingRoles.length > 0 && <DropdownMenuSeparator className="my-2" />}

            {missingRoles.map((roleDef) => {
              const Icon = roleDef.icon;
              return (
                <DropdownMenuItem
                  key={roleDef.id}
                  disabled={addingRole !== null}
                  onSelect={(e) => {
                    e.preventDefault();
                    handleAddRole(roleDef.id);
                  }}
                  className="group mx-1 justify-between px-3 py-2"
                >
                  <span className="flex items-center gap-3">
                    <span className="rounded-md border border-dashed border-border p-2 text-muted-foreground group-focus:border-primary group-focus:text-primary">
                      <Icon />
                    </span>
                    <span className="text-sm font-medium">Add {roleDef.label}</span>
                  </span>
                  {addingRole === roleDef.id ? <Loader2 className="animate-spin text-primary" /> : <Plus className="text-muted-foreground" />}
                </DropdownMenuItem>
              );
            })}
          </>
        )}

        <DropdownMenuSeparator className="my-2" />
        <form action={logoutUser} className="px-4 pt-2">
          <Button type="submit" variant="outline" className="w-full">
            <LogOut /> Sign Out
          </Button>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
