const CONFIG_KEY = "couple-budget-supabase-config";

const categories = {
  expense: ["식비", "카페", "생활", "교통", "주거", "데이트", "의료", "선물", "기타"],
  income: ["월급", "보너스", "부수입", "환급", "기타"],
};

const categoryColors = {
  식비: "#2f7d5c",
  카페: "#b78b2f",
  생활: "#3f6f9f",
  교통: "#55636f",
  주거: "#6b5c9b",
  데이트: "#d55f4a",
  의료: "#4f8f8b",
  선물: "#bc6c57",
  기타: "#7a7f87",
  월급: "#3f6f9f",
  보너스: "#2f7d5c",
  부수입: "#5f8a40",
  환급: "#6b5c9b",
};

let client = null;
let session = null;
let household = null;
let state = { people: [], entries: [], assets: [] };
let selectedMonth = new Date();
let selectedView = "list";
let selectedDate = null;
let editingEntry = null;
const mobileQuery = window.matchMedia("(max-width: 680px)");

const els = {
  accountEmail: document.querySelector("#accountEmail"),
  logoutButton: document.querySelector("#logoutButton"),
  setupView: document.querySelector("#setupView"),
  budgetView: document.querySelector("#budgetView"),
  householdSetup: document.querySelector("#householdSetup"),
  configForm: document.querySelector("#configForm"),
  supabaseUrlInput: document.querySelector("#supabaseUrlInput"),
  supabaseKeyInput: document.querySelector("#supabaseKeyInput"),
  authForm: document.querySelector("#authForm"),
  emailInput: document.querySelector("#emailInput"),
  passwordInput: document.querySelector("#passwordInput"),
  createHouseholdForm: document.querySelector("#createHouseholdForm"),
  householdNameInput: document.querySelector("#householdNameInput"),
  joinHouseholdForm: document.querySelector("#joinHouseholdForm"),
  inviteCodeInput: document.querySelector("#inviteCodeInput"),
  inviteCode: document.querySelector("#inviteCode"),
  copyInviteButton: document.querySelector("#copyInviteButton"),
  currentMonth: document.querySelector("#currentMonth"),
  prevMonth: document.querySelector("#prevMonth"),
  nextMonth: document.querySelector("#nextMonth"),
  remainingAmount: document.querySelector("#remainingAmount"),
  incomeAmount: document.querySelector("#incomeAmount"),
  expenseAmount: document.querySelector("#expenseAmount"),
  savingRate: document.querySelector("#savingRate"),
  budgetProgress: document.querySelector("#budgetProgress"),
  entryForm: document.querySelector("#entryForm"),
  entryType: document.querySelector("#entryType"),
  dateInput: document.querySelector("#dateInput"),
  amountInput: document.querySelector("#amountInput"),
  titleInput: document.querySelector("#titleInput"),
  categoryInput: document.querySelector("#categoryInput"),
  personInput: document.querySelector("#personInput"),
  fixedInput: document.querySelector("#fixedInput"),
  filterPerson: document.querySelector("#filterPerson"),
  insightStrip: document.querySelector("#insightStrip"),
  calendarView: document.querySelector("#calendarView"),
  dayDetailBar: document.querySelector("#dayDetailBar"),
  dayDetailTitle: document.querySelector("#dayDetailTitle"),
  entryList: document.querySelector("#entryList"),
  categoryStats: document.querySelector("#categoryStats"),
  personStats: document.querySelector("#personStats"),
  assetForm: document.querySelector("#assetForm"),
  assetCategoryInput: document.querySelector("#assetCategoryInput"),
  assetNameInput: document.querySelector("#assetNameInput"),
  assetAmountInput: document.querySelector("#assetAmountInput"),
  assetTotal: document.querySelector("#assetTotal"),
  assetList: document.querySelector("#assetList"),
  quickEntryModal: document.querySelector("#quickEntryModal"),
  quickEntryForm: document.querySelector("#quickEntryForm"),
  quickEntryClose: document.querySelector("#quickEntryClose"),
  quickEntryTitle: document.querySelector("#quickEntryTitle"),
  quickDateLabel: document.querySelector("#quickDateLabel"),
  quickDateInput: document.querySelector("#quickDateInput"),
  quickEntryType: document.querySelector("#quickEntryType"),
  quickAmountInput: document.querySelector("#quickAmountInput"),
  quickTitleInput: document.querySelector("#quickTitleInput"),
  quickCategoryInput: document.querySelector("#quickCategoryInput"),
  quickPersonInput: document.querySelector("#quickPersonInput"),
  quickFixedInput: document.querySelector("#quickFixedInput"),
  quickSubmitButton: document.querySelector("#quickSubmitButton"),
  quickAddButton: document.querySelector("#quickAddButton"),
  entryTemplate: document.querySelector("#entryTemplate"),
  statusLine: document.querySelector("#statusLine"),
};

