import type { StoryBattle, StoryMission, StoryReward, StorySite } from './story-content';
import { storyFileSchema, type MissionFile, type RewardFile, type StoryFile, type StorySiteFile } from './schema';

export interface WorldLayout {
  param_x: number;
  param_y: number;
  cloud_x: number;
  cloud_y: number;
  name_x: number;
  name_y: number;
  touch_x: number;
  touch_y: number;
  touch_w: number;
  touch_h: number;
  cond_field_id: number;
  continent_tex: number;
  hide_cloud_tex: number;
}

export interface FieldStory {
  fieldId: number;
  world: WorldLayout | null;
  sites: StorySite[];
  goalQuestId: number | null;
}

export interface StoryCatalog {
  fields: Map<number, FieldStory>;
  joins: ReadonlyMap<number, number>;
  summons: ReadonlyMap<number, number>;
}

const FALLBACK = { breakBonus: 450, exp: 4, gil: 28, questBattleOffset: 50 };

export function rewardFromFile(file: RewardFile | undefined): StoryReward {
  if (!file || 'gems' in file) {
    return { item_type: 99, item_id: 2, item_num: file && 'gems' in file ? file.gems : 20 };
  }
  if ('gil' in file) return { item_type: 99, item_id: 1, item_num: file.gil };
  return { item_type: file.item_type, item_id: file.item_id, item_num: file.num };
}

/** The mission kinds a story file can name, and the mission_type the client expects for each. */
export const MISSION_TYPES = { no_kos: 2, within_turns: 3, breaks: 4, in_party: 8, use_ability: 28 } as const;

export function missionFromFile(file: MissionFile): StoryMission {
  if (file === 'no_kos' || 'no_kos' in file) {
    return {
      type: MISSION_TYPES.no_kos,
      arg: 0,
      description: 'Clear without any KOs',
      reward: rewardFromFile(file === 'no_kos' ? undefined : file.reward),
    };
  }
  if ('within_turns' in file) {
    return {
      type: MISSION_TYPES.within_turns,
      arg: file.within_turns,
      description: `Clear within ${file.within_turns} turns`,
      reward: rewardFromFile(file.reward),
    };
  }
  if ('breaks' in file) {
    return {
      type: MISSION_TYPES.breaks,
      arg: file.breaks,
      description: `Inflict ${file.breaks} or more Breaks`,
      reward: rewardFromFile(file.reward),
    };
  }
  if ('in_party' in file) {
    return {
      type: MISSION_TYPES.in_party,
      arg: file.in_party,
      description: `Have ${file.label} in your party`,
      reward: rewardFromFile(file.reward),
    };
  }
  return {
    type: MISSION_TYPES.use_ability,
    arg: file.use_ability,
    description: `Use ${file.label}`,
    reward: rewardFromFile(file.reward),
  };
}

function battleFromSite(site: Extract<StorySiteFile, { kind: 'battle' }>, offset: number): StoryBattle {
  const battle: StoryBattle = {
    waves: site.waves.map((wave) => wave.map((enemy) => ({ enemy: enemy.enemy, level: enemy.level }))),
    breakBonus: site.break_bonus ?? FALLBACK.breakBonus,
    goalScore: site.goal_score,
    scoreReward: rewardFromFile(site.score_reward),
    missions: [missionFromFile(site.missions[0]), missionFromFile(site.missions[1]), missionFromFile(site.missions[2])],
    clearBonus: (site.clear_bonus ?? [{ gems: 20 }]).map((entry) => rewardFromFile(entry)),
    exp: site.exp ?? FALLBACK.exp,
    gil: site.gil ?? FALLBACK.gil,
    questBattleId: site.quest_battle_id ?? site.quest_id - offset,
  };
  if (site.stage_id !== undefined) battle.stageId = site.stage_id;
  if (site.strong_enemy) battle.strongEnemy = true;
  if (site.side_quest) battle.sideQuest = true;
  return battle;
}

export interface CompiledFile {
  fieldId: number;
  world: WorldLayout | null;
  sites: StorySite[];
  goalQuestId: number | null;
  joins: Map<number, number>;
  summons: Map<number, number>;
}

export function compileStoryFile(file: StoryFile): CompiledFile {
  const offset = file.defaults?.quest_battle_id_offset ?? FALLBACK.questBattleOffset;
  const sites: StorySite[] = [];
  const joins = new Map<number, number>();
  const summons = new Map<number, number>();
  let goalQuestId: number | null = null;
  for (const site of file.sites) {
    if (site.kind === 'move') {
      site.hexes.forEach(([hexX, hexY], index) => {
        sites.push({
          questId: site.first_quest_id + index,
          name: '',
          kind: 'move',
          beforeTalk: 0,
          hexX,
          hexY,
          hexZ: 0,
          revealedBy: site.revealed_by,
          charaIcon: -1,
        });
      });
      continue;
    }
    if (site.kind === 'treasure') {
      const row: StorySite = {
        questId: site.quest_id,
        name: site.name ?? '',
        kind: 'treasure',
        beforeTalk: 0,
        hexX: site.hex[0],
        hexY: site.hex[1],
        hexZ: 0,
        revealedBy: site.revealed_by,
        charaIcon: -1,
        treasure: site.treasure.map((entry) => rewardFromFile(entry)),
      };
      if (site.quest_type !== undefined) row.questType = site.quest_type;
      sites.push(row);
      continue;
    }
    const row: StorySite = {
      questId: site.quest_id,
      name: site.kind === 'battle' ? site.name : '',
      kind: site.kind,
      beforeTalk: site.before_talk ?? 0,
      hexX: site.hex[0],
      hexY: site.hex[1],
      hexZ: 0,
      revealedBy: site.revealed_by,
      charaIcon: site.kind === 'cutscene' ? site.chara_icon ?? -1 : -1,
    };
    if (site.kind === 'battle') row.battle = battleFromSite(site, offset);
    if (site.kind === 'cutscene' && site.joins && site.chara_icon) joins.set(site.quest_id, site.chara_icon);
    if (site.grants_summon) summons.set(site.quest_id, site.grants_summon);
    if (site.goal) goalQuestId = site.quest_id;
    sites.push(row);
  }
  return {
    fieldId: file.field,
    world: file.world ?? null,
    sites,
    goalQuestId,
    joins,
    summons,
  };
}

export function parseStoryFile(data: unknown, filename: string): StoryFile {
  const parsed = storyFileSchema.safeParse(data);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .slice(0, 8)
      .map((issue) => `${issue.path.join('.') || '(file)'}: ${issue.message}`)
      .join('; ');
    throw new Error(`${filename} does not match the story schema: ${detail}`);
  }
  return parsed.data;
}
