import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Checking student profile...');
    const studentUser = await prisma.user.findUnique({
        where: { email: 'student@school.com' },
        include: { student: true },
    });

    if (!studentUser) {
        console.error('❌ User "student@school.com" not found!');
    } else {
        console.log('✅ User found:', studentUser.id, studentUser.firstName);
        if (studentUser.student) {
            console.log('✅ Student profile found:', studentUser.student.id);
        } else {
            console.error('❌ Student profile NOT found for this user!');
        }
    }
}

main()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect());
