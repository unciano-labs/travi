'use client';

import { useId, useState } from 'react';
import { CheckCircle2, FileText, Loader2, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/browser';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  PARTNER_DOCUMENT_MAX_BYTES,
  PARTNER_DOCUMENT_MIME_TYPES,
  PARTNER_DOCUMENTS_BUCKET,
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

const EXTENSIONS: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/**
 * Uploads one KYC document to the PRIVATE `partner-documents` bucket, inside the user's own folder
 * (storage policy), and hands the metadata to the parent form. The server action records it in
 * partner_documents. Files are never publicly readable; admins open them with signed URLs.
 */
export default function PartnerDocumentUpload({ docType, label, hint, required, value, onChange, onError }: Props) {
  const inputId = useId();
  const [uploading, setUploading] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!(PARTNER_DOCUMENT_MIME_TYPES as readonly string[]).includes(file.type)) {
      onError?.('Upload a PDF, JPG, PNG or WebP file.');
      return;
    }
    if (file.size > PARTNER_DOCUMENT_MAX_BYTES) {
      onError?.('Documents must be 10 MB or smaller.');
      return;
    }

    setUploading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Please sign in again.');

      const path = `${user.id}/${docType}-${crypto.randomUUID()}.${EXTENSIONS[file.type]}`;
      const { error } = await supabase.storage.from(PARTNER_DOCUMENTS_BUCKET).upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (error) throw new Error('Upload failed. Please try again.');

      onChange({
        docType,
        storagePath: path,
        fileName: file.name.slice(0, 200),
        mimeType: file.type as PartnerDocumentInput['mimeType'],
        sizeBytes: file.size,
      });
    } catch (err: unknown) {
      onError?.(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  }

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
          <Button type="button" variant="ghost" size="iconsm" onClick={() => onChange(null)} aria-label={`Remove ${label}`}>
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
