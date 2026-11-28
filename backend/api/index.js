require('dotenv').config();
const mongoose = require('mongoose');
const { createApp } = require('../app');
const { seedDatabase } = require('../seedData');

const app = createApp();

// Cache promise kết nối để tái sử dụng giữa các lần gọi Serverless Function
let cachedConnection = null;

async function connectToDatabase() {
  if (mongoose.connection.readyState === 1) {
    return;
  }

  if (!cachedConnection) {
    const MONGODB_URI = process.env.MONGODB_URI;
    if (!MONGODB_URI) {
      throw new Error('Thiếu biến môi trường MONGODB_URI');
    }

    cachedConnection = mongoose
      .connect(MONGODB_URI, { dbName: 'viendong' })
      .then(async (conn) => {
        console.log(`🚀 Connected to MongoDB Atlas (${mongoose.connection.name})`);
        await seedDatabase();
        return conn;
      })
      .catch((err) => {
        cachedConnection = null; // Reset nếu lỗi để lần sau thử kết nối lại
        throw err;
      });
  }

  await cachedConnection;
}

module.exports = async (req, res) => {
  try {
    await connectToDatabase();
    return app(req, res);
  } catch (err) {
    console.error('❌ Serverless DB Error:', err.message);
    return res.status(500).json({ error: 'Lỗi kết nối cơ sở dữ liệu' });
  }
};