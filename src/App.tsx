import { useEffect, useMemo, useRef, useState } from 'react';
import { EMPTY_RESOURCES, loadFieldMap, loadResources, type Resources } from './api';
import { checkStories, type NameTables } from './story/check';
import { HEX_EVEN_COLUMN_SHIFT, HEX_STEP_X, HEX_STEP_Y, fieldImageRect, hexOutline, hexPixel } from './story/hex';
import { storyFileSchema, type StoryFile, type StorySiteFile } from './story/schema';
import { questHexes, saveFileAs, siteAt, siteLabel, storyFileName, type HexAt } from './edit';
import { SitePanel } from './SitePanel';
import { NewField, readStory } from './NewField';

const COLS = 20;
const ROWS = 18;
const HISTORY = 100;
const MERGE_MS = 500;
const ARROW_GAP = 52;

const LEGEND = [
  { kind: 'cutscene', label: 'Cutscene' },
  { kind: 'battle', label: 'Battle' },
  { kind: 'treasure', label: 'Treasure' },
  { kind: 'move', label: 'Move' },
  { kind: 'portal', label: 'Portal' },
];

/** Pull a line back from both hex centres, keeping a visible stub between neighbours. */
function shorten(from: { cx: number; cy: number }, to: { cx: number; cy: number }, gap: number) {
  const dx = to.cx - from.cx;
  const dy = to.cy - from.cy;
  const len = Math.hypot(dx, dy);
  const pull = Math.min(gap, (len - 16) / 2);
  if (pull <= 0) return null;
  const ux = dx / len;
  const uy = dy / len;
  return { x1: from.cx + ux * pull, y1: from.cy + uy * pull, x2: to.cx - ux * pull, y2: to.cy - uy * pull };
}

function siteHex(site: StorySiteFile): HexAt {
  return site.kind === 'move' ? site.hexes[0] : site.hex;
}

function hexTip(file: StoryFile, at: HexAt, talks: Resources['talks']): string | null {
  const index = siteAt(file, at);
  if (index < 0) return null;
  const site = file.sites[index];
  const label = siteLabel(file, index, talks);
  if (site.kind === 'move') {
    const step = site.hexes.findIndex(([x, y]) => x === at[0] && y === at[1]);
    return `Quest ${site.first_quest_id + step} · ${label}, step ${step + 1} of ${site.hexes.length}`;
  }
  return `Quest ${site.quest_id} · ${label}`;
}

/** A cell is on the map only when its whole outline lies inside the painting. */
function onMap(x: number, y: number, rect: { x: number; y: number; width: number; height: number }): boolean {
  return hexOutline(x, y).split(' ').every((pair) => {
    const [px, py] = pair.split(',').map(Number);
    return px >= rect.x && py >= rect.y && px <= rect.x + rect.width && py <= rect.y + rect.height;
  });
}

function namesOf(resources: Resources): NameTables | null {
  if (!resources.characters.length) return null;
  const map = (rows: { id: number; name: string }[]) => new Map(rows.map((row) => [row.id, row.name]));
  return {
    characters: map(resources.characters),
    enemies: map(resources.enemies),
    abilities: map(resources.abilities),
    summons: map(resources.summons),
    talks: map(resources.talks),
    stages: new Set(resources.stages.map((stage) => stage.id)),
    items: new Map(resources.items.map((item) => [`${item.item_type}:${item.item_id}`, item.name])),
  };
}

