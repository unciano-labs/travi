'use client';

import { useId, useState } from 'react';
import { AlertCircle, CheckCircle2, FileText, Loader2, X } from 'lucide-react';
import { uploadPartnerDocument } from '@/actions/partner-documents';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  PARTNER_DOCUMENT_MAX_BYTES,
  PARTNER_DOCUMENT_MIME_TYPES,
  type PartnerDocType,
  type PartnerDocumentInput,
} from '@/lib/schemas/partner';

interface Props {
  docType: PartnerDocType;
  label: string;
  hint?: string;
  required?: boolean;
  value: PartnerDocumentInput | null;
  onChange: (doc: PartnerDocumentInput | null) => void;
  onError?: (message: string) => void;
}

/**
 * Uploads one KYC document to the PRIVATE `partner-documents` bucket via server action,
 * inside the user's own folder, and hands the metadata to the parent form. Files are
 * never publicly readable; admins open them with signed URLs.
 */
export default function PartnerDocumentUpload({ docType, label, hint, required, value, onChange, onError }: Props) {
  const inputId = useId();
  const [uploading, setUploading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setLocalError(null);

    if (!(PARTNER_DOCUMENT_MIME_TYPES as readonly string[]).includes(file.type)) {
      const msg = 'Upload a PDF, JPG, PNG or WebP file.';
      setLocalError(msg);
      onError?.(msg);
      return;
    }
    if (file.size > PARTNER_DOCUMENT_MAX_BYTES) {
      const msg = 'Documents must be 10 MB or smaller.';
      setLocalError(msg);
      onError?.(msg);
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.set('file', file);
      formData.set('docType', docType);

      const res = await uploadPartnerDocument(formData);
      if (!res.success) {
        setLocalError(res.error);
        onError?.(res.error);
        return;
      }

      setLocalError(null);
      onChange(res.doc);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed. Please try again.';
      setLocalError(msg);
      onError?.(msg);
    } finally {
      setUploading(false);
    }
  }

  const handleRemove = () => {
    onChange(null);
    setLocalError(null);
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={inputId}>
        {label}
        {required ? ' *' : ' (optional)'}
      </Label>
      {value ? (
        <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-lightsuccess/40 px-3 py-2 text-sm">
          <span className="flex min-w-0 items-center gap-2 text-successemphasis">
            <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
            <span className="truncate">{value.fileName || 'Document uploaded'}</span>
          </span>
          <Button type="button" variant="ghost" size="iconsm" onClick={handleRemove} aria-label={`Remove ${label}`}>
            <X />
          </Button>
        </div>
      ) : (
        <div className="relative">
          <Input
            id={inputId}
            type="file"
            accept={PARTNER_DOCUMENT_MIME_TYPES.join(',')}
            onChange={handleFile}
            disabled={uploading}
            aria-describedby={hint ? `${inputId}-hint` : undefined}
            className="h-auto cursor-pointer py-2 text-muted-foreground file:rounded-md file:bg-lightprimary file:px-3 file:py-1.5 file:font-semibold file:text-primary"
          />
          {uploading && (
            <span className="mt-1 flex items-center gap-2 text-xs font-medium text-primary">
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> Uploading securely…
            </span>
          )}
          {localError && (
            <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-error" role="alert">
              <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
              {localError}
            </p>
          )}
        </div>
      )}
      {hint && (
        <p id={`${inputId}-hint`} className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <FileText className="size-3.5" aria-hidden="true" /> {hint}
        </p>
      )}
    </div>
  );
}
