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
        public string ChatMode { get; set; } = "private";

        [BindProperty]
        public string? TargetEmail { get; set; }

        [BindProperty]
        public string? GroupName { get; set; }

        [BindProperty]
        public string? GroupMemberEmails { get; set; }

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
                    .FirstOrDefaultAsync(c => c.Id == chatId.Value && c.ChatUsers.Any(cu => cu.UserId == userId));

                if (ActiveChat != null)
                {
                    var currentUserChatUser = ActiveChat.ChatUsers.FirstOrDefault(cu => cu.UserId == userId);
                    if (currentUserChatUser != null)
                    {
                        currentUserChatUser.LastReadAt = DateTime.UtcNow;
                        await _context.SaveChangesAsync();
                    }
                }
                else
                {
                    TempData["ErrorMessage"] = "Không tìm thấy cuộc trò chuyện hoặc bạn không có quyền truy cập.";
                    return RedirectToPage("/Chat");
                }
            }

            return Page();
        }

        public async Task<IActionResult> OnPostCreateChatAsync()
        {
            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (userId == null) return RedirectToPage("/Index");

            if (string.Equals(ChatMode, "group", StringComparison.OrdinalIgnoreCase))
            {
                return await CreateGroupChatAsync(userId);
            }

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
                Name = !string.IsNullOrWhiteSpace(targetUser.FullName) ? targetUser.FullName : targetUser.UserName
            };

            _context.Chats.Add(newChat);
            await _context.SaveChangesAsync();

            _context.ChatUsers.Add(new ChatUser { ChatId = newChat.Id, UserId = userId, Role = UserRole.Admin });
            _context.ChatUsers.Add(new ChatUser { ChatId = newChat.Id, UserId = targetUser.Id, Role = UserRole.Member });
            await _context.SaveChangesAsync();

            await _hubContext.Clients.User(targetUser.Id).SendAsync("NewChatCreated", newChat.Id, User.Identity?.Name);

            return RedirectToPage("/Chat", new { chatId = newChat.Id });
        }

        private async Task<IActionResult> CreateGroupChatAsync(string userId)
        {
            if (string.IsNullOrWhiteSpace(GroupName))
            {
                TempData["ErrorMessage"] = "Vui lòng nhập tên nhóm.";
                return RedirectToPage("/Chat");
            }

            var normalizedEmails = (GroupMemberEmails ?? string.Empty)
                .Split(new[] { ',', ';', '\n', '\r' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            if (normalizedEmails.Count == 0)
            {
                TempData["ErrorMessage"] = "Vui lòng nhập ít nhất một email thành viên.";
                return RedirectToPage("/Chat");
            }

            var users = await _context.Users
                .Where(u => normalizedEmails.Contains(u.Email!))
                .ToListAsync();

            var foundEmails = users
                .Where(u => !string.IsNullOrWhiteSpace(u.Email))
                .Select(u => u.Email!)
                .ToHashSet(StringComparer.OrdinalIgnoreCase);

            var missingEmails = normalizedEmails
                .Where(email => !foundEmails.Contains(email))
                .ToList();

            if (missingEmails.Count > 0)
            {
                TempData["ErrorMessage"] = $"Không tìm thấy người dùng: {string.Join(", ", missingEmails)}.";
                return RedirectToPage("/Chat");
            }

            users = users.Where(u => u.Id != userId).ToList();

            if (users.Count == 0)
            {
                TempData["ErrorMessage"] = "Nhóm cần ít nhất một thành viên khác ngoài bạn.";
                return RedirectToPage("/Chat");
            }

            var groupChat = new Chat
            {
                Type = ChatType.Group,
                Name = GroupName.Trim()
            };

            _context.Chats.Add(groupChat);
            await _context.SaveChangesAsync();

            _context.ChatUsers.Add(new ChatUser { ChatId = groupChat.Id, UserId = userId, Role = UserRole.Admin });
            foreach (var member in users)
            {
                _context.ChatUsers.Add(new ChatUser { ChatId = groupChat.Id, UserId = member.Id, Role = UserRole.Member });
            }

            await _context.SaveChangesAsync();

            var participantIds = users.Select(u => u.Id).ToList();
            if (participantIds.Count > 0)
            {
                await _hubContext.Clients.Users(participantIds).SendAsync("NewChatCreated", groupChat.Id, groupChat.Name);
            }

            return RedirectToPage("/Chat", new { chatId = groupChat.Id });
        }
    }
}
