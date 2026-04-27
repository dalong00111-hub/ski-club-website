#!/usr/bin/env node
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;

// 数据库
const { db, getContent, setContent, getUsers, setUser, getUser } = require('./db.js');

// 用户数据缓存（模块级别）
let users = {};

// 加载用户数据 → 从SQLite
async function loadUsers() {
  try {
    users = await getUsers();
  } catch (e) { console.log('加载用户数据失败:', e.message); }
}

// 保存用户数据 → 写入SQLite
function saveUsers() {
  try {
    for (const [phone, user] of Object.entries(users)) {
      setUser(phone, user);
    }
  } catch (e) { console.log('保存用户数据失败:', e.message); }
}

// 初始化加载
loadUsers().then(() => {
  // 超级管理员账号 - 只在用户不存在时创建
  if (!users['18003411633']) {
    users['18003411633'] = { name: '18003411633', password: 'ZWL6020359', avatar: '👤', isSuperAdmin: true, role: 'superadmin', createdAt: new Date().toISOString() };
  } else {
    // 确保超级管理员标志存在
    users['18003411633'].isSuperAdmin = true;
    users['18003411633'].role = 'superadmin';
  }
});
const smsCodes = {};
const qrSessions = {};

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // No cache for HTML files to force refresh after updates
  if (req.url.endsWith('.html')) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Excel文件上传与解析端点
  if (req.method === 'POST' && req.url === '/upload-excel') {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      const buffer = Buffer.concat(chunks);
      const boundary = req.headers['content-type'] && req.headers['content-type'].split('boundary=')[1];
      if (!boundary) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'No boundary' }));
        return;
      }

      const str = buffer.toString('binary');
      const parts = str.split('--' + boundary);
      for (const part of parts) {
        if (part.indexOf('filename=') !== -1) {
          const fnMatch = part.match(/filename="([^"]+)"/);
          const filename = fnMatch ? fnMatch[1] : 'upload_' + Date.now() + '.xlsx';
          const ext = path.extname(filename);
          const newFilename = 'excel_' + Date.now() + ext;
          const uploadPath = path.join(__dirname, 'uploads', newFilename);
          
          const headerEnd = part.indexOf('\r\n\r\n') + 4;
          const lastIndex = part.lastIndexOf('\r\n');
          const fileData = part.substring(headerEnd, lastIndex);
          
          fs.writeFileSync(uploadPath, fileData, 'binary');
          
          // 解析Excel文件
          const { execSync } = require('child_process');
          try {
            const result = execSync(`python3 ${path.join(__dirname, 'parse_excel.py')} "${uploadPath}"`, { encoding: 'utf-8', stderr: 'pipe' });
            const activities = JSON.parse(result);
            if (activities.error) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: activities.error }));
            } else {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(activities));
            }
          } catch (err) {
            var errMsg = err.stderr ? err.stderr.toString() : err.message;
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: '解析失败: ' + errMsg }));
          } finally {
            try { fs.unlinkSync(uploadPath); } catch (e) {}
          }
          return;
        }
      }
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'No file found' }));
    });
    return;
  }

  // WPS在线表格导入
  if (req.method === 'POST' && req.url === '/import-wps') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { url } = JSON.parse(body);
        if (!url) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: '请提供WPS链接' }));
          return;
        }
        const { execSync } = require('child_process');
        try {
          const result = execSync(`python3 ${path.join(__dirname, 'parse_wps.py')} "${url}"`, { encoding: 'utf-8', timeout: 20000 });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(result);
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: '解析失败: ' + err.message }));
        }
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: '请求格式错误' }));
      }
    });
    return;
  }
  // API: 保存内容 (POST)
  if (req.method === 'POST' && (req.url.split('?')[0] === '/data/content.json' || req.url.split('?')[0] === '/api/save-content')) {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        JSON.parse(body);
        // 写入SQLite
        const fullContent = JSON.parse(body);
        await setContent('_full', fullContent);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
        console.log('✅ 内容已保存', new Date().toLocaleTimeString());
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // API: 读取内容 (GET)
  if (req.method === 'GET' && req.url === '/api/content') {
    (async () => {
      try {
        const content = await getContent('_full');
        const parsed = content ? JSON.parse(content) : {};
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(parsed));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    })();
    return;
  }

  // 文件上传端点
  if (req.method === 'POST' && req.url === '/upload') {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      const buffer = Buffer.concat(chunks);
      const boundary = req.headers['content-type'] && req.headers['content-type'].split('boundary=')[1];
      if (!boundary) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'No boundary' }));
        return;
      }

      const str = buffer.toString('binary');
      const parts = str.split('--' + boundary);
      for (const part of parts) {
        if (part.indexOf('filename=') !== -1) {
          const fnMatch = part.match(/filename="([^"]+)"/);
          const filename = fnMatch ? fnMatch[1] : 'upload_' + Date.now();
          const ext = path.extname(filename);
          const newFilename = 'course_' + Date.now() + ext;
          const uploadPath = path.join(__dirname, 'uploads', newFilename);
          
          const headerEnd = part.indexOf('\r\n\r\n') + 4;
          const lastIndex = part.lastIndexOf('\r\n');
          const fileData = part.substring(headerEnd, lastIndex);
          
          fs.writeFileSync(uploadPath, fileData, 'binary');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, url: 'uploads/' + newFilename, filename: newFilename }));
          return;
        }
      }
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'No file found' }));
    });
    return;
  }

  // API: 获取课程表链接 (放在文件服务之前)
  if (req.method === 'GET' && req.url.startsWith('/api/course-table/')) {
    const courseId = req.url.split('/api/course-table/')[1];
    const contentData = getContent('_full');
    const snowCourse = contentData.courses?.snow?.find(c => c.id === courseId);
    const offseasonCourse = contentData.courses?.offseason?.find(c => c.id === courseId);
    const course = snowCourse || offseasonCourse;
    if (course) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, tableLink: course.tableLink || '' }));
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: '课程不存在' }));
    }
    return;
  }

  // API: 获取推荐规则
  if (req.method === 'GET' && req.url === '/api/rules') {
    const contentData = getContent('_full');
    const rules = contentData.recommendRules || [];
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, rules: rules }));
    return;
  }

  // API: 获取活动列表
  if (req.method === 'GET' && req.url === '/api/activities') {
    const contentData = getContent('_full');
    const activities = contentData.activities || [];
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, activities: activities }));
    return;
  }

  // API: 获取单个活动
  if (req.method === 'GET' && req.url.startsWith('/api/activity/')) {
    const activityId = req.url.split('/api/activity/')[1];
    const contentData = getContent('_full');
    const activity = (contentData.activities || []).find(a => a.id === activityId || a.title === activityId);
    if (activity) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, activity: activity }));
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: '活动不存在' }));
    }
    return;
  }


  // ==================== 用户认证 API ====================
  // 注册账号
  if (req.method === 'POST' && req.url === '/api/register') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { phone, password, nickname, role } = JSON.parse(body);
        if (!phone || !password) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: '请输入手机号和密码' }));
          return;
        }
        if (!/^1[3-9]\d{9}$/.test(phone) || password.length < 6) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: '手机号格式错误或密码少于6位' }));
          return;
        }
        if (users[phone]) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: '该手机号已注册' }));
          return;
        }
        // 简单密码存储（实际应用应加密）
        users[phone] = { 
          name: nickname || phone, 
          password: password, 
          avatar: '👤', 
          role: role || 'user',
          createdAt: new Date().toISOString() 
        };
        saveUsers();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, user: { name: nickname || phone, avatar: '👤', isSuperAdmin: false } }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: '注册失败' }));
      }
    });
    return;
  }

  // 发送验证码
  if (req.method === 'POST' && req.url === '/api/send-code') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { phone } = JSON.parse(body);
        if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: '请输入正确的手机号' }));
          return;
        }
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        smsCodes[phone] = { code, expiresAt: Date.now() + 60000 };
        console.log(`[短信] ${phone} 验证码: ${code}`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: '验证码已发送', debugCode: code }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: '请求格式错误' }));
      }
    });
    return;
  }

  // 用户登录
  if (req.method === 'POST' && req.url === '/api/login') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { phone, code, type, password } = JSON.parse(body);
        if (type === 'wechat') {
          const user = { name: '微信用户', avatar: '🐱', wechat: '已绑定', openid: 'wx_' + Date.now(), createdAt: new Date().toISOString() };
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, user }));
          return;
        }
        

