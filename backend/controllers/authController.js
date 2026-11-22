const User = require('../models/User');
const {
  hashPassword,
  comparePassword,
  hashToken,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  buildUserResponse
} = require('../services/authService');
const { recordAudit } = require('../services/auditService');

async function login(req, res) {
  try {
    const identifier = String(req.body?.email || req.body?.username || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    if (!identifier || !password) {
      return res.status(400).json({ error: 'Vui lòng nhập đầy đủ email và mật khẩu' });
    }

    const user = await User.findOne({ email: identifier });
    if (!user) {
      return res.status(401).json({ error: 'Email hoặc mật khẩu không chính xác' });
    }
    if (!user.isActive) {
      return res.status(403).json({
        code: 'ACCOUNT_DISABLED',
        error: 'Tài khoản này đã bị vô hiệu hóa. Liên hệ Quản trị viên.'
      });
    }

    const valid = await comparePassword(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Email hoặc mật khẩu không chính xác' });
    }

    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user);
    const hashedRefresh = hashToken(refreshToken);
    const loginAt = new Date();

    // Atomically append refresh token (keeping latest 5) so concurrent logins never hit VersionError
    await User.updateOne(
      { id: user.id },
      {
        $push: { refreshTokens: { $each: [hashedRefresh], $slice: -5 } },
        $set: { lastLoginAt: loginAt }
      }
    );
    user.lastLoginAt = loginAt;

    req.user = { id: user.id, email: user.email, role: user.role };
    await recordAudit(req, {
      action: 'AUTH_LOGIN',
      entity: 'User',
      entityId: user.id,
      summary: `${user.email} (${user.role}) đã đăng nhập Portal`
    });

    return res.json({
      accessToken,
      refreshToken,
      user: buildUserResponse(user)
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function refresh(req, res) {
  try {
    const refreshToken = String(req.body?.refreshToken || '').trim();
    if (!refreshToken) {
      return res.status(400).json({ error: 'Thiếu refreshToken' });
    }

    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch (_err) {
      return res.status(401).json({
        code: 'INVALID_REFRESH_TOKEN',
        error: 'Refresh token không hợp lệ hoặc đã hết hạn'
      });
    }

    const hashed = hashToken(refreshToken);
    const user = await User.findOne({ id: payload.sub, isActive: true, refreshTokens: hashed });
    if (!user) {
      return res.status(401).json({
        code: 'REFRESH_REVOKED',
        error: 'Phiên đăng nhập đã bị thu hồi hoặc hết hạn'
      });
    }

    // Atomically rotate refresh token (pull old, push new, keep latest 5)
    const newAccessToken = signAccessToken(user);
    const newRefreshToken = signRefreshToken(user);
    const newHashed = hashToken(newRefreshToken);
    await User.updateOne({ id: user.id }, { $pull: { refreshTokens: hashed } });
    await User.updateOne(
      { id: user.id },
      { $push: { refreshTokens: { $each: [newHashed], $slice: -5 } } }
    );

    return res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      user: buildUserResponse(user)
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function logout(req, res) {
  try {
    const refreshToken = String(req.body?.refreshToken || '').trim();
    if (refreshToken) {
      const hashed = hashToken(refreshToken);
      await User.updateOne(
        { refreshTokens: hashed },
        { $pull: { refreshTokens: hashed } }
      );
    }
    if (req.user && !req.user.isLegacyClient) {
      await recordAudit(req, {
        action: 'AUTH_LOGOUT',
        entity: 'User',
        entityId: req.user.id,
        summary: `${req.user.email} đã đăng xuất`
      });
    }
    return res.json({ success: true, message: 'Đã đăng xuất thành công' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function me(req, res) {
  try {
    const user = await User.findOne({ id: req.user.id });
    if (!user) {
      return res.status(404).json({ error: 'Không tìm thấy tài khoản' });
    }
    return res.json({ user: buildUserResponse(user) });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function changePassword(req, res) {
  try {
    const currentPassword = String(req.body?.currentPassword || '');
    const newPassword = String(req.body?.newPassword || '');

    if (!currentPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Mật khẩu mới phải có ít nhất 6 ký tự' });
    }

    const user = await User.findOne({ id: req.user.id });
    if (!user) return res.status(404).json({ error: 'Không tìm thấy tài khoản' });

    const matches = await comparePassword(currentPassword, user.passwordHash);
    if (!matches) {
      return res.status(400).json({ error: 'Mật khẩu hiện tại không đúng' });
    }

    user.passwordHash = await hashPassword(newPassword);
    user.refreshTokens = [];
    await user.save();

    await recordAudit(req, {
      action: 'AUTH_CHANGE_PASSWORD',
      entity: 'User',
      entityId: user.id,
      summary: `${user.email} đã đổi mật khẩu`
    });

    return res.json({ success: true, message: 'Đổi mật khẩu thành công. Vui lòng đăng nhập lại.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

module.exports = {
  login,
  refresh,
  logout,
  me,
  changePassword
};
