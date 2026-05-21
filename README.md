# The Backlog Strikes Back

A client-side Star Wars canon watch and read tracker. No build step, no framework, no server-side logic — just three files served statically.

---

## Architecture

```
startracker/
├── index.html      # Shell — static markup, zero dynamic content
├── style.css       # All visual styling, CSS custom properties, responsive layout
├── app.js          # All application logic — data fetching, state, rendering, events
├── catalog.json    # Source of truth for canon content and runtime durations / page counts
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

On every state mutation, `save()` flushes `watched` to `localStorage`, then calls `updateStats()` to patch the stats bar in place. The catalog grid is re-rendered in full (`renderCatalog()`) by replacing `innerHTML` — there is no virtual DOM or diffing.

---

## catalog.json

The catalog is an array of **content items** under the top-level `"content"` key. Each item is a `movie`, `short-movie`, `series`, `tv-shorts`, or `novel`.

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
  "era": "disney",
  "disneyPlusUrl": "https://www.disneyplus.com/browse/entity-{uuid}"
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
| `description` | string | Optional. Spoiler-free summary shown in the detail modal.          |
| `format`      | string | `"live-action"` or `"animated"`. Stored but no longer used for filtering. |
| `era`         | string | `"lucas"` or `"disney"`. Required for the Era filter.             |
| `disneyPlusUrl` | string | Optional. Direct URL to the item's page on Disney+ or YouTube. When present, a "Watch on Disney+" (or "Watch on YouTube" for `youtube.com` links) button is shown at the top of the detail modal. |

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
| `format`               | string | `"live-action"` or `"animated"`. Stored but no longer used for filtering. |
| `era`                  | string | `"lucas"` or `"disney"`                          |
| `disneyPlusUrl`        | string | Optional. Direct link to the item's Disney+ or YouTube page. |
| `seasons[]`            | array  | Ordered list of seasons                          |
| `seasons[].season`     | number | Season number (1-indexed)                        |
| `episodes[]`           | array  | Ordered list of episodes                         |
| `episodes[].episode`   | number | Episode number within the season                 |
| `episodes[].title`     | string | Episode title                                    |
| `episodes[].duration`  | number | Runtime in minutes                               |

### Novel schema

```json
{
  "id": "bloodline",
  "title": "Bloodline",
  "type": "novel",
  "author": "Claudia Gray",
  "year": 2016,
  "era": "disney",
  "pageCount": 349,
  "description": "Six years before the rise of the First Order, Senator Leia Organa navigates a fractured New Republic Senate while a conspiracy threatens to tear the galaxy apart.",
  "audibleUrl": "https://www.audible.com/pd/Star-Wars-Bloodline-New-Republic-Audiobook/B01CRMO9BE",
  "amazonUrl": "https://www.amazon.com/s?k=Star+Wars+Bloodline+Claudia+Gray"
}
```

| Field        | Type   | Description                                                                 |
|--------------|--------|-----------------------------------------------------------------------------|
| `id`         | string | Unique stable identifier (slug). Used as localStorage key and poster filename. |
| `title`      | string | Display title                                                               |
| `type`       | string | `"novel"`                                                                   |
| `author`     | string | Author name. Shown in the detail modal info row.                            |
| `year`       | number | Publication year                                                            |
| `era`        | string | `"lucas"` or `"disney"`                                                     |
| `pageCount`  | number | Page count of the print edition. Shown on the card and in the modal.        |
| `description`| string | Optional. Spoiler-free summary shown in the detail modal.                   |
| `audibleUrl` | string | Optional. Direct URL to the audiobook on Audible. Renders a "Listen on Audible" button in the modal. |
| `amazonUrl`  | string | Optional. URL to the book on Amazon (product page or search). Renders a "Buy on Amazon" button in the modal. |

Novels do not have `format`, `duration`, `disneyPlusUrl`, or `seasons`. They are treated as binary items (read or not read) using the same flat state model as movies.

### YA Novel schema

```json
{
  "id": "path-of-deceit",
  "title": "The High Republic: Path of Deceit",
  "type": "ya-novel",
  "author": "Justina Ireland & Tessa Gratton",
  "year": 2022,
  "era": "disney",
  "pageCount": 368,
  "description": "Set 150 years before the height of the High Republic era, a Jedi Padawan and a member of the mysterious Path of the Open Hand are thrown together on a world at the edge of the galaxy.",
  "audibleUrl": "https://www.audible.com/pd/Star-Wars-The-High-Republic-Path-of-Deceit-Audiobook/B0F8FG4C5Z",
  "amazonUrl": "https://www.amazon.com/s?k=Star+Wars+High+Republic+Path+of+Deceit"
}
```

The YA Novel schema is identical to the Adult Novel schema — the only difference is `"type": "ya-novel"`. All stat calculations (Novels count, Pages Remaining, Read %) treat `novel` and `ya-novel` items identically via the `isNovel()` helper. The type filter exposes them as separate options ("Adult Novels" and "YA Novels") so users can filter to one category at a time.

The catalog order controls default display order. Items are shown in the order they appear in `catalog.json`. The user's version is ordered chronologically by in-universe timeline.

---

## State model

All watch/read state lives in a single `watched` object in memory, mirrored to `localStorage` under the key `startracker_watched` (defined as the constant `STORAGE_KEY`).

### Shape

```
watched = {
  // Movie, short-movie, or novel: boolean flag keyed by item id
  "rogue-one-a-star-wars-story": true,
  "bloodline": true,

  // Series or tv-shorts: nested object keyed by season number, then episode number
  "the-mandalorian": {
    1: { 1: true, 2: true, 3: false },
    2: { 1: true }
  }
}
```

Movies, short-movies, and novels are all stored as a flat boolean (`id → true/false/undefined`). Series and tv-shorts are stored as a two-level integer-keyed map: `watched[seriesId][seasonNumber][episodeNumber]`. Missing keys are treated as `false` via optional chaining (`watched[id]?.[season]?.[ep]`), so the object is sparse — only watched/read content is explicitly stored.

### Type helpers

Three helper functions centralise type branching across the codebase:

```js
function isMovie(item)  { return item.type === 'movie'  || item.type === 'short-movie'; }
function isSeries(item) { return item.type === 'series' || item.type === 'tv-shorts'; }
function isNovel(item)  { return item.type === 'novel'  || item.type === 'ya-novel'; }
```

Every place that needs to distinguish content types calls these — not `item.type` directly — so adding a new type only requires updating the helpers.

### Accessor functions

| Function           | Signature                                      | Description                                                    |
|--------------------|------------------------------------------------|----------------------------------------------------------------|
| `getMovieWatched`  | `(id) → bool`                                  | Returns watch/read state for a movie, short-movie, or novel    |
| `setMovieWatched`  | `(id, val)`                                    | Sets watch/read state and saves                                |
| `getEpWatched`     | `(seriesId, season, ep) → bool`                | Returns watch state for one episode                            |
| `setEpWatched`     | `(seriesId, season, ep, val)`                  | Sets one episode and saves                                     |
| `setSeasonWatched` | `(seriesId, seasonNum, episodes[], val)`        | Bulk-sets all episodes in a season                             |
| `setSeriesWatched` | `(item, val)`                                  | Bulk-sets every episode across all seasons in a series         |

`getMovieWatched` and `setMovieWatched` are shared by movies, short-movies, and novels since all three use the same flat boolean storage pattern.

Every setter calls `save()`, which serialises `watched` to `localStorage` and then calls `updateStats()` to refresh the stats bar.

---

## Progress calculation

### Video content (movies, short-movies, series, tv-shorts)

The percentage shown in the Watched stat tile is computed purely from **watch time in minutes**, not episode or item count. A 70-minute pilot counts more than a 22-minute episode.

```
canonWatchedPct = totalWatchedMinutes() / totalMinutes() × 100   (rounded to nearest integer)
```

Novels are excluded from all minute-based calculations — `totalMinutes()` and `watchedMinutesItem()` skip items where `isNovel(item)` is true.

### Functions

| Function                | Description                                                                 |
|-------------------------|-----------------------------------------------------------------------------|
| `movieMinutes(item)`    | Returns `item.duration` for a movie or short-movie                         |
| `seriesMinutes(item)`   | Sums all episode durations across all seasons via nested `reduce`           |
| `totalMinutes()`        | Sums `movieMinutes` or `seriesMinutes` for every non-novel item in the catalog |
| `watchedMinutesMovie(item)` | Returns `item.duration` if watched, else 0                             |
| `watchedMinutesSeries(item)` | Iterates seasons → episodes, sums durations for watched episodes only |
| `watchedMinutesItem(item)` | Returns 0 for novels; dispatches to movie or series variant otherwise  |
| `totalWatchedMinutes()` | Sums `watchedMinutesItem` for every item in the catalog                    |

### Novel content

The Read stat tile is computed from **page counts**:

```
canonReadPct = readPages / totalNovelPages × 100   (rounded to nearest integer)
```

Where `readPages` is the total page count of all novels marked as read, and `totalNovelPages` is the total page count of all novels in the catalog.

### Item status

`itemStatus(item)` derives a display state from the same calculations:

| Status        | Condition                                              |
|---------------|--------------------------------------------------------|
| `"unwatched"` | Movie/novel not marked; or 0 minutes watched in series |
| `"partial"`   | 1 or more minutes watched, less than total (series only) |
| `"watched"`   | Movie/novel marked true; or watched minutes ≥ total minutes |

Movies, short-movies, and novels are always either `"unwatched"` or `"watched"` — there is no partial state for flat boolean items.

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

## Stats bar

`updateStats()` rebuilds all eight stat cards inside `#statsRow` on every save. It sets `innerHTML` directly — no diffing. The eight cards are displayed in this order:

