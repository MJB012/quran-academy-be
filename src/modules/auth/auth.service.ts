import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { Model, Types } from 'mongoose';
import { MailService } from '../mail/mail.service';
import { TeachersService } from '../teachers/teachers.service';
import { UsersService } from '../users/users.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SignupDto } from './dto/signup.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { Otp, OtpDocument, OtpPurpose } from './schemas/otp.schema';
import { JwtPayload } from './strategies/jwt.strategy';

const OTP_TTL_MINUTES = 10;
const BCRYPT_ROUNDS = 10;

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
    private readonly teachers: TeachersService,
    @InjectModel(Otp.name) private readonly otpModel: Model<OtpDocument>,
  ) {}

  /**
   * Whether to expose the OTP code in API responses. We only do this when email
   * delivery is NOT configured (so the demo/dev flow keeps working). Once SMTP
   * credentials are set, the code is delivered by email only.
   */
  private get exposeOtp(): boolean {
    return !this.mail.isEnabled;
  }

  async signup(dto: SignupDto) {
    const password = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.users.create({
      email: dto.email,
      password,
      firstName: dto.firstName,
      lastName: dto.lastName,
      dob: new Date(dto.dob),
      role: dto.role,
    });
    const code = await this.createOtp((user._id as Types.ObjectId).toString(), OtpPurpose.SIGNUP);
    await this.mail.sendOtp(user.email, code, 'signup');
    return {
      user: user.toJSON(),
      // Only returned when email delivery is disabled (dev/demo). With SMTP
      // configured, the code is delivered by email only.
      ...(this.exposeOtp ? { otp: code } : {}),
    };
  }

  async login(dto: LoginDto) {
    const user = await this.users.findByEmailWithPassword(dto.email);
    if (!user) throw new UnauthorizedException('Invalid email or password');

    const ok = await bcrypt.compare(dto.password, user.password);
    if (!ok) throw new UnauthorizedException('Invalid email or password');

    const tokens = await this.issueTokens({
      sub: (user._id as Types.ObjectId).toString(),
      email: user.email,
      role: user.role,
    });
    return { user: user.toJSON(), ...tokens };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.users.findByEmail(dto.email);
    if (user) {
      const code = await this.createOtp((user._id as Types.ObjectId).toString(), OtpPurpose.RESET);
      await this.mail.sendOtp(user.email, code, 'reset');
      return { sent: true, ...(this.exposeOtp ? { otp: code } : {}) };
    }
    return { sent: true };
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const user = await this.users.findByEmail(dto.email);
    if (!user) throw new BadRequestException('Invalid code');

    const otp = await this.findActiveOtp((user._id as Types.ObjectId).toString(), dto.purpose);
    if (!otp) throw new BadRequestException('Invalid or expired code');

    const ok = await bcrypt.compare(dto.code, otp.codeHash);
    if (!ok) throw new BadRequestException('Invalid code');

    otp.consumedAt = new Date();
    await otp.save();

    if (dto.purpose === OtpPurpose.SIGNUP) {
      const verifiedUserId = (user._id as Types.ObjectId).toString();
      await this.users.markEmailVerified(verifiedUserId);
      // If a teacher just verified their email and is already onboarded,
      // announce their availability to students in real time.
      await this.teachers.broadcastIfTeacherVisible(verifiedUserId);
      const tokens = await this.issueTokens({
        sub: (user._id as Types.ObjectId).toString(),
        email: user.email,
        role: user.role,
      });
      return { verified: true, user: user.toJSON(), ...tokens };
    }
    return { verified: true };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.users.findByEmail(dto.email);
    if (!user) throw new BadRequestException('Invalid request');

    const otp = await this.findActiveOtp((user._id as Types.ObjectId).toString(), OtpPurpose.RESET);
    if (!otp) throw new BadRequestException('Invalid or expired code');

    const ok = await bcrypt.compare(dto.code, otp.codeHash);
    if (!ok) throw new BadRequestException('Invalid code');

    const password = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    await this.users.setPassword((user._id as Types.ObjectId).toString(), password);

    otp.consumedAt = new Date();
    await otp.save();

    return { reset: true };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.users.findByIdWithPassword(userId);
    const ok = await bcrypt.compare(dto.currentPassword, user.password);
    if (!ok) throw new BadRequestException('Current password is incorrect');

    const password = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    await this.users.setPassword(userId, password);
    return { changed: true };
  }

  async refresh(dto: RefreshTokenDto) {
    try {
      const payload = await this.jwt.verifyAsync<JwtPayload>(dto.refreshToken, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
      const tokens = await this.issueTokens({
        sub: payload.sub,
        email: payload.email,
        role: payload.role,
      });
      return tokens;
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private async issueTokens(payload: JwtPayload) {
    const accessToken = await this.jwt.signAsync(
      { ...payload },
      {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: (this.config.get<string>('JWT_ACCESS_EXPIRES_IN') ?? '15m') as unknown as number,
      },
    );
    const refreshToken = await this.jwt.signAsync(
      { ...payload },
      {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: (this.config.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '30d') as unknown as number,
      },
    );
    return { accessToken, refreshToken };
  }

  private async createOtp(userId: string, purpose: OtpPurpose): Promise<string> {
    await this.otpModel.deleteMany({ userId: new Types.ObjectId(userId), purpose, consumedAt: { $exists: false } });
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const codeHash = await bcrypt.hash(code, BCRYPT_ROUNDS);
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60_000);
    await this.otpModel.create({
      userId: new Types.ObjectId(userId),
      codeHash,
      purpose,
      expiresAt,
    });
    return code;
  }

  private async findActiveOtp(userId: string, purpose: OtpPurpose): Promise<OtpDocument | null> {
    return this.otpModel
      .findOne({
        userId: new Types.ObjectId(userId),
        purpose,
        consumedAt: { $exists: false },
        expiresAt: { $gt: new Date() },
      })
      .sort({ createdAt: -1 });
  }
}
