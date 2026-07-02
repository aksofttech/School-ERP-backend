import { IsOptional, IsUUID, IsString } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { PaginationDto } from '../../common/utils/pagination.dto';

export class ListStudentsDto extends PaginationDto {
  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsUUID()
  classId?: string;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsUUID()
  sectionId?: string;

  @IsOptional()
  @IsString()
  search?: string;
}
