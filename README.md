# The Backlog Strikes Back

A client-side Star Wars canon watch, read, and play tracker. No build step, no framework, no server-side logic — just three files served statically.

---

## Architecture

```
startracker/
├── index.html      # Shell — static markup, zero dynamic content
├── style.css       # All visual styling, CSS custom properties, responsive layout
├── app.js          # All application logic — data fetching, state, rendering, events
├── catalog.json    # Source of truth for canon content and runtime durations / page counts
└── posters/        # Poster/cover images, one per catalog item (optional per item)
    ├── the-mandalorian.jpg
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

The catalog is an array of **content items** under the top-level `"content"` key. Each item is one of: `movie`, `short-movie`, `series`, `tv-shorts`, `novel`, `ya-novel`, `junior-novel`, `young-reader`, `graphic-novel`, `comic`, `console-game`, `vr-game`, `browser-game`, `mobile-game`, or `audio-drama`.

An item's `type` field can be a single string **or an array of strings** when it belongs to more than one type (e.g. a game released on both browser and mobile). Multi-type items appear in filter results for any of their types, and their card displays all type labels joined with ` / ` (e.g. `BROWSER GAME / MOBILE GAME`). The state model, stats, and modal routing are unaffected — they all normalise `type` through the `itemTypes(item)` helper before branching.

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
| `type`        | string or string[] | `"movie"` or `"short-movie"` (array form not applicable for movies) |
| `year`        | number | Release year                                                       |
| `duration`    | number | Runtime in minutes                                                 |
| `description` | string | Optional. Spoiler-free summary shown in the detail modal.          |
| `format`      | string | `"live-action"` or `"animated"`. Stored but no longer used for filtering. |
| `era`         | string | `"lucas"` or `"disney"`. Required for the Era filter.             |
| `disneyPlusUrl` | string | Optional. Direct URL to the item's page on Disney+ or YouTube. When present, a "Watch on Disney+" (or "Watch on YouTube" for `youtube.com` links) button is shown at the top of the detail modal. |
| `wookieepedia_override` | string | Explicit Wookieepedia URL for this item. When non-empty, used as-is for the **Wookieepedia** button URL instead of the auto-generated URL. Every item in the catalog has this field populated. Set it to the correct article URL whenever a title is ambiguous (e.g. a novel that shares its name with a character, a Little Golden Book edition whose title matches a film, or a comic series that redirects to the wrong page). |
| `timeline`              | string | In-universe date string using the Star Wars BBY/ABY calendar (e.g. `"19 BBY"`, `"4 ABY"`, `"19 BBY–18 BBY"`). BBY = Before Battle of Yavin (higher = earlier); ABY = After Battle of Yavin (higher = later). Shown on the catalog card next to the release year and in the detail modal info row. Populated for every item via the Wookieepedia API `\|timeline=` / `\|canon_timeline=` infobox field. |

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
| `wookieepedia_override` | string | Explicit Wookieepedia URL for this item. See Movie schema for details. |
| `timeline`              | string | In-universe date string (e.g. `"19 BBY"`, `"4 ABY–5 ABY"`). See Movie schema for details. |
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
| `wookieepedia_override` | string | Explicit Wookieepedia URL for this item. See Movie schema for details. |
| `timeline`              | string | In-universe date string (e.g. `"19 BBY"`, `"4 ABY–5 ABY"`). See Movie schema for details. |

The modal for `novel` and `ya-novel` items automatically generates **Listen on Audible** and **Buy on Amazon** buttons from the item title — no URL fields are stored in `catalog.json`. The generated URLs are `https://www.audible.com/search?keywords={title}` and `https://www.amazon.com/s?k={title}`.

Novels do not have `format`, `duration`, `disneyPlusUrl`, or `seasons`. They are treated as binary items (read or not read) using the same flat state model as movies. Graphic novels share this same model — see the Graphic Novel schema section.

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
}
```

The YA Novel schema is identical to the Adult Novel schema — the only difference is `"type": "ya-novel"`. All stat calculations (Novels count, Pages Remaining, Read %) treat `novel`, `ya-novel`, `junior-novel`, and `young-reader` items identically via the `isNovel()` helper. The type filter exposes them as separate options ("Adult Novels", "YA Novels", "Junior Novels", and "Young Readers") so users can filter to one category at a time.

### Junior Novel schema

```json
{
  "id": "the-high-republic-a-test-of-courage",
  "title": "The High Republic: A Test of Courage",
  "type": "junior-novel",
  "author": "Justina Ireland",
  "year": 2021,
  "era": "disney",
  "pageCount": 240,
  "description": "When a mission to a newly-discovered planet goes wrong, Jedi Padawan Vernestra Rwoh must lead a group of young survivors through a dangerous jungle.",
}
```

The Junior Novel schema is identical to the Adult Novel and YA Novel schemas — the only difference is `"type": "junior-novel"`. All stat calculations, card rendering, modal routing, and state management treat `junior-novel` identically to `novel`, `ya-novel`, and `young-reader` via `isNovel()`. Junior novels appear in the Books/Comics count, Pages Remaining, and Read/Listened % stats alongside adult novels, YA novels, and young readers.

| Field        | Type   | Description                                                                 |
|--------------|--------|-----------------------------------------------------------------------------|
| `id`         | string | Unique stable identifier (slug). Used as localStorage key and poster filename. |
| `title`      | string | Display title                                                               |
| `type`       | string | `"junior-novel"`                                                            |
| `author`     | string | Author name. Shown in the detail modal info row.                            |
| `year`       | number | Publication year                                                            |
| `era`        | string | `"lucas"` or `"disney"`                                                     |
| `pageCount`  | number | Page count of the print edition. Shown on the card and in the modal.        |
| `description`| string | Optional. Spoiler-free summary shown in the detail modal.                   |
| `wookieepedia_override` | string | Explicit Wookieepedia URL for this item. See Movie schema for details. |
| `timeline`              | string | In-universe date string (e.g. `"19 BBY"`, `"4 ABY–5 ABY"`). See Movie schema for details. |

Junior novels display both Audible and Amazon buttons in the modal, generated from the item title.

### Young Reader schema

```json
{
  "id": "young-jedi-adventures-jedi-training",
  "title": "Young Jedi Adventures: Jedi Training",
  "type": "young-reader",
  "author": "Caitlin Kennedy",
  "year": 2023,
  "era": "disney",
  "pageCount": 40
}
```

Young readers are picture books, Little Golden Books, Read-Along Storybooks, early-reader chapter books, and other illustrated books aimed at children (ages 2–8). They are the lightest-weight book category in the catalog — page counts typically range from 24 to 128 pages.

| Field        | Type   | Description                                                                 |
|--------------|--------|-----------------------------------------------------------------------------|
| `id`         | string | Unique stable identifier (slug). Used as localStorage key and poster filename. |
| `title`      | string | Display title                                                               |
| `type`       | string | `"young-reader"`                                                            |
| `author`     | string | Author or adapter name. Shown in the detail modal info row. Use `"Lucasfilm Ltd."` for items credited only to the studio. |
| `year`       | number | Publication year                                                            |
| `era`        | string | `"lucas"` or `"disney"`                                                     |
| `pageCount`  | number | Page count of the print edition. Shown on the card and in the modal.        |
| `description`| string | Optional. Spoiler-free summary shown in the detail modal.                   |
| `wookieepedia_override` | string | Explicit Wookieepedia URL for this item. Every item has this field populated. Set it carefully for young readers whose titles collide with a film or other catalog item of the same name (e.g. Little Golden Book editions that share a film's title). See Movie schema for details. |
| `timeline`              | string | In-universe date string (e.g. `"19 BBY"`, `"4 ABY–5 ABY"`). See Movie schema for details. |

The Young Reader schema is a subset of the Adult Novel schema. Young readers display a Buy on Amazon button in the modal, generated from the item title. No Audible button is shown. The `isNovel()` helper covers `young-reader` alongside `novel`, `ya-novel`, and `junior-novel`, so all stat calculations, card rendering, modal routing, and state management treat young readers identically to other book types. The type filter exposes them as a dedicated "Young Readers" option; the app displays the type label **Young Reader** on the card badge.

Young readers are read or unread — there is no partial state. They are excluded from the Watched percentage and Hours Remaining calculations, and contribute only to Read/Listened %, the Books/Comics count, and Pages Remaining stats.

### Graphic Novel schema

```json
{
  "id": "star-wars-rogue-one-graphic-novel-adaptation",
  "title": "Rogue One: A Star Wars Story Graphic Novel Adaptation",
  "type": "graphic-novel",
  "author": "Alessandro Ferrari",
  "year": 2017,
  "era": "disney",
  "pageCount": 80,
  "description": "A full-colour graphic novel adaptation of Rogue One, following Jyn Erso and a band of rebels on their desperate mission to steal the Death Star plans."
}
```

| Field        | Type   | Description                                                                 |
|--------------|--------|-----------------------------------------------------------------------------|
| `id`         | string | Unique stable identifier (slug). Used as localStorage key and poster filename. |
| `title`      | string | Display title                                                               |
| `type`       | string | `"graphic-novel"`                                                           |
| `author`     | string | Author/adapter name. Shown in the detail modal info row.                    |
| `year`       | number | Publication year                                                            |
| `era`        | string | `"lucas"` or `"disney"`                                                     |
| `pageCount`  | number | Page count of the print edition. Shown on the card and in the modal.        |
| `description`| string | Optional. Spoiler-free summary shown in the detail modal.                   |
| `wookieepedia_override` | string | Explicit Wookieepedia URL for this item. See Movie schema for details. |
| `timeline`              | string | In-universe date string (e.g. `"19 BBY"`, `"4 ABY–5 ABY"`). See Movie schema for details. |

Graphic novels are treated identically to `novel`, `ya-novel`, and `junior-novel` items in every part of the system — the same flat boolean state (`read` or `not read`), the same card meta label (`N pages`), the same detail modal (`renderNovelModal`), and the same stats contributions. Graphic novels display a Buy on Amazon button in the modal, generated from the item title. No Audible button is shown. They have no partial state. The type filter exposes them as a dedicated "Graphic Novels" option, positioned between "Junior Novels" and "Comics" in both the pill buttons and the mobile `<select>` dropdown.

### Comic schema

```json
{
  "id": "doctor-aphra-2016",
  "title": "Doctor Aphra (2016)",
  "type": "comic",
  "publisher": "Marvel Comics",
  "year": 2016,
  "era": "disney",
  "description": "The morally flexible rogue archaeologist's first solo ongoing; parallel to Star Wars (2015) #26–75.",
  "arcs": [
    {
      "arc": "Aphra",
      "issues": [
        { "issue": 1, "pageCount": 32 },
        { "issue": 2, "pageCount": 32 }
      ]
    },
    {
      "arc": "The Enormous Profit",
      "issues": [
        { "issue": 9, "pageCount": 32, "title": "The Enormous Profit, Part I" }
      ]
    }
  ]
}
```

Comics are the reading-medium analogue of TV series: a comic **series** groups its **issues** into named **arcs**, exactly the way a TV show groups its episodes into seasons. An arc is the unit of bulk marking (like a season), and an individual issue is the unit of granular marking (like an episode).

| Field                 | Type   | Description                                                                 |
|-----------------------|--------|-----------------------------------------------------------------------------|
| `id`                  | string | Unique stable identifier (slug). Used as localStorage key and poster filename. |
| `title`               | string | Display title                                                               |
| `type`                | string | `"comic"`                                                                   |
| `publisher`           | string | Publisher (e.g. `"Marvel Comics"`, `"IDW Publishing"`, `"Dark Horse Comics"`). Shown in the detail modal info row. |
| `year`                | number | First-issue release year                                                    |
| `era`                 | string | `"lucas"` or `"disney"`                                                     |
| `description`         | string | Optional. Spoiler-free summary shown in the detail modal.                   |
| `arcs[]`              | array  | Ordered list of story arcs                                                  |
| `arcs[].arc`          | string | Arc name (the real titled unit — Marvel does not title individual issues). Shown as the arc header in the modal. |
| `arcs[].issues[]`     | array  | Ordered list of issues within the arc                                       |
| `issues[].issue`      | number | Issue number. **Must be unique across the entire series** — it is the per-issue state key (state is a flat issue-keyed map, not nested by arc). |
| `issues[].pageCount`  | number | Page count of the issue. Used for Pages Remaining and the page-weighted progress bar. |
| `issues[].title`      | string | Optional. Issue title, shown beside the issue number in the modal. Most ongoings leave this blank; miniseries/anthologies/one-shots usually have titled issues. |
| `issues[].label`      | string | Optional. Overrides the issue-number label shown in the modal (defaults to `#N`). Used for non-numeric designations like `Alpha` or `Annual #1`. |
| `wookieepedia_override` | string | Explicit Wookieepedia URL for this item. Top-level field on the comic item. See Movie schema for details. |
| `timeline`              | string | In-universe date string (e.g. `"19 BBY"`, `"4 ABY–5 ABY"`). See Movie schema for details. |