| Card             | Value                                                             | Colour class     |
|------------------|-------------------------------------------------------------------|------------------|
| Watched          | `totalWatchedMinutes / totalMinutes` as `N%`                      | `.accent`        |
| Read             | `readPages / totalNovelPages` as `N%`                             | `.accent`        |
| Movies           | `watchedMovies / totalMovies` (e.g. `11/13`)                      | default          |
| Short Films      | `watchedShortFilms / totalShortFilms` (e.g. `0/2`)               | default          |
| Episodes         | `watchedEps / totalEps` (e.g. `43/579`)                          | default          |
| Novels           | `readNovels / totalNovels` (e.g. `0/1`)                          | default          |
| Pages Remaining  | Total page count of all unread novels                             | default          |
| Hours Remaining  | `Math.round((totalMinutes - totalWatchedMinutes) / 60)` as `Nh`  | default          |

Movies count covers both `movie` and `short-movie` types (via `isMovie()`). Episodes count covers both `series` and `tv-shorts` types (via `isSeries()`). Novels count covers `novel` types (via `isNovel()`). Watched is video-only; Read is novels-only.

---

## Rendering

The app has no templating engine. HTML is built via tagged template literals and assigned to `innerHTML`. There are two render scopes:

**Catalog grid** (`renderCatalog`) — Rebuilds the entire `#catalog` div on every filter change or state mutation. After setting `innerHTML`, it immediately re-attaches event listeners by querying the freshly created DOM nodes.

