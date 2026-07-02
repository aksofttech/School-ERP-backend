import {
  IsNotEmpty,
  IsString,
  IsEnum,
  IsOptional,
  IsDateString,
} from 'class-validator';

export enum ReportType {
  STUDENT = 'STUDENT',
  ATTENDANCE = 'ATTENDANCE',
  EXAM = 'EXAM',
  FEE = 'FEE',
}

export class GenerateReportDto {
  @IsEnum(ReportType)
  @IsNotEmpty()
  type: ReportType;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsString()
  @IsOptional()
  studentId?: string;
}
