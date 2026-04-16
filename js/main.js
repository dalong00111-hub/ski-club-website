/**
 * 极运龙城×趣滑雪俱乐部 - 首页逻辑
 */

// API配置 - 修改这里的地址连接你的后端
const API_BASE = 'https://1255313519-84i7l0se8i.ap-beijing.tencentscf.com';

class SkiClubWebsite {
  constructor() {
    this.content = null;
    this.currentSlide = 0;
    this.sliderInterval = null;
  }

  async init() {
    try {
      await this.loadContent();
      this.renderAll();
      this.initSlider();
      this.initSmoothScroll();
    } catch (error) {
      console.error('网站初始化失败:', error);
      this.showError();
    }
  }

  async loadContent() {
    // 优先从API获取内容
    try {
      const response = await fetch(API_BASE + '/api/content');
      if (response.ok) {
        this.content = await response.json();
        return;
      }
    } catch (e) {
      console.warn('API获取失败，尝试文件路径:', e);
    }
    // 兼容直接访问 data/content.json 文件路径
    const response = await fetch(API_BASE + '/data/content.json');
    this.content = await response.json();
  }

  renderAll() {
    this.renderFounded();
    this.renderHeroSlider();
    this.renderFounder();
    this.renderBases();
    this.renderAthletes();
    this.renderMenu();
  }

  // 渲染页眉
  renderHeader() {
    const header = this.content.header;
    if (!header) return;
    const logoEl = document.querySelector('.nav-logo');
    if (logoEl && header.logo) {
      logoEl.textContent = header.logo;
    }
  }

  // 渲染成立时间
  renderFounded() {
    const foundedEl = document.getElementById('founded-year');
    if (foundedEl && this.content.club) {
      foundedEl.textContent = this.content.club.foundedYear;
    }
    
    const foundedDescEl = document.getElementById('founded-desc');
    if (foundedDescEl && this.content.club) {
      foundedDescEl.textContent = this.content.club.description;
    }
  }

  // 渲染Hero轮播图
  renderHeroSlider() {
    const slider = document.getElementById('hero-slider');
    const dotsContainer = document.getElementById('hero-dots');
    
    if (!slider || !this.content.hero) return;

    const slides = this.content.hero.slides;
    
    // 渲染幻灯片
    slider.innerHTML = slides.map((slide, index) => `
      <div class="hero-slide ${index === 0 ? 'active' : ''}" data-index="${index}">
        <div class="hero-slide-bg" style="background-image: url('${slide.image || ''}')">
          ${!slide.image ? '<div class="hero-slide-bg placeholder-bg">🏂</div>' : ''}
        </div>
        <div class="hero-slide-content">
          <h2 class="hero-slide-title">${slide.title}</h2>
          <p class="hero-slide-desc">${slide.description}</p>
        </div>
      </div>
    `).join('');

    // 渲染导航点
    if (dotsContainer) {
      dotsContainer.innerHTML = slides.map((_, index) => `
        <span class="hero-dot ${index === 0 ? 'active' : ''}" data-index="${index}"></span>
      `).join('');
    }

    // 绑定点击事件
    this.bindSliderEvents();
  }

  bindSliderEvents() {
    const prevBtn = document.getElementById('hero-prev');
    const nextBtn = document.getElementById('hero-next');
    const dots = document.querySelectorAll('.hero-dot');

    if (prevBtn) {
      prevBtn.addEventListener('click', () => this.prevSlide());
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', () => this.nextSlide());
    }

    dots.forEach(dot => {
      dot.addEventListener('click', (e) => {
        const index = parseInt(e.target.dataset.index);
        this.goToSlide(index);
      });
    });
  }

  initSlider() {
    // 自动播放
    this.sliderInterval = setInterval(() => this.nextSlide(), 5000);
  }

  nextSlide() {
    const slides = document.querySelectorAll('.hero-slide');
    const dots = document.querySelectorAll('.hero-dot');
    const total = slides.length;
    
    slides[this.currentSlide].classList.remove('active');
    dots[this.currentSlide].classList.remove('active');
    
    this.currentSlide = (this.currentSlide + 1) % total;
    
    slides[this.currentSlide].classList.add('active');
    dots[this.currentSlide].classList.add('active');
  }

  prevSlide() {
    const slides = document.querySelectorAll('.hero-slide');
    const dots = document.querySelectorAll('.hero-dot');
    const total = slides.length;
    
    slides[this.currentSlide].classList.remove('active');
    dots[this.currentSlide].classList.remove('active');
    
    this.currentSlide = (this.currentSlide - 1 + total) % total;
    
    slides[this.currentSlide].classList.add('active');
    dots[this.currentSlide].classList.add('active');
  }

  goToSlide(index) {
    const slides = document.querySelectorAll('.hero-slide');
    const dots = document.querySelectorAll('.hero-dot');
    
    slides[this.currentSlide].classList.remove('active');
    dots[this.currentSlide].classList.remove('active');
    
    this.currentSlide = index;
    
    slides[this.currentSlide].classList.add('active');
    dots[this.currentSlide].classList.add('active');
  }

