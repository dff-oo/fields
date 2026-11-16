# Contributing story maps

Story maps are JSON files. The builder loads and saves them in the browser; nothing in this repo is written by the builder. [examples/field-001.json](../examples/field-001.json) is a complete Chapter 1 map. A file you want the game server to serve is copied, by hand, into that server's `fields/story/` (or `fields/drafts/` while it is still being written).

## Names

Copy `data/<region>` from the resources repo into `resources/<region>/` in this repo. That directory is git-ignored, and pull requests must not include it. Enemy, character, ability, item, summon and field names, cutscene titles and mission texts come from there. Stage names and mission kinds are part of the same copy.

## Run the builder

```bash
npm install
npm run dev
```

Open the page Vite prints (port 5173). The builder reads `resources/` for its pickers and the client archive for the background. It never writes to the repo.

The toolbar has three buttons:

- **New**: search for the field and press Create. The map starts empty.
- **Load**: choose a story JSON file. A file that fails the schema is rejected, with the problems listed.
- **Save as…**: choose where to write the map. Browsers without a save dialog download it instead.

The builder does not remember which file you opened; the map on screen is all there is, and nothing is kept when the page closes.

Click a hex, then choose what is on it: cutscene, battle, treasure or move. An occupied hex opens its details. The cutscene, enemy, stage, character, ability, item and summon fields are searchable lists of the extracted resources. Picking a cutscene sets `before_talk`. Cutscenes and battles have Start and Goal ticks, shown in the game as S and G. Start is the site nothing reveals (`revealed_by: null`), and Goal sets `goal`; clearing it clears the field. A field needs one of each. Only a cutscene has a character icon, and its "joins the party" tickbox adds that same character. A cutscene has no name in the file: the server sends the talk's title from the client, so the game shows the real one. A battle must have a name, because the client shows whatever name the server sends and has none of its own; Save as stays disabled until every battle has one. On an empty hex next to the end of a move strip, "Extend move" adds that hex to the strip. "Delete" removes what is on the selected hex (a strip cut in the middle becomes two). The first site on an empty field has to be a cutscene or a battle, because only those can be the start. Undo and Redo are in the toolbar; Ctrl+Z and Ctrl+Y do the same, except while typing in a field, which keeps its own undo. Hover a hex for its quest and name. Arrows show which quest reveals each site, and a move strip's hexes are numbered in travel order; "Hide reveal arrows" turns the arrows off. A legend in the corner names the colours. "Hide field image" in the toolbar hides the painting to see the hexes plainly. The bar at the bottom is the same check the server's `content:check` runs.

Save as… writes the canonical layout, so a diff is only the change you made.

When the client archive is on disk, the field's `FieldMap` texture is the background. The painting is placed by its size in hexes, measured in the client on Chapter 1: the square texture spans 20.83 columns and 21.17 rows, and hex (1, 1) sits 2.77 columns in from its left edge and 5.39 rows down from its top. Even columns sit half a row south. Fields with a different horizontal display scale are sized in proportion; only Chapter 1 has been checked in the client. Nothing from the archive is written into the repo.

## What a file contains

One file is one field, or one act of a field. Files that share a `field` id are combined by the server: only one of them may set `world`, `portal` or `goal`. Numeric ids are stored without names. The builder and error messages show the names when `resources/` is present.

Put the video or page that shows a site in `sources`. `notes` can still be written by hand; the builder keeps it but does not edit it, and the server ignores it.

Quest ids must be unique and must not use the field clear marker (`field id * 100 + 99`, so 199 on field 1). The builder suggests the next free id. Chapter 1 uses 190-364. Whether other unused ids work in the client without a matching client master is still unverified, so keep a new act as a draft until that is checked.

## Check before a pull request

`npm run build` typechecks the builder. The shape of a map (schema, unique quest ids, one start and one goal, no shared hexes, reveal links, a connected path, three missions on every battle) is the bar at the bottom of the builder. When `resources/` exists it also checks that enemy, ability, item, character, stage and summon ids exist, and that ability and character labels match the extracted name.

Do not invent battles to fill a gap, and do not commit `resources/`, `archive/`, or screenshots.
