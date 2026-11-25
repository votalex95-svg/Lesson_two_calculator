"use strict";

/*
=============================================
  СЕМЕЙНЫЙ БЮДЖЕТ
=============================================

Приложение написано на чистом JavaScript.

Основные функции:
1. Добавление доходов и расходов.
2. Редактирование операций.
3. Удаление операций.
4. Фильтрация по месяцу.
5. Подсчёт доходов и расходов.
6. Контроль месячных лимитов.
7. Диаграмма категорий расходов.
8. Сохранение в localStorage.
9. Экспорт и импорт JSON.

Данные сохраняются только в браузере.
Для надёжности используйте резервные копии.
*/

// ==========================================
// 1. НАСТРОЙКИ И КАТЕГОРИИ
// ==========================================

const STORAGE_KEY = "familyBudget_v1";

const categories = {
  income: [
    "Зарплата",
    "Подработка",
    "Бизнес",
    "Пенсия",
    "Пособия",
    "Подарки",
    "Другие доходы"
  ],

  expense: [
    "Продукты",
    "Жильё",
    "Коммунальные услуги",
    "Транспорт",
    "Автомобиль",
    "Здоровье",
    "Дети",
    "Образование",
    "Одежда",
    "Развлечения",
    "Кафе и рестораны",
    "Путешествия",
    "Кредиты",
    "Связь и интернет",
    "Накопления",
    "Другие расходы"
  ]
};

const chartColors = [
  "#2563eb",
  "#16a34a",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#ec4899",
  "#84cc16",
  "#f97316",
  "#64748b",
  "#14b8a6",
  "#6366f1",
  "#a855f7",
  "#eab308",
  "#0ea5e9",
  "#78716c"
];

// ==========================================
// 2. ПОЛУЧЕНИЕ HTML-ЭЛЕМЕНТОВ
// ==========================================

const $ = id => document.getElementById(id);

const form = $("transactionForm");
const typeInput = $("type");
const categoryInput = $("category");
const amountInput = $("amount");
const descriptionInput = $("description");
const dateInput = $("date");
const monthFilter = $("monthFilter");
const historyFilter = $("historyFilter");

let transactions = [];
let monthlyLimits = {};
let editingId = null;

// ==========================================
// 3. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ==========================================

// Локальная дата без проблем с часовыми поясами.
function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

// Форматирование денежных сумм.
function formatMoney(value) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

// Форматирование даты.
function formatDate(value) {
  const [year, month, day] = value.split("-");
  return `${day}.${month}.${year}`;
}

// Генерация уникального ID.
function generateId() {
  if (window.crypto && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return Date.now().toString() +
    Math.random().toString(36).slice(2);
}

// Проверка правильности денежной суммы.
function validAmount(value) {
  return Number.isFinite(value) &&
         value > 0 &&
         value <= 1000000000000 &&
         Math.round(value * 100) / 100 === value;
}

// Проверка даты.
function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [y, m, d] = value.split("-").map(Number);
  const parsed = new Date(y, m - 1, d);

  return parsed.getFullYear() === y &&
         parsed.getMonth() === m - 1 &&
         parsed.getDate() === d;
}

// Безопасное округление суммы.
function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

// Проверка структуры операции.
function isValidTransaction(item) {
  return item &&
    typeof item.id === "string" &&
    item.id.length > 0 &&
    ["income", "expense"].includes(item.type) &&
    typeof item.category === "string" &&
    item.category.length <= 100 &&
    typeof item.description === "string" &&
    item.description.length <= 150 &&
    validDate(item.date) &&
    validAmount(item.amount);
}

// ==========================================
// 4. РАБОТА С ХРАНИЛИЩЕМ
// ==========================================