// 账号密码登录
        if (phone && password) {
          const user = users[phone];
          if (!user) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: '账号不存在' }));
            return;
          }
          if (user.password !== password) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: '密码错误' }));
            return;
          }
          // 检查是否是管理员或超级管理员
          if (user.role !== 'admin' && user.role !== 'superadmin') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: '您没有后台管理权限' }));
            return;
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, user: { name: user.name, avatar: user.avatar, phone: phone, role: user.role || 'user', permissions: user.permissions || {}, isSuperAdmin: user.role === 'superadmin' || false } }));
          return;
        }
        
        if (!phone || !code) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: '请输入手机号和验证码' }));
          return;
        }
        const stored = smsCodes[phone];
        if (!stored || stored.code !== code) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: '验证码错误或已过期' }));
          return;
        }
        if (Date.now() > stored.expiresAt) {
          delete smsCodes[phone];
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: '验证码已过期' }));
          return;
        }
        delete smsCodes[phone];
        if (!users[phone]) {
          users[phone] = { name: '用户' + phone.slice(-4), phone, avatar: '👤', createdAt: new Date().toISOString() };
          saveUsers();
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, user: { name: users[phone].name, avatar: users[phone].avatar, phone: phone, role: users[phone].role || 'user', permissions: users[phone].permissions || {}, isSuperAdmin: users[phone].role === 'superadmin' } }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: '登录失败' }));
      }
    });
    return;
  }

  // QR码状态查询
  if (req.method === 'GET' && req.url.startsWith('/api/qr-status')) {
    const urlObj = new URL(req.url, 'http://localhost');
    const token = urlObj.searchParams.get('token');
    
    if (qrSessions[token]) {
      const session = qrSessions[token];
      if (session.confirmed) {
        delete qrSessions[token];
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, loggedIn: true, user: session.user }));
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, loggedIn: false, scanned: session.scanned || false }));
      }
    } else {
      qrSessions[token] = { createdAt: Date.now(), scanned: false };
      
      // 模拟：3秒后自动设置scanned为true（模拟扫码）
      setTimeout(function() {
        if (qrSessions[token]) {
          qrSessions[token].scanned = true;
        }
      }, 3000);
      
      // 8秒后模拟确认登录
      setTimeout(function() {
        if (qrSessions[token] && !qrSessions[token].confirmed) {
          qrSessions[token].confirmed = true;
          qrSessions[token].user = { name: '扫码用户', avatar: '🐱', wechat: '已绑定', createdAt: new Date().toISOString() };
        }
      }, 8000);
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, loggedIn: false, scanned: false }));
    }
    return;
  }

  // 手机确认QR登录
  // 更新用户资料接口
// API: 上传头像文件 (POST) - 保存到单独文件
if (req.method === 'POST' && req.url.split('?')[0] === '/api/avatar') {
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    try {
      const { phone, avatar } = JSON.parse(body);
      if (!phone) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: '请提供手机号' }));
        return;
      }
      if (users[phone]) {
        if (avatar) users[phone].avatar = avatar;
        saveUsers();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: '用户不存在' }));
      }
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: '保存失败' }));
    }
  });
  return;
}

