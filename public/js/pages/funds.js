// ========== 基金列表页 ==========

const FundsPage = {
  currentType: 'all',
  currentSort: '1nzf',
  currentOrder: 'desc',
  page: 1,
  loading: false,
  allLoaded: false,
  fundTypeMap: {},

  async render() {
    const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
    this.currentType = params.get('type') || 'all';

    const container = document.getElementById('mainContent');
    container.innerHTML = `
      <div class="page funds-page">
        <div class="fund-type-tabs" id="fundTypeTabs">
          ${this.getTypeTabs()}
        </div>
        <div class="fund-sort-bar" id="fundSortBar">
          <button class="sort-btn active" data-sort="1nzf">近1年 <i class="fas fa-sort-down"></i></button>
          <button class="sort-btn" data-sort="3yzf">近3月</button>
          <button class="sort-btn" data-sort="1yzf">近1月</button>
          <button class="sort-btn" data-sort="jzzzl">日涨幅</button>
          <button class="sort-btn" data-sort="zzf">总收益</button>
        </div>
        <div class="fund-list" id="fundList">
          <div class="loading-row"><i class="fas fa-spinner fa-pulse"></i> 加载基金数据...</div>
        </div>
        <div class="list-footer" id="listFooter"></div>
      </div>
    `;

    this.bindEvents();
    this.page = 1;
    this.allLoaded = false;
    this.loadFunds(true);
  },

  getTypeTabs() {
    const types = [
      { key: 'all', label: '全部' }, { key: 'gp', label: '股票型' },
      { key: 'hh', label: '混合型' }, { key: 'zq', label: '债券型' },
      { key: 'hb', label: '货币型' }, { key: 'zs', label: '指数型' },
      { key: 'QDII', label: 'QDII' }, { key: 'FOF', label: 'FOF' },
    ];
    return types.map(t =>
      `<button class="type-tab ${t.key === this.currentType ? 'active' : ''}" data-type="${t.key}">${t.label}</button>`
    ).join('');
  },

  async loadFunds(reset = false) {
    if (this.loading || this.allLoaded) return;
    this.loading = true;

    const listEl = document.getElementById('fundList');
    const footerEl = document.getElementById('listFooter');
    if (!listEl) return;

    if (reset) {
      listEl.innerHTML = '<div class="loading-row"><i class="fas fa-spinner fa-pulse"></i> 加载基金数据...</div>';
    }

    try {
      const data = await API.getRanking({
        type: this.currentType,
        sort: this.currentSort,
        order: this.currentOrder,
        page: this.page,
        pageSize: 30
      });

      if (!data || !data.list || data.list.length === 0) {
        if (reset) { listEl.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i> 暂无数据</div>'; }
        this.allLoaded = true;
        if (footerEl) footerEl.innerHTML = '<div class="list-end">已加载全部</div>';
        return;
      }

      const items = data.list.map(f => {
        const ret = fmtReturn(f[this.currentSort === 'jzzzl' ? 'dayReturn' :
                              this.currentSort === '1nzf' ? 'yearReturn' :
                              this.currentSort === '3yzf' ? 'quarterReturn' :
                              this.currentSort === '1yzf' ? 'monthReturn' : 'totalReturn']);
        return `
          <a class="fund-item" href="#fund/${f.code}">
            <div class="fund-item-left">
              <div class="fund-item-name">${f.name}</div>
              <div class="fund-item-code">${f.code} · 净值 ${fmtNum(f.unitNav)}</div>
            </div>
            <div class="fund-item-right">
              <div class="fund-item-return ${ret.cls}">${ret.text}</div>
              <div class="fund-item-date">${fmtDate(f.navDate)}</div>
            </div>
          </a>
        `;
      }).join('');

      if (reset) {
        listEl.innerHTML = items;
      } else {
        listEl.insertAdjacentHTML('beforeend', items);
      }

      // 异步加载实时估值标记
      this.loadRealTimeTags();

      this.page++;
      if (data.total && (this.page - 1) * 30 >= data.total) {
        this.allLoaded = true;
        if (footerEl) footerEl.innerHTML = '<div class="list-end">已加载全部</div>';
      } else {
        if (footerEl) footerEl.innerHTML = '<div class="load-more" id="loadMoreBtn">加载更多</div>';
      }
    } catch (e) {
      if (reset) {
        listEl.innerHTML = '<div class="error-state"><i class="fas fa-exclamation-circle"></i> 加载失败，点击重试</div>';
      }
    } finally {
      this.loading = false;
    }
  },

  async loadRealTimeTags() {
    try {
      const items = document.querySelectorAll('#fundList .fund-item');
      const codes = Array.from(items).map(el => el.href.split('/').pop()).filter(Boolean);
      if (codes.length === 0) return;

      const gzList = await API.getBatchGZ(codes);
      if (!gzList || gzList.length === 0) return;

      const gzMap = {};
      gzList.forEach(g => { gzMap[g.code] = g; });

      items.forEach(el => {
        const code = el.href.split('/').pop();
        const gz = gzMap[code];
        if (!gz || gz.estimatedChange === undefined) return;

        const cls = gz.estimatedChange > 0 ? 'up' : gz.estimatedChange < 0 ? 'down' : 'flat';
        const sign = gz.estimatedChange > 0 ? '+' : '';
        const tag = document.createElement('span');
        tag.className = 'rt-tag ' + cls;
        tag.textContent = `估${sign}${gz.estimatedChange.toFixed(2)}%`;
        el.querySelector('.fund-item-right').appendChild(tag);
      });
    } catch (e) { /* 实时估值非关键数据，静默失败 */ }
  },

  bindEvents() {
    // 类型切换
    const tabs = document.getElementById('fundTypeTabs');
    if (tabs) {
      tabs.addEventListener('click', (e) => {
        const btn = e.target.closest('.type-tab');
        if (!btn) return;
        tabs.querySelectorAll('.type-tab').forEach(t => t.classList.remove('active'));
        btn.classList.add('active');
        this.currentType = btn.dataset.type;
        this.page = 1;
        this.allLoaded = false;
        this.loadFunds(true);
      });
    }

    // 排序切换
    const sortBar = document.getElementById('fundSortBar');
    if (sortBar) {
      sortBar.addEventListener('click', (e) => {
        const btn = e.target.closest('.sort-btn');
        if (!btn) return;
        sortBar.querySelectorAll('.sort-btn').forEach(t => t.classList.remove('active'));
        btn.classList.add('active');
        this.currentSort = btn.dataset.sort;
        this.page = 1;
        this.allLoaded = false;
        this.loadFunds(true);
      });
    }

    // 加载更多
    const footer = document.getElementById('listFooter');
    if (footer) {
      footer.addEventListener('click', (e) => {
        if (e.target.closest('#loadMoreBtn')) {
          this.loadFunds();
        }
      });
    }
  }
};