Comics do not have `author`, `format`, `duration`, `disneyPlusUrl`, `audibleUrl`, `amazonUrl`, or `seasons`. State is stored as a **flat issue-keyed map** (`watched[comicId][issueNumber] = true`), so issue numbers must be unique within a series even across different arcs. Crossover events are modelled as their own standalone series; the tie-in issues that ran inside an ongoing stay listed under that ongoing's arcs, so no issue is double-counted. Mega-ongoings (e.g. *Star Wars (2015)*, *Doctor Aphra*) are modelled as contiguous arc groups that cover every issue (named story arcs + crossover tie-in arcs + an `Annuals` arc) so page totals stay accurate while preserving the arc-grouped UX.

### Console Game / VR Game schema

```json
{
  "id": "star-wars-jedi-fallen-order",
  "title": "Star Wars Jedi: Fallen Order",
  "type": "console-game",
  "developer": "Respawn Entertainment",
  "publisher": "Electronic Arts",
  "year": 2019,
  "era": "disney",
  "platforms": ["PS4", "PS5", "Xbox One", "Xbox Series X/S", "PC"],
  "description": "Set five years after Order 66, Fallen Order follows Cal Kestis, a young Padawan-turned-fugitive surviving as a scrapper on Bracca. When his Force abilities are exposed, he must outrun the Empire's Inquisitors while attempting to rebuild the Jedi Order.",
}
```

| Field        | Type     | Description                                                                 |
|--------------|----------|-----------------------------------------------------------------------------|
| `id`         | string   | Unique stable identifier (slug). Used as localStorage key and cover filename. |
| `title`      | string   | Display title                                                               |
| `type`       | string or string[] | `"console-game"`, `"vr-game"`, `"browser-game"`, or `"mobile-game"` — or an array of these when the game spans categories (e.g. `["console-game", "vr-game"]` for a game with both a standard and a VR release) |
| `developer`  | string   | Studio(s) that developed the game. Shown in the detail modal info row.      |
| `publisher`  | string   | Publisher(s). Stored for data completeness.                                 |
| `year`       | number   | Release year of the earliest platform release.                              |
| `era`        | string   | `"lucas"` or `"disney"`                                                     |
| `platforms`  | string[] | Ordered list of platforms the game is available on (e.g. `["PS5", "Xbox Series X/S", "PC"]`). Shown as pill tags in the detail modal and as a truncated summary on the catalog card. |
| `description`| string   | Optional. Spoiler-free summary shown in the detail modal.                   |
| `wookieepedia_override` | string | Explicit Wookieepedia URL for this item. See Movie schema for details. |
| `timeline`              | string | In-universe date string (e.g. `"19 BBY"`, `"4 ABY–5 ABY"`). See Movie schema for details. |

The game modal automatically generates a **Buy on Amazon** button from the item title for `console-game` and `vr-game` types — no URL field is stored in `catalog.json`. The generated URL is `https://www.amazon.com/s?k={title}`. Browser games and mobile games do not display this button.

Games do not have `duration`, `pageCount`, `disneyPlusUrl`, `audibleUrl`, or `seasons`. They are treated as binary items (played or not played) using the same flat state model as movies and novels.

The `year` field should reflect the earliest real-world release date across all platforms, not the most recent port.

### Browser Game schema

```json
{
  "id": "rebels-ghost-raid",
  "title": "Star Wars Rebels: Ghost Raid",
  "type": "browser-game",
  "developer": "Disney Interactive",
  "publisher": "Disney Interactive",
  "year": 2014,
  "era": "disney",
  "platforms": ["Browser"],
  "description": "A browser game set during the early days of the Spectres crew, in which players help defend the Ghost from Imperial attack."
}
```

The Browser Game schema is identical to the Console/VR Game schema — the only difference is `"type": "browser-game"`. Browser games typically have `"platforms": ["Browser"]`. All stat calculations, card rendering, badge text, and modal behaviour are identical to other game types — all are covered by `isGame()`.

### Mobile Game schema

```json
{
  "id": "star-wars-commander",
  "title": "Star Wars: Commander",
  "type": "mobile-game",
  "developer": "Disney Mobile",
  "publisher": "Disney Interactive",
  "year": 2014,
  "era": "disney",
  "platforms": ["iOS", "Android", "Windows Phone"],
  "description": "A base-building real-time strategy game in which players choose to fight for the Galactic Empire or the Rebel Alliance, constructing and defending bases while deploying troops in battles across the galaxy."
}
```

The Mobile Game schema is identical to the Console/VR Game schema — the only difference is `"type": "mobile-game"`. Mobile games list their target platforms in the `platforms` array (e.g. `["iOS", "Android"]`). All stat calculations, card rendering, badge text, and modal behaviour are identical to other game types — all are covered by `isGame()`.

### Audio Drama schema

```json
{
  "id": "the-high-republic-tempest-runner",
  "title": "The High Republic: Tempest Runner",
  "type": "audio-drama",
  "author": "Cavan Scott",
  "year": 2021,
  "era": "disney",
  "duration": 360,
  "description": "In the aftermath of a devastating Nihil raid, a young woman is captured and forced to survive within the brutal, cutthroat hierarchy of the galaxy's most feared marauders.",
}
```

| Field        | Type   | Description                                                                 |
|--------------|--------|-----------------------------------------------------------------------------|
| `id`         | string | Unique stable identifier (slug). Used as localStorage key and poster filename. |
| `title`      | string | Display title                                                               |
| `type`       | string | `"audio-drama"`                                                             |
| `author`     | string | Writer/adapter name. Shown in the detail modal info row.                    |
| `year`       | number | Release year                                                                |
| `era`        | string | `"lucas"` or `"disney"`                                                     |
| `duration`   | number | Total runtime in minutes. Shown on the card and in the modal, and counted toward Hours Remaining. |
| `description`| string | Optional. Spoiler-free summary shown in the detail modal.                   |
| `wookieepedia_override` | string | Explicit Wookieepedia URL for this item. See Movie schema for details. |
| `timeline`              | string | In-universe date string (e.g. `"19 BBY"`, `"4 ABY–5 ABY"`). See Movie schema for details. |

The audio drama modal automatically generates a **▶ Listen on Audible** button and a **Buy on Amazon** button from the item title — no URL fields are stored in `catalog.json`. URLs: `https://www.audible.com/search?keywords={title}` and `https://www.amazon.com/s?k={title}`.

Audio dramas are treated as binary items (listened or not listened) using the same flat boolean state model as movies, novels, and games. They do not have `format`, `pageCount`, `platforms`, `disneyPlusUrl`, `amazonUrl`, or `seasons`. Audio dramas are excluded from the Watched percentage and included in the Read/Listened percentage and Hours Remaining calculations.

The catalog order controls default display order. Items appear in the order they appear in `catalog.json`. The user's version is ordered chronologically by in-universe timeline position.

---

## State model

All watch/read/play state lives in a single `watched` object in memory, mirrored to `localStorage` under the key `startracker_watched` (defined as the constant `STORAGE_KEY`).

### Shape

```
watched = {
  // Movie, short-movie, novel, or game: boolean flag keyed by item id
  "rogue-one-a-star-wars-story": true,
  "bloodline": true,
  "star-wars-jedi-fallen-order": true,

  // Series or tv-shorts: nested object keyed by season number, then episode number
  "the-mandalorian": {
    1: { 1: true, 2: true, 3: false },
    2: { 1: true }
  },

  // Comic: single-level object keyed by issue number (NOT nested by arc)
  "doctor-aphra-2016": {
    1: true, 2: true, 9: false
  }
}
```

