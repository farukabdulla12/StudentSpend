const SUPABASE_URL = "https://nghhwccvhllhvaegolnf.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_os5MeJr2pe0n0FcDILjm7w_vdfE190O";
const connection = window.StudentSpendConnection;
const supabaseClient = window.supabase && SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
    : null;
const RECOVERY_USER_KEY = "studentSpendRecoveryUserId";

const newPasswordInput = document.getElementById("newPasswordInput");
const resetConfirmPasswordInput = document.getElementById("resetConfirmPasswordInput");
const newPasswordToggle = document.getElementById("newPasswordToggle");
const resetConfirmPasswordToggle = document.getElementById("resetConfirmPasswordToggle");
const newPasswordError = document.getElementById("newPasswordError");
const resetConfirmPasswordError = document.getElementById("resetConfirmPasswordError");
const resetMainError = document.getElementById("resetMainError");
const resetRecoveryStatus = document.getElementById("resetRecoveryStatus");
const resetPasswordForm = document.getElementById("resetPasswordForm");
const resetPasswordBtn = document.getElementById("resetPasswordBtn");
const resetPasswordBtnText = document.getElementById("resetPasswordBtnText");
const resetPasswordBtnIcon = document.getElementById("resetPasswordBtnIcon");
const resetSuccessMessage = document.getElementById("resetSuccessMessage");
const passwordStrengthBar = document.getElementById("passwordStrengthBar");
const passwordStrengthText = document.getElementById("passwordStrengthText");

let recoverySessionValid = false;

function clearResetErrors() {
    newPasswordError.textContent = "";
    resetConfirmPasswordError.textContent = "";
    resetMainError.textContent = "";
}

function togglePasswordVisibility(input, button) {
    const isPassword = input.type === "password";
    input.type = isPassword ? "text" : "password";
    button.innerHTML = isPassword
        ? '<i class="fa-solid fa-eye-slash"></i>'
        : '<i class="fa-solid fa-eye"></i>';
    button.setAttribute("aria-label", isPassword ? "Hide password" : "Show password");
}

function showInvalidRecoveryLink(message = "This password reset link is invalid or has expired. Please request a new reset link.") {
    recoverySessionValid = false;
    resetPasswordForm.classList.add("hidden");
    resetRecoveryStatus.textContent = message;
}

function updatePasswordStrength() {
    const password = newPasswordInput.value;
    const score = [
        password.length >= 6,
        password.length >= 10,
        /[A-Z]/.test(password) && /[a-z]/.test(password),
        /\d/.test(password),
        /[^A-Za-z0-9]/.test(password)
    ].filter(Boolean).length;
    const labels = ["Use at least 6 characters.", "Weak", "Fair", "Good", "Strong", "Strong"];

    passwordStrengthBar.style.width = `${score * 20}%`;
    passwordStrengthBar.dataset.strength = score < 2 ? "weak" : score < 4 ? "fair" : "strong";
    passwordStrengthText.textContent = password ? labels[score] : labels[0];
}

function setResetLoading(isLoading) {
    resetPasswordBtn.disabled = isLoading;
    resetPasswordBtn.setAttribute("aria-busy", String(isLoading));
    resetPasswordBtnText.textContent = isLoading ? "Updating password..." : "Update Password";
    resetPasswordBtnIcon.className = isLoading
        ? "fa-solid fa-spinner fa-spin"
        : "fa-solid fa-arrow-right";
}

async function authorizeRecoverySession(userId) {
    if (!supabaseClient || !userId) {
        showInvalidRecoveryLink();
        return;
    }

    const { data: { user }, error } = await supabaseClient.auth.getUser();
    if (error) {
        sessionStorage.removeItem(RECOVERY_USER_KEY);
        showInvalidRecoveryLink(connection.handleError(error)
            ? "You're offline. Reconnect to verify your password reset link."
            : undefined);
        return;
    }

    if (!user || user.id !== userId) {
        sessionStorage.removeItem(RECOVERY_USER_KEY);
        showInvalidRecoveryLink();
        return;
    }

    recoverySessionValid = true;
    resetRecoveryStatus.textContent = "";
    resetPasswordForm.classList.remove("hidden");
}