  // 渲染创始人
  renderFounder() {
    const container = document.getElementById('founder-content');
    if (!container || !this.content.founder) return;

    const founder = this.content.founder;
    const imageHtml = founder.image 
      ? `<img src="${founder.image}" alt="${founder.name}">` 
      : '<div class="founder-placeholder">👤</div>';
    
    container.innerHTML = `
      <div class="founder-card">
        <div class="founder-image">
          ${imageHtml}
        </div>
        <div class="founder-info">
          <h3>${founder.name}</h3>
          <span class="founder-title-badge">${founder.title}</span>
          <p class="founder-bio">${founder.bio}</p>
        </div>
      </div>
    `;
  }

  // 渲染训练基地
  renderBases() {
    const container = document.getElementById('bases-grid');
    if (!container || !this.content.bases) return;

    container.innerHTML = this.content.bases.map(base => {
      const imageHtml = base.image 
        ? `<img src="${base.image}" alt="${base.name}">` 
        : '<div class="base-placeholder">🏔️</div>';
      
      return `
        <div class="base-card">
          <div class="base-image">
            ${imageHtml}
          </div>
          <div class="base-info">
            <h3>${base.name}</h3>
            <p>${base.description}</p>
          </div>
        </div>
      `;
    }).join('');
  }

  // 渲染优秀队员
  renderAthletes() {
    const container = document.getElementById('athletes-grid');
    if (!container || !this.content.athletes) return;

    container.innerHTML = this.content.athletes.map(athlete => {
      const imageHtml = athlete.image 
        ? `<img src="${athlete.image}" alt="${athlete.name}">` 
        : '<div class="athlete-placeholder">🎿</div>';
      
      const videoLink = athlete.video ? `<a href="${athlete.video}" target="_blank" class="video-link" title="点击观看视频">🎬</a>` : '';
      
      return `
        <div class="athlete-card">
          <div class="athlete-image">
            ${imageHtml}
            ${videoLink}
          </div>
          <h4>${athlete.name}</h4>
          <span class="athlete-level">${athlete.level}</span>
        </div>
      `;
    }).join('');

    // 更新统计数据
    const level1Count = this.content.athletes.filter(a => a.level.includes('一级')).length;
    const level2Count = this.content.athletes.filter(a => a.level.includes('二级')).length;

    const level1El = document.getElementById('level1-count');
    const level2El = document.getElementById('level2-count');
    
    if (level1El) level1El.textContent = level1Count;
    if (level2El) level2El.textContent = level2Count;
  }

  // 渲染菜单导航
  renderMenu() {
    const container = document.getElementById('menu-grid');
    if (!container || !this.content.menu) return;

    var menu = this.content.menu || [];
    var lotteryItem = null;
    var otherItems = [];
    
    // Separate lottery item
    menu.forEach(function(item) {
      if (item.title === '抽奖活动') {
        lotteryItem = item;
      } else {
        otherItems.push(item);
      }
    });
    
    // Render lottery as full-width banner first
    var lotteryHtml = '';
    if (lotteryItem) {
      lotteryHtml = `<a href="${lotteryItem.link}" class="menu-lottery-banner">
        <span class="lottery-icon">${lotteryItem.icon}</span>
        <span class="lottery-title">${lotteryItem.title}</span>
        <span class="lottery-hint">点击参与 →</span>
      </a>`;
    }
    
    // Render other menu items
    var menuHtml = otherItems.map(function(item) {
      return `<a href="${item.link}" class="menu-item">
        <span class="menu-icon">${item.icon}</span>
        <span class="menu-title">${item.title}</span>
      </a>`;
    }).join('');
    
    container.innerHTML = lotteryHtml + menuHtml;
  }

  // 平滑滚动
  initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
          target.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });
        }
      });
    });
  }

  showError() {
    document.body.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; text-align: center; padding: 20px;">
        <div>
          <h1 style="color: #0A5CFF; margin-bottom: 16px;">⚠️ 网站加载失败</h1>
          <p style="color: #666;">请确保在服务器环境中运行本项目</p>
        </div>
      </div>
    `;
  }

  updateNavUserInfo() {
    var userStr = localStorage.getItem('ski_user');
    var navUserAvatar = document.getElementById('nav-user-avatar');
    var navUserName = document.getElementById('nav-user-name');
    if (!navUserAvatar || !navUserName) return;
    if (userStr) {
      try {
        var user = JSON.parse(userStr);
        var name = user.name || '用户';
        var avatar = user.avatar && (user.avatar.startsWith('http') || user.avatar.startsWith('data:')) ? user.avatar : '';
        if (avatar) {
          navUserAvatar.innerHTML = '<img src="' + avatar + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">';
        } else {
          navUserAvatar.textContent = user.avatar || '👤';
        }
        navUserName.textContent = name;
      } catch (e) {
        navUserAvatar.textContent = '👤';
        navUserName.textContent = '我的';
      }
    } else {
      navUserAvatar.textContent = '👤';
      navUserName.textContent = '我的';
    }
  }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  const website = new SkiClubWebsite();
  website.init();
  website.updateNavUserInfo();
});
