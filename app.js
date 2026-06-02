const STORAGE_KEY   = 'startracker_watched';
const THEME_KEY     = 'startracker_theme';
const FILTERS_KEY   = 'startracker_filters_visible';

let catalog = [];
let watched = {};
let activeEras    = new Set();   // empty = all
let activeTypes   = new Set();   // empty = all
let activeStatuses = new Set();  // empty = all
let activeSort = 'chronological';
let activeSortDir = 'asc';
let searchQuery = '';

function applyTheme(theme) {
  document.documentElement.classList.toggle('light', theme === 'light');
  const btn = document.getElementById('themeBtn');
  if (btn) btn.title = theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode';
}

function applyFiltersVisible(visible) {
  document.getElementById('filtersCol').classList.toggle('filters-hidden', !visible);
  document.getElementById('filtersToggleBtn').classList.toggle('filters-collapsed', !visible);
}

async function init() {
  applyTheme(localStorage.getItem(THEME_KEY) || 'light');
  applyFiltersVisible(localStorage.getItem(FILTERS_KEY) !== 'false');
  const res = await fetch('catalog.json');
  catalog = (await res.json()).content;
  watched = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  render();
  bindEvents();
  renderFooter();
}

// ── Watched state helpers ────────────────────────────────────────────────────

function getMovieWatched(id) {
  return !!watched[id];
}

function setMovieWatched(id, val) {
  watched[id] = val;
  save();
}

function getEpWatched(seriesId, season, ep) {
  return !!(watched[seriesId]?.[season]?.[ep]);
}

function setEpWatched(seriesId, season, ep, val) {
  if (!watched[seriesId]) watched[seriesId] = {};
  if (!watched[seriesId][season]) watched[seriesId][season] = {};
  watched[seriesId][season][ep] = val;
  save();
}

function setSeasonWatched(seriesId, seasonNum, episodes, val) {
  if (!watched[seriesId]) watched[seriesId] = {};
  if (!watched[seriesId][seasonNum]) watched[seriesId][seasonNum] = {};
  for (const ep of episodes) {
    watched[seriesId][seasonNum][ep.episode] = val;
  }
  save();
}

function setSeriesWatched(item, val) {
  if (!watched[item.id]) watched[item.id] = {};
  for (const s of item.seasons) {
    if (!watched[item.id][s.season]) watched[item.id][s.season] = {};
    for (const ep of s.episodes) {
      watched[item.id][s.season][ep.episode] = val;
    }
  }
  save();
}

// ── Comic issue state (flat issue-keyed map, grouped into arcs for display) ────

function getIssueRead(comicId, issue) {
  return !!(watched[comicId]?.[issue]);
}

function setIssueRead(comicId, issue, val) {
  if (!watched[comicId]) watched[comicId] = {};
  watched[comicId][issue] = val;
  save();
}

function setArcRead(comicId, arc, val) {
  if (!watched[comicId]) watched[comicId] = {};
  for (const is of arc.issues) watched[comicId][is.issue] = val;
  save();
}

function setComicRead(item, val) {
  if (!watched[item.id]) watched[item.id] = {};
  for (const a of item.arcs) for (const is of a.issues) watched[item.id][is.issue] = val;
  save();
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(watched));
  updateStats();
}

// ── Type helpers ─────────────────────────────────────────────────────────────

function itemTypes(item) { return Array.isArray(item.type) ? item.type : [item.type]; }
function isMovie(item)  { const t = itemTypes(item); return t.includes('movie') || t.includes('short-movie'); }
function isSeries(item) { const t = itemTypes(item); return t.includes('series') || t.includes('tv-shorts'); }
function isNovel(item)  { const t = itemTypes(item); return t.includes('novel') || t.includes('ya-novel') || t.includes('junior-novel') || t.includes('young-reader'); }
function isGame(item)       { const t = itemTypes(item); return t.includes('console-game') || t.includes('vr-game') || t.includes('browser-game') || t.includes('mobile-game'); }
function isAudioDrama(item) { const t = itemTypes(item); return t.includes('audio-drama'); }
function isComic(item)        { const t = itemTypes(item); return t.includes('comic'); }
function isGraphicNovel(item) { const t = itemTypes(item); return t.includes('graphic-novel'); }

// ── Progress calculations ────────────────────────────────────────────────────

function movieMinutes(item) { return item.duration; }

function seriesMinutes(item) {
  return item.seasons.reduce((t, s) => t + s.episodes.reduce((e, ep) => e + ep.duration, 0), 0);
}

function totalMinutes() {
  return catalog.reduce((t, item) => {
    if (isNovel(item) || isGraphicNovel(item) || isGame(item) || isAudioDrama(item) || isComic(item)) return t;
    return t + (isMovie(item) ? movieMinutes(item) : seriesMinutes(item));
  }, 0);
}

function watchedMinutesMovie(item) {
  return getMovieWatched(item.id) ? item.duration : 0;
}

function watchedMinutesSeries(item) {
  let mins = 0;
  for (const s of item.seasons) {
    for (const ep of s.episodes) {
      if (getEpWatched(item.id, s.season, ep.episode)) mins += ep.duration;
    }
  }
  return mins;
}

function watchedMinutesItem(item) {
  if (isNovel(item) || isGraphicNovel(item) || isGame(item) || isAudioDrama(item) || isComic(item)) return 0;
  return isMovie(item) ? watchedMinutesMovie(item) : watchedMinutesSeries(item);
}

