using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;

namespace AuthService.Services;

public class EmailService
{
    private readonly IConfiguration _config;

    public EmailService(IConfiguration config)
    {
        _config = config;
    }

    public async Task SendPasswordResetEmail(string toEmail, string resetCode)
    {
        var html = BuildTemplate(
            title: "Réinitialisation de mot de passe",
            introText: "Vous avez demandé la réinitialisation de votre mot de passe sur AuthPortal.",
            code: resetCode,
            footerText: "Ce code expire dans 15 minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email."
        );
        await Send(toEmail, "Réinitialisation de votre mot de passe", html);
    }

    public async Task SendVerificationEmail(string toEmail, string verificationCode)
    {
        var html = BuildTemplate(
            title: "Vérifiez votre adresse email",
            introText: "Bienvenue sur AuthPortal ! Entrez ce code pour activer votre compte.",
            code: verificationCode,
            footerText: "Ce code expire dans 15 minutes. Si vous n'êtes pas à l'origine de cette inscription, ignorez cet email."
        );
        await Send(toEmail, "Vérifiez votre adresse email", html);
    }

    private static string BuildTemplate(string title, string introText, string code, string footerText)
    {
        return $@"
<!DOCTYPE html>
<html>
<body style=""margin:0;padding:0;background:#f4f4f7;font-family:Arial,Helvetica,sans-serif;"">
  <table width=""100%"" cellpadding=""0"" cellspacing=""0"" style=""background:#f4f4f7;padding:32px 0;"">
    <tr><td align=""center"">
      <table width=""420"" cellpadding=""0"" cellspacing=""0"" style=""background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e5ea;"">
        <tr><td style=""background:#12131A;padding:20px 28px;"">
          <span style=""color:#E9D3A3;font-size:18px;font-weight:700;letter-spacing:0.02em;"">AuthPortal</span>
        </td></tr>
        <tr><td style=""padding:28px;"">
          <h2 style=""margin:0 0 12px;color:#161A22;font-size:19px;"">{title}</h2>
          <p style=""margin:0 0 22px;color:#5B6472;font-size:14px;line-height:1.5;"">{introText}</p>
          <div style=""text-align:center;margin:0 0 22px;"">
            <span style=""display:inline-block;background:#F7F4EC;border:1px solid #E7E2D6;border-radius:8px;padding:14px 26px;font-family:monospace;font-size:26px;letter-spacing:0.25em;color:#161A22;font-weight:700;"">{code}</span>
          </div>
          <p style=""margin:0;color:#8A93A3;font-size:12px;line-height:1.5;"">{footerText}</p>
        </td></tr>
        <tr><td style=""padding:16px 28px;background:#FAF9F6;border-top:1px solid #e5e5ea;"">
         <p style=""margin:0;color:#8A93A3;font-size:11px;"">Email automatique — AuthPortal, ne pas répondre.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>";
    }

    private async Task Send(string toEmail, string subject, string htmlBody)
    {
        var message = new MimeMessage();
        message.From.Add(new MailboxAddress("AuthPortal", _config["Smtp:Email"]!));
        message.To.Add(new MailboxAddress("", toEmail));
        message.Subject = subject;

        var builder = new BodyBuilder { HtmlBody = htmlBody };
        message.Body = builder.ToMessageBody();

        using var client = new SmtpClient();
        await client.ConnectAsync("smtp.gmail.com", 587, SecureSocketOptions.StartTls);
        await client.AuthenticateAsync(_config["Smtp:Email"]!, _config["Smtp:AppPassword"]!);
        await client.SendAsync(message);
        await client.DisconnectAsync(true);
    }
}