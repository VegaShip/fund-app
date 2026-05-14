const express = require('express');
const fetch = require('node-fetch');
const iconv = require('iconv-lite');

const app = express();
const PORT = process.env.PORT || 3000;

// ========== 缓存 ==========
const cache = {
  data: new Map(),
  get(key) {
    const entry = this.data.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiry) {
      this.data.delete(key);
      return null;
    }
    return entry.data;
  },
  set(key, data, ttlMs) {
    this.data.set(key, { data, expiry: Date.now() + ttlMs });
  }
};

// ========== 辅助函数 ==========
function parseFundType(ft) {
  const typeMap = {
    'gp': '股票型', 'hh': '混合型', 'zq': '债券型',
    'hb': '货币型', 'zs': '指数型', 'QDII': 'QDII',
    'FOF': 'FOF', 'lo': 'ETF联接', 'all': '全部'
  };
  return typeMap[ft] || ft;
}

function getTypeFromCode(typeStr) {
  if (!typeStr) return '其他';
  if (typeStr.includes('股票')) return '股票型';
  if (typeStr.includes('混合')) return '混合型';
  if (typeStr.includes('债券')) return '债券型';
  if (typeStr.includes('货币')) return '货币型';
  if (typeStr.includes('指数')) return '指数型';
  if (typeStr.includes('QDII')) return 'QDII';
  if (typeStr.includes('FOF')) return 'FOF';
  if (typeStr.includes('联接') || typeStr.includes('ETF')) return 'ETF联接';
  return '其他';
}

function buildEastMoneyUrl(base, params) {
  const url = new URL(base);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return url.toString();
}

// Convert JS object literal (unquoted keys) to valid JSON
function jsObjToJson(text) {
  // Replace unquoted property names (before colon) with quoted ones
  return text.replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '$1"$2":');
}

async function fetchWithRetry(url, options = {}, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const resp = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'http://fund.eastmoney.com/',
          ...options.headers
        },
        timeout: 10000
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const buffer = await resp.buffer();
      // Detect encoding: 1) Content-Type charset, 2) UTF-8 BOM, 3) fallback to GB2312
      const contentType = resp.headers.get('content-type') || '';
      if (/charset=utf/i.test(contentType)) {
        return iconv.decode(buffer, 'utf8');
      }
      if (buffer.length >= 3 && buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
        return iconv.decode(buffer, 'utf8');
      }
      return iconv.decode(buffer, 'gb2312');
    } catch (e) {
      if (i === retries) throw e;
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
}

// ========== API 路由 ==========

