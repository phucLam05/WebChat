namespace WebChat.Models
{
    public class ChatUser
    {
        public int ChatId { get; set; }
        public Chat Chat { get; set; } = null!;

        public string UserId { get; set; } = null!;
        public ApplicationUser User { get; set; } = null!;
        
        public UserRole Role { get; set; } // Admin, Member
        
        public DateTime LastReadAt { get; set; } = DateTime.UtcNow;
    }

    public enum UserRole
    {
        Admin,
        Member
    }
}
