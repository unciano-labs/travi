import Link from 'next/link';
import { Clock, MessageSquareWarning, XCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface Props {
  partner: 'organizer' | 'transporter';
  status: string;
  reviewNote?: string | null;
  infoRequestedAt?: string | null;
}

const LIMITS = {
  organizer: 'You can prepare draft tours, itineraries and schedules, but you cannot publish tours or request payouts until your account is approved.',
  transporter: 'You can add vehicles and set availability, but organizers cannot find or request your vehicles, and you cannot request payouts, until your account is approved.',
};

/** Approval state for partner dashboards (BIZ-06/07). Renders nothing once approved. */
export default function PartnerStatusBanner({ partner, status, reviewNote, infoRequestedAt }: Props) {
  if (status === 'approved') return null;
  const profileHref = `/dashboard/${partner}/profile`;

  if (status === 'rejected') {
    return (
      <Alert variant="lighterror" className="mb-6">
        <XCircle />
        <AlertTitle>Your application was not approved</AlertTitle>
        <AlertDescription className="space-y-1">
          {reviewNote && <p>Reason: {reviewNote}</p>}
          <p>
            Update your business details or documents on your{' '}
            <Link href={profileHref} className="font-semibold underline">profile page</Link> to send it for review again.
          </p>
        </AlertDescription>
      </Alert>
    );
  }

  if (infoRequestedAt) {
    return (
      <Alert variant="lightwarning" className="mb-6">
        <MessageSquareWarning />
        <AlertTitle>We need more information to approve your account</AlertTitle>
        <AlertDescription className="space-y-1">
          {reviewNote && <p>{reviewNote}</p>}
          <p>
            Please update your details or upload the requested documents on your{' '}
            <Link href={profileHref} className="font-semibold underline">profile page</Link>.
          </p>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert variant="lightinfo" className="mb-6">
      <Clock />
      <AlertTitle>Your account is pending review</AlertTitle>
      <AlertDescription>
        <p>We are checking your business details and documents, usually within 1–2 business days. {LIMITS[partner]}</p>
      </AlertDescription>
    </Alert>
  );
}