function saveData() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        transactions,
        monthlyLimits
      })
    );

    return true;
  } catch (error) {
    alert(
      "Не удалось сохранить данные. " +
      "Проверьте настройки браузера или свободное место."
    );

    return false;
  }
}

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) return;

    const data = JSON.parse(raw);

    if (!data || typeof data !== "object") return;

    if (Array.isArray(data.transactions)) {
      transactions = data.transactions.filter(
        isValidTransaction
      );
    }

    if (
      data.monthlyLimits &&
      typeof data.monthlyLimits === "object" &&
      !Array.isArray(data.monthlyLimits)
    ) {
      monthlyLimits = {};

      for (const [month, amount] of Object.entries(
        data.monthlyLimits
      )) {
        if (
          /^\d{4}-(0[1-9]|1[0-2])$/.test(month) &&
          Number.isFinite(amount) &&
          amount >= 0 &&
          amount <= 1000000000000
        ) {
          monthlyLimits[month] = amount;
        }
      }
    }
  } catch (error) {
    console.error("Ошибка чтения данных:", error);
  }
}

// ==========================================
// 5. КАТЕГОРИИ
// ==========================================

function updateCategories(selected = "") {
  const type = typeInput.value;

  categoryInput.replaceChildren();

  categories[type].forEach(category => {
    const option = document.createElement("option");

    option.value = category;
    option.textContent = category;

    categoryInput.appendChild(option);
  });

  // Сохраняем старую категорию при редактировании.
  if (
    selected &&
    !categories[type].includes(selected)
  ) {
    const option = document.createElement("option");
    option.value = selected;
    option.textContent = selected;
    categoryInput.appendChild(option);
  }

  if (selected) {
    categoryInput.value = selected;
  }
}

// ==========================================
// 6. ДОБАВЛЕНИЕ И РЕДАКТИРОВАНИЕ
// ==========================================

function resetForm() {
  form.reset();

  editingId = null;

  typeInput.value = "income";
  dateInput.value = localDateString();

  updateCategories();

  $("formTitle").textContent = "Добавить операцию";
  $("saveBtn").textContent = "Добавить";
  $("cancelEdit").hidden = true;
  $("formMessage").textContent = "";
}

function handleSubmit(event) {
  event.preventDefault();

  const amount = Number(amountInput.value);

  if (!validAmount(amount)) {
    alert("Введите корректную сумму больше нуля.");
    return;
  }

  if (!validDate(dateInput.value)) {
    alert("Укажите корректную дату.");
    return;
  }

  const operation = {
    id: editingId || generateId(),
    type: typeInput.value,
    category: categoryInput.value,
    amount: roundMoney(amount),
    description: descriptionInput.value.trim(),
    date: dateInput.value
  };

  if (!isValidTransaction(operation)) {
    alert("Проверьте данные операции.");
    return;
  }

  // Подготовка нового состояния.
  let updated;

  if (editingId) {
    updated = transactions.map(item =>
      item.id === editingId ? operation : item
    );
  } else {
    updated = [...transactions, operation];
  }

  const previous = transactions;
  transactions = updated;

  if (!saveData()) {
    transactions = previous;
    return;
  }

  const savedMessage = editingId
    ? "Операция изменена."
    : "Операция добавлена.";

  resetForm();

  $("formMessage").textContent = savedMessage;

  // Показываем месяц сохранённой операции.
  monthFilter.value = operation.date.slice(0, 7);

  render();
}

