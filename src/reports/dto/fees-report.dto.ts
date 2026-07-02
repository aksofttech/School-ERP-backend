import { IsOptional, IsUUID, IsDateString, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { FeeStatus } from '@prisma/client';

export class FeesReportDto {
  @IsOptional()
  @IsUUID()
  @Type(() => String)
  studentId?: string;

  @IsOptional()
  @IsUUID()
  @Type(() => String)
  classId?: string;

  @IsOptional()
  @IsEnum(FeeStatus)
  status?: FeeStatus;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
