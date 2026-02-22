// services/emailService.js
// Service d'envoi d'emails pour Discado
const nodemailer = require('nodemailer');

// Configuration du transporteur SMTP (Gmail)
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.SMTP_USER || 'catalog.discado@gmail.com',
        pass: process.env.SMTP_PASS || ''  // App Password Gmail requis
    }
});

const FROM_EMAIL = process.env.SMTP_FROM || 'catalog.discado@gmail.com';
const APP_NAME = 'Discado';

const emailService = {
    /**
     * Envoyer un email de réinitialisation de mot de passe
     * @param {string} toEmail - Adresse email du destinataire
     * @param {string} resetToken - Token de réinitialisation
     * @param {string} baseUrl - URL de base de l'application (ex: https://catalog.discado.ch)
     */
    async sendPasswordResetEmail(toEmail, resetToken, baseUrl) {
        const resetLink = `${baseUrl}/pages/reset-password.html?token=${resetToken}`;

        const mailOptions = {
            from: `"${APP_NAME}" <${FROM_EMAIL}>`,
            to: toEmail,
            subject: `${APP_NAME} — Password Reset Request`,
            html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0; padding:0; background:#f4f4f7; font-family: 'Inter', Arial, sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7; padding:40px 0;">
        <tr>
            <td align="center">
                <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff; border-radius:12px; box-shadow:0 2px 12px rgba(0,0,0,0.08); overflow:hidden; max-width:92%;">
                    <!-- Header -->
                    <tr>
                        <td style="background:linear-gradient(135deg, #e9394f, #ff4d5e); padding:32px 40px; text-align:center;">
                            <h1 style="color:#ffffff; margin:0; font-size:24px; font-weight:700; letter-spacing:0.5px;">${APP_NAME}</h1>
                        </td>
                    </tr>
                    <!-- Body -->
                    <tr>
                        <td style="padding:36px 40px 20px;">
                            <h2 style="color:#333; margin:0 0 16px; font-size:20px; font-weight:600;">Password Reset</h2>
                            <p style="color:#666; font-size:15px; line-height:1.6; margin:0 0 24px;">
                                You requested a password reset for your Discado account.
                                Click the button below to set a new password.
                            </p>
                            <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td align="center" style="padding:8px 0 24px;">
                                        <a href="${resetLink}" 
                                           style="display:inline-block; background:linear-gradient(135deg, #e9394f, #ff4d5e); color:#ffffff; text-decoration:none; padding:14px 36px; border-radius:8px; font-size:15px; font-weight:600; letter-spacing:0.5px; text-transform:uppercase;">
                                            Reset My Password
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            <p style="color:#999; font-size:13px; line-height:1.5; margin:0 0 16px;">
                                This link expires in <strong>1 hour</strong>. If you did not request a password reset, please ignore this email.
                            </p>
                            <hr style="border:none; border-top:1px solid #eee; margin:24px 0;">
                            <p style="color:#bbb; font-size:12px; line-height:1.5; margin:0;">
                                If the button doesn't work, copy and paste this link into your browser:<br>
                                <a href="${resetLink}" style="color:#e9394f; word-break:break-all;">${resetLink}</a>
                            </p>
                        </td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                        <td style="padding:20px 40px 28px; text-align:center;">
                            <p style="color:#ccc; font-size:11px; margin:0;">&copy; ${APP_NAME} — Professional Portal</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
            `,
            text: `${APP_NAME} — Password Reset\n\nYou requested a password reset for your account.\nClick this link to set a new password:\n${resetLink}\n\nThis link expires in 1 hour.\n\nIf you did not request a password reset, please ignore this email.`
        };

        try {
            const info = await transporter.sendMail(mailOptions);
            console.log(`✅ Password reset email sent to ${toEmail} (${info.messageId})`);
            return { success: true, messageId: info.messageId };
        } catch (error) {
            console.error('❌ Error sending password reset email:', error.message);
            throw new Error('Unable to send email. Please try again later.');
        }
    },

    /**
     * Vérifier la connexion SMTP
     */
    async verifyConnection() {
        try {
            await transporter.verify();
            console.log('✅ Connexion SMTP vérifiée');
            return true;
        } catch (error) {
            console.error('❌ Erreur connexion SMTP:', error.message);
            return false;
        }
    }
};

module.exports = emailService;