function totalWatchedMinutes() {
  return catalog.reduce((t, item) => t + watchedMinutesItem(item), 0);
}

// ── Comic page calculations (arc-grouped, page-weighted like series minutes) ───

function comicIssueCount(item) {
  return item.arcs.reduce((t, a) => t + a.issues.length, 0);
}

function comicPages(item) {
  return item.arcs.reduce((t, a) => t + a.issues.reduce((s, is) => s + is.pageCount, 0), 0);
}

function readComicPages(item) {
  let p = 0;
  for (const a of item.arcs) {
    for (const is of a.issues) {
      if (getIssueRead(item.id, is.issue)) p += is.pageCount;
    }
  }
  return p;
}

function comicArcProgress(item, arc) {
  const total = arc.issues.length;
  const read = arc.issues.filter(is => getIssueRead(item.id, is.issue)).length;
  return { read, total };
}

function itemStatus(item) {
  if (isMovie(item) || isNovel(item) || isGraphicNovel(item) || isGame(item) || isAudioDrama(item)) return getMovieWatched(item.id) ? 'watched' : 'unwatched';
  if (isComic(item)) {
    const total = comicPages(item);
    const done = readComicPages(item);
    if (done === 0) return 'unwatched';
    if (done >= total) return 'watched';
    return 'partial';
  }
  const total = seriesMinutes(item);
  const done = watchedMinutesSeries(item);
  if (done === 0) return 'unwatched';
  if (done >= total) return 'watched';
  return 'partial';
}

function seriesSeasonProgress(item, seasonNum) {
  const s = item.seasons.find(s => s.season === seasonNum);
  if (!s) return { watched: 0, total: 0 };
  const total = s.episodes.length;
  const done = s.episodes.filter(ep => getEpWatched(item.id, s.season, ep.episode)).length;
  return { watched: done, total };
}

function isSeasonAllWatched(item, seasonNum) {
  const s = item.seasons.find(s => s.season === seasonNum);
  return s?.episodes.every(ep => getEpWatched(item.id, s.season, ep.episode));
}

