import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    const totalNotices = await prisma.notice.count();
    const totalNotifications = await prisma.notification.count();
    const totalUsers = await prisma.user.count();
    const totalSchools = await prisma.school.count();

    console.log(`Total Schools: ${totalSchools}`);
    console.log(`Total Users: ${totalUsers}`);
    console.log(`Total Notices: ${totalNotices}`);
    console.log(`Total Notifications: ${totalNotifications}`);

    const schools = await prisma.school.findMany({
      select: { id: true, name: true },
    });
    console.log('Available Schools:', JSON.stringify(schools, null, 2));

    // Specifically check for the institution ID in the image: 0b2e7f3a-9221-463b-a93c-50bf782e97d9
    const targetSchoolId = '0b2e7f3a-9221-463b-a93c-50bf782e97d9';
    const schoolInImage = await prisma.school.findUnique({
      where: { id: targetSchoolId },
    });
    console.log(`School from image exists: ${!!schoolInImage}`);

    if (totalNotices > 0) {
      const notices = await prisma.notice.findMany({ take: 5 });
      console.log('Latest 5 Notices:', JSON.stringify(notices, null, 2));
    }
  } catch (error) {
    console.error('Error querying database:', error);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
