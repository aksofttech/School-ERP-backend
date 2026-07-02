import { IsNotEmpty, IsArray, IsUUID } from 'class-validator';

export class MapStudentsDto {
  @IsArray()
  @IsUUID(undefined, { each: true })
  @IsNotEmpty()
  studentIds: string[];
}
