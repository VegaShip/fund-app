// ========== 自选页面 ==========

const FavoritesPage = {
  async render() {
    const container = document.getElementById('mainContent');
    container.innerHTML = `
      <div class="page favorites-page">
        <div class="fav-list" id="favList">
          <div class="loading-row"><i class="fas fa-spinner fa-pulse"></i> 加载自选基金...</div>
        </div>
      </div>
    `;

    await this.loadFavorites();
  },

  async loadFavorites() {
    const listEl = document.getElementById('favList');
    if (!listEl) return;

    const codes = storageGet('favorites') || [];

    if (codes.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state" style="margin-top:60px">
          <i class="fas fa-star" style="font-size:48px;color:#ddd;display:block;margin-bottom:16px"></i>
          还没有自选基金<br>在基金详情页点击星星添加
        </div>
      `;
      return;
    }

    listEl.innerHTML = '';

    for (const code of codes) {
      try {
        const detail = await API.getFundDetail(code);
        const ret = Calculator.calcReturns(detail?.navHistory || []);
        const r = fmtReturn(ret.dayReturn);

        const item = document.createElement('a');
        item.className = 'fund-item';
        item.href = `#fund/${code}`;
        item.innerHTML = `
          <div class="fund-item-left">
            <div class="fund-item-name">${detail?.info?.name || code}</div>
            <div class="fund-item-code">${code}</div>
          </div>
          <div class="fund-item-right">
            <div class="fund-item-return ${r.cls}">${r.text}</div>
            <div class="fund-item-date">净值 ${fmtNum(ret.currentNav, 4)}</div>
          </div>
        `;
        listEl.appendChild(item);
      } catch (e) {
        // 单个基金加载失败不影响其他
        const item = document.createElement('a');
        item.className = 'fund-item';
        item.href = `#fund/${code}`;
        item.innerHTML = `
          <div class="fund-item-left">
            <div class="fund-item-name">${code}</div>
            <div class="fund-item-code">数据加载失败</div>
          </div>
        `;
        listEl.appendChild(item);
      }
    }
  }
};
