import { IsOptional, IsUUID, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { DayOfWeek } from '@prisma/client';

export class ViewTimetableDto {
  @IsOptional()
  @IsUUID()
  @Type(() => String)
  classId?: string;

  @IsOptional()
  @IsEnum(DayOfWeek)
  day?: DayOfWeek;
}
