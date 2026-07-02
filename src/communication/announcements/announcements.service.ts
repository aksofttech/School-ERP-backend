import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';
import { Role } from '@prisma/client';

@Injectable()
export class AnnouncementsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    createAnnouncementDto: CreateAnnouncementDto,
    currentUser: {
      userId: string;
      firstName: string;
      lastName: string;
      role: Role;
    },
  ) {
    if (
      currentUser.role !== Role.SCHOOL_ADMIN &&
      currentUser.role !== Role.TEACHER
    ) {
      throw new ForbiddenException(
        'Only admins and teachers can create announcements',
      );
    }

    const { classId, ...data } = createAnnouncementDto;

    return this.prisma.announcement.create({
      data: {
        ...data,
        classId,
        authorId: currentUser.userId,
        authorName: `${currentUser.firstName} ${currentUser.lastName}`,
      },
    });
  }

  async findAll(query: { classId?: string; allSchool?: boolean }) {
    const { classId, allSchool } = query;
    const where: any = {};

    if (allSchool !== undefined) {
      where.allSchool = allSchool;
    }

    if (classId) {
      where.OR = [{ classId }, { allSchool: true }];
    }

    return this.prisma.announcement.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        class: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async findOne(id: string) {
    const announcement = await this.prisma.announcement.findUnique({
      where: { id },
      include: {
        class: true,
      },
    });

    if (!announcement) {
      throw new NotFoundException(`Announcement with ID ${id} not found`);
    }

    return announcement;
  }

  async update(id: string, updateAnnouncementDto: UpdateAnnouncementDto) {
    await this.findOne(id);

    return this.prisma.announcement.update({
      where: { id },
      data: updateAnnouncementDto,
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    await this.prisma.announcement.delete({
      where: { id },
    });

    return { message: 'Announcement deleted successfully' };
  }
}