**Modal** (`openModal`, `renderMovieModal`, `renderNovelModal`, `renderSeriesModal`) — Rebuilds `#modalBody` on open, and re-renders it in place on every interaction inside the modal. `bindModalEvents` is called after each re-render to re-attach all click handlers to the new DOM.

This pattern avoids stale closure bugs that would arise from caching references to DOM nodes across re-renders, at the cost of always doing a full subtree replace.

### Card layout

Each card is a horizontal flex row:

```
┌──────────┬─────────────────────────────┐
│          │ TYPE · YEAR                 │
│  poster  │ Title                       │
│          │ Duration/Pages   BADGE      │
│          ├─────────────────────────────┤
│          │ ══════progress bar══  [btn] │
└──────────┴─────────────────────────────┘
```

The card root element receives a CSS class matching its status: `.card.watched`, `.card.partial`, or `.card.unwatched`. This drives border colour, status bar fill colour, and progress bar fill colour entirely via CSS — no inline colour styles.

**Type labels** are mapped in `renderCard`:

| `item.type`    | Displayed label |
|----------------|-----------------|
| `movie`        | Movie           |
| `short-movie`  | Short Film      |
| `series`       | TV Series       |
| `tv-shorts`    | TV Shorts       |
| `novel`        | Novel           |
| `ya-novel`     | YA Novel        |

