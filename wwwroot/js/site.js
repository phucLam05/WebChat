// Iframe detection: Add "in-iframe" class to body if this page is nested in an iframe
if (window.self !== window.top) {
    document.body.classList.add("in-iframe");
}

// Settings modal load/reset logic
document.addEventListener("DOMContentLoaded", () => {
    const settingsModal = document.getElementById("settingsModal");
    if (settingsModal) {
        settingsModal.addEventListener("show.bs.modal", () => {
            const iframe = document.getElementById("settingsIframe");
            if (iframe) {
                // Point to settings page when showing the modal
                iframe.src = "/Identity/Account/Manage";
            }
        });

        settingsModal.addEventListener("hidden.bs.modal", () => {
            const iframe = document.getElementById("settingsIframe");
            if (iframe) {
                // Clear iframe src when closed to prevent keeping state and free up memory
                iframe.src = "about:blank";
            }
        });
    }
});
