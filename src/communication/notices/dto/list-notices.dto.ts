import { IsOptional, IsEnum, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../../common/utils/pagination.dto';
import { NoticeAudience } from '@prisma/client';

export class ListNoticesDto extends PaginationDto {
  @IsOptional()
  @IsEnum(NoticeAudience)
  audience?: NoticeAudience;

  @IsOptional()
  @IsUUID()
  @Type(() => String)
  classId?: string;
}
