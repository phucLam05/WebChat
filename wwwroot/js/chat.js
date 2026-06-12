"use strict";

const MESSAGE_TYPE = {
    text: 0,
    image: 1,
    file: 2,
    icon: 3,
    video: 4
};

var connection = new signalR.HubConnectionBuilder()
    .withUrl("/chatHub")
    .withAutomaticReconnect()
    .build();

const chatIdInput = document.getElementById("currentChatId");
const currentUserIdInput = document.getElementById("currentUserId");
const serverInstanceTokenInput = document.getElementById("serverInstanceToken");
const currentChatId = (chatIdInput && chatIdInput.value) ? parseInt(chatIdInput.value, 10) : 0;
const currentUserId = currentUserIdInput ? currentUserIdInput.value : "";
const serverInstanceToken = serverInstanceTokenInput ? serverInstanceTokenInput.value : "";

const messagesList = document.getElementById("messagesList");
const messageInput = document.getElementById("messageInput");
const btnSend = document.getElementById("btnSend");

const btnAttachImage = document.getElementById("btnAttachImage");
const btnAttachVideo = document.getElementById("btnAttachVideo");
const btnAttachFile = document.getElementById("btnAttachFile");
const imageInput = document.getElementById("imageInput");
const videoInput = document.getElementById("videoInput");
const fileInput = document.getElementById("fileInput");

const mediaPreviewContainer = document.getElementById("mediaPreviewContainer");
const uploadProgressContainer = document.getElementById("uploadProgressContainer");
const uploadProgressBar = document.getElementById("uploadProgressBar");
const chatModeSelect = document.getElementById("chatMode");
const privateChatFields = document.getElementById("privateChatFields");
const groupChatFields = document.getElementById("groupChatFields");
const targetEmailInput = document.getElementById("targetEmail");
const groupNameInput = document.getElementById("groupName");
const groupMemberEmailsInput = document.getElementById("groupMemberEmails");

let pendingMedia = null;
let activeUploadCount = 0;
const loadedVideoUrls = new Set();
const uploadedVideoSources = new Map();
const emojiRegex = /^(?:\p{Emoji_Presentation}|\p{Emoji}\uFE0F|\p{Extended_Pictographic}|[\u200D\uFE0F\s])+$/u;

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
    if (!btnSend || !messageInput) {
        return;
    }

    const hasText = messageInput.value.trim().length > 0;
    btnSend.disabled = !hasText && !pendingMedia;
}

function isEmojiOnlyMessage(value) {
    const content = String(value ?? "").trim();
    return content.length > 0 && emojiRegex.test(content);
}

function syncChatModeFields() {
    const isGroup = chatModeSelect && chatModeSelect.value === "group";
    if (privateChatFields) {
        privateChatFields.classList.toggle("d-none", Boolean(isGroup));
    }
    if (groupChatFields) {
        groupChatFields.classList.toggle("d-none", !isGroup);
    }
    if (targetEmailInput) {
        targetEmailInput.required = !isGroup;
    }
    if (groupNameInput) {
        groupNameInput.required = Boolean(isGroup);
    }
    if (groupMemberEmailsInput) {
        groupMemberEmailsInput.required = Boolean(isGroup);
    }
}

function scrollToBottom() {
    if (messagesList) {
        messagesList.scrollTop = messagesList.scrollHeight;
    }
}

