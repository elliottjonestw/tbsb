# The Backlog Strikes Back

A client-side Star Wars canon watch tracker. No build step, no framework, no server-side logic — just three files served statically.

---

## Architecture

```
startracker/
├── index.html      # Shell — static markup, zero dynamic content
├── style.css       # All visual styling, CSS custom properties, responsive layout
├── app.js          # All application logic — data fetching, state, rendering, events
├── catalog.json    # Source of truth for canon content and runtime durations
└── posters/        # Poster images, one per catalog item (optional per item)
    ├── mandalorian.jpg
    ├── rogue-one-a-star-wars-story.jpg
    └── ...
```

The app follows a simple unidirectional data flow:

```
catalog.json  →  fetch()  →  catalog[]  →  render()  →  DOM
                                ↑
                          localStorage  ←  watched{}  ←  user interaction
```

On every state mutation, `save()` flushes `watched` to `localStorage`, then calls `updateGlobalProgress()` and `updateStats()` to patch the header and stats bar in place. The catalog grid is re-rendered in full (`renderCatalog()`) by replacing `innerHTML` — there is no virtual DOM or diffing.

---

## catalog.json

The catalog is an array of **content items** under the top-level `"content"` key. Each item is a `movie`, `short-movie`, `series`, or `tv-shorts`.

### Movie / Short Movie schema

```json
{
  "id": "rogue-one-a-star-wars-story",
  "title": "Rogue One: A Star Wars Story",
  "type": "movie",
  "year": 2016,
  "duration": 133,
  "description": "A band of rebels embarks on a desperate mission to steal the plans for the Empire's planet-destroying superweapon.",
  "format": "live-action",
  "era": "disney"
}
```

Use `"type": "short-movie"` for short films. The schema is identical — `duration` is still a flat integer in minutes.

| Field         | Type   | Description                                                        |
|---------------|--------|--------------------------------------------------------------------|
| `id`          | string | Unique stable identifier (slug). Used as localStorage key and poster filename. |
| `title`       | string | Display title                                                      |
| `type`        | string | `"movie"` or `"short-movie"`                                       |
| `year`        | number | Release year                                                       |
| `duration`    | number | Runtime in minutes                                                 |
| `description`   | string | Optional. Spoiler-free summary shown in the detail modal.          |
| `format`        | string | `"live-action"` or `"animated"`. Required for the Format filter.  |
| `era`           | string | `"lucas"` or `"disney"`. Required for the Era filter.             |
| `disneyPlusUrl` | string | Optional. Direct URL to the item's page on Disney+ or YouTube. When present, a "Watch on Disney+" (or "Watch on YouTube" for `youtube.com` links) button is shown at the top of the detail modal. Use the `https://www.disneyplus.com/browse/entity-{uuid}` format for Disney+ links. |

### Series / TV Shorts schema

```json
{
  "id": "the-mandalorian",
  "title": "The Mandalorian",
  "type": "series",
  "year": 2019,
  "description": "A lone bounty hunter navigates the outer reaches of the galaxy, far from the authority of the New Republic.",
  "format": "live-action",
  "era": "disney",
  "seasons": [
    {
      "season": 1,
      "episodes": [
        { "episode": 1, "title": "Chapter 1: The Mandalorian", "duration": 39 }
      ]
    }
  ]
}
```

Use `"type": "tv-shorts"` for short-form series (e.g. Young Jedi Adventures Shorts). The schema is identical to `series`.

| Field                  | Type   | Description                                      |
|------------------------|--------|--------------------------------------------------|
| `id`                   | string | Unique stable identifier (slug)                  |
| `title`                | string | Display title                                    |
| `type`                 | string | `"series"` or `"tv-shorts"`                      |
| `year`                 | number | First air year                                   |
| `description`          | string | Optional. Shown at the top of the detail modal.  |
| `format`               | string | `"live-action"` or `"animated"`                  |
| `era`                  | string | `"lucas"` or `"disney"`                          |
| `disneyPlusUrl`        | string | Optional. Same as the movie field — direct link to the item's Disney+ or YouTube page. |
| `seasons[]`            | array  | Ordered list of seasons                          |
| `seasons[].season`     | number | Season number (1-indexed)                        |
| `episodes[]`           | array  | Ordered list of episodes                         |
| `episodes[].episode`   | number | Episode number within the season                 |
| `episodes[].title`     | string | Episode title                                    |
| `episodes[].duration`  | number | Runtime in minutes                               |

