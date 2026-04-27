const { createClient } = require('@libsql/client');

// Turso 数据库配置
const TURSO_URL = 'libsql://ski-club-db-dalong00111-hub.aws-ap-northeast-1.turso.io';
const TURSO_AUTH_TOKEN = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzcwMjg1ODEsImlkIjoiMDE5ZGJmMjYtZDIwMS03YWYyLWEyZmItNzQ3OTY2NDc3MmVjIiwicmlkIjoiNzdjOWMyOWItODVkYy00NWZiLTk3NGItOTVjMjQ4MGQyNDFiIn0.VxGLFHZcIejQCh5MVvKyTPaDKJPOjKY7fIkyWzsIzK3BcqfRQRfkoAMRbYZgrkO7bNTkcSz1Ggsr9CvQGOe0Bg';

// 创建 Turso 客户端
const turso = createClient({
  url: TURSO_URL,
  authToken: TURSO_AUTH_TOKEN,
});

const Database = require('better-sqlite3');
const path = require('path');

// 本地数据库路径（仅用于开发）
const DB_PATH = path.join(__dirname, 'data', 'ski-club.db');

// 判断是否使用远程数据库
const USE_REMOTE = process.env.USE_TURSO === 'true';

// 远程数据库操作
async function tursoExec(sql, params = []) {
  try {
    const result = await turso.execute({ sql, args: params });
    return result;
  } catch (err) {
    console.error('Turso error:', err.message);
    throw err;
  }
}

// 数据库导出接口
const db = {
  // 执行 SQL（兼容 better-sqlite3 接口）
  prepare: (sql) => {
    if (USE_REMOTE) {
      return {
        get: (...args) => tursoExec(sql, args).then(r => r.rows?.[0] || null),
        all: (...args) => tursoExec(sql, args).then(r => r.rows || []),
        run: (...args) => tursoExec(sql, args).then(r => ({ changes: r.rowsAffected })),
      };
    } else {
      const local = new Database(DB_PATH);
      return local.prepare(sql);
    }
  },
  // 直接执行
  exec: async (sql, params) => {
    if (USE_REMOTE) {
      return tursoExec(sql, params);
    } else {
      const local = new Database(DB_PATH);
      return local.exec(sql);
    }
  },
  // 获取内容
  getContent: async (key) => {
    if (USE_REMOTE) {
      const result = await tursoExec('SELECT value FROM content WHERE key = ?', [key]);
      return result.rows?.[0]?.value || null;
    } else {
      const local = new Database(DB_PATH);
      const row = local.prepare('SELECT value FROM content WHERE key = ?').get(key);
      return row?.value || null;
    }
  },
  // 设置内容
  setContent: async (key, value) => {
    if (USE_REMOTE) {
      await tursoExec(
        'INSERT OR REPLACE INTO content (key, value, updated_at) VALUES (?, ?, strftime("%s", "now"))',
        [key, value]
      );
    } else {
      const local = new Database(DB_PATH);
      local.prepare('INSERT OR REPLACE INTO content (key, value, updated_at) VALUES (?, ?, strftime("%s", "now"))').run(key, value);
    }
  },
  // 获取所有用户
  getUsers: async () => {
    if (USE_REMOTE) {
      const result = await tursoExec('SELECT * FROM users');
      const users = {};
      for (const row of result.rows || []) {
        users[row.phone] = row;
      }
      return users;
    } else {
      const local = new Database(DB_PATH);
      const rows = local.prepare('SELECT * FROM users').all();
      const users = {};
      for (const row of rows) {
        users[row.phone] = row;
      }
      return users;
    }
  },
  // 设置用户
  setUser: async (phone, user) => {
    if (USE_REMOTE) {
      await tursoExec(
        `INSERT OR REPLACE INTO users (phone, name, password, role, avatar, is_super_admin, permissions, created_at, my_prizes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [phone, user.name, user.password, user.role, user.avatar, user.isSuperAdmin ? 1 : 0, 
         JSON.stringify(user.permissions || {}), user.createdAt, JSON.stringify(user.my_prizes || [])]
      );
    } else {
      const local = new Database(DB_PATH);
      local.prepare(`INSERT OR REPLACE INTO users (phone, name, password, role, avatar, is_super_admin, permissions, created_at, my_prizes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        phone, user.name, user.password, user.role, user.avatar, user.isSuperAdmin ? 1 : 0,
        JSON.stringify(user.permissions || {}), user.createdAt, JSON.stringify(user.my_prizes || [])
      );
    }
  },
  // 获取单个用户
  getUser: async (phone) => {
    if (USE_REMOTE) {
      const result = await tursoExec('SELECT * FROM users WHERE phone = ?', [phone]);
      return result.rows?.[0] || null;
    } else {
      const local = new Database(DB_PATH);
      return local.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
    }
  },
};

// 导出
module.exports = db;
module.exports.db = db;

// 如果直接运行，则测试连接
if (require.main === module) {
  console.log('🔗 Testing Turso connection...');
  tursoExec('SELECT 1').then(() => {
    console.log('✅ Turso connected successfully!');
    process.exit(0);
  }).catch(err => {
    console.error('❌ Turso connection failed:', err.message);
    process.exit(1);
  });
}