function formatMinutes(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// ── Stats ────────────────────────────────────────────────────────────────────

function updateStats() {
  const fullMovies = catalog.filter(i => itemTypes(i).includes('movie'));
  const shortFilms = catalog.filter(i => itemTypes(i).includes('short-movie'));
  const series = catalog.filter(i => isSeries(i));
  const novels = catalog.filter(i => isNovel(i));
  const graphicNovels = catalog.filter(i => isGraphicNovel(i));
  const comics = catalog.filter(i => isComic(i));
  const games = catalog.filter(i => isGame(i));
  const watchedFullMovies = fullMovies.filter(i => getMovieWatched(i.id)).length;
  const watchedShortFilms = shortFilms.filter(i => getMovieWatched(i.id)).length;
  const totalEps = series
    .reduce((t, i) => t + i.seasons.reduce((s, se) => s + se.episodes.length, 0), 0);
  const watchedEps = series
    .reduce((t, i) => t + i.seasons.reduce((s, se) =>
      s + se.episodes.filter(ep => getEpWatched(i.id, se.season, ep.episode)).length, 0), 0);
  const readNovels = novels.filter(i => getMovieWatched(i.id)).length;
  const totalNovelPages = novels.reduce((t, i) => t + i.pageCount, 0);
  const readNovelPages = novels.filter(i => getMovieWatched(i.id)).reduce((t, i) => t + i.pageCount, 0);
  const readGraphicNovels = graphicNovels.filter(i => getMovieWatched(i.id)).length;
  const totalGraphicNovelPages = graphicNovels.reduce((t, i) => t + i.pageCount, 0);
  const readGraphicNovelPages = graphicNovels.filter(i => getMovieWatched(i.id)).reduce((t, i) => t + i.pageCount, 0);
  const playedGames = games.filter(i => getMovieWatched(i.id)).length;

  // Comics: each series counts as one item, "read" when every issue is read.
  const readComics = comics.filter(i => itemStatus(i) === 'watched').length;
  const totalComicPages = comics.reduce((t, i) => t + comicPages(i), 0);
  const readComicPagesTotal = comics.reduce((t, i) => t + readComicPages(i), 0);

  const remainingPages = (totalNovelPages - readNovelPages) + (totalGraphicNovelPages - readGraphicNovelPages) + (totalComicPages - readComicPagesTotal);

  const audioDramas = catalog.filter(i => isAudioDrama(i));
  const listenedAudioDramas = audioDramas.filter(i => getMovieWatched(i.id)).length;
  const totalAudioDramaMins = audioDramas.reduce((t, i) => t + i.duration, 0);
  const listenedAudioDramaMins = audioDramas.filter(i => getMovieWatched(i.id)).reduce((t, i) => t + i.duration, 0);

  const readListenedTotal = novels.length + graphicNovels.length + comics.length + audioDramas.length;
  const readListenedDone = readNovels + readGraphicNovels + readComics + listenedAudioDramas;
  const readListenedPct = readListenedTotal > 0 ? Math.round((readListenedDone / readListenedTotal) * 100) : 0;
  const playedPct = games.length > 0 ? Math.round((playedGames / games.length) * 100) : 0;

  const sc = (value, label, tip, accent = false) => `
    <div class="stat-card">
      <span class="stat-info">i<span class="stat-tooltip">${tip}</span></span>
      <div class="stat-value${accent ? ' accent' : ''}">${value}</div>
      <div class="stat-label">${label}</div>
    </div>`;

  document.getElementById('statsRow').innerHTML =
    sc(`${Math.round((totalWatchedMinutes() / totalMinutes()) * 100)}%`, 'Watched',
      'Percentage of total video runtime watched, weighted by duration — a 2-hour movie contributes more than a 22-minute episode. Covers movies, short films, TV shows, and TV shorts. Books, audio dramas, and games are excluded.', true) +
    sc(`${readListenedPct}%`, 'Read/Listened',
      'Percentage of books, graphic novels, comics, and audio dramas completed. Each item counts equally regardless of length. A comic series counts as complete only when every issue is read. Covers adult novels, YA novels, junior novels, young readers, graphic novels, comics, and audio dramas.', true) +
    sc(`${playedPct}%`, 'Played',
      'Percentage of games played. Each title counts equally regardless of length. Covers console, VR, browser, and mobile games.', true) +
    sc(`${watchedFullMovies}/${fullMovies.length}`, 'Movies',
      'Feature-length movies watched vs. total in the catalog. Short films are counted separately in the Short Films tile.') +
    sc(`${watchedShortFilms}/${shortFilms.length}`, 'Short Films',
      'Short films watched vs. total. Feature-length movies are not included here.') +
    sc(`${watchedEps}/${totalEps}`, 'Episodes',
      'Individual episodes watched vs. total across all TV shows and TV shorts. Each episode counts once regardless of its runtime.') +
    sc(`${readNovels + readGraphicNovels + readComics}/${novels.length + graphicNovels.length + comics.length}`, 'Books/Comics',
      'Books, graphic novels, and comic series completed vs. total catalog. Includes adult novels, YA novels, junior novels, young readers, graphic novels, and every comic series — each comic series counts as one and is complete only when all its issues are read. Audio dramas are tracked separately in Read/Listened.') +
    sc(`${playedGames}/${games.length}`, 'Games',
      'Games played vs. total catalog. Includes console, VR, browser, and mobile games.') +
    sc(`${remainingPages.toLocaleString()}`, 'Pages Remaining',
      'Total pages left to read — the sum of every unread novel or graphic novel\'s page count plus the page count of every unread comic issue. Includes adult novels, YA novels, junior novels, young readers, graphic novels, and comics. Audio dramas are not included.') +
    sc(`${Math.round((totalMinutes() - totalWatchedMinutes() + totalAudioDramaMins - listenedAudioDramaMins) / 60)}h`, 'Hours Remaining',
      'Hours of content remaining based on runtime. Covers unwatched video (movies, short films, and unfinished episodes) plus unlistened audio dramas. Books and games are not included.');
}

// ── Render catalog ───────────────────────────────────────────────────────────

function filteredCatalog() {
  let items = catalog;

  if (activeEras.size > 0)   items = items.filter(i => activeEras.has(i.era));
  if (activeTypes.size > 0)  items = items.filter(i => itemTypes(i).some(t => activeTypes.has(t)));

  if (activeStatuses.size > 0) {
    const statusMap = { 'not-started': 'unwatched', 'in-progress': 'partial', 'finished': 'watched' };
    items = items.filter(i => {
      const s = itemStatus(i);
      return [...activeStatuses].some(key => (statusMap[key] ?? key) === s);
    });
  }

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    items = items.filter(i => i.title.toLowerCase().includes(q));
  }

  if (activeSort === 'chronological') {
    return activeSortDir === 'desc' ? [...items].reverse() : items;
  }

  const sorted = [...items];
  const dir = activeSortDir === 'asc' ? 1 : -1;
  if (activeSort === 'release') {
    sorted.sort((a, b) => (a.year - b.year) * dir);
  }
  return sorted;
}

function updateSortButtons() {
  document.querySelectorAll('.sort-btn').forEach(btn => {
    const label = btn.dataset.label;
    if (btn.dataset.sort === activeSort) {
      btn.textContent = label + (activeSortDir === 'asc' ? ' ↑' : ' ↓');
    } else {
      btn.textContent = label;
    }
  });
}

function render() {
  updateStats();
  updateSortButtons();
  renderCatalog();
}

function renderCatalog() {
  const items = filteredCatalog();
  const el = document.getElementById('catalog');
  el.innerHTML = items.map(item => renderCard(item)).join('');

  const countEl = document.getElementById('catalogCount');
  if (countEl) countEl.textContent = `Showing ${items.length} / ${catalog.length} items`;

  el.querySelectorAll('.card').forEach(card => {
    const id = card.dataset.id;
    const item = catalog.find(i => i.id === id);
    card.addEventListener('click', e => {
      if (e.target.closest('.card-watch-btn')) return;
      openModal(item);
    });
    card.querySelector('.card-watch-btn')?.addEventListener('click', e => {
      e.stopPropagation();
      quickToggle(item);
    });
  });
}

