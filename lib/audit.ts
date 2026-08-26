import { createAdminClient } from '@/lib/supabase/admin';
import { logger, captureException } from '@/lib/logger';

export interface LogMutationParams {
  adminProfileId: string;
  entityType: 'organizer' | 'transporter' | 'tour' | 'booking' | 'review' | 'user_role' | 'user_profile' | string;
  entityId: string;
  action: 'approve' | 'reject' | 'hide' | 'update' | 'delete' | 'create' | string;
  notes?: string;
  diff?: Record<string, any>;
}

/**
 * Centrally records an administrative action/mutation in the `admin_audit_logs` table.
 * Designed to provide a tamper-proof audit trail for SOC 2 and compliance.
 */
export async function logMutation({
  adminProfileId,
  entityType,
  entityId,
  action,
  notes,
  diff,
}: LogMutationParams): Promise<{ success: boolean; error?: string }> {
  try {
    const adminSupabase = createAdminClient({ admin: true });

    let finalNotes = notes || '';
    if (diff) {
      const diffStr = JSON.stringify(diff);
      finalNotes = finalNotes ? `${finalNotes} | Diff: ${diffStr}` : diffStr;
    }

    const { error } = await adminSupabase.from('admin_audit_logs').insert({
      admin_profile_id: adminProfileId,
      entity_type: entityType,
      entity_id: entityId,
      action: action,
      notes: finalNotes || null,
    });

    if (error) {
      captureException(error, { context: 'logMutation insert failed', adminProfileId, entityType, entityId });
      return { success: false, error: error.message };
    }

    logger.info({ adminProfileId, entityType, entityId, action }, 'Admin audit log recorded');
    return { success: true };
  } catch (err: any) {
    captureException(err, { context: 'logMutation exception', adminProfileId, entityType, entityId });
    return { success: false, error: err.message || 'Audit logging failed' };
  }
}

/**
 * Convenient positional wrapper for logging audits.
 */
export async function logAdminAudit(
  adminProfileId: string,
  action: string,
  entityType: string,
  entityId: string,
  diff?: Record<string, any>,
  notes?: string
) {
  return logMutation({
    adminProfileId,
    action,
    entityType,
    entityId,
    diff,
    notes,
  });
}

