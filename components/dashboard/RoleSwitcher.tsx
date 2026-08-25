'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { getUserRoles, addAccountType } from '@/actions/auth';
import { ChevronDown, Loader2 } from 'lucide-react';
import Link from 'next/link';

const ALL_ROLES = [
  { id: 'traveler', label: 'Traveler' },
  { id: 'organizer', label: 'Organizer' },
  { id: 'transporter', label: 'Transporter' },
];

export function RoleSwitcher({ currentRole }: { currentRole: string }) {
  const [isOpen, setIsOpen] = useState(false);
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

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 p-1 pr-3 rounded-full hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-200"
      >
        <div className="w-8 h-8 rounded-full bg-coral text-white flex items-center justify-center font-bold text-sm uppercase">
          {currentRole[0]}
        </div>
        <div className="hidden sm:block text-left">
          <p className="text-sm font-medium text-slate-700 capitalize">{currentRole} Account</p>
        </div>
        <ChevronDown className="w-4 h-4 text-slate-400" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-100 py-2 z-50">
          <div className="px-4 py-2 border-b border-slate-100 mb-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Switch Account</p>
          </div>
          
          {loading ? (
            <div className="px-4 py-4 flex justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          ) : (
            ALL_ROLES.map((roleDef) => {
              const hasRole = roles.includes(roleDef.id);
              const isActive = currentRole === roleDef.id;

              if (hasRole) {
                return (
                  <Link
                    key={roleDef.id}
                    href={`/dashboard/${roleDef.id}`}
                    onClick={() => setIsOpen(false)}
                    className={`block px-4 py-2 text-sm ${isActive ? 'bg-coral/10 text-coral font-medium' : 'text-slate-700 hover:bg-slate-50'}`}
                  >
                    {roleDef.label} Account {isActive && '(Active)'}
                  </Link>
                );
              } else {
                return (
                  <button
                    key={roleDef.id}
                    onClick={() => handleAddRole(roleDef.id)}
                    disabled={addingRole !== null}
                    className="w-full text-left px-4 py-2 text-sm text-coral hover:bg-slate-50 flex items-center justify-between"
                  >
                    <span>Add {roleDef.label} Account</span>
                    {addingRole === roleDef.id && <Loader2 className="w-3 h-3 animate-spin" />}
                  </button>
                );
              }
            })
          )}
        </div>
      )}
      
      {/* Backdrop for closing when clicking outside */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}
