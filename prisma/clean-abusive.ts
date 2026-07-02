import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const abusiveKeywords = [
  'm hota toh maa bhi chod deta',
  'chodu',
  'fuck',
  'shit',
  'bitch',
  'asshole',
  'bastard',
  'test message',
  'dummy'
];

async function main() {
  console.log('Cleaning abusive and test data from the database...');

  // Build the OR condition for keywords
  const containsConditions = abusiveKeywords.map(keyword => ({
    contains: keyword,
    mode: 'insensitive' as const
  }));

  // Clean Announcements
  const deletedAnnouncements = await prisma.announcement.deleteMany({
    where: {
      OR: [
        { content: { in: abusiveKeywords } },
        ...abusiveKeywords.map(kw => ({ content: { contains: kw, mode: 'insensitive' as const } })),
        ...abusiveKeywords.map(kw => ({ title: { contains: kw, mode: 'insensitive' as const } }))
      ]
    }
  });

  console.log(`Deleted ${deletedAnnouncements.count} abusive announcements.`);

  // Clean Notifications
  const deletedNotifications = await prisma.notification.deleteMany({
    where: {
      OR: [
        ...abusiveKeywords.map(kw => ({ message: { contains: kw, mode: 'insensitive' as const } })),
        ...abusiveKeywords.map(kw => ({ title: { contains: kw, mode: 'insensitive' as const } }))
      ]
    }
  });

  console.log(`Deleted ${deletedNotifications.count} abusive notifications.`);

  // Notice Table
  const deletedNotices = await prisma.notice.deleteMany({
    where: {
      OR: [
        ...abusiveKeywords.map(kw => ({ content: { contains: kw, mode: 'insensitive' as const } })),
        ...abusiveKeywords.map(kw => ({ title: { contains: kw, mode: 'insensitive' as const } }))
      ]
    }
  });
  console.log(`Deleted ${deletedNotices.count} abusive notices.`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