Movies, short-movies, novels, and all game types are all stored as a flat boolean (`id → true/false/undefined`). Series and tv-shorts are stored as a two-level integer-keyed map: `watched[seriesId][seasonNumber][episodeNumber]`. Comics are stored as a **one-level** integer-keyed map: `watched[comicId][issueNumber]` — arcs are a display grouping only and do not appear in state, which is why issue numbers must be unique within a series. Missing keys are treated as `false` via optional chaining (`watched[id]?.[season]?.[ep]`, `watched[comicId]?.[issue]`), so the object is sparse — only watched/read/played content is explicitly stored.

### Type helpers

A normaliser and seven helper functions centralise type branching across the codebase:

```js
function itemTypes(item)      { return Array.isArray(item.type) ? item.type : [item.type]; }
function isMovie(item)        { const t = itemTypes(item); return t.includes('movie') || t.includes('short-movie'); }
function isSeries(item)       { const t = itemTypes(item); return t.includes('series') || t.includes('tv-shorts'); }
function isNovel(item)        { const t = itemTypes(item); return t.includes('novel') || t.includes('ya-novel') || t.includes('junior-novel') || t.includes('young-reader'); }
function isGraphicNovel(item) { const t = itemTypes(item); return t.includes('graphic-novel'); }
function isGame(item)         { const t = itemTypes(item); return t.includes('console-game') || t.includes('vr-game') || t.includes('browser-game') || t.includes('mobile-game'); }
function isAudioDrama(item)   { const t = itemTypes(item); return t.includes('audio-drama'); }
function isComic(item)        { const t = itemTypes(item); return t.includes('comic'); }
```

`itemTypes` normalises `item.type` to an array regardless of whether it is a string or array, so every other helper and call site works correctly for both single-type and multi-type items. Every place that needs to distinguish content types calls these helpers — not `item.type` directly — so adding a new game type only requires updating `isGame()`, and adding an entirely new content category requires only a new helper plus a handful of call sites.

### Accessor functions

| Function           | Signature                                      | Description                                                                    |
|--------------------|------------------------------------------------|--------------------------------------------------------------------------------|
| `getMovieWatched`  | `(id) → bool`                                  | Returns watched/read/played state for a movie, short-movie, novel, or game     |
| `setMovieWatched`  | `(id, val)`                                    | Sets watched/read/played state and saves                                       |
| `getEpWatched`     | `(seriesId, season, ep) → bool`                | Returns watch state for one episode                                            |
| `setEpWatched`     | `(seriesId, season, ep, val)`                  | Sets one episode and saves                                                     |
| `setSeasonWatched` | `(seriesId, seasonNum, episodes[], val)`        | Bulk-sets all episodes in a season                                             |
| `setSeriesWatched` | `(item, val)`                                  | Bulk-sets every episode across all seasons in a series                         |
| `getIssueRead`     | `(comicId, issue) → bool`                      | Returns read state for one comic issue (keyed by issue number)                 |
| `setIssueRead`     | `(comicId, issue, val)`                        | Sets one issue and saves                                                        |
| `setArcRead`       | `(comicId, arc, val)`                          | Bulk-sets every issue in one arc                                               |
| `setComicRead`     | `(item, val)`                                  | Bulk-sets every issue across all arcs in a comic series                        |

`getMovieWatched` and `setMovieWatched` are shared by movies, short-movies, novels, graphic novels, games, and audio dramas — all six use the same flat boolean storage pattern. The function names are historical; they apply to all flat boolean item types.

Comics use their own issue-keyed accessors (`getIssueRead` / `setIssueRead` / `setArcRead` / `setComicRead`), which mirror the series accessors (`getEpWatched` / `setEpWatched` / `setSeasonWatched` / `setSeriesWatched`) but operate on a single-level issue map instead of a two-level season/episode map.

Every setter calls `save()`, which serialises `watched` to `localStorage` and then calls `updateStats()` to refresh the stats bar.

---

## Progress calculation

### Video content (movies, short-movies, series, tv-shorts)

The percentage shown in the Watched stat tile is computed purely from **watch time in minutes**, not episode or item count. A 70-minute pilot counts more than a 22-minute episode.

```
canonWatchedPct = totalWatchedMinutes() / totalMinutes() × 100   (rounded to nearest integer)
```

Novels, graphic novels, comics, games, and audio dramas are excluded from the video minute-based calculations — `totalMinutes()` and `watchedMinutesItem()` skip items where `isNovel(item)`, `isGraphicNovel(item)`, `isComic(item)`, `isGame(item)`, or `isAudioDrama(item)` is true. (Omitting the `isComic` guard here causes a crash in `seriesMinutes`, since comics have no `seasons` array.)

### Functions

| Function                | Description                                                                 |
|-------------------------|-----------------------------------------------------------------------------|
| `movieMinutes(item)`    | Returns `item.duration` for a movie or short-movie                         |
| `seriesMinutes(item)`   | Sums all episode durations across all seasons via nested `reduce`           |
| `totalMinutes()`        | Sums `movieMinutes` or `seriesMinutes` for every video item (excludes novels, comics, games, and audio dramas) |
| `watchedMinutesMovie(item)` | Returns `item.duration` if watched, else 0                             |
| `watchedMinutesSeries(item)` | Iterates seasons → episodes, sums durations for watched episodes only |
| `watchedMinutesItem(item)` | Returns 0 for novels, comics, games, and audio dramas; dispatches to movie or series variant otherwise |
| `totalWatchedMinutes()` | Sums `watchedMinutesItem` for every item in the catalog                    |

### Novel content

The Read/Listened stat tile is computed from an **equal-weight item count** across novels, graphic novels, comics, and audio dramas combined:

```
readListenedPct = (readNovels + readGraphicNovels + readComics + listenedAudioDramas) / (totalNovels + totalGraphicNovels + totalComics + totalAudioDramas) × 100   (rounded to nearest integer)
```

Where `readNovels` is the count of all novels (`novel` + `ya-novel` + `junior-novel` + `young-reader`) marked as read, `readGraphicNovels` is the count of all graphic novels marked as read, `listenedAudioDramas` is the count of all audio dramas marked as listened, and the denominator is the total count of all four. `isNovel()` covers `novel`, `ya-novel`, `junior-novel`, and `young-reader`; `isGraphicNovel()` covers `graphic-novel`; `isAudioDrama()` covers `audio-drama`. An item-count approach is used (rather than page- or minute-based) to avoid mixing incompatible units across content types. **Comics are also folded into this percentage** — each comic series counts as one item in both the numerator (when fully read) and the denominator. See the Stats bar section for the exact combined formula.

### Comic content

Comics are page-weighted internally (like series are minute-weighted) but item-counted in the headline stats (like novels). Four helpers, parallel to the series-minute helpers, drive everything:

| Function                       | Description                                                                       |
|--------------------------------|-----------------------------------------------------------------------------------|
| `comicIssueCount(item)`        | Total number of issues across all arcs (analogue of episode count)                |
| `comicPages(item)`             | Sums `pageCount` across every issue in every arc (analogue of `seriesMinutes`)    |
| `readComicPages(item)`         | Sums `pageCount` for read issues only (analogue of `watchedMinutesSeries`)        |
| `comicArcProgress(item, arc)`  | Returns `{ read: N, total: N }` issue counts for one arc (analogue of `seriesSeasonProgress`) |

- **Read/Listened %** and the **Books/Comics** count treat each comic series as one item — a series is "read" only when *every* issue is read (`itemStatus(item) === 'watched'`).
- **Pages Remaining** adds the page count of every *unread issue* across all comics to the unread-novel pages.
- The **card progress bar** and **status-bar fill** use the page-weighted ratio `readComicPages / comicPages`, giving a true partial fill exactly like a half-watched TV series.
- Comics are excluded from every minute-based calculation (Watched %, Hours Remaining).

### Audio drama content

Audio dramas contribute to the Read/Listened percentage (above) and to Hours Remaining, but not to the Watched percentage. In `updateStats()`, audio drama minutes are computed separately:

```
totalAudioDramaMins    = sum of duration for all audio dramas in the catalog
listenedAudioDramaMins = sum of duration for all listened audio dramas
```

These are added to the video time in the Hours Remaining calculation:

```
hoursRemaining = (totalMinutes() - totalWatchedMinutes() + totalAudioDramaMins - listenedAudioDramaMins) / 60
```

### Game content

The Played stat tile is computed from a simple **equal-weight item count**, since games have no meaningful duration unit to compare across titles:

```
playedPct = playedGames / totalGames × 100   (rounded to nearest integer)
```

Where `playedGames` is the count of all games marked as played, and `totalGames` is the total count of all games in the catalog. Every game title contributes equal weight regardless of length or platform.

### Item status

`itemStatus(item)` derives a display state from the same calculations:

| Status        | Condition                                                                  |
|---------------|----------------------------------------------------------------------------|
| `"unwatched"` | Movie/novel/graphic novel/game/audio drama not marked; or 0 minutes watched in series; or 0 pages read in comic |
| `"partial"`   | 1 or more minutes watched, less than total (series); or 1 or more pages read, less than total (comic) |
| `"watched"`   | Movie/novel/graphic novel/game/audio drama marked true; or watched minutes ≥ total minutes; or read pages ≥ total pages (comic) |

Movies, short-movies, novels, graphic novels, games, and audio dramas are always either `"unwatched"` or `"watched"` — there is no partial state for flat boolean items. **Series and comics are the only two types that can be `"partial"`** (a half-watched show, a half-read comic run). This status value drives the card border colour, the status bar fill height, the card progress bar fill, and the badge text.

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

`updateStats()` rebuilds all ten stat cards inside `#statsRow` on every save. It sets `innerHTML` directly — no diffing. On desktop the ten cards are laid out in two rows of five (`grid-template-columns: repeat(5, 1fr)`). On mobile they collapse to a two-column grid.