The catalog order controls default display order. Items are shown in the order they appear in `catalog.json`. The user's version is ordered chronologically by in-universe timeline.

---

## State model

All watch state lives in a single `watched` object in memory, mirrored to `localStorage` under the key `startracker_watched` (defined as the constant `STORAGE_KEY`).

### Shape

```
watched = {
  // Movie or short-movie: boolean flag keyed by item id
  "rogue-one-a-star-wars-story": true,

  // Series or tv-shorts: nested object keyed by season number, then episode number
  "the-mandalorian": {
    1: { 1: true, 2: true, 3: false },
    2: { 1: true }
  }
}
```

Movies and short-movies are stored as a flat boolean (`id → true/false/undefined`). Series and tv-shorts are stored as a two-level integer-keyed map: `watched[seriesId][seasonNumber][episodeNumber]`. Missing keys are treated as `false` via optional chaining (`watched[id]?.[season]?.[ep]`), so the object is sparse — only watched content is explicitly stored.

### Type helpers

Two helper functions centralise type branching across the codebase:

```js
function isMovie(item)  { return item.type === 'movie'  || item.type === 'short-movie'; }
function isSeries(item) { return item.type === 'series' || item.type === 'tv-shorts'; }
```

Every place that needs to distinguish movies from series calls these — not `item.type` directly — so adding a new type only requires updating the two helpers.

### Accessor functions

| Function           | Signature                                      | Description                                             |
|--------------------|------------------------------------------------|---------------------------------------------------------|
| `getMovieWatched`  | `(id) → bool`                                  | Returns watch state for a movie or short-movie          |
| `setMovieWatched`  | `(id, val)`                                    | Sets movie watch state and saves                        |
| `getEpWatched`     | `(seriesId, season, ep) → bool`                | Returns watch state for one episode                     |
| `setEpWatched`     | `(seriesId, season, ep, val)`                  | Sets one episode and saves                              |
| `setSeasonWatched` | `(seriesId, seasonNum, episodes[], val)`        | Bulk-sets all episodes in a season                      |
| `setSeriesWatched` | `(item, val)`                                  | Bulk-sets every episode across all seasons in a series  |

Every setter calls `save()`, which serialises `watched` to `localStorage` and then calls `updateGlobalProgress()` and `updateStats()` to refresh the header and stats bar.

---

## Progress calculation

The percentage shown in the header is computed purely from **watch time in minutes**, not episode or item count. A 70-minute pilot counts more than a 22-minute episode.

```
globalPct = totalWatchedMinutes() / totalMinutes() × 100   (rounded to nearest integer)
```

### Functions

| Function                | Description                                                                 |
|-------------------------|-----------------------------------------------------------------------------|
| `movieMinutes(item)`    | Returns `item.duration` for a movie or short-movie                         |
| `seriesMinutes(item)`   | Sums all episode durations across all seasons via nested `reduce`           |
| `totalMinutes()`        | Sums `movieMinutes` or `seriesMinutes` for every item in the catalog        |
| `watchedMinutesMovie(item)` | Returns `item.duration` if watched, else 0                             |
| `watchedMinutesSeries(item)` | Iterates seasons → episodes, sums durations for watched episodes only |
| `watchedMinutesItem(item)` | Dispatches to movie or series variant based on `isMovie()`              |
| `totalWatchedMinutes()` | Sums `watchedMinutesItem` for every item in the catalog                    |

### Item status

`itemStatus(item)` derives a display state from the same calculations:

| Status        | Condition                                   |
|---------------|---------------------------------------------|
| `"unwatched"` | 0 minutes watched (or movie not marked)     |
| `"partial"`   | 1 or more minutes watched, less than total  |
| `"watched"`   | watched minutes ≥ total minutes             |

For movies and short-movies, `itemStatus` is a simple boolean check (`getMovieWatched`) — there is no partial state for movies. For series and tv-shorts, it compares `watchedMinutesSeries` against `seriesMinutes`.

