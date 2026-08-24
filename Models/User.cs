namespace AuthService.Models;

public class User
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public bool IsEmailVerified { get; set; } = false;
    public bool IsSuperAdmin { get; set; } = false;
    public ICollection<UserApplicationAccess> Accesses { get; set; } = new List<UserApplicationAccess>();
}