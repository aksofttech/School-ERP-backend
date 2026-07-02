import { IsOptional, IsUUID, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export class AttendanceReportDto {
  @IsOptional()
  @IsUUID()
  @Type(() => String)
  studentId?: string;

  @IsOptional()
  @IsUUID()
  @Type(() => String)
  classId?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