// API: 更新用户资料 (POST)
if (req.method === 'POST' && req.url.split('?')[0] === '/api/update-profile') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const { phone, newPhone, name, avatar, password, role, permissions, gender, id_card, age, height, weight, school, grade } = data;
        if (!phone) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: '请提供手机号' }));
          return;
        }
        if (users[phone]) {
          // Auto-calculate gender and age from id_card
          if (id_card !== undefined && id_card.length >= 18) {
            // Gender: 17th digit (index 16) - odd=男, even=女
            const genderDigit = parseInt(id_card.charAt(16));
            users[phone].gender = genderDigit % 2 === 1 ? '男' : '女';
            // Age: calculate from birthdate (digits 6-13, format YYYYMMDD)
            const birthdateStr = id_card.substring(6, 14);
            if (birthdateStr.length === 8) {
              const birthYear = parseInt(birthdateStr.substring(0, 4));
              const birthMonth = parseInt(birthdateStr.substring(4, 6));
              const birthDay = parseInt(birthdateStr.substring(6, 8));
              const today = new Date();
              let calcAge = today.getFullYear() - birthYear;
              const monthDiff = today.getMonth() + 1 - birthMonth;
              const dayDiff = today.getDate() - birthDay;
              if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
                calcAge--;
              }
              users[phone].age = calcAge > 0 ? calcAge : '';
            }
          } else if (gender !== undefined) {
            users[phone].gender = gender;
          }
          if (age !== undefined) users[phone].age = age;
          // Handle phone number change (phone is the key)
        if (newPhone && newPhone !== phone) {
          if (users[newPhone]) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: '该手机号已被使用' }));
            return;
          }
          // Create new entry with new phone
          users[newPhone] = { ...users[phone], name: name || users[phone].name, avatar: avatar || users[phone].avatar, password: password || users[phone].password, role: role || users[phone].role, permissions: permissions || users[phone].permissions, gender: users[phone].gender, id_card: id_card || users[phone].id_card, age: users[phone].age, height: height || users[phone].height, weight: weight || users[phone].weight, school: school || users[phone].school, grade: grade || users[phone].grade };
          if (name) users[newPhone].name = name;
          if (avatar) users[newPhone].avatar = avatar;
          if (password) users[newPhone].password = password;
          if (typeof isSuperAdmin === 'boolean') users[newPhone].isSuperAdmin = isSuperAdmin;
          // Delete old entry
          delete users[phone];
          saveUsers();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
          return;
        }
        
        if (name !== undefined) users[phone].name = name;
        if (avatar !== undefined) users[phone].avatar = avatar;
        if (password !== undefined) users[phone].password = password;
        if (role !== undefined) users[phone].role = role;
        if (permissions !== undefined) users[phone].permissions = permissions;
        if (id_card !== undefined) users[phone].id_card = id_card;
        if (height !== undefined) users[phone].height = height;
        if (weight !== undefined) users[phone].weight = weight;
        if (school !== undefined) users[phone].school = school;
        if (grade !== undefined) users[phone].grade = grade;
        saveUsers();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, user: { name: users[phone].name, avatar: users[phone].avatar, phone: phone, role: users[phone].role || 'user', permissions: users[phone].permissions || {}, isSuperAdmin: users[phone].role === 'superadmin', gender: users[phone].gender, id_card: users[phone].id_card, age: users[phone].age, height: users[phone].height, weight: users[phone].weight, school: users[phone].school, grade: users[phone].grade } }));
        } else {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: '用户不存在' }));
        }
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: '更新失败' }));
      }
    });
    return;
  }



// API: 参与抽奖 (POST)
  if (req.method === 'POST' && req.url === '/api/lottery') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { name, phone } = JSON.parse(body);
        if (!name || !phone) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: '请填写姓名和手机号' }));
          return;
        }
        
        const contentData = getContent('_full');
        let lottery = contentData.lottery;
        if (!lottery) {
          lottery = { records: [], history: [], prizes: [], enabled: true };
          contentData.lottery = lottery;
        }
        
        // 检查是否已参与
        const participated = lottery.records?.some(r => r.phone === phone && !r.won);
        if (participated) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: '您已参与过本次抽奖' }));
          return;
        }
        
        // 添加记录（等待开奖）
        lottery.records = lottery.records || [];
        lottery.records.push({
          name,
          phone,
          time: new Date().toISOString(),
          won: undefined
        });
        
        // 确保用户数据存在
        if (!contentData.users) contentData.users = {};
        if (!contentData.users[phone]) {
          contentData.users[phone] = {
            name: name,
            phone: phone,
            password: '',
            role: 'user',
            myPrizes: []
          };
        }
        
        setContent('_full', contentData);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: '参与成功，等待开奖' }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    });
    return;
  }

// API: 手动开奖 (POST)
  if (req.method === 'POST' && req.url === '/api/lottery/draw') {
    try {
      const contentData = getContent('_full');
      const lottery = contentData.lottery;
      
      if (!lottery || !lottery.records || lottery.records.length === 0) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: '暂无抽奖记录' }));
        return;
      }
      
      if (lottery.drawn) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: '已经开过奖了' }));
        return;
      }
      
      const prizes = lottery.prizes || [];
      if (prizes.length === 0) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: '暂无奖品' }));
        return;
      }
      
      // 执行开奖
      const records = lottery.records;
      records.sort((a, b) => new Date(a.time) - new Date(b.time));
      
      let winners = [];
      records.forEach(record => {
        const rand = Math.random();
        let cumulative = 0;
        let won = false;
        
        for (let p of prizes) {
          cumulative += p.probability || 0;
          if (rand <= cumulative && p.remain > 0) {
            record.won = true;
            record.prize = p.name;
            record.prizeIcon = p.icon;
            record.prizeId = p.id;
            p.remain = Math.max(0, p.remain - 1);
            winners.push(record);
            
            // 添加到用户中奖记录
            const phone = record.phone;
            if (!contentData.users) contentData.users = {};
            if (!contentData.users[phone]) {
              contentData.users[phone] = {
                name: record.name,
                phone: phone,
                password: '',
                role: 'user',
                myPrizes: []
              };
            }
            if (!contentData.users[phone].myPrizes) contentData.users[phone].myPrizes = [];
            contentData.users[phone].myPrizes.push({
              prize: p.name,
              icon: p.icon,
              description: p.description,
              wonAt: new Date().toISOString(),
              lotteryName: lottery.name || '抽奖活动'
            });
            won = true;
            break;
          }
        }
        
        if (!won) {
          record.won = false;
          record.prize = '未中奖';
        }
      });
      
      // 移到历史
      lottery.history = lottery.history || [];
      records.forEach(r => {
        lottery.history.push({
          ...r,
          archivedAt: new Date().toISOString(),
          archivedNote: '手动开奖'
        });
      });
      lottery.records = [];
      lottery.drawn = true;
      
      setContent('_full', contentData);
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, winners: winners.length }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: e.message }));
    }
    return;
  }

  // API: 获取我的奖品 (GET)
  if (req.method === 'GET' && req.url.startsWith('/api/my/prizes')) {
    const phone = req.url.split('/api/my/prizes/')[1] || '';
    if (!phone) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: '请登录' }));
      return;
    }
    try {
      const contentData = getContent('_full');
      const users = contentData.users || {};
      const user = users[phone];
      if (!user) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: '用户不存在' }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, prizes: user.myPrizes || [] }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: e.message }));
    }
    return;
  }

