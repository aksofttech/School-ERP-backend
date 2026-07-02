import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateHomeworkDto } from './dto/create-homework.dto';
import { UpdateHomeworkDto } from './dto/update-homework.dto';
import { ListHomeworkDto } from './dto/list-homework.dto';
import { PaginatedResult } from '../common/utils/pagination.dto';
import { Role } from '@prisma/client';

@Injectable()
export class HomeworkService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Teacher assigns homework
   * Only TEACHER can create homework
   */
  async create(
    createHomeworkDto: CreateHomeworkDto,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ) {
    const isTeacher = currentUser.role === Role.TEACHER;
    const isAdmin =
      currentUser.role === Role.SCHOOL_ADMIN ||
      currentUser.role === Role.SUPER_ADMIN;

    if (!isTeacher && !isAdmin) {
      throw new ForbiddenException(
        'Only TEACHER or SCHOOL_ADMIN can create homework',
      );
    }

    if (!currentUser.schoolId) {
      throw new ForbiddenException('User must be associated with a school');
    }

    let teacherId: string | null = null;

    if (isTeacher) {
      // Verify teacher exists
      const teacher = await this.prisma.teacher.findFirst({
        where: {
          userId: currentUser.userId,
        },
      });

      if (!teacher) {
        throw new NotFoundException('Teacher profile not found');
      }
      teacherId = teacher.id;
    }

    const { title, description, classId, subjectId, dueDate } =
      createHomeworkDto;

    // Verify class exists and belongs to school
    const classEntity = await this.prisma.class.findUnique({
      where: { id: classId },
    });

    if (!classEntity) {
      throw new NotFoundException(`Class with ID ${classId} not found`);
    }

    if (classEntity.schoolId !== currentUser.schoolId) {
      throw new ForbiddenException(
        'Access denied. You can only create homework for classes in your school',
      );
    }

    // Verify subject exists and belongs to school
    const subject = await this.prisma.subject.findUnique({
      where: { id: subjectId },
    });

    if (!subject) {
      throw new NotFoundException(`Subject with ID ${subjectId} not found`);
    }

    if (subject.schoolId !== currentUser.schoolId) {
      throw new ForbiddenException('Subject must belong to the same school');
    }

    // Verify teacher is assigned to the subject (Only for teachers)
    if (isTeacher && subject.teacherId !== teacherId) {
      throw new ForbiddenException(
        'You can only assign homework for subjects assigned to you',
      );
    }

    // If Admin is creating, use the subject's teacher or the first available teacher in the school
    if (!teacherId && isAdmin) {
      teacherId = subject.teacherId;

      if (!teacherId) {
        // Fallback: find any teacher in the school if the subject has no teacher
        const fallbackTeacher = await this.prisma.teacher.findFirst({
          where: { schoolId: currentUser.schoolId },
        });
        if (!fallbackTeacher) {
          throw new BadRequestException(
            'No teachers found in this school to assign homework to',
          );
        }
        teacherId = fallbackTeacher.id;
      }
    }

    // Validate due date is in the future
    const dueDateObj = new Date(dueDate);
    if (dueDateObj < new Date()) {
      throw new BadRequestException('Due date must be in the future');
    }

    // Create homework
    const homework = await this.prisma.homework.create({
      data: {
        title,
        description: description || null,
        classId,
        subjectId,
        teacherId: teacherId!,
        dueDate: dueDateObj,
      },
      include: {
        class: {
          select: {
            id: true,
            name: true,
          },
        },
        subject: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        teacher: {
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
    });

    return homework;
  }

  /**
   * Class-wise homework list
   * - TEACHER can view homework they assigned
   * - STUDENT can view homework assigned to their class
   */
  async findAll(
    listHomeworkDto: ListHomeworkDto,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ): Promise<PaginatedResult<any>> {
    const { page = 1, limit = 10, classId, subjectId } = listHomeworkDto;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (currentUser.role === Role.TEACHER) {
      if (!currentUser.schoolId) {
        throw new ForbiddenException(
          'Teacher must be associated with a school',
        );
      }

      // TEACHER can view homework they assigned
      const teacher = await this.prisma.teacher.findFirst({
        where: {
          userId: currentUser.userId,
        },
      });

      if (!teacher) {
        throw new NotFoundException('Teacher profile not found');
      }

      where.teacherId = teacher.id;
    } else if (currentUser.role === Role.STUDENT) {
      // STUDENT can view homework assigned to their class
      const student = await this.prisma.student.findFirst({
        where: {
          userId: currentUser.userId,
        },
      });

      if (!student) {
        throw new NotFoundException('Student profile not found');
      }

      where.classId = student.classId;
    } else {
      throw new ForbiddenException(
        'Only TEACHER and STUDENT can view homework',
      );
    }

    // Additional filters
    if (classId) {
      where.classId = classId;
    }

    if (subjectId) {
      where.subjectId = subjectId;
    }

    const [data, total] = await Promise.all([
      this.prisma.homework.findMany({
        where,
        skip,
        take: limit,
        include: {
          class: {
            select: {
              id: true,
              name: true,
            },
          },
          subject: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          teacher: {
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
        orderBy: { dueDate: 'asc' },
      }),
      this.prisma.homework.count({ where }),
    ]);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get homework by class
   * STUDENT can view homework for their class
   */
  async findByClass(
    classId: string,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ) {
    if (currentUser.role === Role.STUDENT) {
      // Verify student belongs to the class
      const student = await this.prisma.student.findFirst({
        where: {
          userId: currentUser.userId,
        },
      });

      if (!student) {
        throw new NotFoundException('Student profile not found');
      }

      if (student.classId !== classId) {
        throw new ForbiddenException(
          'Access denied. You can only view homework for your class',
        );
      }
    } else if (currentUser.role === Role.TEACHER) {
      // TEACHER can view homework for classes in their school
      if (!currentUser.schoolId) {
        throw new ForbiddenException(
          'Teacher must be associated with a school',
        );
      }

      const classEntity = await this.prisma.class.findUnique({
        where: { id: classId },
      });

      if (!classEntity) {
        throw new NotFoundException(`Class with ID ${classId} not found`);
      }

      if (classEntity.schoolId !== currentUser.schoolId) {
        throw new ForbiddenException(
          'Access denied. You can only view homework for classes in your school',
        );
      }
    } else {
      throw new ForbiddenException(
        'Only TEACHER and STUDENT can view homework',
      );
    }

    const homeworks = await this.prisma.homework.findMany({
      where: { classId },
      include: {
        subject: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        teacher: {
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
      orderBy: { dueDate: 'asc' },
    });

    return {
      class: {
        id: classId,
      },
      homeworks,
      total: homeworks.length,
    };
  }

  /**
   * Get homework by ID
   * - TEACHER can view homework they assigned
   * - STUDENT can view homework assigned to their class
   */
  async findOne(
    id: string,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ) {
    const homework = await this.prisma.homework.findUnique({
      where: { id },
      include: {
        class: {
          select: {
            id: true,
            name: true,
            schoolId: true,
          },
        },
        subject: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        teacher: {
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
    });

    if (!homework) {
      throw new NotFoundException(`Homework with ID ${id} not found`);
    }

    // RBAC checks
    if (currentUser.role === Role.TEACHER) {
      if (!currentUser.schoolId) {
        throw new ForbiddenException(
          'Teacher must be associated with a school',
        );
      }

      const teacher = await this.prisma.teacher.findFirst({
        where: {
          userId: currentUser.userId,
        },
      });

      if (!teacher || homework.teacherId !== teacher.id) {
        throw new ForbiddenException(
          'Access denied. You can only view homework you assigned',
        );
      }
    } else if (currentUser.role === Role.STUDENT) {
      const student = await this.prisma.student.findFirst({
        where: {
          userId: currentUser.userId,
        },
      });

      if (!student) {
        throw new NotFoundException('Student profile not found');
      }

      if (homework.classId !== student.classId) {
        throw new ForbiddenException(
          'Access denied. You can only view homework for your class',
        );
      }
    } else {
      throw new ForbiddenException(
        'Only TEACHER and STUDENT can view homework',
      );
    }

    return homework;
  }

  /**
   * Update homework
   * Only TEACHER can update homework they assigned
   */
  async update(
    id: string,
    updateHomeworkDto: UpdateHomeworkDto,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ) {
    if (currentUser.role !== Role.TEACHER) {
      throw new ForbiddenException('Only TEACHER can update homework');
    }

    if (!currentUser.schoolId) {
      throw new ForbiddenException('Teacher must be associated with a school');
    }

    const teacher = await this.prisma.teacher.findFirst({
      where: {
        userId: currentUser.userId,
      },
    });

    if (!teacher) {
      throw new NotFoundException('Teacher profile not found');
    }

    const homework = await this.prisma.homework.findUnique({
      where: { id },
    });

    if (!homework) {
      throw new NotFoundException(`Homework with ID ${id} not found`);
    }

    // Verify teacher owns this homework
    if (homework.teacherId !== teacher.id) {
      throw new ForbiddenException(
        'Access denied. You can only update homework you assigned',
      );
    }

    // Validate due date if being updated
    if (updateHomeworkDto.dueDate) {
      const dueDateObj = new Date(updateHomeworkDto.dueDate);
      if (dueDateObj < new Date()) {
        throw new BadRequestException('Due date must be in the future');
      }
    }

    const updatedHomework = await this.prisma.homework.update({
      where: { id },
      data: {
        ...(updateHomeworkDto.title && { title: updateHomeworkDto.title }),
        ...(updateHomeworkDto.description !== undefined && {
          description: updateHomeworkDto.description,
        }),
        ...(updateHomeworkDto.dueDate && {
          dueDate: new Date(updateHomeworkDto.dueDate),
        }),
      },
      include: {
        class: {
          select: {
            id: true,
            name: true,
          },
        },
        subject: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        teacher: {
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
    });

    return updatedHomework;
  }

  /**
   * Delete homework
   * Only TEACHER can delete homework they assigned
   */
  async remove(
    id: string,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ) {
    if (currentUser.role !== Role.TEACHER) {
      throw new ForbiddenException('Only TEACHER can delete homework');
    }

    if (!currentUser.schoolId) {
      throw new ForbiddenException('Teacher must be associated with a school');
    }

    const teacher = await this.prisma.teacher.findFirst({
      where: {
        userId: currentUser.userId,
      },
    });

    if (!teacher) {
      throw new NotFoundException('Teacher profile not found');
    }

    const homework = await this.prisma.homework.findUnique({
      where: { id },
    });

    if (!homework) {
      throw new NotFoundException(`Homework with ID ${id} not found`);
    }

    // Verify teacher owns this homework
    if (homework.teacherId !== teacher.id) {
      throw new ForbiddenException(
        'Access denied. You can only delete homework you assigned',
      );
    }

    await this.prisma.homework.delete({
      where: { id },
    });

    return {
      message: 'Homework deleted successfully',
    };
  }
}
