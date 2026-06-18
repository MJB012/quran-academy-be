// Sends live samples of the actual OTP email template (signup + reset) so you
// can see how they render in a real inbox.
// Usage: node scripts/send-otp-sample.js [recipient@example.com]
require('dotenv').config();
const nodemailer = require('nodemailer');

const user = (process.env.MAIL_USER || '').trim();
const pass = (process.env.MAIL_PASSWORD || '').replace(/['"]/g, '').replace(/\s+/g, '');
const from = process.env.MAIL_FROM || `Quran Academy <${user}>`;
const to = process.argv[2] || 'jamilbashir012@gmail.com';

const port = Number(process.env.MAIL_PORT || 465);
const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST || 'smtp.gmail.com',
  port,
  secure: process.env.MAIL_SECURE ? process.env.MAIL_SECURE === 'true' : port === 465,
  auth: { user, pass },
});

// Mirrors MailService.buildHtml exactly.
function buildHtml(heading, intro, code) {
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

const samples = [
  {
    subject: 'Verify your email address',
    heading: 'Welcome to Quran Academy',
    intro: 'Use the code below to verify your email address. It expires in 10 minutes.',
    code: '482915',
  },
  {
    subject: 'Your password reset code',
    heading: 'Reset your password',
    intro: 'Use the code below to reset your password. It expires in 10 minutes.',
    code: '739204',
  },
];

(async () => {
  try {
    await transporter.verify();
    console.log(`SMTP OK as ${user}. Sending ${samples.length} sample(s) to ${to}...`);
    for (const s of samples) {
      const info = await transporter.sendMail({
        from,
        to,
        subject: s.subject,
        text: `${s.heading}\n\n${s.intro}\n\nYour code: ${s.code}\n\nIf you did not request this, you can ignore this email.`,
        html: buildHtml(s.heading, s.intro, s.code),
      });
      console.log(`✅ Sent "${s.subject}" — messageId: ${info.messageId}`);
    }
  } catch (err) {
    console.error('❌ FAILED:', err && err.message ? err.message : err);
    process.exit(1);
  }
})();
