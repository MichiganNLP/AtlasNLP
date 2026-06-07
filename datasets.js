/* ============================================================
   AtlasNLP — datasets.js
   Dataset explorer: load, filter, sort, paginate, download
   ============================================================ */

const PAGE_SIZE = 25;

/* ---- Valid country list (matches valid_countries.csv) ----- */
const VALID_COUNTRIES = new Set([
  'Afghanistan','Albania','Algeria','Andorra','Angola','Antigua and Barbuda',
  'Argentina','Armenia','Australia','Austria','Azerbaijan','Bahamas','Bahrain',
  'Bangladesh','Barbados','Belarus','Belgium','Belize','Benin','Bhutan',
  'Bolivia','Bosnia and Herzegovina','Botswana','Brazil','Brunei','Bulgaria',
  'Burkina Faso','Burundi','Cabo Verde','Cambodia','Cameroon','Canada',
  'Central African Republic','Chad','Chile','China','Colombia','Comoros',
  'Congo (Congo-Brazzaville)','Costa Rica',"Cote d'Ivoire",'Croatia','Cuba',
  'Cyprus','Czechia','Democratic Republic of the Congo','Denmark','Djibouti',
  'Dominica','Dominican Republic','Ecuador','Egypt','El Salvador',
  'Equatorial Guinea','Eritrea','Estonia','Eswatini','Ethiopia','Fiji',
  'Finland','France','Gabon','Gambia','Georgia','Germany','Ghana','Greece',
  'Grenada','Guatemala','Guinea','Guinea-Bissau','Guyana','Haiti','Honduras',
  'Hungary','Iceland','India','Indonesia','Iran','Iraq','Ireland','Israel',
  'Italy','Jamaica','Japan','Jordan','Kazakhstan','Kenya','Kiribati','Kosovo',
  'Kuwait','Kyrgyzstan','Laos','Latvia','Lebanon','Lesotho','Liberia','Libya',
  'Liechtenstein','Lithuania','Luxembourg','Madagascar','Malawi','Malaysia',
  'Maldives','Mali','Malta','Marshall Islands','Mauritania','Mauritius',
  'Mexico','Micronesia','Moldova','Monaco','Mongolia','Montenegro','Morocco',
  'Mozambique','Myanmar','Namibia','Nauru','Nepal','Netherlands','New Zealand',
  'Nicaragua','Niger','Nigeria','North Korea','North Macedonia','Norway',
  'Oman','Pakistan','Palau','Palestine','Panama','Papua New Guinea','Paraguay',
  'Peru','Philippines','Poland','Portugal','Qatar','Romania','Russia','Rwanda',
  'Saint Kitts and Nevis','Saint Lucia','Saint Vincent and the Grenadines',
  'Samoa','San Marino','São Tomé and Príncipe','Saudi Arabia','Senegal',
  'Serbia','Seychelles','Sierra Leone','Singapore','Slovakia','Slovenia',
  'Solomon Islands','Somalia','South Africa','South Korea','South Sudan',
  'Spain','Sri Lanka','Sudan','Suriname','Sweden','Switzerland','Syria',
  'Taiwan','Tajikistan','Tanzania','Thailand','Timor-Leste','Togo','Tonga',
  'Trinidad and Tobago','Tunisia','Turkey','Turkmenistan','Tuvalu','Uganda',
  'Ukraine','United Arab Emirates','United Kingdom','United States','Uruguay',
  'Uzbekistan','Vanuatu','Vatican City','Venezuela','Vietnam','Yemen',
  'Zambia','Zimbabwe','Unspecified',
]);

/* ---- Normalize a year value -------------------------------- */
function normalizeYear(val) {
  const s = String(val).trim();
  if (/^\d{2}$/.test(s)) return 2000 + parseInt(s, 10);
  const n = parseInt(s, 10);
  return isNaN(n) ? null : n;
}

