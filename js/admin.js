/**
 * 极运龙城×趣滑雪俱乐部 - 后台管理逻辑
 */

var currentAdminUser = null;

// 登录成功后的初始化回调
function adminLoginSuccess(user) {
  currentAdminUser = user;
  admin = new AdminPanel();
  admin.init();
}

// 管理员登录函数
async function adminLogin() {
  var phone = document.getElementById('login-phone').value.trim();
  var password = document.getElementById('login-password').value;
  
  if (!phone || !password) {
    document.getElementById('login-error').textContent = '请输入账号和密码';
    document.getElementById('login-error').style.display = 'block';
    return;
  }
  
  try {
    var res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: phone, password: password })
    });
    var data = await res.json();
    
    if (data.success) {
      currentAdminUser = data.user;
      document.getElementById('login-modal').classList.remove('show');
      document.getElementById('admin-main').style.display = 'block';
      // 初始化admin
      admin = new AdminPanel();
      await admin.init();
    } else {
      document.getElementById('login-error').textContent = data.error || '登录失败';
      document.getElementById('login-error').style.display = 'block';
    }
  } catch (e) {
    document.getElementById('login-error').textContent = '网络错误，请重试';
    document.getElementById('login-error').style.display = 'block';
  }
}

// 检查是否已登录
function checkAdminLogin() {
  // 每次进入后台都需要重新登录
  document.getElementById('login-modal').classList.add('show');
  return false;
}

// 管理员登出
function adminLogout() {
  localStorage.removeItem('admin_user');
  currentAdminUser = null;
  location.reload();
}

class AdminPanel {
  constructor() {
    this.content = null;
    this.currentSection = 'club';
  }

  async init() {
    try {
      await this.loadContent();
      this.renderAll();
      this.bindEvents();
      // 应用权限
      if (currentAdminUser) {
        this.applyPermissions(currentAdminUser.role, currentAdminUser.permissions);
      }
    } catch (error) {
      console.error('后台初始化失败:', error);
      this.showToast('加载失败: ' + error.message, 'error');
    }
  }

  async loadContent() {
    const response = await fetch('data/content.json');
    this.content = await response.json();
  }

