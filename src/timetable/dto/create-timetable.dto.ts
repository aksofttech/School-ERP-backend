import {
  IsNotEmpty,
  IsString,
  IsUUID,
  IsEnum,
  IsOptional,
  Matches,
} from 'class-validator';
import { DayOfWeek } from '@prisma/client';

export class CreateTimetableDto {
  @IsUUID()
  @IsNotEmpty()
  classId: string;

  @IsEnum(DayOfWeek)
  @IsNotEmpty()
  day: DayOfWeek;

  @IsString()
  @IsNotEmpty()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'startTime must be in format HH:mm (e.g., 09:00)',
  })
  startTime: string; // Format: HH:mm

  @IsString()
  @IsNotEmpty()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'endTime must be in format HH:mm (e.g., 10:00)',
  })
  endTime: string; // Format: HH:mm

  @IsUUID()
  @IsNotEmpty()
  subjectId: string;

  @IsUUID()
  @IsNotEmpty()
  teacherId: string;

  @IsString()
  @IsOptional()
  room?: string;
}
