'use client';

import { useState } from 'react';
import { Lock } from 'lucide-react';
import { Input, NativeSelect } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export type KycField = 'type' | 'companyName' | 'legalName' | 'tin' | 'businessRegistrationNo' | 'accreditationNo';

export interface KycDefaults {
  type?: string | null;
  companyName?: string | null;
  legalName?: string | null;
  tin?: string | null;
  businessRegistrationNo?: string | null;
  accreditationNo?: string | null;
}

interface Props {
  partner: 'organizer' | 'transporter';
  idPrefix: string;
  defaults?: KycDefaults;
  /** Verified fields: shown read-only and not submitted (the server keeps the stored value). */
  locked?: KycField[];
  onTypeChange?: (type: 'individual' | 'company') => void;
}

const ACCREDITATION = {
  organizer: { name: 'dotAccreditationNo', label: 'DOT accreditation no.', placeholder: 'e.g. TO-NCR-2024-00123' },
  transporter: { name: 'ltfrbFranchiseNo', label: 'LTFRB franchise / DOT transport accreditation no.', placeholder: 'e.g. 2024-NCR-12345' },
};

/** Business identity (KYC) fields shared by partner onboarding and profile forms (LEG-06/09, BIZ-08). */
export default function PartnerKycFields({ partner, idPrefix, defaults = {}, locked = [], onTypeChange }: Props) {
  const [type, setType] = useState<'individual' | 'company'>(defaults.type === 'company' ? 'company' : 'individual');
  const isLocked = (f: KycField) => locked.includes(f);
  const lockedNote = (f: KycField) =>
    isLocked(f) ? (
      <span className="ml-1 inline-flex items-center gap-1 text-xs font-normal text-muted-foreground">
        <Lock className="size-3" aria-hidden="true" /> verified
      </span>
    ) : null;
  const accreditation = ACCREDITATION[partner];
  const lockedClass = 'bg-muted/50 text-muted-foreground';

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-type`}>Account type{lockedNote('type')}</Label>
        <NativeSelect
          id={`${idPrefix}-type`}
          name={partner === 'organizer' ? 'organizerType' : 'transporterType'}
          value={type}
          disabled={isLocked('type')}
          className={isLocked('type') ? lockedClass : undefined}
          onChange={(e) => {
            const next = e.target.value === 'company' ? 'company' : 'individual';
            setType(next);
            onTypeChange?.(next);
          }}
        >
          <option value="individual">Individual / Sole proprietor</option>
          <option value="company">Registered company</option>
        </NativeSelect>
      </div>

      {type === 'company' && (
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-companyName`}>Registered company name *{lockedNote('companyName')}</Label>
          <Input
            id={`${idPrefix}-companyName`}
            name="companyName"
            required={!isLocked('companyName')}
            disabled={isLocked('companyName')}
            className={isLocked('companyName') ? lockedClass : undefined}
            defaultValue={defaults.companyName ?? ''}
            placeholder="e.g. Island Hoppers Travel and Tours Inc."
          />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-legalName`}>
          {type === 'company' ? 'Authorized representative (legal name) *' : 'Full legal name *'}
          {lockedNote('legalName')}
        </Label>
        <Input
          id={`${idPrefix}-legalName`}
          name="legalName"
          required={!isLocked('legalName')}
          disabled={isLocked('legalName')}
          className={isLocked('legalName') ? lockedClass : undefined}
          defaultValue={defaults.legalName ?? ''}
          aria-describedby={`${idPrefix}-legalName-hint`}
          placeholder="As shown on your government ID"
        />
        <p id={`${idPrefix}-legalName-hint`} className="text-xs text-muted-foreground">
          {partner === 'organizer'
            ? 'Shown to travelers on your tour pages as the merchant of record.'
            : 'Must match your government ID.'}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-tin`}>BIR TIN *{lockedNote('tin')}</Label>
        <Input
          id={`${idPrefix}-tin`}
          name="tin"
          inputMode="numeric"
          required={!isLocked('tin')}
          disabled={isLocked('tin')}
          className={isLocked('tin') ? lockedClass : undefined}
          defaultValue={defaults.tin ?? ''}
          placeholder="123-456-789-000"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-businessRegistrationNo`}>
          DTI / SEC registration no.{type === 'company' ? ' *' : ' (optional)'}
          {lockedNote('businessRegistrationNo')}
        </Label>
        <Input
          id={`${idPrefix}-businessRegistrationNo`}
          name="businessRegistrationNo"
          required={type === 'company' && !isLocked('businessRegistrationNo')}
          disabled={isLocked('businessRegistrationNo')}
          className={isLocked('businessRegistrationNo') ? lockedClass : undefined}
          defaultValue={defaults.businessRegistrationNo ?? ''}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-accreditation`}>
          {accreditation.label} (optional){lockedNote('accreditationNo')}
        </Label>
        <Input
          id={`${idPrefix}-accreditation`}
          name={accreditation.name}
          disabled={isLocked('accreditationNo')}
          className={isLocked('accreditationNo') ? lockedClass : undefined}
          defaultValue={defaults.accreditationNo ?? ''}
          placeholder={accreditation.placeholder}
        />
      </div>
    </div>
  );
}

/** Fields that are verified (approved and already filled) and therefore read-only. */
export function lockedKycFields(status: string, values: Record<KycField, string | null | undefined>): KycField[] {
  if (status !== 'approved') return [];
  return (Object.keys(values) as KycField[]).filter((k) => Boolean(values[k]?.toString().trim()));
}