This status value drives the card border colour, the status bar fill height, the card progress bar fill, and the badge text.

### Season-level helpers

| Function                              | Description                                                                          |
|---------------------------------------|--------------------------------------------------------------------------------------|
| `seriesSeasonProgress(item, seasonNum)` | Returns `{ watched: N, total: N }` episode counts for a given season              |
| `isSeasonAllWatched(item, seasonNum)` | Returns `true` if every episode in the season has been watched                       |

These are used exclusively in `renderSeriesModal` and `bindModalEvents` to drive the per-season progress text and the "Mark Season" button state.

### formatMinutes

`formatMinutes(mins)` formats an integer number of minutes as:
- `"Ym"` if under 60 minutes
- `"Xh"` if exactly on the hour
- `"Xh Ym"` otherwise

---

## Global progress bar

`updateGlobalProgress()` patches the header bar directly without re-rendering the rest of the UI:

```js
document.getElementById('globalProgressBar').style.width = pct + '%';
document.getElementById('globalProgressPct').textContent = pct + '%';
```

The bar fills with a left-to-right gradient from `--accent` (`#ffe81a`) to `--accent-hover` (`#ffed4a`) and has a `transition: width 0.4s ease` animation.

---

## Stats bar

`updateStats()` rebuilds all six stat cards inside `#statsRow` on every save. It sets `innerHTML` directly — no diffing. The six cards are:

| Card             | Value                                                        | Colour class     |
|------------------|--------------------------------------------------------------|------------------|
| Canon Watched    | `totalWatchedMinutes / totalMinutes` as `N%`                 | `.accent`        |
| Time Watched     | `Math.round(totalWatchedMinutes() / 60)` as `Nh`            | `.watched-color` |
| Movies           | `watchedMovies / totalMovies` (e.g. `11/13`)                 | default          |
| Short Films      | `watchedShortFilms / totalShortFilms` (e.g. `0/2`)          | default          |
| Episodes         | `watchedEps / totalEps` (e.g. `43/579`)                     | default          |
| Time Remaining   | `Math.round((totalMinutes - totalWatchedMinutes) / 60)` as `Nh` | default     |

Movies count covers both `movie` and `short-movie` types (via `isMovie()`). Episodes count covers both `series` and `tv-shorts` types (via `isSeries()`). A series counts as "watched" in the Movies stat only if `itemStatus(i) === 'watched'` — partially-watched series do not increment the watched series count.

---

## Rendering

The app has no templating engine. HTML is built via tagged template literals and assigned to `innerHTML`. There are two render scopes:

**Catalog grid** (`renderCatalog`) — Rebuilds the entire `#catalog` div on every filter change or state mutation. After setting `innerHTML`, it immediately re-attaches event listeners by querying the freshly created DOM nodes.

**Modal** (`openModal`, `renderMovieModal`, `renderSeriesModal`) — Rebuilds `#modalBody` on open, and re-renders it in place on every interaction inside the modal (toggling an episode or clicking "Mark Season" re-renders the whole modal body). `bindModalEvents` is called after each re-render to re-attach all click handlers to the new DOM.

This pattern avoids stale closure bugs that would arise from caching references to DOM nodes across re-renders, at the cost of always doing a full subtree replace.

### Card layout

Each card is a horizontal flex row:

```
┌──────────┬─────────────────────────────┐
│          │ TYPE · YEAR                 │
│  poster  │ Title                       │
│          │ Duration        BADGE       │
│          ├─────────────────────────────┤
│          │ ══════progress bar══  [btn] │
└──────────┴─────────────────────────────┘
```

The card root element receives a CSS class matching its status: `.card.watched`, `.card.partial`, or `.card.unwatched`. This drives border colour, status bar fill colour, and progress bar fill colour entirely via CSS — no inline colour styles.

The `.card-content` column is a vertical flex column split into `.card-body` (flex: 1, grows) and `.card-footer` (fixed height). The `.card-body` contains the type/year label, title, and meta row (duration + badge). The `.card-footer` contains the progress bar and the quick-toggle button.

**Type labels** are mapped in `renderCard`:

| `item.type`    | Displayed label |
|----------------|-----------------|
| `movie`        | Movie           |
| `short-movie`  | Short Film      |
| `series`       | TV Series       |
| `tv-shorts`    | TV Shorts       |

