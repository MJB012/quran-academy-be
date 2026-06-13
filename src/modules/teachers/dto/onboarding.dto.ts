import { ArrayMinSize, IsArray, IsNumber, IsOptional, IsPositive, IsString, MaxLength, MinLength } from 'class-validator';

export class TeacherOnboardingDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  specializations!: string[];

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  languages!: string[];

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  qualification!: string;

  @IsNumber()
  @IsPositive()
  hourlyRate!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;
}
