/* ============================================================
   仓序食时 (CangXu ShiShi) - Personal Accounting + Inventory + Diet SPA
   ============================================================ */

(function () {
  'use strict';

  // ==================== STORAGE KEYS ====================
  const KEYS = {
    products: 'cx_products',
    orders: 'cx_orders',
    inventory: 'cx_inventory',
    inventoryLogs: 'cx_inventory_logs',
    diet: 'cx_diet',
    body: 'cx_body',
    config: 'cx_config',
    recycle: 'cx_recycle',
    unassigned: 'cx_unassigned_food',
    seeded: 'cx_seeded_v1',
    cloudMode: 'cx_cloud_mode'
  };

  // Cloud sync state
  let cloudReady = false;
  let cloudSyncState = 'idle';
  let cloudUserEmail = '';

  function isCloudMode() {
    return cloudReady && window.CloudSync && window.CloudSync.isConfigured() && window.CloudSync.isLoggedIn();
  }

  function scheduleCloudSync() {
    if (isCloudMode()) {
      const getLocal = (key) => getData(KEYS[key], []);
      window.CloudSync.schedulePush(getLocal);
    }
  }

  // ==================== DEFAULT CONFIG ====================
  const DEFAULT_CONFIG = {
    channels: ['惠康', '百佳', '佳宝', '万宁', '屈臣氏', '大生生活超市', '优品360', 'Don Don Donki', 'Aeon', 'Market Place by Jasons', '759阿信屋', '其他'],
    payments: ['现金', '支付宝HK', '微信支付HK', '信用卡', '八达通', 'PayMe', 'FPS转数快', '其他'],
    locations: ['冰箱冷藏', '冰箱冷冻', '储物柜', '厨房台面', '浴室', '卧室', '其他'],
    categories: ['蛋奶', '肉类', '蔬果', '粮油调味', '零食饮料', '日用品', '冷冻食品', '其他'],
    units: ['g', 'kg', 'ml', 'L', '个', '包', '盒', '磅', '斤', '两'],
    language: 'zh-CN',
    energyUnit: 'kcal',
    weightUnit: 'kg',
    defaultCurrency: 'HKD'
  };

  const MEAL_NAMES = { breakfast: '早餐', lunch: '午餐', dinner: '晚餐', snack: '加餐' };
  const MEAL_ICONS = { breakfast: 'sunrise', lunch: 'sun', dinner: 'sunset', snack: 'coffee' };
  const MEAL_COLORS = { breakfast: 'cream', lunch: 'mint', dinner: 'taro', snack: 'pink' };
  const UNIT_CONVERSIONS = {
    '磅': 453.592, '斤': 604.79, '两': 37.8,
    'kg': 1000, 'g': 1, 'L': 1000, 'ml': 1
  };
  const KCAL_TO_KJ = 4.184;

  // ==================== UTILITIES ====================
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }

  function getData(key, def) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : def; }
    catch (e) { console.error('read fail', key, e); return def; }
  }
  function setData(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); }
    catch (e) { console.error('write fail', key, e); }
  }

  function getConfig() {
    const cfg = getData(KEYS.config, null);
    if (!cfg) return { ...DEFAULT_CONFIG };
    return { ...DEFAULT_CONFIG, ...cfg };
  }
  function setConfig(cfg) { setData(KEYS.config, cfg); scheduleCloudSync(); }

  function todayStr() {
    const d = new Date(); d.setHours(0, 0, 0, 0);
    return d.toISOString().slice(0, 10);
  }
  function dateStr(d) {
    const dt = (typeof d === 'string') ? new Date(d) : d;
    return dt.toISOString().slice(0, 10);
  }
  function formatCNDate(d) {
    const dt = (typeof d === 'string') ? new Date(d) : d;
    return `${dt.getMonth() + 1}月${dt.getDate()}日`;
  }
  function formatCNDateFull(d) {
    const dt = (typeof d === 'string') ? new Date(d) : d;
    return `${dt.getFullYear()}年${dt.getMonth() + 1}月${dt.getDate()}日`;
  }
  function daysBetween(d1, d2) {
    const a = new Date(d1); a.setHours(0,0,0,0);
    const b = new Date(d2); b.setHours(0,0,0,0);
    return Math.round((b - a) / 86400000);
  }
  function addDays(d, n) {
    const dt = new Date(d); dt.setDate(dt.getDate() + n); return dt;
  }

  function formatMoney(amount, currency) {
    const cur = currency || getConfig().defaultCurrency || 'HKD';
    const sym = cur === 'CNY' ? '¥' : 'HK$';
    return sym + parseFloat(amount || 0).toFixed(2);
  }

  function formatWeight(kg) {
    const cfg = getConfig();
    if (cfg.weightUnit === 'lb') return (kg * 2.20462).toFixed(1) + ' lb';
    return kg.toFixed(1) + ' kg';
  }

  function formatEnergy(kcal) {
    const cfg = getConfig();
    if (cfg.energyUnit === 'kJ') return Math.round(kcal * KCAL_TO_KJ) + ' kJ';
    return Math.round(kcal) + ' kcal';
  }

  function esc(s) {
    if (s == null) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function toast(msg) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2000);
  }

  // ==================== SEED DATA ====================
  function seedIfNeeded() {
    if (getData(KEYS.seeded, false)) return;

    const today = todayStr();
    const yesterday = dateStr(addDays(today, -1));
    const twoDaysAgo = dateStr(addDays(today, -2));
    const inThreeDays = dateStr(addDays(today, 3));
    const inFiveDays = dateStr(addDays(today, 5));
    const inTenDays = dateStr(addDays(today, 10));

    // Products
    const products = [
      { id: uid(), name: '鸡蛋', brand: '本地农场', category: '蛋奶', unit: '个', defaultPrice: 2.5, calories: 78, protein: 6.5, carbs: 0.6, fat: 5.5, stockThreshold: 6 },
      { id: uid(), name: '牛奶', brand: '维记', category: '蛋奶', unit: 'ml', defaultPrice: 0.02, calories: 65, protein: 3.3, carbs: 4.8, fat: 3.6, stockThreshold: 500 },
      { id: uid(), name: '鸡胸肉', brand: 'Tyson', category: '肉类', unit: 'g', defaultPrice: 0.12, calories: 165, protein: 31, carbs: 0, fat: 3.6, stockThreshold: 200 },
      { id: uid(), name: '大米', brand: '金象牌', category: '粮油调味', unit: 'g', defaultPrice: 0.02, calories: 365, protein: 7.1, carbs: 80, fat: 0.7, stockThreshold: 1000 }
    ];

    // Orders
    const order1Id = uid();
    const order2Id = uid();
    const orders = [
      {
        id: order1Id, date: today, channel: '惠康', payment: '信用卡', currency: 'HKD',
        note: '每周采购', tags: ['日常'],
        items: [
          { id: uid(), productId: products[0].id, productName: '鸡蛋', brand: products[0].brand, unitPrice: 2.5, quantity: 12, unit: '个', subtotal: 30, subtotalEdited: false, toInventory: true, toDiet: false, meal: '', expiry: inTenDays, location: '冰箱冷藏' },
          { id: uid(), productId: products[1].id, productName: '牛奶', brand: products[1].brand, unitPrice: 28, quantity: 2, unit: '盒', subtotal: 56, subtotalEdited: false, toInventory: true, toDiet: false, meal: '', expiry: inFiveDays, location: '冰箱冷藏' },
          { id: uid(), productId: products[2].id, productName: '鸡胸肉', brand: products[2].brand, unitPrice: 0.09, quantity: 500, unit: 'g', subtotal: 45, subtotalEdited: false, toInventory: true, toDiet: false, meal: '', expiry: inThreeDays, location: '冰箱冷冻' }
        ],
        total: 131,
        createdAt: new Date().toISOString()
      },
      {
        id: order2Id, date: yesterday, channel: '百佳', payment: '八达通', currency: 'HKD',
        note: '', tags: [],
        items: [
          { id: uid(), productId: products[3].id, productName: '大米', brand: products[3].brand, unitPrice: 80, quantity: 1, unit: '包', subtotal: 80, subtotalEdited: false, toInventory: true, toDiet: false, meal: '', expiry: null, location: '储物柜' }
        ],
        total: 80,
        createdAt: new Date(Date.now() - 86400000).toISOString()
      }
    ];

    // Inventory
    const inv = [
      { id: uid(), productId: products[0].id, productName: '鸡蛋', brand: products[0].brand, category: '蛋奶', quantity: 12, unit: '个', expiry: inTenDays, location: '冰箱冷藏', avgCost: 2.5, sourceOrderId: order1Id },
      { id: uid(), productId: products[1].id, productName: '牛奶', brand: products[1].brand, category: '蛋奶', quantity: 2000, unit: 'ml', expiry: inFiveDays, location: '冰箱冷藏', avgCost: 0.028, sourceOrderId: order1Id },
      { id: uid(), productId: products[2].id, productName: '鸡胸肉', brand: products[2].brand, category: '肉类', quantity: 500, unit: 'g', expiry: inThreeDays, location: '冰箱冷冻', avgCost: 0.09, sourceOrderId: order1Id },
      { id: uid(), productId: products[3].id, productName: '大米', brand: products[3].brand, category: '粮油调味', quantity: 5000, unit: 'g', expiry: null, location: '储物柜', avgCost: 0.016, sourceOrderId: order2Id }
    ];

    const invLogs = [];
    inv.forEach(i => {
      invLogs.push({ id: uid(), inventoryId: i.id, type: 'in', quantity: i.quantity, note: '采购入库', date: i.sourceOrderId === order1Id ? today : yesterday });
    });

    const diet = [
      {
        id: uid(), date: today, meal: 'breakfast',
        items: [
          { id: uid(), source: 'inventory', productId: products[0].id, name: '鸡蛋', quantity: 2, unit: '个', calories: 156, protein: 13, carbs: 1.2, fat: 11 },
          { id: uid(), source: 'inventory', productId: products[1].id, name: '牛奶', quantity: 250, unit: 'ml', calories: 163, protein: 8.3, carbs: 12, fat: 9 }
        ],
        totalCalories: 0
      },
      {
        id: uid(), date: today, meal: 'lunch',
        items: [
          { id: uid(), source: 'inventory', productId: products[2].id, name: '鸡胸肉', quantity: 150, unit: 'g', calories: 248, protein: 46.5, carbs: 0, fat: 5.4 },
          { id: uid(), source: 'inventory', productId: products[3].id, name: '大米', quantity: 150, unit: 'g', calories: 548, protein: 10.7, carbs: 120, fat: 1.1 }
        ],
        totalCalories: 0
      },
      {
        id: uid(), date: today, meal: 'dinner',
        items: [
          { id: uid(), source: 'manual', name: '番茄炒蛋', quantity: 1, unit: '份', calories: 320, protein: 15, carbs: 12, fat: 22 }
        ],
        totalCalories: 0
      }
    ];
    diet.forEach(m => { m.totalCalories = m.items.reduce((s,i) => s + (i.calories||0), 0); });

    const body = [
      { id: uid(), date: today, weight: 62.4, bodyFat: 18.5 },
      { id: uid(), date: twoDaysAgo, weight: 62.8, bodyFat: 18.7 }
    ];

    setData(KEYS.products, products);
    setData(KEYS.orders, orders);
    setData(KEYS.inventory, inv);
    setData(KEYS.inventoryLogs, invLogs);
    setData(KEYS.diet, diet);
    setData(KEYS.body, body);
    setData(KEYS.recycle, []);
    setData(KEYS.unassigned, []);
    setData(KEYS.seeded, true);
  }

  // ==================== DATA HELPERS ====================
  function getProducts() { return getData(KEYS.products, []); }
  function getOrders() { return getData(KEYS.orders, []); }
  function getInventory() { return getData(KEYS.inventory, []); }
  function getInventoryLogs() { return getData(KEYS.inventoryLogs, []); }
  function getDiet() { return getData(KEYS.diet, []); }
  function getBody() { return getData(KEYS.body, []); }
  function getRecycle() { return getData(KEYS.recycle, []); }
  function getUnassigned() { return getData(KEYS.unassigned, []); }

  function saveProducts(list) { setData(KEYS.products, list); scheduleCloudSync(); }
  function saveOrders(list) { setData(KEYS.orders, list); scheduleCloudSync(); }
  function saveInventory(list) { setData(KEYS.inventory, list); scheduleCloudSync(); }
  function saveInventoryLogs(list) { setData(KEYS.inventoryLogs, list); scheduleCloudSync(); }
  function saveDiet(list) { setData(KEYS.diet, list); scheduleCloudSync(); }
  function saveBody(list) { setData(KEYS.body, list); scheduleCloudSync(); }
  function saveRecycle(list) { setData(KEYS.recycle, list); }
  function saveUnassigned(list) { setData(KEYS.unassigned, list); scheduleCloudSync(); }
  function saveConfigLocal(cfg) { setData(KEYS.config, cfg); scheduleCloudSync(); }

  function findProductByName(name) {
    return getProducts().find(p => p.name === name) || null;
  }
  function findProductById(id) {
    return getProducts().find(p => p.id === id) || null;
  }

  function addInventoryLog(inventoryId, type, quantity, note, date) {
    const logs = getInventoryLogs();
    logs.push({ id: uid(), inventoryId, type, quantity, note: note || '', date: date || todayStr() });
    saveInventoryLogs(logs);
  }

  function mergeIntoInventory(productRef, quantity, unit, expiry, location, sourceOrderId, unitPrice, brand) {
    const inv = getInventory();
    const name = productRef.name;
    const prodBrand = brand || productRef.brand || '';
    const category = productRef.category || '其他';

    let existing = inv.find(i => i.productName === name && i.unit === unit);
    if (existing) {
      const oldTotal = existing.avgCost * existing.quantity;
      const newTotal = (unitPrice || 0) * quantity;
      existing.quantity += quantity;
      existing.avgCost = existing.quantity > 0 ? (oldTotal + newTotal) / existing.quantity : 0;
      if (expiry && (!existing.expiry || new Date(expiry) < new Date(existing.expiry))) {
        existing.expiry = expiry;
      }
      if (location && !existing.location) existing.location = location;
      if (prodBrand && !existing.brand) existing.brand = prodBrand;
      saveInventory(inv);
      addInventoryLog(existing.id, 'in', quantity, '合并入库', todayStr());
      return existing;
    } else {
      const newItem = {
        id: uid(),
        productId: productRef.id || null,
        productName: name,
        brand: prodBrand,
        category,
        quantity,
        unit,
        expiry: expiry || null,
        location: location || '其他',
        avgCost: unitPrice || 0,
        sourceOrderId: sourceOrderId || null
      };
      inv.push(newItem);
      saveInventory(inv);
      addInventoryLog(newItem.id, 'in', quantity, '新增入库', todayStr());
      return newItem;
    }
  }

  // ==================== ROUTER ====================
  const ROUTES = ['home', 'bookkeeping', 'inventory', 'diet', 'profile', 'products', 'recycle'];
  let currentRoute = 'home';

  function navigate(hash) {
    if (hash.startsWith('#')) hash = hash.slice(1);
    if (hash.startsWith('/')) hash = hash.slice(1);
    if (!hash) hash = 'home';
    const parts = hash.split('?');
    const route = parts[0] || 'home';
    const query = parts[1] ? '?' + parts[1] : '';
    const finalRoute = ROUTES.includes(route) ? route : 'home';
    window.location.hash = '/' + finalRoute + query;
  }

  function getRoute() {
    let h = window.location.hash.replace(/^#\/?/, '').split('?')[0];
    if (!h || !ROUTES.includes(h)) h = 'home';
    return h;
  }

  function getQueryParams() {
    const h = window.location.hash;
    const qIdx = h.indexOf('?');
    if (qIdx < 0) return {};
    const qs = h.slice(qIdx + 1);
    const params = {};
    qs.split('&').forEach(p => {
      const [k, v] = p.split('=');
      params[decodeURIComponent(k)] = decodeURIComponent(v || '');
    });
    return params;
  }

  // ==================== LAYOUT ====================
  const ROUTE_META = {
    home: { title: '首页', icon: 'layout-dashboard', color: 'primary' },
    bookkeeping: { title: '记账', icon: 'receipt', color: 'pink' },
    inventory: { title: '库存', icon: 'package', color: 'cream' },
    diet: { title: '饮食', icon: 'utensils', color: 'mint' },
    products: { title: '商品库', icon: 'shopping-bag', color: 'taro' },
    recycle: { title: '回收站', icon: 'trash-2', color: 'gray' },
    profile: { title: '我的', icon: 'user', color: 'primary' }
  };

  function renderLayout(content, activeRoute) {
    const meta = ROUTE_META[activeRoute] || ROUTE_META.home;
    return `
    <div class="flex min-h-screen">
      <aside class="hidden md:flex w-60 flex-col bg-white border-r border-border sticky top-0 h-screen">
        <div class="h-16 flex items-center px-6 border-b border-border">
          <div class="w-8 h-8 rounded-xl bg-primary flex items-center justify-center text-primary-foreground mr-3">
            <i data-lucide="warehouse" class="w-5 h-5"></i>
          </div>
          <span class="font-semibold text-lg text-foreground">仓序食时</span>
        </div>
        <nav class="flex-1 p-4 space-y-1 overflow-y-auto">
          ${['home','bookkeeping','inventory','diet','products','recycle','profile'].map(r => {
            const m = ROUTE_META[r];
            const active = r === activeRoute;
            return `<a href="#/${r}" class="flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${active ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:bg-muted'}">
              <i data-lucide="${m.icon}" class="w-5 h-5"></i>
              <span>${m.title}</span>
            </a>`;
          }).join('')}
        </nav>
      </aside>

      <main class="flex-1 min-w-0 flex flex-col">
        <header class="h-16 bg-white/80 backdrop-blur border-b border-border sticky top-0 z-10 px-4 md:px-8 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <button class="md:hidden w-9 h-9 rounded-full hover:bg-muted flex items-center justify-center text-muted" onclick="toggleMobileMenu()">
              <i data-lucide="menu" class="w-5 h-5"></i>
            </button>
            <h1 class="text-lg font-semibold text-foreground">${meta.title}</h1>
          </div>
          <div class="flex items-center gap-3">
            ${isCloudMode() ? `
              <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-full ${cloudSyncState==='synced'?'bg-mint-100 text-mint-600':cloudSyncState==='syncing'?'bg-info/20 text-info-text':'bg-error/20 text-error-text'} text-xs font-medium" title="${cloudUserEmail}">
                <i data-lucide="${cloudSyncState==='syncing'?'refresh-cw':cloudSyncState==='synced'?'cloud':'cloud-off'}" class="w-3.5 h-3.5 ${cloudSyncState==='syncing'?'animate-spin':''}"></i>
                <span class="hidden sm:inline">${cloudSyncState==='synced'?'已同步':cloudSyncState==='syncing'?'同步中':'同步失败'}</span>
              </div>
            ` : `
              <button class="w-9 h-9 rounded-full hover:bg-muted flex items-center justify-center text-muted transition-colors" onclick="showCloudSetup()" title="开启云端同步">
                <i data-lucide="cloud" class="w-5 h-5"></i>
              </button>
            `}
            <button class="w-9 h-9 rounded-full hover:bg-muted flex items-center justify-center text-muted transition-colors" onclick="navigate('profile')">
              <i data-lucide="bell" class="w-5 h-5"></i>
            </button>
            <div class="w-9 h-9 rounded-full bg-cream-200 text-cream-600 flex items-center justify-center font-medium text-sm" onclick="navigate('profile')">${isCloudMode() ? cloudUserEmail[0].toUpperCase() : '我'}</div>
          </div>
        </header>

        <div class="flex-1 p-4 md:p-8 max-w-6xl w-full mx-auto pb-24 md:pb-8">
          ${content}
        </div>
      </main>

      <nav class="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-border z-20">
        <div class="w-full max-w-md mx-auto grid grid-cols-5 h-full">
          ${['home','bookkeeping','inventory','diet','profile'].map(r => {
            const m = ROUTE_META[r];
            const active = r === activeRoute;
            return `<a href="#/${r}" class="flex flex-col items-center justify-center gap-0.5 px-1 h-full ${active ? 'text-primary' : 'text-muted-foreground'}">
              <i data-lucide="${m.icon}" class="w-5 h-5"></i>
              <span class="text-[11px] leading-none">${m.title}</span>
            </a>`;
          }).join('')}
        </div>
      </nav>

      <div id="mobile-menu" class="hidden md:hidden fixed inset-0 bg-black/30 z-30" onclick="if(event.target===this)toggleMobileMenu()">
        <div class="w-64 h-full bg-white p-4 space-y-1 overflow-y-auto">
          <div class="h-10 flex items-center justify-between mb-4">
            <span class="font-semibold">仓序食时</span>
            <button onclick="toggleMobileMenu()" class="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center">
              <i data-lucide="x" class="w-5 h-5"></i>
            </button>
          </div>
          ${['home','bookkeeping','inventory','diet','products','recycle','profile'].map(r => {
            const m = ROUTE_META[r];
            const active = r === activeRoute;
            return `<a href="#/${r}" onclick="toggleMobileMenu()" class="flex items-center gap-3 px-4 py-3 rounded-xl ${active ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:bg-muted'}">
              <i data-lucide="${m.icon}" class="w-5 h-5"></i>
              <span>${m.title}</span>
            </a>`;
          }).join('')}
        </div>
      </div>
    </div>

    <div id="modal-root"></div>
    `;
  }

  window.toggleMobileMenu = function () {
    const el = $('#mobile-menu');
    if (el) el.classList.toggle('hidden');
  };

  // ==================== MODAL HELPER ====================
  function openModal(html, opts) {
    opts = opts || {};
    const root = $('#modal-root');
    root.innerHTML = `<div class="modal-backdrop" id="modal-backdrop" onclick="if(event.target===this)closeModal()">
      <div class="modal-panel" onclick="event.stopPropagation()">${html}</div>
    </div>`;
    if (opts.afterOpen) setTimeout(opts.afterOpen, 0);
    lucide.createIcons();
  }
  window.closeModal = function () {
    const root = $('#modal-root');
    if (root) root.innerHTML = '';
  };
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });

  // ==================== CONFIRM DIALOG ====================
  function confirmDialog(title, message, onConfirm, opts) {
    opts = opts || {};
    const confirmText = opts.confirmText || '确定';
    const cancelText = opts.cancelText || '取消';
    const danger = opts.danger;
    openModal(`
      <div class="p-6">
        <h3 class="text-lg font-semibold text-foreground mb-2">${esc(title)}</h3>
        <p class="text-sm text-muted-foreground mb-6 whitespace-pre-line">${esc(message)}</p>
        <div class="flex gap-3 justify-end">
          <button class="cx-btn cx-btn-secondary" onclick="closeModal()">${cancelText}</button>
          <button class="cx-btn ${danger ? 'cx-btn-destructive' : 'cx-btn-primary'}" id="confirm-ok">${confirmText}</button>
        </div>
      </div>
    `, {
      afterOpen: () => {
        $('#confirm-ok').addEventListener('click', () => {
          closeModal();
          onConfirm();
        });
      }
    });
  }

  // ==================== VIEWS ====================

  // ---------- HOME ----------
  function renderHome() {
    const orders = getOrders();
    const inventory = getInventory();
    const diet = getDiet();
    const body = getBody();
    const today = todayStr();
    const unassignedPool = getUnassigned();

    const todayOrders = orders.filter(o => o.date === today);
    const todaySpending = todayOrders.reduce((s, o) => s + (parseFloat(o.total) || 0), 0);
    const todayDiet = diet.filter(d => d.date === today);
    const todayCalories = todayDiet.reduce((s, m) => s + (m.totalCalories || 0), 0);
    const latestBody = body.sort((a,b) => b.date.localeCompare(a.date))[0];

    const now = new Date(); now.setHours(0,0,0,0);
    const expiringCount = inventory.filter(i => {
      if (!i.expiry) return false;
      return daysBetween(now, i.expiry) <= 3;
    }).length;
    const lowStockCount = inventory.filter(i => {
      const p = i.productId ? findProductById(i.productId) : null;
      const thr = p ? p.stockThreshold : null;
      return thr != null && i.quantity <= thr;
    }).length;
    const unassignedDiet = unassignedPool.length;

    const recentOrders = [...orders].sort((a,b) => (b.createdAt||b.date).localeCompare(a.createdAt||a.date)).slice(0, 5);
    const recentDiet = [...diet].sort((a,b) => b.date.localeCompare(a.date)).slice(0, 5);

    const mealCaloriesBreakdown = ['breakfast','lunch','dinner','snack'].map(m => {
      const meal = todayDiet.find(d => d.meal === m);
      const cals = meal ? (meal.totalCalories || 0) : 0;
      return getConfig().energyUnit === 'kJ' ? Math.round(cals * KCAL_TO_KJ) : Math.round(cals);
    });

    return `
    <div>
      <section class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div class="cx-card p-5 flex items-center justify-between">
          <div>
            <p class="text-sm text-muted mb-1">今日支出</p>
            <p class="text-2xl font-bold text-foreground">${formatMoney(todaySpending)}</p>
            <p class="text-xs text-muted mt-1">${todayOrders.length} 笔采购</p>
          </div>
          <div class="w-12 h-12 rounded-2xl bg-pink-100 text-pink-500 flex items-center justify-center">
            <i data-lucide="wallet" class="w-6 h-6"></i>
          </div>
        </div>
        <div class="cx-card p-5 flex items-center justify-between">
          <div>
            <p class="text-sm text-muted mb-1">今日摄入</p>
            <p class="text-2xl font-bold text-foreground">${getConfig().energyUnit === 'kJ' ? Math.round(todayCalories * KCAL_TO_KJ) : Math.round(todayCalories)} <span class="text-sm font-normal text-muted">${getConfig().energyUnit}</span></p>
            <p class="text-xs text-muted mt-1">早 ${mealCaloriesBreakdown[0]} · 午 ${mealCaloriesBreakdown[1]} · 晚 ${mealCaloriesBreakdown[2]}</p>
          </div>
          <div class="w-12 h-12 rounded-2xl bg-mint-100 text-mint-600 flex items-center justify-center">
            <i data-lucide="flame" class="w-6 h-6"></i>
          </div>
        </div>
        <div class="cx-card p-5 flex items-center justify-between">
          <div>
            <p class="text-sm text-muted mb-1">最新体重</p>
            <p class="text-2xl font-bold text-foreground">${latestBody ? formatWeight(latestBody.weight) : '--'}</p>
            <p class="text-xs text-muted mt-1">${latestBody ? '体脂率 ' + (latestBody.bodyFat != null ? latestBody.bodyFat + '%' : '--') : '暂无记录'}</p>
          </div>
          <div class="w-12 h-12 rounded-2xl bg-taro-100 text-taro-600 flex items-center justify-center">
            <i data-lucide="scale" class="w-6 h-6"></i>
          </div>
        </div>
      </section>

      <section class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <a href="#/inventory" class="cx-card p-4 flex items-center gap-4 hover:shadow-lg transition-shadow ${expiringCount === 0 ? 'opacity-60' : ''}">
          <div class="w-10 h-10 rounded-xl bg-error/20 text-red-600 flex items-center justify-center">
            <i data-lucide="alert-triangle" class="w-5 h-5"></i>
          </div>
          <div class="flex-1 min-w-0">
            <p class="font-medium text-foreground">临期商品</p>
            <p class="text-sm text-muted truncate">${expiringCount} 件商品保质期 ≤3 天</p>
          </div>
          <i data-lucide="chevron-right" class="w-5 h-5 text-muted flex-shrink-0"></i>
        </a>
        <a href="#/inventory" class="cx-card p-4 flex items-center gap-4 hover:shadow-lg transition-shadow ${lowStockCount === 0 ? 'opacity-60' : ''}">
          <div class="w-10 h-10 rounded-xl bg-warning/30 text-warning-text flex items-center justify-center">
            <i data-lucide="package-x" class="w-5 h-5"></i>
          </div>
          <div class="flex-1 min-w-0">
            <p class="font-medium text-foreground">库存不足</p>
            <p class="text-sm text-muted truncate">${lowStockCount} 件商品低于提醒阈值</p>
          </div>
          <i data-lucide="chevron-right" class="w-5 h-5 text-muted flex-shrink-0"></i>
        </a>
        <a href="#/diet" class="cx-card p-4 flex items-center gap-4 hover:shadow-lg transition-shadow ${unassignedDiet === 0 ? 'opacity-60' : ''}">
          <div class="w-10 h-10 rounded-xl bg-info/20 text-info-text flex items-center justify-center">
            <i data-lucide="coffee" class="w-5 h-5"></i>
          </div>
          <div class="flex-1 min-w-0">
            <p class="font-medium text-foreground">待分配饮食</p>
            <p class="text-sm text-muted truncate">${unassignedDiet} 条外食记录待分配餐次</p>
          </div>
          <i data-lucide="chevron-right" class="w-5 h-5 text-muted flex-shrink-0"></i>
        </a>
      </section>

      <section class="cx-card p-5 mb-6">
        <h2 class="text-base font-semibold text-foreground mb-4">快捷操作</h2>
        <div class="grid grid-cols-3 gap-3">
          <button onclick="openOrderForm()" class="flex flex-col items-center gap-2 p-4 rounded-2xl bg-primary/10 text-primary hover:bg-primary/15 transition-colors">
            <i data-lucide="plus-circle" class="w-6 h-6"></i>
            <span class="text-sm font-medium">记一笔</span>
          </button>
          <button onclick="openDietForm()" class="flex flex-col items-center gap-2 p-4 rounded-2xl bg-mint-100 text-mint-600 hover:bg-mint-200 transition-colors">
            <i data-lucide="apple" class="w-6 h-6"></i>
            <span class="text-sm font-medium">记一餐</span>
          </button>
          <button onclick="openManualInventoryForm()" class="flex flex-col items-center gap-2 p-4 rounded-2xl bg-cream-100 text-cream-600 hover:bg-cream-200 transition-colors">
            <i data-lucide="archive" class="w-6 h-6"></i>
            <span class="text-sm font-medium">入个库</span>
          </button>
        </div>
      </section>

      <section class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="cx-card p-5">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-base font-semibold text-foreground">最近记账</h2>
            <a href="#/bookkeeping" class="text-sm text-primary hover:underline">查看全部</a>
          </div>
          <div class="space-y-3">
            ${recentOrders.length === 0 ? '<p class="text-sm text-muted text-center py-4">暂无记录</p>' :
              recentOrders.map(o => `
                <div class="flex items-center justify-between p-3 rounded-xl bg-white border border-border cursor-pointer hover:border-primary/40 transition-colors" onclick="openOrderForm('${o.id}')">
                  <div class="flex items-center gap-3 min-w-0 flex-1">
                    <div class="w-9 h-9 rounded-lg bg-pink-100 text-pink-500 flex items-center justify-center flex-shrink-0">
                      <i data-lucide="shopping-bag" class="w-4 h-4"></i>
                    </div>
                    <div class="min-w-0 flex-1">
                      <p class="text-sm font-medium text-foreground truncate">${esc(o.channel)}</p>
                      <p class="text-xs text-muted truncate">${formatCNDate(o.date)} · ${o.items.length}件商品</p>
                    </div>
                  </div>
                  <span class="text-sm font-semibold text-foreground ml-2 flex-shrink-0">-${formatMoney(o.total, o.currency)}</span>
                </div>
              `).join('')}
          </div>
        </div>

        <div class="cx-card p-5">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-base font-semibold text-foreground">最近饮食</h2>
            <a href="#/diet" class="text-sm text-primary hover:underline">查看全部</a>
          </div>
          <div class="space-y-3">
            ${recentDiet.length === 0 ? '<p class="text-sm text-muted text-center py-4">暂无记录</p>' :
              recentDiet.map(m => `
                <div class="flex items-center justify-between p-3 rounded-xl bg-white border border-border cursor-pointer hover:border-primary/40 transition-colors" onclick="navigate('diet?date=${m.date}')">
                  <div class="flex items-center gap-3 min-w-0 flex-1">
                    <div class="w-9 h-9 rounded-lg bg-${MEAL_COLORS[m.meal]}-100 text-${MEAL_COLORS[m.meal]}-600 flex items-center justify-center flex-shrink-0">
                      <i data-lucide="${MEAL_ICONS[m.meal]}" class="w-4 h-4"></i>
                    </div>
                    <div class="min-w-0 flex-1">
                      <p class="text-sm font-medium text-foreground truncate">${MEAL_NAMES[m.meal]}</p>
                      <p class="text-xs text-muted truncate">${formatCNDate(m.date)} · ${m.items.map(i=>i.name).join('、')}</p>
                    </div>
                  </div>
                  <span class="text-sm font-semibold text-foreground ml-2 flex-shrink-0">${getConfig().energyUnit==='kJ'?Math.round((m.totalCalories||0)*KCAL_TO_KJ):Math.round(m.totalCalories||0)} ${getConfig().energyUnit}</span>
                </div>
              `).join('')}
          </div>
        </div>
      </section>
    </div>
    `;
  }

  // ---------- BOOKKEEPING ----------
  let bkFilters = { range: 'month', channel: '', payment: '', search: '' };

  function renderBookkeeping() {
    const orders = getOrders();
    const cfg = getConfig();

    let filtered = [...orders];
    const now = new Date();
    if (bkFilters.range === 'today') {
      filtered = filtered.filter(o => o.date === todayStr());
    } else if (bkFilters.range === 'week') {
      const weekAgo = dateStr(addDays(now, -7));
      filtered = filtered.filter(o => o.date >= weekAgo);
    } else if (bkFilters.range === 'month') {
      const monthStart = dateStr(new Date(now.getFullYear(), now.getMonth(), 1));
      filtered = filtered.filter(o => o.date >= monthStart);
    }
    if (bkFilters.channel) filtered = filtered.filter(o => o.channel === bkFilters.channel);
    if (bkFilters.payment) filtered = filtered.filter(o => o.payment === bkFilters.payment);
    if (bkFilters.search) {
      const q = bkFilters.search.toLowerCase();
      filtered = filtered.filter(o =>
        o.channel.toLowerCase().includes(q) ||
        o.note.toLowerCase().includes(q) ||
        o.items.some(i => i.productName.toLowerCase().includes(q))
      );
    }

    filtered.sort((a,b) => b.date.localeCompare(a.date) || (b.createdAt||'').localeCompare(a.createdAt||''));

    const totalSpending = filtered.reduce((s, o) => s + (parseFloat(o.total) || 0), 0);
    const orderCount = filtered.length;
    const daysSet = new Set(filtered.map(o => o.date));
    const dailyAvg = daysSet.size > 0 ? totalSpending / daysSet.size : 0;

    const groups = {};
    filtered.forEach(o => {
      if (!groups[o.date]) groups[o.date] = [];
      groups[o.date].push(o);
    });
    const groupDates = Object.keys(groups).sort((a,b) => b.localeCompare(a));

    return `
    <div>
      <div class="grid grid-cols-3 gap-3 mb-5">
        <div class="cx-card p-4">
          <p class="text-xs text-muted mb-1">总支出</p>
          <p class="text-xl font-bold text-foreground">${formatMoney(totalSpending)}</p>
        </div>
        <div class="cx-card p-4">
          <p class="text-xs text-muted mb-1">笔数</p>
          <p class="text-xl font-bold text-foreground">${orderCount}</p>
        </div>
        <div class="cx-card p-4">
          <p class="text-xs text-muted mb-1">日均</p>
          <p class="text-xl font-bold text-foreground">${formatMoney(dailyAvg)}</p>
        </div>
      </div>

      <div class="cx-card p-4 mb-5">
        <div class="flex flex-wrap gap-2 mb-3">
          ${['today','week','month','all'].map(r => {
            const labels = { today: '今天', week: '本周', month: '本月', all: '全部' };
            const active = bkFilters.range === r;
            return `<button onclick="setBkFilter('range','${r}')" class="cx-btn cx-btn-sm ${active ? 'cx-btn-primary' : 'cx-btn-secondary'}">${labels[r]}</button>`;
          }).join('')}
        </div>
        <div class="flex flex-wrap gap-2 items-center">
          <select onchange="setBkFilter('channel', this.value)" class="cx-input cx-input-sm flex-1 min-w-[120px]">
            <option value="">全部渠道</option>
            ${cfg.channels.map(c => `<option value="${esc(c)}" ${bkFilters.channel===c?'selected':''}>${esc(c)}</option>`).join('')}
          </select>
          <select onchange="setBkFilter('payment', this.value)" class="cx-input cx-input-sm flex-1 min-w-[120px]">
            <option value="">全部支付</option>
            ${cfg.payments.map(p => `<option value="${esc(p)}" ${bkFilters.payment===p?'selected':''}>${esc(p)}</option>`).join('')}
          </select>
          <input type="text" placeholder="搜索..." value="${esc(bkFilters.search)}" oninput="setBkFilter('search', this.value)" class="cx-input cx-input-sm flex-1 min-w-[120px]">
          <button onclick="openOrderForm()" class="cx-btn cx-btn-primary cx-btn-sm ml-auto">
            <i data-lucide="plus" class="w-4 h-4"></i> 新增采购
          </button>
        </div>
      </div>

      <div class="space-y-4">
        ${groupDates.length === 0 ? '<div class="cx-card p-8 text-center text-muted">暂无采购记录，点击"新增采购"开始记账</div>' :
          groupDates.map(d => `
            <div>
              <div class="flex items-center gap-2 mb-2 px-1">
                <span class="text-sm font-medium text-foreground">${formatCNDateFull(d)}</span>
                <span class="text-xs text-muted">${groups[d].length} 笔 · ${formatMoney(groups[d].reduce((s,o)=>s+(+o.total||0),0))}</span>
              </div>
              <div class="space-y-2">
                ${groups[d].map(o => renderOrderCard(o)).join('')}
              </div>
            </div>
          `).join('')}
      </div>
    </div>
    `;
  }

  function renderOrderCard(o) {
    return `
    <details class="cx-card overflow-hidden group">
      <summary class="p-4 flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-pink-100 text-pink-500 flex items-center justify-center flex-shrink-0">
          <i data-lucide="shopping-cart" class="w-5 h-5"></i>
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="font-medium text-foreground">${esc(o.channel)}</span>
            <span class="cx-tag cx-tag-gray">${esc(o.payment)}</span>
            ${o.tags && o.tags.map(t => `<span class="cx-tag cx-tag-primary">${esc(t)}</span>`).join('')}
          </div>
          <p class="text-xs text-muted mt-0.5 truncate">${esc(o.note || '无备注')} · ${o.items.length} 件商品</p>
        </div>
        <span class="font-semibold text-foreground mr-2">${formatMoney(o.total, o.currency)}</span>
        <i data-lucide="chevron-down" class="w-4 h-4 text-muted transition-transform group-open:rotate-180"></i>
      </summary>
      <div class="px-4 pb-4 pt-0 border-t border-border/50">
        <div class="space-y-2 mt-3">
          ${o.items.map(it => `
            <div class="flex items-center justify-between py-2 text-sm">
              <div class="flex-1 min-w-0">
                <span class="text-foreground">${esc(it.productName)}</span>
                ${it.brand ? `<span class="text-muted ml-1 text-xs">(${esc(it.brand)})</span>` : ''}
                <span class="text-muted ml-2">×${it.quantity}${esc(it.unit)}</span>
                ${it.toInventory ? '<span class="cx-tag cx-tag-mint ml-1" style="font-size:10px;padding:1px 6px">入库</span>' : ''}
                ${it.toDiet ? `<span class="cx-tag cx-tag-cream ml-1" style="font-size:10px;padding:1px 6px">${it.meal ? esc(MEAL_NAMES[it.meal]) : '待分配'}</span>` : ''}
              </div>
              <span class="text-muted">${formatMoney(it.subtotal != null ? it.subtotal : (it.unitPrice * it.quantity), o.currency)}</span>
            </div>
          `).join('')}
        </div>
        <div class="flex gap-2 mt-3 pt-3 border-t border-border/50">
          <button onclick="event.preventDefault();event.stopPropagation();openOrderForm('${o.id}')" class="cx-btn cx-btn-sm cx-btn-secondary">
            <i data-lucide="edit-2" class="w-3.5 h-3.5"></i> 编辑
          </button>
          <button onclick="event.preventDefault();event.stopPropagation();deleteOrder('${o.id}')" class="cx-btn cx-btn-sm cx-btn-ghost text-error-text">
            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i> 删除
          </button>
        </div>
      </div>
    </details>
    `;
  }

  window.setBkFilter = function (key, val) {
    bkFilters[key] = val;
    render();
  };

  // Order form
  function openOrderForm(orderId) {
    const cfg = getConfig();
    const products = getProducts();
    const isEdit = !!orderId;
    const order = isEdit ? getOrders().find(o => o.id === orderId) : null;
    const data = order || {
      id: uid(), date: todayStr(), channel: cfg.channels[0], payment: cfg.payments[0],
      currency: cfg.defaultCurrency || 'HKD', note: '', tags: [],
      items: [{ id: uid(), productId: '', productName: '', brand: '', unitPrice: 0, quantity: 1, unit: '个', subtotal: 0, subtotalEdited: false, toInventory: false, toDiet: false, meal: '', expiry: '', location: cfg.locations[0] }],
      total: 0
    };

    data.items.forEach(it => {
      if (it.subtotal == null) it.subtotal = (parseFloat(it.unitPrice)||0) * (parseFloat(it.quantity)||0);
      if (it.subtotalEdited == null) it.subtotalEdited = false;
      if (it.brand == null) it.brand = '';
    });

    function calcItemSubtotal(it) {
      return (parseFloat(it.unitPrice)||0) * (parseFloat(it.quantity)||0);
    }
    function calcTotal() {
      return data.items.reduce((s, it) => s + (parseFloat(it.subtotal)||0), 0);
    }

    function formHtml() {
      data.total = calcTotal();
      return `
      <div class="p-6">
        <div class="flex items-center justify-between mb-5">
          <h3 class="text-lg font-semibold text-foreground">${isEdit ? '编辑采购' : '新增采购'}</h3>
          <button onclick="closeModal()" class="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center text-muted">
            <i data-lucide="x" class="w-5 h-5"></i>
          </button>
        </div>
        <form id="order-form" onsubmit="submitOrder(event)">
          <input type="hidden" name="id" value="${data.id}">
          <datalist id="product-datalist">${products.map(p => `<option value="${esc(p.name)}">${esc(p.name)}${p.brand ? ' - ' + esc(p.brand) : ''}</option>`).join('')}</datalist>
          <div class="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label class="text-xs text-muted block mb-1">日期</label>
              <input type="date" name="date" value="${data.date}" class="cx-input w-full" required>
            </div>
            <div>
              <label class="text-xs text-muted block mb-1">货币</label>
              <select name="currency" class="cx-input w-full">
                <option value="HKD" ${data.currency==='HKD'?'selected':''}>HKD (HK$)</option>
                <option value="CNY" ${data.currency==='CNY'?'selected':''}>CNY (¥)</option>
              </select>
            </div>
            <div>
              <label class="text-xs text-muted block mb-1">采购渠道</label>
              <select name="channel" class="cx-input w-full">
                ${cfg.channels.map(c => `<option value="${esc(c)}" ${data.channel===c?'selected':''}>${esc(c)}</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="text-xs text-muted block mb-1">支付方式</label>
              <select name="payment" class="cx-input w-full">
                ${cfg.payments.map(p => `<option value="${esc(p)}" ${data.payment===p?'selected':''}>${esc(p)}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="mb-4">
            <label class="text-xs text-muted block mb-1">备注</label>
            <input type="text" name="note" value="${esc(data.note)}" class="cx-input w-full" placeholder="可选备注">
          </div>
          <div class="mb-4">
            <label class="text-xs text-muted block mb-2">商品明细</label>
            <div id="order-items" class="space-y-3">
              ${data.items.map((it, idx) => orderItemRow(it, idx, products, cfg)).join('')}
            </div>
            <button type="button" onclick="addOrderItemRow()" class="mt-2 w-full py-2.5 border-2 border-dashed border-border rounded-xl text-sm text-muted hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-1">
              <i data-lucide="plus" class="w-4 h-4"></i> 添加商品
            </button>
          </div>
          <div class="flex items-center justify-between p-3 bg-muted rounded-xl mb-4">
            <span class="text-sm text-muted">合计</span>
            <span class="text-xl font-bold text-primary" id="order-total">${formatMoney(data.total, data.currency)}</span>
          </div>
          <div class="flex gap-3 justify-end">
            <button type="button" onclick="closeModal()" class="cx-btn cx-btn-secondary">取消</button>
            <button type="submit" class="cx-btn cx-btn-primary">${isEdit ? '保存修改' : '保存'}</button>
          </div>
        </form>
      </div>
      `;
    }

    function refresh() {
      const panel = $('.modal-panel');
      if (panel) {
        panel.innerHTML = formHtml();
        lucide.createIcons();
      }
    }
    window._orderRefresh = refresh;
    window._orderData = data;
    window._orderCalcTotal = calcTotal;

    openModal(formHtml(), {
      afterOpen: () => {
        $('#order-form')?.addEventListener('input', () => {
          const form = $('#order-form');
          data.date = form.date.value;
          data.currency = form.currency.value;
          data.channel = form.channel.value;
          data.payment = form.payment.value;
          data.note = form.note.value;
          const totEl = $('#order-total');
          if (totEl) totEl.textContent = formatMoney(calcTotal(), data.currency);
        });
      }
    });
  }
  window.openOrderForm = openOrderForm;

  function orderItemRow(it, idx, products, cfg) {
    const autoSubtotal = (parseFloat(it.unitPrice)||0) * (parseFloat(it.quantity)||0);
    return `
    <div class="p-3 bg-muted/50 rounded-xl space-y-2" data-idx="${idx}">
      <div class="flex gap-2">
        <input type="text" name="item_name_${idx}" value="${esc(it.productName)}" list="product-datalist" placeholder="商品名称"
          class="cx-input cx-input-sm flex-1" oninput="updateOrderItem(${idx},'productName',this.value)" required>
        <button type="button" onclick="removeOrderItemRow(${idx})" class="w-8 h-8 rounded-lg hover:bg-error/20 text-muted hover:text-error-text flex items-center justify-center flex-shrink-0">
          <i data-lucide="x" class="w-4 h-4"></i>
        </button>
      </div>
      <div class="grid grid-cols-4 gap-2">
        <div>
          <label class="text-[11px] text-muted block mb-0.5">品牌</label>
          <input type="text" name="item_brand_${idx}" value="${esc(it.brand||'')}" placeholder="品牌"
            class="cx-input cx-input-sm w-full" oninput="updateOrderItem(${idx},'brand',this.value)">
        </div>
        <div>
          <label class="text-[11px] text-muted block mb-0.5">单价</label>
          <input type="number" step="0.01" min="0" name="item_price_${idx}" value="${it.unitPrice}"
            class="cx-input cx-input-sm w-full" oninput="updateOrderItem(${idx},'unitPrice',parseFloat(this.value)||0)">
        </div>
        <div>
          <label class="text-[11px] text-muted block mb-0.5">数量</label>
          <input type="number" step="0.01" min="0" name="item_qty_${idx}" value="${it.quantity}"
            class="cx-input cx-input-sm w-full" oninput="updateOrderItem(${idx},'quantity',parseFloat(this.value)||0)">
        </div>
        <div>
          <label class="text-[11px] text-muted block mb-0.5">单位</label>
          <select name="item_unit_${idx}" class="cx-input cx-input-sm w-full" onchange="updateOrderItem(${idx},'unit',this.value)">
            ${cfg.units.map(u => `<option value="${u}" ${it.unit===u?'selected':''}>${u}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <div class="flex-1">
          <label class="text-[11px] text-muted block mb-0.5">小计 ${it.subtotalEdited ? '<span class="text-primary" style="font-size:10px">(手动修改)</span>' : ''}</label>
          <input type="number" step="0.01" min="0" name="item_subtotal_${idx}" value="${(it.subtotal != null ? it.subtotal : autoSubtotal)}"
            class="cx-input cx-input-sm w-full" oninput="updateOrderItemSubtotal(${idx},parseFloat(this.value)||0)">
        </div>
      </div>
      <div class="flex flex-wrap gap-3 text-xs">
        <label class="flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" ${it.toInventory?'checked':''} onchange="updateOrderItem(${idx},'toInventory',this.checked);window._orderRefresh()">
          <span class="text-muted">计入库存</span>
        </label>
        <label class="flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" ${it.toDiet?'checked':''} onchange="updateOrderItem(${idx},'toDiet',this.checked);window._orderRefresh()">
          <span class="text-muted">计入饮食</span>
        </label>
      </div>
      ${it.toInventory ? `
      <div class="grid grid-cols-2 gap-2 pt-1">
        <div>
          <label class="text-[11px] text-muted block mb-0.5">保质期</label>
          <input type="date" name="item_expiry_${idx}" value="${it.expiry||''}" class="cx-input cx-input-sm w-full"
            oninput="updateOrderItem(${idx},'expiry',this.value)">
        </div>
        <div>
          <label class="text-[11px] text-muted block mb-0.5">存放位置</label>
          <select name="item_loc_${idx}" class="cx-input cx-input-sm w-full" onchange="updateOrderItem(${idx},'location',this.value)">
            ${cfg.locations.map(l => `<option value="${esc(l)}" ${it.location===l?'selected':''}>${esc(l)}</option>`).join('')}
          </select>
        </div>
      </div>` : ''}
      ${it.toDiet ? `
      <div class="pt-1">
        <label class="text-[11px] text-muted block mb-0.5">餐次</label>
        <select name="item_meal_${idx}" class="cx-input cx-input-sm w-full" onchange="updateOrderItem(${idx},'meal',this.value)">
          <option value="" ${(!it.meal || it.meal==='')?'selected':''}>稍后分配</option>
          ${Object.entries(MEAL_NAMES).map(([k,v]) => `<option value="${k}" ${it.meal===k?'selected':''}>${v}</option>`).join('')}
        </select>
      </div>` : ''}
    </div>
    `;
  }

  window.updateOrderItem = function (idx, field, val) {
    const data = window._orderData;
    if (!data || !data.items[idx]) return;
    data.items[idx][field] = val;
    if (field === 'productName') {
      const p = findProductByName(val);
      if (p) {
        data.items[idx].productId = p.id;
        if (!data.items[idx].unitPrice) data.items[idx].unitPrice = p.defaultPrice;
        if (!data.items[idx].unit) data.items[idx].unit = p.unit;
        if (!data.items[idx].brand) data.items[idx].brand = p.brand || '';
        if (!data.items[idx].subtotalEdited) {
          data.items[idx].subtotal = (parseFloat(data.items[idx].unitPrice)||0) * (parseFloat(data.items[idx].quantity)||0);
        }
      } else {
        data.items[idx].productId = '';
      }
    }
    if ((field === 'unitPrice' || field === 'quantity') && !data.items[idx].subtotalEdited) {
      data.items[idx].subtotal = (parseFloat(data.items[idx].unitPrice)||0) * (parseFloat(data.items[idx].quantity)||0);
      const subInput = document.querySelector(`input[name="item_subtotal_${idx}"]`);
      if (subInput) subInput.value = data.items[idx].subtotal;
    }
    const calcTotal = window._orderCalcTotal;
    const total = calcTotal ? calcTotal() : data.items.reduce((s, it) => s + (parseFloat(it.subtotal)||0), 0);
    const totEl = $('#order-total');
    if (totEl) totEl.textContent = formatMoney(total, data.currency);
  };

  window.updateOrderItemSubtotal = function (idx, val) {
    const data = window._orderData;
    if (!data || !data.items[idx]) return;
    data.items[idx].subtotal = val;
    data.items[idx].subtotalEdited = true;
    const calcTotal = window._orderCalcTotal;
    const total = calcTotal ? calcTotal() : data.items.reduce((s, it) => s + (parseFloat(it.subtotal)||0), 0);
    const totEl = $('#order-total');
    if (totEl) totEl.textContent = formatMoney(total, data.currency);
    const subInput = document.querySelector(`input[name="item_subtotal_${idx}"]`);
    if (subInput) {
      const labelEl = subInput.closest('div').querySelector('label');
      if (labelEl && !labelEl.querySelector('.subtotal-edited-tag')) {
        const span = document.createElement('span');
        span.className = 'text-primary subtotal-edited-tag';
        span.style.fontSize = '10px';
        span.textContent = ' (手动修改)';
        labelEl.appendChild(span);
      }
    }
  };

  window.addOrderItemRow = function () {
    const cfg = getConfig();
    const data = window._orderData;
    data.items.push({ id: uid(), productId: '', productName: '', brand: '', unitPrice: 0, quantity: 1, unit: cfg.units[0], subtotal: 0, subtotalEdited: false, toInventory: false, toDiet: false, meal: '', expiry: '', location: cfg.locations[0] });
    window._orderRefresh();
  };

  window.removeOrderItemRow = function (idx) {
    const data = window._orderData;
    if (data.items.length <= 1) { toast('至少保留一项商品'); return; }
    data.items.splice(idx, 1);
    window._orderRefresh();
  };

  window.submitOrder = function (e) {
    e.preventDefault();
    const data = window._orderData;
    const isEdit = !!getOrders().find(o => o.id === data.id);
    const form = e.target;
    data.date = form.date.value;
    data.currency = form.currency.value;
    data.channel = form.channel.value;
    data.payment = form.payment.value;
    data.note = form.note.value;
    data.items.forEach(it => {
      if (it.subtotal == null) it.subtotal = (parseFloat(it.unitPrice)||0) * (parseFloat(it.quantity)||0);
      if (it.brand == null) it.brand = '';
    });
    data.total = data.items.reduce((s, it) => s + (parseFloat(it.subtotal)||0), 0);
    data.createdAt = new Date().toISOString();

    if (!data.date) { toast('请选择日期'); return; }
    if (data.items.some(it => !it.productName.trim())) { toast('请填写商品名称'); return; }

    let orders = getOrders();
    const existingIdx = orders.findIndex(o => o.id === data.id);
    let unassigned = getUnassigned();

    if (existingIdx >= 0) {
      const oldOrder = orders[existingIdx];
      let inv = getInventory();
      oldOrder.items.forEach(oldIt => {
        if (oldIt.toInventory) {
          const invItem = inv.find(i => i.productName === oldIt.productName && i.sourceOrderId === oldOrder.id);
          if (invItem) {
            invItem.quantity -= oldIt.quantity;
            addInventoryLog(invItem.id, 'adjust', -oldIt.quantity, '编辑订单回退', todayStr());
            if (invItem.quantity <= 0) {
              inv = inv.filter(i => i.id !== invItem.id);
            }
          }
        }
      });
      saveInventory(inv);
      let diet = getDiet();
      oldOrder.items.forEach(oldIt => {
        if (oldIt.toDiet && oldIt.meal) {
          diet = diet.map(m => ({
            ...m,
            items: m.items.filter(di => !(di.source === 'order' && di._orderItemId === oldIt.id))
          })).filter(m => m.items.length > 0);
          diet.forEach(m => { m.totalCalories = m.items.reduce((s,i)=>s+(i.calories||0),0); });
        }
      });
      saveDiet(diet);
      unassigned = unassigned.filter(u => !(u.orderId === oldOrder.id));
      orders[existingIdx] = data;
    } else {
      orders.push(data);
    }
    saveOrders(orders);
    saveUnassigned(unassigned);

    let diet = getDiet();
    const products = getProducts();
    let productsChanged = false;
    let newUnassigned = [];

    data.items.forEach(it => {
      let p = findProductByName(it.productName);
      if (!p) {
        p = { id: uid(), name: it.productName, brand: it.brand || '', category: '其他', unit: it.unit, defaultPrice: it.unitPrice, calories: 0, protein: 0, carbs: 0, fat: 0, stockThreshold: 0 };
        products.push(p);
        productsChanged = true;
      } else if (!it.productId) {
        it.productId = p.id;
      }

      if (it.toInventory) {
        mergeIntoInventory(p, it.quantity, it.unit, it.expiry || null, it.location || '其他', data.id, it.unitPrice, it.brand);
      }

      if (it.toDiet) {
        let cal = 0, pro = 0, carb = 0, fat = 0;
        if (p.calories) {
          const isMass = ['g','kg','ml','L','磅','斤','两'].includes(it.unit);
          const factor = isMass ? (convertToGrams(it.quantity, it.unit) / 100) : it.quantity;
          cal = (p.calories || 0) * factor;
          pro = (p.protein || 0) * factor;
          carb = (p.carbs || 0) * factor;
          fat = (p.fat || 0) * factor;
        }
        if (it.meal) {
          let mealEntry = diet.find(m => m.date === data.date && m.meal === it.meal);
          if (!mealEntry) {
            mealEntry = { id: uid(), date: data.date, meal: it.meal, items: [], totalCalories: 0 };
            diet.push(mealEntry);
          }
          mealEntry.items.push({
            id: uid(), source: 'order', productId: p.id, name: it.productName, brand: it.brand || '',
            quantity: it.quantity, unit: it.unit,
            calories: cal, protein: pro, carbs: carb, fat: fat,
            _orderItemId: it.id
          });
          mealEntry.totalCalories = mealEntry.items.reduce((s, i) => s + (i.calories || 0), 0);
        } else {
          newUnassigned.push({
            id: uid(),
            orderId: data.id,
            orderDate: data.date,
            productId: p.id,
            productName: it.productName,
            brand: it.brand || '',
            unit: it.unit,
            quantity: it.quantity,
            calories: cal, protein: pro, carbs: carb, fat: fat,
            assigned: false
          });
        }
      }
    });
    if (productsChanged) saveProducts(products);
    saveDiet(diet);
    const currentUnassigned = getUnassigned();
    saveUnassigned([...currentUnassigned, ...newUnassigned]);

    closeModal();
    toast(isEdit ? '已更新采购' : '已新增采购');
    render();
  };

  function convertToGrams(qty, unit) {
    if (unit === 'g' || unit === 'ml') return qty;
    if (unit === 'kg' || unit === 'L') return qty * 1000;
    if (UNIT_CONVERSIONS[unit] != null) return qty * UNIT_CONVERSIONS[unit];
    return qty;
  }

  window.deleteOrder = function (id) {
    const orders = getOrders();
    const o = orders.find(x => x.id === id);
    if (!o) return;
    const invCount = o.items.filter(i => i.toInventory).length;
    const dietCount = o.items.filter(i => i.toDiet).length;
    confirmDialog(
      '删除采购记录',
      `确定删除「${o.channel}」的采购记录吗？\n\n影响：\n• ${o.items.length} 件商品明细将被移除\n• ${invCount} 个库存项可能需要调整\n• ${dietCount} 条饮食记录将被移除\n\n记录将移至回收站，可恢复。`,
      () => {
        const recycle = getRecycle();
        recycle.push({ id: uid(), type: 'order', data: JSON.parse(JSON.stringify(o)), deletedAt: new Date().toISOString() });
        saveRecycle(recycle);
        let inv = getInventory();
        const logs = getInventoryLogs();
        o.items.forEach(it => {
          if (it.toInventory) {
            const invItem = inv.find(i => i.productName === it.productName && i.sourceOrderId === o.id);
            if (invItem) {
              invItem.quantity -= it.quantity;
              logs.push({ id: uid(), inventoryId: invItem.id, type: 'adjust', quantity: -it.quantity, note: '删除订单回退', date: todayStr() });
              if (invItem.quantity <= 0) {
                inv = inv.filter(i => i.id !== invItem.id);
              }
            }
          }
        });
        saveInventory(inv); saveInventoryLogs(logs);
        let diet = getDiet();
        o.items.forEach(it => {
          if (it.toDiet && it.meal) {
            diet = diet.map(m => ({
              ...m,
              items: m.items.filter(di => !(di.source === 'order' && di._orderItemId === it.id))
            })).filter(m => m.items.length > 0);
            diet.forEach(m => { m.totalCalories = m.items.reduce((s,i)=>s+(i.calories||0),0); });
          }
        });
        saveDiet(diet);
        let unassigned = getUnassigned();
        unassigned = unassigned.filter(u => u.orderId !== o.id);
        saveUnassigned(unassigned);
        saveOrders(orders.filter(x => x.id !== id));
        toast('已移至回收站');
        render();
      },
      { danger: true, confirmText: '删除' }
    );
  };

  // ---------- INVENTORY ----------
  let invFilters = { category: '', location: '', status: 'all' };

  function renderInventory() {
    const cfg = getConfig();
    let inventory = getInventory();
    const now = new Date(); now.setHours(0,0,0,0);

    const expiringItems = inventory.filter(i => i.expiry && daysBetween(now, i.expiry) <= 3 && daysBetween(now, i.expiry) >= 0);
    const soonItems = inventory.filter(i => i.expiry && daysBetween(now, i.expiry) > 3 && daysBetween(now, i.expiry) <= 7);
    const lowStockItems = inventory.filter(i => {
      const p = i.productId ? findProductById(i.productId) : null;
      return p && p.stockThreshold != null && i.quantity <= p.stockThreshold;
    });
    const expiredItems = inventory.filter(i => i.expiry && daysBetween(now, i.expiry) < 0);

    if (invFilters.category) inventory = inventory.filter(i => i.category === invFilters.category);
    if (invFilters.location) inventory = inventory.filter(i => i.location === invFilters.location);
    if (invFilters.status === 'expiring') inventory = inventory.filter(i => i.expiry && daysBetween(now, i.expiry) <= 7);
    if (invFilters.status === 'low') {
      inventory = inventory.filter(i => {
        const p = i.productId ? findProductById(i.productId) : null;
        return p && p.stockThreshold != null && i.quantity <= p.stockThreshold;
      });
    }

    const groups = {};
    inventory.forEach(i => {
      const cat = i.category || '其他';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(i);
    });

    const catColorMap = {
      '蛋奶': 'cream', '肉类': 'pink', '蔬果': 'mint', '粮油调味': 'taro',
      '零食饮料': 'pink', '日用品': 'taro', '冷冻食品': 'mint', '其他': 'gray'
    };

    return `
    <div>
      ${(expiringItems.length + soonItems.length + lowStockItems.length + expiredItems.length) > 0 ? `
      <div class="space-y-2 mb-5">
        ${expiredItems.length > 0 ? `
          <div class="cx-card p-4 flex items-center gap-3 border-l-4 border-red-400">
            <div class="w-10 h-10 rounded-xl bg-error/20 text-red-600 flex items-center justify-center flex-shrink-0">
              <i data-lucide="x-circle" class="w-5 h-5"></i>
            </div>
            <div class="flex-1">
              <p class="font-medium text-red-700">已过期</p>
              <p class="text-xs text-muted">${expiredItems.length} 件商品已过期：${expiredItems.slice(0,3).map(i=>i.productName).join('、')}${expiredItems.length>3?'...':''}</p>
            </div>
          </div>` : ''}
        ${expiringItems.length > 0 ? `
          <div class="cx-card p-4 flex items-center gap-3 border-l-4 border-orange-400">
            <div class="w-10 h-10 rounded-xl bg-error/20 text-red-600 flex items-center justify-center flex-shrink-0">
              <i data-lucide="alert-triangle" class="w-5 h-5"></i>
            </div>
            <div class="flex-1">
              <p class="font-medium text-foreground">即将过期 (≤3天)</p>
              <p class="text-xs text-muted">${expiringItems.length} 件：${expiringItems.slice(0,3).map(i=>i.productName).join('、')}${expiringItems.length>3?'...':''}</p>
            </div>
          </div>` : ''}
        ${soonItems.length > 0 ? `
          <div class="cx-card p-4 flex items-center gap-3 border-l-4 border-yellow-400">
            <div class="w-10 h-10 rounded-xl bg-warning/30 text-warning-text flex items-center justify-center flex-shrink-0">
              <i data-lucide="clock" class="w-5 h-5"></i>
            </div>
            <div class="flex-1">
              <p class="font-medium text-foreground">临期 (≤7天)</p>
              <p class="text-xs text-muted">${soonItems.length} 件：${soonItems.slice(0,3).map(i=>i.productName).join('、')}${soonItems.length>3?'...':''}</p>
            </div>
          </div>` : ''}
        ${lowStockItems.length > 0 ? `
          <div class="cx-card p-4 flex items-center gap-3 border-l-4 border-blue-400">
            <div class="w-10 h-10 rounded-xl bg-info/20 text-info-text flex items-center justify-center flex-shrink-0">
              <i data-lucide="package-x" class="w-5 h-5"></i>
            </div>
            <div class="flex-1">
              <p class="font-medium text-foreground">库存不足</p>
              <p class="text-xs text-muted">${lowStockItems.length} 件低于阈值：${lowStockItems.slice(0,3).map(i=>i.productName).join('、')}${lowStockItems.length>3?'...':''}</p>
            </div>
          </div>` : ''}
      </div>` : ''}

      <div class="cx-card p-4 mb-5">
        <div class="flex flex-wrap gap-2 items-center">
          <select onchange="setInvFilter('category', this.value)" class="cx-input cx-input-sm">
            <option value="">全部分类</option>
            ${cfg.categories.map(c => `<option value="${esc(c)}" ${invFilters.category===c?'selected':''}>${esc(c)}</option>`).join('')}
          </select>
          <select onchange="setInvFilter('location', this.value)" class="cx-input cx-input-sm">
            <option value="">全部位置</option>
            ${cfg.locations.map(l => `<option value="${esc(l)}" ${invFilters.location===l?'selected':''}>${esc(l)}</option>`).join('')}
          </select>
          <div class="flex gap-1">
            ${[['all','全部'],['expiring','临期'],['low','库存不足']].map(([k,v]) =>
              `<button onclick="setInvFilter('status','${k}')" class="cx-btn cx-btn-sm ${invFilters.status===k?'cx-btn-primary':'cx-btn-secondary'}">${v}</button>`
            ).join('')}
          </div>
          <button onclick="openManualInventoryForm()" class="cx-btn cx-btn-primary cx-btn-sm ml-auto">
            <i data-lucide="plus" class="w-4 h-4"></i> 手动入库
          </button>
        </div>
      </div>

      <div class="space-y-5">
        ${Object.keys(groups).length === 0 ? '<div class="cx-card p-8 text-center text-muted">暂无库存</div>' :
          Object.entries(groups).map(([cat, items]) => `
            <div>
              <div class="flex items-center gap-2 mb-2 px-1">
                <span class="cx-tag cx-tag-${catColorMap[cat]||'gray'}">${esc(cat)}</span>
                <span class="text-xs text-muted">${items.length} 件</span>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                ${items.map(i => renderInventoryCard(i, now)).join('')}
              </div>
            </div>
          `).join('')}
      </div>
    </div>
    `;
  }

  function renderInventoryCard(i, now) {
    let expiryText = '无保质期';
    let expiryClass = 'text-muted';
    if (i.expiry) {
      const days = daysBetween(now, i.expiry);
      if (days < 0) { expiryText = `已过期 ${-days} 天`; expiryClass = 'text-red-600'; }
      else if (days <= 3) { expiryText = `${days}天后过期`; expiryClass = 'text-red-600'; }
      else if (days <= 7) { expiryText = `${days}天后过期`; expiryClass = 'text-amber-600'; }
      else { expiryText = `${days}天后过期`; expiryClass = 'text-muted'; }
    }
    const p = i.productId ? findProductById(i.productId) : null;
    const isLow = p && p.stockThreshold != null && i.quantity <= p.stockThreshold;

    return `
    <div class="cx-card p-4 hover:shadow-lg transition-shadow cursor-pointer" onclick="showInventoryDetail('${i.id}')">
      <div class="flex items-start justify-between gap-2 mb-2">
        <div class="min-w-0 flex-1">
          <h4 class="font-medium text-foreground truncate">${esc(i.productName)}</h4>
          ${i.brand ? `<p class="text-xs text-muted truncate">${esc(i.brand)}</p>` : ''}
        </div>
        <button onclick="event.stopPropagation();openOutboundForm('${i.id}')" class="cx-btn cx-btn-sm cx-btn-secondary flex-shrink-0">
          <i data-lucide="minus-circle" class="w-3.5 h-3.5"></i> 出库
        </button>
      </div>
      <div class="flex items-center gap-3 text-sm mb-2">
        <span class="font-semibold text-foreground">${i.quantity}${esc(i.unit)}</span>
        ${isLow ? '<span class="cx-tag cx-tag-primary" style="font-size:10px;padding:1px 6px">库存不足</span>' : ''}
      </div>
      <div class="flex items-center justify-between text-xs">
        <span class="flex items-center gap-1 ${expiryClass}">
          <i data-lucide="clock" class="w-3 h-3"></i> ${expiryText}
        </span>
        <span class="flex items-center gap-1 text-muted">
          <i data-lucide="map-pin" class="w-3 h-3"></i> ${esc(i.location)}
        </span>
      </div>
      ${i.avgCost ? `<div class="text-xs text-muted mt-1">均价 ${formatMoney(i.avgCost)}/${esc(i.unit)}</div>` : ''}
    </div>
    `;
  }

  window.setInvFilter = function (key, val) { invFilters[key] = val; render(); };

  function showInventoryDetail(id) {
    const inv = getInventory().find(i => i.id === id);
    if (!inv) return;
    const logs = getInventoryLogs().filter(l => l.inventoryId === id).sort((a,b) => b.date.localeCompare(a.date));
    const p = inv.productId ? findProductById(inv.productId) : null;
    openModal(`
      <div class="p-6">
        <div class="flex items-center justify-between mb-5">
          <h3 class="text-lg font-semibold text-foreground">库存详情</h3>
          <button onclick="closeModal()" class="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center text-muted">
            <i data-lucide="x" class="w-5 h-5"></i>
          </button>
        </div>
        <div class="space-y-3 mb-5">
          <div class="flex justify-between py-2 border-b border-border/50">
            <span class="text-muted text-sm">商品名称</span><span class="text-sm font-medium">${esc(inv.productName)}</span>
          </div>
          <div class="flex justify-between py-2 border-b border-border/50">
            <span class="text-muted text-sm">品牌</span><span class="text-sm">${esc(inv.brand||'-')}</span>
          </div>
          <div class="flex justify-between py-2 border-b border-border/50">
            <span class="text-muted text-sm">分类</span><span class="text-sm">${esc(inv.category||'其他')}</span>
          </div>
          <div class="flex justify-between py-2 border-b border-border/50">
            <span class="text-muted text-sm">库存数量</span><span class="text-sm font-semibold text-primary">${inv.quantity}${esc(inv.unit)}</span>
          </div>
          <div class="flex justify-between py-2 border-b border-border/50">
            <span class="text-muted text-sm">保质期</span><span class="text-sm">${inv.expiry ? formatCNDateFull(inv.expiry) : '无'}</span>
          </div>
          <div class="flex justify-between py-2 border-b border-border/50">
            <span class="text-muted text-sm">存放位置</span><span class="text-sm">${esc(inv.location)}</span>
          </div>
          <div class="flex justify-between py-2 border-b border-border/50">
            <span class="text-muted text-sm">平均成本</span><span class="text-sm">${inv.avgCost ? formatMoney(inv.avgCost) + '/' + esc(inv.unit) : '-'}</span>
          </div>
          ${p ? `
          <div class="flex justify-between py-2 border-b border-border/50">
            <span class="text-muted text-sm">营养(每100${['g','ml'].includes(p.unit)?(p.unit==='ml'?'ml':'g'):'份'})</span>
            <span class="text-sm">${p.calories||0}kcal · 蛋白${p.protein||0}g · 碳${p.carbs||0}g · 脂${p.fat||0}g</span>
          </div>` : ''}
        </div>
        <h4 class="text-sm font-medium mb-2">变动记录</h4>
        <div class="space-y-2 max-h-48 overflow-y-auto mb-5">
          ${logs.length === 0 ? '<p class="text-xs text-muted">暂无记录</p>' : logs.map(l => {
            const typeMap = { in:['入库','text-green-600','arrow-down'], out:['出库','text-red-600','arrow-up'], expire:['过期','text-orange-600','clock'], adjust:['调整','text-blue-600','edit'] };
            const [label, cls, icon] = typeMap[l.type] || ['调整','text-muted','edit'];
            return `<div class="flex items-center gap-2 p-2 bg-muted/50 rounded-lg text-xs">
              <i data-lucide="${icon}" class="w-3.5 h-3.5 ${cls}"></i>
              <span class="${cls} font-medium">${label}</span>
              <span class="text-muted">${l.quantity>0?'+':''}${l.quantity}${esc(inv.unit)}</span>
              <span class="text-muted ml-auto">${formatCNDate(l.date)}</span>
              ${l.note ? `<span class="text-muted">· ${esc(l.note)}</span>` : ''}
            </div>`;
          }).join('')}
        </div>
        <div class="flex gap-2 justify-end">
          <button onclick="openInventoryEditForm('${inv.id}')" class="cx-btn cx-btn-sm cx-btn-secondary">
            <i data-lucide="edit-2" class="w-3.5 h-3.5"></i> 编辑
          </button>
          <button onclick="deleteInventory('${inv.id}')" class="cx-btn cx-btn-sm cx-btn-ghost text-error-text">
            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i> 删除
          </button>
          <button onclick="closeModal()" class="cx-btn cx-btn-sm cx-btn-primary">关闭</button>
        </div>
      </div>
    `);
    lucide.createIcons();
  }
  window.showInventoryDetail = showInventoryDetail;

  function openInventoryEditForm(invId) {
    const cfg = getConfig();
    const inv = getInventory().find(i => i.id === invId);
    if (!inv) return;
    const p = inv.productId ? findProductById(inv.productId) : null;

    openModal(`
      <div class="p-6">
        <div class="flex items-center justify-between mb-5">
          <h3 class="text-lg font-semibold">编辑库存</h3>
          <button onclick="closeModal()" class="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center text-muted">
            <i data-lucide="x" class="w-5 h-5"></i>
          </button>
        </div>
        <form onsubmit="submitInventoryEdit(event,'${invId}')" class="space-y-3">
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-xs text-muted block mb-1">商品名称</label>
              <input type="text" id="ie-name" value="${esc(inv.productName)}" class="cx-input w-full" required>
            </div>
            <div>
              <label class="text-xs text-muted block mb-1">品牌</label>
              <input type="text" id="ie-brand" value="${esc(inv.brand||'')}" class="cx-input w-full">
            </div>
          </div>
          <div>
            <label class="text-xs text-muted block mb-1">分类</label>
            <select id="ie-category" class="cx-input w-full">
              ${cfg.categories.map(c => `<option value="${esc(c)}" ${(inv.category||'其他')===c?'selected':''}>${esc(c)}</option>`).join('')}
            </select>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-xs text-muted block mb-1">数量</label>
              <input type="number" id="ie-qty" step="0.01" min="0" value="${inv.quantity}" class="cx-input w-full" required>
            </div>
            <div>
              <label class="text-xs text-muted block mb-1">单位</label>
              <select id="ie-unit" class="cx-input w-full">
                ${cfg.units.map(u => `<option value="${u}" ${inv.unit===u?'selected':''}>${u}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-xs text-muted block mb-1">保质期</label>
              <input type="date" id="ie-expiry" value="${inv.expiry||''}" class="cx-input w-full">
            </div>
            <div>
              <label class="text-xs text-muted block mb-1">存放位置</label>
              <select id="ie-location" class="cx-input w-full">
                ${cfg.locations.map(l => `<option value="${esc(l)}" ${inv.location===l?'selected':''}>${esc(l)}</option>`).join('')}
              </select>
            </div>
          </div>
          ${p ? `
          <div class="border-t border-border pt-3 mt-3">
            <p class="text-xs text-muted mb-2">关联商品营养信息 (每100g/100ml，修改将同步更新商品库)</p>
            <div class="grid grid-cols-4 gap-2">
              <div>
                <label class="text-[11px] text-muted block mb-0.5">热量(kcal)</label>
                <input type="number" id="ie-cal" step="1" min="0" value="${p.calories||0}" class="cx-input cx-input-sm w-full">
              </div>
              <div>
                <label class="text-[11px] text-muted block mb-0.5">蛋白(g)</label>
                <input type="number" id="ie-pro" step="0.1" min="0" value="${p.protein||0}" class="cx-input cx-input-sm w-full">
              </div>
              <div>
                <label class="text-[11px] text-muted block mb-0.5">碳水(g)</label>
                <input type="number" id="ie-carb" step="0.1" min="0" value="${p.carbs||0}" class="cx-input cx-input-sm w-full">
              </div>
              <div>
                <label class="text-[11px] text-muted block mb-0.5">脂肪(g)</label>
                <input type="number" id="ie-fat" step="0.1" min="0" value="${p.fat||0}" class="cx-input cx-input-sm w-full">
              </div>
            </div>
          </div>` : ''}
          <div class="flex gap-3 justify-end pt-2">
            <button type="button" onclick="closeModal()" class="cx-btn cx-btn-secondary">取消</button>
            <button type="submit" class="cx-btn cx-btn-primary">保存</button>
          </div>
        </form>
      </div>
    `);
    lucide.createIcons();
  }
  window.openInventoryEditForm = openInventoryEditForm;

  window.submitInventoryEdit = function (e, invId) {
    e.preventDefault();
    let inv = getInventory();
    const idx = inv.findIndex(i => i.id === invId);
    if (idx < 0) return;
    const item = inv[idx];

    const newName = $('#ie-name').value.trim();
    const newBrand = $('#ie-brand').value.trim();
    const newCategory = $('#ie-category').value;
    const newQty = parseFloat($('#ie-qty').value) || 0;
    const newUnit = $('#ie-unit').value;
    const newExpiry = $('#ie-expiry').value || null;
    const newLocation = $('#ie-location').value;

    const oldQty = item.quantity;
    const qtyDiff = newQty - oldQty;

    item.productName = newName;
    item.brand = newBrand;
    item.category = newCategory;
    item.quantity = newQty;
    item.unit = newUnit;
    item.expiry = newExpiry;
    item.location = newLocation;

    if (item.productId) {
      const products = getProducts();
      const pIdx = products.findIndex(p => p.id === item.productId);
      if (pIdx >= 0) {
        products[pIdx].name = newName;
        products[pIdx].brand = newBrand;
        products[pIdx].category = newCategory;
        products[pIdx].unit = newUnit;
        const calEl = $('#ie-cal');
        if (calEl) {
          products[pIdx].calories = parseFloat(calEl.value) || 0;
          products[pIdx].protein = parseFloat($('#ie-pro').value) || 0;
          products[pIdx].carbs = parseFloat($('#ie-carb').value) || 0;
          products[pIdx].fat = parseFloat($('#ie-fat').value) || 0;
        }
        saveProducts(products);
      }
    }

    saveInventory(inv);
    if (Math.abs(qtyDiff) > 0.001) {
      addInventoryLog(invId, 'adjust', qtyDiff, '编辑库存调整', todayStr());
    }

    closeModal();
    toast('已保存');
    render();
  };

  function openManualInventoryForm() {
    const cfg = getConfig();
    const products = getProducts();

    function html() {
      return `
      <div class="p-6">
        <div class="flex items-center justify-between mb-5">
          <h3 class="text-lg font-semibold">手动入库</h3>
          <button onclick="closeModal()" class="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center text-muted">
            <i data-lucide="x" class="w-5 h-5"></i>
          </button>
        </div>
        <form onsubmit="submitManualInventory(event)" class="space-y-3">
          <div>
            <label class="text-xs text-muted block mb-1">选择商品</label>
            <div class="flex gap-2">
              <select id="mi-product-select" class="cx-input flex-1" onchange="document.getElementById('mi-new-fields').classList.toggle('hidden', this.value!=='__new__')">
                <option value="">-- 选择已有商品 --</option>
                ${products.map(p => `<option value="${p.id}">${esc(p.name)}${p.brand?' - '+esc(p.brand):''}</option>`).join('')}
                <option value="__new__">+ 新建商品</option>
              </select>
            </div>
          </div>
          <div id="mi-new-fields" class="hidden">
            <label class="text-xs text-muted block mb-1">新商品名称</label>
            <input type="text" id="mi-newname" class="cx-input w-full mb-2" placeholder="商品名称">
            <label class="text-xs text-muted block mb-1">品牌</label>
            <input type="text" id="mi-newbrand" class="cx-input w-full mb-2" placeholder="品牌（可选）">
            <label class="text-xs text-muted block mb-1">分类</label>
            <select id="mi-newcat" class="cx-input w-full">
              ${cfg.categories.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('')}
            </select>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-xs text-muted block mb-1">数量</label>
              <input type="number" id="mi-qty" step="0.01" min="0" value="1" class="cx-input w-full" required>
            </div>
            <div>
              <label class="text-xs text-muted block mb-1">单位</label>
              <select id="mi-unit" class="cx-input w-full">
                ${cfg.units.map(u => `<option value="${u}">${u}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-xs text-muted block mb-1">保质期</label>
              <input type="date" id="mi-expiry" class="cx-input w-full">
            </div>
            <div>
              <label class="text-xs text-muted block mb-1">存放位置</label>
              <select id="mi-loc" class="cx-input w-full">
                ${cfg.locations.map(l => `<option value="${esc(l)}">${esc(l)}</option>`).join('')}
              </select>
            </div>
          </div>
          <div>
            <label class="text-xs text-muted block mb-1">单价 (可选)</label>
            <input type="number" id="mi-price" step="0.01" min="0" value="0" class="cx-input w-full">
          </div>
          <div class="flex gap-3 justify-end pt-2">
            <button type="button" onclick="closeModal()" class="cx-btn cx-btn-secondary">取消</button>
            <button type="submit" class="cx-btn cx-btn-primary">入库</button>
          </div>
        </form>
      </div>`;
    }
    openModal(html());
  }
  window.openManualInventoryForm = openManualInventoryForm;

  window.submitManualInventory = function (e) {
    e.preventDefault();
    const sel = $('#mi-product-select').value;
    const qty = parseFloat($('#mi-qty').value) || 0;
    const unit = $('#mi-unit').value;
    const expiry = $('#mi-expiry').value || null;
    const loc = $('#mi-loc').value;
    const price = parseFloat($('#mi-price').value) || 0;

    if (qty <= 0) { toast('数量需大于0'); return; }

    let p;
    let brand = '';
    const products = getProducts();
    if (sel === '__new__') {
      const name = $('#mi-newname').value.trim();
      if (!name) { toast('请输入商品名称'); return; }
      const cat = $('#mi-newcat').value;
      brand = $('#mi-newbrand').value.trim();
      p = { id: uid(), name, brand, category: cat, unit, defaultPrice: price, calories: 0, protein: 0, carbs: 0, fat: 0, stockThreshold: 0 };
      products.push(p);
      saveProducts(products);
    } else if (sel) {
      p = products.find(x => x.id === sel);
      brand = p ? (p.brand || '') : '';
    } else {
      toast('请选择商品或新建'); return;
    }

    mergeIntoInventory(p, qty, unit, expiry, loc, null, price, brand);
    closeModal();
    toast('入库成功');
    render();
  };

  function openOutboundForm(invId) {
    const inv = getInventory().find(i => i.id === invId);
    if (!inv) return;
    openModal(`
      <div class="p-6">
        <div class="flex items-center justify-between mb-5">
          <h3 class="text-lg font-semibold">出库 - ${esc(inv.productName)}</h3>
          <button onclick="closeModal()" class="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center text-muted">
            <i data-lucide="x" class="w-5 h-5"></i>
          </button>
        </div>
        <p class="text-sm text-muted mb-4">当前库存: <span class="font-semibold text-foreground">${inv.quantity}${esc(inv.unit)}</span></p>
        <form onsubmit="submitOutbound(event,'${invId}')" class="space-y-3">
          <div>
            <label class="text-xs text-muted block mb-1">出库类型</label>
            <select name="type" class="cx-input w-full">
              <option value="out">日常消耗</option>
              <option value="expire">过期丢弃</option>
              <option value="adjust">手动调整</option>
              <option value="out">三餐食用</option>
            </select>
          </div>
          <div>
            <label class="text-xs text-muted block mb-1">出库数量 (${esc(inv.unit)})</label>
            <input type="number" name="quantity" step="0.01" min="0.01" max="${inv.quantity}" value="${Math.min(inv.quantity, 1)}" class="cx-input w-full" required>
          </div>
          <div>
            <label class="text-xs text-muted block mb-1">备注</label>
            <input type="text" name="note" class="cx-input w-full" placeholder="可选">
          </div>
          <div class="flex gap-3 justify-end pt-2">
            <button type="button" onclick="closeModal()" class="cx-btn cx-btn-secondary">取消</button>
            <button type="submit" class="cx-btn cx-btn-primary">确认出库</button>
          </div>
        </form>
      </div>
    `);
  }
  window.openOutboundForm = openOutboundForm;

  window.submitOutbound = function (e, invId) {
    e.preventDefault();
    const type = e.target.type.value;
    const qty = parseFloat(e.target.quantity.value);
    const note = e.target.note.value;
    let inv = getInventory();
    const item = inv.find(i => i.id === invId);
    if (!item) return;
    if (qty > item.quantity) { toast('出库数量超过库存'); return; }
    item.quantity -= qty;
    addInventoryLog(invId, type, -qty, note, todayStr());
    if (item.quantity <= 0) {
      inv = inv.filter(i => i.id !== invId);
    }
    saveInventory(inv);
    closeModal();
    toast('出库成功');
    render();
  };

  window.deleteInventory = function (id) {
    const inv = getInventory().find(i => i.id === id);
    if (!inv) return;
    const diet = getDiet();
    let linkedCount = 0;
    diet.forEach(m => { linkedCount += m.items.filter(di => di.productId === inv.productId).length; });
    confirmDialog(
      '删除库存项',
      `确定删除「${inv.productName}」吗？\n\n关联的 ${linkedCount} 条饮食记录不会被删除，但会失去库存关联。\n\n将移至回收站。`,
      () => {
        const recycle = getRecycle();
        recycle.push({ id: uid(), type: 'inventory', data: JSON.parse(JSON.stringify(inv)), deletedAt: new Date().toISOString() });
        saveRecycle(recycle);
        saveInventory(getInventory().filter(i => i.id !== id));
        closeModal();
        toast('已移至回收站');
        render();
      },
      { danger: true, confirmText: '删除' }
    );
  };

  // ---------- DIET ----------
  let dietSelectedDate = todayStr();

  function renderDiet() {
    const params = getQueryParams();
    if (params.date) dietSelectedDate = params.date;
    const cfg = getConfig();
    const diet = getDiet();
    const unassignedPool = getUnassigned();
    const dayDiet = diet.filter(d => d.date === dietSelectedDate);

    const totals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
    dayDiet.forEach(m => {
      m.items.forEach(it => {
        totals.calories += it.calories || 0;
        totals.protein += it.protein || 0;
        totals.carbs += it.carbs || 0;
        totals.fat += it.fat || 0;
      });
    });

    const displayCal = (kcal) => cfg.energyUnit === 'kJ' ? Math.round(kcal * KCAL_TO_KJ) : Math.round(kcal);

    const base = new Date(dietSelectedDate);
    const start = addDays(base, -6);
    const days = [];
    for (let i = 0; i < 14; i++) days.push(addDays(start, i));

    return `
    <div>
      <div class="cx-card p-4 mb-5">
        <div class="flex items-center justify-between mb-3">
          <button onclick="changeDietDate(-7)" class="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center text-muted">
            <i data-lucide="chevron-left" class="w-5 h-5"></i>
          </button>
          <div class="flex items-center gap-2">
            <h3 class="font-semibold text-foreground">${formatCNDateFull(dietSelectedDate)}</h3>
            <button onclick="toggleEnergyUnit()" class="cx-btn cx-btn-sm cx-btn-secondary" title="切换热量单位" style="padding:2px 8px;font-size:11px">
              ${cfg.energyUnit} <i data-lucide="arrow-left-right" class="w-3 h-3 ml-0.5 inline"></i>
            </button>
          </div>
          <button onclick="changeDietDate(7)" class="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center text-muted">
            <i data-lucide="chevron-right" class="w-5 h-5"></i>
          </button>
        </div>
        <div class="grid grid-cols-7 gap-1">
          ${days.map(d => {
            const ds = dateStr(d);
            const selected = ds === dietSelectedDate;
            const isToday = ds === todayStr();
            const hasMeals = diet.some(m => m.date === ds);
            const wd = ['日','一','二','三','四','五','六'][d.getDay()];
            return `<button onclick="setDietDate('${ds}')" class="flex flex-col items-center py-2 rounded-xl transition-colors ${selected ? 'bg-primary text-primary-foreground' : isToday ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-muted-foreground'}">
              <span class="text-[10px] ${selected ? 'text-primary-foreground/70' : 'text-muted'}">${wd}</span>
              <span class="text-sm font-medium mt-0.5">${d.getDate()}</span>
              ${hasMeals ? `<span class="w-1 h-1 rounded-full ${selected ? 'bg-primary-foreground' : 'bg-primary'} mt-0.5"></span>` : ''}
            </button>`;
          }).join('')}
        </div>
      </div>

      <div class="cx-card p-5 mb-5">
        <div class="grid grid-cols-4 gap-3 text-center">
          <div>
            <p class="text-2xl font-bold text-primary">${displayCal(totals.calories)}</p>
            <p class="text-xs text-muted mt-0.5">热量 (${cfg.energyUnit})</p>
          </div>
          <div>
            <p class="text-xl font-semibold text-foreground">${totals.protein.toFixed(1)}g</p>
            <p class="text-xs text-muted mt-0.5">蛋白质</p>
          </div>
          <div>
            <p class="text-xl font-semibold text-foreground">${totals.carbs.toFixed(1)}g</p>
            <p class="text-xs text-muted mt-0.5">碳水</p>
          </div>
          <div>
            <p class="text-xl font-semibold text-foreground">${totals.fat.toFixed(1)}g</p>
            <p class="text-xs text-muted mt-0.5">脂肪</p>
          </div>
        </div>
      </div>

      <div class="space-y-4">
        ${['breakfast','lunch','dinner','snack'].map(meal => {
          const mealEntry = dayDiet.find(d => d.meal === meal);
          const mealCals = mealEntry ? displayCal(mealEntry.totalCalories || 0) : 0;
          const items = mealEntry ? mealEntry.items : [];
          const color = MEAL_COLORS[meal];
          return `
          <div class="cx-card p-4">
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center gap-2">
                <div class="w-9 h-9 rounded-xl bg-${color}-100 text-${color}-600 flex items-center justify-center">
                  <i data-lucide="${MEAL_ICONS[meal]}" class="w-5 h-5"></i>
                </div>
                <div>
                  <h4 class="font-medium text-foreground">${MEAL_NAMES[meal]}</h4>
                  <p class="text-xs text-muted">${mealCals} ${cfg.energyUnit} · ${items.length}项</p>
                </div>
              </div>
              <button onclick="openAddDietForm('${meal}')" class="cx-btn cx-btn-sm cx-btn-secondary">
                <i data-lucide="plus" class="w-3.5 h-3.5"></i> 添加
              </button>
            </div>
            <div class="space-y-2">
              ${items.length === 0 ? '<p class="text-sm text-muted text-center py-4">暂无记录，点击添加</p>' :
                items.map(it => `
                  <div class="flex items-center justify-between p-2.5 rounded-xl bg-white border border-border group">
                    <div class="flex items-center gap-2 min-w-0 flex-1">
                      <div class="w-8 h-8 rounded-lg bg-${color}-100/50 flex items-center justify-center flex-shrink-0">
                        <i data-lucide="${it.source==='manual'?'pencil':'package'}" class="w-4 h-4 text-${color}-600"></i>
                      </div>
                      <div class="min-w-0 flex-1">
                        <p class="text-sm text-foreground truncate">${esc(it.name)}</p>
                        <p class="text-xs text-muted">${it.quantity}${esc(it.unit||'')}${it.source==='inventory'?' · 库存':''}${it.source==='order'?' · 外食':''}${it.source==='manual'?' · 手动':''}</p>
                      </div>
                    </div>
                    <div class="flex items-center gap-1 flex-shrink-0 ml-2">
                      <span class="text-sm font-medium text-foreground mr-1">${displayCal(it.calories||0)}</span>
                      <button onclick="editDietItem('${mealEntry.id}','${it.id}','${meal}')" class="w-7 h-7 rounded-lg hover:bg-muted text-muted-foreground/60 hover:text-foreground flex items-center justify-center transition-colors" title="编辑">
                        <i data-lucide="edit-2" class="w-3.5 h-3.5"></i>
                      </button>
                      <button onclick="deleteDietItem('${mealEntry.id}','${it.id}')" class="w-7 h-7 rounded-lg hover:bg-error/20 text-muted-foreground/60 hover:text-error-text flex items-center justify-center transition-colors" title="删除">
                        <i data-lucide="x" class="w-4 h-4"></i>
                      </button>
                    </div>
                  </div>
                `).join('')}
            </div>
          </div>`;
        }).join('')}
      </div>

      ${unassignedPool.length > 0 ? `
      <div class="cx-card p-4 mt-5 border-l-4 border-blue-400">
        <div class="flex items-center gap-2 mb-2">
          <i data-lucide="coffee" class="w-4 h-4 text-info-text"></i>
          <h4 class="font-medium text-foreground text-sm">待分配餐次的外食 (${unassignedPool.length})</h4>
        </div>
        <div class="space-y-2" id="unassigned-list">
          ${renderUnassignedGroups(unassignedPool)}
        </div>
      </div>` : ''}
    </div>
    `;
  }

  function renderUnassignedGroups(pool) {
    const groups = {};
    pool.forEach(u => {
      const d = u.orderDate || '未知日期';
      if (!groups[d]) groups[d] = [];
      groups[d].push(u);
    });
    const dates = Object.keys(groups).sort((a,b) => b.localeCompare(a));
    return dates.map(d => `
      <div class="mb-2">
        <p class="text-xs text-muted font-medium mb-1">${formatCNDateFull(d)}</p>
        ${groups[d].map(u => `
          <div class="flex items-center gap-2 p-2 bg-info/10 rounded-lg mb-1" data-unassigned-id="${u.id}">
            <div class="flex-1 min-w-0">
              <span class="text-sm">${esc(u.productName)}</span>
              ${u.brand ? `<span class="text-xs text-muted ml-1">(${esc(u.brand)})</span>` : ''}
              <span class="text-xs text-muted ml-1">×${u.quantity}${esc(u.unit)}</span>
            </div>
            <input type="date" value="${d}" class="cx-input cx-input-sm w-32" data-ua-date="${u.id}">
            <select class="cx-input cx-input-sm w-24" data-ua-meal="${u.id}">
              <option value="">餐次</option>
              ${Object.entries(MEAL_NAMES).map(([k,v]) => `<option value="${k}">${v}</option>`).join('')}
            </select>
            <button onclick="assignUnassignedFood('${u.id}')" class="cx-btn cx-btn-sm cx-btn-primary">分配</button>
            <button onclick="deleteUnassignedFood('${u.id}')" class="w-7 h-7 rounded-lg hover:bg-error/20 text-muted hover:text-error-text flex items-center justify-center">
              <i data-lucide="x" class="w-4 h-4"></i>
            </button>
          </div>
        `).join('')}
      </div>
    `).join('');
  }

  window.toggleEnergyUnit = function () {
    const cfg = getConfig();
    cfg.energyUnit = cfg.energyUnit === 'kcal' ? 'kJ' : 'kcal';
    setConfig(cfg);
    render();
  };

  window.assignUnassignedFood = function (uaId) {
    const pool = getUnassigned();
    const item = pool.find(u => u.id === uaId);
    if (!item) return;

    const dateInput = document.querySelector(`input[data-ua-date="${uaId}"]`);
    const mealSelect = document.querySelector(`select[data-ua-meal="${uaId}"]`);
    const targetDate = dateInput ? dateInput.value : item.orderDate;
    const targetMeal = mealSelect ? mealSelect.value : '';

    if (!targetDate) { toast('请选择日期'); return; }
    if (!targetMeal) { toast('请选择餐次'); return; }

    let diet = getDiet();
    let mealEntry = diet.find(m => m.date === targetDate && m.meal === targetMeal);
    if (!mealEntry) {
      mealEntry = { id: uid(), date: targetDate, meal: targetMeal, items: [], totalCalories: 0 };
      diet.push(mealEntry);
    }
    mealEntry.items.push({
      id: uid(), source: 'order', productId: item.productId || null,
      name: item.productName, brand: item.brand || '',
      quantity: item.quantity, unit: item.unit,
      calories: item.calories || 0, protein: item.protein || 0, carbs: item.carbs || 0, fat: item.fat || 0,
      _unassignedId: uaId
    });
    mealEntry.totalCalories = mealEntry.items.reduce((s,i) => s+(i.calories||0),0);
    saveDiet(diet);
    saveUnassigned(pool.filter(u => u.id !== uaId));

    toast('已分配到' + MEAL_NAMES[targetMeal]);
    render();
  };

  window.deleteUnassignedFood = function (uaId) {
    const pool = getUnassigned();
    saveUnassigned(pool.filter(u => u.id !== uaId));
    toast('已移除');
    render();
  };

  window.changeDietDate = function (offset) {
    const d = addDays(dietSelectedDate, offset);
    dietSelectedDate = dateStr(d);
    window.location.hash = '#/diet?date=' + dietSelectedDate;
  };
  window.setDietDate = function (ds) {
    dietSelectedDate = ds;
    window.location.hash = '#/diet?date=' + ds;
  };
  window.openDietForm = function () { openAddDietForm('breakfast'); };

  // Diet add/edit form
  function openAddDietForm(meal, editMealId, editItemId) {
    const isEdit = !!(editMealId && editItemId);
    let editItem = null;
    if (isEdit) {
      const diet = getDiet();
      const editMealEntry = diet.find(m => m.id === editMealId);
      if (editMealEntry) editItem = editMealEntry.items.find(i => i.id === editItemId);
    }

    const inventory = getInventory().filter(i => i.quantity > 0);
    const unassignedPool = getUnassigned();

    let defaultTab = 'inventory';
    let manualMode = 'serving';

    if (isEdit && editItem) {
      if (editItem.source === 'manual') defaultTab = 'manual';
      else defaultTab = 'inventory';
    }

    window._dietFormState = {
      meal, isEdit, editMealId, editItemId, editItem,
      manualMode, defaultTab
    };

    function formHtml() {
      const s = window._dietFormState;
      const cfg = getConfig();
      const d = s.editItem || { name: '', calories: 0, protein: 0, carbs: 0, fat: 0, quantity: 1, unit: '份' };

      return `
      <div class="p-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold">${isEdit ? '编辑' : '添加'}${MEAL_NAMES[meal]}${isEdit ? ' - ' + esc(d.name) : ''}</h3>
          <button onclick="closeModal()" class="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center text-muted">
            <i data-lucide="x" class="w-5 h-5"></i>
          </button>
        </div>
        <div class="flex gap-1 mb-4 border-b border-border">
          <button onclick="switchDietTab('inventory')" id="dt-inventory" class="px-3 py-2 text-sm font-medium border-b-2 ${s.defaultTab==='inventory'?'border-primary text-primary':'border-transparent text-muted hover:text-foreground'}">从库存</button>
          <button onclick="switchDietTab('manual')" id="dt-manual" class="px-3 py-2 text-sm font-medium border-b-2 ${s.defaultTab==='manual'?'border-primary text-primary':'border-transparent text-muted hover:text-foreground'}">手动录入</button>
          <button onclick="switchDietTab('order')" id="dt-order" class="px-3 py-2 text-sm font-medium border-b-2 ${s.defaultTab==='order'?'border-primary text-primary':'border-transparent text-muted hover:text-foreground'}">外食关联${unassignedPool.length>0?` (${unassignedPool.length})`:''}</button>
        </div>
        <div id="diet-tab-content">
          <div id="dtab-inventory" class="${s.defaultTab==='inventory'?'':'hidden'}">
            <input type="text" id="di-search" placeholder="搜索库存..." class="cx-input w-full mb-3" oninput="filterInvDiet(this.value)">
            <div class="space-y-2 max-h-72 overflow-y-auto" id="inv-diet-list">
              ${inventory.length === 0 ? '<p class="text-sm text-muted text-center py-4">暂无库存，请先入库</p>' :
                inventory.map(i => {
                  const p = i.productId ? findProductById(i.productId) : null;
                  const isMassUnit = ['g','kg','ml','L'].includes(i.unit);
                  return `
                  <div class="p-3 bg-muted/50 rounded-xl diet-inv-item" data-name="${esc(i.productName).toLowerCase()}">
                    <div class="flex items-center justify-between mb-1">
                      <div>
                        <p class="text-sm font-medium text-foreground">${esc(i.productName)}</p>
                        <p class="text-xs text-muted">库存 ${i.quantity}${esc(i.unit)}</p>
                      </div>
                    </div>
                    ${p && p.calories ? `<div class="text-[11px] text-muted mb-2">营养(每100g): ${p.calories}kcal · 蛋白${p.protein||0}g · 碳${p.carbs||0}g · 脂${p.fat||0}g</div>` : '<div class="mb-2"></div>'}
                    <div class="flex gap-2 items-center">
                      <input type="number" step="0.01" min="0.01" placeholder="${isMassUnit?'食用克数':'数量'}" class="cx-input cx-input-sm flex-1 di-qty" data-inv-id="${i.id}" data-name="${esc(i.productName)}" data-unit="${esc(i.unit)}" data-product-id="${i.productId||''}" data-calories="${p?p.calories||0:0}" data-protein="${p?p.protein||0:0}" data-carbs="${p?p.carbs||0:0}" data-fat="${p?p.fat||0:0}" data-is-mass="${isMassUnit?'1':'0'}" oninput="calcInvDiet(this)">
                      <span class="text-xs text-muted">${esc(i.unit)}</span>
                      <button onclick="addDietFromInventory('${meal}', this.closest('.diet-inv-item'), ${isEdit}, '${editMealId||''}', '${editItemId||''}')" class="cx-btn cx-btn-sm cx-btn-primary">${isEdit?'更新':'添加'}</button>
                    </div>
                    ${p && p.calories ? `<div class="di-calc-info text-[11px] text-primary mt-1"></div>` : ''}
                  </div>
                `}).join('')}
            </div>
          </div>
          <div id="dtab-manual" class="${s.defaultTab==='manual'?'':'hidden'}">
            <div class="space-y-3">
              <div class="flex gap-1 p-1 bg-muted rounded-lg">
                <button type="button" onclick="setDietManualMode('serving')" id="dm-mode-serving" class="flex-1 py-1.5 text-sm rounded-md transition-colors ${s.manualMode==='serving'?'bg-white shadow-sm font-medium text-foreground':'text-muted'}">每份</button>
                <button type="button" onclick="setDietManualMode('per100')" id="dm-mode-per100" class="flex-1 py-1.5 text-sm rounded-md transition-colors ${s.manualMode==='per100'?'bg-white shadow-sm font-medium text-foreground':'text-muted'}">每100g</button>
              </div>

              <div>
                <label class="text-xs text-muted block mb-1">食物名称</label>
                <input type="text" id="dm-name" class="cx-input w-full" placeholder="如：番茄炒蛋" value="${esc(d.name)}">
              </div>

              <div id="dm-per100-fields" class="${s.manualMode==='per100'?'':'hidden'}">
                <p class="text-xs text-muted mb-2">每100g营养值</p>
                <div class="grid grid-cols-4 gap-2 mb-2">
                  <div>
                    <label class="text-[11px] text-muted block mb-0.5">热量</label>
                    <input type="number" id="dm-pcal" step="1" min="0" class="cx-input cx-input-sm w-full" placeholder="0" oninput="calcManualPer100()">
                  </div>
                  <div>
                    <label class="text-[11px] text-muted block mb-0.5">蛋白</label>
                    <input type="number" id="dm-ppro" step="0.1" min="0" class="cx-input cx-input-sm w-full" placeholder="0" oninput="calcManualPer100()">
                  </div>
                  <div>
                    <label class="text-[11px] text-muted block mb-0.5">碳水</label>
                    <input type="number" id="dm-pcarb" step="0.1" min="0" class="cx-input cx-input-sm w-full" placeholder="0" oninput="calcManualPer100()">
                  </div>
                  <div>
                    <label class="text-[11px] text-muted block mb-0.5">脂肪</label>
                    <input type="number" id="dm-pfat" step="0.1" min="0" class="cx-input cx-input-sm w-full" placeholder="0" oninput="calcManualPer100()">
                  </div>
                </div>
                <div>
                  <label class="text-xs text-muted block mb-1">食用克数</label>
                  <input type="number" id="dm-grams" step="1" min="0" class="cx-input w-full" placeholder="100" value="100" oninput="calcManualPer100()">
                </div>
                <div class="mt-2 p-2 bg-muted rounded-lg">
                  <p class="text-xs text-muted mb-1">总计 (自动计算)</p>
                  <p class="text-sm" id="dm-per100-total">0 ${cfg.energyUnit} · 蛋白0g · 碳0g · 脂0g</p>
                </div>
              </div>

              <div id="dm-serving-fields" class="${s.manualMode==='serving'?'':'hidden'}">
                <div>
                  <label class="text-xs text-muted block mb-1">热量 (${cfg.energyUnit})</label>
                  <input type="number" id="dm-cal" step="1" min="0" class="cx-input w-full" placeholder="0" value="${d.calories||''}">
                </div>
                <div class="grid grid-cols-3 gap-2 mt-2">
                  <div>
                    <label class="text-xs text-muted block mb-1">蛋白质(g)</label>
                    <input type="number" id="dm-pro" step="0.1" min="0" class="cx-input w-full" placeholder="0" value="${d.protein||''}">
                  </div>
                  <div>
                    <label class="text-xs text-muted block mb-1">碳水(g)</label>
                    <input type="number" id="dm-carb" step="0.1" min="0" class="cx-input w-full" placeholder="0" value="${d.carbs||''}">
                  </div>
                  <div>
                    <label class="text-xs text-muted block mb-1">脂肪(g)</label>
                    <input type="number" id="dm-fat" step="0.1" min="0" class="cx-input w-full" placeholder="0" value="${d.fat||''}">
                  </div>
                </div>
              </div>

              <div>
                <label class="text-xs text-muted block mb-1">数量/份量</label>
                <div class="flex gap-2">
                  <input type="text" id="dm-qty" class="cx-input cx-input-sm flex-1" placeholder="1" value="${esc(String(d.quantity||1))}">
                  <input type="text" id="dm-unit" class="cx-input cx-input-sm w-20" placeholder="份" value="${esc(d.unit||'份')}">
                </div>
              </div>
              <button onclick="addManualDiet('${meal}', ${isEdit}, '${editMealId||''}', '${editItemId||''}')" class="cx-btn cx-btn-primary w-full">${isEdit?'更新':'添加到'}${MEAL_NAMES[meal]}</button>
            </div>
          </div>
          <div id="dtab-order" class="${s.defaultTab==='order'?'':'hidden'}">
            ${unassignedPool.length === 0 ? '<p class="text-sm text-muted text-center py-4">暂无待分配的外食记录</p>' :
              `<div class="space-y-2">
                ${renderUnassignedAssignList(unassignedPool, meal, isEdit, editMealId, editItemId)}
              </div>`}
          </div>
        </div>
      </div>
    `;
    }

    openModal(formHtml());
  }
  window.openAddDietForm = openAddDietForm;

  function renderUnassignedAssignList(pool, meal, isEdit, editMealId, editItemId) {
    const groups = {};
    pool.forEach(u => {
      const d = u.orderDate || '未知日期';
      if (!groups[d]) groups[d] = [];
      groups[d].push(u);
    });
    const dates = Object.keys(groups).sort((a,b) => b.localeCompare(a));
    return dates.map(d => `
      <div class="mb-2">
        <p class="text-xs text-muted font-medium mb-1">${formatCNDateFull(d)}</p>
        ${groups[d].map(u => `
          <div class="flex items-center justify-between p-2 bg-muted/50 rounded-xl mb-1">
            <div class="min-w-0 flex-1">
              <p class="text-sm font-medium truncate">${esc(u.productName)}</p>
              <p class="text-xs text-muted">×${u.quantity}${esc(u.unit)} · ${formatEnergy(u.calories||0)}</p>
            </div>
            <div class="flex items-center gap-1 flex-shrink-0">
              <input type="date" value="${dietSelectedDate}" class="cx-input cx-input-sm w-32" data-ua-date="${u.id}">
              <select class="cx-input cx-input-sm w-20" data-ua-meal="${u.id}">
                <option value="">餐次</option>
                ${Object.entries(MEAL_NAMES).map(([k,v]) => `<option value="${k}" ${k===meal?'selected':''}>${v}</option>`).join('')}
              </select>
              <button onclick="assignFromDietModal('${u.id}','${meal}',${isEdit},'${editMealId||''}','${editItemId||''}')" class="cx-btn cx-btn-sm cx-btn-primary">添加</button>
            </div>
          </div>
        `).join('')}
      </div>
    `).join('');
  }

  window.switchDietTab = function (tab) {
    const s = window._dietFormState;
    if (!s) return;
    s.defaultTab = tab;
    ['inventory','manual','order'].forEach(t => {
      const el = $('#dtab-' + t);
      const btn = $('#dt-' + t);
      if (el) el.classList.toggle('hidden', t !== tab);
      if (btn) {
        btn.classList.toggle('border-primary', t === tab);
        btn.classList.toggle('text-primary', t === tab);
        btn.classList.toggle('border-transparent', t !== tab);
        btn.classList.toggle('text-muted', t !== tab);
      }
    });
  };

  window.setDietManualMode = function (mode) {
    const s = window._dietFormState;
    if (!s) return;
    s.manualMode = mode;
    const servingFields = $('#dm-serving-fields');
    const per100Fields = $('#dm-per100-fields');
    const btnServing = $('#dm-mode-serving');
    const btnPer100 = $('#dm-mode-per100');
    if (servingFields) servingFields.classList.toggle('hidden', mode !== 'serving');
    if (per100Fields) per100Fields.classList.toggle('hidden', mode !== 'per100');
    if (btnServing) {
      btnServing.classList.toggle('bg-white', mode === 'serving');
      btnServing.classList.toggle('shadow-sm', mode === 'serving');
      btnServing.classList.toggle('font-medium', mode === 'serving');
      btnServing.classList.toggle('text-foreground', mode === 'serving');
      btnServing.classList.toggle('text-muted', mode !== 'serving');
    }
    if (btnPer100) {
      btnPer100.classList.toggle('bg-white', mode === 'per100');
      btnPer100.classList.toggle('shadow-sm', mode === 'per100');
      btnPer100.classList.toggle('font-medium', mode === 'per100');
      btnPer100.classList.toggle('text-foreground', mode === 'per100');
      btnPer100.classList.toggle('text-muted', mode !== 'per100');
    }
    if (mode === 'per100') calcManualPer100();
  };

  window.calcManualPer100 = function () {
    const pcal = parseFloat($('#dm-pcal')?.value) || 0;
    const ppro = parseFloat($('#dm-ppro')?.value) || 0;
    const pcarb = parseFloat($('#dm-pcarb')?.value) || 0;
    const pfat = parseFloat($('#dm-pfat')?.value) || 0;
    const grams = parseFloat($('#dm-grams')?.value) || 0;
    const factor = grams / 100;
    const totalCal = Math.round(pcal * factor);
    const totalPro = (ppro * factor).toFixed(1);
    const totalCarb = (pcarb * factor).toFixed(1);
    const totalFat = (pfat * factor).toFixed(1);
    const cfg = getConfig();
    const displayCal = cfg.energyUnit === 'kJ' ? Math.round(totalCal * KCAL_TO_KJ) : totalCal;
    const totalEl = $('#dm-per100-total');
    if (totalEl) totalEl.textContent = `${displayCal} ${cfg.energyUnit} · 蛋白${totalPro}g · 碳${totalCarb}g · 脂${totalFat}g`;
  };

  window.filterInvDiet = function (q) {
    q = q.toLowerCase();
    $$('.diet-inv-item').forEach(el => {
      const name = el.dataset.name || '';
      el.style.display = name.includes(q) ? '' : 'none';
    });
  };

  window.calcInvDiet = function (input) {
    const grams = parseFloat(input.value) || 0;
    const isMass = input.dataset.isMass === '1';
    const pcal = parseFloat(input.dataset.calories) || 0;
    const ppro = parseFloat(input.dataset.protein) || 0;
    const pcarb = parseFloat(input.dataset.carbs) || 0;
    const pfat = parseFloat(input.dataset.fat) || 0;
    const infoEl = input.closest('.diet-inv-item')?.querySelector('.di-calc-info');
    if (!infoEl) return;
    if (grams <= 0) { infoEl.textContent = ''; return; }
    let factor;
    if (isMass) {
      const unit = input.dataset.unit;
      const gramsEquiv = ['g','ml'].includes(unit) ? grams : convertToGrams(grams, unit);
      factor = gramsEquiv / 100;
    } else {
      factor = grams;
    }
    const cal = Math.round(pcal * factor);
    const pro = (ppro * factor).toFixed(1);
    const carb = (pcarb * factor).toFixed(1);
    const fat = (pfat * factor).toFixed(1);
    const cfg = getConfig();
    const displayCal = cfg.energyUnit === 'kJ' ? Math.round(cal * KCAL_TO_KJ) : cal;
    infoEl.textContent = `≈ ${displayCal} ${cfg.energyUnit} · 蛋白${pro}g · 碳${carb}g · 脂${fat}g`;
  };

  function _addDietItem(meal, targetDate, item, isEdit, editMealId, editItemId) {
    let diet = getDiet();

    if (isEdit && editMealId && editItemId) {
      const mealEntry = diet.find(m => m.id === editMealId);
      if (mealEntry) {
        const idx = mealEntry.items.findIndex(i => i.id === editItemId);
        if (idx >= 0) {
          item.id = editItemId;
          mealEntry.items[idx] = item;
          mealEntry.totalCalories = mealEntry.items.reduce((s,i) => s+(i.calories||0),0);
          saveDiet(diet);
          closeModal();
          toast('已更新');
          render();
          return;
        }
      }
    }

    let mealEntry = diet.find(m => m.date === targetDate && m.meal === meal);
    if (!mealEntry) {
      mealEntry = { id: uid(), date: targetDate, meal: meal, items: [], totalCalories: 0 };
      diet.push(mealEntry);
    }
    mealEntry.items.push(item);
    mealEntry.totalCalories = mealEntry.items.reduce((s,i) => s+(i.calories||0),0);
    saveDiet(diet);
  }

  window.addManualDiet = function (meal, isEdit, editMealId, editItemId) {
    const s = window._dietFormState;
    const name = $('#dm-name').value.trim();
    if (!name) { toast('请输入食物名称'); return; }
    const qty = $('#dm-qty').value.trim() || '1';
    const unit = $('#dm-unit').value.trim() || '份';

    let cal, pro, carb, fat;
    if (s && s.manualMode === 'per100') {
      const pcal = parseFloat($('#dm-pcal')?.value) || 0;
      const ppro = parseFloat($('#dm-ppro')?.value) || 0;
      const pcarb = parseFloat($('#dm-pcarb')?.value) || 0;
      const pfat = parseFloat($('#dm-pfat')?.value) || 0;
      const grams = parseFloat($('#dm-grams')?.value) || 0;
      const factor = grams / 100;
      cal = pcal * factor;
      pro = ppro * factor;
      carb = pcarb * factor;
      fat = pfat * factor;
    } else {
      cal = parseFloat($('#dm-cal')?.value) || 0;
      pro = parseFloat($('#dm-pro')?.value) || 0;
      carb = parseFloat($('#dm-carb')?.value) || 0;
      fat = parseFloat($('#dm-fat')?.value) || 0;
    }

    const item = {
      id: uid(), source: 'manual', productId: null,
      name, brand: '',
      quantity: qty, unit,
      calories: cal, protein: pro, carbs: carb, fat: fat
    };
    _addDietItem(meal, dietSelectedDate, item, isEdit, editMealId, editItemId);
    closeModal();
    toast(isEdit ? '已更新' : '已添加到' + MEAL_NAMES[meal]);
    render();
  };

  window.addDietFromInventory = function (meal, rowEl, isEdit, editMealId, editItemId) {
    const qtyInput = rowEl.querySelector('.di-qty');
    const grams = parseFloat(qtyInput?.value) || 0;
    if (grams <= 0) { toast('请输入食用量'); return; }

    const invId = qtyInput.dataset.invId;
    const name = qtyInput.dataset.name;
    const unit = qtyInput.dataset.unit;
    const productId = qtyInput.dataset.productId || null;
    const pcal = parseFloat(qtyInput.dataset.calories) || 0;
    const ppro = parseFloat(qtyInput.dataset.protein) || 0;
    const pcarb = parseFloat(qtyInput.dataset.carbs) || 0;
    const pfat = parseFloat(qtyInput.dataset.fat) || 0;

    const isMassUnit = ['g','kg','ml','L'].includes(unit);
    const gramsEquiv = isMassUnit ? convertToGrams(grams, unit) : grams;
    const factor = isMassUnit ? (gramsEquiv / 100) : grams;

    const cal = pcal * factor;
    const pro = ppro * factor;
    const carb = pcarb * factor;
    const fat = pfat * factor;

    let inv = getInventory();
    const invItem = inv.find(i => i.id === invId);
    if (invItem && !isEdit) {
      invItem.quantity -= grams;
      addInventoryLog(invId, 'out', -grams, '饮食消耗', todayStr());
      if (invItem.quantity <= 0) {
        inv = inv.filter(i => i.id !== invId);
      }
      saveInventory(inv);
    }

    const item = {
      id: uid(), source: 'inventory', productId,
      name, brand: invItem ? (invItem.brand || '') : '',
      quantity: grams, unit,
      calories: cal, protein: pro, carbs: carb, fat: fat,
      _inventoryId: invId
    };
    _addDietItem(meal, dietSelectedDate, item, isEdit, editMealId, editItemId);
    closeModal();
    toast(isEdit ? '已更新' : '已添加到' + MEAL_NAMES[meal]);
    render();
  };

  window.assignFromDietModal = function (uaId, meal, isEdit, editMealId, editItemId) {
    const pool = getUnassigned();
    const item = pool.find(u => u.id === uaId);
    if (!item) return;

    const dateInput = document.querySelector(`input[data-ua-date="${uaId}"]`);
    const mealSelect = document.querySelector(`select[data-ua-meal="${uaId}"]`);
    const targetDate = dateInput ? dateInput.value : item.orderDate;
    const targetMeal = mealSelect ? mealSelect.value : meal;

    if (!targetDate) { toast('请选择日期'); return; }
    if (!targetMeal) { toast('请选择餐次'); return; }

    const dietItem = {
      id: uid(), source: 'order', productId: item.productId || null,
      name: item.productName, brand: item.brand || '',
      quantity: item.quantity, unit: item.unit,
      calories: item.calories || 0, protein: item.protein || 0, carbs: item.carbs || 0, fat: item.fat || 0,
      _unassignedId: uaId
    };

    let diet = getDiet();
    if (isEdit && editMealId && editItemId) {
      const mealEntry = diet.find(m => m.id === editMealId);
      if (mealEntry) {
        const idx = mealEntry.items.findIndex(i => i.id === editItemId);
        if (idx >= 0) {
          dietItem.id = editItemId;
          mealEntry.items[idx] = dietItem;
          mealEntry.totalCalories = mealEntry.items.reduce((s,i) => s+(i.calories||0),0);
          saveDiet(diet);
          saveUnassigned(pool.filter(u => u.id !== uaId));
          closeModal();
          toast('已更新');
          render();
          return;
        }
      }
    }

    let mealEntry = diet.find(m => m.date === targetDate && m.meal === targetMeal);
    if (!mealEntry) {
      mealEntry = { id: uid(), date: targetDate, meal: targetMeal, items: [], totalCalories: 0 };
      diet.push(mealEntry);
    }
    mealEntry.items.push(dietItem);
    mealEntry.totalCalories = mealEntry.items.reduce((s,i) => s+(i.calories||0),0);
    saveDiet(diet);
    saveUnassigned(pool.filter(u => u.id !== uaId));

    closeModal();
    toast('已添加到' + MEAL_NAMES[targetMeal]);
    render();
  };

  window.deleteDietItem = function (mealId, itemId) {
    let diet = getDiet();
    const mealEntry = diet.find(m => m.id === mealId);
    if (!mealEntry) return;
    mealEntry.items = mealEntry.items.filter(i => i.id !== itemId);
    mealEntry.totalCalories = mealEntry.items.reduce((s,i) => s+(i.calories||0),0);
    diet = diet.filter(m => m.items.length > 0);
    saveDiet(diet);
    toast('已删除');
    render();
  };

  window.editDietItem = function (mealId, itemId, meal) {
    openAddDietForm(meal, mealId, itemId);
  };

  // ---------- PRODUCTS ----------
  function renderProducts() {
    const products = getProducts();
    const inventory = getInventory();
    return `
    <div>
      <div class="flex items-center justify-between mb-5">
        <div>
          <h3 class="text-lg font-semibold text-foreground">商品库</h3>
          <p class="text-sm text-muted">共 ${products.length} 种商品</p>
        </div>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        ${products.length === 0 ? '<div class="cx-card p-8 text-center text-muted col-span-full">暂无商品，记一笔采购会自动创建</div>' :
          products.map(p => {
            const stock = inventory.filter(i => i.productId === p.id).reduce((s,i) => s+i.quantity, 0);
            return `
            <div class="cx-card p-4">
              <div class="flex items-start justify-between mb-2">
                <div class="min-w-0 flex-1">
                  <h4 class="font-medium text-foreground truncate">${esc(p.name)}</h4>
                  <p class="text-xs text-muted">${esc(p.brand||'无品牌')} · ${esc(p.category||'其他')}</p>
                </div>
              </div>
              <div class="grid grid-cols-2 gap-2 text-xs mb-2">
                <div><span class="text-muted">均价</span> <span class="font-medium">${formatMoney(p.defaultPrice||0)}/${esc(p.unit)}</span></div>
                <div><span class="text-muted">库存</span> <span class="font-medium">${stock}${esc(p.unit)}</span></div>
              </div>
              ${p.calories ? `<div class="text-[11px] text-muted">${p.calories}kcal/100g · P${p.protein||0}g C${p.carbs||0}g F${p.fat||0}g</div>` : '<div class="text-[11px] text-muted">暂无营养信息</div>'}
            </div>`;
          }).join('')}
      </div>
    </div>
    `;
  }

  // ---------- PROFILE ----------
  function renderProfile() {
    const cfg = getConfig();
    const body = getBody();
    const latestBody = [...body].sort((a,b) => b.date.localeCompare(a.date))[0];
    return `
    <div class="space-y-5">
      <div class="cx-card p-5">
        <h3 class="text-base font-semibold mb-4">设置</h3>
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium">热量单位</p>
              <p class="text-xs text-muted">当前：${cfg.energyUnit}</p>
            </div>
            <button onclick="toggleEnergyUnit();closeModal()" class="cx-btn cx-btn-sm cx-btn-secondary">切换为 ${cfg.energyUnit==='kcal'?'kJ':'kcal'}</button>
          </div>
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium">体重单位</p>
              <p class="text-xs text-muted">当前：${cfg.weightUnit}</p>
            </div>
            <button onclick="toggleWeightUnit()" class="cx-btn cx-btn-sm cx-btn-secondary">切换为 ${cfg.weightUnit==='kg'?'lb':'kg'}</button>
          </div>
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium">默认货币</p>
              <p class="text-xs text-muted">当前：${cfg.defaultCurrency}</p>
            </div>
            <select onchange="setCurrency(this.value)" class="cx-input cx-input-sm w-28">
              <option value="HKD" ${cfg.defaultCurrency==='HKD'?'selected':''}>HKD</option>
              <option value="CNY" ${cfg.defaultCurrency==='CNY'?'selected':''}>CNY</option>
            </select>
          </div>
        </div>
      </div>

      <div class="cx-card p-5">
        <h3 class="text-base font-semibold mb-4">体重记录</h3>
        ${latestBody ? `
        <div class="flex items-center gap-4 mb-4">
          <div class="w-14 h-14 rounded-2xl bg-taro-100 text-taro-600 flex items-center justify-center">
            <i data-lucide="scale" class="w-7 h-7"></i>
          </div>
          <div>
            <p class="text-2xl font-bold">${formatWeight(latestBody.weight)}</p>
            <p class="text-xs text-muted">${formatCNDateFull(latestBody.date)}${latestBody.bodyFat!=null?' · 体脂 '+latestBody.bodyFat+'%':''}</p>
          </div>
        </div>` : '<p class="text-sm text-muted mb-4">暂无体重记录</p>'}
        <form onsubmit="addWeightRecord(event)" class="flex gap-2">
          <input type="number" step="0.1" name="weight" placeholder="体重(kg)" class="cx-input flex-1" required>
          <input type="number" step="0.1" name="bodyFat" placeholder="体脂率%" class="cx-input w-28">
          <button type="submit" class="cx-btn cx-btn-primary">记录</button>
        </form>
      </div>

      <div class="cx-card p-5">
        <h3 class="text-base font-semibold mb-4">云端同步</h3>
        ${isCloudMode() ? `
          <div class="space-y-3">
            <div class="flex items-center gap-3 p-3 rounded-xl bg-mint-100/50">
              <i data-lucide="cloud" class="w-5 h-5 text-mint-600"></i>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-foreground">已连接云端</p>
                <p class="text-xs text-muted truncate">${cloudUserEmail}</p>
              </div>
              <span class="text-xs text-mint-600 font-medium">${cloudSyncState==='synced'?'已同步':cloudSyncState==='syncing'?'同步中':'离线'}</span>
            </div>
            <button onclick="manualSync()" class="cx-btn cx-btn-secondary w-full">
              <i data-lucide="refresh-cw" class="w-4 h-4 mr-1"></i> 立即同步
            </button>
            <button onclick="doLogout()" class="cx-btn cx-btn-ghost w-full text-sm text-muted">退出登录</button>
          </div>
        ` : window.CloudSync && window.CloudSync.isConfigured() ? `
          <div class="space-y-3">
            <div class="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
              <i data-lucide="cloud-off" class="w-5 h-5 text-muted"></i>
              <div class="flex-1">
                <p class="text-sm font-medium text-foreground">云端已配置，未登录</p>
                <p class="text-xs text-muted">登录后开启跨设备同步</p>
              </div>
            </div>
            <button onclick="render();window.location.hash='/home'" class="cx-btn cx-btn-primary w-full">前往登录</button>
            <button onclick="showCloudSetup()" class="cx-btn cx-btn-secondary w-full">修改配置</button>
          </div>
        ` : `
          <div class="space-y-3">
            <div class="flex items-center gap-3 p-3 rounded-xl bg-cream-100/50">
              <i data-lucide="cloud" class="w-5 h-5 text-cream-600"></i>
              <div class="flex-1">
                <p class="text-sm font-medium text-foreground">本地模式</p>
                <p class="text-xs text-muted">数据仅保存在此设备</p>
              </div>
            </div>
            <button onclick="showCloudSetup()" class="cx-btn cx-btn-primary w-full">
              <i data-lucide="cloud" class="w-4 h-4 mr-1"></i> 配置云端同步
            </button>
            <p class="text-xs text-muted text-center">免费使用 Supabase 实现电脑+手机数据互通</p>
          </div>
        `}
      </div>

      <div class="cx-card p-5">
        <h3 class="text-base font-semibold mb-4">数据管理</h3>
        <div class="space-y-2">
          <button onclick="exportData()" class="cx-btn cx-btn-secondary w-full">
            <i data-lucide="download" class="w-4 h-4 mr-1"></i> 导出数据
          </button>
          <button onclick="clearAllData()" class="cx-btn cx-btn-destructive w-full">
            <i data-lucide="trash-2" class="w-4 h-4 mr-1"></i> 清除所有数据
          </button>
        </div>
      </div>
    </div>
    `;
  }

  window.toggleWeightUnit = function () {
    const cfg = getConfig();
    cfg.weightUnit = cfg.weightUnit === 'kg' ? 'lb' : 'kg';
    setConfig(cfg);
    render();
  };
  window.setCurrency = function (cur) {
    const cfg = getConfig();
    cfg.defaultCurrency = cur;
    setConfig(cfg);
    render();
  };
  window.addWeightRecord = function (e) {
    e.preventDefault();
    const w = parseFloat(e.target.weight.value);
    const bf = parseFloat(e.target.bodyFat.value) || null;
    if (!w || w <= 0) { toast('请输入有效体重'); return; }
    const list = getBody();
    list.push({ id: uid(), date: todayStr(), weight: w, bodyFat: bf });
    saveBody(list);
    toast('已记录');
    render();
  };
  window.exportData = function () {
    const data = {
      products: getProducts(), orders: getOrders(), inventory: getInventory(),
      inventoryLogs: getInventoryLogs(), diet: getDiet(), body: getBody(),
      config: getConfig(), unassigned: getUnassigned()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'cangxu-shishi-' + todayStr() + '.json';
    a.click(); URL.revokeObjectURL(url);
    toast('已导出');
  };
  window.clearAllData = function () {
    confirmDialog('清除所有数据', '此操作将删除所有记账、库存、饮食、体重数据，且不可恢复。确定吗？', () => {
      Object.values(KEYS).forEach(k => localStorage.removeItem(k));
      toast('已清除，正在重新初始化...');
      setTimeout(() => { location.reload(); }, 800);
    }, { danger: true, confirmText: '清除' });
  };

  // ---------- RECYCLE ----------
  function renderRecycle() {
    const recycle = getRecycle();
    return `
    <div>
      <h3 class="text-lg font-semibold mb-4">回收站</h3>
      ${recycle.length === 0 ? '<div class="cx-card p-8 text-center text-muted">回收站为空</div>' :
        `<div class="space-y-3">
          ${recycle.map(r => `
            <div class="cx-card p-4 flex items-center justify-between">
              <div>
                <p class="font-medium">${r.type === 'order' ? '采购记录' : r.type === 'inventory' ? '库存项' : r.type}</p>
                <p class="text-xs text-muted">删除于 ${formatCNDateFull(r.deletedAt?.slice(0,10) || todayStr())}</p>
              </div>
              <div class="flex gap-2">
                <button onclick="restoreRecycle('${r.id}')" class="cx-btn cx-btn-sm cx-btn-secondary">恢复</button>
                <button onclick="purgeRecycle('${r.id}')" class="cx-btn cx-btn-sm cx-btn-destructive">彻底删除</button>
              </div>
            </div>
          `).join('')}
          <button onclick="emptyRecycle()" class="cx-btn cx-btn-destructive w-full mt-4">清空回收站</button>
        </div>`}
    </div>
    `;
  }
  window.restoreRecycle = function (id) {
    const recycle = getRecycle();
    const item = recycle.find(r => r.id === id);
    if (!item) return;
    if (item.type === 'order') {
      const orders = getOrders();
      orders.push(item.data);
      saveOrders(orders);
    } else if (item.type === 'inventory') {
      const inv = getInventory();
      inv.push(item.data);
      saveInventory(inv);
    }
    saveRecycle(recycle.filter(r => r.id !== id));
    toast('已恢复');
    render();
  };
  window.purgeRecycle = function (id) {
    saveRecycle(getRecycle().filter(r => r.id !== id));
    toast('已彻底删除');
    render();
  };
  window.emptyRecycle = function () {
    confirmDialog('清空回收站', '确定清空所有回收站内容？此操作不可恢复。', () => {
      saveRecycle([]);
      toast('已清空');
      render();
    }, { danger: true, confirmText: '清空' });
  };

  // ---------- CLOUD / AUTH ----------
  function renderLoginScreen() {
    return `
    <div class="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/5 to-mint-100/30">
      <div class="w-full max-w-sm">
        <div class="text-center mb-8">
          <div class="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center text-white mx-auto mb-4">
            <i data-lucide="warehouse" class="w-8 h-8"></i>
          </div>
          <h1 class="text-2xl font-bold text-foreground">仓序食时</h1>
          <p class="text-muted text-sm mt-1">登录后即可跨设备同步数据</p>
        </div>
        <div class="cx-card p-6">
          <div id="login-error" class="hidden mb-3 p-3 rounded-lg bg-error/20 text-error-text text-sm"></div>
          <div class="space-y-3">
            <div>
              <label class="text-xs text-muted block mb-1">邮箱</label>
              <input type="email" id="login-email" class="cx-input w-full" placeholder="your@email.com">
            </div>
            <div>
              <label class="text-xs text-muted block mb-1">密码</label>
              <input type="password" id="login-password" class="cx-input w-full" placeholder="至少6位">
            </div>
            <button onclick="doLogin()" class="cx-btn cx-btn-primary w-full mt-2">登录</button>
            <button onclick="doSignup()" class="cx-btn cx-btn-secondary w-full">注册新账号</button>
          </div>
          <div class="mt-4 pt-4 border-t border-border">
            <button onclick="useLocalMode()" class="w-full text-sm text-muted hover:text-foreground py-2">
              暂不登录，仅在本地使用 →
            </button>
          </div>
        </div>
        <p class="text-center text-xs text-muted mt-4">
          开启云端同步需要先配置 Supabase。<br>
          <a href="javascript:void(0)" onclick="showCloudSetup()" class="text-primary hover:underline">配置云端连接</a>
        </p>
      </div>
    </div>`;
  }

  window.doLogin = async function () {
    const email = $('#login-email').value.trim();
    const password = $('#login-password').value;
    const errEl = $('#login-error');
    if (!email || !password) { errEl.textContent = '请输入邮箱和密码'; errEl.classList.remove('hidden'); return; }
    try {
      await window.CloudSync.login(email, password);
      await afterLogin();
    } catch (e) {
      errEl.textContent = e.message || '登录失败';
      errEl.classList.remove('hidden');
    }
  };

  window.doSignup = async function () {
    const email = $('#login-email').value.trim();
    const password = $('#login-password').value;
    const errEl = $('#login-error');
    if (!email || !password) { errEl.textContent = '请输入邮箱和密码'; errEl.classList.remove('hidden'); return; }
    if (password.length < 6) { errEl.textContent = '密码至少6位'; errEl.classList.remove('hidden'); return; }
    try {
      const result = await window.CloudSync.signup(email, password);
      if (result.needsConfirm) {
        errEl.className = 'mb-3 p-3 rounded-lg bg-info/20 text-info-text text-sm';
        errEl.textContent = '注册成功！请查收邮件验证后登录。';
        errEl.classList.remove('hidden');
      } else {
        await afterLogin();
      }
    } catch (e) {
      errEl.textContent = e.message || '注册失败';
      errEl.classList.remove('hidden');
    }
  };

  window.useLocalMode = function () {
    cloudReady = true;
    seedIfNeeded();
    window.location.hash = '/home';
    render();
  };

  async function afterLogin() {
    const user = window.CloudSync.getUser();
    cloudUserEmail = user?.email || '';
    cloudSyncState = 'syncing';
    // Pull data from cloud
    const cloudData = await window.CloudSync.pullAll();
    if (cloudData) {
      // Check if cloud has data
      const hasCloudData = Object.values(cloudData).some(v => Array.isArray(v) ? v.length > 0 : (v && Object.keys(v).length > 0));
      if (hasCloudData) {
        // Merge: cloud data takes precedence, but merge with local if local has items not in cloud
        if (cloudData.products?.length) setData(KEYS.products, cloudData.products);
        if (cloudData.orders?.length) setData(KEYS.orders, cloudData.orders);
        if (cloudData.inventory?.length) setData(KEYS.inventory, cloudData.inventory);
        if (cloudData.inventoryLogs?.length) setData(KEYS.inventoryLogs, cloudData.inventoryLogs);
        if (cloudData.diet?.length) setData(KEYS.diet, cloudData.diet);
        if (cloudData.body?.length) setData(KEYS.body, cloudData.body);
        if (cloudData.unassigned?.length) setData(KEYS.unassigned, cloudData.unassigned);
        if (cloudData.config) setData(KEYS.config, { ...DEFAULT_CONFIG, ...cloudData.config });
        toast('已从云端同步数据');
      } else {
        // No cloud data yet, push local data up
        await window.CloudSync.pushAll((key) => getData(KEYS[key], key === 'config' ? {} : []));
        toast('已将本地数据上传到云端');
      }
    }
    cloudSyncState = 'synced';
    cloudReady = true;
    setData(KEYS.cloudMode, true);
    window.location.hash = '/home';
    render();
  }

  window.doLogout = async function () {
    if (!confirm('确定要退出登录吗？本地数据将保留，但不会再同步到云端。')) return;
    await window.CloudSync.logout();
    cloudUserEmail = '';
    cloudSyncState = 'idle';
    render();
  };

  window.showCloudSetup = function () {
    const currentUrl = window.CloudSync?.getUrl() || '';
    const currentKey = window.CloudSync?.getKey() || '';
    openModal(`
      <div class="p-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold">配置云端同步</h3>
          <button onclick="closeModal()" class="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center text-muted">
            <i data-lucide="x" class="w-5 h-5"></i>
          </button>
        </div>
        <div class="bg-info/10 text-info-text text-sm p-3 rounded-xl mb-4">
          <p class="font-medium mb-1">如何获取？</p>
          <ol class="list-decimal list-inside space-y-0.5 text-xs">
            <li>前往 <a href="https://supabase.com" target="_blank" class="underline">supabase.com</a> 注册并创建项目</li>
            <li>在项目 SQL Editor 中运行 <code class="bg-white/50 px-1 rounded">supabase-setup.sql</code> 中的建表语句</li>
            <li>在 Settings → API 中复制 Project URL 和 anon public key</li>
          </ol>
        </div>
        <div class="space-y-3">
          <div>
            <label class="text-xs text-muted block mb-1">Supabase Project URL</label>
            <input type="text" id="cloud-url" class="cx-input w-full" placeholder="https://xxxx.supabase.co" value="${currentUrl}">
          </div>
          <div>
            <label class="text-xs text-muted block mb-1">Supabase Anon (public) Key</label>
            <input type="text" id="cloud-key" class="cx-input w-full" placeholder="eyJhbGciOi..." value="${currentKey}">
          </div>
          <button onclick="saveCloudConfig()" class="cx-btn cx-btn-primary w-full">保存并连接</button>
          ${currentUrl ? `<button onclick="clearCloudConfig()" class="cx-btn cx-btn-ghost w-full text-sm">断开云端连接，仅本地使用</button>` : ''}
        </div>
      </div>
    `);
  };

  window.saveCloudConfig = function () {
    const url = $('#cloud-url').value.trim();
    const key = $('#cloud-key').value.trim();
    if (!url || !key) { toast('请填写 URL 和 Key'); return; }
    window.CloudSync.saveConfig(url, key);
    window.CloudSync.initClient();
    closeModal();
    toast('配置已保存');
    // Check session
    window.CloudSync.checkSession().then(user => {
      if (user) {
        afterLogin();
      } else {
        render();
      }
    });
  };

  window.clearCloudConfig = function () {
    if (!confirm('确定断开云端连接？数据将只保存在本地。')) return;
    window.CloudSync.clearConfig();
    setData(KEYS.cloudMode, false);
    cloudUserEmail = '';
    cloudSyncState = 'idle';
    closeModal();
    render();
  };

  window.manualSync = async function () {
    if (!isCloudMode()) return;
    cloudSyncState = 'syncing';
    render();
    await window.CloudSync.pushAll((key) => getData(KEYS[key], key === 'config' ? {} : []));
    cloudSyncState = 'synced';
    toast('同步完成');
    render();
  };

  // ---------- MAIN RENDER ----------
  function render() {
    // If cloud is configured but not logged in, show login screen
    if (window.CloudSync && window.CloudSync.isConfigured() && !window.CloudSync.isLoggedIn() && getData(KEYS.cloudMode, false)) {
      $('#app').innerHTML = renderLoginScreen();
      lucide.createIcons();
      return;
    }

    const route = getRoute();
    let content = '';
    switch(route) {
      case 'home': content = renderHome(); break;
      case 'bookkeeping': content = renderBookkeeping(); break;
      case 'inventory': content = renderInventory(); break;
      case 'diet': content = renderDiet(); break;
      case 'products': content = renderProducts(); break;
      case 'profile': content = renderProfile(); break;
      case 'recycle': content = renderRecycle(); break;
      default: content = renderHome();
    }
    $('#app').innerHTML = renderLayout(content, route);
    lucide.createIcons();
  }

  // ---------- INIT ----------
  async function init() {
    seedIfNeeded();

    // Setup cloud
    if (window.CloudSync) {
      window.CloudSync.initClient();
      window._onSyncChange = (state) => {
        cloudSyncState = state;
        // Don't re-render full page, just update indicator if possible
        const indicator = document.querySelector('[data-sync-indicator]');
        if (indicator) render(); // simple approach
      };

      if (window.CloudSync.isConfigured()) {
        const user = await window.CloudSync.checkSession();
        if (user) {
          cloudUserEmail = user.email || '';
          cloudSyncState = 'synced';
          cloudReady = true;
          setData(KEYS.cloudMode, true);
          // Pull latest data
          const cloudData = await window.CloudSync.pullAll();
          if (cloudData) {
            const hasCloudData = Object.values(cloudData).some(v => Array.isArray(v) ? v.length > 0 : (v && Object.keys(v).length > 0));
            if (hasCloudData) {
              if (cloudData.products?.length) setData(KEYS.products, cloudData.products);
              if (cloudData.orders?.length) setData(KEYS.orders, cloudData.orders);
              if (cloudData.inventory?.length) setData(KEYS.inventory, cloudData.inventory);
              if (cloudData.inventoryLogs?.length) setData(KEYS.inventoryLogs, cloudData.inventoryLogs);
              if (cloudData.diet?.length) setData(KEYS.diet, cloudData.diet);
              if (cloudData.body?.length) setData(KEYS.body, cloudData.body);
              if (cloudData.unassigned?.length) setData(KEYS.unassigned, cloudData.unassigned);
              if (cloudData.config) setData(KEYS.config, { ...DEFAULT_CONFIG, ...cloudData.config });
            }
          }
        }
      }

      window.CloudSync.onAuthChange((user) => {
        if (!user && getData(KEYS.cloudMode, false)) {
          cloudUserEmail = '';
          cloudSyncState = 'idle';
          render();
        }
      });
    }

    // If not in cloud mode, mark as ready for local use
    if (!window.CloudSync || !window.CloudSync.isConfigured() || !getData(KEYS.cloudMode, false)) {
      cloudReady = true;
    }

    window.addEventListener('hashchange', render);
    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();