/* ============================================================
   AtlasNLP — visualizations.js
   Four interactive visualizations: choropleth, heatmap,
   timeline, language landscape
   Data sourced from expanded CSV (one row per dataset × country)
   ============================================================ */

document.addEventListener('DOMContentLoaded', async () => {
  showSpinner(document.getElementById('viz1-wrap'));
  showSpinner(document.getElementById('viz2-wrap'));
  showSpinner(document.getElementById('viz3-wrap'));
  showSpinner(document.getElementById('viz4-wrap'));

  try {
    const [rows, world] = await Promise.all([
      loadExpandedCols(),
      fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json').then(r => r.json()),
    ]);

    drawChoropleth(rows, world);
    drawHeatmap(rows);
    drawTimeline(rows);
    drawLanguageBar(rows);
  } catch(e) {
    ['viz1','viz2','viz3','viz4'].forEach(id => {
      showError(document.getElementById(id + '-wrap'), e.message);
    });
  }
});

/* ============================================================
   Viz 1 — World Choropleth (with task filter)
   ============================================================ */
function drawChoropleth(rows, world) {
  const wrap    = document.getElementById('viz1-wrap');
  const tooltip = document.getElementById('viz1-tooltip');
  wrap.innerHTML = '';

  /* content_country is already a single value — no parsing needed */
  const countMap = {};
  const taskMap  = {};
  rows.forEach(r => {
    const c    = safeStr(r['content_country']);
    const task = safeStr(r['Task Category']) || 'Unknown';
    if (!c) return;
    const nc = normalizeCountryForMap(c);
    countMap[nc] = (countMap[nc] || 0) + 1;
    if (!taskMap[nc]) taskMap[nc] = {};
    taskMap[nc][task] = (taskMap[nc][task] || 0) + 1;
  });

  let activeCountMap = countMap;

  const nameMap = {};
  world.objects.countries.geometries.forEach(g => {
    if (g.properties && g.properties.name) nameMap[g.id] = g.properties.name;
  });

  const container = wrap;
  const W = container.clientWidth || 900;
  const H = Math.max(420, Math.round(W * 0.52));
  container.style.height = H + 'px';

  const svg = d3.select(container).append('svg')
    .attr('viewBox', `0 0 ${W} ${H}`)
    .attr('preserveAspectRatio', 'xMidYMid meet')
    .style('width', '100%').style('height', '100%').style('cursor', 'grab');
  svg.style('background', '#DFF1EC');

  const projection = d3.geoNaturalEarth1().scale(W / 6.2).translate([W / 2, H / 2]);
  const pathGen = d3.geoPath().projection(projection);

  const maxCount = Math.max(...Object.values(countMap), 1);
  const colorScale = d3.scaleSequentialLog().domain([1, maxCount]).interpolator(d3.interpolateBlues).clamp(true);

  const g = svg.append('g');

  g.append('path').datum({ type: 'Sphere' }).attr('d', pathGen).attr('fill', '#DFF1EC').attr('stroke', 'none');
  g.append('path').datum(d3.geoGraticule()()).attr('d', pathGen).attr('fill', 'none')
    .attr('stroke', 'rgba(255,255,255,.3)').attr('stroke-width', .4);

  g.selectAll('path.ctry')
    .data(topojson.feature(world, world.objects.countries).features)
    .enter().append('path').attr('class', 'ctry')
    .attr('d', pathGen)
    .attr('fill', d => { const name = nameMap[d.id] || ''; const cnt = countMap[name] || 0; return cnt > 0 ? colorScale(cnt) : '#CAE9E1'; })
    .attr('stroke', '#fff').attr('stroke-width', .4)
    .on('mousemove', function(event, d) {
      const name = nameMap[d.id] || 'Unknown';
      const cnt  = activeCountMap[name] || 0;
      const topTask = taskMap[name] ? Object.entries(taskMap[name]).sort((a, b) => b[1] - a[1])[0] : null;
      tooltip.style.position = 'fixed';
      tooltip.style.opacity = '1';
      tooltip.style.left = (event.clientX + 14) + 'px';
      tooltip.style.top  = (event.clientY - 14) + 'px';
      tooltip.innerHTML  = cnt > 0
        ? '<strong>' + name + '</strong><br>' + cnt.toLocaleString() + ' dataset' + (cnt !== 1 ? 's' : '')
          + (topTask ? '<br>Top task: ' + truncate(topTask[0], 30) : '')
        : '<strong>' + name + '</strong><br>No datasets';
    })
    .on('mouseleave', () => { tooltip.style.opacity = '0'; });

  g.append('path').datum(topojson.mesh(world, world.objects.countries, (a, b) => a !== b))
    .attr('d', pathGen).attr('fill', 'none').attr('stroke', '#fff').attr('stroke-width', .4);

  const zoom = d3.zoom().scaleExtent([1, 10]).on('zoom', e => { g.attr('transform', e.transform); });
  svg.call(zoom);
  document.getElementById('btn-map-reset').addEventListener('click', () => {
    svg.transition().duration(500).call(zoom.transform, d3.zoomIdentity);
  });

  function updateColors(newMap) {
    const m = Math.max(...Object.values(newMap), 1);
    const scale = d3.scaleSequentialLog().domain([1, m]).interpolator(d3.interpolateBlues).clamp(true);
    g.selectAll('path.ctry').attr('fill', d => {
      const name = nameMap[d.id] || '';
      const cnt  = newMap[name] || 0;
      return cnt > 0 ? scale(cnt) : '#CAE9E1';
    });
    buildGradientLegend(document.getElementById('viz1-legend'), scale, m, 'Fewer datasets', 'More datasets');
  }

  const taskSelect = document.getElementById('task-filter');
  if (taskSelect) {
    const allTasks = [...new Set(rows.map(r => safeStr(r['Task Category'])).filter(Boolean))].sort();
    allTasks.forEach(task => {
      const opt = document.createElement('option');
      opt.value = task; opt.textContent = truncate(task, 55);
      taskSelect.appendChild(opt);
    });
    taskSelect.addEventListener('change', () => {
      const sel = taskSelect.value;
      if (!sel) {
        activeCountMap = countMap;
      } else {
        const filtered = {};
        rows.forEach(r => {
          if (safeStr(r['Task Category']) === sel) {
            const c = safeStr(r['content_country']);
            if (c) {
              const nc = normalizeCountryForMap(c);
              filtered[nc] = (filtered[nc] || 0) + 1;
            }
          }
        });
        activeCountMap = filtered;
      }
      updateColors(activeCountMap);
    });
  }

  buildGradientLegend(document.getElementById('viz1-legend'), colorScale, maxCount, 'Fewer datasets', 'More datasets');
}

