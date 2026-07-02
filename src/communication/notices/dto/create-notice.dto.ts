import {
  IsNotEmpty,
  IsString,
  IsEnum,
  IsOptional,
  IsUUID,
  IsDateString,
} from 'class-validator';
import { NoticeAudience, NoticeStatus } from '@prisma/client';

export class CreateNoticeDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  content: string;

  @IsEnum(NoticeAudience)
  @IsOptional()
  audience?: NoticeAudience;

  @IsEnum(NoticeStatus)
  @IsOptional()
  status?: NoticeStatus;

  @IsDateString()
  @IsOptional()
  publishDate?: string;

  @IsOptional()
  attachments?: any;

  @IsUUID()
  @IsOptional()
  classId?: string; // Optional: target specific class
}
