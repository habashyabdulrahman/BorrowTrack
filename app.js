/* ── Persistence & Configuration ── */
const STORAGE_KEY = "borrowtrack_v1";
const RATES_CACHE_KEY = "borrowtrack_rates_cache";
const CACHE_DURATION = 12 * 60 * 60 * 1000; // تحديث كل 12 ساعة

const DEFAULTS = {
  active: "EGP",
  currencies: {
    EGP: { total: 10000, spent: 0, remaining: 10000 },
    USD: { total: 1000, spent: 0, remaining: 1000 },
    EUR: { total: 500, spent: 0, remaining: 500 },
  },
  rates: { USD: 49.5, EUR: 54.2 },
  history: [],
};

/* ── State Initialization ── */
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return JSON.parse(JSON.stringify(DEFAULTS));
    const saved = JSON.parse(raw);
    return {
      active: saved.active || DEFAULTS.active,
      currencies: Object.assign({}, DEFAULTS.currencies, saved.currencies),
      rates: Object.assign({}, DEFAULTS.rates, saved.rates),
      history: Array.isArray(saved.history) ? saved.history : [],
    };
  } catch (e) {
    return JSON.parse(JSON.stringify(DEFAULTS));
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {}
}

const state = loadState();

/* ── Exchange Rates API Service ── */
const ExchangeService = {
  async fetchRates() {
    try {
      // 1. التحقق من التخزين المؤقت أولاً
      const cached = localStorage.getItem(RATES_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.timestamp < CACHE_DURATION) {
          return parsed.rates;
        }
      }

      // 2. جلب بيانات جديدة من الـ API
      console.log("Fetching live rates...");
      const response = await fetch(
        "https://api.exchangerate-api.com/v4/latest/USD",
      );
      if (!response.ok) throw new Error("API Failure");

      const data = await response.json();
      const freshRates = {
        USD: parseFloat(data.rates.EGP.toFixed(2)),
        EUR: parseFloat((data.rates.EGP / data.rates.EUR).toFixed(2)),
      };

      // 3. تحديث التخزين المؤقت
      localStorage.setItem(
        RATES_CACHE_KEY,
        JSON.stringify({
          rates: freshRates,
          timestamp: Date.now(),
        }),
      );

      return freshRates;
    } catch (error) {
      console.error("Exchange Rate Error:", error);
      return null;
    }
  },

  async sync() {
    const liveRates = await this.fetchRates();
    if (liveRates) {
      state.rates.USD = liveRates.USD;
      state.rates.EUR = liveRates.EUR;
      saveState();
      showToast("تم تحديث أسعار الصرف حياً ✓", "success");
      return true;
    }
    return false;
  },
};

/* ── UI Helpers ── */
const fmt = (n) =>
  n.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

function updateHeaderDate() {
  document.getElementById("header-date").textContent =
    new Date().toLocaleDateString("ar-EG", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
}

/* ── Core UI Updates ── */
function updateCard() {
  const c = state.currencies[state.active];
  const pct = c.total === 0 ? 0 : Math.max(0, (c.remaining / c.total) * 100);

  document.getElementById("val-remaining").textContent = fmt(c.remaining);
  document.getElementById("val-total").textContent = fmt(c.total);
  document.getElementById("val-spent").textContent = fmt(c.spent);
  document.getElementById("card-badge").textContent = state.active;
  document.getElementById("input-currency-label").textContent = state.active;

  const fill = document.getElementById("progress-fill");
  fill.style.width = pct + "%";
  document.getElementById("progress-pct").textContent = Math.round(pct) + "%";
}

function showToast(msg, type = "") {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.className = "toast " + type;
  void t.offsetWidth;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2800);
}

/* ── Transactions Logic ── */
function processTransaction(type) {
  const amountInput = document.getElementById("amount-input");
  const amount = parseFloat(amountInput.value);

  if (isNaN(amount) || amount <= 0) {
    showToast("برجاء إدخال مبلغ صحيح أكبر من الصفر", "error");
    return;
  }

  const c = state.currencies[state.active];

  if (type === "WITHDRAW") {
    if (amount > c.remaining) {
      showToast("الرصيد المتبقي لا يكفي لهذا السحب!", "error");
      return;
    }
    c.remaining -= amount;
    c.spent += amount;
    showToast("تم السحب بنجاح ✓", "success");
  } else {
    // منطق السداد الذكي: لا يسدد أكثر مما تم سحبه
    const canReturn = Math.min(amount, c.spent);
    c.remaining += canReturn;
    c.spent -= canReturn;
    showToast("تم السداد بنجاح ✓", "success");
  }

  amountInput.value = "";
  saveState();
  updateCard();
  renderRates();
  logTransaction(amount, type);
}