Each card is generated by the `sc(value, label, tooltip, accent)` helper defined inside `updateStats()`. The helper wraps the value and label in a `.stat-card` div and injects a `.stat-info` icon (a small italic `i` in a circle) absolutely positioned in the top-right corner. Hovering the icon reveals a `.stat-tooltip` explaining how that tile is calculated. The icon and tooltip are hidden on mobile via the `@media (max-width: 600px)` block.

The ten cards are displayed in this order:

| Card             | Value                                                                                                   | Colour class     |
|------------------|---------------------------------------------------------------------------------------------------------|------------------|
| Watched          | `totalWatchedMinutes / totalMinutes` as `N%` (video only)                                               | `.accent`        |
| Read/Listened    | `(readNovels + readGraphicNovels + readComics + listenedAudioDramas) / (totalNovels + totalGraphicNovels + totalComics + totalAudioDramas)` as `N%` — `totalNovels` includes all novel types: `novel`, `ya-novel`, `junior-novel`, and `young-reader` | `.accent`     |
| Played           | `playedGames / totalGames` as `N%`                                                                      | `.accent`        |
| Movies           | `watchedMovies / totalMovies` (e.g. `11/13`)                                                            | default          |
| Short Films      | `watchedShortFilms / totalShortFilms` (e.g. `0/2`)                                                     | default          |
| Episodes         | `watchedEps / totalEps` (e.g. `43/579`)                                                                 | default          |
| Books/Comics     | `(readNovels + readGraphicNovels + readComics) / (totalNovels + totalGraphicNovels + totalComics)` (e.g. `0/206`) — `totalNovels` includes `novel`, `ya-novel`, `junior-novel`, and `young-reader` | default     |
| Games            | `playedGames / totalGames` (e.g. `0/33`)                                                                | default          |
| Pages Remaining  | Total page count of all unread novels (all types including young readers) + unread graphic novels **plus all unread comic issues** | default          |
| Hours Remaining  | `Math.round((totalMinutes - totalWatchedMinutes + totalAudioDramaMins - listenedAudioDramaMins) / 60)` as `Nh` | default   |

Movies count covers both `movie` and `short-movie` types (via `isMovie()`). Episodes count covers both `series` and `tv-shorts` types (via `isSeries()`). The **Books/Comics** count covers all novel types (`novel`, `ya-novel`, `junior-novel`, and `young-reader` via `isNovel()`), graphic novels (`graphic-novel` via `isGraphicNovel()`), and every comic series (via `isComic()`) — each comic series counts as one and is complete only when all its issues are read. Young readers are fully included in this count, in the Read/Listened percentage, and in Pages Remaining. Games count covers `console-game`, `vr-game`, `browser-game`, and `mobile-game` (via `isGame()`). As additional game types are added in the future, `isGame()` will be expanded to include them, automatically incorporating them into the Played % and Games counts. Watched is video-only; Read/Listened covers novels, graphic novels, comics, and audio dramas; Played is games-only. Comics contribute to the Read/Listened %, the Books/Comics count, and Pages Remaining; they have no dedicated count tile. Graphic novels also have no dedicated tile — they appear in Read/Listened %, Books/Comics, and Pages Remaining, and can be isolated using the Type filter. Audio dramas have no dedicated count tile either — they appear in the Read/Listened percentage and Hours Remaining, and can be isolated using the Type filter.

---

## Rendering

The app has no templating engine. HTML is built via tagged template literals and assigned to `innerHTML`. There are two render scopes:

**Catalog grid** (`renderCatalog`) — Rebuilds the entire `#catalog` div on every filter change or state mutation. After setting `innerHTML`, it immediately re-attaches event listeners by querying the freshly created DOM nodes. It also updates `#catalogCount` with the text `"Showing N / T items"` (filtered count vs total catalog size) every time it runs.

**Modal** (`openModal`, `renderMovieModal`, `renderNovelModal`, `renderGameModal`, `renderSeriesModal`, `renderComicModal`) — Rebuilds `#modalBody` on open, and re-renders it in place on every interaction inside the modal. `bindModalEvents` is called after each re-render to re-attach all click handlers to the new DOM.

This pattern avoids stale closure bugs that would arise from caching references to DOM nodes across re-renders, at the cost of always doing a full subtree replace.

### Card layout

Each card is a horizontal flex row:

```
┌──────────┬─────────────────────────────┐
│          │ TYPE · YEAR · TIMELINE      │
│  poster  │ Title                       │
│          │ Duration/Pages/Platforms  BADGE │
│          ├─────────────────────────────┤
│          │ ══════progress bar══  [btn] │
└──────────┴─────────────────────────────┘
```

The type row renders as `TYPE · YEAR · TIMELINE` — e.g. `NOVEL · 2016 · 28 ABY`. The timeline segment is omitted if `item.timeline` is null.

The card root element receives a CSS class matching its status: `.card.watched`, `.card.partial`, or `.card.unwatched`. This drives border colour, status bar fill colour, and progress bar fill colour entirely via CSS — no inline colour styles.

**Type labels** are mapped in `renderCard`:

| `item.type`           | Displayed label       |
|-----------------------|-----------------------|
| `movie`               | Movie                 |
| `short-movie`         | Short Film            |
| `series`              | TV Series             |
| `tv-shorts`           | TV Shorts             |
| `novel`               | Novel                 |
| `ya-novel`            | YA Novel              |
| `junior-novel`        | Junior Novel          |
| `young-reader`        | Young Reader          |
| `graphic-novel`       | Graphic Novel         |
| `console-game`        | Console Game          |
| `vr-game`             | VR Game               |
| `browser-game`        | Browser Game          |
| `mobile-game`         | Mobile Game           |
| `audio-drama`         | Audio Drama           |
| `comic`               | Comic                 |

**Meta label** (shown below the title):

| Item type             | Meta label                                                        |
|-----------------------|-------------------------------------------------------------------|
| Movie/Short Film      | `formatMinutes(item.duration)` — e.g. `"2h 16m"`                 |
| Audio Drama           | `formatMinutes(item.duration)` — e.g. `"6h"`                     |
| Series/TV Shorts      | `N Season(s)` — e.g. `"3 Seasons"`                               |
| Novel/YA Novel/Junior Novel/Young Reader/Graphic Novel | `N pages` — e.g. `"349 pages"`           |
| Console/VR Game       | `formatPlatforms(item.platforms)` — up to 3 platforms joined by `, `; if more than 3, shows `"Platform1, Platform2 +N more"` |
| Browser Game          | `formatPlatforms(item.platforms)` — same as above; typically just `"Browser"` |
| Mobile Game           | `formatPlatforms(item.platforms)` — same as above; e.g. `"iOS, Android"` |
| Comic                 | `N issue(s)` — total issue count across all arcs, e.g. `"22 issues"`      |

**Badge classes and text**:

| Status      | CSS class          | Text (non-game, non-audio-drama) | Text (game)  | Text (audio drama)  |
|-------------|--------------------|----------------------------------|--------------|---------------------|
| `watched`   | `.badge-watched`   | ✓ Finished                       | ✓ Played     | ✓ Listened          |
| `partial`   | `.badge-partial`   | In Progress                      | —            | —                   |
| `unwatched` | `.badge-unwatched` | Not Started                      | Not Played   | Not Started         |

Games and audio dramas never show "In Progress" — they are always either binary states. Games use "Not Played" / "✓ Played". Audio dramas use "Not Started" / "✓ Listened". Comics behave like series — they use the standard "Not Started" / "In Progress" / "✓ Finished" text and can show the `partial` badge.

**Progress bar percentage**:

- Series/TV Shorts: `watchedMinutesSeries / seriesMinutes × 100`, giving a true partial fill.
- Comics: `readComicPages(item) / comicPages(item) × 100`, a page-weighted partial fill (the same partial-fill behaviour as series, but weighted by issue page counts rather than episode minutes).
- All other types (movies, short-movies, novels, graphic novels, games): `100` if status is `"watched"`, `0` otherwise — there is no partial state for flat boolean items.

**Quick-toggle button** (`.card-watch-btn`): shows `✓` when finished/played/listened, `＋` when not. For movies/short-movies/novels/graphic novels/games/audio-dramas, toggles the boolean directly via `setMovieWatched`. For series/tv-shorts, checks `itemStatus` — if the series is fully `watched`, marks all episodes unwatched; otherwise marks all episodes watched. Comics work the same way via `setComicRead` — if the comic is fully `watched`, marks all issues unread; otherwise marks all issues read. After toggling, calls `renderCatalog()` to refresh the grid.

The button tooltip reads "Mark as Not Played" / "Mark as Played" for games, "Mark as Not Started" / "Mark as Listened" for audio dramas, and "Mark as Not Started" / "Mark as Finished" for all other flat boolean types.

### formatPlatforms

`formatPlatforms(platforms)` formats a game's platform array for the card meta label:
- If 3 or fewer platforms: returns them joined with `", "` — e.g. `"PS5, Xbox Series X/S, PC"`
- If more than 3 platforms: returns the first two followed by `"+N more"` — e.g. `"PS4, PS5 +3 more"`

The full list of platforms is always shown as individual pill tags (`.platform-tag`) in the game's detail modal.

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

`openModal(item)` sets `#modalTitle` from `item.title`, fills `#modalBody` with the appropriate modal renderer based on type (`renderGameModal` → `renderAudioDramaModal` → `renderNovelModal` [for `isNovel` — covering `novel`, `ya-novel`, `junior-novel`, and `young-reader`] → `renderNovelModal` [for `isGraphicNovel`] → `renderComicModal` → `renderMovieModal` → `renderSeriesModal`; games are checked first, comics are checked after novels and graphic novels), adds the `.open` class to `#modalOverlay`, and calls `bindModalEvents`.

`closeModal()` removes the `.open` class. The overlay is `display: none` by default and `display: flex` when `.open`. Three triggers call `closeModal`: the `×` button, clicking the backdrop (overlay but not the modal box itself, checked via `e.target === e.currentTarget`), and the `Escape` key.

The modal box is `max-width: 680px`, `max-height: 85vh`, with `overflow-y: auto` on `.modal-body` so long episode lists scroll independently of the header.

### Movie / Short-movie modal

