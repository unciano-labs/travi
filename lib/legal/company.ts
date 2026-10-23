// Single source of truth for Travi's business identity and legal document versions (LEG-01…05, LEG-11).
// Used by the policy pages, the footer, the contact page, consent capture and the data export.
//
// ⚠ Every value marked TODO is a PLACEHOLDER. The business must fill it in with its real, registered
// details before launch. Never invent these facts in code or copy. Values that still start with
// "TODO" are shown to visitors as "(to be provided)" (see `legalValue`).
//
// ⚠ The policy texts in app/{terms,privacy,refund-policy,cookies,partner-terms}/ are DRAFTS written
// by engineering. They must be reviewed by Philippine counsel. Set LEGAL_REVIEW_COMPLETE = true only
// after that review; until then every policy page shows a "Draft — pending review" notice.

/** Flip to true only after Philippine counsel has reviewed and approved every policy page. */
export const LEGAL_REVIEW_COMPLETE = false;

export const COMPANY = {
  /** Trade / brand name used across the site. */
  brandName: 'Travi',
  /** TODO: exact registered name on the DTI certificate or SEC registration. */
  registeredName: 'TODO: registered business name (DTI/SEC)',
  /** TODO: 'DTI' for a sole proprietorship, 'SEC' for a corporation/partnership. */
  registrationAuthority: 'TODO: DTI or SEC',
  /** TODO: DTI business name certificate no. or SEC company registration no. */
  registrationNumber: 'TODO: DTI/SEC registration number',
  /** TODO: BIR Taxpayer Identification Number (with branch code). */
  tin: 'TODO: BIR TIN',
  /** TODO: registered principal office address (as on the DTI/SEC/BIR registration). */
  registeredAddress: 'TODO: registered business address',
  /** TODO: customer support inbox. Contact-form messages are emailed here once it is a real address. */
  supportEmail: 'TODO: support email address',
  /** TODO: customer support phone / mobile number (optional but recommended under RA 11967). */
  supportPhone: 'TODO: support phone number',
  /** TODO: support hours, e.g. "Monday to Friday, 9:00 AM to 6:00 PM (Philippine time)". */
  supportHours: 'TODO: support hours',
  /** TODO: Data Protection Officer (RA 10173 / NPC Circular 2022-04). */
  dpoName: 'TODO: Data Protection Officer name',
  /** TODO: DPO contact email (e.g. a dedicated privacy@ inbox). */
  dpoEmail: 'TODO: DPO email address',
  /** TODO: NPC registration number, if registration is required (NPC Circular 2022-04 thresholds). */
  npcRegistrationNumber: 'TODO: NPC registration number (if applicable)',
  /** TODO: target response time for support messages, e.g. "2 business days". */
  supportResponseTime: 'TODO: support response time',
} as const;

/**
 * Retention periods quoted in the Privacy Notice and the data-deletion flow. TODO: decide with counsel
 * (tax/accounting record rules, NPC guidance). Shown as "(to be provided)" until filled in.
 */
export const RETENTION = {
  /** Bookings, payments, refunds, payouts, wallet ledger, invoices. */
  financialRecords: 'TODO: retention period for booking, payment and payout records',
  /** Profile and account data after an account is closed. */
  accountData: 'TODO: retention period for account data after closure',
  /** Support messages, complaints and data requests after they are closed. */
  supportRecords: 'TODO: retention period for support and complaint records',
  /** Partner KYC documents after the partnership ends. */
  partnerDocuments: 'TODO: retention period for partner verification documents',
} as const;

export type LegalDocumentKey = 'terms' | 'privacy' | 'refundPolicy' | 'cookies' | 'partnerTerms' | 'checkoutTerms';

export interface LegalDocumentMeta {
  title: string;
  path: string;
  /** Recorded with every acceptance. Letters, digits, dot, dash, underscore; max 32 chars (DB CHECK). */
  version: string;
  /** Date this draft was last edited (YYYY-MM-DD). */
  lastUpdated: string;
  /** TODO: set (YYYY-MM-DD) when the reviewed document takes effect. null = not yet in effect. */
  effectiveDate: string | null;
}

/**
 * Versions of every legal document. Bump `version` whenever the text of a document changes in a way
 * users must agree to again. (Prompting existing users to re-accept is not built yet: we only record
 * which version each user accepted.)
 */
export const LEGAL_DOCUMENTS: Record<LegalDocumentKey, LegalDocumentMeta> = {
  terms: { title: 'Terms of Service', path: '/terms', version: '0.1-draft', lastUpdated: '2026-10-24', effectiveDate: null },
  privacy: { title: 'Privacy Notice', path: '/privacy', version: '0.1-draft', lastUpdated: '2026-10-24', effectiveDate: null },
  refundPolicy: { title: 'Refund & Cancellation Policy', path: '/refund-policy', version: '0.1-draft', lastUpdated: '2026-10-24', effectiveDate: null },
  cookies: { title: 'Cookie Policy', path: '/cookies', version: '0.1-draft', lastUpdated: '2026-10-24', effectiveDate: null },
  partnerTerms: { title: 'Partner Terms', path: '/partner-terms', version: '0.1-draft', lastUpdated: '2026-10-24', effectiveDate: null },
  // The checkbox shown at payment: "I agree to the Terms of Service and the Refund & Cancellation Policy".
  checkoutTerms: { title: 'Booking terms (checkout)', path: '/refund-policy', version: '0.1-draft', lastUpdated: '2026-10-24', effectiveDate: null },
};

/** `legal_acceptances.document` values (DB CHECK) and the config entry each one records. */
export const ACCEPTANCE_DOCUMENTS = {
  terms: 'terms',
  privacy: 'privacy',
  partner_terms: 'partnerTerms',
  checkout_terms: 'checkoutTerms',
} as const satisfies Record<string, LegalDocumentKey>;
export type AcceptanceDocument = keyof typeof ACCEPTANCE_DOCUMENTS;

export function acceptanceVersion(document: AcceptanceDocument): string {
  return LEGAL_DOCUMENTS[ACCEPTANCE_DOCUMENTS[document]].version;
}

/** True while a config value is still a TODO placeholder. */
export function isPlaceholder(value: string | null | undefined): boolean {
  return !value || value.trim().toUpperCase().startsWith('TODO');
}

/** Display value for visitors: placeholders render as "(to be provided)", never as "TODO: …". */
export function legalValue(value: string | null | undefined): string {
  return isPlaceholder(value) ? '(to be provided)' : (value as string);
}

/** "DTI" / "SEC", or "DTI/SEC" while the registration authority is still a placeholder. */
export function registrationAuthorityLabel(): string {
  return isPlaceholder(COMPANY.registrationAuthority) ? 'DTI/SEC' : COMPANY.registrationAuthority;
}

/** A real email address from the config, or null while it is still a placeholder. */
export function configuredEmail(value: string): string | null {
  return !isPlaceholder(value) && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value) ? value : null;
}

/** Every TODO placeholder still present, for the launch checklist and the admin requests page. */
export function missingCompanyFacts(): string[] {
  return Object.entries(COMPANY)
    .filter(([, value]) => isPlaceholder(value))
    .map(([key]) => key);
}

/** National Privacy Commission complaint route (RA 10173). Public, verifiable information. */
export const NPC = {
  name: 'National Privacy Commission',
  website: 'https://privacy.gov.ph',
} as const;

/** DTI consumer complaints (Consumer Act RA 7394; Internet Transactions Act RA 11967 e-Commerce Bureau). */
export const DTI = {
  name: 'Department of Trade and Industry',
  website: 'https://www.dti.gov.ph',
} as const;
