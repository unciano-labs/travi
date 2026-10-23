'use client';

import { useId, useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface InputDialogProps {
  open: boolean;
  title: string;
  description?: React.ReactNode;
  label: string;
  placeholder?: string;
  multiline?: boolean;
  /** Minimum trimmed length; 0 makes the field optional. */
  minLength?: number;
  maxLength?: number;
  confirmText: string;
  destructive?: boolean;
  /** Resolves to an error message to show, or null when done (the dialog then closes). */
  onSubmit: (value: string) => Promise<string | null>;
  onClose: () => void;
}

// Replaces window.prompt() in the admin console: a labelled field, validation, pending and error states.
export default function InputDialog({
  open,
  title,
  description,
  label,
  placeholder,
  multiline = false,
  minLength = 1,
  maxLength = 500,
  confirmText,
  destructive = false,
  onSubmit,
  onClose,
}: InputDialogProps) {
  const fieldId = useId();
  const [value, setValue] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = value.trim();
  const valid = trimmed.length >= minLength && trimmed.length <= maxLength;

  const close = () => {
    if (pending) return;
    setValue('');
    setError(null);
    onClose();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || pending) return;
    setPending(true);
    setError(null);
    const message = await onSubmit(trimmed);
    setPending(false);
    if (message) {
      setError(message);
      return;
    }
    setValue('');
    onClose();
  };

  const Field = multiline ? Textarea : Input;

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) close(); }}>
      <DialogContent className="max-w-md">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription className="pt-2 leading-relaxed">{description}</DialogDescription>}
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor={fieldId}>
              {label}
              {minLength === 0 && <span className="font-normal text-muted-foreground"> (optional)</span>}
            </Label>
            <Field
              id={fieldId}
              value={value}
              placeholder={placeholder}
              maxLength={maxLength}
              autoFocus
              onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setValue(e.target.value)}
            />
          </div>
          {error && (
            <Alert variant="lighterror">
              <AlertCircle />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <Button type="button" variant="neutral" onClick={close} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" variant={destructive ? 'error' : 'default'} disabled={!valid || pending}>
              {pending && <Loader2 className="animate-spin" />}
              {confirmText}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
