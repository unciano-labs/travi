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
  updateProfilePhone
} from '@/actions/profile';

interface AccountSecurityProps {
  email: string;
  phone?: string | null;
  emailVerifiedAt?: string | null;
}

export default function AccountSecurityManager({ email, phone, emailVerifiedAt }: AccountSecurityProps) {
  // Section toggles
  const [openSection, setOpenSection] = useState<string | null>(null);
  const toggle = (section: string) => setOpenSection(openSection === section ? null : section);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-6 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-brand/10 rounded-xl flex items-center justify-center">
            <Shield className="w-5 h-5 text-brand" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-brand-navy">Account Security</h3>
            <p className="text-sm text-slate-500">Manage your email, phone, and password settings.</p>
          </div>
        </div>
      </div>

      <div className="divide-y divide-slate-100">
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
        <PhoneSection
          phone={phone || ''}
          isOpen={openSection === 'phone'}
          onToggle={() => toggle('phone')}
        />
        <ChangePasswordSection
          hasPhone={!!phone}
          isOpen={openSection === 'password'}
          onToggle={() => toggle('password')}
        />
      </div>
    </div>
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
      <button onClick={onToggle} className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
        <div className="flex items-center gap-3">
          <Mail className="w-5 h-5 text-slate-400" />
          <div className="text-left">
            <p className="text-sm font-medium text-slate-900">Email Verification</p>
            <p className="text-xs text-slate-500">{email}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isVerified || step === 'done' ? (
            <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
              <CheckCircle2 className="w-3.5 h-3.5" /> Verified
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs font-semibold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full">
              <AlertTriangle className="w-3.5 h-3.5" /> Unverified
            </span>
          )}
          {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </button>

      {isOpen && !isVerified && step !== 'done' && (
        <div className="px-6 pb-5 pt-1">
          {step === 'idle' && (
            <div className="flex items-center justify-between bg-slate-50 rounded-xl p-4 border border-slate-100">
              <p className="text-sm text-slate-600">Send a verification code to <strong>{email}</strong></p>
              <button onClick={handleSend} disabled={loading}
                className="px-4 py-2 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand-dark transition disabled:opacity-50">
                {loading ? 'Sending...' : 'Verify Now'}
              </button>
            </div>
          )}
          {step === 'sent' && (
            <form onSubmit={handleVerify} className="space-y-3">
              <p className="text-sm text-slate-600">Enter the 6-digit code sent to <strong>{email}</strong></p>
              <input type="text" maxLength={6} placeholder="123456" value={code} onChange={e => setCode(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm tracking-widest outline-none focus:border-brand focus:ring-1 focus:ring-brand/20" />
              {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
              <button type="submit" disabled={loading}
                className="px-4 py-2 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand-dark transition disabled:opacity-50">
                {loading ? 'Verifying...' : 'Confirm'}
              </button>
            </form>
          )}
          {error && step === 'idle' && <p className="text-xs text-red-500 font-medium mt-2">{error}</p>}
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
      <button onClick={onToggle} className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
        <div className="flex items-center gap-3">
          <Send className="w-5 h-5 text-slate-400" />
          <div className="text-left">
            <p className="text-sm font-medium text-slate-900">Change Email</p>
            <p className="text-xs text-slate-500">Update your email address</p>
          </div>
        </div>
        {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {isOpen && (
        <div className="px-6 pb-5 pt-1">
          {step === 'done' ? (
            <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 rounded-xl p-4 border border-emerald-100">
              <CheckCircle2 className="w-5 h-5" />
              <p className="text-sm font-medium">Email updated successfully!</p>
            </div>
          ) : step === 'otp' ? (
            <form onSubmit={handleConfirm} className="space-y-3">
              <p className="text-sm text-slate-600">
                A verification code has been sent to your <strong>current email ({currentEmail})</strong>.
                Enter it below to confirm the email change.
              </p>
              <input type="text" maxLength={6} placeholder="123456" value={code} onChange={e => setCode(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm tracking-widest outline-none focus:border-brand focus:ring-1 focus:ring-brand/20" />
              {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
              <div className="flex gap-2">
                <button type="button" onClick={() => { setStep('form'); setCode(''); setError(''); }}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition">Back</button>
                <button type="submit" disabled={loading}
                  className="px-4 py-2 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand-dark transition disabled:opacity-50">
                  {loading ? 'Updating...' : 'Confirm Change'}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleRequestChange} className="space-y-3">
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">New Email Address</label>
                <input type="email" required placeholder="newemail@example.com" value={newEmail} onChange={e => setNewEmail(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand/20" />
              </div>
              {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
              <button type="submit" disabled={loading}
                className="px-4 py-2 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand-dark transition disabled:opacity-50">
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
function PhoneSection({ phone, isOpen, onToggle }: {
  phone: string; isOpen: boolean; onToggle: () => void;
}) {
  const [phoneValue, setPhoneValue] = useState(phone || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(''); setSuccess(false);
    const res = await updateProfilePhone(phoneValue);
    if (res.success) setSuccess(true);
    else setError(res.error || 'Failed to update phone');
    setLoading(false);
  };

  return (
    <div>
      <button onClick={onToggle} className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
        <div className="flex items-center gap-3">
          <Phone className="w-5 h-5 text-slate-400" />
          <div className="text-left">
            <p className="text-sm font-medium text-slate-900">Phone Number</p>
            <p className="text-xs text-slate-500">{phone || 'Not set — required for password changes'}</p>
          </div>
        </div>
        {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {isOpen && (
        <div className="px-6 pb-5 pt-1">
          <form onSubmit={handleSave} className="space-y-3">
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Mobile Number</label>
              <input type="tel" required placeholder="09123456789" value={phoneValue} onChange={e => setPhoneValue(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand/20" />
              <p className="text-xs text-slate-400">Philippine mobile number format (e.g., 09123456789)</p>
            </div>
            {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
            {success && <p className="text-xs text-emerald-600 font-medium">Phone number updated!</p>}
            <button type="submit" disabled={loading}
              className="px-4 py-2 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand-dark transition disabled:opacity-50">
              {loading ? 'Saving...' : 'Save Phone'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

// ─── Change Password Section ───
function ChangePasswordSection({ hasPhone, isOpen, onToggle }: {
  hasPhone: boolean; isOpen: boolean; onToggle: () => void;
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

    if (score <= 1) return { label: 'Weak', color: 'bg-red-500', width: '20%' };
    if (score <= 2) return { label: 'Fair', color: 'bg-amber-500', width: '40%' };
    if (score <= 3) return { label: 'Good', color: 'bg-yellow-500', width: '60%' };
    if (score <= 4) return { label: 'Strong', color: 'bg-emerald-500', width: '80%' };
    return { label: 'Very Strong', color: 'bg-emerald-600', width: '100%' };
  };

  const strength = passwordStrength(newPassword);

  const handleRequestChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (newPassword !== confirmPwd) { setError('Passwords do not match'); return; }
    setLoading(true); setError('');

    const res = await requestPasswordChange(currentPassword);
    if (res.success) {
      setRequiresPhoneOtp('requiresPhoneOtp' in res ? !!res.requiresPhoneOtp : false);
      setStep('otp');
    } else {
      setError('error' in res && res.error ? String(res.error) : 'Failed to verify current password');
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
      <button onClick={onToggle} className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
        <div className="flex items-center gap-3">
          <Lock className="w-5 h-5 text-slate-400" />
          <div className="text-left">
            <p className="text-sm font-medium text-slate-900">Change Password</p>
            <p className="text-xs text-slate-500">Update your account password</p>
          </div>
        </div>
        {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {isOpen && (
        <div className="px-6 pb-5 pt-1">
          {step === 'done' ? (
            <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 rounded-xl p-4 border border-emerald-100">
              <CheckCircle2 className="w-5 h-5" />
              <p className="text-sm font-medium">Password changed successfully!</p>
            </div>
          ) : step === 'otp' ? (
            <form onSubmit={handleConfirm} className="space-y-4">
              <p className="text-sm text-slate-600">
                Enter the verification code{requiresPhoneOtp ? 's' : ''} sent to your email{requiresPhoneOtp ? ' and phone' : ''}.
              </p>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Email Code</label>
                <input type="text" maxLength={6} placeholder="123456" value={emailOtp} onChange={e => setEmailOtp(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm tracking-widest outline-none focus:border-brand focus:ring-1 focus:ring-brand/20" />
              </div>

              {requiresPhoneOtp && (
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Phone Code</label>
                  <input type="text" maxLength={6} placeholder="123456" value={phoneOtp} onChange={e => setPhoneOtp(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm tracking-widest outline-none focus:border-brand focus:ring-1 focus:ring-brand/20" />
                </div>
              )}

              {error && <p className="text-xs text-red-500 font-medium">{error}</p>}

              <div className="flex gap-2">
                <button type="button" onClick={() => { setStep('form'); setEmailOtp(''); setPhoneOtp(''); setError(''); }}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition">Back</button>
                <button type="submit" disabled={loading}
                  className="px-4 py-2 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand-dark transition disabled:opacity-50">
                  {loading ? 'Changing...' : 'Change Password'}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleRequestChange} className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Current Password</label>
                <div className="relative">
                  <input type={showCurrent ? 'text' : 'password'} required value={currentPassword} onChange={e => setCurrentPassword(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-4 py-2.5 pr-10 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand/20" />
                  <button type="button" onClick={() => setShowCurrent(!showCurrent)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">New Password</label>
                <div className="relative">
                  <input type={showNew ? 'text' : 'password'} required minLength={8} value={newPassword} onChange={e => setNewPassword(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-4 py-2.5 pr-10 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand/20" />
                  <button type="button" onClick={() => setShowNew(!showNew)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {newPassword && (
                  <div className="mt-1.5">
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-300 ${strength.color}`} style={{ width: strength.width }} />
                    </div>
                    <p className="text-xs text-slate-500 mt-1">Strength: <span className="font-medium">{strength.label}</span></p>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Confirm New Password</label>
                <input type="password" required value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand/20" />
                {confirmPwd && confirmPwd !== newPassword && (
                  <p className="text-xs text-red-500 font-medium">Passwords do not match</p>
                )}
              </div>

              {error && <p className="text-xs text-red-500 font-medium">{error}</p>}

              <button type="submit" disabled={loading || !currentPassword || !newPassword || newPassword !== confirmPwd}
                className="px-4 py-2 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand-dark transition disabled:opacity-50">
                {loading ? 'Verifying...' : 'Continue'}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
