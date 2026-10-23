import { z } from 'zod';

// Partner onboarding, KYC and admin review (BIZ-06/07/08, LEG-06/09).
// Mirrors supabase/migrations/20261025090000_partner_approval_kyc.sql.

export const PARTNER_DOCUMENT_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'] as const;
export const PARTNER_DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;
export const PARTNER_DOCUMENTS_BUCKET = 'partner-documents';

export const partnerTypeSchema = z.enum(['organizer', 'transporter']);
export type PartnerType = z.infer<typeof partnerTypeSchema>;

export const partnerDocTypeSchema = z.enum([
  'government_id',
  'business_registration',
  'bir_registration',
  'dot_accreditation',
  'ltfrb_franchise',
  'vehicle_orcr',
  'insurance',
  'other',
]);
export type PartnerDocType = z.infer<typeof partnerDocTypeSchema>;

export const PARTNER_DOC_LABELS: Record<PartnerDocType, string> = {
  government_id: 'Government ID',
  business_registration: 'DTI / SEC registration',
  bir_registration: 'BIR certificate of registration',
  dot_accreditation: 'DOT accreditation',
  ltfrb_franchise: 'LTFRB franchise / DOT transport accreditation',
  vehicle_orcr: 'Vehicle OR/CR',
  insurance: 'Insurance',
  other: 'Other document',
};

/** A file the browser already uploaded to `partner-documents/<auth uid>/…`. */
export const partnerDocumentInputSchema = z.object({
  docType: partnerDocTypeSchema,
  storagePath: z
    .string()
    .min(3)
    .max(300)
    .regex(/^[0-9a-f-]{36}\/[A-Za-z0-9._-]+$/, 'Invalid document path'),
  fileName: z.string().trim().max(200).optional(),
  mimeType: z.enum(PARTNER_DOCUMENT_MIME_TYPES),
  sizeBytes: z.number().int().positive().max(PARTNER_DOCUMENT_MAX_BYTES, 'Documents must be 10 MB or smaller'),
});
export type PartnerDocumentInput = z.infer<typeof partnerDocumentInputSchema>;

/** FormData field `documents`: a JSON array of uploaded documents. */
export const partnerDocumentsFieldSchema = z
  .string()
  .optional()
  .transform((raw, ctx) => {
    if (!raw) return [] as unknown[];
    try {
      return JSON.parse(raw) as unknown[];
    } catch {
      ctx.addIssue({ code: 'custom', message: 'Invalid documents' });
      return z.NEVER;
    }
  })
  .pipe(z.array(partnerDocumentInputSchema).max(10));

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : null));

// BIR TIN: 9 digits, optionally followed by a 3–5 digit branch code; dashes/spaces allowed.
export const tinSchema = z
  .string()
  .trim()
  .regex(/^\d{3}[- ]?\d{3}[- ]?\d{3}([- ]?\d{3,5})?$/, 'Enter a valid TIN, e.g. 123-456-789-000');

const phoneSchema = z
  .string()
  .trim()
  .min(7, 'Enter a valid phone number')
  .max(20, 'Enter a valid phone number')
  .regex(/^[+\d][\d\s-]+$/, 'Enter a valid phone number');

const partnerIdentityShape = {
  companyName: optionalText(200),
  displayName: z.string().trim().min(2, 'Display name is required').max(120),
  legalName: z.string().trim().min(2, 'Legal name is required').max(200),
  tin: tinSchema,
  businessRegistrationNo: optionalText(100),
  phone: phoneSchema,
  description: optionalText(2000),
};

// BIZ-08: company partners need a company name and a DTI/SEC registration number.
function companyRules(
  data: { type: 'individual' | 'company'; companyName: string | null; businessRegistrationNo: string | null },
  ctx: z.RefinementCtx
) {
  if (data.type !== 'company') return;
  if (!data.companyName) {
    ctx.addIssue({ code: 'custom', path: ['companyName'], message: 'Company name is required for registered companies' });
  }
  if (!data.businessRegistrationNo) {
    ctx.addIssue({
      code: 'custom',
      path: ['businessRegistrationNo'],
      message: 'DTI / SEC registration number is required for registered companies',
    });
  }
}

export const organizerProfileSchema = z
  .object({
    organizerType: z.enum(['individual', 'company']),
    ...partnerIdentityShape,
    dotAccreditationNo: optionalText(100),
    address: optionalText(500),
    publicContactEmail: z.string().trim().email('Enter a valid contact email').max(254),
    providesTransport: z.boolean(),
  })
  .superRefine((d, ctx) =>
    companyRules({ type: d.organizerType, companyName: d.companyName, businessRegistrationNo: d.businessRegistrationNo }, ctx)
  );
export type OrganizerProfileInput = z.infer<typeof organizerProfileSchema>;

export const transporterProfileSchema = z
  .object({
    transporterType: z.enum(['individual', 'company']),
    ...partnerIdentityShape,
    ltfrbFranchiseNo: optionalText(100),
    serviceAreas: z.array(z.string().trim().min(1).max(100)).max(30),
  })
  .superRefine((d, ctx) =>
    companyRules({ type: d.transporterType, companyName: d.companyName, businessRegistrationNo: d.businessRegistrationNo }, ctx)
  );
export type TransporterProfileInput = z.infer<typeof transporterProfileSchema>;

/** Onboarding needs a government ID upload. */
export function assertHasGovernmentId(documents: PartnerDocumentInput[]) {
  if (!documents.some((d) => d.docType === 'government_id')) {
    throw new Error('Please upload a government-issued ID.');
  }
}

// ─── Admin review ───

export const partnerRefSchema = z.object({
  partnerType: partnerTypeSchema,
  partnerId: z.string().uuid(),
});

export const rejectPartnerSchema = partnerRefSchema.extend({
  reason: z.string().trim().min(3, 'Please give a reason').max(1000),
});

export const requestMoreInfoSchema = partnerRefSchema.extend({
  note: z.string().trim().min(3, 'Please describe what is missing').max(1000),
});

export const documentIdSchema = z.string().uuid();

// ─── Vehicles ───

export const vehicleSchema = z.object({
  name: z.string().trim().min(2, 'Vehicle name is required').max(120),
  vehicleType: z.enum(['car', 'van', 'bus', 'minibus', 'suv']),
  seatCapacity: z.coerce.number().int('Seat capacity must be a whole number').min(1, 'Seat capacity must be at least 1').max(100),
  plateNumber: z
    .string()
    .trim()
    .max(20)
    .optional()
    .transform((v) => (v ? v.toUpperCase() : null)),
  ratePerDay: z
    .union([z.literal(''), z.coerce.number().min(0, 'Rate cannot be negative').max(1_000_000)])
    .optional()
    .transform((v) => (v === '' || v === undefined ? null : v)),
  description: optionalText(2000),
  status: z.enum(['active', 'inactive']).default('active'),
  photos: z.array(z.string().url()).max(12).default([]),
});
export type VehicleInput = z.infer<typeof vehicleSchema>;

export const vehicleSearchSchema = z
  .object({
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'Invalid start date'),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'Invalid end date'),
    requiredCapacity: z.coerce.number().int().min(1).max(100),
  })
  .transform((d) => ({ ...d, startDate: d.startDate.slice(0, 10), endDate: d.endDate.slice(0, 10) }));
