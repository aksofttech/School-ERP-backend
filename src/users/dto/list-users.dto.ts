import { IsOptional, IsEnum, IsUUID, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { Role } from '../../common/enums';
import { PaginationDto } from '../../common/utils/pagination.dto';

export class ListUsersDto extends PaginationDto {
  @IsOptional()
  @IsEnum(Role)
  @Type(() => String)
  role?: Role;

  @IsOptional()
  @IsUUID()
  schoolId?: string;

  @IsOptional()
  @IsString()
  search?: string;
}
