namespace AuthService.Models;

public class GrantAccessRequest
{
    public Guid UserId { get; set; }
    public Guid ApplicationId { get; set; }
    public string Role { get; set; } = "User";
}