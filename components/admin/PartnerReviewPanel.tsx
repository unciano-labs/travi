'use client';

import { useState } from 'react';
import { Check, ExternalLink, FileText, Loader2, MessageSquareWarning, X } from 'lucide-react';
import { approvePartner, getPartnerDocumentUrl, rejectPartner, requestMoreInfo } from '@/actions/partner-review';
import StatusBadge from '@/components/ui/StatusBadge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PARTNER_DOC_LABELS, type PartnerDocType, type PartnerType } from '@/lib/schemas/partner';

export interface AdminPartnerDocument {
  id: string;
  doc_type: string;
  vehicle_id: string | null;
  vehicle_name?: string | null;
  file_name: string | null;
  status: string;
  created_at: string;
}

export interface ReviewablePartner {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  legal_name: string | null;
  tin: string | null;
  business_registration_no: string | null;
  accreditation_no: string | null;
  review_note: string | null;
  info_requested_at: string | null;
  documents: AdminPartnerDocument[];
}

interface Props {
  partnerType: PartnerType;
  partner: ReviewablePartner;
  onUpdated: (patch: Partial<ReviewablePartner>) => void;
}

const DOC_STATUS: Record<string, string> = { submitted: 'pending', verified: 'approved', rejected: 'rejected' };

/** KYC details, documents (signed links) and approve / reject / request-info actions (BIZ-07). */
export default function PartnerReviewPanel({ partnerType, partner, onUpdated }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<'reject' | 'info' | null>(null);
  const [text, setText] = useState('');
  const [docLinks, setDocLinks] = useState<Record<string, string>>({});

  const ref = { partnerType, partnerId: partner.id };
  const accreditationLabel = partnerType === 'organizer' ? 'DOT accreditation' : 'LTFRB franchise / DOT';

  async function approve() {
    setBusy('approve');
    setError(null);
    const res = await approvePartner(ref);
    setBusy(null);
    if (!res.success) return setError(res.error);
    onUpdated({
      status: 'approved',
      review_note: null,
      info_requested_at: null,
      documents: partner.documents.map((d) => (d.status === 'submitted' ? { ...d, status: 'verified' } : d)),
    });
  }

  async function submitDialog() {
    if (!dialog) return;
    setBusy(dialog);
    setError(null);
    const res = dialog === 'reject' ? await rejectPartner({ ...ref, reason: text }) : await requestMoreInfo({ ...ref, note: text });
    setBusy(null);
    if (!res.success) return setError(res.error);
    onUpdated(
      dialog === 'reject'
        ? { status: 'rejected', review_note: text.trim(), info_requested_at: null }
        : { review_note: text.trim(), info_requested_at: new Date().toISOString() }
    );
    setDialog(null);
    setText('');
  }

  async function openDocument(id: string) {
    setBusy(`doc-${id}`);
    setError(null);
    const res = await getPartnerDocumentUrl(id);
    setBusy(null);
    if (!res.success) return setError(res.error);
    setDocLinks((prev) => ({ ...prev, [id]: res.url }));
    window.open(res.url, '_blank', 'noopener,noreferrer');
  }

  const item = (label: string, value: React.ReactNode) => (
    <div>
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="break-words text-sm font-medium text-foreground">{value || <span className="text-muted-foreground">Not provided</span>}</div>
    </div>
  );

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="lighterror">
          <X />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {partner.review_note && partner.status !== 'approved' && (
        <Alert variant={partner.status === 'rejected' ? 'lighterror' : 'lightwarning'}>
          <MessageSquareWarning />
          <AlertDescription>
            {partner.status === 'rejected' ? 'Rejection reason: ' : 'Information requested: '}
            {partner.review_note}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-4 rounded-lg border border-border p-4 sm:grid-cols-2">
        {item('Legal name', partner.legal_name)}
        {item('BIR TIN', partner.tin)}
        {item('DTI / SEC registration', partner.business_registration_no)}
        {item(accreditationLabel, partner.accreditation_no)}
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Documents</p>
        {partner.documents.length === 0 ? (
          <p className="text-sm text-muted-foreground">No documents uploaded.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {partner.documents.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="font-medium text-foreground">
                    {PARTNER_DOC_LABELS[d.doc_type as PartnerDocType] ?? d.doc_type}
                    {d.vehicle_name ? ` · ${d.vehicle_name}` : ''}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{d.file_name || 'Document'}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <StatusBadge status={DOC_STATUS[d.status] ?? d.status} label={d.status} />
                  <Button
                    type="button"
                    variant="lightprimary"
                    size="xs"
                    onClick={() => openDocument(d.id)}
                    disabled={busy === `doc-${d.id}`}
                    aria-label={`Open ${PARTNER_DOC_LABELS[d.doc_type as PartnerDocType] ?? 'document'}`}
                  >
                    {busy === `doc-${d.id}` ? <Loader2 className="animate-spin" /> : <FileText />}
                    Open
                  </Button>
                  {docLinks[d.id] && (
                    <a href={docLinks[d.id]} target="_blank" rel="noopener noreferrer" className="text-primary" aria-label="Open link (expires in 5 minutes)">
                      <ExternalLink className="size-4" />
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-1 text-xs text-muted-foreground">Links are private and expire after 5 minutes.</p>
      </div>

      <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
        {partner.status === 'pending' && (
          <Button type="button" variant="outline" onClick={() => { setText(''); setDialog('info'); }} disabled={!!busy}>
            <MessageSquareWarning /> Request info
          </Button>
        )}
        {partner.status !== 'rejected' && (
          <Button type="button" variant="outlineerror" onClick={() => { setText(''); setDialog('reject'); }} disabled={!!busy}>
            <X /> {partner.status === 'approved' ? 'Deactivate' : 'Reject'}
          </Button>
        )}
        {partner.status !== 'approved' && (
          <Button type="button" variant="success" onClick={approve} disabled={!!busy}>
            {busy === 'approve' ? <Loader2 className="animate-spin" /> : <Check />}
            {partner.status === 'rejected' ? 'Approve / reactivate' : 'Approve'}
          </Button>
        )}
      </div>

      <Dialog open={dialog !== null} onOpenChange={(open) => { if (!open) setDialog(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{dialog === 'reject' ? (partner.status === 'approved' ? 'Deactivate partner' : 'Reject application') : 'Request more information'}</DialogTitle>
            <DialogDescription>
              {dialog === 'reject'
                ? 'The partner sees this reason and can update their details to apply again.'
                : 'The partner is notified by email and in-app. Their application stays pending.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="partner-review-text">{dialog === 'reject' ? 'Reason' : 'What is missing?'}</Label>
            <Textarea id="partner-review-text" rows={4} value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} />
          </div>
          <DialogFooter>
            <Button type="button" variant="neutral" onClick={() => setDialog(null)}>Cancel</Button>
            <Button
              type="button"
              variant={dialog === 'reject' ? 'error' : 'default'}
              onClick={submitDialog}
              disabled={text.trim().length < 3 || !!busy}
            >
              {busy === dialog && <Loader2 className="animate-spin" />}
              {dialog === 'reject' ? 'Confirm' : 'Send request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