**Duration label**: movies and short-movies show `formatMinutes(item.duration)`; series and tv-shorts show `N Season(s)` (singular/plural).

**Badge classes and text**:

| Status      | CSS class        | Text        |
|-------------|------------------|-------------|
| `watched`   | `.badge-watched` | ✓ Watched   |
| `partial`   | `.badge-partial` | In Progress |
| `unwatched` | `.badge-unwatched`| Unwatched  |

**Quick-toggle button** (`.card-watch-btn`): shows `✓` when watched, `＋` (fullwidth plus) when not. For movies/short-movies, toggles the boolean directly. For series/tv-shorts, checks `itemStatus` — if the series is fully `watched`, marks all episodes unwatched; otherwise marks all episodes watched. After toggling, calls `renderCatalog()` to refresh the grid.

### Status indicator

A 3px-wide vertical bar (`.card-status-bar`) is absolutely positioned along the left edge of the poster column. Inside it, `.card-status-bar-fill` grows from the top by `height: N%` (set inline via the `pct` computed in `renderCard`). The fill colour is set by CSS:

```css
.card.watched .card-status-bar-fill { background: var(--watched); height: 100%; }
.card.partial .card-status-bar-fill { background: var(--partial); }
.card.unwatched .card-status-bar-fill { height: 0%; }
```

The `height: 100%` override on `.card.watched` ensures the bar is always full-height for watched items, regardless of the inline `pct` value.

### Poster images

`renderCard` always emits `<img src="posters/{id}.jpg">`. If the request fails (file absent or 404), an `onerror` handler hides the `<img>` and makes the sibling `.card-poster-missing` div visible, which displays a `✕` over a 45° hatched background (`repeating-linear-gradient`). No pre-flight check or existence test is performed.

### Card hover

On hover, cards lift `translateY(-2px)`, background shifts from `--bg-card` to `--bg-card-hover`, border brightens to `--border-bright`, and a `box-shadow` appears. Transition is `0.2s`.

---

## Modal

### Opening and closing

`openModal(item)` sets `#modalTitle` from `item.title`, fills `#modalBody` with either `renderMovieModal` or `renderSeriesModal`, adds the `.open` class to `#modalOverlay`, and calls `bindModalEvents`.

`closeModal()` removes the `.open` class. The overlay is `display: none` by default and `display: flex` when `.open`. Three triggers call `closeModal`: the `×` button, clicking the backdrop (overlay but not the modal box itself, checked via `e.target === e.currentTarget`), and the `Escape` key.

The modal box is `max-width: 680px`, `max-height: 85vh`, with `overflow-y: auto` on `.modal-body` so long episode lists scroll independently of the header.

### Movie / Short-movie modal

Layout (`.movie-detail`, vertical flex, `gap: 20px`):

1. **Info row** (`.movie-info-row`): badge, year, runtime — all inline, wrapped.
2. **Description** (`.modal-description`): rendered only if `item.description` is present.
3. **Watch button** (`.btn-disney`): rendered only if `item.disneyPlusUrl` is present. Links to the item's Disney+ or YouTube page in a new tab. Label reads "▶ Watch on Disney+" for Disney+ URLs and "▶ Watch on YouTube" for `youtube.com` URLs. Detected via `url.includes('youtube.com')`.
4. **Watch toggle button** (`.movie-watch-toggle`): full-width button with a circular icon on the left and two lines of text on the right. When watched, the button has class `.active`, the icon shows `✓`, main text is "Watched", sub-text is "Click to mark as unwatched". When unwatched, icon shows `○`, main text is "Mark as Watched", sub-text is "Click to log this movie". Clicking toggles the state, re-renders the modal body, re-binds events, and calls `renderCatalog()`.

### Series / TV-Shorts modal

Layout:

