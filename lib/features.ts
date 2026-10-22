// Launch feature flags (compile-time constants, not env vars: flipping one is a code change).

// D5 (docs/MVP_LAUNCH_READINESS.md): no SMS provider at launch, so phone OTP is hidden.
// When false, the UI hides phone-number changes and the phone code in password changes, and
// the phone Server Actions in actions/profile.ts refuse. Email OTP is the only second factor.
export const PHONE_OTP_ENABLED: boolean = false;
