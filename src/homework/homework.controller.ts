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
import { HomeworkService } from './homework.service';
import { CreateHomeworkDto } from './dto/create-homework.dto';
import { UpdateHomeworkDto } from './dto/update-homework.dto';
import { ListHomeworkDto } from './dto/list-homework.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/user.decorator';
import { Role } from '@prisma/client';

@Controller('homework')
@UseGuards(JwtAuthGuard, RolesGuard)
export class HomeworkController {
  constructor(private readonly homeworkService: HomeworkService) {}

  @Post()
  @Roles(Role.TEACHER, Role.SCHOOL_ADMIN, Role.SUPER_ADMIN)
  create(
    @Body() createHomeworkDto: CreateHomeworkDto,
    @CurrentUser() user: any,
  ) {
    return this.homeworkService.create(createHomeworkDto, {
      userId: user.userId,
      role: user.role,
      schoolId: user.schoolId,
    });
  }

  @Get()
  @Roles(Role.TEACHER, Role.STUDENT, Role.SCHOOL_ADMIN, Role.SUPER_ADMIN)
  findAll(@Query() listHomeworkDto: ListHomeworkDto, @CurrentUser() user: any) {
    return this.homeworkService.findAll(listHomeworkDto, {
      userId: user.userId,
      role: user.role,
      schoolId: user.schoolId,
    });
  }

  @Get('class/:classId')
  @Roles(Role.TEACHER, Role.STUDENT, Role.SCHOOL_ADMIN, Role.SUPER_ADMIN)
  findByClass(@Param('classId') classId: string, @CurrentUser() user: any) {
    return this.homeworkService.findByClass(classId, {
      userId: user.userId,
      role: user.role,
      schoolId: user.schoolId,
    });
  }

  @Get(':id')
  @Roles(Role.TEACHER, Role.STUDENT, Role.SCHOOL_ADMIN, Role.SUPER_ADMIN)
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.homeworkService.findOne(id, {
      userId: user.userId,
      role: user.role,
      schoolId: user.schoolId,
    });
  }

  @Patch(':id')
  @Roles(Role.TEACHER, Role.SCHOOL_ADMIN, Role.SUPER_ADMIN)
  update(
    @Param('id') id: string,
    @Body() updateHomeworkDto: UpdateHomeworkDto,
    @CurrentUser() user: any,
  ) {
    return this.homeworkService.update(id, updateHomeworkDto, {
      userId: user.userId,
      role: user.role,
      schoolId: user.schoolId,
    });
  }

  @Delete(':id')
  @Roles(Role.TEACHER, Role.SCHOOL_ADMIN, Role.SUPER_ADMIN)
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.homeworkService.remove(id, {
      userId: user.userId,
      role: user.role,
      schoolId: user.schoolId,
    });
  }
}
