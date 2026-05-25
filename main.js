/* ============================================================
   AtlasNLP — main.js   Shared utilities on every page
   ============================================================ */

const CSV = {
  core: 'automated_full_set_with_audited_languages.csv',
  gold: 'human_validated_set_with_audited_languages.csv',
};

/* --- Column lists ------------------------------------------ */
const CORE_COLS = [
  'Dataset name','Task Category','Country Attribution Method','Year created',
  'Language coverage type','Dataset Link (URL)','Paper Link (URL)',
  'Is the dataset multimodal?','Is dataset in multiple choice format?',
  'Short description about dataset','License','Origin Type','Synthetic?',
  'Synthetic notes (e.g. machine translated?)','Multi Country?','Primary Modality',
  'all_countries_covered','num_content_countries','author_affiliation_type_final',
  'author_affiliation_type_final_source','producer_countries','num_producer_countries',
  'canonical_language (no sign languages)','audited_languages','num_audited_languages',
];

const GOLD_COLS = [
  'Assigned country','Country resource level','Dataset name','Task Category',
  'Country Attribution Method','Year created','Audited languages','num_audited_languages',
  'Language coverage type','Dataset Link (URL)','Paper Link (URL)',
  'Is the dataset multimodal?','Is dataset in multiple choice format?',
  'Short description about dataset','License','Origin Type','Synthetic?',
  'Synthetic notes (e.g. machine translated?)','Multi Country?',
  'All Countries Covered (you can select multiple countries)','Notes','Supplementary',
];

/* --- CSV loaders ------------------------------------------- */
function loadCSV(path) {
  return new Promise((resolve, reject) => {
    Papa.parse(path, {
      download: true, header: true, skipEmptyLines: true,
      complete: r => resolve(r.data),
      error:    e => reject(e),
    });
  });
}
function loadCoreCols() {
  return loadCSV(CSV.core).then(rows => rows.map(r => {
    const o = {}; CORE_COLS.forEach(c => { o[c] = r[c] ?? ''; }); return o;
  }));
}
function loadGoldCols() {
  return loadCSV(CSV.gold).then(rows => rows.map(r => {
    const o = {}; GOLD_COLS.forEach(c => { o[c] = r[c] ?? ''; });
    /* Normalise renamed column so all downstream code can use 'audited_languages' */
    o['audited_languages'] = o['Audited languages'] || o['audited_languages'] || '';
    return o;
  }));
}

/* --- Utilities --------------------------------------------- */
function fmt(n) {
  const num = Number(n);
  return isNaN(num) ? (n || '—') : num.toLocaleString();
}
function parseListField(val, sep = /[;,]+/) {
  if (!val || String(val).trim() === '' || String(val).toLowerCase() === 'nan') return [];
  return String(val).split(sep).map(s => s.trim()).filter(Boolean);
}
/* Deduplicated country list — guards against rows where the field contains
   both comma- and semicolon-separated duplicates (e.g. "A, B; A; B"). */
function parseCountries(val) {
  return [...new Set(parseListField(val))];
}
function truncate(str, n = 100) {
  if (!str) return '';
  return str.length > n ? str.slice(0, n).trimEnd() + '…' : str;
}
function safeStr(val) {
  if (val == null || val === '' || String(val).toLowerCase() === 'nan') return '';
  return String(val).trim();
}

/* --- Spinner / error --------------------------------------- */
function showSpinner(el) {
  el.innerHTML = `<div class="spinner-wrap"><div class="spinner"></div><span>Loading…</span></div>`;
}
function showError(el, msg) {
  el.innerHTML = `<div class="error-msg">Failed to load data: ${msg}</div>`;
}

/* --- Country name normalisation (CSV → TopoJSON names) ---- */
const COUNTRY_ALIASES = {
  'United States': 'United States of America',
  'USA': 'United States of America',
  'U.S.': 'United States of America',
  'U.S.A.': 'United States of America',
  'Czech Republic': 'Czechia',
  'UAE': 'United Arab Emirates',
  'Korea': 'South Korea',
  'Republic of Korea': 'South Korea',
  'UK': 'United Kingdom',
  'Great Britain': 'United Kingdom',
  'England': 'United Kingdom',
  'Scotland': 'United Kingdom',
  'The Netherlands': 'Netherlands',
  'KSA': 'Saudi Arabia',
  'Bosnia and Herzegovina': 'Bosnia and Herz.',
  'Dominican Republic': 'Dominican Rep.',
  'North Macedonia': 'Macedonia',
  'Ivory Coast': "Côte d'Ivoire",
  "Cote d'Ivoire": "Côte d'Ivoire",
  'DR Congo': 'Dem. Rep. Congo',
  'DRC': 'Dem. Rep. Congo',
  'Democratic Republic of Congo': 'Dem. Rep. Congo',
  'Democratic Republic of the Congo': 'Dem. Rep. Congo',
  'Republic of Congo': 'Congo',
  'South Sudan': 'S. Sudan',
  'Eswatini': 'eSwatini',
  'Swaziland': 'eSwatini',
  'East Timor': 'Timor-Leste',
  'Palestinian Territory': 'Palestine',
  'Palestinian Territories': 'Palestine',
  'Central African Republic': 'Central African Rep.',
  'Equatorial Guinea': 'Eq. Guinea',
  'Solomon Islands': 'Solomon Is.',
  'Trinidad & Tobago': 'Trinidad and Tobago',
};

function normalizeCountryForMap(name) {
  return COUNTRY_ALIASES[name] || name;
}

/* --- Nav --------------------------------------------------- */
function initNav() {
  const hamburger = document.querySelector('.hamburger');
  const links     = document.querySelector('.nav-links');
  if (hamburger && links) {
    hamburger.addEventListener('click', () => links.classList.toggle('open'));
  }
  const current = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links .nl').forEach(a => {
    const href = a.getAttribute('href');
    if (href && href.split('/').pop() === current) a.classList.add('active');
  });
}

document.addEventListener('DOMContentLoaded', initNav);
