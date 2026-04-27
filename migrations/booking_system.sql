-- 约课系统数据库结构

-- 主分类：雪季训练 / 非雪季训练
CREATE TABLE IF NOT EXISTS booking_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- 子分类：常训、外训、比赛、室内滑雪机、陆地冲浪、户外拓展
CREATE TABLE IF NOT EXISTS booking_subcategories (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL,
  name TEXT NOT NULL,
  icon TEXT,
  cover_image TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (category_id) REFERENCES booking_categories(id)
);

-- 课程：具体课程内容
CREATE TABLE IF NOT EXISTS booking_courses (
  id TEXT PRIMARY KEY,
  subcategory_id TEXT NOT NULL,
  name TEXT NOT NULL,
  cover_image TEXT,
  description TEXT,
  price REAL DEFAULT 0,
  duration TEXT,
  max_students INTEGER DEFAULT 20,
  enabled INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (subcategory_id) REFERENCES booking_subcategories(id)
);

-- 课程表单字段：动态配置每个课程的表单选项
CREATE TABLE IF NOT EXISTS booking_form_fields (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL,
  field_name TEXT NOT NULL,
  field_type TEXT DEFAULT 'text',
  field_label TEXT NOT NULL,
  options TEXT,
  price REAL DEFAULT 0,
  required INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (course_id) REFERENCES booking_courses(id)
);

-- 约课记录：所有用户的预约信息
CREATE TABLE IF NOT EXISTS booking_records (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL,
  course_name TEXT NOT NULL,
  subcategory_name TEXT,
  category_name TEXT,
  student_name TEXT NOT NULL,
  phone TEXT,
  form_data TEXT,
  total_price REAL DEFAULT 0,
  booking_date TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (course_id) REFERENCES booking_courses(id)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_booking_subcat ON booking_subcategories(category_id);
CREATE INDEX IF NOT EXISTS idx_booking_course ON booking_courses(subcategory_id);
CREATE INDEX IF NOT EXISTS idx_booking_form ON booking_form_fields(course_id);
CREATE INDEX IF NOT EXISTS idx_booking_records ON booking_records(booking_date);
CREATE INDEX IF NOT EXISTS idx_booking_records_course ON booking_records(course_id);

-- 插入主分类
INSERT OR IGNORE INTO booking_categories (id, name, icon, sort_order) VALUES 
  ('cat_snow', '雪季训练', '❄️', 1),
  ('cat_off', '非雪季训练', '☀️', 2);

-- 插入子分类
INSERT OR IGNORE INTO booking_subcategories (id, category_id, name, icon, sort_order) VALUES 
  ('sub_changxun', 'cat_snow', '常训', '🎿', 1),
  ('sub_waixun', 'cat_snow', '外训', '🏔️', 2),
  ('sub_bisai_snow', 'cat_snow', '比赛', '🏆', 3),
  ('sub_indoor', 'cat_off', '室内滑雪机', '🎮', 1),
  ('sub_surf', 'cat_off', '陆地冲浪', '🏄', 2),
  ('sub_outdoor', 'cat_off', '户外拓展', '⛺', 3),
  ('sub_waixun_off', 'cat_off', '外训', '🏔️', 4),
  ('sub_bisai_off', 'cat_off', '比赛', '🏆', 5);