boot();

async function boot() {
  bindEvents();
  loadConfig();
  renderCategoryOptions();
  els.dateInput.value = todayISO();
  syncViewForViewport();
  bindMoneyInput(els.amountInput);
  bindMoneyInput(els.assetAmountInput);
  bindMoneyInput(els.quickAmountInput);

  if (!client) {
    setStatus("Supabase 연결 정보를 먼저 저장하세요.");
    return;
  }

  const { data } = await client.auth.getSession();
  session = data.session;
  client.auth.onAuthStateChange(async (_event, nextSession) => {
    session = nextSession;
    await refreshApp();
  });
  await refreshApp();
}

function bindEvents() {
  els.configForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const config = {
      url: els.supabaseUrlInput.value.trim(),
      key: els.supabaseKeyInput.value.trim(),
    };
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    if (!initClient(config)) return;
    setStatus("Supabase 연결 정보를 저장했습니다.");
    refreshApp();
  });

  els.authForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const action = event.submitter?.dataset.authAction;
    const email = els.emailInput.value.trim();
    const password = els.passwordInput.value;

    const result =
      action === "signup"
        ? await client.auth.signUp({ email, password })
        : await client.auth.signInWithPassword({ email, password });

    if (result.error) {
      setStatus(result.error.message);
      return;
    }

    setStatus(action === "signup" ? "회원가입이 완료되었습니다. 바로 로그인 상태로 전환됩니다." : "로그인했습니다.");
  });

  els.logoutButton.addEventListener("click", async () => {
    if (!client) return;
    await client.auth.signOut();
    household = null;
    state = { people: [], entries: [], assets: [] };
    await refreshApp();
  });

  els.createHouseholdForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await createHousehold(els.householdNameInput.value.trim() || "우리집");
  });

  els.joinHouseholdForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await joinHousehold(els.inviteCodeInput.value.trim());
  });

  document.querySelectorAll("[data-type]").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll("[data-type]").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      els.entryType.value = button.dataset.type;
      renderCategoryOptions();
    });
  });

  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedView = button.dataset.view;
      document.querySelectorAll("[data-view]").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      renderEntries();
    });
  });

  document.querySelectorAll("[data-quick-type]").forEach((button) => {
    button.addEventListener("click", () => {
      setQuickType(button.dataset.quickType);
    });
  });

  mobileQuery.addEventListener("change", () => {
    syncViewForViewport();
    renderEntries();
  });

  els.prevMonth.addEventListener("click", () => {
    selectedMonth = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 1, 1);
    selectedDate = null;
    render();
  });

  els.nextMonth.addEventListener("click", () => {
    selectedMonth = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 1);
    selectedDate = null;
    render();
  });

  els.copyInviteButton.addEventListener("click", async () => {
    if (!household) return;
    await navigator.clipboard.writeText(household.id);
    setStatus("초대 코드를 복사했습니다.");
  });

  els.quickEntryClose.addEventListener("click", closeQuickEntryModal);
  els.quickEntryModal.addEventListener("click", (event) => {
    if (event.target === els.quickEntryModal) {
      closeQuickEntryModal();
    }
  });
  els.quickDateInput.addEventListener("input", () => {
    els.quickDateLabel.textContent = els.quickDateInput.value.replaceAll("-", ".");
  });

  els.quickAddButton.addEventListener("click", () => {
    openQuickEntryModal(selectedDate || `${monthKey(selectedMonth)}-01`);
  });

  els.quickEntryForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const amount = parseMoney(els.quickAmountInput.value);
    if (!amount || amount < 1 || !household) return;

    const entryPayload = {
      type: els.quickEntryType.value,
      date: els.quickDateInput.value,
      amount,
      title: els.quickTitleInput.value.trim(),
      category: els.quickCategoryInput.value,
      personId: els.quickPersonInput.value || null,
      fixed: els.quickFixedInput.checked,
    };
    const saved = editingEntry ? await updateEntry(editingEntry, entryPayload) : await saveEntry(entryPayload);
    if (!saved) return;

    closeQuickEntryModal();
    await loadBudgetData();
    render();
  });

  els.entryForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const amount = parseMoney(els.amountInput.value);
    if (!amount || amount < 1 || !household) return;

    const saved = await saveEntry({
      type: els.entryType.value,
      date: els.dateInput.value,
      amount,
      title: els.titleInput.value.trim(),
      category: els.categoryInput.value,
      personId: els.personInput.value || null,
      fixed: els.fixedInput.checked,
    });
    if (!saved) return;

    els.entryForm.reset();
    els.dateInput.value = todayISO();
    renderCategoryOptions();
    await loadBudgetData();
    render();
  });

  els.assetForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const amount = parseMoney(els.assetAmountInput.value);
    const name = els.assetNameInput.value.trim();
    if (!household || !name || Number.isNaN(amount) || amount < 0) return;

    const { error } = await client.from("assets").insert({
      household_id: household.id,
      category: els.assetCategoryInput.value,
      name,
      amount,
    });

    if (error) {
      setStatus(error.message);
      return;
    }

    els.assetForm.reset();
    await loadBudgetData();
    renderStats();
  });

  els.filterPerson.addEventListener("change", render);
}

