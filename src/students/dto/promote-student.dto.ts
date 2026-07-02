import { IsArray, IsNotEmpty, IsString } from 'class-validator';

export class PromoteStudentsDto {
  @IsArray()
  @IsNotEmpty()
  studentIds: string[];

  @IsString()
  @IsNotEmpty()
  targetClassId: string;
}