**Meta label** (shown below the title):

| Item type        | Meta label                                            |
|------------------|-------------------------------------------------------|
| Movie/Short Film | `formatMinutes(item.duration)` — e.g. `"2h 16m"`     |
| Series/TV Shorts | `N Season(s)` — e.g. `"3 Seasons"`                   |
| Novel            | `N pages` — e.g. `"349 pages"`                       |

**Badge classes and text**:

| Status      | CSS class         | Text          |
|-------------|-------------------|---------------|
| `watched`   | `.badge-watched`  | ✓ Finished    |
| `partial`   | `.badge-partial`  | In Progress   |
| `unwatched` | `.badge-unwatched`| Not Started   |

**Progress bar percentage**:

- Series/TV Shorts: `watchedMinutesSeries / seriesMinutes × 100`, giving a true partial fill.
- All other types (movies, short-movies, novels): `100` if status is `"watched"`, `0` otherwise — there is no partial state for flat boolean items.

**Quick-toggle button** (`.card-watch-btn`): shows `✓` when finished, `＋` when not. For movies/short-movies/novels, toggles the boolean directly via `setMovieWatched`. For series/tv-shorts, checks `itemStatus` — if the series is fully `watched`, marks all episodes unwatched; otherwise marks all episodes watched. After toggling, calls `renderCatalog()` to refresh the grid.

### Status indicator

A 3px-wide vertical bar (`.card-status-bar`) is absolutely positioned along the left edge of the poster column. Inside it, `.card-status-bar-fill` grows from the top by `height: N%` (set inline via the `pct` computed in `renderCard`). The fill colour is set by CSS:

```css
.card.watched .card-status-bar-fill { background: var(--watched); height: 100%; }
.card.partial .card-status-bar-fill { background: var(--partial); }
.card.unwatched .card-status-bar-fill { height: 0%; }
```

The `height: 100%` override on `.card.watched` ensures the bar is always full-height for finished items, regardless of the inline `pct` value.

### Poster images

`renderCard` always emits `<img src="posters/{id}.jpg">`. If the request fails (file absent or 404), an `onerror` handler hides the `<img>` and makes the sibling `.card-poster-missing` div visible, which displays a `✕` over a 45° hatched background (`repeating-linear-gradient`). No pre-flight check or existence test is performed.

### Card hover

On hover, cards lift `translateY(-2px)`, background shifts from `--bg-card` to `--bg-card-hover`, border brightens to `--border-bright`, and a `box-shadow` appears. Transition is `0.2s`.

---

## Modal

### Opening and closing

`openModal(item)` sets `#modalTitle` from `item.title`, fills `#modalBody` with the appropriate modal renderer based on type (`renderNovelModal` → `renderMovieModal` → `renderSeriesModal`), adds the `.open` class to `#modalOverlay`, and calls `bindModalEvents`.

