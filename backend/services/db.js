const mongoose = require('mongoose');
const User = require('../models/User');
const { seedDatabase } = require('../seedData');

let cachedConnection = null;

async function connectToDatabase() {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (!cachedConnection) {
    const MONGODB_URI = process.env.MONGODB_URI;
    if (!MONGODB_URI) {
      throw new Error('Thiếu biến môi trường MONGODB_URI');
    }

    cachedConnection = mongoose
      .connect(MONGODB_URI, { dbName: 'viendong' })
      .then(async conn => {
        console.log(`🚀 Connected to MongoDB Atlas (${mongoose.connection.name})`);
        // On serverless cold starts, only seed when the database is empty (or FORCE_SEED=true)
        const userCount = await User.countDocuments();
        if (userCount === 0 || process.env.FORCE_SEED === 'true') {
          await seedDatabase();
        }
        return conn;
      })
      .catch(err => {
        cachedConnection = null;
        throw err;
      });
  }

  await cachedConnection;
  return mongoose.connection;
}

module.exports = { connectToDatabase };
