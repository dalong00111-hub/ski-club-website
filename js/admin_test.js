console.log("Admin JS loaded");
/**
 * 极运龙城×趣滑雪俱乐部 - 后台管理逻辑
 */

class AdminPanel {
  constructor() {
    this.content = null;
    this.currentSection = 'club';
  }

  async init() {
    console.log('AdminPanel init starting...');
    try {
      await this.loadContent();
      console.log('Content loaded:', Object.keys(this.content));
      this.renderAll();
      console.log('RenderAll done');
      this.bindEvents();
      console.log('BindEvents done');
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
    var self = this;
    
    // 主 Tab 切换
    document.querySelectorAll('.admin-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const target = e.target.dataset.tab;
        
        document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.admin-panel').forEach(p => p.style.display = 'none');
        
        e.target.classList.add('active');
        
        // 处理如何报课父级 tab - 显示子菜单
        if (target === 'apply') {
          document.getElementById('panel-apply').style.display = 'block';
          document.getElementById('apply-subtabs').style.display = 'flex';
          // 默认显示第一个子 tab
          self.switchSubTab('apply');
        } else {
          document.getElementById('apply-subtabs').style.display = 'none';
          document.getElementById('panel-' + target).style.display = 'block';
        }
        
        // 切换到问卷标签时重新渲染
        if (target === 'quiz' || target === 'apply' || target === 'library') {
          this.renderQuizQuestions();
          this.renderQuizResult();
          if (target === 'library') this.renderCourseCategories();
        }
        if (target === 'coupon') this.renderActivities();
        if (target === 'rules') { this.renderRecommendationConfig(); this.renderRecommendationActivities(); this.renderRules(); }
        if (target === 'lottery') this.renderLotterySettings();
      });
    });
    
    // 子 Tab 切换
    document.querySelectorAll('.admin-subtab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const target = e.target.dataset.tab;
        self.switchSubTab(target);
      });
    });
  }

  switchSubTab(target) {
    document.querySelectorAll('.admin-subtab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.admin-panel').forEach(p => p.style.display = 'none');
    
    // 找到并激活对应的子tab按钮
    document.querySelectorAll('.admin-subtab').forEach(t => {
      if (t.dataset.tab === target) t.classList.add('active');
    });
    
    // 显示对应面板
    var panel = document.getElementById('panel-' + target);
    if (panel) panel.style.display = 'block';
    
    // 渲染对应内容
    if (target === 'apply') {
      this.renderQuizQuestions();
      this.renderQuizResult();
    } else if (target === 'coupon') {
      this.renderActivities();
    } else if (target === 'library') {
      this.renderCourseCategories();
    } else if (target === 'rules') {
      this.renderRecommendationConfig();
      this.renderRecommendationActivities();
      this.renderRules();
    } else if (target === 'lottery') {
      this.renderLotterySettings();
    } else if (target === 'quiz-stats') {
      this.renderQuizStatistics();
      this.startQuizStatsAutoRefresh();
    } else {
      // 停止自动刷新
      if (this.quizStatsInterval) {
        clearInterval(this.quizStatsInterval);
        this.quizStatsInterval = null;
      }
    }
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
      var condStr = Object.keys(r.conditions || {}).map(function(k) { return r.conditions[k]; }).join(' / ') || '不限';
      html += '<p>🎯 条件：' + condStr + ' <span style="color:#FF6B35;">⭐权重:' + (r.weight || 6) + '</span></p>';
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

  // 别名
  addRecommendationRule() { this.addRule(); }
  
  deleteRule(idx) {
    if (!confirm('确定删除这条规则？')) return;
    if (!this.content.recommendRules) return;
    this.content.recommendRules.splice(idx, 1);
    this.saveContent().then(() => {
      this.showToast('已删除', 'success');
      this.renderRules();
    });
  }
  
  editRule(idx) {
    // 编辑规则 - 调用addRule的编辑版本
    var rule = this.content.recommendRules?.[idx];
    if (!rule) return;
    // TODO: 实现编辑功能
    this.showToast('编辑功能开发中', 'info');
  }
  
  addRecommendationResult() {
    // 添加推荐结果 - 使用现有课程数据
    var courses = (this.content.courses?.snow || []).concat(this.content.courses?.offseason || []);
    if (courses.length === 0) {
      this.showToast('请先添加课程', 'error');
      return;
    }
    this.addRule();
  }
  
  // 根据问卷问题动态生成匹配条件HTML
  generateConditionFields() {
    var quiz = this.content.quiz || {};
    var questions = quiz.questions || [];
    var html = '<div style="border:1px solid #ddd;padding:15px;border-radius:8px;margin-bottom:15px;">';
    html += '<h4 style="margin-bottom:10px;">🎯 匹配条件（根据问卷问题动态生成）</h4>';
    
    // 按问题ID分组生成下拉选项
    var questionMap = {
      'q1': { label: '年龄段', options: [] },
      'q2': { label: '项目类型', options: [] },
      'q3': { label: '滑雪基础', options: [] },
      'q4': { label: '时间安排', options: [] },
      'q5': { label: '预算范围', options: [] },
      'q6': { label: '板型选择', options: [] }
    };
    
    // 从问卷问题中提取选项
    questions.forEach(function(q) {
      if (q.options && q.options.length > 0) {
        var qid = q.id;
        var label = q.content.replace('您的', '').replace('？', '') || qid;
        questionMap[qid] = { label: label, options: q.options.map(function(o) { return o.text; }) };
      }
    });
    
    // 生成下拉选择
    for (var qid in questionMap) {
      var qdata = questionMap[qid];
      if (qdata.options.length > 0) {
        html += '<div class="form-group"><label>' + qdata.label + '</label>';
        html += '<select id="rule-' + qid + '" style="width:100%;padding:8px;"><option value="">不限</option>';
        qdata.options.forEach(function(opt) {
          html += '<option value="' + opt + '">' + opt + '</option>';
        });
        html += '</select></div>';
      }
    }
    
    html += '</div>';
    return html;
  }
  
  addRule() {
    var self = this;
    var html = '<div class="form-group"><label>规则名称 *</label><input type="text" id="rule-name" placeholder="如：初学者推荐" style="width:100%;padding:8px;"></div>';
    html += this.generateConditionFields();
    html += '<div class="form-group" style="margin-top:15px;">';
    html += '<label>⭐ 匹配权重（1-10，数值越高优先级越大）</label>';
    html += '<select id="rule-weight" style="width:100%;padding:8px;">';
    html += '<option value="10">10 - 极高优先级</option>';
    html += '<option value="8">8 - 高优先级</option>';
    html += '<option value="6" selected>6 - 普通优先级</option>';
    html += '<option value="4">4 - 较低优先级</option>';
    html += '<option value="2">2 - 最低优先级</option>';
    html += '</select></div>';
    html += '<div style="border:1px solid #ddd;padding:15px;border-radius:8px;margin-top:15px;">';
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
      // 收集所有问卷问题的答案条件
      var conditions = {};
      var quiz = self.content.quiz || {};
      var questions = quiz.questions || [];
      questions.forEach(function(q) {
        var el = document.getElementById('rule-' + q.id);
        if (el && el.value) {
          conditions[q.id] = el.value;
        }
      });
      
      self.content.recommendRules.push({
        name: name,
        conditions: conditions,
        weight: parseInt(document.getElementById('rule-weight').value) || 6,
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
    var rules = this.content.recommendRules || [];
    var r = rules[idx];
    var self = this;
    var html = '<div class="form-group"><label>规则名称 *</label><input type="text" id="rule-name" value="' + r.name + '" style="width:100%;padding:8px;"></div>';
    html += '<div style="border:1px solid #ddd;padding:15px;border-radius:8px;margin-bottom:15px;">';
    html += '<h4 style="margin-bottom:10px;">🎯 匹配条件</h4>';
    html += '<div class="form-group"><label>学习目的</label><select id="rule-goal" style="width:100%;padding:8px;"><option value="">不限</option><option value="入门体验"' + (r.conditions?.goal==='入门体验'?' selected':'') + '>入门体验</option><option value="技术提升"' + (r.conditions?.goal==='技术提升'?' selected':'') + '>技术提升</option><option value="考证"' + (r.conditions?.goal==='考证'?' selected':'') + '>考证</option><option value="竞技"' + (r.conditions?.goal==='竞技'?' selected':'') + '>竞技</option></select></div>';
    html += '<div class="form-group"><label>预算范围</label><select id="rule-budget" style="width:100%;padding:8px;"><option value="">不限</option><option value="2000以下"' + (r.conditions?.budget==='2000以下'?' selected':'') + '>2000以下</option><option value="2000-5000"' + (r.conditions?.budget==='2000-5000'?' selected':'') + '>2000-5000</option><option value="5000-10000"' + (r.conditions?.budget==='5000-10000'?' selected':'') + '>5000-10000</option><option value="10000以上"' + (r.conditions?.budget==='10000以上'?' selected':'') + '>10000以上</option></select></div>';
    html += '<div class="form-group"><label>滑雪经验</label><select id="rule-exp" style="width:100%;padding:8px;"><option value="">不限</option><option value="零基础"' + (r.conditions?.experience==='零基础'?' selected':'') + '>零基础</option><option value="有基础"' + (r.conditions?.experience==='有基础'?' selected':'') + '>有基础</option></select></div>';
    html += '</div>';
    html += '<div class="form-group" style="margin-top:15px;">';
    html += '<label>⭐ 匹配权重（1-10，数值越高优先级越大）</label>';
    html += '<select id="rule-weight" style="width:100%;padding:8px;">';
    html += '<option value="10">10 - 极高权重</option>';
    html += '<option value="8">8 - 高权重</option>';
    html += '<option value="6" selected>6 - 普通权重（默认）</option>';
    html += '<option value="4">4 - 较低权重</option>';
    html += '<option value="2">2 - 低权重</option>';
    html += '</select></div>';
    html += '<div style="border:1px solid #ddd;padding:15px;border-radius:8px;margin-top:15px;">';
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
    html += '<div style="margin-top:20px;"><button onclick="admin.saveRecommendationConfig()" class="btn btn-primary">保存配置</button></div>';
    container.innerHTML = html;
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
    var lottery = this.content.lottery || { enabled: true, prizes: [], records: [], rules: [], settings: { maxDrawsPerUser: 0, drawCooldownMinutes: 0 } };
    if (!this.content.lottery) this.content.lottery = lottery;
    if (!this.content.lottery.settings) this.content.lottery.settings = { maxDrawsPerUser: 0, drawCooldownMinutes: 0 };
    
    document.getElementById('lottery-enabled').checked = lottery.enabled !== false;
    document.getElementById('lottery-max-draws').value = lottery.settings.maxDrawsPerUser ?? 1;
    document.getElementById('lottery-cooldown').value = lottery.settings.drawCooldownMinutes || 0;
    
    var rulesEl = document.getElementById('lottery-rules');
    if (rulesEl) {
      var rules = lottery.rules || [];
      if (Array.isArray(rules)) {
        rulesEl.value = rules.join('\n');
      } else {
        rulesEl.value = rules;
      }
    }
    
    this.renderPrizesList();
    this.renderLotteryRecords();
    this.renderFormFields();
  }

  renderFormFields() {
    var container = document.getElementById('form-fields-list');
    if (!container) return;
    
    var lottery = this.content.lottery || {};
    var fields = lottery.formFields || [
      { name: 'name', label: '姓名', type: 'text', required: true, placeholder: '请输入您的姓名' },
      { name: 'phone', label: '手机号', type: 'tel', required: true, placeholder: '请输入您的手机号' },
      { name: 'wechat', label: '微信号', type: 'text', required: false, placeholder: '请输入您的微信号（选填）' }
    ];
    
    if (!lottery.formFields) {
      lottery.formFields = fields;
    }
    
    if (fields.length === 0) {
      container.innerHTML = '<p style="color: var(--text-light);">暂无字段</p>';
      return;
    }
    
    var html = '<table style="width: 100%; border-collapse: collapse;">';
    html += '<tr style="background: #f5f5f5;"><th style="padding: 8px; text-align: left; width: 25%;">字段名</th><th style="padding: 8px; text-align: left; width: 20%;">标签</th><th style="padding: 8px; text-align: left; width: 15%;">类型</th><th style="padding: 8px; text-align: center; width: 10%;">必填</th><th style="padding: 8px; text-align: left;">占位符</th><th style="padding: 8px; text-align: center; width: 60px;">操作</th></tr>';
    
    fields.forEach(function(field, index) {
      html += '<tr style="border-bottom: 1px solid #eee;">';
      html += '<td style="padding: 8px;"><input type="text" value="' + field.name + '" onchange="admin.updateFormField(' + index + ', \'name\', this.value)" style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px;"></td>';
      html += '<td style="padding: 8px;"><input type="text" value="' + field.label + '" onchange="admin.updateFormField(' + index + ', \'label\', this.value)" style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px;"></td>';
      html += '<td style="padding: 8px;"><select onchange="admin.updateFormField(' + index + ', \'type\', this.value)" style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px;"><option value="text"' + (field.type === 'text' ? ' selected' : '') + '>文本</option><option value="tel"' + (field.type === 'tel' ? ' selected' : '') + '>电话</option><option value="number"' + (field.type === 'number' ? ' selected' : '') + '>数字</option><option value="email"' + (field.type === 'email' ? ' selected' : '') + '>邮箱</option></select></td>';
      html += '<td style="padding: 8px; text-align: center;"><input type="checkbox" ' + (field.required ? 'checked' : '') + ' onchange="admin.updateFormField(' + index + ', \'required\', this.checked)"></td>';
      html += '<td style="padding: 8px;"><input type="text" value="' + (field.placeholder || '') + '" onchange="admin.updateFormField(' + index + ', \'placeholder\', this.value)" style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px;"></td>';
      html += '<td style="padding: 8px; text-align: center;"><button onclick="admin.removeFormField(' + index + ')" class="btn btn-danger" style="padding: 4px 8px; font-size: 0.85rem;">删除</button></td>';
      html += '</tr>';
    });
    html += '</table>';
    
    container.innerHTML = html;
  }

  addFormField() {
    var lottery = this.content.lottery || {};
    if (!lottery.formFields) lottery.formFields = [];
    
    lottery.formFields.push({
      name: 'field_' + Date.now(),
      label: '新字段',
      type: 'text',
      required: false,
      placeholder: '请输入'
    });
    
    this.content.lottery = lottery;
    this.renderFormFields();
    this.showToast('已添加新字段', 'success');
  }

  updateFormField(index, key, value) {
    var lottery = this.content.lottery || {};
    if (!lottery.formFields || !lottery.formFields[index]) return;
    
    lottery.formFields[index][key] = value;
    this.content.lottery = lottery;
  }

  removeFormField(index) {
    if (!confirm('确定删除此字段？')) return;
    
    var lottery = this.content.lottery || {};
    if (lottery.formFields) {
      lottery.formFields.splice(index, 1);
      this.content.lottery = lottery;
      this.renderFormFields();
      this.showToast('已删除字段', 'success');
    }
  }

  saveLotterySettings() {
    var lottery = this.content.lottery || { prizes: [], records: [], settings: {} };
    lottery.enabled = document.getElementById('lottery-enabled').checked;
    lottery.settings = {
      maxDrawsPerUser: parseInt(document.getElementById('lottery-max-draws').value) ?? 0,
      drawCooldownMinutes: parseInt(document.getElementById('lottery-cooldown').value) || 0
    };
    
    var rulesEl = document.getElementById('lottery-rules');
    if (rulesEl && rulesEl.value) {
      lottery.rules = rulesEl.value.split('\n').filter(function(r) { return r.trim(); });
    }
    
    // 保存表单字段配置
    if (lottery.formFields) {
      lottery.formFields = lottery.formFields.filter(function(f) { return f.name && f.label; });
    }
    
    this.content.lottery = lottery;
    this.saveContent().then(function() { this.showToast('设置已保存', 'success'); }.bind(this));
  }

  renderPrizesList() {
    var container = document.getElementById('prizes-list');
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
    var container = document.getElementById('lottery-records');
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

renderQuizStatistics() {
    var self = this;
    var container = document.getElementById('quiz-submissions-list');
    var totalCount = document.getElementById('quiz-total-count');
    if (!container) return;
    
    // 显示最后更新时间
    var lastUpdate = document.getElementById('quiz-last-update');
    var now = new Date().toLocaleTimeString('zh-CN');
    if (lastUpdate) lastUpdate.textContent = '最后更新: ' + now;
    
    fetch('/api/quiz/statistics?t=' + Date.now())
      .then(function(res) { return res.json(); })
      .then(function(data) {
        if (!data.success) {
          container.innerHTML = '<p style="color:var(--text-light);">加载失败</p>';
          return;
        }
        
        totalCount.textContent = data.total || 0;
        if (lastUpdate) lastUpdate.textContent = '最后更新: ' + new Date().toLocaleTimeString('zh-CN');
        
        if (!data.submissions || data.submissions.length === 0) {
          container.innerHTML = '<p style="color:var(--text-light);">暂无填写记录</p>';
          return;
        }
        
        var html = '<div style="margin-bottom:10px;color:#666;font-size:0.85rem;">共 ' + data.total + ' 条记录 <span id="quiz-last-update" style="float:right;">最后更新: ' + new Date().toLocaleTimeString('zh-CN') + '</span></div>';
        html += '<table style="width:100%;border-collapse:collapse;font-size:0.9rem;">';
        html += '<tr style="background:#f0f0f0;"><th style="padding:8px;text-align:left;width:150px;">时间</th><th style="padding:8px;text-align:left;">用户答案</th><th style="padding:8px;text-align:left;">推荐课程</th></tr>';
        
        data.submissions.slice().reverse().forEach(function(sub) {
          var answersStr = Object.values(sub.answers || {}).map(function(a) {
            return typeof a === 'object' ? a.text : a;
          }).join(' / ') || '无';
          
          var coursesStr = sub.recommendedCourses ? sub.recommendedCourses.slice(0, 2).join(', ') : '无';
          if (sub.recommendedCourses && sub.recommendedCourses.length > 2) {
            coursesStr += '...';
          }
          
          var date = sub.submittedAt ? new Date(sub.submittedAt).toLocaleString('zh-CN') : '未知';
          
          html += '<tr style="border-bottom:1px solid #eee;">';
          html += '<td style="padding:8px;vertical-align:top;">' + date + '</td>';
          html += '<td style="padding:8px;vertical-align:top;">' + answersStr + '</td>';
          html += '<td style="padding:8px;vertical-align:top;">' + coursesStr + '</td>';
          html += '</tr>';
        });
        
        html += '</table>';
        container.innerHTML = html;
      })
      .catch(function(e) {
        container.innerHTML = '<p style="color:var(--text-light);">加载失败: ' + e.message + '</p>';
      });
  }
  
  // 定时刷新问卷统计（每10秒）
  startQuizStatsAutoRefresh() {
    this.quizStatsInterval = setInterval(() => {
      var panel = document.getElementById('panel-quiz-stats');
      if (panel && panel.style.display !== 'none') {
        this.renderQuizStatistics();
      }
    }, 10000);
  }

}

// Initialize admin panel
let admin;
// 直接初始化
window.onload = async () => {
  admin = new AdminPanel();
  await admin.init();
};
// 如果已经加载完成，直接调用
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  admin = new AdminPanel();
  admin.init().catch(console.error);
}
