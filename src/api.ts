export interface Named {
  id: number;
  name: string;
}

export interface Stage extends Named {
  model?: string;
  confirmed?: boolean;
  notes?: string;
}

export interface Resources {
  characters: Named[];
  enemies: Named[];
  abilities: (Named & { description?: string })[];
  items: { item_type: number; item_id: number; name: string }[];
  summons: Named[];
  fields: (Named & { story_part?: number })[];
  stages: Stage[];
  talks: Named[];
  missions: Named[];
}

interface StageName {
  id: number;
  name?: string;
  confirmed?: boolean;
  notes?: string;
}

/** The client has no stage names, so the ones we have checked live with the builder. */
function withStageNames(stages: Stage[], names: StageName[]): Stage[] {
  const byId = new Map(stages.map((stage) => [stage.id, { ...stage }]));
  for (const entry of names) {
    const stage = byId.get(entry.id) ?? { id: entry.id, name: '' };
    if (entry.name) stage.name = entry.name;
    if (entry.confirmed !== undefined) stage.confirmed = entry.confirmed;
    if (entry.notes) stage.notes = entry.notes;
    byId.set(entry.id, stage);
  }
  return [...byId.values()].sort((a, b) => a.id - b.id);
}

export const EMPTY_RESOURCES: Resources = {
  characters: [], enemies: [], abilities: [], items: [], summons: [], fields: [], stages: [], talks: [], missions: [],
};

export async function loadResources(): Promise<Resources> {
  const response = await fetch('/builder-api/resources');
  if (!response.ok) throw new Error(await response.text());
  const resources = { ...EMPTY_RESOURCES, ...((await response.json()) as Partial<Resources>) };
  const names = (await import('./stage-names.json')).default as StageName[];
  return { ...resources, stages: withStageNames(resources.stages, names) };
}

/** The field's painting from the local archive, or null when it is not on disk. */
export async function loadFieldMap(field: number): Promise<{ blob: Blob; scale: number } | null> {
  const response = await fetch(`/builder-api/field-map/${field}`);
  if (!response.ok) return null;
  return { blob: await response.blob(), scale: Number(response.headers.get('X-Field-Scale')) || 2 };
}
