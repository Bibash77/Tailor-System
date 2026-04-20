require('dotenv').config();
const bcrypt = require('bcryptjs');
const { MongoClient } = require('mongodb');

async function seed() {
  const client = new MongoClient(process.env.MONGO_URI);
  await client.connect();
  const db = client.db('tailor-app');

  await db.collection('users').deleteMany({});
  console.log('Deleted all users.');

  const passwordHash = await bcrypt.hash('123456', 12);
  await db.collection('users').insertOne({
    email:       '1@yopmail.com',
    shopName:    'My Tailor Shop',
    passwordHash,
    createdAt:   new Date(),
    resetToken:  null,
    resetExpiry: null,
  });

  console.log('Created default account: 1@yopmail.com / 123456');
  await client.close();
}

seed().catch(err => { console.error(err); process.exit(1); });
