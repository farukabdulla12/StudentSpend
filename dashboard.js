/* =========================================================
   StudentSpend — FINAL Dashboard Application
   Vanilla JS + Supabase Auth
   ========================================================= */


/* =========================================================
   1. SUPABASE
========================================================= */

const SUPABASE_URL =
  "https://nghhwccvhllhvaegolnf.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_os5MeJr2pe0n0FcDILjm7w_vdfE190O";

const connection =
  window.StudentSpendConnection;

const supabaseClient =
  window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
  );


/* =========================================================
   2. AUTHENTICATION
========================================================= */

async function getCachedSessionUser() {
  try {
    const { data, error } =
      await supabaseClient.auth.getSession();

    if (error) {
      if (!connection.handleError(error)) {
        console.error("Cached session lookup failed:", error);
      }
      return null;
    }

    return data.session?.user || null;
  } catch (error) {
    if (!connection.handleError(error)) {
      console.error("Cached session lookup failed:", error);
    }
    return null;
  }
}

async function checkAuthentication() {
  if (!connection.isOnline()) {
    connection.showOffline();
    return getCachedSessionUser();
  }

  try {
    const {
      data: { user },
      error
    } = await supabaseClient.auth.getUser();

    if (error && connection.handleError(error)) {
      return getCachedSessionUser();
    }

    if (error || !user) {
      window.location.href = "index.html";
      return null;
    }

    console.log("Authenticated:", user.email);

    return user;

  } catch (error) {
    if (connection.handleError(error)) {
      return getCachedSessionUser();
    }

    console.error("Authentication error:", error);
    window.location.href = "index.html";
    return null;
  }
}


/* =========================================================
   3. MAIN APPLICATION
========================================================= */

