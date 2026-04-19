const { MongoClient } = require('mongodb');

const client = new MongoClient(process.env.MONGO_URI);
let db = null;

async function connectDB() {
  await client.connect();
  db = client.db('tailor-app');
  console.log('MongoDB connected');
  return db;
}

function getDB() {
  if (!db) throw new Error('Database not connected');
  return db;
}

module.exports = { connectDB, getDB };
