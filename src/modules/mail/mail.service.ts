import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export type OtpPurposeKind = 'signup' | 'reset';

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    const user = this.config.get<string>('MAIL_USER')?.trim();
    // Gmail app passwords are shown in 4 space-separated groups; SMTP needs them
    // with no spaces (and we strip any stray quotes), so normalise defensively.
    const pass = this.config
      .get<string>('MAIL_PASSWORD')
      ?.replace(/['"]/g, '')
      .replace(/\s+/g, '');
    this.from =
      this.config.get<string>('MAIL_FROM') ??
      (user ? `Quran Academy <${user}>` : 'Quran Academy <no-reply@quran-academy.app>');

    if (!user || !pass) {
      this.logger.warn(
        'MAIL_USER / MAIL_PASSWORD not set — emails will be logged instead of sent.',
      );
      return;
    }

    const port = Number(this.config.get<string>('MAIL_PORT') ?? 465);
    this.transporter = nodemailer.createTransport({
      host: this.config.get<string>('MAIL_HOST') ?? 'smtp.gmail.com',
      port,
      // Port 465 uses implicit TLS; 587 uses STARTTLS.
      secure: this.config.get<string>('MAIL_SECURE')
        ? this.config.get<string>('MAIL_SECURE') === 'true'
        : port === 465,
      auth: { user, pass },
    });
  }

  /** Verify SMTP credentials at startup so misconfiguration is obvious in logs. */
  async onModuleInit(): Promise<void> {
    if (!this.transporter) return;
    try {
      await this.transporter.verify();
      this.logger.log('SMTP connection verified — OTP emails are enabled.');
    } catch (err) {
      this.logger.error(
        'SMTP verification FAILED — check MAIL_USER / MAIL_PASSWORD (Gmail app password) and that 2FA is enabled.',
        err as Error,
      );
    }
  }

  /** True when SMTP credentials are configured and emails are actually sent. */
  get isEnabled(): boolean {
    return this.transporter !== null;
  }

  async sendOtp(to: string, code: string, purpose: OtpPurposeKind): Promise<void> {
    const subject =
      purpose === 'reset' ? 'Your password reset code' : 'Verify your email address';
    const heading =
      purpose === 'reset' ? 'Reset your password' : 'Welcome to Quran Academy';
    const intro =
      purpose === 'reset'
        ? 'Use the code below to reset your password. It expires in 10 minutes.'
        : 'Use the code below to verify your email address. It expires in 10 minutes.';

    if (!this.transporter) {
      this.logger.log(`[MAIL DISABLED] OTP for ${to} (${purpose}): ${code}`);
      return;
    }

    try {
      await this.transporter.sendMail({
        from: this.from,
        to,
        subject,
        text: `${heading}\n\n${intro}\n\nYour code: ${code}\n\nIf you did not request this, you can ignore this email.`,
        html: this.buildHtml(heading, intro, code),
      });
      this.logger.log(`OTP email sent to ${to} (${purpose})`);
    } catch (err) {
      this.logger.error(`Failed to send OTP email to ${to}`, err as Error);
      throw err;
    }
  }

  private buildHtml(heading: string, intro: string, code: string): string {
    return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#0F1B17;">
    <h2 style="color:#0FA678;margin:0 0 16px;">${heading}</h2>
    <p style="font-size:15px;line-height:1.5;color:#334155;margin:0 0 24px;">${intro}</p>
    <div style="background:#EAF7F1;border-radius:12px;text-align:center;padding:20px;margin-bottom:24px;">
      <span style="font-size:32px;font-weight:700;letter-spacing:8px;color:#0FA678;">${code}</span>
    </div>
    <p style="font-size:13px;color:#94A3B8;margin:0;">If you didn't request this, you can safely ignore this email.</p>
  </div>`;
  }
}
