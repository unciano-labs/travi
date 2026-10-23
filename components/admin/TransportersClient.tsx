'use client';

import { useState } from 'react';
import type React from 'react';
import { Search, Building, User, Phone, MapPin, AlignLeft, Calendar, Star, Bus } from 'lucide-react';
import PartnerReviewPanel, { type ReviewablePartner, type AdminPartnerDocument } from '@/components/admin/PartnerReviewPanel';
import { LazyMobileCard } from '@/components/ui/LazyMobileCard';
import PageHeader from '@/components/ui/PageHeader';
import CardBox from '@/components/ui/CardBox';
import StatusBadge from '@/components/ui/StatusBadge';
import EmptyState from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

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
  legal_name: string | null;
  tin: string | null;
  business_registration_no: string | null;
  accreditation_no: string | null;
  review_note: string | null;
  info_requested_at: string | null;
  documents: AdminPartnerDocument[];
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

  const applyUpdate = (id: string, patch: Partial<ReviewablePartner>) => {
    setTransporters(prev => prev.map(p => p.id === id ? { ...p, ...patch } : p));
    setSelectedTrp(prev => prev && prev.id === id ? { ...prev, ...patch } : prev);
  };

  const detailItem = (icon: React.ReactNode, label: string, value: React.ReactNode, className = '') => (
    <div className={`col-span-2 ${className}`}>
      <span className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {icon} {label}
      </span>
      <div className="text-sm font-medium text-foreground">{value}</div>
    </div>
  );

  return (
    <>
      <PageHeader
        title="Manage Transporters"
        breadcrumbs={[{ title: 'Admin', href: '/admin' }, { title: 'Transporters' }]}
      />

      <CardBox className="gap-0 overflow-hidden p-0">
        <div className="flex flex-col gap-4 border-b border-border px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h5 className="card-title">Transporters</h5>
            <p className="text-sm text-muted-foreground">{filtered.length} of {transporters.length} transporters</p>
          </div>
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              type="text"
              aria-label="Search transporters"
              placeholder="Search transporters..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-10 sm:w-72"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon={Bus} title="No transporters found matching your search." />
        ) : (
          <>
            {/* Mobile View */}
            <div className="block space-y-4 p-4 md:hidden">
              {paginated.map((trp) => (
                <LazyMobileCard
                  key={trp.id}
                  onClick={() => setSelectedTrp(trp)}
                  headerTitle={trp.transporter_type === 'company' ? trp.company_name : trp.display_name}
                  headerSubtitle={trp.user_profiles?.email || 'No email'}
                  headerBadge={<StatusBadge status={trp.status} />}
                  rows={[
                    {
                      label: 'Type',
                      value: <div className="flex items-center gap-1.5 capitalize"><User className="size-3.5" />{trp.transporter_type}</div>
                    },
                    {
                      label: 'Vehicles',
                      value: trp.activeVehicles || 0
                    },
                    {
                      label: 'Rating',
                      value: <div className="flex items-center gap-1 font-semibold text-foreground"><Star className="size-3.5 fill-current text-warning" />{trp.average_rating > 0 ? Number(trp.average_rating).toFixed(1) : 'New'}</div>
                    },
                    {
                      label: 'Areas',
                      value: <div className="max-w-[150px] truncate">{trp.service_areas?.join(', ') || 'None'}</div>
                    }
                  ]}
                  actions={
                    <Button
                      type="button"
                      variant="link"
                      size="xs"
                      className="h-auto px-0"
                      onClick={(e) => { e.stopPropagation(); setSelectedTrp(trp); }}
                    >
                      View Details
                    </Button>
                  }
                />
              ))}
            </div>

            {/* Desktop View */}
            <div className="hidden md:block">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="px-6">Name / Company</TableHead>
                    <TableHead className="px-6">Type</TableHead>
                    <TableHead className="px-6">Service Areas</TableHead>
                    <TableHead className="px-6">Status</TableHead>
                    <TableHead className="px-6 text-center">Vehicles</TableHead>
                    <TableHead className="px-6 text-center">Rating</TableHead>
                    <TableHead className="px-6 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map((trp) => (
                    <TableRow key={trp.id}>
                      <TableCell className="px-6">
                        <div className="font-semibold text-foreground">{trp.transporter_type === 'company' ? trp.company_name : trp.display_name}</div>
                        <div className="mt-0.5 text-xs text-muted-foreground">{trp.user_profiles?.email || 'No email'}</div>
                      </TableCell>
                      <TableCell className="px-6">
                        <div className="flex items-center gap-2">
                          {trp.transporter_type === 'company' ? <Building className="size-4" /> : <User className="size-4" />}
                          <span className="font-medium capitalize">{trp.transporter_type}</span>
                        </div>
                      </TableCell>
                      <TableCell className="px-6">
                        <div className="max-w-[200px] truncate" title={trp.service_areas?.join(', ')}>
                          {trp.service_areas?.join(', ') || 'None'}
                        </div>
                      </TableCell>
                      <TableCell className="px-6">
                        <StatusBadge status={trp.status} />
                      </TableCell>
                      <TableCell className="px-6 text-center">
                        <Badge variant="gray">{trp.activeVehicles || 0}</Badge>
                      </TableCell>
                      <TableCell className="px-6">
                        <div className="flex items-center justify-center gap-1 font-semibold text-foreground">
                          <Star className="size-4 fill-current text-warning" />
                          {trp.average_rating > 0 ? Number(trp.average_rating).toFixed(1) : 'New'}
                        </div>
                      </TableCell>
                      <TableCell className="px-6 text-right">
                        <Button type="button" variant="lightprimary" size="xs" onClick={() => setSelectedTrp(trp)}>
                          View Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border px-6 py-4 text-sm">
            <span className="font-medium text-muted-foreground">
              Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)} of {filtered.length}
            </span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="neutral"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => p - 1)}
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="neutral"
                size="sm"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </CardBox>

      {/* Details Modal */}
      <Dialog open={!!selectedTrp} onOpenChange={(open) => { if (!open) setSelectedTrp(null); }}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          {selectedTrp && (
            <>
              <DialogHeader>
                <DialogTitle>Transporter Details</DialogTitle>
                <DialogDescription className="sr-only">Profile, fleet and approval status for this transporter.</DialogDescription>
              </DialogHeader>

              <div className="space-y-6">
                {/* Header Info */}
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-lg font-semibold text-foreground">{selectedTrp.transporter_type === 'company' ? selectedTrp.company_name : selectedTrp.display_name}</p>
                    <p className="mt-1 text-sm font-medium text-muted-foreground">{selectedTrp.user_profiles?.email}</p>
                  </div>
                  <StatusBadge status={selectedTrp.status} label={selectedTrp.status === 'pending' && selectedTrp.info_requested_at ? 'Info requested' : undefined} />
                </div>

                {/* Grid Details */}
                <div className="grid grid-cols-2 gap-4 rounded-lg border border-border bg-muted/50 p-4">
                  {detailItem(<User className="size-3.5" />, 'Type', <span className="capitalize">{selectedTrp.transporter_type}</span>, 'sm:col-span-1')}
                  {detailItem(<Calendar className="size-3.5" />, 'Applied On', new Date(selectedTrp.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }), 'sm:col-span-1')}
                  {detailItem(<Bus className="size-3.5" />, 'Active Vehicles', <span className="font-semibold">{selectedTrp.activeVehicles || 0}</span>, 'sm:col-span-1')}
                  {detailItem(<Star className="size-3.5" />, 'Rating', <span className="font-semibold">{selectedTrp.average_rating > 0 ? Number(selectedTrp.average_rating).toFixed(1) : 'No Ratings'} ({selectedTrp.review_count} reviews)</span>, 'sm:col-span-1')}
                  {detailItem(<MapPin className="size-3.5" />, 'Service Areas', selectedTrp.service_areas?.join(', ') || 'None')}
                  {detailItem(<Phone className="size-3.5" />, 'Phone', selectedTrp.phone || 'N/A')}
                  {detailItem(<AlignLeft className="size-3.5" />, 'Description', selectedTrp.description || 'N/A')}
                </div>
              </div>

              {/* KYC review (BIZ-07) */}
              <PartnerReviewPanel
                partnerType="transporter"
                partner={selectedTrp}
                onUpdated={(patch) => applyUpdate(selectedTrp.id, patch)}
              />
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
