const { MongoClient } = require('mongodb');

const client = new MongoClient(process.env.MONGO_URI, {
  maxPoolSize: 10,
  minPoolSize: 1,
  serverSelectionTimeoutMS: 5000,
  connectTimeoutMS: 10000,
  socketTimeoutMS: 45000,
});
let db = null;

async function connectDB() {
  await client.connect();
  db = client.db('tailor-app');
  // Background index creation — don't block startup
  Promise.all([
    // Orders
    db.collection('orders').createIndex({ shopId: 1, createdAt: -1 }),
    db.collection('orders').createIndex({ shopId: 1, status: 1 }),
    // Assignments
    db.collection('assignments').createIndex({ shopId: 1, orderId: 1 }),
    db.collection('assignments').createIndex({ shopId: 1, kaligadhId: 1 }),
    // Salary
    db.collection('salaryRecords').createIndex({ shopId: 1, kaligadhId: 1, month: 1 }),
    db.collection('salaryPayments').createIndex({ shopId: 1, kaligadhId: 1 }),
    // Other data collections
    db.collection('kaligadhs').createIndex({ shopId: 1 }),
    db.collection('dealers').createIndex({ shopId: 1 }),
    db.collection('expenses').createIndex({ shopId: 1, date: -1 }),
    db.collection('activity').createIndex({ shopId: 1, date: -1 }),
    // Notifications
    db.collection('notifications').createIndex({ userId: 1, read: 1, createdAt: -1 }),
    db.collection('notifications').createIndex({ dedupKey: 1 }, { unique: true, sparse: true }),
    // Users & shops
    db.collection('users').createIndex({ email: 1 }, { unique: true }),
    db.collection('users').createIndex({ shopId: 1 }),
    // Scan queue
    db.collection('scanQueue').createIndex({ userId: 1, status: 1, createdAt: -1 }),
    db.collection('scanQueue').createIndex({ createdAt: -1 }),
  ]).catch(() => {});
  console.log('MongoDB connected');
  return db;
}

function getDB() {
  if (!db) throw new Error('Database not connected');
  return db;
}

module.exports = { connectDB, getDB };
