using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using WebChat.Data;
using WebChat.Models;

namespace WebChat.Hubs
{
    [Authorize]
    public class ChatHub : Hub
    {
        private readonly ApplicationDbContext _context;

        public ChatHub(ApplicationDbContext context)
        {
            _context = context;
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
            var userName = Context.User?.Identity?.Name;

            if (userId == null) return;

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
            await _context.SaveChangesAsync();

            // Broadcast message to everyone in the chat room
            await Clients.Group(chatId.ToString()).SendAsync("ReceiveMessage", new
            {
                id = message.Id,
                chatId = message.ChatId,
                senderId = message.SenderId,
                senderName = userName,
                content = message.Content,
                type = (int)message.Type,
                fileUrl = message.FileUrl,
                fileName = message.FileName,
                fileSize = message.FileSize,
                createdAt = message.CreatedAt
            });
        }
    }
}