function loadConfig() {
  const saved = localStorage.getItem(CONFIG_KEY);
  if (!saved) return;
  try {
    const config = JSON.parse(saved);
    els.supabaseUrlInput.value = config.url || "";
    els.supabaseKeyInput.value = config.key || "";
    initClient(config);
  } catch {
    localStorage.removeItem(CONFIG_KEY);
  }
}

function initClient(config) {
  if (!config.url || !config.key) return false;
  if (!window.supabase) {
    setStatus("Supabase 라이브러리를 불러오지 못했습니다. 인터넷 연결 또는 배포 환경을 확인하세요.");
    return false;
  }
  client = window.supabase.createClient(config.url, config.key);
  return true;
}

async function refreshApp() {
  if (!client) {
    showSetup();
    return;
  }

  const { data } = await client.auth.getSession();
  session = data.session;
  els.accountEmail.textContent = session?.user?.email || "로그인 전";
  els.logoutButton.classList.toggle("hidden", !session);

  if (!session) {
    showSetup();
    els.householdSetup.classList.add("hidden");
    return;
  }

  await loadHousehold();
  if (!household) {
    showSetup();
    els.householdSetup.classList.remove("hidden");
    return;
  }

  await loadBudgetData();
  showBudget();
  render();
}

function showSetup() {
  els.setupView.classList.remove("hidden");
  els.budgetView.classList.add("hidden");
}

function showBudget() {
  els.setupView.classList.add("hidden");
  els.budgetView.classList.remove("hidden");
}

