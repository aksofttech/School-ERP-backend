import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ViewResultsDto } from './dto/view-results.dto';
import { PaginatedResult } from '../common/utils/pagination.dto';
import { Role } from '@prisma/client';

@Injectable()
export class ResultsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Calculate grade based on percentage
   */
  private calculateGrade(percentage: number): string {
    if (percentage >= 90) return 'A+';
    if (percentage >= 80) return 'A';
    if (percentage >= 70) return 'B+';
    if (percentage >= 60) return 'B';
    if (percentage >= 50) return 'C+';
    if (percentage >= 40) return 'C';
    if (percentage >= 33) return 'D';
    return 'F';
  }

  /**
   * Auto-generate results for an exam
   * Calculates grades automatically
   */
  async generateResults(
    examId: string,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ) {
    if (
      currentUser.role !== Role.TEACHER &&
      currentUser.role !== Role.SCHOOL_ADMIN
    ) {
      throw new ForbiddenException(
        'Only TEACHER or SCHOOL_ADMIN can generate results',
      );
    }

    if (!currentUser.schoolId) {
      throw new ForbiddenException('Teacher must be associated with a school');
    }

    // Verify exam exists and belongs to school
    const exam = await this.prisma.exam.findUnique({
      where: { id: examId },
      include: {
        class: true,
        results: true,
      },
    });

    if (!exam) {
      throw new NotFoundException(`Exam with ID ${examId} not found`);
    }

    if (exam.class.schoolId !== currentUser.schoolId) {
      throw new ForbiddenException(
        'Access denied. You can only generate results for exams in your school',
      );
    }

    if (exam.results.length === 0) {
      throw new BadRequestException(
        'No marks entered for this exam. Please enter marks first.',
      );
    }

    // Get all students in the class
    const students = await this.prisma.student.findMany({
      where: {
        classId: exam.classId,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Calculate results with grades
    const results = exam.results.map((result) => {
      const percentage = (result.marks / (exam as any).totalMarks) * 100;
      const grade = this.calculateGrade(percentage);

      return {
        ...result,
        percentage: percentage.toFixed(2),
        grade,
        student: students.find((s) => s.id === result.studentId),
      };
    });

    // Calculate class statistics
    const totalMarks = results.reduce((sum, r) => sum + r.marks, 0);
    const averageMarks = totalMarks / results.length;
    const highestMarks = Math.max(...results.map((r) => r.marks));
    const lowestMarks = Math.min(...results.map((r) => r.marks));

    const gradeDistribution = results.reduce(
      (acc, r) => {
        acc[r.grade] = (acc[r.grade] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      exam: {
        id: exam.id,
        name: exam.name,
        type: exam.type,
        date: exam.date,
      },
      class: {
        id: exam.class.id,
        name: exam.class.name,
      },
      results,
      statistics: {
        totalStudents: students.length,
        studentsWithMarks: results.length,
        averageMarks: averageMarks.toFixed(2),
        highestMarks: highestMarks.toFixed(2),
        lowestMarks: lowestMarks.toFixed(2),
        gradeDistribution,
      },
    };
  }

  /**
   * Get student results
   * - STUDENT can view their own results
   * - PARENT can view results for their linked students
   * - TEACHER can view any results in their school
   */
  async getStudentResults(
    studentId: string,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ) {
    // Verify student exists
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        class: true,
      },
    });

    if (!student) {
      throw new NotFoundException(`Student with ID ${studentId} not found`);
    }

    // RBAC checks
    if (currentUser.role === Role.STUDENT) {
      const currentStudent = await this.prisma.student.findFirst({
        where: {
          userId: currentUser.userId,
        },
      });

      if (!currentStudent || currentStudent.id !== studentId) {
        throw new ForbiddenException(
          'Access denied. You can only view your own results',
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
      if (!linkedStudentIds.includes(studentId)) {
        throw new ForbiddenException(
          'Access denied. You can only view results for your linked students',
        );
      }
    } else if (currentUser.role === Role.TEACHER) {
      if (!currentUser.schoolId || student.schoolId !== currentUser.schoolId) {
        throw new ForbiddenException(
          'Access denied. You can only view results for students in your school',
        );
      }
    } else if (currentUser.role === Role.SCHOOL_ADMIN) {
      if (!currentUser.schoolId || student.schoolId !== currentUser.schoolId) {
        throw new ForbiddenException(
          'Access denied. You can only view results for students in your school',
        );
      }
    } else {
      throw new ForbiddenException('Access denied');
    }

    // Get all exam results for the student
    const results = await this.prisma.examResult.findMany({
      where: { studentId },
      include: {
        exam: {
          select: {
            id: true,
            name: true,
            type: true,
            date: true,
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
        exam: {
          date: 'desc',
        },
      },
    });

    // Calculate grades for each result
    const resultsWithGrades = await Promise.all(
      results.map(async (result) => {
        const examDetail = await this.prisma.exam.findUnique({
          where: { id: result.examId },
        });
        const totalMarks = (examDetail as any)?.totalMarks || 100;
        const percentage = (result.marks / totalMarks) * 100;
        const grade = this.calculateGrade(percentage);

        return {
          ...result,
          percentage: percentage.toFixed(2),
          grade,
        };
      }),
    );

    // Calculate overall statistics
    if (resultsWithGrades.length > 0) {
      const totalMarks = resultsWithGrades.reduce((sum, r) => sum + r.marks, 0);
      const averageMarks = totalMarks / resultsWithGrades.length;
      const overallGrade = this.calculateGrade(averageMarks);

      return {
        student: {
          id: student.id,
          name: `${student.user.firstName} ${student.user.lastName}`,
          rollNumber: student.rollNumber,
          class: student.class.name,
        },
        results: resultsWithGrades,
        statistics: {
          totalExams: resultsWithGrades.length,
          averageMarks: averageMarks.toFixed(2),
          overallGrade,
        },
      };
    }

    return {
      student: {
        id: student.id,
        name: `${student.user.firstName} ${student.user.lastName}`,
        rollNumber: student.rollNumber,
        class: student.class.name,
      },
      results: [],
      statistics: {
        totalExams: 0,
        averageMarks: '0.00',
        overallGrade: 'N/A',
      },
    };
  }

  /**
   * Get exam results
   * - TEACHER can view results for exams in their school
   * - STUDENT/PARENT can view results (read-only)
   */
  async getExamResults(
    examId: string,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ) {
    // Verify exam exists
    const exam = await this.prisma.exam.findUnique({
      where: { id: examId },
      include: {
        class: true,
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
      },
    });

    if (!exam) {
      throw new NotFoundException(`Exam with ID ${examId} not found`);
    }

    // RBAC checks
    if (currentUser.role === Role.TEACHER) {
      if (
        !currentUser.schoolId ||
        exam.class.schoolId !== currentUser.schoolId
      ) {
        throw new ForbiddenException(
          'Access denied. You can only view results for exams in your school',
        );
      }
    } else if (currentUser.role === Role.SCHOOL_ADMIN) {
      if (
        !currentUser.schoolId ||
        exam.class.schoolId !== currentUser.schoolId
      ) {
        throw new ForbiddenException(
          'Access denied. You can only view results for exams in your school',
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
          'Access denied. You can only view results for exams in your class',
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
          "Access denied. You can only view results for exams in your linked students' classes",
        );
      }
    } else {
      throw new ForbiddenException(
        'Only TEACHER, STUDENT, and PARENT can view results',
      );
    }

    // Calculate grades for all results
    const resultsWithGrades = exam.results.map((result) => {
      const percentage = (result.marks / (exam as any).totalMarks) * 100;
      const grade = this.calculateGrade(percentage);

      return {
        ...result,
        percentage: percentage.toFixed(2),
        grade,
      };
    });

    // Calculate statistics
    if (resultsWithGrades.length > 0) {
      const totalMarks = resultsWithGrades.reduce((sum, r) => sum + r.marks, 0);
      const averageMarks = totalMarks / resultsWithGrades.length;
      const highestMarks = Math.max(...resultsWithGrades.map((r) => r.marks));
      const lowestMarks = Math.min(...resultsWithGrades.map((r) => r.marks));

      const gradeDistribution = resultsWithGrades.reduce(
        (acc, r) => {
          acc[r.grade] = (acc[r.grade] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );

      return {
        exam: {
          id: exam.id,
          name: exam.name,
          type: exam.type,
          date: exam.date,
        },
        class: {
          id: exam.class.id,
          name: exam.class.name,
        },
        results: resultsWithGrades,
        statistics: {
          totalStudents: resultsWithGrades.length,
          averageMarks: averageMarks.toFixed(2),
          highestMarks: highestMarks.toFixed(2),
          lowestMarks: lowestMarks.toFixed(2),
          gradeDistribution,
        },
      };
    }

    return {
      exam: {
        id: exam.id,
        name: exam.name,
        type: exam.type,
        date: exam.date,
      },
      class: {
        id: exam.class.id,
        name: exam.class.name,
      },
      results: [],
      statistics: {
        totalStudents: 0,
        averageMarks: '0.00',
        highestMarks: '0.00',
        lowestMarks: '0.00',
        gradeDistribution: {},
      },
    };
  }

  /**
   * Get class results
   * - TEACHER can view results for classes in their school
   * - STUDENT/PARENT can view results (read-only)
   */
  async getClassResults(
    classId: string,
    viewResultsDto: ViewResultsDto,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ): Promise<PaginatedResult<any>> {
    const { page = 1, limit = 10, examId } = viewResultsDto;
    const skip = (page - 1) * limit;

    // Verify class exists
    const classEntity = await this.prisma.class.findUnique({
      where: { id: classId },
    });

    if (!classEntity) {
      throw new NotFoundException(`Class with ID ${classId} not found`);
    }

    // RBAC checks
    if (currentUser.role === Role.TEACHER) {
      if (
        !currentUser.schoolId ||
        classEntity.schoolId !== currentUser.schoolId
      ) {
        throw new ForbiddenException(
          'Access denied. You can only view results for classes in your school',
        );
      }
    } else if (currentUser.role === Role.SCHOOL_ADMIN) {
      if (
        !currentUser.schoolId ||
        classEntity.schoolId !== currentUser.schoolId
      ) {
        throw new ForbiddenException(
          'Access denied. You can only view results for classes in your school',
        );
      }
    } else if (currentUser.role === Role.STUDENT) {
      const student = await this.prisma.student.findFirst({
        where: {
          userId: currentUser.userId,
        },
      });

      if (!student || student.classId !== classId) {
        throw new ForbiddenException(
          'Access denied. You can only view results for your class',
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
      if (!studentClassIds.includes(classId)) {
        throw new ForbiddenException(
          "Access denied. You can only view results for your linked students' classes",
        );
      }
    } else {
      throw new ForbiddenException(
        'Only TEACHER, STUDENT, and PARENT can view results',
      );
    }

    const where: any = {
      exam: {
        classId,
      },
    };

    if (examId) {
      where.examId = examId;
    }

    const [data, total] = await Promise.all([
      this.prisma.examResult.findMany({
        where,
        skip,
        take: limit,
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
            },
          },
        },
        orderBy: {
          exam: {
            date: 'desc',
          },
        },
      }),
      this.prisma.examResult.count({ where }),
    ]);

    // Calculate grades
    const resultsWithGrades = data.map((result) => {
      const percentage = (result.marks / (result.exam as any).totalMarks) * 100;
      const grade = this.calculateGrade(percentage);

      return {
        ...result,
        percentage: percentage.toFixed(2),
        grade,
      };
    });

    return {
      data: resultsWithGrades,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