1. **Description** (`.modal-description`): rendered only if `item.description` is present.
2. **Header actions** (`.series-header-actions`): "Watch on Disney+" / "Watch on YouTube" (`.btn-disney`, rendered only if `item.disneyPlusUrl` is present), "Mark All Watched" (`.btn-primary`, yellow fill), "Clear All" (`.btn-outline`, ghost), and a right-aligned percentage + time string (`N% · Xh Ym / Xh Ym`).
3. **Season blocks** (`.season-block`): one per season, each containing:
   - **Season header** (`.season-header`): season title, `X/Y episodes` progress text, and a "Mark Season" / "✓ All Watched" pill button (`.season-btn`). When all episodes in the season are watched, the button gets class `.all-watched` (green tint). Clicking the season button toggles all episodes in that season — if all are currently watched, it clears them; otherwise it marks them all.
   - **Episode list** (`.episode-list`): one `.episode-row` per episode, each showing a circular check indicator (`.ep-check`), episode number (`E1`, `E2`, …), episode title, and duration in minutes. Watched rows have class `.watched` (green tint background, muted title text, filled check circle). Clicking any row toggles that episode.

Every interactive action inside the modal re-renders the full `#modalBody` and re-calls `bindModalEvents` immediately after, keeping displayed state always in sync with `watched`.

---

## Filtering and sorting

Four independent filter rows and one sort control sit above the catalog grid. On desktop, each filter row is a set of pill buttons. On mobile (≤ 600 px), the pill buttons are hidden and replaced by a `<select>` dropdown for each row. Both controls share the same `applyFilter()` handler and stay in sync at any viewport width. Selecting a value in one row does not affect the others, so all four can be combined freely.

### Filter state

| Variable        | Values                                               | Desktop (pill buttons) | Mobile (select)   | Filter row label |
|-----------------|------------------------------------------------------|------------------------|-------------------|------------------|
| `activeEra`     | `all`, `lucas`, `disney`                             | `.era-btn`             | `.era-select`     | Era              |
| `activeType`    | `all`, `movie`, `short-movie`, `series`, `tv-shorts` | `.type-btn`            | `.type-select`    | Type             |
| `activeFormat`  | `all`, `live-action`, `animated`                     | `.format-btn`          | `.format-select`  | Format           |
| `activeStatus`  | `all`, `unwatched`, `in-progress`, `watched`         | `.status-btn`          | `.status-select`  | Progress         |
| `activeSort`    | `chronological`, `release`, `duration`               | `.sort-btn`            | —                 | Sort (separate)  |
| `activeSortDir` | `asc`, `desc`                                        | —                      | —                 | (arrow on button)|

All six default to `all` / `chronological` / `asc` on load.

### Pipeline

`filteredCatalog()` applies all four filters then the sort in sequence:

```
catalog[]
  → era filter    (i.era === activeEra)
  → type filter   (i.type === activeType)
  → format filter (i.format === activeFormat)
  → status filter (itemStatus(i) === statusKey)
  → sort
  → renderCatalog()
```

Each filter step is a simple `Array.filter` on the in-memory `catalog` array. No data is re-fetched. For the sort step, `[...items]` produces a shallow copy before sorting so the original catalog order is never mutated (preserving chronological order as the default).

### Status filter note

`itemStatus()` returns `'partial'` for in-progress series, but the filter button uses `data-status="in-progress"`. `filteredCatalog()` maps `'in-progress'` → `'partial'` before comparing:

```js
const statusKey = activeStatus === 'in-progress' ? 'partial' : activeStatus;
```

### Sort keys

| Sort            | Key                                                | Default (`asc`)         | Reversed (`desc`)        |
|-----------------|----------------------------------------------------|-------------------------|--------------------------|
| `chronological` | Position in `catalog.json`                        | As-is (earliest first)  | Reversed array           |
| `release`       | `item.year`                                        | Oldest first            | Newest first             |
| `duration`      | `item.duration` (movies) or `seriesMinutes(item)` (series) | Shortest first | Longest first  |

### Sort direction

Each sort supports two directions — ascending (`↑`) and descending (`↓`) — toggled by clicking the active sort button a second time. The active button always shows its label plus the arrow (`Chronological ↑`, `Release Date ↓`, etc.).

`activeSortDir` resets to `'asc'` whenever the user switches to a different sort key.

`updateSortButtons()` reads `activeSort` and `activeSortDir`, then updates every `.sort-btn`'s `textContent`:

```js
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
```

It is called at the end of every `render()` pass so the arrow always reflects current state, and immediately after a sort button click so the button updates before the catalog re-renders.

