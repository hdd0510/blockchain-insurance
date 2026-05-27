const { Op } = require('sequelize');
const { AuditLog } = require('../models');

/**
 * GET /api/audit-logs  [admin only]
 * Query params:
 *   limit       (default 100, max 500)
 *   offset      (default 0)
 *   entity_type (filter)
 *   entity_id   (filter)
 *   action      (substring filter)
 *   user_wallet (filter)
 *   since       (ISO date)
 */
async function listAuditLogs(req, res) {
  const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
  const offset = parseInt(req.query.offset, 10) || 0;
  const where = {};

  if (req.query.entity_type) where.entity_type = req.query.entity_type;
  if (req.query.entity_id) where.entity_id = req.query.entity_id;
  if (req.query.user_wallet) where.user_wallet = req.query.user_wallet.toLowerCase();
  if (req.query.action) where.action = { [Op.like]: `%${req.query.action}%` };
  if (req.query.since) where.created_at = { [Op.gte]: new Date(req.query.since) };

  const { rows, count } = await AuditLog.findAndCountAll({
    where,
    order: [['created_at', 'DESC']],
    limit,
    offset,
  });

  return res.json({ count, rows });
}

/**
 * GET /api/audit-logs/entity/:type/:id
 * Returns chronological audit trail for a single entity.
 */
async function listForEntity(req, res) {
  const { type, id } = req.params;
  const rows = await AuditLog.findAll({
    where: { entity_type: type, entity_id: String(id) },
    order: [['created_at', 'ASC']],
  });
  return res.json(rows);
}

module.exports = { listAuditLogs, listForEntity };
