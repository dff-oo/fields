export interface Named {
  id: number;
  name: string;
}

export interface Resources {
  characters: Named[];
  enemies: Named[];
  abilities: (Named & { description?: string })[];
  items: { item_type: number; item_id: number; name: string }[];
  summons: Named[];
  fields: (Named & { story_part?: number })[];
  stages: (Named & { model?: string })[];
  talks: Named[];
  missions: Named[];
}

export const EMPTY_RESOURCES: Resources = {
  characters: [], enemies: [], abilities: [], items: [], summons: [], fields: [], stages: [], talks: [], missions: [],
};

export async function loadResources(): Promise<Resources> {
  const response = await fetch('/builder-api/resources');
  if (!response.ok) throw new Error(await response.text());
  return { ...EMPTY_RESOURCES, ...((await response.json()) as Partial<Resources>) };
}

/** The field's painting from the local archive, or null when it is not on disk. */
export async function loadFieldMap(field: number): Promise<{ blob: Blob; scale: number } | null> {
  const response = await fetch(`/builder-api/field-map/${field}`);
  if (!response.ok) return null;
  return { blob: await response.blob(), scale: Number(response.headers.get('X-Field-Scale')) || 2 };
}