/* ── History Logic ── */
function logTransaction(amount, type) {
  const now = new Date();
  state.history.unshift({
    id: Date.now(),
    amount,
    currency: state.active,
    type,
    time: now.toLocaleTimeString("ar-EG", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    date: now.toLocaleDateString("ar-EG", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }),
  });

  if (state.history.length > 20) state.history.pop();
  saveState();
  renderHistory();
}

function renderHistory() {
  const list = document.getElementById("history-list");
  document.getElementById("history-count").textContent =
    `${state.history.length} حركات`;

  if (!state.history.length) {
    list.innerHTML =
      '<div class="empty-history"><div class="empty-icon">📋</div>لا توجد حركات بعد</div>';
    return;
  }

  list.innerHTML = "";
  state.history.forEach((log) => {
    const isW = log.type === "WITHDRAW";
    const wrap = document.createElement("li");
    wrap.className = "history-item-wrap";
    wrap.dataset.id = log.id;
    wrap.innerHTML = `
      <div class="history-item">
        <div class="history-left">
          <div class="history-dot ${isW ? "withdraw" : "deposit"}">${isW ? "↓" : "↑"}</div>
          <div>
            <div class="history-label">${isW ? "سحب مصرف" : "سداد دين"}</div>
            <div class="history-time">${log.date || ""} · ${log.time} · ${log.currency}</div>
          </div>
        </div>
        <div class="history-right">
          <div class="history-amount ${isW ? "withdraw" : "deposit"}" dir="ltr">
            ${isW ? "-" : "+"}${fmt(log.amount)}
          </div>
          <div class="history-actions">
            <button class="hist-btn hist-edit" data-action="edit">✏️</button>
            <button class="hist-btn hist-del" data-action="del">🗑</button>
          </div>
        </div>
      </div>
      <div class="history-edit-row" id="edit-row-${log.id}">
        <input class="hist-edit-input" type="number" value="${log.amount}" inputmode="decimal" dir="ltr">
        <button class="hist-save" data-id="${log.id}">حفظ</button>
      </div>`;
    list.appendChild(wrap);
  });

  setupHistoryListeners(list);
}

function setupHistoryListeners(list) {
  list.querySelectorAll(".hist-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const wrap = e.target.closest(".history-item-wrap");
      const id = parseInt(wrap.dataset.id);
      btn.dataset.action === "del" ? deleteHistoryItem(id) : toggleEditRow(id);
    });
  });
  list.querySelectorAll(".hist-save").forEach((btn) => {
    btn.addEventListener("click", () =>
      saveHistoryEdit(parseInt(btn.dataset.id)),
    );
  });
}

function deleteHistoryItem(id) {
  const idx = state.history.findIndex((l) => l.id === id);
  if (idx === -1) return;

  const log = state.history[idx];
  const c = state.currencies[log.currency];

  if (log.type === "WITHDRAW") {
    c.remaining += log.amount;
    c.spent -= log.amount;
  } else {
    c.remaining -= log.amount;
    c.spent += log.amount;
  }

  state.history.splice(idx, 1);
  saveState();
  updateCard();
  renderHistory();
  renderRates();
  showToast("تم حذف الحركة وعكس أثرها ✓", "success");
}

function toggleEditRow(id) {
  const row = document.getElementById("edit-row-" + id);
  const isOpen = row.classList.contains("open");
  document
    .querySelectorAll(".history-edit-row.open")
    .forEach((r) => r.classList.remove("open"));
  if (!isOpen) {
    row.classList.add("open");
    row.querySelector("input").focus();
  }
}

function saveHistoryEdit(id) {
  const row = document.getElementById("edit-row-" + id);
  const newAmount = parseFloat(row.querySelector("input").value);
  if (isNaN(newAmount) || newAmount <= 0)
    return showToast("مبلغ غير صحيح", "error");

  const idx = state.history.findIndex((l) => l.id === id);
  const log = state.history[idx];
  const c = state.currencies[log.currency];
  const diff = newAmount - log.amount;

  if (log.type === "WITHDRAW") {
    if (c.remaining - diff < 0) return showToast("الرصيد لا يكفي", "error");
    c.remaining -= diff;
    c.spent += diff;
  } else {
    c.remaining += diff;
    c.spent -= diff;
  }

  log.amount = newAmount;
  saveState();
  updateCard();
  renderHistory();
  renderRates();
  showToast("تم تعديل الحركة ✓", "success");
}

