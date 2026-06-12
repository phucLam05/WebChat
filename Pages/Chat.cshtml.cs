using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.SignalR;
using System.Security.Claims;
using WebChat.Data;
using WebChat.Hubs;
using WebChat.Models;

namespace WebChat.Pages
{
    [Authorize]
    public class ChatModel : PageModel
    {
        private readonly ApplicationDbContext _context;
        private readonly IHubContext<ChatHub> _hubContext;

        public ChatModel(ApplicationDbContext context, IHubContext<ChatHub> hubContext)
        {
            _context = context;
            _hubContext = hubContext;
        }

        public ApplicationUser CurrentUser { get; set; } = null!;
        public List<Chat> Chats { get; set; } = new List<Chat>();
        public Chat? ActiveChat { get; set; }

        [BindProperty]
        public string? TargetEmail { get; set; }

        public async Task<IActionResult> OnGetAsync(int? chatId)
        {
            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (userId == null) return RedirectToPage("/Index");

            var user = await _context.Users.FindAsync(userId);
            if (user == null) return RedirectToPage("/Index");
            CurrentUser = user;

            // Get all chats user belongs to
            Chats = await _context.Chats
                .Where(c => c.ChatUsers.Any(cu => cu.UserId == userId))
                .Include(c => c.ChatUsers)
                    .ThenInclude(cu => cu.User)
                .Include(c => c.Messages)
                    .ThenInclude(m => m.Sender)
                .ToListAsync();

            if (chatId.HasValue)
            {
                ActiveChat = await _context.Chats
                    .Include(c => c.Messages).ThenInclude(m => m.Sender)
                    .Include(c => c.ChatUsers).ThenInclude(cu => cu.User)
                    .FirstOrDefaultAsync(c => c.Id == chatId.Value);

                if (ActiveChat != null)
                {
                    var currentUserChatUser = ActiveChat.ChatUsers.FirstOrDefault(cu => cu.UserId == userId);
                    if (currentUserChatUser != null)
                    {
                        currentUserChatUser.LastReadAt = DateTime.UtcNow;
                        await _context.SaveChangesAsync();
                    }
                }
            }

            return Page();
        }

        public async Task<IActionResult> OnPostCreateChatAsync()
        {
            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (userId == null) return RedirectToPage("/Index");

            if (string.IsNullOrWhiteSpace(TargetEmail))
            {
                TempData["ErrorMessage"] = "Vui lòng nhập Email.";
                return RedirectToPage("/Chat");
            }

            // Find target user by email
            var targetUser = await _context.Users.FirstOrDefaultAsync(u => u.Email == TargetEmail);
            if (targetUser == null)
            {
                TempData["ErrorMessage"] = "Không tìm thấy người dùng với Email này.";
                return RedirectToPage("/Chat");
            }

            if (targetUser.Id == userId)
            {
                TempData["ErrorMessage"] = "Bạn không thể chat với chính mình.";
                return RedirectToPage("/Chat");
            }

            // Check if private chat already exists
            var existingChatId = await _context.Chats
                .Where(c => c.Type == ChatType.Private)
                .Where(c => c.ChatUsers.Any(cu => cu.UserId == userId) && c.ChatUsers.Any(cu => cu.UserId == targetUser.Id))
                .Select(c => c.Id)
                .FirstOrDefaultAsync();

            if (existingChatId > 0)
            {
                return RedirectToPage("/Chat", new { chatId = existingChatId });
            }

            // Create new private chat
            var newChat = new Chat
            {
                Type = ChatType.Private,
                Name = targetUser.UserName // Use the other person's name as chat name for simplicity
            };

            _context.Chats.Add(newChat);
            await _context.SaveChangesAsync();

            _context.ChatUsers.Add(new ChatUser { ChatId = newChat.Id, UserId = userId, Role = UserRole.Admin });
            _context.ChatUsers.Add(new ChatUser { ChatId = newChat.Id, UserId = targetUser.Id, Role = UserRole.Member });
            await _context.SaveChangesAsync();

            await _hubContext.Clients.User(targetUser.Id).SendAsync("NewChatCreated", newChat.Id, User.Identity?.Name);

            return RedirectToPage("/Chat", new { chatId = newChat.Id });
        }
    }
}