function isMobileView() {
  return mobileQuery.matches;
}

function syncViewForViewport() {
  if (isMobileView()) {
    selectedView = "calendar";
  }
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === selectedView);
  });
}

async function loadHousehold() {
  household = null;
  const { data, error } = await client
    .from("household_members")
    .select("household_id, households(id, name)")
    .eq("user_id", session.user.id)
    .limit(1)
    .maybeSingle();

  if (error) {
    setStatus(error.message);
    return;
  }

  if (data?.households) {
    household = data.households;
  }
}

async function createHousehold(name) {
  const id = crypto.randomUUID();
  const householdResult = await client.from("households").insert({
    id,
    name,
    created_by: session.user.id,
  });

  if (householdResult.error) {
    setStatus(householdResult.error.message);
    return;
  }

  const memberResult = await client.from("household_members").insert({
    household_id: id,
    user_id: session.user.id,
    role: "owner",
  });

  if (memberResult.error) {
    setStatus(memberResult.error.message);
    return;
  }

  await client.from("people").insert([
    { household_id: id, name: "병현" },
    { household_id: id, name: "윤경" },
    { household_id: id, name: "공동" },
  ]);

  setStatus("우리집을 만들었습니다. 배우자에게 초대 코드를 공유하세요.");
  await refreshApp();
}

async function joinHousehold(inviteCode) {
  if (!inviteCode) return;
  const { error } = await client.from("household_members").insert({
    household_id: inviteCode,
    user_id: session.user.id,
    role: "member",
  });

  if (error) {
    setStatus(error.message);
    return;
  }

  setStatus("우리집에 참여했습니다.");
  await refreshApp();
}

async function saveEntry({ type, date, amount, title, category, personId, fixed }) {
  let fixedItemId = null;

  if (fixed) {
    const fixedResult = await client
      .from("fixed_items")
      .insert({
        household_id: household.id,
        type,
        day_of_month: Number(date.slice(-2)),
        amount,
        title,
        category,
        person_id: personId,
        created_by: session.user.id,
      })
      .select("id")
      .single();

    if (fixedResult.error) {
      setStatus(fixedResult.error.message);
      return false;
    }

    fixedItemId = fixedResult.data.id;
  }

  const { error } = await client.from("transactions").insert({
    household_id: household.id,
    type,
    date,
    amount,
    title,
    category,
    person_id: personId,
    fixed_item_id: fixedItemId,
    created_by: session.user.id,
  });

  if (error) {
    setStatus(error.message);
    return false;
  }

  return true;
}

async function updateEntry(entry, { type, date, amount, title, category, personId, fixed }) {
  let fixedItemId = entry.fixed_item_id || null;

  if (fixed) {
    const fixedPayload = {
      type,
      day_of_month: Number(date.slice(-2)),
      amount,
      title,
      category,
      person_id: personId,
      active: true,
    };

    if (fixedItemId) {
      const fixedUpdate = await client
        .from("fixed_items")
        .update(fixedPayload)
        .eq("id", fixedItemId)
        .eq("household_id", household.id);

      if (fixedUpdate.error) {
        setStatus(fixedUpdate.error.message);
        return false;
      }
    } else {
      const fixedCreate = await client
        .from("fixed_items")
        .insert({
          household_id: household.id,
          ...fixedPayload,
          created_by: session.user.id,
        })
        .select("id")
        .single();

      if (fixedCreate.error) {
        setStatus(fixedCreate.error.message);
        return false;
      }

      fixedItemId = fixedCreate.data.id;
    }
  } else if (fixedItemId) {
    const fixedDisable = await client
      .from("fixed_items")
      .update({ active: false })
      .eq("id", fixedItemId)
      .eq("household_id", household.id);

    if (fixedDisable.error) {
      setStatus(fixedDisable.error.message);
      return false;
    }

    fixedItemId = null;
  }

  const { error } = await client
    .from("transactions")
    .update({
      type,
      date,
      amount,
      title,
      category,
      person_id: personId,
      fixed_item_id: fixedItemId,
    })
    .eq("id", entry.id)
    .eq("household_id", household.id);

  if (error) {
    setStatus(error.message);
    return false;
  }

  return true;
}

