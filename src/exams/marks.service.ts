import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMarkDto } from './dto/create-mark.dto';
import { UpdateMarkDto } from './dto/update-mark.dto';
import { BulkMarksDto } from './dto/bulk-marks.dto';
import { Role } from '@prisma/client';

@Injectable()
export class MarksService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Enter marks per student
   * Only TEACHER can enter marks
   */
  async create(
    createMarkDto: CreateMarkDto,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ) {
    if (
      currentUser.role !== Role.TEACHER &&
      currentUser.role !== Role.SCHOOL_ADMIN
    ) {
      throw new ForbiddenException(
        'Only TEACHER or SCHOOL_ADMIN can enter marks',
      );
    }

    if (!currentUser.schoolId) {
      throw new ForbiddenException('Teacher must be associated with a school');
    }

    // Verify teacher exists
    const teacher = await this.prisma.teacher.findFirst({
      where: {
        userId: currentUser.userId,
      },
    });

    if (!teacher) {
      throw new NotFoundException('Teacher profile not found');
    }

    const { examId, studentId, marks } = createMarkDto;

    // Verify exam exists and belongs to school
    const exam = await this.prisma.exam.findUnique({
      where: { id: examId },
      include: {
        class: true,
      },
    });

    if (!exam) {
      throw new NotFoundException(`Exam with ID ${examId} not found`);
    }

    if (exam.class.schoolId !== currentUser.schoolId) {
      throw new ForbiddenException(
        'Access denied. You can only enter marks for exams in your school',
      );
    }

    // Verify student exists and belongs to the exam's class
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
    });

    if (!student) {
      throw new NotFoundException(`Student with ID ${studentId} not found`);
    }

    if (student.classId !== exam.classId) {
      throw new BadRequestException(
        "Student does not belong to the exam's class",
      );
    }

    // Check if marks already exist for this student and exam
    const existingResult = await this.prisma.examResult.findFirst({
      where: {
        examId,
        studentId,
      },
    });

    if (existingResult) {
      throw new ConflictException(
        'Marks already entered for this student in this exam. Use update instead.',
      );
    }

    // Validate marks (should be non-negative)
    if (marks < 0) {
      throw new BadRequestException('Marks cannot be negative');
    }

    // Create exam result
    const examResult = await this.prisma.examResult.create({
      data: {
        examId,
        studentId,
        marks,
      },
      include: {
        exam: {
          select: {
            id: true,
            name: true,
            type: true,
            date: true,
          },
        },
        student: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
            class: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    return examResult;
  }

  /**
   * Enter marks in bulk
   * Only TEACHER can enter marks
   */
  async createBulk(
    bulkMarksDto: BulkMarksDto,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ) {
    if (
      currentUser.role !== Role.TEACHER &&
      currentUser.role !== Role.SCHOOL_ADMIN
    ) {
      throw new ForbiddenException(
        'Only TEACHER or SCHOOL_ADMIN can enter marks',
      );
    }

    if (!currentUser.schoolId) {
      throw new ForbiddenException('Teacher must be associated with a school');
    }

    // Verify teacher exists
    const teacher = await this.prisma.teacher.findFirst({
      where: {
        userId: currentUser.userId,
      },
    });

    if (!teacher) {
      throw new NotFoundException('Teacher profile not found');
    }

    const { examId, marks } = bulkMarksDto;

    // Verify exam exists and belongs to school
    const exam = await this.prisma.exam.findUnique({
      where: { id: examId },
      include: {
        class: true,
      },
    });

    if (!exam) {
      throw new NotFoundException(`Exam with ID ${examId} not found`);
    }

    if (exam.class.schoolId !== currentUser.schoolId) {
      throw new ForbiddenException(
        'Access denied. You can only enter marks for exams in your school',
      );
    }

    // Validate all students belong to the exam's class
    const studentIds = marks.map((m) => m.studentId);
    const students = await this.prisma.student.findMany({
      where: {
        id: { in: studentIds },
      },
    });

    if (students.length !== studentIds.length) {
      throw new NotFoundException('One or more students not found');
    }

    const invalidStudents = students.filter((s) => s.classId !== exam.classId);

    if (invalidStudents.length > 0) {
      throw new BadRequestException(
        "All students must belong to the exam's class",
      );
    }

    // Check for existing marks
    const existingResults = await this.prisma.examResult.findMany({
      where: {
        examId,
        studentId: { in: studentIds },
      },
    });

    if (existingResults.length > 0) {
      const existingStudentIds = existingResults.map((r) => r.studentId);
      throw new ConflictException(
        `Marks already exist for student(s): ${existingStudentIds.join(', ')}. Use update instead.`,
      );
    }

    // Validate all marks are non-negative
    const invalidMarks = marks.filter((m) => m.marks < 0);
    if (invalidMarks.length > 0) {
      throw new BadRequestException('Marks cannot be negative');
    }

    // Create all marks in transaction
    return await this.prisma.$transaction(async (tx) => {
      const results = await Promise.all(
        marks.map((mark) =>
          tx.examResult.create({
            data: {
              examId,
              studentId: mark.studentId,
              marks: mark.marks,
            },
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
          }),
        ),
      );

      return {
        message: `Marks entered for ${results.length} student(s)`,
        exam: {
          id: exam.id,
          name: exam.name,
        },
        results,
      };
    });
  }

  /**
   * List marks
   * - TEACHER can view marks for exams in their school
   * - STUDENT/PARENT can view marks (read-only)
   */
  async findAll(
    examId: string,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ) {
    // Verify exam exists
    const exam = await this.prisma.exam.findUnique({
      where: { id: examId },
      include: {
        class: true,
      },
    });

    if (!exam) {
      throw new NotFoundException(`Exam with ID ${examId} not found`);
    }

    // RBAC checks
    if (
      currentUser.role === Role.TEACHER ||
      currentUser.role === Role.SCHOOL_ADMIN
    ) {
      if (
        !currentUser.schoolId ||
        exam.class.schoolId !== currentUser.schoolId
      ) {
        throw new ForbiddenException(
          'Access denied. You can only view marks for exams in your school',
        );
      }
    } else if (currentUser.role === Role.STUDENT) {
      const student = await this.prisma.student.findFirst({
        where: {
          userId: currentUser.userId,
        },
      });

      if (!student || student.classId !== exam.classId) {
        throw new ForbiddenException(
          'Access denied. You can only view marks for exams in your class',
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
          "Access denied. You can only view marks for exams in your linked students' classes",
        );
      }
    } else {
      throw new ForbiddenException(
        'Only TEACHER, STUDENT, and PARENT can view marks',
      );
    }

    const results = await this.prisma.examResult.findMany({
      where: { examId },
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
            class: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        student: {
          rollNumber: 'asc',
        },
      },
    });

    return {
      exam: {
        id: exam.id,
        name: exam.name,
        type: exam.type,
        date: exam.date,
      },
      results,
      total: results.length,
    };
  }

  /**
   * Get mark by ID
   * Read-only for STUDENT/PARENT
   */
  async findOne(
    id: string,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ) {
    const result = await this.prisma.examResult.findUnique({
      where: { id },
      include: {
        exam: {
          include: {
            class: true,
          },
        },
        student: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
            class: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!result) {
      throw new NotFoundException(`Mark with ID ${id} not found`);
    }

    // RBAC checks (same as findAll)
    if (
      currentUser.role === Role.TEACHER ||
      currentUser.role === Role.SCHOOL_ADMIN
    ) {
      if (
        !currentUser.schoolId ||
        result.exam.class.schoolId !== currentUser.schoolId
      ) {
        throw new ForbiddenException(
          'Access denied. You can only view marks for exams in your school',
        );
      }
    } else if (currentUser.role === Role.STUDENT) {
      const student = await this.prisma.student.findFirst({
        where: {
          userId: currentUser.userId,
        },
      });

      if (!student || result.studentId !== student.id) {
        throw new ForbiddenException(
          'Access denied. You can only view your own marks',
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

      const linkedStudentIds = parent.students.map((s) => s.id);
      if (!linkedStudentIds.includes(result.studentId)) {
        throw new ForbiddenException(
          'Access denied. You can only view marks for your linked students',
        );
      }
    } else {
      throw new ForbiddenException(
        'Only TEACHER, STUDENT, and PARENT can view marks',
      );
    }

    return result;
  }

  /**
   * Update marks
   * Only TEACHER can update marks
   */
  async update(
    id: string,
    updateMarkDto: UpdateMarkDto,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ) {
    if (
      currentUser.role !== Role.TEACHER &&
      currentUser.role !== Role.SCHOOL_ADMIN
    ) {
      throw new ForbiddenException(
        'Only TEACHER or SCHOOL_ADMIN can update marks',
      );
    }

    if (!currentUser.schoolId) {
      throw new ForbiddenException('Teacher must be associated with a school');
    }

    const result = await this.prisma.examResult.findUnique({
      where: { id },
      include: {
        exam: {
          include: {
            class: true,
          },
        },
      },
    });

    if (!result) {
      throw new NotFoundException(`Mark with ID ${id} not found`);
    }

    // Verify mark belongs to teacher's school
    if (result.exam.class.schoolId !== currentUser.schoolId) {
      throw new ForbiddenException(
        'Access denied. You can only update marks for exams in your school',
      );
    }

    // Validate marks
    if (updateMarkDto.marks !== undefined && updateMarkDto.marks < 0) {
      throw new BadRequestException('Marks cannot be negative');
    }

    const updatedResult = await this.prisma.examResult.update({
      where: { id },
      data: updateMarkDto,
      include: {
        exam: {
          select: {
            id: true,
            name: true,
            type: true,
            date: true,
          },
        },
        student: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
            class: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    return updatedResult;
  }

  /**
   * Delete marks
   * Only TEACHER can delete marks
   */
  async remove(
    id: string,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ) {
    if (
      currentUser.role !== Role.TEACHER &&
      currentUser.role !== Role.SCHOOL_ADMIN
    ) {
      throw new ForbiddenException(
        'Only TEACHER or SCHOOL_ADMIN can delete marks',
      );
    }

    if (!currentUser.schoolId) {
      throw new ForbiddenException('Teacher must be associated with a school');
    }

    const result = await this.prisma.examResult.findUnique({
      where: { id },
      include: {
        exam: {
          include: {
            class: true,
          },
        },
      },
    });

    if (!result) {
      throw new NotFoundException(`Mark with ID ${id} not found`);
    }

    // Verify mark belongs to teacher's school
    if (result.exam.class.schoolId !== currentUser.schoolId) {
      throw new ForbiddenException(
        'Access denied. You can only delete marks for exams in your school',
      );
    }

    await this.prisma.examResult.delete({
      where: { id },
    });

    return {
      message: 'Mark deleted successfully',
    };
  }
}
