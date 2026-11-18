import { z } from 'zod';

export const rewardSchema = z.union([
  z.object({ gems: z.number().int().positive() }).strict(),
  z.object({ gil: z.number().int().positive() }).strict(),
  z.object({
    item_type: z.number().int(),
    item_id: z.number().int(),
    num: z.number().int().positive(),
  }).strict(),
]);

const provenance = {
  notes: z.string().optional(),
  sources: z.array(z.string()).optional(),
};

const missionObject = {
  reward: rewardSchema.optional(),
  ...provenance,
};

export const missionSchema = z.union([
  z.literal('no_kos'),
  z.object({ no_kos: z.literal(true), ...missionObject }).strict(),
  z.object({ within_turns: z.number().int().positive(), ...missionObject }).strict(),
  z.object({ breaks: z.number().int().positive(), ...missionObject }).strict(),
  z.object({
    in_party: z.number().int().positive(),
    label: z.string().min(1),
    ...missionObject,
  }).strict(),
  z.object({
    use_ability: z.number().int().positive(),
    label: z.string().min(1),
    ...missionObject,
  }).strict(),
]);

const hexSchema = z.tuple([z.number().int(), z.number().int()]);

const placed = {
  quest_id: z.number().int(),
  hex: hexSchema,
  revealed_by: z.number().int().nullable(),
  before_talk: z.number().int().nonnegative().optional(),
  grants_summon: z.number().int().positive().optional(),
  goal: z.literal(true).optional(),
  ...provenance,
};

/**
 * The client shows a cutscene under its talk-event title, so a cutscene carries no name.
 * `joins` adds the character on its icon to the party.
 */
export const cutsceneSchema = z
  .object({
    kind: z.literal('cutscene'),
    ...placed,
    chara_icon: z.number().int().positive().optional(),
    joins: z.literal(true).optional(),
  })
  .strict();

export const battleSchema = z
  .object({
    kind: z.literal('battle'),
    ...placed,
    name: z.string().min(1, 'a battle needs a name'),
    strong_enemy: z.literal(true).optional(),
    side_quest: z.literal(true).optional(),
    stage_id: z.number().int().nonnegative().optional(),
    quest_battle_id: z.number().int().optional(),
    waves: z.array(z.array(z.object({ enemy: z.number().int().positive(), level: z.number().int().positive() }).strict()).min(1)).min(1),
    goal_score: z.number().int().nonnegative(),
    score_reward: rewardSchema,
    missions: z.tuple([missionSchema, missionSchema, missionSchema]),
    clear_bonus: z.array(rewardSchema).optional(),
    break_bonus: z.number().int().nonnegative().optional(),
    exp: z.number().int().nonnegative().optional(),
    gil: z.number().int().nonnegative().optional(),
  })
  .strict();

export const treasureSchema = z
  .object({
    kind: z.literal('treasure'),
    quest_id: z.number().int(),
    name: z.string().optional(),
    hex: hexSchema,
    revealed_by: z.number().int(),
    treasure: z.array(rewardSchema).min(1),
    quest_type: z.number().int().optional(),
    ...provenance,
  })
  .strict();

export const moveSchema = z
  .object({
    kind: z.literal('move'),
    hexes: z.array(hexSchema).min(1),
    first_quest_id: z.number().int(),
    revealed_by: z.number().int(),
    ...provenance,
  })
  .strict();

export const siteSchema = z.discriminatedUnion('kind', [cutsceneSchema, battleSchema, treasureSchema, moveSchema]);

export const worldSchema = z
  .object({
    param_x: z.number().int(),
    param_y: z.number().int(),
    cloud_x: z.number().int(),
    cloud_y: z.number().int(),
    name_x: z.number().int(),
    name_y: z.number().int(),
    touch_x: z.number().int(),
    touch_y: z.number().int(),
    touch_w: z.number().int().positive(),
    touch_h: z.number().int().positive(),
    cond_field_id: z.number().int().nonnegative(),
    continent_tex: z.number().int().nonnegative(),
    hide_cloud_tex: z.number().int().nonnegative(),
  })
  .strict();

export const defaultsSchema = z
  .object({
    break_bonus: z.number().int().nonnegative().optional(),
    exp: z.number().int().nonnegative().optional(),
    gil: z.number().int().nonnegative().optional(),
    quest_battle_id_offset: z.number().int().optional(),
  })
  .strict();

export const storyFileSchema = z
  .object({
    $schema: z.string().optional(),
    field: z.number().int().positive(),
    world: worldSchema.optional(),
    defaults: defaultsSchema.optional(),
    sites: z.array(siteSchema),
  })
  .strict();

export type StoryFile = z.infer<typeof storyFileSchema>;
export type StorySiteFile = z.infer<typeof siteSchema>;
export type RewardFile = z.infer<typeof rewardSchema>;
export type MissionFile = z.infer<typeof missionSchema>;
