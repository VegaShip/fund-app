// ========== Chart.js 图表封装 ==========

const FundChart = {
  instances: {},

  // 创建净值走势图
  createNavChart(canvasId, navHistory, options = {}) {
    if (this.instances[canvasId]) {
      this.instances[canvasId].destroy();
    }

    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    // 准备数据 - 取最近365条
    const data = navHistory.slice(-(options.days || 365));
    const labels = data.map(d => fmtDate(d.date, 'MM-dd'));
    const unitNav = data.map(d => d.unitNav);
    const accumNav = data.map(d => d.accumNav || d.unitNav);

    const isUp = data.length > 1 && data[data.length - 1].unitNav >= data[0].unitNav;
    const lineColor = isUp ? '#e74c3c' : '#27ae60';
    const fillColor = isUp ? 'rgba(231, 76, 60, 0.1)' : 'rgba(39, 174, 96, 0.1)';

    const config = {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: '单位净值',
            data: unitNav,
            borderColor: lineColor,
            backgroundColor: fillColor,
            fill: true,
            tension: 0.3,
            pointRadius: 1,
            pointHoverRadius: 4,
            borderWidth: 2,
          },
          ...(options.showAccum ? [{
            label: '累计净值',
            data: accumNav,
            borderColor: '#3498db',
            backgroundColor: 'rgba(52, 152, 219, 0.05)',
            fill: false,
            tension: 0.3,
            pointRadius: 0,
            borderWidth: 1.5,
            borderDash: [5, 5],
          }] : [])
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: 'index' },
        plugins: {
          legend: { display: options.showAccum, position: 'top', labels: { boxWidth: 12, padding: 8, font: { size: 11 } } },
          tooltip: {
            backgroundColor: 'rgba(0,0,0,0.8)',
            titleFont: { size: 12 },
            bodyFont: { size: 12 },
            callbacks: {
              label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(4)}`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              font: { size: 10 },
              maxTicksLimit: 10,
              maxRotation: 0,
            }
          },
          y: {
            grid: { color: 'rgba(0,0,0,0.06)' },
            ticks: {
              font: { size: 10 },
              callback: v => v.toFixed(3)
            }
          }
        }
      }
    };

    this.instances[canvasId] = new Chart(ctx, config);
    return this.instances[canvasId];
  },

  // 创建收益率对比柱状图
  createReturnChart(canvasId, returns) {
    if (this.instances[canvasId]) {
      this.instances[canvasId].destroy();
    }

    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const labels = ['日', '周', '月', '季', '半年', '年'];
    const values = [
      returns.dayReturn, returns.weekReturn, returns.monthReturn,
      returns.quarterReturn, returns.halfYearReturn, returns.yearReturn
    ];

    const colors = values.map(v => {
      if (v === null || v === undefined) return '#95a5a6';
      return v >= 0 ? '#e74c3c' : '#27ae60';
    });

    const config = {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: '收益率 (%)',
          data: values.map(v => v ?? 0),
          backgroundColor: colors,
          borderRadius: 4,
          barThickness: 30,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => `${ctx.parsed.y.toFixed(2)}%`
            }
          }
        },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 11 } } },
          y: {
            grid: { color: 'rgba(0,0,0,0.06)' },
            ticks: {
              font: { size: 10 },
              callback: v => v.toFixed(1) + '%'
            }
          }
        }
      }
    };

    this.instances[canvasId] = new Chart(ctx, config);
    return this.instances[canvasId];
  },

  // 销毁所有图表
  destroyAll() {
    Object.values(this.instances).forEach(c => c.destroy());
    this.instances = {};
  }
};