// 问卷提交 API
if (req.method === 'POST' && req.url === '/api/quiz/submit') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
        try {
            const data = JSON.parse(body);
            const contentData = getContent('_full');
            
            if (!contentData.quizSubmissions) contentData.quizSubmissions = [];
            
            const submission = {
                id: Date.now(),
                answers: data.answers || {},
                recommendedCourses: data.recommendedCourses || [],
                submittedAt: new Date().toISOString()
            };
            
            contentData.quizSubmissions.push(submission);
            fs.writeFileSync(CONTENT_FILE, JSON.stringify(contentData, null, 2));
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, id: submission.id }));
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: e.message }));
        }
    });
    return;
}

// 获取问卷统计
if (req.method === 'GET' && req.url.split('?')[0] === '/api/quiz/statistics') {
    try {
        const contentData = getContent('_full');
        const submissions = contentData.quizSubmissions || [];
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: true,
            total: submissions.length,
            submissions: submissions
        }));
    } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: e.message }));
    }
    return;
}

if (req.method === 'POST' && req.url === '/api/qr-confirm') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { token, user } = JSON.parse(body);
        if (qrSessions[token]) {
          qrSessions[token].confirmed = true;
          qrSessions[token].user = user;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false }));
      }
    });
    return;
  }

  // API: 获取用户信息 (GET)
  if (req.method === 'GET' && req.url.startsWith('/api/user/')) {
    let phone = req.url.replace('/api/user/', '').split('?')[0];
    if (phone && users[phone]) {
      const u = users[phone];
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, user: { name: u.name, avatar: u.avatar, phone: phone, role: u.role || 'user', permissions: u.permissions || {}, isSuperAdmin: u.role === 'superadmin', gender: u.gender, id_card: u.id_card, height: u.height, weight: u.weight, school: u.school, grade: u.grade } }));
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: '用户不存在' }));
    }
    return;
  }

  // API: 获取所有用户列表 (GET)
  if (req.method === 'GET' && req.url === '/api/users') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, users: users }));
    return;
  }

  // API: 获取档案字段列表 (GET)
  if (req.method === 'GET' && req.url === '/api/profile-fields') {
    (async () => {
      try {
        const fields = await db.getProfileFields();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, fields: fields }));
      } catch(e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    })();
    return;
  }

  // API: 保存档案字段 (POST)
  if (req.method === 'POST' && req.url === '/api/profile-fields') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const field = JSON.parse(body);
        if (!field.id || !field.field_label) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: '字段ID和名称不能为空' }));
          return;
        }
        await db.setProfileField(field);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch(e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    });
    return;
  }

  // API: 删除档案字段 (DELETE)
  if (req.method === 'DELETE' && req.url.startsWith('/api/profile-fields/')) {
    const id = req.url.replace('/api/profile-fields/', '');
    (async () => {
      try {
        await db.deleteProfileField(id);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch(e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    })();
    return;
  }

  // API: 获取家庭成员档案 (GET)
  if (req.method === 'GET' && req.url === '/api/family-profiles') {
    (async () => {
      try {
        const phone = parsedUrl.query.phone;
        if (!phone) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: '缺少用户手机号' }));
          return;
        }
        const profiles = await db.getFamilyProfiles(phone);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, profiles }));
      } catch(e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    })();
    return;
  }

  // API: 添加家庭成员档案 (POST)
  if (req.method === 'POST' && req.url === '/api/family-profiles') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        (async () => {
          const result = await db.addFamilyProfile(data);
          if (result.success) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
          } else {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
          }
        })();
      } catch(e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    });
    return;
  }

  // API: 获取档案修改请求列表 (GET)
  if (req.method === 'GET' && req.url === '/api/profile-requests') {
    (async () => {
      try {
        const status = parsedUrl.query.status;
        const requests = await db.getProfileRequests(status);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, requests }));
      } catch(e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    })();
    return;
  }

  // API: 提交档案修改请求 (POST)
  if (req.method === 'POST' && req.url === '/api/profile-requests') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        (async () => {
          const result = await db.addProfileRequest(data);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
        })();
      } catch(e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    });
    return;
  }

  // API: 处理档案请求 (POST)
  if (req.method === 'POST' && req.url.startsWith('/api/profile-requests/')) {
    const requestId = req.url.replace('/api/profile-requests/', '');
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        (async () => {
          const result = await db.processProfileRequest(requestId, data);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
        })();
      } catch(e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    });
    return;
  }

  // API: 获取用户已有档案数量 (GET)
  if (req.method === 'GET' && req.url.startsWith('/api/family-profiles/count')) {
    (async () => {
      try {
        const phone = parsedUrl.query.phone;
        const count = await db.getFamilyProfileCount(phone);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, count }));
      } catch(e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    })();
    return;
  }

  // API: 获取4个家庭成员槽位 (GET)
  if (req.method === 'GET' && req.url.startsWith('/api/family-slots')) {
    (async () => {
      try {
        const urlObj = new URL(req.url, 'http://localhost');
        const phone = urlObj.searchParams.get('phone');
        if (!phone) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: '缺少用户手机号' }));
          return;
        }
        const profiles = await db.getFamilyProfiles(phone);
        const slots = [null, null, null, null];
        for (const p of profiles) {
          const s = p.slot || 0;
          if (s >= 0 && s < 4) slots[s] = p;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, slots }));
      } catch(e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    })();
    return;
  }

  // API: 保存槽位档案 (POST)
  if (req.method === 'POST' && req.url === '/api/family-slot-save') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      (async () => {
        try {
          const data = JSON.parse(body);
          const { user_phone, slot, role_name, name, phone, id_card, gender, age, height, weight, school, grade } = data;
          if (!user_phone || slot === undefined) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: '缺少参数' }));
            return;
          }
          const existing = await db.getFamilyProfileBySlot(user_phone, slot);
          if (existing) {
            await db.updateFamilyProfileSlot(existing.id, { name, phone, id_card, gender, age, height, weight, school, grade, role_name });
          } else {
            await db.addFamilyProfile({ user_phone, slot, role_name, name, phone, id_card, gender, age, height, weight, school, grade });
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
        } catch(e) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: e.message }));
        }
      })();
    });
    return;
  }

  // API: 清空槽位 (POST)
  if (req.method === 'POST' && req.url === '/api/family-slot-clear') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      (async () => {
        try {
          const data = JSON.parse(body);
          const { user_phone, slot } = data;
          if (!user_phone || slot === undefined) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: '缺少参数' }));
            return;
          }
          await db.deleteFamilyProfileBySlot(user_phone, slot);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
        } catch(e) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: e.message }));
        }
      })();
    });
    return;
  }

  // API: 获取抽奖记录 (GET)
  if (req.method === 'GET' && req.url === '/api/lottery/records') {
    try {
      const contentData = getContent('_full');
      const lottery = contentData.lottery || { records: [] };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, records: lottery.records || [] }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: e.message }));
    }
    return;
  }

  // API: 获取历史记录 (GET)
  if (req.method === 'GET' && req.url === '/api/lottery/history') {
    try {
      const contentData = getContent('_full');
      const lottery = contentData.lottery || { history: [] };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, history: lottery.history || [] }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: e.message }));
    }
    return;
  }

  // API: 获取抽奖设置 (GET)
  if (req.method === 'GET' && req.url === '/api/lottery/settings') {
    try {
      const contentData = getContent('_full');
      const lottery = contentData.lottery || { enabled: true, prizes: [], records: [], history: [], settings: {} };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        settings: {
          enabled: lottery.enabled,
          name: lottery.name || '',
          rules: lottery.rules || [],
          maxDrawsPerUser: lottery.settings?.maxDrawsPerUser !== undefined ? lottery.settings.maxDrawsPerUser : 1,
          drawCooldownMinutes: lottery.settings?.drawCooldownMinutes || 0,
          lotteryType: lottery.settings?.lotteryType || 'probability',
          guaranteedPrizes: lottery.settings?.guaranteedPrizes || [],
          drawTime: lottery.settings?.drawTime || '',
          formFields: lottery.settings?.formFields || [
            { id: 'name', label: '姓名', type: 'text', required: true, placeholder: '请输入您的姓名' },
            { id: 'phone', label: '手机号', type: 'tel', required: true, placeholder: '请输入手机号' }
          ]
        },
        prizes: lottery.prizes || []
      }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: e.message }));
    }
    return;
  }

  // API: 参与抽奖 (POST)
  if (req.method === 'POST' && req.url === '/api/lottery') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { name, phone } = JSON.parse(body);
        if (!name || !phone) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: '请填写姓名和手机号' }));
          return;
        }
        
        const contentData = getContent('_full');
        let lottery = contentData.lottery;
        if (!lottery) {
          lottery = { records: [], history: [], prizes: [], enabled: true };
          contentData.lottery = lottery;
        }
        
        // 检查是否已参与
        const participated = lottery.records?.some(r => r.phone === phone && !r.won);
        if (participated) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: '您已参与过本次抽奖' }));
          return;
        }
        
        // 添加记录（等待开奖）
        lottery.records = lottery.records || [];
        lottery.records.push({
          name,
          phone,
          time: new Date().toISOString(),
          won: undefined
        });
        
        // 确保用户数据存在
        if (!contentData.users) contentData.users = {};
        if (!contentData.users[phone]) {
          contentData.users[phone] = {
            name: name,
            phone: phone,
            password: '',
            role: 'user',
            myPrizes: []
          };
        }
        
        setContent('_full', contentData);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: '参与成功，等待开奖' }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    });
    return;
  }

