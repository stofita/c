using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using AuthService.Models;

namespace AuthService.Services;

public class TokenService
{
    private readonly IConfiguration _config;

    public TokenService(IConfiguration config)
    {
        _config = config;
    }

public string GenerateToken(User user, UserApplicationAccess access)
{
    var claims = new List<Claim>
    {
        new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
        new Claim(ClaimTypes.Email, user.Email),
        new Claim(ClaimTypes.Role, access.Role),
    };

    if (user.IsSuperAdmin)
    {
        claims.Add(new Claim(ClaimTypes.Role, "SuperAdmin"));
    }

    var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_config["Jwt:Key"]!));
    var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

    var token = new JwtSecurityToken(
        claims: claims,
        expires: DateTime.UtcNow.AddMinutes(15),
        signingCredentials: creds
    );

    return new JwtSecurityTokenHandler().WriteToken(token);
}
    public RefreshToken GenerateRefreshToken(Guid userId)
{
    var randomBytes = System.Security.Cryptography.RandomNumberGenerator.GetBytes(64);
    return new RefreshToken
    {
        Token = Convert.ToBase64String(randomBytes),
        UserId = userId,
        ExpiresAt = DateTime.UtcNow.AddDays(7)
    };
}
}