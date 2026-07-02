import { IsNotEmpty, IsString, IsOptional, IsUUID } from 'class-validator';

export class CreateSubjectDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  code: string;

  @IsUUID()
  @IsOptional()
  teacherId?: string;
}