// 1. 获取基金列表
app.get('/api/funds', async (req, res) => {
  const cacheKey = 'fund_list_all';
  const cached = cache.get(cacheKey);
  if (cached) return res.json({ ok: true, data: cached, fromCache: true });

  try {
    const text = await fetchWithRetry('http://fund.eastmoney.com/js/fundcode_search.js');
    // Find array content between first '[' and the matching final ']'
    const startIdx = text.indexOf('[');
    if (startIdx < 0) throw new Error('Failed to parse fund list');
    let depth = 0;
    let endIdx = -1;
    for (let i = startIdx; i < text.length; i++) {
      if (text[i] === '[') depth++;
      else if (text[i] === ']') {
        depth--;
        if (depth === 0) { endIdx = i; break; }
      }
    }
    if (endIdx < 0) throw new Error('Failed to parse fund list');
    const jsonStr = text.substring(startIdx, endIdx + 1);
    const raw = JSON.parse(jsonStr);
    const funds = raw.map(([code, py, name, type, pinyin]) => ({
      code, name, type, typeLabel: getTypeFromCode(type),
      pinyin
    }));

    // 按类型分组统计
    const typeCount = {};
    funds.forEach(f => {
      typeCount[f.typeLabel] = (typeCount[f.typeLabel] || 0) + 1;
    });

    cache.set(cacheKey, { funds, typeCount }, 3600000);
    res.json({ ok: true, data: { funds, typeCount } });
  } catch (e) {
    console.error('Fund list error:', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// 1.5 搜索基金（按代码或名称）
app.get('/api/search', async (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 1) return res.json({ ok: true, data: { list: [] } });

  const cacheKey = 'fund_list_all';
  let cached = cache.get(cacheKey);
  if (!cached) {
    // 触发一次加载
    try {
      const text = await fetchWithRetry('http://fund.eastmoney.com/js/fundcode_search.js');
      const startIdx = text.indexOf('[');
      if (startIdx < 0) throw new Error('Parse failed');
      let depth = 0, endIdx = -1;
      for (let i = startIdx; i < text.length; i++) {
        if (text[i] === '[') depth++;
        else if (text[i] === ']') { depth--; if (depth === 0) { endIdx = i; break; } }
      }
      if (endIdx < 0) throw new Error('Parse failed');
      const raw = JSON.parse(text.substring(startIdx, endIdx + 1));
      const funds = raw.map(([code, py, name, type, pinyin]) => ({ code, name, type, typeLabel: getTypeFromCode(type), pinyin }));
      cached = { funds };
      cache.set(cacheKey, cached, 3600000);
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  }

  const keyword = q.toUpperCase();
  const matched = cached.funds.filter(f =>
    f.code.includes(keyword) ||
    f.name.toUpperCase().includes(keyword) ||
    f.pinyin.toUpperCase().includes(keyword)
  ).slice(0, 50);

  res.json({ ok: true, data: { list: matched, total: matched.length } });
});

// 2. 基金排行（带收益率数据）
app.get('/api/ranking', async (req, res) => {
  const { type = 'all', sort = '1nzf', order = 'desc', page = 1, pageSize = 50 } = req.query;
  const cacheKey = `ranking_${type}_${sort}_${order}_${page}`;
  const cached = cache.get(cacheKey);
  if (cached) return res.json({ ok: true, data: cached, fromCache: true });

  try {
    const sd = '2024-01-01';
    const ed = new Date().toISOString().split('T')[0];
    const url = buildEastMoneyUrl('http://fund.eastmoney.com/data/rankhandler.aspx', {
      op: 'ph', dt: 'kf', ft: type, rs: '', gs: '0',
      sc: sort, st: order, sd, ed,
      pi: page, pn: pageSize, dx: '1', v: Date.now()
    });

    const text = await fetchWithRetry(url);
    const match = text.match(/var rankData = (\{[\s\S]*\});/);
    if (!match) throw new Error('Failed to parse ranking data');

    const jsonText = jsObjToJson(match[1]);
    const rankData = JSON.parse(jsonText);
    const list = (rankData.datas || []).map(item => {
      const fields = item.split(',');
      return {
        code: fields[0],
        name: fields[1],
        navDate: fields[3] || '',
        unitNav: parseFloat(fields[4]) || 0,
        accumNav: parseFloat(fields[5]) || 0,
        dayReturn: parseFloat(fields[6]) || 0,
        weekReturn: fields[7] ? parseFloat(fields[7]) : null,
        monthReturn: fields[8] ? parseFloat(fields[8]) : null,
        quarterReturn: fields[9] ? parseFloat(fields[9]) : null,
        halfYearReturn: fields[10] ? parseFloat(fields[10]) : null,
        yearReturn: fields[11] ? parseFloat(fields[11]) : null,
        totalReturn: fields[15] ? parseFloat(fields[15]) : null,
      };
    }).filter(f => f.code && f.name);

    const result = {
      list,
      total: rankData.allRecords || 0,
      page: parseInt(page),
      pageSize: parseInt(pageSize)
    };

    cache.set(cacheKey, result, 300000);
    res.json({ ok: true, data: result });
  } catch (e) {
    console.error('Ranking error:', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// 3. 基金详情（pingzhongdata）
app.get('/api/fund/:code', async (req, res) => {
  const { code } = req.params;
  const cacheKey = `fund_detail_${code}`;
  const cached = cache.get(cacheKey);
  if (cached) return res.json({ ok: true, data: cached, fromCache: true });

  try {
    const url = `http://fund.eastmoney.com/pingzhongdata/${code}.js?v=${Date.now()}`;
    const text = await fetchWithRetry(url);

    // 解析 pingzhongdata 中的变量
    const extractVar = (name) => {
      const re = new RegExp(`var ${name}\\s*=\\s*(\\[[\\s\\S]*?\\])\\s*;`);
      const m = text.match(re);
      if (m) try { return JSON.parse(m[1]); } catch(e) {}
      return [];
    };
    const extractStr = (name) => {
      const re = new RegExp(`var ${name}\\s*=\\s*"([^"]*)"`);
      const m = text.match(re);
      return m ? m[1] : '';
    };
    const extractObj = (name) => {
      const re = new RegExp(`var ${name}\\s*=\\s*(\\{[\\s\\S]*?\\})\\s*;`);
      const m = text.match(re);
      if (m) try { return JSON.parse(m[1]); } catch(e) {}
      return {};
    };

    const netWorthTrend = extractVar('Data_netWorthTrend');
    const ACWorthTrend = extractVar('Data_ACWorthTrend');

    // 解析净值走势
    const navHistory = netWorthTrend.map(item => ({
      date: new Date(item.x).toISOString().split('T')[0],
      unitNav: item.y,
      dayReturn: item.equityReturn || 0
    }));

    // 解析累计净值
    const accumNavHistory = ACWorthTrend.map(item => ({
      date: new Date(item[0]).toISOString().split('T')[0],
      accumNav: item[1]
    }));

    // 合并数据
    const mergedMap = new Map();
    navHistory.forEach(n => mergedMap.set(n.date, { ...n }));
    accumNavHistory.forEach(a => {
      if (mergedMap.has(a.date)) {
        mergedMap.get(a.date).accumNav = a.accumNav;
      }
    });

    const merged = Array.from(mergedMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    // 基金基本信息
    const info = {
      code,
      name: extractStr('fS_name') || code,
      type: extractStr('fS_type') || '',
      riskLevel: extractStr('Data_riskLevel') || '',
      fundScale: extractStr('fS_scale') || '',
      fundManager: extractStr('fS_mgr') || '',
      establishDate: extractStr('fS_date') || '',
    };

    // 提取年度收益率数据
    const yearReturn = extractStr('syl_1n');
    const halfYearReturn = extractStr('syl_6y');
    const quarterReturn = extractStr('syl_3y');
    const monthReturn = extractStr('syl_1y');

    const result = { info, navHistory: merged, returns: { yearReturn, halfYearReturn, quarterReturn, monthReturn } };
    cache.set(cacheKey, result, 1800000);
    res.json({ ok: true, data: result });
  } catch (e) {
    console.error(`Fund detail error [${code}]:`, e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// 4. 实时估值
app.get('/api/fund/:code/gz', async (req, res) => {
  const { code } = req.params;
  const cacheKey = `gz_${code}`;
  const cached = cache.get(cacheKey);
  if (cached) return res.json({ ok: true, data: cached, fromCache: true });

  try {
    const url = `http://fundgz.1234567.com.cn/js/${code}.js?rt=${Date.now()}`;
    const text = await fetchWithRetry(url);
    const match = text.match(/jsonpgz\((\{[\s\S]*?\})\)/);
    if (!match) throw new Error('Parse failed');

    const data = JSON.parse(match[1]);
    const result = {
      code: data.fundcode,
      name: data.name,
      navDate: data.jzrq,
      unitNav: parseFloat(data.dwjz) || 0,
      estimatedNav: parseFloat(data.gsz) || 0,
      estimatedChange: parseFloat(data.gszzl) || 0,
      estimateTime: data.gztime
    };

    cache.set(cacheKey, result, 30000);
    res.json({ ok: true, data: result });
  } catch (e) {
    // 非交易时段返回空
    res.json({ ok: true, data: null, note: '非交易时段或数据不可用' });
  }
});

// 4.5 批量实时估值
app.get('/api/gz/batch', async (req, res) => {
  const { codes } = req.query;
  if (!codes) return res.json({ ok: true, data: [] });

  const codeList = codes.split(',').filter(Boolean).slice(0, 50);
  const results = await Promise.allSettled(codeList.map(async (code) => {
    const cacheKey = `gz_${code}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    try {
      const url = `http://fundgz.1234567.com.cn/js/${code}.js?rt=${Date.now()}`;
      const text = await fetchWithRetry(url);
      const match = text.match(/jsonpgz\((\{[\s\S]*?\})\)/);
      if (!match) return null;

      const data = JSON.parse(match[1]);
      const result = {
        code: data.fundcode,
        estimatedNav: parseFloat(data.gsz) || 0,
        unitNav: parseFloat(data.dwjz) || 0,
        estimatedChange: parseFloat(data.gszzl) || 0,
        estimateTime: data.gztime,
        navDate: data.jzrq
      };
      cache.set(cacheKey, result, 30000);
      return result;
    } catch { return null; }
  }));

  const data = results.filter(r => r.status === 'fulfilled' && r.value).map(r => r.value);
  res.json({ ok: true, data });
});

// 5. 历史净值
app.get('/api/fund/:code/history', async (req, res) => {
  const { code } = req.params;
  const { startDate, endDate, page = 1, pageSize = 5000 } = req.query;
  const cacheKey = `history_${code}_${page}_${pageSize}`;
  const cached = cache.get(cacheKey);
  if (cached) return res.json({ ok: true, data: cached, fromCache: true });

  try {
    const url = buildEastMoneyUrl('http://api.fund.eastmoney.com/f10/lsjz', {
      fundCode: code, pageIndex: page, pageSize,
      startDate: startDate || '',
      endDate: endDate || '',
      callback: 'jQuery'
    });

    const text = await fetchWithRetry(url);
    const match = text.match(/jQuery\((\{[\s\S]*?\})\)/);
    if (!match) throw new Error('Parse failed');

    const json = JSON.parse(match[1]);
    const list = (json.Data?.LSJZList || []).map(item => ({
      date: item.FSRQ,
      unitNav: parseFloat(item.DWJZ) || 0,
      accumNav: parseFloat(item.LJJZ) || 0,
      dayReturn: item.JZZZL ? parseFloat(item.JZZZL) : null
    }));

    const result = { list, total: json.TotalCount || 0 };
    cache.set(cacheKey, result, 1800000);
    res.json({ ok: true, data: result });
  } catch (e) {
    console.error(`History error [${code}]:`, e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// 6. 基金持仓
app.get('/api/fund/:code/holdings', async (req, res) => {
  const { code } = req.params;
  const cacheKey = `holdings_${code}`;
  const cached = cache.get(cacheKey);
  if (cached) return res.json({ ok: true, data: cached, fromCache: true });

  try {
    const now = new Date();
    // 按季度尝试：当前季度往前推，直到找到有数据的报告期
    const quarterMonths = [
      { m: '6', label: '1' },  // 1季度
      { m: '9', label: '2' },  // 2季度
      { m: '12', label: '3' }, // 3季度
      { m: '3', label: '4' },  // 4季度
    ];
    // 调整顺序：从最近季度开始尝试（当前月份对应的季度在前）
    const currentQ = Math.floor((now.getMonth()) / 3); // 0=Q1, 1=Q2, 2=Q3, 3=Q4
    const reordered = [...quarterMonths.slice(currentQ), ...quarterMonths.slice(0, currentQ)];

    let holdings = [];
    let reportDate = '';
    let found = false;

    for (const qm of reordered) {
      if (found) break;
      for (let y = now.getFullYear(); y >= now.getFullYear() - 1; y--) {
        if (found) break;
        const url = `http://fundf10.eastmoney.com/FundArchivesDatas.aspx?type=jjcc&code=${code}&topline=10&year=${y}&month=${qm.m}`;
        let text;
        try {
          text = await fetchWithRetry(url);
        } catch { continue; }

        // 解析 JSONP: var apidata={ content:"...", ... };
        const jsonMatch = text.match(/var apidata\s*=\s*(\{[\s\S]*?\});/);
        if (!jsonMatch) continue;

        const jsonText = jsObjToJson(jsonMatch[1]);
        let apidata;
        try { apidata = JSON.parse(jsonText); } catch { continue; }

        const html = apidata.content || '';
        if (!html || html.includes('暂无数据')) continue;

        // 从HTML表格提取持仓
        // 国内基金: tol/tor 格式
        const trRegex = /<tr>[\s\S]*?<td>(\d+)<\/td>[\s\S]*?<td class='tol'><a[^>]*>([^<]+)<\/a>[\s\S]*?<td class='tor'>([\d.]+)%<\/td>/g;
        // QDII基金: toc/toc 格式 (name cell has line-height:18px)
        const trRegexQdii = /<tr>[\s\S]*?<td>(\d+)<\/td>[\s\S]*?<td class='toc' style='line-height:18px'><a[^>]*>([^<]+)<\/a>[\s\S]*?<td class='toc'>([\d.]+)%<\/td>/g;
        let m;
        while ((m = trRegex.exec(html)) !== null) {
          const name = m[2].trim();
          const ratio = parseFloat(m[3]);
          if (name && !isNaN(ratio)) {
            holdings.push({ name, ratio, rank: parseInt(m[1]) });
          }
        }
        if (holdings.length === 0) {
          while ((m = trRegexQdii.exec(html)) !== null) {
            const name = m[2].trim();
            const ratio = parseFloat(m[3]);
            if (name && !isNaN(ratio)) {
              holdings.push({ name, ratio, rank: parseInt(m[1]) });
            }
          }
        }

        if (holdings.length > 0) {
          // 提取报告日期
          const dateMatch = html.match(/截止至：<font[^>]*>([\d-]+)<\/font>/);
          reportDate = dateMatch ? dateMatch[1] : `${y}年${qm.label}季度`;
          found = true;
        }
      }
    }

    // QDII/特殊基金：尝试空 year/month 参数（获取最近报告期）
    if (!found) {
      const url = `http://fundf10.eastmoney.com/FundArchivesDatas.aspx?type=jjcc&code=${code}&topline=10&year=&month=`;
      try {
        const text = await fetchWithRetry(url);
        const jsonMatch = text.match(/var apidata\s*=\s*(\{[\s\S]*?\});/);
        if (jsonMatch) {
          const apidata = JSON.parse(jsObjToJson(jsonMatch[1]));
          const html = apidata.content || '';
          if (html && !html.includes('暂无数据')) {
            // Try domestic regex first
            const trRegex = /<tr>[\s\S]*?<td>(\d+)<\/td>[\s\S]*?<td class='tol'><a[^>]*>([^<]+)<\/a>[\s\S]*?<td class='tor'>([\d.]+)%<\/td>/g;
            let m;
            while ((m = trRegex.exec(html)) !== null) {
              const name = m[2].trim();
              const ratio = parseFloat(m[3]);
              if (name && !isNaN(ratio)) {
                holdings.push({ name, ratio, rank: parseInt(m[1]) });
              }
            }
            // If none found, try QDII regex
            if (holdings.length === 0) {
              const trRegexQdii = /<tr>[\s\S]*?<td>(\d+)<\/td>[\s\S]*?<td class='toc' style='line-height:18px'><a[^>]*>([^<]+)<\/a>[\s\S]*?<td class='toc'>([\d.]+)%<\/td>/g;
              while ((m = trRegexQdii.exec(html)) !== null) {
                const name = m[2].trim();
                const ratio = parseFloat(m[3]);
                if (name && !isNaN(ratio)) {
                  holdings.push({ name, ratio, rank: parseInt(m[1]) });
                }
              }
            }
            const dateMatch = html.match(/截止至：<font[^>]*>([\d-]+)<\/font>/);
            reportDate = dateMatch ? dateMatch[1] : '';
            found = holdings.length > 0;
          }
        }
      } catch { /* ignore */ }
    }

    const result = { holdings, reportDate };
    cache.set(cacheKey, result, 3600000);
    res.json({ ok: true, data: result });
  } catch (e) {
    console.error(`Holdings error [${code}]:`, e.message);
    res.json({ ok: true, data: { holdings: [], reportDate: '' }, note: '持仓数据暂不可用' });
  }
});

// 提供静态文件
app.use(express.static('public'));

// 错误处理
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ ok: false, error: '服务器内部错误' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`基金筛选应用已启动: http://localhost:${PORT}`);
  console.log(`手机访问: http://<本机IP>:${PORT}`);
  console.log(`外网访问: npm run public  (使用 localtunnel 创建外网隧道)`);
});
