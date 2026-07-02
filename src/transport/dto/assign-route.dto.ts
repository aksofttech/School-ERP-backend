import { IsNotEmpty, IsUUID, IsArray } from 'class-validator';

export class AssignRouteDto {
  @IsUUID()
  @IsNotEmpty()
  vehicleId: string;

  @IsArray()
  @IsUUID('4', { each: true })
  @IsNotEmpty()
  studentIds: string[];
}
