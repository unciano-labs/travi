'use client';

import { useState } from 'react';
import type React from 'react';
import { Search, Building, User, Users, Phone, MapPin, AlignLeft, Calendar } from 'lucide-react';
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
  legal_name: string | null;
  tin: string | null;
  business_registration_no: string | null;
  accreditation_no: string | null;
  review_note: string | null;
  info_requested_at: string | null;
  documents: AdminPartnerDocument[];
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

  const applyUpdate = (id: string, patch: Partial<ReviewablePartner>) => {
    setOrganizers(prev => prev.map(p => p.id === id ? { ...p, ...patch } : p));
    setSelectedOrg(prev => prev && prev.id === id ? { ...prev, ...patch } : prev);
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
        title="Manage Organizers"
        breadcrumbs={[{ title: 'Admin', href: '/admin' }, { title: 'Organizers' }]}
      />

      <CardBox className="gap-0 overflow-hidden p-0">
        <div className="flex flex-col gap-4 border-b border-border px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h5 className="card-title">Organizers</h5>
            <p className="text-sm text-muted-foreground">{filtered.length} of {organizers.length} organizers</p>
          </div>
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              type="text"
              aria-label="Search organizers"
              placeholder="Search organizers..."
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
          <EmptyState icon={Users} title="No organizers found matching your search." />
        ) : (
          <>
            {/* Mobile View */}
            <div className="block space-y-4 p-4 md:hidden">
              {paginated.map((org) => (
                <LazyMobileCard
                  key={org.id}
                  onClick={() => setSelectedOrg(org)}
                  headerTitle={org.organizer_type === 'company' ? org.company_name : org.display_name}
                  headerSubtitle={org.user_profiles?.email || 'No email'}
                  headerBadge={<StatusBadge status={org.status} />}
                  rows={[
                    {
                      label: 'Type',
                      value: <div className="flex items-center gap-1.5 capitalize"><User className="size-3.5" />{org.organizer_type}</div>
                    },
                    {
                      label: 'Active Tours',
                      value: org.activeTours || 0
                    },
                    {
                      label: 'Revenue',
                      value: <span className="font-semibold text-successemphasis">₱{(org.revenue || 0).toLocaleString()}</span>
                    }
                  ]}
                  actions={
                    <Button
                      type="button"
                      variant="link"
                      size="xs"
                      className="h-auto px-0"
                      onClick={(e) => { e.stopPropagation(); setSelectedOrg(org); }}
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
                    <TableHead className="px-6">Status</TableHead>
                    <TableHead className="px-6 text-center">Active Tours</TableHead>
                    <TableHead className="px-6 text-right">Revenue</TableHead>
                    <TableHead className="px-6 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map((org) => (
                    <TableRow key={org.id}>
                      <TableCell className="px-6">
                        <div className="font-semibold text-foreground">{org.organizer_type === 'company' ? org.company_name : org.display_name}</div>
                        <div className="mt-0.5 text-xs text-muted-foreground">{org.user_profiles?.email || 'No email'}</div>
                      </TableCell>
                      <TableCell className="px-6">
                        <div className="flex items-center gap-2">
                          {org.organizer_type === 'company' ? <Building className="size-4" /> : <User className="size-4" />}
                          <span className="font-medium capitalize">{org.organizer_type}</span>
                        </div>
                      </TableCell>
                      <TableCell className="px-6">
                        <StatusBadge status={org.status} />
                      </TableCell>
                      <TableCell className="px-6 text-center">
                        <Badge variant="gray">{org.activeTours || 0}</Badge>
                      </TableCell>
                      <TableCell className="px-6 text-right font-semibold text-successemphasis">
                        ₱{(org.revenue || 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="px-6 text-right">
                        <Button type="button" variant="lightprimary" size="xs" onClick={() => setSelectedOrg(org)}>
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
      <Dialog open={!!selectedOrg} onOpenChange={(open) => { if (!open) setSelectedOrg(null); }}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          {selectedOrg && (
            <>
              <DialogHeader>
                <DialogTitle>Organizer Details</DialogTitle>
                <DialogDescription className="sr-only">Profile, revenue and approval status for this organizer.</DialogDescription>
              </DialogHeader>

              <div className="space-y-6">
                {/* Header Info */}
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-lg font-semibold text-foreground">{selectedOrg.organizer_type === 'company' ? selectedOrg.company_name : selectedOrg.display_name}</p>
                    <p className="mt-1 text-sm font-medium text-muted-foreground">{selectedOrg.user_profiles?.email}</p>
                  </div>
                  <StatusBadge status={selectedOrg.status} label={selectedOrg.status === 'pending' && selectedOrg.info_requested_at ? 'Info requested' : undefined} />
                </div>

                {/* Grid Details */}
                <div className="grid grid-cols-2 gap-4 rounded-lg border border-border bg-muted/50 p-4">
                  {detailItem(<User className="size-3.5" />, 'Type', <span className="capitalize">{selectedOrg.organizer_type}</span>, 'sm:col-span-1')}
                  {detailItem(<Calendar className="size-3.5" />, 'Applied On', new Date(selectedOrg.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }), 'sm:col-span-1')}
                  {detailItem(null, 'Revenue Generated', <span className="font-semibold text-successemphasis">₱{(selectedOrg.revenue || 0).toLocaleString()}</span>)}
                  {detailItem(null, 'Active Tours', <span className="font-semibold">{selectedOrg.activeTours || 0}</span>)}
                  {detailItem(<Phone className="size-3.5" />, 'Phone', selectedOrg.phone || 'N/A')}
                  {detailItem(<MapPin className="size-3.5" />, 'Address', selectedOrg.address || 'N/A')}
                  {detailItem(<AlignLeft className="size-3.5" />, 'Description', selectedOrg.description || 'N/A')}
                </div>
              </div>

              {/* KYC review (BIZ-07) */}
              <PartnerReviewPanel
                partnerType="organizer"
                partner={selectedOrg}
                onUpdated={(patch) => applyUpdate(selectedOrg.id, patch)}
              />
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
