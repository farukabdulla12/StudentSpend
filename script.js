// ==========================================
// STUDENTSPEND AUTH
// EMAIL + PASSWORD ONLY
// ==========================================

let supabaseClient = null;
const connection =
    window.StudentSpendConnection;
const SIGNUP_COOLDOWN_MS = 5000;
const DISPOSABLE_EMAIL_DOMAINS = new Set([
    "10minutemail.com",
    "10minutemail.co.uk",
    "10minutemail.net",
    "dispostable.com",
    "emailondeck.com",
    "fakeinbox.com",
    "getnada.com",
    "guerrillamail.com",
    "guerrillamailblock.com",
    "guerrillamail.net",
    "maildrop.cc",
    "mailinator.com",
    "mailinator.net",
    "mailinator.org",
    "mohmal.com",
    "sharklasers.com",
    "temp-mail.io",
    "temp-mail.org",
    "tempmail.com",
    "tempmail.net",
    "throwaway.email",
    "throwawaymail.com",
    "trashmail.com",
    "yopmail.com",
    "yopmail.fr",
    "yopmail.net"
]);
let authRequestInProgress = false;
let lastSignupAttemptAt = 0;


// ==========================================
// SUPABASE CONFIG
// ==========================================

const SUPABASE_URL =
    "https://nghhwccvhllhvaegolnf.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_os5MeJr2pe0n0FcDILjm7w_vdfE190O";


// ==========================================
// CREATE SUPABASE CLIENT
// ==========================================

if (
    window.supabase &&
    SUPABASE_URL &&
    SUPABASE_PUBLISHABLE_KEY
) {

    supabaseClient =
        window.supabase.createClient(
            SUPABASE_URL,
            SUPABASE_PUBLISHABLE_KEY
        );

} else {

    console.error(
        "Supabase library or credentials missing."
    );

}

function setupAuthStateListener() {
    if (!supabaseClient || typeof supabaseClient.auth?.onAuthStateChange !== "function") {
        return;
    }

    supabaseClient.auth.onAuthStateChange((event, session) => {
        const isAuthPage = window.location.pathname.endsWith("index.html") || window.location.pathname.endsWith("/") || window.location.pathname.endsWith("reset-password.html") === false;

        if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED") && session) {
            if (window.location.pathname.endsWith("index.html") || window.location.pathname.endsWith("/")) {
                window.location.replace("dashboard.html");
            }
            return;
        }

        if ((event === "SIGNED_OUT" || event === "USER_DELETED") && window.location.pathname.endsWith("dashboard.html")) {
            window.location.replace("index.html");
            return;
        }

        if (event === "PASSWORD_RECOVERY" && window.location.pathname.endsWith("index.html")) {
            window.location.replace("reset-password.html");
        }
    });
}

setupAuthStateListener();


// ==========================================
// CURRENT MODE
// ==========================================

let currentMode = "login";


// ==========================================
// ELEMENTS
// ==========================================

const loginTab =
    document.getElementById("loginTab");

const registerTab =
    document.getElementById("registerTab");

const authTitle =
    document.getElementById("authTitle");

const authSubtitle =
    document.getElementById("authSubtitle");

const emailInput =
    document.getElementById("emailInput");

const passwordInput =
    document.getElementById("passwordInput");

const confirmPasswordInput =
    document.getElementById("confirmPasswordInput");

const confirmPasswordGroup =
    document.getElementById("confirmPasswordGroup");

const authBtn =
    document.getElementById("authBtn");

const authBtnText =
    document.getElementById("authBtnText");

const authBtnIcon =
    document.getElementById("authBtnIcon");

const passwordToggle =
    document.getElementById("passwordToggle");

const confirmPasswordToggle =
    document.getElementById("confirmPasswordToggle");

const emailError =
    document.getElementById("emailError");

const passwordError =
    document.getElementById("passwordError");

const confirmPasswordError =
    document.getElementById("confirmPasswordError");

const mainError =
    document.getElementById("mainError");

