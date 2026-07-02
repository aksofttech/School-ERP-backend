const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fix() {
  // Find the new school (the one with 25 students)
  const newSchool = await prisma.school.findUnique({
    where: { code: 'SCH-001' }
  });

  if (!newSchool) {
    console.error('Target school not found!');
    return;
  }

  // Update original admin@school.com to point to this new school
  await prisma.user.update({
    where: { email: 'admin@school.com' },
    data: { schoolId: newSchool.id }
  });

  console.log(`✅ Admin admin@school.com has been linked to ${newSchool.name}`);
  console.log('Please logout and login again in the frontend to refresh your session.');
}

fix().finally(() => prisma.$disconnect());
