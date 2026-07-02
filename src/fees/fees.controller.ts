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
} from '@nestjs/common';
import { FeesService } from './fees.service';
import { CreateFeeDto } from './dto/create-fee.dto';
import { UpdateFeeDto } from './dto/update-fee.dto';
import { ListFeesDto } from './dto/list-fees.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/user.decorator';
import { Role } from '@prisma/client';

@Controller('fees')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FeesController {
  constructor(private readonly feesService: FeesService) {}

  @Get('dashboard')
  @Roles(Role.SCHOOL_ADMIN)
  getDashboardStats(@CurrentUser() user: any) {
    return this.feesService.getDashboardStats({
      userId: user.userId,
      role: user.role,
      schoolId: user.schoolId,
    });
  }

  @Post()
  @Roles(Role.SCHOOL_ADMIN)
  create(@Body() createFeeDto: CreateFeeDto, @CurrentUser() user: any) {
    return this.feesService.create(createFeeDto, {
      userId: user.userId,
      role: user.role,
      schoolId: user.schoolId,
    });
  }

  @Get()
  @Roles(Role.SCHOOL_ADMIN, Role.PARENT)
  findAll(@Query() listFeesDto: ListFeesDto, @CurrentUser() user: any) {
    return this.feesService.findAll(listFeesDto, {
      userId: user.userId,
      role: user.role,
      schoolId: user.schoolId,
    });
  }

  @Get('student/:studentId/history')
  @Roles(Role.SCHOOL_ADMIN, Role.PARENT)
  getStudentFeeHistory(
    @Param('studentId') studentId: string,
    @CurrentUser() user: any,
  ) {
    return this.feesService.getStudentFeeHistory(studentId, {
      userId: user.userId,
      role: user.role,
      schoolId: user.schoolId,
    });
  }

  @Get(':id')
  @Roles(Role.SCHOOL_ADMIN, Role.PARENT)
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.feesService.findOne(id, {
      userId: user.userId,
      role: user.role,
      schoolId: user.schoolId,
    });
  }

  @Patch(':id')
  @Roles(Role.SCHOOL_ADMIN)
  update(
    @Param('id') id: string,
    @Body() updateFeeDto: UpdateFeeDto,
    @CurrentUser() user: any,
  ) {
    return this.feesService.update(id, updateFeeDto, {
      userId: user.userId,
      role: user.role,
      schoolId: user.schoolId,
    });
  }

  @Patch(':id/mark-paid')
  @Roles(Role.SCHOOL_ADMIN)
  markAsPaid(@Param('id') id: string, @CurrentUser() user: any) {
    return this.feesService.markAsPaid(id, {
      userId: user.userId,
      role: user.role,
      schoolId: user.schoolId,
    });
  }

  @Delete(':id')
  @Roles(Role.SCHOOL_ADMIN)
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.feesService.remove(id, {
      userId: user.userId,
      role: user.role,
      schoolId: user.schoolId,
    });
  }
}
