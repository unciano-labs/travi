import { z } from 'zod';

export const PASSWORD_MIN_LENGTH = 8;

// One password rule for signup, reset and change (BIZ-15).
export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(72, 'Password must be at most 72 characters'); // bcrypt's limit in Supabase Auth

export const emailSchema = z.string().trim().toLowerCase().email('Invalid email address').max(254);

export const selfServiceRoleSchema = z.enum(['traveler', 'organizer', 'transporter']);

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
  // Validated again with safeNextPath(); this only bounds the raw input.
  next: z.string().max(512).optional(),
});

export const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  firstName: z.string().trim().min(1, 'First name is required').max(100),
  lastName: z.string().trim().min(1, 'Last name is required').max(100),
  role: selfServiceRoleSchema,
  next: z.string().max(512).optional(),
});

export const addAccountTypeSchema = z.object({
  role: selfServiceRoleSchema,
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resendConfirmationSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const updateProfileNameSchema = z.object({
  fullName: z.string().trim().min(1, 'Name is required').max(200, 'Name is too long'),
});

// Account Security (actions/profile.ts)
export const otpCodeSchema = z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code');

export const phPhoneSchema = z
  .string()
  .transform((v) => v.replace(/[\s-]/g, ''))
  .pipe(z.string().regex(/^(\+63|0)9\d{9}$/, 'Please enter a valid Philippine mobile number (e.g., 09123456789)'));

export const changeEmailSchema = z.object({ newEmail: emailSchema });

export const requestPasswordChangeSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
});

export const confirmPasswordChangeSchema = z.object({
  newPassword: passwordSchema,
  emailOtpCode: otpCodeSchema,
  phoneOtpCode: otpCodeSchema.optional(),
});