function renderCard(item) {
  const status = itemStatus(item);
  let pct;
  if (isSeries(item)) {
    const total = seriesMinutes(item);
    const done = watchedMinutesSeries(item);
    pct = total > 0 ? Math.round((done / total) * 100) : 0;
  } else if (isComic(item)) {
    const total = comicPages(item);
    const done = readComicPages(item);
    pct = total > 0 ? Math.round((done / total) * 100) : 0;
  } else {
    pct = status === 'watched' ? 100 : 0;
  }
  const typeLabels = { movie: 'Movie', 'short-movie': 'Short Film', series: 'TV Series', 'tv-shorts': 'TV Shorts', novel: 'Novel', 'ya-novel': 'YA Novel', 'junior-novel': 'Junior Novel', 'young-reader': 'Young Reader', 'graphic-novel': 'Graphic Novel', comic: 'Comic', 'console-game': 'Console Game', 'vr-game': 'VR Game', 'browser-game': 'Browser Game', 'mobile-game': 'Mobile Game', 'audio-drama': 'Audio Drama' };
  const typeLabel = itemTypes(item).map(t => typeLabels[t] || t).join(' / ');
  let metaLabel;
  if (isNovel(item) || isGraphicNovel(item)) {
    metaLabel = item.pageCount ? `${item.pageCount} pages` : '—';
  } else if (isComic(item)) {
    const n = comicIssueCount(item);
    metaLabel = `${n} issue${n > 1 ? 's' : ''}`;
  } else if (isGame(item)) {
    metaLabel = formatPlatforms(item.platforms);
  } else if (isMovie(item) || isAudioDrama(item)) {
    metaLabel = formatMinutes(item.duration);
  } else {
    metaLabel = `${item.seasons.length} Season${item.seasons.length > 1 ? 's' : ''}`;
  }

  const badgeClass = status === 'watched' ? 'badge-watched' : status === 'partial' ? 'badge-partial' : 'badge-unwatched';
  const badgeText = isGame(item)
    ? (status === 'watched' ? '✓ Played' : 'Not Played')
    : isAudioDrama(item)
      ? (status === 'watched' ? '✓ Listened' : 'Not Started')
      : (status === 'watched' ? '✓ Finished' : status === 'partial' ? 'In Progress' : 'Not Started');

  const watchIcon = status === 'watched' ? '✓' : '＋';
  const posterSrc = `posters/${item.id}.jpg`;
  const posterHtml = `
    <div class="card-poster">
      <div class="card-status-bar"><div class="card-status-bar-fill" style="height:${pct}%"></div></div>
      <img src="${posterSrc}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" />
      <div class="card-poster-missing" style="display:none">✕</div>
    </div>`;

  return `
    <div class="card ${status}" data-id="${item.id}">
      ${posterHtml}
      <div class="card-content">
        <div class="card-body">
          <div class="card-type">${typeLabel} · ${item.year}${item.timeline ? ` · ${item.timeline}` : ''}</div>
          <div class="card-title">${item.title}</div>
          <div class="card-meta">
            <span class="card-duration">${metaLabel}</span>
            <span class="card-badge ${badgeClass}">${badgeText}</span>
          </div>
        </div>
        <div class="card-footer">
          <div class="card-progress-wrap">
            <div class="card-progress-fill" style="width:${pct}%"></div>
          </div>
          <button class="card-watch-btn" title="${isGame(item) ? (status === 'watched' ? 'Mark as Not Played' : 'Mark as Played') : isAudioDrama(item) ? (status === 'watched' ? 'Mark as Not Started' : 'Mark as Listened') : (status === 'watched' ? 'Mark as Not Started' : 'Mark as Finished')}">${watchIcon}</button>
        </div>
      </div>
    </div>
  `;
}

function formatPlatforms(platforms) {
  if (!platforms || platforms.length === 0) return '';
  if (platforms.length <= 3) return platforms.join(', ');
  return platforms.slice(0, 2).join(', ') + ` +${platforms.length - 2} more`;
}

function quickToggle(item) {
  if (isMovie(item) || isNovel(item) || isGraphicNovel(item) || isGame(item) || isAudioDrama(item)) {
    setMovieWatched(item.id, !getMovieWatched(item.id));
  } else if (isComic(item)) {
    const s = itemStatus(item);
    setComicRead(item, s !== 'watched');
  } else {
    const s = itemStatus(item);
    setSeriesWatched(item, s !== 'watched');
  }
  renderCatalog();
}

// ── Modal ────────────────────────────────────────────────────────────────────

function wookiepediaUrl(item) {
  if (item.wookieepedia_override) return item.wookieepedia_override;
  return 'https://starwars.fandom.com/wiki/' + item.title.replace(/ /g, '_');
}

function openModal(item) {
  document.getElementById('modalTitle').textContent = item.title;
  document.getElementById('modalBody').innerHTML =
    isGame(item)         ? renderGameModal(item)       :
    isAudioDrama(item)   ? renderAudioDramaModal(item) :
    isNovel(item)        ? renderNovelModal(item)       :
    isGraphicNovel(item) ? renderNovelModal(item)       :
    isComic(item)        ? renderComicModal(item)       :
    isMovie(item)        ? renderMovieModal(item)       :
    renderSeriesModal(item);
  document.getElementById('modalOverlay').classList.add('open');
  bindModalEvents(item);
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
}

