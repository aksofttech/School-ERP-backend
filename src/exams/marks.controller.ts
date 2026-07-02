import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { MarksService } from './marks.service';
import { CreateMarkDto } from './dto/create-mark.dto';
import { UpdateMarkDto } from './dto/update-mark.dto';
import { BulkMarksDto } from './dto/bulk-marks.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/user.decorator';
import { Role } from '@prisma/client';

@Controller('marks')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MarksController {
  constructor(private readonly marksService: MarksService) {}

  @Post()
  @Roles(Role.SCHOOL_ADMIN, Role.TEACHER)
  create(@Body() createMarkDto: CreateMarkDto, @CurrentUser() user: any) {
    return this.marksService.create(createMarkDto, {
      userId: user.userId,
      role: user.role,
      schoolId: user.schoolId,
    });
  }

  @Post('bulk')
  @Roles(Role.SCHOOL_ADMIN, Role.TEACHER)
  createBulk(@Body() bulkMarksDto: BulkMarksDto, @CurrentUser() user: any) {
    return this.marksService.createBulk(bulkMarksDto, {
      userId: user.userId,
      role: user.role,
      schoolId: user.schoolId,
    });
  }

  @Get('exam/:examId')
  @Roles(Role.SCHOOL_ADMIN, Role.TEACHER, Role.STUDENT, Role.PARENT)
  findAll(@Param('examId') examId: string, @CurrentUser() user: any) {
    return this.marksService.findAll(examId, {
      userId: user.userId,
      role: user.role,
      schoolId: user.schoolId,
    });
  }

  @Get(':id')
  @Roles(Role.SCHOOL_ADMIN, Role.TEACHER, Role.STUDENT, Role.PARENT)
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.marksService.findOne(id, {
      userId: user.userId,
      role: user.role,
      schoolId: user.schoolId,
    });
  }

  @Patch(':id')
  @Roles(Role.SCHOOL_ADMIN, Role.TEACHER)
  update(
    @Param('id') id: string,
    @Body() updateMarkDto: UpdateMarkDto,
    @CurrentUser() user: any,
  ) {
    return this.marksService.update(id, updateMarkDto, {
      userId: user.userId,
      role: user.role,
      schoolId: user.schoolId,
    });
  }

  @Delete(':id')
  @Roles(Role.SCHOOL_ADMIN, Role.TEACHER)
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.marksService.remove(id, {
      userId: user.userId,
      role: user.role,
      schoolId: user.schoolId,
    });
  }
}