// API: 手动开奖 (POST)
  if (req.method === 'POST' && req.url === '/api/lottery/draw') {
    try {
      const contentData = getContent('_full');
      const lottery = contentData.lottery;
      
      if (!lottery || !lottery.records || lottery.records.length === 0) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: '暂无抽奖记录' }));
        return;
      }
      
      if (lottery.drawn) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: '已经开过奖了' }));
        return;
      }
      
      const prizes = lottery.prizes || [];
      if (prizes.length === 0) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: '暂无奖品' }));
        return;
      }
      
      // 执行开奖
      const records = lottery.records;
      records.sort((a, b) => new Date(a.time) - new Date(b.time));
      
      let winners = [];
      records.forEach(record => {
        const rand = Math.random();
        let cumulative = 0;
        let won = false;
        
        for (let p of prizes) {
          cumulative += p.probability || 0;
          if (rand <= cumulative && p.remain > 0) {
            record.won = true;
            record.prize = p.name;
            record.prizeIcon = p.icon;
            record.prizeId = p.id;
            p.remain = Math.max(0, p.remain - 1);
            winners.push(record);
            
            // 添加到用户中奖记录
            const phone = record.phone;
            if (!contentData.users) contentData.users = {};
            if (!contentData.users[phone]) {
              contentData.users[phone] = {
                name: record.name,
                phone: phone,
                password: '',
                role: 'user',
                myPrizes: []
              };
            }
            if (!contentData.users[phone].myPrizes) contentData.users[phone].myPrizes = [];
            contentData.users[phone].myPrizes.push({
              prize: p.name,
              icon: p.icon,
              description: p.description,
              wonAt: new Date().toISOString(),
              lotteryName: lottery.name || '抽奖活动'
            });
            won = true;
            break;
          }
        }
        
        if (!won) {
          record.won = false;
          record.prize = '未中奖';
        }
      });
      
      // 移到历史
      lottery.history = lottery.history || [];
      records.forEach(r => {
        lottery.history.push({
          ...r,
          archivedAt: new Date().toISOString(),
          archivedNote: '手动开奖'
        });
      });
      lottery.records = [];
      lottery.drawn = true;
      
      setContent('_full', contentData);
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, winners: winners.length }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: e.message }));
    }
    return;
  }

  // API: 保存抽奖设置 (POST)
  if (req.method === 'POST' && req.url === '/api/lottery/settings') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const contentData = getContent('_full');
        const lottery = contentData.lottery || { prizes: [], records: [], history: [] };
        lottery.enabled = data.enabled !== undefined ? data.enabled : true;
        lottery.name = data.name || '';
        lottery.rules = data.rules || [];
        lottery.settings = lottery.settings || {};
        lottery.settings.maxDrawsPerUser = data.maxDrawsPerUser !== undefined ? data.maxDrawsPerUser : 0;
        lottery.settings.drawCooldownMinutes = data.drawCooldownMinutes || 0;
        lottery.settings.lotteryType = data.lotteryType || 'probability';
        lottery.settings.guaranteedPrizes = data.guaranteedPrizes || [];
        lottery.settings.drawTime = data.drawTime || '';
        lottery.settings.formFields = data.formFields || [
          { id: 'name', label: '姓名', type: 'text', required: true, placeholder: '请输入您的姓名' },
          { id: 'phone', label: '手机号', type: 'tel', required: true, placeholder: '请输入手机号' }
        ];
        if (data.prizes) { console.log('保存的奖品数据:', JSON.stringify(data.prizes)); lottery.prizes = data.prizes; }
        contentData.lottery = lottery;
        setContent('_full', contentData);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    });
    return;
  }

  // API: 删除单条抽奖记录 (DELETE)
  if (req.method === 'DELETE' && req.url.startsWith('/api/lottery/record/')) {
    const index = parseInt(req.url.split('/api/lottery/record/')[1]);
    try {
      const contentData = getContent('_full');
      if (!contentData.lottery || !contentData.lottery.records) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: '无记录' }));
        return;
      }
      contentData.lottery.records.splice(index, 1);
      setContent('_full', contentData);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: e.message }));
    }
    return;
  }

  // API: 创建账号 (POST)
  if (req.method === 'POST' && req.url === '/api/create-user') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { phone, password, name, role, permissions } = JSON.parse(body);
        if (!phone || !password) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: '请输入手机号和密码' }));
          return;
        }
        if (!/^1[3-9]\d{9}$/.test(phone)) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: '手机号格式不正确' }));
          return;
        }
        if (password.length < 6) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: '密码至少6位' }));
          return;
        }
        if (users[phone]) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: '该手机号已注册' }));
          return;
        }
        // 如果传入了permissions则使用传入的，否则为admin生成默认权限
        const userPermissions = role === 'admin' ? (permissions || {
          'home': true, 'courses': true,
          'quiz': true, 'coupon': true, 'library': true, 'rules': true, 'quizStats': true,
          'lotteryCreate': true, 'lotteryRecords': true, 'lotteryHistory': true,
          'createAccount': true, 'allAccounts': true
        }) : (permissions || {});
        users[phone] = {
          name: name || phone,
          password: password,
          phone: phone,
          avatar: '👤',
          role: role || 'user',
          permissions: userPermissions,
          createdAt: new Date().toISOString()
        };
        saveUsers();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: '创建失败' }));
      }
    });
    return;
  }

  // API: 更新用户资料 (POST) - 完整版
  if (req.method === 'POST' && req.url.split('?')[0] === '/api/update-user') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { phone, newPhone, name, avatar, password, role, permissions } = JSON.parse(body);
        if (!phone) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: '请提供手机号' }));
          return;
        }
        if (!users[phone]) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: '用户不存在' }));
          return;
        }
        if (newPhone && newPhone !== phone) {
          if (users[newPhone]) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: '该手机号已被使用' }));
            return;
          }
          users[newPhone] = { ...users[phone] };
          if (name) users[newPhone].name = name;
          if (avatar) users[newPhone].avatar = avatar;
          if (password) users[newPhone].password = password;
          if (role) users[newPhone].role = role;
          if (permissions) users[newPhone].permissions = permissions;
          delete users[phone];
          saveUsers();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
          return;
        }
        if (name) users[phone].name = name;
        if (avatar) users[phone].avatar = avatar;
        if (password) users[phone].password = password;
        if (role) users[phone].role = role;
        if (permissions) users[phone].permissions = permissions;
        saveUsers();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: '更新失败' }));
      }
    });
    return;
  }

  // API: 删除用户 (DELETE)
  if (req.method === 'DELETE' && req.url.startsWith('/api/delete-user/')) {
    let phone = req.url.replace('/api/delete-user/', '').split('?')[0];
    if (!phone) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: '请提供手机号' }));
      return;
    }
    // 不允许删除超级管理员
    if (phone === '18003411633') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: '不能删除超级管理员' }));
      return;
    }
    if (users[phone]) {
      delete users[phone];
      saveUsers();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: '用户不存在' }));
    }
    return;
  }

  // ========== 文件上传 API ==========

