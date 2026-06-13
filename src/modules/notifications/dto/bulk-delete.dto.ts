import { ArrayMinSize, IsArray, IsMongoId } from 'class-validator';

export class BulkDeleteDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsMongoId({ each: true })
  ids!: string[];
}
