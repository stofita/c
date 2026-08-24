namespace AuthService.Models;

public class Application
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = string.Empty;
    public string ApiKey { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;

    public ICollection<UserApplicationAccess> Accesses { get; set; } = new List<UserApplicationAccess>();
}