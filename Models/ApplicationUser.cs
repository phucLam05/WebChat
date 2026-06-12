using Microsoft.AspNetCore.Identity;

namespace WebChat.Models
{
    public class ApplicationUser : IdentityUser
    {
        public string? AvatarUrl { get; set; }
        
        public ICollection<ChatUser> ChatUsers { get; set; } = new List<ChatUser>();
        public ICollection<Message> Messages { get; set; } = new List<Message>();
    }
}
