(function () {
  "use strict";

  if (window.StudentSpendConnection) {
    return;
  }

  const offlineMessage =
    "⚠️ No internet connection. Please turn on your mobile data or Wi-Fi.";
  const restoredMessage =
    "✓ Internet connection restored.";

  let offline = navigator.onLine === false;
  let hideTimer = null;
  let notice = null;

  function getNotice() {
    if (notice) {
      return notice;
    }

    notice = document.createElement("div");
    notice.id = "connectionNotice";
    notice.className = "connection-notice";
    notice.setAttribute("role", "status");
    notice.setAttribute("aria-live", "polite");
    notice.hidden = true;
    document.body.appendChild(notice);

    return notice;
  }

  function display(message, kind) {
    const element = getNotice();
    element.textContent = message;
    element.className = `connection-notice connection-notice-${kind}`;
    element.hidden = false;
  }

  function showOffline(message = offlineMessage) {
    offline = true;
    window.clearTimeout(hideTimer);
    display(message, "offline");
  }

  function showRestored() {
    const wasOffline = offline;
    offline = false;

    if (!wasOffline) {
      return;
    }

    display(restoredMessage, "online");
    window.clearTimeout(hideTimer);
    hideTimer = window.setTimeout(() => {
      if (!offline && notice) {
        notice.hidden = true;
      }
    }, 3200);
  }

  function isOnline() {
    return navigator.onLine !== false && !offline;
  }

  function isNetworkError(error) {
    if (navigator.onLine === false) {
      return true;
    }

    const message = [
      error && error.message,
      error && error.cause && error.cause.message
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return /failed to fetch|fetch failed|networkerror|network error|network request failed|load failed|connection (?:was )?(?:lost|closed|refused|reset)|internet disconnected|err_(?:internet_disconnected|connection|name_not_resolved)/.test(
      message
    );
  }

  function handleError(error) {
    if (!isNetworkError(error)) {
      return false;
    }

    showOffline();
    return true;
  }

  window.StudentSpendConnection = {
    isOnline,
    showOffline,
    handleError
  };

  window.addEventListener("offline", () => {
    showOffline();
  });
  window.addEventListener("online", showRestored);

  if (offline) {
    showOffline();
  }
})();
