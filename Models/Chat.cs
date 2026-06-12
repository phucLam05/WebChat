namespace WebChat.Models
{
    public class Chat
    {
        public int Id { get; set; }
        public string? Name { get; set; }
        public ChatType Type { get; set; } // Private or Group

        public ICollection<ChatUser> ChatUsers { get; set; } = new List<ChatUser>();
        public ICollection<Message> Messages { get; set; } = new List<Message>();
    }

    public enum ChatType
    {
        Private,
        Group
    }
}
