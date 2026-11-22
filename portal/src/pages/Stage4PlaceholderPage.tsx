import React from 'react';
import { Link } from 'react-router-dom';

interface Props {
  title: string;
  description: string;
}

export const Stage4PlaceholderPage: React.FC<Props> = ({ title, description }) => (
  <div className="card" style={{ maxWidth: 640, margin: '36px auto', textAlign: 'center', padding: 36 }}>
    <span className="badge badge-blue" style={{ marginBottom: 12 }}>
      Giai đoạn 4 (FE-07 → FE-09)
    </span>
    <h1 className="page-title" style={{ marginBottom: 8 }}>
      {title}
    </h1>
    <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>{description}</p>
    <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
      <Link to="/dashboard" className="btn btn-primary">
        Về Tổng quan
      </Link>
      <Link to="/orders" className="btn btn-outline">
        Quản lý Đơn hàng
      </Link>
    </div>
  </div>
);
