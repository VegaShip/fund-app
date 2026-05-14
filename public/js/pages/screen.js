// ========== 基金筛选页 ==========

const ScreenPage = {
  resultList: [],

  render() {
    const container = document.getElementById('mainContent');
    container.innerHTML = `
      <div class="page screen-page">
        <div class="screen-form">
          <div class="screen-group">
            <label class="screen-label">基金类型</label>
            <div class="screen-options" id="screenType">
              ${['全部','股票型','混合型','债券型','货币型','指数型','QDII','FOF','ETF联接'].map(t =>
                `<button class="screen-opt ${t === '全部' ? 'active' : ''}" data-value="${t}">${t}</button>`
              ).join('')}
            </div>
          </div>

          <div class="screen-group">
            <label class="screen-label">近1年收益率</label>
            <div class="screen-options" id="screenYearReturn">
              ${[
                { label: '全部', value: 'all' },
                { label: '> 50%', value: '50-999' },
                { label: '30% ~ 50%', value: '30-50' },
                { label: '10% ~ 30%', value: '10-30' },
                { label: '0% ~ 10%', value: '0-10' },
                { label: '< 0%', value: '-999-0' },
              ].map(r =>
                `<button class="screen-opt ${r.value === 'all' ? 'active' : ''}" data-value="${r.value}">${r.label}</button>`
              ).join('')}
            </div>
          </div>

          <div class="screen-group">
            <label class="screen-label">日涨幅</label>
            <div class="screen-options" id="screenDayReturn">
              ${[
                { label: '全部', value: 'all' },
                { label: '涨', value: '0.01-999' },
                { label: '跌', value: '-999--0.01' },
                { label: '大涨 > 3%', value: '3-999' },
                { label: '大跌 < -3%', value: '-999--3' },
              ].map(r =>
                `<button class="screen-opt ${r.value === 'all' ? 'active' : ''}" data-value="${r.value}">${r.label}</button>`
              ).join('')}
            </div>
          </div>

          <button class="screen-submit" id="screenSubmit">
            <i class="fas fa-search"></i> 开始筛选
          </button>
        </div>

        <div class="screen-results" id="screenResults" style="display:none">
          <h3 class="section-subtitle">筛选结果 <span id="resultCount">0</span> 只基金</h3>
          <div class="fund-list" id="screenResultList"></div>
        </div>
      </div>
    `;

    this.bindEvents();
  },

  async doScreen() {
    showLoading('筛选中...');
    const submitBtn = document.getElementById('screenSubmit');
    if (submitBtn) submitBtn.disabled = true;

    try {
      // 获取筛选条件
      const typeEl = document.querySelector('#screenType .screen-opt.active');
      const yearEl = document.querySelector('#screenYearReturn .screen-opt.active');
      const dayEl = document.querySelector('#screenDayReturn .screen-opt.active');

      const type = typeEl ? typeEl.dataset.value : '全部';
      const yearRange = (yearEl ? yearEl.dataset.value : 'all').split('-');
      const dayRange = (dayEl ? dayEl.dataset.value : 'all').split('-');

      // 获取排行数据
      const data = await API.getRanking({ type: 'all', sort: '1nzf', page: 1, pageSize: 5000 });

      if (!data || !data.list) {
        showToast('暂无数据');
        return;
      }

      let list = data.list;

      // 按类型筛选
      if (type !== '全部') {
        list = list.filter(f => f.name && f.name.includes(type));
      }

      // 按收益率筛选
      if (yearRange.length === 2 && yearRange[0] !== 'all') {
        const minY = parseFloat(yearRange[0]);
        const maxY = parseFloat(yearRange[1]);
        list = list.filter(f => f.yearReturn !== null && f.yearReturn >= minY && f.yearReturn <= maxY);
      }

      if (dayRange.length === 2 && dayRange[0] !== 'all') {
        const minD = parseFloat(dayRange[0]);
        const maxD = parseFloat(dayRange[1]);
        list = list.filter(f => f.dayReturn !== null && f.dayReturn >= minD && f.dayReturn <= maxD);
      }

      this.resultList = list;

      // 显示结果
      const resultsEl = document.getElementById('screenResults');
      const listEl = document.getElementById('screenResultList');
      const countEl = document.getElementById('resultCount');

      if (resultsEl) resultsEl.style.display = 'block';
      if (countEl) countEl.textContent = list.length;

      if (list.length === 0) {
        if (listEl) listEl.innerHTML = '<div class="empty-state"><i class="fas fa-search"></i> 没有符合条件的结果</div>';
      } else {
        if (listEl) {
          listEl.innerHTML = list.slice(0, 100).map(f => {
            const yr = fmtReturn(f.yearReturn);
            const dr = fmtReturn(f.dayReturn);
            return `
              <a class="fund-item" href="#fund/${f.code}">
                <div class="fund-item-left">
                  <div class="fund-item-name">${f.name}</div>
                  <div class="fund-item-code">${f.code}</div>
                </div>
                <div class="fund-item-right">
                  <div class="fund-item-return ${yr.cls}">${yr.text}</div>
                  <div class="fund-item-date">日 ${dr.cls ? dr.text : '--'}</div>
                </div>
              </a>
            `;
          }).join('');
        }
      }
    } catch (e) {
      showToast('筛选失败: ' + e.message);
    } finally {
      hideLoading();
      if (submitBtn) submitBtn.disabled = false;
    }
  },

  bindEvents() {
    // 选项切换
    document.querySelectorAll('.screen-options').forEach(group => {
      group.addEventListener('click', (e) => {
        const opt = e.target.closest('.screen-opt');
        if (!opt) return;
        group.querySelectorAll('.screen-opt').forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
      });
    });

    // 筛选按钮
    const submitBtn = document.getElementById('screenSubmit');
    if (submitBtn) {
      submitBtn.addEventListener('click', () => this.doScreen());
    }
  }
};
