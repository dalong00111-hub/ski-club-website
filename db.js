const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data', 'ski-club.db');
const db = new Database(DB_PATH);

// 启用外键约束
db.pragma('foreign_keys = ON');

// ==================== 表结构初始化 ====================
db.exec(`
-- 内容配置表
CREATE TABLE IF NOT EXISTS content (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- 用户表
CREATE TABLE IF NOT EXISTS users (
  phone TEXT PRIMARY KEY,
  name TEXT,
  password TEXT,
  role TEXT DEFAULT 'user',
  avatar TEXT,
  is_super_admin INTEGER DEFAULT 0,
  permissions TEXT,
  created_at TEXT,
  my_prizes TEXT
);

-- 运动员表
CREATE TABLE IF NOT EXISTS athletes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  level TEXT,
  image TEXT,
  video TEXT
);

-- 基地表
CREATE TABLE IF NOT EXISTS bases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  description TEXT,
  image TEXT
);

-- 课程表
CREATE TABLE IF NOT EXISTS courses (
  id TEXT PRIMARY KEY,
  title TEXT,
  icon TEXT,
  type TEXT,
  tag TEXT,
  featured INTEGER DEFAULT 0,
  content TEXT,
  sub_courses TEXT,
  table_link TEXT
);

-- 抽奖奖品表
CREATE TABLE IF NOT EXISTS prizes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  icon TEXT,
  description TEXT,
  probability REAL,
  total INTEGER,
  remain INTEGER,
  level INTEGER,
  content TEXT,
  rules TEXT,
  value TEXT,
  expire_date TEXT,
  lottery_name TEXT,
  drawn INTEGER DEFAULT 0
);

-- 抽奖记录表
CREATE TABLE IF NOT EXISTS lottery_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT,
  name TEXT,
  prize TEXT,
  prize_id INTEGER,
  prize_icon TEXT,
  won INTEGER DEFAULT 0,
  time TEXT,
  archived_at TEXT,
  archived_note TEXT
);

-- 问答提交表
CREATE TABLE IF NOT EXISTS quiz_submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  answers TEXT,
  recommended_courses TEXT,
  submitted_at TEXT
);

-- 系统设置表
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_athletes_name ON athletes(name);
CREATE INDEX IF NOT EXISTS idx_courses_type ON courses(type);
CREATE INDEX IF NOT EXISTS idx_lottery_phone ON lottery_records(phone);
`);

module.exports = {
  db,
  // 便捷查询方法
  getContent: (key) => {
    const row = db.prepare('SELECT value FROM content WHERE key = ?').get(key);
    return row ? JSON.parse(row.value) : null;
  },
  
  setContent: (key, value) => {
    const stmt = db.prepare(`
      INSERT INTO content (key, value, updated_at) VALUES (?, ?, strftime('%s', 'now'))
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `);
    stmt.run(key, JSON.stringify(value));
  },
  
  getUsers: () => {
    const rows = db.prepare('SELECT * FROM users').all();
    return rows.reduce((acc, row) => {
      acc[row.phone] = {
        name: row.name,
        phone: row.phone,
        password: row.password,
        role: row.role,
        avatar: row.avatar,
        isSuperAdmin: row.is_super_admin,
        permissions: row.permissions ? JSON.parse(row.permissions) : {},
        createdAt: row.created_at,
        myPrizes: row.my_prizes ? JSON.parse(row.my_prizes) : []
      };
      return acc;
    }, {});
  },
  
  getUser: (phone) => {
    const row = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
    if (!row) return null;
    return {
      name: row.name,
      phone: row.phone,
      password: row.password,
      role: row.role,
      avatar: row.avatar,
      isSuperAdmin: row.is_super_admin,
      permissions: row.permissions ? JSON.parse(row.permissions) : {},
      createdAt: row.created_at,
      myPrizes: row.my_prizes ? JSON.parse(row.my_prizes) : []
    };
  },
  
  setUser: (phone, user) => {
    const stmt = db.prepare(`
      INSERT INTO users (phone, name, password, role, avatar, is_super_admin, permissions, created_at, my_prizes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(phone) DO UPDATE SET
        name = excluded.name,
        password = excluded.password,
        role = excluded.role,
        avatar = excluded.avatar,
        is_super_admin = excluded.is_super_admin,
        permissions = excluded.permissions,
        my_prizes = excluded.my_prizes
    `);
    stmt.run(
      phone,
      user.name || '',
      user.password || '',
      user.role || 'user',
      user.avatar || '',
      user.isSuperAdmin ? 1 : 0,
      JSON.stringify(user.permissions || {}),
      user.createdAt || new Date().toISOString(),
      JSON.stringify(user.myPrizes || [])
    );
  },
  
  // Generic table operations
  getAll: (table) => {
    return db.prepare(`SELECT * FROM ${table}`).all();
  },
  
  getById: (table, id, col = 'id') => {
    return db.prepare(`SELECT * FROM ${table} WHERE ${col} = ?`).get(id);
  },
  
  insert: (table, data) => {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const cols = keys.join(', ');
    const placeholders = keys.map(() => '?').join(', ');
    const stmt = db.prepare(`INSERT INTO ${table} (${cols}) VALUES (${placeholders})`);
    return stmt.run(...values);
  },
  
  update: (table, id, data, col = 'id') => {
    const sets = Object.keys(data).map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(data), id];
    const stmt = db.prepare(`UPDATE ${table} SET ${sets} WHERE ${col} = ?`);
    return stmt.run(...values);
  },
  
  delete: (table, id, col = 'id') => {
    return db.prepare(`DELETE FROM ${table} WHERE ${col} = ?`).run(id);
  }
};