async function loadBudgetData() {
  await materializeFixedItemsForMonth(selectedMonth);

  const [peopleResult, transactionsResult, assetsResult] = await Promise.all([
    client.from("people").select("id, name").eq("household_id", household.id).order("created_at"),
    client
      .from("transactions")
      .select("id, type, date, amount, title, category, person_id, fixed_item_id, people(name)")
      .eq("household_id", household.id)
      .order("date", { ascending: false }),
    client.from("assets").select("id, category, name, amount").eq("household_id", household.id).order("created_at"),
  ]);

  if (peopleResult.error || transactionsResult.error || assetsResult.error) {
    setStatus(peopleResult.error?.message || transactionsResult.error?.message || assetsResult.error?.message);
    return;
  }

  state.people = peopleResult.data || [];
  state.entries = (transactionsResult.data || []).map((entry) => ({
    ...entry,
    person: entry.people?.name || "미지정",
  }));
  state.assets = assetsResult.data || [];
}

async function materializeFixedItemsForMonth(date) {
  if (!household) return;
  const { data: fixedItems, error } = await client
    .from("fixed_items")
    .select("id, type, day_of_month, amount, title, category, person_id, created_by")
    .eq("household_id", household.id)
    .eq("active", true);

  if (error) {
    setStatus(error.message);
    return;
  }

  const year = date.getFullYear();
  const month = date.getMonth();
  const key = monthKey(date);
  const lastDate = new Date(year, month + 1, 0).getDate();

  for (const item of fixedItems || []) {
    const day = Math.min(item.day_of_month, lastDate);
    const targetDate = `${key}-${String(day).padStart(2, "0")}`;
    const existing = await client
      .from("transactions")
      .select("id")
      .eq("household_id", household.id)
      .eq("fixed_item_id", item.id)
      .eq("date", targetDate)
      .maybeSingle();

    if (existing.error) {
      setStatus(existing.error.message);
      continue;
    }

    if (existing.data) continue;

    const insertResult = await client.from("transactions").insert({
      household_id: household.id,
      type: item.type,
      date: targetDate,
      amount: item.amount,
      title: item.title,
      category: item.category,
      person_id: item.person_id,
      fixed_item_id: item.id,
      created_by: item.created_by,
    });

    if (insertResult.error) {
      setStatus(insertResult.error.message);
    }
  }
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatWon(value) {
  return `${value.toLocaleString("ko-KR")}원`;
}

function parseMoney(value) {
  const normalized = String(value).replace(/[^\d]/g, "");
  return normalized ? Number(normalized) : 0;
}

function bindMoneyInput(input) {
  input.addEventListener("input", () => {
    const amount = parseMoney(input.value);
    input.value = amount ? amount.toLocaleString("ko-KR") : "";
  });
}

function compactWon(value) {
  if (!value) return "0";
  if (value >= 10000) return `${Math.round(value / 1000) / 10}만`;
  return value.toLocaleString("ko-KR");
}

function currentMonthEntries() {
  return entriesForMonth(selectedMonth);
}

function previousMonthEntries() {
  return entriesForMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 1, 1));
}

function entriesForMonth(date) {
  const key = monthKey(date);
  const personId = els.filterPerson.value || "전체";
  return state.entries
    .filter((entry) => entry.date.startsWith(key))
    .filter((entry) => personId === "전체" || entry.person_id === personId)
    .sort((a, b) => b.date.localeCompare(a.date));
}

function entriesForSelectedView() {
  const entries = currentMonthEntries();
  if (selectedView !== "calendar" || !selectedDate) return entries;
  return entries.filter((entry) => entry.date === selectedDate);
}

