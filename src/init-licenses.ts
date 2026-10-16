import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Initializing licenses table in Neon DB...');

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "licenses" (
      "id" TEXT PRIMARY KEY,
      "name" TEXT NOT NULL,
      "key" TEXT NOT NULL,
      "plan" TEXT NOT NULL,
      "seats" INTEGER NOT NULL DEFAULT 0,
      "totalSeats" INTEGER NOT NULL DEFAULT 100,
      "status" TEXT NOT NULL DEFAULT 'Active',
      "expiry" TEXT NOT NULL,
      "autoRenew" BOOLEAN NOT NULL DEFAULT true,
      "icon" TEXT NOT NULL DEFAULT 'MS',
      "color" TEXT NOT NULL DEFAULT 'indigo',
      "cost" TEXT NOT NULL DEFAULT '₹3,000',
      "vendor" TEXT,
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  console.log('✅ "licenses" table created or verified.');

  const existing: any[] = await prisma.$queryRawUnsafe(`SELECT count(*) as count FROM "licenses"`);
  const count = Number(existing[0]?.count || 0);

  if (count === 0) {
    console.log('🌱 Seeding initial realistic enterprise licenses into Neon DB...');
    const seedLicenses = [
      {
        id: 'lic_msft_01',
        name: 'Microsoft 365 Education A3',
        key: 'MSFT-EDU-8924-A83B',
        plan: 'Enterprise',
        seats: 450,
        totalSeats: 500,
        status: 'Active',
        expiry: 'Nov 24, 2026',
        autoRenew: true,
        icon: 'MS',
        color: 'indigo',
        cost: '₹5,400',
        vendor: 'Microsoft Corporation',
      },
      {
        id: 'lic_zoom_02',
        name: 'Zoom Education Campus',
        key: 'ZOOM-EDU-9912-9B2F',
        plan: 'Subscription Pro',
        seats: 20,
        totalSeats: 20,
        status: 'Expiring Soon',
        expiry: 'In 3 Days',
        autoRenew: false,
        icon: 'ZM',
        color: 'blue',
        cost: '₹2,800',
        vendor: 'Zoom Video Communications',
      },
      {
        id: 'lic_ggl_03',
        name: 'Google Workspace Education Plus',
        key: 'GGL-WS-4410-C44D',
        plan: 'Enterprise',
        seats: 780,
        totalSeats: 1000,
        status: 'Active',
        expiry: 'Aug 15, 2027',
        autoRenew: true,
        icon: 'GW',
        color: 'emerald',
        cost: '₹6,200',
        vendor: 'Google LLC',
      },
      {
        id: 'lic_adbe_04',
        name: 'Adobe Creative Cloud Campus',
        key: 'ADBE-CC-7719-F890',
        plan: 'Enterprise All Apps',
        seats: 45,
        totalSeats: 50,
        status: 'Active',
        expiry: 'Dec 10, 2026',
        autoRenew: true,
        icon: 'AD',
        color: 'rose',
        cost: '₹3,500',
        vendor: 'Adobe Systems',
      },
      {
        id: 'lic_slck_05',
        name: 'Slack Pro Enterprise Grid',
        key: 'SLCK-PR-3312-E123',
        plan: 'Subscription Business+',
        seats: 120,
        totalSeats: 200,
        status: 'Active',
        expiry: 'Feb 28, 2027',
        autoRenew: true,
        icon: 'SL',
        color: 'purple',
        cost: '₹1,900',
        vendor: 'Salesforce / Slack',
      },
      {
        id: 'lic_libr_06',
        name: 'Digital Library & Research Module',
        key: 'LIBR-MOD-1092-K991',
        plan: 'Lifetime Basic',
        seats: 1,
        totalSeats: 1,
        status: 'Expired',
        expiry: 'Jan 15, 2026',
        autoRenew: false,
        icon: 'LB',
        color: 'amber',
        cost: '₹800',
        vendor: 'Vikas Academic Solutions',
      },
    ];

    for (const lic of seedLicenses) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "licenses" ("id", "name", "key", "plan", "seats", "totalSeats", "status", "expiry", "autoRenew", "icon", "color", "cost", "vendor")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         ON CONFLICT ("id") DO NOTHING`,
        lic.id,
        lic.name,
        lic.key,
        lic.plan,
        lic.seats,
        lic.totalSeats,
        lic.status,
        lic.expiry,
        lic.autoRenew,
        lic.icon,
        lic.color,
        lic.cost,
        lic.vendor,
      );
    }
    console.log(`✅ Seeded ${seedLicenses.length} enterprise licenses into Neon DB.`);
  } else {
    console.log(`ℹ️ "licenses" table already has ${count} records.`);
  }
}

main()
  .catch((e) => {
    console.error('❌ License init error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
