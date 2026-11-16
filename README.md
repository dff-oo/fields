# DFFOO field builder

A browser editor for Dissidia Final Fantasy Opera Omnia story maps. A map is a JSON file. This repo is the public place for the builder and for examples. It does not contain the game server or names extracted from the client.

## Run it

```bash
npm install
npm run dev
```

Open the page Vite prints (port 5173). **New** starts an empty map, **Load** opens a story JSON file, and **Save as…** writes one. The builder does not write into this repo. [examples/field-001.json](examples/field-001.json) is Chapter 1 and can be loaded as a starting point.

See [docs/contributing-content.md](docs/contributing-content.md) for how a file is put together.

## Names and field paintings

Only the global (GL, English) client is supported.

The pickers read `resources/*.json`. That folder is git-ignored. Copy the contents of `data/` from the resources repo into `resources/` (so `resources/characters.json` and the rest are present). Without those files the lists are empty and the builder still runs.

The field painting comes from a local copy of the global client's files:

- Put it at `archive/gb/` using the same layout as a device (`data/data/<package>/files` and `sdcard/Android/data/<package>/files`), or
- Set `DFFOO_ARCHIVE_ROOT` to that root.

Unpacking a FieldMap texture also needs the unpacker at `tools/re/package/` (the same tool the old monorepo used). That directory is git-ignored.