`closeModal()` removes the `.open` class. The overlay is `display: none` by default and `display: flex` when `.open`. Three triggers call `closeModal`: the `×` button, clicking the backdrop (overlay but not the modal box itself, checked via `e.target === e.currentTarget`), and the `Escape` key.

The modal box is `max-width: 680px`, `max-height: 85vh`, with `overflow-y: auto` on `.modal-body` so long episode lists scroll independently of the header.

### Movie / Short-movie modal

Layout (`.movie-detail`, vertical flex, `gap: 20px`):

1. **Info row** (`.movie-info-row`): badge, year, runtime — all inline, wrapped.
2. **Description** (`.modal-description`): rendered only if `item.description` is present.
3. **Watch button** (`.btn-disney`): rendered only if `item.disneyPlusUrl` is present. Links to the item's Disney+ or YouTube page in a new tab. Label reads "▶ Watch on Disney+" for Disney+ URLs and "▶ Watch on YouTube" for `youtube.com` URLs. Detected via `url.includes('youtube.com')`.
4. **Watch toggle button** (`.movie-watch-toggle`): full-width button with a circular icon on the left and two lines of text on the right. When watched, the button has class `.active`, the icon shows `✓`, main text is "Watched", sub-text is "Click to mark as not started". When unwatched, icon shows `○`, main text is "Mark as Watched", sub-text is "Click to log this movie". Clicking toggles the state, re-renders the modal body, re-binds events, and calls `renderCatalog()`.

### Novel modal

Layout (`.movie-detail`, vertical flex, `gap: 20px`):

1. **Info row** (`.movie-info-row`): badge, year, author (`by Name`), page count — all inline, wrapped.
2. **Description** (`.modal-description`): rendered only if `item.description` is present.
3. **Purchase buttons**: rendered only if the respective URL fields are present.
   - **Listen on Audible** (`.btn-audible`): links to the audiobook on Audible in a new tab.
   - **Buy on Amazon** (`.btn-amazon`): links to the book on Amazon in a new tab.
4. **Read toggle button** (`.movie-watch-toggle`): same structure as the movie toggle. When read, icon shows `✓`, main text is "Read", sub-text is "Click to mark as not started". When unread, icon shows `○`, main text is "Mark as Read", sub-text is "Click to log this book".

The novel modal reuses the `.movie-watch-toggle` styling and the `#movieToggle` id. `bindModalEvents` routes novel items to re-render via `renderNovelModal` rather than `renderMovieModal`.

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

Three independent filter rows and one sort control sit above the catalog grid. On desktop, each filter row is a set of pill buttons. On mobile (≤ 600 px), the pill buttons are hidden and replaced by a `<select>` dropdown for each row. Both controls share the same `applyFilter()` handler and stay in sync at any viewport width. Selecting a value in one row does not affect the others, so all three can be combined freely.

### Filter state

| Variable       | Values                                                | Desktop (pill buttons) | Mobile (select)  | Filter row label |
|----------------|-------------------------------------------------------|------------------------|------------------|------------------|
| `activeEra`    | `all`, `lucas`, `disney`                              | `.era-btn`             | `.era-select`    | Era              |
| `activeType`   | `all`, `movie`, `short-movie`, `series`, `tv-shorts`, `novel`, `ya-novel` | `.type-btn`  | `.type-select`   | Type             |
| `activeStatus` | `all`, `not-started`, `in-progress`, `finished`       | `.status-btn`          | `.status-select` | Progress         |
| `activeSort`   | `chronological`, `release`                            | `.sort-btn`            | —                | Sort (separate)  |
| `activeSortDir`| `asc`, `desc`                                         | —                      | —                | (arrow on button)|

All five default to `all` / `chronological` / `asc` on load.

### Pipeline

`filteredCatalog()` applies all three filters then the sort in sequence:

```
catalog[]
  → era filter    (i.era === activeEra)
  → type filter   (i.type === activeType)
  → status filter (itemStatus(i) === statusKey)
  → sort
  → renderCatalog()
```

