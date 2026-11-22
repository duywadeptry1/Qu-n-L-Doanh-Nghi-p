const User = require('../models/User');
const { ALL_ROLES, ROLES } = require('../config/rbac');
const { hashPassword, buildUserResponse, getNextUserId } = require('../services/authService');
const { recordAudit } = require('../services/auditService');
const { escapeRegex } = require('../services/helpers');

async function listUsers(req, res) {
  try {
    const { role, search, isActive } = req.query;
    const query = {};
    if (role && ALL_ROLES.includes(role)) {
      query.role = role;
    }
    if (isActive === 'true' || isActive === 'false') {
      query.isActive = isActive === 'true';
    }
    if (search) {
      const pattern = escapeRegex(search);
      query.$or = [
        { fullName: { $regex: pattern, $options: 'i' } },
        { email: { $regex: pattern, $options: 'i' } },
        { phone: { $regex: pattern, $options: 'i' } }
      ];
    }

    const users = await User.find(query).sort({ createdAt: -1 });
    return res.json(users.map(u => buildUserResponse(u)));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function createUser(req, res) {
  try {
    const fullName = String(req.body?.fullName || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const phone = String(req.body?.phone || '').trim();
    const password = String(req.body?.password || '');
    const role = String(req.body?.role || ROLES.SALES).trim();

    if (!fullName || !email || password.length < 6) {
      return res.status(400).json({ error: 'Cần họ tên, email hợp lệ và mật khẩu tối thiểu 6 ký tự' });
    }
    if (!ALL_ROLES.includes(role)) {
      return res.status(400).json({ error: `Vai trò không hợp lệ. Chọn một trong: ${ALL_ROLES.join(', ')}` });
    }

    const existing = await User.findOne({ email }).lean();
    if (existing) {
      return res.status(409).json({ error: 'Email này đã được sử dụng' });
    }

    const id = await getNextUserId();
    const passwordHash = await hashPassword(password);
    const created = await User.create({
      id,
      fullName,
      email,
      phone,
      passwordHash,
      role,
      isActive: true
    });

    await recordAudit(req, {
      action: 'USER_CREATE',
      entity: 'User',
      entityId: created.id,
      summary: `Tạo tài khoản ${created.email} (${created.role})`,
      after: { id: created.id, email: created.email, role: created.role, isActive: true }
    });

    return res.status(201).json(buildUserResponse(created));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function updateUser(req, res) {
  try {
    const target = await User.findOne({ id: req.params.id });
    if (!target) {
      return res.status(404).json({ error: 'Không tìm thấy người dùng' });
    }

    const before = {
      fullName: target.fullName,
      phone: target.phone,
      role: target.role,
      isActive: target.isActive
    };

    const nextRole = req.body?.role !== undefined ? String(req.body.role).trim() : target.role;
    const nextActive = req.body?.isActive !== undefined ? Boolean(req.body.isActive) : target.isActive;

    if (!ALL_ROLES.includes(nextRole)) {
      return res.status(400).json({ error: 'Vai trò không hợp lệ' });
    }

    // Prevent removing/disabling the last active ADMIN
    if (target.role === ROLES.ADMIN && (nextRole !== ROLES.ADMIN || !nextActive)) {
      const otherAdmins = await User.countDocuments({
        role: ROLES.ADMIN,
        isActive: true,
        id: { $ne: target.id }
      });
      if (otherAdmins === 0) {
        return res.status(400).json({ error: 'Không thể hạ quyền hoặc khóa quản trị viên (ADMIN) duy nhất' });
      }
    }

    if (req.body?.fullName !== undefined) target.fullName = String(req.body.fullName).trim();
    if (req.body?.phone !== undefined) target.phone = String(req.body.phone).trim();
    target.role = nextRole;
    target.isActive = nextActive;

    if (req.body?.password && String(req.body.password).length >= 6) {
      target.passwordHash = await hashPassword(req.body.password);
      target.refreshTokens = [];
    }
    if (!nextActive) {
      target.refreshTokens = [];
    }

    await target.save();

    await recordAudit(req, {
      action: 'USER_UPDATE',
      entity: 'User',
      entityId: target.id,
      summary: `Cập nhật tài khoản ${target.email} (${target.role}, active=${target.isActive})`,
      before,
      after: {
        fullName: target.fullName,
        phone: target.phone,
        role: target.role,
        isActive: target.isActive
      }
    });

    return res.json(buildUserResponse(target));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

module.exports = {
  listUsers,
  createUser,
  updateUser
};
