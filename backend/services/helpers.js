// Escape user input before using it inside a MongoDB $regex (prevents invalid-regex crashes / ReDoS)
function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizePhone(phone) {
  return String(phone || '').replace(/\s+/g, '').trim();
}

module.exports = {
  escapeRegex,
  normalizePhone
};
