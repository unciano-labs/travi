'use client';

import { useState } from 'react';
import {
  Shield, Mail, Lock, Phone, CheckCircle2, AlertTriangle,
  ChevronDown, ChevronUp, Eye, EyeOff, Send
} from 'lucide-react';
import {
  sendVerifyEmailOtp, confirmVerifyEmail,
  requestEmailChange, confirmEmailChange,
  requestPasswordChange, confirmPasswordChange,
  requestPhoneChange, confirmPhoneChange
} from '@/actions/profile';
import { PHONE_OTP_ENABLED } from '@/lib/features';
import CardBox from '@/components/ui/CardBox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const PRIMARY_BTN = buttonVariants({ size: 'sm' });
const BACK_BTN = buttonVariants({ variant: 'ghost', size: 'sm' });

interface AccountSecurityProps {
  email: string;
  phone?: string | null;
  emailVerifiedAt?: string | null;
  phoneVerifiedAt?: string | null;
}

export default function AccountSecurityManager({ email, phone, emailVerifiedAt, phoneVerifiedAt }: AccountSecurityProps) {
  // Section toggles
  const [openSection, setOpenSection] = useState<string | null>(null);
  const toggle = (section: string) => setOpenSection(openSection === section ? null : section);

  return (
    <CardBox className="gap-0 overflow-hidden p-0">
      <div className="px-6 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-lightprimary rounded-full flex items-center justify-center">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h5 className="card-title">Account Security</h5>
            <p className="text-sm text-muted-foreground">
              {PHONE_OTP_ENABLED ? 'Manage your email, phone, and password settings.' : 'Manage your email and password settings.'}
            </p>
          </div>
        </div>
      </div>

      <div className="divide-y divide-border">
        <VerifyEmailSection
          email={email}
          isVerified={!!emailVerifiedAt}
          isOpen={openSection === 'verify'}
          onToggle={() => toggle('verify')}
        />
        <ChangeEmailSection
          currentEmail={email}
          isOpen={openSection === 'email'}
          onToggle={() => toggle('email')}
        />
        {/* D5: phone OTP is hidden until an SMS provider is integrated (lib/features.ts). */}
        {PHONE_OTP_ENABLED && (
          <PhoneSection
            phone={phone || ''}
            isVerified={!!phoneVerifiedAt}
            isOpen={openSection === 'phone'}
            onToggle={() => toggle('phone')}
          />
        )}
        <ChangePasswordSection
          isOpen={openSection === 'password'}
          onToggle={() => toggle('password')}
        />
      </div>
    </CardBox>
  );
}

// ─── Verify Email Section ───
function VerifyEmailSection({ email, isVerified, isOpen, onToggle }: {
  email: string; isVerified: boolean; isOpen: boolean; onToggle: () => void;
}) {
  const [step, setStep] = useState<'idle' | 'sent' | 'done'>('idle');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSend = async () => {
    setLoading(true); setError('');
    const res = await sendVerifyEmailOtp();
    if (res.success) setStep('sent');
    else setError(res.error || 'Failed to send code');
    setLoading(false);
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) { setError('Enter a 6-digit code'); return; }
    setLoading(true); setError('');
    const res = await confirmVerifyEmail(code);
    if (res.success) setStep('done');
    else setError(res.error || 'Verification failed');
    setLoading(false);
  };

  return (
    <div>
      <button type="button" onClick={onToggle} aria-expanded={isOpen} className="w-full px-6 py-4 flex items-center justify-between hover:bg-lightprimary/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40">
        <div className="flex items-center gap-3">
          <Mail className="w-5 h-5 text-muted-foreground" />
          <div className="text-left">
            <p className="text-sm font-medium text-foreground">Email Verification</p>
            <p className="text-xs text-muted-foreground">{email}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isVerified || step === 'done' ? (
            <Badge variant="lightSuccess">
              <CheckCircle2 className="w-3.5 h-3.5" /> Verified
            </Badge>
          ) : (
            <Badge variant="lightWarning">
              <AlertTriangle className="w-3.5 h-3.5" /> Unverified
            </Badge>
          )}
          {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>

      {isOpen && !isVerified && step !== 'done' && (
        <div className="px-6 pb-5 pt-1">
          {step === 'idle' && (
            <div className="flex flex-wrap items-center justify-between gap-3 bg-muted/50 rounded-lg p-4 border border-border">
              <p className="text-sm text-bodytext">Send a verification code to <strong>{email}</strong></p>
              <button type="button" onClick={handleSend} disabled={loading}
                className={PRIMARY_BTN}>
                {loading ? 'Sending...' : 'Verify Now'}
              </button>
            </div>
          )}
          {step === 'sent' && (
            <form onSubmit={handleVerify} className="space-y-3">
              <p className="text-sm text-bodytext">Enter the 6-digit code sent to <strong>{email}</strong></p>
              <Input type="text" maxLength={6} placeholder="123456" aria-label="Verification code" value={code} onChange={e => setCode(e.target.value)}
               
                  className="tracking-widest" />
              {error && <p className="text-xs text-error font-medium">{error}</p>}
              <button type="submit" disabled={loading}
                className={PRIMARY_BTN}>
                {loading ? 'Verifying...' : 'Confirm'}
              </button>
            </form>
          )}
          {error && step === 'idle' && <p className="text-xs text-error font-medium mt-2">{error}</p>}
        </div>
      )}
    </div>
  );
}

