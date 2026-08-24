using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using AuthService.Data;
using AuthService.Models;

namespace AuthService.Controllers;

[ApiController]
[Route("api/admin")]
[Authorize(Roles = "SuperAdmin")]
public class AdminController : ControllerBase
{
    private readonly AuthDbContext _db;

    public AdminController(AuthDbContext db)
    {
        _db = db;
    }

    [HttpPost("applications")]
    public async Task<IActionResult> CreateApplication([FromBody] CreateApplicationRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest(new { message = "Le nom de l'application est requis." });

        var exists = await _db.Applications.AnyAsync(a => a.Name == request.Name);
        if (exists)
            return Conflict(new { message = "Une application avec ce nom existe déjà." });

        var application = new Application
        {
            Name = request.Name,
            ApiKey = Guid.NewGuid().ToString()
        };
        _db.Applications.Add(application);
        await _db.SaveChangesAsync();

        return Ok(application);
    }

        [HttpPost("access")]
    public async Task<IActionResult> GrantAccess([FromBody] GrantAccessRequest request)
    {
        var userExists = await _db.Users.AnyAsync(u => u.Id == request.UserId);
        var appExists = await _db.Applications.AnyAsync(a => a.Id == request.ApplicationId);

        if (!userExists || !appExists)
            return NotFound(new { message = "Utilisateur ou application introuvable." });

        var existing = await _db.UserApplicationAccesses
            .FirstOrDefaultAsync(a => a.UserId == request.UserId && a.ApplicationId == request.ApplicationId);

        if (existing != null)
        {
            existing.Role = request.Role;
            existing.IsAuthorized = true;
            await _db.SaveChangesAsync();
            return Ok(existing);
        }

        var access = new UserApplicationAccess
        {
            UserId = request.UserId,
            ApplicationId = request.ApplicationId,
            Role = request.Role,
            IsAuthorized = true
        };
        _db.UserApplicationAccesses.Add(access);
        await _db.SaveChangesAsync();

        return Ok(access);
    }

    
   [HttpGet("users")]
    public async Task<IActionResult> GetUsers()
    {
        var users = await _db.Users
            .Select(u => new { u.Id, u.Email, u.IsActive, u.IsSuperAdmin })
            .ToListAsync();
        return Ok(users);
    }

    [HttpGet("applications")]
    public async Task<IActionResult> GetApplications()
    {
        var apps = await _db.Applications.Select(a => new { a.Id, a.Name, a.IsActive }).ToListAsync();
        return Ok(apps);
    }

    [HttpGet("roles")]
    public IActionResult GetRoles()
    {
        var roles = new[] { "Admin" , "User" };
        return Ok(roles);
    }

    [HttpGet("logs")]
    public async Task<IActionResult> GetLogs()
    {
        var logs = await _db.AuthentificationLogs
            .OrderByDescending(l => l.DateTentative)
            .Take(100)
            .ToListAsync();

        return Ok(logs);
    }
[HttpDelete("users/{id}")]
    public async Task<IActionResult> DeactivateUser(Guid id)
    {
        var user = await _db.Users.FindAsync(id);
        if (user == null)
            return NotFound(new { message = "Utilisateur introuvable." });

        user.IsActive = false;
        await _db.SaveChangesAsync();
        return Ok(new { message = "Utilisateur désactivé." });
    }

    [HttpDelete("applications/{id}")]
    public async Task<IActionResult> DeactivateApplication(Guid id)
    {
        var app = await _db.Applications.FindAsync(id);
        if (app == null)
            return NotFound(new { message = "Application introuvable." });

        app.IsActive = false;
        await _db.SaveChangesAsync();
        return Ok(new { message = "Application désactivée." });
    }

    [HttpPost("users/{id}/activate")]
    public async Task<IActionResult> ActivateUser(Guid id)
    {
        var user = await _db.Users.FindAsync(id);
        if (user == null)
            return NotFound(new { message = "Utilisateur introuvable." });

        user.IsActive = true;
        await _db.SaveChangesAsync();
        return Ok(new { message = "Utilisateur réactivé." });
    }

    [HttpPost("applications/{id}/activate")]
    public async Task<IActionResult> ActivateApplication(Guid id)
    {
        var app = await _db.Applications.FindAsync(id);
        if (app == null)
            return NotFound(new { message = "Application introuvable." });

        app.IsActive = true;
        await _db.SaveChangesAsync();
        return Ok(new { message = "Application réactivée." });
    }

[HttpGet("access")]
    public async Task<IActionResult> GetAllAccess()
    {
        var access = await _db.UserApplicationAccesses
            .Include(a => a.User)
            .Include(a => a.Application)
            .Select(a => new
            {
                id = a.Id,
                userEmail = a.User.Email,
                applicationName = a.Application.Name,
                role = a.Role,
                isAuthorized = a.IsAuthorized
            })
            .ToListAsync();
        return Ok(access);
    }

    [HttpDelete("access/{id}")]
    public async Task<IActionResult> RevokeAccess(Guid id)
    {
        var access = await _db.UserApplicationAccesses.FindAsync(id);
        if (access == null)
            return NotFound(new { message = "Accès introuvable." });

        access.IsAuthorized = false;
        await _db.SaveChangesAsync();
        return Ok(new { message = "Accès révoqué." });
    }

    [HttpPost("access/{id}/restore")]
    public async Task<IActionResult> RestoreAccess(Guid id)
    {
        var access = await _db.UserApplicationAccesses.FindAsync(id);
        if (access == null)
            return NotFound(new { message = "Accès introuvable." });

        access.IsAuthorized = true;
        await _db.SaveChangesAsync();
        return Ok(new { message = "Accès restauré." });
    }

[HttpPost("users/{id}/grant-super-admin")]
    public async Task<IActionResult> GrantSuperAdmin(Guid id)
    {
        var user = await _db.Users.FindAsync(id);
        if (user == null)
            return NotFound(new { message = "Utilisateur introuvable." });

        user.IsSuperAdmin = true;
        await _db.SaveChangesAsync();
        return Ok(new { message = "Super-administrateur accordé." });
    }

    [HttpPost("users/{id}/revoke-super-admin")]
    public async Task<IActionResult> RevokeSuperAdmin(Guid id)
    {
        var user = await _db.Users.FindAsync(id);
        if (user == null)
            return NotFound(new { message = "Utilisateur introuvable." });

        user.IsSuperAdmin = false;
        await _db.SaveChangesAsync();
        return Ok(new { message = "Super-administrateur retiré." });
    }


}