const authSection =
    document.getElementById("authSection");

const verificationMessage =
    document.getElementById("verificationMessage");

const verificationText =
    document.getElementById("verificationText");

const backToLoginBtn =
    document.getElementById("backToLoginBtn");

// ==========================================
// LOGIN TAB
// ==========================================

loginTab.addEventListener(
    "click",
    function () {

        currentMode = "login";

        loginTab.classList.add("active");

        registerTab.classList.remove("active");

        authTitle.textContent =
            "Welcome back";

        authSubtitle.textContent =
            "Login to continue to your account";

        confirmPasswordGroup.classList.add(
            "hidden"
        );

        confirmPasswordInput.value = "";

        authBtnText.textContent =
            "Login";

        authBtnIcon.className =
            "fa-solid fa-arrow-right";

        clearErrors();

    }
);


// ==========================================
// REGISTER TAB
// ==========================================

registerTab.addEventListener(
    "click",
    function () {

        currentMode = "register";

        registerTab.classList.add("active");

        loginTab.classList.remove("active");

        authTitle.textContent =
            "Create your account";

        authSubtitle.textContent =
            "Create a secure StudentSpend account";

        confirmPasswordGroup.classList.remove(
            "hidden"
        );

        authBtnText.textContent =
            "Create account";

        authBtnIcon.className =
            "fa-solid fa-user-plus";

        clearErrors();

    }
);


// ==========================================
// PASSWORD SHOW / HIDE
// ==========================================

passwordToggle.addEventListener(
    "click",
    function () {

        togglePassword(
            passwordInput,
            passwordToggle
        );

    }
);


confirmPasswordToggle.addEventListener(
    "click",
    function () {

        togglePassword(
            confirmPasswordInput,
            confirmPasswordToggle
        );

    }
);


function togglePassword(
    input,
    button
) {

    if (input.type === "password") {

        input.type = "text";

        button.innerHTML =
            '<i class="fa-solid fa-eye-slash"></i>';

    } else {

        input.type = "password";

        button.innerHTML =
            '<i class="fa-solid fa-eye"></i>';

    }

}


// ==========================================
// AUTH BUTTON
// ==========================================

authBtn.addEventListener(
    "click",
    handleAuth
);


// ==========================================
// ENTER KEY
// ==========================================

emailInput.addEventListener(
    "keydown",
    handleEnter
);

passwordInput.addEventListener(
    "keydown",
    handleEnter
);

confirmPasswordInput.addEventListener(
    "keydown",
    handleEnter
);


function handleEnter(event) {

    if (event.key === "Enter") {

        handleAuth();

    }

}


// ==========================================
// MAIN AUTH FUNCTION
// ==========================================

async function handleAuth() {

    if (authRequestInProgress) {
        return;
    }

    clearErrors();

    const email =
        emailInput.value.trim();

    const password =
        passwordInput.value;

    const confirmPassword =
        confirmPasswordInput.value;

    if (!email || !password || (currentMode === "register" && !confirmPassword)) {
        showMainError("Please fill in all required fields.");

        if (!email) {
            emailInput.focus();
        } else if (!password) {
            passwordInput.focus();
        } else if (currentMode === "register" && !confirmPassword) {
            confirmPasswordInput.focus();
        }

        return;
    }

    if (currentMode === "register") {
        const signupEmailError =
            getSignupEmailError(email);

        if (signupEmailError) {
            emailError.textContent =
                signupEmailError;
            emailInput.focus();
            return;
        }
    } else if (!validateEmail(email)) {
        emailError.textContent =
            "Please enter a valid email address.";
        emailInput.focus();
        return;
    }

    if (password.length < 6) {
        passwordError.textContent = "Password must be at least 6 characters.";
        passwordInput.focus();
        return;
    }

    if (currentMode === "register") {
        if (password !== confirmPassword) {
            confirmPasswordError.textContent = "Passwords do not match.";
            confirmPasswordInput.focus();
            return;
        }
    }

    if (!connection.isOnline()) {
        const message = "No internet connection. Please turn on your mobile data or Wi-Fi.";
        connection.showOffline(message);
        showMainError(message);
        return;
    }

    if (!supabaseClient) {
        showMainError("Supabase is not connected.");
        return;
    }

    if (currentMode === "register") {
        const remainingCooldown =
            SIGNUP_COOLDOWN_MS - (Date.now() - lastSignupAttemptAt);

        if (remainingCooldown > 0) {
            showMainError(
                "Please wait a moment before trying to sign up again."
            );
            return;
        }

        lastSignupAttemptAt = Date.now();
    }

    authRequestInProgress = true;
    setLoading(true);

    try {
        if (currentMode === "register") {
            await registerUser(email, password);
        } else {
            await loginUser(email, password);
        }
    } catch (error) {

        if (connection.handleError(error)) {
            showMainError("No internet connection. Please turn on your mobile data or Wi-Fi.");
        } else {
            showMainError(getFriendlyError(error));
        }

    } finally {
        authRequestInProgress = false;
        setLoading(false);
    }
}


