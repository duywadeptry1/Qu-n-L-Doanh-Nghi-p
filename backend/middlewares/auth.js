const User = require('../models/User');
const { ROLES, getPermissionsForRole, hasPermission } = require('../config/rbac');
const { verifyAccessToken } = require('../services/authService');

function extractBearerToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) {
    return header.slice(7).trim();
  }
  return null;
}

/**
 * Resolves req.user if an Authorization Bearer token is present.
 * - Valid token + active user -> attaches req.user
 * - Invalid/expired token or inactive user -> responds 401 immediately
 * - No token -> leaves req.user = null for downstream auth guard to decide
 */
async function resolveAuth(req, res, next) {
  const token = extractBearerToken(req);
  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const payload = verifyAccessToken(token);
    const user = await User.findOne({ id: payload.sub }).lean();
    if (!user || !user.isActive) {
      return res.status(401).json({
        code: 'ACCOUNT_DISABLED',
        error: 'Tài khoản không tồn tại hoặc đã bị vô hiệu hóa'
      });
    }

    req.user = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone || '',
      role: user.role,
      permissions: getPermissionsForRole(user.role),
      isLegacyClient: false
    };
    return next();
  } catch (_err) {
    return res.status(401).json({
      code: 'INVALID_TOKEN',
      error: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn'
    });
  }
}

/**
 * Strict authentication guard (always requires a valid JWT).
 * Used for /api/auth/me, /api/users, /api/audit-logs, /api/settings, and all /api/v1/* routes.
 */
function requireAuth(req, res, next) {
  if (!req.user || req.user.isLegacyClient) {
    return res.status(401).json({
      code: 'AUTH_REQUIRED',
      error: 'Yêu cầu đăng nhập để truy cập tài nguyên này'
    });
  }
  return next();
}

/**
 * Transition-safe guard for legacy /api/* routes:
 * - If Bearer token was sent -> strictly uses authenticated user & RBAC
 * - If request came through /api/v1/* OR REQUIRE_AUTH=true -> requires JWT (401)
 * - Otherwise (existing Android app without token during transition) -> legacy ADMIN compatibility mode
 */
function requireAuthOrLegacy(req, res, next) {
  if (req.user) {
    return next();
  }

  const strictMode = Boolean(req.strictAuth) || process.env.REQUIRE_AUTH === 'true';
  if (strictMode) {
    return res.status(401).json({
      code: 'AUTH_REQUIRED',
      error: 'Yêu cầu đăng nhập để truy cập tài nguyên này'
    });
  }

  req.user = {
    id: 'legacy-android',
    email: 'legacy-client@viendong.local',
    fullName: 'Legacy Android Client',
    phone: '',
    role: ROLES.ADMIN,
    permissions: getPermissionsForRole(ROLES.ADMIN),
    isLegacyClient: true
  };
  return next();
}

/**
 * Checks that req.user has AT LEAST ONE of the required permissions.
 */
function requirePermission(...requiredPermissions) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        code: 'AUTH_REQUIRED',
        error: 'Yêu cầu đăng nhập'
      });
    }

    const allowed = requiredPermissions.some(perm => hasPermission(req.user.role, perm));
    if (!allowed) {
      return res.status(403).json({
        code: 'FORBIDDEN',
        error: 'Bạn không có quyền thực hiện thao tác này',
        role: req.user.role,
        requiredPermissions
      });
    }
    return next();
  };
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        code: 'AUTH_REQUIRED',
        error: 'Yêu cầu đăng nhập'
      });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        code: 'FORBIDDEN',
        error: 'Vai trò của bạn không được phép truy cập chức năng này',
        role: req.user.role,
        allowedRoles
      });
    }
    return next();
  };
}

module.exports = {
  resolveAuth,
  requireAuth,
  requireAuthOrLegacy,
  requirePermission,
  requireRole
};