---

## Event handling

Events are bound in two places:

**`bindEvents()`** — called once on init. Handles:
- Modal close button click
- Modal overlay backdrop click (checks `e.target === e.currentTarget` to avoid closing when clicking inside the modal box)
- `Escape` keydown → `closeModal()` and `closeSaveModal()`
- All `.era-btn` / `.era-select`, `.type-btn` / `.type-select`, `.format-btn` / `.format-select`, `.status-btn` / `.status-select` interactions → routed through `applyFilter(filterType, val)`, which updates the active state variable, syncs the `.active` class on pill buttons and the `value` on the select, then calls `renderCatalog()`. The pill buttons and dropdowns always reflect the same state regardless of which control last triggered the change.
- All `.sort-btn` clicks → if the clicked button is already the active sort, `activeSortDir` toggles between `'asc'` and `'desc'`; otherwise the clicked button becomes active, `activeSort` updates, and `activeSortDir` resets to `'asc'`. In both cases `updateSortButtons()` is called first (to update the arrow indicator), then `renderCatalog()`.
- Reset button click → shows `confirm('Reset all watch progress? This cannot be undone.')` dialog; on confirmation sets `watched = {}`, calls `save()` and `renderCatalog()`
- Save button click → calls `openSaveModal()`, adding `.open` to `#saveModalOverlay`
- Save modal close button / Close button click → calls `closeSaveModal()`
- Save modal backdrop click (`e.target === e.currentTarget`) → calls `closeSaveModal()`
- Download backup button click → calls `downloadWatchHistory()`
- Load button click → programmatically triggers `#loadInput.click()`, opening the file picker
- `#loadInput` change → calls `loadWatchHistory(file)`, then clears the input value

**`bindModalEvents(item)`** — called after every modal render. Handles:
- Movie toggle button (`#movieToggle`) → `setMovieWatched`, re-render modal, re-bind, `renderCatalog()`
- Series "Mark All Watched" (`#markAllBtn`) → `setSeriesWatched(item, true)`, re-render, re-bind, `renderCatalog()`
- Series "Clear All" (`#unmarkAllBtn`) → `setSeriesWatched(item, false)`, re-render, re-bind, `renderCatalog()`
- All `.season-btn` clicks → checks `isSeasonAllWatched`, calls `setSeasonWatched` with the inverse, re-render, re-bind, `renderCatalog()`. Uses `e.stopPropagation()` to prevent the click from bubbling.
- All `.episode-row` clicks → `getEpWatched` / `setEpWatched` toggle, re-render, re-bind, `renderCatalog()`

The catalog card click handler lives inside `renderCatalog()` and is re-attached every time the catalog grid is rebuilt. Card body clicks open the modal; the quick-toggle button (`.card-watch-btn`) calls `quickToggle(item)` with `e.stopPropagation()` so the modal does not also open.

---

## CSS design system

All colours and radii are defined as CSS custom properties on `:root`:

| Variable          | Value                          | Usage                                        |
|-------------------|--------------------------------|----------------------------------------------|
| `--bg`            | `#0a0a0f`                      | Page background                              |
| `--bg-card`       | `#12121a`                      | Card and UI element backgrounds              |
| `--bg-card-hover` | `#1a1a26`                      | Card background on hover                     |
| `--bg-elevated`   | `#1e1e2e`                      | Modal background, poster placeholder         |
| `--border`        | `#2a2a3e`                      | Default border colour                        |
| `--border-bright` | `#3a3a5e`                      | Hover/active border colour                   |
| `--text`          | `#e8e8f0`                      | Primary text                                 |
| `--text-muted`    | `#888899`                      | Secondary text, metadata                     |
| `--text-dim`      | `#555566`                      | Tertiary text, labels, disabled states       |
| `--accent`        | `#ffe81a`                      | Star Wars yellow — logo, active filters, progress bar |
| `--accent-dim`    | `rgba(255,232,26,0.15)`        | Active filter button background              |
| `--accent-hover`  | `#ffed4a`                      | Hover accent, progress bar gradient end      |
| `--watched`       | `#22c55e`                      | Green — watched state                        |
| `--watched-dim`   | `rgba(34,197,94,0.15)`         | Watched state background tint                |
| `--partial`       | `#f59e0b`                      | Amber — in-progress state                    |
| `--partial-dim`   | `rgba(245,158,11,0.15)`        | In-progress background tint                  |
| `--radius`        | `12px`                         | Standard border radius                       |
| `--radius-sm`     | `8px`                          | Small border radius (buttons, inputs)        |
| `--shadow`        | `0 4px 24px rgba(0,0,0,0.4)`   | Card hover shadow                            |

