using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using AuthService.Data;
using AuthService.Models;
using AuthService.Services;

namespace AuthService.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly AuthDbContext _db;
    private readonly TokenService _tokenService;
    private readonly EmailService _emailService;

    public AuthController(AuthDbContext db, TokenService tokenService, EmailService emailService)
    {
        _db = db;
        _tokenService = tokenService;
        _emailService = emailService;
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
            return BadRequest(new { message = "Champs manquants." });

        if (request.Password.Length < 8)
            return BadRequest(new { message = "Le mot de passe doit contenir au moins 8 caractères." });

        var existing = await _db.Users.FirstOrDefaultAsync(u => u.Email == request.Email);
        if (existing != null)
            return Conflict(new { message = "Cet email est déjà utilisé." });

        var user = new User
        {
            Email = request.Email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            IsEmailVerified = false
        };
        _db.Users.Add(user);
        await _db.SaveChangesAsync();

        var code = new EmailVerificationCode
        {
            Code = System.Security.Cryptography.RandomNumberGenerator.GetString("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6),
            UserId = user.Id,
            ExpiresAt = DateTime.UtcNow.AddMinutes(15)
        };
        _db.EmailVerificationCodes.Add(code);
        await _db.SaveChangesAsync();

        await _emailService.SendVerificationEmail(user.Email, code.Code);

        return Ok(new { message = "Compte créé. Vérifiez votre email pour activer votre compte.", userId = user.Id });
    }

    [HttpPost("verify-email")]
    public async Task<IActionResult> VerifyEmail([FromBody] VerifyEmailRequest request)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == request.Email);
        if (user == null)
            return NotFound(new { message = "Compte introuvable." });

        var code = await _db.EmailVerificationCodes
            .Where(c => c.UserId == user.Id && c.Code == request.Code)
            .OrderByDescending(c => c.ExpiresAt)
            .FirstOrDefaultAsync();

        if (code == null || code.IsUsed || code.ExpiresAt < DateTime.UtcNow)
            return Unauthorized(new { message = "Code de vérification invalide ou expiré." });

        user.IsEmailVerified = true;
        code.IsUsed = true;
        await _db.SaveChangesAsync();

        return Ok(new { message = "Email vérifié avec succès. Vous pouvez maintenant vous connecter." });
    }

    [EnableRateLimiting("AuthEndpoints")]
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
       
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password) || string.IsNullOrWhiteSpace(request.AppName))
            return BadRequest(new { message = "Champs manquants." });

     
        var application = await _db.Applications.FirstOrDefaultAsync(a => a.Name == request.AppName && a.IsActive);
        if (application == null)
        {
            await LogAttempt(request.Email, request.AppName, false, "Application introuvable");
            return NotFound(new { message = "Application introuvable." });
        }

        
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == request.Email && u.IsActive);
        if (user == null || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
        {
            await LogAttempt(request.Email, request.AppName, false, "Identifiants invalides");
            return Unauthorized(new { message = "Échec de connexion." });
        }

       
        if (!user.IsEmailVerified)
        {
            await LogAttempt(request.Email, request.AppName, false, "Email non vérifié");
            return StatusCode(403, new { message = "Veuillez vérifier votre email avant de vous connecter." });
        }

      
        var access = await _db.UserApplicationAccesses
            .FirstOrDefaultAsync(a => a.UserId == user.Id && a.ApplicationId == application.Id && a.IsAuthorized);
        if (access == null)
        {
            await LogAttempt(request.Email, request.AppName, false, "Accès non autorisé");
            return StatusCode(403, new { message = "Accès refusé." });
        }

        
        var token = _tokenService.GenerateToken(user, access);
        var refreshToken = _tokenService.GenerateRefreshToken(user.Id);
        _db.RefreshTokens.Add(refreshToken);
        await LogAttempt(request.Email, request.AppName, true, "Succès");
        await _db.SaveChangesAsync();

      return Ok(new { token, refreshToken = refreshToken.Token, role = access.Role, isSuperAdmin = user.IsSuperAdmin });
    }

    [HttpPost("refresh")]
    public async Task<IActionResult> Refresh([FromBody] RefreshRequest request)
    {
        var stored = await _db.RefreshTokens
            .Include(r => r.User)
            .FirstOrDefaultAsync(r => r.Token == request.RefreshToken);

        if (stored == null || stored.IsRevoked || stored.ExpiresAt < DateTime.UtcNow)
            return Unauthorized(new { message = "Refresh token invalide ou expiré." });

        var access = await _db.UserApplicationAccesses
            .FirstOrDefaultAsync(a => a.UserId == stored.UserId && a.IsAuthorized);

        if (access == null)
            return StatusCode(403, new { message = "Accès refusé." });

        stored.IsRevoked = true;
        var newRefreshToken = _tokenService.GenerateRefreshToken(stored.UserId);
        _db.RefreshTokens.Add(newRefreshToken);

        var newJwt = _tokenService.GenerateToken(stored.User, access);
        await _db.SaveChangesAsync();

        return Ok(new { token = newJwt, refreshToken = newRefreshToken.Token });
    }

    [EnableRateLimiting("AuthEndpoints")]
    [HttpPost("forgot-password")]
    public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordRequest request)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == request.Email);

        var genericResponse = new { message = "Si cet email existe, un code de réinitialisation a été envoyé." };

        if (user == null)
            return Ok(genericResponse);

        var resetToken = new PasswordResetToken
        {
            Token = System.Security.Cryptography.RandomNumberGenerator.GetString("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6),
            UserId = user.Id,
            ExpiresAt = DateTime.UtcNow.AddMinutes(10)
        };
        _db.PasswordResetTokens.Add(resetToken);
        await _db.SaveChangesAsync();

        await _emailService.SendPasswordResetEmail(user.Email, resetToken.Token);

        return Ok(genericResponse);
    }

    [EnableRateLimiting("AuthEndpoints")]
    [HttpPost("reset-password")]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest request)
    {
        if (request.NewPassword.Length < 8)
            return BadRequest(new { message = "Le mot de passe doit contenir au moins 8 caractères." });

        var stored = await _db.PasswordResetTokens
            .Include(t => t.User)
            .FirstOrDefaultAsync(t => t.Token == request.Token);

        if (stored == null || stored.IsUsed || stored.ExpiresAt < DateTime.UtcNow)
            return Unauthorized(new { message = "Code de réinitialisation invalide ou expiré." });

        stored.User.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
        stored.IsUsed = true;
        await _db.SaveChangesAsync();

        return Ok(new { message = "Mot de passe réinitialisé avec succès." });
    }

    [HttpGet("applications")]
    public async Task<IActionResult> GetPublicApplications()
    {
        var apps = await _db.Applications
            .Where(a => a.IsActive)
            .Select(a => a.Name)
            .ToListAsync();
        return Ok(apps);
    }

    private async Task LogAttempt(string email, string appName, bool success, string motif)
    {
        _db.AuthentificationLogs.Add(new AuthentificationLog
        {
            Email = email,
            AppName = appName,
            Success = success,
            Motif = motif
        });
        await _db.SaveChangesAsync();
    }
}