export function App() {
  const [resources, setResources] = useState<Resources>(EMPTY_RESOURCES);
  const [resourceNote, setResourceNote] = useState('');
  const [file, setFile] = useState<StoryFile | null>(null);
  const [creating, setCreating] = useState(false);
  const [loadErrors, setLoadErrors] = useState<string[]>([]);
  const [at, setAt] = useState<HexAt | null>(null);
  const [showImage, setShowImage] = useState(true);
  const [hideArrows, setHideArrows] = useState(false);
  const [past, setPast] = useState<StoryFile[]>([]);
  const [future, setFuture] = useState<StoryFile[]>([]);
  const [fieldMap, setFieldMap] = useState<{ url: string; scale: number } | null>(null);
  const editedAt = useRef(0);

  useEffect(() => {
    loadResources()
      .then((loaded) => {
        setResources(loaded);
        if (!loaded.characters.length) setResourceNote('No resources extracted. Run npm run resources in server/ for names and lists.');
      })
      .catch(() => setResourceNote('Could not read resources/. Lists will be empty.'));
  }, []);

  useEffect(() => {
    if (!file) return undefined;
    let cancelled = false;
    let objectUrl = '';
    setFieldMap(null);
    void loadFieldMap(file.field).then((map) => {
      if (cancelled || !map) return;
      objectUrl = URL.createObjectURL(map.blob);
      setFieldMap({ url: objectUrl, scale: map.scale });
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [file?.field]);

  const problems = useMemo(
    () => (file ? checkStories([{ name: storyFileName(file.field), data: file }], namesOf(resources)) : []),
    [file, resources],
  );

  const savable = useMemo(() => (file ? storyFileSchema.safeParse(file).success : false), [file]);

  function open(next: StoryFile) {
    setFile(next);
    setPast([]);
    setFuture([]);
    editedAt.current = 0;
    setCreating(false);
    setLoadErrors([]);
    setAt(null);
  }

  function edit(next: StoryFile) {
    if (!file) {
      setFile(next);
      return;
    }
    const now = Date.now();
    if (now - editedAt.current >= MERGE_MS) setPast((prev) => [...prev, file].slice(-HISTORY));
    editedAt.current = now;
    setFuture([]);
    setFile(next);
  }

  function undo() {
    if (!file || past.length === 0) return;
    const previous = past[past.length - 1];
    setPast(past.slice(0, -1));
    setFuture((next) => [file, ...next].slice(0, HISTORY));
    setFile(previous);
    editedAt.current = 0;
  }

  function redo() {
    if (!file || future.length === 0) return;
    const [next, ...rest] = future;
    setFuture(rest);
    setPast((prev) => [...prev, file].slice(-HISTORY));
    setFile(next);
    editedAt.current = 0;
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (creating || !file) return;
      const key = event.key.toLowerCase();
      if (!(event.ctrlKey || event.metaKey) || (key !== 'z' && key !== 'y')) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      event.preventDefault();
      if (key === 'z' && !event.shiftKey) undo();
      else redo();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [creating, file, past, future]);

  async function load(upload: File) {
    const result = await readStory(upload);
    if ('errors' in result) {
      setLoadErrors(result.errors);
      return;
    }
    open(result.file);
  }

  const fieldName = file ? resources.fields.find((row) => row.id === file.field)?.name : undefined;

  const toolbar = (
    <div className="toolbar">
      <button type="button" onClick={() => setCreating(true)}>New</button>
      <label className="button">
        Load
        <input
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(event) => {
            const upload = event.target.files?.[0];
            event.target.value = '';
            if (upload) void load(upload);
          }}
        />
      </label>
      <button
        type="button"
        disabled={!file || creating || !savable}
        title={file && !savable ? 'Fix the problems in the bottom bar first; Load would reject this file.' : undefined}
        onClick={() => file && void saveFileAs(storyFileName(file.field), file).catch((error) => setLoadErrors([String(error)]))}
      >
        Save as…
      </button>
      {file && !creating && (
        <>
          <button type="button" disabled={past.length === 0} onClick={undo}>Undo</button>
          <button type="button" disabled={future.length === 0} onClick={redo}>Redo</button>
        </>
      )}
      {file && !creating && <span>Field {file.field}{fieldName ? `: ${fieldName}` : ''}</span>}
      {file && !creating && (
        <label className="check">
          <input type="checkbox" checked={hideArrows} onChange={(event) => setHideArrows(event.target.checked)} />
          Hide reveal arrows
        </label>
      )}
      {file && !creating && fieldMap && (
        <label className="check">
          <input type="checkbox" checked={!showImage} onChange={(event) => setShowImage(!event.target.checked)} />
          Hide field image
        </label>
      )}
    </div>
  );

  if (!file || creating) {
    return (
      <div className="app">
        {toolbar}
        {creating ? (
          <NewField resources={resources} onCreate={open} onCancel={file ? () => setCreating(false) : undefined} />
        ) : (
          <div className="start"><p>Start a new map or load a story JSON file.</p></div>
        )}
        <div className="problems">{loadErrors.length ? loadErrors.join(' · ') : resourceNote}</div>
      </div>
    );
  }

  const image = fieldMap ? fieldImageRect(fieldMap.scale) : null;
  const view = image ?? {
    x: 0,
    y: 0,
    width: Math.max(hexPixel(COLS - 1, 0).cx + HEX_STEP_X, 0) + 80,
    height: Math.max(hexPixel(0, ROWS - 1).cy + HEX_STEP_Y + HEX_EVEN_COLUMN_SHIFT, 0) + 80,
  };
  const columns = image ? Math.ceil((image.x + image.width) / HEX_STEP_X) + 2 : COLS;
  const rows = image ? Math.ceil((image.y + image.height) / HEX_STEP_Y) + 2 : ROWS;
  const selectedSite = at ? siteAt(file, at) : -1;
  const byQuest = new Map(questHexes(file).map((row) => [row.questId, row.hex]));
  const arrows = hideArrows
    ? []
    : file.sites.flatMap((site, index) => {
        if (site.revealed_by === null) return [];
        const fromHex = byQuest.get(site.revealed_by);
        if (!fromHex) return [];
        const to = siteHex(site);
        const line = shorten(hexPixel(fromHex[0], fromHex[1]), hexPixel(to[0], to[1]), ARROW_GAP);
        return line ? [{ index, ...line }] : [];
      });

  return (
    <div className="app">
      {toolbar}
      <div className="workspace">
        <div className={fieldMap && showImage ? 'map has-overlay' : 'map'}>
          <svg viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`}>
            <defs>
              <marker id="reveal-arrow" markerUnits="userSpaceOnUse" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="36" markerHeight="36" orient="auto">
                <path d="M 0 0 L 10 5 L 0 10 z" className="reveal-head" />
              </marker>
            </defs>
            {fieldMap && image && showImage && (
              <image
                href={fieldMap.url}
                x={image.x}
                y={image.y}
                width={image.width}
                height={image.height}
                preserveAspectRatio="none"
                style={{ pointerEvents: 'none' }}
              />
            )}
            {Array.from({ length: columns * rows }, (_, index) => {
              const x = index % columns;
              const y = Math.floor(index / columns);
              if (image && !onMap(x, y, image)) return null;
              const occupied = siteAt(file, [x, y]);
              const kind = occupied >= 0 ? file.sites[occupied].kind : '';
              const portalHere = file.portal && file.portal.hex[0] === x && file.portal.hex[1] === y;
              const tip = occupied >= 0
                ? hexTip(file, [x, y], resources.talks)
                : portalHere
                  ? `Quest ${file.portal?.quest_id} · Portal`
                  : null;
              return (
                <polygon
                  key={`${x}-${y}`}
                  points={hexOutline(x, y)}
                  className={`hex ${occupied >= 0 ? `kind-${kind}` : 'empty'}`}
                  onClick={() => setAt([x, y])}
                >
                  {tip && <title>{tip}</title>}
                </polygon>
              );
            })}
            {file.portal && (
              <polygon points={hexOutline(file.portal.hex[0], file.portal.hex[1])} className="hex kind-portal">
                <title>{`Quest ${file.portal.quest_id} · Portal`}</title>
              </polygon>
            )}
            {arrows.map(({ index, x1, y1, x2, y2 }) => (
              <line key={`reveal-${index}`} className="reveal" markerEnd="url(#reveal-arrow)" x1={x1} y1={y1} x2={x2} y2={y2} />
            ))}
            {file.sites.flatMap((site, index) => {
              if (site.kind !== 'move' || site.hexes.length < 2) return [];
              return site.hexes.map((hex, step) => {
                const { cx, cy } = hexPixel(hex[0], hex[1]);
                return (
                  <text key={`step-${index}-${step}`} x={cx} y={cy} className="step">
                    {step + 1}
                  </text>
                );
              });
            })}
            {file.sites.flatMap((site, index) => {
              if (site.kind !== 'cutscene' && site.kind !== 'battle') return [];
              const { cx, cy } = hexPixel(site.hex[0], site.hex[1]);
              const letters = [site.revealed_by === null && 'S', site.goal && 'G'].filter((letter) => letter) as string[];
              return letters.map((letter, n) => (
                <text
                  key={`${letter}-${index}`}
                  x={cx + (letters.length > 1 ? (n ? 30 : -30) : 0)}
                  y={cy}
                  className={`marker marker-${letter}`}
                >
                  {letter}
                </text>
              ));
            })}
            {selectedSite >= 0 &&
              questHexes(file)
                .filter((row) => row.site === selectedSite)
                .map(({ hex: [x, y] }) => (
                  <polygon key={`outline-${x}-${y}`} points={hexOutline(x, y)} className="hex outline same-site" />
                ))}
            {at && <polygon points={hexOutline(at[0], at[1])} className="hex outline selected" />}
          </svg>
          <aside className="legend" aria-label="Map legend">
            {LEGEND.map(({ kind, label }) => (
              <span key={kind}>
                <svg viewBox="0 0 20 22" width="16" height="18" aria-hidden="true">
                  <polygon points="10,1 18.5,6 18.5,16 10,21 1.5,16 1.5,6" className={`hex kind-${kind}`} />
                </svg>
                {label}
              </span>
            ))}
            <span><b>S</b> Start</span>
            <span><b>G</b> Goal</span>
          </aside>
        </div>
        <aside className="inspector">
          {at ? (
            <SitePanel
              file={file}
              at={at}
              resources={resources}
              onChange={edit}
            />
          ) : (
            <p>Click a hex to choose what is on it.</p>
          )}
        </aside>
      </div>
      <div className={problems.length ? 'problems' : 'problems ok'}>
        {problems.length
          ? problems.map((problem) => problem.message).join(' · ')
          : resourceNote || `${file.sites.length} site${file.sites.length === 1 ? '' : 's'}, no problems found.`}
      </div>
    </div>
  );
}
