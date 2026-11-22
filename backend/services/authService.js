const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { ROLES, getPermissionsForRole } = require('../config/rbac');

const ACCESS_SECRET = process.env.JWT_SECRET || 'viendong-dev-access-secret-change-in-prod';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'viendong-dev-refresh-secret-change-in-prod';
const ACCESS_EXPIRES = process.env.JWT_ACCESS_EXPIRES || '2h';
const REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES || '7d';
const BCRYPT_ROUNDS = 10;

async function hashPassword(plainPassword) {
  return bcrypt.hash(String(plainPassword), BCRYPT_ROUNDS);
}

async function comparePassword(plainPassword, passwordHash) {
  return bcrypt.compare(String(plainPassword), passwordHash);
}

function hashToken(rawToken) {
  return crypto.createHash('sha256').update(String(rawToken)).digest('hex');
}

function signAccessToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      fullName: user.fullName,
      type: 'access'
    },
    ACCESS_SECRET,
    { expiresIn: ACCESS_EXPIRES }
  );
}

function signRefreshToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      type: 'refresh',
      jti: crypto.randomBytes(12).toString('hex')
    },
    REFRESH_SECRET,
    { expiresIn: REFRESH_EXPIRES }
  );
}

function verifyAccessToken(token) {
  const payload = jwt.verify(token, ACCESS_SECRET);
  if (payload.type !== 'access') {
    throw new Error('Invalid token type');
  }
  return payload;
}

function verifyRefreshToken(token) {
  const payload = jwt.verify(token, REFRESH_SECRET);
  if (payload.type !== 'refresh') {
    throw new Error('Invalid refresh token type');
  }
  return payload;
}

function buildUserResponse(user) {
  const permissions = getPermissionsForRole(user.role);
  return user.toSafeJSON(permissions);
}

async function getNextUserId() {
  const existing = await User.find({}, { id: 1 }).lean();
  let maxNum = existing.length;
  for (const item of existing) {
    const match = typeof item.id === 'string' ? item.id.match(/^u-(\d+)$/) : null;
    if (match) {
      const n = parseInt(match[1], 10);
      if (n > maxNum) maxNum = n;
    }
  }
  return `u-${maxNum + 1}`;
}

const DEFAULT_SEED_USERS = [
  {
    id: 'u-1',
    fullName: 'Quản trị Viễn Đông',
    email: process.env.SEED_ADMIN_EMAIL || 'admin@viendong.vn',
    phone: '0900 000 001',
    password: process.env.SEED_ADMIN_PASSWORD || 'Admin@123',
    role: ROLES.ADMIN
  },
  {
    id: 'u-2',
    fullName: 'Quản lý Kinh doanh',
    email: 'manager@viendong.vn',
    phone: '0900 000 002',
    password: 'Manager@123',
    role: ROLES.MANAGER
  },
  {
    id: 'u-3',
    fullName: 'Nhân viên Kinh doanh',
    email: 'sales@viendong.vn',
    phone: '0900 000 003',
    password: 'Sales@123',
    role: ROLES.SALES
  },
  {
    id: 'u-4',
    fullName: 'Thủ kho Viễn Đông',
    email: 'warehouse@viendong.vn',
    phone: '0900 000 004',
    password: 'Warehouse@123',
    role: ROLES.WAREHOUSE
  },
  {
    id: 'u-5',
    fullName: 'Kế toán Viễn Đông',
    email: 'accountant@viendong.vn',
    phone: '0900 000 005',
    password: 'Accountant@123',
    role: ROLES.ACCOUNTANT
  }
];

async function seedDefaultUsers() {
  const count = await User.countDocuments();
  if (count > 0) return false;

  const docs = [];
  for (const u of DEFAULT_SEED_USERS) {
    const passwordHash = await hashPassword(u.password);
    docs.push({
      id: u.id,
      fullName: u.fullName,
      email: u.email.toLowerCase(),
      phone: u.phone,
      passwordHash,
      role: u.role,
      isActive: true
    });
  }
  await User.insertMany(docs);
  console.log(`✅ Seeded ${docs.length} default RBAC portal users (admin: ${DEFAULT_SEED_USERS[0].email})`);
  return true;
}

module.exports = {
  hashPassword,
  comparePassword,
  hashToken,
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  buildUserResponse,
  getNextUserId,
  seedDefaultUsers
};
