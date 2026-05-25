/* ============================================================
   AtlasNLP — analysis.js
   Five finding charts via Chart.js, data aggregated from CSVs
   ============================================================ */

const CHART_DEFAULTS = {
  font:    { family: 'system-ui, -apple-system, sans-serif', size: 12 },
  colors: {
    primary:  '#2A7088',
    ocean:    '#0C3340',
    coral:    '#FF7A5C',
    gold:     '#F39C12',
    kelp:     '#1E8449',
    slate:    '#5A8894',
    foam:     '#DFF1EC',
    mist:     '#CAE9E1',
  },
};

Chart.defaults.font.family = CHART_DEFAULTS.font.family;
Chart.defaults.font.size   = CHART_DEFAULTS.font.size;
Chart.defaults.color       = '#5A8894';

document.addEventListener('DOMContentLoaded', async () => {
  const ids = ['chart1','chart2','chart3','chart4','chart5','chart6','chart7'];
  ids.forEach(id => {
    const el = document.getElementById(id + '-wrap');
    if (el) showSpinner(el);
  });

  try {
    const core = await loadCoreCols();
    drawChart1(core);
    drawChart2(core);
    drawChart3(core);
    drawChart4(core);
    drawChart5(core);
    drawTaskPortfolio(core);
    drawLanguageConcentration(core);
  } catch(e) {
    ids.forEach(id => {
      const el = document.getElementById(id + '-wrap');
      if (el) showError(el, e.message);
    });
  }
});

/* ---- Chart 1: Top 20 content countries by dataset count -- */
function drawChart1(core) {
  const wrap = document.getElementById('chart1-wrap');
  wrap.innerHTML = '<canvas id="chart1"></canvas>';

  const countMap = {};
  core.forEach(r => {
    parseCountries(safeStr(r['all_countries_covered'])).forEach(c => {
      countMap[c] = (countMap[c] || 0) + 1;
    });
  });

  const sorted = Object.entries(countMap).sort((a, b) => b[1] - a[1]).slice(0, 20);
  const labels = sorted.map(([k]) => k);
  const data   = sorted.map(([, v]) => v);

  const maxVal = Math.max(...data);
  const colors = data.map(v => {
    const t = v / maxVal;
    const r = Math.round(27  + t * (11  - 27));
    const g = Math.round(79  + t * (29  - 79));
    const b = Math.round(114 + t * (46  - 114));
    return `rgba(${r+30},${g+30},${b+30},0.85)`;
  });

  new Chart(document.getElementById('chart1'), {
    type: 'bar',
    data: { labels, datasets: [{ data, backgroundColor: colors, borderRadius: 4, borderSkipped: false }] },
    options: {
      indexAxis: 'y',
      plugins: { legend: { display: false }, tooltip: { callbacks: {
        label: ctx => ` ${ctx.raw.toLocaleString()} datasets`
      }}},
      scales: {
        x: { grid: { color: 'rgba(0,0,0,.06)' }, ticks: { callback: v => v.toLocaleString() } },
        y: { grid: { display: false } },
      },
      responsive: true,
      maintainAspectRatio: false,
    }
  });
}

/* ---- Chart 2: Task distribution (top 15 tasks) ----------- */
function drawChart2(core) {
  const wrap = document.getElementById('chart2-wrap');
  wrap.innerHTML = '<canvas id="chart2"></canvas>';

  const taskMap = {};
  core.forEach(r => {
    const t = safeStr(r['Task Category']);
    if (t) taskMap[t] = (taskMap[t] || 0) + 1;
  });

  const sorted = Object.entries(taskMap).sort((a, b) => b[1] - a[1]).slice(0, 15);
  const labels = sorted.map(([k]) => truncate(k, 45));
  const data   = sorted.map(([, v]) => v);

  new Chart(document.getElementById('chart2'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: CHART_DEFAULTS.colors.primary,
        borderRadius: 4,
        borderSkipped: false,
      }]
    },
    options: {
      indexAxis: 'y',
      plugins: { legend: { display: false }, tooltip: { callbacks: {
        label: ctx => ` ${ctx.raw.toLocaleString()} datasets`
      }}},
      scales: {
        x: { grid: { color: 'rgba(0,0,0,.06)' }, ticks: { callback: v => v.toLocaleString() } },
        y: { grid: { display: false }, ticks: { font: { size: 11 } } },
      },
      responsive: true,
      maintainAspectRatio: false,
    }
  });
}

