'use client';

import { useState } from 'react';
import { Search, Loader2, Check, X, Building, User, Phone, MapPin, AlignLeft, Calendar, Star, Bus } from 'lucide-react';
import { approveTransporter, rejectTransporter } from '@/actions/admin';
import { LazyMobileCard } from '@/components/ui/LazyMobileCard';

interface Transporter {
  id: string;
  display_name: string;
  company_name: string | null;
  transporter_type: 'individual' | 'company';
  status: 'pending' | 'approved' | 'rejected';
  phone: string;
  service_areas: string[];
  description: string | null;
  average_rating: number;
  review_count: number;
  created_at: string;
  user_profiles: { email: string } | null;
  activeVehicles?: number;
}

interface TransportersClientProps {
  initialTransporters: Transporter[];
}

const ITEMS_PER_PAGE = 10;

export default function TransportersClient({ initialTransporters }: TransportersClientProps) {
  const [transporters, setTransporters] = useState<Transporter[]>(initialTransporters);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedTrp, setSelectedTrp] = useState<Transporter | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  // Filter logic
  const filtered = transporters.filter((trp) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const name = (trp.company_name || trp.display_name).toLowerCase();
    const email = (trp.user_profiles?.email || '').toLowerCase();
    const type = trp.transporter_type.toLowerCase();
    const status = trp.status.toLowerCase();
    const areas = trp.service_areas?.join(', ').toLowerCase() || '';
    return name.includes(q) || email.includes(q) || type.includes(q) || status.includes(q) || areas.includes(q);
  });

  // Pagination logic
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE) || 1;
  const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const handleApprove = async (id: string) => {
    setActionLoading(`${id}-approve`);
    const res = await approveTransporter(id);
    setActionLoading(null);
    if (res.success) {
      setTransporters(prev => prev.map(t => t.id === id ? { ...t, status: 'approved' } : t));
      if (selectedTrp?.id === id) setSelectedTrp(prev => prev ? { ...prev, status: 'approved' } : null);
    } else {
      alert(res.error || 'Failed to approve');
    }
  };

  const handleReject = async (id: string) => {
    const reason = window.prompt("Reason for rejection/deactivation (optional):");
    if (reason === null) return; // User cancelled prompt

    setActionLoading(`${id}-reject`);
    const res = await rejectTransporter(id, reason);
    setActionLoading(null);
    if (res.success) {
      setTransporters(prev => prev.map(t => t.id === id ? { ...t, status: 'rejected' } : t));
      if (selectedTrp?.id === id) setSelectedTrp(prev => prev ? { ...prev, status: 'rejected' } : null);
    } else {
      alert(res.error || 'Failed to reject');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-900">Manage Transporters</h1>
        
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text"
            placeholder="Search transporters..."
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
            No transporters found matching your search.
          </div>
        ) : (
          <>
            {/* Mobile View */}
            <div className="block md:hidden p-4 space-y-4">
              {paginated.map((trp) => (
                <LazyMobileCard
                  key={trp.id}
                  onClick={() => setSelectedTrp(trp)}
                  headerTitle={trp.transporter_type === 'company' ? trp.company_name : trp.display_name}
                  headerSubtitle={trp.user_profiles?.email || 'No email'}
                  headerBadge={
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold capitalize ${
                      trp.status === 'approved' ? 'bg-emerald-100 text-emerald-800' : 
                      trp.status === 'rejected' ? 'bg-red-100 text-red-800' :
                      'bg-amber-100 text-amber-800'
                    }`}>
                      {trp.status}
                    </span>
                  }
                  rows={[
                    {
                      label: 'Type',
                      value: <div className="flex items-center gap-1.5 capitalize"><User className="w-3.5 h-3.5"/>{trp.transporter_type}</div>
                    },
                    {
                      label: 'Vehicles',
                      value: trp.activeVehicles || 0
                    },
                    {
                      label: 'Rating',
                      value: <div className="flex items-center gap-1 text-slate-900 font-bold"><Star className="w-3.5 h-3.5 text-amber-400 fill-current" />{trp.average_rating > 0 ? Number(trp.average_rating).toFixed(1) : 'New'}</div>
                    },
                    {
                      label: 'Areas',
                      value: <div className="truncate max-w-[150px]">{trp.service_areas?.join(', ') || 'None'}</div>
                    }
                  ]}
                  actions={
                    <button 
                      onClick={(e) => { e.stopPropagation(); setSelectedTrp(trp); }}
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
                  <th className="px-6 py-4">Service Areas</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-center">Vehicles</th>
                  <th className="px-6 py-4 text-center">Rating</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginated.map((trp) => (
                  <tr key={trp.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900">{trp.transporter_type === 'company' ? trp.company_name : trp.display_name}</div>
                      <div className="text-slate-500 text-xs mt-0.5">{trp.user_profiles?.email || 'No email'}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-slate-600">
                        {trp.transporter_type === 'company' ? <Building className="w-4 h-4" /> : <User className="w-4 h-4" />}
                        <span className="capitalize font-medium">{trp.transporter_type}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-slate-600 max-w-[200px] truncate" title={trp.service_areas?.join(', ')}>
                        {trp.service_areas?.join(', ') || 'None'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold capitalize ${
                        trp.status === 'approved' ? 'bg-emerald-100 text-emerald-800' : 
                        trp.status === 'rejected' ? 'bg-red-100 text-red-800' :
                        'bg-amber-100 text-amber-800'
                      }`}>
                        {trp.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center justify-center min-w-[1.5rem] px-1.5 py-0.5 rounded-md bg-slate-100 text-xs font-bold text-slate-700">
                        {trp.activeVehicles || 0}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-1 text-slate-900 font-bold">
                        <Star className="w-4 h-4 text-amber-400 fill-current" />
                        {trp.average_rating > 0 ? Number(trp.average_rating).toFixed(1) : 'New'}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => setSelectedTrp(trp)}
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
      {selectedTrp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h2 className="text-lg font-bold text-slate-900">Transporter Details</h2>
              <button onClick={() => setSelectedTrp(null)} className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Header Info */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-lg font-bold text-slate-900">{selectedTrp.transporter_type === 'company' ? selectedTrp.company_name : selectedTrp.display_name}</p>
                  <p className="text-sm font-medium text-slate-500 mt-1">{selectedTrp.user_profiles?.email}</p>
                </div>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold capitalize ${
                  selectedTrp.status === 'approved' ? 'bg-emerald-100 text-emerald-800' : 
                  selectedTrp.status === 'rejected' ? 'bg-red-100 text-red-800' :
                  'bg-amber-100 text-amber-800'
                }`}>
                  {selectedTrp.status}
                </span>
              </div>

              {/* Grid Details */}
              <div className="bg-slate-50 rounded-xl p-4 grid grid-cols-2 gap-4 border border-slate-100">
                <div className="col-span-2 sm:col-span-1">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-1">
                    <User className="w-3.5 h-3.5" /> Type
                  </span>
                  <div className="font-medium text-slate-900 text-sm capitalize">{selectedTrp.transporter_type}</div>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-1">
                    <Calendar className="w-3.5 h-3.5" /> Applied On
                  </span>
                  <div className="font-medium text-slate-900 text-sm">{new Date(selectedTrp.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</div>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-1">
                    <Bus className="w-3.5 h-3.5" /> Active Vehicles
                  </span>
                  <div className="font-bold text-slate-900 text-sm">{selectedTrp.activeVehicles || 0}</div>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-1">
                    <Star className="w-3.5 h-3.5" /> Rating
                  </span>
                  <div className="font-bold text-slate-900 text-sm">{selectedTrp.average_rating > 0 ? Number(selectedTrp.average_rating).toFixed(1) : 'No Ratings'} ({selectedTrp.review_count} reviews)</div>
                </div>
                <div className="col-span-2">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-1">
                    <MapPin className="w-3.5 h-3.5" /> Service Areas
                  </span>
                  <div className="font-medium text-slate-900 text-sm">{selectedTrp.service_areas?.join(', ') || 'None'}</div>
                </div>
                <div className="col-span-2">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-1">
                    <Phone className="w-3.5 h-3.5" /> Phone
                  </span>
                  <div className="font-medium text-slate-900 text-sm">{selectedTrp.phone || 'N/A'}</div>
                </div>
                <div className="col-span-2">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-1">
                    <AlignLeft className="w-3.5 h-3.5" /> Description
                  </span>
                  <div className="font-medium text-slate-900 text-sm">{selectedTrp.description || 'N/A'}</div>
                </div>
              </div>

              {/* Actions */}
              <div className="pt-2 flex items-center justify-end gap-3">
                {selectedTrp.status === 'pending' && (
                  <>
                    <button 
                      onClick={() => handleReject(selectedTrp.id)}
                      disabled={!!actionLoading}
                      className="px-4 py-2.5 rounded-xl border border-red-200 text-red-600 font-bold text-sm hover:bg-red-50 transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                      {actionLoading === `${selectedTrp.id}-reject` ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                      Reject
                    </button>
                    <button 
                      onClick={() => handleApprove(selectedTrp.id)}
                      disabled={!!actionLoading}
                      className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 shadow-md shadow-emerald-600/20 transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                      {actionLoading === `${selectedTrp.id}-approve` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      Approve
                    </button>
                  </>
                )}
                
                {selectedTrp.status === 'approved' && (
                  <button 
                    onClick={() => handleReject(selectedTrp.id)}
                    disabled={!!actionLoading}
                    className="px-4 py-2.5 rounded-xl border border-red-200 text-red-600 font-bold text-sm hover:bg-red-50 transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    {actionLoading === `${selectedTrp.id}-reject` ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                    Deactivate
                  </button>
                )}
                
                {selectedTrp.status === 'rejected' && (
                  <button 
                    onClick={() => handleApprove(selectedTrp.id)}
                    disabled={!!actionLoading}
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 shadow-md shadow-emerald-600/20 transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    {actionLoading === `${selectedTrp.id}-approve` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
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
