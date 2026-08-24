namespace AuthService.Models;

public class UserApplicationAccess
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public Guid ApplicationId { get; set; }
    public Application Application { get; set; } = null!;
    public string Role { get; set; } = "User";
    public bool IsAuthorized { get; set; } = true;
}