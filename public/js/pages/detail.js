// ========== 基金详情页 ==========

const DetailPage = {
  code: '',
  navData: [],

  async render(code) {
    this.code = code;
    const container = document.getElementById('mainContent');
    container.innerHTML = `
      <div class="page detail-page">
        <div class="detail-header" id="detailHeader">
          <div class="loading-row"><i class="fas fa-spinner fa-pulse"></i> 加载基金详情...</div>
        </div>
        <div class="detail-body" id="detailBody" style="display:none">
          <!-- 实时估值卡片 -->
          <div class="real-time-card" id="realTimeCard" style="display:none">
            <div class="real-time-header">
              <span class="real-time-title"><i class="fas fa-chart-line"></i> 实时估值</span>
              <span class="real-time-badge" id="rtBadge">盘中</span>
            </div>
            <div class="real-time-body">
              <div class="rt-main">
                <div class="rt-estimate">
                  <div class="rt-label">估算净值</div>
                  <div class="rt-value" id="rtEstNav">--</div>
                </div>
                <div class="rt-change" id="rtChange">
                  <div class="rt-change-value">--</div>
                  <div class="rt-change-arrow" id="rtArrow"><i class="fas fa-minus"></i></div>
                </div>
              </div>
              <div class="rt-details">
                <div class="rt-detail-item">
                  <span class="rt-detail-label">昨收净值</span>
                  <span class="rt-detail-value" id="rtUnitNav">--</span>
                </div>
                <div class="rt-detail-item">
                  <span class="rt-detail-label">净值日期</span>
                  <span class="rt-detail-value" id="rtNavDate">--</span>
                </div>
                <div class="rt-detail-item">
                  <span class="rt-detail-label">估算时间</span>
                  <span class="rt-detail-value" id="rtTime">--</span>
                </div>
              </div>
              <div class="rt-signal" id="rtSignal">
                <i class="fas fa-lightbulb"></i>
                <span id="rtSignalText">--</span>
              </div>
            </div>
            <div class="real-time-footer" id="rtFooter">
              <span class="rt-refresh"><i class="fas fa-sync-alt"></i> 自动刷新中</span>
            </div>
          </div>

          <div class="detail-nav-section">
            <div class="nav-chart-container">
              <canvas id="navChart"></canvas>
            </div>
            <div class="period-selector" id="periodSelector">
              <button class="period-btn active" data-days="365">近1年</button>
              <button class="period-btn" data-days="90">近3月</button>
              <button class="period-btn" data-days="30">近1月</button>
              <button class="period-btn" data-days="0">全部</button>
            </div>
          </div>

          <div class="detail-returns" id="detailReturns"></div>

          <div class="return-chart-container">
            <h3 class="section-subtitle">各区间收益率</h3>
            <canvas id="returnChart"></canvas>
          </div>

          <div class="detail-info" id="detailInfo"></div>

          <div class="detail-holdings" id="detailHoldings">
            <h3 class="section-subtitle"><i class="fas fa-briefcase"></i> 前十大持仓</h3>
            <div class="loading-row"><i class="fas fa-spinner fa-pulse"></i> 加载持仓...</div>
          </div>
        </div>
      </div>
    `;

    await this.loadDetail();
    this.bindEvents();
  },

  async loadDetail() {
    try {
      const detail = await API.getFundDetail(this.code);
      if (!detail || !detail.info) throw new Error('No data');

      // 显示头部
      this.renderHeader(detail.info);

      // 净值数据
      this.navData = detail.navHistory || [];

      // 计算收益率
      const returns = Calculator.calcReturns(this.navData);
      this.renderReturns(returns);
      this.renderInfo(detail.info, returns);

      // 渲染图表
      setTimeout(() => {
        FundChart.createNavChart('navChart', this.navData, { days: 365 });
        FundChart.createReturnChart('returnChart', returns);
      }, 100);

      // 显示内容
      document.getElementById('detailBody').style.display = 'block';

      // 加载持仓
      this.loadHoldings();

      // 加载实时估值
      this.loadRealTime();

    } catch (e) {
      console.error('Detail load error:', e);
      const header = document.getElementById('detailHeader');
      if (header) header.innerHTML = '<div class="error-state"><i class="fas fa-exclamation-circle"></i> 基金数据加载失败</div>';
    }
  },

  renderHeader(info) {
    const header = document.getElementById('detailHeader');
    if (!header) return;

    const isFav = (storageGet('favorites') || []).includes(this.code);
    header.innerHTML = `
      <div class="detail-title-row">
        <div>
          <h2 class="detail-name">${info.name || info.fullName || this.code}</h2>
          <div class="detail-code-row">
            <span class="detail-code">${this.code}</span>
            <span class="detail-type-tag" style="background:${getTypeColor(info.type) || '#95a5a6'}">${info.type || '--'}</span>
            ${info.riskLevel ? `<span class="detail-risk" style="color:${getRiskColor(info.riskLevel)}">${info.riskLevel}</span>` : ''}
          </div>
        </div>
        <button class="fav-btn ${isFav ? 'active' : ''}" onclick="DetailPage.toggleFav()">
          <i class="fas ${isFav ? 'fa-star' : 'fa-star-o'}"></i>
        </button>
      </div>
      ${info.establishDate ? `<div class="detail-establish">成立日: ${info.establishDate}</div>` : ''}
      ${info.fundScale ? `<div class="detail-scale">规模: ${info.fundScale}</div>` : ''}
    `;
  },

  renderReturns(ret) {
    const el = document.getElementById('detailReturns');
    if (!el) return;

    const items = [
      { label: '日收益率', key: 'dayReturn' },
      { label: '近1周', key: 'weekReturn' },
      { label: '近1月', key: 'monthReturn' },
      { label: '近3月', key: 'quarterReturn' },
      { label: '近6月', key: 'halfYearReturn' },
      { label: '近1年', key: 'yearReturn' },
      { label: '近3年', key: 'threeYearReturn' },
      { label: '成立以来', key: 'totalReturn' },
    ];

    el.innerHTML = `<div class="returns-grid">
      ${items.map(item => {
        const val = ret[item.key];
        const f = fmtReturn(val);
        return `
          <div class="return-card ${item.key === 'dayReturn' ? 'highlight' : ''}">
            <div class="return-label">${item.label}</div>
            <div class="return-value ${f.cls}">${f.text}</div>
          </div>
        `;
      }).join('')}
      ${ret.annualized !== null ? `
        <div class="return-card highlight">
          <div class="return-label">年化收益</div>
          <div class="return-value ${fmtReturn(ret.annualized).cls}">${fmtReturn(ret.annualized).text}</div>
        </div>
      ` : ''}
    </div>`;
  },

  renderInfo(info, ret) {
    const el = document.getElementById('detailInfo');
    if (!el) return;

    el.innerHTML = `
      <h3 class="section-subtitle"><i class="fas fa-info-circle"></i> 基金信息</h3>
      <div class="info-grid">
        <div class="info-item">
          <span class="info-label">最新净值</span>
          <span class="info-value">${fmtNum(ret.currentNav, 4)}</span>
        </div>
        <div class="info-item">
          <span class="info-label">累计净值</span>
          <span class="info-value">${fmtNum(ret.accumNav, 4)}</span>
        </div>
        <div class="info-item">
          <span class="info-label">净值日期</span>
          <span class="info-value">${ret.navDate || '--'}</span>
        </div>
        <div class="info-item">
          <span class="info-label">基金经理</span>
          <span class="info-value">${info.fundManager || '--'}</span>
        </div>
      </div>
    `;
  },

  async loadHoldings() {
    const el = document.getElementById('detailHoldings');
    if (!el) return;

    try {
      const data = await API.getHoldings(this.code);
      if (!data || !data.holdings || data.holdings.length === 0) {
        el.innerHTML = '<h3 class="section-subtitle"><i class="fas fa-briefcase"></i> 前十大持仓</h3><div class="empty-state">暂无持仓数据</div>';
        return;
      }

      const maxRatio = Math.max(...data.holdings.map(h => h.ratio));
      el.innerHTML = `
        <h3 class="section-subtitle"><i class="fas fa-briefcase"></i> 前十大持仓 <small>${data.reportDate || ''}</small></h3>
        <div class="holdings-list">
          ${data.holdings.map(h => `
            <div class="holding-item">
              <div class="holding-name">${h.name}</div>
              <div class="holding-bar-wrap">
                <div class="holding-bar" style="width:${(h.ratio / maxRatio) * 100}%"></div>
              </div>
              <div class="holding-ratio">${fmtNum(h.ratio, 2)}%</div>
            </div>
          `).join('')}
        </div>
      `;
    } catch (e) {
      el.innerHTML = '<h3 class="section-subtitle"><i class="fas fa-briefcase"></i> 前十大持仓</h3><div class="empty-state">持仓数据暂不可用</div>';
    }
  },

  async loadRealTime() {
    const card = document.getElementById('realTimeCard');
    if (!card) return;

    // 先显示卡片
    card.style.display = 'block';
    card.innerHTML = '<div class="loading-row"><i class="fas fa-spinner fa-pulse"></i> 加载实时估值...</div>';

    try {
      const gz = await API.getRealTimeGZ(this.code);
      if (!gz || gz.estimatedChange === undefined) {
        card.style.display = 'none';
        return;
      }

      const isUp = gz.estimatedChange > 0;
      const isDown = gz.estimatedChange < 0;
      const cls = isUp ? 'up' : isDown ? 'down' : 'flat';
      const arrow = isUp ? 'fa-arrow-up' : isDown ? 'fa-arrow-down' : 'fa-minus';

      // 计算估算涨跌额
      const changeAmount = gz.estimatedNav - gz.unitNav;
      const changeAmountText = (changeAmount >= 0 ? '+' : '') + changeAmount.toFixed(4);

      // 买卖参考信号
      let signalIcon, signalText, signalCls;
      if (gz.estimatedChange <= -2) {
        signalIcon = 'fa-exclamation-triangle';
        signalText = '今日跌幅较大，若看好长期趋势可考虑分批买入';
        signalCls = 'signal-buy';
      } else if (gz.estimatedChange <= -0.5) {
        signalIcon = 'fa-arrow-down';
        signalText = '估值下跌，可关注逢低布局机会';
        signalCls = 'signal-buy';
      } else if (gz.estimatedChange < 0.5) {
        signalIcon = 'fa-minus-circle';
        signalText = '今日波动较小，建议观望';
        signalCls = 'signal-hold';
      } else if (gz.estimatedChange < 2) {
        signalIcon = 'fa-arrow-up';
        signalText = '估值上涨，持有观察，注意短期回调风险';
        signalCls = 'signal-sell';
      } else {
        signalIcon = 'fa-exclamation-triangle';
        signalText = '今日涨幅较大，可考虑适当止盈';
        signalCls = 'signal-sell';
      }

      // 改为前收盘净值 > 0 才显示为"盘中", QDII等显示"参考"
      const isTrading = Math.abs(gz.estimatedChange) > 0;

      card.innerHTML = `
        <div class="real-time-header">
          <span class="real-time-title"><i class="fas fa-chart-line"></i> 实时估值</span>
          <span class="real-time-badge ${cls}" id="rtBadge">${isTrading ? '盘中' : '参考'}</span>
        </div>
        <div class="real-time-body">
          <div class="rt-main">
            <div class="rt-estimate">
              <div class="rt-label">估算净值</div>
              <div class="rt-value ${cls}" id="rtEstNav">${gz.estimatedNav.toFixed(4)}</div>
            </div>
            <div class="rt-change ${cls}" id="rtChange">
              <div class="rt-change-value">${fmtReturn(gz.estimatedChange).text}</div>
              <div class="rt-change-arrow" id="rtArrow"><i class="fas ${arrow}"></i></div>
              <div class="rt-change-amount">${changeAmountText}</div>
            </div>
          </div>
          <div class="rt-details">
            <div class="rt-detail-item">
              <span class="rt-detail-label">昨收净值</span>
              <span class="rt-detail-value" id="rtUnitNav">${gz.unitNav.toFixed(4)}</span>
            </div>
            <div class="rt-detail-item">
              <span class="rt-detail-label">净值日期</span>
              <span class="rt-detail-value" id="rtNavDate">${gz.navDate || '--'}</span>
            </div>
            <div class="rt-detail-item">
              <span class="rt-detail-label">估算时间</span>
              <span class="rt-detail-value" id="rtTime">${gz.estimateTime || '--'}</span>
            </div>
          </div>
          <div class="rt-signal ${signalCls}" id="rtSignal">
            <i class="fas ${signalIcon}"></i>
            <span id="rtSignalText">${signalText}</span>
          </div>
        </div>
        <div class="real-time-footer" id="rtFooter">
          <span class="rt-refresh"><i class="fas fa-sync-alt"></i> 自动刷新中</span>
        </div>
      `;

      // 每隔30秒自动刷新实时估值
      if (this._rtTimer) clearTimeout(this._rtTimer);
      if (isTrading) {
        this._rtTimer = setTimeout(() => this.loadRealTime(), 30000);
      } else {
        // 非交易时段每5分钟检查一次
        this._rtTimer = setTimeout(() => this.loadRealTime(), 300000);
      }

    } catch (e) {
      card.style.display = 'none';
    }
  },

  // 页面离开时清除定时器
  destroy() {
    if (this._rtTimer) {
      clearTimeout(this._rtTimer);
      this._rtTimer = null;
    }
  },

  toggleFav() {
    let favs = storageGet('favorites') || [];
    const idx = favs.indexOf(this.code);
    const btn = document.querySelector('.fav-btn');
    if (idx >= 0) {
      favs.splice(idx, 1);
      if (btn) { btn.classList.remove('active'); btn.innerHTML = '<i class="fas fa-star-o"></i>'; }
      showToast('已取消自选');
    } else {
      favs.push(this.code);
      if (btn) { btn.classList.add('active'); btn.innerHTML = '<i class="fas fa-star"></i>'; }
      showToast('已添加自选');
    }
    storageSet('favorites', favs);
  },

  bindEvents() {
    const periodSelector = document.getElementById('periodSelector');
    if (periodSelector) {
      periodSelector.addEventListener('click', (e) => {
        const btn = e.target.closest('.period-btn');
        if (!btn) return;
        periodSelector.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const days = parseInt(btn.dataset.days);
        FundChart.createNavChart('navChart', this.navData, { days: days || undefined });
      });
    }
  }
};