function renderAudioDramaModal(item) {
  const isListened = getMovieWatched(item.id);
  return `
    <div class="movie-detail">
      <div class="movie-info-row">
        <span class="card-badge ${isListened ? 'badge-watched' : 'badge-unwatched'}">${isListened ? '✓ Listened' : 'Not Started'}</span>
        <span style="color:var(--text-muted);font-size:0.85rem">${item.year}</span>
        ${item.timeline ? `<span style="color:var(--text-muted);font-size:0.85rem">${item.timeline}</span>` : ''}
        <span style="color:var(--text-muted);font-size:0.85rem">by ${item.author}</span>
        <span style="color:var(--text-muted);font-size:0.85rem">${formatMinutes(item.duration)}</span>
      </div>
      ${item.description ? `<p class="modal-description">${item.description}</p>` : ''}
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <a class="btn-audible" href="https://www.audible.com/search?keywords=${encodeURIComponent(item.title)}" target="_blank" rel="noopener noreferrer">▶ Listen on Audible</a>
        <a class="btn-amazon" href="https://www.amazon.com/s?k=${encodeURIComponent(item.title)}" target="_blank" rel="noopener noreferrer">Buy on Amazon</a>
        <a class="btn-wookieepedia" href="${wookiepediaUrl(item)}" target="_blank" rel="noopener noreferrer">Wookieepedia</a>
      </div>
      <button class="movie-watch-toggle ${isListened ? 'active' : ''}" id="movieToggle">
        <div class="toggle-icon">${isListened ? '✓' : '○'}</div>
        <div>
          <div class="toggle-text">${isListened ? 'Listened' : 'Mark as Listened'}</div>
          <div class="toggle-sub">${isListened ? 'Click to mark as not started' : 'Click to log this audio drama'}</div>
        </div>
      </button>
    </div>
  `;
}

function renderMovieModal(item) {
  const isDone = getMovieWatched(item.id);
  return `
    <div class="movie-detail">
      <div class="movie-info-row">
        <span class="card-badge ${isDone ? 'badge-watched' : 'badge-unwatched'}">${isDone ? '✓ Finished' : 'Not Started'}</span>
        <span style="color:var(--text-muted);font-size:0.85rem">${item.year}</span>
        ${item.timeline ? `<span style="color:var(--text-muted);font-size:0.85rem">${item.timeline}</span>` : ''}
        <span style="color:var(--text-muted);font-size:0.85rem">${formatMinutes(item.duration)}</span>
      </div>
      ${item.description ? `<p class="modal-description">${item.description}</p>` : ''}
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        ${item.disneyPlusUrl ? `<a class="btn-disney" href="${item.disneyPlusUrl}" target="_blank" rel="noopener noreferrer">▶ ${item.disneyPlusUrl.includes('youtube.com') ? 'Watch on YouTube' : 'Watch on Disney+'}</a>` : ''}
        <a class="btn-wookieepedia" href="${wookiepediaUrl(item)}" target="_blank" rel="noopener noreferrer">Wookieepedia</a>
      </div>
      <button class="movie-watch-toggle ${isDone ? 'active' : ''}" id="movieToggle">
        <div class="toggle-icon">${isDone ? '✓' : '○'}</div>
        <div>
          <div class="toggle-text">${isDone ? 'Watched' : 'Mark as Watched'}</div>
          <div class="toggle-sub">${isDone ? 'Click to mark as not started' : 'Click to log this movie'}</div>
        </div>
      </button>
    </div>
  `;
}

function renderNovelModal(item) {
  const isRead = getMovieWatched(item.id);
  return `
    <div class="movie-detail">
      <div class="movie-info-row">
        <span class="card-badge ${isRead ? 'badge-watched' : 'badge-unwatched'}">${isRead ? '✓ Read' : 'Not Started'}</span>
        <span style="color:var(--text-muted);font-size:0.85rem">${item.year}</span>
        ${item.timeline ? `<span style="color:var(--text-muted);font-size:0.85rem">${item.timeline}</span>` : ''}
        <span style="color:var(--text-muted);font-size:0.85rem">by ${item.author}</span>
        ${item.pageCount ? `<span style="color:var(--text-muted);font-size:0.85rem">${item.pageCount} pages</span>` : ''}
      </div>
      ${item.description ? `<p class="modal-description">${item.description}</p>` : ''}
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        ${itemTypes(item).some(t => t === 'novel' || t === 'ya-novel' || t === 'junior-novel') ? `<a class="btn-audible" href="https://www.audible.com/search?keywords=${encodeURIComponent(item.title)}" target="_blank" rel="noopener noreferrer">Listen on Audible</a>` : ''}
        <a class="btn-amazon" href="https://www.amazon.com/s?k=${encodeURIComponent(item.title)}" target="_blank" rel="noopener noreferrer">Buy on Amazon</a>
        <a class="btn-wookieepedia" href="${wookiepediaUrl(item)}" target="_blank" rel="noopener noreferrer">Wookieepedia</a>
      </div>
      <button class="movie-watch-toggle ${isRead ? 'active' : ''}" id="movieToggle">
        <div class="toggle-icon">${isRead ? '✓' : '○'}</div>
        <div>
          <div class="toggle-text">${isRead ? 'Read' : 'Mark as Read'}</div>
          <div class="toggle-sub">${isRead ? 'Click to mark as not started' : 'Click to log this book'}</div>
        </div>
      </button>
    </div>
  `;
}

