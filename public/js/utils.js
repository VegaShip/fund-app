// ========== 工具函数 ==========

// 格式化数字（保留指定位数）
function fmtNum(num, decimals = 2) {
  if (num === null || num === undefined || isNaN(num)) return '--';
  return Number(num).toFixed(decimals);
}

// 格式化收益率（带正负号和百分比）
function fmtReturn(val) {
  if (val === null || val === undefined || isNaN(val)) return { text: '--', cls: '' };
  const sign = val > 0 ? '+' : '';
  const text = `${sign}${val.toFixed(2)}%`;
  const cls = val > 0 ? 'up' : val < 0 ? 'down' : 'flat';
  return { text, cls };
}

// 格式化金额
function fmtMoney(val, unit = '元') {
  if (!val || isNaN(val)) return '--';
  if (val >= 1e8) return (val / 1e8).toFixed(2) + '亿' + unit;
  if (val >= 1e4) return (val / 1e4).toFixed(2) + '万' + unit;
  return val.toFixed(2) + unit;
}

// 格式化日期
function fmtDate(dateStr, fmt = 'MM-dd') {
  if (!dateStr) return '--';
  const d = new Date(dateStr);
  const Y = d.getFullYear();
  const M = String(d.getMonth() + 1).padStart(2, '0');
  const D = String(d.getDate()).padStart(2, '0');
  return fmt.replace('YYYY', Y).replace('MM', M).replace('dd', D);
}

// 格式化时间戳
function fmtTime(ts) {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
}

// 获取基金类型的显示颜色
function getTypeColor(type) {
  const colors = {
    '股票型': '#e74c3c', '混合型': '#e67e22', '债券型': '#2ecc71',
    '货币型': '#3498db', '指数型': '#9b59b6', 'QDII': '#1abc9c',
    'FOF': '#f39c12', 'ETF联接': '#00bcd4', '其他': '#95a5a6'
  };
  return colors[type] || '#95a5a6';
}

// 获取风险等级颜色
function getRiskColor(level) {
  const map = { 'R1': '#2ecc71', 'R2': '#3498db', 'R3': '#e67e22', 'R4': '#e74c3c', 'R5': '#c0392b' };
  return map[level] || '#95a5a6';
}

// 防抖
function debounce(fn, delay = 300) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

// 节流
function throttle(fn, interval = 200) {
  let last = 0;
  return function (...args) {
    const now = Date.now();
    if (now - last >= interval) {
      last = now;
      fn.apply(this, args);
    }
  };
}

// Toast 提示
function showToast(msg, duration = 2000) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hide');
  el.style.opacity = '1';
  clearTimeout(el._timer);
  el._timer = setTimeout(() => {
    el.style.opacity = '0';
    setTimeout(() => el.classList.add('hide'), 300);
  }, duration);
}

// 显示/隐藏加载
function showLoading(text = '加载中...') {
  const overlay = document.getElementById('loadingOverlay');
  if (!overlay) return;
  overlay.querySelector('.loading-text').textContent = text;
  overlay.classList.remove('hide');
}

function hideLoading() {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) overlay.classList.add('hide');
}

// LocalStorage 操作
function storageGet(key, def = null) {
  try {
    const val = localStorage.getItem('fund_app_' + key);
    return val ? JSON.parse(val) : def;
  } catch { return def; }
}

function storageSet(key, val) {
  try { localStorage.setItem('fund_app_' + key, JSON.stringify(val)); } catch {}
}

// 获取基金简称（去掉基金类型后缀）
function shortName(name) {
  if (!name) return '';
  return name.replace(/^(.*?)(?:股票|混合|债券|货币|指数|ETF|QDII|FOF|联接).*$/, '$1').trim() || name;
}