function render() {
  els.currentMonth.textContent = selectedMonth.toLocaleDateString("ko-KR", { year: "numeric", month: "long" });
  els.inviteCode.textContent = household?.id || "";
  els.dateInput.value ||= todayISO();
  renderPeople();
  renderCategoryOptions();
  renderSummary();
  renderEntries();
  renderStats();
}

function renderPeople() {
  const selectedPerson = els.personInput.value;
  const selectedQuickPerson = els.quickPersonInput.value;
  els.personInput.innerHTML = state.people.map((person) => `<option value="${person.id}">${person.name}</option>`).join("");
  els.quickPersonInput.innerHTML = state.people.map((person) => `<option value="${person.id}">${person.name}</option>`).join("");
  if (state.people.some((person) => person.id === selectedPerson)) {
    els.personInput.value = selectedPerson;
  }
  if (state.people.some((person) => person.id === selectedQuickPerson)) {
    els.quickPersonInput.value = selectedQuickPerson;
  }

  const currentFilter = els.filterPerson.value || "전체";
  els.filterPerson.innerHTML = ["<option value=\"전체\">전체</option>", ...state.people.map((person) => `<option value="${person.id}">${person.name}</option>`)].join("");
  els.filterPerson.value = ["전체", ...state.people.map((person) => person.id)].includes(currentFilter) ? currentFilter : "전체";

}

function renderCategoryOptions() {
  renderOptions(els.categoryInput, categories[els.entryType.value]);
  renderQuickCategoryOptions();
}

function renderQuickCategoryOptions() {
  renderOptions(els.quickCategoryInput, categories[els.quickEntryType.value]);
}

function renderOptions(select, options) {
  const selected = select.value;
  select.innerHTML = options.map((option) => `<option value="${option}">${option}</option>`).join("");
  if (options.includes(selected)) {
    select.value = selected;
  }
}

function setQuickType(type) {
  els.quickEntryType.value = type;
  document.querySelectorAll("[data-quick-type]").forEach((button) => {
    button.classList.toggle("active", button.dataset.quickType === type);
  });
  renderQuickCategoryOptions();
}

function openQuickEntryModal(date, entry = null) {
  editingEntry = entry;
  selectedDate = date;
  els.quickDateInput.value = date;
  els.quickDateLabel.textContent = date.replaceAll("-", ".");
  els.quickEntryTitle.textContent = entry ? "내역 수정" : "날짜 기록";
  els.quickSubmitButton.textContent = entry ? "수정 저장" : "저장";
  els.quickEntryForm.reset();
  els.quickDateInput.value = date;
  setQuickType(entry?.type || "expense");
  els.quickAmountInput.value = entry ? entry.amount.toLocaleString("ko-KR") : "";
  els.quickTitleInput.value = entry?.title || "";
  els.quickCategoryInput.value = entry?.category || els.quickCategoryInput.value;
  if (entry?.person_id && state.people.some((person) => person.id === entry.person_id)) {
    els.quickPersonInput.value = entry.person_id;
  }
  els.quickFixedInput.checked = !!entry?.fixed_item_id;
  els.quickEntryModal.classList.remove("hidden");
  requestAnimationFrame(() => els.quickAmountInput.focus());
}

function closeQuickEntryModal() {
  editingEntry = null;
  els.quickEntryModal.classList.add("hidden");
}

