import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.user.findFirst({
    where: { email: 'admin@vidyamandir.edu.in' },
    include: { school: true },
  });

  console.log('School Admin:', admin?.firstName, admin?.lastName, 'School:', admin?.school?.name, 'SchoolId:', admin?.schoolId);

  if (!admin?.schoolId) {
    console.log('No schoolId on admin!');
    return;
  }

  const schoolId = admin.schoolId;

  const students = await prisma.student.findMany({
    where: { schoolId },
    include: { user: true, class: true, section: true },
  });
  console.log(`Total students for school: ${students.length}`);

  const attendances = await prisma.attendance.findMany({
    where: { student: { schoolId } },
    take: 10,
  });
  console.log(`Total attendance records for school: ${attendances.length}`);

  const vehicles = await prisma.vehicle.findMany({
    where: { schoolId },
  });
  console.log(`Total vehicles for school: ${vehicles.length}`);

  const audits = await prisma.auditLog.findMany({
    where: { user: { schoolId } },
    take: 10,
  });
  console.log(`Total audits for school users: ${audits.length}`);

  const allAudits = await prisma.auditLog.findMany({ take: 5 });
  console.log(`Total all audits in DB: ${allAudits.length}`);
}

main().finally(() => prisma.$disconnect());
