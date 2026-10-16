import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const schoolId = 'a457cc2d-27a7-4303-8ae1-262f879635fa';

  const staffUsers = await prisma.user.findMany({
    where: {
      schoolId,
      role: { in: ['TEACHER', 'SCHOOL_ADMIN'] },
    },
    include: {
      teacher: true,
    },
  });

  console.log(`Found ${staffUsers.length} staff users for school ${schoolId}`);

  // Clear existing staff payments to avoid duplicates on re-run
  await prisma.staffPayment.deleteMany({
    where: { schoolId },
  });

  const salaryProfiles: Record<string, { basic: number; allowances: number; deductions: number; designation: string }> = {
    'principal@vidyamandir.edu.in': { basic: 75000, allowances: 10000, deductions: 5000, designation: 'Principal' },
    'admin@vidyamandir.edu.in': { basic: 55000, allowances: 6000, deductions: 3000, designation: 'Admin Head' },
    'rajesh.sharma@vidyamandir.edu.in': { basic: 48000, allowances: 5000, deductions: 2500, designation: 'Senior Math Teacher' },
    'sunita.verma@vidyamandir.edu.in': { basic: 42000, allowances: 4000, deductions: 2000, designation: 'English Teacher' },
    'amit.choudhary@vidyamandir.edu.in': { basic: 40000, allowances: 4000, deductions: 2000, designation: 'Science Teacher' },
    'pooja.mishra@vidyamandir.edu.in': { basic: 38000, allowances: 3500, deductions: 1800, designation: 'Commerce Teacher' },
    'dinesh.pareek@vidyamandir.edu.in': { basic: 35000, allowances: 3000, deductions: 1500, designation: 'Sports & PE Teacher' },
    'kavita.joshi@vidyamandir.edu.in': { basic: 36000, allowances: 3000, deductions: 1500, designation: 'Languages Teacher' },
  };

  const currentMonth = 'October 2026';
  const prevMonth = 'September 2026';

  for (const user of staffUsers) {
    const profile = salaryProfiles[user.email] || {
      basic: 35000,
      allowances: 3000,
      deductions: 1500,
      designation: user.role === 'TEACHER' ? 'Teacher' : 'Staff',
    };

    const netSalary = profile.basic + profile.allowances - profile.deductions;

    // Previous month (September) - all paid
    await prisma.staffPayment.create({
      data: {
        schoolId,
        staffId: user.id,
        basicSalary: profile.basic,
        allowances: profile.allowances,
        deductions: profile.deductions,
        netSalary,
        month: prevMonth,
        paymentDate: new Date('2026-09-30T10:30:00Z'),
        status: 'PAID',
        paymentMethod: user.email.includes('sunita') || user.email.includes('kavita') ? 'UPI' : (user.email.includes('dinesh') ? 'Cash' : 'Bank Transfer'),
        transactionId: `TXN-SEP-${Math.floor(100000 + Math.random() * 900000)}`,
        remarks: `Salary credited for ${prevMonth} (${profile.designation})`,
      },
    });

    // Current month (October) - some paid, some pending
    const isPending = user.email.includes('pooja') || user.email.includes('kavita');
    await prisma.staffPayment.create({
      data: {
        schoolId,
        staffId: user.id,
        basicSalary: profile.basic,
        allowances: profile.allowances,
        deductions: profile.deductions,
        netSalary,
        month: currentMonth,
        paymentDate: isPending ? null : new Date('2026-10-10T11:00:00Z'),
        status: isPending ? 'PENDING' : 'PAID',
        paymentMethod: isPending ? 'Bank Transfer' : (user.email.includes('sunita') ? 'UPI' : (user.email.includes('dinesh') ? 'Cash' : 'Bank Transfer')),
        transactionId: isPending ? null : `TXN-OCT-${Math.floor(100000 + Math.random() * 900000)}`,
        remarks: isPending ? 'Payment queued for approval' : `Salary credited for ${currentMonth} (${profile.designation})`,
      },
    });
  }

  const count = await prisma.staffPayment.count({ where: { schoolId } });
  console.log(`Successfully seeded ${count} staff payment records!`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