function renderSummary() {
  const entries = currentMonthEntries();
  const previousEntries = previousMonthEntries();
  const income = sum(previousEntries.filter((entry) => entry.type === "income"));
  const expense = sum(entries.filter((entry) => entry.type === "expense"));
  const remaining = income - expense;
  const savingRate = income ? Math.round((remaining / income) * 100) : 0;
  const progress = income ? Math.min(100, Math.round((expense / income) * 100)) : 0;

  els.remainingAmount.textContent = formatWon(remaining);
  els.incomeAmount.textContent = formatWon(income);
  els.expenseAmount.textContent = formatWon(expense);
  els.savingRate.textContent = `${savingRate}%`;
  els.budgetProgress.style.width = `${progress}%`;

  const biggest = topByCategory(entries);
  const daysInMonth = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0).getDate();
  els.insightStrip.innerHTML = [
    ["이번 달 거래", `${entries.length}건`],
    ["가장 큰 지출", biggest ? `${biggest.label} ${formatWon(biggest.amount)}` : "아직 없음"],
    ["하루 평균 지출", formatWon(Math.round(expense / daysInMonth))],
  ]
    .map(([label, value]) => `<div class="insight"><span>${label}</span><strong>${value}</strong></div>`)
    .join("");
}

function renderEntries() {
  syncViewForViewport();
  renderCalendar();
  const entries = entriesForSelectedView();
  els.entryList.innerHTML = "";
  els.calendarView.classList.toggle("hidden", selectedView !== "calendar");
  els.dayDetailBar.classList.toggle("hidden", selectedView !== "calendar");

  if (selectedView === "calendar") {
    const label = selectedDate ? selectedDate.replaceAll("-", ".") : "날짜를 선택하세요";
    els.dayDetailTitle.textContent = selectedDate ? `${label} 내역` : label;
  }

  if (!entries.length) {
    els.entryList.innerHTML =
      selectedView === "calendar"
        ? `<div class="empty">선택한 날짜의 기록이 없어요.</div>`
        : `<div class="empty">이번 달 기록이 없어요.<br />첫 내역을 추가해보세요.</div>`;
    return;
  }

  entries.forEach((entry) => {
    const node = els.entryTemplate.content.firstElementChild.cloneNode(true);
    const icon = node.querySelector(".entry-icon");
    const title = node.querySelector(".entry-main strong");
    const meta = node.querySelector(".entry-main span");
    const money = node.querySelector(".entry-money");
    const deleteButton = node.querySelector(".delete-button");

    icon.textContent = entry.category.slice(0, 1);
    icon.style.background = categoryColors[entry.category] || "#7a7f87";
    title.textContent = entry.title;
    meta.textContent = `${entry.date} · ${entry.category} · ${entry.person}${entry.fixed_item_id ? " · 고정비" : ""}`;
    money.textContent = `${entry.type === "income" ? "+" : "-"}${formatWon(entry.amount)}`;
    money.classList.add(entry.type);
    node.addEventListener("click", () => {
      openQuickEntryModal(entry.date, entry);
    });
    deleteButton.addEventListener("click", async (event) => {
      event.stopPropagation();
      await client.from("transactions").delete().eq("id", entry.id).eq("household_id", household.id);
      await loadBudgetData();
      render();
    });

    els.entryList.append(node);
  });
}

