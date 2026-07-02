import { PrismaClient, Gender } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🔧 Fixing student profile...');

    const email = 'student@school.com';
    const user = await prisma.user.findUnique({
        where: { email },
        include: { student: true },
    });

    if (!user) {
        console.error(`❌ User ${email} not found! Run seed first.`);
        return;
    }

    if (user.student) {
        console.log('✅ Student profile already exists. No action needed.');
        return;
    }

    console.log('⚠️ Student profile missing. Creating now...');

    // Get necessary references (School, Class, Section)
    // We'll grab the first availale ones or seed ones if possible
    const school = await prisma.school.findFirst();
    if (!school) {
        console.error('❌ No school found! Cannot create student.');
        return;
    }

    const cls = await prisma.class.findFirst({ where: { schoolId: school.id } });
    const section = await prisma.section.findFirst({ where: { schoolId: school.id } });

    if (!cls || !section) {
        console.error('❌ Class/Section not found! Cannot create student.');
        // Try to create them if missing? accessing seed logic might be better but let's try to assume basic seed exists
        return;
    }

    // Create Student
    const newStudent = await prisma.student.create({
        data: {
            userId: user.id,
            schoolId: school.id,
            classId: cls.id,
            sectionId: section.id,
            rollNumber: 'FIX-01',
            gender: Gender.MALE,
            dob: new Date('2010-01-01'),
        },
    });

    console.log('✅ Student profile created successfully:', newStudent.id);
}

main()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect());