Each filter step is a simple `Array.filter` on the in-memory `catalog` array. No data is re-fetched. For the sort step, `[...items]` produces a shallow copy before sorting so the original catalog order is never mutated (preserving chronological order as the default).

### Status filter note

`itemStatus()` returns internal values (`'unwatched'`, `'partial'`, `'watched'`), but the filter buttons use different keys (`not-started`, `in-progress`, `finished`). `filteredCatalog()` maps between them before comparing:

```js
const statusKey =
  activeStatus === 'in-progress' ? 'partial'   :
  activeStatus === 'not-started' ? 'unwatched' :
  activeStatus === 'finished'    ? 'watched'   :
  activeStatus;
```

This keeps the internal status values stable (they are also used as CSS class names) while allowing the UI to use more content-neutral language.

### Sort keys

| Sort            | Key                           | Default (`asc`)        | Reversed (`desc`)       |
|-----------------|-------------------------------|------------------------|-------------------------|
| `chronological` | Position in `catalog.json`   | As-is (earliest first) | Reversed array          |
| `release`       | `item.year`                   | Oldest first           | Newest first            |

### Sort direction

Each sort supports two directions — ascending (`↑`) and descending (`↓`) — toggled by clicking the active sort button a second time. The active button always shows its label plus the arrow (`Chronological ↑`, `Release Date ↓`, etc.).

`activeSortDir` resets to `'asc'` whenever the user switches to a different sort key.

`updateSortButtons()` reads `activeSort` and `activeSortDir`, then updates every `.sort-btn`'s `textContent`. It is called at the end of every `render()` pass and immediately after a sort button click so the arrow always reflects current state.

---

## Event handling

Events are bound in two places:

**`bindEvents()`** — called once on init. Handles:
- Modal close button click
- Modal overlay backdrop click (checks `e.target === e.currentTarget`)
- `Escape` keydown → `closeModal()` and `closeSaveModal()`
- All `.era-btn` / `.era-select`, `.type-btn` / `.type-select`, `.status-btn` / `.status-select` interactions → routed through `applyFilter(filterType, val)`, which updates the active state variable, syncs the `.active` class on pill buttons and the `value` on the select, then calls `renderCatalog()`.
- All `.sort-btn` clicks → if the clicked button is already the active sort, `activeSortDir` toggles; otherwise the clicked button becomes active, `activeSort` updates, and `activeSortDir` resets to `'asc'`. `updateSortButtons()` is called first, then `renderCatalog()`.
- Reset button click → shows `confirm('Reset all progress? This cannot be undone.')` dialog; on confirmation sets `watched = {}`, calls `save()` and `renderCatalog()`
- Save button click → calls `openSaveModal()`, adding `.open` to `#saveModalOverlay`
- Save/close modal buttons → call `closeSaveModal()`
- Save modal backdrop click → calls `closeSaveModal()`
- Download backup button click → calls `downloadWatchHistory()`
- Load button click → programmatically triggers `#loadInput.click()`
- `#loadInput` change → calls `loadWatchHistory(file)`, then clears the input value

**`bindModalEvents(item)`** — called after every modal render. Routes to different handlers based on type:
- **Novel**: `#movieToggle` → `setMovieWatched`, re-render `renderNovelModal`, re-bind, `renderCatalog()`
- **Movie**: `#movieToggle` → `setMovieWatched`, re-render `renderMovieModal`, re-bind, `renderCatalog()`
- **Series**: "Mark All Watched" (`#markAllBtn`) → `setSeriesWatched(item, true)`; "Clear All" (`#unmarkAllBtn`) → `setSeriesWatched(item, false)`; `.season-btn` clicks → `setSeasonWatched` toggle; `.episode-row` clicks → `setEpWatched` toggle. All re-render, re-bind, and call `renderCatalog()`.

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
| `--accent`        | `#ffe81a`                      | Star Wars yellow — logo, active filters, Watched/Read tiles |
| `--accent-dim`    | `rgba(255,232,26,0.15)`        | Active filter button background              |
| `--accent-hover`  | `#ffed4a`                      | Hover accent                                 |
| `--watched`       | `#22c55e`                      | Green — watched/finished state               |
| `--watched-dim`   | `rgba(34,197,94,0.15)`         | Watched state background tint                |
| `--partial`       | `#f59e0b`                      | Amber — in-progress state                    |
| `--partial-dim`   | `rgba(245,158,11,0.15)`        | In-progress background tint                  |
| `--radius`        | `12px`                         | Standard border radius                       |
| `--radius-sm`     | `8px`                          | Small border radius (buttons, inputs)        |
| `--shadow`        | `0 4px 24px rgba(0,0,0,0.4)`   | Card hover shadow                            |