function editTransaction(id) {
  const operation = transactions.find(
    item => item.id === id
  );

  if (!operation) return;

  editingId = id;

  typeInput.value = operation.type;
  updateCategories(operation.category);

  amountInput.value = operation.amount;
  descriptionInput.value = operation.description;
  dateInput.value = operation.date;

  $("formTitle").textContent = "Редактировать операцию";
  $("saveBtn").textContent = "Сохранить изменения";
  $("cancelEdit").hidden = false;

  form.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

function deleteTransaction(id) {
  const confirmed = confirm(
    "Вы действительно хотите удалить операцию?"
  );

  if (!confirmed) return;

  const previous = transactions;

  transactions = transactions.filter(
    item => item.id !== id
  );

  if (!saveData()) {
    transactions = previous;
    return;
  }

  if (editingId === id) {
    resetForm();
  }

  render();
}

// ==========================================
// 7. ПОДСЧЁТ БЮДЖЕТА
// ==========================================

function getMonthTransactions() {
  const month = monthFilter.value;

  return transactions.filter(
    item => item.date.slice(0, 7) === month
  );
}

function calculateSummary(items) {
  let income = 0;
  let expense = 0;

  items.forEach(item => {
    if (item.type === "income") {
      income += item.amount;
    } else {
      expense += item.amount;
    }
  });

  income = roundMoney(income);
  expense = roundMoney(expense);

  return {
    income,
    expense,
    balance: roundMoney(income - expense)
  };
}

function renderSummary() {
  const summary = calculateSummary(
    getMonthTransactions()
  );

  $("totalIncome").textContent =
    formatMoney(summary.income);

  $("totalExpense").textContent =
    formatMoney(summary.expense);

  $("totalBalance").textContent =
    formatMoney(summary.balance);

  const savingsPercent = summary.income > 0
    ? (summary.balance / summary.income) * 100
    : 0;

  $("savingsPercent").textContent =
    savingsPercent.toFixed(1) + "%";

  $("totalBalance").classList.toggle(
    "negative",
    summary.balance < 0
  );

  $("savingsPercent").classList.toggle(
    "negative",
    savingsPercent < 0
  );
}

// ==========================================
// 8. МЕСЯЧНЫЙ ЛИМИТ
// ==========================================

function saveLimit() {
  const month = monthFilter.value;
  const raw = $("budgetLimit").value.trim();

  if (raw === "") {
    alert(
      "Введите сумму лимита. Для удаления лимита укажите 0."
    );
    return;
  }

  const limit = Number(raw);

  if (
    !Number.isFinite(limit) ||
    limit < 0 ||
    limit > 1000000000000
  ) {
    alert("Укажите корректный лимит.");
    return;
  }

  const previous = { ...monthlyLimits };

  if (limit === 0) {
    delete monthlyLimits[month];
  } else {
    monthlyLimits[month] = roundMoney(limit);
  }

  if (!saveData()) {
    monthlyLimits = previous;
    return;
  }

  renderLimit();
}

function renderLimit() {
  const month = monthFilter.value;
  const limit = monthlyLimits[month] || 0;

  const { expense } = calculateSummary(
    getMonthTransactions()
  );

  $("budgetLimit").value =
    limit > 0 ? limit : "";

  const progress = $("progressFill");

  if (limit <= 0) {
    progress.style.width = "0%";
    progress.classList.remove("over");

    $("limitInfo").textContent =
      "Лимит на этот месяц не установлен";

    $("limitRemaining").textContent = "";

    return;
  }

  const percent = expense / limit * 100;
  const remaining = roundMoney(limit - expense);

  progress.style.width =
    Math.min(percent, 100) + "%";

  progress.classList.toggle(
    "over",
    expense > limit
  );

  $("limitInfo").textContent =
    "Использовано " +
    percent.toFixed(1) +
    "% из " +
    formatMoney(limit);

  if (remaining >= 0) {
    $("limitRemaining").textContent =
      "Можно потратить ещё: " +
      formatMoney(remaining);

    $("limitRemaining").className = "income";
  } else {
    $("limitRemaining").textContent =
      "Превышение лимита: " +
      formatMoney(Math.abs(remaining));

    $("limitRemaining").className = "expense";
  }
}

// ==========================================
// 9. ДИАГРАММА РАСХОДОВ
// ==========================================

function renderChart() {
  const items = getMonthTransactions().filter(
    item => item.type === "expense"
  );

  const grouped = {};

  items.forEach(item => {
    grouped[item.category] =
      (grouped[item.category] || 0) + item.amount;
  });

  const entries = Object.entries(grouped)
    .sort((a, b) => b[1] - a[1]);

  const chart = $("expenseChart");
  const legend = $("expenseLegend");

  legend.replaceChildren();

  if (entries.length === 0) {
    chart.style.background = getCssVar("--chart-empty");
    chart.setAttribute(
      "aria-label",
      "Расходов пока нет"
    );

    const message = document.createElement("p");
    message.className = "muted";
    message.textContent = "Пока нет расходов";

    legend.appendChild(message);
    return;
  }

  const total = entries.reduce(
    (sum, entry) => sum + entry[1],
    0
  );

  const gradientParts = [];
  let currentPercent = 0;

  entries.forEach(([category, amount], index) => {
    const percent = amount / total * 100;
    const color =
      chartColors[index % chartColors.length];

    const endPercent = currentPercent + percent;

    gradientParts.push(
      `${color} ${currentPercent}% ${endPercent}%`
    );

    currentPercent = endPercent;

    const row = document.createElement("div");
    row.className = "legend-item";

    const name = document.createElement("span");
    name.className = "legend-name";

    const dot = document.createElement("span");
    dot.className = "dot";
    dot.style.background = color;

    const label = document.createElement("span");
    label.textContent =
      category + " (" + percent.toFixed(1) + "%)";

    name.append(dot, label);

    const value = document.createElement("strong");
    value.textContent = formatMoney(amount);

    row.append(name, value);
    legend.appendChild(row);
  });

  chart.style.background =
    `conic-gradient(${gradientParts.join(",")})`;

  chart.setAttribute(
    "aria-label",
    "Диаграмма распределения расходов по категориям"
  );
}

// ==========================================
// 10. ИСТОРИЯ ОПЕРАЦИЙ
// ==========================================

function renderHistory() {
  const filter = historyFilter.value;

  let items = getMonthTransactions();

  if (filter !== "all") {
    items = items.filter(
      item => item.type === filter
    );
  }

  items = [...items].sort((a, b) =>
    b.date.localeCompare(a.date)
  );

  const tbody = $("transactionTable");
  tbody.replaceChildren();

  $("emptyMessage").textContent =
    items.length === 0
      ? "Операций за выбранный период нет."
      : "";

  items.forEach(item => {
    const row = document.createElement("tr");

    const dateCell = document.createElement("td");
    dateCell.textContent = formatDate(item.date);

    const typeCell = document.createElement("td");
    typeCell.textContent = item.type === "income"
      ? "Доход"
      : "Расход";

    const categoryCell = document.createElement("td");
    categoryCell.textContent = item.category;

    const descriptionCell = document.createElement("td");
    descriptionCell.textContent =
      item.description || "—";

    const amountCell = document.createElement("td");
    amountCell.className =
      "amount " +
      (item.type === "income" ? "income" : "expense");

    amountCell.textContent =
      (item.type === "income" ? "+ " : "− ") +
      formatMoney(item.amount);

    const actionsCell = document.createElement("td");

    const editButton = document.createElement("button");
    editButton.className = "btn-small";
    editButton.textContent = "Изменить";
    editButton.setAttribute(
      "aria-label",
      "Изменить операцию от " + formatDate(item.date)
    );

    editButton.addEventListener("click", () => {
      editTransaction(item.id);
    });

    const deleteButton = document.createElement("button");
    deleteButton.className = "btn-small btn-red";
    deleteButton.textContent = "Удалить";
    deleteButton.setAttribute(
      "aria-label",
      "Удалить операцию от " + formatDate(item.date)
    );

    deleteButton.addEventListener("click", () => {
      deleteTransaction(item.id);
    });

    actionsCell.append(editButton, deleteButton);

    row.append(
      dateCell,
      typeCell,
      categoryCell,
      descriptionCell,
      amountCell,
      actionsCell
    );

    tbody.appendChild(row);
  });
}

// ==========================================
// 11. ЭКСПОРТ ДАННЫХ
// ==========================================

function exportData() {
  const data = {
    version: 1,
    exportedAt: new Date().toISOString(),
    transactions,
    monthlyLimits
  };

  const json = JSON.stringify(data, null, 2);

  const blob = new Blob([json], {
    type: "application/json;charset=utf-8"
  });

  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download =
    "family-budget-" + localDateString() + ".json";

  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ==========================================
// 12. ИМПОРТ ДАННЫХ
// ==========================================

async function importData(event) {
  const file = event.target.files[0];

  if (!file) return;

  try {
    // Ограничиваем максимальный размер файла.
    if (file.size > 5 * 1024 * 1024) {
      throw new Error("Файл больше 5 МБ.");
    }

    const text = await file.text();
    const data = JSON.parse(text);

    if (
      data.version !== 1 ||
      !Array.isArray(data.transactions) ||
      !data.monthlyLimits ||
      typeof data.monthlyLimits !== "object" ||
      Array.isArray(data.monthlyLimits)
    ) {
      throw new Error(
        "Неподдерживаемый формат резервной копии."
      );
    }

    if (!data.transactions.every(isValidTransaction)) {
      throw new Error(
        "Файл содержит некорректные операции."
      );
    }

    const ids = data.transactions.map(item => item.id);

    if (new Set(ids).size !== ids.length) {
      throw new Error("В файле повторяются ID операций.");
    }

    const limits = {};

    for (const [month, amount] of Object.entries(
      data.monthlyLimits
    )) {
      if (
        !/^\d{4}-(0[1-9]|1[0-2])$/.test(month) ||
        !Number.isFinite(amount) ||
        amount < 0 ||
        amount > 1000000000000
      ) {
        throw new Error(
          "В файле обнаружен некорректный лимит."
        );
      }

      limits[month] = amount;
    }

    const confirmed = confirm(
      "Заменить текущие данные данными из файла?"
    );

    if (!confirmed) return;

    const previousTransactions = transactions;
    const previousLimits = monthlyLimits;

    transactions = data.transactions;
    monthlyLimits = limits;

    if (!saveData()) {
      transactions = previousTransactions;
      monthlyLimits = previousLimits;
      return;
    }

    resetForm();
    render();

    alert("Резервная копия успешно загружена.");

  } catch (error) {
    alert("Ошибка импорта: " + error.message);
  } finally {
    event.target.value = "";
  }
}

// ==========================================
// 13. ПОЛНАЯ ОЧИСТКА ДАННЫХ
// ==========================================

function clearAllData() {
  const confirmed = confirm(
    "Удалить все доходы, расходы и лимиты? " +
    "Отменить это действие невозможно."
  );

  if (!confirmed) return;

  const previousTransactions = transactions;
  const previousLimits = monthlyLimits;

  transactions = [];
  monthlyLimits = {};

  if (!saveData()) {
    transactions = previousTransactions;
    monthlyLimits = previousLimits;
    return;
  }

  resetForm();
  render();
}

// ==========================================
// 14. СВЕТЛАЯ И ТЁМНАЯ ТЕМА
// ==========================================

function getCssVar(name) {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
}

// ==========================================
// 15. ОБНОВЛЕНИЕ ИНТЕРФЕЙСА
// ==========================================

function render() {
  renderSummary();
  renderLimit();
  renderChart();
  renderHistory();
}

// ==========================================
// 16. ПОДКЛЮЧЕНИЕ ОБРАБОТЧИКОВ
// ==========================================

typeInput.addEventListener("change", () => {
  updateCategories();
});

form.addEventListener("submit", handleSubmit);

$("cancelEdit").addEventListener("click", resetForm);

monthFilter.addEventListener("change", render);

historyFilter.addEventListener("change", renderHistory);

$("saveLimit").addEventListener("click", saveLimit);

$("exportBtn").addEventListener("click", exportData);

$("importBtn").addEventListener("click", () => {
  $("importFile").click();
});

$("importFile").addEventListener("change", importData);

$("clearBtn").addEventListener("click", clearAllData);

// ==========================================
// 17. ЗАПУСК ПРИЛОЖЕНИЯ
// ==========================================

function init() {
  monthFilter.value = localDateString().slice(0, 7);

  loadData();
  resetForm();
  render();
}

init();



