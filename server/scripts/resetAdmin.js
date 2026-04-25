require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');

async function run() {
  const client = new MongoClient(process.env.MONGO_URI);
  await client.connect();
  const db = client.db();

  const email = (process.env.ADMIN_EMAIL || '').toLowerCase();
  const pass  =  process.env.ADMIN_PASS  || '';
  if (!email || !pass) { console.error('ADMIN_EMAIL or ADMIN_PASS missing in .env'); process.exit(1); }

  const hash = await bcrypt.hash(pass, 12);
  const result = await db.collection('admins').replaceOne(
    {},
    { email, passwordHash: hash, createdAt: new Date() },
    { upsert: true },
  );

  console.log(`Admin upserted: ${email} (matched: ${result.matchedCount}, upserted: ${result.upsertedCount})`);
  await client.close();
}

run().catch(e => { console.error(e); process.exit(1); });