  async saveContent() {
    try {
      // 使用fetch发送POST请求保存内容
      const response = await fetch('data/content.json', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(this.content, null, 2)
      });

      if (!response.ok) {
        throw new Error('保存失败');
      }

      this.showToast('保存成功！', 'success');
      return true;
    } catch (error) {
      console.error('保存失败:', error);
      // 尝试使用download方式保存
      this.downloadContent();
      return false;
    }
  }

  downloadContent() {
    const blob = new Blob([JSON.stringify(this.content, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'content.json';
    a.click();
    URL.revokeObjectURL(url);
    this.showToast('已生成下载，请手动替换 data/content.json 文件', 'success');
  }

  renderAll() {
    this.renderHeaderForm();
    this.renderClubInfo();
    this.renderHeroSlides();
    this.renderFounderForm();
    this.renderBasesList();
    this.renderAthletesList();
    this.renderMenuList();
    this.renderCoursesPageForm();
    this.renderCoursesSnowList();
    this.renderCoursesOffseasonList();
  }

  // 渲染页眉表单
  renderHeaderForm() {
    const container = document.getElementById('header-form');
    if (!container) return;
    
    const header = this.content.header || { logo: '', phone: '', wechat: '' };
    
    container.innerHTML = `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
        <div class="form-group">
          <label>Logo文字</label>
          <input type="text" id="header-logo" value="${header.logo || ''}" placeholder="显示在顶部的名称">
        </div>
        <div class="form-group">
          <label>联系电话</label>
          <input type="text" id="header-phone" value="${header.phone || ''}" placeholder="显示在顶部的电话">
        </div>
      </div>
      <div class="form-group">
        <label>微信号/二维码</label>
        <input type="text" id="header-wechat" value="${header.wechat || ''}" placeholder="显示在顶部的微信">
      </div>
      <button type="button" class="btn btn-primary" onclick="admin.saveHeader()">保存页眉</button>
    `;
  }

  saveHeader() {
    this.content.header = {
      logo: document.getElementById('header-logo').value,
      phone: document.getElementById('header-phone').value,
      wechat: document.getElementById('header-wechat').value
    };
    this.saveContent();
    this.showToast('页眉已保存', 'success');
  }

  // 渲染俱乐部基本信息
  renderClubInfo() {
    const form = document.getElementById('club-form');
    if (!form || !this.content.club) return;

    form.innerHTML = `
      <div class="form-group">
        <label>俱乐部名称</label>
        <input type="text" id="club-name" value="${this.content.club.name}">
      </div>
      <div class="form-group">
        <label>成立年份</label>
        <input type="number" id="club-year" value="${this.content.club.foundedYear}" min="2000" max="2030">
      </div>
      <div class="form-group">
        <label>简介描述</label>
        <textarea id="club-desc">${this.content.club.description}</textarea>
      </div>
      <button type="button" class="btn btn-primary" onclick="admin.saveClubInfo()">保存俱乐部信息</button>
    `;
  }

  saveClubInfo() {
    this.content.club.name = document.getElementById('club-name').value;
    this.content.club.foundedYear = parseInt(document.getElementById('club-year').value);
    this.content.club.description = document.getElementById('club-desc').value;
    this.saveContent();
  }

  // 渲染Hero轮播图管理
  renderHeroSlides() {
    const container = document.getElementById('hero-slides-list');
    if (!container || !this.content.hero) return;

    const slides = this.content.hero.slides;
    
    container.innerHTML = slides.map((slide, index) => `
      <div class="list-item" data-id="${slide.id}">
        <div class="list-item-image">
          ${slide.image ? `<img src="${slide.image}" alt="${slide.title}">` : '<div class="placeholder-bg">🏂</div>'}
        </div>
        <div class="list-item-info">
          <h4>轮播图 ${index + 1}</h4>
          <p>标题: ${slide.title}</p>
        </div>
        <div class="list-item-actions">
          <button class="btn btn-secondary btn-small" onclick="admin.editSlide(${slide.id})">编辑</button>
          <button class="btn btn-danger btn-small" onclick="admin.deleteSlide(${slide.id})">删除</button>
        </div>
      </div>
    `).join('');

    // 添加按钮
    container.innerHTML += `
      <button class="btn btn-primary" style="margin-top: 20px;" onclick="admin.addSlide()">+ 添加轮播图</button>
    `;
  }

  addSlide() {
    const newId = Math.max(...this.content.hero.slides.map(s => s.id)) + 1;
    const newSlide = {
      id: newId,
      image: '',
      title: '新轮播图',
      description: '输入描述文字'
    };
    
    this.content.hero.slides.push(newSlide);
    this.saveContent().then(() => this.renderHeroSlides());
  }

  editSlide(id) {
    const slide = this.content.hero.slides.find(s => s.id === id);
    if (!slide) return;

    const modal = this.createModal('编辑轮播图', `
      <div class="form-group">
        <label>标题</label>
        <input type="text" id="edit-slide-title" value="${slide.title}">
      </div>
      <div class="form-group">
        <label>描述</label>
        <textarea id="edit-slide-desc">${slide.description}</textarea>
      </div>
      <div class="form-group">
        <label>图片</label>
        <div class="image-upload-area" onclick="document.getElementById('edit-slide-file').click()">
          <input type="file" id="edit-slide-file" accept="image/*" onchange="admin.uploadSlideImage(${id}, this)">
          <div class="upload-icon">📷</div>
          <div class="upload-hint">点击上传图片</div>
        </div>
        ${slide.image ? `<p style="margin-top:10px;color:#666;">当前: ${slide.image}</p>` : ''}
      </div>
      <div style="display:flex;gap:12px;margin-top:20px;">
        <button class="btn btn-primary" onclick="admin.saveSlide(${id})">保存</button>
        <button class="btn btn-secondary" onclick="admin.closeModal()">取消</button>
      </div>
    `);

    document.body.appendChild(modal);
  }

  async uploadSlideImage(id, input) {
    if (!input.files || !input.files[0]) return;

    const file = input.files[0];
    const formData = new FormData();
    formData.append('image', file);

    try {
      const response = await fetch('api/upload.php', {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        const slide = this.content.hero.slides.find(s => s.id === id);
        if (slide) {
          slide.image = data.path;
          await this.saveContent();
          this.showToast('上传成功', 'success');
          this.closeModal();
          this.editSlide(id);
        }
      } else {
        throw new Error('上传失败');
      }
    } catch (error) {
      // 如果没有上传接口，直接保存base64
      const reader = new FileReader();
      reader.onload = async (e) => {
        const slide = this.content.hero.slides.find(s => s.id === id);
        if (slide) {
          slide.image = e.target.result;
          await this.saveContent();
          this.showToast('图片已保存（作为Base64）', 'success');
          this.closeModal();
          this.editSlide(id);
        }
      };
      reader.readAsDataURL(file);
    }
  }

  saveSlide(id) {
    const slide = this.content.hero.slides.find(s => s.id === id);
    if (!slide) return;

    slide.title = document.getElementById('edit-slide-title').value;
    slide.description = document.getElementById('edit-slide-desc').value;
    
    this.saveContent().then(() => {
      this.closeModal();
      this.renderHeroSlides();
    });
  }

  deleteSlide(id) {
    if (!confirm('确定要删除这个轮播图吗？')) return;
    
    this.content.hero.slides = this.content.hero.slides.filter(s => s.id !== id);
    this.saveContent().then(() => this.renderHeroSlides());
  }

  // 渲染创始人表单
  renderFounderForm() {
    const form = document.getElementById('founder-form');
    if (!form || !this.content.founder) return;

    const founder = this.content.founder;
    form.innerHTML = `
      <div class="form-group">
        <label>姓名</label>
        <input type="text" id="founder-name" value="${founder.name}">
      </div>
      <div class="form-group">
        <label>职位/头衔</label>
        <input type="text" id="founder-title" value="${founder.title}">
      </div>
      <div class="form-group">
        <label>简介</label>
        <textarea id="founder-bio">${founder.bio}</textarea>
      </div>
      <div class="form-group">
        <label>照片</label>
        <div class="image-upload-area" onclick="document.getElementById('founder-file').click()">
          <input type="file" id="founder-file" accept="image/*" onchange="admin.uploadFounderImage(this)">
          <div class="upload-icon">👤</div>
          <div class="upload-hint">点击上传照片</div>
        </div>
        ${founder.image ? `<p style="margin-top:10px;color:#666;">当前: ${founder.image}</p>` : ''}
      </div>
      <button type="button" class="btn btn-primary" onclick="admin.saveFounder()">保存创始人信息</button>
    `;
  }

  async uploadFounderImage(input) {
    if (!input.files || !input.files[0]) return;

    const file = input.files[0];
    const reader = new FileReader();
    
    reader.onload = (e) => {
      this.content.founder.image = e.target.result;
      this.saveContent();
      this.showToast('照片已保存', 'success');
      this.renderFounderForm();
    };
    
    reader.readAsDataURL(file);
  }

  saveFounder() {
    this.content.founder.name = document.getElementById('founder-name').value;
    this.content.founder.title = document.getElementById('founder-title').value;
    this.content.founder.bio = document.getElementById('founder-bio').value;
    this.saveContent();
  }

  // 渲染训练基地列表
  renderBasesList() {
    const container = document.getElementById('bases-list');
    if (!container || !this.content.bases) return;

    container.innerHTML = this.content.bases.map(base => `
      <div class="list-item" data-id="${base.id}">
        <div class="list-item-image">
          ${base.image ? `<img src="${base.image}" alt="${base.name}">` : '<div class="placeholder-bg">🏔️</div>'}
        </div>
        <div class="list-item-info">
          <h4>${base.name}</h4>
          <p>${base.description}</p>
        </div>
        <div class="list-item-actions">
          <button class="btn btn-secondary btn-small" onclick="admin.editBase(${base.id})">编辑</button>
          <button class="btn btn-danger btn-small" onclick="admin.deleteBase(${base.id})">删除</button>
        </div>
      </div>
    `).join('');

    container.innerHTML += `
      <button class="btn btn-primary" style="margin-top: 20px;" onclick="admin.addBase()">+ 添加训练基地</button>
    `;
  }

  addBase() {
    const newId = Math.max(...this.content.bases.map(b => b.id)) + 1;
    const newBase = {
      id: newId,
      name: '新训练基地',
      image: '',
      description: '输入描述'
    };
    
    this.content.bases.push(newBase);
    this.saveContent().then(() => this.renderBasesList());
  }

  editBase(id) {
    const base = this.content.bases.find(b => b.id === id);
    if (!base) return;

    const modal = this.createModal('编辑训练基地', `
      <div class="form-group">
        <label>名称</label>
        <input type="text" id="edit-base-name" value="${base.name}">
      </div>
      <div class="form-group">
        <label>描述</label>
        <textarea id="edit-base-desc">${base.description}</textarea>
      </div>
      <div class="form-group">
        <label>图片</label>
        <div class="image-upload-area" onclick="document.getElementById('edit-base-file').click()">
          <input type="file" id="edit-base-file" accept="image/*" onchange="admin.uploadBaseImage(${id}, this)">
          <div class="upload-icon">🏔️</div>
          <div class="upload-hint">点击上传图片</div>
        </div>
      </div>
      <div style="display:flex;gap:12px;margin-top:20px;">
        <button class="btn btn-primary" onclick="admin.saveBase(${id})">保存</button>
        <button class="btn btn-secondary" onclick="admin.closeModal()">取消</button>
      </div>
    `);

    document.body.appendChild(modal);
  }

  async uploadBaseImage(id, input) {
    if (!input.files || !input.files[0]) return;

    const file = input.files[0];
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const base = this.content.bases.find(b => b.id === id);
      if (base) {
        base.image = e.target.result;
        this.saveContent();
        this.showToast('图片已上传', 'success');
      }
    };
    
    reader.readAsDataURL(file);
  }

  saveBase(id) {
    const base = this.content.bases.find(b => b.id === id);
    if (!base) return;

    base.name = document.getElementById('edit-base-name').value;
    base.description = document.getElementById('edit-base-desc').value;
    
    this.saveContent().then(() => {
      this.closeModal();
      this.renderBasesList();
    });
  }

  deleteBase(id) {
    if (!confirm('确定要删除这个训练基地吗？')) return;
    
    this.content.bases = this.content.bases.filter(b => b.id !== id);
    this.saveContent().then(() => this.renderBasesList());
  }

  // 渲染优秀队员列表
  renderAthletesList() {
    const container = document.getElementById('athletes-list');
    if (!container || !this.content.athletes) return;

    container.innerHTML = this.content.athletes.map(athlete => `
      <div class="list-item" data-id="${athlete.id}">
        <div class="list-item-image">
          ${athlete.image ? `<img src="${athlete.image}" alt="${athlete.name}">` : '<div class="placeholder-bg">🎿</div>'}
        </div>
        <div class="list-item-info">
          <h4>${athlete.name}</h4>
          <p>${athlete.level}</p>
        </div>
        <div class="list-item-actions">
          <button class="btn btn-secondary btn-small" onclick="admin.editAthlete(${athlete.id})">编辑</button>
          <button class="btn btn-danger btn-small" onclick="admin.deleteAthlete(${athlete.id})">删除</button>
        </div>
      </div>
    `).join('');

    container.innerHTML += `
      <button class="btn btn-primary" style="margin-top: 20px;" onclick="admin.addAthlete()">+ 添加队员</button>
    `;
  }

  addAthlete() {
    const newId = Math.max(...this.content.athletes.map(a => a.id)) + 1;
    const newAthlete = {
      id: newId,
      name: '新队员',
      level: '国家二级运动员',
      image: ''
    };
    
    this.content.athletes.push(newAthlete);
    this.saveContent().then(() => this.renderAthletesList());
  }

  editAthlete(id) {
    const athlete = this.content.athletes.find(a => a.id === id);
    if (!athlete) return;

    const modal = this.createModal('编辑队员信息', `
      <div class="form-group">
        <label>姓名</label>
        <input type="text" id="edit-athlete-name" value="${athlete.name}">
      </div>
      <div class="form-group">
        <label>级别</label>
        <select id="edit-athlete-level" style="width:100%;padding:12px;border:2px solid #E8F4FF;border-radius:10px;">
          <option value="国家一级运动员" ${athlete.level === '国家一级运动员' ? 'selected' : ''}>国家一级运动员</option>
          <option value="国家二级运动员" ${athlete.level === '国家二级运动员' ? 'selected' : ''}>国家二级运动员</option>
        </select>
      </div>
      <div class="form-group">
        <label>照片</label>
        <div class="image-upload-area" onclick="document.getElementById('edit-athlete-file').click()">
          <input type="file" id="edit-athlete-file" accept="image/*" onchange="admin.uploadAthleteImage(${id}, this)">
          <div class="upload-icon">🎿</div>
          <div class="upload-hint">点击上传照片</div>
        </div>
      </div>
      <div style="display:flex;gap:12px;margin-top:20px;">
        <button class="btn btn-primary" onclick="admin.saveAthlete(${id})">保存</button>
        <button class="btn btn-secondary" onclick="admin.closeModal()">取消</button>
      </div>
    `);

    document.body.appendChild(modal);
  }

  async uploadAthleteImage(id, input) {
    if (!input.files || !input.files[0]) return;

    const file = input.files[0];
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const athlete = this.content.athletes.find(a => a.id === id);
      if (athlete) {
        athlete.image = e.target.result;
        this.saveContent();
        this.showToast('照片已上传', 'success');
      }
    };
    
    reader.readAsDataURL(file);
  }

  saveAthlete(id) {
    const athlete = this.content.athletes.find(a => a.id === id);
    if (!athlete) return;

    athlete.name = document.getElementById('edit-athlete-name').value;
    athlete.level = document.getElementById('edit-athlete-level').value;
    
    this.saveContent().then(() => {
      this.closeModal();
      this.renderAthletesList();
    });
  }

  deleteAthlete(id) {
    if (!confirm('确定要删除这个队员吗？')) return;
    
    this.content.athletes = this.content.athletes.filter(a => a.id !== id);
    this.saveContent().then(() => this.renderAthletesList());
  }

  // 渲染菜单列表
  renderMenuList() {
    const container = document.getElementById('menu-list');
    if (!container || !this.content.menu) return;

    container.innerHTML = this.content.menu.map(item => `
      <div class="list-item" data-id="${item.id}">
        <div class="list-item-info">
          <h4>${item.icon} ${item.title}</h4>
          <p>链接: ${item.link}</p>
        </div>
        <div class="list-item-actions">
          <button class="btn btn-secondary btn-small" onclick="admin.editMenu(${item.id})">编辑</button>
          <button class="btn btn-danger btn-small" onclick="admin.deleteMenu(${item.id})">删除</button>
        </div>
      </div>
    `).join('');
  }

  editMenu(id) {
    const item = this.content.menu.find(m => m.id === id);
    if (!item) return;

    const modal = this.createModal('编辑菜单项', `
      <div class="form-group">
        <label>标题</label>
        <input type="text" id="edit-menu-title" value="${item.title}">
      </div>
      <div class="form-group">
        <label>链接</label>
        <input type="text" id="edit-menu-link" value="${item.link}">
      </div>
      <div class="form-group">
        <label>图标 (emoji)</label>
        <input type="text" id="edit-menu-icon" value="${item.icon}">
      </div>
      <div style="display:flex;gap:12px;margin-top:20px;">
        <button class="btn btn-primary" onclick="admin.saveMenu(${id})">保存</button>
        <button class="btn btn-secondary" onclick="admin.closeModal()">取消</button>
      </div>
    `);

    document.body.appendChild(modal);
  }

  saveMenu(id) {
    const item = this.content.menu.find(m => m.id === id);
    if (!item) return;

    item.title = document.getElementById('edit-menu-title').value;
    item.link = document.getElementById('edit-menu-link').value;
    item.icon = document.getElementById('edit-menu-icon').value;
    
    this.saveContent().then(() => {
      this.closeModal();
      this.renderMenuList();
    });
  }

  deleteMenu(id) {
    if (!confirm('确定要删除这个菜单项吗？')) return;
    this.content.menu = this.content.menu.filter(m => m.id !== id);
    this.saveContent().then(() => {
      this.renderMenuList();
      this.showToast('菜单项已删除', 'success');
    });
  }

  // 渲染雪季课程列表
  renderCoursesPageForm() {
    const container = document.getElementById('courses-page-form');
    if (!container || !this.content.coursesPage) return;
    const p = this.content.coursesPage;
    container.innerHTML = `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
        <div class="form-group">
          <label>页面主标题</label>
          <input type="text" id="cp-hero-title" value="${p.hero.title}">
        </div>
        <div class="form-group">
          <label>页面副标题</label>
          <input type="text" id="cp-hero-subtitle" value="${p.hero.subtitle}">
        </div>
        <div class="form-group">
          <label>雪季课程小标题</label>
          <input type="text" id="cp-snow-badge" value="${p.snowSection.badge}">
        </div>
        <div class="form-group">
          <label>雪季课程标题</label>
          <input type="text" id="cp-snow-title" value="${p.snowSection.title}">
        </div>
        <div class="form-group">
          <label>雪季课程副标题</label>
          <input type="text" id="cp-snow-subtitle" value="${p.snowSection.subtitle}">
        </div>
        <div class="form-group">
          <label>非雪季课程小标题</label>
          <input type="text" id="cp-off-badge" value="${p.offseasonSection.badge}">
        </div>
        <div class="form-group">
          <label>非雪季课程标题</label>
          <input type="text" id="cp-off-title" value="${p.offseasonSection.title}">
        </div>
        <div class="form-group">
          <label>非雪季课程副标题</label>
          <input type="text" id="cp-off-subtitle" value="${p.offseasonSection.subtitle}">
        </div>
        <div class="form-group">
          <label>CTA标题</label>
          <input type="text" id="cp-cta-title" value="${p.cta.title}">
        </div>
        <div class="form-group">
          <label>CTA副标题</label>
          <input type="text" id="cp-cta-subtitle" value="${p.cta.subtitle}">
        </div>
      </div>
      <div style="margin-top: 20px;">
        <button class="btn btn-primary" onclick="admin.saveCoursesPage()">保存页面内容</button>
      </div>
    `;
  }

  saveCoursesPage() {
    this.content.coursesPage = {
      hero: {
        title: document.getElementById('cp-hero-title').value,
        subtitle: document.getElementById('cp-hero-subtitle').value
      },
      snowSection: {
        badge: document.getElementById('cp-snow-badge').value,
        title: document.getElementById('cp-snow-title').value,
        subtitle: document.getElementById('cp-snow-subtitle').value
      },
      offseasonSection: {
        badge: document.getElementById('cp-off-badge').value,
        title: document.getElementById('cp-off-title').value,
        subtitle: document.getElementById('cp-off-subtitle').value
      },
      cta: {
        title: document.getElementById('cp-cta-title').value,
        subtitle: document.getElementById('cp-cta-subtitle').value
      }
    };
    this.saveContent().then(() => {
      this.showToast('页面内容已保存', 'success');
    });
  }

  addCourse(season) {
    const modal = this.createModal('添加课程', `
      <div class="form-group">
        <label>图标 (emoji)</label>
        <input type="text" id="course-icon" value="${season === 'snow' ? '🎿' : '🧗'}" placeholder="如: 🎿">
      </div>
      <div class="form-group">
        <label>课程名称</label>
        <input type="text" id="course-title" value="" placeholder="如: 私教课">
      </div>
      <div class="form-group">
        <label>标签（如：热门、推荐）</label>
        <input type="text" id="course-tag" value="" placeholder="如: 热门">
      </div>
      <div class="form-group">
        <label>课程内容</label>
        <textarea id="course-desc" rows="3" placeholder="课程描述内容"></textarea>
      </div>
      <div class="form-group">
        <label>适合人群</label>
        <input type="text" id="course-crowd" value="" placeholder="如: 成人和儿童">
      </div>
      <div class="form-group">
        <label>训练时间</label>
        <input type="text" id="course-time" value="" placeholder="如: 灵活预约">
      </div>
      <div class="form-group">
        <label>课程价格</label>
        <input type="text" id="course-price" value="" placeholder="如: 详询顾问">
      </div>
      <div class="form-group">
        <label>视频地址</label>
        <input type="text" id="course-video" value="" placeholder="输入视频URL或嵌入代码">
      </div>
      <div class="form-group">
        <label>封面图片URL</label>
        <input type="text" id="course-cover" value="" placeholder="输入封面图片URL">
      </div>
      <div class="form-group">
        <label style="color: var(--text-light);">提示：视频和封面图片请直接输入URL地址</label>
      </div>
      <div style="display: flex; gap: 10px; margin-top: 20px;">
        <button class="btn btn-primary" onclick="admin.saveNewCourse('${season}')">保存</button>
        <button class="btn btn-secondary" onclick="admin.closeModal()">取消</button>
      </div>
    `);
    document.body.appendChild(modal);
  }

  saveNewCourse(season) {
    const id = 'course_' + Date.now();
    const newCourse = {
      id: id,
      icon: document.getElementById('course-icon').value || '🎿',
      title: document.getElementById('course-title').value || '新课程',
      tag: document.getElementById('course-tag').value || '',
      featured: false,
      content: {
        description: document.getElementById('course-desc').value || '',
        crowd: document.getElementById('course-crowd').value || '',
        time: document.getElementById('course-time').value || '',
        price: document.getElementById('course-price').value || '详询顾问',
        video: document.getElementById('course-video').value || '',
        cover: document.getElementById('course-cover').value || ''
      }
    };
    this.content.courses[season].push(newCourse);
    this.saveContent().then(() => {
      this.closeModal();
      this.showToast('课程已添加', 'success');
      if (season === 'snow') {
        this.renderCoursesSnowList();
      } else {
        this.renderCoursesOffseasonList();
      }
    });
  }

  renderCoursesSnowList() {
    const container = document.getElementById('courses-snow-list');
    if (!container || !this.content.courses) return;

    const courses = this.content.courses.snow || [];
    
    container.innerHTML = courses.map((course, index) => `
      <div class="list-item" data-id="${course.id}">
        <div class="list-item-info">
          <h4>${course.icon} ${course.title}</h4>
          <p>标签: ${course.tag} | 适合: ${course.content.crowd}</p>
        </div>
        <div class="list-item-actions">
          <button class="btn btn-secondary btn-small" onclick="admin.editCourse('snow', '${course.id}')">编辑</button>
          <button class="btn btn-danger btn-small" onclick="admin.deleteCourse('snow', '${course.id}')">删除</button>
        </div>
      </div>
    `).join('');

    container.innerHTML += `
      <button class="btn btn-primary" style="margin-top: 20px;" onclick="admin.addCourse('snow')">+ 添加雪季课程</button>
    `;
  }

  // 渲染非雪季课程列表
  renderCoursesOffseasonList() {
    const container = document.getElementById('courses-offseason-list');
    if (!container || !this.content.courses) return;

    const courses = this.content.courses.offseason || [];
    
    container.innerHTML = courses.map((course, index) => `
      <div class="list-item" data-id="${course.id}">
        <div class="list-item-info">
          <h4>${course.icon} ${course.title}</h4>
          <p>标签: ${course.tag} | 适合: ${course.content.crowd}</p>
        </div>
        <div class="list-item-actions">
          <button class="btn btn-secondary btn-small" onclick="admin.editCourse('offseason', '${course.id}')">编辑</button>
          <button class="btn btn-danger btn-small" onclick="admin.deleteCourse('offseason', '${course.id}')">删除</button>
        </div>
      </div>
    `).join('');

    container.innerHTML += `
      <button class="btn btn-primary" style="margin-top: 20px;" onclick="admin.addCourse('offseason')">+ 添加非雪季课程</button>
    `;
  }

  // 添加课程
  addCourse(season) {
    const modal = this.createModal('添加课程', `
      <div class="form-group">
        <label>课程ID（英文唯一标识）</label>
        <input type="text" id="course-id" placeholder="如: new-course">
      </div>
      <div class="form-group">
        <label>图标（emoji）</label>
        <input type="text" id="course-icon" placeholder="如: 🎿">
      </div>
      <div class="form-group">
        <label>课程名称</label>
        <input type="text" id="course-title" placeholder="如: 新课程">
      </div>
      <div class="form-group">
        <label>标签</label>
        <input type="text" id="course-tag" placeholder="如: 新上线">
      </div>
      <div class="form-group">
        <label>课程描述</label>
        <textarea id="course-desc" placeholder="课程描述内容"></textarea>
      </div>
      <div class="form-group">
        <label>适合人群</label>
        <input type="text" id="course-crowd" placeholder="如: 成人 / 儿童">
      </div>
      <div class="form-group">
        <label>训练时间</label>
        <input type="text" id="course-time" placeholder="如: 约2小时/课时">
      </div>
      <div class="form-group">
        <label>课程价格</label>
        <input type="text" id="course-price" placeholder="如: 详询顾问">
      </div>
      <div class="form-group">
        <label>特点标签（用逗号分隔）</label>
        <input type="text" id="course-features" placeholder="如: 专业,高效,安全">
      </div>
      <div style="display: flex; gap: 10px; margin-top: 20px;">
        <button class="btn btn-primary" onclick="admin.saveNewCourse('${season}')">保存</button>
        <button class="btn btn-secondary" onclick="admin.closeModal()">取消</button>
      </div>
    `);
    document.body.appendChild(modal);
  }

  saveNewCourse(season) {
    const id = document.getElementById('course-id').value.trim();
    if (!id) {
      alert('请输入课程ID');
      return;
    }

    const features = document.getElementById('course-features').value.split(',').map(f => f.trim()).filter(f => f);

    const newCourse = {
      id: id,
      icon: document.getElementById('course-icon').value || '📚',
      title: document.getElementById('course-title').value || '新课程',
      tag: document.getElementById('course-tag').value || '新上线',
      tagType: 'normal',
      featured: false,
      content: {
        description: document.getElementById('course-desc').value || '',
        crowd: document.getElementById('course-crowd').value || '',
        time: document.getElementById('course-time').value || '',
        price: document.getElementById('course-price').value || '详询顾问'
      },
      features: features,
      videoText: '视频展示',
      videoSub: '点击观看',
      achievements: []
    };

    // 检查ID是否重复
    const exists = this.content.courses[season].find(c => c.id === id);
    if (exists) {
      alert('课程ID已存在，请使用不同的ID');
      return;
    }

    this.content.courses[season].push(newCourse);
    this.saveContent().then(() => {
      this.closeModal();
      if (season === 'snow') {
        this.renderCoursesSnowList();
      } else {
        this.renderCoursesOffseasonList();
      }
    });
  }

  // 编辑课程
  editCourse(season, id) {
    const course = this.content.courses[season].find(c => c.id === id);
    if (!course) return;

    const coverPreview = course.content.cover 
      ? '<img src="' + course.content.cover + '" style="width:100%;max-height:150px;object-fit:cover;border-radius:8px;">' 
      : '<p style="color:#666;font-size:0.9rem;">暂无封面</p>';
    const videoVal = course.content.video || '';
    const coverVal = course.content.cover || '';

    // 子课程列表HTML
    var subCourses = course.subCourses || [];
    var subCoursesHtml = '<div style="margin-top:20px;padding-top:20px;border-top:2px solid #eee;">';
    subCoursesHtml += '<h4 style="color:#0039A6;margin-bottom:12px;">📋 子课程列表</h4>';
    if (subCourses.length > 0) {
      subCourses.forEach(function(sub, idx) {
        subCoursesHtml += '<div style="background:#f8f9fa;padding:12px;border-radius:8px;margin-bottom:8px;">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;"><strong>' + (sub.name||'子课程'+(idx+1)) + '</strong>' +
          '<div style="display:flex;gap:8px;">' +
            '<button class="btn btn-secondary btn-small" onclick="admin.editSubCourse(\'' + season + '\',\'' + id + '\',' + idx + ')">编辑</button>' +
            '<button class="btn btn-danger btn-small" onclick="admin.deleteSubCourse(\'' + season + '\',\'' + id + '\',' + idx + ')">删除</button>' +
          '</div></div>' +
          '<div style="font-size:0.85rem;color:#666;margin-top:4px;">' + (sub.price||'') + ' | ' + (sub.timeLimit||'') + '</div>' +
        '</div>';
      });
    } else {
      subCoursesHtml += '<p style="color:#999;font-size:0.9rem;">暂无子课程</p>';
    }
    subCoursesHtml += '<button class="btn btn-primary" style="margin-top:8px;" onclick="admin.addSubCourse(\'' + season + '\',\'' + id + '\')">+ 添加子课程</button>';
    subCoursesHtml += '</div>';

    const modal = this.createModal('编辑课程', 
      '<div class="form-group"><label>图标</label><input type="text" id="course-icon" value="' + course.icon + '"></div>' +
      '<div class="form-group"><label>课程名称</label><input type="text" id="course-title" value="' + course.title + '"></div>' +
      '<div class="form-group"><label>标签</label><input type="text" id="course-tag" value="' + (course.tag || '') + '"></div>' +
      '<div class="form-group"><label>精选</label><input type="checkbox" id="course-featured"' + (course.featured ? ' checked' : '') + '></div>' +
      '<div class="form-group"><label>课程内容</label><textarea id="course-desc" rows="3">' + course.content.description + '</textarea></div>' +
      '<div class="form-group"><label>适合人群</label><input type="text" id="course-crowd" value="' + course.content.crowd + '"></div>' +
      '<div class="form-group"><label>训练时间</label><input type="text" id="course-time" value="' + course.content.time + '"></div>' +
      '<div class="form-group"><label>课程价格</label><input type="text" id="course-price" value="' + course.content.price + '"></div>' +
      '<div class="form-group"><label>视频地址</label><input type="text" id="course-video" value="' + videoVal + '" placeholder="输入视频URL"></div>' +
      '<div class="form-group"><label>封面上传</label><input type="file" id="course-cover-file" accept="image/*" onchange="admin.handleCoverUpload(this)"><input type="hidden" id="course-cover" value="' + coverVal + '"><div id="cover-preview-area" style="margin-top:10px;">' + coverPreview + '</div></div>' +
      subCoursesHtml +
      '<div style="display:flex;gap:10px;margin-top:20px;"><button class="btn btn-primary" id="btn-save-course">保存</button><button class="btn btn-secondary" onclick="admin.closeModal()">取消</button></div>'
    );
    document.body.appendChild(modal);
    
    document.getElementById('btn-save-course').onclick = () => this.saveCourse(season, id);
  }

  handleCoverUpload(input) {
    const file = input.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    fetch('/upload', { method: 'POST', body: formData })
      .then(r => r.json())
      .then(data => {
        if (data.url) {
          document.getElementById('course-cover').value = data.url;
          document.getElementById('cover-preview-area').innerHTML = '<img src="' + data.url + '" style="width:100%;max-height:150px;object-fit:cover;border-radius:8px;">';
          this.showToast('封面上传成功', 'success');
        }
      })
      .catch(() => this.showToast('上传失败', 'error'));
  }

  saveCourse(season, id) {
    const course = this.content.courses[season].find(c => c.id === id);
    if (!course) return;

    course.icon = document.getElementById('course-icon').value;
    course.title = document.getElementById('course-title').value;
    course.tag = document.getElementById('course-tag').value;
    course.featured = document.getElementById('course-featured').checked;
    course.content.description = document.getElementById('course-desc').value;
    course.content.crowd = document.getElementById('course-crowd').value;
    course.content.time = document.getElementById('course-time').value;
    course.content.price = document.getElementById('course-price').value;
    course.content.video = document.getElementById('course-video').value;
    course.content.cover = document.getElementById('course-cover').value;

    this.saveContent().then(() => {
      this.closeModal();
      this.showToast('课程已保存', 'success');
      if (season === 'snow') {
        this.renderCoursesSnowList();
      } else {
        this.renderCoursesOffseasonList();
      }
    });
  }

  // 删除课程
  deleteCourse(season, id) {
    if (!confirm('确定要删除这个课程吗？')) return;

    const index = this.content.courses[season].findIndex(c => c.id === id);
    if (index > -1) {
      this.content.courses[season].splice(index, 1);
      this.saveContent().then(() => {
        if (season === 'snow') {
          this.renderCoursesSnowList();
        } else {
          this.renderCoursesOffseasonList();
        }
      });
    }
  }

  // 辅助方法
  createModal(title, content) {
    const modal = document.createElement('div');
    modal.id = 'edit-modal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
    `;
    modal.innerHTML = `
      <div style="background: white; border-radius: 16px; padding: 30px; max-width: 500px; width: 90%; max-height: 90vh; overflow-y: auto;">
        <h3 style="margin-bottom: 20px; color: #0039A6;">${title}</h3>
        ${content}
      </div>
    `;
    modal.onclick = (e) => {
      if (e.target === modal) this.closeModal();
    };
    return modal;
  }

  closeModal() {
    const modal = document.getElementById('edit-modal');
    if (modal) modal.remove();
  }

  showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  bindEvents() {
    const self = this;

    // 主 Tab 切换
    document.querySelectorAll('.admin-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const target = e.target.dataset.tab;
        if (!target) return;
        
        // 隐藏所有子菜单
        document.querySelectorAll('.admin-subtabs').forEach(s => s.classList.remove('visible'));
        
        // 显示对应子菜单并切换panel
        if (target === 'apply') {
          document.getElementById('apply-subtabs').classList.add('visible');
          // 找到第一个可见的子菜单
          var firstVisible = document.querySelector('#apply-subtabs .admin-subtab:not([style*="display: none"])');
          var firstTab = firstVisible ? firstVisible.dataset.tab : 'quizStats';
          this.switchSubTab('apply', firstTab);
        } else if (target === 'lottery') {
          document.getElementById('lottery-subtabs').classList.add('visible');
          var firstVisible = document.querySelector('#lottery-subtabs .admin-subtab:not([style*="display: none"])');
          var firstTab = firstVisible ? firstVisible.dataset.tab : 'lottery-create';
          this.switchSubTab('lottery', firstTab);
        } else if (target === 'accounts') {
          document.getElementById('accounts-subtabs').classList.add('visible');
          var firstVisible = document.querySelector('#accounts-subtabs .admin-subtab:not([style*="display: none"])');
          var firstTab = firstVisible ? firstVisible.dataset.tab : 'create-account';
          this.switchSubTab('accounts', firstTab);
        } else {
          this.switchMainTab(target);
        }
      });
    });

    // 子 Tab 切换（事件委托）
    document.querySelectorAll('.admin-subtabs').forEach(subtabs => {
      subtabs.addEventListener('click', (e) => {
        const btn = e.target.closest('.admin-subtab');
        if (!btn) return;
        const subTarget = btn.dataset.tab;
        const parent = subtabs.id.replace('-subtabs', '');
        console.log('子菜单点击:', { subTarget: subTarget, parent: parent });
        this.switchSubTab(parent, subTarget);
      });
    });

    // 新建账号 - 角色切换显示权限配置
    document.getElementById('new-acc-role')?.addEventListener('change', function() {
      const box = document.getElementById('new-acc-perm-box');
      if (this.value === 'admin') {
        box.style.display = 'block';
        self.renderNewAccountPermissions();
      } else {
        box.style.display = 'none';
      }
    });
  }

  switchSubTab(parent, target) {
    console.log('switchSubTab called:', { parent: parent, target: target });
    
    // 父级高亮
    document.querySelectorAll('.admin-tab').forEach(t => {
      if (t.dataset.tab === parent) t.classList.add('active');
      else t.classList.remove('active');
    });

    // 子菜单高亮
    const subtabsId = parent + '-subtabs';
    document.querySelectorAll('#' + subtabsId + ' .admin-subtab').forEach(st => {
      st.classList.toggle('active', st.dataset.tab === target);
    });

    // 显示对应面板
    document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
    const panel = document.getElementById('panel-' + target);
    console.log('Looking for panel:', 'panel-' + target, 'Found:', panel);
    if (panel) panel.classList.add('active');

    // 加载数据
    if (target === 'lottery-create') this.loadLotterySettings();
    if (target === 'lottery-records') this.loadLotteryRecords();
    if (target === 'lottery-history') this.loadLotteryHistory();
    if (target === 'all-accounts') this.loadAccountsList();
    if (target === 'create-account') this.resetCreateAccountForm();
    if (target === 'apply') { this.renderQuizQuestions(); this.renderQuizResult(); }
    if (target === 'coupon') this.renderActivities();
    if (target === 'library') this.renderCourseCategories();
    if (target === 'rules') { this.renderRecommendationConfig(); this.renderRecommendationActivities(); this.renderRules(); }
    if (target === 'quizStats') this.loadQuizStatistics();
  }
  
  switchMainTab(target) {
    console.log('switchMainTab called:', target);
    // 高亮对应tab
    document.querySelectorAll('.admin-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.tab === target);
    });
    // 显示对应panel
    document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
    const panel = document.getElementById('panel-' + target);
    console.log('switchMainTab looking for:', 'panel-' + target, 'Found:', panel);
    if (panel) panel.classList.add('active');
    // 加载数据
    if (target === 'home') { /* 首页不需要特殊加载 */ }
    if (target === 'courses') { /* 课程不需要特殊加载 */ }
  }


  // ==================== 问卷管理 ====================
  renderQuizQuestions() {
    const container = document.getElementById('quiz-questions-tree');
    if (!container || !this.content.quiz) return;
    document.getElementById('quiz-start-id').value = this.content.quiz.startQuestionId || '';
    if (!this.content.quiz.questions || this.content.quiz.questions.length === 0) {
      container.innerHTML = '<p style="color: var(--text-light);">暂无题目</p>';
      return;
    }
    const typeColors = { single: '#3b82f6', multiple: '#8b5cf6', input: '#10b981' };
    const typeNames = { single: '单选', multiple: '多选', input: '输入' };
    const self = this;
    container.innerHTML = this.content.quiz.questions.map((q, idx) => '<div class="quiz-item" draggable="true" data-id="'+q.id+'" data-idx="'+idx+'" style="background:#f8f9fa;border-radius:8px;padding:16px;margin-bottom:12px;border-left:4px solid #C9A962;cursor:move;"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;"><div><span style="background:#C9A962;color:white;padding:2px 8px;border-radius:4px;font-size:0.8rem;margin-right:8px;">☰ 拖拽</span><span style="background:#C9A962;color:white;padding:2px 8px;border-radius:4px;font-size:0.8rem;margin-right:8px;">ID:'+q.id+'</span><span style="background:'+typeColors[q.type]+';color:white;padding:2px 8px;border-radius:4px;font-size:0.8rem;">'+typeNames[q.type]+'</span></div><div style="display:flex;gap:8px;"><button class="btn-edit" data-action="edit" data-id="'+q.id+'">编辑</button><button class="btn-delete" data-action="delete" data-id="'+q.id+'">删除</button></div></div><p style="font-weight:600;margin:8px 0;">'+(idx+1)+'. '+q.content+'</p></div>').join('');
    
    // 拖拽排序
    let draggedIdx = null;
    container.querySelectorAll('.quiz-item').forEach(item => {
      item.addEventListener('dragstart', function(e) {
        draggedIdx = parseInt(this.dataset.idx);
        this.style.opacity = '0.5';
      });
      item.addEventListener('dragend', function() {
        this.style.opacity = '1';
        draggedIdx = null;
      });
      item.addEventListener('dragover', function(e) {
        e.preventDefault();
        this.style.borderTop = '3px solid #0039A6';
      });
      item.addEventListener('dragleave', function() {
        this.style.borderTop = '';
      });
      item.addEventListener('drop', function(e) {
        e.preventDefault();
        this.style.borderTop = '';
        const dropIdx = parseInt(this.dataset.idx);
        if (draggedIdx !== null && draggedIdx !== dropIdx) {
          const questions = self.content.quiz.questions;
          const [moved] = questions.splice(draggedIdx, 1);
          questions.splice(dropIdx, 0, moved);
          self.saveContent().then(() => self.renderQuizQuestions());
        }
      });
    });
    
    // 事件委托
    container.onclick = (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      const id = btn.dataset.id;
      if (action === 'edit') this.editQuestion(id);
      if (action === 'delete') this.deleteQuestion(id);
    };
  }

  renderQuizResult() {
    const container = document.getElementById('quiz-result-form');
    if (!container || !this.content.quiz) return;
    const r = this.content.quiz.result || {};
    container.innerHTML = '<div class="form-group"><label>结束页面标题</label><input type="text" id="quiz-result-title" value="'+r.title+'"></div><div class="form-group"><label>结束页面内容</label><textarea id="quiz-result-content" rows="3">'+r.content+'</textarea></div><button class="btn btn-primary" onclick="admin.saveQuizResult()">保存</button>';
  }

  saveQuizSettings() {
    if (!this.content.quiz) this.content.quiz = {};
    this.content.quiz.startQuestionId = document.getElementById('quiz-start-id').value;
    this.saveContent().then(() => this.showToast('设置已保存', 'success'));
  }

  saveQuizResult() {
    if (!this.content.quiz) this.content.quiz = {};
    this.content.quiz.result = { title: document.getElementById('quiz-result-title').value, content: document.getElementById('quiz-result-content').value };
    this.saveContent().then(() => { this.showToast('已保存', 'success'); this.renderQuizResult(); });
  }

  addQuestion() {
    const id = 'q' + (this.content.quiz?.questions?.length + 1 || 1);
    const modal = this.createModal('添加题目', '<div class="form-group"><label>题目ID</label><input type="text" id="new-q-id" value="'+id+'"></div><div class="form-group"><label>题目类型</label><select id="new-q-type"><option value="single">单选</option><option value="multiple">多选</option><option value="input">输入框</option></select></div><div class="form-group"><label>题目内容</label><textarea id="new-q-content" rows="2"></textarea></div><div class="form-group" id="new-q-opt"><label>答案（每行一个）</label><textarea id="new-q-options" rows="3"></textarea></div><div style="display:flex;gap:12px;margin-top:20px;"><button class="btn btn-primary" onclick="admin.saveNewQuestion()">保存</button><button class="btn btn-secondary" onclick="admin.closeModal()">取消</button></div>');
    document.body.appendChild(modal);
    document.getElementById('new-q-type').onchange = function() { document.getElementById('new-q-opt').style.display = this.value === 'input' ? 'none' : 'block'; };
  }

  saveNewQuestion() {
    const id = document.getElementById('new-q-id').value.trim();
    const type = document.getElementById('new-q-type').value;
    const content = document.getElementById('new-q-content').value.trim();
    if (!id || !content) { alert('请填写完整'); return; }
    const newQ = { id, type, content };
    if (type !== 'input') {
      const optionsText = document.getElementById('new-q-options').value.trim();
      newQ.options = optionsText.split('\n').map(line => { const parts = line.split('|'); return { text: parts[0].trim(), next: parts[1]?.trim() || 'end' }; }).filter(opt => opt.text);
    } else { newQ.placeholder = '请输入...'; newQ.next = 'end'; }
    if (!this.content.quiz) this.content.quiz = { questions: [], startQuestionId: id };
    if (!this.content.quiz.questions) this.content.quiz.questions = [];
    this.content.quiz.questions.push(newQ);
    this.saveContent().then(() => { this.closeModal(); this.showToast('已添加', 'success'); this.renderQuizQuestions(); });
  }

  editQuestion(id) {
    const q = this.content.quiz?.questions?.find(q => q.id === id);
    if (!q) return;
    const selS = q.type === 'single' ? 'selected' : '';
    const selM = q.type === 'multiple' ? 'selected' : '';
    const selI = q.type === 'input' ? 'selected' : '';
    const qid = q.id.replace(/'/g, "\\'");
    const optLines = q.options?.map(o => o.text+'|'+o.next).join('\n') || '';
    const qIds = this.content.quiz?.questions?.map(q => q.id) || [];
        const nextOptions = qIds.map(qid => '<option value="'+qid+'"'+(q.next===qid?' selected':'')+'>'+qid+'</option>').join('');
        const optHtml = q.type !== 'input' ? '<div class="form-group"><label>答案选项（每行一个）</label><textarea id="edit-q-options" rows="4">'+optLines+'</textarea></div>' : '<div class="form-group"><label>占位文字</label><input type="text" id="edit-q-placeholder" value="'+(q.placeholder||'')+'"></div><div class="form-group"><label>下一题</label><select id="edit-q-next" style="width:100%;padding:8px;"><option value="end">结束</option>'+nextOptions+'</select></div>';
    const modal = this.createModal('编辑题目', '<div class="form-group"><label>题目ID</label><input type="text" id="edit-q-id" value="'+qid+'" style="width:100%;padding:8px;"></div><div class="form-group"><label>题目类型</label><select id="edit-q-type"><option value="single" '+selS+'>单选</option><option value="multiple" '+selM+'>多选</option><option value="input" '+selI+'>输入框</option></select></div><div class="form-group"><label>题目内容</label><textarea id="edit-q-content" rows="2">'+q.content.replace(/</g, '&lt;').replace(/>/g, '&gt;')+'</textarea></div>'+optHtml+'<div style="display:flex;gap:12px;margin-top:20px;"><button class="btn btn-primary" onclick="admin.saveEditQuestion(\''+qid+'\')">保存</button><button class="btn btn-secondary" onclick="admin.closeModal()">取消</button></div>');
    document.body.appendChild(modal);
  }

  saveEditQuestion(oldId) {
    const questions = this.content.quiz.questions;
    const q = questions.find(q => q.id === oldId);
    if (!q) return;
    const newId = document.getElementById('edit-q-id').value.trim();
    if (newId !== oldId) {
      // Check if new ID already exists
      if (questions.some(q => q.id === newId)) {
        alert('ID已存在，请使用其他ID');
        return;
      }
      q.id = newId;
    }
    q.type = document.getElementById('edit-q-type').value;
    q.content = document.getElementById('edit-q-content').value.trim();
    if (q.type !== 'input') {
      q.options = document.getElementById('edit-q-options').value.trim().split('\n').map(line => { const parts = line.split('|'); return { text: parts[0].trim(), next: parts[1]?.trim() || 'end' }; }).filter(opt => opt.text);
    } else { 
      q.placeholder = document.getElementById('edit-q-placeholder').value; 
      q.next = document.getElementById('edit-q-next').value; 
    }
    this.saveContent().then(() => { this.closeModal(); this.showToast('已保存', 'success'); this.renderQuizQuestions(); });
  }

  deleteQuestion(id) {
    if (!confirm('确定删除？')) return;
    this.content.quiz.questions = this.content.quiz.questions.filter(q => q.id !== id);
    this.saveContent().then(() => { this.showToast('已删除', 'success'); this.renderQuizQuestions(); });
  }

  renderCourseCategories() {
    var c = document.getElementById('course-categories');
    if (!c) return;
    var snow = this.content.courses?.snow || [];
    var offseason = this.content.courses?.offseason || [];
    var html = '<div class="cat-btn" data-type="snow" style="padding:12px 20px;background:' + (this.selectedCategory==='snow'?'#0039A6':'#e5e7eb') + ';color:' + (this.selectedCategory==='snow'?'white':'#333') + ';border-radius:20px;cursor:pointer;display:inline-block;margin-right:10px;">🏔️ 雪季课程 (' + snow.length + '门)</div>';
    html += '<div class="cat-btn" data-type="offseason" style="padding:12px 20px;background:' + (this.selectedCategory==='offseason'?'#0039A6':'#e5e7eb') + ';color:' + (this.selectedCategory==='offseason'?'white':'#333') + ';border-radius:20px;cursor:pointer;display:inline-block;">🌿 非雪季课程 (' + offseason.length + '门)</div>';
    c.innerHTML = html;
    var self = this;
    c.querySelectorAll('.cat-btn').forEach(function(btn) {
      btn.onclick = function() { self.selectCategory(this.dataset.type); };
    });
  }

  selectCategory(type) {
    this.selectedCategory = type;
    this.renderCourseCategories();
    this.renderCategoryCourses();
  }

  renderCategoryCourses() {
    var cont = document.getElementById('category-courses');
    var list = document.getElementById('courses-list');
    var title = document.getElementById('current-category-title');
    if (!this.selectedCategory) { cont.style.display = 'none'; return; }
    var name = this.selectedCategory === 'snow' ? '🏔️ 雪季课程' : '🌿 非雪季课程';
    var courses = this.selectedCategory === 'snow' ? (this.content.courses?.snow || []) : (this.content.courses?.offseason || []);
    cont.style.display = 'block';
    title.textContent = name + ' - 课程列表';
    if (courses.length === 0) { list.innerHTML = '<p style="color:#999;text-align:center;padding:30px;">暂无课程</p>'; return; }
    var self = this;
    var html = '';
    courses.forEach(function(c, i) {
      var subs = c.subCourses || [];
      html += '<div style="background:#f8f9fa;padding:16px;margin-bottom:12px;border-radius:8px;border-left:4px solid #C9A962;">';
      html += '<div style="margin-bottom:8px;"><strong style="font-size:1.1rem;color:#0039A6;">' + (c.icon||'') + ' ' + c.title + '</strong></div>';
      html += '<div style="font-size:0.9rem;color:#666;margin-bottom:10px;"><p>📝 ' + ((c.content?.description)||'') + '</p><p>💰 ' + ((c.content?.price)||'') + '</p></div>';
      html += '<button class="btn-action" data-action="setTable" data-idx="' + i + '">📋 课程表</button> ';
      html += '<button class="btn-action" data-action="addSub" data-idx="' + i + '">+ 添加子课程</button>';
      if (subs.length > 0) {
        html += '<div style="margin-top:12px;padding-top:12px;border-top:1px dashed #ddd;"><strong style="color:#0039A6;">子课程 (' + subs.length + ')</strong>';
        subs.forEach(function(sub, si) {
          html += '<div style="background:#fff;padding:10px;margin-top:8px;border-radius:6px;font-size:0.9rem;">';
          html += '<div style="display:flex;justify-content:space-between;"><strong>' + sub.order + '. ' + sub.name + '</strong>';
          html += '<div><button class="btn-action" data-action="editSub" data-idx="' + i + '" data-subidx="' + si + '">编辑</button> ';
          html += '<button class="btn-action" data-action="copySub" data-idx="' + i + '" data-subidx="' + si + '">复制</button> ';
          html += '<button class="btn-action" data-action="delSub" data-idx="' + i + '" data-subidx="' + si + '">删除</button></div></div>';
          html += '<div style="color:#666;font-size:0.85rem;margin-top:4px;">' + (sub.category?'📂'+sub.category:'') + ' ' + (sub.timeLimit?'⏰'+sub.timeLimit:'') + ' ' + (sub.price?'💰'+sub.price:'') + '</div>';
          html += '<div style="color:#555;font-size:0.85rem;margin-top:4px;">' + (sub.description||'') + '</div></div>';
        });
        html += '</div>';
      }
      html += '</div>';
    });
    list.innerHTML = html;
    list.onclick = function(e) {
      var btn = e.target.closest('.btn-action');
      if (!btn) return;
      var action = btn.dataset.action;
      var idx = parseInt(btn.dataset.idx);
      var subIdx = parseInt(btn.dataset.subidx||'0');
      if (action === 'setTable') self.setCourseTable(idx);
      else if (action === 'addSub') self.addSubCourse(idx);
      else if (action === 'editSub') self.editSubCourse(idx, subIdx);
      else if (action === 'copySub') self.copySubCourse(idx, subIdx);
      else if (action === 'delSub') self.deleteSubCourse(idx, subIdx);
    };
  }

  setCourseTable(idx) {
    var courses = this.selectedCategory === 'snow' ? this.content.courses.snow : this.content.courses.offseason;
    var course = courses[idx];
    var preview = course.tableLink ? '<div style="margin-bottom:15px;padding:12px;background:#f5f5f5;border-radius:8px;"><label style="font-weight:600;color:#0039A6;">📋 预览</label><div style="background:#fff;margin-top:8px;border-radius:6px;overflow:hidden;"><iframe src="' + course.tableLink + '" style="width:100%;height:300px;border:none;" frameborder="0"></iframe></div></div>' : '<div style="padding:20px;text-align:center;color:#999;">暂无活动表</div>'; var m = this.createModal('活动表链接', '<div class="form-group"><label>WPS活动表链接</label><input type="text" id="tbl-link" value="' + (course.tableLink||'') + '" placeholder="粘贴WPS表格链接" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px;" oninput="this.parentNode.previousElementSibling.querySelector(\'iframe\').src = this.value;"></div>' + preview + '<div style="margin-top:20px;"><button id="btn-save-tbl" class="btn btn-primary">保存</button> <button onclick="admin.closeModal()" class="btn btn-secondary">取消</button></div>');
    document.body.appendChild(m);
    document.getElementById('btn-save-tbl').onclick = function() {
      course.tableLink = document.getElementById('tbl-link').value.trim();
      this.saveContent().then(function() { this.closeModal(); this.showToast('已保存','success'); this.renderCategoryCourses(); }.bind(this));
    }.bind(this);
  }

  addSubCourse(idx) {
    var courses = this.selectedCategory === 'snow' ? this.content.courses.snow : this.content.courses.offseason;
    var course = courses[idx];
    if (!course.subCourses) course.subCourses = [];
    var nextOrder = course.subCourses.length + 1;
    var m = this.createModal('添加子课程', '<div class="form-group"><label>序号</label><input type="number" id="sub-order" value="' + nextOrder + '" style="width:80px;"></div><div class="form-group"><label>名称 *</label><input type="text" id="sub-name" placeholder="名称" style="width:100%;padding:8px;"></div><div class="form-group"><label>类别</label><input type="text" id="sub-cat" placeholder="如：初级" style="width:100%;padding:8px;"></div><div class="form-group"><label>时限</label><input type="text" id="sub-time" placeholder="如：10课时" style="width:100%;padding:8px;"></div><div class="form-group"><label>价格</label><input type="text" id="sub-price" placeholder="如：¥2000" style="width:100%;padding:8px;"></div><div class="form-group"><label>说明</label><textarea id="sub-desc" rows="3" style="width:100%;padding:8px;"></textarea></div><div class="form-group"><label>备注</label><input type="text" id="sub-notes" placeholder="选填" style="width:100%;padding:8px;"></div><div style="margin-top:20px;"><button id="btn-add-sub" class="btn btn-primary">添加</button> <button onclick="admin.closeModal()" class="btn btn-secondary">取消</button></div>');
    document.body.appendChild(m);
    var self = this;
    document.getElementById('btn-add-sub').onclick = function() {
      var name = document.getElementById('sub-name').value.trim();
      if (!name) { alert('请输入名称'); return; }
      course.subCourses.push({order:document.getElementById('sub-order').value, name:name, category:document.getElementById('sub-cat').value, timeLimit:document.getElementById('sub-time').value, price:document.getElementById('sub-price').value, description:document.getElementById('sub-desc').value, notes:document.getElementById('sub-notes').value});
      self.saveContent().then(function() { self.closeModal(); self.showToast('已添加','success'); self.renderCategoryCourses(); });
    };
  }

  editSubCourse(idx, subIdx) {
    var courses = this.selectedCategory === 'snow' ? this.content.courses.snow : this.content.courses.offseason;
    var sub = courses[idx].subCourses[subIdx];
    var m = this.createModal('编辑子课程', '<div class="form-group"><label>序号</label><input type="number" id="sub-order" value="' + sub.order + '" style="width:80px;"></div><div class="form-group"><label>名称 *</label><input type="text" id="sub-name" value="' + sub.name + '" style="width:100%;padding:8px;"></div><div class="form-group"><label>类别</label><input type="text" id="sub-cat" value="' + (sub.category||'') + '" style="width:100%;padding:8px;"></div><div class="form-group"><label>时限</label><input type="text" id="sub-time" value="' + (sub.timeLimit||'') + '" style="width:100%;padding:8px;"></div><div class="form-group"><label>价格</label><input type="text" id="sub-price" value="' + (sub.price||'') + '" style="width:100%;padding:8px;"></div><div class="form-group"><label>说明</label><textarea id="sub-desc" rows="3" style="width:100%;padding:8px;">' + (sub.description||'') + '</textarea></div><div class="form-group"><label>备注</label><input type="text" id="sub-notes" value="' + (sub.notes||'') + '" style="width:100%;padding:8px;"></div><div style="margin-top:20px;"><button id="btn-save-sub" class="btn btn-primary">保存</button> <button onclick="admin.closeModal()" class="btn btn-secondary">取消</button></div>');
    document.body.appendChild(m);
    var self = this;
    document.getElementById('btn-save-sub').onclick = function() {
      sub.order = document.getElementById('sub-order').value;
      sub.name = document.getElementById('sub-name').value.trim();
      sub.category = document.getElementById('sub-cat').value;
      sub.timeLimit = document.getElementById('sub-time').value;
      sub.price = document.getElementById('sub-price').value;
      sub.description = document.getElementById('sub-desc').value;
      sub.notes = document.getElementById('sub-notes').value;
      self.saveContent().then(function() { self.closeModal(); self.showToast('已保存','success'); self.renderCategoryCourses(); });
    };
  }

  copySubCourse(idx, subIdx) {
    var courses = this.selectedCategory === 'snow' ? this.content.courses.snow : this.content.courses.offseason;
    var course = courses[idx];
    var original = course.subCourses[subIdx];
    var copy = JSON.parse(JSON.stringify(original));
    copy.order = course.subCourses.length + 1;
    copy.name = original.name + ' (副本)';
    course.subCourses.push(copy);
    this.saveContent().then(() => { this.showToast('已复制','success'); this.renderCategoryCourses(); });
  }

  deleteSubCourse(idx, subIdx) {
    if (!confirm('确定删除？')) return;
    var courses = this.selectedCategory === 'snow' ? this.content.courses.snow : this.content.courses.offseason;
    courses[idx].subCourses.splice(subIdx, 1);
    this.saveContent().then(() => { this.showToast('已删除','success'); this.renderCategoryCourses(); });
  }

  // ==================== 优惠活动 ====================
  renderActivities() {
    var list = document.getElementById('activities-list');
    if (!list) return;
    var acts = this.content.activities || [];
    if (acts.length === 0) { list.innerHTML = '<p style="color:#999;text-align:center;padding:30px;">暂无活动，点击上方按钮添加</p>'; return; }
    var self = this;
    var html = '';
    acts.forEach(function(a, i) {
      html += '<div style="background:#f8f9fa;padding:16px;margin-bottom:12px;border-radius:8px;border-left:4px solid #FF6B35;">';
      html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
      html += '<strong style="font-size:1.1rem;color:#0039A6;">' + a.title + '</strong>';
      html += '<div><button class="btn-action" data-action="editAct" data-idx="' + i + '">编辑</button> <button class="btn-action" data-action="delAct" data-idx="' + i + '">删除</button></div>';
      html += '</div>';
      if (a.tableLink) html += '<div style="margin-top:8px;font-size:0.9rem;color:#666;">📋 活动表：<a href="' + a.tableLink + '" target="_blank">查看链接</a></div>';
      html += '</div>';
    });
    list.innerHTML = html;
    list.onclick = function(e) {
      var btn = e.target.closest('.btn-action');
      if (!btn) return;
      var action = btn.dataset.action;
      var idx = parseInt(btn.dataset.idx);
      if (action === 'editAct') self.editActivity(idx);
      else if (action === 'delAct') self.deleteActivity(idx);
    };
  }

  addActivity() {
    var self = this;
    var m = this.createModal('添加活动', '<div class="form-group"><label>活动名称 *</label><input type="text" id="act-title" placeholder="如：暑期优惠" style="width:100%;padding:8px;"></div><div class="form-group"><label>活动表链接</label><input type="text" id="act-link" placeholder="粘贴WPS表格链接" style="width:100%;padding:8px;"></div><div id="act-preview" style="margin-top:10px;"></div><div style="margin-top:20px;"><button id="btn-add-act" class="btn btn-primary">添加</button> <button onclick="admin.closeModal()" class="btn btn-secondary">取消</button></div>');
    document.body.appendChild(m);
    var preview = document.getElementById('act-preview');
    document.getElementById('act-link').addEventListener('input', function() {
      if (this.value) preview.innerHTML = '<div style="background:#f5f5f5;padding:8px;border-radius:6px;"><label style="font-weight:600;font-size:0.9rem;">预览</label><div style="background:#fff;margin-top:6px;border-radius:4px;overflow:hidden;"><iframe src="' + this.value + '" style="width:100%;height:200px;border:none;" frameborder="0"></iframe></div></div>';
      else preview.innerHTML = '';
    });
    document.getElementById('btn-add-act').addEventListener('click', function() {
      var title = document.getElementById('act-title').value.trim();
      if (!title) { alert('请输入活动名称'); return; }
      if (!self.content.activities) self.content.activities = [];
      self.content.activities.push({title: title, tableLink: document.getElementById('act-link').value.trim()});
      self.saveContent().then(function() { self.closeModal(); self.showToast('已添加','success'); self.renderActivities(); });
    });
  }

  editActivity(idx) {
    var acts = this.content.activities;
    var act = acts[idx];
    var self = this;
    var previewHtml = act.tableLink ? '<div style="background:#f5f5f5;padding:8px;border-radius:6px;margin-top:10px;"><label style="font-weight:600;font-size:0.9rem;">预览</label><div style="background:#fff;margin-top:6px;border-radius:4px;overflow:hidden;"><iframe id="act-preview-iframe" src="' + act.tableLink + '" style="width:100%;height:200px;border:none;" frameborder="0"></iframe></div></div>' : '';
    var m = this.createModal('编辑活动', '<div class="form-group"><label>活动名称 *</label><input type="text" id="act-title" value="' + act.title + '" style="width:100%;padding:8px;"></div><div class="form-group"><label>活动表链接</label><input type="text" id="act-link" value="' + (act.tableLink||'') + '" placeholder="粘贴WPS表格链接" style="width:100%;padding:8px;" oninput="var p=document.getElementById(\'act-preview\'); if(this.value) p.innerHTML=\'<div style=background:#f5f5f5;padding:8px;border-radius:6px;><label style=font-weight:600;font-size:0.9rem;>预览</label><div style=background:#fff;margin-top:6px;border-radius:4px;overflow:hidden;><iframe src=\'+this.value+\' style=width:100%;height:200px;border:none; frameborder=0></iframe></div></div>\'; else p.innerHTML=\'\';"></div><div id="act-preview">' + previewHtml + '</div><div style="margin-top:20px;"><button id="btn-save-act" class="btn btn-primary">保存</button> <button onclick="admin.closeModal()" class="btn btn-secondary">取消</button></div>');
    document.body.appendChild(m);
    document.getElementById('btn-save-act').addEventListener('click', function() {
      act.title = document.getElementById('act-title').value.trim();
      act.tableLink = document.getElementById('act-link').value.trim();
      self.saveContent().then(function() { self.closeModal(); self.showToast('已保存','success'); self.renderActivities(); });
    });
  }

  deleteActivity(idx) {
    if (!confirm('确定删除？')) return;
    this.content.activities.splice(idx, 1);
    this.saveContent().then(() => { this.showToast('已删除','success'); this.renderActivities(); });
  }

  // ==================== 推荐规则管理 ====================
  renderRules() {
    var list = document.getElementById('rules-list');
    if (!list) return;
    var rules = this.content.recommendRules || [];
    if (rules.length === 0) { list.innerHTML = '<p style="color:#999;text-align:center;padding:30px;">暂无规则，点击上方按钮添加</p>'; return; }
    var self = this;
    var html = '';
    rules.forEach(function(r, i) {
      html += '<div style="background:#f8f9fa;padding:16px;margin-bottom:12px;border-radius:8px;border-left:4px solid #28a745;">';
      html += '<div style="display:flex;justify-content:space-between;align-items:start;"><strong style="font-size:1.1rem;color:#0039A6;">' + r.name + '</strong>';
      html += '<div><button class="btn-action" data-action="editRule" data-idx="' + i + '">编辑</button> <button class="btn-action" data-action="delRule" data-idx="' + i + '">删除</button></div></div>';
      html += '<div style="font-size:0.9rem;color:#666;margin-top:8px;">';
      html += '<p>🎯 条件：' + (r.conditions?.goal||'不限') + ' | ' + (r.conditions?.budget||'不限') + ' | ' + (r.conditions?.experience||'不限') + '</p>';
      html += '<p>📦 推荐课程：' + (r.result?.courseTitle||'未设置') + '</p>';
      html += '<p>💰 匹配活动：' + (r.result?.activityTitle||'无') + '</p>';
      html += '</div></div>';
    });
    list.innerHTML = html;
    list.onclick = function(e) {
      var btn = e.target.closest('.btn-action');
      if (!btn) return;
      var action = btn.dataset.action;
      var idx = parseInt(btn.dataset.idx);
      if (action === 'editRule') self.editRule(idx);
      else if (action === 'delRule') self.deleteRule(idx);
    };
  }

  addRule() {
    var self = this;
    var html = '<div class="form-group"><label>规则名称 *</label><input type="text" id="rule-name" placeholder="如：初学者推荐" style="width:100%;padding:8px;"></div>';
    html += '<div style="border:1px solid #ddd;padding:15px;border-radius:8px;margin-bottom:15px;">';
    html += '<h4 style="margin-bottom:10px;">🎯 匹配条件</h4>';
    html += '<div class="form-group"><label>学习目的</label><select id="rule-goal" style="width:100%;padding:8px;"><option value="">不限</option><option value="入门体验">入门体验</option><option value="技术提升">技术提升</option><option value="考证">考证</option><option value="竞技">竞技</option></select></div>';
    html += '<div class="form-group"><label>预算范围</label><select id="rule-budget" style="width:100%;padding:8px;"><option value="">不限</option><option value="2000以下">2000以下</option><option value="2000-5000">2000-5000</option><option value="5000-10000">5000-10000</option><option value="10000以上">10000以上</option></select></div>';
    html += '<div class="form-group"><label>滑雪经验</label><select id="rule-exp" style="width:100%;padding:8px;"><option value="">不限</option><option value="零基础">零基础</option><option value="有基础">有基础</option></select></div>';
    html += '</div>';
    html += '<div style="border:1px solid #ddd;padding:15px;border-radius:8px;">';
    html += '<h4 style="margin-bottom:10px;">📦 推荐结果</h4>';
    html += '<div class="form-group"><label>推荐课程类型</label><select id="rule-course" style="width:100%;padding:8px;"><option value="">请选择</option>';
    var snowCourses = this.content.courses?.snow || [];
    var offseasonCourses = this.content.courses?.offseason || [];
    snowCourses.forEach(function(c) { html += '<option value="' + c.id + '">🏔️ ' + c.title + '</option>'; });
    offseasonCourses.forEach(function(c) { html += '<option value="' + c.id + '">🌿 ' + c.title + '</option>'; });
    html += '</select></div>';
    html += '<div class="form-group"><label>匹配活动（可选）</label><select id="rule-activity" style="width:100%;padding:8px;"><option value="">无</option>';
    var acts = this.content.activities || [];
    acts.forEach(function(a) { html += '<option value="' + a.title + '">' + a.title + '</option>'; });
    html += '</select></div>';
    html += '<div class="form-group"><label>推荐话术</label><textarea id="rule-msg" rows="3" placeholder="推荐给客户的说明文字" style="width:100%;padding:8px;"></textarea></div>';
    html += '</div>';
    html += '<div style="margin-top:20px;"><button id="btn-add-rule" class="btn btn-primary">添加</button> <button onclick="admin.closeModal()" class="btn btn-secondary">取消</button></div>';
    var m = this.createModal('添加推荐规则', html);
    document.body.appendChild(m);
    document.getElementById('btn-add-rule').addEventListener('click', function() {
      var name = document.getElementById('rule-name').value.trim();
      if (!name) { alert('请输入规则名称'); return; }
      if (!self.content.recommendRules) self.content.recommendRules = [];
      self.content.recommendRules.push({
        name: name,
        conditions: {
          goal: document.getElementById('rule-goal').value,
          budget: document.getElementById('rule-budget').value,
          experience: document.getElementById('rule-exp').value
        },
        result: {
          courseId: document.getElementById('rule-course').value,
          courseTitle: document.getElementById('rule-course').options[document.getElementById('rule-course').selectedIndex].text,
          activityTitle: document.getElementById('rule-activity').value,
          message: document.getElementById('rule-msg').value
        }
      });
      self.saveContent().then(function() { self.closeModal(); self.showToast('已添加','success'); self.renderRules(); });
    });
  }

  editRule(idx) {
    var rules = this.content.recommendRules;
    var r = rules[idx];
    var self = this;
    var html = '<div class="form-group"><label>规则名称 *</label><input type="text" id="rule-name" value="' + r.name + '" style="width:100%;padding:8px;"></div>';
    html += '<div style="border:1px solid #ddd;padding:15px;border-radius:8px;margin-bottom:15px;">';
    html += '<h4 style="margin-bottom:10px;">🎯 匹配条件</h4>';
    html += '<div class="form-group"><label>学习目的</label><select id="rule-goal" style="width:100%;padding:8px;"><option value="">不限</option><option value="入门体验"' + (r.conditions?.goal==='入门体验'?' selected':'') + '>入门体验</option><option value="技术提升"' + (r.conditions?.goal==='技术提升'?' selected':'') + '>技术提升</option><option value="考证"' + (r.conditions?.goal==='考证'?' selected':'') + '>考证</option><option value="竞技"' + (r.conditions?.goal==='竞技'?' selected':'') + '>竞技</option></select></div>';
    html += '<div class="form-group"><label>预算范围</label><select id="rule-budget" style="width:100%;padding:8px;"><option value="">不限</option><option value="2000以下"' + (r.conditions?.budget==='2000以下'?' selected':'') + '>2000以下</option><option value="2000-5000"' + (r.conditions?.budget==='2000-5000'?' selected':'') + '>2000-5000</option><option value="5000-10000"' + (r.conditions?.budget==='5000-10000'?' selected':'') + '>5000-10000</option><option value="10000以上"' + (r.conditions?.budget==='10000以上'?' selected':'') + '>10000以上</option></select></div>';
    html += '<div class="form-group"><label>滑雪经验</label><select id="rule-exp" style="width:100%;padding:8px;"><option value="">不限</option><option value="零基础"' + (r.conditions?.experience==='零基础'?' selected':'') + '>零基础</option><option value="有基础"' + (r.conditions?.experience==='有基础'?' selected':'') + '>有基础</option></select></div>';
    html += '</div>';
    html += '<div style="border:1px solid #ddd;padding:15px;border-radius:8px;">';
    html += '<h4 style="margin-bottom:10px;">📦 推荐结果</h4>';
    html += '<div class="form-group"><label>推荐课程类型</label><select id="rule-course" style="width:100%;padding:8px;"><option value="">请选择</option>';
    var snowCourses = this.content.courses?.snow || [];
    var offseasonCourses = this.content.courses?.offseason || [];
    snowCourses.forEach(function(c) { html += '<option value="' + c.id + '"' + (r.result?.courseId===c.id?' selected':'') + '>🏔️ ' + c.title + '</option>'; });
    offseasonCourses.forEach(function(c) { html += '<option value="' + c.id + '"' + (r.result?.courseId===c.id?' selected':'') + '>🌿 ' + c.title + '</option>'; });
    html += '</select></div>';
    html += '<div class="form-group"><label>匹配活动（可选）</label><select id="rule-activity" style="width:100%;padding:8px;"><option value="">无</option>';
    var acts = this.content.activities || [];
    acts.forEach(function(a) { html += '<option value="' + a.title + '"' + (r.result?.activityTitle===a.title?' selected':'') + '>' + a.title + '</option>'; });
    html += '</select></div>';
    html += '<div class="form-group"><label>推荐话术</label><textarea id="rule-msg" rows="3" style="width:100%;padding:8px;">' + (r.result?.message||'') + '</textarea></div>';
    html += '</div>';
    html += '<div style="margin-top:20px;"><button id="btn-save-rule" class="btn btn-primary">保存</button> <button onclick="admin.closeModal()" class="btn btn-secondary">取消</button></div>';
    var m = this.createModal('编辑推荐规则', html);
    document.body.appendChild(m);
    document.getElementById('btn-save-rule').addEventListener('click', function() {
      r.name = document.getElementById('rule-name').value.trim();
      r.conditions = {
        goal: document.getElementById('rule-goal').value,
        budget: document.getElementById('rule-budget').value,
        experience: document.getElementById('rule-exp').value
      };
      r.result = {
        courseId: document.getElementById('rule-course').value,
        courseTitle: document.getElementById('rule-course').options[document.getElementById('rule-course').selectedIndex].text,
        activityTitle: document.getElementById('rule-activity').value,
        message: document.getElementById('rule-msg').value
      };
      self.saveContent().then(function() { self.closeModal(); self.showToast('已保存','success'); self.renderRules(); });
    });
  }


  // ========== 推荐规则管理相关 ==========

  renderRecommendationConfig() {
    var container = document.getElementById('recommendation-config');
    if (!container) return;
    var config = this.content.recommendationRules || {
      weights: { projectType: 10, ageGroup: 3, budget: 3, timePreference: 2, featured: 2, beginner: 2 },
      displaySettings: { maxResults: 4, showMatchRate: true, showActivities: true, showSaving: true, showTableLink: false },
      matchRateBase: 95, matchRateDecrement: 8
    };
    var html = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:20px;">';
    html += '<div class="form-group"><label>项目类型权重</label><input type="number" id="cfg-projectType" value="' + (config.weights?.projectType||10) + '" min="0" max="20" style="width:100%;padding:8px;"></div>';
    html += '<div class="form-group"><label>年龄匹配权重</label><input type="number" id="cfg-ageGroup" value="' + (config.weights?.ageGroup||3) + '" min="0" max="20" style="width:100%;padding:8px;"></div>';
    html += '<div class="form-group"><label>预算匹配权重</label><input type="number" id="cfg-budget" value="' + (config.weights?.budget||3) + '" min="0" max="20" style="width:100%;padding:8px;"></div>';
    html += '<div class="form-group"><label>时间偏好权重</label><input type="number" id="cfg-timePref" value="' + (config.weights?.timePreference||2) + '" min="0" max="20" style="width:100%;padding:8px;"></div>';
    html += '<div class="form-group"><label>推荐课程权重</label><input type="number" id="cfg-featured" value="' + (config.weights?.featured||2) + '" min="0" max="20" style="width:100%;padding:8px;"></div>';
    html += '<div class="form-group"><label>零基础加分</label><input type="number" id="cfg-beginner" value="' + (config.weights?.beginner||2) + '" min="0" max="20" style="width:100%;padding:8px;"></div></div>';
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:20px;">';
    html += '<div class="form-group"><label>显示数量</label><input type="number" id="cfg-maxResults" value="' + (config.displaySettings?.maxResults||4) + '" min="1" max="10" style="width:100%;padding:8px;"></div>';
    html += '<div class="form-group"><label>匹配度起始值</label><input type="number" id="cfg-matchBase" value="' + (config.matchRateBase||95) + '" min="50" max="100" style="width:100%;padding:8px;"></div>';
    html += '<div class="form-group"><label>匹配度递减</label><input type="number" id="cfg-matchDec" value="' + (config.matchRateDecrement||8) + '" min="1" max="20" style="width:100%;padding:8px;"></div></div>';
    html += '<div style="margin-bottom:16px;"><strong>显示设置：</strong></div>';
    html += '<div style="display:flex;flex-wrap:wrap;gap:20px;">';
    html += '<label style="display:flex;align-items:center;gap:8px;"><input type="checkbox" id="cfg-showMatch" ' + (config.displaySettings?.showMatchRate?'checked':'') + '> 显示匹配度</label>';
    html += '<label style="display:flex;align-items:center;gap:8px;"><input type="checkbox" id="cfg-showAct" ' + (config.displaySettings?.showActivities?'checked':'') + '> 显示活动标签</label>';
    html += '<label style="display:flex;align-items:center;gap:8px;"><input type="checkbox" id="cfg-showSave" ' + (config.displaySettings?.showSaving?'checked':'') + '> 显示省钱方案</label>';
    html += '<label style="display:flex;align-items:center;gap:8px;"><input type="checkbox" id="cfg-showLink" ' + (config.displaySettings?.showTableLink?'checked':'') + '> 显示表格链接</label></div>';
    
    container.innerHTML = html;
    // 自动保存配置（输入变化时）
    container.querySelectorAll('input, select').forEach(function(el) {
      el.addEventListener('change', function() { admin.saveRecommendationConfig(); });
      el.addEventListener('input', function() { 
        // 防抖保存
        clearTimeout(window._cfgSaveTimer);
        window._cfgSaveTimer = setTimeout(function() { admin.saveRecommendationConfig(); }, 1500);
      });
    });
  }

  saveRecommendationConfig() {
    if (!this.content.recommendationRules) this.content.recommendationRules = {};
    this.content.recommendationRules.weights = {
      projectType: parseInt(document.getElementById('cfg-projectType').value) || 10,
      ageGroup: parseInt(document.getElementById('cfg-ageGroup').value) || 3,
      budget: parseInt(document.getElementById('cfg-budget').value) || 3,
      timePreference: parseInt(document.getElementById('cfg-timePref').value) || 2,
      featured: parseInt(document.getElementById('cfg-featured').value) || 2,
      beginner: parseInt(document.getElementById('cfg-beginner').value) || 2
    };
    this.content.recommendationRules.displaySettings = {
      maxResults: parseInt(document.getElementById('cfg-maxResults').value) || 4,
      showMatchRate: document.getElementById('cfg-showMatch').checked,
      showActivities: document.getElementById('cfg-showAct').checked,
      showSaving: document.getElementById('cfg-showSave').checked,
      showTableLink: document.getElementById('cfg-showLink').checked
    };
    this.content.recommendationRules.matchRateBase = parseInt(document.getElementById('cfg-matchBase').value) || 95;
    this.content.recommendationRules.matchRateDecrement = parseInt(document.getElementById('cfg-matchDec').value) || 8;
    this.saveContent().then(() => { this.showToast('配置已保存', 'success'); });
  }

  renderRecommendationActivities() {
    var list = document.getElementById('activities-list');
    if (!list) return;
    var activities = this.content.activities || [];
    if (activities.length === 0) { list.innerHTML = '<p style="color:#999;text-align:center;padding:20px;">暂无活动，点击上方按钮添加</p>'; return; }
    var self = this;
    var html = '';
    activities.forEach(function(act, i) {
      var enabledBadge = act.enabled !== false ? '<span style="background:#28a745;color:white;padding:2px 8px;border-radius:10px;font-size:0.8rem;margin-left:8px;">启用</span>' : '<span style="background:#dc3545;color:white;padding:2px 8px;border-radius:10px;font-size:0.8rem;margin-left:8px;">禁用</span>';
      html += '<div style="background:#f8f9fa;padding:16px;margin-bottom:12px;border-radius:8px;border-left:4px solid ' + (act.enabled !== false ? '#28a745' : '#ccc') + ';">';
      html += '<div style="display:flex;justify-content:space-between;align-items:start;">';
      html += '<div><strong style="font-size:1.1rem;color:#0039A6;">' + act.badge + ' ' + act.title + '</strong>' + enabledBadge + '</div>';
      html += '<div><button class="btn-action" data-action="editActivity" data-idx="' + i + '">编辑</button> <button class="btn-action" data-action="delActivity" data-idx="' + i + '">删除</button></div></div>';
      html += '<div style="font-size:0.9rem;color:#666;margin-top:8px;">';
      html += '<p>📝 ' + act.description + '</p>';
      html += '<p>💰 优惠: <strong style="color:#e55;">' + act.discount + '</strong> | 预计节省: ' + act.savings + '</p>';
      html += '<p>📋 适用课程: ' + (act.courseTypes||[]).map(function(t){return t==='snow'?'❄️雪季':'🌿非雪季';}).join(', ') + '</p>';
      html += '<p>📎 活动表格: <a href="' + (act.tableLink||'#') + '" target="_blank" style="color:var(--primary-blue);">查看详情</a></p>';
      html += '</div></div>';
    });
    list.innerHTML = html;
    list.onclick = function(e) {
      var btn = e.target.closest('.btn-action');
      if (!btn) return;
      var action = btn.dataset.action;
      var idx = parseInt(btn.dataset.idx);
      if (action === 'editActivity') self.editActivity(idx);
      else if (action === 'delActivity') self.deleteActivity(idx);
    };
  }

  addActivity() {
    var self = this;
    var html = '<div class="form-group"><label>活动名称 *</label><input type="text" id="act-title" placeholder="如：早鸟优惠" style="width:100%;padding:8px;"></div>';
    html += '<div class="form-group"><label>活动标签</label><input type="text" id="act-badge" placeholder="如：🎁 限时" style="width:100%;padding:8px;"></div>';
    html += '<div class="form-group"><label>活动描述</label><textarea id="act-desc" rows="2" placeholder="活动的详细说明" style="width:100%;padding:8px;"></textarea></div>';
    html += '<div class="form-group"><label>优惠方式</label><input type="text" id="act-discount" placeholder="如：9折、立减200元" style="width:100%;padding:8px;"></div>';
    html += '<div class="form-group"><label>预计节省</label><input type="text" id="act-savings" placeholder="如：省1280元" style="width:100%;padding:8px;"></div>';
    html += '<div class="form-group"><label>适用条件</label><input type="text" id="act-condition" placeholder="如：提前30天报名" style="width:100%;padding:8px;"></div>';
    html += '<div class="form-group"><label>适用课程类型</label><div style="display:flex;gap:20px;margin-top:8px;">';
    html += '<label><input type="checkbox" id="act-snow" checked> ❄️ 雪季课程</label>';
    html += '<label><input type="checkbox" id="act-offseason"> 🌿 非雪季课程</label></div></div>';
    html += '<div class="form-group"><label>活动表格链接</label><input type="text" id="act-tableLink" value="https://www.kdocs.cn/l/cgcQW29QLJgA" style="width:100%;padding:8px;"></div>';
    html += '<div class="form-group"><label><input type="checkbox" id="act-enabled" checked> 启用此活动</label></div>';
    html += '<div style="margin-top:20px;"><button id="btn-add-act" class="btn btn-primary">添加</button> <button onclick="admin.closeModal()" class="btn btn-secondary">取消</button></div>';
    var m = this.createModal('添加优惠活动', html);
    document.body.appendChild(m);
    document.getElementById('btn-add-act').addEventListener('click', function() {
      var title = document.getElementById('act-title').value.trim();
      if (!title) { alert('请输入活动名称'); return; }
      if (!self.content.activities) self.content.activities = [];
      var courseTypes = [];
      if (document.getElementById('act-snow').checked) courseTypes.push('snow');
      if (document.getElementById('act-offseason').checked) courseTypes.push('offseason');
      self.content.activities.push({
        id: 'act' + Date.now(),
        title: title,
        badge: document.getElementById('act-badge').value || '🎁 ' + title,
        description: document.getElementById('act-desc').value,
        discount: document.getElementById('act-discount').value,
        savings: document.getElementById('act-savings').value,
        condition: document.getElementById('act-condition').value,
        courseTypes: courseTypes,
        tableLink: document.getElementById('act-tableLink').value,
        enabled: document.getElementById('act-enabled').checked,
        sortOrder: self.content.activities.length + 1
      });
      self.saveContent().then(function() { self.closeModal(); self.showToast('已添加', 'success'); self.renderRecommendationActivities(); });
    });
  }

  editActivity(idx) {
    var acts = this.content.activities;
    var act = acts[idx];
    var self = this;
    var html = '<div class="form-group"><label>活动名称 *</label><input type="text" id="act-title" value="' + act.title + '" style="width:100%;padding:8px;"></div>';
    html += '<div class="form-group"><label>活动标签</label><input type="text" id="act-badge" value="' + (act.badge||'') + '" style="width:100%;padding:8px;"></div>';
    html += '<div class="form-group"><label>活动描述</label><textarea id="act-desc" rows="2" style="width:100%;padding:8px;">' + (act.description||'') + '</textarea></div>';
    html += '<div class="form-group"><label>优惠方式</label><input type="text" id="act-discount" value="' + (act.discount||'') + '" style="width:100%;padding:8px;"></div>';
    html += '<div class="form-group"><label>预计节省</label><input type="text" id="act-savings" value="' + (act.savings||'') + '" style="width:100%;padding:8px;"></div>';
    html += '<div class="form-group"><label>适用条件</label><input type="text" id="act-condition" value="' + (act.condition||'') + '" style="width:100%;padding:8px;"></div>';
    html += '<div class="form-group"><label>适用课程类型</label><div style="display:flex;gap:20px;margin-top:8px;">';
    html += '<label><input type="checkbox" id="act-snow" ' + ((act.courseTypes||[]).includes('snow')?'checked':'') + '> ❄️ 雪季课程</label>';
    html += '<label><input type="checkbox" id="act-offseason" ' + ((act.courseTypes||[]).includes('offseason')?'checked':'') + '> 🌿 非雪季课程</label></div></div>';
    html += '<div class="form-group"><label>活动表格链接</label><input type="text" id="act-tableLink" value="' + (act.tableLink||'') + '" style="width:100%;padding:8px;"></div>';
    html += '<div class="form-group"><label><input type="checkbox" id="act-enabled" ' + (act.enabled !== false?'checked':'') + '> 启用此活动</label></div>';
    html += '<div style="margin-top:20px;"><button id="btn-save-act" class="btn btn-primary">保存</button> <button onclick="admin.closeModal()" class="btn btn-secondary">取消</button></div>';
    var m = this.createModal('编辑优惠活动', html);
    document.body.appendChild(m);
    document.getElementById('btn-save-act').addEventListener('click', function() {
      act.title = document.getElementById('act-title').value.trim();
      act.badge = document.getElementById('act-badge').value || '🎁 ' + act.title;
      act.description = document.getElementById('act-desc').value;
      act.discount = document.getElementById('act-discount').value;
      act.savings = document.getElementById('act-savings').value;
      act.condition = document.getElementById('act-condition').value;
      var courseTypes = [];
      if (document.getElementById('act-snow').checked) courseTypes.push('snow');
      if (document.getElementById('act-offseason').checked) courseTypes.push('offseason');
      act.courseTypes = courseTypes;
      act.tableLink = document.getElementById('act-tableLink').value;
      act.enabled = document.getElementById('act-enabled').checked;
      self.saveContent().then(function() { self.closeModal(); self.showToast('已保存', 'success'); self.renderRecommendationActivities(); });
    });
  }

  deleteActivity(idx) {
    if (!confirm('确定删除此活动？')) return;
    this.content.activities.splice(idx, 1);
    this.saveContent().then(() => { this.showToast('已删除', 'success'); this.renderRecommendationActivities(); });
  }

  // ==================== 抽奖活动管理 ====================
  renderLotterySettings() {
    var lottery = this.content.lottery || { enabled: true, prizes: [], records: [], rules: [] };
    if (!this.content.lottery) this.content.lottery = lottery;
    
    document.getElementById('lottery-enabled-create').checked = lottery.enabled !== false;
    
    var rulesEl = document.getElementById('lottery-rules-create');
    if (rulesEl) {
      var rules = lottery.rules || [];
      if (Array.isArray(rules)) {
        rulesEl.value = rules.join('\n');
      } else {
        rulesEl.value = rules;
      }
    }
    
    // 只使用新的渲染方法
    // this.renderPrizesList(); // 已废弃，使用renderPrizesListNew
    this.renderLotteryRecords();
  }

  saveLotterySettings() {
    var lottery = this.content.lottery || { prizes: [], records: [] };
    lottery.enabled = document.getElementById('lottery-enabled-create').checked;
    
    var rulesEl = document.getElementById('lottery-rules-create');
    if (rulesEl && rulesEl.value) {
      lottery.rules = rulesEl.value.split('\n').filter(function(r) { return r.trim(); });
    }
    
    this.content.lottery = lottery;
    this.saveContent().then(function() { this.showToast('设置已保存', 'success'); }.bind(this));
  }

  renderPrizesList() {
    var container = document.getElementById('prizes-list-create');
    if (!container) return;
    
    var lottery = this.content.lottery || { prizes: [] };
    var prizes = lottery.prizes || [];
    
    if (prizes.length === 0) {
      container.innerHTML = '<p style="color: var(--text-light);">暂无奖品，点击上方按钮添加</p>';
      return;
    }
    
    var self = this;
    container.innerHTML = prizes.map(function(p, i) {
      return '<div style="display:flex;align-items:center;gap:12px;padding:12px;background:#f8f9fa;border-radius:8px;margin-bottom:8px;">' +
        '<span style="font-size:2rem;">' + p.icon + '</span>' +
        '<div style="flex:1;">' +
          '<strong>' + p.name + '</strong> - ' + p.description +
          '<div style="font-size:0.85rem;color:#666;">概率:' + (p.probability * 100).toFixed(0) + '% | 剩余:' + (p.remain || 0) + '/' + (p.total || 0) + '</div>' +
        '</div>' +
        '<button class="btn btn-secondary btn-small" onclick="admin.editPrize(' + i + ')">编辑</button> ' +
        '<button class="btn btn-danger btn-small" onclick="admin.deletePrize(' + i + ')">删除</button>' +
      '</div>';
    }).join('');
  }

  addPrize() {
    var lottery = this.content.lottery || { prizes: [], records: [] };
    lottery.prizes = lottery.prizes || [];
    
    var newId = lottery.prizes.length > 0 ? Math.max.apply(null, lottery.prizes.map(function(p) { return p.id || 0; })) + 1 : 1;
    
    var prize = {
      id: newId,
      name: '新奖品',
      icon: '🎁',
      description: '奖品描述',
      probability: 0.1,
      value: '',
      total: 10,
      remain: 10
    };
    
    var self = this;
    var html = '<div class="form-group"><label>奖品名称</label><input type="text" id="prize-name" value="' + prize.name + '"></div>' +
      '<div class="form-group"><label>图标</label><input type="text" id="prize-icon" value="' + prize.icon + '" placeholder="如：🏆"></div>' +
      '<div class="form-group"><label>描述</label><input type="text" id="prize-desc" value="' + prize.description + '"></div>' +
      '<div class="form-group"><label>价值/优惠</label><input type="text" id="prize-value" value="' + prize.value + '"></div>' +
      '<div class="form-group"><label>中奖概率 (0-1，如0.1表示10%)</label><input type="number" id="prize-prob" value="' + prize.probability + '" step="0.01" min="0" max="1"></div>' +
      '<div class="form-group"><label>总数量</label><input type="number" id="prize-total" value="' + prize.total + '" min="1"></div>';
    
    var modal = this.createModal('添加奖品', html + '<div style="margin-top:20px;"><button class="btn btn-primary" onclick="admin.saveNewPrize()">保存</button> <button class="btn btn-secondary" onclick="admin.closeModal()">取消</button></div>');
    document.body.appendChild(modal);
    
    this.tempPrize = prize;
  }

  saveNewPrize() {
    var lottery = this.content.lottery || { prizes: [], records: [] };
    lottery.prizes = lottery.prizes || [];
    
    var prize = this.tempPrize;
    prize.name = document.getElementById('prize-name').value || prize.name;
    prize.icon = document.getElementById('prize-icon').value || prize.icon;
    prize.description = document.getElementById('prize-desc').value || prize.description;
    prize.value = document.getElementById('prize-value').value || prize.value;
    prize.probability = parseFloat(document.getElementById('prize-prob').value) || prize.probability;
    prize.total = parseInt(document.getElementById('prize-total').value) || prize.total;
    prize.remain = prize.remain || prize.total;
    
    lottery.prizes.push(prize);
    this.content.lottery = lottery;
    
    var self = this;
    this.saveContent().then(function() {
      self.closeModal();
      self.showToast('奖品已添加', 'success');
      self.renderPrizesList();
    });
  }

  editPrize(index) {
    var lottery = this.content.lottery || { prizes: [] };
    var prize = lottery.prizes[index];
    if (!prize) return;
    
    var self = this;
    var html = '<div class="form-group"><label>奖品名称</label><input type="text" id="prize-name" value="' + prize.name + '"></div>' +
      '<div class="form-group"><label>图标</label><input type="text" id="prize-icon" value="' + prize.icon + '"></div>' +
      '<div class="form-group"><label>描述</label><input type="text" id="prize-desc" value="' + prize.description + '"></div>' +
      '<div class="form-group"><label>价值/优惠</label><input type="text" id="prize-value" value="' + (prize.value || '') + '"></div>' +
      '<div class="form-group"><label>中奖概率 (0-1)</label><input type="number" id="prize-prob" value="' + prize.probability + '" step="0.01" min="0" max="1"></div>' +
      '<div class="form-group"><label>剩余数量</label><input type="number" id="prize-remain" value="' + (prize.remain || 0) + '" min="0"></div>';
    
    var modal = this.createModal('编辑奖品', html + '<div style="margin-top:20px;"><button class="btn btn-primary" onclick="admin.savePrize(' + index + ')">保存</button> <button class="btn btn-secondary" onclick="admin.closeModal()">取消</button></div>');
    document.body.appendChild(modal);
  }

  savePrize(index) {
    var lottery = this.content.lottery || { prizes: [], records: [] };
    var prize = lottery.prizes[index];
    if (!prize) return;
    
    prize.name = document.getElementById('prize-name').value || prize.name;
    prize.icon = document.getElementById('prize-icon').value || prize.icon;
    prize.description = document.getElementById('prize-desc').value || prize.description;
    prize.value = document.getElementById('prize-value').value || prize.value;
    prize.probability = parseFloat(document.getElementById('prize-prob').value) || prize.probability;
    prize.remain = parseInt(document.getElementById('prize-remain').value) || 0;
    
    this.content.lottery = lottery;
    
    var self = this;
    this.saveContent().then(function() {
      self.closeModal();
      self.showToast('奖品已保存', 'success');
      self.renderPrizesList();
    });
  }

  deletePrize(index) {
    if (!confirm('确定删除此奖品？')) return;
    
    var lottery = this.content.lottery || { prizes: [], records: [] };
    lottery.prizes.splice(index, 1);
    this.content.lottery = lottery;
    
    var self = this;
    this.saveContent().then(function() {
      self.showToast('奖品已删除', 'success');
      self.renderPrizesList();
    });
  }

  renderLotteryRecords() {
    var container = document.getElementById('lottery-records-list');
    if (!container) return;
    
    var lottery = this.content.lottery || { records: [] };
    var records = lottery.records || [];
    
    if (records.length === 0) {
      container.innerHTML = '<p style="color: var(--text-light);">暂无中奖记录</p>';
      return;
    }
    
    container.innerHTML = '<table style="width:100%;border-collapse:collapse;"><tr style="background:#f0f0f0;"><th style="padding:8px;text-align:left;">时间</th><th style="padding:8px;text-align:left;">姓名</th><th style="padding:8px;text-align:left;">电话</th><th style="padding:8px;text-align:left;">奖品</th></tr>' +
      records.map(function(r) {
        return '<tr style="border-bottom:1px solid #eee;"><td style="padding:8px;">' + (r.time || '') + '</td><td style="padding:8px;">' + (r.name || '') + '</td><td style="padding:8px;">' + (r.phone || '') + '</td><td style="padding:8px;">' + (r.prize || '') + '</td></tr>';
      }).join('') + '</table>';
  }

  // ==================== 抽奖活动管理（新） ====================
  async loadLotterySettings() {
    try {
      const res = await fetch('/api/lottery/settings');
      const data = await res.json();
      if (data.success) {
        document.getElementById('lottery-enabled-create').checked = data.settings.enabled !== false;
        document.getElementById('lottery-name-create').value = data.settings.name || '';
        document.getElementById('lottery-rules-create').value = (data.settings.rules || []).join('\n');
        document.getElementById('lottery-times-create').value = data.settings.maxDrawsPerUser !== undefined ? data.settings.maxDrawsPerUser : 1;
        document.getElementById('lottery-interval-create').value = data.settings.drawCooldownMinutes || 0;
        document.getElementById('lottery-type-create').value = data.settings.lotteryType || 'probability';
        
        document.getElementById('lottery-draw-time-create').value = data.settings.drawTime || '';
        this._lotterySettings = data.settings;
        this._tempFormFields = data.settings.formFields || [
          { id: 'name', label: '姓名', type: 'text', required: true, placeholder: '请输入您的姓名' },
          { id: 'phone', label: '手机号', type: 'tel', required: true, placeholder: '请输入手机号' }
        ];
        this.renderFormFieldsList();
        this.renderPrizesListNew(data.prizes || []);
        this.toggleLotteryType();
      }
    } catch (e) { console.error('加载抽奖设置失败', e); }
  }

  renderFormFieldsList() {
    const container = document.getElementById('form-fields-list');
    if (!container) return;
    const fields = this._tempFormFields || [];
    if (fields.length === 0) {
      container.innerHTML = '<p style="color:var(--text-light);">暂无字段</p>';
      return;
    }
    let html = '<table style="width:100%;border-collapse:collapse;"><tr style="background:#f0f0f0;"><th style="padding:8px;">字段ID</th><th style="padding:8px;">标签</th><th style="padding:8px;">类型</th><th style="padding:8px;">必填</th><th style="padding:8px;">操作</th></tr>';
    fields.forEach(function(f, i) {
      html += '<tr style="border-bottom:1px solid #eee;"><td style="padding:8px;">' + f.id + '</td><td style="padding:8px;">' + f.label + '</td><td style="padding:8px;">' + f.type + '</td><td style="padding:8px;">' + (f.required ? '是' : '否') + '</td><td style="padding:8px;"><button onclick="admin.editFormField(' + i + ')" class="btn btn-secondary btn-small">编辑</button> <button onclick="admin.deleteFormField(' + i + ')" class="btn btn-danger btn-small">删除</button></td></tr>';
    });
    html += '</table>';
    container.innerHTML = html;
  }

  addFormField() {
    const field = { id: 'field_' + Date.now(), label: '新字段', type: 'text', required: false, placeholder: '' };
    const modal = this.createModal('添加字段',
      '<div class="form-group"><label>字段ID（英文，唯一）</label><input type="text" id="ff-id" value="' + field.id + '" style="width:100%;padding:8px;"></div>' +
      '<div class="form-group"><label>显示标签</label><input type="text" id="ff-label" value="' + field.label + '" style="width:100%;padding:8px;"></div>' +
      '<div class="form-group"><label>输入类型</label><select id="ff-type" style="width:100%;padding:8px;"><option value="text">文本</option><option value="tel">手机号</option><option value="email">邮箱</option><option value="number">数字</option></select></div>' +
      '<div class="form-group"><label>占位提示</label><input type="text" id="ff-placeholder" value="" placeholder="请输入占位提示" style="width:100%;padding:8px;"></div>' +
      '<div class="form-group"><label><input type="checkbox" id="ff-required"> 必填字段</label></div>' +
      '<div style="margin-top:16px;"><button onclick="admin.saveNewFormField()" class="btn btn-primary">保存</button> <button onclick="admin.closeModal()" class="btn btn-secondary">取消</button></div>'
    );
    document.body.appendChild(modal);
  }

  editFormField(index) {
    const fields = this._tempFormFields || [];
    const field = fields[index];
    if (!field) return;
    const modal = this.createModal('编辑字段',
      '<div class="form-group"><label>字段ID（英文，唯一）</label><input type="text" id="ff-id" value="' + field.id + '" style="width:100%;padding:8px;"></div>' +
      '<div class="form-group"><label>显示标签</label><input type="text" id="ff-label" value="' + field.label + '" style="width:100%;padding:8px;"></div>' +
      '<div class="form-group"><label>输入类型</label><select id="ff-type" style="width:100%;padding:8px;"><option value="text"' + (field.type==='text'?' selected':'') + '>文本</option><option value="tel"' + (field.type==='tel'?' selected':'') + '>手机号</option><option value="email"' + (field.type==='email'?' selected':'') + '>邮箱</option><option value="number"' + (field.type==='number'?' selected':'') + '>数字</option></select></div>' +
      '<div class="form-group"><label>占位提示</label><input type="text" id="ff-placeholder" value="' + (field.placeholder||'') + '" placeholder="请输入占位提示" style="width:100%;padding:8px;"></div>' +
      '<div class="form-group"><label><input type="checkbox" id="ff-required"' + (field.required?' checked':'') + '> 必填字段</label></div>' +
      '<div style="margin-top:16px;"><button onclick="admin.saveEditFormField(' + index + ')" class="btn btn-primary">保存</button> <button onclick="admin.closeModal()" class="btn btn-secondary">取消</button></div>'
    );
    document.body.appendChild(modal);
  }

  saveNewFormField() {
    const fields = this._tempFormFields || [];
    fields.push({
      id: document.getElementById('ff-id').value.trim() || 'field_' + Date.now(),
      label: document.getElementById('ff-label').value.trim() || '未命名',
      type: document.getElementById('ff-type').value,
      required: document.getElementById('ff-required').checked,
      placeholder: document.getElementById('ff-placeholder').value.trim()
    });
    this._tempFormFields = fields;
    this.renderFormFieldsList();
    this.closeModal();
  }

  saveEditFormField(index) {
    const fields = this._tempFormFields || [];
    if (!fields[index]) return;
    fields[index] = {
      id: document.getElementById('ff-id').value.trim() || fields[index].id,
      label: document.getElementById('ff-label').value.trim() || '未命名',
      type: document.getElementById('ff-type').value,
      required: document.getElementById('ff-required').checked,
      placeholder: document.getElementById('ff-placeholder').value.trim()
    };
    this._tempFormFields = fields;
    this.renderFormFieldsList();
    this.closeModal();
  }

  deleteFormField(index) {
    if (!confirm('确定删除这个字段？')) return;
    const fields = this._tempFormFields || [];
    fields.splice(index, 1);
    this._tempFormFields = fields;
    this.renderFormFieldsList();
  }

  renderPrizesListNew(prizes) {
    const container = document.getElementById('prizes-list-create');
    if (!container) return;
    if (prizes.length === 0) {
      container.innerHTML = '<p style="color:var(--text-light);">暂无奖品</p>';
      this._tempPrizes = [];
      return;
    }
    const self = this;
    var levelNames = {1:'一等奖', 2:'二等奖', 3:'三等奖', 4:'四等奖', 5:'五等奖'};
    container.innerHTML = prizes.map(function(p, i) {
      // 检查是否过期
      var isExpired = false;
      if (p.expireDate) {
        var expireDate = new Date(p.expireDate);
        if (expireDate < new Date()) {
          isExpired = true;
        }
      }
      var expireTag = isExpired ? '<span style="background:#dc3545;color:white;padding:2px 6px;border-radius:4px;font-size:0.75rem;margin-left:8px;">已作废</span>' : (p.expireDate ? '<span style="background:#28a745;color:white;padding:2px 6px;border-radius:4px;font-size:0.75rem;margin-left:8px;">有效期至:' + p.expireDate + '</span>' : '');
      var levelTag = '<span style="background:#9333EA;color:white;padding:2px 6px;border-radius:4px;font-size:0.75rem;margin-left:4px;">' + (levelNames[p.level]||'其他') + '</span>';
      return '<div class="prize-item" style="' + (isExpired ? 'opacity:0.6;' : '') + '">' +
        '<span class="prize-icon">' + (p.icon || '🎁') + '</span>' +
        '<div class="prize-info">' +
          '<strong>' + (p.name || '') + '</strong> ' + levelTag + expireTag +
          '<div style="font-size:0.85rem;color:#666;">' + (p.description || '') + '</div>' +
          '<div style="font-size:0.85rem;color:#666;">概率:' + ((p.probability||0)*100).toFixed(0) + '% | 剩余:' + (p.remain||0) + '/' + (p.total||0) + '</div>' +
        '</div>' +
        '<div class="prize-actions">' +
          '<button class="btn btn-secondary btn-small" onclick="admin.editPrizeNew(' + i + ')">编辑</button> ' +
          '<button class="btn btn-danger btn-small" onclick="admin.deletePrizeNew(' + i + ')">删除</button>' +
        '</div></div>';
    }).join('');
    this._tempPrizes = prizes;
  }

  addPrizeNew() {
    const prizes = this._tempPrizes || [];
    const newId = prizes.length > 0 ? Math.max.apply(null, prizes.map(function(p){ return p.id||0; })) + 1 : 1;
    const prize = { id: newId, name: '新奖品', icon: '🎁', content: '', rules: '', description: '', probability: 0.1, value: '', total: 10, remain: 10 };
    this._tempPrize = prize;
    const modal = this.createModal('添加奖品',
      '<div class="form-group"><label>奖品名称</label><input type="text" id="pn-name" value="新奖品"></div>' +
      '<div class="form-group"><label>图标</label><input type="text" id="pn-icon" value="🎁" placeholder="如：🏆"></div>' +
      '<div class="form-group"><label>奖品内容</label><textarea id="pn-content" rows="2" placeholder="如：价值299元滑雪体验课一节"></textarea></div>' +
      '<div class="form-group"><label>使用规则</label><textarea id="pn-rules" rows="3" placeholder="如：需提前预约，不与其他优惠同用"></textarea></div>' +
      '<div class="form-group"><label>有效期截止</label><input type="date" id="pn-expire" value=""><p style="color:#666;font-size:0.85rem;margin-top:4px;">💡 不设置则永久有效</p></div>' +
      '<div class="form-group"><label>描述</label><input type="text" id="pn-desc" value=""></div>' +
      '<div class="form-group"><label>价值/优惠</label><input type="text" id="pn-value" value=""></div>' +
      '<div class="form-group"><label>中奖概率 (0-1，如0.1表示10%)</label><input type="number" id="pn-prob" value="0.1" step="0.01" min="0" max="1"></div>' +
      '<div class="form-group"><label>总数量</label><input type="number" id="pn-total" value="10" min="1"></div>' +
      '<div style="margin-top:20px;"><button class="btn btn-primary" onclick="admin.saveNewPrizeNew()">保存</button> <button class="btn btn-secondary" onclick="admin.closeModal()">取消</button></div>'
    );
    document.body.appendChild(modal);
  }

  saveNewPrizeNew() {
    const prizes = this._tempPrizes || [];
    const prize = this._tempPrize;
    prize.name = document.getElementById('pn-name').value || prize.name;
    prize.icon = document.getElementById('pn-icon').value || prize.icon;
    prize.content = document.getElementById('pn-content').value || '';
    prize.rules = document.getElementById('pn-rules').value || '';
    prize.description = document.getElementById('pn-desc').value || '';
    prize.value = document.getElementById('pn-value').value || '';
    prize.probability = parseFloat(document.getElementById('pn-prob').value) || 0.1;
    prize.total = parseInt(document.getElementById('pn-total').value) || 10;
    prize.remain = prize.remain || prize.total;
    prize.expireDate = document.getElementById('pn-expire').value || '';
    prizes.push(prize);
    this._tempPrizes = prizes;
    this.closeModal();
    this.renderPrizesListNew(prizes);
  }

  editPrizeNew(index) {
    const prizes = this._tempPrizes || [];
    const prize = prizes[index];
    if (!prize) return;
    this._tempPrizeIndex = index;
    const modal = this.createModal('编辑奖品',
      '<div class="form-group"><label>奖品名称</label><input type="text" id="pe-name" value="' + (prize.name||'') + '"></div>' +
      '<div class="form-group"><label>奖项等级</label><select id="pe-level" style="width:100%;padding:8px;border:2px solid var(--ice-blue);border-radius:8px;">' +
        '<option value="1"' + ((prize.level===1||!prize.level)?' selected':'') + '>一等奖</option>' +
        '<option value="2"' + (prize.level===2?' selected':'') + '>二等奖</option>' +
        '<option value="3"' + (prize.level===3?' selected':'') + '>三等奖</option>' +
        '<option value="4"' + (prize.level===4?' selected':'') + '>四等奖</option>' +
        '<option value="5"' + (prize.level===5?' selected':'') + '>五等奖</option>' +
      '</select></div>' +
      '<div class="form-group"><label>图标</label><input type="text" id="pe-icon" value="' + (prize.icon||'') + '"></div>' +
      '<div class="form-group"><label>奖品内容</label><textarea id="pe-content" rows="2" placeholder="如：价值299元滑雪体验课一节">' + (prize.content||'') + '</textarea></div>' +
      '<div class="form-group"><label>使用规则</label><textarea id="pe-rules" rows="3" placeholder="如：需提前预约，不与其他优惠同用">' + (prize.rules||'') + '</textarea></div>' +
      '<div class="form-group"><label>有效期截止</label><input type="date" id="pe-expire" value="' + (prize.expireDate||'') + '"><p style="color:#666;font-size:0.85rem;margin-top:4px;">💡 不设置则永久有效</p></div>' +
      '<div class="form-group"><label>描述</label><input type="text" id="pe-desc" value="' + (prize.description||'') + '"></div>' +
      '<div class="form-group"><label>价值/优惠</label><input type="text" id="pe-value" value="' + (prize.value||'') + '"></div>' +
      '<div class="form-group"><label>中奖概率 (0-1)</label><input type="number" id="pe-prob" value="' + (prize.probability||0.1) + '" step="0.01" min="0" max="1"></div>' +
      '<div class="form-group"><label>剩余数量</label><input type="number" id="pe-remain" value="' + (prize.remain||0) + '" min="0"></div>' +
      '<div class="form-group"><label>总数量</label><input type="number" id="pe-total" value="' + (prize.total||0) + '" min="1"></div>' +
      '<div style="margin-top:20px;"><button class="btn btn-primary" onclick="admin.saveEditPrizeNew()">保存</button> <button class="btn btn-secondary" onclick="admin.closeModal()">取消</button></div>'
    );
    document.body.appendChild(modal);
  }

  saveEditPrizeNew() {
    const prizes = this._tempPrizes || [];
    const index = this._tempPrizeIndex;
    const prize = prizes[index];
    if (!prize) return;
    var probValue = document.getElementById('pe-prob').value;
    console.log('编辑前probability:', prize.probability, '表单值:', probValue);
    prize.name = document.getElementById('pe-name').value || prize.name;
    prize.level = parseInt(document.getElementById('pe-level').value) || 1;
    prize.icon = document.getElementById('pe-icon').value || prize.icon;
    prize.content = document.getElementById('pe-content').value || '';
    prize.rules = document.getElementById('pe-rules').value || '';
    prize.description = document.getElementById('pe-desc').value || '';
    prize.value = document.getElementById('pe-value').value || '';
    console.log('表单输入的probValue:', probValue, '类型:', typeof probValue);
    var probNum = probValue !== '' && probValue !== null ? parseFloat(probValue) : 0.1;
    console.log('转换后的probability:', probNum);
    prize.probability = probNum;
    prize.remain = parseInt(document.getElementById('pe-remain').value) || 0;
    prize.total = parseInt(document.getElementById('pe-total').value) || 0;
    prize.expireDate = document.getElementById('pe-expire').value || '';
    console.log('保存后probability:', prize.probability);
    alert('保存成功！概率=' + prize.probability);
    this._tempPrizes = prizes;
    this.closeModal();
    this.renderPrizesListNew(prizes);
  }

  deletePrizeNew(index) {
    if (!confirm('确定删除此奖品？')) return;
    const prizes = this._tempPrizes || [];
    prizes.splice(index, 1);
    this._tempPrizes = prizes;
    this.renderPrizesListNew(prizes);
  }

  toggleLotteryType() {
    var type = document.getElementById('lottery-type-create').value;
    var guaranteedDiv = document.getElementById('guaranteed-settings');
    if (type === 'guaranteed') {
      guaranteedDiv.style.display = 'block';
      this.renderGuaranteedPrizesList();
    } else {
      guaranteedDiv.style.display = 'none';
    }
  }

  renderGuaranteedPrizesList() {
    var container = document.getElementById('guaranteed-prizes-list');
    if (!container) return;
    var settings = this._lotterySettings || {};
    var guaranteed = settings.guaranteedPrizes || [];
    
    if (guaranteed.length === 0) {
      container.innerHTML = '<p style="color:#666;text-align:center;padding:20px;">暂无可必出的奖品，请点击下方按钮添加</p>';
      return;
    }
    
    var levelNames = {1:'一等奖', 2:'二等奖', 3:'三等奖', 4:'四等奖', 5:'五等奖'};
    var self = this;
    
    container.innerHTML = '<p style="color:#666;font-size:0.85rem;margin-bottom:12px;">💡 拖拽左侧手柄可排序，顺序决定优先级（先抽优先级高的）</p><div id="guaranteed-drag-list" style="display:grid;gap:12px;">';
    guaranteed.forEach(function(gp, i) {
      var p = self._tempPrizes ? self._tempPrizes.find(function(pr){ return pr.id === gp.prizeId; }) : null;
      if (!p) return;
      var maxCount = gp.maxCount !== undefined ? gp.maxCount : gp.count;
      document.getElementById('guaranteed-drag-list').innerHTML += 
        '<div class="guaranteed-drag-item" draggable="true" data-guaranteed-idx="' + i + '" style="display:flex;align-items:center;gap:12px;padding:12px;background:white;border-radius:8px;border-left:4px solid #28a745;cursor:move;" ondragstart="admin.dragGuaranteedStart(event)" ondragover="admin.dragGuaranteedOver(event)" ondrop="admin.dragGuaranteedDrop(event)" ondragend="admin.dragGuaranteedEnd(event)">' +
          '<span style="color:#999;cursor:move;font-size:1.2rem;">☰</span>' +
          '<span style="background:#3b82f6;color:white;padding:4px 10px;border-radius:4px;font-size:0.85rem;font-weight:bold;">' + (i+1) + '</span>' +
          '<span style="font-size:1.3rem;">' + (p.icon||'🎁') + '</span>' +
          '<div style="flex:1;">' +
            '<div style="font-weight:600;">' + p.name + '</div>' +
            '<div style="font-size:0.8rem;color:#666;">' + (levelNames[p.level]||'其他') + ' | 剩余:' + (p.remain||0) + '</div>' +
          '</div>' +
          '<label style="font-size:0.85rem;color:#666;">必出:</label>' +
          '<input type="number" id="guaranteed-count-' + gp.prizeId + '" value="' + gp.count + '" min="0" max="100" style="width:50px;padding:6px;border:1px solid #ddd;border-radius:6px;text-align:center;">' +
          '<label style="font-size:0.85rem;color:#666;">最多:</label>' +
          '<input type="number" id="guaranteed-max-' + gp.prizeId + '" value="' + maxCount + '" min="1" max="100" style="width:50px;padding:6px;border:1px solid #ddd;border-radius:6px;text-align:center;">' +
          '<button onclick="admin.removeFromGuaranteed(' + gp.prizeId + ')" style="background:#dc3545;color:white;border:none;padding:6px 10px;border-radius:6px;cursor:pointer;">×</button>' +
        '</div>';
    });
    container.innerHTML += '</div>';
  }

  dragGuaranteedStart(e) {
    this._dragGuaranteedIdx = parseInt(e.target.dataset.guaranteedIdx);
    e.dataTransfer.effectAllowed = 'move';
    e.target.style.opacity = '0.5';
  }

  dragGuaranteedOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }

  dragGuaranteedDrop(e) {
    e.preventDefault();
    var targetIdx = parseInt(e.target.closest('[data-guaranteed-idx]').dataset.guaranteedIdx);
    if (this._dragGuaranteedIdx !== undefined && targetIdx !== undefined && this._dragGuaranteedIdx !== targetIdx) {
      var settings = this._lotterySettings || {};
      var guaranteed = settings.guaranteedPrizes || [];
      var dragged = guaranteed.splice(this._dragGuaranteedIdx, 1)[0];
      guaranteed.splice(targetIdx, 0, dragged);
      settings.guaranteedPrizes = guaranteed;
      this._lotterySettings = settings;
      this.renderGuaranteedPrizesList();
    }
  }

  dragGuaranteedEnd(e) {
    e.target.style.opacity = '1';
    this._dragGuaranteedIdx = undefined;
  }

  addToGuaranteed() {
    var prizes = this._tempPrizes || [];
    if (prizes.length === 0) {
      this.showToast('请先添加奖品', 'error');
      return;
    }
    var settings = this._lotterySettings || {};
    var guaranteed = settings.guaranteedPrizes || [];
    var alreadyAdded = guaranteed.map(function(gp){ return gp.prizeId; });
    var available = prizes.filter(function(p){ return alreadyAdded.indexOf(p.id) === -1 && (p.remain||0) > 0; });
    
    if (available.length === 0) {
      this.showToast('所有奖品已添加到必出列表', 'error');
      return;
    }
    
    var levelNames = {1:'一等奖', 2:'二等奖', 3:'三等奖', 4:'四等奖', 5:'五等奖'};
    var html = '<p style="margin-bottom:16px;color:#666;">选择要添加到必出列表的奖品：</p>';
    var self = this;
    available.forEach(function(p) {
      html += '<label style="display:flex;align-items:center;gap:10px;padding:10px;background:#f8f9fa;border-radius:8px;margin-bottom:8px;cursor:pointer;">' +
        '<input type="checkbox" class="guaranteed-prize-check" value="' + p.id + '">' +
        '<span style="font-size:1.2rem;">' + (p.icon||'🎁') + '</span>' +
        '<span style="flex:1;font-weight:500;">' + p.name + '</span>' +
        '<span style="background:#9333EA;color:white;padding:2px 8px;border-radius:4px;font-size:0.8rem;">' + (levelNames[p.level]||'其他') + '</span>' +
        '</label>';
    });
    
    html += '<div style="margin-top:16px;">';
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:16px;">';
    html += '<div class="form-group"><label>必出数量</label><input type="number" id="guaranteed-new-count" value="1" min="0" max="100" style="width:100%;padding:8px;border:2px solid var(--ice-blue);border-radius:8px;"></div>';
    html += '<div class="form-group"><label>最多出</label><input type="number" id="guaranteed-new-max" value="1" min="1" max="100" style="width:100%;padding:8px;border:2px solid var(--ice-blue);border-radius:8px;"></div>';
    html += '</div>';
    html += '<p style="color:#666;font-size:0.85rem;margin-top:8px;">必出=每次开奖必定抽出，最多出=该奖品最多能抽出几个</p>';
    html += '<button onclick="admin.saveAddToGuaranteed()" class="btn btn-primary" style="margin-top:12px;">确认添加</button>';
    html += '</div>';
    
    var modal = this.createModal('添加必出奖品', html);
    document.body.appendChild(modal);
  }

  saveAddToGuaranteed() {
    var checkboxes = document.querySelectorAll('.guaranteed-prize-check:checked');
    var count = parseInt(document.getElementById('guaranteed-new-count').value) || 0;
    var maxCount = parseInt(document.getElementById('guaranteed-new-max').value) || count;
    if (checkboxes.length === 0) {
      this.showToast('请选择至少一个奖品', 'error');
      return;
    }
    
    var settings = this._lotterySettings || {};
    if (!settings.guaranteedPrizes) settings.guaranteedPrizes = [];
    
    var self = this;
    checkboxes.forEach(function(cb) {
      var prizeId = parseInt(cb.value);
      var prize = self._tempPrizes.find(function(p){ return p.id === prizeId; });
      if (prize) {
        settings.guaranteedPrizes.push({
          prizeId: prizeId,
          count: count,
          maxCount: maxCount,
          prizeName: prize.name,
          prizeIcon: prize.icon,
          level: prize.level
        });
      }
    });
    
    this._lotterySettings = settings;
    this.closeModal();
    this.renderGuaranteedPrizesList();
    this.showToast('已添加 ' + checkboxes.length + ' 个奖品到必出列表', 'success');
  }

  removeFromGuaranteed(prizeId) {
    var settings = this._lotterySettings || {};
    if (!settings.guaranteedPrizes) return;
    settings.guaranteedPrizes = settings.guaranteedPrizes.filter(function(gp){ return gp.prizeId !== prizeId; });
    this._lotterySettings = settings;
    this.renderGuaranteedPrizesList();
  }

  getGuaranteedSettings() {
    var prizes = this._tempPrizes || [];
    var settings = [];
    var self = this;
    prizes.forEach(function(p) {
      var countInput = document.getElementById('guaranteed-count-' + p.id);
      var maxInput = document.getElementById('guaranteed-max-' + p.id);
      if (countInput || maxInput) {
        var count = parseInt(countInput ? countInput.value : 0) || 0;
        var maxCount = parseInt(maxInput ? maxInput.value : 0) || count;
        if (count > 0) {
          settings.push({ prizeId: p.id, count: count, maxCount: maxCount, prizeName: p.name, prizeIcon: p.icon, level: p.level });
        }
      }
    });
    return settings;
  }

  async saveLotterySettingsNew() {
    try {
      const data = {
        enabled: document.getElementById('lottery-enabled-create').checked,
        name: document.getElementById('lottery-name-create').value,
        rules: document.getElementById('lottery-rules-create').value.split('\n').filter(function(r){ return r.trim(); }),
        maxDrawsPerUser: parseInt(document.getElementById('lottery-times-create').value) || 0,
        drawCooldownMinutes: parseInt(document.getElementById('lottery-interval-create').value) || 0,
        lotteryType: document.getElementById('lottery-type-create').value,
        guaranteedPrizes: this.getGuaranteedSettings(),
        drawTime: document.getElementById('lottery-draw-time-create').value,
        formFields: this._tempFormFields || [
          { id: 'name', label: '姓名', type: 'text', required: true, placeholder: '请输入您的姓名' },
          { id: 'phone', label: '手机号', type: 'tel', required: true, placeholder: '请输入手机号' }
        ],
        prizes: this._tempPrizes || []
      };
      const res = await fetch('/api/lottery/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const result = await res.json();
      if (result.success) {
        this.showToast('抽奖设置已保存！', 'success');
      } else {
        this.showToast('保存失败: ' + result.error, 'error');
      }
    } catch (e) { this.showToast('保存失败: ' + e.message, 'error'); }
  }

  async loadLotteryRecords() {
    const container = document.getElementById('lottery-records-list');
    if (!container) return;
    container.innerHTML = '<p style="color:var(--text-light);">加载中...</p>';
    try {
      // 同时获取抽奖记录和设置（奖品信息）
      const [recordsRes, settingsRes] = await Promise.all([
        fetch('/api/lottery/records'),
        fetch('/api/lottery/settings')
      ]);
      const data = await recordsRes.json();
      const settings = await settingsRes.json();
      const prizes = settings.prizes || [];
      
      if (data.success && data.records && data.records.length > 0) {
        let html = '<table class="records-table"><tr><th>序号</th><th>时间</th><th>姓名</th><th>手机</th><th>中奖结果</th><th>操作</th></tr>';
        data.records.slice().reverse().forEach(function(r, i) {
          const realIndex = data.records.length - 1 - i;
          const won = r.prize && r.prize !== '未中奖';
          // 获取奖品详情
          let prizeDetail = '';
          if (won && r.prizeId) {
            const prize = prizes.find(function(p){ return p.id == r.prizeId; });
            if (prize) {
              prizeDetail = '<div style="font-size:0.8rem;color:#666;">' + (prize.icon||'') + ' ' + prize.name + '</div>';
            }
          }
          html += '<tr><td>' + (i+1) + '</td>' +
            '<td style="font-size:0.85rem;">' + (r.time ? new Date(r.time).toLocaleString('zh-CN') : '') + '</td>' +
            '<td>' + (r.name||'') + '</td>' +
            '<td>' + (r.phone||'') + '</td>' +
            '<td><span style="color:' + (won?'#10b981':'#999') + ';">' + (won?'✅ '+r.prize :'❌ 未中奖') + '</span>' + prizeDetail + '</td>' +
            '<td><button class="btn btn-danger btn-small" onclick="admin.deleteLotteryRecord(' + realIndex + ')">删除</button></td></tr>';
        });
        html += '</table>';
        container.innerHTML = html;
      } else {
        container.innerHTML = '<p style="color:var(--text-light);text-align:center;padding:40px;">暂无抽奖记录</p>';
      }
    } catch (e) { container.innerHTML = '<p style="color:red;">加载失败: ' + e.message + '</p>'; }
  }

  async deleteLotteryRecord(index) {
    if (!confirm('确定删除这条抽奖记录？')) return;
    try {
      const res = await fetch('/api/lottery/record/' + index, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) { this.showToast('记录已删除', 'success'); this.loadLotteryRecords(); }
      else { this.showToast('删除失败: ' + data.error, 'error'); }
    } catch (e) { this.showToast('删除失败: ' + e.message, 'error'); }
  }

  async exportLotteryRecords() {
    try {
      const res = await fetch('/api/lottery/records');
      const data = await res.json();
      if (!data.success || !data.records || data.records.length === 0) {
        this.showToast('暂无记录可导出', 'error');
        return;
      }
      const records = data.records;
      let csv = '\uFEFF序号,时间,姓名,手机,奖品,状态\n';
      records.forEach(function(r, i) {
        csv += (i+1) + ',' + (r.time ? new Date(r.time).toLocaleString('zh-CN') : '') + ',' + (r.name||'') + ',' + (r.phone||'') + ',' + (r.prize||'') + ',' + (r.won ? '已中奖' : '未中奖') + '\n';
      });
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = '抽奖记录_' + new Date().toISOString().slice(0,10) + '.csv';
      a.click();
      URL.revokeObjectURL(url);
      this.showToast('导出成功', 'success');
    } catch (e) { this.showToast('导出失败', 'error'); }
  }

  async exportLotteryHistory() {
    try {
      const res = await fetch('/api/lottery/history');
      const data = await res.json();
      if (!data.success || !data.history || data.history.length === 0) {
        this.showToast('暂无历史记录可导出', 'error');
        return;
      }
      const history = data.history;
      let csv = '\uFEFF序号,时间,姓名,手机,奖品,归档时间,说明\n';
      history.forEach(function(r, i) {
        csv += (i+1) + ',' + (r.time ? new Date(r.time).toLocaleString('zh-CN') : '') + ',' + (r.name||'') + ',' + (r.phone||'') + ',' + (r.prize||'') + ',' + (r.archivedAt||'') + ',' + (r.archivedNote||'') + '\n';
      });
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = '抽奖历史_' + new Date().toISOString().slice(0,10) + '.csv';
      a.click();
      URL.revokeObjectURL(url);
      this.showToast('导出成功', 'success');
    } catch (e) { this.showToast('导出失败', 'error'); }
  }

  async loadLotteryHistory() {
    const container = document.getElementById('lottery-history-list');
    if (!container) return;
    container.innerHTML = '<p style="color:var(--text-light);">加载中...</p>';
    try {
      // 同时获取历史记录和设置（奖品信息）
      const [historyRes, settingsRes] = await Promise.all([
        fetch('/api/lottery/history'),
        fetch('/api/lottery/settings')
      ]);
      const data = await historyRes.json();
      const settings = await settingsRes.json();
      const prizes = settings.prizes || [];
      
      if (data.success && data.history && data.history.length > 0) {
        let html = '<table class="records-table"><tr><th>序号</th><th>时间</th><th>姓名</th><th>手机</th><th>中奖结果</th><th>说明</th></tr>';
        data.history.forEach(function(r, i) {
          // 获取奖品详情
          let prizeDisplay = r.prize || '无';
          if (r.prize && r.prizeId) {
            const prize = prizes.find(function(p){ return p.id == r.prizeId; });
            if (prize) {
              prizeDisplay = '<span style="color:#10b981;">' + (prize.icon||'') + ' ' + r.prize + '</span><div style="font-size:0.8rem;color:#666;">奖品: ' + prize.name + '</div>';
            }
          }
          html += '<tr><td>' + (i+1) + '</td>' +
            '<td style="font-size:0.85rem;">' + (r.time ? new Date(r.time).toLocaleString('zh-CN') : '') + '</td>' +
            '<td>' + (r.name||'') + '</td>' +
            '<td>' + (r.phone||'') + '</td>' +
            '<td>' + prizeDisplay + '</td>' +
            '<td>' + (r.archivedNote||'抽奖参与') + '</td></tr>';
        });
        html += '</table>';
        container.innerHTML = html;
      } else {
        container.innerHTML = '<p style="color:var(--text-light);text-align:center;padding:40px;">暂无历史记录</p>';
      }
    } catch (e) { container.innerHTML = '<p style="color:red;">加载失败: ' + e.message + '</p>'; }
  }

  // ==================== 账号管理 ====================
  resetCreateAccountForm() {
    const nameEl = document.getElementById('new-acc-name');
    const phoneEl = document.getElementById('new-acc-phone');
    const pwdEl = document.getElementById('new-acc-pwd');
    const roleEl = document.getElementById('new-acc-role');
    const permBox = document.getElementById('new-acc-perm-box');
    if (nameEl) nameEl.value = '';
    if (phoneEl) phoneEl.value = '';
    if (pwdEl) pwdEl.value = '';
    if (roleEl) roleEl.value = 'user';
    if (permBox) permBox.style.display = 'none';
  }

  renderNewAccountPermissions() {
    const container = document.getElementById('new-acc-perm-list');
    if (!container) return;
    const perms = [
      { key: 'home', label: '🏠 首页信息', tab: 'home' },
      { key: 'courses', label: '🎿 了解课程', tab: 'courses' },
      { key: 'quiz', label: '📝 问卷设置', tab: 'quizSettings' },
      { key: 'coupon', label: '🎫 优惠活动', tab: 'coupon' },
      { key: 'library', label: '📚 课程库', tab: 'library' },
      { key: 'rules', label: '🧠 推荐规则', tab: 'rules' },
      { key: 'quizStats', label: '📊 问卷统计', tab: 'quizStats' },
      { key: 'lotteryCreate', label: '🎰 创建抽奖', tab: 'lottery-create' },
      { key: 'lotteryRecords', label: '📋 抽奖记录', tab: 'lottery-records' },
      { key: 'lotteryHistory', label: '📜 历史记录', tab: 'lottery-history' },
      { key: 'createAccount', label: '➕ 创建账号', tab: 'create-account' },
      { key: 'allAccounts', label: '📋 全部账号', tab: 'all-accounts' }
    ];
    let html = '<div class="perm-group"><div class="perm-items">';
    perms.forEach(function(p) {
      html += '<label class="perm-item"><input type="checkbox" id="new-perm-' + p.key + '" checked> ' + p.label + '</label>';
    });
    html += '</div></div>';
    container.innerHTML = html;
  }

  async createAccount() {
    const name = document.getElementById('new-acc-name').value.trim();
    const phone = document.getElementById('new-acc-phone').value.trim();
    const password = document.getElementById('new-acc-pwd').value;
    const role = document.getElementById('new-acc-role').value;
    if (!name) { this.showToast('请输入姓名', 'error'); return; }
    if (!phone || !/^1[3-9]\d{9}$/.test(phone)) { this.showToast('请输入正确的手机号', 'error'); return; }
    if (!password || password.length < 6) { this.showToast('密码至少6位', 'error'); return; }
    let permissions = {};
    if (role === 'admin') {
      const permCheckboxes = document.querySelectorAll('#new-acc-perm-list input[type="checkbox"]');
      permCheckboxes.forEach(function(cb) {
        permissions[cb.id.replace('new-perm-', '')] = cb.checked;
      });
    }
    try {
      const res = await fetch('/api/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone, password: password, name: name, role: role, permissions: permissions })
      });
      const data = await res.json();
      if (data.success) {
        this.showToast('账号创建成功！', 'success');
        this.resetCreateAccountForm();
      } else {
        this.showToast(data.error || '创建失败', 'error');
      }
    } catch (e) { this.showToast('创建失败: ' + e.message, 'error'); }
  }

  togglePasswordVisibility(inputId, btn) {
    const input = document.getElementById(inputId);
    if (!input) return;
    if (input.type === 'password') {
      input.type = 'text';
      btn.textContent = '🙈';
    } else {
      input.type = 'password';
      btn.textContent = '👁️';
    }
  }

  async loadAccountsList() {
    const container = document.getElementById('accounts-list');
    if (!container) return;
    container.innerHTML = '<p style="color:var(--text-light);">加载中...</p>';
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      if (data.success) {
        const users = data.users;
        // 过滤掉test条目和超级管理员
        const filtered = Object.entries(users).filter(function(entry) { 
          return entry[0] !== '18003411633' && entry[0] !== 'test' && typeof entry[1] === 'object'; 
        });
        this._allUsers = users; // 保存用户数据
        if (filtered.length === 0) {
          container.innerHTML = '<p style="color:var(--text-light);text-align:center;padding:40px;">暂无账号</p>';
          return;
        }
        let html = '';
        var self = this;
        filtered.forEach(function(entry) {
          const phone = entry[0];
          const user = entry[1];
          if (typeof user !== 'object') return; // 跳过无效条目
          const roleClass = user.role === 'superadmin' ? 'role-superadmin' : (user.role === 'admin' ? 'role-admin' : 'role-user');
          const roleLabel = user.role === 'superadmin' ? '超级管理员' : (user.role === 'admin' ? '管理员' : '普通用户');
          html += '<div class="account-row" data-phone="' + phone + '">' +
            '<div class="acc-info"><strong>' + (user.name||phone) + '</strong><span class="acc-role ' + roleClass + '">' + roleLabel + '</span></div>' +
            '<div class="acc-phone">' + phone + '</div>' +
            '<div style="display:flex;align-items:center;gap:8px;">' +
              '<span class="pwd-display" id="pwd-' + phone + '" style="color:#666;font-size:0.9rem;">••••••</span>' +
              '<button class="pwd-toggle" data-phone="' + phone + '" title="显示/隐藏密码">👁️</button>' +
            '</div>' +
            '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
              '<button class="btn btn-secondary btn-small btn-edit" data-phone="' + phone + '">编辑</button>';
          if (user.role !== 'superadmin') {
            html += ' <button class="btn btn-danger btn-small btn-delete" data-phone="' + phone + '">删除</button>';
          }
          if (user.role === 'admin') {
            html += ' <button class="btn btn-primary btn-small btn-perm" data-phone="' + phone + '">权限</button>';
          }
          html += '</div></div>';
        });
        container.innerHTML = html;
        
        // 事件委托处理账号按钮点击
        container.onclick = function(e) {
          var btn = e.target.closest('button[data-phone]');
          if (!btn) return;
          var phone = btn.dataset.phone;
          var cls = btn.className;
          if (cls.indexOf('pwd-toggle') !== -1) {
            e.preventDefault();
            self.toggleAccountPwd(phone, btn);
          } else if (cls.indexOf('btn-edit') !== -1) {
            e.preventDefault();
            self.editAccount(phone);
          } else if (cls.indexOf('btn-delete') !== -1) {
            e.preventDefault();
            self.deleteAccount(phone);
          } else if (cls.indexOf('btn-perm') !== -1) {
            e.preventDefault();
            self.configurePermissions(phone);
          }
        };
        
        this._allUsers = users;
      }
    } catch (e) { container.innerHTML = '<p style="color:red;">加载失败: ' + e.message + '</p>'; }
  }

  toggleAccountPwd(phone, btn) {
    const user = this._allUsers ? this._allUsers[phone] : null;
    if (!user) return;
    const span = document.getElementById('pwd-' + phone);
    if (!span) return;
    if (span.textContent === '••••••') {
      span.textContent = user.password || '';
      btn.textContent = '🙈';
    } else {
      span.textContent = '••••••';
      btn.textContent = '👁️';
    }
  }

  searchAccounts() {
    const nameQuery = (document.getElementById('search-name').value || '').toLowerCase();
    const phoneQuery = document.getElementById('search-phone').value || '';
    const rows = document.querySelectorAll('.account-row');
    const self = this;
    rows.forEach(function(row) {
      const phone = row.dataset.phone;
      const user = self._allUsers ? self._allUsers[phone] : null;
      if (!user) return;
      const nameMatch = !nameQuery || (user.name||'').toLowerCase().includes(nameQuery);
      const phoneMatch = !phoneQuery || phone.includes(phoneQuery);
      row.style.display = (nameMatch && phoneMatch) ? 'flex' : 'none';
    });
  }

  editAccount(phone) {
    console.log('editAccount called with phone:', phone);
    console.log('_allUsers keys:', this._allUsers ? Object.keys(this._allUsers) : 'null');
    const user = this._allUsers ? this._allUsers[phone] : null;
    console.log('user:', user);
    if (!user) { alert('用户不存在: ' + phone); return; }
    this._editAccountPhone = phone;
    const modal = this.createModal('编辑账号',
      '<div class="form-group"><label>姓名</label><input type="text" id="edit-acc-name" value="' + (user.name||'') + '"></div>' +
      '<div class="form-group"><label>手机号</label><input type="text" id="edit-acc-phone" value="' + phone + '" style="width:100%;padding:8px;border:2px solid var(--ice-blue);border-radius:8px;"></div>' +
      '<div class="form-group"><label>新密码（留空则不修改）</label><div style="display:flex;gap:8px;"><input type="password" id="edit-acc-pwd" placeholder="输入新密码" style="flex:1;"><button type="button" class="pwd-toggle" onclick="admin.togglePasswordVisibility(\'edit-acc-pwd\', this)">👁️</button></div></div>' +
      '<div class="form-group"><label>角色</label><select id="edit-acc-role" style="width:100%;padding:10px;border:2px solid var(--ice-blue);border-radius:8px;">' +
        '<option value="user"' + (user.role==='user'?' selected':'') + '>普通用户</option>' +
        '<option value="admin"' + (user.role==='admin'?' selected':'') + '>普通管理员</option>' +
        '<option value="superadmin"' + (user.role==='superadmin'?' selected':'') + '>超级管理员</option>' +
      '</select></div>' +
      '<div style="margin-top:20px;"><button class="btn btn-primary" onclick="admin.saveAccountEdit()">保存</button> <button class="btn btn-secondary" onclick="admin.closeModal()">取消</button></div>'
    );
    document.body.appendChild(modal);
  }

  async saveAccountEdit() {
    const oldPhone = this._editAccountPhone;
    const newPhone = document.getElementById('edit-acc-phone').value.trim();
    const name = document.getElementById('edit-acc-name').value.trim();
    const password = document.getElementById('edit-acc-pwd').value;
    const role = document.getElementById('edit-acc-role').value;
    
    if (!newPhone || !/^1[3-9]\d{9}$/.test(newPhone)) {
      this.showToast('请输入正确的手机号', 'error');
      return;
    }
    
    try {
      const res = await fetch('/api/update-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: oldPhone, newPhone: newPhone, name: name, password: password||undefined, role: role })
      });
      const data = await res.json();
      if (data.success) {
        this.showToast('账号已保存', 'success');
        this.closeModal();
        this.loadAccountsList();
      } else { this.showToast(data.error||'保存失败', 'error'); }
    } catch (e) { this.showToast('保存失败: ' + e.message, 'error'); }
  }

  async deleteAccount(phone) {
    console.log('deleteAccount called with phone:', phone);
    if (!confirm('确定删除账号 ' + phone + '？此操作不可恢复。')) return;
    try {
      const res = await fetch('/api/delete-user/' + phone, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) { this.showToast('账号已删除', 'success'); this.loadAccountsList(); }
      else { this.showToast(data.error||'删除失败', 'error'); }
    } catch (e) { this.showToast('删除失败: ' + e.message, 'error'); }
  }

  configurePermissions(phone) {
    console.log('configurePermissions called with phone:', phone);
    const user = this._allUsers ? this._allUsers[phone] : null;
    if (!user) { alert('用户不存在: ' + phone); return; }
    this._permAccountPhone = phone;
    const perms = user.permissions || {};
    const allPerms = [
      { key: 'home', label: '🏠 首页信息', group: '首页信息', tab: 'home' },
      { key: 'courses', label: '🎿 了解课程', group: '首页信息', tab: 'courses' },
      { key: 'quiz', label: '📝 问卷设置', group: '如何报课', tab: 'quizSettings' },
      { key: 'coupon', label: '🎫 优惠活动', group: '如何报课', tab: 'coupon' },
      { key: 'library', label: '📚 课程库', group: '如何报课', tab: 'library' },
      { key: 'rules', label: '🧠 推荐规则', group: '如何报课', tab: 'rules' },
      { key: 'quizStats', label: '📊 问卷统计', group: '如何报课', tab: 'quizStats' },
      { key: 'lotteryCreate', label: '🎰 创建抽奖', group: '抽奖活动', tab: 'lottery-create' },
      { key: 'lotteryRecords', label: '📋 抽奖记录', group: '抽奖活动', tab: 'lottery-records' },
      { key: 'lotteryHistory', label: '📜 历史记录', group: '抽奖活动', tab: 'lottery-history' },
      { key: 'createAccount', label: '➕ 创建账号', group: '管理账号', tab: 'create-account' },
      { key: 'allAccounts', label: '📋 全部账号', group: '管理账号', tab: 'all-accounts' }
    ];
    const groups = {};
    allPerms.forEach(function(p) {
      if (!groups[p.group]) groups[p.group] = [];
      groups[p.group].push(p);
    });
    let html = '';
    const self = this;
    Object.keys(groups).forEach(function(g) {
      html += '<div class="perm-group"><h4>' + g + '</h4><div class="perm-items">';
      groups[g].forEach(function(p) {
        const checked = perms[p.key] !== false;
        html += '<label class="perm-item"><input type="checkbox" id="perm-' + p.key + '"' + (checked?' checked':'') + '> ' + p.label + '</label>';
      });
      html += '</div></div>';
    });
    const modal = this.createModal('权限配置 - ' + (user.name||phone), html +
      '<div style="margin-top:20px;"><button class="btn btn-primary" onclick="admin.savePermissions()">保存权限</button> <button class="btn btn-secondary" onclick="admin.closeModal()">取消</button></div>'
    );
    document.body.appendChild(modal);
  }

  async savePermissions() {
    const phone = this._permAccountPhone;
    const permissions = {};
    const checkboxes = document.querySelectorAll('#edit-modal input[type="checkbox"]');
    checkboxes.forEach(function(cb) {
      permissions[cb.id.replace('perm-', '')] = cb.checked;
    });
    try {
      const res = await fetch('/api/update-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone, permissions: permissions })
      });
      const data = await res.json();
      if (data.success) {
        this.showToast('权限已保存', 'success');
        this.closeModal();
        this.loadAccountsList();
      } else { this.showToast(data.error||'保存失败', 'error'); }
    } catch (e) { this.showToast('保存失败: ' + e.message, 'error'); }
  }

  // ==================== 权限应用 ====================
  applyPermissions(userRole, userPerms) {
    if (userRole === 'superadmin') return;
    
    const perms = userPerms || {};
    console.log('applyPermissions called:', { role: userRole, perms: perms });
    
    // 隐藏子菜单中的按钮（使用#xxx-subtabs来限定范围）
    const hideSubMenu = function(subtabsId, dataTab) {
      var el = document.querySelector('#' + subtabsId + ' [data-tab="' + dataTab + '"]');
      if (el) { el.style.display = 'none'; console.log('隐藏子菜单:', subtabsId, dataTab); }
    };
    
    // 隐藏父级菜单按钮
    const hideParentMenu = function(dataTab) {
      var el = document.querySelector('.admin-tabs [data-tab="' + dataTab + '"]');
      if (el) { el.style.display = 'none'; console.log('隐藏父级菜单:', dataTab); }
    };
    
    // 隐藏子菜单容器
    const hideSubtabs = function(subtabsId) {
      var el = document.getElementById(subtabsId);
      if (el) { el.style.display = 'none'; console.log('隐藏子菜单容器:', subtabsId); }
    };
    
    // ===== 如何报课 section =====
    var applyVisible = 0;
    if (perms.quiz !== false) { applyVisible++; } else { hideSubMenu('apply-subtabs', 'apply'); }
    if (perms.coupon !== false) { applyVisible++; } else { hideSubMenu('apply-subtabs', 'coupon'); }
    if (perms.library !== false) { applyVisible++; } else { hideSubMenu('apply-subtabs', 'library'); }
    if (perms.rules !== false) { applyVisible++; } else { hideSubMenu('apply-subtabs', 'rules'); }
    if (perms.quizStats !== false) { applyVisible++; } else { hideSubMenu('apply-subtabs', 'quizStats'); }
    console.log('如何报课可见数量:', applyVisible);
    if (applyVisible === 0) {
      hideParentMenu('apply');
      hideSubtabs('apply-subtabs');
    }
    
    // ===== 抽奖活动 section =====
    var lotteryVisible = 0;
    if (perms.lotteryCreate !== false) { lotteryVisible++; } else { hideSubMenu('lottery-subtabs', 'lottery-create'); }
    if (perms.lotteryRecords !== false) { lotteryVisible++; } else { hideSubMenu('lottery-subtabs', 'lottery-records'); }
    if (perms.lotteryHistory !== false) { lotteryVisible++; } else { hideSubMenu('lottery-subtabs', 'lottery-history'); }
    console.log('抽奖活动可见数量:', lotteryVisible);
    if (lotteryVisible === 0) {
      hideParentMenu('lottery');
      hideSubtabs('lottery-subtabs');
    }
    
    // ===== 账号管理 section =====
    var accVisible = 0;
    if (perms.createAccount !== false) { accVisible++; } else { hideSubMenu('accounts-subtabs', 'create-account'); }
    if (perms.allAccounts !== false) { accVisible++; } else { hideSubMenu('accounts-subtabs', 'all-accounts'); }
    console.log('账号管理可见数量:', accVisible);
    if (accVisible === 0) {
      hideParentMenu('accounts');
      hideSubtabs('accounts-subtabs');
    }
    
    // ===== 其他主菜单 =====
    if (perms.home === false) hideParentMenu('home');
    if (perms.courses === false) hideParentMenu('courses');
    
    // 如果首页被隐藏，自动切换到第一个可见的菜单
    setTimeout(function() {
      var firstMenu = document.querySelector('.admin-tab:not([style*="display: none"])');
      if (firstMenu) {
        var tab = firstMenu.dataset.tab;
        if (tab === 'apply' || tab === 'lottery' || tab === 'accounts') {
          firstMenu.click();
        } else {
          document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
          document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
          firstMenu.classList.add('active');
          var panel = document.getElementById('panel-' + tab);
          if (panel) panel.classList.add('active');
        }
      }
    }, 100);
  }

  // ==================== 问卷统计 ====================
  async loadQuizStatistics() {
    const container = document.getElementById('quiz-statistics-data');
    if (!container) return;
    container.innerHTML = '<p style="color:var(--text-light);">加载中...</p>';
    try {
      const res = await fetch('/api/quiz/statistics');
      const data = await res.json();
      if (data.success) {
        if (data.total === 0) {
          container.innerHTML = '<p style="color:var(--text-light);text-align:center;padding:40px;">暂无问卷提交记录</p>';
          return;
        }
        let html = '<p style="margin-bottom:16px;">共 <strong>' + data.total + '</strong> 条提交记录</p>';
        html += '<table class="records-table" style="width:100%;border-collapse:collapse;"><tr style="background:#f5f5f5;"><th style="padding:12px;text-align:left;">序号</th><th style="padding:12px;text-align:left;">时间</th><th style="padding:12px;text-align:left;">填写内容</th><th style="padding:12px;text-align:left;">推荐课程</th><th style="padding:12px;text-align:left;">操作</th></tr>';
        
        data.submissions.slice().reverse().forEach(function(s, i) {
          const answers = s.answers || {};
          // 提取所有答案的文本
          let answerParts = [];
          let fullDetails = [];
          for (let key in answers) {
            let val = answers[key];
            let text = '';
            if (typeof val === 'object' && val.text) {
              text = val.text;
            } else if (typeof val === 'string') {
              text = val;
            } else if (Array.isArray(val)) {
              text = val.join('/');
            }
            if (text) {
              answerParts.push(text);
              fullDetails.push(key + ': ' + text);
            }
          }
          const answerText = answerParts.slice(0,3).join(' → ') || '无';
          const detailText = fullDetails.join('\n');
          html += '<tr style="border-bottom:1px solid #eee;">' +
            '<td style="padding:10px;">' + (data.total - i) + '</td>' +
            '<td style="padding:10px;font-size:0.85rem;color:#666;">' + new Date(s.submittedAt).toLocaleString('zh-CN') + '</td>' +
            '<td style="padding:10px;font-size:0.9rem;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + answerText + '">' + answerText + '</td>' +
            '<td style="padding:10px;font-size:0.85rem;">' + (s.recommendedCourses||[]).join(', ') + '</td>' +
            '<td style="padding:10px;"><button class="btn btn-secondary btn-small" onclick="admin.showQuizDetail(' + i + ', ' + data.total + ', \'' + encodeURIComponent(JSON.stringify(s)) + '\')">查看详情</button></td></tr>';
        });
        html += '</table>';
        container.innerHTML = html;
        
        // 存储数据供详情使用
        this._quizSubmissions = data.submissions;
      } else { container.innerHTML = '<p style="color:red;">加载失败</p>'; }
    } catch (e) { container.innerHTML = '<p style="color:red;">加载失败: ' + e.message + '</p>'; }
  }

  showQuizDetail(idx, total, dataStr) {
    const submissions = this._quizSubmissions;
    const submission = submissions[total - 1 - idx];
    if (!submission) return;
    
    const answers = submission.answers || {};
    let details = [];
    for (let key in answers) {
      let val = answers[key];
      let text = '';
      if (typeof val === 'object' && val.text) {
        text = val.text;
      } else if (typeof val === 'string') {
        text = val;
      } else if (Array.isArray(val)) {
        text = val.join('/');
      }
      if (text) details.push('<div style="margin-bottom:8px;"><strong>' + key + ':</strong> ' + text + '</div>');
    }
    
    const modal = this.createModal('问卷详情', 
      '<div style="max-height:400px;overflow-y:auto;">' +
      '<p style="color:#666;margin-bottom:16px;">提交时间: ' + new Date(submission.submittedAt).toLocaleString('zh-CN') + '</p>' +
      '<h4 style="color:#0039A6;margin-bottom:12px;">填写内容：</h4>' +
      details.join('') +
      '<h4 style="color:#0039A6;margin:16px 0 12px;">推荐课程：</h4>' +
      '<div>' + (submission.recommendedCourses||[]).map(function(c){ return '<span style="background:#f0f0f0;padding:4px 8px;border-radius:4px;margin:2px;display:inline-block;">' + c + '</span>'; }).join('') + '</div>' +
      '</div>' +
      '<div style="margin-top:20px;text-align:center;"><button class="btn btn-primary" onclick="admin.closeModal()">关闭</button></div>'
    );
    document.body.appendChild(modal);
  }

  // ==================== 开奖控制 ====================
  updateDrawStatus(settings) {
    const statusEl = document.getElementById('draw-status');
    if (!statusEl) return;
    if (settings.drawn) {
      statusEl.textContent = '✅ 已开奖';
      statusEl.style.color = '#10b981';
    } else if (settings.drawTime) {
      const drawTime = new Date(settings.drawTime);
      const now = new Date();
      if (now >= drawTime) {
        statusEl.textContent = '⏰ 已到达开奖时间';
        statusEl.style.color = '#f59e0b';
      } else {
        const diff = drawTime - now;
        const hours = Math.floor(diff / (1000*60*60));
        const mins = Math.floor((diff % (1000*60*60)) / (1000*60));
        statusEl.textContent = '⏰ ' + hours + '小时' + mins + '分后开奖';
        statusEl.style.color = '#3b82f6';
      }
    } else {
      statusEl.textContent = '⏭️ 手动开奖模式';
      statusEl.style.color = '#6b7280';
    }
  }

  async manualDraw() {
    if (!confirm('确定立即开奖？此操作不可逆！')) return;
    try {
      const res = await fetch('/api/lottery/draw', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        this.showToast('开奖完成！共 ' + data.winners + ' 人中奖', 'success');
        this.loadLotterySettings();
        this.loadLotteryRecords();
        this.loadLotteryHistory();
      } else {
        this.showToast(data.error || '开奖失败', 'error');
      }
    } catch (e) { this.showToast('开奖失败: ' + e.message, 'error'); }
  }

}

// Initialize admin panel
let admin;
document.addEventListener('DOMContentLoaded', async () => {
  // 直接显示登录框
  var modal = document.getElementById('login-modal');
  if (modal) {
    modal.classList.add('show');
  }
  
  // 绑定登录按钮事件
  var btn = document.getElementById('login-submit-btn');
  if (btn) {
    btn.onclick = function() {
      adminLogin();
    };
  }
});
