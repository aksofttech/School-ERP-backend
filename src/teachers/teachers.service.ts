import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { UpdateTeacherDto } from './dto/update-teacher.dto';
import { AssignSubjectsDto } from './dto/assign-subjects.dto';
import { ListTeachersDto } from './dto/list-teachers.dto';
import { PaginatedResult } from '../common/utils/pagination.dto';
import * as bcrypt from 'bcrypt';
import { Role } from '@prisma/client';

@Injectable()
export class TeachersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create teacher profile from User
   * Only SCHOOL_ADMIN can create teachers
   */
  async create(
    createTeacherDto: CreateTeacherDto,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ) {
    if (currentUser.role !== Role.SCHOOL_ADMIN) {
      throw new ForbiddenException('Only SCHOOL_ADMIN can create teachers');
    }

    if (!currentUser.schoolId) {
      throw new ForbiddenException(
        'School admin must be associated with a school',
      );
    }

    const {
      email,
      password,
      firstName,
      lastName,
      phone,
      qualification,
      experience,
      subjectIds,
    } = createTeacherDto;

    // Check if user with email already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Validate subjects if provided
    if (subjectIds && subjectIds.length > 0) {
      const subjects = await this.prisma.subject.findMany({
        where: {
          id: { in: subjectIds },
        },
      });

      if (subjects.length !== subjectIds.length) {
        throw new NotFoundException('One or more subjects not found');
      }

      // Verify all subjects belong to the school
      const invalidSubjects = subjects.filter(
        (s) => s.schoolId !== currentUser.schoolId,
      );

      if (invalidSubjects.length > 0) {
        throw new ForbiddenException(
          'All subjects must belong to the same school',
        );
      }

      // Check if any subject is already assigned to another teacher
      const assignedSubjects = subjects.filter((s) => s.teacherId !== null);

      if (assignedSubjects.length > 0) {
        throw new ConflictException(
          `Subject(s) ${assignedSubjects.map((s) => s.name).join(', ')} are already assigned to another teacher`,
        );
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Use transaction to create user and teacher atomically
    return await this.prisma.$transaction(async (tx) => {
      // Create user
      const user = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          firstName,
          lastName,
          phone,
          role: Role.TEACHER,
          schoolId: currentUser.schoolId,
        },
      });

      // Create teacher profile
      const teacher = await tx.teacher.create({
        data: {
          userId: user.id,
          qualification,
          experience,
          schoolId: currentUser.schoolId,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              phone: true,
              isActive: true,
            },
          },
          subjects: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
      });

      // Assign subjects if provided
      if (subjectIds && subjectIds.length > 0) {
        await tx.subject.updateMany({
          where: {
            id: { in: subjectIds },
          },
          data: {
            teacherId: teacher.id,
          },
        });

        // Fetch updated teacher with subjects
        return await tx.teacher.findUnique({
          where: { id: teacher.id },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                phone: true,
                isActive: true,
              },
            },
            subjects: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        });
      }

      return teacher;
    });
  }

  /**
   * List teachers by school
   * Only SCHOOL_ADMIN can list teachers
   */
  async findAll(
    listTeachersDto: ListTeachersDto,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ): Promise<PaginatedResult<any>> {
    if (currentUser.role !== Role.SCHOOL_ADMIN) {
      throw new ForbiddenException('Only SCHOOL_ADMIN can list teachers');
    }

    if (!currentUser.schoolId) {
      console.warn(
        `[TeachersService] Sub-optimal security state: User ${currentUser.userId} listing teachers without schoolId association.`,
      );
    }

    const { page = 1, limit = 10, search } = listTeachersDto;
    const skip = (page - 1) * limit;

    const where: any = {
      schoolId: currentUser.schoolId,
    };

    if (search) {
      where.OR = [
        { user: { firstName: { contains: search, mode: 'insensitive' } } },
        { user: { lastName: { contains: search, mode: 'insensitive' } } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.teacher.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              phone: true,
              isActive: true,
            },
          },
          subjects: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          _count: {
            select: {
              subjects: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.teacher.count({ where }),
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
   * Get teacher by ID
   * - SCHOOL_ADMIN can view any teacher from their school
   * - TEACHER can only view their own profile
   */
  async findOne(
    id: string,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ) {
    const teacher = await this.prisma.teacher.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            isActive: true,
          },
        },
        subjects: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        school: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        _count: {
          select: {
            subjects: true,
          },
        },
      },
    });

    if (!teacher) {
      throw new NotFoundException(`Teacher with ID ${id} not found`);
    }

    // RBAC checks
    if (currentUser.role === Role.SCHOOL_ADMIN) {
      if (!currentUser.schoolId || teacher.schoolId !== currentUser.schoolId) {
        throw new ForbiddenException(
          'Access denied. You can only access teachers from your school',
        );
      }
    } else if (currentUser.role === Role.TEACHER) {
      // TEACHER can only view their own profile
      if (teacher.userId !== currentUser.userId) {
        throw new ForbiddenException(
          'Access denied. You can only view your own profile',
        );
      }
    } else {
      throw new ForbiddenException(
        'Only SCHOOL_ADMIN and TEACHER can view teacher profiles',
      );
    }

    return teacher;
  }

  /**
   * Update teacher
   * Only SCHOOL_ADMIN can update teachers
   */
  async update(
    id: string,
    updateTeacherDto: UpdateTeacherDto,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ) {
    if (currentUser.role !== Role.SCHOOL_ADMIN) {
      throw new ForbiddenException('Only SCHOOL_ADMIN can update teachers');
    }

    if (!currentUser.schoolId) {
      throw new ForbiddenException(
        'School admin must be associated with a school',
      );
    }

    const teacher = await this.prisma.teacher.findUnique({
      where: { id },
    });

    if (!teacher) {
      throw new NotFoundException(`Teacher with ID ${id} not found`);
    }

    // Verify the teacher belongs to the school admin's school
    if (teacher.schoolId !== currentUser.schoolId) {
      throw new ForbiddenException(
        'Access denied. You can only update teachers from your school',
      );
    }

    // Update teacher profile
    const updateData: any = {};

    if (updateTeacherDto.qualification) {
      updateData.qualification = updateTeacherDto.qualification;
    }

    if (updateTeacherDto.experience !== undefined) {
      updateData.experience = updateTeacherDto.experience;
    }

    // Update user info if provided
    if (
      updateTeacherDto.firstName ||
      updateTeacherDto.lastName ||
      updateTeacherDto.phone
    ) {
      await this.prisma.user.update({
        where: { id: teacher.userId },
        data: {
          ...(updateTeacherDto.firstName && {
            firstName: updateTeacherDto.firstName,
          }),
          ...(updateTeacherDto.lastName && {
            lastName: updateTeacherDto.lastName,
          }),
          ...(updateTeacherDto.phone !== undefined && {
            phone: updateTeacherDto.phone,
          }),
        },
      });
    }

    const updatedTeacher = await this.prisma.teacher.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            isActive: true,
          },
        },
        subjects: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    return updatedTeacher;
  }

  /**
   * Assign subjects to teacher
   * Only SCHOOL_ADMIN can assign subjects
   */
  async assignSubjects(
    id: string,
    assignSubjectsDto: AssignSubjectsDto,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ) {
    if (currentUser.role !== Role.SCHOOL_ADMIN) {
      throw new ForbiddenException('Only SCHOOL_ADMIN can assign subjects');
    }

    if (!currentUser.schoolId) {
      throw new ForbiddenException(
        'School admin must be associated with a school',
      );
    }

    const teacher = await this.prisma.teacher.findUnique({
      where: { id },
    });

    if (!teacher) {
      throw new NotFoundException(`Teacher with ID ${id} not found`);
    }

    // Verify the teacher belongs to the school admin's school
    if (teacher.schoolId !== currentUser.schoolId) {
      throw new ForbiddenException(
        'Access denied. You can only assign subjects to teachers from your school',
      );
    }

    const { subjectIds } = assignSubjectsDto;

    // Validate subjects
    const subjects = await this.prisma.subject.findMany({
      where: {
        id: { in: subjectIds },
      },
    });

    if (subjects.length !== subjectIds.length) {
      throw new NotFoundException('One or more subjects not found');
    }

    // Verify all subjects belong to the school
    const invalidSubjects = subjects.filter(
      (s) => s.schoolId !== currentUser.schoolId,
    );

    if (invalidSubjects.length > 0) {
      throw new ForbiddenException(
        'All subjects must belong to the same school',
      );
    }

    // Check if any subject is already assigned to another teacher
    const assignedSubjects = subjects.filter(
      (s) => s.teacherId !== null && s.teacherId !== id,
    );

    if (assignedSubjects.length > 0) {
      throw new ConflictException(
        `Subject(s) ${assignedSubjects.map((s) => s.name).join(', ')} are already assigned to another teacher`,
      );
    }

    // Unassign current subjects first (optional - you might want to keep existing assignments)
    // For now, we'll replace all assignments
    await this.prisma.subject.updateMany({
      where: {
        teacherId: id,
      },
      data: {
        teacherId: null,
      },
    });

    // Assign new subjects
    await this.prisma.subject.updateMany({
      where: {
        id: { in: subjectIds },
      },
      data: {
        teacherId: id,
      },
    });

    // Fetch updated teacher with subjects
    const updatedTeacher = await this.prisma.teacher.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            isActive: true,
          },
        },
        subjects: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    return updatedTeacher;
  }

  /**
   * Delete teacher
   * Only SCHOOL_ADMIN can delete teachers
   */
  async remove(
    id: string,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ) {
    if (currentUser.role !== Role.SCHOOL_ADMIN) {
      throw new ForbiddenException('Only SCHOOL_ADMIN can delete teachers');
    }

    if (!currentUser.schoolId) {
      throw new ForbiddenException(
        'School admin must be associated with a school',
      );
    }

    const teacher = await this.prisma.teacher.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            subjects: true,
          },
        },
      },
    });

    if (!teacher) {
      throw new NotFoundException(`Teacher with ID ${id} not found`);
    }

    // Verify the teacher belongs to the school admin's school
    if (teacher.schoolId !== currentUser.schoolId) {
      throw new ForbiddenException(
        'Access denied. You can only delete teachers from your school',
      );
    }

    // Use transaction to delete teacher and user
    return await this.prisma.$transaction(async (tx) => {
      // Unassign all subjects first
      if (teacher._count.subjects > 0) {
        await tx.subject.updateMany({
          where: {
            teacherId: id,
          },
          data: {
            teacherId: null,
          },
        });
      }

      // Delete teacher
      await tx.teacher.delete({
        where: { id },
      });

      // Delete user
      await tx.user.delete({
        where: { id: teacher.userId },
      });

      return {
        message: `Teacher has been deleted successfully`,
      };
    });
  }
}
