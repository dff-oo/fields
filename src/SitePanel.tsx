import { useMemo } from 'react';
import { MISSION_TYPES } from './story/compile';
import type { MissionFile, RewardFile, StoryFile, StorySiteFile } from './story/schema';
import type { Resources } from './api';
import { KINDS, adjacentMoves, changeKind, clearHex, defaultReveal, extendMove, newSite, questHexes, siteAt, siteLabel, type HexAt, type Kind } from './edit';
import { SearchSelect, namedOptions, stageOptions, type Option } from './SearchSelect';

type Battle = Extract<StorySiteFile, { kind: 'battle' }>;
type Placed = Extract<StorySiteFile, { kind: 'cutscene' | 'battle' }>;

export function SitePanel(props: {
  file: StoryFile;
  at: HexAt;
  resources: Resources;
  onChange: (file: StoryFile) => void;
}) {
  const { file, at, resources } = props;
  const index = siteAt(file, at);
  const site = index >= 0 ? file.sites[index] : undefined;
  const options = useMemo(() => ({
    characters: namedOptions(resources.characters),
    enemies: namedOptions(resources.enemies),
    abilities: namedOptions(resources.abilities),
    summons: namedOptions(resources.summons),
    stages: stageOptions(resources.stages),
    talks: namedOptions(resources.talks),
    items: resources.items.map((item) => ({ key: `${item.item_type}:${item.item_id}`, label: `${item.name} (${item.item_type}:${item.item_id})` })),
  }), [resources]);
  const quests = useMemo(() => questOptions(file, resources.talks), [file, resources.talks]);

  function put(next: StorySiteFile) {
    const sites = file.sites.slice();
    sites[index] = next;
    props.onChange({ ...file, sites });
  }

  if (!site) {
    const taken = new Set(questHexes(file).map((row) => row.questId));
    const extendable = adjacentMoves(file, at).filter((move) => {
      const strip = file.sites[move];
      return strip.kind === 'move' && !taken.has(strip.first_quest_id + strip.hexes.length);
    });
    const kinds = file.sites.length ? KINDS : KINDS.filter(({ kind }) => kind === 'cutscene' || kind === 'battle');
    return (
      <>
        <strong>Hex {at[0]}, {at[1]}</strong>
        <p>What is on this hex?</p>
        <div className="kind-choices">
          {kinds.map(({ kind, label }) => (
            <button key={kind} type="button" onClick={() => props.onChange({ ...file, sites: [...file.sites, newSite(file, kind, at)] })}>
              {label}
            </button>
          ))}
        </div>
        {file.sites.length === 0 && <p className="hint">The first site has to be the start, so it must be a cutscene or a battle.</p>}
        {extendable.map((move) => {
          const strip = file.sites[move];
          if (strip.kind !== 'move') return null;
          return (
            <button key={move} type="button" onClick={() => props.onChange(extendMove(file, move, at))}>
              Extend move from {strip.first_quest_id} (quest {strip.first_quest_id + strip.hexes.length})
            </button>
          );
        })}
      </>
    );
  }

  const ownIds = site.kind === 'move'
    ? site.hexes.map((_, step) => site.first_quest_id + step)
    : [site.quest_id];
  const revealOptions = quests.filter((option) => !ownIds.includes(Number(option.key)));

  const step = site.kind === 'move' ? Math.max(0, site.hexes.findIndex(([x, y]) => x === at[0] && y === at[1])) : 0;
  const questId = site.kind === 'move' ? site.first_quest_id + step : site.quest_id;

  return (
    <>
      <strong>{siteLabel(file, index, resources.talks)}</strong>
      <p className="hint">
        Hex {at[0]}, {at[1]} · quest {questId}
        {site.kind === 'move' ? `, step ${step + 1} of ${site.hexes.length}` : ''}
      </p>
      <label>
        Type
        <select value={site.kind} onChange={(event) => put(changeKind(file, site, event.target.value as Kind, at))}>
          {KINDS.map(({ kind, label }) => <option key={kind} value={kind}>{label}</option>)}
        </select>
      </label>

      {site.kind === 'move' ? (
        <label>
          First quest id ({site.hexes.length} hex{site.hexes.length === 1 ? '' : 'es'})
          <input type="number" value={site.first_quest_id} onChange={(event) => put({ ...site, first_quest_id: Number(event.target.value) })} />
        </label>
      ) : (
        <label>
          Quest id
          <input type="number" value={site.quest_id} onChange={(event) => put({ ...site, quest_id: Number(event.target.value) })} />
        </label>
      )}

      {site.kind === 'cutscene' && (
        <SearchSelect
          label="Cutscene"
          options={options.talks}
          value={site.before_talk ? String(site.before_talk) : null}
          onChange={(key) => put({ ...site, before_talk: key === null ? 0 : Number(key) })}
          allowNone
          placeholder="Search cutscene titles"
        />
      )}
      {site.kind === 'cutscene' && <p className="hint">The game shows the cutscene's title as its name.</p>}

      {site.kind === 'battle' && (
        <label>
          Name
          <input value={site.name} onChange={(event) => put({ ...site, name: event.target.value })} />
        </label>
      )}
      {site.kind === 'treasure' && (
        <label>
          Name (optional)
          <input value={site.name ?? ''} onChange={(event) => put({ ...site, name: event.target.value || undefined })} />
        </label>
      )}

      {(site.kind === 'cutscene' || site.kind === 'battle') && (
        <div className="ends">
          <label className="check">
            <input
              type="checkbox"
              checked={site.revealed_by === null}
              disabled={site.revealed_by === null && defaultReveal(file, at) === null}
              onChange={(event) => put({ ...site, revealed_by: event.target.checked ? null : defaultReveal(file, at) })}
            />
            Start
          </label>
          <label className="check">
            <input type="checkbox" checked={site.goal === true} onChange={(event) => put({ ...site, goal: event.target.checked ? true : undefined })} />
            Goal
          </label>
        </div>
      )}

      {site.revealed_by !== null && (
        <SearchSelect
          label="Revealed by"
          options={revealOptions}
          value={String(site.revealed_by)}
          onChange={(key) => {
            if (key !== null) put({ ...site, revealed_by: Number(key) });
          }}
        />
      )}

      {(site.kind === 'cutscene' || site.kind === 'battle') && (
        <PlacedFields site={site} options={options} onChange={put} />
      )}

      {site.kind === 'battle' && <BattleFields site={site} resources={resources} options={options} onChange={put} />}

      {site.kind === 'treasure' && (
        <RewardList
          label="Contents"
          rewards={site.treasure}
          items={options.items}
          minimum={1}
          onChange={(treasure) => put({ ...site, treasure })}
        />
      )}

      <div className="panel-actions">
        <button type="button" onClick={() => props.onChange(clearHex(file, at))}>Delete</button>
      </div>
    </>
  );
}

function questOptions(file: StoryFile, talks: Resources['talks']): Option[] {
  return questHexes(file)
    .filter((row) => row.site >= 0)
    .map((row) => ({ key: String(row.questId), label: `${row.questId} ${siteLabel(file, row.site, talks)} (${row.hex[0]}, ${row.hex[1]})` }))
    .sort((a, b) => Number(a.key) - Number(b.key));
}

interface PanelOptions {
  characters: Option[];
  enemies: Option[];
  abilities: Option[];
  summons: Option[];
  stages: Option[];
  items: Option[];
}

function PlacedFields(props: { site: Placed; options: PanelOptions; onChange: (site: Placed) => void }) {
  const { site } = props;
  const optional = (key: string | null) => (key === null ? undefined : Number(key));
  return (
    <>
      {site.kind === 'cutscene' && (
        <>
          <SearchSelect
            label="Character icon"
            options={props.options.characters}
            value={site.chara_icon === undefined ? null : String(site.chara_icon)}
            allowNone
            onChange={(key) => props.onChange({ ...site, chara_icon: optional(key), joins: key === null ? undefined : site.joins })}
          />
          <label className="check">
            <input
              type="checkbox"
              checked={site.joins === true}
              disabled={site.chara_icon === undefined}
              onChange={(event) => props.onChange({ ...site, joins: event.target.checked ? true : undefined })}
            />
            This character joins the party
          </label>
        </>
      )}
      <SearchSelect
        label="Grants summon"
        options={props.options.summons}
        value={site.grants_summon === undefined ? null : String(site.grants_summon)}
        allowNone
        onChange={(key) => props.onChange({ ...site, grants_summon: optional(key) })}
      />
    </>
  );
}

const MISSION_KINDS = [
  { kind: 'no_kos', type: MISSION_TYPES.no_kos, fallback: 'Clear without any KOs' },
  { kind: 'within_turns', type: MISSION_TYPES.within_turns, fallback: 'Clear within %d turns' },
  { kind: 'breaks', type: MISSION_TYPES.breaks, fallback: 'Inflict %d or more Breaks' },
  { kind: 'in_party', type: MISSION_TYPES.in_party, fallback: 'Have %s in your party' },
  { kind: 'use_ability', type: MISSION_TYPES.use_ability, fallback: 'Use %s' },
] as const;

type MissionKind = (typeof MISSION_KINDS)[number]['kind'];

function missionKind(mission: MissionFile): MissionKind {
  if (mission === 'no_kos' || 'no_kos' in mission) return 'no_kos';
  if ('within_turns' in mission) return 'within_turns';
  if ('breaks' in mission) return 'breaks';
  if ('in_party' in mission) return 'in_party';
  return 'use_ability';
}

function BattleFields(props: { site: Battle; resources: Resources; options: PanelOptions; onChange: (site: Battle) => void }) {
  const { site, resources } = props;
  const missionText = (type: number, fallback: string) =>
    (resources.missions.find((row) => row.id === type)?.name ?? fallback).replace('%d', 'N').replace('%s', '…');

  function setWaves(waves: Battle['waves']) {
    props.onChange({ ...site, waves });
  }

  function setMission(slot: number, mission: MissionFile) {
    const missions = site.missions.slice() as Battle['missions'];
    missions[slot] = mission;
    props.onChange({ ...site, missions });
  }

  function retype(slot: number, kind: MissionKind) {
    const old = site.missions[slot];
    const extra = old !== 'no_kos' && 'reward' in old && old.reward ? { reward: old.reward } : {};
    const firstCharacter = resources.characters[0];
    const firstAbility = resources.abilities[0];
    switch (kind) {
      case 'no_kos': return setMission(slot, Object.keys(extra).length ? { no_kos: true, ...extra } : 'no_kos');
      case 'within_turns': return setMission(slot, { within_turns: 20, ...extra });
      case 'breaks': return setMission(slot, { breaks: 1, ...extra });
      case 'in_party': return setMission(slot, { in_party: firstCharacter?.id ?? 1, label: firstCharacter?.name ?? 'Cloud', ...extra });
      default: return setMission(slot, { use_ability: firstAbility?.id ?? 1, label: firstAbility?.name ?? 'Ability', ...extra });
    }
  }

  return (
    <>
      <SearchSelect
        label="Stage"
        options={props.options.stages}
        value={site.stage_id === undefined ? null : String(site.stage_id)}
        allowNone
        onChange={(key) => props.onChange({ ...site, stage_id: key === null ? undefined : Number(key) })}
      />
      <label className="check">
        <input type="checkbox" checked={site.strong_enemy === true} onChange={(event) => props.onChange({ ...site, strong_enemy: event.target.checked ? true : undefined })} />
        Strong enemy (gold helmet)
      </label>
      <label className="check">
        <input type="checkbox" checked={site.side_quest === true} onChange={(event) => props.onChange({ ...site, side_quest: event.target.checked ? true : undefined })} />
        Side quest (green helmet)
      </label>

      <fieldset>
        <legend>Waves</legend>
        {site.waves.map((wave, waveIndex) => (
          <div key={waveIndex} className="wave">
            <span className="wave-title">
              Wave {waveIndex + 1}
              {site.waves.length > 1 && (
                <button type="button" onClick={() => setWaves(site.waves.filter((_, i) => i !== waveIndex))}>Remove wave</button>
              )}
            </span>
            {wave.map((enemy, enemyIndex) => {
              const slot = `${enemyIndex < 26 ? String.fromCharCode(65 + enemyIndex) : enemyIndex + 1} of ${wave.length}`;
              return (
                <div key={enemyIndex} className="enemy">
                  <SearchSelect
                    label={slot}
                    options={props.options.enemies}
                    value={String(enemy.enemy)}
                    onChange={(key) => {
                      if (key === null) return;
                      const waves = site.waves.map((row) => row.slice());
                      waves[waveIndex][enemyIndex] = { ...enemy, enemy: Number(key) };
                      setWaves(waves);
                    }}
                  />
                  <label className="level">
                    Lv
                    <input
                      type="number"
                      min="1"
                      value={enemy.level}
                      onChange={(event) => {
                        const waves = site.waves.map((row) => row.slice());
                        waves[waveIndex][enemyIndex] = { ...enemy, level: Math.max(1, Number(event.target.value)) };
                        setWaves(waves);
                      }}
                    />
                  </label>
                  {wave.length > 1 && (
                    <button
                      type="button"
                      aria-label={`Remove ${slot}`}
                      onClick={() => setWaves(site.waves.map((row, i) => (i === waveIndex ? row.filter((_, j) => j !== enemyIndex) : row)))}
                    >
                      ×
                    </button>
                  )}
                </div>
              );
            })}
            <button
              type="button"
              onClick={() => setWaves(site.waves.map((row, i) => (i === waveIndex ? [...row, { ...row[row.length - 1] }] : row)))}
            >
              Add enemy
            </button>
          </div>
        ))}
        <button type="button" onClick={() => setWaves([...site.waves, [{ enemy: 1, level: 1 }]])}>Add wave</button>
      </fieldset>

      <label>
        Goal score
        <input type="number" min="0" value={site.goal_score} onChange={(event) => props.onChange({ ...site, goal_score: Number(event.target.value) })} />
      </label>
      <RewardEditor label="Score reward" reward={site.score_reward} items={props.options.items} onChange={(score_reward) => props.onChange({ ...site, score_reward })} />

      <fieldset>
        <legend>Missions</legend>
        {site.missions.map((mission, slot) => {
          const kind = missionKind(mission);
          return (
            <div key={slot} className="mission">
              <select value={kind} onChange={(event) => retype(slot, event.target.value as MissionKind)}>
                {MISSION_KINDS.map((entry) => (
                  <option key={entry.kind} value={entry.kind}>{missionText(entry.type, entry.fallback)}</option>
                ))}
              </select>
              {mission !== 'no_kos' && 'within_turns' in mission && (
                <input type="number" min="1" aria-label="Turns" value={mission.within_turns} onChange={(event) => setMission(slot, { ...mission, within_turns: Math.max(1, Number(event.target.value)) })} />
              )}
              {mission !== 'no_kos' && 'breaks' in mission && (
                <input type="number" min="1" aria-label="Breaks" value={mission.breaks} onChange={(event) => setMission(slot, { ...mission, breaks: Math.max(1, Number(event.target.value)) })} />
              )}
              {mission !== 'no_kos' && 'in_party' in mission && (
                <SearchSelect
                  label="Character"
                  options={props.options.characters}
                  value={String(mission.in_party)}
                  onChange={(key) => {
                    const character = resources.characters.find((row) => String(row.id) === key);
                    if (character) setMission(slot, { ...mission, in_party: character.id, label: character.name });
                  }}
                />
              )}
              {mission !== 'no_kos' && 'use_ability' in mission && (
                <SearchSelect
                  label="Ability"
                  options={props.options.abilities}
                  value={String(mission.use_ability)}
                  onChange={(key) => {
                    const ability = resources.abilities.find((row) => String(row.id) === key);
                    if (ability) setMission(slot, { ...mission, use_ability: ability.id, label: ability.name });
                  }}
                />
              )}
            </div>
          );
        })}
      </fieldset>

      <RewardList
        label="First clear bonus"
        rewards={site.clear_bonus ?? []}
        items={props.options.items}
        minimum={0}
        onChange={(clear_bonus) => props.onChange({ ...site, clear_bonus: clear_bonus.length ? clear_bonus : undefined })}
      />
    </>
  );
}

function rewardKind(reward: RewardFile): 'gems' | 'gil' | 'item' {
  if ('gems' in reward) return 'gems';
  if ('gil' in reward) return 'gil';
  return 'item';
}

function RewardEditor(props: { label: string; reward: RewardFile; items: Option[]; onChange: (reward: RewardFile) => void }) {
  const { reward } = props;
  const kind = rewardKind(reward);
  const amount = 'gems' in reward ? reward.gems : 'gil' in reward ? reward.gil : reward.num;
  const setAmount = (value: number) => {
    const n = Math.max(1, value);
    if ('gems' in reward) props.onChange({ gems: n });
    else if ('gil' in reward) props.onChange({ gil: n });
    else props.onChange({ ...reward, num: n });
  };
  return (
    <div className="reward">
      <span>{props.label}</span>
      <select
        value={kind}
        onChange={(event) => {
          const next = event.target.value;
          if (next === 'gems') props.onChange({ gems: amount });
          else if (next === 'gil') props.onChange({ gil: amount });
          else {
            const [type, id] = (props.items[0]?.key ?? '11:2').split(':').map(Number);
            props.onChange({ item_type: type, item_id: id, num: amount });
          }
        }}
      >
        <option value="gems">Gems</option>
        <option value="gil">Gil</option>
        <option value="item">Item</option>
      </select>
      <input type="number" min="1" aria-label={`${props.label} amount`} value={amount} onChange={(event) => setAmount(Number(event.target.value))} />
      {kind === 'item' && 'item_type' in reward && (
        <SearchSelect
          label="Item"
          options={props.items}
          value={`${reward.item_type}:${reward.item_id}`}
          onChange={(key) => {
            if (key === null) return;
            const [type, id] = key.split(':').map(Number);
            props.onChange({ ...reward, item_type: type, item_id: id });
          }}
        />
      )}
    </div>
  );
}

function RewardList(props: { label: string; rewards: RewardFile[]; items: Option[]; minimum: number; onChange: (rewards: RewardFile[]) => void }) {
  return (
    <fieldset>
      <legend>{props.label}</legend>
      {props.rewards.map((reward, index) => (
        <div key={index} className="reward-row">
          <RewardEditor
            label={`#${index + 1}`}
            reward={reward}
            items={props.items}
            onChange={(next) => props.onChange(props.rewards.map((row, i) => (i === index ? next : row)))}
          />
          {props.rewards.length > props.minimum && (
            <button type="button" aria-label="Remove reward" onClick={() => props.onChange(props.rewards.filter((_, i) => i !== index))}>×</button>
          )}
        </div>
      ))}
      <button type="button" onClick={() => props.onChange([...props.rewards, { gil: 1000 }])}>Add reward</button>
    </fieldset>
  );
}
