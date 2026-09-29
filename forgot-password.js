const SUPABASE_URL = "https://nghhwccvhllhvaegolnf.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_os5MeJr2pe0n0FcDILjm7w_vdfE190O";
const RESET_PASSWORD_URL = new URL("reset-password.html", window.location.href).href;
const connection = window.StudentSpendConnection;
const supabaseClient = window.supabase && SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
    : null;

const forgotPasswordForm = document.getElementById("forgotPasswordForm");
const forgotEmailInput = document.getElementById("forgotEmailInput");
const forgotEmailError = document.getElementById("forgotEmailError");
const forgotMainError = document.getElementById("forgotMainError");
const sendResetLinkBtn = document.getElementById("sendResetLinkBtn");
const sendResetLinkText = document.getElementById("sendResetLinkText");
const sendResetLinkIcon = document.getElementById("sendResetLinkIcon");
const forgotPasswordFormSection = document.getElementById("forgotPasswordFormSection");
const forgotPasswordSuccess = document.getElementById("forgotPasswordSuccess");
const sentResetEmail = document.getElementById("sentResetEmail");

function setForgotPasswordLoading(isLoading) {
    sendResetLinkBtn.disabled = isLoading;
    sendResetLinkBtn.setAttribute("aria-busy", String(isLoading));
    sendResetLinkText.textContent = isLoading ? "Sending reset link..." : "Send Reset Link";
    sendResetLinkIcon.className = isLoading
        ? "fa-solid fa-spinner fa-spin"
        : "fa-solid fa-arrow-right";
}

function isValidEmail(email) {
    return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

forgotPasswordForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    forgotEmailError.textContent = "";
    forgotMainError.textContent = "";

    const email = forgotEmailInput.value.trim().toLowerCase();
    if (!email) {
        forgotEmailError.textContent = "Please enter your email address.";
        forgotEmailInput.focus();
        return;
    }

    if (!isValidEmail(email)) {
        forgotEmailError.textContent = "Please enter a valid email address.";
        forgotEmailInput.focus();
        return;
    }

    if (!connection.isOnline()) {
        connection.showOffline();
        forgotMainError.textContent = "No internet connection. Please try again when you're online.";
        return;
    }

    if (!supabaseClient) {
        forgotMainError.textContent = "Password recovery is temporarily unavailable. Please try again later.";
        return;
    }

    setForgotPasswordLoading(true);
    try {
        const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
            redirectTo: RESET_PASSWORD_URL
        });
        if (error) {
            if (connection.handleError(error)) {
                forgotMainError.textContent = "No internet connection. Please try again when you're online.";
            } else {
                forgotMainError.textContent = "Unable to send the reset link. Please try again.";
            }
            return;
        }

        sentResetEmail.textContent = email;
        forgotPasswordFormSection.classList.add("hidden");
        forgotPasswordSuccess.classList.remove("hidden");
    } catch (error) {
        if (connection.handleError(error)) {
            forgotMainError.textContent = "No internet connection. Please try again when you're online.";
        } else {
            forgotMainError.textContent = "Unable to send the reset link. Please try again.";
        }
    } finally {
        setForgotPasswordLoading(false);
    }
});
