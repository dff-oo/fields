export type StorySiteKind = 'cutscene' | 'battle' | 'move' | 'treasure';

export interface StoryReward {
  item_type: number;
  item_id: number;
  item_num: number;
}

export interface StoryMission {
  /** Index into MessageData_QuestMissionText. */
  type: number;
  arg: number;
  description: string;
  reward: StoryReward;
}

export interface StoryEnemy {
  /** battle_enemy_id. Stats come from mst_enemy_level at enemy_id * 1000 + level. */
  enemy: number;
  level: number;
}

export interface StoryBattle {
  /** Enemies in each wave. The wave count is the quest's "Battles" figure. */
  waves: readonly (readonly StoryEnemy[])[];
  breakBonus: number;
  goalScore: number;
  scoreReward: StoryReward;
  missions: readonly [StoryMission, StoryMission, StoryMission];
  clearBonus: readonly StoryReward[];
  exp: number;
  gil: number;
  /**
   * battle_stage.quest_battle_id, 1 when unset. While it is 301 and UI tutorial
   * 18 is unseen, the solo spawn (0x5401c0) leaves party slots 1 and 2 empty
   * until 351 is cleared; 1-1's wave-3 script then spawns Vivi and Rem there.
   */
  questBattleId?: number;
  /** battle_info.is_strong_enemy: the map draws the gold helmet hex instead of the silver one. */
  strongEnemy?: boolean;
  /** Battle background: loads client model S<stageId>Model; 1 when unset. See docs/stages.md. */
  stageId?: number;
  /** Side quests (quest_type 5) draw a green helmet on the map instead of silver. */
  sideQuest?: boolean;
}

export interface StorySite {
  questId: number;
  name: string;
  kind: StorySiteKind;
  beforeTalk: number;
  /**
   * Hex grid: y grows southward and even columns sit half a cell south of odd
   * ones (the client's adjacency test at 0x49bd20).
   */
  hexX: number;
  hexY: number;
  hexZ: number;
  /** The site appears once this quest is cleared; null means from the start. */
  revealedBy: number | null;
  /** Character id from MessageData_Character drawn on the hex, or -1. */
  charaIcon: number;
  battle?: StoryBattle;
  /** A treasure chest's contents, granted on its first clear. */
  treasure?: readonly StoryReward[];
  /** Map quest_type, when it is not the kind's usual one. */
  questType?: number;
}
