class MailService {
  async sendPasswordResetEmail({ to, name, resetLink }) {
    if (!process.env.BREVO_API_KEY) {
      console.log('Link de redefinição de senha:', resetLink);
      return;
    }

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'api-key': process.env.BREVO_API_KEY,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        sender: {
          name: 'SpotCheckList',
          email: 'andersonchecklist@gmail.com'
        },
        to: [
          {
            email: to,
            name: name || to
          }
        ],
        subject: 'Redefinição de senha - SpotCheckList',
        htmlContent: `
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

              <p style="color:#b7c0cd; font-size:13px;">
                Se você não solicitou esta alteração, ignore este e-mail.
              </p>
            </div>
          </div>
        `
      })
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      console.error('Erro Brevo:', data);
      throw new Error(data?.message || 'Erro ao enviar e-mail de redefinição.');
    }

    return data;
  }
}

module.exports = new MailService();