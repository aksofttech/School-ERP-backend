import { PrismaClient, AttendanceStatus, Role } from '@prisma/client';

const prisma = new PrismaClient();

async function populateRealData() {
  console.log('🚀 Populating real data for School ERP dashboard...');

  const school = await prisma.school.findFirst();
  if (!school) {
    console.error('❌ No school found in database!');
    return;
  }
  console.log(`🏫 School: ${school.name} (${school.id})`);

  // Find users for audit logs
  const adminUser = await prisma.user.findFirst({
    where: { schoolId: school.id, role: Role.SCHOOL_ADMIN },
  });
  const teachers = await prisma.user.findMany({
    where: { schoolId: school.id, role: Role.TEACHER },
  });

  const principal = (await prisma.user.findFirst({
    where: {
      schoolId: school.id,
      email: { contains: 'principal' },
    },
  })) || adminUser;

  const teacher1 = teachers[0] || adminUser;
  const teacher2 = teachers[1] || adminUser;

  // 1. POPULATE VEHICLES
  console.log('🚌 Populating Transport Vehicles...');
  await prisma.vehicle.deleteMany({ where: { schoolId: school.id } });

  const vehiclesData = [
    {
      number: 'RJ-14-PA-2024',
      driver: 'Ramesh Chand Sharma',
      phone: '+91 98291 12345',
      model: 'Tata Starbus Ultra (40 Seater)',
      capacity: 40,
      schoolId: school.id,
    },
    {
      number: 'RJ-14-PB-4089',
      driver: 'Suresh Kumar Verma',
      phone: '+91 98292 23456',
      model: 'Eicher Skyline Pro (32 Seater)',
      capacity: 32,
      schoolId: school.id,
    },
    {
      number: 'RJ-14-PC-7712',
      driver: 'Dharmendra Singh',
      phone: '+91 98293 34567',
      model: 'Force Traveller (20 Seater)',
      capacity: 20,
      schoolId: school.id,
    },
    {
      number: 'RJ-14-PD-9901',
      driver: 'Mahesh Kumar Sharma',
      phone: '+91 98294 45678',
      model: 'Ashok Leyland Oyster (45 Seater)',
      capacity: 45,
      schoolId: school.id,
    },
    {
      number: 'RJ-14-PE-5520',
      driver: 'Vikram Rawat',
      phone: '+91 98295 56789',
      model: 'Swaraj Mazda School Bus',
      capacity: 36,
      schoolId: school.id,
    },
  ];

  for (const v of vehiclesData) {
    await prisma.vehicle.create({ data: v });
  }
  console.log(`✅ ${vehiclesData.length} Transport vehicles created.`);

  // 2. POPULATE ATTENDANCE
  console.log('📅 Populating Weekly Attendance...');
  const students = await prisma.student.findMany({
    where: { schoolId: school.id },
  });

  if (students.length > 0) {
    // Delete existing attendance
    await prisma.attendance.deleteMany({
      where: {
        student: { schoolId: school.id },
      },
    });

    // Populate last 7 days (day 0 = today, day 6 = 6 days ago)
    for (let dayOffset = 6; dayOffset >= 0; dayOffset--) {
      const attendanceDate = new Date();
      attendanceDate.setDate(attendanceDate.getDate() - dayOffset);
      attendanceDate.setHours(10, 0, 0, 0); // 10:00 AM

      const dayOfWeek = attendanceDate.getDay(); // 0 is Sunday

      // If Sunday, let's keep it holiday or minimal, or if Mon-Sat:
      if (dayOfWeek === 0) {
        // Sunday - No school / holiday (0 attendance)
        continue;
      }

      // Mark attendance for all students
      for (let sIdx = 0; sIdx < students.length; sIdx++) {
        const student = students[sIdx];
        // Most present, occasional absent on index 2 or dayOffset 3
        const isAbsent = (dayOffset + sIdx) % 7 === 3;
        const status = isAbsent ? AttendanceStatus.ABSENT : AttendanceStatus.PRESENT;

        await prisma.attendance.create({
          data: {
            studentId: student.id,
            status,
            date: attendanceDate,
          },
        });
      }
    }
    console.log(`✅ Weekly attendance created for ${students.length} students across 7 days.`);
  }

  // 3. POPULATE AUDIT LOGS (RECENT ACTIVITIES)
  console.log('📝 Populating Recent Updates / Audit Logs...');
  // Delete logs for school users
  const schoolUsers = await prisma.user.findMany({
    where: { schoolId: school.id },
    select: { id: true },
  });
  const userIds = schoolUsers.map((u) => u.id);

  if (userIds.length > 0) {
    await prisma.auditLog.deleteMany({
      where: { userId: { in: userIds } },
    });
  }

  const now = new Date();
  const makeDate = (minsAgo: number) => new Date(now.getTime() - minsAgo * 60 * 1000);

  const auditEvents = [
    {
      userId: adminUser?.id || userIds[0],
      action: 'Fee receipt #REC-8921 generated for Aarav Agarwal (Class 10th-A) - ₹12,500',
      createdAt: makeDate(15),
    },
    {
      userId: teacher1?.id || userIds[0],
      action: 'Morning attendance recorded for Class 10th-A: 100% Present',
      createdAt: makeDate(48),
    },
    {
      userId: adminUser?.id || userIds[0],
      action: 'Vehicle RJ-14-PA-2024 (Route 1) departed on morning pickup schedule',
      createdAt: makeDate(115),
    },
    {
      userId: principal?.id || adminUser?.id || userIds[0],
      action: 'Notice published: Parent-Teacher Meeting (PTM) Scheduled for Saturday',
      createdAt: makeDate(230),
    },
    {
      userId: teacher2?.id || userIds[0],
      action: 'Attendance recorded for Class 7th-A: 100% Present',
      createdAt: makeDate(320),
    },
    {
      userId: teacher1?.id || userIds[0],
      action: 'Homework assigned: Mathematics - Quadratic Equations Exercise 4.2',
      createdAt: makeDate(24 * 60 + 45), // ~Yesterday
    },
    {
      userId: adminUser?.id || userIds[0],
      action: 'New student Yash Soni (Roll: VM-105) enrolled and section 10th-A assigned',
      createdAt: makeDate(26 * 60), // ~Yesterday
    },
    {
      userId: principal?.id || adminUser?.id || userIds[0],
      action: 'Quarterly academic syllabus review approved by Principal',
      createdAt: makeDate(30 * 60),
    },
    {
      userId: adminUser?.id || userIds[0],
      action: 'Transport fleet maintenance & fitness inspection completed for 5 buses',
      createdAt: makeDate(48 * 60 + 30), // ~2 days ago
    },
    {
      userId: principal?.id || adminUser?.id || userIds[0],
      action: 'Annual Sports Meet event schedule published to school calendar',
      createdAt: makeDate(72 * 60), // ~3 days ago
    },
  ];

  for (const ev of auditEvents) {
    if (ev.userId) {
      await prisma.auditLog.create({
        data: {
          action: ev.action,
          userId: ev.userId,
          ip: '192.168.1.10',
          createdAt: ev.createdAt,
        },
      });
    }
  }
  console.log(`✅ ${auditEvents.length} Recent Audit Log activities created.`);

  console.log('🎉 Real data population complete!');
}

populateRealData()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
