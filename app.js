const STORAGE_KEY = 'startracker_watched';
const THEME_KEY   = 'startracker_theme';

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

async function init() {
  applyTheme(localStorage.getItem(THEME_KEY) || 'light');
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

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(watched));
  updateStats();
}

// ── Type helpers ─────────────────────────────────────────────────────────────

function itemTypes(item) { return Array.isArray(item.type) ? item.type : [item.type]; }
function isMovie(item)  { const t = itemTypes(item); return t.includes('movie') || t.includes('short-movie'); }
function isSeries(item) { const t = itemTypes(item); return t.includes('series') || t.includes('tv-shorts'); }
function isNovel(item)  { const t = itemTypes(item); return t.includes('novel') || t.includes('ya-novel'); }
function isGame(item)       { const t = itemTypes(item); return t.includes('console-game') || t.includes('vr-game') || t.includes('browser-game') || t.includes('mobile-game'); }
function isAudioDrama(item) { const t = itemTypes(item); return t.includes('audio-drama'); }

// ── Progress calculations ────────────────────────────────────────────────────

function movieMinutes(item) { return item.duration; }

function seriesMinutes(item) {
  return item.seasons.reduce((t, s) => t + s.episodes.reduce((e, ep) => e + ep.duration, 0), 0);
}

function totalMinutes() {
  return catalog.reduce((t, item) => {
    if (isNovel(item) || isGame(item) || isAudioDrama(item)) return t;
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
  if (isNovel(item) || isGame(item) || isAudioDrama(item)) return 0;
  return isMovie(item) ? watchedMinutesMovie(item) : watchedMinutesSeries(item);
}

function totalWatchedMinutes() {
  return catalog.reduce((t, item) => t + watchedMinutesItem(item), 0);
}

function itemStatus(item) {
  if (isMovie(item) || isNovel(item) || isGame(item) || isAudioDrama(item)) return getMovieWatched(item.id) ? 'watched' : 'unwatched';
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
  const readPages = novels.filter(i => getMovieWatched(i.id)).reduce((t, i) => t + i.pageCount, 0);
  const remainingPages = totalNovelPages - readPages;
  const playedGames = games.filter(i => getMovieWatched(i.id)).length;

  const audioDramas = catalog.filter(i => isAudioDrama(i));
  const listenedAudioDramas = audioDramas.filter(i => getMovieWatched(i.id)).length;
  const totalAudioDramaMins = audioDramas.reduce((t, i) => t + i.duration, 0);
  const listenedAudioDramaMins = audioDramas.filter(i => getMovieWatched(i.id)).reduce((t, i) => t + i.duration, 0);

  const readListenedTotal = novels.length + audioDramas.length;
  const readListenedPct = readListenedTotal > 0 ? Math.round(((readNovels + listenedAudioDramas) / readListenedTotal) * 100) : 0;
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
      'Percentage of books and audio dramas completed. Each item counts equally regardless of length — a short novella and an 800-page novel each count as one. Covers adult novels, YA novels, and audio dramas.', true) +
    sc(`${playedPct}%`, 'Played',
      'Percentage of games played. Each title counts equally regardless of length. Covers console, VR, browser, and mobile games.', true) +
    sc(`${watchedFullMovies}/${fullMovies.length}`, 'Movies',
      'Feature-length movies watched vs. total in the catalog. Short films are counted separately in the Short Films tile.') +
    sc(`${watchedShortFilms}/${shortFilms.length}`, 'Short Films',
      'Short films watched vs. total. Feature-length movies are not included here.') +
    sc(`${watchedEps}/${totalEps}`, 'Episodes',
      'Individual episodes watched vs. total across all TV shows and TV shorts. Each episode counts once regardless of its runtime.') +
    sc(`${readNovels}/${novels.length}`, 'Books',
      'Books read vs. total catalog. Includes both adult and YA novels. Audio dramas are tracked separately in Read/Listened.') +
    sc(`${playedGames}/${games.length}`, 'Games',
      'Games played vs. total catalog. Includes console, VR, browser, and mobile games.') +
    sc(`${remainingPages.toLocaleString()}`, 'Pages Remaining',
      'Total page count of all unread books — the sum of every unread novel\'s page count. Includes adult and YA novels. Audio dramas are not included.') +
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
  } else {
    pct = status === 'watched' ? 100 : 0;
  }
  const typeLabels = { movie: 'Movie', 'short-movie': 'Short Film', series: 'TV Series', 'tv-shorts': 'TV Shorts', novel: 'Novel', 'ya-novel': 'YA Novel', 'console-game': 'Console Game', 'vr-game': 'VR Game', 'browser-game': 'Browser Game', 'mobile-game': 'Mobile Game', 'audio-drama': 'Audio Drama' };
  const typeLabel = itemTypes(item).map(t => typeLabels[t] || t).join(' / ');
  let metaLabel;
  if (isNovel(item)) {
    metaLabel = `${item.pageCount} pages`;
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
          <div class="card-type">${typeLabel} · ${item.year}</div>
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
  if (isMovie(item) || isNovel(item) || isGame(item) || isAudioDrama(item)) {
    setMovieWatched(item.id, !getMovieWatched(item.id));
  } else {
    const s = itemStatus(item);
    setSeriesWatched(item, s !== 'watched');
  }
  renderCatalog();
}

// ── Modal ────────────────────────────────────────────────────────────────────

function openModal(item) {
  document.getElementById('modalTitle').textContent = item.title;
  document.getElementById('modalBody').innerHTML =
    isGame(item)       ? renderGameModal(item)       :
    isAudioDrama(item) ? renderAudioDramaModal(item) :
    isNovel(item)      ? renderNovelModal(item)       :
    isMovie(item)      ? renderMovieModal(item)       :
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
        <span style="color:var(--text-muted);font-size:0.85rem">by ${item.author}</span>
        <span style="color:var(--text-muted);font-size:0.85rem">${formatMinutes(item.duration)}</span>
      </div>
      ${item.description ? `<p class="modal-description">${item.description}</p>` : ''}
      ${item.audibleUrl ? `<a class="btn-audible" href="${item.audibleUrl}" target="_blank" rel="noopener noreferrer">▶ Listen on Audible</a>` : ''}
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
        <span style="color:var(--text-muted);font-size:0.85rem">${formatMinutes(item.duration)}</span>
      </div>
      ${item.description ? `<p class="modal-description">${item.description}</p>` : ''}
      ${item.disneyPlusUrl ? `<a class="btn-disney" href="${item.disneyPlusUrl}" target="_blank" rel="noopener noreferrer">▶ ${item.disneyPlusUrl.includes('youtube.com') ? 'Watch on YouTube' : 'Watch on Disney+'}</a>` : ''}
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
        <span style="color:var(--text-muted);font-size:0.85rem">by ${item.author}</span>
        <span style="color:var(--text-muted);font-size:0.85rem">${item.pageCount} pages</span>
      </div>
      ${item.description ? `<p class="modal-description">${item.description}</p>` : ''}
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        ${item.audibleUrl ? `<a class="btn-audible" href="${item.audibleUrl}" target="_blank" rel="noopener noreferrer">Listen on Audible</a>` : ''}
        ${item.amazonUrl ? `<a class="btn-amazon" href="${item.amazonUrl}" target="_blank" rel="noopener noreferrer">Buy on Amazon</a>` : ''}
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
        <span style="color:var(--text-muted);font-size:0.85rem">${item.developer}</span>
      </div>
      ${platformsHtml}
      ${item.description ? `<p class="modal-description">${item.description}</p>` : ''}
      ${item.amazonUrl ? `<a class="btn-amazon" href="${item.amazonUrl}" target="_blank" rel="noopener noreferrer">Buy on Amazon</a>` : ''}
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
      <button class="btn-primary" id="markAllBtn" data-id="${item.id}">Mark All Watched</button>
      <button class="btn-outline" id="unmarkAllBtn" data-id="${item.id}">Clear All</button>
      <span style="margin-left:auto;color:var(--text-muted);font-size:0.85rem;align-self:center">${pct}% · ${formatMinutes(doneMins)} / ${formatMinutes(totalMins)}</span>
    </div>
    ${seasonsHtml}
  `;
}

function bindModalEvents(item) {
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

  if (isNovel(item)) {
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