let allRows    = [];  /* merged Core + Gold */
let filtered   = [];
let sortCol    = '';
let sortDir    = 'asc';
let currentPage = 1;
let activeFilters = {};  /* key → value */

/* ---- Column display labels ------------------------------- */
const CORE_DISPLAY = {
  'Dataset name':                              'Dataset',
  'Task Category':                             'Task',
  'all_countries_covered':                     'Countries',
  'audited_languages':                         'Languages',
  'Year created':                              'Year',
  'Language coverage type':                    'Lang. Coverage',
  'Is the dataset multimodal?':                'Multimodal',
  'Is dataset in multiple choice format?':     'MC Format',
  'Synthetic?':                                'Synthetic',
  'Origin Type':                               'Origin',
  'Primary Modality':                          'Modality',
  'num_content_countries':                     '# Countries',
  'num_producer_countries':                    '# Producers',
  'License':                                   'License',
};

const GOLD_DISPLAY = {
  'Dataset name':                                          'Dataset',
  'Assigned country':                                      'Assigned Country',
  'Country resource level':                                'Resource Level',
  'Task Category':                                         'Task',
  'All Countries Covered (you can select multiple countries)': 'Countries',
  'audited_languages':                                     'Languages',
  'Year created':                                          'Year',
  'Language coverage type':                                'Lang. Coverage',
  'Is the dataset multimodal?':                            'Multimodal',
  'Is dataset in multiple choice format?':                 'MC Format',
  'Synthetic?':                                            'Synthetic',
  'Origin Type':                                           'Origin',
  'License':                                               'License',
  'Country Attribution Method':                            'Attribution',
};

/* Table columns shown (in order) for each source */
const CORE_TABLE_COLS = [
  'Dataset name', 'Task Category', 'all_countries_covered', 'audited_languages',
  'Year created', 'Primary Modality', 'Is the dataset multimodal?', 'Synthetic?', 'License',
];
const GOLD_TABLE_COLS = [
  'Dataset name', 'Assigned country', 'Country resource level', 'Task Category',
  'All Countries Covered (you can select multiple countries)', 'audited_languages',
  'Year created', 'Country Attribution Method', 'Is the dataset multimodal?', 'Synthetic?',
];

/* ---- Init ------------------------------------------------ */
document.addEventListener('DOMContentLoaded', async () => {
  const mainWrap = document.getElementById('datasets-main');
  showSpinner(mainWrap);

  try {
    const [core, gold] = await Promise.all([loadCoreCols(), loadGoldCols()]);

    const coreTagged = core.map(r => ({ ...r, _source: 'core' }));
    const goldTagged = gold.map(r => ({ ...r, _source: 'gold' }));
    allRows = [...coreTagged, ...goldTagged];

    populateFilters(core, gold);
    applyFilters();
    mainWrap.innerHTML = '';
    renderAll();
  } catch(e) {
    showError(mainWrap, e.message);
  }
});