Layout (`.movie-detail`, vertical flex, `gap: 20px`):

1. **Info row** (`.movie-info-row`): badge, year, timeline (if present), runtime — all inline, wrapped.
2. **Description** (`.modal-description`): rendered only if `item.description` is present.
3. **Action buttons**: rendered in a flex row — **Watch button** (`.btn-disney`, rendered only if `item.disneyPlusUrl` is present) followed by **Wookieepedia button** (`.btn-wookieepedia`, always present). The Watch button links to the item's Disney+ or YouTube page in a new tab; label reads "▶ Watch on Disney+" for Disney+ URLs and "▶ Watch on YouTube" for `youtube.com` URLs, detected via `url.includes('youtube.com')`. The Wookieepedia button links to `https://starwars.fandom.com/wiki/{title_underscored}`, or to `item.wookieepedia_override` if set.
4. **Watch toggle button** (`.movie-watch-toggle`): full-width button with a circular icon on the left and two lines of text on the right. When watched, the button has class `.active`, the icon shows `✓`, main text is "Watched", sub-text is "Click to mark as not started". When unwatched, icon shows `○`, main text is "Mark as Watched", sub-text is "Click to log this movie". Clicking toggles the state, re-renders the modal body, re-binds events, and calls `renderCatalog()`.

### Audio drama modal

Layout (`.movie-detail`, vertical flex, `gap: 20px`):

1. **Info row** (`.movie-info-row`): badge, year, timeline (if present), author (`by Name`), runtime — all inline, wrapped.
2. **Description** (`.modal-description`): rendered only if `item.description` is present.
3. **Listen on Audible** (`.btn-audible`), **Buy on Amazon** (`.btn-amazon`), and **Wookieepedia** (`.btn-wookieepedia`): all three always rendered in a flex row. URLs generated from `item.title` — `https://www.audible.com/search?keywords={title}` and `https://www.amazon.com/s?k={title}`. Audible label reads "▶ Listen on Audible".
4. **Listen toggle button** (`.movie-watch-toggle`): same structure as the movie and novel toggles. When listened, the button has class `.active`, icon shows `✓`, main text is "Listened", sub-text is "Click to mark as not started". When not started, icon shows `○`, main text is "Mark as Listened", sub-text is "Click to log this audio drama".

The audio drama modal reuses the `.movie-watch-toggle` styling and the `#movieToggle` id. `bindModalEvents` routes audio drama items to re-render via `renderAudioDramaModal`. The `btn-audible` style is shared with the novel modal's Audible button.

### Novel modal

Layout (`.movie-detail`, vertical flex, `gap: 20px`):

1. **Info row** (`.movie-info-row`): badge, year, timeline (if present), author (`by Name`), page count — all inline, wrapped.
2. **Description** (`.modal-description`): rendered only if `item.description` is present.
3. **Purchase/reference buttons**: rendered in a flex row, generated from `item.title`.
   - **Listen on Audible** (`.btn-audible`): shown for `novel`, `ya-novel`, and `junior-novel` types only. Label: "Listen on Audible" (no ▶ prefix). URL: `https://www.audible.com/search?keywords={title}`.
   - **Buy on Amazon** (`.btn-amazon`): shown for all novel types (`novel`, `ya-novel`, `junior-novel`, `young-reader`, `graphic-novel`). URL: `https://www.amazon.com/s?k={title}`.
   - **Wookieepedia** (`.btn-wookieepedia`): always present for all novel and graphic novel types.
4. **Read toggle button** (`.movie-watch-toggle`): same structure as the movie toggle. When read, icon shows `✓`, main text is "Read", sub-text is "Click to mark as not started". When unread, icon shows `○`, main text is "Mark as Read", sub-text is "Click to log this book".

### Game modal

Layout (`.movie-detail`, vertical flex, `gap: 20px`):

1. **Info row** (`.movie-info-row`): badge, year, timeline (if present), developer name — all inline, wrapped.
2. **Platform tags** (`.game-platforms`): one `.platform-tag` pill per platform in `item.platforms`. All platforms are shown here (not truncated as on the card).
3. **Description** (`.modal-description`): rendered only if `item.description` is present.
4. **Action buttons**: rendered in a flex row — **Buy on Amazon** (`.btn-amazon`, rendered only for `console-game` and `vr-game` types; URL generated from `item.title` as `https://www.amazon.com/s?k={title}`) followed by **Wookieepedia** (`.btn-wookieepedia`, always present).
5. **Play toggle button** (`.movie-watch-toggle`): same structure as the movie and novel toggles. When played, the button has class `.active`, icon shows `✓`, main text is "Played", sub-text is "Click to mark as not played". When not played, icon shows `○`, main text is "Mark as Played", sub-text is "Click to log this game". Clicking toggles the state, re-renders the modal body, re-binds events, and calls `renderCatalog()`.

The game modal reuses the `.movie-watch-toggle` styling and the `#movieToggle` id. `bindModalEvents` routes game items to re-render via `renderGameModal`.

### Series / TV-Shorts modal

Layout:

1. **Description** (`.modal-description`): rendered only if `item.description` is present.
2. **Header actions** (`.series-header-actions`): "Watch on Disney+" / "Watch on YouTube" (`.btn-disney`, rendered only if `item.disneyPlusUrl` is present), **Wookieepedia** (`.btn-wookieepedia`, always present), "Mark All Watched" (`.btn-primary`, yellow fill), "Clear All" (`.btn-outline`, ghost), and a right-aligned percentage + time string (`N% · Xh Ym / Xh Ym`).
3. **Season blocks** (`.season-block`): one per season, each containing:
   - **Season header** (`.season-header`): season title, `X/Y episodes` progress text, and a "Mark Season" / "✓ All Watched" pill button (`.season-btn`). When all episodes in the season are watched, the button gets class `.all-watched` (green tint). Clicking the season button toggles all episodes in that season — if all are currently watched, it clears them; otherwise it marks them all.
   - **Episode list** (`.episode-list`): one `.episode-row` per episode, each showing a circular check indicator (`.ep-check`), episode number (`E1`, `E2`, …), episode title, and duration in minutes. Watched rows have class `.watched` (green tint background, muted title text, filled check circle). Clicking any row toggles that episode.

Every interactive action inside the modal re-renders the full `#modalBody` and re-calls `bindModalEvents` immediately after, keeping displayed state always in sync with `watched`.

### Comic modal

`renderComicModal` mirrors the series modal almost exactly — **arcs map to seasons and issues map to episodes** — and deliberately reuses the same CSS classes (`.season-block`, `.season-header`, `.season-btn`, `.episode-list`, `.episode-row`, `.ep-check`) so no new styling is required.

Layout:

1. **Info row** (`.movie-info-row`): badge, year, timeline (if present), publisher (if present), issue count — all inline, wrapped.
2. **Description** (`.modal-description`): rendered only if `item.description` is present.
3. **Header actions** (`.series-header-actions`): **Buy on Amazon** (`.btn-amazon`, URL generated from title as `https://www.amazon.com/s?k={title}`), **Wookieepedia** (`.btn-wookieepedia`), "Mark All Read" (`.btn-primary`, id `markAllComicBtn`), "Clear All" (`.btn-outline`, id `unmarkAllComicBtn`), and a right-aligned percentage + page string (`N% · R / T pages`) computed from `readComicPages` / `comicPages`.
4. **Arc blocks** (`.season-block`): one per arc, each containing:
   - **Arc header** (`.season-header`): arc name, `X/Y issues` progress text from `comicArcProgress(item, arc)`, and a "Mark Arc" / "✓ All Read" pill button (`.season-btn`). When every issue in the arc is read, the button gets class `.all-watched`. Clicking toggles all issues in that arc via `setArcRead` — if all are currently read, it clears them; otherwise it marks them all.
   - **Issue list** (`.episode-list`): one `.episode-row` per issue, each showing a circular check indicator (`.ep-check`), the issue number (`#1`, `#2`, …), the issue title or label if present, and the page count. Read rows have class `.watched`. Clicking any row toggles that issue via `setIssueRead`.

Because comic state is a **flat issue-keyed map** (`watched[comicId][issueNumber]`), issue numbers must be unique within a series across all its arcs; the data model assigns continuous numbering across arcs so crossover/annual issues never collide.

---

## Filtering and sorting

Three independent filter rows, one sort control, and a live search bar sit above the catalog grid. On desktop, the filter rows are enclosed in a collapsible panel (`#filtersCol`) toggled by a `#filtersToggleBtn` pill button (labelled "Filters" with a chevron that rotates when collapsed). Panel visibility is persisted to `localStorage` under `FILTERS_KEY`. Each filter row is a set of pill buttons that support **multi-select**: any combination of options within a row can be active simultaneously. The Type filter row is split into three intentional sub-rows: screen content (All, Movies, Short Films, TV Shows, TV Show Shorts) on the first line; book content (Adult Novels, YA Novels, Junior Novels, Young Readers, Graphic Novels, Comics) on the second; and game and audio content (Console Games, VR Games, Browser Games, Mobile Games, Audio Dramas) on the third. On mobile (≤ 600 px), the pill buttons are hidden and replaced by a `<select>` dropdown for each row, which remains single-select.

### Filter state

Each filter is stored as a `Set` of active values. An **empty set means "all"** — no filter applied. The "All" button is active when the set is empty.

| Variable         | Possible values in set                                                           | Desktop (pill buttons) | Mobile (select)  | Filter row label |
|------------------|----------------------------------------------------------------------------------|------------------------|------------------|------------------|
| `activeEras`     | `lucas`, `disney`                                                                | `.era-btn`             | `.era-select`    | Era              |
| `activeTypes`    | `movie`, `short-movie`, `series`, `tv-shorts`, `novel`, `ya-novel`, `junior-novel`, `young-reader`, `graphic-novel`, `comic`, `console-game`, `vr-game`, `browser-game`, `mobile-game`, `audio-drama` | `.type-btn` | `.type-select` | Type |
| `activeStatuses` | `not-started`, `in-progress`, `finished`                                         | `.status-btn`          | `.status-select` | Progress         |
| `activeSort`     | `chronological`, `release`                                                       | `.sort-btn`            | —                | Sort (separate)  |
| `activeSortDir`  | `asc`, `desc`                                                                    | —                      | —                | (arrow on button)|

