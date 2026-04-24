const { MongoClient } = require('mongodb');

const client = new MongoClient(process.env.MONGO_URI);
let db = null;

async function connectDB() {
  await client.connect();
  db = client.db('tailor-app');
  // Background index creation — don't block startup
  Promise.all([
    db.collection('orders').createIndex({ status: 1, createdAt: -1 }),
    db.collection('orders').createIndex({ createdAt: -1 }),
    db.collection('activity').createIndex({ date: -1 }),
    db.collection('assignments').createIndex({ orderId: 1 }),
    db.collection('assignments').createIndex({ kaligadhId: 1 }),
    db.collection('salaryRecords').createIndex({ kaligadhId: 1, month: 1 }),
  ]).catch(() => {});
  console.log('MongoDB connected');
  return db;
}

function getDB() {
  if (!db) throw new Error('Database not connected');
  return db;
}

module.exports = { connectDB, getDB };
