// Migrate subscription + scanQuota from user docs to shop docs.
// Also links 2@yopmail.com to sarojpariyar830@gmail.com's shop.
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { MongoClient } = require('mongodb');

async function run() {
  const client = new MongoClient(process.env.MONGO_URI);
  await client.connect();
  const db = client.db('tailor-app');

  const users = await db.collection('users').find({}).toArray();
  const shops = await db.collection('shops').find({}).toArray();

  // ── 1. Move subscription + scanQuota from each user to their shop ─────────
  for (const u of users) {
    if (!u.shopId) continue;
    const shop = shops.find(s => s._id === u.shopId);
    if (!shop) continue;
    if (shop.subscription) continue; // already migrated

    const sub = u.subscription || {
      status: 'trial',
      trialEndsAt: new Date(Date.now() + 30 * 86_400_000),
      billedUntil: null,
      monthlyFee: u.scanQuota?.monthlyCharge ?? 500,
      payments: [],
    };
    const quota = {
      freeScanLimit: u.scanQuota?.freeScanLimit ?? 20,
      paidPlanLimit: u.scanQuota?.paidPlanLimit ?? 0,
      used:          u.scanQuota?.used          ?? 0,
      monthlyCharge: u.scanQuota?.monthlyCharge ?? 500,
      billingStatus: u.scanQuota?.billingStatus ?? 'active',
      renewDate:     u.scanQuota?.renewDate     ?? null,
      month:         u.scanQuota?.month         ?? '',
    };

    await db.collection('shops').updateOne(
      { _id: u.shopId },
      { $set: { subscription: sub, scanQuota: quota } },
    );
    console.log(`Migrated billing for shop "${shop.name}" (${u.email})`);
  }

  // ── 2. Link 2@yopmail.com to sarojpariyar830's shop ─────────────────────
  const saroj = await db.collection('users').findOne({ email: 'sarojpariyar830@gmail.com' });
  if (saroj) {
    const r = await db.collection('users').updateOne(
      { email: '2@yopmail.com' },
      { $set: { shopId: saroj.shopId, shopName: saroj.shopName } },
    );
    if (r.matchedCount) {
      console.log(`Linked 2@yopmail.com → shop "${saroj.shopName}" (${saroj.shopId})`);
    }
  }

  console.log('Migration complete.');
  await client.close();
}

run().catch(e => { console.error(e); process.exit(1); });
