'use client';

import { useState } from 'react';
import { Search, Loader2, Check, X, Building, User, Phone, MapPin, AlignLeft, Calendar } from 'lucide-react';
import { approveOrganizer, rejectOrganizer } from '@/actions/admin';
import { LazyMobileCard } from '@/components/ui/LazyMobileCard';

interface Organizer {
  id: string;
  display_name: string;
  company_name: string | null;
  organizer_type: 'individual' | 'company';
  status: 'pending' | 'approved' | 'rejected';
  phone: string;
  address: string | null;
  description: string | null;
  created_at: string;
  user_profiles: { email: string } | null;
  revenue?: number;
  activeTours?: number;
}

interface OrganizersClientProps {
  initialOrganizers: Organizer[];
}

const ITEMS_PER_PAGE = 10;

export default function OrganizersClient({ initialOrganizers }: OrganizersClientProps) {
  const [organizers, setOrganizers] = useState<Organizer[]>(initialOrganizers);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedOrg, setSelectedOrg] = useState<Organizer | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  // Filter logic
  const filtered = organizers.filter((org) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const name = (org.company_name || org.display_name).toLowerCase();
    const email = (org.user_profiles?.email || '').toLowerCase();
    const type = org.organizer_type.toLowerCase();
    const status = org.status.toLowerCase();
    return name.includes(q) || email.includes(q) || type.includes(q) || status.includes(q);
  });

  // Pagination logic
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const handleApprove = async (id: string) => {
    setActionLoading(`${id}-approve`);
    const res = await approveOrganizer(id);
    setActionLoading(null);
    if (res.success) {
      setOrganizers(prev => prev.map(o => o.id === id ? { ...o, status: 'approved' } : o));
      if (selectedOrg?.id === id) setSelectedOrg(prev => prev ? { ...prev, status: 'approved' } : null);
    } else {
      alert(res.error || 'Failed to approve');
    }
  };

  const handleReject = async (id: string) => {
    const reason = window.prompt("Reason for rejection (optional):");
    if (reason === null) return; // User cancelled prompt

    setActionLoading(`${id}-reject`);
    const res = await rejectOrganizer(id, reason);
    setActionLoading(null);
    if (res.success) {
      setOrganizers(prev => prev.map(o => o.id === id ? { ...o, status: 'rejected' } : o));
      if (selectedOrg?.id === id) setSelectedOrg(prev => prev ? { ...prev, status: 'rejected' } : null);
    } else {
      alert(res.error || 'Failed to reject');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-900">Manage Organizers</h1>
        
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text"
            placeholder="Search organizers..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full sm:w-72 pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition-all shadow-sm"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-500 font-medium">
            No organizers found matching your search.
          </div>
        ) : (
          <>
            {/* Mobile View */}
            <div className="block md:hidden p-4 space-y-4">
              {paginated.map((org) => (
                <LazyMobileCard
                  key={org.id}
                  onClick={() => setSelectedOrg(org)}
                  headerTitle={org.organizer_type === 'company' ? org.company_name : org.display_name}
                  headerSubtitle={org.user_profiles?.email || 'No email'}
                  headerBadge={
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold capitalize ${
                      org.status === 'approved' ? 'bg-emerald-100 text-emerald-800' : 
                      org.status === 'rejected' ? 'bg-red-100 text-red-800' :
                      'bg-amber-100 text-amber-800'
                    }`}>
                      {org.status}
                    </span>
                  }
                  rows={[
                    {
                      label: 'Type',
                      value: <div className="flex items-center gap-1.5 capitalize"><User className="w-3.5 h-3.5"/>{org.organizer_type}</div>
                    },
                    {
                      label: 'Active Tours',
                      value: org.activeTours || 0
                    },
                    {
                      label: 'Revenue',
                      value: <span className="text-emerald-600 font-bold">₱{(org.revenue || 0).toLocaleString()}</span>
                    }
                  ]}
                  actions={
                    <button 
                      onClick={(e) => { e.stopPropagation(); setSelectedOrg(org); }}
                      className="text-xs font-bold text-brand hover:text-brand-dark hover:underline"
                    >
                      View Details
                    </button>
                  }
                />
              ))}
            </div>

            {/* Desktop View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium">
                <tr>
                  <th className="px-6 py-4">Name / Company</th>
                  <th className="px-6 py-4">Type</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-center">Active Tours</th>
                  <th className="px-6 py-4 text-right">Revenue</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginated.map((org) => (
                  <tr key={org.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900">{org.organizer_type === 'company' ? org.company_name : org.display_name}</div>
                      <div className="text-slate-500 text-xs mt-0.5">{org.user_profiles?.email || 'No email'}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-slate-600">
                        {org.organizer_type === 'company' ? <Building className="w-4 h-4" /> : <User className="w-4 h-4" />}
                        <span className="capitalize font-medium">{org.organizer_type}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold capitalize ${
                        org.status === 'approved' ? 'bg-emerald-100 text-emerald-800' : 
                        org.status === 'rejected' ? 'bg-red-100 text-red-800' :
                        'bg-amber-100 text-amber-800'
                      }`}>
                        {org.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center justify-center min-w-[1.5rem] px-1.5 py-0.5 rounded-md bg-slate-100 text-xs font-bold text-slate-700">
                        {org.activeTours || 0}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-emerald-600 font-bold">
                      ₱{(org.revenue || 0).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => setSelectedOrg(org)}
                        className="text-xs font-bold text-brand hover:text-brand-dark hover:underline"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </>
        )}
        
        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between text-sm">
            <span className="text-slate-500 font-medium">
              Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)} of {filtered.length}
            </span>
            <div className="flex gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => p - 1)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 font-medium hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
                Previous
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => p + 1)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 font-medium hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Details Modal */}
      {selectedOrg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h2 className="text-lg font-bold text-slate-900">Organizer Details</h2>
              <button onClick={() => setSelectedOrg(null)} className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Header Info */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-lg font-bold text-slate-900">{selectedOrg.organizer_type === 'company' ? selectedOrg.company_name : selectedOrg.display_name}</p>
                  <p className="text-sm font-medium text-slate-500 mt-1">{selectedOrg.user_profiles?.email}</p>
                </div>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold capitalize ${
                  selectedOrg.status === 'approved' ? 'bg-emerald-100 text-emerald-800' : 
                  selectedOrg.status === 'rejected' ? 'bg-red-100 text-red-800' :
                  'bg-amber-100 text-amber-800'
                }`}>
                  {selectedOrg.status}
                </span>
              </div>

              {/* Grid Details */}
              <div className="bg-slate-50 rounded-xl p-4 grid grid-cols-2 gap-4 border border-slate-100">
                <div className="col-span-2 sm:col-span-1">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-1">
                    <User className="w-3.5 h-3.5" /> Type
                  </span>
                  <div className="font-medium text-slate-900 text-sm capitalize">{selectedOrg.organizer_type}</div>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-1">
                    <Calendar className="w-3.5 h-3.5" /> Applied On
                  </span>
                  <div className="font-medium text-slate-900 text-sm">{new Date(selectedOrg.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</div>
                </div>
                <div className="col-span-2">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-1">
                    Revenue Generated
                  </span>
                  <div className="font-bold text-emerald-600 text-sm">₱{(selectedOrg.revenue || 0).toLocaleString()}</div>
                </div>
                <div className="col-span-2">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-1">
                    Active Tours
                  </span>
                  <div className="font-bold text-slate-900 text-sm">{selectedOrg.activeTours || 0}</div>
                </div>
                <div className="col-span-2">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-1">
                    <Phone className="w-3.5 h-3.5" /> Phone
                  </span>
                  <div className="font-medium text-slate-900 text-sm">{selectedOrg.phone || 'N/A'}</div>
                </div>
                <div className="col-span-2">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-1">
                    <MapPin className="w-3.5 h-3.5" /> Address
                  </span>
                  <div className="font-medium text-slate-900 text-sm">{selectedOrg.address || 'N/A'}</div>
                </div>
                <div className="col-span-2">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-1">
                    <AlignLeft className="w-3.5 h-3.5" /> Description
                  </span>
                  <div className="font-medium text-slate-900 text-sm">{selectedOrg.description || 'N/A'}</div>
                </div>
              </div>

              {/* Actions */}
              <div className="pt-2 flex items-center justify-end gap-3">
                {selectedOrg.status === 'pending' && (
                  <>
                    <button 
                      onClick={() => handleReject(selectedOrg.id)}
                      disabled={!!actionLoading}
                      className="px-4 py-2.5 rounded-xl border border-red-200 text-red-600 font-bold text-sm hover:bg-red-50 transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                      {actionLoading === `${selectedOrg.id}-reject` ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                      Reject
                    </button>
                    <button 
                      onClick={() => handleApprove(selectedOrg.id)}
                      disabled={!!actionLoading}
                      className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 shadow-md shadow-emerald-600/20 transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                      {actionLoading === `${selectedOrg.id}-approve` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      Approve
                    </button>
                  </>
                )}
                
                {selectedOrg.status === 'approved' && (
                  <button 
                    onClick={() => handleReject(selectedOrg.id)}
                    disabled={!!actionLoading}
                    className="px-4 py-2.5 rounded-xl border border-red-200 text-red-600 font-bold text-sm hover:bg-red-50 transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    {actionLoading === `${selectedOrg.id}-reject` ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                    Deactivate
                  </button>
                )}
                
                {selectedOrg.status === 'rejected' && (
                  <button 
                    onClick={() => handleApprove(selectedOrg.id)}
                    disabled={!!actionLoading}
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 shadow-md shadow-emerald-600/20 transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    {actionLoading === `${selectedOrg.id}-approve` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    Activate
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
