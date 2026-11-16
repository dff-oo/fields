import type { StoryFile } from './schema';

const FILE_KEYS = ['$schema', 'field', 'world', 'defaults', 'portal', 'sites'] as const;
const WORLD_KEYS = [
  'param_x', 'param_y', 'cloud_x', 'cloud_y', 'name_x', 'name_y',
  'touch_x', 'touch_y', 'touch_w', 'touch_h', 'cond_field_id', 'continent_tex', 'hide_cloud_tex',
] as const;
const DEFAULT_KEYS = ['break_bonus', 'exp', 'gil', 'quest_battle_id_offset'] as const;
const PORTAL_KEYS = ['quest_id', 'hex', 'symbol_label', 'hidden_by', 'notes'] as const;
const PROVENANCE = ['sources', 'notes'] as const;

const SITE_KEYS: Record<string, readonly string[]> = {
  cutscene: ['quest_id', 'kind', 'name', 'hex', 'revealed_by', 'before_talk', 'chara_icon', 'joins', 'grants_summon', 'goal', ...PROVENANCE],
  battle: [
    'quest_id', 'kind', 'name', 'hex', 'revealed_by', 'before_talk', 'chara_icon', 'joins', 'grants_summon', 'goal',
    'strong_enemy', 'side_quest', 'stage_id', 'quest_battle_id', 'waves', 'goal_score', 'score_reward', 'missions',
    'clear_bonus', 'break_bonus', 'exp', 'gil', ...PROVENANCE,
  ],
  treasure: ['quest_id', 'kind', 'name', 'hex', 'revealed_by', 'treasure', 'quest_type', ...PROVENANCE],
  move: ['kind', 'hexes', 'first_quest_id', 'revealed_by', ...PROVENANCE],
};

function order(value: Record<string, unknown>, keys: readonly string[]): Record<string, unknown> {
  const ordered: Record<string, unknown> = {};
  for (const key of [...keys, ...Object.keys(value)]) {
    if (value[key] !== undefined && !(key in ordered)) ordered[key] = value[key];
  }
  return ordered;
}

export function orderStory(file: StoryFile): StoryFile {
  const sites = file.sites.map((site) => order(site, SITE_KEYS[site.kind]) as typeof site);
  return order(
    {
      ...file,
      world: file.world ? order(file.world, WORLD_KEYS) : undefined,
      defaults: file.defaults ? order(file.defaults, DEFAULT_KEYS) : undefined,
      portal: file.portal ? order(file.portal, PORTAL_KEYS) : undefined,
      sites,
    },
    FILE_KEYS,
  ) as StoryFile;
}

function formatValue(value: unknown, indent: number, expand: boolean): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  const inline = JSON.stringify(value);
  if (!expand && inline.length <= 96) return inline;
  const pad = '  '.repeat(indent);
  const inner = '  '.repeat(indent + 1);
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    const items = value.map((item) => formatValue(item, indent + 1, false));
    return `[\n${items.map((item) => `${inner}${item}`).join(',\n')}\n${pad}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) return '{}';
  const lines = entries.map(([key, child]) => {
    const text = formatValue(child, indent + 1, key === 'sites' || key === 'world' || key === 'defaults' || key === 'portal' || isSite(child));
    return `${inner}${JSON.stringify(key)}: ${text}`;
  });
  return `{\n${lines.join(',\n')}\n${pad}}`;
}

function isSite(value: unknown): boolean {
  return !!value && typeof value === 'object' && 'kind' in value;
}

/** Canonical story JSON: fixed key order, 2-space indent, short arrays on one line. */
export function formatStory(file: StoryFile): string {
  return `${formatValue(orderStory(file), 0, true)}\n`;
}