function renderGameModal(item) {
  const isPlayed = getMovieWatched(item.id);
  const platformsHtml = item.platforms && item.platforms.length
    ? `<div class="game-platforms">${item.platforms.map(p => `<span class="platform-tag">${p}</span>`).join('')}</div>`
    : '';
  return `
    <div class="movie-detail">
      <div class="movie-info-row">
        <span class="card-badge ${isPlayed ? 'badge-watched' : 'badge-unwatched'}">${isPlayed ? '✓ Played' : 'Not Played'}</span>
        <span style="color:var(--text-muted);font-size:0.85rem">${item.year}</span>
        ${item.timeline ? `<span style="color:var(--text-muted);font-size:0.85rem">${item.timeline}</span>` : ''}
        <span style="color:var(--text-muted);font-size:0.85rem">${item.developer}</span>
      </div>
      ${platformsHtml}
      ${item.description ? `<p class="modal-description">${item.description}</p>` : ''}
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        ${itemTypes(item).some(t => t === 'console-game' || t === 'vr-game') ? `<a class="btn-amazon" href="https://www.amazon.com/s?k=${encodeURIComponent(item.title)}" target="_blank" rel="noopener noreferrer">Buy on Amazon</a>` : ''}
        <a class="btn-wookieepedia" href="${wookiepediaUrl(item)}" target="_blank" rel="noopener noreferrer">Wookieepedia</a>
      </div>
      <button class="movie-watch-toggle ${isPlayed ? 'active' : ''}" id="movieToggle">
        <div class="toggle-icon">${isPlayed ? '✓' : '○'}</div>
        <div>
          <div class="toggle-text">${isPlayed ? 'Played' : 'Mark as Played'}</div>
          <div class="toggle-sub">${isPlayed ? 'Click to mark as not played' : 'Click to log this game'}</div>
        </div>
      </button>
    </div>
  `;
}

function renderSeriesModal(item) {
  const totalMins = seriesMinutes(item);
  const doneMins = watchedMinutesSeries(item);
  const pct = Math.round((doneMins / totalMins) * 100);

  const seasonsHtml = item.seasons.map(s => {
    const prog = seriesSeasonProgress(item, s.season);
    const allWatched = prog.watched === prog.total;

    const epsHtml = s.episodes.map(ep => {
      const isWatched = getEpWatched(item.id, s.season, ep.episode);
      return `
        <div class="episode-row ${isWatched ? 'watched' : ''}" data-series="${item.id}" data-season="${s.season}" data-ep="${ep.episode}">
          <div class="ep-check">${isWatched ? '✓' : ''}</div>
          <span class="ep-num">E${ep.episode}</span>
          <span class="ep-title">${ep.title}</span>
          <span class="ep-duration">${ep.duration}m</span>
        </div>
      `;
    }).join('');

    return `
      <div class="season-block">
        <div class="season-header">
          <span class="season-title">Season ${s.season}</span>
          <span class="season-progress-text">${prog.watched}/${prog.total} episodes</span>
          <button class="season-btn ${allWatched ? 'all-watched' : ''}" data-series="${item.id}" data-season="${s.season}">
            ${allWatched ? '✓ All Watched' : 'Mark Season'}
          </button>
        </div>
        <div class="episode-list">${epsHtml}</div>
      </div>
    `;
  }).join('');

  return `
    ${item.description ? `<p class="modal-description">${item.description}</p>` : ''}
    <div class="series-header-actions">
      ${item.disneyPlusUrl ? `<a class="btn-disney" href="${item.disneyPlusUrl}" target="_blank" rel="noopener noreferrer">▶ ${item.disneyPlusUrl.includes('youtube.com') ? 'Watch on YouTube' : 'Watch on Disney+'}</a>` : ''}
      <a class="btn-wookieepedia" href="${wookiepediaUrl(item)}" target="_blank" rel="noopener noreferrer">Wookieepedia</a>
      <button class="btn-primary" id="markAllBtn" data-id="${item.id}">Mark All Watched</button>
      <button class="btn-outline" id="unmarkAllBtn" data-id="${item.id}">Clear All</button>
      <span style="margin-left:auto;color:var(--text-muted);font-size:0.85rem;align-self:center">${pct}% · ${formatMinutes(doneMins)} / ${formatMinutes(totalMins)}</span>
    </div>
    ${seasonsHtml}
  `;
}