function buildGradientLegend(el, scale, max, labelMin, labelMax) {
  if (!el) return;
  const steps = 10;
  const swatches = Array.from({ length: steps }, (_, i) => {
    const v = Math.pow(max, i / (steps - 1));
    return `<span style="display:inline-block;width:${100/steps}%;height:12px;background:${scale(v)};"></span>`;
  }).join('');
  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:.75rem;font-size:.8rem;color:var(--surf-slate);">
      <span>${labelMin}</span>
      <div style="flex:1;display:flex;border-radius:4px;overflow:hidden;">${swatches}</div>
      <span>${labelMax}</span>
    </div>`;
}

/* ============================================================
   Viz 2 — Country × Task Heatmap
   ============================================================ */
function drawHeatmap(rows) {
  const wrap    = document.getElementById('viz2-wrap');
  const tooltip = document.getElementById('viz2-tooltip');
  wrap.innerHTML = '';

  const matrix       = {};
  const countryCounts = {};
  const taskCounts    = {};

  rows.forEach(r => {
    const c    = safeStr(r['content_country']);
    const task = safeStr(r['Task Category']) || 'Unknown';
    if (!c) return;
    const key = `${c}|||${task}`;
    matrix[key]      = (matrix[key]      || 0) + 1;
    countryCounts[c] = (countryCounts[c] || 0) + 1;
    taskCounts[task] = (taskCounts[task] || 0) + 1;
  });

  const TOP_C = 30, TOP_T = 20;
  const topCountries = Object.entries(countryCounts).sort((a, b) => b[1] - a[1]).slice(0, TOP_C).map(([k]) => k);
  const topTasks     = Object.entries(taskCounts).sort((a, b) => b[1] - a[1]).slice(0, TOP_T).map(([k]) => k);

  const cellW = 28, cellH = 22;
  const marginL = 140, marginT = 120, marginR = 20, marginB = 20;
  const W = marginL + topTasks.length * cellW + marginR;
  const H = marginT + topCountries.length * cellH + marginB;

  const maxVal = Math.max(...topCountries.flatMap(c => topTasks.map(t => matrix[`${c}|||${t}`] || 0)), 1);
  const colorScale = d3.scaleSequentialSqrt()
    .domain([0, maxVal])
    .interpolator(d3.interpolateBlues);

  const svg = d3.select(wrap).append('svg')
    .attr('width', W)
    .attr('height', H)
    .style('font-size', '11px');

  const g = svg.append('g').attr('transform', `translate(${marginL},${marginT})`);

  g.selectAll('.task-label')
    .data(topTasks)
    .enter().append('text')
    .attr('class', 'task-label')
    .attr('x', (_, i) => i * cellW + cellW / 2)
    .attr('y', -8)
    .attr('text-anchor', 'start')
    .attr('transform', (_, i) => `rotate(-55, ${i * cellW + cellW / 2}, -8)`)
    .attr('fill', '#566573')
    .text(d => truncate(d, 28));

  g.selectAll('.country-label')
    .data(topCountries)
    .enter().append('text')
    .attr('class', 'country-label')
    .attr('x', -6)
    .attr('y', (_, i) => i * cellH + cellH / 2 + 4)
    .attr('text-anchor', 'end')
    .attr('fill', '#566573')
    .text(d => d);

  topCountries.forEach((country, ci) => {
    topTasks.forEach((task, ti) => {
      const val = matrix[`${country}|||${task}`] || 0;
      g.append('rect')
        .attr('x', ti * cellW)
        .attr('y', ci * cellH)
        .attr('width', cellW - 1)
        .attr('height', cellH - 1)
        .attr('rx', 2)
        .attr('fill', val > 0 ? colorScale(val) : '#f0f4f8')
        .on('mousemove', function(event) {
          tooltip.style.position = 'fixed';
          tooltip.style.opacity = '1';
          tooltip.style.left = (event.clientX + 14) + 'px';
          tooltip.style.top  = (event.clientY - 14) + 'px';
          tooltip.innerHTML  = `<strong>${country}</strong> × <strong>${truncate(task, 40)}</strong><br>${val.toLocaleString()} dataset${val !== 1 ? 's' : ''}`;
        })
        .on('mouseleave', () => { tooltip.style.opacity = '0'; });

      if (val > 0 && cellW >= 24) {
        g.append('text')
          .attr('x', ti * cellW + cellW / 2)
          .attr('y', ci * cellH + cellH / 2 + 4)
          .attr('text-anchor', 'middle')
          .attr('font-size', '9')
          .attr('fill', val > maxVal * 0.6 ? '#fff' : '#2C3E50')
          .text(val);
      }
    });
  });
}

/* ============================================================
   Viz 3 — Timeline (datasets per year, deduped by name)
   ============================================================ */
function drawTimeline(rows) {
  const wrap = document.getElementById('viz3-wrap');
  wrap.innerHTML = '<canvas id="viz3-canvas" style="max-height:380px;"></canvas>';

  const yearMap = {};
  const seen = new Set();
  rows.forEach(r => {
    const name = safeStr(r['Dataset name']);
    if (!name || seen.has(name)) return;
    seen.add(name);
    const y = parseInt(r['Year created']);
    if (!isNaN(y) && y >= 1990 && y <= 2030) yearMap[y] = (yearMap[y] || 0) + 1;
  });

  const allYears = Object.keys(yearMap).map(Number).sort((a, b) => a - b);

  new Chart(document.getElementById('viz3-canvas'), {
    type: 'line',
    data: {
      labels: allYears,
      datasets: [{
        label: 'AtlasNLP Core',
        data: allYears.map(y => yearMap[y]),
        borderColor: '#2A7088',
        backgroundColor: 'rgba(42,112,136,.12)',
        fill: true,
        tension: .35,
        pointRadius: 3,
        pointHoverRadius: 6,
      }]
    },
    options: {
      plugins: {
        legend: { display: false },
        tooltip: { mode: 'index', intersect: false },
      },
      scales: {
        x: { grid: { color: 'rgba(0,0,0,.05)' } },
        y: { grid: { color: 'rgba(0,0,0,.05)' }, ticks: { callback: v => v.toLocaleString() } },
      },
      responsive: true,
      maintainAspectRatio: true,
    }
  });
}

/* ============================================================
   Viz 4 — Language Landscape (top 25 languages, deduped)
   ============================================================ */
function drawLanguageBar(rows) {
  const wrap = document.getElementById('viz4-wrap');
  wrap.innerHTML = '<canvas id="viz4-canvas" style="max-height:560px;"></canvas>';

  const langMap = {};
  const seen = new Set();
  rows.forEach(r => {
    const name = safeStr(r['Dataset name']);
    if (!name || seen.has(name)) return;
    seen.add(name);
    parseListField(safeStr(r['languages_in_dataset']), /;/).forEach(l => {
      if (l) langMap[l] = (langMap[l] || 0) + 1;
    });
  });

  const sorted = Object.entries(langMap).sort((a, b) => b[1] - a[1]).slice(0, 25);
  const labels = sorted.map(([k]) => k);
  const data   = sorted.map(([, v]) => v);
  const maxVal = Math.max(...data);

  const colors = data.map(v => {
    const t = v / maxVal;
    return `rgba(${Math.round(27 + (1-t)*120)}, ${Math.round(79 + (1-t)*80)}, ${Math.round(114 + (1-t)*60)}, 0.85)`;
  });

  new Chart(document.getElementById('viz4-canvas'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderRadius: 4,
        borderSkipped: false,
      }]
    },
    options: {
      indexAxis: 'y',
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: {
          label: ctx => ` ${ctx.raw.toLocaleString()} datasets`
        }}
      },
      scales: {
        x: { grid: { color: 'rgba(0,0,0,.06)' }, ticks: { callback: v => v.toLocaleString() } },
        y: { grid: { display: false } },
      },
      responsive: true,
      maintainAspectRatio: false,
    }
  });
}