### Header

The header is `position: sticky; top: 0; z-index: 100` with `backdrop-filter: blur(20px)` and a semi-transparent background (`rgba(10,10,15,0.85)`), so it floats above the catalog without fully blocking it. The inner content is constrained to `max-width: 1200px` and laid out as a single flex row: logo on the left, header action buttons (Reset, Save, Load) on the right as a `.header-actions` flex row with `gap: 8px`.

### Filter and sort buttons

Both `.filter-btn` and `.sort-btn` share the same visual treatment: `border-radius: 100px` pill shape, `--bg-card` background, `--border` border, `--text-muted` text. On hover, border brightens and text becomes `--text`. When `.active`, background becomes `--accent-dim`, border becomes `--accent`, text becomes `--accent`, font-weight 600. Filter row labels (`.filter-row-label`) are `min-width: 56px`, uppercase, `--text-dim` colour, aligned center within their row.

### Catalog grid

Fixed two-column grid: `grid-template-columns: repeat(2, 1fr)`, `gap: 16px`. No maximum number of rows — the grid grows as needed.

### Action buttons

| Class         | Colour                       | Usage                                |
|---------------|------------------------------|--------------------------------------|
| `.btn-primary`| `--accent` (yellow) fill     | Mark All Watched in series modal     |
| `.btn-outline`| Transparent, ghost border    | Clear All in series modal            |
| `.btn-secondary`| Transparent, muted border  | Header actions (Reset, Save, Load)   |
| `.btn-disney` | `#0063e5` (blue)             | Watch on Disney+ / YouTube links     |
| `.btn-audible`| `#ff6f00` (deep orange)      | Listen on Audible links in novel modal |
| `.btn-amazon` | `#ff9900` (amber), black text | Buy on Amazon links in novel modal  |

---

## Persistence

`localStorage` is the only automatic persistence mechanism. The entire `watched` object is serialised to JSON and stored under the key `startracker_watched` on every mutation. On load, `init()` deserialises it back with `JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')`. No server, no IndexedDB, no cookies.

Clearing browser storage or clicking the Reset button (which calls `confirm()` first) sets `watched = {}` and re-saves, returning all state to zero.

---

## Save / load

The header exposes three action buttons — **Reset**, **Save**, and **Load**.

### Save (export)

Clicking **Save** opens a dedicated modal (`#saveModalOverlay`) that explains the localStorage limitation and offers a download. The modal contains two buttons:

| Button | Behaviour |
|--------|-----------|
| **Close** | Calls `closeSaveModal()` |
| **Download backup** | Calls `downloadWatchHistory()`, triggering a `tbsb-backup.json` download |

`downloadWatchHistory()` serialises the in-memory `watched` object to a formatted JSON string, wraps it in a `Blob`, creates a temporary object URL, programmatically clicks a disposable `<a>` element to trigger the browser's native file-save dialog, then immediately revokes the URL.

The downloaded file is the exact in-memory shape of `watched` — movies and novels as flat booleans, series as nested season/episode maps. Example:

