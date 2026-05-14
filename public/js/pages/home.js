// ========== 首页 ==========

const HomePage = {
  async render() {
    const container = document.getElementById('mainContent');
    container.innerHTML = `
      <div class="page home-page">
        <div class="market-overview" id="marketOverview">
          <div class="overview-loading"><i class="fas fa-spinner fa-pulse"></i> 加载市场数据...</div>
        </div>

        <div class="section">
          <h2 class="section-title"><i class="fas fa-th-large"></i> 基金类型</h2>
          <div class="type-grid" id="typeGrid">
            ${this.getTypeGridHTML()}
          </div>
        </div>

        <div class="section">
          <h2 class="section-title"><i class="fas fa-fire"></i> 热门基金</h2>
          <div class="hot-funds" id="hotFunds">
            <div class="loading-row"><i class="fas fa-spinner fa-pulse"></i> 加载热门基金...</div>
          </div>
        </div>

        <div class="section">
          <h2 class="section-title"><i class="fas fa-trophy"></i> 收益排行</h2>
          <div class="rank-tabs" id="rankTabs">
            <button class="rank-tab active" data-sort="1nzf">近1年</button>
            <button class="rank-tab" data-sort="3yzf">近3月</button>
            <button class="rank-tab" data-sort="1yzf">近1月</button>
            <button class="rank-tab" data-sort="zzf">总收益</button>
          </div>
          <div class="rank-list" id="rankList">
            <div class="loading-row"><i class="fas fa-spinner fa-pulse"></i> 加载排行...</div>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
    this.loadData('1nzf');
    this.loadHotFunds();
  },

  getTypeGridHTML() {
    const types = [
      { key: 'gp', label: '股票型', icon: 'fa-chart-line', color: '#e74c3c' },
      { key: 'hh', label: '混合型', icon: 'fa-blender', color: '#e67e22' },
      { key: 'zq', label: '债券型', icon: 'fa-shield-alt', color: '#2ecc71' },
      { key: 'hb', label: '货币型', icon: 'fa-coins', color: '#3498db' },
      { key: 'zs', label: '指数型', icon: 'fa-chart-simple', color: '#9b59b6' },
      { key: 'QDII', label: 'QDII', icon: 'fa-globe', color: '#1abc9c' },
      { key: 'FOF', label: 'FOF', icon: 'fa-layer-group', color: '#f39c12' },
      { key: 'all', label: '全部', icon: 'fa-list', color: '#95a5a6' },
    ];
    return types.map(t => `
      <a class="type-card" href="#funds?type=${t.key}" style="--type-color: ${t.color}">
        <div class="type-icon"><i class="fas ${t.icon}"></i></div>
        <div class="type-name">${t.label}</div>
      </a>
    `).join('');
  },

  async loadData(sort) {
    const rankList = document.getElementById('rankList');
    if (!rankList) return;
    rankList.innerHTML = '<div class="loading-row"><i class="fas fa-spinner fa-pulse"></i> 加载排行...</div>';

    try {
      const data = await API.getRanking({ type: 'all', sort, page: 1, pageSize: 20 });
      if (!data || !data.list || data.list.length === 0) {
        rankList.innerHTML = '<div class="empty-state">暂无数据</div>';
        return;
      }

      rankList.innerHTML = data.list.map((f, i) => {
        const ret = fmtReturn(f.yearReturn);
        return `
          <a class="rank-item" href="#fund/${f.code}">
            <span class="rank-num ${i < 3 ? 'top' : ''}">${i + 1}</span>
            <div class="rank-info">
              <div class="rank-name">${f.name}</div>
              <div class="rank-code">${f.code}</div>
            </div>
            <span class="rank-return ${ret.cls}">${ret.text}</span>
          </a>
        `;
      }).join('');
    } catch (e) {
      rankList.innerHTML = '<div class="error-state"><i class="fas fa-exclamation-circle"></i> 加载失败，下拉刷新重试</div>';
    }
  },

  async loadHotFunds() {
    const el = document.getElementById('hotFunds');
    if (!el) return;

    try {
      // 热门基金：取热门类型的涨幅榜前6
      const gp = await API.getRanking({ type: 'gp', sort: '1nzf', page: 1, pageSize: 3 });
      const hh = await API.getRanking({ type: 'hh', sort: '1nzf', page: 1, pageSize: 3 });
      const hotList = [...(gp?.list || []), ...(hh?.list || [])].slice(0, 6);

      if (hotList.length === 0) {
        el.innerHTML = '<div class="empty-state">暂无数据</div>';
        return;
      }

      el.innerHTML = hotList.map(f => {
        const ret = fmtReturn(f.dayReturn);
        return `
          <a class="hot-item" href="#fund/${f.code}">
            <div class="hot-name">${shortName(f.name)}</div>
            <div class="hot-return ${ret.cls}">${ret.text}</div>
          </a>
        `;
      }).join('');
    } catch (e) {
      el.innerHTML = '<div class="empty-state">暂无数据</div>';
    }
  },

  bindEvents() {
    const rankTabs = document.getElementById('rankTabs');
    if (rankTabs) {
      rankTabs.addEventListener('click', (e) => {
        const tab = e.target.closest('.rank-tab');
        if (!tab) return;
        rankTabs.querySelectorAll('.rank-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.loadData(tab.dataset.sort);
      });
    }
  }
};
