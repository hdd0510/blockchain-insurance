const { AuditLog } = require('../models');

/**
 * Helper for writing off-chain audit log entries (Section 2.6).
 *
 * Usage from controllers:
 *   await logAction(req, {
 *     action: 'claim.approve.sign',
 *     entityType: 'claim',
 *     entityId: claim.id,
 *     oldValue: { approvals_count: prev },
 *     newValue: { approvals_count: next },
 *     txHash,
 *   });
 *
 * The helper never throws; audit failures must NOT block the original write.
 */
async function logAction(req, {
  action,
  entityType,
  entityId,
  oldValue = null,
  newValue = null,
  txHash = null,
}) {
  try {
    await AuditLog.create({
      user_id: req?.user?.id ?? null,
      user_wallet: req?.user?.wallet ?? null,
      user_role: req?.user?.role ?? null,
      action,
      entity_type: entityType,
      entity_id: entityId != null ? String(entityId) : null,
      old_value: oldValue,
      new_value: newValue,
      ip_address: req?.ip || req?.headers?.['x-forwarded-for'] || null,
      tx_hash: txHash,
    });
  } catch (err) {
    console.warn('[audit-service] failed to write log:', err.message);
  }
}

module.exports = { logAction };