// API: 上传课程封面图片
if (req.method === 'POST' && req.url === '/api/upload/cover') {
  const chunks = [];
  req.on('data', chunk => chunks.push(chunk));
  req.on('end', () => {
    const buffer = Buffer.concat(chunks);
    const boundary = req.headers['content-type']?.split('boundary=')[1];
    if (!boundary) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'No boundary' }));
      return;
    }
    
    const parts = buffer.toString('binary').split('--' + boundary);
    for (const part of parts) {
      if (part.includes('filename=')) {
        const match = part.match(/filename="(.+)"/);
        const filename = match ? match[1] : 'cover_' + Date.now() + '.jpg';
        const ext = filename.split('.').pop() || 'jpg';
        const newFilename = 'cover_' + Date.now() + '.' + ext;
        const filepath = path.join(__dirname, 'uploads', newFilename);
        
        const contentMatch = part.split('\r\n\r\n');
        if (contentMatch.length > 1) {
          const content = contentMatch[contentMatch.length - 1];
          const cleanContent = content.slice(0, -2); // Remove trailing \r\n
          require('fs').writeFileSync(filepath, Buffer.from(cleanContent, 'binary'));
          const url = '/uploads/' + newFilename;
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, url }));
          return;
        }
      }
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'No file found' }));
  });
  return;
}

