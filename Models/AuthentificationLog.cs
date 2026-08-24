namespace AuthService.Models;

public class AuthentificationLog
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Email { get; set; } = string.Empty;
    public string AppName { get; set; } = string.Empty;
    public DateTime DateTentative { get; set; } = DateTime.UtcNow;
    public bool Success { get; set; }
    public string Motif { get; set; } = string.Empty;
}