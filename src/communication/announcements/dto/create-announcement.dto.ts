import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsBoolean,
  IsDateString,
  IsUUID,
} from 'class-validator';
import { NotificationType, Priority } from '@prisma/client';

export class CreateAnnouncementDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  content: string;

  @IsEnum(NotificationType)
  @IsOptional()
  type?: NotificationType;

  @IsEnum(Priority)
  @IsOptional()
  priority?: Priority;

  @IsBoolean()
  @IsOptional()
  allSchool?: boolean;

  @IsUUID()
  @IsOptional()
  classId?: string;

  @IsString()
  @IsOptional()
  attachment?: string;

  @IsDateString()
  @IsOptional()
  expiresAt?: string;
}
