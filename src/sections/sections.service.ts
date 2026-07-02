import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSectionDto } from './dto/create-section.dto';
import { UpdateSectionDto } from './dto/update-section.dto';
import { Role } from '@prisma/client';

@Injectable()
export class SectionsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create section under a class
   * Only SCHOOL_ADMIN can create sections
   */
  async create(
    createSectionDto: CreateSectionDto,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ) {
    if (currentUser.role !== Role.SCHOOL_ADMIN) {
      throw new ForbiddenException('Only SCHOOL_ADMIN can create sections');
    }

    if (!currentUser.schoolId) {
      throw new ForbiddenException(
        'School admin must be associated with a school',
      );
    }

    const { name, classId } = createSectionDto;

    // Verify the class exists and belongs to the school
    const classEntity = await this.prisma.class.findUnique({
      where: { id: classId },
    });

    if (!classEntity) {
      throw new NotFoundException(`Class with ID ${classId} not found`);
    }

    if (classEntity.schoolId !== currentUser.schoolId) {
      throw new ForbiddenException(
        'Access denied. You can only create sections for classes in your school',
      );
    }

    // Check for duplicate section name in the same class
    const existingSection = await this.prisma.section.findFirst({
      where: {
        name,
        classId,
      },
    });

    if (existingSection) {
      throw new ConflictException(
        `Section with name "${name}" already exists in this class`,
      );
    }

    // Create section
    const section = await this.prisma.section.create({
      data: {
        name,
        classId,
        schoolId: currentUser.schoolId,
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
            students: true,
          },
        },
      },
    });

    return section;
  }

  /**
   * List all sections for a class
   */
  async findAllByClass(
    classId: string,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ) {
    if (currentUser.role !== Role.SCHOOL_ADMIN) {
      throw new ForbiddenException('Only SCHOOL_ADMIN can list sections');
    }

    if (!currentUser.schoolId) {
      throw new ForbiddenException(
        'School admin must be associated with a school',
      );
    }

    // Verify the class exists and belongs to the school
    const classEntity = await this.prisma.class.findUnique({
      where: { id: classId },
    });

    if (!classEntity) {
      throw new NotFoundException(`Class with ID ${classId} not found`);
    }

    if (classEntity.schoolId !== currentUser.schoolId) {
      throw new ForbiddenException(
        'Access denied. You can only access sections from classes in your school',
      );
    }

    const sections = await this.prisma.section.findMany({
      where: { classId },
      include: {
        _count: {
          select: {
            students: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return sections;
  }

  /**
   * Get section by ID
   */
  async findOne(
    id: string,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ) {
    if (currentUser.role !== Role.SCHOOL_ADMIN) {
      throw new ForbiddenException('Only SCHOOL_ADMIN can view sections');
    }

    if (!currentUser.schoolId) {
      throw new ForbiddenException(
        'School admin must be associated with a school',
      );
    }

    const section = await this.prisma.section.findUnique({
      where: { id },
      include: {
        class: {
          select: {
            id: true,
            name: true,
            schoolId: true,
          },
        },
        _count: {
          select: {
            students: true,
          },
        },
      },
    });

    if (!section) {
      throw new NotFoundException(`Section with ID ${id} not found`);
    }

    // Verify the section belongs to the school admin's school
    if (section.schoolId !== currentUser.schoolId) {
      throw new ForbiddenException(
        'Access denied. You can only access sections from your school',
      );
    }

    return section;
  }

  /**
   * Update section
   */
  async update(
    id: string,
    updateSectionDto: UpdateSectionDto,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ) {
    if (currentUser.role !== Role.SCHOOL_ADMIN) {
      throw new ForbiddenException('Only SCHOOL_ADMIN can update sections');
    }

    if (!currentUser.schoolId) {
      throw new ForbiddenException(
        'School admin must be associated with a school',
      );
    }

    const section = await this.prisma.section.findUnique({
      where: { id },
      include: {
        class: true,
      },
    });

    if (!section) {
      throw new NotFoundException(`Section with ID ${id} not found`);
    }

    // Verify the section belongs to the school admin's school
    if (section.schoolId !== currentUser.schoolId) {
      throw new ForbiddenException(
        'Access denied. You can only update sections from your school',
      );
    }

    // If name is being updated, check for duplicates in the same class
    if (updateSectionDto.name && updateSectionDto.name !== section.name) {
      const existingSection = await this.prisma.section.findFirst({
        where: {
          name: updateSectionDto.name,
          classId: section.classId,
          id: { not: id },
        },
      });

      if (existingSection) {
        throw new ConflictException(
          `Section with name "${updateSectionDto.name}" already exists in this class`,
        );
      }
    }

    const updatedSection = await this.prisma.section.update({
      where: { id },
      data: updateSectionDto,
      include: {
        class: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            students: true,
          },
        },
      },
    });

    return updatedSection;
  }

  /**
   * Delete section
   * Cannot delete if students exist
   */
  async remove(
    id: string,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ) {
    if (currentUser.role !== Role.SCHOOL_ADMIN) {
      throw new ForbiddenException('Only SCHOOL_ADMIN can delete sections');
    }

    if (!currentUser.schoolId) {
      throw new ForbiddenException(
        'School admin must be associated with a school',
      );
    }

    const section = await this.prisma.section.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            students: true,
          },
        },
        class: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!section) {
      throw new NotFoundException(`Section with ID ${id} not found`);
    }

    // Verify the section belongs to the school admin's school
    if (section.schoolId !== currentUser.schoolId) {
      throw new ForbiddenException(
        'Access denied. You can only delete sections from your school',
      );
    }

    // Check if students exist
    if (section._count.students > 0) {
      throw new BadRequestException(
        `Cannot delete section. ${section._count.students} student(s) are enrolled in this section`,
      );
    }

    await this.prisma.section.delete({
      where: { id },
    });

    return {
      message: `Section "${section.name}" has been deleted successfully`,
    };
  }
}
