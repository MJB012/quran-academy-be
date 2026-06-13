import { IsEmail, IsEnum, IsString, Length, Matches } from 'class-validator';
import { OtpPurpose } from '../schemas/otp.schema';

export class VerifyOtpDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/, { message: 'Code must be 6 digits' })
  code!: string;

  @IsEnum(OtpPurpose)
  purpose!: OtpPurpose;
}
