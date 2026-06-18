// Standalone SMTP test: verifies the mail credentials in .env and sends a test email.
// Usage: node scripts/test-mail.js [recipient@example.com]
require('dotenv').config();
const nodemailer = require('nodemailer');

const user = (process.env.MAIL_USER || '').trim();
const pass = (process.env.MAIL_PASSWORD || '').replace(/['"]/g, '').replace(/\s+/g, '');
const to = process.argv[2] || user;

if (!user || !pass) {
  console.error('MAIL_USER / MAIL_PASSWORD missing in .env');
  process.exit(1);
}

const port = Number(process.env.MAIL_PORT || 465);
const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST || 'smtp.gmail.com',
  port,
  secure: process.env.MAIL_SECURE ? process.env.MAIL_SECURE === 'true' : port === 465,
  auth: { user, pass },
});

(async () => {
  try {
    console.log(`Verifying SMTP as ${user} (pass length: ${pass.length})...`);
    await transporter.verify();
    console.log('✅ SMTP auth OK. Sending test email to', to);
    const info = await transporter.sendMail({
      from: process.env.MAIL_FROM || `Quran Academy <${user}>`,
      to,
      subject: 'Quran Academy SMTP test',
      text: 'If you can read this, OTP emails will work. Code: 123456',
    });
    console.log('✅ Sent. messageId:', info.messageId);
  } catch (err) {
    console.error('❌ SMTP FAILED:', err && err.message ? err.message : err);
    if (err && err.response) console.error('Server said:', err.response);
    process.exit(1);
  }
})();