function renderComicModal(item) {
  const totalPages = comicPages(item);
  const donePages = readComicPages(item);
  const pct = totalPages > 0 ? Math.round((donePages / totalPages) * 100) : 0;
  const status = itemStatus(item);
  const totalIssues = comicIssueCount(item);

  const arcsHtml = item.arcs.map((a, arcIdx) => {
    const prog = comicArcProgress(item, a);
    const allRead = prog.read === prog.total;

    const issuesHtml = a.issues.map(is => {
      const isRead = getIssueRead(item.id, is.issue);
      const label = is.label ? is.label : `#${is.issue}`;
      return `
        <div class="episode-row ${isRead ? 'watched' : ''}" data-comic="${item.id}" data-issue="${is.issue}">
          <div class="ep-check">${isRead ? '✓' : ''}</div>
          <span class="ep-num">${label}</span>
          <span class="ep-title">${is.title || ''}</span>
          <span class="ep-duration">${is.pageCount}p</span>
        </div>
      `;
    }).join('');

    return `
      <div class="season-block">
        <div class="season-header">
          <span class="season-title">${a.arc}</span>
          <span class="season-progress-text">${prog.read}/${prog.total} issues</span>
          <button class="season-btn ${allRead ? 'all-watched' : ''}" data-comic="${item.id}" data-arc="${arcIdx}">
            ${allRead ? '✓ All Read' : 'Mark Arc'}
          </button>
        </div>
        <div class="episode-list">${issuesHtml}</div>
      </div>
    `;
  }).join('');

  const badgeClass = status === 'watched' ? 'badge-watched' : status === 'partial' ? 'badge-partial' : 'badge-unwatched';
  const badgeText = status === 'watched' ? '✓ Finished' : status === 'partial' ? 'In Progress' : 'Not Started';

  return `
    <div class="movie-info-row" style="margin-bottom:16px">
      <span class="card-badge ${badgeClass}">${badgeText}</span>
      <span style="color:var(--text-muted);font-size:0.85rem">${item.year}</span>
      ${item.timeline ? `<span style="color:var(--text-muted);font-size:0.85rem">${item.timeline}</span>` : ''}
      ${item.publisher ? `<span style="color:var(--text-muted);font-size:0.85rem">${item.publisher}</span>` : ''}
      <span style="color:var(--text-muted);font-size:0.85rem">${totalIssues} issue${totalIssues > 1 ? 's' : ''}</span>
    </div>
    ${item.description ? `<p class="modal-description">${item.description}</p>` : ''}
    <div class="series-header-actions">
      <a class="btn-amazon" href="https://www.amazon.com/s?k=${encodeURIComponent(item.title)}" target="_blank" rel="noopener noreferrer">Buy on Amazon</a>
      <a class="btn-wookieepedia" href="${wookiepediaUrl(item)}" target="_blank" rel="noopener noreferrer">Wookieepedia</a>
      <button class="btn-primary" id="markAllComicBtn" data-id="${item.id}">Mark All Read</button>
      <button class="btn-outline" id="unmarkAllComicBtn" data-id="${item.id}">Clear All</button>
      <span style="margin-left:auto;color:var(--text-muted);font-size:0.85rem;align-self:center">${pct}% · ${donePages.toLocaleString()} / ${totalPages.toLocaleString()} pages</span>
    </div>
    ${arcsHtml}
  `;
}

function bindModalEvents(item) {
  if (isComic(item)) {
    document.getElementById('markAllComicBtn')?.addEventListener('click', () => {
      setComicRead(item, true);
      document.getElementById('modalBody').innerHTML = renderComicModal(item);
      bindModalEvents(item);
      renderCatalog();
    });
    document.getElementById('unmarkAllComicBtn')?.addEventListener('click', () => {
      setComicRead(item, false);
      document.getElementById('modalBody').innerHTML = renderComicModal(item);
      bindModalEvents(item);
      renderCatalog();
    });
    document.querySelectorAll('.season-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const arc = item.arcs[parseInt(btn.dataset.arc)];
        const allRead = arc.issues.every(is => getIssueRead(item.id, is.issue));
        setArcRead(item.id, arc, !allRead);
        document.getElementById('modalBody').innerHTML = renderComicModal(item);
        bindModalEvents(item);
        renderCatalog();
      });
    });
    document.querySelectorAll('.episode-row').forEach(row => {
      row.addEventListener('click', () => {
        const issue = row.dataset.issue;
        setIssueRead(item.id, issue, !getIssueRead(item.id, issue));
        document.getElementById('modalBody').innerHTML = renderComicModal(item);
        bindModalEvents(item);
        renderCatalog();
      });
    });
    return;
  }

  if (isGame(item)) {
    document.getElementById('movieToggle')?.addEventListener('click', () => {
      setMovieWatched(item.id, !getMovieWatched(item.id));
      document.getElementById('modalBody').innerHTML = renderGameModal(item);
      bindModalEvents(item);
      renderCatalog();
    });
    return;
  }

  if (isAudioDrama(item)) {
    document.getElementById('movieToggle')?.addEventListener('click', () => {
      setMovieWatched(item.id, !getMovieWatched(item.id));
      document.getElementById('modalBody').innerHTML = renderAudioDramaModal(item);
      bindModalEvents(item);
      renderCatalog();
    });
    return;
  }

  if (isNovel(item) || isGraphicNovel(item)) {
    document.getElementById('movieToggle')?.addEventListener('click', () => {
      setMovieWatched(item.id, !getMovieWatched(item.id));
      document.getElementById('modalBody').innerHTML = renderNovelModal(item);
      bindModalEvents(item);
      renderCatalog();
    });
    return;
  }

  if (isMovie(item)) {
    document.getElementById('movieToggle')?.addEventListener('click', () => {
      setMovieWatched(item.id, !getMovieWatched(item.id));
      document.getElementById('modalBody').innerHTML = renderMovieModal(item);
      bindModalEvents(item);
      renderCatalog();
    });
    return;
  }

  document.getElementById('markAllBtn')?.addEventListener('click', () => {
    setSeriesWatched(item, true);
    document.getElementById('modalBody').innerHTML = renderSeriesModal(item);
    bindModalEvents(item);
    renderCatalog();
  });

  document.getElementById('unmarkAllBtn')?.addEventListener('click', () => {
    setSeriesWatched(item, false);
    document.getElementById('modalBody').innerHTML = renderSeriesModal(item);
    bindModalEvents(item);
    renderCatalog();
  });

  document.querySelectorAll('.season-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const seriesId = btn.dataset.series;
      const seasonNum = parseInt(btn.dataset.season);
      const s = item.seasons.find(s => s.season === seasonNum);
      const allWatched = isSeasonAllWatched(item, seasonNum);
      setSeasonWatched(seriesId, seasonNum, s.episodes, !allWatched);
      document.getElementById('modalBody').innerHTML = renderSeriesModal(item);
      bindModalEvents(item);
      renderCatalog();
    });
  });

  document.querySelectorAll('.episode-row').forEach(row => {
    row.addEventListener('click', () => {
      const seriesId = row.dataset.series;
      const season = parseInt(row.dataset.season);
      const ep = parseInt(row.dataset.ep);
      const cur = getEpWatched(seriesId, season, ep);
      setEpWatched(seriesId, season, ep, !cur);
      document.getElementById('modalBody').innerHTML = renderSeriesModal(item);
      bindModalEvents(item);
      renderCatalog();
    });
  });
}