### Header

The header is `position: sticky; top: 0; z-index: 100` with `backdrop-filter: blur(20px)` and a semi-transparent background (`rgba(10,10,15,0.85)`), so it floats above the catalog without fully blocking it. The inner content is constrained to `max-width: 1200px` and laid out as a single flex row: logo on the left, progress pill in the middle (flex: 1), header action buttons (Reset, Save, Load) on the right as a `.header-actions` flex row with `gap: 8px`.

### Filter and sort buttons

Both `.filter-btn` and `.sort-btn` share the same visual treatment: `border-radius: 100px` pill shape, `--bg-card` background, `--border` border, `--text-muted` text. On hover, border brightens and text becomes `--text`. When `.active`, background becomes `--accent-dim`, border becomes `--accent`, text becomes `--accent`, font-weight 600. Filter row labels (`.filter-row-label`) are `min-width: 56px`, uppercase, `--text-dim` colour, aligned center within their row.

### Catalog grid

Fixed two-column grid: `grid-template-columns: repeat(2, 1fr)`, `gap: 16px`. No maximum number of rows — the grid grows as needed.

---

## Persistence

`localStorage` is the only automatic persistence mechanism. The entire `watched` object is serialised to JSON and stored under the key `startracker_watched` on every mutation. On load, `init()` deserialises it back with `JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')`. No server, no IndexedDB, no cookies.

Clearing browser storage or clicking the Reset button (which calls `confirm()` first) sets `watched = {}` and re-saves, returning all state to zero.

Because localStorage is scoped to the browser and device, progress is not shared across browsers or devices and is lost when browser data is cleared. The save/load feature (described below) exists to address this.

---

## Save / load

The header exposes three action buttons — **Reset**, **Save**, and **Load** — rendered as a flex row inside `.header-actions`.

### Save (export)

Clicking **Save** opens a dedicated modal (`#saveModalOverlay`) that explains the localStorage limitation and offers a download. The modal is built with the same `.modal-overlay` / `.modal` / `.modal-header` / `.modal-body` structure as the content modal, but targets a narrower `max-width: 480px` via the `.save-modal` modifier class.

The modal contains two buttons:

| Button | Behaviour |
|--------|-----------|
| **Close** | Calls `closeSaveModal()`, removing `.open` from `#saveModalOverlay` |
| **Download backup** | Calls `downloadWatchHistory()`, triggering a `tbsb-backup.json` download |

`downloadWatchHistory()` serialises the in-memory `watched` object to a formatted JSON string, wraps it in a `Blob` with type `application/json`, creates a temporary object URL, programmatically clicks a disposable `<a>` element to trigger the browser's native file-save dialog, then immediately revokes the URL to release memory:

```js
function downloadWatchHistory() {
  const blob = new Blob([JSON.stringify(watched, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'tbsb-backup.json';
  a.click();
  URL.revokeObjectURL(url);
}
```

The downloaded file is a plain JSON object — the exact in-memory shape of `watched` — and can be inspected or edited in any text editor. Example:

```json
{
  "the-mandalorian": {
    "1": { "1": true, "2": true, "3": false },
    "2": { "1": true }
  },
  "rogue-one-a-star-wars-story": true
}
```

