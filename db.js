const { createClient } = require('@libsql/client');

// Turso 配置
const TURSO_URL = process.env.TURSO_URL || 'libsql://ski-club-db-dalong00111-hub.aws-ap-northeast-1.turso.io';
const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN || 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzcwMjg1ODEsImlkIjoiMDE5ZGJmMjYtZDIwMS03YWYyLWEyZmItNzQ3OTY2NDc3MmVjIiwicmlkIjoiNzdjOWMyOWItODVkYy00NWZiLTk3NGItOTVjMjQ4MGQyNDFiIn0.VxGLFHZcIejQCh5MVvKyTPaDKJPOjKY7fIkyWzsIzK3BcqfRQRfkoAMRbYZgrkO7bNTkcSz1Ggsr9CvQGOe0Bg';

const Database = require('better-sqlite3');
const path = require('path');

// 是否使用远程数据库
const USE_TURSO = process.env.USE_TURSO === 'true';

// 创建 Turso 客户端
let tursoClient = null;
if (USE_TURSO) {
  tursoClient = createClient({
    url: TURSO_URL,
    authToken: TURSO_AUTH_TOKEN,
  });
}

// 本地数据库
const DB_PATH = path.join(__dirname, 'data', 'ski-club.db');
let localDb = null;

function getLocalDb() {
  if (!localDb) {
    localDb = new Database(DB_PATH);
  }
  return localDb;
}

// 统一数据库接口
const db = {
  // 同步方法 - 仅用于本地SQLite
  get: (sql, params = []) => {
    if (USE_TURSO) throw new Error('Use async methods for Turso');
    return getLocalDb().prepare(sql).get(...params);
  },
  
  all: (sql, params = []) => {
    if (USE_TURSO) throw new Error('Use async methods for Turso');
    return getLocalDb().prepare(sql).all(...params);
  },
  
  run: (sql, params = []) => {
    if (USE_TURSO) throw new Error('Use async methods for Turso');
    return getLocalDb().prepare(sql).run(...params);
  },

  // 异步方法 - 用于 Turso
  getAsync: async (sql, params = []) => {
    if (USE_TURSO) {
      const result = await tursoClient.execute({ sql, args: params });
      return result.rows?.[0] || null;
    }
    return getLocalDb().prepare(sql).get(...params);
  },
  
  allAsync: async (sql, params = []) => {
    if (USE_TURSO) {
      const result = await tursoClient.execute({ sql, args: params });
      return result.rows || [];
    }
    return getLocalDb().prepare(sql).all(...params);
  },
  
  runAsync: async (sql, params = []) => {
    if (USE_TURSO) {
      const result = await tursoClient.execute({ sql, args: params });
      return { changes: result.rowsAffected };
    }
    return getLocalDb().prepare(sql).run(...params);
  },

  // 便捷方法：获取内容
  getContent: async (key) => {
    if (USE_TURSO) {
      const result = await tursoClient.execute({
        sql: 'SELECT value FROM content WHERE key = ?',
        args: [key]
      });
      return result.rows?.[0]?.value || null;
    }
    const row = getLocalDb().prepare('SELECT value FROM content WHERE key = ?').get(key);
    return row?.value || null;
  },

  // 便捷方法：设置内容
  setContent: async (key, value) => {
    if (USE_TURSO) {
      await tursoClient.execute({
        sql: 'INSERT OR REPLACE INTO content (key, value, updated_at) VALUES (?, ?, strftime("%s", "now"))',
        args: [key, value]
      });
    } else {
      getLocalDb().prepare('INSERT OR REPLACE INTO content (key, value, updated_at) VALUES (?, ?, strftime("%s", "now"))').run(key, value);
    }
  },

  // 便捷方法：获取所有用户
  getUsers: async () => {
    if (USE_TURSO) {
      const result = await tursoClient.execute('SELECT * FROM users');
      const users = {};
      for (const row of result.rows || []) {
        users[row.phone] = row;
      }
      return users;
    }
    const rows = getLocalDb().prepare('SELECT * FROM users').all();
    const users = {};
    for (const row of rows) {
      users[row.phone] = row;
    }
    return users;
  },

  // 便捷方法：设置用户
  setUser: async (phone, user) => {
    if (USE_TURSO) {
      await tursoClient.execute({
        sql: `INSERT OR REPLACE INTO users (phone, name, password, role, avatar, is_super_admin, permissions, created_at, my_prizes)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          phone, 
          user.name || phone, 
          user.password || '', 
          user.role || 'user', 
          user.avatar || '👤', 
          user.isSuperAdmin ? 1 : 0,
          JSON.stringify(user.permissions || {}),
          user.createdAt || new Date().toISOString(),
          JSON.stringify(user.my_prizes || [])
        ]
      });
    } else {
      getLocalDb().prepare(`INSERT OR REPLACE INTO users (phone, name, password, role, avatar, is_super_admin, permissions, created_at, my_prizes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        phone, user.name || phone, user.password || '', user.role || 'user', user.avatar || '👤',
        user.isSuperAdmin ? 1 : 0,
        JSON.stringify(user.permissions || {}),
        user.createdAt || new Date().toISOString(),
        JSON.stringify(user.my_prizes || [])
      );
    }
  },

  // 便捷方法：获取单个用户
  getUser: async (phone) => {
    if (USE_TURSO) {
      const result = await tursoClient.execute({
        sql: 'SELECT * FROM users WHERE phone = ?',
        args: [phone]
      });
      return result.rows?.[0] || null;
    }
    return getLocalDb().prepare('SELECT * FROM users WHERE phone = ?').get(phone);
  }
};

module.exports = db;
module.exports.db = db;
module.exports.USE_TURSO = USE_TURSO;

// 测试连接
if (require.main === module) {
  console.log('🧪 Testing database connection...');
  console.log('USE_TURSO:', USE_TURSO);
  
  if (USE_TURSO) {
    db.getUsers().then(users => {
      console.log('✅ Turso connected! Users:', Object.keys(users).length);
      process.exit(0);
    }).catch(err => {
      console.error('❌ Turso error:', err.message);
      process.exit(1);
    });
  } else {
    try {
      const users = db.getUsers();
      console.log('✅ Local SQLite connected! Users:', Object.keys(users).length);
      process.exit(0);
    } catch (err) {
      console.error('❌ Local DB error:', err.message);
      process.exit(1);
    }
  }
}
