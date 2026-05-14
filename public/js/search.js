// ========== 搜索功能 ==========

const Search = {
  timer: null,
  lastQuery: '',

  init() {
    const input = document.getElementById('searchInput');
    if (!input) return;

    input.addEventListener('input', () => {
      const q = input.value.trim();
      if (q === this.lastQuery) return;
      this.lastQuery = q;

      clearTimeout(this.timer);
      const hint = document.querySelector('.search-hint');
      const results = document.getElementById('searchResults');

      if (!q) {
        if (results) results.innerHTML = '<div class="search-hint"><i class="fas fa-search"></i> 输入基金代码或名称搜索</div>';
        return;
      }

      if (q.length < 1) return;

      // 显示加载
      if (results) results.innerHTML = '<div class="search-loading"><i class="fas fa-spinner fa-pulse"></i> 搜索中...</div>';

      this.timer = setTimeout(() => this.doSearch(q), 300);
    });

    // 关闭搜索
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') App.toggleSearch();
    });
  },

  async doSearch(q) {
    try {
      const data = await API.search(q);
      const results = document.getElementById('searchResults');
      if (!results) return;

      if (!data || !data.list || data.list.length === 0) {
        results.innerHTML = '<div class="search-empty"><i class="fas fa-inbox"></i> 未找到匹配的基金</div>';
        return;
      }

      results.innerHTML = data.list.map(f => {
        const codeMatch = f.code.includes(q);
        const nameMatch = f.name.toUpperCase().includes(q.toUpperCase());
        return `
          <a class="search-result-item" href="#fund/${f.code}" onclick="App.toggleSearch()">
            <div class="search-result-left">
              <div class="search-result-name">${this.highlight(f.name, q)}</div>
              <div class="search-result-code">
                <span class="search-result-code-text">${codeMatch ? this.highlight(f.code, q) : f.code}</span>
                <span class="search-result-type" style="background:${getTypeColor(f.typeLabel)}">${f.typeLabel}</span>
              </div>
            </div>
            <i class="fas fa-chevron-right search-result-arrow"></i>
          </a>
        `;
      }).join('');
    } catch (e) {
      const results = document.getElementById('searchResults');
      if (results) results.innerHTML = '<div class="search-empty"><i class="fas fa-exclamation-circle"></i> 搜索失败，请重试</div>';
    }
  },

  highlight(text, keyword) {
    if (!keyword || !text) return text;
    const idx = text.toUpperCase().indexOf(keyword.toUpperCase());
    if (idx < 0) return text;
    return text.substring(0, idx) +
      '<em>' + text.substring(idx, idx + keyword.length) + '</em>' +
      text.substring(idx + keyword.length);
  },

  clear() {
    const input = document.getElementById('searchInput');
    if (input) { input.value = ''; this.lastQuery = ''; }
    const results = document.getElementById('searchResults');
    if (results) results.innerHTML = '<div class="search-hint"><i class="fas fa-search"></i> 输入基金代码或名称搜索</div>';
  }
};
