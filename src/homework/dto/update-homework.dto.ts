import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateHomeworkDto } from './create-homework.dto';

export class UpdateHomeworkDto extends PartialType(
  OmitType(CreateHomeworkDto, ['classId', 'subjectId'] as const),
) {}
