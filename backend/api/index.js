require('dotenv').config();
const app = require('../app');
const { connectToDatabase } = require('../services/db');

module.exports = async (req, res) => {
  try {
    if (req.url !== '/favicon.ico' && req.url !== '/favicon.png') {
      await connectToDatabase();
    }
    return app(req, res);
  } catch (err) {
    console.error('❌ Serverless DB Error:', err.message);
    return res.status(500).json({ error: 'Lỗi kết nối cơ sở dữ liệu' });
  }
};
