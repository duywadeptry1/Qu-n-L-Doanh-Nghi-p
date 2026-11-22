const mongoose = require('mongoose');
const { ALL_ROLES, ROLES } = require('../config/rbac');

const userSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  fullName: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String, default: '', trim: true },
  passwordHash: { type: String, required: true },
  role: {
    type: String,
    enum: ALL_ROLES,
    default: ROLES.SALES
  },
  isActive: { type: Boolean, default: true },
  refreshTokens: { type: [String], default: [] },
  lastLoginAt: { type: Date, default: null }
}, { timestamps: true });

userSchema.methods.toSafeJSON = function toSafeJSON(permissions = []) {
  return {
    id: this.id,
    fullName: this.fullName,
    email: this.email,
    phone: this.phone,
    role: this.role,
    isActive: this.isActive,
    lastLoginAt: this.lastLoginAt,
    createdAt: this.createdAt,
    permissions
  };
};

module.exports = mongoose.model('User', userSchema);