// ─── Change Email Section ───
function ChangeEmailSection({ currentEmail, isOpen, onToggle }: {
  currentEmail: string; isOpen: boolean; onToggle: () => void;
}) {
  const [step, setStep] = useState<'form' | 'otp' | 'done'>('form');
  const [newEmail, setNewEmail] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRequestChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || newEmail === currentEmail) { setError('Enter a different email address'); return; }
    setLoading(true); setError('');
    const res = await requestEmailChange(newEmail);
    if (res.success) setStep('otp');
    else setError(res.error || 'Failed to send verification code');
    setLoading(false);
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) { setError('Enter a 6-digit code'); return; }
    setLoading(true); setError('');
    const res = await confirmEmailChange(code);
    if (res.success) setStep('done');
    else setError(res.error || 'Verification failed');
    setLoading(false);
  };

  return (
    <div>
      <button type="button" onClick={onToggle} aria-expanded={isOpen} className="w-full px-6 py-4 flex items-center justify-between hover:bg-lightprimary/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40">
        <div className="flex items-center gap-3">
          <Send className="w-5 h-5 text-muted-foreground" />
          <div className="text-left">
            <p className="text-sm font-medium text-foreground">Change Email</p>
            <p className="text-xs text-muted-foreground">Update your email address</p>
          </div>
        </div>
        {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {isOpen && (
        <div className="px-6 pb-5 pt-1">
          {step === 'done' ? (
            <Alert variant="lightsuccess">
              <CheckCircle2 />
              <AlertDescription className="font-medium">Email updated successfully!</AlertDescription>
            </Alert>
          ) : step === 'otp' ? (
            <form onSubmit={handleConfirm} className="space-y-3">
              <p className="text-sm text-bodytext">
                A verification code has been sent to your <strong>current email ({currentEmail})</strong>.
                Enter it below to confirm the email change.
              </p>
              <Input type="text" maxLength={6} placeholder="123456" aria-label="Verification code" value={code} onChange={e => setCode(e.target.value)}
               
                  className="tracking-widest" />
              {error && <p className="text-xs text-error font-medium">{error}</p>}
              <div className="flex gap-2">
                <button type="button" onClick={() => { setStep('form'); setCode(''); setError(''); }}
                  className={BACK_BTN}>Back</button>
                <button type="submit" disabled={loading}
                  className={PRIMARY_BTN}>
                  {loading ? 'Updating...' : 'Confirm Change'}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleRequestChange} className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="sec-new-email">New Email Address</Label>
                <Input id="sec-new-email" type="email" required placeholder="newemail@example.com" value={newEmail} onChange={e => setNewEmail(e.target.value)}
                  />
              </div>
              {error && <p className="text-xs text-error font-medium">{error}</p>}
              <button type="submit" disabled={loading}
                className={PRIMARY_BTN}>
                {loading ? 'Sending Code...' : 'Send Verification Code'}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Phone Section ───
function PhoneSection({ phone, isVerified, isOpen, onToggle }: {
  phone: string; isVerified: boolean; isOpen: boolean; onToggle: () => void;
}) {
  const [step, setStep] = useState<'form' | 'otp' | 'done'>('form');
  const [newPhone, setNewPhone] = useState(phone || '');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRequestChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPhone || newPhone === phone) { setError('Enter a different mobile number'); return; }
    setLoading(true); setError('');
    const res = await requestPhoneChange(newPhone);
    if (res.success) setStep('otp');
    else setError(res.error || 'Failed to send verification code');
    setLoading(false);
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) { setError('Enter a 6-digit code'); return; }
    setLoading(true); setError('');
    const res = await confirmPhoneChange(code);
    if (res.success) setStep('done');
    else setError(res.error || 'Verification failed');
    setLoading(false);
  };

  return (
    <div>
      <button type="button" onClick={onToggle} aria-expanded={isOpen} className="w-full px-6 py-4 flex items-center justify-between hover:bg-lightprimary/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40">
        <div className="flex items-center gap-3">
          <Phone className="w-5 h-5 text-muted-foreground" />
          <div className="text-left">
            <p className="text-sm font-medium text-foreground">Phone Number</p>
            <p className="text-xs text-muted-foreground">{phone || 'Not set — required for password changes'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {phone && (
            isVerified || step === 'done' ? (
              <Badge variant="lightSuccess">
                <CheckCircle2 className="w-3.5 h-3.5" /> Verified
              </Badge>
            ) : (
              <Badge variant="lightWarning">
                <AlertTriangle className="w-3.5 h-3.5" /> Unverified
              </Badge>
            )
          )}
          {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>

      {isOpen && (
        <div className="px-6 pb-5 pt-1">
          {step === 'done' ? (
            <Alert variant="lightsuccess">
              <CheckCircle2 />
              <AlertDescription className="font-medium">Phone number updated successfully!</AlertDescription>
            </Alert>
          ) : step === 'otp' ? (
            <form onSubmit={handleConfirm} className="space-y-3">
              <p className="text-sm text-bodytext">
                A verification code has been sent to your <strong>registered email address</strong>.
                Enter it below to confirm the change.
              </p>
              <Input type="text" maxLength={6} placeholder="123456" aria-label="Verification code" value={code} onChange={e => setCode(e.target.value)}
               
                  className="tracking-widest" />
              {error && <p className="text-xs text-error font-medium">{error}</p>}
              <div className="flex gap-2">
                <button type="button" onClick={() => { setStep('form'); setCode(''); setError(''); }}
                  className={BACK_BTN}>Back</button>
                <button type="submit" disabled={loading}
                  className={PRIMARY_BTN}>
                  {loading ? 'Updating...' : 'Confirm Change'}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleRequestChange} className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="sec-new-phone">Mobile Number</Label>
                <Input id="sec-new-phone" type="tel" required placeholder="09123456789" value={newPhone} onChange={e => setNewPhone(e.target.value)}
                  />
                <p className="text-xs text-muted-foreground">Philippine mobile number format (e.g., 09123456789)</p>
              </div>
              {error && <p className="text-xs text-error font-medium">{error}</p>}
              <button type="submit" disabled={loading}
                className={PRIMARY_BTN}>
                {loading ? 'Sending Code...' : 'Send Verification Code'}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Change Password Section ───
function ChangePasswordSection({ isOpen, onToggle }: {
  isOpen: boolean; onToggle: () => void;
}) {
  const [step, setStep] = useState<'form' | 'otp' | 'done'>('form');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [emailOtp, setEmailOtp] = useState('');
  const [phoneOtp, setPhoneOtp] = useState('');
  const [requiresPhoneOtp, setRequiresPhoneOtp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const passwordStrength = (pwd: string) => {
    if (!pwd) return { label: '', color: '', width: '0%' };
    let score = 0;
    if (pwd.length >= 8) score++;
    if (pwd.length >= 12) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;

    if (score <= 1) return { label: 'Weak', color: 'bg-error', width: '20%' };
    if (score <= 2) return { label: 'Fair', color: 'bg-warning', width: '40%' };
    if (score <= 3) return { label: 'Good', color: 'bg-secondary', width: '60%' };
    if (score <= 4) return { label: 'Strong', color: 'bg-success', width: '80%' };
    return { label: 'Very Strong', color: 'bg-successemphasis', width: '100%' };
  };

  const strength = passwordStrength(newPassword);

  const handleRequestChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (newPassword !== confirmPwd) { setError('Passwords do not match'); return; }
    setLoading(true); setError('');

    const res = await requestPasswordChange(currentPassword);
    if (res.success) {
      // The server decides (only when PHONE_OTP_ENABLED and the account has a phone).
      setRequiresPhoneOtp(PHONE_OTP_ENABLED && res.requiresPhoneOtp);
      setStep('otp');
    } else {
      setError(res.error || 'Failed to verify current password');
    }
    setLoading(false);
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (emailOtp.length !== 6) { setError('Enter a 6-digit email code'); return; }
    if (requiresPhoneOtp && phoneOtp.length !== 6) { setError('Enter a 6-digit phone code'); return; }
    setLoading(true); setError('');

    const res = await confirmPasswordChange(newPassword, emailOtp, requiresPhoneOtp ? phoneOtp : undefined);
    if (res.success) {
      setStep('done');
      setCurrentPassword(''); setNewPassword(''); setConfirmPwd('');
      setEmailOtp(''); setPhoneOtp('');
    } else {
      setError(res.error || 'Password change failed');
    }
    setLoading(false);
  };

  return (
    <div>
      <button type="button" onClick={onToggle} aria-expanded={isOpen} className="w-full px-6 py-4 flex items-center justify-between hover:bg-lightprimary/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40">
        <div className="flex items-center gap-3">
          <Lock className="w-5 h-5 text-muted-foreground" />
          <div className="text-left">
            <p className="text-sm font-medium text-foreground">Change Password</p>
            <p className="text-xs text-muted-foreground">Update your account password</p>
          </div>
        </div>
        {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {isOpen && (
        <div className="px-6 pb-5 pt-1">
          {step === 'done' ? (
            <Alert variant="lightsuccess">
              <CheckCircle2 />
              <AlertDescription className="font-medium">Password changed successfully!</AlertDescription>
            </Alert>
          ) : step === 'otp' ? (
            <form onSubmit={handleConfirm} className="space-y-4">
              <p className="text-sm text-bodytext">
                Enter the verification code{requiresPhoneOtp ? 's' : ''} sent to your email{requiresPhoneOtp ? ' and phone' : ''}.
              </p>

              <div className="space-y-2">
                <Label htmlFor="sec-email-otp">Email Code</Label>
                <Input id="sec-email-otp" type="text" maxLength={6} placeholder="123456" value={emailOtp} onChange={e => setEmailOtp(e.target.value)}
                 
                  className="tracking-widest" />
              </div>

              {requiresPhoneOtp && (
                <div className="space-y-2">
                  <Label htmlFor="sec-phone-otp">Phone Code</Label>
                  <Input id="sec-phone-otp" type="text" maxLength={6} placeholder="123456" value={phoneOtp} onChange={e => setPhoneOtp(e.target.value)}
                   
                  className="tracking-widest" />
                </div>
              )}

              {error && <p className="text-xs text-error font-medium">{error}</p>}

              <div className="flex gap-2">
                <button type="button" onClick={() => { setStep('form'); setEmailOtp(''); setPhoneOtp(''); setError(''); }}
                  className={BACK_BTN}>Back</button>
                <button type="submit" disabled={loading}
                  className={PRIMARY_BTN}>
                  {loading ? 'Changing...' : 'Change Password'}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleRequestChange} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="sec-current-password">Current Password</Label>
                <div className="relative">
                  <Input id="sec-current-password" type={showCurrent ? 'text' : 'password'} required value={currentPassword} onChange={e => setCurrentPassword(e.target.value)}
                    className="pr-10" />
                  <button type="button" onClick={() => setShowCurrent(!showCurrent)} aria-label={showCurrent ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
                    {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sec-new-password">New Password</Label>
                <div className="relative">
                  <Input id="sec-new-password" type={showNew ? 'text' : 'password'} required minLength={8} value={newPassword} onChange={e => setNewPassword(e.target.value)}
                    className="pr-10" />
                  <button type="button" onClick={() => setShowNew(!showNew)} aria-label={showNew ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
                    {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {newPassword && (
                  <div className="mt-1.5">
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-300 ${strength.color}`} style={{ width: strength.width }} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Strength: <span className="font-medium">{strength.label}</span></p>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="sec-confirm-password">Confirm New Password</Label>
                <Input id="sec-confirm-password" type="password" required value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)}
                  />
                {confirmPwd && confirmPwd !== newPassword && (
                  <p className="text-xs text-error font-medium">Passwords do not match</p>
                )}
              </div>

              {error && <p className="text-xs text-error font-medium">{error}</p>}

              <button type="submit" disabled={loading || !currentPassword || !newPassword || newPassword !== confirmPwd}
                className={PRIMARY_BTN}>
                {loading ? 'Verifying...' : 'Continue'}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
