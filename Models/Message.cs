namespace WebChat.Models
{
    public class Message
    {
        public int Id { get; set; }
        
        public int ChatId { get; set; }
        public Chat Chat { get; set; } = null!;

        public string SenderId { get; set; } = null!;
        public ApplicationUser Sender { get; set; } = null!;

        public string? Content { get; set; }
        public MessageType Type { get; set; }
        
        public string? FileUrl { get; set; }
        public string? FileName { get; set; } // useful for file downloads
        public long? FileSize { get; set; } // useful for file downloads

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }

    public enum MessageType
    {
        Text,
        Image,
        File,
        Icon
    }
}
