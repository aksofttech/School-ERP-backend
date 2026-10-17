import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExamDto } from './dto/create-exam.dto';
import { UpdateExamDto } from './dto/update-exam.dto';
import { Role } from '@prisma/client';

@Injectable()
export class ExamsService {
  constructor(private readonly prisma: PrismaService) {}

  private async getEffectiveSchoolId(currentUser: { userId: string; role: Role; schoolId?: string }): Promise<string> {
    if (currentUser.schoolId) {
      return currentUser.schoolId;
    }
    const school = await this.prisma.school.findFirst({ select: { id: true } });
    if (!school) {
      throw new BadRequestException('No school found in database');
    }
    return school.id;
  }

  /**
   * Create exam per class
   * SCHOOL_ADMIN, SUPER_ADMIN, and TEACHER can create exams
   */
  async create(
    createExamDto: CreateExamDto,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ) {
    if (
      currentUser.role !== Role.TEACHER &&
      currentUser.role !== Role.SCHOOL_ADMIN &&
      currentUser.role !== Role.SUPER_ADMIN
    ) {
      throw new ForbiddenException(
        'Only TEACHER or SCHOOL_ADMIN can create exams',
      );
    }

    const schoolId = await this.getEffectiveSchoolId(currentUser);

    // If teacher, verify teacher profile
    if (currentUser.role === Role.TEACHER) {
      const teacher = await this.prisma.teacher.findFirst({
        where: {
          userId: currentUser.userId,
        },
      });

      if (!teacher) {
        throw new NotFoundException('Teacher profile not found');
      }
    }

    const { name, type, date, classId, totalMarks, passingMarks } =
      createExamDto;

    // Verify class exists and belongs to school
    const classEntity = await this.prisma.class.findUnique({
      where: { id: classId },
    });

    if (!classEntity) {
      throw new NotFoundException(`Class with ID ${classId} not found`);
    }

    if (classEntity.schoolId !== schoolId) {
      throw new ForbiddenException(
        'Access denied. You can only create exams for classes in your school',
      );
    }

    // Create exam
    const exam = await this.prisma.exam.create({
      data: {
        name,
        type,
        date: new Date(date),
        classId,
        totalMarks,
        passingMarks,
      },
      include: {
        class: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            results: true,
          },
        },
      },
    });

    return exam;
  }

  /**
   * List exams
   * - SCHOOL_ADMIN / SUPER_ADMIN / TEACHER can view exams for classes in their school
   * - STUDENT/PARENT can view exams for their class
   */
  async findAll(
    currentUser: { userId: string; role: Role; schoolId?: string },
    classId?: string,
  ) {
    const where: any = {};

    if (
      currentUser.role === Role.SCHOOL_ADMIN ||
      currentUser.role === Role.SUPER_ADMIN ||
      currentUser.role === Role.TEACHER
    ) {
      const schoolId = await this.getEffectiveSchoolId(currentUser);

      where.class = {
        schoolId,
      };

      if (classId) {
        where.classId = classId;
      }
    } else if (currentUser.role === Role.STUDENT) {
      // STUDENT can view exams for their class
      const student = await this.prisma.student.findFirst({
        where: {
          userId: currentUser.userId,
        },
      });

      if (!student) {
        throw new NotFoundException('Student profile not found');
      }

      where.classId = student.classId;
    } else if (currentUser.role === Role.PARENT) {
      // PARENT can view exams for their linked students' classes
      const parent = await this.prisma.parent.findFirst({
        where: {
          userId: currentUser.userId,
        },
        include: {
          students: true,
        },
      });

      if (!parent) {
        throw new NotFoundException('Parent profile not found');
      }

      if (parent.students.length === 0) {
        return [];
      }

      const classIds = [...new Set(parent.students.map((s) => s.classId))];
      where.classId = { in: classIds };
    } else {
      throw new ForbiddenException(
        'Unauthorized to view exams',
      );
    }

    const exams = await this.prisma.exam.findMany({
      where,
      include: {
        class: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            results: true,
          },
        },
      },
      orderBy: { date: 'desc' },
    });

    return exams;
  }

  /**
   * Get exam by ID
   */
  async findOne(
    id: string,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ) {
    const exam = await this.prisma.exam.findUnique({
      where: { id },
      include: {
        class: {
          select: {
            id: true,
            name: true,
            schoolId: true,
          },
        },
        results: {
          include: {
            student: {
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
          },
        },
        _count: {
          select: {
            results: true,
          },
        },
      },
    });

    if (!exam) {
      throw new NotFoundException(`Exam with ID ${id} not found`);
    }

    const schoolId = await this.getEffectiveSchoolId(currentUser);

    // RBAC checks
    if (
      currentUser.role === Role.SCHOOL_ADMIN ||
      currentUser.role === Role.SUPER_ADMIN ||
      currentUser.role === Role.TEACHER
    ) {
      if (exam.class.schoolId !== schoolId) {
        throw new ForbiddenException(
          'Access denied. You can only view exams for classes in your school',
        );
      }
    } else if (currentUser.role === Role.STUDENT) {
      const student = await this.prisma.student.findFirst({
        where: {
          userId: currentUser.userId,
        },
      });

      if (!student || exam.classId !== student.classId) {
        throw new ForbiddenException(
          'Access denied. You can only view exams for your class',
        );
      }
    } else if (currentUser.role === Role.PARENT) {
      const parent = await this.prisma.parent.findFirst({
        where: {
          userId: currentUser.userId,
        },
        include: {
          students: true,
        },
      });

      if (!parent) {
        throw new NotFoundException('Parent profile not found');
      }

      const studentClassIds = parent.students.map((s) => s.classId);
      if (!studentClassIds.includes(exam.classId)) {
        throw new ForbiddenException(
          "Access denied. You can only view exams for your linked students' classes",
        );
      }
    }

    return exam;
  }

  /**
   * Update exam
   */
  async update(
    id: string,
    updateExamDto: UpdateExamDto,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ) {
    if (
      currentUser.role !== Role.TEACHER &&
      currentUser.role !== Role.SCHOOL_ADMIN &&
      currentUser.role !== Role.SUPER_ADMIN
    ) {
      throw new ForbiddenException(
        'Only TEACHER or SCHOOL_ADMIN can update exams',
      );
    }

    const schoolId = await this.getEffectiveSchoolId(currentUser);

    const exam = await this.prisma.exam.findUnique({
      where: { id },
      include: {
        class: true,
      },
    });

    if (!exam) {
      throw new NotFoundException(`Exam with ID ${id} not found`);
    }

    if (exam.class.schoolId !== schoolId) {
      throw new ForbiddenException(
        'Access denied. You can only update exams for classes in your school',
      );
    }

    const updatedExam = await this.prisma.exam.update({
      where: { id },
      data: {
        ...(updateExamDto.name && { name: updateExamDto.name }),
        ...(updateExamDto.type && { type: updateExamDto.type }),
        ...(updateExamDto.date && { date: new Date(updateExamDto.date) }),
        ...(updateExamDto.totalMarks !== undefined && {
          totalMarks: updateExamDto.totalMarks,
        }),
        ...(updateExamDto.passingMarks !== undefined && {
          passingMarks: updateExamDto.passingMarks,
        }),
      },
      include: {
        class: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            results: true,
          },
        },
      },
    });

    return updatedExam;
  }

  /**
   * Delete exam
   */
  async remove(
    id: string,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ) {
    if (
      currentUser.role !== Role.TEACHER &&
      currentUser.role !== Role.SCHOOL_ADMIN &&
      currentUser.role !== Role.SUPER_ADMIN
    ) {
      throw new ForbiddenException(
        'Only TEACHER or SCHOOL_ADMIN can delete exams',
      );
    }

    const schoolId = await this.getEffectiveSchoolId(currentUser);

    const exam = await this.prisma.exam.findUnique({
      where: { id },
      include: {
        class: true,
        _count: {
          select: {
            results: true,
          },
        },
      },
    });

    if (!exam) {
      throw new NotFoundException(`Exam with ID ${id} not found`);
    }

    if (exam.class.schoolId !== schoolId) {
      throw new ForbiddenException(
        'Access denied. You can only delete exams for classes in your school',
      );
    }

    return await this.prisma.$transaction(async (tx) => {
      if (exam._count.results > 0) {
        await tx.examResult.deleteMany({
          where: { examId: id },
        });
      }

      await tx.exam.delete({
        where: { id },
      });

      return {
        message: 'Exam and all associated results deleted successfully',
      };
    });
  }
}
