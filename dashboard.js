/* =========================================================
   StudentSpend — FINAL Dashboard Application
   Vanilla JS + Supabase Auth
   ========================================================= */

/* =========================================================
   1. SUPABASE
========================================================= */

const SUPABASE_URL = "https://nghhwccvhllhvaegolnf.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_os5MeJr2pe0n0FcDILjm7w_vdfE190O";

const connection = window.StudentSpendConnection;

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
);

/* =========================================================
   2. AUTHENTICATION
========================================================= */

async function getCachedSessionUser() {
  try {
    const { data, error } = await supabaseClient.auth.getSession();

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
  if (!supabaseClient) {
    window.location.replace("index.html");
    return null;
  }

  try {
    const {
      data: { session },
      error,
    } = await supabaseClient.auth.getSession();

    if (error) {
      if (connection.handleError(error)) {
        return getCachedSessionUser();
      }
      console.error("Session check failed:", error);
      window.location.replace("index.html");
      return null;
    }

    if (!session?.user) {
      window.location.replace("index.html");
      return null;
    }

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError) {
      if (connection.handleError(userError)) {
        return session.user;
      }
      console.error("User validation failed:", userError);
      window.location.replace("index.html");
      return null;
    }

    if (!user) {
      window.location.replace("index.html");
      return null;
    }

    console.log("Authenticated:", user.email);
    return user;
  } catch (error) {
    if (connection.handleError(error)) {
      return getCachedSessionUser();
    }

    console.error("Authentication error:", error);
    window.location.replace("index.html");
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

    reminderTime: "20:00",
  };

  const DEFAULT_STUDENT_FEATURES = {
    studentMode: "",
    customStudentType: "",
    categoryBudgets: {},
    savingsGoals: [],
    savingsTransfers: [],
    savingsOperations: [],
    paymentReminders: [],
    challenge: null,
  };

  const STUDENT_TYPE_OPTIONS = [
    { value: "undergraduate", label: "Undergraduate Student" },
    { value: "postgraduate", label: "Postgraduate Student" },
    { value: "diploma", label: "Diploma Student" },
    { value: "research", label: "PhD / Research Student" },
    { value: "engineering", label: "Engineering Student" },
    { value: "college", label: "College Student" },
    {
      value: "hostel",
      label: "Hostel Student",
      recommendedCategories: [
        "Mess/Food",
        "Snacks",
        "Hostel",
        "Transport",
        "Recharge",
        "College",
        "Entertainment",
        "Money From Home",
      ],
    },
    {
      value: "day-scholar",
      label: "Day Scholar",
      recommendedCategories: [
        "Bus/Fuel",
        "Food",
        "College",
        "Recharge",
        "Entertainment",
        "Study Materials",
        "Other",
      ],
    },
    { value: "other", label: "Other" },
  ];

  const EXPENSE_CATEGORIES = [
    { name: "Food", color: "#f97316" },
    { name: "Transport", color: "#3b82f6" },
    { name: "Education", color: "#8b5cf6" },
    { name: "Recharge", color: "#14b8a6" },
    { name: "Entertainment", color: "#ec4899" },
    { name: "Shopping", color: "#eab308" },
    { name: "Hostel", color: "#6366f1" },
    { name: "Health", color: "#ef4444" },
    { name: "Other", color: "#94a3b8" },
  ];

  const INCOME_CATEGORIES = [
    { name: "Money From Home", color: "#10b981" },
    { name: "Scholarship", color: "#06b6d4" },
    { name: "Part-time", color: "#8b5cf6" },
    { name: "Gift", color: "#f43f5e" },
    { name: "Other Income", color: "#64748b" },
  ];

  const ALL_CATEGORIES = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];

  const PAYMENT_METHODS = ["UPI", "Cash", "Card", "Bank Transfer", "Other"];
  const INCOME_SOURCE_LABELS = {
    gpay: "GPay",
    phonepe: "PhonePe",
    bank_transfer: "Bank Transfer",
    bank_account: "Bank Account",
    mutual_fund: "Mutual Fund",
    other: "Other",
  };
  const INCOME_SOURCE_VALUES = new Set(Object.keys(INCOME_SOURCE_LABELS));

  function normalizeIncomeSource(value) {
    const normalized = String(value || "")
      .trim()
      .toLowerCase();
    return INCOME_SOURCE_VALUES.has(normalized) ? normalized : null;
  }

  function normalizeIncomeSourceName(value) {
    return String(value || "")
      .trim()
      .slice(0, 60);
  }

  function getIncomeSourceLabel(transaction) {
    if (transaction.type !== "income")
      return transaction.paymentMethod || "UPI";

    const source = normalizeIncomeSource(
      transaction.incomeSource ?? transaction.income_source,
    );
    const sourceName = normalizeIncomeSourceName(
      transaction.incomeSourceName ?? transaction.income_source_name,
    );
    if (transactionCountsAsSavings(transaction)) {
      const bucket = normalizeSavingsBucket(
        getTransactionMoneySource(transaction),
      );
      if (bucket === "cash") return "Cash Savings";
      return `Online Savings · ${
        source === "other" && sourceName
          ? sourceName
          : INCOME_SOURCE_LABELS[source] || "Online"
      }`;
    }
    if (getTransactionMoneySource(transaction) === "cash") return "Cash";
    return `Online · ${
      source === "other" && sourceName
        ? sourceName
        : INCOME_SOURCE_LABELS[source] || transaction.paymentMethod || "Online"
    }`;
  }

  function moneySourceFromPaymentMethod(paymentMethod) {
    return String(paymentMethod || "")
      .trim()
      .toLowerCase() === "cash"
      ? "cash"
      : "online";
  }

  function normalizeMoneySource(type, source, paymentMethod) {
    const normalized = String(source || "")
      .trim()
      .toLowerCase();
    const allowedSources =
      type === "income" ? ["cash", "online"] : ["cash", "online", "savings"];

    return allowedSources.includes(normalized)
      ? normalized
      : moneySourceFromPaymentMethod(paymentMethod);
  }

  function getTransactionMoneySource(transaction) {
    return normalizeMoneySource(
      transaction.type,
      transaction.moneySource ?? transaction.money_source,
      transaction.paymentMethod ?? transaction.payment_method,
    );
  }

  function transactionCountsAsSavings(transaction) {
    return (
      transaction.type === "income" &&
      (transaction.countAsSavings === true ||
        transaction.count_as_savings === true)
    );
  }

  const SAVINGS_PLATFORMS = {
    google_pay: "Google Pay",
    phonepe: "PhonePe",
    bank_account: "Bank Account",
    digital_gold: "Digital Gold",
    mutual_fund: "Mutual Fund",
    other: "Other",
  };
  const NON_SPENDABLE_SAVINGS_PLATFORMS = new Set([
    "digital_gold",
    "mutual_fund",
  ]);

  function normalizeSavingsBucket(value) {
    return value === "online" ? "online" : "cash";
  }

  function normalizeSavingsPlatform(value) {
    return Object.prototype.hasOwnProperty.call(SAVINGS_PLATFORMS, value)
      ? value
      : "other";
  }

  function getIncomeSavingsPlatform(transaction) {
    const source = normalizeIncomeSource(
      transaction.incomeSource ?? transaction.income_source,
    );
    const platform = {
      gpay: "google_pay",
      phonepe: "phonepe",
      bank_account: "bank_account",
      mutual_fund: "mutual_fund",
      other: "other",
    }[source];
    if (platform) {
      return {
        platform,
        platformName:
          source === "other"
            ? normalizeIncomeSourceName(
                transaction.incomeSourceName ?? transaction.income_source_name,
              )
            : "",
      };
    }
    return {
      platform:
        transaction.savingsPlatform || transaction.savings_platform
          ? normalizeSavingsPlatform(
              transaction.savingsPlatform ?? transaction.savings_platform,
            )
          : "other",
      platformName:
        transaction.savingsPlatformName ||
        transaction.savings_platform_name ||
        "Income savings",
    };
  }

  function getSavingsPlatformLabel(platform, customPlatformName = "") {
    return platform === "other" && customPlatformName.trim()
      ? `Other — ${customPlatformName.trim()}`
      : SAVINGS_PLATFORMS[platform] || SAVINGS_PLATFORMS.other;
  }

  function calculateMoneyBalances(
    transactions,
    savingsTransfers = state.studentFeatures.savingsTransfers || [],
    savingsOperations = state.studentFeatures.savingsOperations || [],
  ) {
    let cashCents = 0;
    let onlineCents = 0;
    const savingsEvents = [];

    transactions.forEach((transaction) => {
      const amountCents = Math.round(Number(transaction.amount || 0) * 100);
      const moneySource = getTransactionMoneySource(transaction);

      if (transaction.type === "income") {
        if (transactionCountsAsSavings(transaction)) {
          const incomeSavingsPlatform = getIncomeSavingsPlatform(transaction);
          const incomeSource = normalizeIncomeSource(
            transaction.incomeSource ?? transaction.income_source,
          );
          savingsEvents.push({
            kind: "deposit",
            amountCents,
            includeInTotal: true,
            bucket: normalizeSavingsBucket(
              getTransactionMoneySource(transaction),
            ),
            platform:
              getTransactionMoneySource(transaction) === "online"
                ? incomeSavingsPlatform.platform
                : null,
            platformName: incomeSource
              ? incomeSavingsPlatform.platformName
              : transaction.savingsPlatformName ||
                transaction.savings_platform_name ||
                "Income savings",
            date: transaction.date,
            createdAt: Number(transaction.createdAt) || 0,
          });
        } else if (moneySource === "cash") {
          cashCents += amountCents;
        } else {
          onlineCents += amountCents;
        }
      } else if (transaction.type === "expense") {
        if (moneySource === "savings") {
          savingsEvents.push({
            kind: "withdrawal",
            amountCents,
            bucket:
              transaction.savingsBucket || transaction.savings_bucket
                ? normalizeSavingsBucket(
                    transaction.savingsBucket ?? transaction.savings_bucket,
                  )
                : null,
            platform:
              transaction.savingsPlatform || transaction.savings_platform
                ? normalizeSavingsPlatform(
                    transaction.savingsPlatform ?? transaction.savings_platform,
                  )
                : null,
            platformName:
              transaction.savingsPlatformName ||
              transaction.savings_platform_name ||
              "",
            date: transaction.date,
            createdAt: Number(transaction.createdAt) || 0,
          });
        } else if (moneySource === "cash") {
          cashCents -= amountCents;
        } else {
          onlineCents -= amountCents;
        }
      }
    });

    savingsTransfers.forEach((transfer) => {
      const amountCents = Math.round(Number(transfer.amount || 0) * 100);
      if (transfer.source === "cash") {
        cashCents -= amountCents;
      } else {
        onlineCents -= amountCents;
      }
      savingsEvents.push({
        kind: "deposit",
        amountCents,
        includeInTotal: true,
        bucket: normalizeSavingsBucket(transfer.source),
        platform:
          transfer.source === "online"
            ? normalizeSavingsPlatform(transfer.platform)
            : null,
        platformName:
          transfer.source === "online" &&
          normalizeSavingsPlatform(transfer.platform) === "other"
            ? transfer.customPlatformName || "Moved from Online"
            : "",
        date: transfer.date,
        createdAt: Number(transfer.createdAt) || 0,
      });
    });

    // dashboard.js - calculateMoneyBalances() bhitorot

    savingsOperations.forEach((operation) => {
      const amountCents = Math.round(Number(operation.amount || 0) * 100);

      // --- EITU NOTUN ADD KORIBA ---
      // Withdraw hole target balance (Cash ba Online)-t poisa add hobo:
      if (operation.type === "withdrawal") {
        if (operation.savingsType === "cash") {
          cashCents += amountCents;
        } else if (operation.savingsType === "online") {
          onlineCents += amountCents;
        }
      }

      // Savings lot/event record (Savings deduct korar karone):
      savingsEvents.push({
        kind: operation.type === "withdrawal" ? "withdrawal" : "deposit",
        amountCents: amountCents,
        includeInTotal:
          operation.includeInTotalMoney === true ||
          operation.includeInTotal === true,
        bucket: ["cash", "online"].includes(operation.savingsType)
          ? operation.savingsType
          : operation.type === "deposit"
            ? "cash"
            : null,
        platform:
          operation.savingsType === "online"
            ? normalizeSavingsPlatform(operation.platform)
            : null,
        platformName: operation.customPlatformName || "",
        date: operation.date,
        createdAt: Number(operation.createdAt) || 0,
      });
    });

    savingsEvents.sort(
      (a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt,
    );
    const savingsLots = [];
    savingsEvents.forEach((entry) => {
      if (entry.kind === "deposit") {
        savingsLots.push({
          bucket: entry.bucket || "cash",
          platform:
            entry.bucket === "online" ? entry.platform || "other" : null,
          platformName: entry.platformName || "",
          includeInTotal: entry.includeInTotal === true,
          remainingCents: entry.amountCents,
          date: entry.date,
          createdAt: entry.createdAt,
        });
        return;
      }

      let remaining = entry.amountCents;
      const matchingLots = savingsLots
        .filter(
          (lot) =>
            (!entry.bucket || lot.bucket === entry.bucket) &&
            (!entry.platform || lot.platform === entry.platform) &&
            (!entry.platformName || lot.platformName === entry.platformName) &&
            lot.remainingCents > 0,
        )
        .sort(
          (a, b) =>
            Number(a.includeInTotal) - Number(b.includeInTotal) ||
            a.date.localeCompare(b.date) ||
            a.createdAt - b.createdAt,
        );
      matchingLots.forEach((lot) => {
        if (remaining <= 0) return;
        const used = Math.min(lot.remainingCents, remaining);
        lot.remainingCents -= used;
        remaining -= used;
      });
      if (remaining > 0) {
        savingsLots.push({
          bucket: entry.bucket || "cash",
          platform:
            entry.bucket === "online" ? entry.platform || "other" : null,
          platformName: entry.platformName || "",
          includeInTotal: true,
          remainingCents: -remaining,
          date: entry.date,
          createdAt: entry.createdAt,
        });
      }
    });

    const cashLots = savingsLots.filter((lot) => lot.bucket === "cash");
    const onlineLots = savingsLots.filter((lot) => lot.bucket === "online");
    const cashSavingsCents = cashLots.reduce(
      (sum, lot) => sum + lot.remainingCents,
      0,
    );
    const onlineSavingsCents = onlineLots.reduce(
      (sum, lot) => sum + lot.remainingCents,
      0,
    );
    const onlineSpendableSavingsCents = onlineLots
      .filter((lot) => !NON_SPENDABLE_SAVINGS_PLATFORMS.has(lot.platform))
      .reduce((sum, lot) => sum + lot.remainingCents, 0);
    const includedSavingsCents = savingsLots
      .filter((lot) => lot.includeInTotal)
      .reduce((sum, lot) => sum + lot.remainingCents, 0);
    const excludedSavingsCents = savingsLots
      .filter((lot) => !lot.includeInTotal)
      .reduce((sum, lot) => sum + lot.remainingCents, 0);
    const onlinePlatforms = new Map();
    onlineLots.forEach((lot) => {
      const key = `${lot.platform || "other"}:${lot.platformName || ""}`;
      const existing = onlinePlatforms.get(key) || {
        platform: lot.platform || "other",
        customPlatformName: lot.platformName || "",
        amountCents: 0,
      };
      existing.amountCents += lot.remainingCents;
      onlinePlatforms.set(key, existing);
    });
    const savingsCents = cashSavingsCents + onlineSavingsCents;
    return {
      cashCents,
      onlineCents,
      totalCents: cashCents + onlineCents + includedSavingsCents,
      savingsCents,
      cashSavingsCents,
      onlineSavingsCents,
      onlineSpendableSavingsCents,
      includedSavingsCents,
      excludedSavingsCents,
      onlinePlatforms: Array.from(onlinePlatforms.values()).filter(
        (entry) => entry.amountCents !== 0,
      ),
      spendableCents: Math.max(0, cashCents + onlineCents),
    };
  }

  const STUDENT_TIPS = [
    "Track a purchase the moment you make it.",
    "Small recurring costs can add up quickly.",
    "Set your monthly budget before spending.",
    "Review your top spending category every week.",
    "Saving even 10% can build a strong habit.",
    "Track canteen and snack expenses regularly.",
    "Record shared expenses immediately.",
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
    "December",
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
      phone: "",
    },

    settings: {
      ...DEFAULT_SETTINGS,
    },

    studentFeatures: {
      ...DEFAULT_STUDENT_FEATURES,
    },
    txCurrentPage: 1,
    txPageSize: 7,
    savingsCurrentPage: 1,
    savingsPageSize: 7,

    homeMoneyCurrentPage: 1,
    homeMoneyPageSize: 7,

    currentPage: "dashboard",

    viewMonth: startOfMonth(new Date()),

    editingId: null,

    confirmAction: null,

    reportPeriod: "monthly",

    trendHoverIndex: null,

    calendarMonth: startOfMonth(new Date()),

    calendarSelectedDate: todayISO(),

    savingsOperationReturnFocus: null,

    savingsOperationType: "deposit",

    savingsOperationSubmitting: false,

    savingsEventsWired: false,

    savingsActivityExpanded: false,
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
      value && typeof value === "object" && !Array.isArray(value) ? value : {};

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
          .filter(
            (goal) =>
              goal &&
              typeof goal.id === "string" &&
              typeof goal.name === "string" &&
              Number.isFinite(Number(goal.target)) &&
              Number(goal.target) > 0,
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
            createdAt: Number(goal.createdAt) || Date.now(),
          }))
      : [];

    const savingsTransfers = Array.isArray(source.savingsTransfers)
      ? source.savingsTransfers
          .filter(
            (transfer) =>
              transfer &&
              typeof transfer.id === "string" &&
              ["cash", "online"].includes(transfer.source) &&
              Number.isFinite(Number(transfer.amount)) &&
              Number(transfer.amount) > 0,
          )
          .map((transfer) => ({
            id: transfer.id,
            amount: Math.round(Number(transfer.amount) * 100) / 100,
            source: transfer.source,
            platform:
              transfer.source === "online"
                ? normalizeSavingsPlatform(transfer.platform)
                : null,
            customPlatformName:
              transfer.source === "online" &&
              normalizeSavingsPlatform(transfer.platform) === "other"
                ? String(transfer.customPlatformName || "Moved from Online")
                    .trim()
                    .slice(0, 60)
                : "",
            date:
              typeof transfer.date === "string"
                ? transfer.date.slice(0, 10)
                : todayISO(),
            createdAt: Number(transfer.createdAt) || Date.now(),
          }))
      : [];

    const savingsOperations = Array.isArray(source.savingsOperations)
      ? source.savingsOperations
          .filter(
            (operation) =>
              operation &&
              typeof operation.id === "string" &&
              ["deposit", "withdrawal"].includes(operation.type) &&
              Number.isFinite(Number(operation.amount)) &&
              Number(operation.amount) > 0,
          )
          .map((operation) => ({
            id: operation.id,
            type: operation.type,
            amount: Math.round(Number(operation.amount) * 100) / 100,
            savingsType: ["cash", "online"].includes(operation.savingsType)
              ? operation.savingsType
              : operation.type === "deposit"
                ? "cash"
                : null,
            platform:
              operation.savingsType === "online"
                ? normalizeSavingsPlatform(operation.platform)
                : null,
            customPlatformName:
              operation.savingsType === "online" &&
              normalizeSavingsPlatform(operation.platform) === "other"
                ? String(operation.customPlatformName || "Other")
                    .trim()
                    .slice(0, 60)
                : "",
            includeInTotal:
              operation.type === "deposit" &&
              (operation.includeInTotalMoney === true ||
                operation.includeInTotal === true),
            includeInTotalMoney:
              operation.type === "deposit" &&
              (operation.includeInTotalMoney === true ||
                operation.includeInTotal === true),
            date:
              typeof operation.date === "string"
                ? operation.date.slice(0, 10)
                : todayISO(),
            createdAt: Number(operation.createdAt) || Date.now(),
          }))
      : [];

    const paymentReminders = Array.isArray(source.paymentReminders)
      ? source.paymentReminders
          .filter(
            (reminder) =>
              reminder &&
              typeof reminder.id === "string" &&
              typeof reminder.name === "string" &&
              Number.isFinite(Number(reminder.amount)) &&
              Number(reminder.amount) > 0,
          )
          .map((reminder) => ({
            id: reminder.id,
            kind: reminder.kind === "repayment" ? "repayment" : "payment",
            name: reminder.name.slice(0, 60),
            personName: String(reminder.personName || "").slice(0, 60),
            amount: Math.round(Number(reminder.amount) * 100) / 100,
            dueDate: String(reminder.dueDate || ""),
            category: String(reminder.category || "Other").slice(0, 60),
            recurring:
              reminder.kind !== "repayment" && reminder.recurring === true,
            recurrence: ["weekly", "monthly"].includes(reminder.recurrence)
              ? reminder.recurrence
              : "monthly",
            completed: reminder.completed === true,
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
            status: ["active", "completed", "canceled"].includes(
              source.challenge.status,
            )
              ? source.challenge.status
              : "active",
          }
        : null;

    return {
      ...DEFAULT_STUDENT_FEATURES,
      studentMode:
        typeof source.studentMode === "string"
          ? source.studentMode.trim().slice(0, 60)
          : "",
      customStudentType:
        typeof source.customStudentType === "string"
          ? normalizeProfileName(source.customStudentType).slice(0, 60)
          : "",
      categoryBudgets,
      savingsGoals,
      savingsTransfers,
      savingsOperations,
      paymentReminders,
      challenge,
    };
  }

  const Store = {
    transactionsKey() {
      return getUserStoragePrefix() + "_transactions";
    },

    pendingTransactionDeletesKey() {
      return getUserStoragePrefix() + "_pending_transaction_deletes";
    },

    loadPendingTransactionDeletes() {
      try {
        const parsed = JSON.parse(
          localStorage.getItem(this.pendingTransactionDeletesKey()) || "[]",
        );
        return Array.isArray(parsed)
          ? [...new Set(parsed.filter((id) => typeof id === "string"))]
          : [];
      } catch (error) {
        console.error("Pending transaction delete load error:", error);
        return [];
      }
    },

    queueTransactionDelete(id) {
      try {
        const pending = this.loadPendingTransactionDeletes();
        if (!pending.includes(id)) {
          pending.push(id);
        }
        localStorage.setItem(
          this.pendingTransactionDeletesKey(),
          JSON.stringify(pending),
        );
      } catch (error) {
        console.error("Pending transaction delete save error:", error);
        showToast(
          "Could not queue this transaction for online deletion.",
          "error",
        );
      }
    },

    clearPendingTransactionDelete(id) {
      try {
        const pending = this.loadPendingTransactionDeletes().filter(
          (pendingId) => pendingId !== id,
        );
        localStorage.setItem(
          this.pendingTransactionDeletesKey(),
          JSON.stringify(pending),
        );
      } catch (error) {
        console.error("Pending transaction delete update error:", error);
      }
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

    notificationReadKey() {
      return getUserStoragePrefix() + "_notification_read";
    },

    loadNotificationReadIds() {
      try {
        const parsed = JSON.parse(
          localStorage.getItem(this.notificationReadKey()) || "[]",
        );
        return Array.isArray(parsed)
          ? parsed.filter((id) => typeof id === "string").slice(-200)
          : [];
      } catch (error) {
        console.error("Notification read-state load error:", error);
        return [];
      }
    },

    saveNotificationReadIds(ids) {
      try {
        localStorage.setItem(
          this.notificationReadKey(),
          JSON.stringify(
            ids.filter((id) => typeof id === "string").slice(-200),
          ),
        );
        return true;
      } catch (error) {
        console.error("Notification read-state save error:", error);
        return false;
      }
    },

    hasPendingStudentFeaturesSync() {
      try {
        return (
          localStorage.getItem(this.studentFeaturesPendingKey()) === "true"
        );
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
        const raw = localStorage.getItem(this.transactionsKey());

        if (!raw) return [];

        const parsed = JSON.parse(raw);

        if (!Array.isArray(parsed)) {
          return [];
        }

        return parsed.map((item) => ({
          ...item,

          amount: Math.round(Number(item.amount || 0) * 100) / 100,

          moneySource: normalizeMoneySource(
            item.type,
            item.moneySource ?? item.money_source,
            item.paymentMethod ?? item.payment_method,
          ),

          countAsSavings: transactionCountsAsSavings(item),
          savingsBucket:
            item.savingsBucket || item.savings_bucket
              ? normalizeSavingsBucket(
                  item.savingsBucket ?? item.savings_bucket,
                )
              : null,
          savingsPlatform:
            item.savingsPlatform || item.savings_platform
              ? normalizeSavingsPlatform(
                  item.savingsPlatform ?? item.savings_platform,
                )
              : null,
          savingsPlatformName: String(
            item.savingsPlatformName || item.savings_platform_name || "",
          )
            .trim()
            .slice(0, 60),
          incomeSource:
            item.type === "income"
              ? normalizeIncomeSource(item.incomeSource ?? item.income_source)
              : null,
          incomeSourceName:
            item.type === "income"
              ? normalizeIncomeSourceName(
                  item.incomeSourceName ?? item.income_source_name,
                )
              : "",

          createdAt: item.createdAt || Date.now(),
        }));
      } catch (error) {
        console.error("Transaction loading error:", error);

        return [];
      }
    },

    saveTransactions(list) {
      try {
        localStorage.setItem(this.transactionsKey(), JSON.stringify(list));

        // Fire-and-forget: sync local transaction changes when online
        if (
          window.supabase &&
          supabaseClient &&
          connection.isOnline() &&
          state.user &&
          state.user.id
        ) {
          syncTransactionsToSupabase(list).catch((err) => {
            console.warn("Supabase transaction sync failed:", err);
          });
        }
      } catch (error) {
        console.error("Transaction save error:", error);

        showToast("Could not save transactions.", "error");
      }
    },

    loadSettings() {
      try {
        const raw = localStorage.getItem(this.settingsKey());

        const parsed = raw ? JSON.parse(raw) : {};

        return {
          ...DEFAULT_SETTINGS,
          ...parsed,
        };
      } catch (error) {
        console.error("Settings loading error:", error);

        return {
          ...DEFAULT_SETTINGS,
        };
      }
    },

    saveSettings(settings) {
      try {
        localStorage.setItem(this.settingsKey(), JSON.stringify(settings));

        renderNotificationPanel();
      } catch (error) {
        console.error("Settings save error:", error);
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
          JSON.stringify(features),
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
        const raw = localStorage.getItem(this.alertsKey());

        const parsed = raw ? JSON.parse(raw) : {};

        return parsed && typeof parsed === "object" && !Array.isArray(parsed)
          ? parsed
          : {};
      } catch (error) {
        return {};
      }
    },

    saveAlerts(alerts) {
      try {
        localStorage.setItem(this.alertsKey(), JSON.stringify(alerts));
      } catch (error) {
        console.error(error);
      }
    },

    loadProfile() {
      try {
        const raw = localStorage.getItem(this.profileKey());

        if (!raw) {
          return {
            name: "",
            firstName: "",
            middleName: "",
            lastName: "",
            age: "",
            phone: "",
          };
        }

        const parsed = JSON.parse(raw);

        return {
          name: parsed.name || "",
          firstName: parsed.firstName || "",
          middleName: parsed.middleName || "",
          lastName: parsed.lastName || "",
          age: parsed.age || "",
          phone: parsed.phone || "",
        };
      } catch (error) {
        console.error("Profile loading error:", error);

        return {
          name: "",
          firstName: "",
          middleName: "",
          lastName: "",
          age: "",
          phone: "",
        };
      }
    },

    saveProfile(profile) {
      try {
        localStorage.setItem(this.profileKey(), JSON.stringify(profile));

        return true;
      } catch (error) {
        console.error("Profile save error:", error);

        return false;
      }
    },
  };

  // ======================================================
  // Supabase transaction sync helpers
  // - keep localStorage as primary offline store
  // - attempt to upsert all local transactions when online
  // ======================================================

  async function upsertTransactionsToSupabase(list) {
    if (
      !supabaseClient ||
      !connection.isOnline() ||
      !state.user ||
      !state.user.id
    )
      return false;

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
        money_source: getTransactionMoneySource(tx),
        count_as_savings: transactionCountsAsSavings(tx),
        savings_bucket:
          tx.type === "expense" && getTransactionMoneySource(tx) === "savings"
            ? tx.savingsBucket || tx.savings_bucket || null
            : null,
        savings_platform:
          tx.type === "expense" && getTransactionMoneySource(tx) === "savings"
            ? tx.savingsPlatform || tx.savings_platform || null
            : null,
        savings_platform_name:
          tx.type === "expense" && getTransactionMoneySource(tx) === "savings"
            ? tx.savingsPlatformName || tx.savings_platform_name || null
            : null,
        income_source:
          tx.type === "income"
            ? normalizeIncomeSource(tx.incomeSource ?? tx.income_source)
            : null,
        income_source_name:
          tx.type === "income" &&
          normalizeIncomeSource(tx.incomeSource ?? tx.income_source) === "other"
            ? normalizeIncomeSourceName(
                tx.incomeSourceName ?? tx.income_source_name,
              ) || null
            : null,
        note: tx.note || null,
        created_at: tx.createdAt
          ? new Date(tx.createdAt).toISOString()
          : new Date().toISOString(),
      }));

      if (rows.length === 0) return true;

      const { data, error } = await supabaseClient
        .from("transactions")
        .upsert(rows, { onConflict: "id" })
        .select();

      if (error) {
        if (!connection.handleError(error)) {
          console.warn("Supabase upsert error:", error);
        }
        return false;
      }

      return Boolean(data);
    } catch (error) {
      connection.handleError(error);
      throw error;
    }
  }

  async function fetchRemoteTransactions() {
    if (
      !supabaseClient ||
      !connection.isOnline() ||
      !state.user ||
      !state.user.id
    )
      return [];

    try {
      const { data, error } = await supabaseClient
        .from("transactions")
        .select("*")
        .eq("user_id", state.user.id)
        .order("created_at", { ascending: true });

      if (error) {
        if (!connection.handleError(error)) {
          console.warn("Supabase fetch error:", error);
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
          title: r.title || "",
          category: r.category || "Other",
          date: r.date ? String(r.date).slice(0, 10) : todayISO(),
          paymentMethod: r.payment_method || r.paymentMethod || "UPI",
          moneySource: normalizeMoneySource(
            r.type,
            r.money_source || r.moneySource,
            r.payment_method || r.paymentMethod,
          ),
          countAsSavings:
            r.type === "income" &&
            (r.count_as_savings === true || r.countAsSavings === true),
          savingsBucket:
            r.savings_bucket || r.savingsBucket
              ? normalizeSavingsBucket(r.savings_bucket || r.savingsBucket)
              : null,
          savingsPlatform:
            r.savings_platform || r.savingsPlatform
              ? normalizeSavingsPlatform(
                  r.savings_platform || r.savingsPlatform,
                )
              : null,
          savingsPlatformName: String(
            r.savings_platform_name || r.savingsPlatformName || "",
          )
            .trim()
            .slice(0, 60),
          incomeSource:
            r.type === "income"
              ? normalizeIncomeSource(r.income_source || r.incomeSource)
              : null,
          incomeSourceName:
            r.type === "income"
              ? normalizeIncomeSourceName(
                  r.income_source_name || r.incomeSourceName,
                )
              : "",
          note: r.note || "",
          createdAt: r.created_at ? Date.parse(r.created_at) : Date.now(),
        });
        changed = true;
      }
    });

    if (changed) {
      Store.saveTransactions(state.transactions);
      renderCurrentPage();
    }
  }

  async function deleteTransactionFromSupabase(id) {
    if (
      !supabaseClient ||
      !connection.isOnline() ||
      !state.user ||
      !state.user.id
    )
      return false;

    try {
      const { error } = await supabaseClient
        .from("transactions")
        .delete()
        .eq("id", id)
        .eq("user_id", state.user.id);

      if (error && !connection.handleError(error)) {
        console.warn("Supabase delete error:", error);
      }
      return !error;
    } catch (err) {
      connection.handleError(err);
      return false;
    }
  }

  async function syncTransactionsToSupabase(list = state.transactions) {
    if (!supabaseClient || !connection.isOnline() || !state.user?.id)
      return false;

    for (const id of Store.loadPendingTransactionDeletes()) {
      const deleted = await deleteTransactionFromSupabase(id);
      if (!deleted) return false;
      Store.clearPendingTransactionDelete(id);
    }

    return upsertTransactionsToSupabase(list);
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

    const { error } = await supabaseClient.from("student_features").upsert(
      {
        user_id: state.user.id,
        payload: state.studentFeatures,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
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
    state.studentFeatures = Store.loadStudentFeatures();

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
          "warning",
        );
      }
      return;
    }

    if (error) {
      if (!connection.handleError(error)) {
        console.warn("Student tools cloud load failed:", error);
        showToast(
          "Student tools are available on this device. Apply the Student Tools Supabase migration to sync them across devices.",
          "warning",
        );
      }
      return;
    }

    if (data?.payload) {
      if (Store.hasPendingStudentFeaturesSync()) {
        await persistStudentFeatures(false);
        return;
      }
      state.studentFeatures = normalizeStudentFeatures(data.payload);
      Store.saveStudentFeatures(state.studentFeatures);
      return;
    }

    await persistStudentFeatures(false);
  }

  async function persistStudentFeatures(
    showSyncError = true,
    localAlreadySaved = false,
  ) {
    if (
      !localAlreadySaved &&
      !Store.saveStudentFeatures(state.studentFeatures)
    ) {
      return false;
    }

    renderNotificationPanel();

    if (!connection.isOnline()) {
      Store.setPendingStudentFeaturesSync(true);
      return true;
    }

    try {
      const synced = await syncStudentFeaturesToSupabase();
      Store.setPendingStudentFeaturesSync(!synced);
      if (!synced && showSyncError && connection.isOnline()) {
        showToast(
          "Saved on this device, but cloud sync failed. It will retry when the connection is restored.",
          "warning",
        );
      }
      return synced;
    } catch (error) {
      Store.setPendingStudentFeaturesSync(true);
      console.warn("Student tools cloud save failed:", error);
      if (showSyncError) {
        showToast(
          "Saved on this device, but cloud sync failed. Check your Supabase Student Tools migration and connection.",
          "warning",
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
      Math.random().toString(36).slice(2, 9)
    );
  }

  function escapeHtml(value) {
    const div = document.createElement("div");

    div.textContent = String(value ?? "");

    return div.innerHTML;
  }

  function formatCurrency(amount) {
    const number = Math.round((Number(amount) || 0) * 100) / 100;

    return (
      "₹" +
      number.toLocaleString("en-IN", {
        maximumFractionDigits: number % 1 === 0 ? 0 : 2,
      })
    );
  }

  function startOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  function monthKey(date) {
    return (
      date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0")
    );
  }

  function txMonthKey(tx) {
    return tx && typeof tx.date === "string" && tx.date.length >= 7
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
    return MONTH_NAMES[date.getMonth()] + " " + date.getFullYear();
  }

  function formatDateDisplay(dateString) {
    if (!dateString) return "";

    const parts = dateString.split("-");

    if (parts.length === 3) {
      const date = new Date(
        Number(parts[0]),
        Number(parts[1]) - 1,
        Number(parts[2]),
      );

      return date.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    }

    return dateString;
  }

  function clamp(number, min, max) {
    return Math.max(min, Math.min(max, number));
  }

  function isReducedMotion() {
    return (
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  function cssVar(name) {
    return getComputedStyle(document.documentElement)
      .getPropertyValue(name)
      .trim();
  }

  function initials(name) {
    if (!name) return "?";

    return String(name).trim().charAt(0).toUpperCase();
  }

  function categoryMeta(name) {
    return (
      ALL_CATEGORIES.find(
        (category) =>
          category.name.toLowerCase() === String(name || "").toLowerCase(),
      ) || {
        name: name || "Other",
        color: "#94a3b8",
      }
    );
  }

  function animateValue(
    element,
    endValue,
    formatter = (n) => String(Math.round(n)),
  ) {
    if (!element) return;

    if (isReducedMotion()) {
      element.textContent = formatter(endValue);
      element.dataset.rawValue = String(endValue);
      return;
    }

    const startValue = Number(element.dataset.rawValue || 0);
    if (startValue === endValue) {
      element.textContent = formatter(endValue);
      return;
    }

    // সংখ্যা পৰিৱৰ্তন হ'লে পপ এনিমেচন লগাব
    element.classList.remove("is-updating");
    void element.offsetWidth; // Force Reflow
    element.classList.add("is-updating");

    const start = performance.now();
    const duration = 600; // ০.৬ ছেকেণ্ডৰ ৰোলিং সময়

    function frame(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);

      // Smooth Quintic Easing
      const eased = 1 - Math.pow(1 - progress, 5);
      const current = startValue + (endValue - startValue) * eased;

      element.textContent = formatter(current);

      if (progress < 1) {
        requestAnimationFrame(frame);
      } else {
        element.textContent = formatter(endValue);
        element.dataset.rawValue = String(endValue);
      }
    }

    requestAnimationFrame(frame);
  }

  /* =======================================================
     PROFILE
  ======================================================= */

  function normalizeProfileName(value) {
    return String(value || "")
      .replace(/[^A-Za-z]+/g, " ")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(" ");
  }

  function normalizeProfileNameInput(value) {
    const raw = String(value || "");
    const keepTrailingSpace = /[\s\d\W]$/.test(raw);
    const formatted = normalizeProfileName(raw);
    return keepTrailingSpace && formatted ? `${formatted} ` : formatted;
  }

  function getProfileNameParts() {
    const firstName =
      typeof state.profile.firstName === "string"
        ? normalizeProfileName(state.profile.firstName)
        : "";
    const middleName =
      typeof state.profile.middleName === "string"
        ? normalizeProfileName(state.profile.middleName)
        : "";
    const lastName =
      typeof state.profile.lastName === "string"
        ? normalizeProfileName(state.profile.lastName)
        : "";

    if (firstName || middleName || lastName) {
      return { firstName, middleName, lastName };
    }

    const legacyParts = normalizeProfileName(state.profile.name)
      .split(/\s+/)
      .filter(Boolean);

    if (legacyParts.length >= 3) {
      return {
        firstName: legacyParts[0],
        middleName: legacyParts.slice(1, -1).join(" "),
        lastName: legacyParts[legacyParts.length - 1],
      };
    }

    return {
      firstName: legacyParts[0] || "",
      middleName: "",
      lastName: legacyParts[1] || "",
    };
  }

  function normalizeSavedProfileName() {
    const parts = getProfileNameParts();
    state.profile = {
      ...state.profile,
      firstName: parts.firstName,
      middleName: parts.middleName,
      lastName: parts.lastName,
      name: [parts.firstName, parts.middleName, parts.lastName]
        .filter(Boolean)
        .join(" "),
    };
    return parts;
  }

  function getProfileFullName() {
    const { firstName, middleName, lastName } = getProfileNameParts();

    return [firstName, middleName, lastName].filter(Boolean).join(" ");
  }

  function formatProfileNameForGreeting(name) {
    return normalizeProfileName(name);
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

      state.profile = Store.loadProfile();
      let remoteProfileName = null;
      let profileRecord = null;

      /*
        If local profile is empty but Supabase
        already contains user metadata, use it.
      */

      if (!state.profile.name) {
        state.profile.name =
          user.user_metadata?.full_name || user.user_metadata?.name || "";
      }

      if (!state.profile.firstName) {
        state.profile.firstName = user.user_metadata?.first_name || "";
      }

      if (!state.profile.middleName) {
        state.profile.middleName = user.user_metadata?.middle_name || "";
      }

      if (!state.profile.lastName) {
        state.profile.lastName = user.user_metadata?.last_name || "";
      }

      if (!state.profile.age) {
        state.profile.age = user.user_metadata?.age || "";
      }

      if (!state.profile.phone) {
        state.profile.phone = user.user_metadata?.phone || "";
      }

      if (connection.isOnline()) {
        let profileLoadError = null;

        try {
          const result = await supabaseClient
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
              "error",
            );
          }
        } else if (profileRecord && profileRecord.id !== user.id) {
          console.error("Supabase returned a profile for a different user.");
          showToast(
            "Could not load your profile because the returned user did not match your account.",
            "error",
          );
        } else if (profileRecord) {
          remoteProfileName =
            typeof profileRecord.name === "string" ? profileRecord.name : "";
          state.profile = {
            ...state.profile,
            name: profileRecord.name || "",
            firstName: "",
            middleName: "",
            lastName: "",
            age: profileRecord.age == null ? "" : String(profileRecord.age),
            phone: profileRecord.phone || "",
          };
        }
      }

      const profileNameParts = normalizeSavedProfileName();
      const cleanedProfileName = state.profile.name;
      if (!Store.saveProfile(state.profile)) {
        showToast(
          "Your cleaned profile name could not be saved on this device.",
          "warning",
        );
      }

      if (
        remoteProfileName !== null &&
        remoteProfileName !== cleanedProfileName &&
        connection.isOnline()
      ) {
        try {
          const { data: cleanedProfile, error: cleanupError } =
            await supabaseClient
              .from("profiles")
              .update({
                name: cleanedProfileName,
                updated_at: new Date().toISOString(),
              })
              .eq("id", user.id)
              .select("id, name")
              .maybeSingle();

          if (cleanupError) {
            throw cleanupError;
          }

          if (
            !cleanedProfile ||
            cleanedProfile.id !== user.id ||
            cleanedProfile.name !== cleanedProfileName
          ) {
            console.error("Supabase did not confirm the cleaned profile name.");
            showToast(
              "Your profile name was cleaned on this device but could not be confirmed in Supabase.",
              "warning",
            );
          }
        } catch (error) {
          if (!connection.handleError(error)) {
            console.error("Supabase profile name cleanup failed:", error);
            showToast(
              "Your profile name was cleaned on this device but could not be saved to Supabase.",
              "warning",
            );
          }
        }
      }

      const email = user.email || "";

      const firstNameInput = document.getElementById("profileFirstName");

      const middleNameInput = document.getElementById("profileMiddleName");

      const lastNameInput = document.getElementById("profileLastName");

      const ageInput = document.getElementById("profileAge");

      const phoneInput = document.getElementById("profilePhone");

      const emailInput = document.getElementById("profileEmail");

      const displayName = document.getElementById("profileDisplayName");

      const displayEmail = document.getElementById("profileDisplayEmail");

      if (firstNameInput) firstNameInput.value = profileNameParts.firstName;
      if (middleNameInput) middleNameInput.value = profileNameParts.middleName;
      if (lastNameInput) lastNameInput.value = profileNameParts.lastName;

      if (ageInput) {
        ageInput.value = state.profile.age;
      }

      if (phoneInput) {
        phoneInput.value = indianMobileInputValue(state.profile.phone);
      }

      if (emailInput) {
        emailInput.value = email;
      }

      if (displayName) {
        displayName.textContent = getProfileFullName() || "Student";
      }

      if (displayEmail) {
        displayEmail.textContent = email;
      }

      return true;
    } catch (error) {
      if (connection.handleError(error)) {
        return Boolean(state.user);
      }

      console.error("Profile initialization error:", error);

      return false;
    }
  }

  function isProfileComplete() {
    const { firstName, lastName } = getProfileNameParts();
    const age = Number(state.profile.age);

    return (
      firstName.length > 0 &&
      lastName.length > 0 &&
      Number.isInteger(age) &&
      age >= 13 &&
      age <= 100 &&
      normalizeIndianMobileNumber(state.profile.phone) !== null
    );
  }

  function closeActiveModals(exceptOverlay = null) {
    document
      .querySelectorAll(
        ".modal-overlay.is-open, .reminder-overlay:not([hidden])",
      )
      .forEach((overlay) => {
        if (overlay === exceptOverlay) return;

        switch (overlay.id) {
          case "txModalOverlay":
            closeModal();
            break;
          case "confirmOverlay":
            closeConfirm();
            break;
          case "budgetWarningOverlay":
            closeBudgetWarning();
            break;
          case "savingsOperationOverlay":
            closeSavingsOperationModal();
            break;
          case "dailyReminderPopup":
            closeDailyReminderPopup();
            break;
          default:
            overlay.classList.remove("is-open");
            overlay.setAttribute("aria-hidden", "true");
            if (overlay.classList.contains("reminder-overlay")) {
              overlay.hidden = true;
            }
        }
      });
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
      showToast("User session not found.", "error");

      return;
    }

    const firstNameInput = document.getElementById("profileFirstName");

    const middleNameInput = document.getElementById("profileMiddleName");

    const lastNameInput = document.getElementById("profileLastName");

    const ageInput = document.getElementById("profileAge");

    const phoneInput = document.getElementById("profilePhone");
    const customStudentTypeInput = document.getElementById(
      "profileCustomStudentType",
    );

    const firstName = normalizeProfileName(firstNameInput?.value);
    const middleName = normalizeProfileName(middleNameInput?.value);
    const lastName = normalizeProfileName(lastNameInput?.value);

    if (firstNameInput) firstNameInput.value = firstName;
    if (middleNameInput) middleNameInput.value = middleName;
    if (lastNameInput) lastNameInput.value = lastName;
    const name = [firstName, middleName, lastName].filter(Boolean).join(" ");

    const age = ageInput?.value.trim() || "";

    const phone = normalizeIndianMobileNumber(phoneInput?.value || "");

    if (!firstName || !lastName) {
      showToast("Please enter your first and last name.", "error");

      if (!firstName) {
        firstNameInput?.focus();
      } else {
        lastNameInput?.focus();
      }

      return;
    }

    if (age) {
      const ageNumber = Number(age);

      if (!Number.isInteger(ageNumber) || ageNumber < 13 || ageNumber > 100) {
        showToast("Please enter a valid age between 13 and 100.", "error");

        ageInput?.focus();

        return;
      }
    } else {
      showToast("Please enter your age to complete your profile.", "error");

      ageInput?.focus();

      return;
    }

    if (phone === null) {
      showToast(
        "Enter your 10-digit Indian mobile number starting with 6–9.",
        "error",
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
      phone,
    };
    const studentMode =
      document.getElementById("profileStudentMode")?.value || "";
    const customStudentType = normalizeProfileName(
      customStudentTypeInput?.value,
    ).slice(0, 60);

    if (customStudentTypeInput) {
      customStudentTypeInput.value = customStudentType;
    }
    if (studentMode === "other" && !customStudentType) {
      showToast("Please enter your student type.", "error");
      customStudentTypeInput?.focus();
      return;
    }

    if (saveButton) {
      saveButton.dataset.loading = "true";
      saveButton.disabled = true;
      saveButton.textContent = "Saving profile...";
    }

    try {
      const {
        data: { user },
        error: userError,
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
        updated_at: new Date().toISOString(),
      };

      const { data: savedProfile, error } = await supabaseClient
        .from("profiles")
        .upsert(profileData, { onConflict: "id" })
        .select("id, name, age, phone")
        .single();

      if (error) {
        throw error;
      }

      if (!savedProfile || savedProfile.id !== user.id) {
        throw new Error(
          "Supabase did not return the saved profile for this user.",
        );
      }

      state.profile = {
        ...updatedProfile,
        name: savedProfile.name || "",
        firstName,
        middleName,
        lastName,
        age: savedProfile.age == null ? "" : String(savedProfile.age),
        phone: savedProfile.phone || "",
      };

      document.getElementById("profileAge").value = state.profile.age;
      document.getElementById("profilePhone").value = indianMobileInputValue(
        state.profile.phone,
      );

      Store.saveProfile(state.profile);
      state.studentFeatures.studentMode = studentMode;
      state.studentFeatures.customStudentType = customStudentType;
      updateCustomStudentTypeVisibility();
      renderStudentMode();
      await persistStudentFeatures();
    } catch (error) {
      if (connection.handleError(error)) {
        return;
      }

      console.error("Supabase profile save failed:", error);
      showToast(
        `Could not save your profile to Supabase: ${error.message || "Please check your connection and database policies."}`,
        "error",
      );
      return;
    } finally {
      if (saveButton) {
        saveButton.dataset.loading = "false";
        saveButton.disabled = false;
        saveButton.textContent = "Save Profile";
      }
    }

    const displayName = document.getElementById("profileDisplayName");

    if (displayName) {
      displayName.textContent = getProfileFullName();
    }

    showToast("Profile updated successfully!", "success");
  }

  function normalizeIndianMobileNumber(value) {
    const input = value.trim();

    if (!input) return null;

    const match = input.match(/^(?:\+91[\s-]?)?([6-9]\d{9})$/);

    return match ? `+91${match[1]}` : null;
  }

  function indianMobileInputValue(value) {
    const match = String(value || "")
      .trim()
      .match(/^(?:\+91[\s-]?)?([6-9]\d{9})$/);

    return match ? match[1] : "";
  }

  function clearCurrentUserMemory() {
    state.user = null;
    state.transactions = [];
    state.profile = {
      name: "",
      firstName: "",
      middleName: "",
      lastName: "",
      age: "",
      phone: "",
    };
    state.settings = { ...DEFAULT_SETTINGS };
    state.studentFeatures = {
      ...DEFAULT_STUDENT_FEATURES,
      categoryBudgets: {},
      savingsGoals: [],
      paymentReminders: [],
    };
  }

  async function logoutUser() {
    openConfirm(
      "Are you sure you want to log out?",
      async function () {
        if (!supabaseClient) {
          closeConfirm();
          clearCurrentUserMemory();
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

          clearCurrentUserMemory();
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
        cancelText: "Cancel",
      },
    );
  }

  function renderProfilePage() {
    if (!state.user) return;

    const firstNameInput = document.getElementById("profileFirstName");

    const middleNameInput = document.getElementById("profileMiddleName");

    const lastNameInput = document.getElementById("profileLastName");

    const ageInput = document.getElementById("profileAge");

    const phoneInput = document.getElementById("profilePhone");

    const emailInput = document.getElementById("profileEmail");

    const displayName = document.getElementById("profileDisplayName");

    const displayEmail = document.getElementById("profileDisplayEmail");

    const nameParts = getProfileNameParts();
    if (firstNameInput) firstNameInput.value = nameParts.firstName;
    if (middleNameInput) middleNameInput.value = nameParts.middleName;
    if (lastNameInput) lastNameInput.value = nameParts.lastName;

    if (ageInput) {
      ageInput.value = state.profile.age || "";
    }

    if (phoneInput) {
      phoneInput.value = indianMobileInputValue(state.profile.phone);
    }

    const studentModeInput = document.getElementById("profileStudentMode");
    if (studentModeInput) {
      populateStudentTypeOptions(studentModeInput);
      studentModeInput.value = state.studentFeatures.studentMode;
    }
    const customStudentTypeInput = document.getElementById(
      "profileCustomStudentType",
    );
    if (customStudentTypeInput) {
      customStudentTypeInput.value = state.studentFeatures.customStudentType;
    }
    updateCustomStudentTypeVisibility();

    if (emailInput) {
      emailInput.value = state.user.email || "";
    }

    if (displayName) {
      displayName.textContent = getProfileFullName() || "Student";
    }

    if (displayEmail) {
      displayEmail.textContent = state.user.email || "";
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

    return "studentspend_" + state.user.id + "_reminder_shown";
  }

  /*
    Check whether today's timed reminder
    has already been displayed.
  */
  function hasShownReminderToday() {
    try {
      return localStorage.getItem(reminderShownKey()) === reminderTodayKey();
    } catch (error) {
      return false;
    }
  }

  /*
    Mark today's timed reminder as shown.
  */
  function markReminderShownToday() {
    try {
      localStorage.setItem(reminderShownKey(), reminderTodayKey());
    } catch (error) {
      console.warn("Could not save reminder state:", error);
    }
  }

  /*
    Display reminder popup.
  */
  function showDailyReminderPopup(reason = "daily") {
    const overlay = document.getElementById("dailyReminderPopup");

    const message = document.getElementById("dailyReminderPopupMessage");

    if (!overlay) return;

    closeActiveModals(overlay);

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

    overlay.setAttribute("aria-hidden", "false");
  }

  /*
    Close reminder popup.
  */
  function closeDailyReminderPopup() {
    const overlay = document.getElementById("dailyReminderPopup");

    if (!overlay) return;

    overlay.hidden = true;

    overlay.setAttribute("aria-hidden", "true");
  }

  /*
    Render reminder controls inside Profile.
  */
  function renderReminderSettings() {
    const enabled = document.getElementById("dailyReminderEnabled");

    const time = document.getElementById("dailyReminderTime");

    const status = document.getElementById("reminderStatusText");

    if (enabled) {
      enabled.checked = Boolean(state.settings.reminderEnabled);
    }

    if (time) {
      time.value = state.settings.reminderTime || "20:00";
    }

    if (status) {
      if (state.settings.reminderEnabled) {
        const selectedTime = state.settings.reminderTime || "20:00";

        status.textContent = `Reminder is ON. You will be reminded every day at ${formatReminderTime(selectedTime)}.`;
      } else {
        status.textContent = "Reminder is currently disabled.";
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

    const parts = timeValue.split(":");

    if (parts.length < 2) {
      return timeValue;
    }

    let hours = Number(parts[0]);

    const minutes = parts[1];

    if (!Number.isFinite(hours)) {
      return timeValue;
    }

    const suffix = hours >= 12 ? "PM" : "AM";

    hours = hours % 12 || 12;

    return `${hours}:${minutes} ${suffix}`;
  }

  /*
    Save reminder settings.
  */
  function saveReminderSettings() {
    const enabledInput = document.getElementById("dailyReminderEnabled");

    const timeInput = document.getElementById("dailyReminderTime");

    const status = document.getElementById("reminderSaveStatus");

    if (!enabledInput || !timeInput) {
      return;
    }

    const enabled = enabledInput.checked;

    const time = timeInput.value;

    if (enabled && !time) {
      showToast("Please select a reminder time.", "error");

      timeInput.focus();

      return;
    }

    state.settings.reminderEnabled = enabled;

    state.settings.reminderTime = time || "20:00";

    Store.saveSettings(state.settings);

    renderReminderSettings();

    if (status) {
      status.textContent = "Reminder saved ✓";

      setTimeout(() => {
        if (status) {
          status.textContent = "";
        }
      }, 3000);
    }

    showToast(
      enabled
        ? `Daily reminder set for ${formatReminderTime(state.settings.reminderTime)}.`
        : "Daily reminder disabled.",
      "success",
    );

    startReminderChecker();
  }

  /*
    Check current time every 30 seconds.
  */
  function checkDailyReminder() {
    if (!state.user) return;

    if (!state.settings.reminderEnabled) {
      return;
    }

    const reminderTime = state.settings.reminderTime;

    if (!reminderTime) return;

    const now = new Date();

    const currentHours = String(now.getHours()).padStart(2, "0");

    const currentMinutes = String(now.getMinutes()).padStart(2, "0");

    const currentTime = `${currentHours}:${currentMinutes}`;

    /*
      Only show once per day.
    */
    if (currentTime === reminderTime && !hasShownReminderToday()) {
      markReminderShownToday();

      showDailyReminderPopup("daily");
    }
  }

  /*
    Start / restart reminder timer.
  */
  function startReminderChecker() {
    if (reminderTimer) {
      clearInterval(reminderTimer);

      reminderTimer = null;
    }

    if (!state.settings.reminderEnabled) {
      return;
    }

    /*
      Check immediately.
    */
    checkDailyReminder();

    /*
      Then check every 30 seconds.
    */
    reminderTimer = setInterval(checkDailyReminder, 30000);
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

    const sessionKey = "studentspend_login_reminder_" + state.user.id;

    try {
      if (sessionStorage.getItem(sessionKey) === "shown") {
        return;
      }

      sessionStorage.setItem(sessionKey, "shown");

      /*
        Small delay so the dashboard
        finishes loading first.
      */
      setTimeout(() => {
        showDailyReminderPopup("login");
      }, 700);
    } catch (error) {
      setTimeout(() => showDailyReminderPopup("login"), 700);
    }
  }

  /* =======================================================
     TOAST
  ======================================================= */

  function showToast(message, kind = "info") {
    const stack = document.getElementById("toastStack");

    if (!stack) return;

    const toast = document.createElement("div");

    toast.className = `toast toast-${kind}`;

    toast.setAttribute("role", "status");

    const messageSpan = document.createElement("span");

    messageSpan.textContent = message;

    toast.appendChild(messageSpan);

    const progress = document.createElement("div");

    progress.className = "toast-progress";

    progress.style.animationDuration = "3200ms";

    toast.appendChild(progress);

    stack.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";

      toast.style.transform = "translateX(36px)";

      toast.style.transition = "opacity .25s ease, transform .25s ease";

      setTimeout(() => toast.remove(), 260);
    }, 3200);
  }

  /* =======================================================
     CONFIRM DIALOG
  ======================================================= */

  function openConfirm(message, onConfirm, options = {}) {
    const messageEl = document.getElementById("confirmMessage");

    const overlay = document.getElementById("confirmOverlay");

    const confirmBtn = document.getElementById("confirmOk");

    const cancelBtn = document.getElementById("confirmCancel");

    if (messageEl) {
      messageEl.textContent = message;
    }

    if (confirmBtn) {
      confirmBtn.textContent = options.confirmText || "Confirm";
    }

    if (cancelBtn) {
      cancelBtn.textContent = options.cancelText || "Cancel";
    }

    closeActiveModals(overlay);
    state.confirmAction = onConfirm;

    if (overlay) {
      overlay.classList.add("is-open");

      overlay.setAttribute("aria-hidden", "false");
    }
  }

  function closeConfirm() {
    const overlay = document.getElementById("confirmOverlay");

    if (overlay) {
      overlay.classList.remove("is-open");

      overlay.setAttribute("aria-hidden", "true");
    }

    const confirmBtn = document.getElementById("confirmOk");
    if (confirmBtn) {
      confirmBtn.textContent = "Confirm";
    }

    state.confirmAction = null;
  }

  /* =======================================================
     TRANSACTION HELPERS
  ======================================================= */

  function txForMonth(date) {
    const key = monthKey(date);

    return state.transactions.filter(
      (transaction) => txMonthKey(transaction) === key,
    );
  }

  function sumByType(list, type) {
    return list
      .filter((transaction) => transaction.type === type)
      .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
  }

  function categoryTotals(list, type) {
    const totals = {};

    list
      .filter((transaction) => transaction.type === type)
      .forEach((transaction) => {
        const category = transaction.category || "Other";

        totals[category] =
          (totals[category] || 0) + Number(transaction.amount || 0);
      });

    return totals;
  }

  function updateNavBadge() {
    const badge = document.getElementById("navTxBadge");

    if (badge) {
      badge.textContent = String(state.transactions.length);
    }
  }

  /* =======================================================
     NAVIGATION
  ======================================================= */

  const PAGE_META = {
    dashboard: {
      title: "Dashboard",
      desc: "Your financial health at a glance",
    },

    transactions: {
      title: "Transactions",
      desc: "Search, filter, edit, and organize every expense",
    },

    reports: {
      title: "Reports & Analytics",
      desc: "Category breakdowns and monthly spending trends",
    },

    budget: {
      title: "Budget",
      desc: "Monthly and category limits, usage, and spending alerts",
    },

    savings: {
      title: "Savings Dashboard",
      desc: "Manage your savings balance, activity, and goals",
    },

    calendar: {
      title: "Expense Calendar",
      desc: "Explore daily expenses from your transaction history",
    },

    challenges: {
      title: "No-Spend Challenges",
      desc: "Set a personal spending challenge and track progress",
    },

    payments: {
      title: "Payment Reminders",
      desc: "Organize upcoming, due, overdue, and completed payments",
    },

    settings: {
      title: "Settings & Backups",
      desc: "Preferences, monthly budget target, and data exports",
    },

    about: {
      title: "About & Help",
      desc: "Learn how StudentSpend works and how to get the most from it",
    },

    profile: {
      title: "My Profile",
      desc: "Manage your name, age, email, and profile picture",
    },
  };

  function switchPage(page, pushHistory = true) {
    if (!PAGE_META[page]) return;

    state.currentPage = page;

    if (pushHistory) {
      history.pushState({ page: page }, "", "#" + page);
    }

    document
      .querySelectorAll(".page")
      .forEach((element) => element.classList.remove("is-active"));

    const activePage = document.getElementById("page-" + page);

    if (activePage) {
      activePage.classList.add("is-active");

      // কাৰ্ডৰ এনিমেচন ৰিচেট কৰা যাতে প্ৰতিবাৰ পেজ সলনি হ'লে এনিমেট হয়
      activePage.querySelectorAll(".panel, .summary-card").forEach((card) => {
        card.style.animation = "none";
        void card.offsetHeight; // reflow trigger
        card.style.animation = "";
      });
    }

    document.querySelectorAll(".nav-item").forEach((element) => {
      element.classList.toggle("is-active", element.dataset.page === page);
    });

    const title = document.getElementById("pageTitle");

    const desc = document.getElementById("pageDesc");

    if (title) {
      title.textContent = PAGE_META[page].title;
    }

    if (desc) {
      desc.textContent = PAGE_META[page].desc;
    }

    closeSidebarMobile();

    renderCurrentPage();

    window.scrollTo({
      top: 0,
      behavior: isReducedMotion() ? "auto" : "smooth",
    });
  }

  function closeSidebarMobile() {
    document.getElementById("sidebar")?.classList.remove("is-open");

    document.getElementById("sidebarOverlay")?.classList.remove("is-open");
  }

  function buildNotifications() {
    const notifications = [];
    const today = todayISO();

    state.studentFeatures.paymentReminders
      .filter((reminder) => !reminder.completed)
      .forEach((reminder) => {
        const dueDate = String(reminder.dueDate || "");
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return;
        const [year, month, day] = dueDate.split("-").map(Number);
        const [todayYear, todayMonth, todayDay] = today.split("-").map(Number);
        const daysUntilDue = Math.round(
          (Date.UTC(year, month - 1, day) -
            Date.UTC(todayYear, todayMonth - 1, todayDay)) /
            86400000,
        );
        if (daysUntilDue > 7) return;

        const overdue = daysUntilDue < 0;
        const dueText = overdue
          ? `${Math.abs(daysUntilDue)} day${Math.abs(daysUntilDue) === 1 ? "" : "s"} overdue`
          : daysUntilDue === 0
            ? "Due today"
            : `Due in ${daysUntilDue} day${daysUntilDue === 1 ? "" : "s"}`;
        const displayName =
          reminder.kind === "repayment"
            ? reminder.personName || reminder.name
            : reminder.name;
        notifications.push({
          id: `payment:${reminder.id}:${dueDate}`,
          title:
            reminder.kind === "repayment"
              ? "Upcoming repayment"
              : "Upcoming payment",
          message: `${displayName} · ${formatCurrency(reminder.amount)} · ${dueText}`,
          icon: reminder.kind === "repayment" ? "↗" : "₹",
          tone: overdue ? "danger" : daysUntilDue <= 2 ? "warning" : "info",
          page: "payments",
          priority: overdue ? 0 : 1,
          sortDate: dueDate,
        });
      });

    const monthId = monthKey(new Date());
    getSmartBudgetMessages().forEach((message) => {
      if (message.type === "good") return;
      if (message.text.startsWith("Today's spending")) {
        notifications.push({
          id: `spending:${today}`,
          title: "Spending alert",
          message: message.text,
          icon: "↗",
          tone: message.type,
          page: "transactions",
          priority: 4,
        });
      } else if (message.text.toLowerCase().includes("budget")) {
        notifications.push({
          id: `budget:${monthId}:${message.text}`,
          title:
            message.type === "danger"
              ? "Budget limit reached"
              : "Budget warning",
          message: message.text,
          icon: "!",
          tone: message.type,
          page: "budget",
          priority: message.type === "danger" ? 2 : 3,
        });
      }
    });

    state.studentFeatures.savingsGoals.forEach((goal) => {
      const target = Number(goal.target);
      const saved = Number(goal.saved);
      if (target <= 0 || saved <= 0) return;
      const percent = Math.min(100, Math.max(0, (saved / target) * 100));
      const milestone = percent >= 100 ? 100 : Math.floor(percent / 25) * 25;
      notifications.push({
        id: `savings:${goal.id}:${milestone || "started"}`,
        title:
          percent >= 100 ? "Savings goal reached" : "Savings goal progress",
        message: `${goal.name} · ${Math.round(percent)}% saved (${formatCurrency(saved)} of ${formatCurrency(target)})`,
        icon: percent >= 100 ? "✓" : "◎",
        tone: percent >= 100 ? "good" : "info",
        page: "savings",
        priority: 5,
      });
    });

    const currentMonthTransactions = txForMonth(new Date());
    const monthlyIncome = sumByType(currentMonthTransactions, "income");
    const monthlyExpense = sumByType(currentMonthTransactions, "expense");
    notifications.push({
      id: `monthly-summary:${monthId}`,
      title: "Monthly summary",
      message: `${formatMonthLabel(new Date())} · ${currentMonthTransactions.length} transaction${currentMonthTransactions.length === 1 ? "" : "s"} · ${formatCurrency(monthlyIncome)} income · ${formatCurrency(monthlyExpense)} expenses`,
      icon: "Σ",
      tone: "info",
      page: "reports",
      priority: 6,
    });

    return notifications.sort(
      (a, b) =>
        a.priority - b.priority ||
        String(a.sortDate || "").localeCompare(String(b.sortDate || "")) ||
        a.title.localeCompare(b.title),
    );
  }

  function renderNotificationPanel() {
    const toggle = document.getElementById("notificationToggle");
    const badge = document.getElementById("notificationBadge");
    const summary = document.getElementById("notificationUnreadSummary");
    const list = document.getElementById("notificationList");
    if (!toggle || !badge || !summary || !list) return;

    const notifications = buildNotifications();
    const readIds = new Set(Store.loadNotificationReadIds());
    const unreadCount = notifications.reduce(
      (count, notification) => count + (readIds.has(notification.id) ? 0 : 1),
      0,
    );

    badge.hidden = unreadCount === 0;
    badge.textContent = unreadCount > 9 ? "9+" : String(unreadCount);
    toggle.setAttribute(
      "aria-label",
      unreadCount
        ? `Open notifications, ${unreadCount} unread`
        : "Open notifications",
    );
    summary.textContent = unreadCount
      ? `${unreadCount} unread · ${notifications.length} total`
      : "You’re all caught up.";

    list.innerHTML = notifications.length
      ? notifications
          .map(
            (notification) => `
          <li>
            <button
              class="notification-item${readIds.has(notification.id) ? "" : " is-unread"}"
              type="button"
              data-notification-id="${escapeHtml(notification.id)}"
              data-notification-page="${escapeHtml(notification.page)}"
            >
              <span class="notification-item-icon is-${escapeHtml(notification.tone)}" aria-hidden="true">${escapeHtml(notification.icon)}</span>
              <span class="notification-item-copy">
                <span class="notification-item-title">${escapeHtml(notification.title)}</span>
                <span class="notification-item-message">${escapeHtml(notification.message)}</span>
              </span>
            </button>
          </li>
        `,
          )
          .join("")
      : '<li class="notification-empty">You’re all caught up.</li>';
  }

  function setNotificationDropdownOpen(isOpen) {
    const toggle = document.getElementById("notificationToggle");
    const dropdown = document.getElementById("notificationDropdown");
    if (!toggle || !dropdown) return;
    dropdown.hidden = !isOpen;
    toggle.setAttribute("aria-expanded", String(isOpen));
  }

  function renderCurrentPage() {
    updateNavBadge();
    renderNotificationPanel();

    if (state.currentPage === "dashboard") {
      renderDashboard();
    } else if (state.currentPage === "transactions") {
      renderHomeMoney();
      renderTransactionsPage();
    } else if (state.currentPage === "reports") {
      renderReportsPage();
    } else if (state.currentPage === "budget") {
      renderBudgetPage();
    } else if (state.currentPage === "savings") {
      renderSavingsDashboard();
    } else if (state.currentPage === "calendar") {
      renderExpenseCalendar();
    } else if (state.currentPage === "challenges") {
      renderNoSpendChallenge();
    } else if (state.currentPage === "payments") {
      renderPaymentReminders();
    } else if (state.currentPage === "settings") {
      renderSettingsPage();
    } else if (state.currentPage === "profile") {
      renderProfilePage();
    }
  }

  /* =======================================================
     DASHBOARD
  ======================================================= */

  function renderDashboard() {
    const greeting = document.getElementById("dashboardGreeting");
    if (greeting) {
      const fullName = getProfileFullName();
      greeting.textContent = fullName
        ? `Welcome back, ${formatProfileNameForGreeting(fullName)}`
        : "Welcome back";
    }

    const monthLabel = document.getElementById("monthLabel");

    if (monthLabel) {
      monthLabel.textContent = formatMonthLabel(state.viewMonth);
    }

    const list = txForMonth(state.viewMonth);

    const income = sumByType(list, "income");

    const expense = sumByType(list, "expense");

    const accountIncome = list
      .filter(
        (transaction) =>
          transaction.type === "income" &&
          !transactionCountsAsSavings(transaction),
      )
      .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
    const accountExpense = list
      .filter(
        (transaction) =>
          transaction.type === "expense" &&
          getTransactionMoneySource(transaction) !== "savings",
      )
      .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
    const savingsTransfers = state.studentFeatures.savingsTransfers
      .filter(
        (transfer) => transfer.date.slice(0, 7) === monthKey(state.viewMonth),
      )
      .reduce((sum, transfer) => sum + Number(transfer.amount || 0), 0);
    const netBalance = accountIncome - accountExpense - savingsTransfers;

    const balance = Math.max(0, netBalance);

    animateValue(
      document.getElementById("statBalance"),
      balance,
      formatCurrency,
    );

    const balanceSub = document.getElementById("statBalanceSub");

    if (balanceSub) {
      balanceSub.textContent =
        netBalance < 0
          ? "Expenses exceed income this month"
          : "Net balance for this month";
    }

    animateValue(document.getElementById("statIncome"), income, formatCurrency);

    animateValue(
      document.getElementById("statExpense"),
      expense,
      formatCurrency,
    );

    animateValue(document.getElementById("statCount"), list.length);

    const stateCountEl = document.getElementById("stateCount");
    if (stateCountEl) {
      animateValue(stateCountEl, list.length);
    }

    const countSub = document.getElementById("statCountSub");
    if (countSub) {
      countSub.textContent =
        list.length === 1
          ? "1 transaction this month"
          : `${list.length} transactions this month`;
    }

    if (countSub) {
      countSub.textContent =
        list.length === 1
          ? "1 transaction this month"
          : `${list.length} transactions this month`;
    }

    const dailySpendingPlan = renderDailySpendingLimit();
    renderMoneySummary();
    renderDashboardHomeMoney();
    renderDashboardFeatureSummaries();

    renderBudgetPanel(expense);
    renderSpendingOverview(expense, dailySpendingPlan);

    renderTrendChart();

    renderDonutChart();

    renderInsights(list, income, expense);

    renderRecentList();
    renderNotificationPanel();
  }

  function renderMoneySummary() {
    const balances = calculateMoneyBalances(state.transactions);
    const values = {
      totalMoneyBalance: balances.totalCents,
      spendableMoneyBalance: balances.spendableCents,
      onlineMoneyBalance: balances.onlineCents,
      cashMoneyBalance: balances.cashCents,
      savingsMoneyBalance: Math.max(0, balances.savingsCents),
    };

    Object.entries(values).forEach(([id, cents]) => {
      const element = document.getElementById(id);
      if (element) {
        animateValue(element, cents / 100, formatCurrency);
      }
    });

    const savingsTotal = document.getElementById("dashboardSavingsTotal");
    if (savingsTotal) {
      animateValue(
        savingsTotal,
        Math.max(0, balances.savingsCents) / 100,
        formatCurrency,
      );
    }
    const savingsSummary = document.getElementById("dashboardSavingsSummary");
    if (savingsSummary) {
      savingsSummary.textContent = `Cash ${formatCurrency(Math.max(0, balances.cashSavingsCents) / 100)} · Online ${formatCurrency(
        Math.max(0, balances.onlineSavingsCents) / 100,
      )}`;
    }
  }

  function renderDailySpendingLimit() {
    const today = new Date();
    const plan = calculateDailySpendingPlan(state.transactions, today);

    const values = {
      dailyLimitAmount: plan.dailyLimit,
      dailyLimitBalance: plan.balance,
      dailyLimitDays: plan.remainingDays,
      dailyLimitSpent: plan.spentToday,
      dailyLimitLeft: plan.leftToday,
    };

    Object.entries(values).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element) {
        element.textContent =
          id === "dailyLimitDays" ? String(value) : formatCurrency(value);
      }
    });
    const leftElement = document.getElementById("dailyLimitLeft");
    if (leftElement) {
      leftElement.textContent = `${formatCurrency(plan.leftToday)} left today`;
    }
    const metaElement = document.getElementById("dailyLimitMeta");
    if (metaElement) {
      metaElement.textContent = `${formatCurrency(plan.balance)} remaining balance · ${plan.remainingDays} days · ${formatCurrency(plan.spentToday)} spent today`;
    }
    return plan;
  }

  function calculateDailySpendingPlan(transactions, today) {
    const monthKeyToday = monthKey(today);
    const monthTransactions = transactions.filter(
      (transaction) => txMonthKey(transaction) === monthKeyToday,
    );
    const monthSavingsTransfers = state.studentFeatures.savingsTransfers.filter(
      (transfer) => transfer.date.slice(0, 7) === monthKeyToday,
    );
    const income = monthTransactions
      .filter(
        (transaction) =>
          transaction.type === "income" &&
          !transactionCountsAsSavings(transaction),
      )
      .reduce(
        (total, transaction) => total + Number(transaction.amount || 0),
        0,
      );
    const expense = monthTransactions
      .filter(
        (transaction) =>
          transaction.type === "expense" &&
          getTransactionMoneySource(transaction) !== "savings",
      )
      .reduce(
        (total, transaction) => total + Number(transaction.amount || 0),
        0,
      );
    const transferred = monthSavingsTransfers.reduce(
      (total, transfer) => total + Number(transfer.amount || 0),
      0,
    );
    const balance = Math.max(0, income - expense - transferred);
    const remainingDays =
      new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate() -
      today.getDate() +
      1;
    const dailyLimit = remainingDays > 0 ? balance / remainingDays : 0;
    const todayKey = toISODate(today);
    const spentToday = transactions
      .filter(
        (transaction) =>
          transaction.type === "expense" && transaction.date === todayKey,
      )
      .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);

    return {
      balance,
      remainingDays,
      dailyLimit,
      spentToday,
      leftToday: Math.max(0, dailyLimit - spentToday),
    };
  }

  function renderSpendingOverview(expense, plan) {
    const budget = Number(state.settings.budget) || 0;
    const remaining = budget - expense;
    const percent = budget > 0 ? (expense / budget) * 100 : 0;
    const values = {
      spendingOverviewSpent: formatCurrency(expense),
      spendingOverviewRemaining:
        remaining < 0
          ? `${formatCurrency(Math.abs(remaining))} over budget`
          : formatCurrency(remaining),
      spendingOverviewDailyLimit: `${formatCurrency(plan.dailyLimit)}/day`,
      spendingOverviewSpentToday: formatCurrency(plan.spentToday),
    };

    Object.entries(values).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element) element.textContent = value;
    });

    const progressBar = document.getElementById("spendingOverviewProgressBar");
    const progress = document.getElementById("spendingOverviewProgress");
    const boundedPercent = Math.min(100, Math.max(0, percent));
    if (progressBar) {
      progressBar.setAttribute(
        "aria-valuenow",
        String(Math.round(boundedPercent)),
      );
      progressBar.setAttribute(
        "aria-valuetext",
        budget > 0
          ? `${Math.round(percent)} percent of monthly budget used`
          : "No monthly budget set",
      );
    }
    if (progress) {
      progress.style.width = `${boundedPercent}%`;
    }
  }

  function moneyFromHomeTransactions(list) {
    return list.filter(
      (transaction) =>
        transaction.type === "income" &&
        transaction.category === "Money From Home",
    );
  }

  function renderDashboardHomeMoney() {
    const homeIncome = moneyFromHomeTransactions(state.transactions);
    const total = homeIncome.reduce(
      (sum, transaction) => sum + Number(transaction.amount || 0),
      0,
    );
    const latest = [...homeIncome].sort(
      (a, b) =>
        b.date.localeCompare(a.date) ||
        Number(b.createdAt || 0) - Number(a.createdAt || 0),
    )[0];
    const totalElement = document.getElementById("dashboardHomeMoneyTotal");
    const latestElement = document.getElementById("dashboardHomeMoneyLatest");

    // Keep the panel permanently visible on the dashboard
    if (totalElement?.closest(".panel")) {
      totalElement.closest(".panel").hidden = false;
    }

    if (totalElement) {
      totalElement.textContent = formatCurrency(total);
    }
    if (latestElement) {
      latestElement.textContent = latest
        ? `Latest: ${formatCurrency(latest.amount)} on ${formatDateDisplay(latest.date)}`
        : "No money from home recorded yet.";
    }
  }

  function setDashboardWidgetVisibility(element, visible) {
    const panel = element?.closest(".panel");
    if (!panel) return;

    panel.hidden = !visible;

    const grid = panel.parentElement;
    if (!grid?.matches(".dash-grid, .student-dashboard-summaries")) return;

    const panels = Array.from(grid.children).filter((child) =>
      child.classList.contains("panel"),
    );
    if (panels.length) {
      grid.hidden = panels.every((child) => child.hidden);
    }
  }

  function renderDashboardFeatureSummaries() {
    const messages = getSmartBudgetMessages().slice(0, 2);
    const alertList = document.getElementById("dashboardSmartAlerts");
    if (alertList) {
      alertList.innerHTML = messages
        .map(
          (message) => `
        <li class="smart-alert smart-alert-${message.type}">
          <span aria-hidden="true">${message.type === "danger" ? "!" : message.type === "warning" ? "⚠" : "✓"}</span>
          ${escapeHtml(message.text)}
        </li>
      `,
        )
        .join("");
      setDashboardWidgetVisibility(alertList, messages.length > 0);
    }

    const goals = state.studentFeatures.savingsGoals;
    renderDashboardSavingsGoals();

    const nextReminder = state.studentFeatures.paymentReminders
      .filter((reminder) => !reminder.completed)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
    const paymentSummary = document.getElementById("dashboardPaymentSummary");
    if (paymentSummary) {
      if (!nextReminder) {
        paymentSummary.textContent = "No upcoming payments or repayments.";
      } else {
        const timing =
          nextReminder.dueDate < todayISO()
            ? "Overdue"
            : nextReminder.dueDate === todayISO()
              ? "Due today"
              : formatDateDisplay(nextReminder.dueDate);
        paymentSummary.textContent =
          nextReminder.kind === "repayment"
            ? `Expected from ${nextReminder.personName || nextReminder.name} · ${formatCurrency(nextReminder.amount)} · ${timing}`
            : `${nextReminder.name} · ${formatCurrency(nextReminder.amount)} · ${timing}`;
      }
      setDashboardWidgetVisibility(paymentSummary, Boolean(nextReminder));
    }

    const challenge = state.studentFeatures.challenge;
    const challengeSummary = document.getElementById(
      "dashboardChallengeSummary",
    );
    const challengeProgress = document.getElementById(
      "dashboardChallengeProgress",
    );
    if (challengeSummary) {
      if (challenge?.status === "active") {
        const elapsed = Math.max(
          0,
          Math.floor(
            (new Date(`${todayISO()}T12:00:00`) -
              new Date(`${challenge.startDate}T12:00:00`)) /
              86400000,
          ) + 1,
        );
        const completed = Math.min(challenge.duration, elapsed);
        challengeSummary.textContent = `${completed} of ${challenge.duration} days completed`;
        if (challengeProgress) {
          challengeProgress.style.width = `${Math.min(100, (completed / challenge.duration) * 100)}%`;
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
      setDashboardWidgetVisibility(
        challengeSummary,
        challenge?.status === "active" || challenge?.status === "completed",
      );
    }
  }

  function renderDashboardSavingsGoals() {
    const summary = document.getElementById("dashboardSavingsSummary");
    if (summary) {
      const balances = calculateMoneyBalances(state.transactions);
      summary.textContent = `Cash ${formatCurrency(Math.max(0, balances.cashSavingsCents) / 100)} · Online ${formatCurrency(
        Math.max(0, balances.onlineSavingsCents) / 100,
      )}`;
    }
  }

  function openSavingsOperationModal(
    type,
    trigger = document.activeElement,
    preselectedSource = null,
  ) {
    const overlay = document.getElementById("savingsOperationOverlay");
    const form = document.getElementById("savingsOperationForm");
    const error = document.getElementById("savingsOperationError");
    if (!overlay || !form) return;

    state.savingsOperationReturnFocus =
      trigger instanceof HTMLElement ? trigger : null;
    state.savingsOperationType = type;
    form.reset();

    const isDeposit = type === "deposit";
    const isTransfer = type === "transfer";
    const title = document.getElementById("savingsOperationTitle");
    const description = document.getElementById("savingsOperationDescription");
    const submit = document.getElementById("savingsOperationSubmit");
    const includeRow = document.getElementById("savingsIncludeInTotalRow");
    const sourceRow = document.getElementById("savingsTransferSourceRow");
    const bucketRow = document.getElementById("savingsOperationBucketRow");
    const bucketInput = document.getElementById("savingsOperationBucket");
    const sourceInput = document.getElementById("savingsTransferSource");
    if (title) {
      title.textContent = isDeposit
        ? "Add money to Savings"
        : isTransfer
          ? preselectedSource === "cash"
            ? "Move Cash to Savings"
            : preselectedSource === "online"
              ? "Move Online to Savings"
              : "Move money to Savings"
          : "Withdraw from Savings";
    }
    if (description) {
      description.textContent = isTransfer
        ? `Move money directly from your ${preselectedSource ? preselectedSource.toUpperCase() : "Cash/Online"} balance into Savings.`
        : "Manage your savings balances.";
    }
    if (submit) {
      submit.textContent = isTransfer ? "Transfer to Savings" : "Save";
    }
    if (includeRow) {
      includeRow.hidden = !isDeposit;
    }
    if (sourceRow) {
      sourceRow.hidden = !isTransfer;
    }
    if (bucketRow) {
      bucketRow.hidden = isTransfer;
    }
    if (sourceInput && preselectedSource) {
      sourceInput.value = preselectedSource;
    }
    syncSavingsOperationFields();
    if (error) {
      error.textContent = "";
      error.hidden = true;
    }
    document
      .getElementById("savingsOperationAmount")
      ?.removeAttribute("aria-invalid");
    document
      .getElementById("savingsOperationPlatformName")
      ?.removeAttribute("aria-invalid");

    closeActiveModals(overlay);
    overlay.classList.add("is-open");
    overlay.setAttribute("aria-hidden", "false");
    document.getElementById("savingsOperationAmount")?.focus();
    if (bucketInput && sourceInput) {
      bucketInput.value = preselectedSource || "cash";
      sourceInput.value = preselectedSource || "cash";
    }
  }

  function syncSavingsOperationFields() {
    const isTransfer = state.savingsOperationType === "transfer";
    const bucketLabel = document.getElementById("savingsOperationBucketLabel");

    // Transfer হ'লে sourceInput লওক, নহ'লে bucketInput
    const bucket = isTransfer
      ? document.getElementById("savingsTransferSource")?.value
      : document.getElementById("savingsOperationBucket")?.value;

    const platformRow = document.getElementById("savingsOperationPlatformRow");
    const platformNameRow = document.getElementById(
      "savingsOperationPlatformNameRow",
    );
    const platform = document.getElementById("savingsOperationPlatform")?.value;

    if (bucketLabel) {
      bucketLabel.textContent =
        state.savingsOperationType === "withdrawal"
          ? "Withdraw from"
          : "Save to";
    }

    // Online বাচিলে সদায় Platform row ওলাব (Transfer-ৰ বাবেও)
    const showOnline = bucket === "online";
    if (platformRow) platformRow.hidden = !showOnline;
    if (platformNameRow) {
      platformNameRow.hidden = !showOnline || platform !== "other";
    }
    const error = document.getElementById("savingsOperationError");
    if (error) {
      error.textContent = "";
      error.hidden = true;
    }
    document
      .getElementById("savingsOperationPlatformName")
      ?.removeAttribute("aria-invalid");
  }

  function getSavingsBucketBalanceCents(
    balances,
    bucket,
    platform = null,
    customPlatformName = null,
    spendableOnly = false,
  ) {
    if (bucket === "cash") return balances.cashSavingsCents;
    if (
      spendableOnly &&
      platform &&
      NON_SPENDABLE_SAVINGS_PLATFORMS.has(platform)
    ) {
      return 0;
    }
    if (!platform) {
      return spendableOnly
        ? balances.onlineSpendableSavingsCents
        : balances.onlineSavingsCents;
    }
    return balances.onlinePlatforms
      .filter(
        (entry) =>
          entry.platform === platform &&
          (customPlatformName === null ||
            entry.customPlatformName === customPlatformName),
      )
      .reduce((sum, entry) => sum + entry.amountCents, 0);
  }

  function closeSavingsOperationModal() {
    const overlay = document.getElementById("savingsOperationOverlay");
    if (overlay) {
      overlay.classList.remove("is-open");
      overlay.setAttribute("aria-hidden", "true");
    }

    const returnFocus = state.savingsOperationReturnFocus;
    state.savingsOperationReturnFocus = null;
    if (returnFocus?.isConnected) {
      returnFocus.focus();
    }
  }

  async function handleSavingsOperationSubmit(event) {
    event.preventDefault();
    if (state.savingsOperationSubmitting) return;
    const amountInput = document.getElementById("savingsOperationAmount");
    const sourceInput = document.getElementById("savingsTransferSource");
    const bucketInput = document.getElementById("savingsOperationBucket");
    const platformInput = document.getElementById("savingsOperationPlatform");
    const platformNameInput = document.getElementById(
      "savingsOperationPlatformName",
    );
    const errorElement = document.getElementById("savingsOperationError");
    const amount = Number(amountInput?.value);

    if (!Number.isFinite(amount) || amount <= 0) {
      if (errorElement) {
        errorElement.textContent = "Enter a valid amount greater than ₹0.";
        errorElement.hidden = false;
      }
      amountInput?.setAttribute("aria-invalid", "true");
      amountInput?.focus();
      return;
    }

    const amountCents = Math.round(amount * 100);
    if (amountCents < 1) {
      if (errorElement) {
        errorElement.textContent = "Enter an amount of at least ₹0.01.";
        errorElement.hidden = false;
      }
      amountInput?.setAttribute("aria-invalid", "true");
      amountInput?.focus();
      return;
    }
    const balances = calculateMoneyBalances(state.transactions);
    const isDeposit = state.savingsOperationType === "deposit";
    const isTransfer = state.savingsOperationType === "transfer";
    const isWithdrawal = !isDeposit && !isTransfer;
    const savingsType = isTransfer ? sourceInput?.value : bucketInput?.value;
    const platform =
      savingsType === "online"
        ? normalizeSavingsPlatform(platformInput?.value)
        : null;
    const customPlatformName =
      platform === "other" ? platformNameInput?.value.trim() || "" : "";
    if (
      savingsType === "online" &&
      platform === "other" &&
      !customPlatformName
    ) {
      if (errorElement) {
        errorElement.textContent = "Enter a platform name for Other.";
        errorElement.hidden = false;
      }
      platformNameInput?.setAttribute("aria-invalid", "true");
      platformNameInput?.focus();
      return;
    }
    const source = sourceInput?.value;
    if (isTransfer) {
      const availableSource =
        source === "cash" ? balances.cashCents : balances.onlineCents;
      if (
        !["cash", "online"].includes(source) ||
        amountCents > Math.max(0, availableSource)
      ) {
        if (errorElement) {
          errorElement.textContent = `Insufficient ${source === "cash" ? "Cash" : "Online"} balance. You have ${formatCurrency(
            Math.max(0, availableSource) / 100,
          )} available.`;
          errorElement.hidden = false;
        }
        amountInput?.setAttribute("aria-invalid", "true");
        amountInput?.focus();
        return;
      }
    }
    const availableSavings = isWithdrawal
      ? getSavingsBucketBalanceCents(
          balances,
          savingsType,
          platform,
          platform === "other" ? customPlatformName : null,
        )
      : 0;
    if (isWithdrawal && amountCents > Math.max(0, availableSavings)) {
      if (errorElement) {
        errorElement.textContent = `Insufficient ${savingsType === "cash" ? "Cash Savings" : "Online Savings"} balance. You have ${formatCurrency(
          Math.max(0, availableSavings) / 100,
        )} available.`;
        errorElement.hidden = false;
      }
      amountInput?.setAttribute("aria-invalid", "true");
      amountInput?.focus();
      return;
    }

    const operation = {
      id: uid(),
      type: isDeposit ? "deposit" : "withdrawal",
      amount: amountCents / 100,
      savingsType,
      platform,
      customPlatformName,
      includeInTotalMoney:
        isDeposit &&
        document.querySelector('input[name="savingsIncludeInTotal"]:checked')
          ?.value === "yes",
      includeInTotal:
        isDeposit &&
        document.querySelector('input[name="savingsIncludeInTotal"]:checked')
          ?.value === "yes",
      date: todayISO(),
      createdAt: Date.now(),
    };
    state.savingsOperationSubmitting = true;
    const submitButton = document.getElementById("savingsOperationSubmit");
    const submitLabel = submitButton?.textContent || "Save";
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Saving...";
    }
    const previousOperations = state.studentFeatures.savingsOperations || [];
    const previousTransfers = state.studentFeatures.savingsTransfers || [];
    try {
      // dashboard.js -> handleSavingsOperationSubmit() bhitorot:

      if (isTransfer) {
        state.studentFeatures.savingsTransfers = [
          ...previousTransfers,
          {
            id: operation.id,
            amount: operation.amount,
            source: source, // cash বা online
            savingsType: source, // bucket cash নে online
            platform: source === "online" ? platform : null,
            customPlatformName:
              source === "online" && platform === "other"
                ? customPlatformName
                : "",
            date: operation.date,
            createdAt: operation.createdAt,
          },
        ];
      } else {
        state.studentFeatures.savingsOperations = [
          ...previousOperations,
          operation,
        ];

        // কেৱল বাহিৰৰ পৰা Direct Deposit বা Withdrawal হ'লেহে Transaction যোগ হ'ব
        const txCategory = isDeposit ? "Savings Deposit" : "Savings Withdrawal";
        const txTitle = isDeposit
          ? `Saved in ${savingsType === "online" ? customPlatformName || getSavingsPlatformLabel(platform) : "Cash"}`
          : `Withdrawn from Savings to ${savingsType === "online" ? "Online" : "Cash"}`;

        state.transactions.push({
          id: uid(),
          type: isWithdrawal ? "income" : "expense",
          amount: operation.amount,
          title: txTitle,
          category: txCategory,
          date: operation.date,
          paymentMethod: savingsType === "online" ? "UPI" : "Cash",
          moneySource: isWithdrawal
            ? savingsType === "online"
              ? "online"
              : "cash"
            : "savings",
          countAsSavings: isDeposit ? true : false,
          savingsBucket: savingsType,
          savingsPlatform: platform,
          savingsPlatformName: customPlatformName,
          note: isDeposit
            ? "Direct savings deposit"
            : "Withdrawn back to spendable wallet",
          createdAt: Date.now(),
        });

        Store.saveTransactions(state.transactions);
      }
      if (!Store.saveStudentFeatures(state.studentFeatures)) {
        state.studentFeatures.savingsOperations = previousOperations;
        state.studentFeatures.savingsTransfers = previousTransfers;
        if (errorElement) {
          errorElement.textContent =
            "Could not save this Savings operation on this device.";
          errorElement.hidden = false;
        }
        return;
      }

      closeSavingsOperationModal();
      renderCurrentPage();
      const synced = await persistStudentFeatures(false, true);
      if (synced) {
        showToast(
          isDeposit
            ? "Money added to Savings."
            : isTransfer
              ? "Money moved to Savings."
              : "Savings withdrawal recorded.",
          "success",
        );
      } else {
        showToast(
          "Saved on this device. Cloud sync is pending and will retry when available.",
          "warning",
        );
      }
    } finally {
      state.savingsOperationSubmitting = false;
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = submitLabel;
      }
    }
  }

  function renderBudgetPanel(expense) {
    const budget = Number(state.settings.budget) || 0;

    const percent = budget > 0 ? (expense / budget) * 100 : 0;

    const remaining = budget - expense;

    animateValue(
      document.getElementById("budgetSpent"),
      expense,
      formatCurrency,
    );

    animateValue(
      document.getElementById("budgetTotal"),
      budget,
      formatCurrency,
    );

    const percentEl = document.getElementById("budgetPercent");

    const budgetUsage = document.getElementById("budgetUsage");

    const warningIcon = document.getElementById("budgetWarningIcon");

    const budgetPanel = document.querySelector(".panel-budget");

    const remainingEl = document.getElementById("budgetRemaining");

    if (percentEl) {
      percentEl.textContent = Math.round(percent) + "% used";
    }

    if (warningIcon) {
      warningIcon.hidden = percent < 80;

      warningIcon.classList.toggle("is-danger", percent >= 100);

      warningIcon.title =
        percent >= 100
          ? "You have reached or exceeded your monthly budget."
          : "You have used at least 80% of your monthly budget.";
    }

    if (budgetPanel) {
      budgetPanel.classList.toggle(
        "has-budget-warning",
        percent >= 80 && percent < 100,
      );

      budgetPanel.classList.toggle("has-budget-danger", percent >= 100);
    }

    if (budgetUsage) {
      budgetUsage.classList.toggle(
        "is-budget-warning",
        percent >= 80 && percent < 100,
      );

      budgetUsage.classList.toggle("is-budget-danger", percent >= 100);
    }

    if (remainingEl) {
      remainingEl.textContent =
        remaining < 0
          ? `${formatCurrency(Math.abs(remaining))} over budget`
          : `${formatCurrency(remaining)} remaining`;

      remainingEl.classList.toggle("is-budget-danger", percent >= 100);
    }

    const fill = document.getElementById("budgetProgress");

    if (fill) {
      fill.classList.remove("is-warning", "is-danger");

      fill.style.width = clamp(percent, 0, 100) + "%";

      if (percent >= 100) {
        fill.classList.add("is-danger");
      } else if (percent >= 80) {
        fill.classList.add("is-warning");
      }
    }
  }

  const CATEGORY_BUDGET_NAMES = [
    "Food",
    "Transport",
    "Education",
    "Entertainment",
    "Recharge",
    "Other",
  ];

  function renderStudentTools() {
    renderStudentMode();
    renderHomeMoney(moneyFromHomeTransactions(state.transactions));
    renderCategoryBudgets();
    renderSmartBudgetAlerts();
    renderSavingsDashboard();
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
    const percent = budget > 0 ? (expenses / budget) * 100 : 0;
    const spentElement = document.getElementById("categoryBudgetMonthlySpent");
    const limitElement = document.getElementById("categoryBudgetMonthlyLimit");
    const progressElement = document.getElementById("categoryBudgetProgress");
    const summaryElement = document.getElementById(
      "categoryBudgetMonthlySummary",
    );
    if (spentElement) spentElement.textContent = formatCurrency(expenses);
    if (limitElement) limitElement.textContent = formatCurrency(budget);
    if (progressElement) {
      progressElement.style.width = `${Math.min(100, percent)}%`;
      progressElement.classList.toggle(
        "is-warning",
        percent >= 80 && percent < 100,
      );
      progressElement.classList.toggle("is-danger", percent >= 100);
    }
    if (summaryElement) {
      summaryElement.textContent =
        budget > 0
          ? `${Math.round(percent)}% used · ${formatCurrency(Math.max(0, budget - expenses))} remaining`
          : "Set a monthly target to track your total spending.";
    }
  }

  function renderCategoryBudgetProgress() {
    const containerLeft = document.getElementById(
      "categoryBudgetProgressListLeft",
    );
    const containerRight = document.getElementById(
      "categoryBudgetProgressListRight",
    );
    if (!containerLeft && !containerRight) return;

    const totals = categoryTotals(txForMonth(new Date()), "expense");
    const budgets = state.studentFeatures.categoryBudgets || {};
    const entries = Object.entries(budgets);

    if (!entries.length) {
      if (containerLeft)
        containerLeft.innerHTML =
          '<p class="feature-empty">No category budgets set yet.</p>';
      if (containerRight)
        containerRight.innerHTML =
          '<p class="feature-empty">No category budgets set yet.</p>';
      return;
    }

    // Group 1-ত Food, Transport, Education থাকিব; বাকীবোৰ Group 2-ত যাব
    const group1Categories = new Set(["Food", "Transport", "Education"]);
    const leftItems = [];
    const rightItems = [];

    entries.forEach(([category, limit]) => {
      const spent = totals[category] || 0;
      const percent = limit > 0 ? (spent / limit) * 100 : 0;
      const html = `
        <div class="category-budget-progress" style="margin-bottom: 14px;">
          <div class="category-budget-progress-heading" style="display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 0.82rem;">
            <strong>${escapeHtml(category)}</strong>
            <span>${formatCurrency(spent)} / ${formatCurrency(limit)} · ${Math.round(percent)}%</span>
          </div>
          <div class="goal-progress-track">
            <span class="${percent >= 100 ? "is-danger" : percent >= 80 ? "is-warning" : ""}" style="width:${Math.min(100, percent)}%"></span>
          </div>
        </div>
      `;

      if (group1Categories.has(category)) {
        leftItems.push(html);
      } else {
        rightItems.push(html);
      }
    });

    if (containerLeft) {
      containerLeft.innerHTML = leftItems.length
        ? leftItems.join("")
        : '<p class="feature-empty">No primary essential budgets set.</p>';
    }

    if (containerRight) {
      containerRight.innerHTML = rightItems.length
        ? rightItems.join("")
        : '<p class="feature-empty">No additional category budgets set.</p>';
    }
  }

  function renderStudentMode() {
    const select = document.getElementById("studentMode");
    const recommendations = document.getElementById(
      "studentModeRecommendations",
    );
    if (select) {
      populateStudentTypeOptions(select);
      select.value = state.studentFeatures.studentMode;
    }
    const profileSelect = document.getElementById("profileStudentMode");
    if (profileSelect) {
      populateStudentTypeOptions(profileSelect);
      profileSelect.value = state.studentFeatures.studentMode;
    }
    updateCustomStudentTypeVisibility();
    if (!recommendations) return;

    const selectedType = STUDENT_TYPE_OPTIONS.find(
      (option) => option.value === state.studentFeatures.studentMode,
    );
    const categories = selectedType?.recommendedCategories || [];
    recommendations.textContent = categories.length
      ? `Recommended categories: ${categories.join(" · ")}. All existing categories remain available when recording transactions.`
      : "No student-specific category recommendations are configured for this type.";
  }

  function updateCustomStudentTypeVisibility() {
    const field = document.getElementById("profileCustomStudentTypeField");
    const select = document.getElementById("profileStudentMode");
    if (field && select) {
      field.hidden = select.value !== "other";
    }
  }

  function populateStudentTypeOptions(select) {
    const selectedMode = state.studentFeatures.studentMode;
    const options = [
      { value: "", label: "Choose a student type" },
      ...STUDENT_TYPE_OPTIONS,
    ];
    if (
      selectedMode &&
      !STUDENT_TYPE_OPTIONS.some((option) => option.value === selectedMode)
    ) {
      options.push({ value: selectedMode, label: selectedMode });
    }

    select.replaceChildren(
      ...options.map(({ value, label }) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        return option;
      }),
    );
  }

  function renderHomeMoney(
    transactions = moneyFromHomeTransactions(state.transactions),
  ) {
    const sortedLatest = [...transactions].sort(
      (a, b) =>
        b.date.localeCompare(a.date) ||
        Number(b.createdAt || 0) - Number(a.createdAt || 0),
    );
    const latest = sortedLatest[0];

    const total = transactions.reduce(
      (sum, transaction) => sum + Number(transaction.amount || 0),
      0,
    );
    const totalElement = document.getElementById("homeMoneyTotal");
    const latestElement = document.getElementById("homeMoneyLatest");
    const history = document.getElementById("homeMoneyHistory");
    const dateInput = document.getElementById("homeMoneyDate");

    if (totalElement) totalElement.textContent = formatCurrency(total);
    if (latestElement) {
      latestElement.textContent = latest
        ? `${formatCurrency(latest.amount)} · ${formatDateDisplay(latest.date)}`
        : "No money received yet";
    }
    if (dateInput && !dateInput.value) dateInput.value = todayISO();
    if (!history) return;

    // নতুন Transaction সদায় ওপৰত ৰাখিবলৈ Descending sort
    const sortedList = [...transactions].sort((a, b) =>
      (b.date + (b.createdAt || 0)).localeCompare(a.date + (a.createdAt || 0)),
    );

    const totalCount = sortedList.length;
    const totalPages = Math.max(
      1,
      Math.ceil(totalCount / state.homeMoneyPageSize),
    );

    if (state.homeMoneyCurrentPage > totalPages) {
      state.homeMoneyCurrentPage = totalPages;
    }

    // ৭ টা লেনদেনৰ বাবে Slice কৰা
    const startIndex =
      (state.homeMoneyCurrentPage - 1) * state.homeMoneyPageSize;
    const pagedList = sortedList.slice(
      startIndex,
      startIndex + state.homeMoneyPageSize,
    );

    // Pagination Status আৰু Buttons আপডেট
    const showingText = document.getElementById(
      "homeMoneyPaginationShowingText",
    );
    const pageIndicator = document.getElementById(
      "homeMoneyCurrentPageIndicator",
    );
    const prevBtn = document.getElementById("homeMoneyPrevPageBtn");
    const nextBtn = document.getElementById("homeMoneyNextPageBtn");

    if (showingText) {
      const from = totalCount === 0 ? 0 : startIndex + 1;
      const to = Math.min(
        state.homeMoneyCurrentPage * state.homeMoneyPageSize,
        totalCount,
      );
      showingText.textContent = `${from}-${to} of ${totalCount}`;
    }
    if (pageIndicator)
      pageIndicator.textContent = `Page ${state.homeMoneyCurrentPage}`;
    if (prevBtn) prevBtn.disabled = state.homeMoneyCurrentPage <= 1;
    if (nextBtn)
      nextBtn.disabled =
        state.homeMoneyCurrentPage >= totalPages || totalCount === 0;

    if (totalCount === 0) {
      history.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 24px; color: var(--text-faint);">
            No money from home recorded yet.
          </td>
        </tr>
      `;
      return;
    }

    history.innerHTML = pagedList
      .map((transaction) => {
        const meta = categoryMeta(transaction.category || "Money From Home");
        const paymentMethod =
          transaction.paymentMethod || transaction.payment_method || "UPI";

        return `
        <tr data-id="${escapeHtml(transaction.id)}">
          <td>
            <div class="tx-cell-title">
              <span class="tx-icon" style="background:${meta.color}22; color:${meta.color}">
                ${escapeHtml(initials(transaction.category || "Money From Home"))}
              </span>
              <span class="tx-title">${escapeHtml(transaction.note || transaction.title || "Money From Home")}</span>
            </div>
          </td>
          <td>
            <span class="cat-pill" style="background:${meta.color}22; color:${meta.color}">
              ${escapeHtml(transaction.category || "Money From Home")}
            </span>
          </td>
          <td>${formatDateDisplay(transaction.date)}</td>
          <td>${escapeHtml(paymentMethod)}</td>
          <td class="tx-amount is-income" style="text-align: right;">
            +${formatCurrency(transaction.amount)}
          </td>
          <td>
            <div class="row-actions">
              <button type="button" class="edit-btn" data-feature-action="edit-home" data-id="${escapeHtml(transaction.id)}">Edit</button>
              <button type="button" class="del-btn" data-feature-action="delete-home" data-id="${escapeHtml(transaction.id)}">Delete</button>
            </div>
          </td>
        </tr>
      `;
      })
      .join("");
  }

  function renderCategoryBudgets() {
    const container = document.getElementById("categoryBudgetInputs");
    if (!container) return;
    container.innerHTML = CATEGORY_BUDGET_NAMES.map(
      (category) => `
      <label>${escapeHtml(category)} (₹/month)
        <input type="number" min="0" step="0.01" inputmode="decimal" data-category-budget="${escapeHtml(category)}" value="${state.studentFeatures.categoryBudgets[category] || ""}" placeholder="No limit">
      </label>
    `,
    ).join("");
  }

  function getSmartBudgetMessages() {
    const messages = [];
    const monthTransactions = txForMonth(new Date());
    const monthExpense = sumByType(monthTransactions, "expense");
    const monthlyBudget = Number(state.settings.budget) || 0;
    if (monthlyBudget > 0) {
      const used = monthExpense / monthlyBudget;
      if (used >= 1) {
        messages.push({
          type: "danger",
          text: `You have used ${Math.round(used * 100)}% of your monthly budget.`,
        });
      } else if (used >= 0.8) {
        messages.push({
          type: "warning",
          text: `You have used ${Math.round(used * 100)}% of your monthly budget.`,
        });
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
    Object.entries(state.studentFeatures.categoryBudgets).forEach(
      ([category, limit]) => {
        const spent = categoryTotals[category] || 0;
        if (limit > 0 && spent / limit >= 0.8) {
          messages.push({
            type: spent >= limit ? "danger" : "warning",
            text: `You are close to your ${category} budget (${Math.round((spent / limit) * 100)}% used).`,
          });
        }
      },
    );

    const today = todayISO();
    const todaySpent = state.transactions
      .filter(
        (transaction) =>
          transaction.type === "expense" && transaction.date === today,
      )
      .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
    const priorSevenDays = [];
    for (let offset = 1; offset <= 7; offset += 1) {
      const date = new Date();
      date.setDate(date.getDate() - offset);
      priorSevenDays.push(toISODate(date));
    }
    const sevenDayAverage =
      priorSevenDays.reduce(
        (sum, date) =>
          sum +
          state.transactions
            .filter(
              (transaction) =>
                transaction.type === "expense" && transaction.date === date,
            )
            .reduce(
              (daySum, transaction) => daySum + Number(transaction.amount || 0),
              0,
            ),
        0,
      ) / 7;
    if (
      todaySpent > 0 &&
      sevenDayAverage > 0 &&
      todaySpent > sevenDayAverage * 1.25
    ) {
      messages.push({
        type: "warning",
        text: `Today's spending is higher than your recent daily average (${formatCurrency(sevenDayAverage)}).`,
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
          : "Set a monthly or category budget to receive spending alerts.",
      });
    }
    return messages;
  }

  function renderSmartBudgetAlerts() {
    const list = document.getElementById("smartBudgetAlerts");
    if (!list) return;
    list.innerHTML = getSmartBudgetMessages()
      .map(
        (message) => `
        <li class="smart-alert smart-alert-${message.type}">
          <span aria-hidden="true">${message.type === "danger" ? "!" : message.type === "warning" ? "⚠" : "✓"}</span>
          ${escapeHtml(message.text)}
        </li>
      `,
      )
      .join("");
  }

  function renderSavingsGoals() {
    const list = document.getElementById("savingsGoalsList");
    if (!list) return;
    const goals = state.studentFeatures.savingsGoals;
    list.innerHTML = goals.length
      ? goals
          .map((goal) => {
            const percent = Math.min(100, (goal.saved / goal.target) * 100);
            const remaining = Math.max(0, goal.target - goal.saved);
            const nowDay = Math.floor(Date.now() / 86400000);
            const createdDay = Math.floor(goal.createdAt / 86400000);
            const endDay = goal.targetDate
              ? Math.floor(
                  new Date(`${goal.targetDate}T12:00:00`).getTime() / 86400000,
                )
              : 0;
            const expected =
              endDay > createdDay
                ? Math.min(
                    100,
                    Math.max(
                      0,
                      ((nowDay - createdDay) / (endDay - createdDay)) * 100,
                    ),
                  )
                : 100;
            const status =
              goal.saved >= goal.target
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
              <div
                class="goal-progress-track"
                role="progressbar"
                aria-label="${escapeHtml(goal.name)} progress"
                aria-valuemin="0"
                aria-valuemax="100"
                aria-valuenow="${Math.round(percent)}"
              ><span style="width:${percent}%"></span></div>
              <p>${formatCurrency(remaining)} remaining${goal.note ? ` · ${escapeHtml(goal.note)}` : ""}</p>
              <form class="goal-contribution-form" data-goal-contribute="${escapeHtml(goal.id)}">
                <label>Add savings (₹)<input type="number" min="0.01" step="0.01" required></label>
                <button class="btn btn-secondary btn-sm" type="submit">Add to goal</button>
              </form>
            </article>
          `;
          })
          .join("")
      : '<div class="feature-empty">No savings goals yet.</div>';
  }

  function renderSavingsDashboard() {
    renderSavingsGoals();

    const balances = calculateMoneyBalances(state.transactions);
    const totalElement = document.getElementById("savingsPageTotal");
    if (totalElement) {
      animateValue(
        totalElement,
        Math.max(0, balances.savingsCents) / 100,
        formatCurrency,
      );
    }
    [
      ["cashSavingsBalance", balances.cashSavingsCents],
      ["onlineSavingsBalance", balances.onlineSavingsCents],
    ].forEach(([id, cents]) => {
      animateValue(
        document.getElementById(id),
        Math.max(0, cents) / 100,
        formatCurrency,
      );
    });

    const platformList = document.getElementById("onlineSavingsPlatformList");
    const onlineTotal = document.getElementById("onlineSavingsBreakdownTotal");
    if (onlineTotal) {
      onlineTotal.textContent = `${formatCurrency(Math.max(0, balances.onlineSavingsCents) / 100)} across tracked platforms`;
    }
    if (platformList) {
      const platforms = balances.onlinePlatforms.filter(
        (entry) => entry.amountCents !== 0,
      );
      platformList.innerHTML = platforms.length
        ? platforms
            .map(
              (entry) => `
            <li>
              <span>${escapeHtml(
                getSavingsPlatformLabel(
                  entry.platform,
                  entry.customPlatformName,
                ),
              )}</span>
              <strong>${formatCurrency(entry.amountCents / 100)}</strong>
            </li>
          `,
            )
            .join("")
        : '<li class="feature-empty">No Online Savings tracked yet. Add money to see a platform breakdown.</li>';
    }

    const activity = getSavingsActivity();
    const list = document.getElementById("savingsActivityList");
    if (!list) return;

    const totalSavingsCount = activity.length;
    const totalSavingsPages = Math.max(
      1,
      Math.ceil(totalSavingsCount / state.savingsPageSize),
    );
    if (state.savingsCurrentPage > totalSavingsPages) {
      state.savingsCurrentPage = totalSavingsPages;
    }

    const sStartIndex = (state.savingsCurrentPage - 1) * state.savingsPageSize;
    const pagedActivity = activity.slice(
      sStartIndex,
      sStartIndex + state.savingsPageSize,
    );

    // Pagination status bar update
    const sShowingText = document.getElementById(
      "savingsPaginationShowingText",
    );
    const sPageIndicator = document.getElementById(
      "savingsCurrentPageIndicator",
    );
    const sPrevBtn = document.getElementById("savingsPrevPageBtn");
    const sNextBtn = document.getElementById("savingsNextPageBtn");

    if (sShowingText) {
      const sFrom = totalSavingsCount === 0 ? 0 : sStartIndex + 1;
      const sTo = Math.min(
        state.savingsCurrentPage * state.savingsPageSize,
        totalSavingsCount,
      );
      sShowingText.textContent = `${sFrom}-${sTo} of ${totalSavingsCount}`;
    }
    if (sPageIndicator) {
      sPageIndicator.textContent = `Page ${state.savingsCurrentPage}`;
    }
    if (sPrevBtn) {
      sPrevBtn.disabled = state.savingsCurrentPage <= 1;
    }
    if (sNextBtn) {
      sNextBtn.disabled =
        state.savingsCurrentPage >= totalSavingsPages ||
        totalSavingsCount === 0;
    }

    list.innerHTML = pagedActivity.length
      ? pagedActivity
          .map(
            (entry) => `
          <li class="savings-activity-row is-${entry.direction}">
            <div class="savings-activity-description">
              <strong>${escapeHtml(entry.description)}</strong>
              <span>${escapeHtml(formatDateDisplay(entry.date))} · ${escapeHtml(entry.detail)}</span>
            </div>
            <strong>${entry.direction === "credit" ? "+" : "−"}${formatCurrency(entry.amountCents / 100)}</strong>
          </li>
        `,
          )
          .join("")
      : '<li class="feature-empty">No savings activity yet.</li>';

    if (activity.length > 20) {
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "link-btn-subtle savings-activity-toggle";
      toggle.dataset.savingsActivityToggle = "true";
      toggle.textContent = state.savingsActivityExpanded
        ? "Show recent activity"
        : `Show all ${activity.length} activities`;
      const toggleItem = document.createElement("li");
      toggleItem.append(toggle);
      list.append(toggleItem);
    }
  }

  function getSavingsActivity() {
    const activity = [];

    state.transactions.forEach((transaction) => {
      if (
        transaction.type === "income" &&
        transactionCountsAsSavings(transaction)
      ) {
        activity.push({
          id: transaction.id,
          amountCents: Math.round(Number(transaction.amount || 0) * 100),
          direction: "credit",
          date: transaction.date,
          createdAt: Number(transaction.createdAt) || 0,
          description: transaction.title || "Income counted as savings",
          detail: "Income · included in Total Money",
        });
      } else if (
        transaction.type === "expense" &&
        getTransactionMoneySource(transaction) === "savings"
      ) {
        activity.push({
          id: transaction.id,
          amountCents: Math.round(Number(transaction.amount || 0) * 100),
          direction: "debit",
          date: transaction.date,
          createdAt: Number(transaction.createdAt) || 0,
          description: transaction.title || "Savings expense",
          detail:
            transaction.savingsBucket === "online"
              ? `Expense from ${getSavingsPlatformLabel(
                  transaction.savingsPlatform || "other",
                  transaction.savingsPlatformName || "",
                )}`
              : transaction.savingsBucket === "cash"
                ? "Expense from Cash Savings"
                : "Expense paid from Savings",
        });
      }
    });

    state.studentFeatures.savingsTransfers.forEach((transfer) => {
      activity.push({
        id: transfer.id,
        amountCents: Math.round(Number(transfer.amount || 0) * 100),
        direction: "credit",
        date: transfer.date,
        createdAt: Number(transfer.createdAt) || 0,
        description: "Moved into Savings",
        detail:
          transfer.source === "cash"
            ? "Transfer from Cash · included in Total Money"
            : `Transfer from Online · ${getSavingsPlatformLabel(
                transfer.platform || "other",
                transfer.customPlatformName || "Moved from Online",
              )} · included in Total Money`,
      });
    });

    state.studentFeatures.savingsOperations.forEach((operation) => {
      const isDeposit = operation.type === "deposit";
      activity.push({
        id: operation.id,
        amountCents: Math.round(Number(operation.amount || 0) * 100),
        direction: isDeposit ? "credit" : "debit",
        date: operation.date,
        createdAt: Number(operation.createdAt) || 0,
        description: isDeposit
          ? "Direct Savings deposit"
          : "Savings withdrawal",
        detail: isDeposit
          ? `${
              operation.savingsType === "online"
                ? getSavingsPlatformLabel(
                    operation.platform || "other",
                    operation.customPlatformName || "",
                  )
                : "Cash Savings"
            } · ${
              operation.includeInTotalMoney || operation.includeInTotal
                ? "Included in Total Money"
                : "Not included in Total Money"
            }`
          : `Used from ${
              operation.savingsType === "online"
                ? getSavingsPlatformLabel(
                    operation.platform || "other",
                    operation.customPlatformName || "",
                  )
                : operation.savingsType === "cash"
                  ? "Cash Savings"
                  : "Savings"
            }`,
      });
    });

    return activity.sort(
      (a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt,
    );
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
    const monthTotalElement = document.getElementById(
      "expenseCalendarMonthTotal",
    );
    if (monthTotalElement) {
      const monthExpense = sumByType(
        txForMonth(state.calendarMonth),
        "expense",
      );
      monthTotalElement.textContent = `${formatCurrency(monthExpense)} total expenses this month · Daily totals from your transactions.`;
    }
    const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    let cells = weekdays
      .map((day) => `<span class="calendar-weekday">${day}</span>`)
      .join("");
    for (let blank = 0; blank < firstDay; blank += 1) {
      cells +=
        '<span class="calendar-day calendar-day-empty" aria-hidden="true"></span>';
    }
    for (let day = 1; day <= dayCount; day += 1) {
      const date = toISODate(new Date(year, month, day));
      const amount = state.transactions
        .filter(
          (transaction) =>
            transaction.type === "expense" && transaction.date === date,
        )
        .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
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
    const dayTransactions = state.transactions.filter(
      (transaction) => transaction.date === selected,
    );
    const dayExpenses = dayTransactions.filter(
      (transaction) => transaction.type === "expense",
    );
    const dayTotal = dayExpenses.reduce(
      (sum, transaction) => sum + Number(transaction.amount || 0),
      0,
    );
    if (selectedDate) {
      selectedDate.textContent = selected
        ? formatDateDisplay(selected)
        : "Select a date";
    }
    if (total) {
      total.textContent = dayExpenses.length
        ? `${formatCurrency(dayTotal)} spent`
        : "Expenses recorded for this day.";
    }
    if (transactionsList) {
      if (!dayTransactions.length) {
        transactionsList.innerHTML = `
          <tr>
            <td colspan="6" style="text-align: center; padding: 18px; color: var(--text-faint);">
              No transactions recorded for this day.
            </td>
          </tr>
        `;
      } else {
        // শেহতীয়া লেনদেন ওপৰত ৰাখিবলৈ Descending sort
        const sortedDayTransactions = [...dayTransactions].sort(
          (a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0),
        );

        transactionsList.innerHTML = sortedDayTransactions
          .map((transaction) => {
            const meta = categoryMeta(transaction.category || "Other");
            const income = transaction.type === "income";
            const paymentMethod =
              transaction.paymentMethod || transaction.payment_method || "UPI";

            return `
            <tr data-id="${escapeHtml(transaction.id)}">
              <td>
                <div class="tx-cell-title">
                  <span class="tx-icon" style="background:${meta.color}22; color:${meta.color}">
                    ${escapeHtml(initials(transaction.category))}
                  </span>
                  <span class="tx-title">${escapeHtml(transaction.title || "—")}</span>
                </div>
              </td>
              <td>
                <span class="cat-pill" style="background:${meta.color}22; color:${meta.color}">
                  ${escapeHtml(transaction.category)}
                </span>
              </td>
              <td>${formatDateDisplay(transaction.date)}</td>
              <td>${escapeHtml(paymentMethod)}</td>
              <td class="tx-amount ${income ? "is-income" : "is-expense"}" style="text-align: right;">
                ${income ? "+" : "−"}${formatCurrency(transaction.amount)}
              </td>
              <td>
                <div class="row-actions">
                  <button type="button" class="edit-btn" data-feature-action="edit-calendar-transaction" data-id="${escapeHtml(transaction.id)}">Edit</button>
                </div>
              </td>
            </tr>
          `;
          })
          .join("");
      }
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
    const deleteButton = document.getElementById("challengeDeleteButton");
    const duration = document.getElementById("challengeDuration");
    const customWrap = document.getElementById("challengeCustomWrap");
    const active = challenge?.status === "active";
    if (startButton) startButton.hidden = Boolean(active);
    if (cancelButton) cancelButton.hidden = !active;
    if (completeButton) completeButton.hidden = !active;
    if (restartButton) restartButton.hidden = !challenge || active;
    if (deleteButton) deleteButton.hidden = !challenge;
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
    const progress =
      challenge.status === "completed"
        ? 100
        : Math.min(100, (completed / challenge.duration) * 100);
    const statusText =
      challenge.status === "active"
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
      ["completed", "Completed"],
    ];
    const renderKind = (kind, title) => {
      const remindersForKind = state.studentFeatures.paymentReminders.filter(
        (reminder) =>
          (reminder.kind === "repayment" ? "repayment" : "payment") === kind,
      );
      const content = groups
        .map(([status, heading]) => {
          const reminders = remindersForKind
            .filter((reminder) => paymentReminderStatus(reminder) === status)
            .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
          if (!reminders.length) return "";
          return `
          <section class="reminder-group">
            <h4>${kind === "repayment" && status === "completed" ? "Received" : heading}</h4>
            ${reminders
              .map(
                (reminder) => `
              <div class="feature-list-row payment-reminder-row">
                <div>
                <strong>${escapeHtml(reminder.name)} <span class="reminder-status status-${status}">${kind === "repayment" && status === "completed" ? "Received" : status === "due" ? "Due today" : status}</span></strong>
                  <span>${
                    kind === "repayment"
                      ? `Expected from ${escapeHtml(reminder.personName || "someone")} · ${formatCurrency(reminder.amount)} · Expected ${escapeHtml(formatDateDisplay(reminder.dueDate))}`
                      : `${escapeHtml(reminder.category)} · ${formatCurrency(reminder.amount)} · ${escapeHtml(formatDateDisplay(reminder.dueDate))}${reminder.recurring ? ` · Repeats ${escapeHtml(reminder.recurrence)}` : ""}`
                  }</span>
                </div>
                <div class="feature-row-actions">
                  ${!reminder.completed ? `<button class="link-btn-subtle" type="button" data-feature-action="complete-reminder" data-id="${escapeHtml(reminder.id)}">${kind === "repayment" ? "Mark received" : "Mark paid"}</button>` : ""}
                  <button class="link-btn-subtle" type="button" data-feature-action="edit-reminder" data-id="${escapeHtml(reminder.id)}">Edit</button>
                  <button class="link-btn-subtle feature-delete" type="button" data-feature-action="delete-reminder" data-id="${escapeHtml(reminder.id)}">Delete</button>
                </div>
              </div>
            `,
              )
              .join("")}
          </section>
        `;
        })
        .join("");
      return `
        <section class="reminder-type-group">
          <h3>${title}</h3>
          ${content || `<p class="feature-empty">${kind === "repayment" ? "No money lent reminders yet. Add one to remember when to follow up." : "No payment reminders yet."}</p>`}
        </section>
      `;
    };
    container.innerHTML =
      renderKind("payment", "Payments to make") +
      renderKind("repayment", "Money lent · expected repayments");
  }

  /* =======================================================
     TREND CHART
  ======================================================= */

  function last6Months() {
    const result = [];

    for (let i = 5; i >= 0; i--) {
      const date = new Date(
        state.viewMonth.getFullYear(),
        state.viewMonth.getMonth() - i,
        1,
      );

      const list = txForMonth(date);

      result.push({
        label: MONTH_NAMES[date.getMonth()].slice(0, 3),

        income: sumByType(list, "income"),

        expense: sumByType(list, "expense"),
      });
    }

    return result;
  }

  function renderTrendChart() {
    const canvas = document.getElementById("trendChart");

    if (!canvas) return;

    const rect = canvas.parentElement?.getBoundingClientRect();

    const width = Math.max(1, rect?.width || 600);

    const height = 230;

    const dpr = window.devicePixelRatio || 1;

    canvas.width = width * dpr;

    canvas.height = height * dpr;

    canvas.style.width = width + "px";

    canvas.style.height = height + "px";

    const ctx = canvas.getContext("2d");

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.clearRect(0, 0, width, height);

    const months = last6Months();

    const padding = {
      top: 20,
      right: 20,
      bottom: 35,
      left: 55,
    };

    const chartWidth = width - padding.left - padding.right;

    const chartHeight = height - padding.top - padding.bottom;

    const maxValue =
      Math.max(100, ...months.map((m) => Math.max(m.income, m.expense))) * 1.15;

    const textColor = cssVar("--text-faint") || "#9290af";

    const borderColor = cssVar("--border") || "#e5e7eb";

    const incomeColor = cssVar("--income") || "#10b981";

    const expenseColor = cssVar("--expense") || "#f43f5e";

    ctx.font = '11px "Segoe UI", sans-serif';

    ctx.fillStyle = textColor;

    ctx.strokeStyle = borderColor;

    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (chartHeight / 4) * i;

      ctx.beginPath();

      ctx.moveTo(padding.left, y);

      ctx.lineTo(width - padding.right, y);

      ctx.stroke();

      const value = maxValue - (maxValue / 4) * i;

      ctx.textAlign = "right";

      ctx.textBaseline = "middle";

      ctx.fillText(compactNumber(value), padding.left - 8, y);
    }

    const step = chartWidth / (months.length - 1);

    months.forEach((month, index) => {
      const x = padding.left + step * index;

      ctx.textAlign = "center";

      ctx.textBaseline = "top";

      ctx.fillStyle = textColor;

      ctx.fillText(month.label, x, height - 25);
    });

    function drawLine(key, color) {
      ctx.beginPath();

      months.forEach((month, index) => {
        const x = padding.left + step * index;

        const y =
          padding.top + chartHeight - (month[key] / maxValue) * chartHeight;

        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });

      ctx.strokeStyle = color;

      ctx.lineWidth = 3;

      ctx.lineJoin = "round";

      ctx.lineCap = "round";

      ctx.stroke();

      months.forEach((month, index) => {
        const x = padding.left + step * index;

        const y =
          padding.top + chartHeight - (month[key] / maxValue) * chartHeight;

        ctx.beginPath();

        ctx.arc(x, y, 4, 0, Math.PI * 2);

        ctx.fillStyle = color;

        ctx.fill();
      });
    }

    drawLine("expense", expenseColor);

    drawLine("income", incomeColor);
  }

  function compactNumber(number) {
    if (number >= 100000) {
      return "₹" + (number / 100000).toFixed(1) + "L";
    }

    if (number >= 1000) {
      return "₹" + (number / 1000).toFixed(1) + "k";
    }

    return "₹" + Math.round(number);
  }

  /* =======================================================
     DONUT CHART
  ======================================================= */

  const donutAnimationFrames = new WeakMap();

  function renderDonutChart(animate = false) {
    const totals = categoryTotals(txForMonth(state.viewMonth), "expense");
    setDashboardWidgetVisibility(
      document.getElementById("donutChart"),
      Object.values(totals).some((amount) => amount > 0),
    );

    drawDonut("donutChart", "donutLegend", "donutTooltip", totals, animate);
  }

  function observeDashboardPanels() {
    const panels = document.querySelectorAll("#page-dashboard .panel");

    if (
      !panels.length ||
      !("IntersectionObserver" in window) ||
      isReducedMotion()
    ) {
      return;
    }

    panels.forEach((panel) => {
      panel.classList.add("is-observed");
    });

    panels[0].getBoundingClientRect();

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");

            if (entry.target.classList.contains("panel-donut")) {
              renderDonutChart(true);
            }
          } else {
            entry.target.classList.remove("is-visible");
          }
        });
      },
      {
        threshold: 0.12,
      },
    );

    panels.forEach((panel) => {
      observer.observe(panel);
    });
  }

  function drawDonut(canvasId, legendId, tooltipId, totals, animate = false) {
    const canvas = document.getElementById(canvasId);

    const legend = document.getElementById(legendId);

    if (!canvas || !legend) {
      return;
    }

    const previousFrame = donutAnimationFrames.get(canvas);

    if (previousFrame !== undefined) {
      cancelAnimationFrame(previousFrame);
      donutAnimationFrames.delete(canvas);
    }

    legend.classList.toggle("is-animated", animate && !isReducedMotion());

    const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);

    const total = entries.reduce((sum, item) => sum + item[1], 0);

    if (total <= 0) {
      legend.innerHTML = `<li class="donut-empty">
          No expenses logged for this month.
        </li>`;
    } else {
      legend.innerHTML = entries
        .map(([category, amount], index) => {
          const meta = categoryMeta(category);

          const percent = Math.round((amount / total) * 100);

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
        })
        .join("");
    }

    const size = 180;

    const dpr = window.devicePixelRatio || 1;

    canvas.width = size * dpr;

    canvas.height = size * dpr;

    canvas.style.width = size + "px";

    canvas.style.height = size + "px";

    const ctx = canvas.getContext("2d");

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.clearRect(0, 0, size, size);

    const center = size / 2;

    const outerRadius = 78;

    const innerRadius = 50;

    if (total <= 0) {
      ctx.beginPath();

      ctx.arc(center, center, outerRadius, 0, Math.PI * 2);

      ctx.fillStyle = cssVar("--border-subtle") || "#e5e7eb";

      ctx.fill();

      ctx.beginPath();

      ctx.arc(center, center, innerRadius, 0, Math.PI * 2);

      ctx.fillStyle = cssVar("--surface") || "#fff";

      ctx.fill();

      ctx.fillStyle = cssVar("--text-faint") || "#999";

      ctx.font = "600 12px sans-serif";

      ctx.textAlign = "center";

      ctx.textBaseline = "middle";

      ctx.fillText("₹0 Spent", center, center);

      return;
    }

    function drawChart(progress) {
      ctx.clearRect(0, 0, size, size);

      let startAngle = -Math.PI / 2;
      let sweptAngle = 0;
      const visibleSweep = Math.PI * 2 * progress;

      entries.forEach(([category, amount]) => {
        const angle = (amount / total) * Math.PI * 2;
        const visibleAngle = Math.min(
          angle,
          Math.max(0, visibleSweep - sweptAngle),
        );

        if (visibleAngle > 0) {
          ctx.beginPath();
          ctx.moveTo(center, center);
          ctx.arc(
            center,
            center,
            outerRadius,
            startAngle,
            startAngle + visibleAngle,
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
      const progress = clamp((now - startTime) / duration, 0, 1);
      const easedProgress = 1 - Math.pow(1 - progress, 3);

      drawChart(easedProgress);

      if (progress < 1) {
        donutAnimationFrames.set(canvas, requestAnimationFrame(animateChart));
      } else {
        donutAnimationFrames.delete(canvas);
      }
    }

    donutAnimationFrames.set(canvas, requestAnimationFrame(animateChart));
  }

  /* =======================================================
     INSIGHTS
  ======================================================= */

  function renderInsights(list, income, expense) {
    const element = document.getElementById("insightList");

    if (!element) return;

    const insights = [];

    const totals = categoryTotals(list, "expense");

    const categories = Object.entries(totals).sort((a, b) => b[1] - a[1]);

    if (categories.length && expense > 0) {
      const [category, amount] = categories[0];

      const percent = Math.round((amount / expense) * 100);

      insights.push(
        `Your highest spending category is <strong>${escapeHtml(category)}</strong> (${percent}% of monthly expenses).`,
      );
    }

    const budget = Number(state.settings.budget) || 0;

    if (budget > 0) {
      const used = (expense / budget) * 100;

      if (used >= 100) {
        insights.push("You have exceeded your monthly budget.");
      } else if (used >= 80) {
        insights.push(
          `You have used <strong>${Math.round(used)}%</strong> of your budget.`,
        );
      } else {
        insights.push(
          `You're within your budget with <strong>${Math.round(100 - used)}%</strong> remaining.`,
        );
      }
    }

    if (income > 0) {
      const savingRate = Math.round(((income - expense) / income) * 100);

      insights.push(
        `Your current saving rate is <strong>${savingRate}%</strong>.`,
      );
    }

    if (expense > income && income > 0) {
      insights.push("Your expenses exceed your income this month.");
    }

    if (income === 0 && expense > 0) {
      insights.push("You have logged expenses without recording income.");
    }

    if (list.length === 0) {
      insights.push(
        "No activity recorded for this month yet. Click '+ Add Transaction' to start tracking.",
      );
    }

    element.innerHTML = insights
      .map(
        (text) =>
          `<li>
              <span class="ins-icon">&#9673;</span>
              <span>${text}</span>
            </li>`,
      )
      .join("");
    setDashboardWidgetVisibility(element, list.length > 0 || budget > 0);
  }

  /* =======================================================
     RECENT TRANSACTIONS
  ======================================================= */

  function renderRecentList() {
    const list = document.getElementById("recentList");

    if (!list) return;

    const recent = [...state.transactions]
      .sort((a, b) =>
        (b.date + (b.createdAt || 0)).localeCompare(
          a.date + (a.createdAt || 0),
        ),
      )
      .slice(0, 5);

    if (!recent.length) {
      list.innerHTML = `<li class="empty-inline">
          No transactions yet. Click "+ Add Transaction" above!
        </li>`;

      return;
    }

    list.innerHTML = recent
      .map((transaction) => {
        const meta = categoryMeta(transaction.category);

        const income = transaction.type === "income";

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
                  ${escapeHtml(initials(transaction.category))}
                </span>

                <span class="tx-meta">

                  <span class="tx-title">
                    ${escapeHtml(transaction.title)}
                  </span>

                  <span class="tx-sub">
                    ${escapeHtml(transaction.category)}
                    &bull;
                    ${formatDateDisplay(transaction.date)}
                  </span>

                </span>

                <span
                  class="tx-amount ${income ? "is-income" : "is-expense"}"
                >
                  ${income ? "+" : "-"}
                  ${formatCurrency(transaction.amount)}
                </span>

              </li>
            `;
      })
      .join("");

    list.querySelectorAll("li[data-id]").forEach((element) => {
      element.addEventListener("click", () =>
        openModalForEdit(element.dataset.id),
      );
    });
  }

  /* =======================================================
     TRANSACTIONS PAGE
  ======================================================= */

  function populateFilterOptions() {
    const categorySelect = document.getElementById("filterCategory");

    const monthSelect = document.getElementById("filterMonth");

    if (!categorySelect || !monthSelect) {
      return;
    }

    const oldCategory = categorySelect.value || "all";

    const oldMonth = monthSelect.value || "all";

    const categories = [
      ...new Set(state.transactions.map((t) => t.category).filter(Boolean)),
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
            </option>`,
        )
        .join("");

    if (categories.includes(oldCategory)) {
      categorySelect.value = oldCategory;
    }

    const months = [
      ...new Set(
        state.transactions
          .map(txMonthKey)
          .filter((month) => month.length === 7),
      ),
    ]
      .sort()
      .reverse();

    monthSelect.innerHTML =
      `<option value="all">
        All Months
      </option>` +
      months
        .map((month) => {
          const [year, monthNumber] = month.split("-");

          const label = `${MONTH_NAMES[Number(monthNumber) - 1]} ${year}`;

          return `
              <option value="${month}">
                ${label}
              </option>
            `;
        })
        .join("");

    if (months.includes(oldMonth)) {
      monthSelect.value = oldMonth;
    }
  }

  function getFilteredTransactions() {
    const search =
      document.getElementById("searchInput")?.value.trim().toLowerCase() || "";

    const type = document.getElementById("filterType")?.value || "all";

    const category = document.getElementById("filterCategory")?.value || "all";

    const month = document.getElementById("filterMonth")?.value || "all";

    return state.transactions

      .filter((t) => type === "all" || t.type === type)

      .filter((t) => category === "all" || t.category === category)

      .filter((t) => month === "all" || txMonthKey(t) === month)

      .filter((t) => {
        if (!search) {
          return true;
        }

        return (
          String(t.title || "")
            .toLowerCase()
            .includes(search) ||
          String(t.category || "")
            .toLowerCase()
            .includes(search) ||
          String(t.note || "")
            .toLowerCase()
            .includes(search) ||
          String(t.paymentMethod || "")
            .toLowerCase()
            .includes(search) ||
          getIncomeSourceLabel(t).toLowerCase().includes(search) ||
          String(t.amount || "").includes(search)
        );
      })

      .sort((a, b) =>
        (b.date + (b.createdAt || 0)).localeCompare(
          a.date + (a.createdAt || 0),
        ),
      );
  }

  function renderTransactionsPage() {
    populateFilterOptions();

    const allRows = getFilteredTransactions();

    const tbody = document.getElementById("txTableBody");
    const empty = document.getElementById("txEmptyState");
    const noMatch = document.getElementById("txNoMatchState");
    const table = document.getElementById("txTable");
    const search = document.getElementById("searchInput");
    const clear = document.getElementById("searchClearBtn");

    if (!tbody || !empty || !noMatch || !table) return;

    if (clear && search) {
      clear.hidden = !search.value;
    }

    if (state.transactions.length === 0) {
      tbody.innerHTML = "";
      empty.hidden = false;
      noMatch.hidden = true;
      table.style.display = "none";
      updateTxPagination(0);
      return;
    }

    table.style.display = "";

    if (!allRows.length) {
      tbody.innerHTML = "";
      empty.hidden = true;
      noMatch.hidden = false;
      updateTxPagination(0);
      return;
    }

    empty.hidden = true;
    noMatch.hidden = true;

    // Slice for 7 items per page
    const totalCount = allRows.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / state.txPageSize));
    if (state.txCurrentPage > totalPages) {
      state.txCurrentPage = totalPages;
    }

    const startIndex = (state.txCurrentPage - 1) * state.txPageSize;
    const pagedRows = allRows.slice(startIndex, startIndex + state.txPageSize);

    updateTxPagination(totalCount);

    tbody.innerHTML = pagedRows
      .map((transaction) => {
        const meta = categoryMeta(transaction.category);
        const income = transaction.type === "income";

        return `
          <tr data-id="${escapeHtml(transaction.id)}">
            <td>
              <div class="tx-cell-title">
                <span class="tx-icon" style="background:${meta.color}22; color:${meta.color}">
                  ${escapeHtml(initials(transaction.category))}
                </span>
                <span class="tx-title">${escapeHtml(transaction.title)}</span>
              </div>
            </td>
            <td>
              <span class="cat-pill" style="background:${meta.color}22; color:${meta.color}">
                ${escapeHtml(transaction.category)}
              </span>
            </td>
            <td>${formatDateDisplay(transaction.date)}</td>
            <td>${escapeHtml(getIncomeSourceLabel(transaction))}</td>
            <td class="tx-amount ${income ? "is-income" : "is-expense"}" style="text-align:right;">
              ${income ? "+" : "-"}${formatCurrency(transaction.amount)}
            </td>
            <td>
              <div class="row-actions">
                <button type="button" class="edit-btn" data-id="${escapeHtml(transaction.id)}">Edit</button>
                <button type="button" class="del-btn" data-id="${escapeHtml(transaction.id)}">Delete</button>
              </div>
            </td>
          </tr>
        `;
      })
      .join("");

    tbody.querySelectorAll(".edit-btn").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        openModalForEdit(button.dataset.id);
      });
    });

    tbody.querySelectorAll(".del-btn").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        confirmDeleteTransaction(button.dataset.id);
      });
    });

    tbody.querySelectorAll("tr").forEach((row) => {
      row.addEventListener("click", () => openModalForEdit(row.dataset.id));
    });
  }

  function updateTxPagination(totalCount) {
    const totalPages = Math.max(1, Math.ceil(totalCount / state.txPageSize));
    const showingText = document.getElementById("paginationShowingText");
    const pageIndicator = document.getElementById("txCurrentPageIndicator");
    const prevBtn = document.getElementById("txPrevPageBtn");
    const nextBtn = document.getElementById("txNextPageBtn");

    if (showingText) {
      const from =
        totalCount === 0 ? 0 : (state.txCurrentPage - 1) * state.txPageSize + 1;
      const to = Math.min(state.txCurrentPage * state.txPageSize, totalCount);
      showingText.textContent = `${from}-${to} of ${totalCount}`;
    }
    if (pageIndicator) {
      pageIndicator.textContent = `Page ${state.txCurrentPage}`;
    }
    if (prevBtn) {
      prevBtn.disabled = state.txCurrentPage <= 1;
    }
    if (nextBtn) {
      nextBtn.disabled = state.txCurrentPage >= totalPages || totalCount === 0;
    }
  }

  function confirmDeleteTransaction(id) {
    const transactionToDelete = state.transactions.find(
      (transaction) => transaction.id === id,
    );

    if (
      transactionToDelete?.type === "income" &&
      calculateMoneyBalances(
        state.transactions.filter((transaction) => transaction.id !== id),
      ).savingsCents < 0
    ) {
      showToast(
        "This income is needed to cover expenses already paid from Savings.",
        "warning",
      );
      return;
    }

    if (
      transactionToDelete?.type === "income" &&
      !transactionCountsAsSavings(transactionToDelete)
    ) {
      const monthTransactions = state.transactions.filter(
        (transaction) =>
          txMonthKey(transaction) === txMonthKey(transactionToDelete) &&
          transaction.id !== id,
      );
      const incomeCents = monthTransactions
        .filter(
          (transaction) =>
            transaction.type === "income" &&
            !transactionCountsAsSavings(transaction),
        )
        .reduce(
          (sum, transaction) =>
            sum + Math.round(Number(transaction.amount || 0) * 100),
          0,
        );
      const expenseCents = monthTransactions
        .filter(
          (transaction) =>
            transaction.type === "expense" &&
            getTransactionMoneySource(transaction) !== "savings",
        )
        .reduce(
          (sum, transaction) =>
            sum + Math.round(Number(transaction.amount || 0) * 100),
          0,
        );

      const savingsTransfersCents = state.studentFeatures.savingsTransfers
        .filter(
          (transfer) =>
            transfer.date.slice(0, 7) === txMonthKey(transactionToDelete),
        )
        .reduce(
          (sum, transfer) =>
            sum + Math.round(Number(transfer.amount || 0) * 100),
          0,
        );

      if (expenseCents + savingsTransfersCents > incomeCents) {
        showToast(
          "This income is needed to cover expenses already recorded for the month. Reduce or remove those expenses before deleting it.",
          "warning",
        );
        return;
      }
    }

    openConfirm(
      "Are you sure you want to delete this transaction?",
      function () {
        state.transactions = state.transactions.filter(
          (transaction) => transaction.id !== id,
        );

        Store.queueTransactionDelete(id);

        Store.saveTransactions(state.transactions);

        renderCurrentPage();

        showToast("Transaction deleted successfully.", "success");

        closeConfirm();
      },
    );
  }

  /* =======================================================
     ADD / EDIT TRANSACTION
  ======================================================= */

  function populateCategorySelect(type, customCategory = null) {
    const select = document.getElementById("txCategory");

    if (!select) return;

    const existingCategories =
      type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    const selectedStudentType = STUDENT_TYPE_OPTIONS.find(
      (option) => option.value === state.studentFeatures.studentMode,
    );
    const recommendedNames =
      type === "expense"
        ? selectedStudentType?.recommendedCategories || []
        : ["Money From Home"];
    const recommendedCategories = recommendedNames.map((name) => ({
      name,
      color: categoryMeta(name).color,
    }));
    const categories = [
      ...recommendedCategories,
      ...existingCategories.filter(
        (category) => !recommendedNames.includes(category.name),
      ),
    ];

    let options = categories.map(
      (category) =>
        `<option value="${escapeHtml(category.name)}">
            ${escapeHtml(category.name)}
          </option>`,
    );

    if (
      customCategory &&
      !categories.some(
        (category) =>
          category.name.toLowerCase() === customCategory.toLowerCase(),
      )
    ) {
      options.push(
        `<option value="${escapeHtml(customCategory)}">
          ${escapeHtml(customCategory)}
        </option>`,
      );
    }

    select.innerHTML = options.join("");
  }

  function setModalType(type, customCategory = null) {
    document
      .getElementById("typeExpenseBtn")
      ?.classList.toggle("is-active", type === "expense");

    document
      .getElementById("typeIncomeBtn")
      ?.classList.toggle("is-active", type === "income");

    const icon = document.getElementById("modalTypeBadgeIcon");

    if (icon) {
      icon.textContent = type === "income" ? "💰" : "💸";
    }

    populateCategorySelect(type, customCategory);

    syncTransactionSourceControls(type);
  }

  function syncTransactionSourceControls(
    type,
    source = null,
    savingsBucket = null,
    savingsPlatform = null,
    savingsPlatformName = "",
    incomeSource = null,
    incomeSourceName = "",
  ) {
    const sourceSelect = document.getElementById("txMoneySource");
    const sourceLabel = document.getElementById("txMoneySourceLabel");
    const savingsBucketLabel = document.getElementById("txSavingsBucketLabel");
    const savingsBucketSelect = document.getElementById("txSavingsBucket");
    const paymentMethod = document.getElementById("txPayment");

    if (sourceLabel) {
      sourceLabel.textContent =
        type === "income" ? "Money Received In" : "Pay from";
    }
    if (savingsBucketLabel) {
      savingsBucketLabel.textContent =
        type === "income" ? "Savings type" : "Savings source";
    }
    if (savingsBucketSelect) {
      savingsBucketSelect.value = normalizeSavingsBucket(savingsBucket);
    }
    const onlineSourceSelect = document.getElementById("txIncomeOnlineSource");
    const savingsSourceSelect = document.getElementById(
      "txIncomeSavingsSource",
    );
    const normalizedIncomeSource = normalizeIncomeSource(incomeSource);
    if (onlineSourceSelect) {
      onlineSourceSelect.value =
        type === "income" && source === "online"
          ? normalizedIncomeSource || ""
          : "";
    }
    if (savingsSourceSelect) {
      savingsSourceSelect.value =
        type === "income" && source === "savings"
          ? normalizedIncomeSource || ""
          : "";
    }
    document.getElementById("txIncomeOnlineOther").value =
      type === "income" &&
      source === "online" &&
      normalizedIncomeSource === "other"
        ? normalizeIncomeSourceName(incomeSourceName)
        : "";
    document.getElementById("txIncomeSavingsOther").value =
      type === "income" &&
      source === "savings" &&
      normalizedIncomeSource === "other"
        ? normalizeIncomeSourceName(incomeSourceName)
        : "";
    if (sourceSelect) {
      const validSource = ["cash", "online", "savings"].includes(source);
      sourceSelect.value = validSource
        ? source
        : normalizeMoneySource(type, source, paymentMethod?.value);
    }
    syncTransactionSavingsBucketControls(savingsPlatform, savingsPlatformName);
  }

  function updateTransactionSavingsPlatformOptions(
    selectedPlatform = null,
    selectedPlatformName = "",
  ) {
    const select = document.getElementById("txSavingsPlatform");
    const balances = calculateMoneyBalances(
      state.transactions.filter(
        (transaction) => transaction.id !== state.editingId,
      ),
    );
    const options = balances.onlinePlatforms.filter(
      (entry) =>
        entry.amountCents > 0 &&
        !NON_SPENDABLE_SAVINGS_PLATFORMS.has(entry.platform),
    );
    if (!select) return balances;
    select.innerHTML = options.length
      ? '<option value="">Select a platform</option>' +
        options
          .map(
            (entry, index) => `
          <option
            value="${index}"
            data-platform="${escapeHtml(entry.platform)}"
            data-platform-name="${escapeHtml(entry.customPlatformName)}"
          >${escapeHtml(
            getSavingsPlatformLabel(entry.platform, entry.customPlatformName),
          )} · ${escapeHtml(formatCurrency(entry.amountCents / 100))}</option>
        `,
          )
          .join("")
      : '<option value="">No spendable Online Savings available</option>';
    const matchingIndex = options.findIndex(
      (entry) =>
        entry.platform === selectedPlatform &&
        entry.customPlatformName === selectedPlatformName,
    );
    select.value = matchingIndex >= 0 ? String(matchingIndex) : "";
    return balances;
  }

  function syncTransactionSavingsBucketControls(
    selectedPlatform = null,
    selectedPlatformName = "",
  ) {
    const type = currentModalType();
    const source = document.getElementById("txMoneySource")?.value;
    const usingSavings = source === "savings";
    const bucket = document.getElementById("txSavingsBucket")?.value || "cash";
    const bucketRow = document.getElementById("txSavingsBucketRow");
    const platformRow = document.getElementById("txSavingsPlatformRow");
    const paymentRow = document.getElementById("txPaymentRow");
    const onlineSourceRow = document.getElementById("txIncomeOnlineSourceRow");
    const onlineOtherRow = document.getElementById("txIncomeOnlineOtherRow");
    const savingsSourceRow = document.getElementById(
      "txIncomeSavingsSourceRow",
    );
    const savingsOtherRow = document.getElementById("txIncomeSavingsOtherRow");
    const onlineIncomeSource = document.getElementById(
      "txIncomeOnlineSource",
    )?.value;
    const savingsIncomeSource = document.getElementById(
      "txIncomeSavingsSource",
    )?.value;

    if (bucketRow) bucketRow.hidden = !usingSavings;
    if (platformRow) {
      platformRow.hidden =
        type !== "expense" || !usingSavings || bucket !== "online";
    }
    if (paymentRow) {
      paymentRow.hidden = type === "income";
    }
    if (onlineSourceRow) {
      onlineSourceRow.hidden = type !== "income" || source !== "online";
    }
    if (onlineOtherRow) {
      onlineOtherRow.hidden =
        type !== "income" ||
        source !== "online" ||
        onlineIncomeSource !== "other";
    }
    if (savingsSourceRow) {
      savingsSourceRow.hidden =
        type !== "income" || source !== "savings" || bucket !== "online";
    }
    if (savingsOtherRow) {
      savingsOtherRow.hidden =
        type !== "income" ||
        source !== "savings" ||
        bucket !== "online" ||
        savingsIncomeSource !== "other";
    }

    const balances = updateTransactionSavingsPlatformOptions(
      selectedPlatform,
      selectedPlatformName,
    );
    const bucketHelp = document.getElementById("txSavingsBucketHelp");
    if (bucketHelp) {
      if (type === "expense") {
        const available =
          bucket === "cash"
            ? balances.cashSavingsCents
            : balances.onlineSpendableSavingsCents;
        bucketHelp.textContent = `Available spendable Savings: ${formatCurrency(
          Math.max(0, available) / 100,
        )}. Digital Gold and Mutual Fund cannot be spent here.`;
      }
    }
    updateTransactionSourceHelp(type);
    clearTransactionSavingsError();
    clearIncomeSourceErrors();
  }

  function updateTransactionSourceHelp(type) {
    const sourceHelp = document.getElementById("txMoneySourceHelp");
    if (!sourceHelp) return;

    const source = document.getElementById("txMoneySource")?.value;
    sourceHelp.textContent =
      type === "income"
        ? "Choose Cash, an online source, or a Savings destination."
        : source === "savings"
          ? "Savings is used without reducing Cash or Online."
          : "Choose the Cash or Online balance used for this transaction.";
  }

  function syncMoneySourceToPaymentMethod() {
    const sourceSelect = document.getElementById("txMoneySource");
    const paymentMethod = document.getElementById("txPayment");
    if (!sourceSelect || !paymentMethod) return;
    if (currentModalType() === "income") return;

    if (sourceSelect.value === "savings") {
      if (currentModalType() === "income") {
        document.getElementById("txSavingsBucket").value =
          moneySourceFromPaymentMethod(paymentMethod.value);
        syncTransactionSavingsBucketControls();
      }
      return;
    }

    sourceSelect.value = moneySourceFromPaymentMethod(paymentMethod.value);
    syncTransactionSavingsBucketControls();
    clearTransactionSavingsError();
  }

  function clearIncomeSourceErrors() {
    [
      ["txIncomeOnlineSourceError", "txIncomeOnlineSource"],
      ["txIncomeSavingsSourceError", "txIncomeSavingsSource"],
    ].forEach(([errorId, controlId]) => {
      const error = document.getElementById(errorId);
      if (error) {
        error.textContent = "";
        error.hidden = true;
      }
      document.getElementById(controlId)?.removeAttribute("aria-invalid");
    });
    document
      .getElementById("txIncomeOnlineOther")
      ?.removeAttribute("aria-invalid");
    document
      .getElementById("txIncomeSavingsOther")
      ?.removeAttribute("aria-invalid");
  }

  function showIncomeSourceError(message, errorId, controlId) {
    const error = document.getElementById(errorId);
    if (error) {
      error.textContent = message;
      error.hidden = false;
    }
    const control = document.getElementById(controlId);
    control?.setAttribute("aria-invalid", "true");
    control?.focus();
  }

  function clearTransactionSavingsError() {
    const errorElement = document.getElementById("txMoneySourceError");
    if (errorElement) {
      errorElement.textContent = "";
      errorElement.hidden = true;
    }
    document.getElementById("txMoneySource")?.removeAttribute("aria-invalid");
    document.getElementById("txSavingsBucket")?.removeAttribute("aria-invalid");
    document
      .getElementById("txSavingsPlatform")
      ?.removeAttribute("aria-invalid");
  }

  function showTransactionSavingsError(message) {
    const errorElement = document.getElementById("txMoneySourceError");
    if (errorElement) {
      errorElement.textContent = message;
      errorElement.hidden = false;
    }
    const sourceSelect = document.getElementById("txMoneySource");
    const savingsBucket = document.getElementById("txSavingsBucket");
    const invalidControl =
      sourceSelect?.value === "savings"
        ? currentModalType() === "expense" && savingsBucket?.value === "online"
          ? document.getElementById("txSavingsPlatform")
          : savingsBucket
        : sourceSelect;
    invalidControl?.setAttribute("aria-invalid", "true");
    invalidControl?.focus();
  }

  function currentModalType() {
    return document
      .getElementById("typeIncomeBtn")
      ?.classList.contains("is-active")
      ? "income"
      : "expense";
  }

  function openModalForAdd() {
    state.editingId = null;

    const submitButton = document.getElementById("txSubmitBtn");
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.dataset.loading = "false";
      submitButton.textContent = "Save Transaction";
    }

    document.getElementById("txModalTitle").textContent = "Add Transaction";

    document.getElementById("txSubmitBtn").textContent = "Save Transaction";

    document.getElementById("txForm").reset();

    document.getElementById("txId").value = "";

    setModalType("expense");

    document.getElementById("txDate").value = todayISO();

    document.getElementById("txPayment").value = "UPI";

    openModal();
  }

  function openModalForEdit(id) {
    const transaction = state.transactions.find((t) => t.id === id);

    if (!transaction) return;

    state.editingId = id;

    const submitButton = document.getElementById("txSubmitBtn");
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.dataset.loading = "false";
      submitButton.textContent = "Update Transaction";
    }

    document.getElementById("txModalTitle").textContent = "Edit Transaction";

    document.getElementById("txSubmitBtn").textContent = "Update Transaction";

    document.getElementById("txId").value = transaction.id;

    setModalType(transaction.type, transaction.category);

    document.getElementById("txCategory").value = transaction.category;

    document.getElementById("txAmount").value = transaction.amount;

    document.getElementById("txTitle").value = transaction.title;

    document.getElementById("txDate").value = transaction.date;

    document.getElementById("txPayment").value =
      transaction.paymentMethod || "UPI";

    syncTransactionSourceControls(
      transaction.type,
      transaction.type === "income" && transactionCountsAsSavings(transaction)
        ? "savings"
        : (transaction.moneySource ?? transaction.money_source),
      transaction.type === "income" && transactionCountsAsSavings(transaction)
        ? getTransactionMoneySource(transaction)
        : (transaction.savingsBucket ?? transaction.savings_bucket),
      transaction.savingsPlatform ?? transaction.savings_platform,
      transaction.savingsPlatformName ||
        transaction.savings_platform_name ||
        "",
      transaction.incomeSource ?? transaction.income_source,
      transaction.incomeSourceName ?? transaction.income_source_name,
    );

    document.getElementById("txNote").value = transaction.note || "";

    openModal();
  }

  function openModal() {
    const overlay = document.getElementById("txModalOverlay");

    if (!overlay) return;

    closeActiveModals(overlay);

    overlay.classList.add("is-open");

    overlay.setAttribute("aria-hidden", "false");
  }

  function closeModal() {
    const overlay = document.getElementById("txModalOverlay");

    if (overlay) {
      overlay.classList.remove("is-open");

      overlay.setAttribute("aria-hidden", "true");
    }

    const submitButton = document.getElementById("txSubmitBtn");
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.dataset.loading = "false";
      submitButton.textContent = state.editingId
        ? "Update Transaction"
        : "Save Transaction";
    }

    state.editingId = null;
  }

  function handleTxFormSubmit(event) {
    event.preventDefault();

    const submitButton = document.getElementById("txSubmitBtn");

    if (state.transactionSubmitInFlight) {
      return;
    }

    const type = currentModalType();

    const amount = Number(document.getElementById("txAmount").value);

    const title = document.getElementById("txTitle").value.trim();

    const category = document.getElementById("txCategory").value;

    const date = document.getElementById("txDate").value;

    const sourceChoice = document.getElementById("txMoneySource").value;
    const selectedSavingsBucket =
      sourceChoice === "savings"
        ? normalizeSavingsBucket(
            document.getElementById("txSavingsBucket").value,
          )
        : null;
    const incomeSource =
      type === "income"
        ? normalizeIncomeSource(
            sourceChoice === "online"
              ? document.getElementById("txIncomeOnlineSource").value
              : sourceChoice === "savings" && selectedSavingsBucket === "online"
                ? document.getElementById("txIncomeSavingsSource").value
                : null,
          )
        : null;
    const incomeSourceName =
      type === "income" && incomeSource === "other"
        ? normalizeIncomeSourceName(
            sourceChoice === "online"
              ? document.getElementById("txIncomeOnlineOther").value
              : document.getElementById("txIncomeSavingsOther").value,
          )
        : "";
    const incomePaymentMethod =
      sourceChoice === "cash" ||
      (sourceChoice === "savings" && selectedSavingsBucket === "cash")
        ? "Cash"
        : incomeSource === "gpay" || incomeSource === "phonepe"
          ? "UPI"
          : incomeSource === "bank_transfer" || incomeSource === "bank_account"
            ? "Bank Transfer"
            : incomeSource === "other" || incomeSource === "mutual_fund"
              ? "Other"
              : "UPI";
    const paymentMethod =
      type === "income"
        ? incomePaymentMethod
        : document.getElementById("txPayment").value;
    const moneySource =
      type === "expense" && sourceChoice === "savings"
        ? "savings"
        : normalizeMoneySource(
            type,
            sourceChoice === "savings" ? selectedSavingsBucket : sourceChoice,
            paymentMethod,
          );
    const savingsBucket =
      type === "expense" && moneySource === "savings"
        ? selectedSavingsBucket
        : null;
    const selectedSavingsPlatform =
      document.getElementById("txSavingsPlatform")?.selectedOptions[0];
    const savingsPlatform =
      type === "expense" &&
      moneySource === "savings" &&
      savingsBucket === "online"
        ? selectedSavingsPlatform?.dataset.platform || null
        : null;
    const savingsPlatformName = savingsPlatform
      ? selectedSavingsPlatform?.dataset.platformName || ""
      : "";

    const countAsSavings = type === "income" && sourceChoice === "savings";

    clearIncomeSourceErrors();

    const note = document.getElementById("txNote").value.trim();

    if (!Number.isFinite(amount) || amount <= 0) {
      showToast("Please enter a valid amount greater than ₹0.", "error");

      return;
    }

    if (!title) {
      showToast("Please enter a title or description.", "error");

      return;
    }

    if (!date) {
      showToast("Please select a date.", "error");

      return;
    }

    if (type === "income" && sourceChoice === "online" && !incomeSource) {
      showIncomeSourceError(
        "Choose an online source.",
        "txIncomeOnlineSourceError",
        "txIncomeOnlineSource",
      );
      return;
    }
    if (
      type === "income" &&
      sourceChoice === "savings" &&
      selectedSavingsBucket === "online" &&
      !incomeSource
    ) {
      showIncomeSourceError(
        "Choose where this money is saved.",
        "txIncomeSavingsSourceError",
        "txIncomeSavingsSource",
      );
      return;
    }
    if (type === "income" && incomeSource === "other" && !incomeSourceName) {
      const onlineOther = sourceChoice === "online";
      showIncomeSourceError(
        "Enter the custom source name.",
        onlineOther
          ? "txIncomeOnlineSourceError"
          : "txIncomeSavingsSourceError",
        onlineOther ? "txIncomeOnlineOther" : "txIncomeSavingsOther",
      );
      return;
    }

    const roundedAmount = Math.round(amount * 100) / 100;
    clearTransactionSavingsError();

    const editedTransaction = state.editingId
      ? state.transactions.find(
          (transaction) => transaction.id === state.editingId,
        )
      : null;
    const candidateTransaction = {
      ...(editedTransaction || {}),
      id: editedTransaction?.id || "new-transaction",
      type,
      amount: roundedAmount,
      paymentMethod,
      moneySource,
      countAsSavings,
      savingsBucket,
      savingsPlatform,
      savingsPlatformName,
      incomeSource,
      incomeSourceName,
      date,
    };
    const candidateTransactions = editedTransaction
      ? state.transactions.map((transaction) =>
          transaction.id === editedTransaction.id
            ? candidateTransaction
            : transaction,
        )
      : [...state.transactions, candidateTransaction];
    const projectedSavingsCents = calculateMoneyBalances(
      candidateTransactions,
    ).savingsCents;

    if (type === "expense" && moneySource === "savings") {
      const savingsWithoutEditedTransaction = calculateMoneyBalances(
        state.transactions.filter(
          (transaction) => transaction.id !== state.editingId,
        ),
      );
      if (savingsBucket === "online" && !savingsPlatform) {
        showTransactionSavingsError(
          "Choose an available Online Savings platform.",
        );
        return;
      }
      const availableSavingsCents = Math.max(
        0,
        getSavingsBucketBalanceCents(
          savingsWithoutEditedTransaction,
          savingsBucket,
          savingsPlatform,
          savingsPlatformName,
          true,
        ),
      );

      if (Math.round(roundedAmount * 100) > availableSavingsCents) {
        showTransactionSavingsError(
          `Insufficient savings balance. Available savings: ${formatCurrency(
            availableSavingsCents / 100,
          )}`,
        );
        return;
      }
      const savingsAfterExpense = calculateMoneyBalances(candidateTransactions);
      const selectedBalanceAfterExpense = getSavingsBucketBalanceCents(
        savingsAfterExpense,
        savingsBucket,
        savingsPlatform,
        savingsPlatformName,
        true,
      );
      if (
        selectedBalanceAfterExpense < 0 ||
        savingsAfterExpense.savingsCents < 0
      ) {
        showTransactionSavingsError(
          "This expense date would make the selected Savings balance negative. Choose a later date or a different source.",
        );
        return;
      }
    } else if (projectedSavingsCents < 0) {
      showTransactionSavingsError(
        "This change would make tracked Savings negative. Keep the income or remove savings expenses first.",
      );
      return;
    }

    if (type === "expense" && moneySource !== "savings") {
      const monthTransactions = state.transactions.filter(
        (transaction) =>
          txMonthKey(transaction) === date.slice(0, 7) &&
          transaction.id !== state.editingId,
      );

      const incomeCents = monthTransactions
        .filter((transaction) => transaction.type === "income")
        .filter((transaction) => !transactionCountsAsSavings(transaction))
        .reduce(
          (total, transaction) =>
            total + Math.round(Number(transaction.amount || 0) * 100),
          0,
        );

      const expenseCents = monthTransactions
        .filter(
          (transaction) =>
            transaction.type === "expense" &&
            getTransactionMoneySource(transaction) !== "savings",
        )
        .reduce(
          (total, transaction) =>
            total + Math.round(Number(transaction.amount || 0) * 100),
          0,
        );
      const transferCents = state.studentFeatures.savingsTransfers
        .filter((transfer) => transfer.date.slice(0, 7) === date.slice(0, 7))
        .reduce(
          (total, transfer) =>
            total + Math.round(Number(transfer.amount || 0) * 100),
          0,
        );

      const allowedCents = incomeCents - expenseCents - transferCents;

      if (Math.round(roundedAmount * 100) > allowedCents) {
        showToast(
          `This expense would exceed money received for the month. Add income first or reduce the expense. You can spend up to ${formatCurrency(
            Math.max(0, allowedCents) / 100,
          )} more.`,
          "warning",
        );

        return;
      }
    }

    if (state.editingId) {
      const existingTransaction = state.transactions.find(
        (transaction) => transaction.id === state.editingId,
      );
      if (existingTransaction?.type === "income") {
        const oldMonth = txMonthKey(existingTransaction);
        const adjustedMonthTransactions = state.transactions.filter(
          (transaction) =>
            txMonthKey(transaction) === oldMonth &&
            transaction.id !== state.editingId,
        );
        const existingAccountExpenses = adjustedMonthTransactions
          .filter(
            (transaction) =>
              transaction.type === "expense" &&
              getTransactionMoneySource(transaction) !== "savings",
          )
          .reduce(
            (sum, transaction) =>
              sum + Math.round(Number(transaction.amount || 0) * 100),
            0,
          );
        const existingSavingsTransfers = state.studentFeatures.savingsTransfers
          .filter((transfer) => transfer.date.slice(0, 7) === oldMonth)
          .reduce(
            (sum, transfer) =>
              sum + Math.round(Number(transfer.amount || 0) * 100),
            0,
          );
        const adjustedAccountIncome =
          adjustedMonthTransactions
            .filter(
              (transaction) =>
                transaction.type === "income" &&
                !transactionCountsAsSavings(transaction),
            )
            .reduce(
              (sum, transaction) =>
                sum + Math.round(Number(transaction.amount || 0) * 100),
              0,
            ) +
          (type === "income" && !countAsSavings && date.slice(0, 7) === oldMonth
            ? Math.round(roundedAmount * 100)
            : 0);

        if (
          existingAccountExpenses + existingSavingsTransfers >
          adjustedAccountIncome
        ) {
          showToast(
            "This change would leave monthly expenses higher than money received. Keep the income or reduce/remove expenses first.",
            "warning",
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
        const index = state.transactions.findIndex(
          (t) => t.id === state.editingId,
        );

        if (index !== -1) {
          state.transactions[index] = {
            ...state.transactions[index],

            type,

            amount: roundedAmount,

            title,

            category,

            date,

            paymentMethod,

            moneySource,

            countAsSavings,

            savingsBucket,

            savingsPlatform,

            savingsPlatformName,

            incomeSource,

            incomeSourceName,

            note,
          };
        }

        const challengeWarning = getNoSpendPurchaseWarning(
          type,
          category,
          date,
        );
        showToast(
          challengeWarning || "Transaction updated successfully.",
          challengeWarning ? "warning" : "success",
        );
      } else {
        state.transactions.push({
          id: uid(),

          type,

          amount: roundedAmount,

          title,

          category,

          date,

          paymentMethod,

          moneySource,

          countAsSavings,

          savingsBucket,

          savingsPlatform,

          savingsPlatformName,

          incomeSource,

          incomeSourceName,

          note,

          createdAt: Date.now(),
        });

        const challengeWarning = getNoSpendPurchaseWarning(
          type,
          category,
          date,
        );
        showToast(
          challengeWarning ||
            (type === "income"
              ? "Money received recorded!"
              : "Expense logged!"),
          challengeWarning ? "warning" : "success",
        );
      }

      Store.saveTransactions(state.transactions);

      closeModal();

      renderCurrentPage();

      checkMonthlyBudgetAlerts();
    } finally {
      state.transactionSubmitInFlight = false;
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.dataset.loading = "false";
        submitButton.textContent = state.editingId
          ? "Update Transaction"
          : "Save Transaction";
      }
    }
  }

  /* =======================================================
     REPORTS
  ======================================================= */

  function getReportRange() {
    if (state.reportPeriod === "monthly") {
      const start = startOfMonth(state.viewMonth);

      const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);

      return {
        start: toISODate(start),

        end: toISODate(end),

        label: formatMonthLabel(start),
      };
    }

    if (state.reportPeriod === "weekly") {
      const end = new Date();

      const start = new Date(
        end.getFullYear(),
        end.getMonth(),
        end.getDate() - 6,
      );

      return {
        start: toISODate(start),

        end: toISODate(end),

        label: `Last 7 days (${formatDateDisplay(
          toISODate(start),
        )} - ${formatDateDisplay(toISODate(end))})`,
      };
    }

    const start = document.getElementById("reportStartDate")?.value;

    const end = document.getElementById("reportEndDate")?.value;

    if (!start || !end || start > end) {
      return null;
    }

    return {
      start,

      end,

      label: `${formatDateDisplay(start)} - ${formatDateDisplay(end)}`,
    };
  }

  function renderReportsPage() {
    const period = document.getElementById("reportPeriod");

    const custom = document.getElementById("reportCustomDates");

    const monthNav = document.getElementById("reportMonthNav");

    if (period) {
      period.value = state.reportPeriod;
    }

    if (custom) {
      custom.hidden = state.reportPeriod !== "custom";
    }

    if (monthNav) {
      monthNav.hidden = state.reportPeriod !== "monthly";
    }

    const range = getReportRange();

    if (!range) {
      return;
    }

    const list = state.transactions.filter(
      (transaction) =>
        transaction.date >= range.start && transaction.date <= range.end,
    );

    const expenses = list.filter((t) => t.type === "expense");

    const incomes = list.filter((t) => t.type === "income");

    const totalExpense = sumByType(list, "expense");

    const totalIncome = sumByType(list, "income");

    const average = expenses.length ? totalExpense / expenses.length : 0;

    animateValue(
      document.getElementById("repAvgExpense"),
      average,
      formatCurrency,
    );

    const largest = expenses.length
      ? expenses.reduce((max, item) =>
          Number(item.amount) > Number(max.amount) ? item : max,
        )
      : null;

    if (largest) {
      document.getElementById("repLargestExpense").textContent = formatCurrency(
        largest.amount,
      );

      document.getElementById("repLargestExpenseSub").textContent =
        `${largest.title} (${largest.category})`;
    } else {
      document.getElementById("repLargestExpense").textContent = "₹0";

      document.getElementById("repLargestExpenseSub").textContent =
        "No expenses in this period";
    }

    const totals = categoryTotals(list, "expense");

    const categories = Object.entries(totals).sort((a, b) => b[1] - a[1]);

    if (categories.length) {
      const [category, amount] = categories[0];

      document.getElementById("repTopCategory").textContent = category;

      document.getElementById("repTopCategorySub").textContent = `${Math.round(
        (amount / totalExpense) * 100,
      )}% of expenses in this period`;
    } else {
      document.getElementById("repTopCategory").textContent = "—";

      document.getElementById("repTopCategorySub").textContent =
        "No expenses in this period";
    }

    const savingRate =
      totalIncome > 0
        ? Math.round(((totalIncome - totalExpense) / totalIncome) * 100)
        : 0;

    animateValue(
      document.getElementById("repSavingRate"),
      savingRate,
      (n) => Math.round(n) + "%",
    );

    document.getElementById("repSavingRateSub").textContent = range.label;

    const subtitle = document.getElementById("monthlySummarySub");

    if (subtitle) {
      subtitle.textContent = range.label;
    }

    const breakdown = document.getElementById("reportBreakdownSub");

    if (breakdown) {
      breakdown.textContent = `Spending distribution for ${range.label}`;
    }

    drawDonut(
      "reportDonutChart",
      "reportDonutLegend",
      "reportDonutTooltip",
      totals,
      true,
    );

    const rankList = document.getElementById("rankList");

    if (rankList) {
      if (!categories.length) {
        rankList.innerHTML = `<li class="empty-inline">
            No expense records found.
          </li>`;
      } else {
        rankList.innerHTML = categories
          .map(([category, amount], index) => {
            const meta = categoryMeta(category);

            const percent = Math.round((amount / totalExpense) * 100);

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
          })
          .join("");
      }
    }

    const net = totalIncome - totalExpense;

    document.getElementById("msIncome").textContent =
      formatCurrency(totalIncome);

    document.getElementById("msExpense").textContent =
      formatCurrency(totalExpense);

    const netElement = document.getElementById("msNet");

    if (netElement) {
      netElement.textContent =
        (net >= 0 ? "+" : "-") + formatCurrency(Math.abs(net));

      netElement.className = net >= 0 ? "is-income" : "is-expense";
    }

    document.getElementById("msCount").textContent = String(list.length);

    document.getElementById("repMonthLabel").textContent = formatMonthLabel(
      state.viewMonth,
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
            "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
          );
        }

        await loadPdfScript(
          "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.28/jspdf.plugin.autotable.min.js",
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
        "error",
      );
      return;
    }

    const range = getReportRange();

    if (!range) {
      showToast("Choose a valid report date range.", "error");

      return;
    }

    const transactions = state.transactions
      .filter((t) => t.date >= range.start && t.date <= range.end)
      .sort((a, b) =>
        (b.date + (b.createdAt || 0)).localeCompare(
          a.date + (a.createdAt || 0),
        ),
      );

    const income = sumByType(transactions, "income");

    const expense = sumByType(transactions, "expense");

    const net = income - expense;

    const categories = Object.entries(
      categoryTotals(transactions, "expense"),
    ).sort((a, b) => b[1] - a[1]);

    const tableRows = transactions.length
      ? transactions.map((t) => [
          formatDateDisplay(t.date),
          t.title || "—",
          t.category || "Other",
          t.type === "income" ? "Income" : "Expense",
          `₹${Number(t.amount || 0).toLocaleString("en-IN", {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
          })}`,
        ])
      : [["—", "No transactions recorded", "—", "—", "—"]];

    const pdf = new window.jspdf.jsPDF({
      orientation: "portrait",
      unit: "pt",
      format: "a4",
    });

    const pageWidth = pdf.internal.pageSize.getWidth();

    const pageHeight = pdf.internal.pageSize.getHeight();

    const margin = 40;

    const primary = [26, 103, 196];

    const dark = [19, 31, 55];

    const accent = [67, 198, 141];

    const soft = [244, 247, 249];

    const muted = [89, 97, 125];

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
    pdf.text(
      `Generated: ${formatDateDisplay(todayISO())}`,
      pageWidth - margin - 120,
      82,
      { align: "right" },
    );

    const summaryY = 138;
    const summaryWidth = (pageWidth - margin * 2 - 18) / 4;

    const summaryCards = [
      {
        label: "Money Received",
        value: `₹${income.toLocaleString("en-IN")}`,
        color: [218, 247, 232],
      },
      {
        label: "Total Spent",
        value: `₹${expense.toLocaleString("en-IN")}`,
        color: [254, 232, 232],
      },
      {
        label: "Net Balance",
        value: `${net >= 0 ? "+" : "-"}₹${Math.abs(net).toLocaleString("en-IN")}`,
        color: [232, 241, 255],
      },
      {
        label: "Transactions",
        value: String(transactions.length),
        color: [245, 240, 255],
      },
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

    const breakdownRows = categories.length
      ? categories.map(([category, amount]) => [
          category,
          `₹${Number(amount || 0).toLocaleString("en-IN")}`,
        ])
      : [["No expenses", "₹0"]];

    if (breakdownRows.length) {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      breakdownRows.slice(0, 5).forEach(([label, value]) => {
        pdf.setFillColor(247, 249, 251);
        pdf.rect(margin, currentY, pageWidth - margin * 2, 18, "F");
        pdf.text(label, margin + 10, currentY + 12);
        pdf.text(value, pageWidth - margin - 80, currentY + 12, {
          align: "right",
        });
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
        fontSize: 9,
      },
      bodyStyles: {
        fontSize: 8,
        textColor: dark,
        cellPadding: 5,
        valign: "middle",
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      margin: { left: margin, right: margin },
      tableWidth: pageWidth - margin * 2,
      styles: {
        lineColor: [220, 224, 232],
        lineWidth: 0.5,
        overflow: "linebreak",
      },
      columnStyles: {
        0: { cellWidth: 60 },
        1: { cellWidth: 160 },
        2: { cellWidth: 120 },
        3: { cellWidth: 70 },
        4: { cellWidth: 60, halign: "right" },
      },
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
    pdf.text(
      "StudentSpend • Confidential financial history",
      margin,
      pageHeight - 13,
    );
    pdf.text(
      `Summary based on ${transactions.length} recorded item(s)`,
      pageWidth - margin - 100,
      pageHeight - 13,
      { align: "right" },
    );

    pdf.save(`studentspend-report-${range.start}-to-${range.end}.pdf`);

    showToast("Professional PDF report downloaded.", "success");
  }

  /* =======================================================
     CUSTOM FILTERED TRANSACTIONS PDF EXPORT
  ======================================================= */
  async function downloadTransactionsPdf() {
    try {
      await ensurePdfLibraries();
    } catch (error) {
      console.error("PDF libraries could not be loaded:", error);
      showToast("Could not prepare the PDF. Check your connection.", "error");
      return;
    }

    // ইউজাৰে যিবোৰ ফিল্টাৰ বাছনি কৰি থৈছে (All, Income, Expense, Search, Date আদি)
    const filteredList = getFilteredTransactions();

    if (!filteredList.length) {
      showToast(
        "No transactions found to download with current filters.",
        "warning",
      );
      return;
    }

    const typeFilter = document.getElementById("filterType")?.value || "all";
    const categoryFilter =
      document.getElementById("filterCategory")?.value || "all";
    const monthFilter = document.getElementById("filterMonth")?.value || "all";

    const totalIncome = filteredList
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);

    const totalExpense = filteredList
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);

    const netBalance = totalIncome - totalExpense;

    const pdf = new window.jspdf.jsPDF({
      orientation: "portrait",
      unit: "pt",
      format: "a4",
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 40;

    // ৰং নিৰ্বাচন (Professional Theme)
    const primaryColor = [88, 70, 246]; // Brand Purple
    const darkColor = [24, 22, 46];
    const textFaint = [115, 111, 152];

    // ১. Header Banner
    pdf.setFillColor(...primaryColor);
    pdf.rect(0, 0, pageWidth, 90, "F");

    pdf.setTextColor(255, 255, 255);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(22);
    pdf.text("StudentSpend", margin, 38);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.text("Account Transaction Statement", margin, 54);

    const filterText = `Type: ${typeFilter.toUpperCase()} | Category: ${categoryFilter} | Month: ${monthFilter}`;
    pdf.setFontSize(9);
    pdf.text(filterText, margin, 74);
    pdf.text(
      `Generated: ${formatDateDisplay(todayISO())}`,
      pageWidth - margin,
      74,
      { align: "right" },
    );

    // ২. Summary Cards (Income / Expense / Net)
    const cardY = 110;
    const cardWidth = (pageWidth - margin * 2 - 20) / 3;

    // Income Box
    pdf.setFillColor(237, 248, 242);
    pdf.roundedRect(margin, cardY, cardWidth, 54, 6, 6, "F");
    pdf.setTextColor(16, 185, 129);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.text("TOTAL RECEIVED", margin + 12, cardY + 16);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(14);
    pdf.text(formatCurrency(totalIncome), margin + 12, cardY + 38);

    // Expense Box
    pdf.setFillColor(255, 241, 241);
    pdf.roundedRect(margin + cardWidth + 10, cardY, cardWidth, 54, 6, 6, "F");
    pdf.setTextColor(244, 63, 94);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.text("TOTAL SPENT", margin + cardWidth + 22, cardY + 16);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(14);
    pdf.text(formatCurrency(totalExpense), margin + cardWidth + 22, cardY + 38);

    // Net Box
    pdf.setFillColor(240, 239, 255);
    pdf.roundedRect(
      margin + cardWidth * 2 + 20,
      cardY,
      cardWidth,
      54,
      6,
      6,
      "F",
    );
    pdf.setTextColor(88, 70, 246);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.text("NET BALANCE", margin + cardWidth * 2 + 32, cardY + 16);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(14);
    pdf.text(
      (netBalance >= 0 ? "+" : "-") + formatCurrency(Math.abs(netBalance)),
      margin + cardWidth * 2 + 32,
      cardY + 38,
    );

    // ৩. Table Data
    const tableBody = filteredList.map((t) => [
      formatDateDisplay(t.date),
      t.title || "—",
      t.category || "Other",
      t.type === "income" ? "Income" : "Expense",
      t.paymentMethod || t.payment_method || "UPI",
      (t.type === "income" ? "+" : "-") + formatCurrency(t.amount),
    ]);

    pdf.autoTable({
      startY: 185,
      head: [["Date", "Title / Note", "Category", "Type", "Payment", "Amount"]],
      body: tableBody,
      theme: "grid",
      headStyles: {
        fillColor: primaryColor,
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 9,
        halign: "left",
      },
      bodyStyles: {
        fontSize: 8,
        textColor: darkColor,
        cellPadding: 6,
        valign: "middle",
      },
      alternateRowStyles: {
        fillColor: [248, 249, 252],
      },
      columnStyles: {
        0: { cellWidth: 65 },
        1: { cellWidth: 140 },
        2: { cellWidth: 80 },
        3: { cellWidth: 60 },
        4: { cellWidth: 70 },
        5: { cellWidth: 100, halign: "right", fontStyle: "bold" },
      },
      margin: { left: margin, right: margin },
    });

    // ৪. Footer
    pdf.setFillColor(245, 246, 250);
    pdf.rect(0, pageHeight - 28, pageWidth, 28, "F");
    pdf.setTextColor(...textFaint);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.text(
      "StudentSpend • Confidential Student Financial Report",
      margin,
      pageHeight - 11,
    );
    pdf.text(
      `Total Records: ${filteredList.length}`,
      pageWidth - margin,
      pageHeight - 11,
      { align: "right" },
    );

    pdf.save(`studentspend-statement-${todayISO()}.pdf`);
    showToast("Statement PDF downloaded successfully!", "success");
  }
  /* =======================================================
     SETTINGS
  ======================================================= */

  function renderSettingsPage() {
    const budget = document.getElementById("budgetInput");

    if (budget) {
      budget.value = state.settings.budget;
    }

    document
      .getElementById("lightModeBtn")
      ?.classList.toggle("is-active", state.settings.theme === "light");

    document
      .getElementById("darkModeBtn")
      ?.classList.toggle("is-active", state.settings.theme === "dark");
  }

  function applyTheme(theme) {
    const finalTheme = theme === "dark" ? "dark" : "light";

    document.documentElement.setAttribute("data-theme", finalTheme);

    const icon = document.getElementById("themeIcon");

    if (icon) {
      icon.innerHTML = finalTheme === "dark" ? "&#9788;" : "&#9789;";
    }
  }

  function toggleTheme() {
    state.settings.theme = state.settings.theme === "dark" ? "light" : "dark";

    applyTheme(state.settings.theme);

    Store.saveSettings(state.settings);

    renderCurrentPage();
  }

  /* =======================================================
     BUDGET ALERTS
  ======================================================= */

  function closeBudgetWarning() {
    const overlay = document.getElementById("budgetWarningOverlay");

    closeActiveModals(overlay);

    if (overlay) {
      overlay.classList.remove("is-open");

      overlay.setAttribute("aria-hidden", "true");
    }
  }

  function checkMonthlyBudgetAlerts() {
    const budget = Number(state.settings.budget) || 0;

    if (budget <= 0) return;

    const today = new Date();

    const key = monthKey(today);

    const spent = sumByType(txForMonth(today), "expense");

    const percent = (spent / budget) * 100;

    const alerts = Store.loadAlerts();

    let record = alerts[key];

    if (!record || Number(record.budget) !== budget) {
      record = {
        budget,

        levels: [],

        exceeded: false,
      };
    }

    [50, 80, 90, 100].forEach((level) => {
      if (percent >= level && !record.levels.includes(level)) {
        record.levels.push(level);

        showToast(
          `Monthly budget ${level}% used.`,
          level >= 90 ? "warning" : "info",
        );
      }
    });

    if (percent > 100 && !record.exceeded) {
      record.exceeded = true;

      const message = document.getElementById("budgetWarningMessage");

      if (message) {
        message.textContent = `You have spent ${formatCurrency(
          spent,
        )}, which is ${formatCurrency(
          spent - budget,
        )} over your monthly budget of ${formatCurrency(budget)}.`;
      }

      const overlay = document.getElementById("budgetWarningOverlay");

      if (overlay) {
        overlay.classList.add("is-open");

        overlay.setAttribute("aria-hidden", "false");
      }
    }

    alerts[key] = record;

    Store.saveAlerts(alerts);
  }

  /* =======================================================
     IMPORT / EXPORT
  ======================================================= */

  function exportData() {
    const data = {
      app: "StudentSpend",

      version: "2.0",

      user: state.user?.email || "",

      exportedAt: new Date().toISOString(),

      transactions: state.transactions,

      settings: state.settings,

      studentFeatures: state.studentFeatures,

      profile: state.profile,
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;

    link.download = `studentspend-backup-${todayISO()}.json`;

    document.body.appendChild(link);

    link.click();

    link.remove();

    URL.revokeObjectURL(url);

    showToast("Backup exported successfully.", "success");
  }

  function importData(file) {
    const reader = new FileReader();

    reader.onload = function (event) {
      try {
        const data = JSON.parse(event.target.result);

        if (!data || !Array.isArray(data.transactions)) {
          throw new Error("Invalid backup file.");
        }

        const transactions = data.transactions
          .filter(
            (t) =>
              t &&
              (t.type === "income" || t.type === "expense") &&
              Number(t.amount) > 0 &&
              t.title &&
              t.date,
          )
          .map((t) => ({
            id: t.id || uid(),

            type: t.type,

            amount: Math.round(Number(t.amount) * 100) / 100,

            title: String(t.title).slice(0, 80),

            category: String(t.category || "Other"),

            date: String(t.date).slice(0, 10),

            paymentMethod: String(t.paymentMethod || t.payment_method || "UPI"),

            moneySource: normalizeMoneySource(
              t.type,
              t.moneySource || t.money_source,
              t.paymentMethod || t.payment_method || "UPI",
            ),

            countAsSavings:
              t.type === "income" &&
              (t.countAsSavings === true || t.count_as_savings === true),

            savingsBucket:
              (t.savingsBucket || t.savings_bucket) && t.type === "expense"
                ? normalizeSavingsBucket(t.savingsBucket || t.savings_bucket)
                : null,

            savingsPlatform:
              (t.savingsPlatform || t.savings_platform) && t.type === "expense"
                ? normalizeSavingsPlatform(
                    t.savingsPlatform || t.savings_platform,
                  )
                : null,

            savingsPlatformName: String(
              t.savingsPlatformName || t.savings_platform_name || "",
            )
              .trim()
              .slice(0, 60),

            incomeSource:
              t.type === "income"
                ? normalizeIncomeSource(t.incomeSource || t.income_source)
                : null,

            incomeSourceName:
              t.type === "income"
                ? normalizeIncomeSourceName(
                    t.incomeSourceName || t.income_source_name,
                  )
                : "",

            note: String(t.note || ""),

            createdAt: t.createdAt || Date.now(),
          }));

        const importedStudentFeatures =
          data.studentFeatures && typeof data.studentFeatures === "object"
            ? normalizeStudentFeatures(data.studentFeatures)
            : null;
        const transfersForValidation =
          importedStudentFeatures?.savingsTransfers ??
          state.studentFeatures.savingsTransfers;
        const operationsForValidation =
          importedStudentFeatures?.savingsOperations ??
          state.studentFeatures.savingsOperations;

        if (
          calculateMoneyBalances(
            transactions,
            transfersForValidation,
            operationsForValidation,
          ).savingsCents < 0
        ) {
          throw new Error(
            "The backup has Savings expenses greater than its tracked Savings income.",
          );
        }

        state.transactions = transactions;

        if (data.settings && typeof data.settings === "object") {
          state.settings = {
            ...DEFAULT_SETTINGS,
            ...data.settings,
          };
        }

        if (importedStudentFeatures) {
          state.studentFeatures = importedStudentFeatures;
          persistStudentFeatures();
        }

        if (data.profile && typeof data.profile === "object") {
          state.profile = {
            name: data.profile.name || "",

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

            age: data.profile.age || "",

            phone:
              typeof data.profile.phone === "string" ? data.profile.phone : "",
          };

          Store.saveProfile(state.profile);
        }

        Store.saveTransactions(state.transactions);

        Store.saveSettings(state.settings);

        applyTheme(state.settings.theme);

        renderCurrentPage();

        showToast(
          `Successfully imported ${transactions.length} transactions.`,
          "success",
        );
      } catch (error) {
        console.error("Import error:", error);

        showToast("Could not import backup file.", "error");
      }
    };

    reader.readAsText(file);
  }

  async function clearAllData() {
    openConfirm(
      "This will permanently delete ALL transactions, savings, budgets, and goals for your account. This cannot be undone.",
      async function () {
        // ১. Local Storage-ৰ সকলো ইউজাৰ কী (Keys) ডিলিট কৰা
        const prefix = getUserStoragePrefix();
        const keysToRemove = [
          Store.transactionsKey(),
          Store.alertsKey(),
          Store.studentFeaturesKey(),
          Store.studentFeaturesPendingKey(),
          Store.notificationReadKey(),
          Store.pendingTransactionDeletesKey(),
        ];

        keysToRemove.forEach((key) => localStorage.removeItem(key));

        // ২. ক্লায়েন্ট স্টেট (State) ৰিচেট কৰা
        state.transactions = [];
        state.studentFeatures = {
          ...DEFAULT_STUDENT_FEATURES,
          categoryBudgets: {},
          savingsGoals: [],
          savingsTransfers: [],
          savingsOperations: [],
          paymentReminders: [],
          challenge: null,
        };

        // ৩. অনলাইন থাকিলে Supabase-ৰ পৰাও মচি পেলোৱা
        if (supabaseClient && connection.isOnline() && state.user?.id) {
          try {
            // ট্রাঞ্জাকচন ডিলিট কৰা
            await supabaseClient
              .from("transactions")
              .delete()
              .eq("user_id", state.user.id);

            // ষ্টুডেণ্ট ফিচাৰ / ছেভিংস পে'ল'ড খালি কৰা
            await supabaseClient.from("student_features").upsert({
              user_id: state.user.id,
              payload: state.studentFeatures,
              updated_at: new Date().toISOString(),
            });
          } catch (err) {
            console.warn("Cloud data wipe failed:", err);
          }
        }

        // ৪. স্ক্ৰীনৰ সকলো UI পুনৰ ৰেণ্ডাৰ কৰা
        renderCurrentPage();

        showToast(
          "All data, savings, and records have been cleared.",
          "success",
        );
        closeConfirm();
      },
      {
        confirmText: "Clear Everything",
        cancelText: "Cancel",
      },
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
      moneySource: "online",
      countAsSavings: false,
      note,
      createdAt: Date.now(),
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
    if (
      !name ||
      !Number.isFinite(target) ||
      target <= 0 ||
      !Number.isFinite(saved) ||
      saved < 0 ||
      !targetDate
    ) {
      showToast(
        "Enter a goal name, valid target and saved amounts, and target date.",
        "error",
      );
      return;
    }

    const current = state.studentFeatures.savingsGoals.find(
      (goal) => goal.id === id,
    );
    const goal = {
      id: id || uid(),
      name,
      target: Math.round(target * 100) / 100,
      saved: Math.round(saved * 100) / 100,
      targetDate,
      note,
      createdAt: current?.createdAt || Date.now(),
    };
    state.studentFeatures.savingsGoals = id
      ? state.studentFeatures.savingsGoals.map((item) =>
          item.id === id ? goal : item,
        )
      : [...state.studentFeatures.savingsGoals, goal];
    resetSavingsGoalForm();
    persistStudentFeatures();
    renderStudentTools();
    showToast(
      id ? "Savings goal updated." : "Savings goal created.",
      "success",
    );
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
      const goal = state.studentFeatures.savingsGoals.find(
        (item) => item.id === id,
      );
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
      const reminder = state.studentFeatures.paymentReminders.find(
        (item) => item.id === id,
      );
      if (!reminder) return;
      document.getElementById("paymentReminderId").value = reminder.id;
      document.getElementById("paymentReminderKind").value =
        reminder.kind === "repayment" ? "repayment" : "payment";
      document.getElementById("paymentReminderPerson").value =
        reminder.personName || "";
      document.getElementById("paymentReminderName").value = reminder.name;
      document.getElementById("paymentReminderAmount").value = String(
        reminder.amount,
      );
      document.getElementById("paymentReminderDate").value = reminder.dueDate;
      document.getElementById("paymentReminderCategory").value =
        reminder.category;
      document.getElementById("paymentReminderRecurring").checked =
        reminder.recurring;
      document.getElementById("paymentReminderFrequency").value =
        reminder.recurrence || "monthly";
      updatePaymentReminderKindFields();
      document.getElementById("paymentReminderSubmit").textContent =
        "Save changes";
      document.getElementById("paymentReminderCancel").hidden = false;
      document.getElementById("paymentReminderName").focus();
      return;
    }
    if (featureAction === "complete-reminder") {
      const completedReminder = state.studentFeatures.paymentReminders.find(
        (reminder) => reminder.id === id,
      );
      state.studentFeatures.paymentReminders =
        state.studentFeatures.paymentReminders.map((reminder) =>
          reminder.id === id ? { ...reminder, completed: true } : reminder,
        );
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
            completedReminder.recurrence,
          ),
          completed: false,
        });
      }
      persistStudentFeatures();
      renderStudentTools();
      showToast(
        completedReminder?.recurring
          ? "Payment marked complete; the next reminder is scheduled. No transaction was created."
          : completedReminder?.kind === "repayment"
            ? "Repayment marked received. No transaction was created."
            : "Payment marked complete. No transaction was created.",
        "success",
      );
      return;
    }
    if (featureAction === "delete-reminder") {
      openConfirm("Delete this payment reminder?", () => {
        state.studentFeatures.paymentReminders =
          state.studentFeatures.paymentReminders.filter(
            (reminder) => reminder.id !== id,
          );
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
    state.studentFeatures.savingsGoals = state.studentFeatures.savingsGoals.map(
      (goal) =>
        goal.id === id
          ? { ...goal, saved: Math.round((goal.saved + amount) * 100) / 100 }
          : goal,
    );
    persistStudentFeatures();
    renderStudentTools();
    showToast(
      "Savings goal updated. Your available balance was not changed.",
      "success",
    );
  }

  function handlePaymentReminderSubmit(event) {
    event.preventDefault();
    const id = document.getElementById("paymentReminderId").value;
    const kind = document.getElementById("paymentReminderKind").value;
    const personName = document
      .getElementById("paymentReminderPerson")
      .value.trim();
    const name = document.getElementById("paymentReminderName").value.trim();
    const amount = Number(
      document.getElementById("paymentReminderAmount").value,
    );
    const dueDate = document.getElementById("paymentReminderDate").value;
    if (
      !name ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      !dueDate ||
      (kind === "repayment" && !personName)
    ) {
      showToast(
        kind === "repayment"
          ? "Enter what the money was for, who owes you, a valid amount, and an expected repayment date."
          : "Enter a payment name, valid amount, and due date.",
        "error",
      );
      return;
    }
    const existing = state.studentFeatures.paymentReminders.find(
      (item) => item.id === id,
    );
    const reminder = {
      id: id || uid(),
      kind: kind === "repayment" ? "repayment" : "payment",
      personName: kind === "repayment" ? personName : "",
      name,
      amount: Math.round(amount * 100) / 100,
      dueDate,
      category:
        kind === "repayment"
          ? "Money Lent"
          : document.getElementById("paymentReminderCategory").value,
      recurring:
        kind === "payment" &&
        document.getElementById("paymentReminderRecurring").checked,
      recurrence: document.getElementById("paymentReminderFrequency").value,
      completed: existing?.completed || false,
    };
    state.studentFeatures.paymentReminders = id
      ? state.studentFeatures.paymentReminders.map((item) =>
          item.id === id ? reminder : item,
        )
      : [...state.studentFeatures.paymentReminders, reminder];
    resetPaymentReminderForm();
    persistStudentFeatures();
    renderStudentTools();
    showToast(
      kind === "repayment"
        ? id
          ? "Repayment reminder updated."
          : "Repayment reminder added."
        : id
          ? "Payment reminder updated."
          : "Payment reminder added.",
      "success",
    );
  }

  function resetPaymentReminderForm() {
    document.getElementById("paymentReminderForm")?.reset();
    document.getElementById("paymentReminderId").value = "";
    document.getElementById("paymentReminderSubmit").textContent =
      "Add reminder";
    document.getElementById("paymentReminderCancel").hidden = true;
    updatePaymentReminderKindFields();
  }

  function updatePaymentReminderKindFields() {
    const isRepayment =
      document.getElementById("paymentReminderKind").value === "repayment";
    const recurring = document.getElementById("paymentReminderRecurring");

    document.getElementById("paymentReminderPersonWrap").hidden = !isRepayment;
    document.getElementById("paymentReminderPerson").required = isRepayment;
    document.getElementById("paymentReminderCategoryWrap").hidden = isRepayment;
    document.getElementById("paymentReminderRecurringWrap").hidden =
      isRepayment;
    document.getElementById("paymentReminderFrequencyWrap").hidden =
      isRepayment || !recurring.checked;
    document.getElementById("paymentReminderNameLabel").firstChild.textContent =
      isRepayment ? "What was the money for?" : "Payment name";
    document.getElementById("paymentReminderName").placeholder = isRepayment
      ? "Lunch, tickets, or another loan"
      : "Mobile Recharge";
    document.getElementById("paymentReminderDateLabel").firstChild.textContent =
      isRepayment ? "Expected repayment date" : "Due date";
    document.getElementById("paymentReminderPerson").value = isRepayment
      ? document.getElementById("paymentReminderPerson").value
      : "";
    if (isRepayment) {
      recurring.checked = false;
    }
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
      0,
    ).getDate();
    return toISODate(
      new Date(
        nextMonth.getFullYear(),
        nextMonth.getMonth(),
        Math.min(day, lastDay),
      ),
    );
  }

  function startNoSpendChallenge(duration) {
    state.studentFeatures.challenge = {
      id: uid(),
      duration,
      startDate: todayISO(),
      status: "active",
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
      "food",
      "mess/food",
      "snacks",
      "transport",
      "bus/fuel",
      "education",
      "study materials",
      "college",
      "hostel",
      "health",
      "recharge",
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
    document
      .getElementById("homeMoneyForm")
      ?.addEventListener("submit", handleHomeMoneySubmit);

    document
      .querySelectorAll("[data-open-transactions]")
      .forEach((button) =>
        button.addEventListener("click", () => switchPage("transactions")),
      );

    document
      .querySelectorAll("[data-dashboard-page]")
      .forEach((button) =>
        button.addEventListener("click", () =>
          switchPage(button.dataset.dashboardPage),
        ),
      );

    document
      .getElementById("categoryBudgetsForm")
      ?.addEventListener("submit", (event) => {
        event.preventDefault();
        const budgets = {};
        document.querySelectorAll("[data-category-budget]").forEach((input) => {
          const amount = Number(input.value);
          if (input.value && Number.isFinite(amount) && amount > 0) {
            budgets[input.dataset.categoryBudget] =
              Math.round(amount * 100) / 100;
          }
        });
        state.studentFeatures.categoryBudgets = budgets;
        persistStudentFeatures();
        renderCurrentPage(); // <-- ইয়াত renderStudentTools() ৰ ঠাইত renderCurrentPage() লিখক
        showToast("Category budgets saved.", "success");
      });

    document
      .getElementById("savingsGoalForm")
      ?.addEventListener("submit", handleSavingsGoalSubmit);
    document
      .getElementById("savingsGoalCancel")
      ?.addEventListener("click", resetSavingsGoalForm);
    document
      .getElementById("savingsGoalsList")
      ?.addEventListener("click", handleGoalListClick);
    document
      .getElementById("savingsGoalsList")
      ?.addEventListener("submit", handleGoalContribution);

    document
      .getElementById("homeMoneyHistory")
      ?.addEventListener("click", handleGoalListClick);
    document
      .getElementById("calendarDayTransactions")
      ?.addEventListener("click", handleGoalListClick);
    document
      .getElementById("paymentRemindersList")
      ?.addEventListener("click", handleGoalListClick);
    document
      .getElementById("paymentReminderForm")
      ?.addEventListener("submit", handlePaymentReminderSubmit);
    document
      .getElementById("paymentReminderCancel")
      ?.addEventListener("click", resetPaymentReminderForm);
    document
      .getElementById("paymentReminderKind")
      ?.addEventListener("change", updatePaymentReminderKindFields);
    document
      .getElementById("paymentReminderRecurring")
      ?.addEventListener("change", (event) => {
        document.getElementById("paymentReminderFrequencyWrap").hidden =
          !event.target.checked;
      });

    document
      .getElementById("expenseCalendar")
      ?.addEventListener("click", (event) => {
        const button = event.target.closest("[data-calendar-date]");
        if (!button) return;
        state.calendarSelectedDate = button.dataset.calendarDate;
        renderExpenseCalendar();
      });
    document
      .getElementById("expenseCalendarPrev")
      ?.addEventListener("click", () => {
        state.calendarMonth = new Date(
          state.calendarMonth.getFullYear(),
          state.calendarMonth.getMonth() - 1,
          1,
        );
        state.calendarSelectedDate = toISODate(state.calendarMonth);
        renderExpenseCalendar();
      });
    document
      .getElementById("expenseCalendarNext")
      ?.addEventListener("click", () => {
        state.calendarMonth = new Date(
          state.calendarMonth.getFullYear(),
          state.calendarMonth.getMonth() + 1,
          1,
        );
        state.calendarSelectedDate = toISODate(state.calendarMonth);
        renderExpenseCalendar();
      });

    document
      .getElementById("challengeDuration")
      ?.addEventListener("change", renderNoSpendChallenge);
    document
      .getElementById("challengeForm")
      ?.addEventListener("submit", (event) => {
        event.preventDefault();
        const selected = document.getElementById("challengeDuration").value;
        const duration =
          selected === "custom"
            ? Number(document.getElementById("challengeCustomDays").value)
            : Number(selected);
        if (!Number.isInteger(duration) || duration < 1 || duration > 365) {
          showToast(
            "Choose a challenge duration between 1 and 365 days.",
            "error",
          );
          return;
        }
        startNoSpendChallenge(duration);
      });
    document
      .getElementById("challengeCancelButton")
      ?.addEventListener("click", () => {
        if (!state.studentFeatures.challenge) return;
        state.studentFeatures.challenge.status = "canceled";
        persistStudentFeatures();
        renderStudentTools();
        showToast(
          "Challenge canceled. Your transactions were not changed.",
          "info",
        );
      });
    document
      .getElementById("challengeDeleteButton")
      ?.addEventListener("click", () => {
        if (!state.studentFeatures.challenge) return;
        openConfirm(
          "Are you sure want to delete this challenge? This cannot be undone.",
          () => {
            state.studentFeatures.challenge = null;
            persistStudentFeatures();
            renderStudentTools();
            renderDashboardFeatureSummaries();
            showToast("Challenge deleted successfully.", "success");
            closeConfirm();
          },
        );
      });
    document
      .getElementById("challengeCompleteButton")
      ?.addEventListener("click", () => {
        if (!state.studentFeatures.challenge) return;
        state.studentFeatures.challenge.status = "completed";
        persistStudentFeatures();
        renderStudentTools();
        showToast("Challenge marked complete.", "success");
      });
    document
      .getElementById("challengeRestartButton")
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

    window.addEventListener("online", () => {
      if (!state.user?.id) return;

      (async () => {
        if (Store.hasPendingStudentFeaturesSync()) {
          await persistStudentFeatures(false);
        }
        const synced = await syncTransactionsToSupabase();
        if (synced) {
          await syncFromServer();
        }
      })().catch((error) => {
        if (!connection.handleError(error)) {
          console.warn("Supabase transaction sync failed:", error);
        }
      });
    });

    const notificationMenu = document.getElementById("notificationMenu");
    document
      .getElementById("notificationToggle")
      ?.addEventListener("click", () => {
        const dropdown = document.getElementById("notificationDropdown");
        setNotificationDropdownOpen(Boolean(dropdown?.hidden));
      });

    document
      .getElementById("markNotificationsRead")
      ?.addEventListener("click", () => {
        const readIds = new Set(Store.loadNotificationReadIds());
        buildNotifications().forEach((notification) =>
          readIds.add(notification.id),
        );
        Store.saveNotificationReadIds([...readIds]);
        renderNotificationPanel();
      });

    document
      .getElementById("notificationList")
      ?.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        const notificationButton = target.closest("[data-notification-id]");
        if (!notificationButton) return;

        const readIds = new Set(Store.loadNotificationReadIds());
        readIds.add(notificationButton.dataset.notificationId);
        Store.saveNotificationReadIds([...readIds]);
        renderNotificationPanel();
        setNotificationDropdownOpen(false);
        switchPage(notificationButton.dataset.notificationPage);
      });

    document.addEventListener("pointerdown", (event) => {
      if (
        notificationMenu &&
        event.target instanceof Node &&
        !notificationMenu.contains(event.target)
      ) {
        setNotificationDropdownOpen(false);
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        setNotificationDropdownOpen(false);
      }
    });

    /* Navigation */

    document.querySelectorAll(".nav-item").forEach((button) => {
      button.addEventListener("click", () => switchPage(button.dataset.page));
    });

    /* Profile */

    document
      .getElementById("profileForm")
      ?.addEventListener("submit", saveProfile);

    document
      .getElementById("profileStudentMode")
      ?.addEventListener("change", updateCustomStudentTypeVisibility);

    document
      .getElementById("profileCustomStudentType")
      ?.addEventListener("input", (event) => {
        const input = event.currentTarget;
        const cursor = input.selectionStart;
        const normalizedValue = normalizeProfileNameInput(input.value).slice(
          0,
          60,
        );
        if (input.value === normalizedValue) {
          return;
        }

        const normalizedBeforeCursor = normalizeProfileNameInput(
          input.value.slice(0, cursor),
        ).slice(0, 60);
        input.value = normalizedValue;
        const nextCursor = Math.min(
          normalizedBeforeCursor.length,
          normalizedValue.length,
        );
        input.setSelectionRange(nextCursor, nextCursor);
      });

    ["profileFirstName", "profileMiddleName", "profileLastName"].forEach(
      (id) => {
        const input = document.getElementById(id);
        input?.addEventListener("input", () => {
          const cursor = input.selectionStart;
          const normalizedValue = normalizeProfileNameInput(input.value);
          if (input.value === normalizedValue) {
            return;
          }

          const normalizedBeforeCursor = normalizeProfileNameInput(
            input.value.slice(0, cursor),
          );
          input.value = normalizedValue;
          const nextCursor = Math.min(
            normalizedBeforeCursor.length,
            normalizedValue.length,
          );
          input.setSelectionRange(nextCursor, nextCursor);
        });
      },
    );

    document.getElementById("logoutBtn")?.addEventListener("click", logoutUser);
    /* Daily Reminder */

    document
      .getElementById("saveReminderBtn")
      ?.addEventListener("click", saveReminderSettings);

    document
      .getElementById("dailyReminderEnabled")
      ?.addEventListener("change", () => {
        const status = document.getElementById("reminderStatusText");

        const enabled = document.getElementById(
          "dailyReminderEnabled",
        )?.checked;

        if (status) {
          if (enabled) {
            const time =
              document.getElementById("dailyReminderTime")?.value || "20:00";

            status.textContent = `Reminder is ON. You will be reminded every day at ${formatReminderTime(time)}.`;
          } else {
            status.textContent = "Reminder is currently disabled.";
          }
        }
      });

    document
      .getElementById("dailyReminderTime")
      ?.addEventListener("change", () => {
        const status = document.getElementById("reminderStatusText");

        const enabled = document.getElementById(
          "dailyReminderEnabled",
        )?.checked;

        if (status && enabled) {
          const time =
            document.getElementById("dailyReminderTime")?.value || "20:00";

          status.textContent = `Reminder is ON. You will be reminded every day at ${formatReminderTime(time)}.`;
        }
      });

    document
      .getElementById("closeDailyReminderPopup")
      ?.addEventListener("click", closeDailyReminderPopup);

    document
      .getElementById("dailyReminderPopup")
      ?.addEventListener("click", (event) => {
        if (event.target.id === "dailyReminderPopup") {
          closeDailyReminderPopup();
        }
      });

    /* Mobile menu */

    document.getElementById("menuToggle")?.addEventListener("click", () => {
      document.getElementById("sidebar")?.classList.add("is-open");

      document.getElementById("sidebarOverlay")?.classList.add("is-open");
    });

    document
      .getElementById("sidebarOverlay")
      ?.addEventListener("click", closeSidebarMobile);

    /* Theme */

    document
      .getElementById("themeToggle")
      ?.addEventListener("click", toggleTheme);

    document.getElementById("lightModeBtn")?.addEventListener("click", () => {
      state.settings.theme = "light";

      applyTheme("light");

      Store.saveSettings(state.settings);

      renderCurrentPage();
    });

    document.getElementById("darkModeBtn")?.addEventListener("click", () => {
      state.settings.theme = "dark";

      applyTheme("dark");

      Store.saveSettings(state.settings);

      renderCurrentPage();
    });

    /* Tip */

    document.getElementById("tipRefreshBtn")?.addEventListener("click", () => {
      const tip = document.getElementById("sidebarTip");

      if (!tip) return;

      tip.textContent =
        STUDENT_TIPS[Math.floor(Math.random() * STUDENT_TIPS.length)];
    });

    /* Dashboard month */

    document.getElementById("prevMonth")?.addEventListener("click", () => {
      state.viewMonth = new Date(
        state.viewMonth.getFullYear(),
        state.viewMonth.getMonth() - 1,
        1,
      );

      renderDashboard();
    });

    document.getElementById("nextMonth")?.addEventListener("click", () => {
      state.viewMonth = new Date(
        state.viewMonth.getFullYear(),
        state.viewMonth.getMonth() + 1,
        1,
      );

      renderDashboard();
    });

    document.getElementById("todayMonthBtn")?.addEventListener("click", () => {
      state.viewMonth = startOfMonth(new Date());

      renderDashboard();
    });

    /* Reports */

    document.getElementById("repPrevMonth")?.addEventListener("click", () => {
      state.viewMonth = new Date(
        state.viewMonth.getFullYear(),
        state.viewMonth.getMonth() - 1,
        1,
      );

      renderReportsPage();
    });

    document.getElementById("repNextMonth")?.addEventListener("click", () => {
      state.viewMonth = new Date(
        state.viewMonth.getFullYear(),
        state.viewMonth.getMonth() + 1,
        1,
      );

      renderReportsPage();
    });

    document
      .getElementById("repTodayMonthBtn")
      ?.addEventListener("click", () => {
        state.viewMonth = startOfMonth(new Date());

        renderReportsPage();
      });

    document
      .getElementById("reportPeriod")
      ?.addEventListener("change", (event) => {
        state.reportPeriod = event.target.value;

        renderReportsPage();
      });

    ["reportStartDate", "reportEndDate"].forEach((id) => {
      document
        .getElementById(id)
        ?.addEventListener("change", renderReportsPage);
    });

    document
      .getElementById("downloadReportBtn")
      ?.addEventListener("click", downloadReportPdf);

    /* Add transaction */

    document
      .getElementById("addTransactionBtn")
      ?.addEventListener("click", openModalForAdd);

    document
      .getElementById("emptyAddBtn")
      ?.addEventListener("click", openModalForAdd);

    // Paste here:
    document
      .getElementById("recordMoneyFromHomeBtn")
      ?.addEventListener("click", () => {
        openModalForAdd();
        setModalType("income", "Money From Home");
        const catSelect = document.getElementById("txCategory");
        if (catSelect) catSelect.value = "Money From Home";
      });
    /* Transaction modal */

    document
      .getElementById("txModalClose")
      ?.addEventListener("click", closeModal);

    document
      .getElementById("txCancelBtn")
      ?.addEventListener("click", closeModal);

    document
      .getElementById("txModalOverlay")
      ?.addEventListener("click", (event) => {
        if (event.target.id === "txModalOverlay") {
          closeModal();
        }
      });

    document
      .getElementById("typeExpenseBtn")
      ?.addEventListener("click", () => setModalType("expense"));

    document
      .getElementById("typeIncomeBtn")
      ?.addEventListener("click", () => setModalType("income"));

    document.getElementById("txMoneySource")?.addEventListener("change", () => {
      document.getElementById("txIncomeOnlineSource").value = "";
      document.getElementById("txIncomeSavingsSource").value = "";
      document.getElementById("txIncomeOnlineOther").value = "";
      document.getElementById("txIncomeSavingsOther").value = "";
      clearTransactionSavingsError();
      clearIncomeSourceErrors();
      syncTransactionSavingsBucketControls();
    });

    document
      .getElementById("txPayment")
      ?.addEventListener("change", syncMoneySourceToPaymentMethod);

    document
      .getElementById("txSavingsBucket")
      ?.addEventListener("change", () => {
        document.getElementById("txIncomeSavingsSource").value = "";
        document.getElementById("txIncomeSavingsOther").value = "";
        syncTransactionSavingsBucketControls();
      });

    document
      .getElementById("txIncomeOnlineSource")
      ?.addEventListener("change", () => {
        if (document.getElementById("txIncomeOnlineSource").value !== "other") {
          document.getElementById("txIncomeOnlineOther").value = "";
        }
        clearIncomeSourceErrors();
        syncTransactionSavingsBucketControls();
      });

    document
      .getElementById("txIncomeSavingsSource")
      ?.addEventListener("change", () => {
        if (
          document.getElementById("txIncomeSavingsSource").value !== "other"
        ) {
          document.getElementById("txIncomeSavingsOther").value = "";
        }
        clearIncomeSourceErrors();
        syncTransactionSavingsBucketControls();
      });

    document
      .getElementById("txIncomeOnlineOther")
      ?.addEventListener("input", clearIncomeSourceErrors);

    document
      .getElementById("txIncomeSavingsOther")
      ?.addEventListener("input", clearIncomeSourceErrors);

    document
      .getElementById("txSavingsPlatform")
      ?.addEventListener("change", clearTransactionSavingsError);

    if (!state.savingsEventsWired) {
      document
        .getElementById("addMoneyToSavingsBtn")
        ?.addEventListener("click", (event) =>
          openSavingsOperationModal("deposit", event.currentTarget),
        );
      document
        .getElementById("moveCashToSavingsBtn")
        ?.addEventListener("click", (event) =>
          openSavingsOperationModal("transfer", event.currentTarget, "cash"),
        );

      document
        .getElementById("moveOnlineToSavingsBtn")
        ?.addEventListener("click", (event) =>
          openSavingsOperationModal("transfer", event.currentTarget, "online"),
        );
      document
        .getElementById("savingsOperationClose")
        ?.addEventListener("click", closeSavingsOperationModal);

      document
        .getElementById("savingsOperationCancel")
        ?.addEventListener("click", closeSavingsOperationModal);

      document
        .getElementById("savingsOperationOverlay")
        ?.addEventListener("click", (event) => {
          if (event.target.id === "savingsOperationOverlay") {
            closeSavingsOperationModal();
          }
        });

      document
        .getElementById("savingsOperationForm")
        ?.addEventListener("submit", handleSavingsOperationSubmit);

      document
        .getElementById("savingsOperationAmount")
        ?.addEventListener("input", () => {
          const error = document.getElementById("savingsOperationError");
          if (error) {
            error.textContent = "";
            error.hidden = true;
          }
          document
            .getElementById("savingsOperationAmount")
            ?.removeAttribute("aria-invalid");
        });

      document
        .getElementById("savingsTransferSource")
        ?.addEventListener("change", () => {
          const error = document.getElementById("savingsOperationError");
          if (error) {
            error.textContent = "";
            error.hidden = true;
          }
          document
            .getElementById("savingsOperationAmount")
            ?.removeAttribute("aria-invalid");
          syncSavingsOperationFields();
        });

      document
        .getElementById("savingsOperationBucket")
        ?.addEventListener("change", syncSavingsOperationFields);

      document
        .getElementById("savingsOperationPlatform")
        ?.addEventListener("change", syncSavingsOperationFields);

      document
        .getElementById("savingsOperationPlatformName")
        ?.addEventListener("input", () => {
          const error = document.getElementById("savingsOperationError");
          if (error) {
            error.textContent = "";
            error.hidden = true;
          }
          document
            .getElementById("savingsOperationPlatformName")
            ?.removeAttribute("aria-invalid");
        });

      document
        .getElementById("savingsActivityList")
        ?.addEventListener("click", (event) => {
          if (!event.target.closest("[data-savings-activity-toggle]")) return;
          state.savingsActivityExpanded = !state.savingsActivityExpanded;
          renderSavingsDashboard();
        });

      state.savingsEventsWired = true;
    }

    document
      .getElementById("txForm")
      ?.addEventListener("submit", handleTxFormSubmit);

    /* Confirm */

    document
      .getElementById("confirmCancel")
      ?.addEventListener("click", closeConfirm);

    document
      .getElementById("confirmOverlay")
      ?.addEventListener("click", (event) => {
        if (event.target.id === "confirmOverlay") {
          closeConfirm();
        }
      });

    document
      .getElementById("confirmOk")
      ?.addEventListener("click", async () => {
        if (typeof state.confirmAction === "function") {
          await state.confirmAction();
        }
      });

    document
      .getElementById("budgetWarningClose")
      ?.addEventListener("click", closeBudgetWarning);

    /* Search/filter */

    ["searchInput", "filterType", "filterCategory", "filterMonth"].forEach(
      (id) => {
        document
          .getElementById(id)
          ?.addEventListener("input", renderTransactionsPage);

        document
          .getElementById(id)
          ?.addEventListener("change", renderTransactionsPage);
      },
    );

    document.getElementById("searchClearBtn")?.addEventListener("click", () => {
      const input = document.getElementById("searchInput");

      if (input) {
        input.value = "";

        renderTransactionsPage();

        input.focus();
      }
    });

    function resetFilters() {
      const search = document.getElementById("searchInput");

      const type = document.getElementById("filterType");

      const category = document.getElementById("filterCategory");

      const month = document.getElementById("filterMonth");

      if (search) search.value = "";

      if (type) type.value = "all";

      if (category) category.value = "all";

      if (month) month.value = "all";

      renderTransactionsPage();
    }

    document
      .getElementById("resetFiltersBtn")
      ?.addEventListener("click", resetFilters);

    document
      .getElementById("clearFilterBtn")
      ?.addEventListener("click", resetFilters);

    /* Budget */

    document
      .getElementById("budgetForm")
      ?.addEventListener("submit", (event) => {
        event.preventDefault();

        const value = Number(document.getElementById("budgetInput").value);

        if (!Number.isFinite(value) || value < 0) {
          showToast("Please enter a valid budget.", "error");

          return;
        }

        state.settings.budget = Math.round(value);

        Store.saveSettings(state.settings);

        checkMonthlyBudgetAlerts();

        renderCurrentPage();

        showToast("Monthly budget saved.", "success");
      });

    /* Export */

    document.getElementById("exportBtn")?.addEventListener("click", exportData);

    /* Import */

    document
      .getElementById("importBtn")
      ?.addEventListener("click", () =>
        document.getElementById("importInput")?.click(),
      );

    document
      .getElementById("importInput")
      ?.addEventListener("change", (event) => {
        const file = event.target.files[0];

        if (file) {
          importData(file);
        }

        event.target.value = "";
      });

    /* Clear */

    document
      .getElementById("clearBtn")
      ?.addEventListener("click", clearAllData);

    /* Keyboard */

    document.addEventListener("keydown", (event) => {
      if (event.key === "Tab") {
        const savingsDialog = document.querySelector(
          "#savingsOperationOverlay.is-open .modal",
        );
        if (savingsDialog) {
          const focusable = Array.from(
            savingsDialog.querySelectorAll(
              'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
            ),
          ).filter((element) => !element.closest("[hidden]"));
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (
            first &&
            last &&
            event.shiftKey &&
            (document.activeElement === first ||
              !savingsDialog.contains(document.activeElement))
          ) {
            event.preventDefault();
            last.focus();
          } else if (
            last &&
            !event.shiftKey &&
            document.activeElement === last
          ) {
            event.preventDefault();
            first.focus();
          }
        }
      }

      if (event.key === "Escape") {
        closeActiveModals();
      }
      /* Handle Browser Back / Forward buttons */
      window.addEventListener("popstate", (event) => {
        const targetPage =
          event.state?.page ||
          window.location.hash.replace("#", "") ||
          "dashboard";
        switchPage(targetPage, false);
      });

      /* Number input wheel */

      document.querySelectorAll('input[type="number"]').forEach((input) => {
        input.addEventListener("wheel", (event) => event.preventDefault(), {
          passive: false,
        });
      });

      /* Resize */

      let resizeTimer;

      window.addEventListener("resize", () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
          if (state.currentPage === "dashboard") {
            renderDashboard();
          } else if (state.currentPage === "reports") {
            renderReportsPage();
          }
        }, 200);
      });
      /* Browser Back / Forward Button Support */
      window.addEventListener("popstate", (event) => {
        const targetPage =
          event.state?.page ||
          window.location.hash.replace("#", "") ||
          "dashboard";
        switchPage(targetPage, false);
      });
    }); //End of keydown listener
    // Transactions Pagination Controls
    document.getElementById("txPrevPageBtn")?.addEventListener("click", () => {
      if (state.txCurrentPage > 1) {
        state.txCurrentPage--;
        renderTransactionsPage();
      }
    });

    document.getElementById("txNextPageBtn")?.addEventListener("click", () => {
      const allRows = getFilteredTransactions();
      const totalPages = Math.ceil(allRows.length / state.txPageSize);
      if (state.txCurrentPage < totalPages) {
        state.txCurrentPage++;
        renderTransactionsPage();
      }
    });

    // Money From Home Pagination Controls
    document
      .getElementById("homeMoneyPrevPageBtn")
      ?.addEventListener("click", () => {
        if (state.homeMoneyCurrentPage > 1) {
          state.homeMoneyCurrentPage--;
          renderHomeMoney();
        }
      });

    document
      .getElementById("homeMoneyNextPageBtn")
      ?.addEventListener("click", () => {
        const totalCount = moneyFromHomeTransactions(state.transactions).length;
        const totalPages = Math.ceil(totalCount / state.homeMoneyPageSize);
        if (state.homeMoneyCurrentPage < totalPages) {
          state.homeMoneyCurrentPage++;
          renderHomeMoney();
        }
      });

    // Savings Activity Pagination Controls
    document
      .getElementById("savingsPrevPageBtn")
      ?.addEventListener("click", () => {
        if (state.savingsCurrentPage > 1) {
          state.savingsCurrentPage--;
          renderSavingsDashboard();
        }
      });

    document
      .getElementById("savingsNextPageBtn")
      ?.addEventListener("click", () => {
        const totalSavingsPages = Math.ceil(
          getSavingsActivity().length / state.savingsPageSize,
        );
        if (state.savingsCurrentPage < totalSavingsPages) {
          state.savingsCurrentPage++;
          renderSavingsDashboard();
        }
      });
      document.getElementById("downloadTxPdfBtn")
      ?.addEventListener("click", downloadTransactionsPdf);

  } // window.addEventListener

  /* =======================================================
         INITIALIZATION
      ======================================================= */

  async function init() {
    try {
      const user = await checkAuthentication();

      if (!user) {
        return;
      }

      state.user = user;

      await Promise.all([loadCurrentProfile(), loadStudentFeatures()]);

      state.transactions = Store.loadTransactions();

      state.settings = {
        ...DEFAULT_SETTINGS,
        ...Store.loadSettings(),
      };

      try {
        const transactionsSynced = await syncTransactionsToSupabase();
        if (transactionsSynced) {
          await syncFromServer();
        }
      } catch (error) {
        if (!connection.handleError(error)) {
          console.warn("Supabase transaction sync failed:", error);
        }
      }

      /*
            4. Report default dates
          */

      const currentMonth = startOfMonth(new Date());

      const reportStart = document.getElementById("reportStartDate");

      const reportEnd = document.getElementById("reportEndDate");

      if (reportStart) {
        reportStart.value = toISODate(currentMonth);
      }

      if (reportEnd) {
        reportEnd.value = todayISO();
      }

      /*
            5. Theme
          */

      applyTheme(state.settings.theme);

      /*
            6. Student tip
          */

      const tip = document.getElementById("sidebarTip");

      if (tip) {
        tip.textContent =
          STUDENT_TIPS[Math.floor(Math.random() * STUDENT_TIPS.length)];
      }

      /*
            7. Connect all buttons
          */

      wireEvents();

      document
        .getElementById("moveCashToSavingsBtn")
        ?.addEventListener("click", (event) =>
          openSavingsOperationModal("transfer", event.currentTarget, "cash"),
        );

      document
        .getElementById("moveOnlineToSavingsBtn")
        ?.addEventListener("click", (event) =>
          openSavingsOperationModal("transfer", event.currentTarget, "online"),
        );

      /* Load reminder controls */
      renderReminderSettings();

      /* Start daily reminder checker */
      startReminderChecker();

      /* Show login reminder once */
      showLoginReminderOnce();

      /*
            8. Open dashboard or URL hash page 
          */

      const hashPage = window.location.hash.replace("#", "");
      const initialPage = PAGE_META[hashPage] ? hashPage : "dashboard";

      switchPage(initialPage, false);
      history.replaceState({ page: initialPage }, "", "#" + initialPage);

      observeDashboardPanels();

      /*
            9. Check budget
          */

      checkMonthlyBudgetAlerts();

      console.log("StudentSpend initialized successfully.");
    } catch (error) {
      console.error("StudentSpend initialization failed:", error);

      showToast(
        "Dashboard could not initialize. Check the browser console.",
        "error",
      );
    }
  }

  /* =======================================================
     START
  ======================================================= */

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
