'use client';

import { useState, useEffect } from 'react';
import { getUserRoles, addAccountType } from '@/actions/auth';
import { ChevronDown, Loader2, Compass, Briefcase, Car, Plus, Check } from 'lucide-react';
import Link from 'next/link';

const ALL_ROLES = [
  { id: 'traveler', label: 'Traveler', icon: Compass, description: 'Explore & book tours' },
  { id: 'organizer', label: 'Organizer', icon: Briefcase, description: 'Manage tour packages' },
  { id: 'transporter', label: 'Transporter', icon: Car, description: 'Manage fleet & vehicles' },
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
        <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] border border-slate-100 py-3 z-50 origin-top-right transition-all">
          <div className="px-4 pb-3 border-b border-slate-100 mb-2">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Switch Account</p>
          </div>
          
          {loading ? (
            <div className="px-4 py-8 flex justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          ) : (
            <div className="space-y-1 px-2">
              {ALL_ROLES.map((roleDef) => {
                const hasRole = roles.includes(roleDef.id);
                const isActive = currentRole === roleDef.id;
                const Icon = roleDef.icon;

                if (hasRole) {
                  return (
                    <Link
                      key={roleDef.id}
                      href={`/dashboard/${roleDef.id}`}
                      onClick={() => setIsOpen(false)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors group ${
                        isActive 
                          ? 'bg-coral-50/50' 
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-md ${isActive ? 'bg-coral-100 text-coral-600' : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="text-left">
                          <p className={`text-sm font-semibold ${isActive ? 'text-coral-700' : 'text-slate-700'}`}>
                            {roleDef.label}
                          </p>
                          <p className="text-[11px] text-slate-500 leading-none mt-0.5">{roleDef.description}</p>
                        </div>
                      </div>
                      {isActive && <Check className="w-4 h-4 text-coral-600" />}
                    </Link>
                  );
                }
                return null;
              })}

              {roles.length > 0 && roles.length < 3 && (
                <div className="my-2 border-t border-slate-100"></div>
              )}

              {ALL_ROLES.map((roleDef) => {
                const hasRole = roles.includes(roleDef.id);
                const Icon = roleDef.icon;

                if (!hasRole) {
                  return (
                    <button
                      key={roleDef.id}
                      onClick={() => handleAddRole(roleDef.id)}
                      disabled={addingRole !== null}
                      className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors hover:bg-slate-50 group text-left disabled:opacity-50"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-md bg-slate-50 border border-dashed border-slate-300 text-slate-400 group-hover:border-coral group-hover:text-coral transition-colors">
                          <Icon className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-600 group-hover:text-coral transition-colors">
                            Add {roleDef.label}
                          </p>
                        </div>
                      </div>
                      {addingRole === roleDef.id ? (
                        <Loader2 className="w-4 h-4 animate-spin text-coral" />
                      ) : (
                        <Plus className="w-4 h-4 text-slate-300 group-hover:text-coral transition-colors" />
                      )}
                    </button>
                  );
                }
                return null;
              })}
            </div>
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