All filter sets start empty (= "all") on load; sort defaults to `chronological` (displayed as **Default**) / `asc`; `searchQuery` starts as an empty string.

**Desktop button behaviour (multi-select):**
- Clicking a non-"All" button toggles that value in the set. "All" deactivates automatically when any value is in the set.
- Clicking an already-active button removes it from the set. When the set becomes empty, "All" re-activates automatically.
- Clicking "All" clears the entire set.
- Multiple values in a set act as **OR** within that filter row — e.g. Era = {lucas, disney} shows everything; Type = {movie, novel} shows only movies and novels.
- Filters across rows combine as **AND** — e.g. Era = {lucas} AND Type = {movie} shows only Lucas-era movies.

**Mobile select behaviour (single-select):** Changing the select clears the set and adds at most one value (or nothing, for "All"). The select reflects the current set state: shows the single selected value if exactly one is active, otherwise shows "All".

### Progress filter and games

Comics, like series, have a true `partial` state, so "In Progress" returns comics with some (but not all) issues read. "Finished" shows fully-read comics and "Not Started" shows comics with no issues read.

The Progress filter maps UI values to internal status strings via a lookup table:

```js
const statusMap = { 'not-started': 'unwatched', 'in-progress': 'partial', 'finished': 'watched' };
items = items.filter(i => {
  const s = itemStatus(i);
  return [...activeStatuses].some(key => (statusMap[key] ?? key) === s);
});
```

For games, "Finished" shows all played games, "Not Started" shows all unplayed games. "In Progress" always returns zero results for games (no partial state exists). Selecting both "Not Started" and "Finished" shows all games.

### Search

`#searchInput` is a live `<input type="search">` that filters by title as the user types. The query is stored in the `searchQuery` string and applied as a case-insensitive substring match against `item.title`. An empty string is a no-op.

On desktop, `#searchInput` sits in the `.controls-right` column below the sort buttons, right-aligned and vertically level with the Progress filter row. On mobile it sits below the sort buttons, full-width, as a direct continuation of the `.controls-right` stack.

### Pipeline

`filteredCatalog()` applies all three filters, the search query, then the sort in sequence:

```
catalog[]
  → era filter    (activeEras.size > 0 → i.era ∈ activeEras)
  → type filter   (activeTypes.size > 0 → i.type ∈ activeTypes)
  → status filter (activeStatuses.size > 0 → itemStatus(i) ∈ mapped activeStatuses)
  → search        (searchQuery → i.title.toLowerCase().includes(q))
  → sort
  → renderCatalog()
```

Each filter step is a simple `Array.filter` on the in-memory `catalog` array. A filter with an empty set is a no-op (no items are removed). No data is re-fetched.

### Sort keys

| Sort key (`activeSort`) | Display label | Key                          | Default (`asc`)        | Reversed (`desc`)  |
|-------------------------|---------------|------------------------------|------------------------|--------------------|
| `chronological`         | **Default**   | Position in `catalog.json`  | As-is (chronological)  | Reversed array     |
| `release`               | Release Date  | `item.year`                  | Oldest first           | Newest first       |

### Sort direction

Each sort supports two directions — ascending (`↑`) and descending (`↓`) — toggled by clicking the active sort button a second time. `activeSortDir` resets to `'asc'` whenever the user switches to a different sort key. `updateSortButtons()` reads `activeSort` and `activeSortDir`, then updates every `.sort-btn`'s `textContent`. It is called at the end of every `render()` pass and immediately after a sort button click.

---

## Event handling

Events are bound in two places:

**`bindEvents()`** — called once on init. Handles:
- Modal close button click
- Modal overlay backdrop click (checks `e.target === e.currentTarget`)
- `Escape` keydown → `closeModal()`, `closeSaveModal()`, and `closeShareModal()`
- All `.era-btn` / `.type-btn` / `.status-btn` clicks → routed through `applyFilterBtn(filterType, val)`, which toggles `val` in the corresponding `Set` (or clears the set if `val === 'all'`), calls `syncFilterButtons` to update `.active` classes, syncs the mobile select, then calls `renderCatalog()`.
- All `.era-select` / `.type-select` / `.status-select` changes → routed through `applyFilterSel(filterType, val)`, which clears the set and adds at most one value, then syncs buttons and re-renders. `getActiveSet(filterType)` is a helper that returns the correct set for a given filter type. `syncFilterButtons(filterType)` updates `.active` on all buttons in the group: the "All" button is active when the set is empty, all other buttons reflect set membership.
- All `.sort-btn` clicks → if the clicked button is already the active sort, `activeSortDir` toggles; otherwise the clicked button becomes active, `activeSort` updates, and `activeSortDir` resets to `'asc'`. `updateSortButtons()` is called first, then `renderCatalog()`.
- Theme toggle click (`#themeBtn`) → reads `html.classList.contains('light')`; flips to the opposite theme; persists to `localStorage` under `THEME_KEY`; calls `applyTheme(theme)`, which toggles the `light` class on `<html>` and updates the button's `title`.
- Filters toggle click (`#filtersToggleBtn`) → reads whether `#filtersCol` has class `filters-hidden`; calls `applyFiltersVisible(visible)`, which toggles the `filters-hidden` class on `#filtersCol` and the `filters-collapsed` class on `#filtersToggleBtn` (which rotates the chevron icon via CSS); persists the new state to `localStorage` under `FILTERS_KEY`.
- Reset button click → shows `confirm('Reset all progress? This cannot be undone.')` dialog; on confirmation sets `watched = {}`, calls `save()` and `renderCatalog()`
- Save button click → calls `openSaveModal()`, adding `.open` to `#saveModalOverlay`
- Save/close modal buttons → call `closeSaveModal()`
- Save modal backdrop click → calls `closeSaveModal()`
- Download backup button click → calls `downloadWatchHistory()`
- Load button click → programmatically triggers `#loadInput.click()`
- `#loadInput` change → calls `loadWatchHistory(file)`, then clears the input value
- Share button click (`#shareBtn`) → calls `generateShareImage()`, which renders a 1080×1080 Canvas progress card and passes it to `openShareModal(canvas)`, adding `.open` to `#shareModalOverlay`
- Share modal close/Close buttons → call `closeShareModal()`
- Share modal backdrop click → calls `closeShareModal()`
- Download button (`#downloadImageBtn`) → calls `canvas.toBlob()` and triggers a `tbsb-progress.png` download via a temporary object URL
- Copy Image button (`#copyImageBtn`) → writes the canvas blob to the clipboard via `navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])`; falls back to an `alert` if the Clipboard API is unavailable

**`bindModalEvents(item)`** — called after every modal render. Routes to different handlers based on type:
- **Comic**: "Mark All Read" (`#markAllComicBtn`) → `setComicRead(item, true)`; "Clear All" (`#unmarkAllComicBtn`) → `setComicRead(item, false)`; `.season-btn` clicks → `setArcRead` toggle; `.episode-row` clicks → `setIssueRead` toggle. All re-render `renderComicModal`, re-bind, and call `renderCatalog()`. Checked first (via `isComic(item)`) before the game, audio drama, novel, movie, and series handlers.
- **Game**: `#movieToggle` → `setMovieWatched`, re-render `renderGameModal`, re-bind, `renderCatalog()`. Checked first before audio drama, novel, and movie handlers.
- **Audio Drama**: `#movieToggle` → `setMovieWatched`, re-render `renderAudioDramaModal`, re-bind, `renderCatalog()`. Checked after game, before novel and movie handlers.
- **Novel / Graphic Novel**: `#movieToggle` → `setMovieWatched`, re-render `renderNovelModal` (shared by `isNovel` — covering `novel`, `ya-novel`, `junior-novel`, and `young-reader` — and `isGraphicNovel`), re-bind, `renderCatalog()`
- **Movie**: `#movieToggle` → `setMovieWatched`, re-render `renderMovieModal`, re-bind, `renderCatalog()`
- **Series**: "Mark All Watched" (`#markAllBtn`) → `setSeriesWatched(item, true)`; "Clear All" (`#unmarkAllBtn`) → `setSeriesWatched(item, false)`; `.season-btn` clicks → `setSeasonWatched` toggle; `.episode-row` clicks → `setEpWatched` toggle. All re-render, re-bind, and call `renderCatalog()`.

The catalog card click handler lives inside `renderCatalog()` and is re-attached every time the catalog grid is rebuilt. Card body clicks open the modal; the quick-toggle button (`.card-watch-btn`) calls `quickToggle(item)` with `e.stopPropagation()` so the modal does not also open.

`renderFooter()` — called once at the end of `init()`. Picks a random quote from `FOOTER_QUOTES` and sets `footer p`'s `innerHTML`. The footer is static after that — quotes change only on a full page reload.

---

## CSS design system

All colours and radii are defined as CSS custom properties on `:root`. The app supports two themes — **light** (default) and **dark** — applied by toggling the `light` class on the `<html>` element. The application defaults to light mode (`localStorage.getItem(THEME_KEY) || 'light'`). Structurally, `:root` holds the dark mode token values and `html.light` overrides them with light mode values; this is a CSS implementation detail and does not make dark mode the default. Layout, spacing, and radius tokens are shared between themes.

### Dark mode tokens

| Variable          | Dark value                     | Usage                                        |
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
| `--accent`        | `#ffe81a`                      | Star Wars yellow — logo, active filters, Watched/Read/Played tiles |
| `--accent-dim`    | `rgba(255,232,26,0.15)`        | Active filter button background              |
| `--accent-hover`  | `#ffed4a`                      | Hover accent                                 |
| `--watched`       | `#22c55e`                      | Green — watched/read/played state            |
| `--watched-dim`   | `rgba(34,197,94,0.15)`         | Watched/played state background tint         |
| `--partial`       | `#f59e0b`                      | Amber — in-progress state (series only)      |
| `--partial-dim`   | `rgba(245,158,11,0.15)`        | In-progress background tint                  |
| `--radius`        | `12px`                         | Standard border radius                       |
| `--radius-sm`     | `8px`                          | Small border radius (buttons, inputs)        |
| `--shadow`        | `0 4px 24px rgba(0,0,0,0.4)`   | Card hover shadow                            |