async function initializeRecoverySession() {
    if (!supabaseClient) {
        showInvalidRecoveryLink("Password recovery is temporarily unavailable. Please try again later.");
        return;
    }

    const { data: { session }, error } = await supabaseClient.auth.getSession();
    if (error) {
        if (connection.handleError(error)) {
            showInvalidRecoveryLink("You're offline. Reconnect to verify your password reset link.");
        } else {
            showInvalidRecoveryLink();
        }
        return;
    }

    const recoveryUserId = sessionStorage.getItem(RECOVERY_USER_KEY);
    if (!session || !recoveryUserId || session.user.id !== recoveryUserId) {
        showInvalidRecoveryLink();
        return;
    }

    await authorizeRecoverySession(recoveryUserId);
}

async function handlePasswordReset(event) {
    event.preventDefault();
    clearResetErrors();

    if (!recoverySessionValid || !supabaseClient) {
        showInvalidRecoveryLink();
        return;
    }

    const newPassword = newPasswordInput.value;
    const confirmPassword = resetConfirmPasswordInput.value;

    if (!newPassword.trim()) {
        newPasswordError.textContent = "Please enter a new password.";
        newPasswordInput.focus();
        return;
    }

    if (newPassword.length < 6) {
        newPasswordError.textContent = "Password must be at least 6 characters long.";
        newPasswordInput.focus();
        return;
    }

    if (!confirmPassword) {
        resetConfirmPasswordError.textContent = "Please confirm your new password.";
        resetConfirmPasswordInput.focus();
        return;
    }

    if (newPassword !== confirmPassword) {
        resetConfirmPasswordError.textContent = "Passwords do not match.";
        resetConfirmPasswordInput.focus();
        return;
    }

    if (!connection.isOnline()) {
        connection.showOffline();
        resetMainError.textContent = "No internet connection. Please try again when you're online.";
        return;
    }

    setResetLoading(true);
    try {
        const { error } = await supabaseClient.auth.updateUser({ password: newPassword });
        if (error) {
            if (connection.handleError(error)) {
                resetMainError.textContent = "No internet connection. Please try again when you're online.";
            } else {
                resetMainError.textContent = "We could not update your password. Please try again.";
            }
            return;
        }

        sessionStorage.removeItem(RECOVERY_USER_KEY);
        recoverySessionValid = false;
        const { error: signOutError } = await supabaseClient.auth.signOut({ scope: "local" });
        if (signOutError) {
            resetMainError.textContent = "Your password was updated. Please sign out before logging in again.";
            return;
        }

        resetPasswordForm.classList.add("hidden");
        resetRecoveryStatus.textContent = "";
        resetSuccessMessage.classList.remove("hidden");
    } catch (error) {
        if (connection.handleError(error)) {
            resetMainError.textContent = "No internet connection. Please try again when you're online.";
        } else {
            resetMainError.textContent = "We could not update your password. Please try again.";
        }
    } finally {
        setResetLoading(false);
    }
}

newPasswordToggle.addEventListener("click", () => {
    togglePasswordVisibility(newPasswordInput, newPasswordToggle);
});

resetConfirmPasswordToggle.addEventListener("click", () => {
    togglePasswordVisibility(resetConfirmPasswordInput, resetConfirmPasswordToggle);
});

newPasswordInput.addEventListener("input", updatePasswordStrength);
resetPasswordForm.addEventListener("submit", handlePasswordReset);

if (supabaseClient) {
    supabaseClient.auth.onAuthStateChange((event, session) => {
        if (event === "PASSWORD_RECOVERY" && session) {
            sessionStorage.setItem(RECOVERY_USER_KEY, session.user.id);
            const cleanUrl = `${window.location.origin}${window.location.pathname}`;
            window.history.replaceState(null, document.title, cleanUrl);
            window.setTimeout(() => {
                authorizeRecoverySession(session.user.id).catch((error) => {
                    showInvalidRecoveryLink(connection.handleError(error)
                        ? "You're offline. Reconnect to verify your password reset link."
                        : undefined);
                });
            }, 0);
        }
    });
}

initializeRecoverySession().catch((error) => {
    if (connection.handleError(error)) {
        showInvalidRecoveryLink("You're offline. Reconnect to verify your password reset link.");
    } else {
        showInvalidRecoveryLink();
    }
});
