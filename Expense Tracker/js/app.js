// =====================================================
// app.js — Main Application Controller
// =====================================================

const App = (() => {

  // ── State ──────────────────────────────────────────
  let currentUser = null;
  let userProfile = null;
  let allExpenses = [];
  let allIncome = [];
  let budgets = {};
  let customCategories = [];
  let hiddenDefaults = [];
  let editingExpenseId = null;
  let editingIncomeId = null;

  const CURRENCIES = {
    CAD: { symbol: '$', name: 'Canadian Dollar', code: 'CAD' },
    USD: { symbol: '$', name: 'US Dollar',       code: 'USD' },
    INR: { symbol: '₹', name: 'Indian Rupee',    code: 'INR' }
  };

  const DEFAULT_CATEGORIES = [
    { name: 'Housing',              iconKey: 'home',         cls: 'cat-housing' },
    { name: 'Food & Dining',        iconKey: 'utensils',     cls: 'cat-food' },
    { name: 'Transportation',       iconKey: 'car',          cls: 'cat-transport' },
    { name: 'Health & Medical',     iconKey: 'heart',        cls: 'cat-health' },
    { name: 'Entertainment',        iconKey: 'film',         cls: 'cat-entertain' },
    { name: 'Shopping',             iconKey: 'shopping-bag', cls: 'cat-shopping' },
    { name: 'Education',            iconKey: 'book',         cls: 'cat-education' },
    { name: 'Savings & Investment', iconKey: 'dollar-sign',  cls: 'cat-savings' },
    { name: 'Personal Care',        iconKey: 'user',         cls: 'cat-personal' },
    { name: 'Travel',               iconKey: 'plane',        cls: 'cat-travel' },
    { name: 'Other',                iconKey: 'grid',         cls: 'cat-other' },
  ];

  function getCategories() {
    const defaults = DEFAULT_CATEGORIES.filter(c => !hiddenDefaults.includes(c.name));
    const custom = customCategories.map(c => ({
      name: c.name,
      iconKey: c.icon || 'tag',
      cls: 'cat-other',
      isCustom: true
    }));
    return [...defaults, ...custom];
  }

  function catIcon(key, size) { return Icons.get(key, { size: size || 18 }); }

  function getCurrency() { return CURRENCIES[userProfile?.currency || 'CAD']; }
  function sym() { return getCurrency().symbol; }
  function fmt(v) { return `${sym()}${parseFloat(v || 0).toFixed(2)}`; }
  function catInfo(n) {
    return getCategories().find(c => c.name === n) || { iconKey: 'grid', cls: 'cat-other', name: n };
  }

  // ── Timeout wrapper ────────────────────────────────
  function withTimeout(promise, ms = 8000) {
    return Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(
          'Timed out. Check: (1) Firestore Database is created, (2) Rules published, (3) Open via http://'
        )), ms)
      )
    ]);
  }

  // ── Toast ──────────────────────────────────────────
  function toast(msg, type = 'success') {
    const iconMap = { success: 'check', error: 'x', info: 'info' };
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.innerHTML = `<span>${Icons.get(iconMap[type] || 'info', { size: 16 })}</span><span>${msg}</span>`;
    document.getElementById('toast-container').appendChild(t);
    setTimeout(() => t.remove(), 3200);
  }

  // ── Theme ──────────────────────────────────────────
  function getSystemTheme() {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }

  function applyTheme(pref) {
    const actual = pref === 'auto' ? getSystemTheme() : pref;
    document.documentElement.setAttribute('data-theme', actual);
    document.body.setAttribute('data-theme', actual);
    const iconEl = document.getElementById('theme-toggle-icon');
    if (iconEl) iconEl.innerHTML = Icons.get(actual === 'light' ? 'sun' : 'moon', { size: 18 });

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = actual === 'light' ? '#F3F4F6' : '#8B5CF6';

    document.querySelectorAll('.theme-option').forEach(el => {
      el.classList.toggle('selected', el.dataset.themeVal === pref);
    });
  }

  function setTheme(pref) {
    localStorage.setItem('sw-theme', pref);
    applyTheme(pref);
  }

  function initTheme() {
    const saved = localStorage.getItem('sw-theme') || 'dark';
    applyTheme(saved);

    // Listen for system changes when set to auto
    window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
      const pref = localStorage.getItem('sw-theme') || 'dark';
      if (pref === 'auto') applyTheme('auto');
    });
  }

  // ── Navigation ─────────────────────────────────────
  function navigate(view) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-item, .bottom-nav-item').forEach(n => n.classList.remove('active'));

    const viewEl = document.getElementById(`view-${view}`);
    if (viewEl) viewEl.classList.add('active');
    document.querySelectorAll(`[data-view="${view}"]`).forEach(el => el.classList.add('active'));

    const titles = { dashboard: 'Dashboard', expenses: 'Expenses', income: 'Income', budgets: 'Budgets', settings: 'Settings' };
    document.getElementById('page-title').textContent = titles[view] || view;

    if (view === 'dashboard') renderDashboard();
    if (view === 'expenses') renderExpenseList();
    if (view === 'income')   renderIncomeList();
    if (view === 'budgets')  renderBudgets();
    if (view === 'settings') renderSettings();

    document.querySelector('.page-content')?.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ── Auth pages ─────────────────────────────────────
  function showAuthPage() {
    document.getElementById('auth-page').style.display = 'flex';
    document.getElementById('app-page').style.display = 'none';
  }

  function showAppPage() {
    document.getElementById('auth-page').style.display = 'none';
    document.getElementById('app-page').style.display = 'block';
  }

  // ── Greeting ───────────────────────────────────────
  function getGreeting() {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }

  // ── Data loading ───────────────────────────────────
  async function loadAllData() {
    try {
      let catSettings;
      [allExpenses, allIncome, budgets, userProfile, catSettings] = await withTimeout(
        Promise.all([
          DB.getExpenses(currentUser.uid),
          DB.getIncome(currentUser.uid),
          DB.getBudgets(currentUser.uid),
          DB.getProfile(currentUser.uid),
          DB.getCategorySettings(currentUser.uid)
        ]), 10000
      );
      customCategories = catSettings.list || [];
      hiddenDefaults = catSettings.hidden || [];
    } catch (err) {
      console.error('loadAllData:', err);
      toast('Could not load data — ' + err.message, 'error');
      allExpenses = []; allIncome = []; budgets = {}; userProfile = null;
      customCategories = []; hiddenDefaults = [];
    }
    rebuildCategoryDropdowns();
    updateUserUI();
    renderDashboard();
  }

  // ── Rebuild category dropdowns dynamically ─────────
  function rebuildCategoryDropdowns() {
    const cats = getCategories();
    // Expense modal category dropdown
    const expCatSelect = document.getElementById('expense-category');
    if (expCatSelect) {
      const currentVal = expCatSelect.value;
      expCatSelect.innerHTML = '<option value="" disabled selected>Select a category</option>';
      cats.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.name;
        opt.textContent = c.name;
        expCatSelect.appendChild(opt);
      });
      if (currentVal) expCatSelect.value = currentVal;
    }
    // Expense filter dropdown
    const expCatFilter = document.getElementById('exp-cat-filter');
    if (expCatFilter) {
      const currentVal = expCatFilter.value;
      expCatFilter.innerHTML = '<option value="">All Categories</option>';
      cats.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.name;
        opt.textContent = c.name;
        expCatFilter.appendChild(opt);
      });
      if (currentVal) expCatFilter.value = currentVal;
    }
  }

  function updateUserUI() {
    const name = userProfile?.name || currentUser.displayName || 'User';
    const email = userProfile?.email || currentUser.email || '';
    const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    document.getElementById('user-name').textContent = name;
    document.getElementById('user-email').textContent = email;
    document.getElementById('user-avatar').textContent = initials;
    const greetEl = document.getElementById('dash-greeting-text');
    if (greetEl) greetEl.textContent = `${getGreeting()}, ${name.split(' ')[0]}!`;
    updateCurrencyBadge();
  }

  function updateCurrencyBadge() {
    document.getElementById('currency-badge').textContent = userProfile?.currency || 'CAD';
  }

  // ── Number counter animation ───────────────────────
  function animateCounter(el, targetText) {
    const match = targetText.match(/[\d.]+/);
    if (!match) { el.textContent = targetText; return; }
    const target = parseFloat(match[0]);
    const prefix = targetText.substring(0, targetText.indexOf(match[0]));
    const suffix = targetText.substring(targetText.indexOf(match[0]) + match[0].length);
    const duration = 600;
    const startTime = performance.now();

    function update(now) {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = target * eased;
      el.textContent = prefix + current.toFixed(2) + suffix;
      if (progress < 1) requestAnimationFrame(update);
      else el.textContent = targetText;
    }
    requestAnimationFrame(update);
  }

  // ── Dashboard ──────────────────────────────────────
  function renderDashboard() {
    const now = new Date();
    const isThisMonth = e => {
      const d = new Date(e.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    };

    const thisMonthExp = allExpenses.filter(isThisMonth);
    const thisMonthInc = allIncome.filter(isThisMonth);
    const totalExp = thisMonthExp.reduce((s, e) => s + parseFloat(e.amount), 0);
    const totalInc = thisMonthInc.reduce((s, e) => s + parseFloat(e.amount), 0);
    const balance  = totalInc - totalExp;
    const savingsRate = totalInc > 0 ? ((balance / totalInc) * 100) : 0;

    document.getElementById('dash-month').textContent = now.toLocaleString('default', { month: 'long', year: 'numeric' });

    animateCounter(document.getElementById('dash-income'),   fmt(totalInc));
    animateCounter(document.getElementById('dash-expenses'), fmt(totalExp));
    animateCounter(document.getElementById('dash-balance'),  fmt(Math.abs(balance)));
    animateCounter(document.getElementById('dash-savings'),  savingsRate.toFixed(1) + '%');

    const balEl  = document.getElementById('dash-balance');
    const signEl = document.getElementById('dash-balance-sign');
    balEl.className = `summary-amount balance ${balance >= 0 ? 'positive' : 'negative'}`;
    signEl.textContent = balance < 0 ? '-' : '';

    const combined = [
      ...allExpenses.map(e => ({ ...e, kind: 'expense' })),
      ...allIncome.map(e => ({ ...e, kind: 'income' }))
    ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 8);

    renderTransactionItems('recent-list', combined, true);
    Charts.renderPieChart(allExpenses, sym());
    Charts.renderBarChart(allExpenses, allIncome, sym());
  }

  // ── Transaction renderer ───────────────────────────
  function renderTransactionItems(containerId, items, readonly = false) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!items.length) {
      container.innerHTML = `<div class="empty-state"><div class="empty-icon">${Icons.get('inbox', { size: 40 })}</div><p>No transactions yet. Add one!</p></div>`;
      return;
    }

    container.innerHTML = items.map((item, i) => {
      const isExpense = item.kind === 'expense';
      const cat = isExpense
        ? catInfo(item.category)
        : { iconKey: 'trending-up', cls: 'cat-income', name: item.source || 'Income' };
      const dateStr = new Date(item.date).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
      const actions = !readonly ? `
        <div class="t-actions">
          <button class="action-btn" onclick="App.openEditModal('${item.kind}','${item.id}')" title="Edit">${Icons.get('edit', { size: 14 })}</button>
          <button class="action-btn delete" onclick="App.deleteItem('${item.kind}','${item.id}')" title="Delete">${Icons.get('trash', { size: 14 })}</button>
        </div>` : '';

      return `
        <div class="transaction-item" style="animation-delay:${i * 40}ms">
          <div class="t-icon ${cat.cls}">${catIcon(cat.iconKey)}</div>
          <div class="t-info">
            <div class="t-cat">${cat.name}</div>
            <div class="t-note">${item.note || (isExpense ? item.category : item.source) || '—'}</div>
          </div>
          <div class="t-right">
            <div class="t-amount ${isExpense ? 'expense' : 'income'}">${isExpense ? '-' : '+'}${fmt(item.amount)}</div>
            <div class="t-date">${dateStr}</div>
          </div>
          ${actions}
        </div>`;
    }).join('');
  }

  // ── Expense list ───────────────────────────────────
  function renderExpenseList() {
    const month  = document.getElementById('exp-month-filter')?.value || '';
    const cat    = document.getElementById('exp-cat-filter')?.value || '';
    const search = document.getElementById('exp-search')?.value?.toLowerCase() || '';

    let items = allExpenses.map(e => ({ ...e, kind: 'expense' }));
    if (month)  items = items.filter(e => e.date.startsWith(month));
    if (cat)    items = items.filter(e => e.category === cat);
    if (search) items = items.filter(e =>
      e.category.toLowerCase().includes(search) || (e.note || '').toLowerCase().includes(search)
    );

    renderTransactionItems('expense-list', items);
    const total = items.reduce((s, e) => s + parseFloat(e.amount), 0);
    const el = document.getElementById('exp-total');
    if (el) el.textContent = `Total: ${fmt(total)} · ${items.length} transaction${items.length !== 1 ? 's' : ''}`;
  }

  // ── Income list ────────────────────────────────────
  function renderIncomeList() {
    const month  = document.getElementById('inc-month-filter')?.value || '';
    const search = document.getElementById('inc-search')?.value?.toLowerCase() || '';

    let items = allIncome.map(e => ({ ...e, kind: 'income' }));
    if (month)  items = items.filter(e => e.date.startsWith(month));
    if (search) items = items.filter(e =>
      (e.source || '').toLowerCase().includes(search) || (e.note || '').toLowerCase().includes(search)
    );

    renderTransactionItems('income-list', items);
    const total = items.reduce((s, e) => s + parseFloat(e.amount), 0);
    const el = document.getElementById('inc-total');
    if (el) el.textContent = `Total: ${fmt(total)} · ${items.length} transaction${items.length !== 1 ? 's' : ''}`;
  }

  // ── Budgets ────────────────────────────────────────
  function renderBudgets() {
    const now = new Date();
    const spent = {};
    allExpenses.filter(e => {
      const d = new Date(e.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).forEach(e => { spent[e.category] = (spent[e.category] || 0) + parseFloat(e.amount); });

    const container = document.getElementById('budget-grid');
    if (!container) return;

    const cats = getCategories();

    container.innerHTML = cats.map(cat => {
      const budget = budgets[cat.name] || 0;
      const s = spent[cat.name] || 0;
      const pct = budget > 0 ? Math.min((s / budget) * 100, 100) : 0;
      const over = budget > 0 && s > budget;
      const fillClass = pct >= 100 ? 'over' : pct >= 80 ? 'warn' : 'safe';
      const safeName = cat.name.replace(/'/g, "\\'");
      const deleteBtn = `<button class="budget-delete-btn" onclick="App.deleteCategory('${safeName}')" title="Delete category">${Icons.get('trash', { size: 14 })}</button>`;

      return `
        <div class="budget-card">
          <div class="budget-card-header">
            <div class="budget-cat-name"><span class="budget-cat-icon">${catIcon(cat.iconKey)}</span><span>${cat.name}</span></div>
            <div style="display:flex;align-items:center;gap:6px;">
              ${over ? '<span style="color:var(--red);font-size:12px;font-weight:700;">Over budget!</span>' : ''}
              ${deleteBtn}
            </div>
          </div>
          <div class="progress-bar">
            <div class="progress-fill ${fillClass}" style="width:${pct}%" data-pct="${pct}"></div>
          </div>
          <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
            <span class="budget-amounts"><span class="budget-spent">${fmt(s)}</span> / ${budget > 0 ? fmt(budget) : 'no budget'}</span>
            <span style="font-size:12px;color:var(--t2);">${budget > 0 ? pct.toFixed(0) + '%' : '—'}</span>
          </div>
          <div class="budget-edit-row">
            <input class="budget-input" type="number" min="0" step="10" placeholder="Set budget…"
              value="${budget || ''}" id="bi-${cat.name.replace(/[^a-z0-9]/gi,'-')}" />
            <button class="btn btn-sm btn-primary" onclick="App.saveBudget('${safeName}')">Save</button>
          </div>
        </div>`;
    }).join('');

    requestAnimationFrame(() => {
      document.querySelectorAll('.progress-fill[data-pct]').forEach(el => {
        const pct = el.dataset.pct;
        el.style.width = '0%';
        setTimeout(() => { el.style.width = pct + '%'; }, 50);
      });
    });
  }

  async function saveBudget(catName) {
    const id = `bi-${catName.replace(/[^a-z0-9]/gi, '-')}`;
    const val = parseFloat(document.getElementById(id)?.value);
    if (isNaN(val) || val < 0) { toast('Enter a valid amount', 'error'); return; }
    await DB.setBudget(currentUser.uid, catName, val);
    budgets[catName] = val;
    renderBudgets();
    toast(`Budget for ${catName} saved!`);
  }

  // ── Add / Delete categories ────────────────────────
  async function addCategory() {
    const nameInput = document.getElementById('new-cat-name');
    const iconSelect = document.getElementById('new-cat-icon');
    const name = nameInput?.value.trim();
    const icon = iconSelect?.value || '🏷️';

    if (!name) { toast('Enter a category name', 'error'); return; }
    if (name.length > 30) { toast('Name is too long (max 30 chars)', 'error'); return; }

    const allCats = getCategories();
    if (allCats.some(c => c.name.toLowerCase() === name.toLowerCase())) {
      toast('Category already exists', 'error');
      return;
    }

    customCategories.push({ name, icon });
    try {
      await withTimeout(DB.setCategorySettings(currentUser.uid, customCategories, hiddenDefaults));
      rebuildCategoryDropdowns();
      renderBudgets();
      nameInput.value = '';
      toast(`Category "${name}" added!`);
    } catch (err) {
      customCategories.pop();
      toast('Error saving category', 'error');
    }
  }

  async function deleteCategory(name) {
    if (!confirm(`Delete the "${name}" category? This won't delete any existing transactions that use it, but the category will no longer appear in dropdowns.`)) return;

    const isDefault = DEFAULT_CATEGORIES.some(c => c.name === name);

    if (isDefault) {
      hiddenDefaults.push(name);
    } else {
      customCategories = customCategories.filter(c => c.name !== name);
    }

    try {
      await withTimeout(DB.setCategorySettings(currentUser.uid, customCategories, hiddenDefaults));
      // Also remove any budget for this category
      if (budgets[name] !== undefined) {
        await DB.deleteBudget(currentUser.uid, name).catch(() => {});
        delete budgets[name];
      }
      rebuildCategoryDropdowns();
      renderBudgets();
      toast(`Category "${name}" deleted`);
    } catch (err) {
      if (isDefault) hiddenDefaults.pop();
      toast('Error deleting category', 'error');
    }
  }

  // ── Settings ───────────────────────────────────────
  function renderSettings() {
    document.getElementById('settings-name').value = userProfile?.name || '';
    const cur = userProfile?.currency || 'CAD';
    document.querySelectorAll('.currency-option').forEach(el => {
      el.classList.toggle('selected', el.dataset.currency === cur);
    });
    // Update theme option selection
    const savedTheme = localStorage.getItem('sw-theme') || 'dark';
    document.querySelectorAll('.theme-option').forEach(el => {
      el.classList.toggle('selected', el.dataset.themeVal === savedTheme);
    });
  }

  async function saveProfile() {
    const name = document.getElementById('settings-name').value.trim();
    if (!name) { toast('Name cannot be empty', 'error'); return; }
    const currency = document.querySelector('.currency-option.selected')?.dataset.currency || 'CAD';
    await DB.setProfile(currentUser.uid, { name, currency });
    userProfile = { ...userProfile, name, currency };
    updateUserUI();
    toast('Profile saved!');
  }

  // ── Modals ─────────────────────────────────────────
  function openModal(id) { document.getElementById(id).classList.add('open'); }
  function closeModal(id) {
    document.getElementById(id).classList.remove('open');
    editingExpenseId = null;
    editingIncomeId = null;
  }

  function openAddExpense() {
    editingExpenseId = null;
    document.getElementById('expense-modal-title').textContent = 'Add Expense';
    document.getElementById('expense-form').reset();
    document.getElementById('expense-date').valueAsDate = new Date();
    openModal('expense-modal');
  }

  function openAddIncome() {
    editingIncomeId = null;
    document.getElementById('income-modal-title').textContent = 'Add Income';
    document.getElementById('income-form').reset();
    document.getElementById('income-date').valueAsDate = new Date();
    openModal('income-modal');
  }

  function openEditModal(kind, id) {
    if (kind === 'expense') {
      const e = allExpenses.find(x => x.id === id); if (!e) return;
      editingExpenseId = id;
      document.getElementById('expense-modal-title').textContent = 'Edit Expense';
      document.getElementById('expense-amount').value   = e.amount;
      document.getElementById('expense-category').value = e.category;
      document.getElementById('expense-date').value     = e.date;
      document.getElementById('expense-note').value     = e.note || '';
      openModal('expense-modal');
    } else {
      const e = allIncome.find(x => x.id === id); if (!e) return;
      editingIncomeId = id;
      document.getElementById('income-modal-title').textContent = 'Edit Income';
      document.getElementById('income-amount').value = e.amount;
      document.getElementById('income-source').value = e.source;
      document.getElementById('income-date').value   = e.date;
      document.getElementById('income-note').value   = e.note || '';
      openModal('income-modal');
    }
  }

  // ── Save expense ───────────────────────────────────
  async function saveExpense(e) {
    e.preventDefault();
    const btn = document.getElementById('save-expense-btn');
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';
    const data = {
      amount:   parseFloat(document.getElementById('expense-amount').value),
      category: document.getElementById('expense-category').value,
      date:     document.getElementById('expense-date').value,
      note:     document.getElementById('expense-note').value.trim()
    };
    try {
      if (editingExpenseId) {
        await withTimeout(DB.updateExpense(currentUser.uid, editingExpenseId, data));
        allExpenses = allExpenses.map(ex => ex.id === editingExpenseId ? { ...ex, ...data } : ex);
        toast('Expense updated!');
      } else {
        const id = await withTimeout(DB.addExpense(currentUser.uid, data));
        allExpenses.unshift({ id, ...data });
        toast('Expense added!');
      }
      closeModal('expense-modal');
      renderExpenseList();
    } catch (err) {
      toast('Error: ' + err.message, 'error');
      console.error(err);
    } finally {
      btn.disabled = false; btn.innerHTML = 'Save';
    }
  }

  // ── Save income ────────────────────────────────────
  async function saveIncome(e) {
    e.preventDefault();
    const btn = document.getElementById('save-income-btn');
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';
    const data = {
      amount: parseFloat(document.getElementById('income-amount').value),
      source: document.getElementById('income-source').value,
      date:   document.getElementById('income-date').value,
      note:   document.getElementById('income-note').value.trim()
    };
    try {
      if (editingIncomeId) {
        await withTimeout(DB.updateIncome(currentUser.uid, editingIncomeId, data));
        allIncome = allIncome.map(inc => inc.id === editingIncomeId ? { ...inc, ...data } : inc);
        toast('Income updated!');
      } else {
        const id = await withTimeout(DB.addIncome(currentUser.uid, data));
        allIncome.unshift({ id, ...data });
        toast('Income added!');
      }
      closeModal('income-modal');
      renderIncomeList();
    } catch (err) {
      toast('Error: ' + err.message, 'error');
      console.error(err);
    } finally {
      btn.disabled = false; btn.innerHTML = 'Save';
    }
  }

  // ── Delete ─────────────────────────────────────────
  async function deleteItem(kind, id) {
    if (!confirm('Delete this entry?')) return;
    try {
      if (kind === 'expense') {
        await withTimeout(DB.deleteExpense(currentUser.uid, id));
        allExpenses = allExpenses.filter(e => e.id !== id);
        renderExpenseList();
      } else {
        await withTimeout(DB.deleteIncome(currentUser.uid, id));
        allIncome = allIncome.filter(e => e.id !== id);
        renderIncomeList();
      }
      toast('Deleted!');
    } catch (err) {
      toast('Error deleting', 'error');
    }
  }

  // ── CSV Export ─────────────────────────────────────
  function exportCSV(type) {
    const data = type === 'expenses' ? allExpenses : allIncome;
    if (!data.length) { toast('No data to export', 'info'); return; }
    const hdr = type === 'expenses'
      ? ['Date','Category','Amount','Currency','Note']
      : ['Date','Source','Amount','Currency','Note'];
    const cur = userProfile?.currency || 'CAD';
    const rows = data.map(e => type === 'expenses'
      ? [e.date, e.category, e.amount, cur, e.note || '']
      : [e.date, e.source, e.amount, cur, e.note || '']
    );
    const csv = [hdr, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `${type}_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    toast('CSV exported!');
  }

  // ── Auth helpers ───────────────────────────────────
  function clearAuthMessages() {
    document.querySelectorAll('.auth-error, .auth-success').forEach(el => el.classList.remove('visible'));
  }

  function showAuthError(msg) {
    const el = document.querySelector('.auth-error:not([style*="none"])') || document.querySelector('.auth-error');
    if (el) { el.textContent = msg; el.classList.add('visible'); }
  }

  function friendlyAuthError(code) {
    return {
      'auth/email-already-in-use': 'This email is already registered.',
      'auth/invalid-email':        'Invalid email address.',
      'auth/weak-password':        'Password must be at least 6 characters.',
      'auth/user-not-found':       'No account found with this email.',
      'auth/wrong-password':       'Incorrect password.',
      'auth/invalid-credential':   'Incorrect email or password.',
      'auth/popup-closed-by-user': 'Google sign-in was cancelled.',
      'auth/network-request-failed': 'Network error. Check your connection.',
    }[code] || 'An error occurred. Please try again.';
  }

  // ── Inject SVG icons into static HTML elements ─────
  function injectStaticIcons() {
    const I = Icons.get;
    const set = (id, name, size) => { const el = document.getElementById(id); if (el) el.innerHTML = I(name, { size: size || 18 }); };
    // Sidebar nav
    set('sn-home','home'); set('sn-expenses','trending-down'); set('sn-income','trending-up');
    set('sn-budgets','target'); set('sn-settings','settings');
    // Bottom nav
    set('bn-home','home',20); set('bn-expenses','trending-down',20); set('bn-income','trending-up',20);
    set('bn-budgets','target',20); set('bn-settings','settings',20);
    // Dashboard summary icons
    set('si-income','arrow-up-circle',14); set('si-expenses','arrow-down-circle',14);
    set('si-balance','scale',14); set('si-savings','percent',14);
    // Chart headers
    set('ci-pie','pie-chart',16); set('ci-bar','bar-chart',16); set('ci-clock','clock',16);
    // Add buttons
    set('ab-exp','plus',14); set('ab-inc','plus',14);
    set('ab-csv-exp','upload',14); set('ab-add-exp2','plus',14);
    set('ab-csv-inc','upload',14); set('ab-add-inc2','plus',14);
    // Search icons
    set('si-search-exp','search',14); set('si-search-inc','search',14);
    // Settings icons
    set('si-profile','user',16); set('si-currency','credit-card',16);
    set('si-appearance','palette',16); set('si-account','lock',16);
    // Theme option icons
    set('ti-dark','moon',22); set('ti-light','sun',22); set('ti-auto','monitor',22);
    // Icon picker for add-category
    const picker = document.getElementById('new-cat-icon');
    if (picker) {
      picker.innerHTML = '';
      Icons.pickerIcons.forEach(name => {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        picker.appendChild(opt);
      });
    }
  }

  // ── Init ───────────────────────────────────────────
  function init() {

    // Inject SVG icons into static HTML
    injectStaticIcons();

    // Apply saved theme immediately
    initTheme();

    // Auth state
    Auth.onAuthStateChange(async (user) => {
      currentUser = user;
      showAppPage();
      await loadAllData();
      navigate('dashboard');
    }, () => {
      currentUser = null;
      showAuthPage();
    });

    // Auth tabs
    document.querySelectorAll('.auth-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        document.querySelectorAll('.auth-form').forEach(f => f.classList.add('hidden'));
        document.getElementById(`${tab.dataset.tab}-form`).classList.remove('hidden');
        clearAuthMessages();
      });
    });

    // Register
    document.getElementById('register-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('register-btn');
      btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';
      clearAuthMessages();
      const name  = document.getElementById('reg-name').value.trim();
      const email = document.getElementById('reg-email').value.trim();
      const pass  = document.getElementById('reg-password').value;
      const pass2 = document.getElementById('reg-password2').value;
      if (pass !== pass2) { showAuthError('Passwords do not match'); btn.disabled = false; btn.textContent = 'Create Account'; return; }
      try {
        await Auth.register(name, email, pass);
      } catch (err) {
        showAuthError(friendlyAuthError(err.code));
        btn.disabled = false; btn.textContent = 'Create Account';
      }
    });

    // Login
    document.getElementById('login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('login-btn');
      btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';
      clearAuthMessages();
      const email = document.getElementById('login-email').value.trim();
      const pass  = document.getElementById('login-password').value;
      try {
        await Auth.login(email, pass);
      } catch (err) {
        showAuthError(friendlyAuthError(err.code));
        btn.disabled = false; btn.textContent = 'Sign In';
      }
    });

    // Google sign-in
    document.querySelectorAll('.google-signin-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        clearAuthMessages();
        try { await Auth.loginWithGoogle(); }
        catch (err) { showAuthError(friendlyAuthError(err.code)); }
      });
    });

    // Logout
    document.getElementById('logout-btn').addEventListener('click', () => Auth.logout());

    // Desktop sidebar nav
    document.querySelectorAll('.nav-item[data-view]').forEach(item => {
      item.addEventListener('click', () => navigate(item.dataset.view));
    });

    // Bottom nav
    document.querySelectorAll('.bottom-nav-item[data-view]').forEach(item => {
      item.addEventListener('click', () => navigate(item.dataset.view));
    });

    // Theme toggle (top bar quick button)
    document.getElementById('theme-toggle')?.addEventListener('click', () => {
      const current = localStorage.getItem('sw-theme') || 'dark';
      setTheme(current === 'dark' ? 'light' : 'dark');
    });

    // Theme options (settings page)
    document.querySelectorAll('.theme-option').forEach(el => {
      el.addEventListener('click', () => {
        document.querySelectorAll('.theme-option').forEach(x => x.classList.remove('selected'));
        el.classList.add('selected');
        setTheme(el.dataset.themeVal);
      });
    });

    // Expense modal
    document.getElementById('add-expense-btn').addEventListener('click', openAddExpense);
    document.getElementById('add-expense-btn-2')?.addEventListener('click', openAddExpense);
    document.getElementById('expense-form').addEventListener('submit', saveExpense);
    document.getElementById('close-expense-modal').addEventListener('click', () => closeModal('expense-modal'));
    document.getElementById('cancel-expense-btn').addEventListener('click', () => closeModal('expense-modal'));

    // Income modal
    document.getElementById('add-income-btn').addEventListener('click', openAddIncome);
    document.getElementById('add-income-btn-2')?.addEventListener('click', openAddIncome);
    document.getElementById('income-form').addEventListener('submit', saveIncome);
    document.getElementById('close-income-modal').addEventListener('click', () => closeModal('income-modal'));
    document.getElementById('cancel-income-btn').addEventListener('click', () => closeModal('income-modal'));

    // Close modals on overlay click
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.remove('open'); });
    });

    // Filters
    ['exp-month-filter','exp-cat-filter'].forEach(id => {
      document.getElementById(id)?.addEventListener('change', renderExpenseList);
    });
    document.getElementById('exp-search')?.addEventListener('input', renderExpenseList);
    document.getElementById('inc-month-filter')?.addEventListener('change', renderIncomeList);
    document.getElementById('inc-search')?.addEventListener('input', renderIncomeList);

    // CSV
    document.getElementById('export-exp-btn')?.addEventListener('click', () => exportCSV('expenses'));
    document.getElementById('export-inc-btn')?.addEventListener('click', () => exportCSV('income'));

    // Settings
    document.getElementById('save-settings-btn')?.addEventListener('click', saveProfile);
    document.querySelectorAll('.currency-option').forEach(el => {
      el.addEventListener('click', () => {
        document.querySelectorAll('.currency-option').forEach(x => x.classList.remove('selected'));
        el.classList.add('selected');
      });
    });
    document.getElementById('currency-badge')?.addEventListener('click', () => navigate('settings'));

    // Set default month filters
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    ['exp-month-filter', 'inc-month-filter'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = ym;
    });
  }

  window.addEventListener('DOMContentLoaded', init);

  return { openEditModal, deleteItem, saveBudget, addCategory, deleteCategory };
})();
