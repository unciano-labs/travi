import Link from 'next/link';

// LEG-05: required Partner Terms click-through on the organizer/transporter onboarding forms
// (dashboard theme). The action records the accepted version in legal_acceptances.
export default function PartnerTermsCheckbox({ partner }: { partner: 'organizer' | 'transporter' }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/50 p-4">
      <input
        type="checkbox"
        id="acceptPartnerTerms"
        name="acceptPartnerTerms"
        required
        className="mt-0.5 size-4 shrink-0 accent-primary focus-visible:ring-2 focus-visible:ring-primary/40"
      />
      <label htmlFor="acceptPartnerTerms" className="text-sm text-bodytext">
        I have read and agree to the{' '}
        <Link href="/partner-terms" target="_blank" className="font-medium text-primary underline-offset-2 hover:underline">
          Partner Terms
        </Link>
        {partner === 'organizer'
          ? ', including the platform commission, escrow holding period and my obligations to travelers'
          : ', including my licensing, insurance and safety obligations'}
        . I confirm the information and documents I submit are true and that I am authorized to act for the business.
      </label>
    </div>
  );
}
