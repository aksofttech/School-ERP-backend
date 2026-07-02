import { IsOptional, IsUUID, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../common/utils/pagination.dto';
import { FeeStatus } from '@prisma/client';

export class ListFeesDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  @Type(() => String)
  studentId?: string;

  @IsOptional()
  @IsEnum(FeeStatus)
  status?: FeeStatus;
}
