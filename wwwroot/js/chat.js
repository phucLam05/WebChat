"use strict";

var connection = new signalR.HubConnectionBuilder()
    .withUrl("/chatHub")
    .withAutomaticReconnect()
    .build();

const chatIdInput = document.getElementById("currentChatId");
const currentUserIdInput = document.getElementById("currentUserId");
const currentChatId = (chatIdInput && chatIdInput.value) ? parseInt(chatIdInput.value) : 0;
const currentUserId = currentUserIdInput ? currentUserIdInput.value : "";

const messagesList = document.getElementById("messagesList");
const messageInput = document.getElementById("messageInput");
const btnSend = document.getElementById("btnSend");

const btnAttachImage = document.getElementById("btnAttachImage");
const btnAttachFile = document.getElementById("btnAttachFile");
const imageInput = document.getElementById("imageInput");
const fileInput = document.getElementById("fileInput");

const uploadProgressContainer = document.getElementById("uploadProgressContainer");
const uploadProgressBar = document.getElementById("uploadProgressBar");

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function formatMessageTime(value) {
    const date = new Date(value);
    return date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

function updateSendState() {
    if (!btnSend || !messageInput) return;
    btnSend.disabled = messageInput.value.trim().length === 0;
}

// Scroll to bottom
function scrollToBottom() {
    if (messagesList) {
        messagesList.scrollTop = messagesList.scrollHeight;
    }
}

// Get user initials
function getInitials(name) {
    if (!name) return "?";
    const parts = name.split(' ').filter(p => p.length > 0);
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Lightbox controller
window.zoomImage = function(src) {
    const lightbox = document.getElementById("imageLightbox");
    const lightboxImg = document.getElementById("lightboxImage");
    if (lightbox && lightboxImg) {
        lightboxImg.src = src;
        lightbox.style.display = "flex";
    }
};

window.closeLightbox = function() {
    const lightbox = document.getElementById("imageLightbox");
    if (lightbox) {
        lightbox.style.display = "none";
    }
};

// Press escape key to close lightbox
document.addEventListener("keydown", function(e) {
    if (e.key === "Escape") {
        window.closeLightbox();
    }
});

// Update SignalR connection status UI
function updateConnectionUI(state) {
    const statusDot = document.getElementById("connectionStatusDot");
    const statusText = document.getElementById("connectionStatusText");
    if (!statusDot) return;

    statusDot.classList.remove("online", "connecting", "reconnecting", "disconnected");
    let text = "";
    if (state === "connected") {
        statusDot.classList.add("online");
        text = "Đã kết nối";
    } else if (state === "connecting") {
        statusDot.classList.add("connecting");
        text = "Đang kết nối...";
    } else if (state === "reconnecting") {
        statusDot.classList.add("reconnecting");
        text = "Mất kết nối, đang thử lại...";
    } else {
        statusDot.classList.add("disconnected");
        text = "Đã ngắt kết nối";
    }

    statusDot.title = text;
    if (statusText) {
        statusText.textContent = text;
    }
}

// Scroll to bottom immediately on DOM content loaded
document.addEventListener("DOMContentLoaded", () => {
    scrollToBottom();
    updateConnectionUI("connecting");
    updateSendState();
});

// Register ReceiveMessage event handler globally
connection.on("ReceiveMessage", function (message) {
        // 1. Update the sidebar preview text, time and sort order in real-time
        const chatItem = document.querySelector(`.chat-list-item[data-chat-id="${message.chatId}"]`);
        const chatList = document.querySelector(".chat-list");
        
        if (chatItem) {
            const timeEl = document.getElementById(`sidebar-time-${message.chatId}`);
            const msgEl = document.getElementById(`sidebar-msg-${message.chatId}`);
            
            // Format time
            const timeString = formatMessageTime(message.createdAt);
            if (timeEl) timeEl.textContent = timeString;

            // Format message preview
            const senderName = message.senderId === currentUserId ? "Bạn" : message.senderName;
            let previewText = "";
            if (message.type === 1) {
                previewText = `${senderName}: [Hình ảnh]`;
            } else if (message.type === 2) {
                previewText = `${senderName}: [Tệp tin: ${message.fileName}]`;
            } else {
                let content = message.content || "";
                if (content.length > 25) content = content.substring(0, 22) + "...";
                previewText = `${senderName}: ${content}`;
            }

            if (msgEl) msgEl.textContent = previewText;

            // Update unread state in sidebar if message is not sent by current user
            if (message.senderId !== currentUserId) {
                if (message.chatId === currentChatId) {
                    // Current chat is active, call MarkChatAsRead on server
                    connection.invoke("MarkChatAsRead", currentChatId).catch(err => console.error(err));
                } else {
                    // Not in active chat, mark as unread and add dot
                    chatItem.classList.add("unread");
                    const avatar = chatItem.querySelector(".avatar-circle");
                    if (avatar) {
                        let dot = avatar.querySelector(".sidebar-unread-dot");
                        if (!dot) {
                            dot = document.createElement("span");
                            dot.className = "status-dot online position-absolute sidebar-unread-dot";
                            dot.id = `unread-dot-${message.chatId}`;
                            dot.style.width = "10px";
                            dot.style.height = "10px";
                            dot.style.right = "-2px";
                            dot.style.bottom = "-2px";
                            dot.style.border = "2px solid var(--bg-surface-container-lowest)";
                            avatar.appendChild(dot);
                        }
                    }
                }
            }

            // Move the active/updated chat item to the top of the sidebar list
            if (chatList) {
                chatList.prepend(chatItem);
            }
        }

        // 2. Append message to chat screen if it belongs to the active chat
        if (message.chatId !== currentChatId) return;

        const isCurrentUser = message.senderId === currentUserId;
        
        const wrapper = document.createElement("div");
        wrapper.className = `message-wrapper new-message ${isCurrentUser ? "justify-content-end" : ""}`;
        
        let messageContentHtml = "";
        
        if (message.type === 0 || message.type === 3) { // Text or Icon
            messageContentHtml = `<span>${escapeHtml(message.content)}</span>`;
        } else if (message.type === 1) { // Image
            const safeUrl = escapeHtml(message.fileUrl);
            messageContentHtml = `<img src="${safeUrl}" class="chat-img img-fluid" alt="image" onclick="zoomImage(this.src)" />`;
        } else if (message.type === 2) { // File
            const content = message.content ? escapeHtml(message.content) : "Tài liệu";
            const fileName = escapeHtml(message.fileName);
            const fileUrl = escapeHtml(message.fileUrl);
            const isPdf = message.fileName && message.fileName.toLowerCase().endsWith(".pdf");
            messageContentHtml = `<div class="file-attachment-card" onclick="window.open('${fileUrl}', '_blank')">
                                    <div class="file-icon-box ${isPdf ? "pdf" : "generic"}">
                                        <span class="material-symbols-outlined">${isPdf ? "picture_as_pdf" : "description"}</span>
                                    </div>
                                    <div class="file-info">
                                        <p class="file-name" title="${fileName}">${fileName}</p>
                                        <p class="file-size">${content}</p>
                                    </div>
                                    <a href="${fileUrl}" download="${fileName}" class="file-download-btn" onclick="event.stopPropagation();" target="_blank">
                                        <span class="material-symbols-outlined">download</span>
                                    </a>
                                  </div>`;
        }

        let senderAvatarHtml = "";
        let senderNameHtml = "";
        if (!isCurrentUser) {
            const safeSenderName = escapeHtml(message.senderName);
            senderAvatarHtml = `<div class="avatar-circle-sm mb-1 align-self-end" title="${safeSenderName}">${escapeHtml(getInitials(message.senderName))}</div>`;
            senderNameHtml = `<div class="sender-name">${safeSenderName}</div>`;
        }

        const timeString = formatMessageTime(message.createdAt);

        wrapper.innerHTML = `
            ${senderAvatarHtml}
            <div class="message-box ${isCurrentUser ? "right-msg" : "left-msg"}">
                ${senderNameHtml}
                <div class="message-content">${messageContentHtml}</div>
                <div class="message-time ${isCurrentUser ? "right" : "left"}">${timeString}</div>
            </div>
        `;
        
        messagesList.appendChild(wrapper);
        scrollToBottom();
});

if (chatIdInput && currentChatId) {
    // Emoji Picker Logic
    const btnEmoji = document.getElementById("btnEmoji");
    const emojiPicker = document.getElementById("emojiPicker");
    const emojis = ["😀", "😂", "🥰", "😎", "😭", "😡", "👍", "👎", "❤️", "🔥", "🎉", "👀", "🤔", "👏", "🙌", "✨", "💯", "🙏"];
    
    if (emojiPicker && btnEmoji) {
        emojis.forEach(emoji => {
            const span = document.createElement("span");
            span.textContent = emoji;
            span.style.userSelect = "none";
            span.onclick = () => {
                messageInput.value += emoji;
                emojiPicker.classList.add("d-none");
                messageInput.focus();
            };
            emojiPicker.appendChild(span);
        });

        btnEmoji.addEventListener("click", (e) => {
            e.stopPropagation();
            emojiPicker.classList.toggle("d-none");
        });

        document.addEventListener("click", (e) => {
            if (!btnEmoji.contains(e.target) && !emojiPicker.contains(e.target)) {
                emojiPicker.classList.add("d-none");
            }
        });
    }

    // Send Text
    btnSend.addEventListener("click", function (event) {
        const message = messageInput.value.trim();
        if (!message) return;
        
        connection.invoke("SendMessage", currentChatId, message, 0, null, null, null).catch(function (err) {
            return console.error(err.toString());
        });
        messageInput.value = "";
        messageInput.focus();
        updateSendState();
        event.preventDefault();
    });

    messageInput.addEventListener("input", updateSendState);
    messageInput.addEventListener("keypress", function (e) {
        if (e.key === 'Enter') {
            btnSend.click();
        }
    });

    // File / Image attachments
    btnAttachImage.addEventListener("click", () => imageInput.click());
    btnAttachFile.addEventListener("click", () => fileInput.click());

    imageInput.addEventListener("change", (e) => uploadFile(e.target.files[0], 1));
    fileInput.addEventListener("change", (e) => uploadFile(e.target.files[0], 2));

    function uploadFile(file, type) {
        if (!file) return;

        uploadProgressContainer.classList.remove("d-none");
        uploadProgressBar.style.width = "0%";

        const formData = new FormData();
        formData.append("file", file);

        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/files/upload", true);

        xhr.upload.onprogress = function(e) {
            if (e.lengthComputable) {
                const percentComplete = (e.loaded / e.total) * 100;
                uploadProgressBar.style.width = percentComplete + "%";
            }
        };

        xhr.onload = function() {
            if (xhr.status === 200) {
                const response = JSON.parse(xhr.responseText);
                
                // Trigger SignalR send
                connection.invoke("SendMessage", currentChatId, "", type, response.fileUrl, response.fileName, response.fileSize).catch(function (err) {
                    return console.error(err.toString());
                });

                // reset
                imageInput.value = "";
                fileInput.value = "";
                setTimeout(() => {
                    uploadProgressContainer.classList.add("d-none");
                    uploadProgressBar.style.width = "0%";
                }, 1000);
            } else {
                alert("Upload tệp thất bại!");
                uploadProgressContainer.classList.add("d-none");
                uploadProgressBar.style.width = "0%";
            }
        };

        xhr.send(formData);
    }
}

// Global Connection Start & Events
connection.on("NewChatCreated", function (chatId, chatName) {
    // When a new chat is created targeting this user, reload to update the chat list
    window.location.reload();
});

connection.on("UserStatusChanged", function (userId, isOnline) {
    // 1. Update chat window header status if this is our current chat partner
    const partnerIdInput = document.getElementById("partnerUserId");
    if (partnerIdInput && partnerIdInput.value === userId) {
        const statusDot = document.getElementById("partnerStatusDot");
        const statusText = document.getElementById("partnerStatusText");
        if (statusDot && statusText) {
            statusDot.className = "status-dot " + (isOnline ? "online" : "offline");
            statusText.textContent = isOnline ? "Online" : "Offline";
        }
    }
});

connection.start().then(function () {
    updateConnectionUI("connected");
    if (chatIdInput && currentChatId) {
        connection.invoke("JoinChat", currentChatId).catch(function (err) {
            return console.error(err.toString());
        });
        connection.invoke("MarkChatAsRead", currentChatId).catch(function (err) {
            return console.error(err.toString());
        });
        scrollToBottom();
    }
}).catch(function (err) {
    updateConnectionUI("disconnected");
    return console.error(err.toString());
});

connection.onreconnecting((error) => {
    updateConnectionUI("reconnecting");
});

connection.onreconnected((connectionId) => {
    updateConnectionUI("connected");
});

connection.onclose((error) => {
    updateConnectionUI("disconnected");
});