function getInitials(name) {
    if (!name) return "?";
    const parts = name.split(" ").filter(p => p.length > 0);
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getPreviewText(message, senderName) {
    if (message.type === MESSAGE_TYPE.image) {
        return `${senderName}: [Hình ảnh]`;
    }

    if (message.type === MESSAGE_TYPE.video) {
        return `${senderName}: [Video]`;
    }

    if (message.type === MESSAGE_TYPE.file) {
        return `${senderName}: [Tệp tin: ${message.fileName}]`;
    }

    let content = message.content || "";
    if (content.length > 25) {
        content = `${content.substring(0, 22)}...`;
    }
    return `${senderName}: ${content}`;
}

function inferMessageTypeFromFile(file) {
    if (!file) {
        return MESSAGE_TYPE.file;
    }

    const mimeType = String(file.type ?? "").toLowerCase();
    const fileName = String(file.name ?? "").toLowerCase();

    if (mimeType.startsWith("image/")) {
        return MESSAGE_TYPE.image;
    }

    if (mimeType.startsWith("video/")) {
        return MESSAGE_TYPE.video;
    }

    if (/\.(png|jpe?g|gif|bmp|webp|svg|avif)$/i.test(fileName)) {
        return MESSAGE_TYPE.image;
    }

    if (/\.(mp4|webm|mov|m4v|ogg|ogv|avi|mkv)$/i.test(fileName)) {
        return MESSAGE_TYPE.video;
    }

    return MESSAGE_TYPE.file;
}

function buildMediaUrl(message) {
    const baseUrl = String(message?.fileUrl ?? "");
    if (!baseUrl) {
        return "";
    }

    const params = [];
    const versionToken = message?.id ?? message?.createdAt ?? "";
    if (versionToken) {
        params.push(`v=${encodeURIComponent(String(versionToken))}`);
    }
    if (serverInstanceToken) {
        params.push(`sv=${encodeURIComponent(serverInstanceToken)}`);
    }

    if (params.length === 0) {
        return baseUrl;
    }

    const separator = baseUrl.includes("?") ? "&" : "?";
    return `${baseUrl}${separator}${params.join("&")}`;
}

function getLocalVideoSource(fileUrl) {
    return uploadedVideoSources.get(String(fileUrl ?? "")) ?? "";
}

function setUploadProgress(visible, percent = 0) {
    if (!uploadProgressContainer || !uploadProgressBar) {
        return;
    }

    uploadProgressContainer.classList.toggle("d-none", !visible);
    uploadProgressBar.style.width = `${percent}%`;
}

function beginUploadProgress() {
    activeUploadCount += 1;
    setUploadProgress(true, 0);
}

function endUploadProgress() {
    activeUploadCount = Math.max(0, activeUploadCount - 1);
    if (activeUploadCount === 0) {
        setUploadProgress(false, 0);
    }
}

function clearPendingMedia() {
    if (pendingMedia?.previewUrl) {
        URL.revokeObjectURL(pendingMedia.previewUrl);
    }

    pendingMedia = null;

    if (mediaPreviewContainer) {
        mediaPreviewContainer.classList.add("d-none");
        mediaPreviewContainer.innerHTML = "";
    }

    if (imageInput) imageInput.value = "";
    if (videoInput) videoInput.value = "";
    updateSendState();
}

function renderPendingMedia() {
    if (!mediaPreviewContainer) {
        return;
    }

    if (!pendingMedia) {
        mediaPreviewContainer.classList.add("d-none");
        mediaPreviewContainer.innerHTML = "";
        return;
    }

    const safeName = escapeHtml(pendingMedia.file.name);
    const previewHtml = pendingMedia.type === MESSAGE_TYPE.image
        ? `<img src="${pendingMedia.previewUrl}" alt="${safeName}" class="media-preview-thumb" />`
        : `<video src="${pendingMedia.previewUrl}" class="media-preview-thumb" muted playsinline></video>`;

    mediaPreviewContainer.innerHTML = `
        <div class="media-preview-card">
            <div class="media-preview-visual">${previewHtml}</div>
            <div class="media-preview-meta">
                <div class="media-preview-title">${safeName}</div>
                <div class="media-preview-hint">Thêm nội dung trong ô nhập rồi bấm gửi.</div>
            </div>
            <button type="button" class="media-preview-remove" id="btnRemovePendingMedia" title="Bỏ đính kèm">
                <span class="material-symbols-outlined">close</span>
            </button>
        </div>
    `;
    mediaPreviewContainer.classList.remove("d-none");

    const removeButton = document.getElementById("btnRemovePendingMedia");
    if (removeButton) {
        removeButton.addEventListener("click", clearPendingMedia);
    }
}

function setPendingMedia(file, type) {
    if (!file) {
        return;
    }

    clearPendingMedia();

    pendingMedia = {
        file,
        type,
        previewUrl: URL.createObjectURL(file)
    };

    renderPendingMedia();
    updateSendState();
    if (messageInput) {
        messageInput.focus();
    }
}

function renderAttachmentContent(message, isCurrentUser) {
    if (message.type === MESSAGE_TYPE.text || message.type === MESSAGE_TYPE.icon) {
        const className = message.type === MESSAGE_TYPE.icon || isEmojiOnlyMessage(message.content) ? "emoji-only-text" : "";
        return `<span class="${className}">${escapeHtml(message.content)}</span>`;
    }

    if (message.type === MESSAGE_TYPE.image) {
        const safeUrl = escapeHtml(buildMediaUrl(message));
        const caption = message.content ? `<div class="media-caption">${escapeHtml(message.content)}</div>` : "";
        return `<img src="${safeUrl}" class="chat-img img-fluid" alt="image" onclick="zoomImage(this.src)" />${caption}`;
    }

    if (message.type === MESSAGE_TYPE.video) {
        const safeUrl = escapeHtml(buildMediaUrl(message));
        const localVideoUrl = isCurrentUser ? getLocalVideoSource(message.fileUrl) : "";
        const safeLocalUrl = localVideoUrl ? escapeHtml(localVideoUrl) : "";
        const caption = message.content ? `<div class="media-caption">${escapeHtml(message.content)}</div>` : "";
        return `<div class="chat-video-shell" data-video-shell>
                    <button type="button" class="chat-video-placeholder" data-video-src="${safeUrl}" data-video-local-src="${safeLocalUrl}" onclick="loadInlineVideo(this)">
                        <span class="material-symbols-outlined">play_circle</span>
                        <span>Xem video</span>
                    </button>
                </div>${caption}`;
    }

    const content = message.content ? escapeHtml(message.content) : "Tài liệu";
    const fileName = escapeHtml(message.fileName);
    const fileUrl = escapeHtml(message.fileUrl);
    const isPdf = message.fileName && message.fileName.toLowerCase().endsWith(".pdf");
    return `<div class="file-attachment-card" onclick="window.open('${fileUrl}', '_blank')">
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

function updateSidebarMessageMetadata(message) {
    const msgEl = document.getElementById(`sidebar-msg-${message.chatId}`);
    if (!msgEl) {
        return;
    }

    msgEl.dataset.lastMessageSenderId = message.senderId || "";
    msgEl.dataset.lastMessageType = String(message.type ?? "");
    msgEl.dataset.lastMessageContent = message.content || "";
    msgEl.dataset.lastMessageFileName = message.fileName || "";
}

function updateSidebarPreview(message) {
    const chatItem = document.querySelector(`.chat-list-item[data-chat-id="${message.chatId}"]`);
    const chatList = document.querySelector(".chat-list");

    if (!chatItem) {
        return;
    }

    const timeEl = document.getElementById(`sidebar-time-${message.chatId}`);
    const msgEl = document.getElementById(`sidebar-msg-${message.chatId}`);

    if (timeEl) {
        timeEl.textContent = formatMessageTime(message.createdAt);
    }

    updateSidebarMessageMetadata(message);

    if (msgEl) {
        const senderName = message.senderId === currentUserId ? "Bạn" : message.senderName;
        msgEl.textContent = getPreviewText(message, senderName);
    }

    if (message.senderId !== currentUserId) {
        if (message.chatId === currentChatId) {
            connection.invoke("MarkChatAsRead", currentChatId).catch(err => console.error(err));
        } else {
            chatItem.classList.add("unread");
            const avatar = chatItem.querySelector(".avatar-circle");
            if (avatar && !avatar.querySelector(".sidebar-unread-dot")) {
                const dot = document.createElement("span");
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

    if (chatList) {
        chatList.prepend(chatItem);
    }
}

function appendMessage(message) {
    if (message.chatId !== currentChatId || !messagesList) {
        return;
    }

    const isCurrentUser = message.senderId === currentUserId;
    const wrapper = document.createElement("div");
    wrapper.className = `message-wrapper new-message ${isCurrentUser ? "justify-content-end" : ""}`;

    let senderAvatarHtml = "";
    let senderNameHtml = "";
    if (!isCurrentUser) {
        const safeSenderName = escapeHtml(message.senderName);
        senderAvatarHtml = `<div class="avatar-circle-sm mb-1 align-self-end" title="${safeSenderName}" data-user-avatar-id="${escapeHtml(message.senderId)}">${escapeHtml(getInitials(message.senderName))}</div>`;
        senderNameHtml = `<div class="sender-name" data-user-name-id="${escapeHtml(message.senderId)}">${safeSenderName}</div>`;
    }

    wrapper.innerHTML = `
        ${senderAvatarHtml}
        <div class="message-box ${isCurrentUser ? "right-msg" : "left-msg"} ${message.type === MESSAGE_TYPE.image || message.type === MESSAGE_TYPE.video ? "media-message" : ""} ${message.type === MESSAGE_TYPE.icon || isEmojiOnlyMessage(message.content) ? "emoji-message" : ""}">
            ${senderNameHtml}
            <div class="message-content">${renderAttachmentContent(message, isCurrentUser)}</div>
            <div class="message-time ${isCurrentUser ? "right" : "left"}">${formatMessageTime(message.createdAt)}</div>
        </div>
    `;

    messagesList.appendChild(wrapper);
    scrollToBottom();
}

function updateConnectionUI(state) {
    const statusDot = document.getElementById("connectionStatusDot");
    const statusText = document.getElementById("connectionStatusText");
    if (!statusDot) {
        return;
    }

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

async function uploadFile(file, onProgress) {
    return await new Promise((resolve, reject) => {
        const formData = new FormData();
        formData.append("file", file);

        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/files/upload", true);

        xhr.upload.onprogress = function (e) {
            if (e.lengthComputable) {
                const percent = (e.loaded / e.total) * 100;
                setUploadProgress(true, percent);
                if (onProgress) {
                    onProgress(percent);
                }
            }
        };

        xhr.onload = function () {
            if (xhr.status >= 200 && xhr.status < 300) {
                resolve(JSON.parse(xhr.responseText));
                return;
            }

            let serverMessage = "";
            try {
                const response = JSON.parse(xhr.responseText);
                serverMessage = response?.title || response?.message || response?.detail || "";
            } catch {
                serverMessage = xhr.responseText || "";
            }

            const fallbackMessage = xhr.status === 413
                ? "Tệp vượt quá giới hạn upload 256MB."
                : `Upload tệp thất bại (HTTP ${xhr.status}).`;

            reject(new Error(serverMessage || fallbackMessage));
        };

        xhr.onerror = function () {
            reject(new Error("Upload tệp thất bại."));
        };

        xhr.send(formData);
    });
}

async function sendTextMessage() {
    const message = messageInput.value.trim();
    if (!message) {
        return;
    }

    const messageType = isEmojiOnlyMessage(message) ? MESSAGE_TYPE.icon : MESSAGE_TYPE.text;
    await connection.invoke("SendMessage", currentChatId, message, messageType, null, null, null);
    messageInput.value = "";
}

async function enqueueAttachmentSend(file, type, caption = "") {
    beginUploadProgress();

    try {
        const uploadResponse = await uploadFile(file);
        if (type === MESSAGE_TYPE.video && uploadResponse?.fileUrl) {
            const localObjectUrl = URL.createObjectURL(file);
            uploadedVideoSources.set(uploadResponse.fileUrl, localObjectUrl);
            loadedVideoUrls.add(localObjectUrl);
        }
        await connection.invoke(
            "SendMessage",
            currentChatId,
            caption,
            type,
            uploadResponse.fileUrl,
            uploadResponse.fileName,
            uploadResponse.fileSize
        );
    } catch (error) {
        alert(error?.message || "Không gửi được tệp.");
        console.error(error);
    } finally {
        endUploadProgress();
        updateSendState();
    }
}

async function handleSend() {
    if (!currentChatId || !messageInput) {
        return;
    }

    const hasText = messageInput.value.trim().length > 0;
    if (!pendingMedia && !hasText) {
        return;
    }

    try {
        if (pendingMedia) {
            const mediaToSend = pendingMedia;
            const caption = messageInput.value.trim();
            clearPendingMedia();
            messageInput.value = "";
            updateSendState();
            enqueueAttachmentSend(mediaToSend.file, mediaToSend.type, caption);
        } else {
            await sendTextMessage();
        }

        messageInput.focus();
    } catch (error) {
        alert(error?.message || "Không gửi được tin nhắn.");
        console.error(error);
        updateSendState();
    }
}

function updateUserDisplayName(userId, displayName) {
    if (!userId || !displayName) {
        return;
    }

    document.querySelectorAll(`[data-user-name-id="${userId}"]`).forEach(element => {
        element.textContent = displayName;
    });

    document.querySelectorAll(`[data-user-avatar-id="${userId}"]`).forEach(element => {
        element.textContent = getInitials(displayName);
        const title = element.getAttribute("title");
        if (title) {
            const emailMatch = title.match(/\(([^)]+)\)$/);
            element.title = emailMatch ? `${displayName} (${emailMatch[1]})` : displayName;
        } else {
            element.title = displayName;
        }
    });

    document.querySelectorAll(`[data-private-chat-user-id="${userId}"]`).forEach(element => {
        if (element.hasAttribute("data-chat-header-avatar")) {
            element.textContent = getInitials(displayName);
            return;
        }

        element.textContent = displayName;
    });

    document.querySelectorAll("[id^='sidebar-msg-']").forEach(element => {
        if (element.dataset.lastMessageSenderId !== userId) {
            return;
        }

        const messageType = Number(element.dataset.lastMessageType);
        const content = element.dataset.lastMessageContent || "";
        const fileName = element.dataset.lastMessageFileName || "";
        const senderName = userId === currentUserId ? "Bạn" : displayName;
        element.textContent = getPreviewText({ type: messageType, content, fileName }, senderName);
    });
}

window.zoomImage = function (src) {
    const lightbox = document.getElementById("imageLightbox");
    const lightboxImg = document.getElementById("lightboxImage");
    if (lightbox && lightboxImg) {
        lightboxImg.src = src;
        lightbox.style.display = "flex";
    }
};

window.closeLightbox = function () {
    const lightbox = document.getElementById("imageLightbox");
    if (lightbox) {
        lightbox.style.display = "none";
    }
};

window.loadInlineVideo = function (button) {
    if (!button) {
        return;
    }

    const videoSrc = button.getAttribute("data-video-src");
    if (!videoSrc) {
        return;
    }

    const localVideoSrc = button.getAttribute("data-video-local-src");

    const shell = button.closest("[data-video-shell]");
    if (!shell) {
        return;
    }

    if (button.dataset.loading === "true") {
        return;
    }

    button.dataset.loading = "true";
    button.disabled = true;
    button.innerHTML = `
        <span class="material-symbols-outlined">progress_activity</span>
        <span>Đang tải video...</span>
    `;

    if (localVideoSrc) {
        shell.innerHTML = `<video src="${localVideoSrc}" class="chat-video img-fluid" controls preload="auto" playsinline autoplay></video>`;
        const localVideo = shell.querySelector("video");
        if (localVideo) {
            localVideo.load();
        }
        return;
    }

    fetch(videoSrc, {
        credentials: "same-origin",
        cache: "no-store"
    })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            return response.blob();
        })
        .then(blob => {
            const objectUrl = URL.createObjectURL(blob);
            loadedVideoUrls.add(objectUrl);
            shell.innerHTML = `<video src="${objectUrl}" class="chat-video img-fluid" controls preload="auto" playsinline autoplay></video>`;
            const video = shell.querySelector("video");
            if (video) {
                video.load();
            }
        })
        .catch(error => {
            console.error(error);
            button.dataset.loading = "false";
            button.disabled = false;
            button.innerHTML = `
                <span class="material-symbols-outlined">play_circle</span>
                <span>Tải video thất bại, bấm thử lại</span>
            `;
        });
};

window.addEventListener("beforeunload", () => {
    loadedVideoUrls.forEach(url => URL.revokeObjectURL(url));
    loadedVideoUrls.clear();
});


document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
        window.closeLightbox();
    }
});

document.addEventListener("DOMContentLoaded", () => {
    scrollToBottom();
    updateConnectionUI("connecting");
    updateSendState();
    syncChatModeFields();
});

connection.on("ReceiveMessage", function (message) {
    updateSidebarPreview(message);
    appendMessage(message);
});

connection.on("NewChatCreated", function () {
    window.location.reload();
});

connection.on("UserStatusChanged", function (userId, isOnline) {
    const partnerIdInput = document.getElementById("partnerUserId");
    if (partnerIdInput && partnerIdInput.value === userId) {
        const statusDot = document.getElementById("partnerStatusDot");
        const statusText = document.getElementById("partnerStatusText");
        if (statusDot && statusText) {
            statusDot.className = `status-dot ${isOnline ? "online" : "offline"}`;
            statusText.textContent = isOnline ? "Online" : "Offline";
        }
    }
});

connection.on("UserProfileUpdated", function (userId, displayName) {
    updateUserDisplayName(userId, displayName);
});

if (chatIdInput && currentChatId) {
    const btnEmoji = document.getElementById("btnEmoji");
    const emojiPicker = document.getElementById("emojiPicker");
    const emojis = [
        "😀", "😁", "😂", "🤣", "😊", "😍", "🥰", "😘", "😎", "🤩", "🤔", "😴",
        "😭", "😤", "😡", "🥲", "😱", "🤯", "🥳", "😇", "🤗", "🫠", "🙃", "🥹",
        "👍", "👎", "👏", "🙌", "🙏", "💪", "👀", "❤️", "💔", "🔥", "✨", "💯",
        "🎉", "🎶", "🎧", "☕", "🍀", "🌈", "⚡", "💼", "📚", "🚀", "🎮", "🐱"
    ];

    if (emojiPicker && btnEmoji) {
        emojis.forEach(emoji => {
            const span = document.createElement("span");
            span.textContent = emoji;
            span.style.userSelect = "none";
            span.onclick = () => {
                messageInput.value += emoji;
                emojiPicker.classList.add("d-none");
                messageInput.focus();
                updateSendState();
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

    if (btnSend) {
        btnSend.addEventListener("click", async function (event) {
            event.preventDefault();
            await handleSend();
        });
    }

    if (messageInput) {
        messageInput.addEventListener("input", updateSendState);
        messageInput.addEventListener("keypress", function (e) {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                btnSend.click();
            }
        });
    }

    if (btnAttachImage && imageInput) {
        btnAttachImage.addEventListener("click", () => imageInput.click());
        imageInput.addEventListener("change", (e) => setPendingMedia(e.target.files[0], MESSAGE_TYPE.image));
    }

    if (btnAttachVideo && videoInput) {
        btnAttachVideo.addEventListener("click", () => videoInput.click());
        videoInput.addEventListener("change", (e) => setPendingMedia(e.target.files[0], MESSAGE_TYPE.video));
    }

    if (btnAttachFile && fileInput) {
        btnAttachFile.addEventListener("click", () => fileInput.click());
        fileInput.addEventListener("change", (e) => {
            const file = e.target.files[0];
            if (!file) {
                return;
            }

            fileInput.value = "";
            const inferredType = inferMessageTypeFromFile(file);
            if (inferredType === MESSAGE_TYPE.image || inferredType === MESSAGE_TYPE.video) {
                setPendingMedia(file, inferredType);
                return;
            }

            enqueueAttachmentSend(file, MESSAGE_TYPE.file);
        });
    }
}

if (chatModeSelect) {
    chatModeSelect.addEventListener("change", syncChatModeFields);
}

connection.start().then(function () {
    updateConnectionUI("connected");
    if (chatIdInput && currentChatId) {
        connection.invoke("JoinChat", currentChatId).catch(function (err) {
            console.error(err.toString());
            window.location.assign("/Chat");
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

connection.onreconnecting(() => {
    updateConnectionUI("reconnecting");
});

connection.onreconnected(() => {
    updateConnectionUI("connected");
});

connection.onclose(() => {
    updateConnectionUI("disconnected");
});