### Light mode tokens (default)

| Variable          | Light value                      |
|-------------------|----------------------------------|
| `--bg`            | `#f0f0f7`                        |
| `--bg-card`       | `#ffffff`                        |
| `--bg-card-hover` | `#f5f5fb`                        |
| `--bg-elevated`   | `#e8e8f2`                        |
| `--border`        | `#dcdcea`                        |
| `--border-bright` | `#c0c0d4`                        |
| `--text`          | `#0f0f1a`                        |
| `--text-muted`    | `#5c5c74`                        |
| `--text-dim`      | `#9898b2`                        |
| `--accent`        | `#c8920c`                        |
| `--accent-dim`    | `rgba(200,146,12,0.13)`          |
| `--accent-hover`  | `#a87808`                        |
| `--watched`       | `#16a34a`                        |
| `--watched-dim`   | `rgba(22,163,74,0.12)`           |
| `--partial`       | `#d97706`                        |
| `--partial-dim`   | `rgba(217,119,6,0.12)`           |
| `--shadow`        | `0 4px 24px rgba(0,0,0,0.1)`     |

The accent in light mode is a deep amber-gold (`#c8920c`) rather than the bright yellow used in dark mode — yellow has insufficient contrast against white backgrounds at normal text sizes.

Several properties that are hardcoded rather than variable-driven also have `html.light` overrides: the header backdrop colour, the modal box-shadow, the modal overlay opacity, and the watched/partial card border opacity (increased so green/amber borders remain visible against white card backgrounds).

### Header

The header is `position: sticky; top: 0; z-index: 100` with `backdrop-filter: blur(20px)` and a semi-transparent background (dark: `rgba(10,10,15,0.85)`, light: `rgba(240,240,247,0.92)`), so it floats above the catalog without fully blocking it. The inner content is constrained to `max-width: 1200px` and laid out as a single flex row: logo on the left, header action buttons (Reset, Save, Load, and the theme toggle) on the right as a `.header-actions` flex row with `gap: 8px`.

### Filter and sort buttons

Both `.filter-btn` and `.sort-btn` share the same visual treatment: `border-radius: 100px` pill shape, `--bg-card` background, `--border` border, `--text-muted` text. On hover, border brightens and text becomes `--text`. When `.active`, background becomes `--accent-dim`, border becomes `--accent`, text becomes `--accent`, font-weight 600. Filter row labels (`.filter-row-label`) are `min-width: 56px`, uppercase, `--text-dim` colour, aligned center within their row.

The `.filter-toggle-btn` is a pill button (`.filter-toggle-btn`, `border-radius: 100px`) shown only on desktop (hidden on mobile via the default `display: none`, overridden to `display: inline-flex` at `min-width: 601px`). It contains a funnel SVG icon, the text "Filters", and a chevron SVG that rotates `180deg` when the panel is collapsed (via `.filter-toggle-btn.filters-collapsed .toggle-chevron { transform: rotate(180deg) }`). The filter rows sit inside `.filters-col`, which animates between `max-height: 600px` (expanded) and `max-height: 0` (collapsed) with a `0.3s` transition.

The Type filter row uses a nested `.type-btn-rows` flex column containing three `.type-btn-subrow` divs, allowing three intentional rows of buttons to share a single "TYPE" label that vertically centres alongside them. Sub-row 1: All + screen types; sub-row 2: book types (Adult Novels through Comics); sub-row 3: game types + Audio Dramas.

### Platform tags

Game detail modals display each platform as a `.platform-tag` pill: `--bg-elevated` background, `--border-bright` border, `--text-muted` text, `border-radius: 100px`. Tags are contained in a `.game-platforms` flex-wrap row with `gap: 6px`.

### Catalog count

A `.catalog-count-row` sits between the controls and the catalog grid, right-aligned. It contains a `#catalogCount` `<span>` that `renderCatalog()` updates on every render with `"Showing N / T items"`. Hidden on mobile via the `@media (max-width: 600px)` block.

### Catalog grid

Fixed two-column grid: `grid-template-columns: repeat(2, 1fr)`, `gap: 16px`. No maximum number of rows — the grid grows as needed.

### Action buttons

