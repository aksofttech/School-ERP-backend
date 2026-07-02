import { IsOptional, IsUUID, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { ExamType } from '@prisma/client';

export class ExamsReportDto {
  @IsOptional()
  @IsUUID()
  @Type(() => String)
  studentId?: string;

  @IsOptional()
  @IsUUID()
  @Type(() => String)
  classId?: string;

  @IsOptional()
  @IsUUID()
  @Type(() => String)
  examId?: string;

  @IsOptional()
  @IsEnum(ExamType)
  examType?: ExamType;
}
