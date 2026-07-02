import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';
import { ListSubjectsDto } from './dto/list-subjects.dto';
import { PaginatedResult } from '../common/utils/pagination.dto';
import { Role } from '@prisma/client';

@Injectable()
export class SubjectsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create subject for a school
   * Only SCHOOL_ADMIN can create subjects
   */
  async create(
    createSubjectDto: CreateSubjectDto,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ) {
    if (currentUser.role !== Role.SCHOOL_ADMIN) {
      throw new ForbiddenException('Only SCHOOL_ADMIN can create subjects');
    }

    if (!currentUser.schoolId) {
      throw new ForbiddenException(
        'School admin must be associated with a school',
      );
    }

    const { name, code, teacherId } = createSubjectDto;

    // Check for duplicate subject code in the same school
    const existingSubject = await this.prisma.subject.findFirst({
      where: {
        code,
        schoolId: currentUser.schoolId,
      },
    });

    if (existingSubject) {
      throw new ConflictException(
        `Subject with code "${code}" already exists in your school`,
      );
    }

    // If teacher is assigned, verify teacher exists and belongs to the school
    if (teacherId) {
      const teacher = await this.prisma.teacher.findUnique({
        where: { id: teacherId },
        include: {
          user: true,
        },
      });

      if (!teacher) {
        throw new NotFoundException(`Teacher with ID ${teacherId} not found`);
      }

      if (teacher.schoolId !== currentUser.schoolId) {
        throw new ForbiddenException('Teacher must belong to the same school');
      }

      if (teacher.user.role !== Role.TEACHER) {
        throw new BadRequestException('User is not a teacher');
      }
    }

    // Create subject
    const subject = await this.prisma.subject.create({
      data: {
        name,
        code,
        schoolId: currentUser.schoolId,
        teacherId: teacherId || null,
      },
      include: {
        teacher: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
    });

    return subject;
  }

  /**
   * List subjects
   * - SCHOOL_ADMIN can see all subjects in their school
   * - TEACHER can only see subjects assigned to them
   * - Can filter by classId (for class-wise listing)
   */
  async findAll(
    listSubjectsDto: ListSubjectsDto,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ): Promise<PaginatedResult<any>> {
    const { page = 1, limit = 10, classId } = listSubjectsDto;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (currentUser.role === Role.SCHOOL_ADMIN) {
      if (!currentUser.schoolId) {
        throw new ForbiddenException(
          'School admin must be associated with a school',
        );
      }
      // SCHOOL_ADMIN sees all subjects in their school
      where.schoolId = currentUser.schoolId;
    } else if (currentUser.role === Role.TEACHER) {
      // TEACHER can only see subjects assigned to them
      const teacher = await this.prisma.teacher.findFirst({
        where: {
          userId: currentUser.userId,
        },
      });

      if (!teacher) {
        throw new NotFoundException('Teacher profile not found');
      }

      where.teacherId = teacher.id;
    } else {
      throw new ForbiddenException(
        'Only SCHOOL_ADMIN and TEACHER can view subjects',
      );
    }

    // Note: classId filter is for future use if Subject-Class relationship is added
    // For now, we'll just list subjects by school/teacher

    const [data, total] = await Promise.all([
      this.prisma.subject.findMany({
        where,
        skip,
        take: limit,
        include: {
          teacher: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          },
        },
        orderBy: { name: 'asc' },
      }),
      this.prisma.subject.count({ where }),
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
   * List subjects by class
   * Returns all subjects for a school, filtered conceptually by class
   * (Since schema doesn't have direct Subject-Class relationship)
   */
  async findByClass(
    classId: string,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ) {
    if (currentUser.role === Role.TEACHER) {
      throw new ForbiddenException('Teachers cannot filter subjects by class');
    }

    if (currentUser.role !== Role.SCHOOL_ADMIN) {
      throw new ForbiddenException(
        'Only SCHOOL_ADMIN can view subjects by class',
      );
    }

    if (!currentUser.schoolId) {
      throw new ForbiddenException(
        'School admin must be associated with a school',
      );
    }

    // Verify class exists and belongs to the school
    const classEntity = await this.prisma.class.findUnique({
      where: { id: classId },
    });

    if (!classEntity) {
      throw new NotFoundException(`Class with ID ${classId} not found`);
    }

    if (classEntity.schoolId !== currentUser.schoolId) {
      throw new ForbiddenException(
        'Access denied. You can only access classes from your school',
      );
    }

    // Return all subjects for the school (since subjects are school-wide)
    // In a real scenario, you might want to add a Subject-Class relationship
    const subjects = await this.prisma.subject.findMany({
      where: {
        schoolId: currentUser.schoolId,
      },
      include: {
        teacher: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return {
      class: {
        id: classEntity.id,
        name: classEntity.name,
      },
      subjects,
    };
  }

  /**
   * Get subject by ID
   */
  async findOne(
    id: string,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ) {
    const subject = await this.prisma.subject.findUnique({
      where: { id },
      include: {
        teacher: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
        school: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    if (!subject) {
      throw new NotFoundException(`Subject with ID ${id} not found`);
    }

    // RBAC checks
    if (currentUser.role === Role.SCHOOL_ADMIN) {
      if (!currentUser.schoolId || subject.schoolId !== currentUser.schoolId) {
        throw new ForbiddenException(
          'Access denied. You can only access subjects from your school',
        );
      }
    } else if (currentUser.role === Role.TEACHER) {
      // TEACHER can only see subjects assigned to them
      if (!subject.teacherId) {
        throw new ForbiddenException('Subject is not assigned to any teacher');
      }

      const teacher = await this.prisma.teacher.findFirst({
        where: {
          userId: currentUser.userId,
        },
      });

      if (!teacher || subject.teacherId !== teacher.id) {
        throw new ForbiddenException(
          'Access denied. You can only view subjects assigned to you',
        );
      }
    } else {
      throw new ForbiddenException(
        'Only SCHOOL_ADMIN and TEACHER can view subjects',
      );
    }

    return subject;
  }

  /**
   * Update subject
   * Only SCHOOL_ADMIN can update subjects
   */
  async update(
    id: string,
    updateSubjectDto: UpdateSubjectDto,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ) {
    if (currentUser.role !== Role.SCHOOL_ADMIN) {
      throw new ForbiddenException('Only SCHOOL_ADMIN can update subjects');
    }

    if (!currentUser.schoolId) {
      throw new ForbiddenException(
        'School admin must be associated with a school',
      );
    }

    const subject = await this.prisma.subject.findUnique({
      where: { id },
    });

    if (!subject) {
      throw new NotFoundException(`Subject with ID ${id} not found`);
    }

    // Verify the subject belongs to the school admin's school
    if (subject.schoolId !== currentUser.schoolId) {
      throw new ForbiddenException(
        'Access denied. You can only update subjects from your school',
      );
    }

    // If teacher is being updated, verify teacher exists and belongs to the school
    if (updateSubjectDto.teacherId) {
      const teacher = await this.prisma.teacher.findUnique({
        where: { id: updateSubjectDto.teacherId },
        include: {
          user: true,
        },
      });

      if (!teacher) {
        throw new NotFoundException(
          `Teacher with ID ${updateSubjectDto.teacherId} not found`,
        );
      }

      if (teacher.schoolId !== currentUser.schoolId) {
        throw new ForbiddenException('Teacher must belong to the same school');
      }

      if (teacher.user.role !== Role.TEACHER) {
        throw new BadRequestException('User is not a teacher');
      }
    }

    const updatedSubject = await this.prisma.subject.update({
      where: { id },
      data: updateSubjectDto,
      include: {
        teacher: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
    });

    return updatedSubject;
  }

  /**
   * Delete subject
   * Only SCHOOL_ADMIN can delete subjects
   */
  async remove(
    id: string,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ) {
    if (currentUser.role !== Role.SCHOOL_ADMIN) {
      throw new ForbiddenException('Only SCHOOL_ADMIN can delete subjects');
    }

    if (!currentUser.schoolId) {
      throw new ForbiddenException(
        'School admin must be associated with a school',
      );
    }

    const subject = await this.prisma.subject.findUnique({
      where: { id },
    });

    if (!subject) {
      throw new NotFoundException(`Subject with ID ${id} not found`);
    }

    // Verify the subject belongs to the school admin's school
    if (subject.schoolId !== currentUser.schoolId) {
      throw new ForbiddenException(
        'Access denied. You can only delete subjects from your school',
      );
    }

    await this.prisma.subject.delete({
      where: { id },
    });

    return {
      message: `Subject "${subject.name}" has been deleted successfully`,
    };
  }
}