// ==========================================
// REGISTER USER
// ==========================================

async function registerUser(
    email,
    password
) {

    const redirectUrl =
        new URL(
            "dashboard.html",
            window.location.href
        ).href;


    const {
        data,
        error
    } =
        await supabaseClient.auth.signUp({

            email: email,

            password: password,

            options: {

                emailRedirectTo:
                    redirectUrl

            }

        });


    if (error) {
        if (error.message && error.message.toLowerCase().includes("already registered")) {
            throw new Error("An account with this email already exists. Please log in.");
        }

        throw error;
    }

    /*
       If Supabase has email confirmation enabled,
       user will receive a verification email.
    */

    if (
        data.user &&
        !data.session
    ) {

        authSection.classList.add(
            "hidden"
        );

        verificationMessage.classList.remove(
            "hidden"
        );

        verificationText.textContent =
            `We sent a verification link to ${email}. Please verify your email before logging in.`;

        return;

    }


    /*
       If email confirmation is disabled,
       session can be created immediately.
    */

    if (data.session) {

        window.location.href =
            "dashboard.html";

    }

}


// ==========================================
// LOGIN USER
// ==========================================

async function loginUser(
    email,
    password
) {

    const {
        data,
        error
    } =
        await supabaseClient.auth.signInWithPassword({

            email: email,

            password: password

        });


    if (error) {
        if (error.message && error.message.toLowerCase().includes("invalid login credentials")) {
            throw new Error("Incorrect email or password.");
        }

        throw error;
    }


    if (!data.session) {

        throw new Error(
            "Login session could not be created."
        );

    }


    /*
       Supabase email confirmation is enabled:
       unverified users normally cannot authenticate.
    */

    window.location.href =
        "dashboard.html";

}


// ==========================================
// BACK TO LOGIN
// ==========================================

backToLoginBtn.addEventListener(
    "click",
    function () {

        verificationMessage.classList.add(
            "hidden"
        );

        authSection.classList.remove(
            "hidden"
        );

        currentMode = "login";

        loginTab.click();

        emailInput.focus();

    }
);


// ==========================================
// VALIDATE EMAIL
// ==========================================

function validateEmail(email) {

    const pattern =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    return pattern.test(email);

}


function getSignupEmailError(email) {

    const atIndex =
        email.indexOf("@");

    if (
        email.length > 254 ||
        atIndex < 1 ||
        atIndex !== email.lastIndexOf("@")
    ) {
        return "Invalid email format. Please enter a valid email address.";
    }

    const localPart =
        email.slice(0, atIndex);
    const domain =
        email.slice(atIndex + 1).toLowerCase();
    const localPartPattern =
        /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/;
    const domainLabels =
        domain.split(".");
    const validDomain =
        domainLabels.length >= 2 &&
        domainLabels.every((label) =>
            label.length <= 63 &&
            /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/.test(label)
        ) &&
        /^[A-Za-z]{2,}$/.test(domainLabels[domainLabels.length - 1]);

    if (
        localPart.length > 64 ||
        !localPartPattern.test(localPart) ||
        !validDomain
    ) {
        return "Invalid email format. Please enter a valid email address.";
    }

    const isDisposable =
        Array.from(DISPOSABLE_EMAIL_DOMAINS).some((blockedDomain) =>
            domain === blockedDomain ||
            domain.endsWith(`.${blockedDomain}`)
        );

    if (isDisposable) {
        return "Temporary/disposable email addresses are not allowed.";
    }

    return "";

}


