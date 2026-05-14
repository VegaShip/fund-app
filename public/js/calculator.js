// ========== 收益率计算引擎 ==========

const Calculator = {

  // 计算区间收益率
  // navHistory: [{date, unitNav, accumNav}], 按日期升序
  calcReturns(navHistory) {
    if (!navHistory || navHistory.length < 2) return {};

    const sorted = [...navHistory].filter(n => n.unitNav > 0).sort((a, b) => a.date.localeCompare(b.date));
    const latest = sorted[sorted.length - 1];
    const currentNav = latest.unitNav;

    // 辅助：找指定天数前的净值
    const findNav = (daysAgo) => {
      const target = new Date(latest.date);
      target.setDate(target.getDate() - daysAgo);
      // 往前找最近的有效净值
      for (let i = sorted.length - 1; i >= 0; i--) {
        const d = new Date(sorted[i].date);
        if (d <= target && sorted[i].unitNav > 0) return sorted[i].unitNav;
      }
      return null;
    };

    // 辅助：计算收益率
    const calc = (oldNav) => {
      if (!oldNav || oldNav === 0) return null;
      return (currentNav - oldNav) / oldNav * 100;
    };

    const dayReturn = sorted.length >= 2 ? calc(sorted[sorted.length - 2].unitNav) : null;
    const weekReturn = calc(findNav(7));
    const monthReturn = calc(findNav(30));
    const quarterReturn = calc(findNav(90));
    const halfYearReturn = calc(findNav(180));
    const yearReturn = calc(findNav(365));
    const twoYearReturn = calc(findNav(730));
    const threeYearReturn = calc(findNav(1095));
    const totalReturn = sorted[0].unitNav > 0 ? calc(sorted[0].unitNav) : null;

    // 年化收益率
    const annualized = (() => {
      if (!totalReturn || totalReturn === 0) return null;
      const days = (new Date(latest.date) - new Date(sorted[0].date)) / (1000 * 60 * 60 * 24);
      if (days < 30) return null;
      const total = 1 + totalReturn / 100;
      return (Math.pow(total, 365 / days) - 1) * 100;
    })();

    return {
      currentNav,
      accumNav: latest.accumNav || 0,
      navDate: latest.date,
      dayReturn, weekReturn, monthReturn, quarterReturn,
      halfYearReturn, yearReturn, twoYearReturn, threeYearReturn,
      totalReturn, annualized
    };
  },

  // 收益率排名计算（基于排行榜数据）
  calcRankReturns(fund) {
    return {
      dayReturn: fund.dayReturn,
      weekReturn: fund.weekReturn,
      monthReturn: fund.monthReturn,
      quarterReturn: fund.quarterReturn,
      halfYearReturn: fund.halfYearReturn,
      yearReturn: fund.yearReturn,
      totalReturn: fund.totalReturn,
    };
  },

  // 模拟实时收益率变化（非交易时段返回基金的实际日收益率）
  simulateRealTime(fund) {
    if (!fund) return { change: 0, text: '--', cls: '' };
    // 对真实估值数据，直接使用已获取的 estimatedChange
    if (fund.estimatedChange !== undefined) {
      return fmtReturn(fund.estimatedChange);
    }
    // 否则返回当日净值增长率
    return fmtReturn(fund.dayReturn);
  }
};