/* ---- Chart 3: Producer vs. content countries (top 15) ---- */
function drawChart3(core) {
  const wrap = document.getElementById('chart3-wrap');
  wrap.innerHTML = '<canvas id="chart3"></canvas>';

  const contentMap = {};
  const producerMap = {};

  core.forEach(r => {
    parseCountries(safeStr(r['all_countries_covered'])).forEach(c => {
      contentMap[c] = (contentMap[c] || 0) + 1;
    });
    parseCountries(safeStr(r['producer_countries'])).forEach(c => {
      producerMap[c] = (producerMap[c] || 0) + 1;
    });
  });

  const topContent = Object.entries(contentMap).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([k]) => k);

  new Chart(document.getElementById('chart3'), {
    type: 'bar',
    data: {
      labels: topContent,
      datasets: [
        {
          label: 'Content country',
          data: topContent.map(c => contentMap[c] || 0),
          backgroundColor: CHART_DEFAULTS.colors.primary,
          borderRadius: 3,
        },
        {
          label: 'Producer country',
          data: topContent.map(c => producerMap[c] || 0),
          backgroundColor: CHART_DEFAULTS.colors.coral,
          borderRadius: 3,
        }
      ]
    },
    options: {
      plugins: {
        legend: { position: 'top' },
        tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${ctx.raw.toLocaleString()}` } }
      },
      scales: {
        x: { grid: { display: false } },
        y: { grid: { color: 'rgba(0,0,0,.06)' }, ticks: { callback: v => v.toLocaleString() } },
      },
      responsive: true,
      maintainAspectRatio: false,
    }
  });
}

/* ---- Chart 4: Language coverage type (Core) -------------- */
function drawChart4(core) {
  const wrap = document.getElementById('chart4-wrap');
  wrap.innerHTML = '<canvas id="chart4"></canvas>';

  const covMap = {};
  core.forEach(r => {
    const lv = safeStr(r['Language coverage type']);
    if (lv) covMap[lv] = (covMap[lv] || 0) + 1;
  });

  const labels = Object.keys(covMap).sort();
  const data   = labels.map(l => covMap[l]);
  const total  = data.reduce((a, b) => a + b, 0);
  const palette = {
    'Monolingual':  CHART_DEFAULTS.colors.primary,
    'Multilingual': CHART_DEFAULTS.colors.coral,
  };
  const colors = labels.map(l => palette[l] || CHART_DEFAULTS.colors.slate);

  new Chart(document.getElementById('chart4'), {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderWidth: 2,
        borderColor: '#fff',
        hoverOffset: 8,
      }]
    },
    options: {
      plugins: {
        legend: { position: 'right' },
        tooltip: { callbacks: {
          label: ctx => ` ${ctx.label}: ${ctx.raw.toLocaleString()} (${((ctx.raw / total) * 100).toFixed(1)}%)`
        }}
      },
      responsive: true,
      maintainAspectRatio: false,
    }
  });
}

/* ---- Chart 5: Attribution method breakdown --------------- */
function drawChart5(core) {
  const wrap = document.getElementById('chart5-wrap');
  wrap.innerHTML = '<canvas id="chart5"></canvas>';

  const methodMap = {};
  core.forEach(r => {
    const m = safeStr(r['Country Attribution Method']) || 'Not stated';
    methodMap[m] = (methodMap[m] || 0) + 1;
  });

  const sorted = Object.entries(methodMap).sort((a, b) => b[1] - a[1]);
  const labels = sorted.map(([k]) => truncate(k, 50));
  const data   = sorted.map(([, v]) => v);
  const total  = data.reduce((a, b) => a + b, 0);

  const colors = [
    CHART_DEFAULTS.colors.primary,
    CHART_DEFAULTS.colors.kelp,
    CHART_DEFAULTS.colors.gold,
    CHART_DEFAULTS.colors.coral,
    CHART_DEFAULTS.colors.slate,
    '#8E44AD',
    '#16A085',
  ];

  new Chart(document.getElementById('chart5'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: data.map((_, i) => colors[i % colors.length]),
        borderRadius: 4,
        borderSkipped: false,
      }]
    },
    options: {
      indexAxis: 'y',
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: {
          label: ctx => ` ${ctx.raw.toLocaleString()} (${((ctx.raw / total) * 100).toFixed(1)}%)`
        }}
      },
      scales: {
        x: { grid: { color: 'rgba(0,0,0,.06)' }, ticks: { callback: v => v.toLocaleString() } },
        y: { grid: { display: false }, ticks: { font: { size: 11 } } },
      },
      responsive: true,
      maintainAspectRatio: false,
    }
  });
}

/* ---- Chart 6: Task breadth by country (top 20) ----------- */
function drawTaskPortfolio(core) {
  const wrap = document.getElementById('chart6-wrap');
  if (!wrap) return;
  wrap.innerHTML = '';
  wrap.style.height = 'auto';

  const countryData = {};
  core.forEach(r => {
    const task = safeStr(r['Task Category']) || 'Unknown';
    parseCountries(safeStr(r['all_countries_covered'])).forEach(c => {
      if (!countryData[c]) countryData[c] = { total: 0, tasks: {} };
      countryData[c].total++;
      countryData[c].tasks[task] = (countryData[c].tasks[task] || 0) + 1;
    });
  });

  const top20 = Object.entries(countryData)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 20)
    .map(([country, d]) => {
      const taskEntries = Object.entries(d.tasks).sort((a, b) => b[1] - a[1]);
      const top3Sum  = taskEntries.slice(0, 3).reduce((s, [, v]) => s + v, 0);
      const top3Names = taskEntries.slice(0, 3).map(([k]) => truncate(k, 22)).join(', ');
      return { country, total: d.total, breadth: taskEntries.length, top3Share: ((top3Sum / d.total) * 100).toFixed(0) + '%', top3Names };
    });

  wrap.innerHTML = `
    <div class="table-wrap" style="max-height:440px;overflow-y:auto;">
      <table>
        <thead><tr><th>Country</th><th>Datasets</th><th>Task breadth</th><th>Top-3 share</th><th>Top 3 tasks</th></tr></thead>
        <tbody>
          ${top20.map(d => `<tr>
            <td>${d.country}</td>
            <td>${d.total.toLocaleString()}</td>
            <td>${d.breadth}</td>
            <td>${d.top3Share}</td>
            <td style="font-size:12px;color:var(--muted)">${d.top3Names}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

/* ---- Chart 7: Language concentration (top 12 languages) -- */
function drawLanguageConcentration(core) {
  const wrap = document.getElementById('chart7-wrap');
  if (!wrap) return;
  wrap.innerHTML = '<canvas id="chart7"></canvas>';

  const langCountry = {};
  const langTotal   = {};
  core.forEach(r => {
    const countries = parseCountries(safeStr(r['all_countries_covered']));
    parseListField(safeStr(r['audited_languages'])).forEach(lang => {
      if (!lang) return;
      if (!langCountry[lang]) langCountry[lang] = {};
      langTotal[lang] = (langTotal[lang] || 0) + 1;
      countries.forEach(c => { langCountry[lang][c] = (langCountry[lang][c] || 0) + 1; });
    });
  });

  const top12 = Object.entries(langTotal).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k]) => k);

  const allCounts = {};
  top12.forEach(lang => {
    Object.entries(langCountry[lang] || {}).forEach(([c, v]) => { allCounts[c] = (allCounts[c] || 0) + v; });
  });
  const top5Countries = Object.entries(allCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k]) => k);

  const palette = ['#0C3340','#2A7088','#5AB4B8','#FF7A5C','#CAE9E1'];

  const datasets = [
    ...top5Countries.map((country, i) => ({
      label: country,
      data: top12.map(lang => {
        const t = langTotal[lang];
        return t > 0 ? Math.round(((langCountry[lang][country] || 0) / t) * 100) : 0;
      }),
      backgroundColor: palette[i],
      borderRadius: 2,
      borderSkipped: false,
    })),
    {
      label: 'Others',
      data: top12.map(lang => {
        const t = langTotal[lang];
        if (!t) return 0;
        const top5Sum = top5Countries.reduce((s, c) => s + (langCountry[lang][c] || 0), 0);
        return Math.round(((t - top5Sum) / t) * 100);
      }),
      backgroundColor: '#EAECEE',
      borderRadius: 2,
      borderSkipped: false,
    }
  ];

  new Chart(document.getElementById('chart7'), {
    type: 'bar',
    data: { labels: top12, datasets },
    options: {
      indexAxis: 'y',
      plugins: {
        legend: { position: 'bottom' },
        tooltip: { callbacks: { label: ctx => ' ' + ctx.dataset.label + ': ' + ctx.raw + '%' } }
      },
      scales: {
        x: { stacked: true, max: 100, grid: { color: 'rgba(0,0,0,.06)' }, ticks: { callback: v => v + '%' } },
        y: { stacked: true, grid: { display: false } },
      },
      responsive: true,
      maintainAspectRatio: false,
    }
  });
}
