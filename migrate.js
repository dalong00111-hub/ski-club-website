/**
 * 数据迁移脚本：从 JSON 文件迁移到 SQLite
 * 使用方法: node migrate.js
 */

const fs = require('fs');
const path = require('path');
const { db, setContent, setUser } = require('./db');

console.log('🚀 开始数据迁移...\n');

// 读取现有JSON数据
const contentPath = path.join(__dirname, 'data', 'content.json');
const usersPath = path.join(__dirname, 'data', 'users.json');

const content = JSON.parse(fs.readFileSync(contentPath, 'utf-8'));
const users = JSON.parse(fs.readFileSync(usersPath, 'utf-8'));

// 迁移 content.json 中的主要字段
const contentMappings = {
  'club': content.club,
  'header': content.header,
  'hero': content.hero,
  'founder': content.founder,
  'menu': content.menu,
  'courses': content.courses,
  'quiz': content.quiz,
  'apply': content.apply,
  'coupons': content.coupons,
  'coursesPage': content.coursesPage,
  'activities': content.activities,
  'recommendationRules': content.recommendationRules,
  'lottery': {
    enabled: content.lottery.enabled,
    prizes: content.lottery.prizes,
    records: content.lottery.records,
    rules: content.lottery.rules,
    formFields: content.lottery.formFields,
    settings: content.lottery.settings,
    history: content.lottery.history,
    name: content.lottery.name,
    drawn: content.lottery.drawn
  },
  'recommendRules': content.recommendRules
};

let migrated = 0;
for (const [key, value] of Object.entries(contentMappings)) {
  try {
    setContent(key, value);
    migrated++;
    console.log(`✅ 迁移 content.${key}`);
  } catch (e) {
    console.log(`❌ 迁移 content.${key} 失败:`, e.message);
  }
}

// 迁移运动员
if (content.athletes && Array.isArray(content.athletes)) {
  const athleteStmt = db.prepare(`
    INSERT OR REPLACE INTO athletes (id, name, level, image, video) VALUES (?, ?, ?, ?, ?)
  `);
  for (const athlete of content.athletes) {
    athleteStmt.run(athlete.id, athlete.name, athlete.level, athlete.image, athlete.video || null);
  }
  console.log(`✅ 迁移 ${content.athletes.length} 个运动员`);
}

// 迁移基地
if (content.bases && Array.isArray(content.bases)) {
  const baseStmt = db.prepare(`
    INSERT OR REPLACE INTO bases (id, name, description, image) VALUES (?, ?, ?, ?)
  `);
  for (const base of content.bases) {
    baseStmt.run(base.id, base.name, base.description, base.image);
  }
  console.log(`✅ 迁移 ${content.bases.length} 个基地`);
}

// 迁移课程
if (content.courses) {
  const courseStmt = db.prepare(`
    INSERT OR REPLACE INTO courses (id, title, icon, type, tag, featured, content, sub_courses, table_link)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const [type, courses] of Object.entries(content.courses)) {
    if (Array.isArray(courses)) {
      for (const c of courses) {
        courseStmt.run(
          c.id,
          c.title,
          c.icon,
          c.type,
          c.tag || null,
          c.featured ? 1 : 0,
          JSON.stringify(c.content),
          JSON.stringify(c.subCourses || []),
          c.tableLink || null
        );
      }
    }
  }
  console.log(`✅ 迁移课程数据`);
}

// 迁移用户
let userCount = 0;
for (const [phone, user] of Object.entries(users)) {
  if (typeof user === 'object' && user !== null) {
    try {
      setUser(phone, user);
      userCount++;
    } catch (e) {
      // 跳过无效用户数据
    }
  }
}
console.log(`✅ 迁移 ${userCount} 个用户`);

// 迁移问答提交
if (content.quizSubmissions && Array.isArray(content.quizSubmissions)) {
  const quizStmt = db.prepare(`
    INSERT INTO quiz_submissions (id, answers, recommended_courses, submitted_at)
    VALUES (?, ?, ?, ?)
  `);
  for (const q of content.quizSubmissions) {
    quizStmt.run(
      q.id,
      JSON.stringify(q.answers),
      JSON.stringify(q.recommendedCourses || []),
      q.submittedAt
    );
  }
  console.log(`✅ 迁移 ${content.quizSubmissions.length} 条问答记录`);
}

console.log('\n✨ 迁移完成！');
console.log(`📁 数据库位置: ${path.join(__dirname, 'data', 'ski-club.db')}`);
