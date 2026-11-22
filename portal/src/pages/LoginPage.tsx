import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../api/client';

const DEMO_ACCOUNTS = [
  { label: 'Admin (Toàn quyền)', email: 'admin@viendong.vn', pass: 'Admin@123' },
  { label: 'Quản lý (Manager)', email: 'manager@viendong.vn', pass: 'Manager@123' },
  { label: 'Kinh doanh (Sales)', email: 'sales@viendong.vn', pass: 'Sales@123' },
  { label: 'Thủ kho (Warehouse)', email: 'warehouse@viendong.vn', pass: 'Warehouse@123' },
  { label: 'Kế toán (Accountant)', email: 'accountant@viendong.vn', pass: 'Accountant@123' }
];

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('admin@viendong.vn');
  const [password, setPassword] = useState('Admin@123');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không thể kết nối máy chủ Backend (cổng 5000)');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
          <div className="brand-mark" style={{ width: 46, height: 46, fontSize: 19 }}>
            VĐ
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 21, fontWeight: 800 }}>Viễn Đông Sales Portal</h1>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Đăng nhập hệ thống quản trị doanh nghiệp
            </div>
          </div>
        </div>

        {error && (
          <div className="alert-banner alert-red" style={{ marginBottom: 16, fontSize: 13.5 }}>
            <span>⚠️ {error}</span>
          </div>
        )}

        <form onSubmit={e => void handleSubmit(e)}>
          <div className="form-group">
            <label className="field-label" htmlFor="login-email">
              Email tài khoản
            </label>
            <div style={{ position: 'relative' }}>
              <Mail
                size={16}
                style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-muted)' }}
              />
              <input
                id="login-email"
                type="email"
                className="input"
                style={{ paddingLeft: 36 }}
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="field-label" htmlFor="login-password">
              Mật khẩu
            </label>
            <div style={{ position: 'relative' }}>
              <Lock
                size={16}
                style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-muted)' }}
              />
              <input
                id="login-password"
                type="password"
                className="input"
                style={{ paddingLeft: 36 }}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', padding: '11px 16px', fontSize: 15, marginTop: 4 }}
            disabled={submitting}
          >
            {submitting ? 'Đang đăng nhập...' : 'Đăng nhập Portal'}
          </button>
        </form>

        <div style={{ marginTop: 22, paddingTop: 18, borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-muted)' }}>
            Chọn nhanh tài khoản thử nghiệm RBAC:
          </div>
          <div className="quick-role-grid">
            {DEMO_ACCOUNTS.map(acc => (
              <button
                key={acc.email}
                type="button"
                className="btn btn-outline btn-sm"
                style={{ justifyContent: 'flex-start', fontWeight: 600 }}
                onClick={() => {
                  setEmail(acc.email);
                  setPassword(acc.pass);
                  setError('');
                }}
              >
                {acc.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
