import { PrismaClient, NoticeAudience, NoticeStatus, FeeStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const school = await prisma.school.findFirst();
  if (!school) {
    console.error('No school found!');
    return;
  }
  const schoolId = school.id;
  console.log(`Using school: ${school.name} (${schoolId})`);

  // ==========================================
  // 1. SEED NOTICES / ANNOUNCEMENTS
  // ==========================================
  console.log('Seeding Notices...');
  await prisma.notice.deleteMany({ where: { schoolId } });

  const now = new Date();
  const daysAgo = (d: number) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000);

  const noticesData = [
    {
      title: 'Diwali Break & Festive Holidays 2026',
      content:
        'The school will remain closed from October 28, 2026 to November 03, 2026 on account of Dhanteras, Diwali, Govardhan Puja, and Bhai Dooj. Regular classes will resume on Wednesday, November 04, 2026. Holiday homework and project guidelines have been uploaded to student portals. Wishing all students, parents, and staff members a joyous and safe festive season!',
      audience: NoticeAudience.ALL,
      status: NoticeStatus.PUBLISHED,
      publishDate: daysAgo(1),
    },
    {
      title: 'Mid-Term Examination 2026-27 Schedule & Instructions',
      content:
        'Mid-Term Examinations for Classes 9 to 12 are scheduled to commence from November 10, 2026. Students must carry their official School ID cards and reporting time is 08:30 AM sharp. No electronic gadgets or calculators will be permitted in the examination halls. Datesheets and syllabus breakdowns have been distributed by respective class teachers.',
      audience: NoticeAudience.STUDENTS,
      status: NoticeStatus.PUBLISHED,
      publishDate: daysAgo(3),
    },
    {
      title: "Annual Sports Day 'SPARDHA 2026' - Registrations Open",
      content:
        "Registrations are now officially open for the 18th Annual Inter-House Athletics Meet 'SPARDHA 2026' to be held on November 20-21. Events include 100m/200m Sprint, 4x100m Relay, Long Jump, Shot Put, Tug of War, and Badminton. Interested students can contact Coach Dinesh Pareek (HOD Physical Education) or their House Captains before October 25, 2026.",
      audience: NoticeAudience.ALL,
      status: NoticeStatus.PUBLISHED,
      publishDate: daysAgo(5),
    },
    {
      title: 'Mandatory Parent-Teacher Meeting (PTM) - Quarter 2',
      content:
        'Quarter 2 Parent-Teacher Interaction will take place on Saturday, October 24, 2026, from 09:00 AM to 01:00 PM. Parents will have dedicated one-on-one sessions with Class Teachers and Subject Educators to review Unit Test performance, attendance, and co-curricular milestones. We request both parents to attend in their allotted time slots.',
      audience: NoticeAudience.PARENTS,
      status: NoticeStatus.PUBLISHED,
      publishDate: daysAgo(6),
    },
    {
      title: 'Transition to Mandatory Winter School Uniform',
      content:
        'Notice to all parents and students: All students must switch to the prescribed winter school uniform starting November 01, 2026. This includes navy blue blazers with school crest, grey woollen trousers/skirts, navy blue pullovers, and school ties. The official school uniform shop is open on campus on all weekdays from 09:00 AM to 03:00 PM.',
      audience: NoticeAudience.ALL,
      status: NoticeStatus.PUBLISHED,
      publishDate: daysAgo(8),
    },
    {
      title: 'Faculty Workshop: NEP 2020 Pedagogical Framework',
      content:
        'A specialized professional development session on Competency-Based Learning and Continuous Assessment under the NEP 2020 guidelines will be conducted on Saturday, October 18, 2026, in the Central Auditorium. Attendance is mandatory for all primary and secondary teaching faculty.',
      audience: NoticeAudience.TEACHERS,
      status: NoticeStatus.PUBLISHED,
      publishDate: daysAgo(2),
    },
  ];

  for (const n of noticesData) {
    await prisma.notice.create({
      data: {
        ...n,
        schoolId,
      },
    });
  }
  console.log(`Seeded ${noticesData.length} notices.`);

  // ==========================================
  // 2. SEED FEES DATA
  // ==========================================
  console.log('Seeding Student Fees...');
  await prisma.fee.deleteMany({
    where: { student: { schoolId } },
  });

  const students = await prisma.student.findMany({
    where: { schoolId },
    include: {
      class: true,
      user: true,
    },
    orderBy: { rollNumber: 'asc' },
  });

  console.log(`Found ${students.length} students to seed fees for.`);

  // Helper for monthly distribution
  // 6 months: May 2026 (5 months ago), Jun (4), Jul (3), Aug (2), Sep (1), Oct (0)
  const getMonthDate = (monthsAgo: number, day = 10) => {
    const d = new Date();
    d.setMonth(d.getMonth() - monthsAgo);
    d.setDate(day);
    d.setHours(11, 30, 0, 0);
    return d;
  };

  const today = new Date();
  today.setHours(10, 15, 0, 0);

  let feeCount = 0;

  for (let i = 0; i < students.length; i++) {
    const student = students[i];
    const className = student.class?.name || 'Class 10';

    // Set base fee amount based on class grade
    let baseAmount = 24500;
    if (className.includes('11') || className.includes('12')) {
      baseAmount = 36000;
    } else if (className.includes('9') || className.includes('10')) {
      baseAmount = 28500;
    }

    // 1. Quarter 1 Fee (Paid historically across May - July 2026)
    const q1Month = (i % 3) + 3; // 3 to 5 months ago (May, June, July)
    const q1PaidDate = getMonthDate(q1Month, 5 + (i % 20));
    await prisma.fee.create({
      data: {
        studentId: student.id,
        amount: baseAmount,
        status: FeeStatus.PAID,
        dueDate: q1PaidDate,
        createdAt: q1PaidDate,
        updatedAt: q1PaidDate,
      },
    });
    feeCount++;

    // 2. Quarter 2 Fee (Distributed across August, September, October, and some Pending/Overdue)
    if (i < 3) {
      // 3 students paid TODAY! (Gives immediate Today's Intake)
      await prisma.fee.create({
        data: {
          studentId: student.id,
          amount: baseAmount,
          status: FeeStatus.PAID,
          dueDate: new Date(today.getTime() + 15 * 24 * 60 * 60 * 1000),
          createdAt: getMonthDate(1, 15),
          updatedAt: today,
        },
      });
      feeCount++;
    } else if (i < 12) {
      // 9 students paid in September / October
      const q2PaidDate = i < 7 ? getMonthDate(0, 4 + i) : getMonthDate(1, 8 + i);
      await prisma.fee.create({
        data: {
          studentId: student.id,
          amount: baseAmount,
          status: FeeStatus.PAID,
          dueDate: q2PaidDate,
          createdAt: getMonthDate(1, 1),
          updatedAt: q2PaidDate,
        },
      });
      feeCount++;
    } else if (i < 19) {
      // 7 students paid in August
      const q2PaidDate = getMonthDate(2, 6 + (i % 15));
      await prisma.fee.create({
        data: {
          studentId: student.id,
          amount: baseAmount,
          status: FeeStatus.PAID,
          dueDate: q2PaidDate,
          createdAt: getMonthDate(2, 1),
          updatedAt: q2PaidDate,
        },
      });
      feeCount++;
    } else if (i < 23) {
      // 4 students with PENDING fees (Due in future: Nov 15, 2026)
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 25);
      await prisma.fee.create({
        data: {
          studentId: student.id,
          amount: baseAmount,
          status: FeeStatus.PENDING,
          dueDate,
          createdAt: getMonthDate(0, 1),
          updatedAt: getMonthDate(0, 1),
        },
      });
      feeCount++;
    } else {
      // 4 students with OVERDUE fees (Due date in past: September 15, 2026)
      const overdueDate = getMonthDate(1, 15);
      await prisma.fee.create({
        data: {
          studentId: student.id,
          amount: baseAmount,
          status: FeeStatus.OVERDUE,
          dueDate: overdueDate,
          createdAt: getMonthDate(2, 1),
          updatedAt: overdueDate,
        },
      });
      feeCount++;
    }
  }

  console.log(`Seeded ${feeCount} fee records across ${students.length} students.`);

  // ==========================================
  // 3. ENSURE VEHICLES ARE UP TO DATE
  // ==========================================
  const existingVehicles = await prisma.vehicle.findMany({ where: { schoolId } });
  console.log(`Current vehicles in school: ${existingVehicles.length}`);
  if (existingVehicles.length === 0) {
    const fleet = [
      { number: 'RJ-14-PA-2024', driver: 'Mahesh Kumar', model: 'Tata Starbus Ultra 40S', phone: '+91 98290 11223', capacity: 42 },
      { number: 'RJ-14-PB-4089', driver: 'Ramcharan Gurjar', model: 'Ashok Leyland Sunshine', phone: '+91 98291 33445', capacity: 54 },
      { number: 'RJ-14-PC-7712', driver: 'Sukhdev Singh', model: 'Eicher Starline 32S', phone: '+91 98292 55667', capacity: 36 },
      { number: 'RJ-14-PD-9901', driver: 'Dharmendra Yadav', model: 'Force Traveller Monobus', phone: '+91 98293 77889', capacity: 26 },
      { number: 'RJ-14-PE-3345', driver: 'Kailash Meena', model: 'Tata CityRide 50S', phone: '+91 98294 99001', capacity: 52 },
    ];
    for (const v of fleet) {
      await prisma.vehicle.create({ data: { ...v, schoolId } });
    }
    console.log(`Seeded ${fleet.length} vehicles.`);
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
