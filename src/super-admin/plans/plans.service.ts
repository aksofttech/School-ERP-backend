import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import {
  PaginationDto,
  PaginatedResult,
} from '../../common/utils/pagination.dto';

@Injectable()
export class PlansService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createPlanDto: CreatePlanDto, userId: string, ip?: string) {
    const { name, description, price, duration } = createPlanDto;

    // Check if plan with same name already exists
    const existingPlan = await this.prisma.plan.findFirst({
      where: { name },
    });

    if (existingPlan) {
      throw new ConflictException('Plan with this name already exists');
    }

    return await this.prisma.$transaction(async (tx) => {
      const plan = await tx.plan.create({
        data: {
          name,
          description,
          price,
          duration,
          isActive: true,
        },
      });

      // Create audit log
      await tx.auditLog.create({
        data: {
          action: `Created plan: ${plan.name}`,
          userId,
          ip: ip || null,
        },
      });

      return plan;
    });
  }

  async findAll(paginationDto: PaginationDto): Promise<PaginatedResult<any>> {
    const { page = 1, limit = 10 } = paginationDto;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.plan.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.plan.count(),
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

  async findOne(id: string) {
    const plan = await this.prisma.plan.findUnique({
      where: { id },
    });

    if (!plan) {
      throw new NotFoundException(`Plan with ID ${id} not found`);
    }

    return plan;
  }

  async update(
    id: string,
    updatePlanDto: UpdatePlanDto,
    userId: string,
    ip?: string,
  ) {
    const plan = await this.prisma.plan.findUnique({
      where: { id },
    });

    if (!plan) {
      throw new NotFoundException(`Plan with ID ${id} not found`);
    }

    // Check if name is being updated and if it conflicts
    if (updatePlanDto.name && updatePlanDto.name !== plan.name) {
      const existingPlan = await this.prisma.plan.findFirst({
        where: {
          name: updatePlanDto.name,
          id: { not: id },
        },
      });

      if (existingPlan) {
        throw new ConflictException('Plan with this name already exists');
      }
    }

    return await this.prisma.$transaction(async (tx) => {
      const updatedPlan = await tx.plan.update({
        where: { id },
        data: updatePlanDto,
      });

      // Create audit log
      await tx.auditLog.create({
        data: {
          action: `Updated plan: ${updatedPlan.name}`,
          userId,
          ip: ip || null,
        },
      });

      return updatedPlan;
    });
  }

  async remove(id: string, userId: string, ip?: string) {
    const plan = await this.prisma.plan.findUnique({
      where: { id },
    });

    if (!plan) {
      throw new NotFoundException(`Plan with ID ${id} not found`);
    }

    return await this.prisma.$transaction(async (tx) => {
      await tx.plan.delete({
        where: { id },
      });

      // Create audit log
      await tx.auditLog.create({
        data: {
          action: `Deleted plan: ${plan.name}`,
          userId,
          ip: ip || null,
        },
      });

      return {
        message: `Plan ${plan.name} has been deleted`,
      };
    });
  }
}