/* ── Exchange Rates Logic ── */
/* ── Exchange Rates Logic (Updated UX) ── */
function renderRates() {
  const grid = document.getElementById("rates-grid");
  if (!grid) return;

  const pairs = [{ from: "USD" }, { from: "EUR" }];

  if (!grid.dataset.built) {
    grid.innerHTML = `
      <div class="rate-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <span style="font-size:0.85rem; color:var(--text-secondary); font-weight:600;">تقييم المحافظ (حياً)</span>
        <button id="btn-sync-rates" style="background:none; border:none; color:var(--accent-teal); cursor:pointer; font-size:0.8rem; display:flex; align-items:center; gap:4px;">
          <span>🔄</span> مزامنة
        </button>
      </div>
      <div id="rates-container" style="display: flex; flex-direction: column; gap: 10px;"></div>
    `;

    document
      .getElementById("btn-sync-rates")
      .addEventListener("click", async () => {
        const btn = document.getElementById("btn-sync-rates");
        btn.style.opacity = "0.5";
        const success = await ExchangeService.sync();
        if (success) renderRates();
        btn.style.opacity = "1";
      });
    grid.dataset.built = "1";
  }

  const container = document.getElementById("rates-container");
  container.innerHTML = "";

  pairs.forEach((pair) => {
    const rate = state.rates[pair.from];
    const remaining = state.currencies[pair.from].remaining;
    const equiv = remaining * rate;

    const row = document.createElement("div");
    row.className = "rate-row";
    // تنسيق البطاقة لتكون للقراءة فقط وبشكل أنيق
    row.style.background = "var(--surface)";
    row.style.padding = "14px 16px";
    row.style.borderRadius = "var(--radius-sm)";
    row.style.border = "1px solid var(--border-light)";
    row.style.display = "flex";
    row.style.justifyContent = "space-between";
    row.style.alignItems = "center";

    row.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 6px;">
        <div style="font-size: 0.75rem; color: var(--text-secondary);">
          سعر السوق: 1 ${pair.from} = ${fmt(rate)} EGP
        </div>
        <div style="font-size: 0.9rem; font-weight: 600;">
          محفظتك: <span dir="ltr">${fmt(remaining)} ${pair.from}</span>
        </div>
      </div>
      <div style="font-size: 1.1rem; font-weight: bold; color: var(--accent-teal);" dir="ltr">
        ≈ ${fmt(equiv)} EGP
      </div>
    `;

    container.appendChild(row);
  });
}

/* ── Base Amount Modal Logic ── */
const modal = {
  el: document.getElementById("modal-base"),
  input: document.getElementById("modal-base-input"),
  open() {
    const cur = state.active;
    document.getElementById("modal-base-sub").textContent =
      `تعديل إجمالي محفظة ${cur}`;
    this.input.value = state.currencies[cur].total;
    this.el.classList.add("open");
    setTimeout(() => this.input.select(), 100);
  },
  close() {
    this.el.classList.remove("open");
  },
  confirm() {
    const newTotal = parseFloat(this.input.value);
    if (isNaN(newTotal) || newTotal < 0)
      return showToast("قيمة غير صحيحة", "error");

    const c = state.currencies[state.active];
    const delta = newTotal - c.total;
    c.total = newTotal;
    c.remaining = Math.max(0, c.remaining + delta);

    saveState();
    updateCard();
    renderRates();
    this.close();
    showToast("تم تحديث الإجمالي بنجاح ✓", "success");
  },
};

/* ── Event Listeners ── */
function initEventListeners() {
  document
    .getElementById("btn-edit-base")
    ?.addEventListener("click", () => modal.open());
  document
    .getElementById("modal-base-cancel")
    ?.addEventListener("click", () => modal.close());
  document
    .getElementById("modal-base-confirm")
    ?.addEventListener("click", () => modal.confirm());

  document.getElementById("currency-tabs").addEventListener("click", (e) => {
    const tab = e.target.closest(".tab");
    if (!tab) return;
    document
      .querySelectorAll(".tab")
      .forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    state.active = tab.dataset.currency;
    saveState();
    updateCard();
  });

  document
    .getElementById("btn-withdraw")
    .addEventListener("click", () => processTransaction("WITHDRAW"));
  document
    .getElementById("btn-deposit")
    .addEventListener("click", () => processTransaction("DEPOSIT"));
}

/* ── Bootstrap ── */
function bootstrap() {
  updateHeaderDate();
  initEventListeners();
  updateCard();
  renderHistory();
  renderRates();

  // مزامنة الأسعار في الخلفية عند التشغيل
  ExchangeService.sync().then(() => renderRates());

  // تعيين التبويب النشط
  document.querySelectorAll(".tab").forEach((t) => {
    t.classList.toggle("active", t.dataset.currency === state.active);
  });
}

bootstrap();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./sw.js")
      .then(() => console.log("PWA: Service Worker Registered ✓"))
      .catch((err) => console.log("PWA: Registration Failed", err));
  });
}