// ── Save / load ──────────────────────────────────────────────────────────────

function openSaveModal() {
  document.getElementById('saveModalOverlay').classList.add('open');
}

function closeSaveModal() {
  document.getElementById('saveModalOverlay').classList.remove('open');
}

function downloadWatchHistory() {
  const blob = new Blob([JSON.stringify(watched, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'tbsb-backup.json';
  a.click();
  URL.revokeObjectURL(url);
}

function loadWatchHistory(file) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      if (typeof data !== 'object' || Array.isArray(data)) throw new Error();
      watched = data;
      save();
      renderCatalog();
    } catch {
      alert('Invalid file. Please select a The Backlog Strikes Back history backup (.json).');
    }
  };
  reader.readAsText(file);
}

// ── Event bindings ───────────────────────────────────────────────────────────

function bindEvents() {
  document.getElementById('modalClose').addEventListener('click', closeModal);
  document.getElementById('modalOverlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal();
  });

  function getActiveSet(filterType) {
    return filterType === 'era' ? activeEras : filterType === 'type' ? activeTypes : activeStatuses;
  }

  function syncFilterButtons(filterType) {
    const activeSet = getActiveSet(filterType);
    const isAll = activeSet.size === 0;
    document.querySelectorAll(`.${filterType}-btn`).forEach(b => {
      b.classList.toggle('active', b.dataset[filterType] === 'all' ? isAll : activeSet.has(b.dataset[filterType]));
    });
  }

  // Desktop buttons: multi-select toggle
  function applyFilterBtn(filterType, val) {
    const activeSet = getActiveSet(filterType);
    if (val === 'all') {
      activeSet.clear();
    } else {
      activeSet.has(val) ? activeSet.delete(val) : activeSet.add(val);
    }
    syncFilterButtons(filterType);
    // Sync mobile select: reflect single selection, otherwise reset to "all"
    const sel = document.querySelector(`.${filterType}-select`);
    if (sel) sel.value = activeSet.size === 1 ? [...activeSet][0] : 'all';
    renderCatalog();
  }

  // Mobile select: single-value, clears set then adds one entry
  function applyFilterSel(filterType, val) {
    const activeSet = getActiveSet(filterType);
    activeSet.clear();
    if (val !== 'all') activeSet.add(val);
    syncFilterButtons(filterType);
    renderCatalog();
  }

  ['era', 'type', 'status'].forEach(filterType => {
    document.querySelectorAll(`.${filterType}-btn`).forEach(btn => {
      btn.addEventListener('click', () => applyFilterBtn(filterType, btn.dataset[filterType]));
    });
    const sel = document.querySelector(`.${filterType}-select`);
    if (sel) sel.addEventListener('change', () => applyFilterSel(filterType, sel.value));
  });

  document.querySelectorAll('.sort-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.sort === activeSort) {
        activeSortDir = activeSortDir === 'asc' ? 'desc' : 'asc';
      } else {
        document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeSort = btn.dataset.sort;
        activeSortDir = 'asc';
      }
      updateSortButtons();
      renderCatalog();
    });
  });

  document.getElementById('themeBtn').addEventListener('click', () => {
    const next = document.documentElement.classList.contains('light') ? 'dark' : 'light';
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
  });

  document.getElementById('filtersToggleBtn').addEventListener('click', () => {
    const visible = document.getElementById('filtersCol').classList.contains('filters-hidden');
    localStorage.setItem(FILTERS_KEY, visible);
    applyFiltersVisible(visible);
  });

  document.getElementById('resetBtn').addEventListener('click', () => {
    if (confirm('Reset all progress? This cannot be undone.')) {
      watched = {};
      save();
      renderCatalog();
    }
  });

  document.getElementById('saveBtn').addEventListener('click', openSaveModal);
  document.getElementById('saveModalClose').addEventListener('click', closeSaveModal);
  document.getElementById('saveModalCloseBtn').addEventListener('click', closeSaveModal);
  document.getElementById('downloadBtn').addEventListener('click', downloadWatchHistory);
  document.getElementById('saveModalOverlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeSaveModal();
  });

  document.getElementById('searchInput').addEventListener('input', e => {
    searchQuery = e.target.value;
    renderCatalog();
  });

  document.getElementById('loadBtn').addEventListener('click', () => {
    document.getElementById('loadInput').click();
  });
  document.getElementById('loadInput').addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) {
      loadWatchHistory(file);
      e.target.value = '';
    }
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeModal(); closeSaveModal(); }
  });
}

const FOOTER_QUOTES = [
  'The ability to stream does not make you intelligent.',
  'I watched them. I watched them all. And not just the movies, but the shows and the shorts, too.',
  'I find your lack of watch progress disturbing.',
  'I know what I have to watch, but I don\'t know if I have the strength to do it.',
];

function renderFooter() {
  document.querySelector('footer p').innerHTML =
    FOOTER_QUOTES[Math.floor(Math.random() * FOOTER_QUOTES.length)];
}

init();
