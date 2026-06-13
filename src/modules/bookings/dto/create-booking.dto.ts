import { IsDateString, IsIn, IsMongoId, IsNotEmpty, IsString } from 'class-validator';

export class CreateBookingDto {
  @IsMongoId()
  teacherId!: string;

  @IsDateString()
  date!: string;

  @IsString()
  @IsNotEmpty()
  timeSlot!: string;

  @IsIn([30, 60, 90])
  durationMins!: number;

  @IsString()
  @IsNotEmpty()
  subject!: string;
}
