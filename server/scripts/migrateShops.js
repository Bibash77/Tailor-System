/**
 * Migration: create shops collection, link existing users, normalise scanQuota.
 * Run once: node server/scripts/migrateShops.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { MongoClient } = require('mongodb');
const crypto = require('crypto');

async function run() {
  const client = new MongoClient(process.env.MONGO_URI);
  await client.connect();
  const db = client.db('tailor-app');

  const users = await db.collection('users').find({}).toArray();
  console.log(`Found ${users.length} users`);

  for (const u of users) {
    let shopId = u.shopId;

    if (!shopId) {
      // Create a shop for this user
      shopId = crypto.randomUUID();
      await db.collection('shops').insertOne({
        _id:       shopId,
        name:      u.shopName || u.email,
        createdAt: u.createdAt || new Date(),
      });
      console.log(`Created shop "${u.shopName}" for ${u.email}`);
    }

    // Normalise scanQuota → new model
    const q = u.scanQuota || {};
    const newQuota = {
      freeScanLimit:  q.freeScanLimit  ?? q.monthlyLimit ?? 20,
      used:           q.used           ?? 0,
      paidPlanLimit:  q.paidPlanLimit  ?? 0,
      monthlyCharge:  q.monthlyCharge  ?? q.price ?? 500,
      billingStatus:  q.billingStatus  ?? 'active',
      renewDate:      q.renewDate      ?? null,
      month:          q.month          ?? '',
    };

    await db.collection('users').updateOne(
      { _id: u._id },
      {
        $set: {
          shopId,
          role:      u.role   || 'shop_admin',
          status:    u.status || 'active',
          scanQuota: newQuota,
        },
      },
    );
    console.log(`Updated user ${u.email}`);
  }

  // Create indexes
  await db.collection('shops').createIndex({ name: 1 });
  await db.collection('users').createIndex({ shopId: 1 });

  console.log('Migration complete');
  await client.close();
}

run().catch(e => { console.error(e); process.exit(1); });
