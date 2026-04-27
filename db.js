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
    const strValue = typeof value === 'string' ? value : JSON.stringify(value);
    if (USE_TURSO) {
      await tursoClient.execute({
        sql: 'INSERT OR REPLACE INTO content (key, value, updated_at) VALUES (?, ?, datetime("now"))',
        args: [key, strValue]
      });
    } else {
      getLocalDb().prepare(`INSERT OR REPLACE INTO content (key, value, updated_at) VALUES ('${key}', ?, datetime('now'))`).run(strValue);
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
  },

  // ========== 约课系统方法 ==========

  // 获取所有主分类
  getBookingCategories: async () => {
    if (USE_TURSO) {
      const result = await tursoClient.execute('SELECT * FROM booking_categories ORDER BY sort_order');
      return result.rows || [];
    }
    return getLocalDb().prepare('SELECT * FROM booking_categories ORDER BY sort_order').all();
  },

  // 获取子分类（可按主分类筛选）
  getBookingSubcategories: async (categoryId = null) => {
    if (USE_TURSO) {
      const sql = categoryId 
        ? 'SELECT * FROM booking_subcategories WHERE category_id = ? ORDER BY sort_order'
        : 'SELECT * FROM booking_subcategories ORDER BY sort_order';
      const args = categoryId ? [categoryId] : [];
      const result = await tursoClient.execute({ sql, args });
      return result.rows || [];
    }
    if (categoryId) {
      return getLocalDb().prepare('SELECT * FROM booking_subcategories WHERE category_id = ? ORDER BY sort_order').all(categoryId);
    }
    return getLocalDb().prepare('SELECT * FROM booking_subcategories ORDER BY sort_order').all();
  },

  // 获取课程（可按子分类筛选）
  getBookingCourses: async (subcategoryId = null, enabled = true, categoryId = null, status = 'active') => {
    if (USE_TURSO) {
      let sql = 'SELECT * FROM booking_courses WHERE 1=1';
      const args = [];
      if (subcategoryId) {
        sql += ' AND subcategory_id = ?';
        args.push(subcategoryId);
      }
      if (categoryId) {
        sql += ' AND category_id = ?';
        args.push(categoryId);
      }
      if (enabled !== null) {
        sql += ' AND enabled = ?';
        args.push(enabled ? 1 : 0);
      }
      if (status !== null) {
        sql += ' AND status = ?';
        args.push(status);
      }
      sql += ' ORDER BY created_at DESC';
      const result = await tursoClient.execute({ sql, args });
      return result.rows || [];
    }
    let sql = 'SELECT * FROM booking_courses WHERE 1=1';
    const params = [];
    if (subcategoryId) {
      sql += ' AND subcategory_id = ?';
      params.push(subcategoryId);
    }
    if (categoryId) {
      sql += ' AND category_id = ?';
      params.push(categoryId);
    }
    if (enabled !== null) {
      sql += ' AND enabled = ?';
      params.push(enabled ? 1 : 0);
    }
    if (status !== null) {
      sql += ' AND status = ?';
      params.push(status);
    }
    sql += ' ORDER BY created_at DESC';
    return getLocalDb().prepare(sql).all(...params);
  },

  // 获取单个课程
  getBookingCourse: async (courseId) => {
    if (USE_TURSO) {
      const result = await tursoClient.execute({ sql: 'SELECT * FROM booking_courses WHERE id = ?', args: [courseId] });
      return result.rows?.[0] || null;
    }
    return getLocalDb().prepare('SELECT * FROM booking_courses WHERE id = ?').get(courseId);
  },

  // 自动过期：设置已过结束日期的课程为禁用状态
  autoExpireCourses: async () => {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    if (USE_TURSO) {
      const result = await tursoClient.execute({
        sql: `UPDATE booking_courses SET enabled = 0, status = 'stopped' WHERE end_date IS NOT NULL AND end_date != '' AND end_date < ? AND enabled = 1`,
        args: [today]
      });
      return result.rowsAffected || 0;
    }
    const stmt = getLocalDb().prepare(`UPDATE booking_courses SET enabled = 0, status = 'stopped' WHERE end_date IS NOT NULL AND end_date != '' AND end_date < ? AND enabled = 1`);
    const result = stmt.run(today);
    return result.changes || 0;
  },

  // 创建/更新课程
  setBookingCourse: async (course) => {
    // Default subcategory based on category
    let subcategoryId = course.subcategory_id;
    if (!subcategoryId && course.category_id) {
      subcategoryId = course.category_id === 'cat_snow' ? 'sub_changxun' : 'sub_indoor';
    }
    if (USE_TURSO) {
      await tursoClient.execute({
        sql: `INSERT OR REPLACE INTO booking_courses (id, subcategory_id, category_id, name, cover_image, description, price, duration, start_date, end_date, max_students, enabled, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          course.id, subcategoryId, course.category_id || null, course.name, course.cover_image || null,
          course.description || null, course.price || 0, course.duration || null,
          course.start_date || null, course.end_date || null,
          course.max_students || 20, course.enabled !== false ? 1 : 0,
          course.created_at || new Date().toISOString()
        ]
      });
    } else {
      getLocalDb().prepare(`INSERT OR REPLACE INTO booking_courses (id, subcategory_id, category_id, name, cover_image, description, price, duration, start_date, end_date, max_students, enabled, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        course.id, subcategoryId, course.category_id || null, course.name, course.cover_image || null,
        course.description || null, course.price || 0, course.duration || null,
        course.start_date || null, course.end_date || null,
        course.max_students || 20, course.enabled !== false ? 1 : 0,
        course.created_at || new Date().toISOString()
      );
    }
  },

  // 获取课程表单字段
  getBookingFormFields: async (courseId) => {
    if (USE_TURSO) {
      const result = await tursoClient.execute({
        sql: 'SELECT * FROM booking_form_fields WHERE course_id = ? ORDER BY sort_order',
        args: [courseId]
      });
      return result.rows || [];
    }
    return getLocalDb().prepare('SELECT * FROM booking_form_fields WHERE course_id = ? ORDER BY sort_order').all(courseId);
  },

  // 创建/更新表单字段
  setBookingFormField: async (field) => {
    if (USE_TURSO) {
      await tursoClient.execute({
        sql: `INSERT OR REPLACE INTO booking_form_fields (id, course_id, field_name, field_type, field_label, options, option_prices, price, required, sort_order, condition, multiplier, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          field.id, field.course_id, field.field_name, field.field_type || 'text',
          field.field_label, field.options || null, field.option_prices ? JSON.stringify(field.option_prices) : null,
          field.price || 0, field.required ? 1 : 0, field.sort_order || 0, field.condition || null, field.multiplier || 1.0, field.created_at || new Date().toISOString()
        ]
      });
    } else {
      getLocalDb().prepare(`INSERT OR REPLACE INTO booking_form_fields (id, course_id, field_name, field_type, field_label, options, option_prices, price, required, sort_order, condition, multiplier, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        field.id, field.course_id, field.field_name, field.field_type || 'text',
        field.field_label, field.options || null, field.option_prices ? JSON.stringify(field.option_prices) : null,
        field.price || 0, field.required ? 1 : 0, field.sort_order || 0, field.condition || null, field.multiplier || 1.0, field.created_at || new Date().toISOString()
      );
    }
  },

  // 删除表单字段
  deleteBookingFormField: async (fieldId) => {
    if (USE_TURSO) {
      await tursoClient.execute({ sql: 'DELETE FROM booking_form_fields WHERE id = ?', args: [fieldId] });
    } else {
      getLocalDb().prepare('DELETE FROM booking_form_fields WHERE id = ?').run(fieldId);
    }
  },

  // 创建约课记录
  createBookingRecord: async (record) => {
    if (USE_TURSO) {
      await tursoClient.execute({
        sql: `INSERT INTO booking_records (id, course_id, course_name, subcategory_name, category_name, student_name, phone, form_data, total_price, booking_date, course_start_date, course_end_date, status, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          record.id, record.course_id, record.course_name, record.subcategory_name || '',
          record.category_name || '', record.student_name, record.phone || '',
          JSON.stringify(record.form_data || {}), record.total_price || 0,
          record.booking_date, record.course_start_date || '', record.course_end_date || '',
          record.status || 'pending', new Date().toISOString()
        ]
      });
    } else {
      getLocalDb().prepare(`INSERT INTO booking_records (id, course_id, course_name, subcategory_name, category_name, student_name, phone, form_data, total_price, booking_date, course_start_date, course_end_date, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        record.id, record.course_id, record.course_name, record.subcategory_name || '',
        record.category_name || '', record.student_name, record.phone || '',
        JSON.stringify(record.form_data || {}), record.total_price || 0,
        record.booking_date, record.course_start_date || '', record.course_end_date || '',
        record.status || 'pending', new Date().toISOString()
      );
    }
  },

  // 获取约课记录（支持按日期范围、课程筛选）
  getBookingRecords: async (filters = {}) => {
    if (USE_TURSO) {
      let sql = 'SELECT * FROM booking_records WHERE 1=1';
      const args = [];
      if (filters.course_id) {
        sql += ' AND course_id = ?';
        args.push(filters.course_id);
      }
      if (filters.booking_date) {
        sql += ' AND booking_date = ?';
        args.push(filters.booking_date);
      }
      if (filters.start_date) {
        sql += ' AND booking_date >= ?';
        args.push(filters.start_date);
      }
      if (filters.end_date) {
        sql += ' AND booking_date <= ?';
        args.push(filters.end_date);
      }
      if (filters.student_name) {
        sql += ' AND student_name LIKE ?';
        args.push('%' + filters.student_name + '%');
      }
      sql += ' ORDER BY created_at DESC';
      if (filters.limit) {
        sql += ' LIMIT ?';
        args.push(filters.limit);
      }
      const result = await tursoClient.execute({ sql, args });
      return result.rows || [];
    }
    let sql = 'SELECT * FROM booking_records WHERE 1=1';
    const params = [];
    if (filters.course_id) {
      sql += ' AND course_id = ?';
      params.push(filters.course_id);
    }
    if (filters.booking_date) {
      sql += ' AND booking_date = ?';
      params.push(filters.booking_date);
    }
    if (filters.start_date) {
      sql += ' AND booking_date >= ?';
      params.push(filters.start_date);
    }
    if (filters.end_date) {
      sql += ' AND booking_date <= ?';
      params.push(filters.end_date);
    }
    if (filters.student_name) {
      sql += ' AND student_name LIKE ?';
      params.push('%' + filters.student_name + '%');
    }
    sql += ' ORDER BY created_at DESC';
    if (filters.limit) {
      sql += ' LIMIT ?';
      params.push(filters.limit);
    }
    return getLocalDb().prepare(sql).all(...params);
  },

  // 删除课程
  deleteBookingCourse: async (courseId) => {
    if (USE_TURSO) {
      await tursoClient.execute({ sql: 'DELETE FROM booking_form_fields WHERE course_id = ?', args: [courseId] });
      await tursoClient.execute({ sql: 'DELETE FROM booking_courses WHERE id = ?', args: [courseId] });
    } else {
      getLocalDb().prepare('DELETE FROM booking_form_fields WHERE course_id = ?').run(courseId);
      getLocalDb().prepare('DELETE FROM booking_courses WHERE id = ?').run(courseId);
    }
  },

  // 更新课程（包括状态）
  updateBookingCourse: async (courseId, data) => {
    if (USE_TURSO) {
      let sql = 'UPDATE booking_courses SET ';
      const args = [];
      const updates = [];
      if (data.status !== undefined) { updates.push('status = ?'); args.push(data.status); }
      if (data.name !== undefined) { updates.push('name = ?'); args.push(data.name); }
      if (data.price !== undefined) { updates.push('price = ?'); args.push(data.price); }
      if (data.enabled !== undefined) { updates.push('enabled = ?'); args.push(data.enabled); }
      if (updates.length === 0) return;
      sql += updates.join(', ') + ' WHERE id = ?';
      args.push(courseId);
      await tursoClient.execute({ sql, args });
    } else {
      let sql = 'UPDATE booking_courses SET ';
      const args = [];
      const updates = [];
      if (data.status !== undefined) { updates.push('status = ?'); args.push(data.status); }
      if (data.name !== undefined) { updates.push('name = ?'); args.push(data.name); }
      if (data.price !== undefined) { updates.push('price = ?'); args.push(data.price); }
      if (data.enabled !== undefined) { updates.push('enabled = ?'); args.push(data.enabled); }
      if (updates.length === 0) return;
      sql += updates.join(', ') + ' WHERE id = ?';
      args.push(courseId);
      getLocalDb().prepare(sql).run(...args);
    }
  },
  
  // 更新预约记录
  updateBookingRecord: async (id, data) => {
    if (USE_TURSO) {
      let sql = 'UPDATE booking_records SET ';
      const args = [];
      const updates = [];
      if (data.status !== undefined) { updates.push('status = ?'); args.push(data.status); }
      if (data.student_name !== undefined) { updates.push('student_name = ?'); args.push(data.student_name); }
      if (data.phone !== undefined) { updates.push('phone = ?'); args.push(data.phone); }
      if (data.booking_date !== undefined) { updates.push('booking_date = ?'); args.push(data.booking_date); }
      if (data.form_data !== undefined) { updates.push('form_data = ?'); args.push(typeof data.form_data === 'string' ? data.form_data : JSON.stringify(data.form_data)); }
      if (updates.length === 0) return;
      sql += updates.join(', ') + ' WHERE id = ?';
      args.push(id);
      await tursoClient.execute({ sql, args });
      return { success: true };
    }
    let sql = 'UPDATE booking_records SET ';
    const args = [];
    const updates = [];
    if (data.status !== undefined) { updates.push('status = ?'); args.push(data.status); }
    if (data.student_name !== undefined) { updates.push('student_name = ?'); args.push(data.student_name); }
    if (data.phone !== undefined) { updates.push('phone = ?'); args.push(data.phone); }
    if (data.booking_date !== undefined) { updates.push('booking_date = ?'); args.push(data.booking_date); }
    if (data.form_data !== undefined) { updates.push('form_data = ?'); args.push(typeof data.form_data === 'string' ? data.form_data : JSON.stringify(data.form_data)); }
    if (updates.length === 0) return;
    sql += updates.join(', ') + ' WHERE id = ?';
    args.push(id);
    return getLocalDb().prepare(sql).run(...args);
  },
  
  // 删除预约记录
  deleteBookingRecord: async (id) => {
    if (USE_TURSO) {
      await tursoClient.execute({ sql: 'DELETE FROM booking_records WHERE id = ?', args: [id] });
      return { success: true };
    }
    return getLocalDb().prepare('DELETE FROM booking_records WHERE id = ?').run(id);
  },
  
  // 获取单个预约记录
  getBookingRecord: async (id) => {
    if (USE_TURSO) {
      const result = await tursoClient.execute({ sql: 'SELECT * FROM booking_records WHERE id = ?', args: [id] });
      return result.rows && result.rows[0];
    }
    return getLocalDb().prepare('SELECT * FROM booking_records WHERE id = ?').get(id);
  },

  // Profile Fields CRUD
  getProfileFields: async () => {
    if (USE_TURSO) {
      const result = await tursoClient.execute('SELECT * FROM profile_fields ORDER BY sort_order');
      return result.rows || [];
    }
    return getLocalDb().prepare('SELECT * FROM profile_fields ORDER BY sort_order').all();
  },

  getProfileField: async (id) => {
    if (USE_TURSO) {
      const result = await tursoClient.execute({ sql: 'SELECT * FROM profile_fields WHERE id = ?', args: [id] });
      return result.rows && result.rows[0];
    }
    return getLocalDb().prepare('SELECT * FROM profile_fields WHERE id = ?').get(id);
  },

  setProfileField: async (field) => {
    if (USE_TURSO) {
      await tursoClient.execute({
        sql: `INSERT OR REPLACE INTO profile_fields (id, field_label, field_type, placeholder, hint, sort_order, required, options)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [field.id, field.field_label, field.field_type || 'text', field.placeholder || '', field.hint || '', field.sort_order || 0, field.required ? 1 : 0, field.options || '']
      });
    } else {
      getLocalDb().prepare(`INSERT OR REPLACE INTO profile_fields (id, field_label, field_type, placeholder, hint, sort_order, required, options)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
        field.id, field.field_label, field.field_type || 'text', field.placeholder || '', field.hint || '', field.sort_order || 0, field.required ? 1 : 0, field.options || ''
      );
    }
    return { success: true };
  },

  deleteProfileField: async (id) => {
    if (USE_TURSO) {
      await tursoClient.execute({ sql: 'DELETE FROM profile_fields WHERE id = ?', args: [id] });
    } else {
      getLocalDb().prepare('DELETE FROM profile_fields WHERE id = ?').run(id);
    }
    return { success: true };
  },

  // 获取家庭成员档案
  getFamilyProfiles: async (phone) => {
    if (USE_TURSO) {
      const result = await tursoClient.execute({ sql: "SELECT * FROM family_profiles WHERE user_phone = ? ORDER BY created_at DESC", args: [phone] });
      return result.rows || [];
    } else {
      return getLocalDb().all("SELECT * FROM family_profiles WHERE user_phone = ? ORDER BY created_at DESC", [phone]);
    }
  },

  // 获取家庭成员档案数量
  getFamilyProfileCount: async (phone) => {
    if (USE_TURSO) {
      const result = await tursoClient.execute({ sql: "SELECT COUNT(*) as count FROM family_profiles WHERE user_phone = ? AND status = 'active'", args: [phone] });
      return result.rows && result.rows[0] ? result.rows[0].count : 0;
    } else {
      const row = getLocalDb().get("SELECT COUNT(*) as count FROM family_profiles WHERE user_phone = ? AND status = 'active'", [phone]);
      return row ? row.count : 0;
    }
  },

  // 添加家庭成员档案
  addFamilyProfile: async (data) => {
    const { user_phone, name, gender, id_card, age, phone, height, weight, school, grade, relation, slot, role_name } = data;
    if (!user_phone) return { success: false, error: '缺少用户手机号' };
    // 检查数量限制（至多4个）
    const count = await db.getFamilyProfileCount(user_phone);
    if (count >= 4) return { success: false, error: '最多添加4个家庭成员档案' };
    // 身份证号不能重复
    if (id_card) {
      let existing;
      if (USE_TURSO) {
        const result = await tursoClient.execute({ sql: "SELECT id FROM family_profiles WHERE id_card = ? AND user_phone = ? AND status = 'active'", args: [id_card, user_phone] });
        existing = result.rows && result.rows[0];
      } else {
        existing = getLocalDb().get("SELECT id FROM family_profiles WHERE id_card = ? AND user_phone = ? AND status = 'active'", [id_card, user_phone]);
      }
      if (existing) return { success: false, error: '该身份证号已添加过' };
    }
    if (USE_TURSO) {
      await tursoClient.execute({
        sql: `INSERT INTO family_profiles (user_phone, name, gender, id_card, age, phone, height, weight, school, grade, relation, role_name, slot, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
        args: [user_phone, name, gender, id_card, age, phone, height, weight, school, grade, relation || '', role_name || '', slot || 0]
      });
    } else {
      getLocalDb().prepare(`INSERT INTO family_profiles (user_phone, name, gender, id_card, age, phone, height, weight, school, grade, relation, role_name, slot, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`).run(user_phone, name, gender, id_card, age, phone, height, weight, school, grade, relation || '', role_name || '', slot || 0);
    }
    return { success: true };
  },

  // 按槽位获取档案
  getFamilyProfileBySlot: async (phone, slot) => {
    if (USE_TURSO) {
      const result = await tursoClient.execute({ sql: "SELECT * FROM family_profiles WHERE user_phone = ? AND slot = ? AND status = 'active'", args: [phone, slot] });
      return result.rows && result.rows[0] || null;
    } else {
      return getLocalDb().get("SELECT * FROM family_profiles WHERE user_phone = ? AND slot = ? AND status = 'active'", [phone, slot]);
    }
  },

  // 更新槽位档案
  updateFamilyProfileSlot: async (id, data) => {
    const { name, phone, id_card, gender, age, height, weight, school, grade, role_name } = data;
    if (USE_TURSO) {
      await tursoClient.execute({ sql: `UPDATE family_profiles SET name=?, phone=?, id_card=?, gender=?, age=?, height=?, weight=?, school=?, grade=?, role_name=? WHERE id=?`, args: [name, phone, id_card, gender, age, height, weight, school, grade, role_name || '', id] });
    } else {
      getLocalDb().prepare(`UPDATE family_profiles SET name=?, phone=?, id_card=?, gender=?, age=?, height=?, weight=?, school=?, grade=?, role_name=? WHERE id=?`).run(name, phone, id_card, gender, age, height, weight, school, grade, role_name || '', id);
    }
  },

  // 删除槽位档案
  deleteFamilyProfileBySlot: async (phone, slot) => {
    if (USE_TURSO) {
      await tursoClient.execute({ sql: "UPDATE family_profiles SET status='deleted' WHERE user_phone = ? AND slot = ?", args: [phone, slot] });
    } else {
      getLocalDb().prepare("UPDATE family_profiles SET status='deleted' WHERE user_phone = ? AND slot = ?").run(phone, slot);
    }
  },

  // 获取档案请求列表
  getProfileRequests: async (status) => {
    if (USE_TURSO) {
      let sql = "SELECT * FROM profile_requests WHERE 1=1";
      const args = [];
      if (status && status !== 'all') {
        sql += " AND status = ?";
        args.push(status);
      }
      sql += " ORDER BY created_at DESC";
      const result = await tursoClient.execute({ sql, args });
      return result.rows || [];
    } else {
      let sql = "SELECT * FROM profile_requests WHERE 1=1";
      const params = [];
      if (status && status !== 'all') {
        sql += " AND status = ?";
        params.push(status);
      }
      sql += " ORDER BY created_at DESC";
      return getLocalDb().all(sql, params);
    }
  },

  // 添加档案请求
  addProfileRequest: async (data) => {
    const { user_phone, profile_id, request_type, field_name, old_value, new_value, reason } = data;
    if (!user_phone || !request_type) return { success: false, error: '缺少必要参数' };
    if (USE_TURSO) {
      await tursoClient.execute({
        sql: `INSERT INTO profile_requests (user_phone, profile_id, request_type, field_name, old_value, new_value, reason, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
        args: [user_phone, profile_id, request_type, field_name, old_value, new_value, reason]
      });
    } else {
      getLocalDb().prepare(`INSERT INTO profile_requests (user_phone, profile_id, request_type, field_name, old_value, new_value, reason, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`).run(user_phone, profile_id, request_type, field_name, old_value, new_value, reason);
    }
    return { success: true };
  },

  // 处理档案请求
  processProfileRequest: async (requestId, data) => {
    const { status, admin_note } = data;
    if (!['approved', 'rejected'].includes(status)) {
      return { success: false, error: '无效的操作' };
    }
    let request;
    if (USE_TURSO) {
      const result = await tursoClient.execute({ sql: "SELECT * FROM profile_requests WHERE id = ?", args: [requestId] });
      request = result.rows && result.rows[0];
    } else {
      request = getLocalDb().get("SELECT * FROM profile_requests WHERE id = ?", [requestId]);
    }
    if (!request) return { success: false, error: '请求不存在' };
    if (request.status !== 'pending') return { success: false, error: '请求已处理' };
    // 更新请求状态
    if (USE_TURSO) {
      await tursoClient.execute({ sql: "UPDATE profile_requests SET status = ?, admin_note = ?, processed_at = datetime('now') WHERE id = ?", args: [status, admin_note || '', requestId] });
    } else {
      getLocalDb().prepare("UPDATE profile_requests SET status = ?, admin_note = ?, processed_at = datetime('now', 'localtime') WHERE id = ?").run(status, admin_note || '', requestId);
    }
    // 如果是批准，修改档案
    if (status === 'approved' && request.profile_id) {
      const { field_name, new_value } = request;
      if (field_name && new_value !== undefined) {
        if (USE_TURSO) {
          await tursoClient.execute({ sql: `UPDATE family_profiles SET ${field_name} = ? WHERE id = ?`, args: [new_value, request.profile_id] });
        } else {
          getLocalDb().prepare(`UPDATE family_profiles SET ${field_name} = ? WHERE id = ?`).run(new_value, request.profile_id);
        }
      }
    }
    return { success: true };
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
