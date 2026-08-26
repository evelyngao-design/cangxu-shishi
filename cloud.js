/* ============================================================
   仓序食时 - Supabase 云端同步模块
   ============================================================ */
(function () {
  'use strict';

  const CLOUD_KEYS = {
    url: 'cx_supabase_url',
    key: 'cx_supabase_key'
  };

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

  function getUrl() { return localStorage.getItem(CLOUD_KEYS.url) || ''; }
  function getKey() { return localStorage.getItem(CLOUD_KEYS.key) || ''; }

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
    const { data, error } = await client.auth.signUp({ email, password });
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
      throw e;
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
    } catch (e) {
      syncState = 'error';
      console.error('Push all failed:', e);
    }
    if (window._onSyncChange) window._onSyncChange(syncState);
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
        if (error) throw error;

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
      if (window._onSyncChange) window._onSyncChange(syncState);
      return result;
    } catch (e) {
      syncState = 'error';
      if (window._onSyncChange) window._onSyncChange(syncState);
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
    login, signup, logout,
    getUser, isLoggedIn, getUserId,
    getSyncState,
    pushAll, pullAll, pushTable,
    schedulePush,
    saveConfig, clearConfig,
    getUrl, getKey
  };
})();