// ========== 约课系统 API ==========

  // API: 获取约课分类和子分类 (GET)
  if (req.method === 'GET' && req.url === '/api/booking/categories') {
    db.getBookingCategories().then(categories => {
      db.getBookingSubcategories().then(subcategories => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, categories, subcategories }));
      });
    }).catch(err => {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    });
    return;
  }

  // API: 获取课程列表 (GET) - 可按子分类筛选
  if (req.method === 'GET' && req.url.startsWith('/api/booking/courses')) {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const subcategoryId = url.searchParams.get('subcategory_id') || null;
    const categoryId = url.searchParams.get('category_id') || null;
    const status = url.searchParams.get('status') || 'active'; // 默认只显示active
    db.getBookingCourses(subcategoryId, true, categoryId, status).then(courses => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, courses }));
    }).catch(err => {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    });
    return;
  }

  // API: 获取所有课程(含停止) (GET) - 后台管理用
  if (req.method === 'GET' && req.url.startsWith('/api/booking/admin/courses')) {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const status = url.searchParams.get('status');
    db.getBookingCourses(null, null, null, status).then(courses => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, courses }));
    }).catch(err => {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    });
    return;
  }

  // API: 获取单个课程详情 (GET)
  if (req.method === 'GET' && req.url.startsWith('/api/booking/course/')) {
    const id = req.url.replace('/api/booking/course/', '').split('?')[0];
    db.getBookingCourse(id).then(course => {
      if (!course) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: '课程不存在' }));
        return;
      }
      db.getBookingFormFields(id).then((fields) => {
        // 不再自动创建默认字段 - 如果数据库中没有字段，就返回空
        // 默认字段应该在创建课程时就已经保存到数据库
        
        // Fix: parse option_prices and condition if they're strings (double-encoded from storage)
        fields = fields.map(field => {
          if (field.option_prices && typeof field.option_prices === 'string') {
            try {
              let val = JSON.parse(field.option_prices);
              // If still a string, parse again (double encoding)
              if (typeof val === 'string') val = JSON.parse(val);
              field.option_prices = val;
            } catch(e) { /* ignore */ }
          }
          if (field.condition && typeof field.condition === 'string') {
            try {
              let val = JSON.parse(field.condition);
              if (typeof val === 'string') val = JSON.parse(val);
              field.condition = val;
            } catch(e) { /* ignore */ }
          }
          return field;
        });
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, course, fields }));
      });
    }).catch(err => {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    });
    return;
  }

  // API: 创建/更新课程 (POST)
  if (req.method === 'POST' && req.url === '/api/booking/course') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const course = JSON.parse(body);
        if (!course.id) course.id = 'course_' + Date.now();
        if (!course.name) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: '课程名称不能为空' }));
          return;
        }
        // Provide default subcategory_id if not set
        if (!course.subcategory_id) {
          course.subcategory_id = 'sub_changxun'; // default
        }
        
        // Check if course already exists before saving
        db.getBookingCourse(course.id).then(existingCourse => {
          db.setBookingCourse(course).then(() => {
            // Only create default fields for NEW courses
            if (!existingCourse) {
              const defaultFields = [
                { field_name: 'student_name', field_label: '姓名', field_type: 'text', required: true, price: 0 },
                { field_name: 'phone', field_label: '联系电话', field_type: 'text', required: false, price: 0 },
                { field_name: 'booking_date', field_label: '预约日期', field_type: 'date', required: true, price: 0 }
              ];
              Promise.all(defaultFields.map(f => {
                f.id = 'field_' + course.id + '_' + f.field_name;
                f.course_id = course.id;
                f.options = null;
                f.option_prices = null;
                f.sort_order = defaultFields.indexOf(f);
                return db.setBookingFormField(f);
              })).then(() => {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, courseId: course.id }));
              }).catch(err => {
                console.error('Set field error:', err);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: '保存字段失败: ' + err.message }));
              });
            } else {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: true, courseId: course.id }));
            }
          }).catch(err => {
            console.error('Set course error:', err);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: '保存课程失败: ' + err.message }));
          });
        });
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: '保存失败' }));
      }
    });
    return;
  }

  // API: 添加/更新课程表单字段 (POST)
  if (req.method === 'POST' && req.url === '/api/booking/field') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const field = JSON.parse(body);
        if (!field.id) field.id = 'field_' + Date.now();
        if (!field.field_label) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: '字段名称不能为空' }));
          return;
        }
        db.setBookingFormField(field).then(() => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, fieldId: field.id }));
        }).catch(err => {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: '保存失败' }));
        });
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: '保存失败' }));
      }
    });
    return;
  }

  // API: 删除课程表单字段 (DELETE)
  if (req.method === 'DELETE' && req.url.startsWith('/api/booking/field/')) {
    const fieldId = req.url.replace('/api/booking/field/', '');
    db.deleteBookingFormField(fieldId).then(() => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
    }).catch(err => {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    });
    return;
  }

  // API: 删除课程 (DELETE)
  if (req.method === 'DELETE' && req.url.startsWith('/api/booking/course/')) {
    const courseId = req.url.replace('/api/booking/course/', '');
    db.deleteBookingCourse(courseId).then(() => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
    }).catch(err => {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    });
    return;
  }

  // API: 更新课程状态 (PUT) - 启动/停止课程
  if (req.method === 'PUT' && req.url.startsWith('/api/booking/course/')) {
    const courseId = req.url.replace('/api/booking/course/', '').split('?')[0];
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        await db.updateBookingCourse(courseId, { status: data.status });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch(err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // API: 提交约课 (POST)
  if (req.method === 'POST' && req.url === '/api/booking/submit') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const formData = data.form_data || {};
        
        // Validate required fields from form configuration
        // The required check is done on frontend via HTML5 required attribute
        // But we also check here as a fallback
        db.getBookingCourse(data.course_id).then(course => {
          if (!course) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: '课程不存在' }));
            return;
          }
          
          // Get field configuration to check required fields
          db.getBookingFormFields(data.course_id).then(fields => {
            // Check required fields from form configuration
            // Skip validation for fields with conditions (they may be hidden)
            // Frontend generates element id as 'field_' + field.id
            for (const field of fields) {
              if (field.required && !field.condition) {
                // Check both 'field_' + id and field_name formats
                const frontendId = 'field_' + field.id;
                const fieldValue = formData[frontendId] || formData[field.id] || formData[field.field_name];
                if (!fieldValue || !fieldValue.trim()) {
                  res.writeHead(200, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ success: false, error: `请填写${field.field_label}` }));
                  return;
                }
              }
            }
            
            // Extract student_name, phone, booking_date
            // Frontend generates element id as 'field_' + field.id
            let student_name = '';
            let phone = '';
            let booking_date = '';
            for (const field of fields) {
              const fieldIdWithPrefix = 'field_' + field.id;
              if (field.field_name === 'student_name') {
                student_name = formData[fieldIdWithPrefix] || formData[field.id] || '';
              }
              if (field.field_name === 'phone') {
                phone = formData[fieldIdWithPrefix] || formData[field.id] || '';
              }
              if (field.field_name === 'booking_date') {
                booking_date = formData[fieldIdWithPrefix] || formData[field.id] || '';
              }
            }
            
            const record = {
              id: 'booking_' + Date.now(),
              course_id: data.course_id,
              course_name: course.name,
              subcategory_name: data.subcategory_name || '',
              category_name: data.category_name || '',
              student_name: student_name,
              phone: phone,
              booking_date: booking_date || course.start_date || '',
              course_start_date: course.start_date || '',
              course_end_date: course.end_date || '',
              form_data: formData,
              total_price: data.total_price || course.price || 0,
              status: 'confirmed'
            };
            
            // Check duplicate
            db.getBookingRecords({ student_name: student_name, course_id: data.course_id, booking_date: booking_date, limit: 5 }).then(existing => {
              const duplicate = existing.find(r => r.student_name === student_name && r.course_id === data.course_id && r.booking_date === booking_date);
              if (duplicate) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: '该学员本周已预约此课程，请勿重复提交' }));
                return;
              }
              db.createBookingRecord(record).then(() => {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, recordId: record.id }));
              }).catch(err => {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: '提交失败' }));
              });
            });
          }).catch(err => {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: '提交失败' }));
          });
        }).catch(err => {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: '提交失败' }));
        });
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: '提交失败' }));
      }
    });
    return;
  }

  // API: 获取约课记录 (GET) - 后台管理
  if (req.method === 'GET' && req.url.startsWith('/api/booking/records')) {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const filters = {
      course_id: url.searchParams.get('course_id') || null,
      booking_date: url.searchParams.get('booking_date') || null,
      start_date: url.searchParams.get('start_date') || null,
      end_date: url.searchParams.get('end_date') || null,
      student_name: url.searchParams.get('student_name') || null,
      phone: url.searchParams.get('phone') || null,
      limit: url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')) : 100
    };
    db.getBookingRecords(filters).then(records => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, records }));
    }).catch(err => {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    });
    return;
  }
  
  // API: 更新我的约课 (PUT) - 用户只能修改自己的未开始课程
  if (req.method === 'PUT' && req.url.startsWith('/api/booking/my/')) {
    const id = req.url.split('/api/booking/my/')[1];
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const data = JSON.parse(body);
      // Check if booking exists
      db.getBookingRecord(id).then(record => {
        if (!record) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: '预约记录不存在' }));
          return;
        }
        // Check if booking date is in the past - only allow cancel for future bookings
        if (record.booking_date) {
          const bookingDate = new Date(record.booking_date);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          if (bookingDate < today) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: '课程已开始，无法取消' }));
            return;
          }
        }
        // Handle cancel
        if (data.status === 'cancelled') {
          db.updateBookingRecord(id, { status: 'cancelled' }).then(() => {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
          }).catch(err => {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: err.message }));
          });
          return;
        }
        // Update form_data or booking_date - only for future bookings
        const updateData = {};
        if (data.form_data) updateData.form_data = data.form_data;
        if (data.booking_date) updateData.booking_date = data.booking_date;
        if (Object.keys(updateData).length > 0) {
          db.updateBookingRecord(id, updateData).then(() => {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
          }).catch(err => {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: err.message }));
          });
        } else {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
        }
      });
    });
    return;
  }
  
  // PUT /api/booking/record/:id - Update booking record (superadmin only)
  if (req.method === 'PUT' && req.url.startsWith('/api/booking/record/')) {
    const id = req.url.split('/api/booking/record/')[1];
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const data = JSON.parse(body);
      db.updateBookingRecord(id, data).then(result => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      }).catch(err => {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      });
    });
    return;
  }
  
  // DELETE /api/booking/record/:id - Delete booking record (superadmin only)
  if (req.method === 'DELETE' && req.url.startsWith('/api/booking/record/')) {
    const id = req.url.split('/api/booking/record/')[1];
    db.deleteBookingRecord(id).then(result => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
    }).catch(err => {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    });
    return;
  }
  
  // GET /api/booking/export - Export records to XLSX
  if (req.method === 'GET' && req.url.startsWith('/api/booking/export')) {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const filters = {
      course_id: url.searchParams.get('course_id') || null,
      booking_date: url.searchParams.get('booking_date') || null,
      start_date: url.searchParams.get('start_date') || null,
      end_date: url.searchParams.get('end_date') || null,
      student_name: url.searchParams.get('student_name') || null,
      limit: 10000
    };
    
    db.getBookingRecords(filters).then(async records => {
      const XLSX = require('xlsx');
      
      // Get field configuration for all courses to build headers
      const courses = await db.getBookingCourses();
      const allFieldLabels = new Set(['学员姓名', '联系电话', '课程', '分类', '预约日期', '总费用', '状态', '报名时间']);
      
      // Parse form_data and collect all field labels
      const parsedRecords = records.map(r => {
        let formData = r.form_data;
        if (typeof formData === 'string') {
          try { formData = JSON.parse(formData); } catch(e) { formData = {}; }
        }
        // Collect labels
        for (const [key, value] of Object.entries(formData)) {
          if (value && typeof value === 'object' && value.label) {
            allFieldLabels.add(value.label);
          }
        }
        return { ...r, _formData: formData };
      });
      
      // Prepare data
      const exportData = parsedRecords.map(r => {
        const row = {
          '学员姓名': r.student_name || '',
          '联系电话': r.phone || '',
          '课程': r.course_name || '',
          '分类': r.category_name || '',
          '预约日期': r.booking_date || '',
          '总费用': r.total_price || 0,
          '状态': r.status === 'pending' ? '待确认' : r.status,
          '报名时间': new Date(r.created_at).toLocaleString('zh-CN')
        };
        
        // Add all form fields
        for (const label of allFieldLabels) {
          if (label === '学员姓名') continue;
          let found = false;
          const formData = r._formData || {};
          for (const [key, value] of Object.entries(formData)) {
            if (value && typeof value === 'object' && value.label === label) {
              row[label] = value.value || '';
              found = true;
              break;
            }
          }
          if (!found) row[label] = '';
        }
        
        return row;
      });
      
      // Create workbook
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, '预约记录');
      
      // Set column widths
      const headers = Array.from(allFieldLabels);
      worksheet['!cols'] = headers.map(() => ({ wch: 15 }));
      
      // Generate buffer
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      
      res.writeHead(200, {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename=booking_records.xlsx'
      });
      res.end(buffer);
    }).catch(err => {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    });
    return;
  }

  if (req.method === 'GET') {
    let filePath = req.url === '/' ? '/index.html' : req.url;
    filePath = path.join(__dirname, filePath);
    if (!filePath.startsWith(__dirname)) {
      res.writeHead(403);
      res.end('禁止访问');
      return;
    }
    const mimeType = MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('文件未找到');
        return;
      }
      res.writeHead(200, { 'Content-Type': mimeType });
      res.end(data);
    });
    return;
  }

  res.writeHead(404);
  res.end();
});

server.listen(PORT, async () => {
  console.log(`🏂 网站已启动: http://localhost:${PORT}/`);
  // Auto-expire courses that have passed their end date
  try {
    const expired = await db.autoExpireCourses();
    if (expired > 0) {
      console.log(`⏰ 自动停用了 ${expired} 个已过期的课程`);
    }
  } catch(e) {
    console.log('Auto-expire check failed:', e.message);
  }
});
