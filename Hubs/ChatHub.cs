using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using System.Collections.Concurrent;
using System.Security.Claims;
using WebChat.Data;
using WebChat.Models;

namespace WebChat.Hubs
{
    [Authorize]
    public class ChatHub : Hub
    {
        private readonly ApplicationDbContext _context;

        public static readonly ConcurrentDictionary<string, int> UserConnections = new ConcurrentDictionary<string, int>();
        private static readonly object _connectionsLock = new object();

        public static bool IsUserOnline(string userId)
        {
            return UserConnections.ContainsKey(userId);
        }

        public ChatHub(ApplicationDbContext context)
        {
            _context = context;
        }

        public override async Task OnConnectedAsync()
        {
            var userId = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (userId != null)
            {
                bool becameOnline = false;
                lock (_connectionsLock)
                {
                    UserConnections.AddOrUpdate(userId, 1, (key, oldValue) => oldValue + 1);
                    if (UserConnections.TryGetValue(userId, out int count) && count == 1)
                    {
                        becameOnline = true;
                    }
                }
                if (becameOnline)
                {
                    await Clients.All.SendAsync("UserStatusChanged", userId, true);
                }
            }
            await base.OnConnectedAsync();
        }

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            var userId = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (userId != null)
            {
                bool becameOffline = false;
                lock (_connectionsLock)
                {
                    if (UserConnections.TryGetValue(userId, out int count))
                    {
                        if (count <= 1)
                        {
                            UserConnections.TryRemove(userId, out _);
                            becameOffline = true;
                        }
                        else
                        {
                            UserConnections.TryUpdate(userId, count - 1, count);
                        }
                    }
                }
                if (becameOffline)
                {
                    await Clients.All.SendAsync("UserStatusChanged", userId, false);
                }
            }
            await base.OnDisconnectedAsync(exception);
        }

        public async Task JoinChat(int chatId)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, chatId.ToString());
        }

        public async Task LeaveChat(int chatId)
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, chatId.ToString());
        }

        public async Task SendMessage(int chatId, string content, int type, string? fileUrl = null, string? fileName = null, long? fileSize = null)
        {
            var userId = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (userId == null) return;

            var user = await _context.Users.FindAsync(userId);
            var senderDisplayName = (!string.IsNullOrWhiteSpace(user?.FullName) ? user.FullName : user?.UserName) ?? "Ai đó";

            // Optional: Validate if user belongs to the chat

            var message = new Message
            {
                ChatId = chatId,
                SenderId = userId,
                Content = content,
                Type = (MessageType)type,
                FileUrl = fileUrl,
                FileName = fileName,
                FileSize = fileSize,
                CreatedAt = DateTime.UtcNow
            };

            _context.Messages.Add(message);

            // Update sender's LastReadAt to now
            var senderChatUser = await _context.ChatUsers
                .FirstOrDefaultAsync(cu => cu.ChatId == chatId && cu.UserId == userId);
            if (senderChatUser != null)
            {
                senderChatUser.LastReadAt = DateTime.UtcNow;
            }

            await _context.SaveChangesAsync();

            // Get all user IDs belonging to this chat to notify them in real-time
            var userIdsInChat = await _context.ChatUsers
                .Where(cu => cu.ChatId == chatId)
                .Select(cu => cu.UserId)
                .ToListAsync();

            // Broadcast message to all members of this chat
            await Clients.Users(userIdsInChat).SendAsync("ReceiveMessage", new
            {
                id = message.Id,
                chatId = message.ChatId,
                senderId = message.SenderId,
                senderName = senderDisplayName,
                content = message.Content,
                type = (int)message.Type,
                fileUrl = message.FileUrl,
                fileName = message.FileName,
                fileSize = message.FileSize,
                createdAt = message.CreatedAt
            });
        }

        public async Task MarkChatAsRead(int chatId)
        {
            var userId = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (userId == null) return;

            var chatUser = await _context.ChatUsers
                .FirstOrDefaultAsync(cu => cu.ChatId == chatId && cu.UserId == userId);
            if (chatUser != null)
            {
                chatUser.LastReadAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();
            }
        }
    }
}