| Class           | Colour                       | Usage                                           |
|-----------------|------------------------------|-------------------------------------------------|
| `.btn-primary`  | `--accent` (yellow) fill     | Mark All Watched in series modal                |
| `.btn-outline`  | Transparent, ghost border    | Clear All in series modal                       |
| `.btn-secondary`| Transparent, muted border    | Header actions (Reset, Save, Load, Share, theme toggle)|
| `.btn-theme`    | Inherits `.btn-secondary`    | Icon-only theme toggle; adds `display: flex` and tighter padding. Contains two SVGs (`.icon-sun`, `.icon-moon`) — CSS shows the sun in dark mode and the moon in light mode via `html.light` visibility rules. |
| `.btn-disney`   | `#0063e5` (blue)             | Watch on Disney+ / YouTube links                |
| `.btn-audible`  | `#ff6f00` (deep orange)      | Listen on Audible links in novel modal          |
| `.btn-amazon`   | `#ff9900` (amber), black text| Buy on Amazon links in novel and game modals    |
| `.btn-wookieepedia` | Transparent, ghost border | **Wookieepedia** button shown in every detail modal. URL is generated by `wookiepediaUrl(item)`: if `wookieepedia_override` is non-empty that value is used directly; otherwise the URL is `https://starwars.fandom.com/wiki/{title}` with spaces replaced by underscores. Every catalog item now has `wookieepedia_override` explicitly populated, so the fallback auto-generation is rarely exercised. Set the override carefully for items whose title is shared with a character, film, or other entry (e.g. the *Clone Wars* film and TV series, or Little Golden Books that share a film's title). |

---

## Persistence

`localStorage` is the only automatic persistence mechanism. Two keys are used:

| Key                           | Constant        | Content                                         |
|-------------------------------|-----------------|--------------------------------------------------|
| `startracker_watched`         | `STORAGE_KEY`   | Serialised `watched` object — all play/watch/read state |
| `startracker_theme`           | `THEME_KEY`     | `"dark"` or `"light"` — user's theme preference |
| `startracker_filters_visible` | `FILTERS_KEY`   | `"true"` or `"false"` — whether the filter panel is expanded or collapsed |

`watched` is serialised to JSON and written on every state mutation. On load, `init()` reads it back with `JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')`. The theme preference and filter panel visibility are both read at the very start of `init()` (before the catalog fetch) so the correct theme and panel state are applied before any rendering occurs. All three keys default gracefully — missing `watched` becomes `{}`, missing theme becomes `'light'`, missing filters visibility becomes `true` (expanded).

Clearing browser storage or clicking the Reset button (which calls `confirm()` first) sets `watched = {}` and re-saves, returning all content state to zero. The theme preference is unaffected by Reset.

---

## Save / load

The header exposes five action buttons — **Reset**, **Save**, **Load**, **Share**, and the **theme toggle**.

### Save (export)

Clicking **Save** opens a dedicated modal (`#saveModalOverlay`) that explains the localStorage limitation and offers a download. The modal contains two buttons:

| Button | Behaviour |
|--------|-----------|
| **Close** | Calls `closeSaveModal()` |
| **Download backup** | Calls `downloadWatchHistory()`, triggering a `tbsb-backup.json` download |

`downloadWatchHistory()` serialises the in-memory `watched` object to a formatted JSON string, wraps it in a `Blob`, creates a temporary object URL, programmatically clicks a disposable `<a>` element to trigger the browser's native file-save dialog, then immediately revokes the URL.

The downloaded file is the exact in-memory shape of `watched` — movies, novels, and games as flat booleans, series as nested season/episode maps. Example:

```json
{
  "the-mandalorian": {
    "1": { "1": true, "2": true, "3": false },
    "2": { "1": true }
  },
  "rogue-one-a-star-wars-story": true,
  "bloodline": true,
  "star-wars-jedi-fallen-order": true
}
```

### Load (import)

Clicking **Load** programmatically clicks a hidden `<input type="file" id="loadInput" accept=".json">`, opening the browser's native file picker filtered to `.json` files.

`loadWatchHistory(file)` reads the file asynchronously via `FileReader`. If `JSON.parse` fails or the result is not a plain object, the user sees an `alert`. On success, `watched` is replaced with the parsed data, `save()` flushes it to localStorage, and `renderCatalog()` refreshes the grid.

The backup file format is identical to the `startracker_watched` localStorage entry. Any file produced by a previous version of the app — including backups predating novel or game support — is a valid input. Game entries are stored as flat booleans just like movies, so there is no migration needed.

### Share (progress image)

Clicking **Share** generates a 1080×1080 PNG progress card using the Canvas 2D API (no external dependencies) and displays it in a preview modal (`#shareModalOverlay`) before the user decides to save it.

**Image layout** (top to bottom):
- Title "My Star Wars Canon Progress" in bold black, left-aligned
- Three stat tiles (Watched %, Read/Listened %, Played %) on a uniform `#f0f0f7` background
- Four consolidated progress rows as white cards: Movies & Short Films, TV Episodes, Books/Comics & Audio, Games
- "Generated at The Backlog Strikes Back" footer label

All elements share the same light `#f0f0f7` background — there is no two-tone or dark header section. The canvas is always rendered in the light-mode palette regardless of the user's current theme.

**Color-coded progress:** Both the stat tile percentages and the progress bar fills use a shared `progressColor(ratio)` helper:

| Range | Colour |
|-------|--------|
| 0 % | Empty bar / grey left edge |
| 1 %–25 % | Red (`#dc2626`) |
| 26 %–74 % | Gold (`#c8920c`) |
| 75 %–100 % | Green (`#16a34a`) |

`rr(x, y, w, h, r)` is a local helper that draws rounded rectangles via `quadraticCurveTo` for broad browser compatibility. The generated canvas is stored in the module-level `_shareCanvas` variable so the download and copy handlers can access it after the preview modal opens.

**Preview modal buttons:**

| Button | Behaviour |
|--------|-----------|
| **Close** / **×** | Calls `closeShareModal()` |
| **Copy Image** | Writes blob to clipboard via `navigator.clipboard.write()`; shows "✓ Copied!" for 2 s; alerts on failure |
| **Download** | Triggers a `tbsb-progress.png` download via a temporary object URL |

---

## Loading overlay

On first visit (before catalog images load), a full-screen loading overlay (`#loadingOverlay`) covers the page. It shows a centred `border-top` spinner (`.spinner`, `@keyframes spin`) against the page background. After `init()` completes, the overlay receives the `fade-out` class (0.4 s opacity transition) and is removed from the DOM on `transitionend`. An inline `<script>` in `<head>` applies `html.light` immediately if the stored theme is light, so the overlay background colour matches the user's theme before any CSS loads.

---

## Responsive layout

A single `@media (max-width: 600px)` block overrides desktop styles. The desktop layout is unchanged above that breakpoint.

**Header**
- `.header-inner` gains `flex-wrap: wrap; gap: 10px; padding: 10px 16px`.
- `.logo` font size drops to `1rem`.
- `.btn-secondary` padding reduces to `6px 10px`, font to `0.8rem`; `.header-actions` gap reduces to `6px`.

**Main content**
- `main` padding reduces to `16px 16px 60px`.
- `.controls-row` gap reduces to `12px; margin-bottom: 20px`.
- `.sort-bar` becomes `width: 100%; flex-shrink: 1`.

**Stats row**
- On desktop: `.stats-row` is a `5-column grid` (`grid-template-columns: repeat(5, 1fr)`), producing two rows of five tiles.
- On mobile: `.stats-row` collapses to a `2-column grid` (`grid-template-columns: 1fr 1fr`). With 10 stat tiles, this produces 5 rows of 2.
- `.stat-value` reduces to `1.5rem`, `.stat-label` to `0.72rem`.

**Filters**
- `.filter-btn` elements are hidden (`display: none`). `.filter-select` dropdowns are shown (`display: block`) and stretch to fill the remaining row width. The dropdowns are styled to match the dark theme with a custom SVG chevron.
- The `.type-btn-rows` / `.type-btn-subrow` nested structure is irrelevant on mobile since all buttons are hidden.

**Catalog count**
- `.catalog-count-row` is hidden (`display: none`).

**Catalog grid**
- `.catalog` collapses to single column (`grid-template-columns: 1fr`), gap reduces to `10px`.
- `.card-poster` narrows to `80px`.
- `.card-title` keeps `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` — titles truncate with an ellipsis on mobile exactly as they do on desktop.

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

Append an object to the `"content"` array in `catalog.json` following the appropriate schema above. The `id` must be unique across all items — it is used as the localStorage key and the poster/cover filename. The app reloads the catalog on every page load, so changes take effect on refresh.

Every new item should include a `timeline` field with the in-universe BBY/ABY date (e.g. `"19 BBY"`, `"4 ABY"`, `"19 BBY–4 ABY"` for ranges). Check the item's Wookieepedia article infobox (`|timeline=` or `|canon_timeline=` field) for the canonical value. Items without a known date can set `"timeline": null`. Insert the item at the correct chronological position in the array — the catalog order controls display order, and the **Default** sort mode (`chronological` internally) uses array position as-is, so the catalog is kept in in-universe chronological order as best as possible.

### Adding movies or series

Follow the Movie or Series schema. `duration` values are in minutes. `format` is stored but no longer used for filtering — it is kept for data completeness.

### Adding novels (adult, YA, or junior)

Use `"type": "novel"` for adult novels, `"type": "ya-novel"` for young adult novels, `"type": "junior-novel"` for junior novels (middle-grade), and `"type": "young-reader"` for picture books and illustrated books aimed at young children — see the dedicated Young Reader section below. The schema is identical for all four — the only difference is the `type` field. All four types are treated identically by all stat calculations and state management via `isNovel()`.

`pageCount` is an integer (print edition page count). No URL fields are needed in `catalog.json` — the modal generates purchase links automatically from the item title. `novel`, `ya-novel`, and `junior-novel` types show both Audible and Amazon buttons; `young-reader` and `graphic-novel` types show only the Amazon button.

Novels are read or unread — there is no partial state. They are excluded from the Watched percentage and Hours Remaining calculations, and contribute only to Read/Listened %, the Books/Comics count, and Pages Remaining stats.

### Adding young reader books

Use `"type": "young-reader"` for picture books, Little Golden Books, Read-Along Storybooks, and other illustrated books aimed at young children (ages 2–8). Provide `author` (the credited writer; use `"Lucasfilm Ltd."` for books credited only to the studio), `year`, `era`, and `pageCount`.

Young readers use the same schema as junior novels. They share the `renderNovelModal` detail modal and the `isNovel()` helper, so they are automatically included in all book-related stat calculations (Read/Listened %, Books/Comics count, Pages Remaining) without any code changes.

Use `wookieepedia_override` for any young reader whose title exactly matches another catalog item — most notably Little Golden Book editions of the main saga films (e.g. `"The Phantom Menace"` collides with the film entry; override to the Wookieepedia disambiguation page for the book).

### Adding graphic novels

Use `"type": "graphic-novel"` and follow the Graphic Novel schema above. Provide `author` (adapter or writer credit), `year`, `era`, `pageCount`, and an optional `description`.

Graphic novels are read or unread — there is no partial state. They are treated identically to `novel` and `ya-novel` items in all calculations: excluded from the Watched percentage and Hours Remaining, and counted in Read/Listened %, Books/Comics, and Pages Remaining. The detail modal is shared with novels (`renderNovelModal`) — it shows the author, year, page count, description, and the "Mark as Read" toggle.

Use `"era": "lucas"` for graphic novel adaptations of the six George Lucas films (Episodes I–VI). Use `"era": "disney"` for all Disney-era publications, including adaptations of Clone Wars or Rebels content, even if those stories are set in the prequel era — era assignment follows the publication date, consistent with how the rest of the catalog marks Disney-era comics.

For the `author` field on items that are screencast/screenshot adaptations without a credited writer (e.g. Screen Comix or cinestory comics), use `"Lucasfilm Ltd."` or the publisher name to avoid rendering `"by undefined"` in the modal.

### Adding games

**Console games** (`"type": "console-game"`) are games available on standard home consoles and/or PC. Set `year` to the earliest real-world release date across all platforms. List all known platforms in `platforms` as an array of strings.

**VR games** (`"type": "vr-game"`) are games that require a VR headset (e.g. Meta Quest, PSVR, PC VR, Samsung Gear VR). Use `"platforms"` to list the specific headsets supported.

If a game has both a standard release and a VR mode (e.g. a console game with an optional PSVR mode), set `"type": ["console-game", "vr-game"]`. The item will appear in both type filters.

**Browser games** (`"type": "browser-game"`) are games that were playable in a web browser, typically hosted on Disney.com, StarWars.com, or similar official sites. Use `"platforms": ["Browser"]`.

**Mobile games** (`"type": "mobile-game"`) are games released for iOS and/or Android. List all platforms the game was available on (e.g. `["iOS", "Android"]`, `["iOS", "Android", "Windows Phone"]`).

All game types are played or not played — there is no partial state. They are excluded from all minute-based calculations (Watched %, Hours Remaining) and contribute only to Played %, Games, and the played/unplayed filter. All types share identical card rendering, badge text, and modal behaviour via `isGame()`.

When additional game types are introduced in the future, add their `type` values to `isGame()` and `typeLabels` — they will automatically be picked up by all stat calculations, filtering, card rendering, and modal routing.

No `amazonUrl`, `audibleUrl`, or `disneyPlusUrl` fields are used for games. Console and VR games automatically get a Buy on Amazon button generated from the item title; browser and mobile games do not.

### Adding comics

Use `"type": "comic"` and follow the Comic schema above. Provide `publisher` (e.g. `"Marvel Comics"`, `"Dark Horse Comics"`), `year`, `era`, an optional `description`, and an `arcs` array. Each arc is `{ "arc": name, "issues": [...] }`, and each issue is `{ "issue": number, "pageCount": int, "title"?: string, "label"?: string }`.

Comic progress is stored as a **flat issue-keyed map** (`watched[id][issueNumber]`), so **issue numbers must be unique within a series across all of its arcs**. Number issues continuously across arcs rather than restarting at 1 per arc; annuals, one-shots, and crossover issues should each get their own unique number. A crossover issue that appears in multiple series should be listed once, in the most appropriate series. Mega-ongoing runs can be split into multiple arcs to keep the issue list manageable.

Comics behave exactly like series for progress purposes: they have a true `partial` state (some issues read), contribute to the Read/Listened % and Books/Comics stat tile (counted only as fully read when every issue is read), and add the page counts of their unread issues to Pages Remaining. They are excluded from all minute-based calculations via `isComic()`. A comic is treated identically to a novel in the Books/Comics tile but renders with the arc/issue modal UI.

The catalog order controls default display position. Insert each comic series at the correct in-universe chronological position within `catalog.json`, immediately after the surrounding film, novel, or series anchor it follows.

### Adding audio dramas

Use `"type": "audio-drama"`. Provide `author` (writer/adapter name) and `duration` (total runtime in minutes). No `audibleUrl` is needed — the modal generates a Listen on Audible button automatically from the item title.

Audio dramas are listened or not listened — there is no partial state. They are excluded from the Watched percentage, counted in Read/Listened percentage (equal weight alongside novels), and contribute their full runtime to Hours Remaining. They do not have `format`, `pageCount`, `platforms`, `disneyPlusUrl`, or `amazonUrl`.

The catalog order controls default display position. Insert audio dramas at the correct chronological position within `catalog.json` relative to the surrounding novels and films.

### Adding cover images

Drop a `.jpg` into the `posters/` directory named after the item's `id`:

```
posters/the-mandalorian.jpg
posters/rogue-one-a-star-wars-story.jpg
posters/bloodline.jpg
posters/star-wars-jedi-fallen-order.jpg
```

The filename must match the `id` field in `catalog.json` exactly, with a `.jpg` extension. Items with no matching file display a `✕` placeholder over a hatched background automatically — no configuration required. For games, Steam library portrait images (`library_600x900_2x.jpg` from Valve's CDN) work well as cover art.