```json
{
  "the-mandalorian": {
    "1": { "1": true, "2": true, "3": false },
    "2": { "1": true }
  },
  "rogue-one-a-star-wars-story": true,
  "bloodline": true
}
```

### Load (import)

Clicking **Load** programmatically clicks a hidden `<input type="file" id="loadInput" accept=".json">`, opening the browser's native file picker filtered to `.json` files.

`loadWatchHistory(file)` reads the file asynchronously via `FileReader`. If `JSON.parse` fails or the result is not a plain object, the user sees an `alert`. On success, `watched` is replaced with the parsed data, `save()` flushes it to localStorage, and `renderCatalog()` refreshes the grid.

The backup file format is identical to the `startracker_watched` localStorage entry. Any file produced by a previous version of the app — including backups predating novel support — is a valid input. Novel entries are stored as flat booleans just like movies, so there is no migration needed.

---

## Responsive layout

A single `@media (max-width: 600px)` block overrides desktop styles. The desktop layout is unchanged above that breakpoint.

**Header**
- `.header-inner` gains `flex-wrap: wrap; gap: 10px; padding: 10px 16px`.
- `.logo` font size drops to `1rem`, SVG icon to `22×22 px`.
- `.btn-secondary` padding reduces to `6px 10px`, font to `0.8rem`; `.header-actions` gap reduces to `6px`.

**Main content**
- `main` padding reduces to `16px 16px 60px`.
- `.controls-row` gap reduces to `12px; margin-bottom: 20px`.
- `.sort-bar` becomes `width: 100%; flex-shrink: 1`.

**Stats row**
- `.stats-row` collapses to a `2-column grid` (`grid-template-columns: 1fr 1fr`). With 8 stat tiles, this produces 4 rows of 2.
- `.stat-value` reduces to `1.5rem`, `.stat-label` to `0.72rem`.

**Filters**
- `.filter-btn` elements are hidden (`display: none`). `.filter-select` dropdowns are shown (`display: block`) and stretch to fill the remaining row width. The dropdowns are styled to match the dark theme with a custom SVG chevron.

**Catalog grid**
- `.catalog` collapses to single column (`grid-template-columns: 1fr`), gap reduces to `10px`.
- `.card-poster` narrows to `80px`.
- `.card-title` switches to `white-space: normal`, allowing the title to wrap.

**Modals**
- `.modal-overlay` padding reduces to `12px`.
- `.modal-header` and `.modal-body` padding reduces.
- Inside the save modal (`.save-modal-actions`), buttons stack vertically and stretch to full width.

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

Append an object to the `"content"` array in `catalog.json` following the appropriate schema above. The `id` must be unique across all items — it is used as the localStorage key and the poster filename. The app reloads the catalog on every page load, so changes take effect on refresh.

### Adding movies or series

Follow the Movie or Series schema. `duration` values are in minutes. `format` is stored but no longer used for filtering — it is kept for data completeness.

### Adding novels (adult or YA)

Use `"type": "novel"` for adult novels and `"type": "ya-novel"` for young adult novels. The schema is identical for both — the only difference is the `type` field. Both types are treated identically by all stat calculations and state management via `isNovel()`.

`pageCount` is an integer (print edition page count). Provide `audibleUrl` pointing directly to the audiobook product page on Audible (format: `https://www.audible.com/pd/{title}/{ASIN}`), and `amazonUrl` pointing to the product page or a search URL on Amazon.

Novels are read or unread — there is no partial state. They are excluded from the Watched percentage and Hours Remaining calculations, and contribute only to Read, Novels, and Pages Remaining stats.

### Adding poster images

Drop a `.jpg` into the `posters/` directory named after the item's `id`:

```
posters/the-mandalorian.jpg
posters/rogue-one-a-star-wars-story.jpg
posters/bloodline.jpg
```

The filename must match the `id` field in `catalog.json` exactly, with a `.jpg` extension. Items with no matching file display a `✕` placeholder over a hatched background automatically — no configuration required.