/* ---- Populate filter dropdowns --------------------------- */
function populateFilters(core, gold) {
  /* Source toggle */
  document.querySelectorAll('.toggle-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.toggle-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilters['_source'] = btn.dataset.source;
      currentPage = 1;
      applyFilters();
      renderAll();
    });
  });

  /* Task dropdown — from Core */
  const tasks = [...new Set(core.map(r => safeStr(r['Task Category'])).filter(Boolean))].sort();
  const taskSel = document.getElementById('filter-task');
  tasks.forEach(t => { const o = document.createElement('option'); o.value = t; o.textContent = truncate(t, 60); taskSel.appendChild(o); });

  /* Country dropdown — valid countries only */
  const countrySet = new Set();
  [...core, ...gold].forEach(r => {
    parseListField(safeStr(r['all_countries_covered'] || r['All Countries Covered (you can select multiple countries)'])).forEach(c => {
      if (VALID_COUNTRIES.has(c)) countrySet.add(c);
    });
  });
  const countrySel = document.getElementById('filter-country');
  [...countrySet].sort().forEach(c => { const o = document.createElement('option'); o.value = c; o.textContent = c; countrySel.appendChild(o); });

  /* Year range — normalize 2-digit years, clamp to valid range */
  const years = [...core, ...gold].map(r => normalizeYear(r['Year created'])).filter(y => y !== null && y >= 1952 && y <= 2026);
  const minY = Math.min(...years), maxY = Math.max(...years);
  const yearFrom = document.getElementById('filter-year-from');
  const yearTo   = document.getElementById('filter-year-to');
  yearFrom.min = minY; yearFrom.max = maxY; yearFrom.placeholder = minY;
  yearTo.min   = minY; yearTo.max   = maxY; yearTo.placeholder   = maxY;

  /* Language dropdown */
  const langSet = new Set();
  [...core, ...gold].forEach(r => parseListField(safeStr(r['audited_languages'])).forEach(l => langSet.add(l)));
  const langSel = document.getElementById('filter-lang');
  [...langSet].sort().forEach(l => { const o = document.createElement('option'); o.value = l; o.textContent = l; langSel.appendChild(o); });

  /* Modality */
  const modalSet = new Set(core.map(r => safeStr(r['Primary Modality'])).filter(Boolean));
  const modalSel = document.getElementById('filter-modality');
  [...modalSet].sort().forEach(m => { const o = document.createElement('option'); o.value = m; o.textContent = m; modalSel.appendChild(o); });

  /* Resource level (Gold only) */
  const resSet = new Set(gold.map(r => safeStr(r['Country resource level'])).filter(Boolean));
  const resSel = document.getElementById('filter-resource');
  [...resSet].sort().forEach(lv => { const o = document.createElement('option'); o.value = lv; o.textContent = lv; resSel.appendChild(o); });

  /* Attach change handlers */
  const handlers = {
    'filter-task':       v => { activeFilters['Task Category'] = v; },
    'filter-country':    v => { activeFilters['_country'] = v; },
    'filter-year-from':  v => { activeFilters['_yearFrom'] = v; },
    'filter-year-to':    v => { activeFilters['_yearTo'] = v; },
    'filter-lang':       v => { activeFilters['_lang'] = v; },
    'filter-modality':   v => { activeFilters['Primary Modality'] = v; },
    'filter-resource':   v => { activeFilters['Country resource level'] = v; },
  };
  Object.entries(handlers).forEach(([id, fn]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('change', () => { fn(el.value); currentPage = 1; applyFilters(); renderAll(); });
  });

  /* Search */
  const searchEl = document.getElementById('filter-search');
  searchEl.addEventListener('input', () => {
    activeFilters['_search'] = searchEl.value.trim().toLowerCase();
    currentPage = 1;
    applyFilters();
    renderAll();
  });

  /* Clear button */
  document.getElementById('btn-clear').addEventListener('click', () => {
    activeFilters = {};
    document.querySelectorAll('.filter-group input, .filter-group select').forEach(el => { el.value = ''; });
    document.querySelectorAll('.toggle-pill').forEach((b, i) => { b.classList.toggle('active', i === 0); });
    currentPage = 1;
    applyFilters();
    renderAll();
  });

  /* Download */
  document.getElementById('btn-download').addEventListener('click', downloadFiltered);
}

