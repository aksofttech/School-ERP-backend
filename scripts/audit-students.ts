import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🔍 Auditing ALL Student Users...');

    const students = await prisma.user.findMany({
        where: { role: 'STUDENT' },
        include: { student: true },
    });

    console.log(`Found ${students.length} users with role STUDENT.`);

    let brokenCount = 0;

    for (const user of students) {
        if (!user.student) {
            console.error(`❌ BROKEN USER: ${user.email} (ID: ${user.id}) - No Student Profile!`);
            brokenCount++;
        } else {
            console.log(`✅ OK: ${user.email} (Student ID: ${user.student.id})`);
        }
    }

    if (brokenCount > 0) {
        console.log(`\n⚠️ Found ${brokenCount} broken student users! These users will crash the dashboard.`);
    } else {
        console.log('\n✅ All student users have valid profiles.');
    }
}

main()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect());
