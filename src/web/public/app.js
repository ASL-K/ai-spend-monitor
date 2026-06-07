// ai-spend-monitor 仪表盘前端逻辑
// 调 3 个 API + 渲染 DOM（无任何依赖，浏览器原生）

const BUDGET_CNY = 49.0; // 跟 package.json / config.ts 一致

async function fetchJson(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

function formatCNY(n) {
  return `¥${n.toFixed(2)}`;
}

function formatNumber(n) {
  return n.toLocaleString('zh-CN');
}

function formatMonth(m) {
  return m;
}

async function loadMonthly() {
  const data = await fetchJson('/api/stats/month');
  const month = formatMonth(data.month);
  document.getElementById('subtitle').textContent = `${month} 期间统计`;

  document.getElementById('totalCost').textContent = formatCNY(data.totalCostCNY);
  document.getElementById('budget').textContent = `/ ${formatCNY(BUDGET_CNY)}（套餐）`;

  const pct = BUDGET_CNY > 0 ? Math.min((data.totalCostCNY / BUDGET_CNY) * 100, 100) : 0;
  const bar = document.getElementById('progressBar');
  bar.style.width = `${pct}%`;
  bar.classList.remove('warning', 'danger');
  if (pct >= 80) bar.classList.add('danger');
  else if (pct >= 60) bar.classList.add('warning');

  document.getElementById('totalCalls').textContent = `${formatNumber(data.totalCalls)} 次调用`;
  document.getElementById('totalTokens').textContent = `${formatNumber(data.totalTokens)} tokens`;

  // By Provider
  const providerDiv = document.getElementById('byProvider');
  if (data.byProvider.length === 0) {
    providerDiv.innerHTML = '<div class="empty">暂无数据</div>';
  } else {
    providerDiv.innerHTML = data.byProvider
      .map(
        (p) => `
        <div class="provider-row">
          <div class="provider-name">${escapeHtml(p.provider)}</div>
          <div class="provider-bar">
            <div class="provider-bar-fill" style="width: ${p.percentage.toFixed(1)}%"></div>
          </div>
          <div class="provider-cost">${formatCNY(p.costCNY)}</div>
          <div class="provider-percent">${p.percentage.toFixed(1)}%</div>
        </div>`
      )
      .join('');
  }

  // By Model
  const modelDiv = document.getElementById('byModel');
  if (data.byModel.length === 0) {
    modelDiv.innerHTML = '<div class="empty">暂无数据</div>';
  } else {
    modelDiv.innerHTML = data.byModel
      .slice(0, 10)
      .map(
        (m, i) => `
        <div class="model-row">
          <div class="model-rank">${i + 1}</div>
          <div class="model-name">${escapeHtml(m.provider)} / ${escapeHtml(m.model)}</div>
          <div class="model-cost">${formatCNY(m.costCNY)}</div>
        </div>`
      )
      .join('');
  }
}

async function loadDaily() {
  const data = await fetchJson('/api/stats/daily');
  const dayDiv = document.getElementById('byDay');
  if (data.length === 0) {
    dayDiv.innerHTML = '<div class="empty">暂无数据</div>';
    return;
  }

  // 填充缺失日期
  const filled = fillMissingDays(data);
  const maxCost = Math.max(...filled.map((d) => d.costCNY), 1);

  dayDiv.innerHTML = filled
    .map(
      (d) => `
      <div class="day-bar ${d.costCNY === 0 ? 'empty' : ''}"
           style="height: ${Math.max((d.costCNY / maxCost) * 100, 2)}%"
           title="${d.date}: ${formatCNY(d.costCNY)} (${d.callCount} 次)"></div>`
    )
    .join('');
}

function fillMissingDays(data) {
  if (data.length === 0) return [];
  // 假设都是同一月
  const first = new Date(data[0].date);
  const year = first.getFullYear();
  const month = first.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const map = new Map(data.map((d) => [d.date, d]));
  const result = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    result.push(
      map.get(date) || { date, costCNY: 0, callCount: 0, totalTokens: 0 }
    );
  }
  return result;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function init() {
  try {
    await Promise.all([loadMonthly(), loadDaily()]);
  } catch (err) {
    document.getElementById('subtitle').textContent = `加载失败: ${err.message}`;
  }
}

init();
