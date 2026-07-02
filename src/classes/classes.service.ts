import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import { Role } from '@prisma/client';

@Injectable()
export class ClassesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create class for a school
   * Only SCHOOL_ADMIN can create classes for their school
   */
  async create(
    createClassDto: CreateClassDto,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ) {
    if (currentUser.role !== Role.SCHOOL_ADMIN) {
      throw new ForbiddenException('Only SCHOOL_ADMIN can create classes');
    }

    if (!currentUser.schoolId) {
      throw new ForbiddenException(
        'School admin must be associated with a school',
      );
    }

    const { name } = createClassDto;

    // Check for duplicate class name in the same school
    const existingClass = await this.prisma.class.findFirst({
      where: {
        name,
        schoolId: currentUser.schoolId,
      },
    });

    if (existingClass) {
      throw new ConflictException(
        `Class with name "${name}" already exists in your school`,
      );
    }

    // Create class
    const newClass = await this.prisma.class.create({
      data: {
        name,
        schoolId: currentUser.schoolId,
      },
      include: {
        sections: {
          orderBy: { name: 'asc' },
        },
        _count: {
          select: {
            students: true,
            sections: true,
          },
        },
      },
    });

    return newClass;
  }

  /**
   * List all classes for the school with their sections
   * Only SCHOOL_ADMIN can list classes from their school
   */
  async findAll(currentUser: {
    userId: string;
    role: Role;
    schoolId?: string;
  }) {
    if (
      currentUser.role !== Role.SCHOOL_ADMIN &&
      currentUser.role !== Role.TEACHER &&
      currentUser.role !== Role.SUPER_ADMIN
    ) {
      throw new ForbiddenException('Insufficient permissions to list classes');
    }

    if (!currentUser.schoolId && currentUser.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('User must be associated with a school');
    }

    const classes = await this.prisma.class.findMany({
      where: {
        schoolId: currentUser.schoolId,
      },
      include: {
        sections: {
          orderBy: { name: 'asc' },
          include: {
            _count: {
              select: {
                students: true,
              },
            },
          },
        },
        _count: {
          select: {
            students: true,
            sections: true,
            exams: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return classes;
  }

  /**
   * Get class by ID with sections
   */
  async findOne(
    id: string,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ) {
    if (currentUser.role !== Role.SCHOOL_ADMIN) {
      throw new ForbiddenException('Only SCHOOL_ADMIN can view classes');
    }

    if (!currentUser.schoolId) {
      throw new ForbiddenException(
        'School admin must be associated with a school',
      );
    }

    const classEntity = await this.prisma.class.findUnique({
      where: { id },
      include: {
        sections: {
          orderBy: { name: 'asc' },
          include: {
            _count: {
              select: {
                students: true,
              },
            },
          },
        },
        _count: {
          select: {
            students: true,
            sections: true,
            exams: true,
          },
        },
      },
    });

    if (!classEntity) {
      throw new NotFoundException(`Class with ID ${id} not found`);
    }

    // Verify the class belongs to the school admin's school
    if (classEntity.schoolId !== currentUser.schoolId) {
      throw new ForbiddenException(
        'Access denied. You can only access classes from your school',
      );
    }

    return classEntity;
  }

  /**
   * Update class
   */
  async update(
    id: string,
    updateClassDto: UpdateClassDto,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ) {
    if (currentUser.role !== Role.SCHOOL_ADMIN) {
      throw new ForbiddenException('Only SCHOOL_ADMIN can update classes');
    }

    if (!currentUser.schoolId) {
      throw new ForbiddenException(
        'School admin must be associated with a school',
      );
    }

    const classEntity = await this.prisma.class.findUnique({
      where: { id },
    });

    if (!classEntity) {
      throw new NotFoundException(`Class with ID ${id} not found`);
    }

    // Verify the class belongs to the school admin's school
    if (classEntity.schoolId !== currentUser.schoolId) {
      throw new ForbiddenException(
        'Access denied. You can only update classes from your school',
      );
    }

    // If name is being updated, check for duplicates
    if (updateClassDto.name && updateClassDto.name !== classEntity.name) {
      const existingClass = await this.prisma.class.findFirst({
        where: {
          name: updateClassDto.name,
          schoolId: currentUser.schoolId,
          id: { not: id },
        },
      });

      if (existingClass) {
        throw new ConflictException(
          `Class with name "${updateClassDto.name}" already exists in your school`,
        );
      }
    }

    const updatedClass = await this.prisma.class.update({
      where: { id },
      data: updateClassDto,
      include: {
        sections: {
          orderBy: { name: 'asc' },
        },
        _count: {
          select: {
            students: true,
            sections: true,
          },
        },
      },
    });

    return updatedClass;
  }

  /**
   * Delete class
   * Cannot delete if students exist
   */
  async remove(
    id: string,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ) {
    if (currentUser.role !== Role.SCHOOL_ADMIN) {
      throw new ForbiddenException('Only SCHOOL_ADMIN can delete classes');
    }

    if (!currentUser.schoolId) {
      throw new ForbiddenException(
        'School admin must be associated with a school',
      );
    }

    const classEntity = await this.prisma.class.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            students: true,
            sections: true,
          },
        },
      },
    });

    if (!classEntity) {
      throw new NotFoundException(`Class with ID ${id} not found`);
    }

    // Verify the class belongs to the school admin's school
    if (classEntity.schoolId !== currentUser.schoolId) {
      throw new ForbiddenException(
        'Access denied. You can only delete classes from your school',
      );
    }

    // Check if students exist
    if (classEntity._count.students > 0) {
      throw new BadRequestException(
        `Cannot delete class. ${classEntity._count.students} student(s) are enrolled in this class`,
      );
    }

    // Delete all sections first (cascade delete)
    if (classEntity._count.sections > 0) {
      await this.prisma.section.deleteMany({
        where: { classId: id },
      });
    }

    // Delete the class
    await this.prisma.class.delete({
      where: { id },
    });

    return {
      message: `Class "${classEntity.name}" has been deleted successfully`,
    };
  }
}
