import { IsNotEmpty, IsArray, IsUUID } from 'class-validator';

export class AssignSubjectsDto {
  @IsArray()
  @IsUUID(undefined, { each: true })
  @IsNotEmpty()
  subjectIds: string[];
}
