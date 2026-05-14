const nodemailer = require('nodemailer');

function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || 'false') === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

class MailService {
  async sendPasswordResetEmail({ to, name, resetLink }) {
    if (
      !process.env.SMTP_HOST ||
      !process.env.SMTP_USER ||
      !process.env.SMTP_PASS ||
      !process.env.SMTP_FROM
    ) {
      console.log('Link de redefinição de senha:', resetLink);
      return;
    }

    const transporter = getTransporter();

    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to,
      subject: 'Redefinição de senha - SpotCheckList',
      html: `
        <div style="font-family: Arial, sans-serif; background:#151922; padding:24px;">
          <div style="max-width:560px; margin:auto; background:#1f2530; border-radius:18px; padding:24px; color:#ffffff;">
            <h1 style="color:#f4f66b; margin-top:0;">SpotCheckList</h1>
            <p>Olá, ${name || 'usuário'}.</p>
            <p>Recebemos uma solicitação para redefinir sua senha.</p>
            <p>Clique no botão abaixo para criar uma nova senha:</p>
            <p style="margin:28px 0;">
              <a href="${resetLink}" style="background:#f4f66b; color:#111827; padding:14px 20px; border-radius:12px; text-decoration:none; font-weight:bold;">
                Redefinir senha
              </a>
            </p>
            <p>Este link expira em 30 minutos.</p>
            <p style="color:#b7c0cd; font-size:13px;">Se você não solicitou esta alteração, ignore este e-mail.</p>
          </div>
        </div>
      `
    });
  }
}

module.exports = new MailService();