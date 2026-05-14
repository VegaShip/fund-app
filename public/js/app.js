// ========== SPA 路由 & 主应用 ==========

const App = {
  currentPage: '',
  currentParams: {},

  init() {
    this.handleRoute();
    window.addEventListener('hashchange', () => this.handleRoute());
    window.addEventListener('popstate', () => this.handleRoute());
  },

  handleRoute() {
    const hash = window.location.hash || '#home';
    const [page, ...rest] = hash.split('?');
    const route = page.replace('#', '') || 'home';
    const paramsStr = rest.join('?');

    this.currentPage = route;
    this.currentParams = new URLSearchParams(paramsStr);

    // 更新导航高亮
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.page === route || (route.startsWith('fund/') && item.dataset.page === 'funds'));
    });

    // 更新标题
    const titles = {
      home: '基金筛选', funds: '基金列表', screen: '基金筛选',
      compare: '基金对比', favorites: '我的自选', detail: '基金详情'
    };
    // 处理详情页标题
    const titleEl = document.getElementById('headerTitle');
    if (titleEl) {
      const routeBase = route.split('/')[0];
      titleEl.textContent = titles[routeBase] || '基金筛选';
    }

    // 显示/隐藏左侧按钮
    const headerLeft = document.getElementById('headerLeft');
    if (headerLeft) {
      if (route.startsWith('fund/')) {
        headerLeft.innerHTML = '<button class="header-btn" onclick="window.history.back()"><i class="fas fa-arrow-left"></i></button>';
      } else {
        headerLeft.innerHTML = '';
      }
    }

    // 渲染对应页面
    this.renderPage(route);
  },

  renderPage(route) {
    FundChart.destroyAll();
    // 清理详情页定时器
    if (DetailPage.destroy) DetailPage.destroy();

    if (route === 'home') {
      HomePage.render();
    } else if (route === 'funds') {
      FundsPage.render();
    } else if (route.startsWith('fund/')) {
      const code = route.split('/')[1];
      DetailPage.render(code);
    } else if (route === 'screen') {
      ScreenPage.render();
    } else if (route === 'compare') {
      ComparePage.render();
    } else if (route === 'favorites') {
      FavoritesPage.render();
    } else {
      document.getElementById('mainContent').innerHTML = '<div class="page"><div class="empty-state">页面未找到</div></div>';
    }
  },

  // 搜索开关
  toggleSearch() {
    const overlay = document.getElementById('searchOverlay');
    if (!overlay) return;
    const isHidden = overlay.classList.contains('hide');
    if (isHidden) {
      overlay.classList.remove('hide');
      document.getElementById('mainContent').classList.add('blur');
      document.getElementById('bottomNav').classList.add('blur');
      setTimeout(() => {
        const input = document.getElementById('searchInput');
        if (input) { input.focus(); input.value = ''; }
      }, 200);
      Search.clear();
      Search.init();
    } else {
      overlay.classList.add('hide');
      document.getElementById('mainContent').classList.remove('blur');
      document.getElementById('bottomNav').classList.remove('blur');
    }
  },

  // 清空搜索
  clearSearch() {
    Search.clear();
    const input = document.getElementById('searchInput');
    if (input) input.focus();
  }
};

// 页面刷新
function refreshCurrentPage() {
  App.handleRoute();
  showToast('已刷新');
}

// 启动
document.addEventListener('DOMContentLoaded', () => App.init());
