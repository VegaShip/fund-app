// ========== API 客户端 ==========

const API = {
  base: '',

  async get(path) {
    try {
      const resp = await fetch(this.base + path, { timeout: 15000 });
      const json = await resp.json();
      if (!json.ok) throw new Error(json.error || '请求失败');
      return json.data;
    } catch (e) {
      console.error(`API GET ${path}:`, e);
      throw e;
    }
  },

  // 获取基金列表
  async getFunds() {
    return this.get('/api/funds');
  },

  // 获取基金排行（带收益率）
  async getRanking({ type = 'all', sort = '1nzf', order = 'desc', page = 1, pageSize = 50 } = {}) {
    const params = `type=${type}&sort=${sort}&order=${order}&page=${page}&pageSize=${pageSize}`;
    return this.get(`/api/ranking?${params}`);
  },

  // 获取基金详情
  async getFundDetail(code) {
    return this.get(`/api/fund/${code}`);
  },

  // 获取实时估值
  async getRealTimeGZ(code) {
    return this.get(`/api/fund/${code}/gz`);
  },

  // 获取历史净值
  async getHistory(code, { startDate, endDate, page = 1, pageSize = 5000 } = {}) {
    let params = `page=${page}&pageSize=${pageSize}`;
    if (startDate) params += `&startDate=${startDate}`;
    if (endDate) params += `&endDate=${endDate}`;
    return this.get(`/api/fund/${code}/history?${params}`);
  },

  // 获取基金持仓
  async getHoldings(code) {
    return this.get(`/api/fund/${code}/holdings`);
  },

  // 搜索基金
  async search(keyword) {
    return this.get(`/api/search?q=${encodeURIComponent(keyword)}`);
  },

  // 批量实时估值
  async getBatchGZ(codes) {
    if (!codes || codes.length === 0) return [];
    return this.get(`/api/gz/batch?codes=${codes.join(',')}`);
  }
};
