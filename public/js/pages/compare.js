// ========== 基金对比页 ==========

const ComparePage = {
  funds: [],
  maxCompare: 4,
  searchTimer: null,

  render() {
    const container = document.getElementById('mainContent');
    container.innerHTML = `
      <div class="page compare-page">
        <div class="compare-search">
          <div class="compare-input-wrap">
            <div class="compare-search-field">
              <input type="text" id="compareInput" placeholder="输入基金名称或代码搜索，如 白酒、161725" class="compare-input" autocomplete="off">
              <div class="compare-dropdown" id="compareDropdown" style="display:none"></div>
            </div>
          </div>
          <div class="compare-tips">最多添加4只基金进行对比，支持名称或代码搜索</div>
        </div>
        <div class="compare-selected" id="compareSelected">
          <div class="empty-state" style="padding: 20px"><i class="fas fa-exchange-alt"></i> 搜索并添加基金开始对比</div>
        </div>
        <div class="compare-results" id="compareResults" style="display:none"></div>
      </div>
    `;

    this.bindEvents();
  },

  async addFundBySearch(code, name) {
    if (this.funds.length >= this.maxCompare) {
      showToast(`最多对比${this.maxCompare}只基金`);
      return;
    }
    if (this.funds.find(f => f.code === code)) {
      showToast('该基金已添加');
      return;
    }

    try {
      showLoading('加载基金...');
      const detail = await API.getFundDetail(code);
      if (!detail || !detail.info) throw new Error('未找到该基金');

      this.funds.push({
        code,
        name: detail.info.name || name || code,
        info: detail.info,
        navHistory: detail.navHistory || [],
      });

      // 清空输入和下拉
      const input = document.getElementById('compareInput');
      if (input) { input.value = ''; }
      this.hideDropdown();

      this.renderSelected();
      this.renderComparison();
      hideLoading();
    } catch (e) {
      hideLoading();
      showToast('加载基金数据失败');
    }
  },

  async doSearch(q) {
    const dropdown = document.getElementById('compareDropdown');
    if (!dropdown) return;

    if (!q || q.length < 1) {
      this.hideDropdown();
      return;
    }

    try {
      const data = await API.search(q);
      if (!data || !data.list || data.list.length === 0) {
        dropdown.innerHTML = '<div class="compare-dropdown-empty">未找到匹配的基金</div>';
        dropdown.style.display = 'block';
        return;
      }

      dropdown.innerHTML = data.list.map(f => {
        const isAdded = this.funds.find(ff => ff.code === f.code);
        return `
          <div class="compare-dropdown-item ${isAdded ? 'disabled' : ''}" data-code="${f.code}" data-name="${f.name}">
            <div class="dropdown-item-left">
              <div class="dropdown-item-name">${f.name}</div>
              <div class="dropdown-item-code">
                <span>${f.code}</span>
                <span class="search-result-type" style="background:${getTypeColor(f.typeLabel)};padding:1px 6px;border-radius:8px;font-size:10px;color:#fff;margin-left:6px">${f.typeLabel}</span>
              </div>
            </div>
            ${isAdded ? '<span class="dropdown-item-added">已添加</span>' : '<i class="fas fa-plus-circle dropdown-item-add"></i>'}
          </div>
        `;
      }).join('');
      dropdown.style.display = 'block';

      // 绑定点击事件
      dropdown.querySelectorAll('.compare-dropdown-item:not(.disabled)').forEach(el => {
        el.addEventListener('click', () => {
          const code = el.dataset.code;
          const name = el.dataset.name;
          this.addFundBySearch(code, name);
        });
      });
    } catch (e) {
      dropdown.innerHTML = '<div class="compare-dropdown-empty">搜索失败</div>';
      dropdown.style.display = 'block';
    }
  },

  hideDropdown() {
    const dropdown = document.getElementById('compareDropdown');
    if (dropdown) dropdown.style.display = 'none';
  },

  removeFund(code) {
    this.funds = this.funds.filter(f => f.code !== code);
    this.renderSelected();
    if (this.funds.length === 0) {
      document.getElementById('compareResults').style.display = 'none';
    } else {
      this.renderComparison();
    }
  },

  renderSelected() {
    const el = document.getElementById('compareSelected');
    if (!el) return;

    if (this.funds.length === 0) {
      el.innerHTML = '<div class="empty-state" style="padding: 20px"><i class="fas fa-exchange-alt"></i> 搜索并添加基金开始对比</div>';
      return;
    }

    el.innerHTML = `<div class="compare-chips">
      ${this.funds.map(f => `
        <div class="compare-chip">
          <span class="chip-name">${shortName(f.name)}</span>
          <span class="chip-code">${f.code}</span>
          <button class="chip-remove" onclick="ComparePage.removeFund('${f.code}')">&times;</button>
        </div>
      `).join('')}
    </div>`;
  },

  renderComparison() {
    const el = document.getElementById('compareResults');
    if (!el || this.funds.length < 1) return;

    el.style.display = 'block';

    // 计算每只基金的收益率
    const returns = this.funds.map(f => ({
      ...f,
      ret: Calculator.calcReturns(f.navHistory)
    }));

    // 收益率对比表格
    const metrics = [
      { label: '最新净值', key: 'currentNav', fmt: v => fmtNum(v, 4) },
      { label: '日收益率', key: 'dayReturn' },
      { label: '近1周', key: 'weekReturn' },
      { label: '近1月', key: 'monthReturn' },
      { label: '近3月', key: 'quarterReturn' },
      { label: '近6月', key: 'halfYearReturn' },
      { label: '近1年', key: 'yearReturn' },
      { label: '总收益', key: 'totalReturn' },
      { label: '年化收益', key: 'annualized' },
    ];

    el.innerHTML = `
      <h3 class="section-subtitle"><i class="fas fa-chart-simple"></i> 收益率对比</h3>
      <div class="compare-table-wrap">
        <table class="compare-table">
          <thead>
            <tr>
              <th>指标</th>
              ${returns.map(f => `<th>${shortName(f.name)}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${metrics.map(m => {
              const isReturn = ['dayReturn','weekReturn','monthReturn','quarterReturn','halfYearReturn','yearReturn','totalReturn','annualized'].includes(m.key);
              return `<tr>
                <td class="metric-label">${m.label}</td>
                ${returns.map(f => {
                  const val = f.ret[m.key];
                  if (isReturn) {
                    const fmt = fmtReturn(val);
                    return `<td class="${fmt.cls}">${fmt.text}</td>`;
                  }
                  return `<td>${m.fmt ? m.fmt(val) : val ?? '--'}</td>`;
                }).join('')}
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;

    // 对比折线图
    setTimeout(() => {
      const chartContainer = document.createElement('div');
      chartContainer.className = 'compare-chart-section';
      chartContainer.innerHTML = `
        <h3 class="section-subtitle"><i class="fas fa-chart-line"></i> 净值走势对比</h3>
        <div class="nav-chart-container" style="height:300px">
          <canvas id="compareNavChart"></canvas>
        </div>
      `;
      el.appendChild(chartContainer);

      this.drawCompareChart();
    }, 50);
  },

  drawCompareChart() {
    const ctx = document.getElementById('compareNavChart');
    if (!ctx) return;

    // 准备数据：使用最近365天的数据
    const colors = ['#e74c3c', '#3498db', '#2ecc71', '#e67e22'];
    const datasets = this.funds.map((f, i) => {
      const data = f.navHistory.slice(-365);
      return {
        label: shortName(f.name),
        data: data.map(d => d.unitNav),
        borderColor: colors[i],
        backgroundColor: 'transparent',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.3,
      };
    });

    // 使用所有基金日期的并集作为labels
    const allDates = new Set();
    this.funds.forEach(f => {
      f.navHistory.slice(-365).forEach(d => allDates.add(d.date));
    });
    const labels = Array.from(allDates).sort();

    const chart = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: 'index' },
        plugins: {
          legend: { position: 'top', labels: { boxWidth: 12, padding: 10, font: { size: 11 } } },
          tooltip: {
            backgroundColor: 'rgba(0,0,0,0.8)',
            bodyFont: { size: 12 }
          }
        },
        scales: {
          x: { grid: { display: false }, ticks: { maxTicksLimit: 8, font: { size: 10 } } },
          y: { grid: { color: 'rgba(0,0,0,0.06)' }, ticks: { font: { size: 10 } } }
        }
      }
    });

    FundChart.instances['compareNavChart'] = chart;
  },

  bindEvents() {
    const input = document.getElementById('compareInput');
    if (!input) return;

    // 输入时搜索
    input.addEventListener('input', () => {
      const q = input.value.trim();
      clearTimeout(this.searchTimer);
      if (q.length < 1) {
        this.hideDropdown();
        return;
      }
      this.searchTimer = setTimeout(() => this.doSearch(q), 300);
    });

    // 回车直接搜索并添加第一个结果
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const q = input.value.trim();
        if (q.length < 1) return;
        // 如果是纯6位数字，直接按代码添加
        if (/^\d{6}$/.test(q)) {
          this.addFundBySearch(q, q);
        } else {
          // 否则触发搜索，自动添加第一个结果
          this.doSearch(q);
          setTimeout(() => {
            const firstItem = document.querySelector('.compare-dropdown-item:not(.disabled)');
            if (firstItem) {
              firstItem.click();
            }
          }, 500);
        }
      }
    });

    // 点击外部关闭下拉
    document.addEventListener('click', (e) => {
      const searchField = document.querySelector('.compare-search-field');
      if (searchField && !searchField.contains(e.target)) {
        this.hideDropdown();
      }
    });
  }
};