// ==========================================
// LOADING
// ==========================================

function setLoading(isLoading) {

    authBtn.disabled =
        isLoading;
    loginTab.disabled =
        isLoading;
    registerTab.disabled =
        isLoading;
    authBtn.setAttribute(
        "aria-busy",
        String(isLoading)
    );


    if (isLoading) {

        authBtnText.textContent =
            currentMode === "register"
                ? "Creating account..."
                : "Signing in...";

        authBtnIcon.className =
            "fa-solid fa-spinner fa-spin";

    } else {

        authBtnText.textContent =
            currentMode === "register"
                ? "Create account"
                : "Login";

        authBtnIcon.className =
            currentMode === "register"
                ? "fa-solid fa-user-plus"
                : "fa-solid fa-arrow-right";

    }

}


// ==========================================
// ERROR MESSAGE
// ==========================================

function showMainError(message) {

    mainError.textContent =
        message;

}


// ==========================================
// CLEAR ERRORS
// ==========================================

function clearErrors() {

    emailError.textContent = "";

    passwordError.textContent = "";

    confirmPasswordError.textContent = "";

    mainError.textContent = "";

}


// ==========================================
// FRIENDLY SUPABASE ERRORS
// ==========================================

function getFriendlyError(error) {

    const message =
        error?.message || "";

    const lower =
        message.toLowerCase();


    if (
        lower.includes(
            "invalid login credentials"
        ) ||
        lower.includes(
            "incorrect email or password"
        )
    ) {

        return "Incorrect email or password.";

    }


    if (
        lower.includes(
            "email not confirmed"
        )
    ) {

        return "Please verify your email first. Check your inbox.";

    }


    if (
        lower.includes(
            "user already registered"
        ) ||
        lower.includes(
            "already exists"
        ) ||
        lower.includes(
            "email already"
        )
    ) {

        return "An account with this email already exists. Please log in.";

    }


    if (
        lower.includes(
            "password should be at least"
        )
    ) {

        return "Password must be at least 6 characters.";

    }


    if (
        lower.includes(
            "rate limit"
        )
    ) {

        return "Too many attempts. Please wait and try again.";

    }

    if (
        lower.includes(
            "invalid email format"
        ) ||
        lower.includes(
            "please enter a valid email address"
        )
    ) {

        return "Invalid email format. Please enter a valid email address.";

    }


    if (
        lower.includes(
            "temporary/disposable email addresses are not allowed"
        )
    ) {

        return "Temporary/disposable email addresses are not allowed.";

    }


    if (
        lower.includes(
            "invalid api key"
        )
    ) {

        return "Supabase API key is invalid. Check your Supabase configuration.";

    }


    return message ||
        "Something went wrong. Please try again.";

}


// ==========================================
// RESTORE SESSION
// ==========================================

async function restoreSession() {

    if (!supabaseClient) {
        return;
    }

    if (!connection.isOnline()) {
        connection.showOffline();
        return;
    }


    try {

        const {
            data,
            error
        } =
            await supabaseClient.auth.getSession();


        if (error) {

            if (connection.handleError(error)) {
                return;
            }

            console.error(error);

            return;

        }


        if (data.session) {

            window.location.href =
                "dashboard.html";

        }

    } catch (error) {

        if (connection.handleError(error)) {
            return;
        }

        console.error(
            "Session restore error:",
            error
        );

    }

}


// ==========================================
// START
// ==========================================

restoreSession();