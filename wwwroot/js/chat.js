"use strict";

var connection = new signalR.HubConnectionBuilder().withUrl("/chatHub").build();

const chatIdInput = document.getElementById("currentChatId");
const currentUserIdInput = document.getElementById("currentUserId");
const messagesList = document.getElementById("messagesList");
const messageInput = document.getElementById("messageInput");
const btnSend = document.getElementById("btnSend");

const btnAttachImage = document.getElementById("btnAttachImage");
const btnAttachFile = document.getElementById("btnAttachFile");
const imageInput = document.getElementById("imageInput");
const fileInput = document.getElementById("fileInput");

const uploadProgressContainer = document.getElementById("uploadProgressContainer");
const uploadProgressBar = document.getElementById("uploadProgressBar");

// Scroll to bottom
function scrollToBottom() {
    if (messagesList) {
        messagesList.scrollTop = messagesList.scrollHeight;
    }
}

if (chatIdInput) {
    var currentChatId = parseInt(chatIdInput.value);
    var currentUserId = currentUserIdInput.value;

    connection.on("ReceiveMessage", function (message) {
        if (message.chatId !== currentChatId) return;

        const isCurrentUser = message.senderId === currentUserId;
        
        const wrapper = document.createElement("div");
        wrapper.className = `message-wrapper d-flex mb-3 ${isCurrentUser ? "justify-content-end" : ""}`;
        
        let messageContentHtml = "";
        
        if (message.type === 0 || message.type === 3) { // Text or Icon
            messageContentHtml = `<span>${message.content}</span>`;
        } else if (message.type === 1) { // Image
            messageContentHtml = `<img src="${message.fileUrl}" class="img-fluid rounded chat-img" alt="image" />`;
        } else if (message.type === 2) { // File
            messageContentHtml = `<div class="d-flex align-items-center">
                                    <i class="bi bi-file-earmark me-2"></i>
                                    <a href="${message.fileUrl}" target="_blank" class="${isCurrentUser ? "text-white" : ""}" download="${message.fileName}">${message.fileName}</a>
                                  </div>`;
        }

        let senderNameHtml = "";
        if (!isCurrentUser) {
            senderNameHtml = `<div class="sender-name small fw-bold text-muted mb-1">${message.senderName}</div>`;
        }

        const timeString = new Date(message.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

        wrapper.innerHTML = `
            <div class="message-box ${isCurrentUser ? "bg-primary text-white right-msg" : "bg-light left-msg"} p-2 rounded">
                ${senderNameHtml}
                ${messageContentHtml}
                <div class="message-time small ${isCurrentUser ? "text-light" : "text-muted"} text-end mt-1">${timeString}</div>
            </div>
        `;
        
        messagesList.appendChild(wrapper);
        scrollToBottom();
    });

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

        btnEmoji.addEventListener("click", () => {
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
        const message = messageInput.value;
        if (!message) return;
        
        connection.invoke("SendMessage", currentChatId, message, 0, null, null, null).catch(function (err) {
            return console.error(err.toString());
        });
        messageInput.value = "";
        event.preventDefault();
    });

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
                }, 1000);
            } else {
                alert("File upload failed!");
                uploadProgressContainer.classList.add("d-none");
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

connection.start().then(function () {
    if (chatIdInput && currentChatId) {
        connection.invoke("JoinChat", currentChatId).catch(function (err) {
            return console.error(err.toString());
        });
        scrollToBottom();
    }
}).catch(function (err) {
    return console.error(err.toString());
});