(function () {

  "use strict";


  /* =======================================================
     CONSTANTS
  ======================================================= */

  const DEFAULT_SETTINGS = {
    theme:
      window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light",

    budget: 10000,

    reminderEnabled: false,

    reminderTime: "20:00"
  };

  const DEFAULT_STUDENT_FEATURES = {
    studentMode: "",
    categoryBudgets: {},
    savingsGoals: [],
    paymentReminders: [],
    challenge: null
  };


  const EXPENSE_CATEGORIES = [
    { name: "Food", color: "#f97316" },
    { name: "Transport", color: "#3b82f6" },
    { name: "Education", color: "#8b5cf6" },
    { name: "Recharge", color: "#14b8a6" },
    { name: "Entertainment", color: "#ec4899" },
    { name: "Shopping", color: "#eab308" },
    { name: "Hostel", color: "#6366f1" },
    { name: "Health", color: "#ef4444" },
    { name: "Other", color: "#94a3b8" }
  ];


  const INCOME_CATEGORIES = [
    { name: "Money From Home", color: "#10b981" },
    { name: "Scholarship", color: "#06b6d4" },
    { name: "Part-time", color: "#8b5cf6" },
    { name: "Gift", color: "#f43f5e" },
    { name: "Other Income", color: "#64748b" }
  ];


  const ALL_CATEGORIES = [
    ...EXPENSE_CATEGORIES,
    ...INCOME_CATEGORIES
  ];


  const PAYMENT_METHODS = [
    "UPI",
    "Cash",
    "Card",
    "Bank Transfer",
    "Other"
  ];


  const STUDENT_TIPS = [
    "Track a purchase the moment you make it.",
    "Small recurring costs can add up quickly.",
    "Set your monthly budget before spending.",
    "Review your top spending category every week.",
    "Saving even 10% can build a strong habit.",
    "Track canteen and snack expenses regularly.",
    "Record shared expenses immediately."
  ];


  const MONTH_NAMES = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December"
  ];


  /* =======================================================
     STATE
  ======================================================= */

  const state = {

    user: null,

    transactions: [],

    transactionSubmitInFlight: false,

    profile: {
      name: "",
      firstName: "",
      middleName: "",
      lastName: "",
      age: "",
      phone: ""
    },

    settings: {
      ...DEFAULT_SETTINGS
    },

    studentFeatures: {
      ...DEFAULT_STUDENT_FEATURES
    },

    currentPage: "dashboard",

    viewMonth: startOfMonth(new Date()),

    editingId: null,

    confirmAction: null,

    reportPeriod: "monthly",

    trendHoverIndex: null,

    calendarMonth: startOfMonth(new Date()),

    calendarSelectedDate: todayISO()

  };

  /* =======================================================
     USER-SPECIFIC STORAGE
  ======================================================= */

  function getUserStoragePrefix() {

    if (!state.user || !state.user.id) {
      return "studentspend_guest";
    }

    return "studentspend_" + state.user.id;
  }

  function normalizeStudentFeatures(value) {
    const source =
      value && typeof value === "object" && !Array.isArray(value)
        ? value
        : {};

    const categoryBudgets = {};
    if (
      source.categoryBudgets &&
      typeof source.categoryBudgets === "object" &&
      !Array.isArray(source.categoryBudgets)
    ) {
      Object.entries(source.categoryBudgets).forEach(([category, amount]) => {
        const limit = Number(amount);
        if (category && Number.isFinite(limit) && limit > 0) {
          categoryBudgets[category] = Math.round(limit * 100) / 100;
        }
      });
    }

    const savingsGoals = Array.isArray(source.savingsGoals)
      ? source.savingsGoals
          .filter((goal) =>
            goal &&
            typeof goal.id === "string" &&
            typeof goal.name === "string" &&
            Number.isFinite(Number(goal.target)) &&
            Number(goal.target) > 0
          )
          .map((goal) => ({
            id: goal.id,
            name: goal.name.slice(0, 60),
            target: Math.round(Number(goal.target) * 100) / 100,
            saved: Number.isFinite(Number(goal.saved))
              ? Math.max(0, Math.round(Number(goal.saved) * 100) / 100)
              : 0,
            targetDate: String(goal.targetDate || ""),
            note: String(goal.note || "").slice(0, 140),
            createdAt: Number(goal.createdAt) || Date.now()
          }))
      : [];

    const paymentReminders = Array.isArray(source.paymentReminders)
      ? source.paymentReminders
          .filter((reminder) =>
            reminder &&
            typeof reminder.id === "string" &&
            typeof reminder.name === "string" &&
            Number.isFinite(Number(reminder.amount)) &&
            Number(reminder.amount) > 0
          )
          .map((reminder) => ({
            id: reminder.id,
            name: reminder.name.slice(0, 60),
            amount: Math.round(Number(reminder.amount) * 100) / 100,
            dueDate: String(reminder.dueDate || ""),
            category: String(reminder.category || "Other").slice(0, 60),
            recurring: reminder.recurring === true,
            recurrence: ["weekly", "monthly"].includes(reminder.recurrence)
              ? reminder.recurrence
              : "monthly",
            completed: reminder.completed === true
          }))
      : [];

    const challenge =
      source.challenge &&
      typeof source.challenge === "object" &&
      Number.isInteger(Number(source.challenge.duration)) &&
      Number(source.challenge.duration) >= 1 &&
      Number(source.challenge.duration) <= 365 &&
      typeof source.challenge.startDate === "string"
        ? {
            id: String(source.challenge.id || uid()),
            duration: Number(source.challenge.duration),
            startDate: source.challenge.startDate,
            status: ["active", "completed", "canceled"].includes(source.challenge.status)
              ? source.challenge.status
              : "active"
          }
        : null;

    return {
      ...DEFAULT_STUDENT_FEATURES,
      studentMode: ["hostel", "day-scholar"].includes(source.studentMode)
        ? source.studentMode
        : "",
      categoryBudgets,
      savingsGoals,
      paymentReminders,
      challenge
    };
  }


  const Store = {

    transactionsKey() {
      return getUserStoragePrefix() + "_transactions";
    },

    settingsKey() {
      return getUserStoragePrefix() + "_settings";
    },

    alertsKey() {
      return getUserStoragePrefix() + "_budget_alerts";
    },

    studentFeaturesKey() {
      return getUserStoragePrefix() + "_student_features";
    },

    studentFeaturesPendingKey() {
      return this.studentFeaturesKey() + "_pending_sync";
    },

    hasPendingStudentFeaturesSync() {
      try {
        return localStorage.getItem(this.studentFeaturesPendingKey()) === "true";
      } catch (error) {
        console.error("Student tools sync status load error:", error);
        return false;
      }
    },

    setPendingStudentFeaturesSync(isPending) {
      try {
        if (isPending) {
          localStorage.setItem(this.studentFeaturesPendingKey(), "true");
        } else {
          localStorage.removeItem(this.studentFeaturesPendingKey());
        }
      } catch (error) {
        console.error("Student tools sync status save error:", error);
      }
    },

    profileKey() {
      return getUserStoragePrefix() + "_profile";
    },


    loadTransactions() {

      try {

        const raw =
          localStorage.getItem(
            this.transactionsKey()
          );

        if (!raw) return [];

        const parsed = JSON.parse(raw);

        if (!Array.isArray(parsed)) {
          return [];
        }

        return parsed.map((item) => ({
          ...item,

          amount:
            Math.round(
              Number(item.amount || 0) * 100
            ) / 100,

          createdAt:
            item.createdAt || Date.now()
        }));

      } catch (error) {

        console.error(
          "Transaction loading error:",
          error
        );

        return [];
      }
    },


    saveTransactions(list) {

      try {

        localStorage.setItem(
          this.transactionsKey(),
          JSON.stringify(list)
        );

        // Fire-and-forget: attempt to sync local transactions to Supabase when online
        if (window.supabase && supabaseClient && connection.isOnline() && state.user && state.user.id) {
          // don't await - keep UI responsive
          (async () => {
            try {
              await upsertTransactionsToSupabase(list);
            } catch (err) {
              // Non-fatal - keep local copy as source of truth while offline
              console.warn("Supabase transaction sync failed:", err);
            }
          })();
        }

      } catch (error) {

        console.error(
          "Transaction save error:",
          error
        );

        showToast(
          "Could not save transactions.",
          "error"
        );
      }
    },



    loadSettings() {

      try {

        const raw =
          localStorage.getItem(
            this.settingsKey()
          );

        const parsed =
          raw ? JSON.parse(raw) : {};

        return {
          ...DEFAULT_SETTINGS,
          ...parsed
        };

      } catch (error) {

        console.error(
          "Settings loading error:",
          error
        );

        return {
          ...DEFAULT_SETTINGS
        };
      }
    },


    saveSettings(settings) {

      try {

        localStorage.setItem(
          this.settingsKey(),
          JSON.stringify(settings)
        );

      } catch (error) {

        console.error(
          "Settings save error:",
          error
        );
      }
    },

    loadStudentFeatures() {
      try {
        const raw = localStorage.getItem(this.studentFeaturesKey());
        const parsed = raw ? JSON.parse(raw) : {};
        return normalizeStudentFeatures(parsed);
      } catch (error) {
        console.error("Student tools loading error:", error);
        return { ...DEFAULT_STUDENT_FEATURES };
      }
    },

    saveStudentFeatures(features) {
      try {
        localStorage.setItem(
          this.studentFeaturesKey(),
          JSON.stringify(features)
        );
        return true;
      } catch (error) {
        console.error("Student tools save error:", error);
        showToast("Could not save student tools on this device.", "error");
        return false;
      }
    },


    loadAlerts() {

      try {

        const raw =
          localStorage.getItem(
            this.alertsKey()
          );

        const parsed =
          raw ? JSON.parse(raw) : {};

        return parsed &&
          typeof parsed === "object" &&
          !Array.isArray(parsed)
          ? parsed
          : {};

      } catch (error) {

        return {};
      }
    },


    saveAlerts(alerts) {

      try {

        localStorage.setItem(
          this.alertsKey(),
          JSON.stringify(alerts)
        );

      } catch (error) {

        console.error(error);
      }
    },


    loadProfile() {

      try {

        const raw =
          localStorage.getItem(
            this.profileKey()
          );

        if (!raw) {

          return {
            name: "",
            firstName: "",
            middleName: "",
            lastName: "",
            age: "",
            phone: ""
          };
        }

        const parsed =
          JSON.parse(raw);

        return {
          name: parsed.name || "",
          firstName: parsed.firstName || "",
          middleName: parsed.middleName || "",
          lastName: parsed.lastName || "",
          age: parsed.age || "",
          phone: parsed.phone || ""
        };

      } catch (error) {

        console.error(
          "Profile loading error:",
          error
        );

        return {
          name: "",
          firstName: "",
          middleName: "",
          lastName: "",
          age: "",
          phone: ""
        };
      }
    },


    saveProfile(profile) {

      try {

        localStorage.setItem(
          this.profileKey(),
          JSON.stringify(profile)
        );

        return true;

      } catch (error) {

        console.error(
          "Profile save error:",
          error
        );

        return false;
      }
    }

  };


  // ======================================================
  // Supabase transaction sync helpers
  // - keep localStorage as primary offline store
  // - attempt to upsert all local transactions when online
  // ======================================================

  async function upsertTransactionsToSupabase(list) {
    if (!supabaseClient || !connection.isOnline() || !state.user || !state.user.id) return;

    try {
      const rows = (list || []).map((tx) => ({
        id: tx.id,
        user_id: state.user.id,
        type: tx.type,
        amount: tx.amount,
        title: tx.title,
        category: tx.category,
        date: tx.date,
        payment_method: tx.paymentMethod || tx.payment_method || null,
        note: tx.note || null,
        created_at: tx.createdAt ? new Date(tx.createdAt).toISOString() : new Date().toISOString()
      }));

      if (rows.length === 0) return;

      const { data, error } = await supabaseClient
        .from('transactions')
        .upsert(rows, { onConflict: 'id' })
        .select();

      if (error) {
        if (!connection.handleError(error)) {
          console.warn('Supabase upsert error:', error);
        }
      }

      return data;

    } catch (error) {
      connection.handleError(error);
      throw error;
    }
  }

  async function fetchRemoteTransactions() {
    if (!supabaseClient || !connection.isOnline() || !state.user || !state.user.id) return [];

    try {
      const { data, error } = await supabaseClient
        .from('transactions')
        .select('*')
        .eq('user_id', state.user.id)
        .order('created_at', { ascending: true });

      if (error) {
        if (!connection.handleError(error)) {
          console.warn('Supabase fetch error:', error);
        }
        return [];
      }

      return data || [];
    } catch (error) {
      connection.handleError(error);
      return [];
    }
  }

  async function syncFromServer() {
    const remote = await fetchRemoteTransactions();

    if (!remote || !remote.length) return;

    const localById = new Map((state.transactions || []).map((t) => [t.id, t]));
    let changed = false;

    remote.forEach((r) => {
      const id = r.id;
      if (!localById.has(id)) {
        state.transactions.push({
          id: r.id,
          type: r.type,
          amount: Math.round(Number(r.amount || 0) * 100) / 100,
          title: r.title || '',
          category: r.category || 'Other',
          date: r.date ? String(r.date).slice(0, 10) : todayISO(),
          paymentMethod: r.payment_method || r.paymentMethod || 'UPI',
          note: r.note || '',
          createdAt: r.created_at ? Date.parse(r.created_at) : Date.now()
        });
        changed = true;
      }
    });

    if (changed) {
      Store.saveTransactions(state.transactions);
      renderCurrentPage();
    }
  }

  function upsertSingleTransaction(tx) {
    return upsertTransactionsToSupabase([tx]);
  }

  async function deleteTransactionFromSupabase(id) {
    if (!supabaseClient || !connection.isOnline() || !state.user || !state.user.id) return;

    try {
      const { error } = await supabaseClient
        .from('transactions')
        .delete()
        .eq('id', id)
        .eq('user_id', state.user.id);

      if (error && !connection.handleError(error)) {
        console.warn('Supabase delete error:', error);
      }
    } catch (err) {
      connection.handleError(err);
    }
  }

  async function syncStudentFeaturesToSupabase() {
    if (
      !supabaseClient ||
      !connection.isOnline() ||
      !state.user ||
      !state.user.id
    ) {
      return false;
    }

    const { error } = await supabaseClient
      .from("student_features")
      .upsert(
        {
          user_id: state.user.id,
          payload: state.studentFeatures,
          updated_at: new Date().toISOString()
        },
        { onConflict: "user_id" }
      );

    if (error) {
      if (!connection.handleError(error)) {
        throw error;
      }
      return false;
    }

    return true;
  }

  async function loadStudentFeatures() {
    state.studentFeatures =
      Store.loadStudentFeatures();

    if (!connection.isOnline() || !state.user?.id) {
      return;
    }

    let data;
    let error;
    try {
      const result = await supabaseClient
        .from("student_features")
        .select("payload")
        .eq("user_id", state.user.id)
        .maybeSingle();
      data = result.data;
      error = result.error;
    } catch (loadError) {
      if (!connection.handleError(loadError)) {
        console.warn("Student tools cloud load failed:", loadError);
        showToast(
          "Student tools could not be loaded from Supabase; using this device's saved data.",
          "warning"
        );
      }
      return;
    }

    if (error) {
      if (!connection.handleError(error)) {
        console.warn("Student tools cloud load failed:", error);
        showToast(
          "Student tools are available on this device. Apply the Student Tools Supabase migration to sync them across devices.",
          "warning"
        );
      }
      return;
    }

    if (data?.payload) {
      if (Store.hasPendingStudentFeaturesSync()) {
        await persistStudentFeatures(false);
        return;
      }
      state.studentFeatures =
        normalizeStudentFeatures(data.payload);
      Store.saveStudentFeatures(state.studentFeatures);
      return;
    }

    await persistStudentFeatures(false);
  }

  async function persistStudentFeatures(showSyncError = true) {
    if (!Store.saveStudentFeatures(state.studentFeatures)) {
      return false;
    }

    if (!connection.isOnline()) {
      Store.setPendingStudentFeaturesSync(true);
      return true;
    }

    try {
      const synced = await syncStudentFeaturesToSupabase();
      Store.setPendingStudentFeaturesSync(!synced);
      return synced;
    } catch (error) {
      Store.setPendingStudentFeaturesSync(true);
      console.warn("Student tools cloud save failed:", error);
      if (showSyncError) {
        showToast(
          "Saved on this device, but cloud sync failed. Check your Supabase Student Tools migration and connection.",
          "warning"
        );
      }
      return false;
    }
  }


  /* =======================================================
     UTILITIES
  ======================================================= */

  function uid() {

    return (
      "tx_" +
      Date.now().toString(36) +
      "_" +
      Math.random()
        .toString(36)
        .slice(2, 9)
    );
  }


  function escapeHtml(value) {

    const div =
      document.createElement("div");

    div.textContent =
      String(value ?? "");

    return div.innerHTML;
  }


  function formatCurrency(amount) {

    const number =
      Math.round(
        (Number(amount) || 0) * 100
      ) / 100;

    return (
      "₹" +
      number.toLocaleString(
        "en-IN",
        {
          maximumFractionDigits:
            number % 1 === 0 ? 0 : 2
        }
      )
    );
  }


  function startOfMonth(date) {

    return new Date(
      date.getFullYear(),
      date.getMonth(),
      1
    );
  }


  function monthKey(date) {

    return (
      date.getFullYear() +
      "-" +
      String(date.getMonth() + 1)
        .padStart(2, "0")
    );
  }


  function txMonthKey(tx) {

    return tx &&
      typeof tx.date === "string" &&
      tx.date.length >= 7
      ? tx.date.slice(0, 7)
      : "";
  }


  function todayISO() {

    const d = new Date();

    return (
      d.getFullYear() +
      "-" +
      String(d.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(d.getDate()).padStart(2, "0")
    );
  }


  function toISODate(date) {

    return (
      date.getFullYear() +
      "-" +
      String(date.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(date.getDate()).padStart(2, "0")
    );
  }


  function formatMonthLabel(date) {

    return (
      MONTH_NAMES[date.getMonth()] +
      " " +
      date.getFullYear()
    );
  }


  function formatDateDisplay(dateString) {

    if (!dateString) return "";

    const parts =
      dateString.split("-");

    if (parts.length === 3) {

      const date =
        new Date(
          Number(parts[0]),
          Number(parts[1]) - 1,
          Number(parts[2])
        );

      return date.toLocaleDateString(
        "en-IN",
        {
          day: "numeric",
          month: "short",
          year: "numeric"
        }
      );
    }

    return dateString;
  }


  function clamp(number, min, max) {

    return Math.max(
      min,
      Math.min(max, number)
    );
  }


  function isReducedMotion() {

    return (
      window.matchMedia &&
      window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches
    );
  }


  function cssVar(name) {

    return getComputedStyle(
      document.documentElement
    )
      .getPropertyValue(name)
      .trim();
  }


  function initials(name) {

    if (!name) return "?";

    return String(name)
      .trim()
      .charAt(0)
      .toUpperCase();
  }


  function categoryMeta(name) {

    return (
      ALL_CATEGORIES.find(
        (category) =>
          category.name.toLowerCase() ===
          String(name || "").toLowerCase()
      ) || {
        name: name || "Other",
        color: "#94a3b8"
      }
    );
  }


  function animateValue(
    element,
    endValue,
    formatter = (n) => String(Math.round(n))
  ) {

    if (!element) return;

    if (isReducedMotion()) {

      element.textContent =
        formatter(endValue);

      element.dataset.rawValue =
        String(endValue);

      return;
    }

    const startValue =
      Number(element.dataset.rawValue || 0);

    const start =
      performance.now();

    const duration = 450;

    function frame(now) {

      const progress =
        clamp(
          (now - start) / duration,
          0,
          1
        );

      const eased =
        1 - Math.pow(1 - progress, 3);

      const value =
        startValue +
        (endValue - startValue) *
        eased;

      element.textContent =
        formatter(value);

      if (progress < 1) {

        requestAnimationFrame(frame);

      } else {

        element.textContent =
          formatter(endValue);

        element.dataset.rawValue =
          String(endValue);
      }
    }

    requestAnimationFrame(frame);
  }


  /* =======================================================
     PROFILE
  ======================================================= */

  function getProfileNameParts() {

    const firstName =
      typeof state.profile.firstName === "string"
        ? state.profile.firstName.trim()
        : "";
    const middleName =
      typeof state.profile.middleName === "string"
        ? state.profile.middleName.trim()
        : "";
    const lastName =
      typeof state.profile.lastName === "string"
        ? state.profile.lastName.trim()
        : "";

    if (firstName || middleName || lastName) {
      return { firstName, middleName, lastName };
    }

    const legacyParts =
      typeof state.profile.name === "string"
        ? state.profile.name.trim().split(/\s+/).filter(Boolean)
        : [];

    if (legacyParts.length >= 3) {
      return {
        firstName: legacyParts[0],
        middleName: legacyParts.slice(1, -1).join(" "),
        lastName: legacyParts[legacyParts.length - 1]
      };
    }

    return {
      firstName: legacyParts[0] || "",
      middleName: "",
      lastName: legacyParts[1] || ""
    };
  }


  function getProfileFullName() {

    const { firstName, middleName, lastName } =
      getProfileNameParts();

    return [firstName, middleName, lastName]
      .filter(Boolean)
      .join(" ") || state.profile.name || "";
  }


  async function loadCurrentProfile() {

    try {

      let user = state.user;

      if (!user) {
        if (connection.isOnline()) {
          window.location.href = "index.html";
        }
        return false;
      }

      state.user = user;

      state.profile =
        Store.loadProfile();

      /*
        If local profile is empty but Supabase
        already contains user metadata, use it.
      */

      if (!state.profile.name) {

        state.profile.name =
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          "";
      }

      if (!state.profile.firstName) {
        state.profile.firstName =
          user.user_metadata?.first_name || "";
      }

      if (!state.profile.middleName) {
        state.profile.middleName =
          user.user_metadata?.middle_name || "";
      }

      if (!state.profile.lastName) {
        state.profile.lastName =
          user.user_metadata?.last_name || "";
      }

      if (!state.profile.age) {

        state.profile.age =
          user.user_metadata?.age ||
          "";
      }

      if (!state.profile.phone) {

        state.profile.phone =
          user.user_metadata?.phone ||
          "";
      }

      if (connection.isOnline()) {
        let profileRecord = null;
        let profileLoadError = null;

        try {
          const result =
            await supabaseClient
              .from("profiles")
              .select("id, name, age, phone")
              .eq("id", user.id)
              .maybeSingle();

          profileRecord = result.data;
          profileLoadError = result.error;
        } catch (error) {
          if (!connection.handleError(error)) {
            throw error;
          }
        }

        if (profileLoadError) {
          if (!connection.handleError(profileLoadError)) {
            console.error("Supabase profile load failed:", profileLoadError);
            showToast(
              `Could not load your profile from Supabase: ${profileLoadError.message}`,
              "error"
            );
          }
        } else if (profileRecord && profileRecord.id !== user.id) {
          console.error("Supabase returned a profile for a different user.");
          showToast(
            "Could not load your profile because the returned user did not match your account.",
            "error"
          );
        } else if (profileRecord) {
          state.profile = {
            ...state.profile,
            name: profileRecord.name || "",
            firstName: "",
            middleName: "",
            lastName: "",
            age: profileRecord.age == null ? "" : String(profileRecord.age),
            phone: profileRecord.phone || ""
          };
        }
      }

      const profileNameParts =
        getProfileNameParts();


      const email =
        user.email || "";


      const firstNameInput =
        document.getElementById(
          "profileFirstName"
        );

      const middleNameInput =
        document.getElementById(
          "profileMiddleName"
        );

      const lastNameInput =
        document.getElementById(
          "profileLastName"
        );

      const ageInput =
        document.getElementById(
          "profileAge"
        );

      const phoneInput =
        document.getElementById(
          "profilePhone"
        );

      const emailInput =
        document.getElementById(
          "profileEmail"
        );

      const displayName =
        document.getElementById(
          "profileDisplayName"
        );

      const displayEmail =
        document.getElementById(
          "profileDisplayEmail"
        );


      if (firstNameInput) firstNameInput.value = profileNameParts.firstName;
      if (middleNameInput) middleNameInput.value = profileNameParts.middleName;
      if (lastNameInput) lastNameInput.value = profileNameParts.lastName;


      if (ageInput) {

        ageInput.value =
          state.profile.age;
      }

      if (phoneInput) {

        phoneInput.value =
          indianMobileInputValue(state.profile.phone);
      }


      if (emailInput) {

        emailInput.value =
          email;
      }


      if (displayName) {

        displayName.textContent =
          getProfileFullName() ||
          "Student";
      }


      if (displayEmail) {

        displayEmail.textContent =
          email;
      }


      return true;

    } catch (error) {

      if (connection.handleError(error)) {
        return Boolean(state.user);
      }

      console.error(
        "Profile initialization error:",
        error
      );

      return false;
    }
  }


  function isProfileComplete() {

    const { firstName, lastName } =
      getProfileNameParts();
    const age =
      Number(state.profile.age);

    return (
      firstName.length > 0 &&
      lastName.length > 0 &&
      Number.isInteger(age) &&
      age >= 13 &&
      age <= 100 &&
      normalizeIndianMobileNumber(state.profile.phone) !== null
    );
  }


  function showProfileCompletionPopup() {

    if (isProfileComplete()) return;

    const overlay =
      document.getElementById(
        "profileCompletionPopup"
      );

    if (!overlay) return;

    overlay.hidden = false;
    overlay.setAttribute("aria-hidden", "false");
  }


  function closeProfileCompletionPopup() {

    const overlay =
      document.getElementById(
        "profileCompletionPopup"
      );

    if (!overlay) return;

    overlay.hidden = true;
    overlay.setAttribute("aria-hidden", "true");
  }

  function requireCompleteProfileForTransaction() {

    if (isProfileComplete()) {
      return true;
    }

    showProfileCompletionPopup();
    showToast(
      "Complete your profile before adding a transaction.",
      "warning"
    );

    return false;
  }


  async function saveProfile(event) {

    event.preventDefault();

    const saveButton = document.getElementById("saveProfileBtn");

    if (saveButton && saveButton.dataset.loading === "true") {
      return;
    }

    if (!connection.isOnline()) {
      connection.showOffline();
      return;
    }


    if (!state.user) {

      showToast(
        "User session not found.",
        "error"
      );

      return;
    }


    const firstNameInput =
      document.getElementById(
        "profileFirstName"
      );

    const middleNameInput =
      document.getElementById(
        "profileMiddleName"
      );

    const lastNameInput =
      document.getElementById(
        "profileLastName"
      );

    const ageInput =
      document.getElementById(
        "profileAge"
      );

    const phoneInput =
      document.getElementById(
        "profilePhone"
      );


    const firstName =
      firstNameInput?.value.trim() || "";
    const middleName =
      middleNameInput?.value.trim() || "";
    const lastName =
      lastNameInput?.value.trim() || "";
    const name =
      [firstName, middleName, lastName]
        .filter(Boolean)
        .join(" ");

    const age =
      ageInput?.value.trim() || "";

    const phone =
      normalizeIndianMobileNumber(
        phoneInput?.value || ""
      );


    if (!firstName || !lastName) {

      showToast(
        "Please enter your first and last name.",
        "error"
      );

      if (!firstName) {
        firstNameInput?.focus();
      } else {
        lastNameInput?.focus();
      }

      return;
    }


    if (age) {

      const ageNumber =
        Number(age);

      if (
        !Number.isInteger(ageNumber) ||
        ageNumber < 13 ||
        ageNumber > 100
      ) {

        showToast(
          "Please enter a valid age between 13 and 100.",
          "error"
        );

        ageInput?.focus();

        return;
      }
    } else {

      showToast(
        "Please enter your age to complete your profile.",
        "error"
      );

      ageInput?.focus();

      return;
    }

    if (phone === null) {

      showToast(
        "Enter your 10-digit Indian mobile number starting with 6–9.",
        "error"
      );

      phoneInput?.focus();

      return;
    }


    const updatedProfile = {

      name,

      firstName,

      middleName,
      lastName,
      age,
      phone
    };
    const studentMode =
      document.getElementById("profileStudentMode")?.value || "";

    if (saveButton) {
      saveButton.dataset.loading = "true";
      saveButton.disabled = true;
      saveButton.textContent = "Saving profile...";
    }

    try {
      const {
        data: { user },
        error: userError
      } = await supabaseClient.auth.getUser();

      if (userError) {
        throw userError;
      }
      if (!user) {
        throw new Error("User session not found.");
      }

      if (!connection.isOnline()) {
        connection.showOffline();
        return;
      }

      state.user = user;

      const profileData = {
        id: user.id,
        name,
        age: Number(age),
        phone,
        updated_at: new Date().toISOString()
      };

      const { data: savedProfile, error } =
        await supabaseClient
          .from("profiles")
          .upsert(profileData, { onConflict: "id" })
          .select("id, name, age, phone")
          .single();

      if (error) {
        throw error;
      }

      if (!savedProfile || savedProfile.id !== user.id) {
        throw new Error("Supabase did not return the saved profile for this user.");
      }

      state.profile = {
        ...updatedProfile,
        name: savedProfile.name || "",
        firstName,
        middleName,
        lastName,
        age: savedProfile.age == null ? "" : String(savedProfile.age),
        phone: savedProfile.phone || ""
      };

      document.getElementById("profileAge").value =
        state.profile.age;
      document.getElementById("profilePhone").value =
        indianMobileInputValue(state.profile.phone);

      Store.saveProfile(state.profile);
      state.studentFeatures.studentMode = studentMode;
      const studentModeInput =
        document.getElementById("studentMode");
      if (studentModeInput) {
        studentModeInput.value = studentMode;
      }
      await persistStudentFeatures();
    } catch (error) {
      if (connection.handleError(error)) {
        return;
      }

      console.error("Supabase profile save failed:", error);
      showToast(
        `Could not save your profile to Supabase: ${error.message || "Please check your connection and database policies."}`,
        "error"
      );
      return;
    } finally {
      if (saveButton) {
        saveButton.dataset.loading = "false";
        saveButton.disabled = false;
        saveButton.textContent = "Save Profile";
      }
    }


    const displayName =
      document.getElementById(
        "profileDisplayName"
      );


    if (displayName) {

      displayName.textContent =
        getProfileFullName();
    }


    if (isProfileComplete()) {
      closeProfileCompletionPopup();
    }


    showToast(
      "Profile updated successfully!",
      "success"
    );
  }

  function normalizeIndianMobileNumber(value) {

    const input = value.trim();

    if (!input) return null;

    const match =
      input.match(/^(?:\+91[\s-]?)?([6-9]\d{9})$/);

    return match ? `+91${match[1]}` : null;
  }


  function indianMobileInputValue(value) {

    const match =
      String(value || "").trim().match(/^(?:\+91[\s-]?)?([6-9]\d{9})$/);

    return match ? match[1] : "";
  }


  async function logoutUser() {

    openConfirm(
      "Are you sure you want to log out?",
      async function () {

        if (!connection.isOnline()) {
          connection.showOffline();
          closeConfirm();
          return;
        }

        if (!supabaseClient) {
          closeConfirm();
          window.location.replace("index.html");
          return;
        }

        try {
          const { error } = await supabaseClient.auth.signOut();

          if (error) {
            throw error;
          }

          closeConfirm();

          try {
            sessionStorage.clear();
          } catch (error) {
            console.warn("Could not clear session storage:", error);
          }

          localStorage.removeItem("studentspend_guest_transactions");
          localStorage.removeItem("studentspend_guest_settings");
          localStorage.removeItem("studentspend_guest_profile");

          window.location.replace("index.html");
        } catch (error) {
          if (connection.handleError(error)) {
            return;
          }

          console.error("Logout error:", error);
          closeConfirm();
          showToast("Logout failed. Please try again.", "error");
        }
      },
      {
        confirmText: "Log out",
        cancelText: "Cancel"
      }
    );
  }


  function renderProfilePage() {

    if (!state.user) return;


    const firstNameInput =
      document.getElementById(
        "profileFirstName"
      );

    const middleNameInput =
      document.getElementById(
        "profileMiddleName"
      );

    const lastNameInput =
      document.getElementById(
        "profileLastName"
      );

    const ageInput =
      document.getElementById(
        "profileAge"
      );

    const phoneInput =
      document.getElementById(
        "profilePhone"
      );

    const emailInput =
      document.getElementById(
        "profileEmail"
      );

    const displayName =
      document.getElementById(
        "profileDisplayName"
      );

    const displayEmail =
      document.getElementById(
        "profileDisplayEmail"
      );


    const nameParts = getProfileNameParts();
    if (firstNameInput) firstNameInput.value = nameParts.firstName;
    if (middleNameInput) middleNameInput.value = nameParts.middleName;
    if (lastNameInput) lastNameInput.value = nameParts.lastName;


    if (ageInput) {

      ageInput.value =
        state.profile.age || "";
    }

    if (phoneInput) {

      phoneInput.value =
        indianMobileInputValue(state.profile.phone);
    }

    const studentModeInput =
      document.getElementById("profileStudentMode");
    if (studentModeInput) {
      studentModeInput.value =
        state.studentFeatures.studentMode;
    }


    if (emailInput) {

      emailInput.value =
        state.user.email || "";
    }


    if (displayName) {

      displayName.textContent =
        getProfileFullName() ||
        "Student";
    }


    if (displayEmail) {

      displayEmail.textContent =
        state.user.email || "";
    }


    renderReminderSettings();
  }
  /* =======================================================
   DAILY REMINDER
======================================================= */

  let reminderTimer = null;


  /*
    Returns today's local date.
    Example: 2026-09-28
  */
  function reminderTodayKey() {

    const date = new Date();

    return (
      date.getFullYear() +
      "-" +
      String(date.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(date.getDate()).padStart(2, "0")
    );
  }


  /*
    Key used to remember which day
    the reminder popup was already shown.
  */
  function reminderShownKey() {

    if (!state.user?.id) {
      return "studentspend_reminder_shown_guest";
    }

    return (
      "studentspend_" +
      state.user.id +
      "_reminder_shown"
    );
  }


  /*
    Check whether today's timed reminder
    has already been displayed.
  */
  function hasShownReminderToday() {

    try {

      return (
        localStorage.getItem(
          reminderShownKey()
        ) === reminderTodayKey()
      );

    } catch (error) {

      return false;
    }
  }


  /*
    Mark today's timed reminder as shown.
  */
  function markReminderShownToday() {

    try {

      localStorage.setItem(
        reminderShownKey(),
        reminderTodayKey()
      );

    } catch (error) {

      console.warn(
        "Could not save reminder state:",
        error
      );
    }
  }


  /*
    Display reminder popup.
  */
  function showDailyReminderPopup(reason = "daily") {

    const overlay =
      document.getElementById(
        "dailyReminderPopup"
      );

    const message =
      document.getElementById(
        "dailyReminderPopupMessage"
      );

    if (!overlay) return;


    if (message) {

      if (reason === "login") {

        message.textContent =
          "Welcome back! Don't forget to record today's income and expenses in StudentSpend.";

      } else {

        message.textContent =
          "It's time to record today's income and expenses. Keeping your StudentSpend records updated helps you track your money better.";
      }
    }


    overlay.hidden = false;

    overlay.setAttribute(
      "aria-hidden",
      "false"
    );
  }


  /*
    Close reminder popup.
  */
  function closeDailyReminderPopup() {

    const overlay =
      document.getElementById(
        "dailyReminderPopup"
      );

    if (!overlay) return;


    overlay.hidden = true;

    overlay.setAttribute(
      "aria-hidden",
      "true"
    );
  }


  /*
    Render reminder controls inside Profile.
  */
  function renderReminderSettings() {

    const enabled =
      document.getElementById(
        "dailyReminderEnabled"
      );

    const time =
      document.getElementById(
        "dailyReminderTime"
      );

    const status =
      document.getElementById(
        "reminderStatusText"
      );


    if (enabled) {

      enabled.checked =
        Boolean(
          state.settings.reminderEnabled
        );
    }


    if (time) {

      time.value =
        state.settings.reminderTime ||
        "20:00";
    }


    if (status) {

      if (
        state.settings.reminderEnabled
      ) {

        const selectedTime =
          state.settings.reminderTime ||
          "20:00";

        status.textContent =
          `Reminder is ON. You will be reminded every day at ${formatReminderTime(selectedTime)}.`;

      } else {

        status.textContent =
          "Reminder is currently disabled.";
      }
    }
  }


  /*
    Convert 20:00 → 8:00 PM
  */
  function formatReminderTime(timeValue) {

    if (!timeValue) {
      return "8:00 PM";
    }


    const parts =
      timeValue.split(":");


    if (parts.length < 2) {
      return timeValue;
    }


    let hours =
      Number(parts[0]);

    const minutes =
      parts[1];


    if (!Number.isFinite(hours)) {
      return timeValue;
    }


    const suffix =
      hours >= 12
        ? "PM"
        : "AM";


    hours =
      hours % 12 || 12;


    return (
      `${hours}:${minutes} ${suffix}`
    );
  }


  /*
    Save reminder settings.
  */
  function saveReminderSettings() {

    const enabledInput =
      document.getElementById(
        "dailyReminderEnabled"
      );

    const timeInput =
      document.getElementById(
        "dailyReminderTime"
      );

    const status =
      document.getElementById(
        "reminderSaveStatus"
      );


    if (!enabledInput || !timeInput) {
      return;
    }


    const enabled =
      enabledInput.checked;


    const time =
      timeInput.value;


    if (enabled && !time) {

      showToast(
        "Please select a reminder time.",
        "error"
      );

      timeInput.focus();

      return;
    }


    state.settings.reminderEnabled =
      enabled;


    state.settings.reminderTime =
      time || "20:00";


    Store.saveSettings(
      state.settings
    );


    renderReminderSettings();


    if (status) {

      status.textContent =
        "Reminder saved ✓";

      setTimeout(
        () => {

          if (status) {
            status.textContent = "";
          }

        },
        3000
      );
    }


    showToast(
      enabled
        ? `Daily reminder set for ${formatReminderTime(state.settings.reminderTime)}.`
        : "Daily reminder disabled.",
      "success"
    );


    startReminderChecker();
  }


  /*
    Check current time every 30 seconds.
  */
  function checkDailyReminder() {

    if (!state.user) return;


    if (
      !state.settings.reminderEnabled
    ) {

      return;
    }


    const reminderTime =
      state.settings.reminderTime;


    if (!reminderTime) return;


    const now =
      new Date();


    const currentHours =
      String(
        now.getHours()
      ).padStart(2, "0");


    const currentMinutes =
      String(
        now.getMinutes()
      ).padStart(2, "0");


    const currentTime =
      `${currentHours}:${currentMinutes}`;


    /*
      Only show once per day.
    */
    if (
      currentTime === reminderTime &&
      !hasShownReminderToday()
    ) {

      markReminderShownToday();

      showDailyReminderPopup(
        "daily"
      );
    }
  }


  /*
    Start / restart reminder timer.
  */
  function startReminderChecker() {

    if (reminderTimer) {

      clearInterval(
        reminderTimer
      );

      reminderTimer = null;
    }


    if (
      !state.settings.reminderEnabled
    ) {

      return;
    }


    /*
      Check immediately.
    */
    checkDailyReminder();


    /*
      Then check every 30 seconds.
    */
    reminderTimer =
      setInterval(
        checkDailyReminder,
        30000
      );
  }


  /*
    Show one welcome reminder after login/dashboard load.
  */
  function showLoginReminderOnce() {

    if (
      !state.user ||
      !isProfileComplete() ||
      !state.settings.reminderEnabled
    ) {

      return;
    }


    const sessionKey =
      "studentspend_login_reminder_" +
      state.user.id;


    try {

      if (
        sessionStorage.getItem(
          sessionKey
        ) === "shown"
      ) {

        return;
      }


      sessionStorage.setItem(
        sessionKey,
        "shown"
      );


      /*
        Small delay so the dashboard
        finishes loading first.
      */
      setTimeout(
        () => {

          showDailyReminderPopup(
            "login"
          );

        },
        700
      );

    } catch (error) {

      setTimeout(
        () =>
          showDailyReminderPopup(
            "login"
          ),
        700
      );
    }
  }




  /* =======================================================
     TOAST
  ======================================================= */

  function showToast(
    message,
    kind = "info"
  ) {

    const stack =
      document.getElementById(
        "toastStack"
      );

    if (!stack) return;


    const toast =
      document.createElement("div");

    toast.className =
      `toast toast-${kind}`;

    toast.setAttribute(
      "role",
      "status"
    );


    const messageSpan =
      document.createElement("span");

    messageSpan.textContent =
      message;


    toast.appendChild(
      messageSpan
    );


    const progress =
      document.createElement("div");

    progress.className =
      "toast-progress";

    progress.style.animationDuration =
      "3200ms";


    toast.appendChild(
      progress
    );


    stack.appendChild(
      toast
    );


    setTimeout(() => {

      toast.style.opacity =
        "0";

      toast.style.transform =
        "translateX(36px)";

      toast.style.transition =
        "opacity .25s ease, transform .25s ease";


      setTimeout(
        () => toast.remove(),
        260
      );

    }, 3200);
  }


  /* =======================================================
     CONFIRM DIALOG
  ======================================================= */

  function openConfirm(
    message,
    onConfirm,
    options = {}
  ) {

    const messageEl =
      document.getElementById(
        "confirmMessage"
      );

    const overlay =
      document.getElementById(
        "confirmOverlay"
      );

    const confirmBtn =
      document.getElementById(
        "confirmOk"
      );

    const cancelBtn =
      document.getElementById(
        "confirmCancel"
      );

    if (messageEl) {
      messageEl.textContent = message;
    }

    if (confirmBtn) {
      confirmBtn.textContent = options.confirmText || "Confirm";
    }

    if (cancelBtn) {
      cancelBtn.textContent = options.cancelText || "Cancel";
    }

    state.confirmAction =
      onConfirm;


    if (overlay) {

      overlay.classList.add(
        "is-open"
      );

      overlay.setAttribute(
        "aria-hidden",
        "false"
      );
    }
  }


  function closeConfirm() {

    const overlay =
      document.getElementById(
        "confirmOverlay"
      );


    if (overlay) {

      overlay.classList.remove(
        "is-open"
      );

      overlay.setAttribute(
        "aria-hidden",
        "true"
      );
    }

    const confirmBtn = document.getElementById("confirmOk");
    if (confirmBtn) {
      confirmBtn.textContent = "Confirm";
    }

    state.confirmAction =
      null;
  }


  /* =======================================================
     TRANSACTION HELPERS
  ======================================================= */

  function txForMonth(date) {

    const key =
      monthKey(date);

    return state.transactions.filter(
      (transaction) =>
        txMonthKey(transaction) === key
    );
  }


  function sumByType(
    list,
    type
  ) {

    return list
      .filter(
        (transaction) =>
          transaction.type === type
      )
      .reduce(
        (sum, transaction) =>
          sum +
          Number(
            transaction.amount || 0
          ),
        0
      );
  }


  function categoryTotals(
    list,
    type
  ) {

    const totals = {};


    list
      .filter(
        (transaction) =>
          transaction.type === type
      )
      .forEach(
        (transaction) => {

          const category =
            transaction.category ||
            "Other";


          totals[category] =
            (totals[category] || 0) +
            Number(
              transaction.amount || 0
            );
        }
      );


    return totals;
  }


  function updateNavBadge() {

    const badge =
      document.getElementById(
        "navTxBadge"
      );


    if (badge) {

      badge.textContent =
        String(
          state.transactions.length
        );
    }
  }


  /* =======================================================
     NAVIGATION
  ======================================================= */

  const PAGE_META = {

    dashboard: {
      title: "Dashboard",
      desc:
        "Your financial health at a glance"
    },

    transactions: {
      title: "Transactions",
      desc:
        "Search, filter, edit, and organize every expense"
    },

    reports: {
      title: "Reports & Analytics",
      desc:
        "Category breakdowns and monthly spending trends"
    },

    budget: {
      title: "Budget",
      desc: "Monthly and category limits, usage, and spending alerts"
    },

    savings: {
      title: "Savings Goals",
      desc: "Track your goals, contributions, and progress"
    },

    calendar: {
      title: "Expense Calendar",
      desc: "Explore daily expenses from your transaction history"
    },

    challenges: {
      title: "No-Spend Challenges",
      desc: "Set a personal spending challenge and track progress"
    },

    payments: {
      title: "Payment Reminders",
      desc: "Organize upcoming, due, overdue, and completed payments"
    },

    settings: {
      title: "Settings & Backups",
      desc:
        "Preferences, monthly budget target, and data exports"
    },

    about: {
      title: "About StudentSpend",
      desc:
        "A simpler way to understand and manage your money"
    },

    profile: {
      title: "My Profile",
      desc:
        "Manage your name, age, email, and profile picture"
    }
  };


  function switchPage(page) {

    if (!PAGE_META[page]) return;


    state.currentPage =
      page;


    document
      .querySelectorAll(".page")
      .forEach(
        (element) =>
          element.classList.remove(
            "is-active"
          )
      );


    const activePage =
      document.getElementById(
        "page-" + page
      );


    if (activePage) {

      activePage.classList.add(
        "is-active"
      );
    }


    document
      .querySelectorAll(".nav-item")
      .forEach(
        (element) => {

          element.classList.toggle(
            "is-active",
            element.dataset.page === page
          );
        }
      );


    const title =
      document.getElementById(
        "pageTitle"
      );

    const desc =
      document.getElementById(
        "pageDesc"
      );


    if (title) {

      title.textContent =
        PAGE_META[page].title;
    }


    if (desc) {

      desc.textContent =
        PAGE_META[page].desc;
    }


    closeSidebarMobile();

    renderCurrentPage();


    window.scrollTo({
      top: 0,
      behavior:
        isReducedMotion()
          ? "auto"
          : "smooth"
    });
  }


  function closeSidebarMobile() {

    document
      .getElementById("sidebar")
      ?.classList.remove(
        "is-open"
      );

    document
      .getElementById("sidebarOverlay")
      ?.classList.remove(
        "is-open"
      );
  }


  function renderCurrentPage() {

    updateNavBadge();


    if (
      state.currentPage ===
      "dashboard"
    ) {

      renderDashboard();

    } else if (
      state.currentPage ===
      "transactions"
    ) {

      renderHomeMoney();
      renderTransactionsPage();

    } else if (
      state.currentPage ===
      "reports"
    ) {

      renderReportsPage();

    } else if (
      state.currentPage ===
      "budget"
    ) {

      renderBudgetPage();

    } else if (
      state.currentPage ===
      "savings"
    ) {

      renderSavingsGoals();

    } else if (
      state.currentPage ===
      "calendar"
    ) {

      renderExpenseCalendar();

    } else if (
      state.currentPage ===
      "challenges"
    ) {

      renderNoSpendChallenge();

    } else if (
      state.currentPage ===
      "payments"
    ) {

      renderPaymentReminders();

    } else if (
      state.currentPage ===
      "settings"
    ) {

      renderSettingsPage();

    } else if (
      state.currentPage ===
      "profile"
    ) {

      renderProfilePage();
    }
  }


  /* =======================================================
     DASHBOARD
  ======================================================= */

  function renderDashboard() {

    const greeting =
      document.getElementById("dashboardGreeting");
    if (greeting) {
      greeting.textContent =
        getProfileFullName()
          ? `Welcome back, ${getProfileFullName()}`
          : "Welcome back";
    }

    const monthLabel =
      document.getElementById(
        "monthLabel"
      );


    if (monthLabel) {

      monthLabel.textContent =
        formatMonthLabel(
          state.viewMonth
        );
    }


    const list =
      txForMonth(
        state.viewMonth
      );


    const income =
      sumByType(
        list,
        "income"
      );


    const expense =
      sumByType(
        list,
        "expense"
      );


    const netBalance =
      income - expense;

    const balance =
      Math.max(
        0,
        netBalance
      );


    animateValue(
      document.getElementById(
        "statBalance"
      ),
      balance,
      formatCurrency
    );


    const balanceSub =
      document.getElementById(
        "statBalanceSub"
      );


    if (balanceSub) {

      balanceSub.textContent =
        netBalance < 0
          ? "Expenses exceed income this month"
          : "Net balance for this month";
    }


    animateValue(
      document.getElementById(
        "statIncome"
      ),
      income,
      formatCurrency
    );


    animateValue(
      document.getElementById(
        "statExpense"
      ),
      expense,
      formatCurrency
    );


    animateValue(
      document.getElementById(
        "statCount"
      ),
      list.length
    );


    const countSub =
      document.getElementById(
        "statCountSub"
      );


    if (countSub) {

      countSub.textContent =
        list.length === 1
          ? "1 transaction this month"
          : `${list.length} transactions this month`;
    }

    renderDailySpendingLimit();
    renderDashboardHomeMoney();
    renderDashboardFeatureSummaries();

    renderBudgetPanel(
      expense
    );

    renderTrendChart();

    renderDonutChart();

    renderInsights(
      list,
      income,
      expense
    );

    renderRecentList();
  }

  function renderDailySpendingLimit() {
    const today = new Date();
    const plan = calculateDailySpendingPlan(state.transactions, today);

    const values = {
      dailyLimitAmount: plan.dailyLimit,
      dailyLimitBalance: plan.balance,
      dailyLimitDays: plan.remainingDays,
      dailyLimitSpent: plan.spentToday,
      dailyLimitLeft: plan.leftToday
    };

    Object.entries(values).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element) {
        element.textContent =
          id === "dailyLimitDays"
            ? String(value)
            : formatCurrency(value);
      }
    });
    const leftElement =
      document.getElementById("dailyLimitLeft");
    if (leftElement) {
      leftElement.textContent =
        `${formatCurrency(plan.leftToday)} left today`;
    }
    const metaElement =
      document.getElementById("dailyLimitMeta");
    if (metaElement) {
      metaElement.textContent =
        `${formatCurrency(plan.balance)} remaining balance · ${plan.remainingDays} days · ${formatCurrency(plan.spentToday)} spent today`;
    }
  }

  function calculateDailySpendingPlan(transactions, today) {
    const monthKeyToday = monthKey(today);
    const monthTransactions = transactions.filter((transaction) =>
      txMonthKey(transaction) === monthKeyToday);
    const income = sumByType(monthTransactions, "income");
    const expense = sumByType(monthTransactions, "expense");
    const balance = Math.max(0, income - expense);
    const remainingDays =
      new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate() -
      today.getDate() + 1;
    const dailyLimit = remainingDays > 0 ? balance / remainingDays : 0;
    const todayKey = toISODate(today);
    const spentToday = transactions
      .filter((transaction) =>
        transaction.type === "expense" && transaction.date === todayKey)
      .reduce((sum, transaction) =>
        sum + Number(transaction.amount || 0), 0);

    return {
      balance,
      remainingDays,
      dailyLimit,
      spentToday,
      leftToday: Math.max(0, dailyLimit - spentToday)
    };
  }

  function moneyFromHomeTransactions(list) {
    return list.filter((transaction) =>
      transaction.type === "income" &&
      transaction.category === "Money From Home"
    );
  }

  function renderDashboardHomeMoney() {
    const homeIncome =
      moneyFromHomeTransactions(state.transactions);
    const total =
      homeIncome.reduce((sum, transaction) =>
        sum + Number(transaction.amount || 0), 0);
    const latest =
      [...homeIncome].sort((a, b) =>
        b.date.localeCompare(a.date) ||
        Number(b.createdAt || 0) - Number(a.createdAt || 0)
      )[0];
    const totalElement =
      document.getElementById("dashboardHomeMoneyTotal");
    const latestElement =
      document.getElementById("dashboardHomeMoneyLatest");

    if (totalElement) {
      totalElement.textContent = formatCurrency(total);
    }
    if (latestElement) {
      latestElement.textContent = latest
        ? `Latest: ${formatCurrency(latest.amount)} on ${formatDateDisplay(latest.date)}`
        : "No money from home recorded yet.";
    }
  }

  function renderDashboardFeatureSummaries() {
    const messages =
      getSmartBudgetMessages().slice(0, 2);
    const alertList =
      document.getElementById("dashboardSmartAlerts");
    if (alertList) {
      alertList.innerHTML = messages.map((message) => `
        <li class="smart-alert smart-alert-${message.type}">
          <span aria-hidden="true">${message.type === "danger" ? "!" : message.type === "warning" ? "⚠" : "✓"}</span>
          ${escapeHtml(message.text)}
        </li>
      `).join("");
    }

    const goals = state.studentFeatures.savingsGoals;
    const savingsSummary =
      document.getElementById("dashboardSavingsSummary");
    const savingsProgress =
      document.getElementById("dashboardSavingsProgress");
    if (savingsSummary) {
      savingsSummary.textContent = goals.length
        ? `${goals.length} goal${goals.length === 1 ? "" : "s"} · ${formatCurrency(goals.reduce((sum, goal) => sum + goal.saved, 0))} saved`
        : "No savings goals yet.";
    }
    if (savingsProgress) {
      const nextGoal = goals.find((goal) => goal.saved < goal.target);
      savingsProgress.innerHTML = nextGoal
        ? `<div class="goal-progress-label"><span>${escapeHtml(nextGoal.name)}</span><span>${Math.round(Math.min(100, nextGoal.saved / nextGoal.target * 100))}%</span></div><div class="goal-progress-track"><span style="width:${Math.min(100, nextGoal.saved / nextGoal.target * 100)}%"></span></div>`
        : "";
    }

    const upcoming =
      state.studentFeatures.paymentReminders
        .filter((reminder) =>
          !reminder.completed &&
          reminder.dueDate >= todayISO()
        )
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
    const paymentSummary =
      document.getElementById("dashboardPaymentSummary");
    if (paymentSummary) {
      paymentSummary.textContent = upcoming
        ? `${upcoming.name} · ${formatCurrency(upcoming.amount)} · ${formatDateDisplay(upcoming.dueDate)}`
        : "No upcoming payments.";
    }

    const challenge = state.studentFeatures.challenge;
    const challengeSummary =
      document.getElementById("dashboardChallengeSummary");
    const challengeProgress =
      document.getElementById("dashboardChallengeProgress");
    if (challengeSummary) {
      if (challenge?.status === "active") {
        const elapsed = Math.max(
          0,
          Math.floor(
            (new Date(`${todayISO()}T12:00:00`) -
              new Date(`${challenge.startDate}T12:00:00`)) /
              86400000
          ) + 1
        );
        const completed = Math.min(challenge.duration, elapsed);
        challengeSummary.textContent =
          `${completed} of ${challenge.duration} days completed`;
        if (challengeProgress) {
          challengeProgress.style.width =
            `${Math.min(100, completed / challenge.duration * 100)}%`;
        }
      } else {
        challengeSummary.textContent =
          challenge?.status === "completed"
            ? "Challenge completed!"
            : "No active challenge.";
        if (challengeProgress) {
          challengeProgress.style.width =
            challenge?.status === "completed" ? "100%" : "0%";
        }
      }
    }
  }

  function renderBudgetPanel(
    expense
  ) {

    const budget =
      Number(
        state.settings.budget
      ) || 0;


    const percent =
      budget > 0
        ? (expense / budget) * 100
        : 0;


    const remaining =
      budget - expense;


    animateValue(
      document.getElementById(
        "budgetSpent"
      ),
      expense,
      formatCurrency
    );


    animateValue(
      document.getElementById(
        "budgetTotal"
      ),
      budget,
      formatCurrency
    );


    const percentEl =
      document.getElementById(
        "budgetPercent"
      );

    const budgetUsage =
      document.getElementById(
        "budgetUsage"
      );

    const warningIcon =
      document.getElementById(
        "budgetWarningIcon"
      );

    const budgetPanel =
      document.querySelector(
        ".panel-budget"
      );


    const remainingEl =
      document.getElementById(
        "budgetRemaining"
      );


    if (percentEl) {

      percentEl.textContent =
        Math.round(percent) +
        "% used";
    }

    if (warningIcon) {

      warningIcon.hidden =
        percent < 80;

      warningIcon.classList.toggle(
        "is-danger",
        percent >= 100
      );

      warningIcon.title =
        percent >= 100
          ? "You have reached or exceeded your monthly budget."
          : "You have used at least 80% of your monthly budget.";
    }

    if (budgetPanel) {

      budgetPanel.classList.toggle(
        "has-budget-warning",
        percent >= 80 && percent < 100
      );

      budgetPanel.classList.toggle(
        "has-budget-danger",
        percent >= 100
      );
    }

    if (budgetUsage) {

      budgetUsage.classList.toggle(
        "is-budget-warning",
        percent >= 80 && percent < 100
      );

      budgetUsage.classList.toggle(
        "is-budget-danger",
        percent >= 100
      );
    }


    if (remainingEl) {

      remainingEl.textContent =
        remaining < 0
          ? `${formatCurrency(
            Math.abs(remaining)
          )} over budget`
          : `${formatCurrency(
            remaining
          )} remaining`;

      remainingEl.classList.toggle(
        "is-budget-danger",
        percent >= 100
      );
    }


    const fill =
      document.getElementById(
        "budgetProgress"
      );


    if (fill) {

      fill.classList.remove(
        "is-warning",
        "is-danger"
      );

      fill.style.width =
        clamp(
          percent,
          0,
          100
        ) + "%";


      if (percent >= 100) {

        fill.classList.add(
          "is-danger"
        );

      } else if (percent >= 80) {

        fill.classList.add(
          "is-warning"
        );
      }
    }
  }

  const CATEGORY_BUDGET_NAMES = [
    "Food",
    "Transport",
    "Education",
    "Entertainment",
    "Recharge",
    "Other"
  ];

  function renderStudentTools() {
    renderStudentMode();
    renderHomeMoney(moneyFromHomeTransactions(state.transactions));
    renderCategoryBudgets();
    renderSmartBudgetAlerts();
    renderSavingsGoals();
    renderExpenseCalendar();
    renderNoSpendChallenge();
    renderPaymentReminders();
  }

  function renderBudgetPage() {
    const input = document.getElementById("budgetInput");
    if (input) {
      input.value = String(state.settings.budget);
    }
    renderCategoryBudgets();
    renderSmartBudgetAlerts();
    renderCategoryBudgetProgress();

    const expenses = sumByType(txForMonth(new Date()), "expense");
    const budget = Number(state.settings.budget) || 0;
    const percent = budget > 0 ? expenses / budget * 100 : 0;
    const spentElement =
      document.getElementById("categoryBudgetMonthlySpent");
    const limitElement =
      document.getElementById("categoryBudgetMonthlyLimit");
    const progressElement =
      document.getElementById("categoryBudgetProgress");
    const summaryElement =
      document.getElementById("categoryBudgetMonthlySummary");
    if (spentElement) spentElement.textContent = formatCurrency(expenses);
    if (limitElement) limitElement.textContent = formatCurrency(budget);
    if (progressElement) {
      progressElement.style.width = `${Math.min(100, percent)}%`;
      progressElement.classList.toggle("is-warning", percent >= 80 && percent < 100);
      progressElement.classList.toggle("is-danger", percent >= 100);
    }
    if (summaryElement) {
      summaryElement.textContent = budget > 0
        ? `${Math.round(percent)}% used · ${formatCurrency(Math.max(0, budget - expenses))} remaining`
        : "Set a monthly target to track your total spending.";
    }
  }

  function renderCategoryBudgetProgress() {
    const container =
      document.getElementById("categoryBudgetProgressList");
    if (!container) return;
    const totals =
      categoryTotals(txForMonth(new Date()), "expense");
    const budgets =
      state.studentFeatures.categoryBudgets;
    container.innerHTML = Object.entries(budgets).length
      ? Object.entries(budgets).map(([category, limit]) => {
          const spent = totals[category] || 0;
          const percent = limit > 0 ? spent / limit * 100 : 0;
          return `
            <div class="category-budget-progress">
              <div class="category-budget-progress-heading">
                <strong>${escapeHtml(category)}</strong>
                <span>${formatCurrency(spent)} / ${formatCurrency(limit)} · ${Math.round(percent)}%</span>
              </div>
              <div class="goal-progress-track"><span class="${percent >= 100 ? "is-danger" : percent >= 80 ? "is-warning" : ""}" style="width:${Math.min(100, percent)}%"></span></div>
            </div>
          `;
        }).join("")
      : '<p class="feature-empty">No category budgets set yet.</p>';
  }

  function renderStudentMode() {
    const select = document.getElementById("studentMode");
    const recommendations =
      document.getElementById("studentModeRecommendations");
    if (select) {
      select.value = state.studentFeatures.studentMode;
    }
    const profileSelect =
      document.getElementById("profileStudentMode");
    if (profileSelect) {
      profileSelect.value = state.studentFeatures.studentMode;
    }
    if (!recommendations) return;

    const categories =
      state.studentFeatures.studentMode === "hostel"
        ? ["Mess/Food", "Snacks", "Hostel", "Transport", "Recharge", "College", "Entertainment", "Money From Home"]
        : state.studentFeatures.studentMode === "day-scholar"
          ? ["Bus/Fuel", "Food", "College", "Recharge", "Entertainment", "Study Materials", "Other"]
          : [];
    recommendations.textContent = categories.length
      ? `Recommended categories: ${categories.join(" · ")}. All existing categories remain available when recording transactions.`
      : "Choose Hostel Student or Day Scholar to see category recommendations.";
  }

  function renderHomeMoney(transactions = moneyFromHomeTransactions(state.transactions)) {
    const latest = [...transactions].sort((a, b) =>
      b.date.localeCompare(a.date) ||
      Number(b.createdAt || 0) - Number(a.createdAt || 0)
    )[0];
    const total = transactions.reduce((sum, transaction) =>
      sum + Number(transaction.amount || 0), 0);
    const totalElement = document.getElementById("homeMoneyTotal");
    const latestElement = document.getElementById("homeMoneyLatest");
    const history = document.getElementById("homeMoneyHistory");
    const dateInput = document.getElementById("homeMoneyDate");
    if (totalElement) {
      totalElement.textContent = formatCurrency(total);
    }
    if (latestElement) {
      latestElement.textContent = latest
        ? `${formatCurrency(latest.amount)} · ${formatDateDisplay(latest.date)}`
        : "No money received yet";
    }
    if (dateInput && !dateInput.value) {
      dateInput.value = todayISO();
    }
    if (!history) return;

    history.innerHTML = transactions.length
      ? [...transactions]
          .sort((a, b) => b.date.localeCompare(a.date))
          .map((transaction) => `
            <li class="feature-list-row">
              <div>
                <strong>${formatCurrency(transaction.amount)}</strong>
                <span>${escapeHtml(formatDateDisplay(transaction.date))} · ${escapeHtml(transaction.note || transaction.title)}</span>
              </div>
              <div class="feature-row-actions">
                <button class="link-btn-subtle" type="button" data-feature-action="edit-home" data-id="${escapeHtml(transaction.id)}">Edit</button>
                <button class="link-btn-subtle feature-delete" type="button" data-feature-action="delete-home" data-id="${escapeHtml(transaction.id)}">Delete</button>
              </div>
            </li>
          `).join("")
      : '<li class="feature-empty">No money from home recorded yet.</li>';
  }

  function renderCategoryBudgets() {
    const container = document.getElementById("categoryBudgetInputs");
    if (!container) return;
    container.innerHTML = CATEGORY_BUDGET_NAMES.map((category) => `
      <label>${escapeHtml(category)} (₹/month)
        <input type="number" min="0" step="0.01" inputmode="decimal" data-category-budget="${escapeHtml(category)}" value="${state.studentFeatures.categoryBudgets[category] || ""}" placeholder="No limit">
      </label>
    `).join("");
  }

  function getSmartBudgetMessages() {
    const messages = [];
    const monthTransactions = txForMonth(new Date());
    const monthExpense = sumByType(monthTransactions, "expense");
    const monthlyBudget = Number(state.settings.budget) || 0;
    if (monthlyBudget > 0) {
      const used = monthExpense / monthlyBudget;
      if (used >= 1) {
        messages.push({ type: "danger", text: `You have used ${Math.round(used * 100)}% of your monthly budget.` });
      } else if (used >= 0.8) {
        messages.push({ type: "warning", text: `You have used ${Math.round(used * 100)}% of your monthly budget.` });
      }
    }

    const categoryTotals = {};
    monthTransactions
      .filter((transaction) => transaction.type === "expense")
      .forEach((transaction) => {
        const category = transaction.category || "Other";
        categoryTotals[category] =
          (categoryTotals[category] || 0) + Number(transaction.amount || 0);
      });
    Object.entries(state.studentFeatures.categoryBudgets).forEach(([category, limit]) => {
      const spent = categoryTotals[category] || 0;
      if (limit > 0 && spent / limit >= 0.8) {
        messages.push({
          type: spent >= limit ? "danger" : "warning",
          text: `You are close to your ${category} budget (${Math.round(spent / limit * 100)}% used).`
        });
      }
    });

    const today = todayISO();
    const todaySpent = state.transactions
      .filter((transaction) => transaction.type === "expense" && transaction.date === today)
      .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
    const priorSevenDays = [];
    for (let offset = 1; offset <= 7; offset += 1) {
      const date = new Date();
      date.setDate(date.getDate() - offset);
      priorSevenDays.push(toISODate(date));
    }
    const sevenDayAverage = priorSevenDays.reduce((sum, date) =>
      sum + state.transactions
        .filter((transaction) => transaction.type === "expense" && transaction.date === date)
        .reduce((daySum, transaction) =>
          daySum + Number(transaction.amount || 0), 0), 0) / 7;
    if (todaySpent > 0 && sevenDayAverage > 0 && todaySpent > sevenDayAverage * 1.25) {
      messages.push({
        type: "warning",
        text: `Today's spending is higher than your recent daily average (${formatCurrency(sevenDayAverage)}).`
      });
    }
    if (messages.length === 0) {
      const hasConfiguredBudget =
        monthlyBudget > 0 ||
        Object.keys(state.studentFeatures.categoryBudgets).length > 0;
      messages.push({
        type: "good",
        text: hasConfiguredBudget
          ? "You are within your budget."
          : "Set a monthly or category budget to receive spending alerts."
      });
    }
    return messages;
  }

  function renderSmartBudgetAlerts() {
    const list = document.getElementById("smartBudgetAlerts");
    if (!list) return;
    list.innerHTML = getSmartBudgetMessages()
      .map((message) => `
        <li class="smart-alert smart-alert-${message.type}">
          <span aria-hidden="true">${message.type === "danger" ? "!" : message.type === "warning" ? "⚠" : "✓"}</span>
          ${escapeHtml(message.text)}
        </li>
      `).join("");
  }

  function renderSavingsGoals() {
    const list = document.getElementById("savingsGoalsList");
    if (!list) return;
    const goals = state.studentFeatures.savingsGoals;
    list.innerHTML = goals.length
      ? goals.map((goal) => {
          const percent = Math.min(100, goal.saved / goal.target * 100);
          const remaining = Math.max(0, goal.target - goal.saved);
          const nowDay = Math.floor(Date.now() / 86400000);
          const createdDay = Math.floor(goal.createdAt / 86400000);
          const endDay = goal.targetDate
            ? Math.floor(new Date(`${goal.targetDate}T12:00:00`).getTime() / 86400000)
            : 0;
          const expected = endDay > createdDay
            ? Math.min(100, Math.max(0, (nowDay - createdDay) / (endDay - createdDay) * 100))
            : 100;
          const status = goal.saved >= goal.target
            ? "Goal reached"
            : Date.now() > new Date(`${goal.targetDate}T23:59:59`).getTime()
              ? "Target date passed"
              : percent >= expected
                ? "On track"
                : "Needs attention";
          return `
            <article class="goal-card">
              <div class="feature-list-row">
                <div>
                  <h3>${escapeHtml(goal.name)}</h3>
                  <span>${escapeHtml(status)} · Target ${escapeHtml(formatDateDisplay(goal.targetDate))}</span>
                </div>
                <div class="feature-row-actions">
                  <button class="link-btn-subtle" type="button" data-feature-action="edit-goal" data-id="${escapeHtml(goal.id)}">Edit</button>
                  <button class="link-btn-subtle feature-delete" type="button" data-feature-action="delete-goal" data-id="${escapeHtml(goal.id)}">Delete</button>
                </div>
              </div>
              <div class="goal-progress-label"><span>${formatCurrency(goal.saved)} saved</span><span>${Math.round(percent)}%</span></div>
              <div class="goal-progress-track"><span style="width:${percent}%"></span></div>
              <p>${formatCurrency(remaining)} remaining${goal.note ? ` · ${escapeHtml(goal.note)}` : ""}</p>
              <form class="goal-contribution-form" data-goal-contribute="${escapeHtml(goal.id)}">
                <label>Add savings (₹)<input type="number" min="0.01" step="0.01" required></label>
                <button class="btn btn-secondary btn-sm" type="submit">Add to goal</button>
              </form>
            </article>
          `;
        }).join("")
      : '<div class="feature-empty">No savings goals yet.</div>';
  }

  function renderExpenseCalendar() {
    const grid = document.getElementById("expenseCalendar");
    if (!grid) return;
    const monthLabel = document.getElementById("expenseCalendarMonth");
    if (monthLabel) {
      monthLabel.textContent = formatMonthLabel(state.calendarMonth);
    }
    const year = state.calendarMonth.getFullYear();
    const month = state.calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const dayCount = new Date(year, month + 1, 0).getDate();
    const monthTotalElement =
      document.getElementById("expenseCalendarMonthTotal");
    if (monthTotalElement) {
      const monthExpense = sumByType(txForMonth(state.calendarMonth), "expense");
      monthTotalElement.textContent =
        `${formatCurrency(monthExpense)} total expenses this month · Daily totals from your transactions.`;
    }
    const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    let cells = weekdays.map((day) =>
      `<span class="calendar-weekday">${day}</span>`).join("");
    for (let blank = 0; blank < firstDay; blank += 1) {
      cells += '<span class="calendar-day calendar-day-empty" aria-hidden="true"></span>';
    }
    for (let day = 1; day <= dayCount; day += 1) {
      const date = toISODate(new Date(year, month, day));
      const amount = state.transactions
        .filter((transaction) =>
          transaction.type === "expense" && transaction.date === date)
        .reduce((sum, transaction) =>
          sum + Number(transaction.amount || 0), 0);
      cells += `
        <button type="button" class="calendar-day${amount > 0 ? " has-spending" : ""}${date === state.calendarSelectedDate ? " is-selected" : ""}" data-calendar-date="${date}" aria-label="${escapeHtml(formatDateDisplay(date))}, ${formatCurrency(amount)} spent">
          <span>${day}</span><small>${amount > 0 ? escapeHtml(formatCurrency(amount)) : "—"}</small>
        </button>
      `;
    }
    grid.innerHTML = cells;

    const selected = state.calendarSelectedDate;
    const selectedDate = document.getElementById("calendarSelectedDate");
    const total = document.getElementById("calendarDayTotal");
    const transactionsList = document.getElementById("calendarDayTransactions");
    const dayTransactions = state.transactions.filter((transaction) =>
      transaction.date === selected);
    const dayExpenses = dayTransactions.filter((transaction) =>
      transaction.type === "expense");
    const dayTotal = dayExpenses.reduce((sum, transaction) =>
      sum + Number(transaction.amount || 0), 0);
    if (selectedDate) {
      selectedDate.textContent = selected ? formatDateDisplay(selected) : "Select a date";
    }
    if (total) {
      total.textContent = dayExpenses.length
        ? `${formatCurrency(dayTotal)} spent`
        : "No expenses recorded for this day.";
    }
    if (transactionsList) {
      transactionsList.innerHTML = dayTransactions.length
        ? dayTransactions.map((transaction) => `
            <li class="feature-list-row">
              <div><strong>${transaction.type === "income" ? "+" : "−"}${formatCurrency(transaction.amount)} · ${escapeHtml(transaction.title)}</strong><span>${escapeHtml(transaction.category)} · ${escapeHtml(formatDateDisplay(transaction.date))}</span></div>
              <button class="link-btn-subtle" type="button" data-feature-action="edit-calendar-transaction" data-id="${escapeHtml(transaction.id)}">Edit</button>
            </li>
          `).join("")
        : "";
    }
  }

  function renderNoSpendChallenge() {
    const status = document.getElementById("challengeStatus");
    const form = document.getElementById("challengeForm");
    if (!status || !form) return;
    const challenge = state.studentFeatures.challenge;
    const startButton = document.getElementById("challengeStartButton");
    const cancelButton = document.getElementById("challengeCancelButton");
    const completeButton = document.getElementById("challengeCompleteButton");
    const restartButton = document.getElementById("challengeRestartButton");
    const duration = document.getElementById("challengeDuration");
    const customWrap = document.getElementById("challengeCustomWrap");
    const active = challenge?.status === "active";
    if (startButton) startButton.hidden = Boolean(active);
    if (cancelButton) cancelButton.hidden = !active;
    if (completeButton) completeButton.hidden = !active;
    if (restartButton) restartButton.hidden = !challenge || active;
    if (duration) duration.disabled = Boolean(active);
    if (customWrap && duration) customWrap.hidden = duration.value !== "custom";
    if (!challenge) {
      status.innerHTML = '<p class="feature-empty">No active challenge.</p>';
      return;
    }

    const start = new Date(`${challenge.startDate}T12:00:00`);
    const end = new Date(start);
    end.setDate(end.getDate() + challenge.duration - 1);
    const today = new Date(`${todayISO()}T12:00:00`);
    const elapsed = Math.max(0, Math.floor((today - start) / 86400000) + 1);
    const completed = Math.min(challenge.duration, elapsed);
    const remaining = Math.max(0, challenge.duration - completed);
    if (active && today > end) {
      challenge.status = "completed";
      persistStudentFeatures();
    }
    const progress = challenge.status === "completed"
      ? 100
      : Math.min(100, completed / challenge.duration * 100);
    const statusText = challenge.status === "active"
      ? `${completed} days completed · ${remaining} days remaining`
      : challenge.status === "completed"
        ? "Challenge completed!"
        : "Challenge canceled.";
    status.innerHTML = `
      <p><strong>${escapeHtml(statusText)}</strong></p>
      <p>Started ${escapeHtml(formatDateDisplay(challenge.startDate))} · Ends ${escapeHtml(formatDateDisplay(toISODate(end)))}</p>
      <div class="goal-progress-track"><span style="width:${progress}%"></span></div>
      <small>${Math.round(progress)}% complete. Avoided spending is not estimated because no reliable baseline is available.</small>
    `;
  }

  function paymentReminderStatus(reminder) {
    if (reminder.completed) return "completed";
    const today = todayISO();
    if (reminder.dueDate < today) return "overdue";
    if (reminder.dueDate === today) return "due";
    return "upcoming";
  }

  function renderPaymentReminders() {
    const container = document.getElementById("paymentRemindersList");
    if (!container) return;
    const groups = [
      ["due", "Due today"],
      ["overdue", "Overdue"],
      ["upcoming", "Upcoming"],
      ["completed", "Completed"]
    ];
    container.innerHTML = groups.map(([status, title]) => {
      const reminders = state.studentFeatures.paymentReminders
        .filter((reminder) => paymentReminderStatus(reminder) === status)
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
      return `
        <section class="reminder-group">
          <h3>${title}</h3>
          ${reminders.length
            ? reminders.map((reminder) => `
                <div class="feature-list-row payment-reminder-row">
                  <div>
                    <strong>${escapeHtml(reminder.name)} <span class="reminder-status status-${status}">${status === "due" ? "Due today" : status}</span></strong>
                    <span>${escapeHtml(reminder.category)} · ${formatCurrency(reminder.amount)} · ${escapeHtml(formatDateDisplay(reminder.dueDate))}${reminder.recurring ? ` · Repeats ${escapeHtml(reminder.recurrence)}` : ""}</span>
                  </div>
                  <div class="feature-row-actions">
                    ${!reminder.completed ? `<button class="link-btn-subtle" type="button" data-feature-action="complete-reminder" data-id="${escapeHtml(reminder.id)}">Complete</button>` : ""}
                    <button class="link-btn-subtle" type="button" data-feature-action="edit-reminder" data-id="${escapeHtml(reminder.id)}">Edit</button>
                    <button class="link-btn-subtle feature-delete" type="button" data-feature-action="delete-reminder" data-id="${escapeHtml(reminder.id)}">Delete</button>
                  </div>
                </div>
              `).join("")
            : '<p class="feature-empty">No payments in this group.</p>'}
        </section>
      `;
    }).join("");
  }


  /* =======================================================
     TREND CHART
  ======================================================= */

  function last6Months() {

    const result = [];


    for (
      let i = 5;
      i >= 0;
      i--
    ) {

      const date =
        new Date(
          state.viewMonth.getFullYear(),
          state.viewMonth.getMonth() - i,
          1
        );


      const list =
        txForMonth(date);


      result.push({

        label:
          MONTH_NAMES[
            date.getMonth()
          ].slice(0, 3),

        income:
          sumByType(
            list,
            "income"
          ),

        expense:
          sumByType(
            list,
            "expense"
          )
      });
    }


    return result;
  }


  function renderTrendChart() {

    const canvas =
      document.getElementById(
        "trendChart"
      );


    if (!canvas) return;


    const rect =
      canvas.parentElement
        ?.getBoundingClientRect();


    const width =
      Math.max(
        320,
        rect?.width || 600
      );


    const height = 230;

    const dpr =
      window.devicePixelRatio || 1;


    canvas.width =
      width * dpr;

    canvas.height =
      height * dpr;

    canvas.style.width =
      width + "px";

    canvas.style.height =
      height + "px";


    const ctx =
      canvas.getContext("2d");


    ctx.setTransform(
      dpr,
      0,
      0,
      dpr,
      0,
      0
    );


    ctx.clearRect(
      0,
      0,
      width,
      height
    );


    const months =
      last6Months();


    const padding = {
      top: 20,
      right: 20,
      bottom: 35,
      left: 55
    };


    const chartWidth =
      width -
      padding.left -
      padding.right;


    const chartHeight =
      height -
      padding.top -
      padding.bottom;


    const maxValue =
      Math.max(
        100,
        ...months.map(
          (m) =>
            Math.max(
              m.income,
              m.expense
            )
        )
      ) * 1.15;


    const textColor =
      cssVar("--text-faint") ||
      "#9290af";


    const borderColor =
      cssVar("--border") ||
      "#e5e7eb";


    const incomeColor =
      cssVar("--income") ||
      "#10b981";


    const expenseColor =
      cssVar("--expense") ||
      "#f43f5e";


    ctx.font =
      '11px "Segoe UI", sans-serif';


    ctx.fillStyle =
      textColor;


    ctx.strokeStyle =
      borderColor;


    for (
      let i = 0;
      i <= 4;
      i++
    ) {

      const y =
        padding.top +
        (chartHeight / 4) *
        i;


      ctx.beginPath();

      ctx.moveTo(
        padding.left,
        y
      );

      ctx.lineTo(
        width - padding.right,
        y
      );

      ctx.stroke();


      const value =
        maxValue -
        (maxValue / 4) *
        i;


      ctx.textAlign =
        "right";

      ctx.textBaseline =
        "middle";


      ctx.fillText(
        compactNumber(value),
        padding.left - 8,
        y
      );
    }


    const step =
      chartWidth /
      (months.length - 1);


    months.forEach(
      (month, index) => {

        const x =
          padding.left +
          step * index;


        ctx.textAlign =
          "center";

        ctx.textBaseline =
          "top";


        ctx.fillStyle =
          textColor;


        ctx.fillText(
          month.label,
          x,
          height - 25
        );
      }
    );


    function drawLine(
      key,
      color
    ) {

      ctx.beginPath();


      months.forEach(
        (month, index) => {

          const x =
            padding.left +
            step * index;


          const y =
            padding.top +
            chartHeight -
            (
              month[key] /
              maxValue
            ) *
            chartHeight;


          if (index === 0) {

            ctx.moveTo(
              x,
              y
            );

          } else {

            ctx.lineTo(
              x,
              y
            );
          }
        }
      );


      ctx.strokeStyle =
        color;

      ctx.lineWidth = 3;

      ctx.lineJoin =
        "round";

      ctx.lineCap =
        "round";

      ctx.stroke();


      months.forEach(
        (month, index) => {

          const x =
            padding.left +
            step * index;


          const y =
            padding.top +
            chartHeight -
            (
              month[key] /
              maxValue
            ) *
            chartHeight;


          ctx.beginPath();

          ctx.arc(
            x,
            y,
            4,
            0,
            Math.PI * 2
          );

          ctx.fillStyle =
            color;

          ctx.fill();
        }
      );
    }


    drawLine(
      "expense",
      expenseColor
    );

    drawLine(
      "income",
      incomeColor
    );
  }


  function compactNumber(number) {

    if (number >= 100000) {

      return (
        "₹" +
        (
          number / 100000
        ).toFixed(1) +
        "L"
      );
    }


    if (number >= 1000) {

      return (
        "₹" +
        (
          number / 1000
        ).toFixed(1) +
        "k"
      );
    }


    return (
      "₹" +
      Math.round(number)
    );
  }


  /* =======================================================
     DONUT CHART
  ======================================================= */

  const donutAnimationFrames = new WeakMap();

  function renderDonutChart() {

    drawDonut(
      "donutChart",
      "donutLegend",
      "donutTooltip",
      categoryTotals(
        txForMonth(
          state.viewMonth
        ),
        "expense"
      )
    );
  }


  function drawDonut(
    canvasId,
    legendId,
    tooltipId,
    totals,
    animate = false
  ) {

    const canvas =
      document.getElementById(
        canvasId
      );

    const legend =
      document.getElementById(
        legendId
      );


    if (!canvas || !legend) {
      return;
    }

    const previousFrame =
      donutAnimationFrames.get(canvas);

    if (previousFrame !== undefined) {
      cancelAnimationFrame(previousFrame);
      donutAnimationFrames.delete(canvas);
    }

    legend.classList.toggle(
      "is-animated",
      animate && !isReducedMotion()
    );


    const entries =
      Object.entries(
        totals
      ).sort(
        (a, b) =>
          b[1] - a[1]
      );


    const total =
      entries.reduce(
        (sum, item) =>
          sum + item[1],
        0
      );


    if (total <= 0) {

      legend.innerHTML =
        `<li class="donut-empty">
          No expenses logged for this month.
        </li>`;

    } else {

      legend.innerHTML =
        entries
          .map(
            ([category, amount], index) => {

              const meta =
                categoryMeta(
                  category
                );


              const percent =
                Math.round(
                  (amount / total) *
                  100
                );


              return `
                <li style="--legend-index:${index}">
                  <span class="cat-name">
                    <span
                      class="legend-swatch"
                      style="background:${meta.color}"
                    ></span>
                    ${escapeHtml(category)}
                  </span>

                  <strong>
                    ${percent}%
                    <span
                      style="
                        font-weight:normal;
                        font-size:.75rem;
                        color:var(--text-faint)
                      "
                    >
                      (${formatCurrency(amount)})
                    </span>
                  </strong>
                </li>
              `;
            }
          )
          .join("");
    }


    const size = 180;

    const dpr =
      window.devicePixelRatio || 1;


    canvas.width =
      size * dpr;

    canvas.height =
      size * dpr;

    canvas.style.width =
      size + "px";

    canvas.style.height =
      size + "px";


    const ctx =
      canvas.getContext("2d");


    ctx.setTransform(
      dpr,
      0,
      0,
      dpr,
      0,
      0
    );


    ctx.clearRect(
      0,
      0,
      size,
      size
    );


    const center =
      size / 2;


    const outerRadius =
      78;


    const innerRadius =
      50;


    if (total <= 0) {

      ctx.beginPath();

      ctx.arc(
        center,
        center,
        outerRadius,
        0,
        Math.PI * 2
      );

      ctx.fillStyle =
        cssVar(
          "--border-subtle"
        ) || "#e5e7eb";

      ctx.fill();


      ctx.beginPath();

      ctx.arc(
        center,
        center,
        innerRadius,
        0,
        Math.PI * 2
      );

      ctx.fillStyle =
        cssVar("--surface") ||
        "#fff";

      ctx.fill();


      ctx.fillStyle =
        cssVar("--text-faint") ||
        "#999";


      ctx.font =
        "600 12px sans-serif";


      ctx.textAlign =
        "center";

      ctx.textBaseline =
        "middle";


      ctx.fillText(
        "₹0 Spent",
        center,
        center
      );


      return;
    }


    function drawChart(progress) {

      ctx.clearRect(
        0,
        0,
        size,
        size
      );

      let startAngle = -Math.PI / 2;
      let sweptAngle = 0;
      const visibleSweep = Math.PI * 2 * progress;

      entries.forEach(([category, amount]) => {

        const angle = (amount / total) * Math.PI * 2;
        const visibleAngle =
          Math.min(angle, Math.max(0, visibleSweep - sweptAngle));

        if (visibleAngle > 0) {
          ctx.beginPath();
          ctx.moveTo(center, center);
          ctx.arc(
            center,
            center,
            outerRadius,
            startAngle,
            startAngle + visibleAngle
          );
          ctx.closePath();
          ctx.fillStyle = categoryMeta(category).color;
          ctx.fill();
        }

        startAngle += angle;
        sweptAngle += angle;
      });

      ctx.beginPath();
      ctx.arc(center, center, innerRadius, 0, Math.PI * 2);
      ctx.fillStyle = cssVar("--surface") || "#fff";
      ctx.fill();

      ctx.fillStyle = cssVar("--text") || "#19182d";
      ctx.font = "700 15px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(compactNumber(total), center, center - 6);

      ctx.font = "500 10px sans-serif";
      ctx.fillStyle = cssVar("--text-faint") || "#9290af";
      ctx.fillText("Total Spent", center, center + 12);
    }

    if (!animate || isReducedMotion()) {
      drawChart(1);
      return;
    }

    const startTime = performance.now();
    const duration = 850;

    function animateChart(now) {
      const progress =
        clamp((now - startTime) / duration, 0, 1);
      const easedProgress =
        1 - Math.pow(1 - progress, 3);

      drawChart(easedProgress);

      if (progress < 1) {
        donutAnimationFrames.set(
          canvas,
          requestAnimationFrame(animateChart)
        );
      } else {
        donutAnimationFrames.delete(canvas);
      }
    }

    donutAnimationFrames.set(
      canvas,
      requestAnimationFrame(animateChart)
    );
  }


  /* =======================================================
     INSIGHTS
  ======================================================= */

  function renderInsights(
    list,
    income,
    expense
  ) {

    const element =
      document.getElementById(
        "insightList"
      );


    if (!element) return;


    const insights = [];


    const totals =
      categoryTotals(
        list,
        "expense"
      );


    const categories =
      Object.entries(
        totals
      ).sort(
        (a, b) =>
          b[1] - a[1]
      );


    if (
      categories.length &&
      expense > 0
    ) {

      const [
        category,
        amount
      ] =
        categories[0];


      const percent =
        Math.round(
          (amount / expense) *
          100
        );


      insights.push(
        `Your highest spending category is <strong>${escapeHtml(category)}</strong> (${percent}% of monthly expenses).`
      );
    }


    const budget =
      Number(
        state.settings.budget
      ) || 0;


    if (budget > 0) {

      const used =
        (expense / budget) *
        100;


      if (used >= 100) {

        insights.push(
          "You have exceeded your monthly budget."
        );

      } else if (used >= 80) {

        insights.push(
          `You have used <strong>${Math.round(used)}%</strong> of your budget.`
        );

      } else {

        insights.push(
          `You're within your budget with <strong>${Math.round(100 - used)}%</strong> remaining.`
        );
      }
    }


    if (income > 0) {

      const savingRate =
        Math.round(
          (
            (income - expense) /
            income
          ) * 100
        );


      insights.push(
        `Your current saving rate is <strong>${savingRate}%</strong>.`
      );
    }


    if (
      expense > income &&
      income > 0
    ) {

      insights.push(
        "Your expenses exceed your income this month."
      );
    }


    if (
      income === 0 &&
      expense > 0
    ) {

      insights.push(
        "You have logged expenses without recording income."
      );
    }


    if (
      list.length === 0
    ) {

      insights.push(
        "No activity recorded for this month yet. Click '+ Add Transaction' to start tracking."
      );
    }


    element.innerHTML =
      insights
        .map(
          (text) =>
            `<li>
              <span class="ins-icon">&#9673;</span>
              <span>${text}</span>
            </li>`
        )
        .join("");
  }


  /* =======================================================
     RECENT TRANSACTIONS
  ======================================================= */

  function renderRecentList() {

    const list =
      document.getElementById(
        "recentList"
      );


    if (!list) return;


    const recent =
      [...state.transactions]
        .sort(
          (a, b) =>
            (
              b.date +
              (b.createdAt || 0)
            ).localeCompare(
              a.date +
              (a.createdAt || 0)
            )
        )
        .slice(0, 5);


    if (!recent.length) {

      list.innerHTML =
        `<li class="empty-inline">
          No transactions yet. Click "+ Add Transaction" above!
        </li>`;

      return;
    }


    list.innerHTML =
      recent
        .map(
          (transaction) => {

            const meta =
              categoryMeta(
                transaction.category
              );


            const income =
              transaction.type ===
              "income";


            return `
              <li
                data-id="${escapeHtml(transaction.id)}"
                title="Click to edit"
              >

                <span
                  class="tx-icon"
                  style="
                    background:${meta.color}22;
                    color:${meta.color}
                  "
                >
                  ${escapeHtml(
              initials(
                transaction.category
              )
            )}
                </span>

                <span class="tx-meta">

                  <span class="tx-title">
                    ${escapeHtml(
              transaction.title
            )}
                  </span>

                  <span class="tx-sub">
                    ${escapeHtml(
              transaction.category
            )}
                    &bull;
                    ${formatDateDisplay(
              transaction.date
            )}
                  </span>

                </span>

                <span
                  class="tx-amount ${income
                ? "is-income"
                : "is-expense"
              }"
                >
                  ${income ? "+" : "-"}
                  ${formatCurrency(
                transaction.amount
              )}
                </span>

              </li>
            `;
          }
        )
        .join("");


    list
      .querySelectorAll(
        "li[data-id]"
      )
      .forEach(
        (element) => {

          element.addEventListener(
            "click",
            () =>
              openModalForEdit(
                element.dataset.id
              )
          );
        }
      );
  }


  /* =======================================================
     TRANSACTIONS PAGE
  ======================================================= */

  function populateFilterOptions() {

    const categorySelect =
      document.getElementById(
        "filterCategory"
      );

    const monthSelect =
      document.getElementById(
        "filterMonth"
      );


    if (!categorySelect ||
      !monthSelect) {
      return;
    }


    const oldCategory =
      categorySelect.value ||
      "all";


    const oldMonth =
      monthSelect.value ||
      "all";


    const categories =
      [
        ...new Set(
          state.transactions
            .map(
              (t) => t.category
            )
            .filter(Boolean)
        )
      ].sort();


    categorySelect.innerHTML =
      `<option value="all">
        All Categories
      </option>` +
      categories
        .map(
          (category) =>
            `<option value="${escapeHtml(category)}">
              ${escapeHtml(category)}
            </option>`
        )
        .join("");


    if (
      categories.includes(
        oldCategory
      )
    ) {

      categorySelect.value =
        oldCategory;
    }


    const months =
      [
        ...new Set(
          state.transactions
            .map(txMonthKey)
            .filter(
              (month) =>
                month.length === 7
            )
        )
      ]
        .sort()
        .reverse();


    monthSelect.innerHTML =
      `<option value="all">
        All Months
      </option>` +
      months
        .map(
          (month) => {

            const [
              year,
              monthNumber
            ] =
              month.split("-");


            const label =
              `${MONTH_NAMES[
              Number(monthNumber) - 1
              ]} ${year}`;


            return `
              <option value="${month}">
                ${label}
              </option>
            `;
          }
        )
        .join("");


    if (
      months.includes(
        oldMonth
      )
    ) {

      monthSelect.value =
        oldMonth;
    }
  }


  function getFilteredTransactions() {

    const search =
      document
        .getElementById(
          "searchInput"
        )
        ?.value
        .trim()
        .toLowerCase() || "";


    const type =
      document.getElementById(
        "filterType"
      )?.value || "all";


    const category =
      document.getElementById(
        "filterCategory"
      )?.value || "all";


    const month =
      document.getElementById(
        "filterMonth"
      )?.value || "all";


    return state.transactions

      .filter(
        (t) =>
          type === "all" ||
          t.type === type
      )

      .filter(
        (t) =>
          category === "all" ||
          t.category === category
      )

      .filter(
        (t) =>
          month === "all" ||
          txMonthKey(t) === month
      )

      .filter(
        (t) => {

          if (!search) {
            return true;
          }


          return (

            String(t.title || "")
              .toLowerCase()
              .includes(search)

            ||

            String(t.category || "")
              .toLowerCase()
              .includes(search)

            ||

            String(t.note || "")
              .toLowerCase()
              .includes(search)

            ||

            String(
              t.paymentMethod || ""
            )
              .toLowerCase()
              .includes(search)

            ||

            String(
              t.amount || ""
            ).includes(search)
          );
        }
      )

      .sort(
        (a, b) =>
          (
            b.date +
            (b.createdAt || 0)
          ).localeCompare(
            a.date +
            (a.createdAt || 0)
          )
      );
  }


  function renderTransactionsPage() {

    populateFilterOptions();


    const rows =
      getFilteredTransactions();


    const tbody =
      document.getElementById(
        "txTableBody"
      );


    const empty =
      document.getElementById(
        "txEmptyState"
      );


    const noMatch =
      document.getElementById(
        "txNoMatchState"
      );


    const table =
      document.getElementById(
        "txTable"
      );


    const search =
      document.getElementById(
        "searchInput"
      );


    const clear =
      document.getElementById(
        "searchClearBtn"
      );


    if (!tbody ||
      !empty ||
      !noMatch ||
      !table) {
      return;
    }


    if (clear && search) {

      clear.hidden =
        !search.value;
    }


    if (
      state.transactions.length === 0
    ) {

      tbody.innerHTML = "";

      empty.hidden = false;

      noMatch.hidden = true;

      table.style.display =
        "none";

      return;
    }


    table.style.display =
      "";


    if (!rows.length) {

      tbody.innerHTML = "";

      empty.hidden = true;

      noMatch.hidden = false;

      return;
    }


    empty.hidden = true;

    noMatch.hidden = true;


    tbody.innerHTML =
      rows
        .map(
          (transaction) => {

            const meta =
              categoryMeta(
                transaction.category
              );


            const income =
              transaction.type ===
              "income";


            return `
              <tr
                data-id="${escapeHtml(transaction.id)}"
              >

                <td>

                  <div class="tx-cell-title">

                    <span
                      class="tx-icon"
                      style="
                        background:${meta.color}22;
                        color:${meta.color}
                      "
                    >
                      ${escapeHtml(
              initials(
                transaction.category
              )
            )}
                    </span>

                    <span class="tx-title">
                      ${escapeHtml(
              transaction.title
            )}
                    </span>

                  </div>

                </td>


                <td>

                  <span
                    class="cat-pill"
                    style="
                      background:${meta.color}22;
                      color:${meta.color}
                    "
                  >
                    ${escapeHtml(
              transaction.category
            )}
                  </span>

                </td>


                <td>
                  ${formatDateDisplay(
              transaction.date
            )}
                </td>


                <td>
                  ${escapeHtml(
              transaction.paymentMethod ||
              "UPI"
            )}
                </td>


                <td
                  class="tx-amount ${income
                ? "is-income"
                : "is-expense"
              }"
                  style="text-align:right;"
                >
                  ${income ? "+" : "-"}
                  ${formatCurrency(
                transaction.amount
              )}
                </td>


                <td>

                  <div class="row-actions">

                    <button
                      type="button"
                      class="edit-btn"
                      data-id="${escapeHtml(transaction.id)}"
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      class="del-btn"
                      data-id="${escapeHtml(transaction.id)}"
                    >
                      Delete
                    </button>

                  </div>

                </td>

              </tr>
            `;
          }
        )
        .join("");


    tbody
      .querySelectorAll(".edit-btn")
      .forEach(
        (button) => {

          button.addEventListener(
            "click",
            (event) => {

              event.stopPropagation();

              openModalForEdit(
                button.dataset.id
              );
            }
          );
        }
      );


    tbody
      .querySelectorAll(".del-btn")
      .forEach(
        (button) => {

          button.addEventListener(
            "click",
            (event) => {

              event.stopPropagation();

              confirmDeleteTransaction(
                button.dataset.id
              );
            }
          );
        }
      );


    tbody
      .querySelectorAll("tr")
      .forEach(
        (row) => {

          row.addEventListener(
            "click",
            () =>
              openModalForEdit(
                row.dataset.id
              )
          );
        }
      );
  }


  function confirmDeleteTransaction(
    id
  ) {
    const transactionToDelete =
      state.transactions.find((transaction) => transaction.id === id);

    if (transactionToDelete?.type === "income") {
      const monthTransactions =
        state.transactions.filter((transaction) =>
          txMonthKey(transaction) === txMonthKey(transactionToDelete) &&
          transaction.id !== id);
      const incomeCents =
        monthTransactions
          .filter((transaction) => transaction.type === "income")
          .reduce((sum, transaction) =>
            sum + Math.round(Number(transaction.amount || 0) * 100), 0);
      const expenseCents =
        monthTransactions
          .filter((transaction) => transaction.type === "expense")
          .reduce((sum, transaction) =>
            sum + Math.round(Number(transaction.amount || 0) * 100), 0);

      if (expenseCents > incomeCents) {
        showToast(
          "This income is needed to cover expenses already recorded for the month. Reduce or remove those expenses before deleting it.",
          "warning"
        );
        return;
      }
    }

    openConfirm(
      "Are you sure you want to delete this transaction?",
      function () {

        state.transactions =
          state.transactions.filter(
            (transaction) =>
              transaction.id !== id
          );


        Store.saveTransactions(
          state.transactions
        );

        // Attempt to delete from Supabase as well when online
        if (connection.isOnline() && window.supabase && supabaseClient && state.user && state.user.id) {
          deleteTransactionFromSupabase(id).catch((err) => {
            console.warn('Supabase delete failed:', err);
          });
        }

        renderCurrentPage();

        showToast(
          "Transaction deleted successfully.",
          "success"
        );


        closeConfirm();
      }
    );
  }


  /* =======================================================
     ADD / EDIT TRANSACTION
  ======================================================= */

  function populateCategorySelect(
    type,
    customCategory = null
  ) {

    const select =
      document.getElementById(
        "txCategory"
      );


    if (!select) return;


    const existingCategories =
      type === "income"
        ? INCOME_CATEGORIES
        : EXPENSE_CATEGORIES;
    const recommendedNames =
      type === "expense"
        ? state.studentFeatures.studentMode === "hostel"
          ? ["Mess/Food", "Snacks", "Hostel", "Transport", "Recharge", "College", "Entertainment"]
          : state.studentFeatures.studentMode === "day-scholar"
            ? ["Bus/Fuel", "Food", "College", "Recharge", "Entertainment", "Study Materials", "Other"]
            : []
        : ["Money From Home"];
    const recommendedCategories = recommendedNames.map((name) => ({
      name,
      color: categoryMeta(name).color
    }));
    const categories = [
      ...recommendedCategories,
      ...existingCategories.filter((category) =>
        !recommendedNames.includes(category.name)
      )
    ];


    let options =
      categories.map(
        (category) =>
          `<option value="${escapeHtml(category.name)}">
            ${escapeHtml(category.name)}
          </option>`
      );


    if (
      customCategory &&
      !categories.some(
        (category) =>
          category.name.toLowerCase() ===
          customCategory.toLowerCase()
      )
    ) {

      options.push(
        `<option value="${escapeHtml(customCategory)}">
          ${escapeHtml(customCategory)}
        </option>`
      );
    }


    select.innerHTML =
      options.join("");
  }


  function setModalType(
    type,
    customCategory = null
  ) {

    document
      .getElementById(
        "typeExpenseBtn"
      )
      ?.classList.toggle(
        "is-active",
        type === "expense"
      );


    document
      .getElementById(
        "typeIncomeBtn"
      )
      ?.classList.toggle(
        "is-active",
        type === "income"
      );


    const icon =
      document.getElementById(
        "modalTypeBadgeIcon"
      );


    if (icon) {

      icon.textContent =
        type === "income"
          ? "💰"
          : "💸";
    }


    populateCategorySelect(
      type,
      customCategory
    );
  }


  function currentModalType() {

    return document
      .getElementById(
        "typeIncomeBtn"
      )
      ?.classList.contains(
        "is-active"
      )
      ? "income"
      : "expense";
  }


  function openModalForAdd() {

    if (!requireCompleteProfileForTransaction()) {
      return;
    }

    state.editingId = null;

    const submitButton = document.getElementById("txSubmitBtn");
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.dataset.loading = "false";
      submitButton.textContent = "Save Transaction";
    }

    document.getElementById(
      "txModalTitle"
    ).textContent =
      "Add Transaction";


    document.getElementById(
      "txSubmitBtn"
    ).textContent =
      "Save Transaction";


    document
      .getElementById(
        "txForm"
      )
      .reset();


    document.getElementById(
      "txId"
    ).value = "";


    setModalType(
      "expense"
    );


    document.getElementById(
      "txDate"
    ).value =
      todayISO();


    document.getElementById(
      "txPayment"
    ).value =
      "UPI";


    openModal();
  }


  function openModalForEdit(
    id
  ) {

    const transaction =
      state.transactions.find(
        (t) => t.id === id
      );


    if (!transaction) return;


    state.editingId =
      id;

    const submitButton = document.getElementById("txSubmitBtn");
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.dataset.loading = "false";
      submitButton.textContent = "Update Transaction";
    }


    document.getElementById(
      "txModalTitle"
    ).textContent =
      "Edit Transaction";


    document.getElementById(
      "txSubmitBtn"
    ).textContent =
      "Update Transaction";


    document.getElementById(
      "txId"
    ).value =
      transaction.id;


    setModalType(
      transaction.type,
      transaction.category
    );


    document.getElementById(
      "txCategory"
    ).value =
      transaction.category;


    document.getElementById(
      "txAmount"
    ).value =
      transaction.amount;


    document.getElementById(
      "txTitle"
    ).value =
      transaction.title;


    document.getElementById(
      "txDate"
    ).value =
      transaction.date;


    document.getElementById(
      "txPayment"
    ).value =
      transaction.paymentMethod ||
      "UPI";


    document.getElementById(
      "txNote"
    ).value =
      transaction.note || "";


    openModal();
  }


  function openModal() {

    const overlay =
      document.getElementById(
        "txModalOverlay"
      );


    if (!overlay) return;


    overlay.classList.add(
      "is-open"
    );


    overlay.setAttribute(
      "aria-hidden",
      "false"
    );
  }


  function closeModal() {

    const overlay =
      document.getElementById(
        "txModalOverlay"
      );


    if (overlay) {

      overlay.classList.remove(
        "is-open"
      );

      overlay.setAttribute(
        "aria-hidden",
        "true"
      );
    }

    const submitButton = document.getElementById("txSubmitBtn");
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.dataset.loading = "false";
      submitButton.textContent = state.editingId ? "Update Transaction" : "Save Transaction";
    }

    state.editingId =
      null;
  }


  function handleTxFormSubmit(
    event
  ) {

    event.preventDefault();

    const submitButton = document.getElementById("txSubmitBtn");

    if (state.transactionSubmitInFlight) {
      return;
    }

    if (
      !state.editingId &&
      !requireCompleteProfileForTransaction()
    ) {
      closeModal();
      return;
    }


    const type =
      currentModalType();


    const amount =
      Number(
        document.getElementById(
          "txAmount"
        ).value
      );


    const title =
      document.getElementById(
        "txTitle"
      ).value.trim();


    const category =
      document.getElementById(
        "txCategory"
      ).value;


    const date =
      document.getElementById(
        "txDate"
      ).value;


    const paymentMethod =
      document.getElementById(
        "txPayment"
      ).value;


    const note =
      document.getElementById(
        "txNote"
      ).value.trim();


    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {

      showToast(
        "Please enter a valid amount greater than ₹0.",
        "error"
      );

      return;
    }


    if (!title) {

      showToast(
        "Please enter a title or description.",
        "error"
      );

      return;
    }


    if (!date) {

      showToast(
        "Please select a date.",
        "error"
      );

      return;
    }

    const roundedAmount = Math.round(amount * 100) / 100;

    if (type === "expense") {

      const monthTransactions =
        state.transactions.filter(
          (transaction) =>
            txMonthKey(transaction) === date.slice(0, 7) &&
            transaction.id !== state.editingId
        );

      const incomeCents =
        monthTransactions
          .filter((transaction) => transaction.type === "income")
          .reduce(
            (total, transaction) =>
              total + Math.round(Number(transaction.amount || 0) * 100),
            0
          );

      const expenseCents =
        monthTransactions
          .filter((transaction) => transaction.type === "expense")
          .reduce(
            (total, transaction) =>
              total + Math.round(Number(transaction.amount || 0) * 100),
            0
          );

      const allowedCents =
        incomeCents - expenseCents;

      if (Math.round(roundedAmount * 100) > allowedCents) {

        showToast(
          `This expense would exceed money received for the month. Add income first or reduce the expense. You can spend up to ${formatCurrency(
            Math.max(0, allowedCents) / 100
          )} more.`,
          "warning"
        );

        return;
      }
    }

    if (state.editingId) {
      const existingTransaction =
        state.transactions.find((transaction) =>
          transaction.id === state.editingId);
      if (existingTransaction?.type === "income") {
        const oldMonth =
          txMonthKey(existingTransaction);
        const adjustedMonthTransactions =
          state.transactions.filter((transaction) =>
            txMonthKey(transaction) === oldMonth &&
            transaction.id !== state.editingId);
        const adjustedIncome =
          adjustedMonthTransactions
            .filter((transaction) => transaction.type === "income")
            .reduce((sum, transaction) =>
              sum + Math.round(Number(transaction.amount || 0) * 100), 0) +
          (type === "income" && date.slice(0, 7) === oldMonth
            ? Math.round(roundedAmount * 100)
            : 0);
        const existingExpenses =
          adjustedMonthTransactions
            .filter((transaction) => transaction.type === "expense")
            .reduce((sum, transaction) =>
              sum + Math.round(Number(transaction.amount || 0) * 100), 0);

        if (existingExpenses > adjustedIncome) {
          showToast(
            "This change would leave monthly expenses higher than money received. Keep the income or reduce/remove expenses first.",
            "warning"
          );
          return;
        }
      }
    }

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.dataset.loading = "true";
      submitButton.textContent = state.editingId ? "Updating..." : "Saving...";
    }

    state.transactionSubmitInFlight = true;

    try {
      if (state.editingId) {

        const index =
          state.transactions.findIndex(
            (t) =>
              t.id ===
              state.editingId
          );


        if (index !== -1) {

          state.transactions[index] = {

            ...state.transactions[index],

            type,

            amount:
              roundedAmount,

            title,

            category,

            date,

            paymentMethod,

            note
          };
        }


        const challengeWarning =
          getNoSpendPurchaseWarning(type, category, date);
        showToast(
          challengeWarning || "Transaction updated successfully.",
          challengeWarning ? "warning" : "success"
        );

      } else {

        state.transactions.push({

          id: uid(),

          type,

          amount:
            roundedAmount,

          title,

          category,

          date,

          paymentMethod,

          note,

          createdAt:
            Date.now()
        });


        const challengeWarning =
          getNoSpendPurchaseWarning(type, category, date);
        showToast(
          challengeWarning ||
            (type === "income"
              ? "Money received recorded!"
              : "Expense logged!"),
          challengeWarning ? "warning" : "success"
        );
      }


      Store.saveTransactions(
        state.transactions
      );

      // If online, schedule upsert of the changed transaction to Supabase
      if (connection.isOnline() && window.supabase && supabaseClient && state.user && state.user.id) {
        try {
          const tx = state.editingId
            ? state.transactions.find((t) => t.id === state.editingId)
            : state.transactions[state.transactions.length - 1];

          if (tx) {
            upsertSingleTransaction(tx).catch((err) => {
              console.warn('Supabase upsert failed:', err);
            });
          }
        } catch (err) {
          console.warn('Supabase upsert scheduling error:', err);
        }
      }

      closeModal();

      renderCurrentPage();

      checkMonthlyBudgetAlerts();
    } finally {
      state.transactionSubmitInFlight = false;
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.dataset.loading = "false";
        submitButton.textContent = state.editingId ? "Update Transaction" : "Save Transaction";
      }
    }
  }


  /* =======================================================
     REPORTS
  ======================================================= */

  function getReportRange() {

    if (
      state.reportPeriod ===
      "monthly"
    ) {

      const start =
        startOfMonth(
          state.viewMonth
        );


      const end =
        new Date(
          start.getFullYear(),
          start.getMonth() + 1,
          0
        );


      return {

        start:
          toISODate(start),

        end:
          toISODate(end),

        label:
          formatMonthLabel(
            start
          )
      };
    }


    if (
      state.reportPeriod ===
      "weekly"
    ) {

      const end =
        new Date();


      const start =
        new Date(
          end.getFullYear(),
          end.getMonth(),
          end.getDate() - 6
        );


      return {

        start:
          toISODate(start),

        end:
          toISODate(end),

        label:
          `Last 7 days (${formatDateDisplay(
            toISODate(start)
          )} - ${formatDateDisplay(
            toISODate(end)
          )})`
      };
    }


    const start =
      document.getElementById(
        "reportStartDate"
      )?.value;


    const end =
      document.getElementById(
        "reportEndDate"
      )?.value;


    if (
      !start ||
      !end ||
      start > end
    ) {

      return null;
    }


    return {

      start,

      end,

      label:
        `${formatDateDisplay(
          start
        )} - ${formatDateDisplay(
          end
        )}`
    };
  }


  function renderReportsPage() {

    const period =
      document.getElementById(
        "reportPeriod"
      );


    const custom =
      document.getElementById(
        "reportCustomDates"
      );


    const monthNav =
      document.getElementById(
        "reportMonthNav"
      );


    if (period) {

      period.value =
        state.reportPeriod;
    }


    if (custom) {

      custom.hidden =
        state.reportPeriod !==
        "custom";
    }


    if (monthNav) {

      monthNav.hidden =
        state.reportPeriod !==
        "monthly";
    }


    const range =
      getReportRange();


    if (!range) {

      return;
    }


    const list =
      state.transactions.filter(
        (transaction) =>
          transaction.date >=
          range.start &&
          transaction.date <=
          range.end
      );


    const expenses =
      list.filter(
        (t) =>
          t.type === "expense"
      );


    const incomes =
      list.filter(
        (t) =>
          t.type === "income"
      );


    const totalExpense =
      sumByType(
        list,
        "expense"
      );


    const totalIncome =
      sumByType(
        list,
        "income"
      );


    const average =
      expenses.length
        ? totalExpense /
        expenses.length
        : 0;


    animateValue(
      document.getElementById(
        "repAvgExpense"
      ),
      average,
      formatCurrency
    );


    const largest =
      expenses.length
        ? expenses.reduce(
          (max, item) =>
            Number(item.amount) >
              Number(max.amount)
              ? item
              : max
        )
        : null;


    if (largest) {

      document.getElementById(
        "repLargestExpense"
      ).textContent =
        formatCurrency(
          largest.amount
        );


      document.getElementById(
        "repLargestExpenseSub"
      ).textContent =
        `${largest.title} (${largest.category})`;

    } else {

      document.getElementById(
        "repLargestExpense"
      ).textContent =
        "₹0";


      document.getElementById(
        "repLargestExpenseSub"
      ).textContent =
        "No expenses in this period";
    }


    const totals =
      categoryTotals(
        list,
        "expense"
      );


    const categories =
      Object.entries(
        totals
      ).sort(
        (a, b) =>
          b[1] - a[1]
      );


    if (categories.length) {

      const [
        category,
        amount
      ] =
        categories[0];


      document.getElementById(
        "repTopCategory"
      ).textContent =
        category;


      document.getElementById(
        "repTopCategorySub"
      ).textContent =
        `${Math.round(
          (amount / totalExpense) *
          100
        )}% of expenses in this period`;

    } else {

      document.getElementById(
        "repTopCategory"
      ).textContent =
        "—";


      document.getElementById(
        "repTopCategorySub"
      ).textContent =
        "No expenses in this period";
    }


    const savingRate =
      totalIncome > 0
        ? Math.round(
          (
            (totalIncome -
              totalExpense) /
            totalIncome
          ) * 100
        )
        : 0;


    animateValue(
      document.getElementById(
        "repSavingRate"
      ),
      savingRate,
      (n) =>
        Math.round(n) + "%"
    );


    document.getElementById(
      "repSavingRateSub"
    ).textContent =
      range.label;


    const subtitle =
      document.getElementById(
        "monthlySummarySub"
      );


    if (subtitle) {

      subtitle.textContent =
        range.label;
    }


    const breakdown =
      document.getElementById(
        "reportBreakdownSub"
      );


    if (breakdown) {

      breakdown.textContent =
        `Spending distribution for ${range.label}`;
    }


    drawDonut(
      "reportDonutChart",
      "reportDonutLegend",
      "reportDonutTooltip",
      totals,
      true
    );


    const rankList =
      document.getElementById(
        "rankList"
      );


    if (rankList) {

      if (!categories.length) {

        rankList.innerHTML =
          `<li class="empty-inline">
            No expense records found.
          </li>`;

      } else {

        rankList.innerHTML =
          categories
            .map(
              ([category, amount], index) => {

                const meta =
                  categoryMeta(
                    category
                  );


                const percent =
                  Math.round(
                    (amount /
                      totalExpense) *
                    100
                  );


                return `
                  <li class="rank-row">

                    <span class="rank-num">
                      ${index + 1}
                    </span>

                    <div class="rank-bar-wrap">

                      <div class="rank-top">

                        <span>
                          ${escapeHtml(category)}
                        </span>

                        <strong>
                          ${formatCurrency(amount)}
                          (${percent}%)
                        </strong>

                      </div>

                      <div class="rank-track">

                        <div
                          class="rank-fill"
                          style="
                            width:${percent}%;
                            background:${meta.color}
                          "
                        ></div>

                      </div>

                    </div>

                  </li>
                `;
              }
            )
            .join("");
      }
    }


    const net =
      totalIncome -
      totalExpense;


    document.getElementById(
      "msIncome"
    ).textContent =
      formatCurrency(
        totalIncome
      );


    document.getElementById(
      "msExpense"
    ).textContent =
      formatCurrency(
        totalExpense
      );


    const netElement =
      document.getElementById(
        "msNet"
      );


    if (netElement) {

      netElement.textContent =
        (net >= 0 ? "+" : "-") +
        formatCurrency(
          Math.abs(net)
        );


      netElement.className =
        net >= 0
          ? "is-income"
          : "is-expense";
    }


    document.getElementById(
      "msCount"
    ).textContent =
      String(
        list.length
      );


    document.getElementById(
      "repMonthLabel"
    ).textContent =
      formatMonthLabel(
        state.viewMonth
      );
  }


  /* =======================================================
     PDF REPORT
  ======================================================= */

  let pdfLibrariesPromise = null;

  function loadPdfScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.onload = resolve;
      script.onerror = () => {
        reject(new Error(`Could not load PDF library: ${src}`));
      };
      document.head.appendChild(script);
    });
  }

  async function ensurePdfLibraries() {
    if (window.jspdf?.jsPDF?.API?.autoTable) {
      return;
    }

    if (!pdfLibrariesPromise) {
      pdfLibrariesPromise = (async () => {
        if (!window.jspdf?.jsPDF) {
          await loadPdfScript(
            "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"
          );
        }

        await loadPdfScript(
          "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.28/jspdf.plugin.autotable.min.js"
        );

        if (!window.jspdf?.jsPDF?.API?.autoTable) {
          throw new Error("PDF table support did not initialize.");
        }
      })();
    }

    try {
      await pdfLibrariesPromise;
    } catch (error) {
      pdfLibrariesPromise = null;
      throw error;
    }
  }

  async function downloadReportPdf() {

    try {
      await ensurePdfLibraries();
    } catch (error) {
      console.error("PDF libraries could not be loaded:", error);
      showToast(
        "Could not prepare the PDF. Check your connection and try again.",
        "error"
      );
      return;
    }

    const range =
      getReportRange();


    if (!range) {

      showToast(
        "Choose a valid report date range.",
        "error"
      );

      return;
    }


    const transactions =
      state.transactions
        .filter(
          (t) =>
            t.date >=
            range.start &&
            t.date <=
            range.end
        )
        .sort(
          (a, b) =>
            (b.date + (b.createdAt || 0)).localeCompare(
              a.date + (a.createdAt || 0)
            )
        );


    const income =
      sumByType(
        transactions,
        "income"
      );


    const expense =
      sumByType(
        transactions,
        "expense"
      );


    const net =
      income - expense;

    const categories =
      Object.entries(
        categoryTotals(
          transactions,
          "expense"
        )
      ).sort(
        (a, b) =>
          b[1] - a[1]
      );


    const tableRows =
      transactions.length
        ? transactions.map(
          (t) => [
            formatDateDisplay(t.date),
            t.title || "—",
            t.category || "Other",
            t.type === "income" ? "Income" : "Expense",
            `₹${Number(t.amount || 0).toLocaleString("en-IN", {
              minimumFractionDigits: 0,
              maximumFractionDigits: 2
            })}`
          ]
        )
        : [["—", "No transactions recorded", "—", "—", "—"]];


    const pdf =
      new window.jspdf.jsPDF({
        orientation: "portrait",
        unit: "pt",
        format: "a4"
      });


    const pageWidth =
      pdf.internal.pageSize.getWidth();

    const pageHeight =
      pdf.internal.pageSize.getHeight();

    const margin =
      40;

    const primary =
      [26, 103, 196];

    const dark =
      [19, 31, 55];

    const accent =
      [67, 198, 141];

    const soft =
      [244, 247, 249];

    const muted =
      [89, 97, 125];


    pdf.setFillColor(...primary);
    pdf.rect(0, 0, pageWidth, 110, "F");

    pdf.setTextColor(255, 255, 255);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(22);
    pdf.text("StudentSpend", margin, 38);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.text("Personal finance history report", margin, 58);

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.text(`Period: ${range.label}`, margin, 82);
    pdf.text(`Generated: ${formatDateDisplay(todayISO())}`, pageWidth - margin - 120, 82, { align: "right" });


    const summaryY = 138;
    const summaryWidth =
      (pageWidth - margin * 2 - 18) / 4;

    const summaryCards = [
      { label: "Money Received", value: `₹${income.toLocaleString("en-IN")}`, color: [218, 247, 232] },
      { label: "Total Spent", value: `₹${expense.toLocaleString("en-IN")}`, color: [254, 232, 232] },
      { label: "Net Balance", value: `${net >= 0 ? "+" : "-"}₹${Math.abs(net).toLocaleString("en-IN")}`, color: [232, 241, 255] },
      { label: "Transactions", value: String(transactions.length), color: [245, 240, 255] }
    ];

    summaryCards.forEach((card, index) => {
      const x = margin + index * (summaryWidth + 6);
      pdf.setFillColor(...card.color);
      pdf.roundedRect(x, summaryY, summaryWidth, 64, 8, 8, "F");

      pdf.setTextColor(...dark);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.text(card.label, x + 14, summaryY + 18);

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(18);
      pdf.text(card.value, x + 14, summaryY + 42);
    });


    let currentY = 232;
    pdf.setDrawColor(223, 228, 235);
    pdf.setTextColor(...dark);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(13);
    pdf.text("Expense breakdown", margin, currentY);
    currentY += 18;


    const breakdownRows =
      categories.length
        ? categories.map(([category, amount]) => [
            category,
            `₹${Number(amount || 0).toLocaleString("en-IN")}`
          ])
        : [["No expenses", "₹0"]];


    if (breakdownRows.length) {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      breakdownRows.slice(0, 5).forEach(([label, value]) => {
        pdf.setFillColor(247, 249, 251);
        pdf.rect(margin, currentY, pageWidth - margin * 2, 18, "F");
        pdf.text(label, margin + 10, currentY + 12);
        pdf.text(value, pageWidth - margin - 80, currentY + 12, { align: "right" });
        currentY += 22;
      });
    }


    currentY += 18;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(13);
    pdf.text("Transaction history", margin, currentY);
    currentY += 12;


    const tableStartY = currentY + 4;
    const tableHeaders = ["Date", "Title", "Category", "Type", "Amount"];
    const tableBody = tableRows;

    pdf.autoTable({
      startY: tableStartY,
      head: [tableHeaders],
      body: tableBody,
      theme: "grid",
      headStyles: {
        fillColor: primary,
        textColor: [255, 255, 255],
        fontStyle: "bold",
        halign: "center",
        fontSize: 9
      },
      bodyStyles: {
        fontSize: 8,
        textColor: dark,
        cellPadding: 5,
        valign: "middle"
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      margin: { left: margin, right: margin },
      tableWidth: pageWidth - margin * 2,
      styles: {
        lineColor: [220, 224, 232],
        lineWidth: 0.5,
        overflow: "linebreak"
      },
      columnStyles: {
        0: { cellWidth: 60 },
        1: { cellWidth: 160 },
        2: { cellWidth: 120 },
        3: { cellWidth: 70 },
        4: { cellWidth: 60, halign: "right" }
      }
    });


    const finalY = pdf.lastAutoTable.finalY || 0;
    if (finalY > pageHeight - 70) {
      pdf.addPage();
    }

    pdf.setFillColor(245, 247, 249);
    pdf.rect(0, pageHeight - 30, pageWidth, 30, "F");
    pdf.setTextColor(...muted);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.text("StudentSpend • Confidential financial history", margin, pageHeight - 13);
    pdf.text(`Summary based on ${transactions.length} recorded item(s)`, pageWidth - margin - 100, pageHeight - 13, { align: "right" });

    pdf.save(`studentspend-report-${range.start}-to-${range.end}.pdf`);

    showToast(
      "Professional PDF report downloaded.",
      "success"
    );
  }


  /* =======================================================
     SETTINGS
  ======================================================= */

  function renderSettingsPage() {

    const budget =
      document.getElementById(
        "budgetInput"
      );


    if (budget) {

      budget.value =
        state.settings.budget;
    }


    document
      .getElementById(
        "lightModeBtn"
      )
      ?.classList.toggle(
        "is-active",
        state.settings.theme ===
        "light"
      );


    document
      .getElementById(
        "darkModeBtn"
      )
      ?.classList.toggle(
        "is-active",
        state.settings.theme ===
        "dark"
      );
  }


  function applyTheme(theme) {

    const finalTheme =
      theme === "dark"
        ? "dark"
        : "light";


    document.documentElement
      .setAttribute(
        "data-theme",
        finalTheme
      );


    const icon =
      document.getElementById(
        "themeIcon"
      );


    if (icon) {

      icon.innerHTML =
        finalTheme === "dark"
          ? "&#9788;"
          : "&#9789;";
    }
  }


  function toggleTheme() {

    state.settings.theme =
      state.settings.theme ===
        "dark"
        ? "light"
        : "dark";


    applyTheme(
      state.settings.theme
    );


    Store.saveSettings(
      state.settings
    );


    renderCurrentPage();
  }


  /* =======================================================
     BUDGET ALERTS
  ======================================================= */

  function closeBudgetWarning() {

    const overlay =
      document.getElementById(
        "budgetWarningOverlay"
      );


    if (overlay) {

      overlay.classList.remove(
        "is-open"
      );

      overlay.setAttribute(
        "aria-hidden",
        "true"
      );
    }
  }


  function checkMonthlyBudgetAlerts() {

    const budget =
      Number(
        state.settings.budget
      ) || 0;


    if (budget <= 0) return;


    const today =
      new Date();


    const key =
      monthKey(today);


    const spent =
      sumByType(
        txForMonth(today),
        "expense"
      );


    const percent =
      (spent / budget) *
      100;


    const alerts =
      Store.loadAlerts();


    let record =
      alerts[key];


    if (
      !record ||
      Number(record.budget) !== budget
    ) {

      record = {

        budget,

        levels: [],

        exceeded: false
      };
    }


    [50, 80, 90, 100]
      .forEach(
        (level) => {

          if (
            percent >= level &&
            !record.levels.includes(
              level
            )
          ) {

            record.levels.push(
              level
            );


            showToast(
              `Monthly budget ${level}% used.`,
              level >= 90
                ? "warning"
                : "info"
            );
          }
        }
      );


    if (
      percent > 100 &&
      !record.exceeded
    ) {

      record.exceeded =
        true;


      const message =
        document.getElementById(
          "budgetWarningMessage"
        );


      if (message) {

        message.textContent =
          `You have spent ${formatCurrency(
            spent
          )}, which is ${formatCurrency(
            spent - budget
          )} over your monthly budget of ${formatCurrency(
            budget
          )}.`;
      }


      const overlay =
        document.getElementById(
          "budgetWarningOverlay"
        );


      if (overlay) {

        overlay.classList.add(
          "is-open"
        );

        overlay.setAttribute(
          "aria-hidden",
          "false"
        );
      }
    }


    alerts[key] =
      record;


    Store.saveAlerts(
      alerts
    );
  }


  /* =======================================================
     IMPORT / EXPORT
  ======================================================= */

  function exportData() {

    const data = {

      app:
        "StudentSpend",

      version:
        "2.0",

      user:
        state.user?.email || "",

      exportedAt:
        new Date().toISOString(),

      transactions:
        state.transactions,

      settings:
        state.settings,

      studentFeatures:
        state.studentFeatures,

      profile:
        state.profile
    };


    const blob =
      new Blob(
        [
          JSON.stringify(
            data,
            null,
            2
          )
        ],
        {
          type:
            "application/json"
        }
      );


    const url =
      URL.createObjectURL(
        blob
      );


    const link =
      document.createElement(
        "a"
      );


    link.href =
      url;


    link.download =
      `studentspend-backup-${todayISO()}.json`;


    document.body.appendChild(
      link
    );


    link.click();


    link.remove();


    URL.revokeObjectURL(
      url
    );


    showToast(
      "Backup exported successfully.",
      "success"
    );
  }


  function importData(file) {

    const reader =
      new FileReader();


    reader.onload =
      function (event) {

        try {

          const data =
            JSON.parse(
              event.target.result
            );


          if (
            !data ||
            !Array.isArray(
              data.transactions
            )
          ) {

            throw new Error(
              "Invalid backup file."
            );
          }


          const transactions =
            data.transactions
              .filter(
                (t) =>
                  t &&
                  (
                    t.type ===
                    "income" ||
                    t.type ===
                    "expense"
                  ) &&
                  Number(t.amount) > 0 &&
                  t.title &&
                  t.date
              )
              .map(
                (t) => ({

                  id:
                    t.id || uid(),

                  type:
                    t.type,

                  amount:
                    Math.round(
                      Number(t.amount) *
                      100
                    ) / 100,

                  title:
                    String(
                      t.title
                    ).slice(
                      0,
                      80
                    ),

                  category:
                    String(
                      t.category ||
                      "Other"
                    ),

                  date:
                    String(
                      t.date
                    ).slice(
                      0,
                      10
                    ),

                  paymentMethod:
                    String(
                      t.paymentMethod ||
                      "UPI"
                    ),

                  note:
                    String(
                      t.note ||
                      ""
                    ),

                  createdAt:
                    t.createdAt ||
                    Date.now()
                })
              );


          state.transactions =
            transactions;


          if (
            data.settings &&
            typeof data.settings ===
            "object"
          ) {

            state.settings =
            {
              ...DEFAULT_SETTINGS,
              ...data.settings
            };
          }

          if (
            data.studentFeatures &&
            typeof data.studentFeatures === "object"
          ) {
            state.studentFeatures =
              normalizeStudentFeatures(data.studentFeatures);
            persistStudentFeatures();
          }


          if (
            data.profile &&
            typeof data.profile ===
            "object"
          ) {

            state.profile =
            {
              name:
                data.profile.name ||
                "",

              firstName:
                typeof data.profile.firstName === "string"
                  ? data.profile.firstName
                  : "",

              middleName:
                typeof data.profile.middleName === "string"
                  ? data.profile.middleName
                  : "",

              lastName:
                typeof data.profile.lastName === "string"
                  ? data.profile.lastName
                  : "",

              age:
                data.profile.age ||
                "",

              phone:
                typeof data.profile.phone === "string"
                  ? data.profile.phone
                  : ""
            };


            Store.saveProfile(
              state.profile
            );
          }


          Store.saveTransactions(
            state.transactions
          );


          Store.saveSettings(
            state.settings
          );


          applyTheme(
            state.settings.theme
          );


          renderCurrentPage();


          showToast(
            `Successfully imported ${transactions.length} transactions.`,
            "success"
          );


        } catch (error) {

          console.error(
            "Import error:",
            error
          );


          showToast(
            "Could not import backup file.",
            "error"
          );
        }
      };


    reader.readAsText(
      file
    );
  }


  function clearAllData() {

    openConfirm(
      "This will permanently delete every transaction stored for your account in this browser.",
      function () {

        state.transactions =
          [];


        Store.saveTransactions(
          []
        );


        Store.saveAlerts(
          {}
        );


        renderCurrentPage();


        showToast(
          "All transactions cleared.",
          "success"
        );


        closeConfirm();
      }
    );
  }

  function handleHomeMoneySubmit(event) {
    event.preventDefault();
    const amount = Number(document.getElementById("homeMoneyAmount").value);
    const date = document.getElementById("homeMoneyDate").value;
    const note = document.getElementById("homeMoneyNote").value.trim();
    if (!Number.isFinite(amount) || amount <= 0 || !date) {
      showToast("Enter a valid amount and date for money received.", "error");
      return;
    }

    state.transactions.push({
      id: uid(),
      type: "income",
      amount: Math.round(amount * 100) / 100,
      title: "Money From Home",
      category: "Money From Home",
      date,
      paymentMethod: "Other",
      note,
      createdAt: Date.now()
    });
    Store.saveTransactions(state.transactions);
    document.getElementById("homeMoneyForm").reset();
    document.getElementById("homeMoneyDate").value = todayISO();
    renderCurrentPage();
    showToast("Money from home recorded as income.", "success");
  }

  function handleSavingsGoalSubmit(event) {
    event.preventDefault();
    const id = document.getElementById("savingsGoalId").value;
    const name = document.getElementById("savingsGoalName").value.trim();
    const target = Number(document.getElementById("savingsGoalTarget").value);
    const saved = Number(document.getElementById("savingsGoalSaved").value);
    const targetDate = document.getElementById("savingsGoalDate").value;
    const note = document.getElementById("savingsGoalNote").value.trim();
    if (!name || !Number.isFinite(target) || target <= 0 ||
        !Number.isFinite(saved) || saved < 0 || !targetDate) {
      showToast("Enter a goal name, valid target and saved amounts, and target date.", "error");
      return;
    }

    const current = state.studentFeatures.savingsGoals.find((goal) => goal.id === id);
    const goal = {
      id: id || uid(),
      name,
      target: Math.round(target * 100) / 100,
      saved: Math.round(saved * 100) / 100,
      targetDate,
      note,
      createdAt: current?.createdAt || Date.now()
    };
    state.studentFeatures.savingsGoals = id
      ? state.studentFeatures.savingsGoals.map((item) => item.id === id ? goal : item)
      : [...state.studentFeatures.savingsGoals, goal];
    resetSavingsGoalForm();
    persistStudentFeatures();
    renderStudentTools();
    showToast(id ? "Savings goal updated." : "Savings goal created.", "success");
  }

  function resetSavingsGoalForm() {
    document.getElementById("savingsGoalForm")?.reset();
    document.getElementById("savingsGoalId").value = "";
    document.getElementById("savingsGoalSaved").value = "0";
    document.getElementById("savingsGoalSubmit").textContent = "Add goal";
    document.getElementById("savingsGoalCancel").hidden = true;
  }

  function handleGoalListClick(event) {
    const button = event.target.closest("[data-feature-action]");
    if (!button) return;
    const { featureAction, id } = button.dataset;

    if (featureAction === "edit-home") {
      openModalForEdit(id);
      return;
    }
    if (featureAction === "delete-home") {
      confirmDeleteTransaction(id);
      return;
    }
    if (featureAction === "edit-calendar-transaction") {
      openModalForEdit(id);
      return;
    }
    if (featureAction === "edit-goal") {
      const goal = state.studentFeatures.savingsGoals.find((item) => item.id === id);
      if (!goal) return;
      document.getElementById("savingsGoalId").value = goal.id;
      document.getElementById("savingsGoalName").value = goal.name;
      document.getElementById("savingsGoalTarget").value = String(goal.target);
      document.getElementById("savingsGoalSaved").value = String(goal.saved);
      document.getElementById("savingsGoalDate").value = goal.targetDate;
      document.getElementById("savingsGoalNote").value = goal.note;
      document.getElementById("savingsGoalSubmit").textContent = "Save changes";
      document.getElementById("savingsGoalCancel").hidden = false;
      document.getElementById("savingsGoalName").focus();
      return;
    }
    if (featureAction === "delete-goal") {
      openConfirm("Delete this savings goal?", () => {
        state.studentFeatures.savingsGoals =
          state.studentFeatures.savingsGoals.filter((goal) => goal.id !== id);
        persistStudentFeatures();
        renderStudentTools();
        showToast("Savings goal deleted.", "success");
        closeConfirm();
      });
      return;
    }
    if (featureAction === "edit-reminder") {
      const reminder = state.studentFeatures.paymentReminders.find((item) => item.id === id);
      if (!reminder) return;
      document.getElementById("paymentReminderId").value = reminder.id;
      document.getElementById("paymentReminderName").value = reminder.name;
      document.getElementById("paymentReminderAmount").value = String(reminder.amount);
      document.getElementById("paymentReminderDate").value = reminder.dueDate;
      document.getElementById("paymentReminderCategory").value = reminder.category;
      document.getElementById("paymentReminderRecurring").checked = reminder.recurring;
      document.getElementById("paymentReminderFrequency").value = reminder.recurrence || "monthly";
      document.getElementById("paymentReminderFrequencyWrap").hidden = !reminder.recurring;
      document.getElementById("paymentReminderSubmit").textContent = "Save changes";
      document.getElementById("paymentReminderCancel").hidden = false;
      document.getElementById("paymentReminderName").focus();
      return;
    }
    if (featureAction === "complete-reminder") {
      const completedReminder =
        state.studentFeatures.paymentReminders.find((reminder) => reminder.id === id);
      state.studentFeatures.paymentReminders =
        state.studentFeatures.paymentReminders.map((reminder) =>
          reminder.id === id ? { ...reminder, completed: true } : reminder);
      if (completedReminder?.recurring) {
        const recurrenceBase =
          completedReminder.dueDate > todayISO()
            ? completedReminder.dueDate
            : todayISO();
        state.studentFeatures.paymentReminders.push({
          ...completedReminder,
          id: uid(),
          dueDate: nextReminderDate(
            recurrenceBase,
            completedReminder.recurrence
          ),
          completed: false
        });
      }
      persistStudentFeatures();
      renderStudentTools();
      showToast(
        completedReminder?.recurring
          ? "Payment marked complete; the next reminder is scheduled. No transaction was created."
          : "Payment marked complete. No transaction was created.",
        "success"
      );
      return;
    }
    if (featureAction === "delete-reminder") {
      openConfirm("Delete this payment reminder?", () => {
        state.studentFeatures.paymentReminders =
          state.studentFeatures.paymentReminders.filter((reminder) => reminder.id !== id);
        persistStudentFeatures();
        renderStudentTools();
        showToast("Payment reminder deleted.", "success");
        closeConfirm();
      });
    }
  }

  function handleGoalContribution(event) {
    const form = event.target.closest("[data-goal-contribute]");
    if (!form) return;
    event.preventDefault();
    const amount = Number(form.querySelector("input").value);
    if (!Number.isFinite(amount) || amount <= 0) {
      showToast("Enter a contribution greater than ₹0.", "error");
      return;
    }
    const id = form.dataset.goalContribute;
    state.studentFeatures.savingsGoals =
      state.studentFeatures.savingsGoals.map((goal) =>
        goal.id === id
          ? { ...goal, saved: Math.round((goal.saved + amount) * 100) / 100 }
          : goal);
    persistStudentFeatures();
    renderStudentTools();
    showToast("Savings goal updated. Your available balance was not changed.", "success");
  }

  function handlePaymentReminderSubmit(event) {
    event.preventDefault();
    const id = document.getElementById("paymentReminderId").value;
    const name = document.getElementById("paymentReminderName").value.trim();
    const amount = Number(document.getElementById("paymentReminderAmount").value);
    const dueDate = document.getElementById("paymentReminderDate").value;
    if (!name || !Number.isFinite(amount) || amount <= 0 || !dueDate) {
      showToast("Enter a payment name, valid amount, and due date.", "error");
      return;
    }
    const existing = state.studentFeatures.paymentReminders.find((item) => item.id === id);
    const reminder = {
      id: id || uid(),
      name,
      amount: Math.round(amount * 100) / 100,
      dueDate,
      category: document.getElementById("paymentReminderCategory").value,
      recurring: document.getElementById("paymentReminderRecurring").checked,
      recurrence: document.getElementById("paymentReminderFrequency").value,
      completed: existing?.completed || false
    };
    state.studentFeatures.paymentReminders = id
      ? state.studentFeatures.paymentReminders.map((item) => item.id === id ? reminder : item)
      : [...state.studentFeatures.paymentReminders, reminder];
    resetPaymentReminderForm();
    persistStudentFeatures();
    renderStudentTools();
    showToast(id ? "Payment reminder updated." : "Payment reminder added.", "success");
  }

  function resetPaymentReminderForm() {
    document.getElementById("paymentReminderForm")?.reset();
    document.getElementById("paymentReminderId").value = "";
    document.getElementById("paymentReminderSubmit").textContent = "Add reminder";
    document.getElementById("paymentReminderCancel").hidden = true;
    document.getElementById("paymentReminderFrequencyWrap").hidden = true;
  }

  function nextReminderDate(dueDate, recurrence) {
    const [year, month, day] = dueDate.split("-").map(Number);
    if (recurrence === "weekly") {
      return toISODate(new Date(year, month - 1, day + 7));
    }
    const nextMonth = new Date(year, month, 1);
    const lastDay = new Date(
      nextMonth.getFullYear(),
      nextMonth.getMonth() + 1,
      0
    ).getDate();
    return toISODate(
      new Date(nextMonth.getFullYear(), nextMonth.getMonth(), Math.min(day, lastDay))
    );
  }

  function startNoSpendChallenge(duration) {
    state.studentFeatures.challenge = {
      id: uid(),
      duration,
      startDate: todayISO(),
      status: "active"
    };
    persistStudentFeatures();
    renderStudentTools();
    showToast(`${duration}-day no-spend challenge started.`, "success");
  }

  function getNoSpendPurchaseWarning(type, category, date) {
    const challenge = state.studentFeatures.challenge;
    let endDate = "";
    if (challenge) {
      const startDate = new Date(`${challenge.startDate}T12:00:00`);
      startDate.setDate(startDate.getDate() + challenge.duration - 1);
      endDate = toISODate(startDate);
    }
    const essentialCategories = new Set([
      "food", "mess/food", "snacks", "transport", "bus/fuel", "education",
      "study materials", "college", "hostel", "health", "recharge"
    ]);

    if (
      type === "expense" &&
      challenge?.status === "active" &&
      date >= challenge.startDate &&
      date <= endDate &&
      !essentialCategories.has(String(category).toLowerCase())
    ) {
      return "You made a purchase today. Your challenge can still continue.";
    }
    return "";
  }

  function wireStudentToolEvents() {
    document.getElementById("homeMoneyForm")
      ?.addEventListener("submit", handleHomeMoneySubmit);

    document.querySelectorAll("[data-open-transactions]")
      .forEach((button) => button.addEventListener("click", () => switchPage("transactions")));

    document.querySelectorAll("[data-dashboard-page]")
      .forEach((button) => button.addEventListener("click", () =>
        switchPage(button.dataset.dashboardPage)));

    document.getElementById("categoryBudgetsForm")
      ?.addEventListener("submit", (event) => {
        event.preventDefault();
        const budgets = {};
        document.querySelectorAll("[data-category-budget]").forEach((input) => {
          const amount = Number(input.value);
          if (input.value && Number.isFinite(amount) && amount > 0) {
            budgets[input.dataset.categoryBudget] = Math.round(amount * 100) / 100;
          }
        });
        state.studentFeatures.categoryBudgets = budgets;
        persistStudentFeatures();
        renderStudentTools();
        showToast("Category budgets saved.", "success");
      });

    document.getElementById("savingsGoalForm")
      ?.addEventListener("submit", handleSavingsGoalSubmit);
    document.getElementById("savingsGoalCancel")
      ?.addEventListener("click", resetSavingsGoalForm);
    document.getElementById("savingsGoalsList")
      ?.addEventListener("click", handleGoalListClick);
    document.getElementById("savingsGoalsList")
      ?.addEventListener("submit", handleGoalContribution);

    document.getElementById("homeMoneyHistory")
      ?.addEventListener("click", handleGoalListClick);
    document.getElementById("calendarDayTransactions")
      ?.addEventListener("click", handleGoalListClick);
    document.getElementById("paymentRemindersList")
      ?.addEventListener("click", handleGoalListClick);
    document.getElementById("paymentReminderForm")
      ?.addEventListener("submit", handlePaymentReminderSubmit);
    document.getElementById("paymentReminderCancel")
      ?.addEventListener("click", resetPaymentReminderForm);
    document.getElementById("paymentReminderRecurring")
      ?.addEventListener("change", (event) => {
        document.getElementById("paymentReminderFrequencyWrap").hidden =
          !event.target.checked;
      });

    document.getElementById("expenseCalendar")
      ?.addEventListener("click", (event) => {
        const button = event.target.closest("[data-calendar-date]");
        if (!button) return;
        state.calendarSelectedDate = button.dataset.calendarDate;
        renderExpenseCalendar();
      });
    document.getElementById("expenseCalendarPrev")
      ?.addEventListener("click", () => {
        state.calendarMonth = new Date(
          state.calendarMonth.getFullYear(),
          state.calendarMonth.getMonth() - 1,
          1
        );
        state.calendarSelectedDate = toISODate(state.calendarMonth);
        renderExpenseCalendar();
      });
    document.getElementById("expenseCalendarNext")
      ?.addEventListener("click", () => {
        state.calendarMonth = new Date(
          state.calendarMonth.getFullYear(),
          state.calendarMonth.getMonth() + 1,
          1
        );
        state.calendarSelectedDate = toISODate(state.calendarMonth);
        renderExpenseCalendar();
      });

    document.getElementById("challengeDuration")
      ?.addEventListener("change", renderNoSpendChallenge);
    document.getElementById("challengeForm")
      ?.addEventListener("submit", (event) => {
        event.preventDefault();
        const selected = document.getElementById("challengeDuration").value;
        const duration = selected === "custom"
          ? Number(document.getElementById("challengeCustomDays").value)
          : Number(selected);
        if (!Number.isInteger(duration) || duration < 1 || duration > 365) {
          showToast("Choose a challenge duration between 1 and 365 days.", "error");
          return;
        }
        startNoSpendChallenge(duration);
      });
    document.getElementById("challengeCancelButton")
      ?.addEventListener("click", () => {
        if (!state.studentFeatures.challenge) return;
        state.studentFeatures.challenge.status = "canceled";
        persistStudentFeatures();
        renderStudentTools();
        showToast("Challenge canceled. Your transactions were not changed.", "info");
      });
    document.getElementById("challengeCompleteButton")
      ?.addEventListener("click", () => {
        if (!state.studentFeatures.challenge) return;
        state.studentFeatures.challenge.status = "completed";
        persistStudentFeatures();
        renderStudentTools();
        showToast("Challenge marked complete.", "success");
      });
    document.getElementById("challengeRestartButton")
      ?.addEventListener("click", () => {
        const duration = state.studentFeatures.challenge?.duration;
        if (duration) startNoSpendChallenge(duration);
      });
  }


  /* =======================================================
     EVENTS
  ======================================================= */

  function wireEvents() {

    wireStudentToolEvents();

    /* Navigation */

    document
      .querySelectorAll(
        ".nav-item"
      )
      .forEach(
        (button) => {

          button.addEventListener(
            "click",
            () =>
              switchPage(
                button.dataset.page
              )
          );
        }
      );


    /* Profile */

    document
      .getElementById(
        "profileForm"
      )
      ?.addEventListener(
        "submit",
        saveProfile
      );


    document
      .getElementById(
        "logoutBtn"
      )
      ?.addEventListener(
        "click",
        logoutUser
      );
    /* Daily Reminder */

    document
      .getElementById(
        "saveReminderBtn"
      )
      ?.addEventListener(
        "click",
        saveReminderSettings
      );


    document
      .getElementById(
        "dailyReminderEnabled"
      )
      ?.addEventListener(
        "change",
        () => {

          const status =
            document.getElementById(
              "reminderStatusText"
            );

          const enabled =
            document.getElementById(
              "dailyReminderEnabled"
            )?.checked;


          if (status) {

            if (enabled) {

              const time =
                document.getElementById(
                  "dailyReminderTime"
                )?.value ||
                "20:00";

              status.textContent =
                `Reminder is ON. You will be reminded every day at ${formatReminderTime(time)}.`;

            } else {

              status.textContent =
                "Reminder is currently disabled.";
            }
          }
        }
      );


    document
      .getElementById(
        "dailyReminderTime"
      )
      ?.addEventListener(
        "change",
        () => {

          const status =
            document.getElementById(
              "reminderStatusText"
            );

          const enabled =
            document.getElementById(
              "dailyReminderEnabled"
            )?.checked;


          if (
            status &&
            enabled
          ) {

            const time =
              document.getElementById(
                "dailyReminderTime"
              )?.value ||
              "20:00";

            status.textContent =
              `Reminder is ON. You will be reminded every day at ${formatReminderTime(time)}.`;
          }
        }
      );


    document
      .getElementById(
        "closeDailyReminderPopup"
      )
      ?.addEventListener(
        "click",
        closeDailyReminderPopup
      );

    document
      .getElementById(
        "openProfileCompletion"
      )
      ?.addEventListener(
        "click",
        () => {
          closeProfileCompletionPopup();
          switchPage("profile");
          document.getElementById("profileFirstName")?.focus();
        }
      );

    document
      .getElementById(
        "dismissProfileCompletion"
      )
      ?.addEventListener(
        "click",
        closeProfileCompletionPopup
      );

    document
      .getElementById(
        "profileCompletionPopup"
      )
      ?.addEventListener(
        "click",
        (event) => {
          if (event.target.id === "profileCompletionPopup") {
            closeProfileCompletionPopup();
          }
        }
      );


    document
      .getElementById(
        "dailyReminderPopup"
      )
      ?.addEventListener(
        "click",
        (event) => {

          if (
            event.target.id ===
            "dailyReminderPopup"
          ) {

            closeDailyReminderPopup();
          }
        }
      );


    /* Mobile menu */

    document
      .getElementById(
        "menuToggle"
      )
      ?.addEventListener(
        "click",
        () => {

          document
            .getElementById(
              "sidebar"
            )
            ?.classList.add(
              "is-open"
            );

          document
            .getElementById(
              "sidebarOverlay"
            )
            ?.classList.add(
              "is-open"
            );
        }
      );


    document
      .getElementById(
        "sidebarOverlay"
      )
      ?.addEventListener(
        "click",
        closeSidebarMobile
      );


    /* Theme */

    document
      .getElementById(
        "themeToggle"
      )
      ?.addEventListener(
        "click",
        toggleTheme
      );


    document
      .getElementById(
        "lightModeBtn"
      )
      ?.addEventListener(
        "click",
        () => {

          state.settings.theme =
            "light";

          applyTheme(
            "light"
          );

          Store.saveSettings(
            state.settings
          );

          renderCurrentPage();
        }
      );


    document
      .getElementById(
        "darkModeBtn"
      )
      ?.addEventListener(
        "click",
        () => {

          state.settings.theme =
            "dark";

          applyTheme(
            "dark"
          );

          Store.saveSettings(
            state.settings
          );

          renderCurrentPage();
        }
      );


    /* Tip */

    document
      .getElementById(
        "tipRefreshBtn"
      )
      ?.addEventListener(
        "click",
        () => {

          const tip =
            document.getElementById(
              "sidebarTip"
            );


          if (!tip) return;


          tip.textContent =
            STUDENT_TIPS[
            Math.floor(
              Math.random() *
              STUDENT_TIPS.length
            )
            ];
        }
      );


    /* Dashboard month */

    document
      .getElementById(
        "prevMonth"
      )
      ?.addEventListener(
        "click",
        () => {

          state.viewMonth =
            new Date(
              state.viewMonth.getFullYear(),
              state.viewMonth.getMonth() - 1,
              1
            );

          renderDashboard();
        }
      );


    document
      .getElementById(
        "nextMonth"
      )
      ?.addEventListener(
        "click",
        () => {

          state.viewMonth =
            new Date(
              state.viewMonth.getFullYear(),
              state.viewMonth.getMonth() + 1,
              1
            );

          renderDashboard();
        }
      );


    document
      .getElementById(
        "todayMonthBtn"
      )
      ?.addEventListener(
        "click",
        () => {

          state.viewMonth =
            startOfMonth(
              new Date()
            );

          renderDashboard();
        }
      );


    /* Reports */

    document
      .getElementById(
        "repPrevMonth"
      )
      ?.addEventListener(
        "click",
        () => {

          state.viewMonth =
            new Date(
              state.viewMonth.getFullYear(),
              state.viewMonth.getMonth() - 1,
              1
            );

          renderReportsPage();
        }
      );


    document
      .getElementById(
        "repNextMonth"
      )
      ?.addEventListener(
        "click",
        () => {

          state.viewMonth =
            new Date(
              state.viewMonth.getFullYear(),
              state.viewMonth.getMonth() + 1,
              1
            );

          renderReportsPage();
        }
      );


    document
      .getElementById(
        "repTodayMonthBtn"
      )
      ?.addEventListener(
        "click",
        () => {

          state.viewMonth =
            startOfMonth(
              new Date()
            );

          renderReportsPage();
        }
      );


    document
      .getElementById(
        "reportPeriod"
      )
      ?.addEventListener(
        "change",
        (event) => {

          state.reportPeriod =
            event.target.value;

          renderReportsPage();
        }
      );


    [
      "reportStartDate",
      "reportEndDate"
    ].forEach(
      (id) => {

        document
          .getElementById(id)
          ?.addEventListener(
            "change",
            renderReportsPage
          );
      }
    );


    document
      .getElementById(
        "downloadReportBtn"
      )
      ?.addEventListener(
        "click",
        downloadReportPdf
      );


    /* Add transaction */

    document
      .getElementById(
        "addTransactionBtn"
      )
      ?.addEventListener(
        "click",
        openModalForAdd
      );


    document
      .getElementById(
        "emptyAddBtn"
      )
      ?.addEventListener(
        "click",
        openModalForAdd
      );


    document
      .getElementById(
        "viewAllBtn"
      )
      ?.addEventListener(
        "click",
        () =>
          switchPage(
            "transactions"
          )
      );


    /* Transaction modal */

    document
      .getElementById(
        "txModalClose"
      )
      ?.addEventListener(
        "click",
        closeModal
      );


    document
      .getElementById(
        "txCancelBtn"
      )
      ?.addEventListener(
        "click",
        closeModal
      );


    document
      .getElementById(
        "txModalOverlay"
      )
      ?.addEventListener(
        "click",
        (event) => {

          if (
            event.target.id ===
            "txModalOverlay"
          ) {

            closeModal();
          }
        }
      );


    document
      .getElementById(
        "typeExpenseBtn"
      )
      ?.addEventListener(
        "click",
        () =>
          setModalType(
            "expense"
          )
      );


    document
      .getElementById(
        "typeIncomeBtn"
      )
      ?.addEventListener(
        "click",
        () =>
          setModalType(
            "income"
          )
      );


    document
      .getElementById(
        "txForm"
      )
      ?.addEventListener(
        "submit",
        handleTxFormSubmit
      );


    /* Confirm */

    document
      .getElementById(
        "confirmCancel"
      )
      ?.addEventListener(
        "click",
        closeConfirm
      );


    document
      .getElementById(
        "confirmOverlay"
      )
      ?.addEventListener(
        "click",
        (event) => {

          if (
            event.target.id ===
            "confirmOverlay"
          ) {

            closeConfirm();
          }
        }
      );


    document
      .getElementById(
        "confirmOk"
      )
      ?.addEventListener(
        "click",
        async () => {

          if (
            typeof state.confirmAction ===
            "function"
          ) {

            await state.confirmAction();
          }
        }
      );


    document
      .getElementById(
        "budgetWarningClose"
      )
      ?.addEventListener(
        "click",
        closeBudgetWarning
      );


    /* Search/filter */

    [
      "searchInput",
      "filterType",
      "filterCategory",
      "filterMonth"
    ].forEach(
      (id) => {

        document
          .getElementById(id)
          ?.addEventListener(
            "input",
            renderTransactionsPage
          );

        document
          .getElementById(id)
          ?.addEventListener(
            "change",
            renderTransactionsPage
          );
      }
    );


    document
      .getElementById(
        "searchClearBtn"
      )
      ?.addEventListener(
        "click",
        () => {

          const input =
            document.getElementById(
              "searchInput"
            );


          if (input) {

            input.value = "";

            renderTransactionsPage();

            input.focus();
          }
        }
      );


    function resetFilters() {

      const search =
        document.getElementById(
          "searchInput"
        );


      const type =
        document.getElementById(
          "filterType"
        );


      const category =
        document.getElementById(
          "filterCategory"
        );


      const month =
        document.getElementById(
          "filterMonth"
        );


      if (search) search.value = "";

      if (type) type.value = "all";

      if (category) category.value = "all";

      if (month) month.value = "all";


      renderTransactionsPage();
    }


    document
      .getElementById(
        "resetFiltersBtn"
      )
      ?.addEventListener(
        "click",
        resetFilters
      );


    document
      .getElementById(
        "clearFilterBtn"
      )
      ?.addEventListener(
        "click",
        resetFilters
      );


    /* Budget */

    document
      .getElementById(
        "budgetForm"
      )
      ?.addEventListener(
        "submit",
        (event) => {

          event.preventDefault();


          const value =
            Number(
              document.getElementById(
                "budgetInput"
              ).value
            );


          if (
            !Number.isFinite(value) ||
            value < 0
          ) {

            showToast(
              "Please enter a valid budget.",
              "error"
            );

            return;
          }


          state.settings.budget =
            Math.round(value);


          Store.saveSettings(
            state.settings
          );


          checkMonthlyBudgetAlerts();


          renderCurrentPage();


          showToast(
            "Monthly budget saved.",
            "success"
          );
        }
      );


    /* Export */

    document
      .getElementById(
        "exportBtn"
      )
      ?.addEventListener(
        "click",
        exportData
      );


    /* Import */

    document
      .getElementById(
        "importBtn"
      )
      ?.addEventListener(
        "click",
        () =>
          document
            .getElementById(
              "importInput"
            )
            ?.click()
      );


    document
      .getElementById(
        "importInput"
      )
      ?.addEventListener(
        "change",
        (event) => {

          const file =
            event.target.files[0];


          if (file) {

            importData(file);
          }


          event.target.value =
            "";
        }
      );


    /* Clear */

    document
      .getElementById(
        "clearBtn"
      )
      ?.addEventListener(
        "click",
        clearAllData
      );


    /* Keyboard */

    document.addEventListener(
      "keydown",
      (event) => {

        if (
          event.key ===
          "Escape"
        ) {

          closeModal();

          closeConfirm();

          closeBudgetWarning();

          closeDailyReminderPopup();

          closeProfileCompletionPopup();
        }


        /* Number input wheel */

        document
          .querySelectorAll(
            'input[type="number"]'
          )
          .forEach(
            (input) => {

              input.addEventListener(
                "wheel",
                (event) =>
                  event.preventDefault(),
                {
                  passive: false
                }
              );
            }
          );


        /* Resize */

        let resizeTimer;


        window.addEventListener(
          "resize",
          () => {

            clearTimeout(
              resizeTimer
            );


            resizeTimer =
              setTimeout(
                () => {

                  if (
                    state.currentPage ===
                    "dashboard"
                  ) {

                    renderDashboard();

                  } else if (
                    state.currentPage ===
                    "reports"
                  ) {

                    renderReportsPage();
                  }

                },
                200
              );
          }
        );
      });
    }


      /* =======================================================
         INITIALIZATION
      ======================================================= */

      async function init() {

        try {

          /*
            1. Check Supabase login
          */

          const cachedUser =
            await getCachedSessionUser();

          let user;

          if (cachedUser) {

            state.user =
              cachedUser;

            const [authenticatedUser] =
              await Promise.all([
                connection.isOnline()
                  ? checkAuthentication()
                  : Promise.resolve(cachedUser),
                loadCurrentProfile(),
                loadStudentFeatures()
              ]);

            user =
              authenticatedUser;

          } else {

            user =
              await checkAuthentication();

            if (!user) {
              return;
            }

            state.user =
              user;

            await Promise.all([
              loadCurrentProfile(),
              loadStudentFeatures()
            ]);
          }


          if (!user) {

            return;
          }


          /*
            2. Store current user
          */

          state.user =
            user;


          /*
            3. Load user-specific data
          */

          state.transactions =
            Store.loadTransactions();


          state.settings = {
            ...DEFAULT_SETTINGS,
            ...Store.loadSettings()
          };

          /*
            4. Report default dates
          */

          const currentMonth =
            startOfMonth(
              new Date()
            );


          const reportStart =
            document.getElementById(
              "reportStartDate"
            );


          const reportEnd =
            document.getElementById(
              "reportEndDate"
            );


          if (reportStart) {

            reportStart.value =
              toISODate(
                currentMonth
              );
          }


          if (reportEnd) {

            reportEnd.value =
              todayISO();
          }


          /*
            5. Theme
          */

          applyTheme(
            state.settings.theme
          );


          /*
            6. Student tip
          */

          const tip =
            document.getElementById(
              "sidebarTip"
            );


          if (tip) {

            tip.textContent =
              STUDENT_TIPS[
              Math.floor(
                Math.random() *
                STUDENT_TIPS.length
              )
              ];
          }


          /*
            7. Connect all buttons
          */

          wireEvents();
          /* Load reminder controls */
          renderReminderSettings();

          /* Start daily reminder checker */
          startReminderChecker();

          /* Show login reminder once */
          showLoginReminderOnce();


          /*
            8. Open dashboard
          */

          switchPage(
            "dashboard"
          );

          showProfileCompletionPopup();


          /*
            9. Check budget
          */

          checkMonthlyBudgetAlerts();


          console.log(
            "StudentSpend initialized successfully."
          );


        } catch (error) {

          console.error(
            "StudentSpend initialization failed:",
            error
          );


          showToast(
            "Dashboard could not initialize. Check the browser console.",
            "error"
          );
        }
      }


  /* =======================================================
     START
  ======================================================= */

  if(document.readyState==="loading")
    {
      document.addEventListener("DOMContentLoaded", init)
    }
    else 
    {
      init();
    };
})();