/* ---- Apply filters --------------------------------------- */
function applyFilters() {
  filtered = allRows.filter(r => {
    /* Source */
    if (activeFilters['_source'] && activeFilters['_source'] !== 'all') {
      if (r._source !== activeFilters['_source']) return false;
    }
    /* Task */
    if (activeFilters['Task Category']) {
      if (safeStr(r['Task Category']) !== activeFilters['Task Category']) return false;
    }
    /* Country */
    if (activeFilters['_country']) {
      const countries = parseListField(safeStr(r['all_countries_covered'] || r['All Countries Covered (you can select multiple countries)']));
      if (!countries.includes(activeFilters['_country'])) return false;
    }
    /* Year from/to */
    const year = normalizeYear(r['Year created']);
    if (activeFilters['_yearFrom'] && year !== null && year < parseInt(activeFilters['_yearFrom'])) return false;
    if (activeFilters['_yearTo']   && year !== null && year > parseInt(activeFilters['_yearTo']))   return false;
    /* Language */
    if (activeFilters['_lang']) {
      const langs = parseListField(safeStr(r['audited_languages']));
      if (!langs.includes(activeFilters['_lang'])) return false;
    }
    /* Modality */
    if (activeFilters['Primary Modality']) {
      if (safeStr(r['Primary Modality']) !== activeFilters['Primary Modality']) return false;
    }
    /* Resource level */
    if (activeFilters['Country resource level']) {
      if (safeStr(r['Country resource level']) !== activeFilters['Country resource level']) return false;
    }
    /* Search */
    if (activeFilters['_search']) {
      const q = activeFilters['_search'];
      const haystack = [
        r['Dataset name'], r['Short description about dataset'], r['Task Category']
      ].map(v => safeStr(v).toLowerCase()).join(' ');
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  /* Sort */
  if (sortCol) {
    filtered.sort((a, b) => {
      const va = safeStr(a[sortCol]).toLowerCase();
      const vb = safeStr(b[sortCol]).toLowerCase();
      const nA = parseFloat(va), nB = parseFloat(vb);
      const cmp = !isNaN(nA) && !isNaN(nB) ? nA - nB : va.localeCompare(vb);
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }
}

/* ---- Determine which source is active -------------------- */
function activeSource() {
  const pill = document.querySelector('.toggle-pill.active');
  return pill ? pill.dataset.source : 'all';
}

/* ---- Render all ------------------------------------------ */
function renderAll() {
  renderCount();
  renderTable();
  renderPagination();
}

function renderCount() {
  const el = document.getElementById('result-count');
  if (el) el.textContent = `Showing ${filtered.length.toLocaleString()} dataset${filtered.length !== 1 ? 's' : ''}`;
}

/* ---- Table ----------------------------------------------- */
function renderTable() {
  const wrap = document.getElementById('table-wrap');
  const src  = activeSource();
  const cols = src === 'gold' ? GOLD_TABLE_COLS : CORE_TABLE_COLS;
  const labels = src === 'gold' ? GOLD_DISPLAY : CORE_DISPLAY;

  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  if (filtered.length === 0) {
    wrap.innerHTML = '<p class="text-muted" style="padding:2rem;">No datasets match the current filters.</p>';
    return;
  }

  const thead = `<thead><tr>${cols.map(c => {
    const cls = c === sortCol ? `sortable sort-${sortDir}` : 'sortable';
    return `<th class="${cls}" data-col="${c}">${labels[c] || c}<span class="sort-arrow"></span></th>`;
  }).join('')}</tr></thead>`;

  const tbody = `<tbody>${pageRows.map(r => {
    const src = r._source;
    return `<tr>${cols.map(c => renderCell(r, c, src)).join('')}</tr>`;
  }).join('')}</tbody>`;

  wrap.innerHTML = `<div class="table-wrap"><table>${thead}${tbody}</table></div>`;

  wrap.querySelectorAll('thead th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.col;
      if (sortCol === col) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
      else { sortCol = col; sortDir = 'asc'; }
      applyFilters();
      renderAll();
    });
  });
}

function renderCell(r, col, src) {
  const val = safeStr(r[col]);

  if (col === 'Dataset name') {
    const paper = safeStr(r['Paper Link (URL)']);
    const ds    = safeStr(r['Dataset Link (URL)']);
    const name  = val || '—';
    const link  = paper || ds;
    let html = link ? `<a href="${link}" target="_blank" rel="noopener">${name}</a>` : name;
    if (src === 'gold') html += ' <span class="badge badge--gold" style="font-size:.7rem;vertical-align:middle;">Gold</span>';
    /* Show description as title tooltip */
    const desc = safeStr(r['Short description about dataset']);
    return `<td title="${desc.replace(/"/g, '&quot;')}">${html}</td>`;
  }

  if (col === 'all_countries_covered' || col === 'All Countries Covered (you can select multiple countries)') {
    const cs = parseListField(val);
    if (!cs.length) return '<td>—</td>';
    const shown = cs.slice(0, 3).map(c => `<span class="badge badge--blue">${c}</span>`).join(' ');
    const more  = cs.length > 3 ? ` <span class="text-muted text-sm">+${cs.length - 3}</span>` : '';
    return `<td>${shown}${more}</td>`;
  }

  if (col === 'audited_languages') {
    const ls = parseListField(val);
    if (!ls.length) return '<td>—</td>';
    const shown = ls.slice(0, 2).join(', ');
    const more  = ls.length > 2 ? ` +${ls.length - 2}` : '';
    return `<td>${shown}<span class="text-muted">${more}</span></td>`;
  }

  if (col === 'Country resource level') {
    const cls = val === 'Low' ? 'badge--red' : val === 'High' ? 'badge--green' : 'badge--gold';
    return val ? `<td><span class="badge ${cls}">${val}</span></td>` : '<td>—</td>';
  }

  if (col === 'Is the dataset multimodal?' || col === 'Synthetic?' || col === 'Is dataset in multiple choice format?') {
    const cls = val === 'Yes' ? 'badge--green' : val === 'No' ? 'badge--gray' : 'badge--gray';
    return val ? `<td><span class="badge ${cls}">${val}</span></td>` : '<td>—</td>';
  }

  if (col === 'Task Category') {
    return `<td title="${val}">${truncate(val, 45) || '—'}</td>`;
  }

  return `<td>${val || '—'}</td>`;
}

/* ---- Pagination ------------------------------------------ */
function renderPagination() {
  const wrap  = document.getElementById('pagination');
  const total = Math.ceil(filtered.length / PAGE_SIZE);
  if (!wrap) return;
  if (total <= 1) { wrap.innerHTML = ''; return; }

  const makeBtn = (label, page, disabled = false, active = false) =>
    `<button data-page="${page}" ${disabled ? 'disabled' : ''} ${active ? 'class="active"' : ''}>${label}</button>`;

  let html = makeBtn('‹ Prev', currentPage - 1, currentPage === 1);

  const delta = 2;
  const pages = new Set([1, total]);
  for (let p = Math.max(1, currentPage - delta); p <= Math.min(total, currentPage + delta); p++) pages.add(p);
  const sorted = [...pages].sort((a, b) => a - b);

  let prev = 0;
  sorted.forEach(p => {
    if (p - prev > 1) html += `<span class="pagination__ellipsis">…</span>`;
    html += makeBtn(p, p, false, p === currentPage);
    prev = p;
  });

  html += makeBtn('Next ›', currentPage + 1, currentPage === total);
  wrap.innerHTML = html;

  wrap.querySelectorAll('button[data-page]').forEach(btn => {
    btn.addEventListener('click', () => {
      currentPage = parseInt(btn.dataset.page);
      applyFilters();
      renderAll();
      window.scrollTo({ top: document.getElementById('datasets-section').offsetTop - 80, behavior: 'smooth' });
    });
  });
}

/* ---- Download -------------------------------------------- */
function downloadFiltered() {
  const src  = activeSource();
  const cols = src === 'gold' ? GOLD_TABLE_COLS : CORE_TABLE_COLS;
  const header = cols.join(',');
  const body = filtered.map(r =>
    cols.map(c => {
      const v = safeStr(r[c]);
      return v.includes(',') || v.includes('"') || v.includes('\n')
        ? `"${v.replace(/"/g, '""')}"`
        : v;
    }).join(',')
  ).join('\n');
  const blob = new Blob([header + '\n' + body], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'atlasnlp-filtered.csv';
  a.click();
  URL.revokeObjectURL(url);
}
