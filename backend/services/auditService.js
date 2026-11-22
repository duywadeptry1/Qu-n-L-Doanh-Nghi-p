const AuditLog = require('../models/AuditLog');
const StockLog = require('../models/StockLog');

function extractActor(req) {
  const user = req && req.user ? req.user : null;
  return {
    actorId: user ? user.id : 'system',
    actorEmail: user ? user.email : 'system',
    actorRole: user ? user.role : 'ADMIN',
    ip: req ? (req.ip || req.socket?.remoteAddress || '') : ''
  };
}

async function recordAudit(req, { action, entity, entityId = '', summary = '', before = null, after = null }) {
  try {
    const actor = extractActor(req);
    await AuditLog.create({
      actorId: actor.actorId,
      actorEmail: actor.actorEmail,
      actorRole: actor.actorRole,
      action,
      entity,
      entityId: String(entityId || ''),
      summary,
      before,
      after,
      ip: actor.ip
    });
  } catch (err) {
    console.error('⚠️ Failed to write AuditLog:', err.message);
  }
}

async function recordStockLog(req, {
  productId,
  productName,
  delta,
  previousStock,
  newStock,
  reason,
  orderId = '',
  note = ''
}) {
  try {
    const actor = extractActor(req);
    await StockLog.create({
      productId,
      productName,
      delta,
      previousStock,
      newStock,
      reason,
      orderId,
      note,
      actorId: actor.actorId,
      actorRole: actor.actorRole
    });
  } catch (err) {
    console.error('⚠️ Failed to write StockLog:', err.message);
  }
}

module.exports = {
  recordAudit,
  recordStockLog
};
