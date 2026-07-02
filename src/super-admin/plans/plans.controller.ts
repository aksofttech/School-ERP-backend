import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { PlansService } from './plans.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { PaginationDto } from '../../common/utils/pagination.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../../common/guards/roles.guard';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/user.decorator';

@Controller('super-admin/plans')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  @Post()
  create(
    @Body() createPlanDto: CreatePlanDto,
    @CurrentUser() user: any,
    @Request() req: any,
  ) {
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    return this.plansService.create(createPlanDto, user.userId, ip);
  }

  @Get()
  findAll(@Query() paginationDto: PaginationDto) {
    return this.plansService.findAll(paginationDto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.plansService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updatePlanDto: UpdatePlanDto,
    @CurrentUser() user: any,
    @Request() req: any,
  ) {
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    return this.plansService.update(id, updatePlanDto, user.userId, ip);
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Request() req: any,
  ) {
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    return this.plansService.remove(id, user.userId, ip);
  }
}
