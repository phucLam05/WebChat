using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using WebChat.Models;

namespace WebChat.Data
{
    public class ApplicationDbContext : IdentityDbContext<ApplicationUser>
    {
        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
            : base(options)
        {
        }

        public DbSet<Chat> Chats { get; set; } = null!;
        public DbSet<ChatUser> ChatUsers { get; set; } = null!;
        public DbSet<Message> Messages { get; set; } = null!;

        protected override void OnModelCreating(ModelBuilder builder)
        {
            base.OnModelCreating(builder);

            builder.Entity<ChatUser>()
                .HasKey(x => new { x.ChatId, x.UserId });

            builder.Entity<ChatUser>()
                .HasOne(x => x.Chat)
                .WithMany(x => x.ChatUsers)
                .HasForeignKey(x => x.ChatId);

            builder.Entity<ChatUser>()
                .HasOne(x => x.User)
                .WithMany(x => x.ChatUsers)
                .HasForeignKey(x => x.UserId);
                
            builder.Entity<Message>()
                .HasOne(x => x.Chat)
                .WithMany(x => x.Messages)
                .HasForeignKey(x => x.ChatId);

            builder.Entity<Message>()
                .HasOne(x => x.Sender)
                .WithMany(x => x.Messages)
                .HasForeignKey(x => x.SenderId);
        }
    }
}
