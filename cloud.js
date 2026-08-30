/* ============================================================
   仓序食时 - Supabase 云端同步模块
   ============================================================ */
(function () {
  'use strict';

  const CLOUD_KEYS = {
    url: 'cx_supabase_url',
    key: 'cx_supabase_key'
  };

  // 内置云端配置（anon key 本身就是设计给前端公开使用的，数据安全由登录账号 + RLS 策略保证）
  // 任何设备打开网页都会自动使用此配置，直接进入登录界面；用户手动填写的配置会覆盖内置值。
  const BUILTIN_URL = 'https://yfofcakxhseivibgocyo.supabase.co';
  const BUILTIN_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlmb2ZjYWt4aHNlaXZpYmdvY3lvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc5MjcxNTYsImV4cCI6MjEwMzUwMzE1Nn0.bU1ThWYiJhCkp6-cIDS-vMeoHSC6hYuhlh41Se6sWsE';

  const TABLE_MAP = {
    products: 'products',
    orders: 'orders',
    inventory: 'inventory',
    inventoryLogs: 'inventory_logs',
    diet: 'diet',
    body: 'body_data',
    unassigned: 'unassigned_food'
  };

  let supabaseClient = null;
  let currentUser = null;
  let syncState = 'idle'; // idle | syncing | error | synced
  let lastError = '';

  // Translate common Supabase errors into beginner-friendly Chinese
  function friendlyError(e) {
    const raw = (e && (e.message || e.error_description || String(e))) || '未知错误';
    let hint = '';
    if (/relation .* does not exist|42P01/i.test(raw)) {
      hint = '数据库还没有建表：请在 Supabase 后台打开 SQL Editor，把 supabase-setup.sql 的全部内容粘贴进去并点击 RUN 运行。';
    } else if (/permission denied for (table|sequence|relation)/i.test(raw)) {
      hint = '数据库表权限缺失：请重新在 SQL Editor 中完整运行最新版 supabase-setup.sql（新版包含 grant 授权语句），运行后必须看到 Success。';
    } else if (/permission denied|row-level security|42501|new row violates row-level security/i.test(raw)) {
      hint = '数据库权限策略缺失：请重新在 SQL Editor 中完整运行一次最新版 supabase-setup.sql（包含 drop policy 和 create policy 部分），运行后必须看到 Success。';
    } else if (/JWT|jwt|invalid api key|invalid token/i.test(raw)) {
      hint = 'API Key 不正确：请确认复制的是 anon / public key（不是 service_role key）。';
    } else if (/Failed to fetch|NetworkError|network|load failed/i.test(raw)) {
      hint = '网络连接失败：请检查网络，或确认 Project URL 填写正确（应为 https://xxxx.supabase.co）。';
    } else if (/Could not find the|column .* does not exist|PGRST204/i.test(raw)) {
      hint = '数据表结构过旧：请重新运行最新版 supabase-setup.sql 后再试。';
    }
    return hint ? hint + '（详细信息：' + raw + '）' : raw;
  }

  function sanitizeUrl(u) {
    u = (u || '').trim();
    // Extract the canonical API URL: https://<ref>.supabase.co
    // This strips trailing slashes, accidental paths (e.g. /auth/v1),
    // and dashboard URLs pasted by mistake.
    const m = u.match(/^(https:\/\/[a-z0-9]{15,30}\.supabase\.co)/i);
    if (m) return m[1];
    // Fallback: just strip trailing slashes/spaces
    return u.replace(/\/+$/, '');
  }

  function getUrl() { return sanitizeUrl(localStorage.getItem(CLOUD_KEYS.url) || BUILTIN_URL || ''); }
  function getKey() { return (localStorage.getItem(CLOUD_KEYS.key) || BUILTIN_KEY || '').trim(); }
  // 用户是否手动填写过配置（覆盖内置配置）
  function hasUserConfig() { return !!(localStorage.getItem(CLOUD_KEYS.url) && localStorage.getItem(CLOUD_KEYS.key)); }

  function isConfigured() {
    return !!(getUrl() && getKey() && window.supabase);
  }

  function initClient() {
    if (!isConfigured()) { supabaseClient = null; return null; }
    if (supabaseClient) return supabaseClient;
    try {
      supabaseClient = window.supabase.createClient(getUrl(), getKey(), {
        auth: { persistSession: true, autoRefreshToken: true }
      });
      return supabaseClient;
    } catch (e) {
      console.error('Supabase init failed:', e);
      supabaseClient = null;
      return null;
    }
  }

  async function checkSession() {
    const client = initClient();
    if (!client) { currentUser = null; return null; }
    try {
      const { data } = await client.auth.getSession();
      currentUser = data.session?.user || null;
      return currentUser;
    } catch (e) {
      console.error('Session check failed:', e);
      return null;
    }
  }

  function onAuthChange(callback) {
    const client = initClient();
    if (!client) return;
    client.auth.onAuthStateChange((event, session) => {
      currentUser = session?.user || null;
      callback(currentUser);
    });
  }

  async function login(email, password) {
    const client = initClient();
    if (!client) throw new Error('云端未配置');
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    currentUser = data.user;
    return data.user;
  }

  async function signup(email, password) {
    const client = initClient();
    if (!client) throw new Error('云端未配置');
    // Redirect back to the current site after email confirmation
    const signUpOpts = { email, password };
    if (window.location.origin && /^https?:/.test(window.location.origin)) {
      signUpOpts.options = {
        emailRedirectTo: window.location.origin + window.location.pathname
      };
    }
    const { data, error } = await client.auth.signUp(signUpOpts);
    if (error) throw error;
    if (data.user && !data.session) {
      return { needsConfirm: true, user: data.user };
    }
    currentUser = data.user;
    return { needsConfirm: false, user: data.user };
  }

  async function logout() {
    const client = initClient();
    if (!client) return;
    await client.auth.signOut();
    currentUser = null;
  }

  async function resendConfirm(email) {
    const client = initClient();
    if (!client) throw new Error('云端未配置');
    const opts = { email, type: 'signup' };
    if (window.location.origin && /^https?:/.test(window.location.origin)) {
      opts.options = { emailRedirectTo: window.location.origin + window.location.pathname };
    }
    const { error } = await client.auth.resend(opts);
    if (error) throw error;
  }

  function getUser() { return currentUser; }
  function isLoggedIn() { return !!currentUser; }
  function getSyncState() { return syncState; }

  function getUserId() { return currentUser?.id; }

  // Push a single table's data to cloud
  async function pushTable(localKey, tableName, data) {
    if (!isLoggedIn() || !supabaseClient) return;
    const userId = getUserId();
    if (!userId) return;

    try {
      // First delete all existing records for this user (simple full-sync approach)
      await supabaseClient.from(tableName).delete().eq('user_id', userId);

      if (!data || data.length === 0) return;

      // Map local data to cloud format
      const records = data.map(item => {
        const rec = { ...item, user_id: userId };
        // 本地时间戳字段不入库（数据库用 created_at/updated_at 自动生成）
        delete rec.createdAt;
        delete rec.updatedAt;
        // Convert field names to match DB schema
        if (tableName === 'body_data') {
          // body -> body_data: weight, bodyFat -> body_fat
          rec.body_fat = item.bodyFat;
          delete rec.bodyFat;
        }
        if (tableName === 'inventory_logs') {
          // inventoryLogs -> inventory_logs
          rec.inventory_id = item.inventoryId;
          delete rec.inventoryId;
        }
        if (tableName === 'unassigned_food') {
          rec.order_id = item.orderId;
          rec.order_date = item.orderDate;
          rec.product_id = item.productId;
          rec.product_name = item.productName;
          delete rec.orderId; delete rec.orderDate; delete rec.productId; delete rec.productName;
          delete rec.assigned;
        }
        // Convert camelCase to snake_case for JSON fields that are objects
        if (tableName === 'orders') {
          // items and tags are already JSON, field names match
        }
        if (tableName === 'diet') {
          // items is JSON, totalCalories -> total_calories
          rec.total_calories = item.totalCalories;
          delete rec.totalCalories;
        }
        if (tableName === 'products') {
          rec.default_price = item.defaultPrice;
          rec.stock_threshold = item.stockThreshold;
          delete rec.defaultPrice; delete rec.stockThreshold;
        }
        if (tableName === 'inventory') {
          rec.product_id = item.productId;
          rec.product_name = item.productName;
          rec.avg_cost = item.avgCost;
          rec.source_order_id = item.sourceOrderId;
          delete rec.productId; delete rec.productName; delete rec.avgCost; delete rec.sourceOrderId;
        }
        return rec;
      });

      // Upsert in batches
      const batchSize = 100;
      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);
        const { error } = await supabaseClient.from(tableName).insert(batch);
        if (error) {
          console.error(`Push ${tableName} error:`, error);
          throw error;
        }
      }
    } catch (e) {
      console.error(`Push ${tableName} failed:`, e);
      const wrapped = new Error(`[表:${tableName}] ${e.message || e.error_description || e}`);
      wrapped.cause = e;
      throw wrapped;
    }
  }

  // Push all local data to cloud
  async function pushAll(getLocalData) {
    if (!isLoggedIn()) return;
    syncState = 'syncing';
    if (window._onSyncChange) window._onSyncChange(syncState);

    try {
      const tables = {
        products: 'products',
        orders: 'orders',
        inventory: 'inventory',
        inventoryLogs: 'inventory_logs',
        diet: 'diet',
        body: 'body_data',
        unassigned: 'unassigned_food'
      };

      for (const [localKey, tableName] of Object.entries(tables)) {
        const data = getLocalData(localKey);
        await pushTable(localKey, tableName, data);
      }

      // Push config separately
      const config = getLocalData('config');
      if (config) {
        const { error } = await supabaseClient.from('user_config').upsert({
          user_id: getUserId(),
          config: config
        });
        if (error) console.error('Push config error:', error);
      }

      syncState = 'synced';
      lastError = '';
    } catch (e) {
      syncState = 'error';
      lastError = friendlyError(e);
      console.error('Push all failed:', e);
    }
    if (window._onSyncChange) window._onSyncChange(syncState, lastError);
  }

  // Pull all data from cloud to local
  async function pullAll() {
    if (!isLoggedIn() || !supabaseClient) return null;
    syncState = 'syncing';
    if (window._onSyncChange) window._onSyncChange(syncState);

    try {
      const userId = getUserId();
      const result = {};

      // Pull each table
      const tables = [
        ['products', 'products'],
        ['orders', 'orders'],
        ['inventory', 'inventory'],
        ['inventoryLogs', 'inventory_logs'],
        ['diet', 'diet'],
        ['body', 'body_data'],
        ['unassigned', 'unassigned_food']
      ];

      for (const [localKey, tableName] of tables) {
        const { data, error } = await supabaseClient.from(tableName).select('*').eq('user_id', userId);
        if (error) throw new Error(`[表:${tableName}] ${error.message || error}`);

        result[localKey] = (data || []).map(rec => {
          const item = { ...rec };
          delete item.user_id;
          // Convert snake_case back to camelCase
          if (tableName === 'body_data') {
            item.bodyFat = rec.body_fat || 0;
            delete item.body_fat;
          }
          if (tableName === 'inventory_logs') {
            item.inventoryId = rec.inventory_id;
            delete item.inventory_id;
          }
          if (tableName === 'unassigned_food') {
            item.orderId = rec.order_id;
            item.orderDate = rec.order_date;
            item.productId = rec.product_id;
            item.productName = rec.product_name;
            item.assigned = false;
            delete item.order_id; delete item.order_date; delete item.product_id; delete item.product_name;
          }
          if (tableName === 'diet') {
            item.totalCalories = rec.total_calories || 0;
            delete item.total_calories;
          }
          if (tableName === 'products') {
            item.defaultPrice = rec.default_price || 0;
            item.stockThreshold = rec.stock_threshold || 0;
            delete item.default_price; delete item.stock_threshold;
          }
          if (tableName === 'inventory') {
            item.productId = rec.product_id;
            item.productName = rec.product_name;
            item.avgCost = rec.avg_cost || 0;
            item.sourceOrderId = rec.source_order_id;
            delete item.product_id; delete item.product_name; delete item.avg_cost; delete item.source_order_id;
          }
          delete item.created_at; delete item.updated_at;
          return item;
        });
      }

      // Pull config
      const { data: cfgData } = await supabaseClient.from('user_config').select('config').eq('user_id', userId).maybeSingle();
      result.config = cfgData?.config || null;

      // Pull recycle (stays local only)
      result.recycle = [];

      syncState = 'synced';
      lastError = '';
      if (window._onSyncChange) window._onSyncChange(syncState, lastError);
      return result;
    } catch (e) {
      syncState = 'error';
      lastError = friendlyError(e);
      if (window._onSyncChange) window._onSyncChange(syncState, lastError);
      console.error('Pull all failed:', e);
      return null;
    }
  }

  function saveConfig(url, key) {
    localStorage.setItem(CLOUD_KEYS.url, url);
    localStorage.setItem(CLOUD_KEYS.key, key);
    supabaseClient = null; // reset to re-init
  }

  function clearConfig() {
    localStorage.removeItem(CLOUD_KEYS.url);
    localStorage.removeItem(CLOUD_KEYS.key);
    supabaseClient = null;
    currentUser = null;
  }

  // Debounced auto-sync
  let syncTimer = null;
  function schedulePush(getLocalData) {
    if (!isLoggedIn()) return;
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
      pushAll(getLocalData).catch(console.error);
    }, 2000);
  }

  window.CloudSync = {
    isConfigured,
    initClient,
    checkSession,
    onAuthChange,
    login, signup, logout, resendConfirm,
    getUser, isLoggedIn, getUserId,
    getSyncState, getLastError: () => lastError,
    pushAll, pullAll, pushTable,
    schedulePush,
    saveConfig, clearConfig,
    getUrl, getKey
  };
})();