The save modal also dismisses on backdrop click (`e.target === e.currentTarget`) and on the `Escape` key (shared with the content modal's existing keydown listener, which now calls both `closeModal()` and `closeSaveModal()`).

### Load (import)

Clicking **Load** programmatically clicks a hidden `<input type="file" id="loadInput" accept=".json">` element, opening the browser's native file picker filtered to `.json` files.

When the user selects a file, the `change` event fires on `#loadInput`. The handler calls `loadWatchHistory(file)`:

```js
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
```

`FileReader.readAsText` reads the file asynchronously. The `onload` callback attempts `JSON.parse`; if parsing fails or the result is not a plain object (e.g. an array or a primitive), it throws and the user sees an `alert`. On success, `watched` is replaced with the parsed data, `save()` flushes it to localStorage and updates the header and stats bar, and `renderCatalog()` refreshes the grid. The file input's `value` is cleared after each load so that selecting the same file twice in a row fires the `change` event again.

### File format compatibility

The backup file format is identical to the `startracker_watched` localStorage entry. Any file produced by a previous version of the app — or manually constructed following the state model shape — is a valid input to `loadWatchHistory`. No version field or schema validation is performed beyond the plain-object check.

---

## Responsive layout

A single `@media (max-width: 600px)` block overrides desktop styles. The desktop layout is unchanged above that breakpoint.

**Header**
- `.header-inner` gains `flex-wrap: wrap; gap: 10px; padding: 10px 16px`.
- `.logo` font size drops to `1rem`, SVG icon to `22×22 px`.
- `.btn-secondary` padding reduces to `6px 10px`, font to `0.8rem`; `.header-actions` gap reduces to `6px`. Together these keep all three buttons (Reset, Save, Load) on one line next to the logo at 375 px viewport width.
- `.progress-pill` is pushed to `order: 3; flex-basis: 100%` so it wraps to its own full-width row beneath the logo and buttons.

**Main content**
- `main` padding reduces to `16px 16px 60px`.
- `.controls-row` gap reduces to `12px; margin-bottom: 20px`.
- `.sort-bar` becomes `width: 100%; flex-shrink: 1` so it takes the full row and its pill buttons wrap internally rather than overflowing.

**Stats row**
- `.stats-row` becomes a `2×2 grid` (`grid-template-columns: 1fr 1fr`). The fifth card (Time Remaining) uses `grid-column: span 2` to fill the full bottom row on its own.
- `.stat-value` reduces to `1.5rem`, `.stat-label` to `0.72rem`.

**Filters**
- `.filter-btn` elements are hidden (`display: none`). `.filter-select` dropdowns are shown (`display: block`) and stretch to fill the remaining row width (`flex: 1`) beside their label. The dropdowns are styled to match the dark theme: `--bg-card` background, `--border` border, `--text` colour, `appearance: none` with a custom SVG chevron injected via `background-image`.

**Catalog grid**
- `.catalog` collapses to single column (`grid-template-columns: 1fr`), gap reduces to `10px`.
- `.card-poster` narrows to `80px`.
- `.card-title` switches from `white-space: nowrap; text-overflow: ellipsis` to `white-space: normal`, allowing the title to wrap rather than truncate.

**Modals**
- `.modal-overlay` padding reduces to `12px`.
- `.modal-header` padding reduces to `16px 16px 14px`; `.modal-body` to `14px 16px 20px`.
- Inside the save modal (`.save-modal-actions`), buttons stack vertically (`flex-direction: column`) and each stretches to full width.

Custom scrollbar styling (`6px` wide, transparent track, rounded `--border-bright` thumb) is applied globally via `::-webkit-scrollbar` rules.

---

## Serving

The app requires a real HTTP server (not `file://`) because `fetch('catalog.json')` is blocked by browsers on the `file:` protocol. Any static file server works:

```bash
# Python
python3 -m http.server 3456

# Node (npx)
npx serve .

# Caddy
caddy file-server --listen :3456
```

No build step, no bundler, no transpilation. The browser receives the source files directly.

---

## Adding content to the catalog

Append an object to the `"content"` array in `catalog.json` following the movie or series schema above. The `id` must be unique across all items — it is used as the localStorage key and the poster filename. Duration values are in minutes. The app reloads the catalog on every page load, so changes take effect on refresh.

## Adding poster images

Drop a `.jpg` into the `posters/` directory named after the item's `id`:

```
posters/the-mandalorian.jpg
posters/rogue-one-a-star-wars-story.jpg
posters/the-clone-wars.jpg
```

The filename must match the `id` field in `catalog.json` exactly, with a `.jpg` extension. Items with no matching file display a `✕` placeholder over a hatched background automatically — no configuration required.