function renderCalendar() {
  if (!els.calendarView) return;
  const entries = currentMonthEntries();
  const year = selectedMonth.getFullYear();
  const month = selectedMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDate = new Date(year, month + 1, 0).getDate();
  const offset = firstDay.getDay();
  const dayMap = new Map();

  entries.forEach((entry) => {
    const current = dayMap.get(entry.date) || { income: 0, expense: 0, count: 0 };
    current[entry.type] += entry.amount;
    current.count += 1;
    dayMap.set(entry.date, current);
  });

  if (!selectedDate || !selectedDate.startsWith(monthKey(selectedMonth))) {
    const firstEntryDay = [...dayMap.keys()].sort()[0];
    selectedDate = firstEntryDay || `${monthKey(selectedMonth)}-01`;
  }

  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  const cells = [];
  weekdays.forEach((day) => cells.push(`<div class="calendar-weekday">${day}</div>`));
  for (let i = 0; i < offset; i += 1) {
    cells.push(`<div class="calendar-cell blank"></div>`);
  }

  for (let day = 1; day <= lastDate; day += 1) {
    const date = `${monthKey(selectedMonth)}-${String(day).padStart(2, "0")}`;
    const sums = dayMap.get(date);
    const isSelected = date === selectedDate;
    cells.push(`
      <button class="calendar-cell ${isSelected ? "selected" : ""}" type="button" data-date="${date}">
        <span class="calendar-day">${day}</span>
        ${
          sums
            ? `${sums.expense ? `<span class="calendar-expense">-${compactWon(sums.expense)}</span>` : ""}
               ${sums.income ? `<span class="calendar-income">+${compactWon(sums.income)}</span>` : ""}
               <span class="calendar-count">${sums.count}건</span>`
            : `<span class="calendar-empty-dot"></span>`
        }
      </button>
    `);
  }

  els.calendarView.innerHTML = cells.join("");
  els.calendarView.querySelectorAll("[data-date]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedDate = button.dataset.date;
      els.calendarView.querySelectorAll("[data-date]").forEach((item) => item.classList.remove("selected"));
      button.classList.add("selected");
      renderEntries();
    });
  });
}

function renderStats() {
  const entries = currentMonthEntries().filter((entry) => entry.type === "expense");
  renderRows(els.categoryStats, groupSum(entries, "category"), "category");
  renderRows(els.personStats, groupSum(entries, "person"), "person");
  renderAssets();
}

function renderAssets() {
  const total = sum(state.assets);
  els.assetTotal.textContent = formatWon(total);

  if (!state.assets.length) {
    els.assetList.innerHTML = `<div class="empty asset-empty">등록된 자산이 없어요.</div>`;
    return;
  }

  els.assetList.innerHTML = state.assets
    .map(
      (asset) => `
        <article class="asset-item">
          <div>
            <strong>${asset.name}</strong>
            <span>${asset.category}</span>
          </div>
          <strong>${formatWon(asset.amount)}</strong>
          <button class="delete-button" type="button" data-remove-asset="${asset.id}" aria-label="${asset.name} 삭제">×</button>
        </article>
      `,
    )
    .join("");

  els.assetList.querySelectorAll("[data-remove-asset]").forEach((button) => {
    button.addEventListener("click", async () => {
      const { error } = await client.from("assets").delete().eq("id", button.dataset.removeAsset).eq("household_id", household.id);
      if (error) {
        setStatus(error.message);
        return;
      }
      await loadBudgetData();
      renderStats();
    });
  });
}

function renderRows(container, rows, colorKey) {
  const max = Math.max(...rows.map((row) => row.amount), 1);
  if (!rows.length) {
    container.innerHTML = `<div class="empty">지출 데이터가 없어요.</div>`;
    return;
  }

  container.innerHTML = rows
    .map((row) => {
      const color = colorKey === "category" ? categoryColors[row.label] || "#7a7f87" : row.label === "공동" ? "#2f7d5c" : "#3f6f9f";
      const width = Math.max(7, Math.round((row.amount / max) * 100));
      return `
        <div class="stat-row">
          <div class="stat-top"><span>${row.label}</span><strong>${formatWon(row.amount)}</strong></div>
          <div class="mini-track"><div style="width: ${width}%; background: ${color};"></div></div>
        </div>
      `;
    })
    .join("");
}

function groupSum(entries, key) {
  const map = new Map();
  entries.forEach((entry) => map.set(entry[key], (map.get(entry[key]) || 0) + entry.amount));
  return [...map.entries()]
    .map(([label, amount]) => ({ label, amount }))
    .sort((a, b) => b.amount - a.amount);
}

function topByCategory(entries) {
  return groupSum(
    entries.filter((entry) => entry.type === "expense"),
    "category",
  )[0];
}

function sum(entries) {
  return entries.reduce((total, entry) => total + entry.amount, 0);
}

function setStatus(message) {
  els.statusLine.textContent = message || "";
}
