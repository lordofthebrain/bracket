import { MatchWithDetails } from '@openapi';
import dayjs from 'dayjs';
import { formatStageItemInput } from './stage_item_input';
import { Translator } from './types';

export interface SchedulerSettings {
  eloThreshold: number;
  setEloThreshold: any;
  limit: number;
  setLimit: any;
  iterations: number;
  setIterations: any;
  onlyRecommended: string;
  setOnlyRecommended: any;
}

export function getMatchStartTime(match: MatchWithDetails) {
  return dayjs(match.start_time || '');
}

export function getMatchEndTime(match: MatchWithDetails) {
  return getMatchStartTime(match).add(match.duration_minutes + match.margin_minutes, 'minutes');
}

export function isMatchHappening(match: MatchWithDetails) {
  return getMatchStartTime(match) < dayjs() && getMatchEndTime(match) > dayjs();
}

export function isMatchInTheFutureOrPresent(match: MatchWithDetails) {
  return getMatchEndTime(match) > dayjs();
}

export function isMatchInTheFuture(match: MatchWithDetails) {
  return getMatchStartTime(match) > dayjs();
}

export function getMatchWinner(match: MatchWithDetails): 1 | 2 | null {
  if (
    match.stage_item_input1_score_penalties != null &&
    match.stage_item_input2_score_penalties != null
  ) {
    if (match.stage_item_input1_score_penalties > match.stage_item_input2_score_penalties)
      return 1;
    if (match.stage_item_input1_score_penalties < match.stage_item_input2_score_penalties)
      return 2;
    return null;
  }

  if (
    match.stage_item_input1_score_after_extra_time != null &&
    match.stage_item_input2_score_after_extra_time != null
  ) {
    if (
      match.stage_item_input1_score_after_extra_time >
      match.stage_item_input2_score_after_extra_time
    )
      return 1;
    if (
      match.stage_item_input1_score_after_extra_time <
      match.stage_item_input2_score_after_extra_time
    )
      return 2;
    return null;
  }

  if (match.stage_item_input1_score > match.stage_item_input2_score) return 1;
  if (match.stage_item_input1_score < match.stage_item_input2_score) return 2;
  return null;
}

export interface MatchResultDisplay {
  // Translation key for the short result-type label, translated by the caller (has `t` in scope).
  prefix: 'after_extra_time_short' | 'after_penalties_short' | null;
  headline: [number, number];
  checkpoints: [number, number][];
}

// Collapses consecutive identical checkpoints (e.g. 0:0 at 120', 105' and 90') into one,
// since repeating an unchanged score doesn't add information.
function dedupeConsecutiveCheckpoints(checkpoints: [number, number][]): [number, number][] {
  return checkpoints.filter((checkpoint, index) => {
    const previous = checkpoints[index - 1];
    return previous == null || previous[0] !== checkpoint[0] || previous[1] !== checkpoint[1];
  });
}

export function getMatchResultDisplay(match: MatchWithDetails): MatchResultDisplay {
  const hasPenalties =
    match.stage_item_input1_score_penalties != null &&
    match.stage_item_input2_score_penalties != null;
  const hasExtraTime =
    match.stage_item_input1_score_after_extra_time != null &&
    match.stage_item_input2_score_after_extra_time != null;
  const hasExtraTimeHalf =
    match.stage_item_input1_score_extra_time_half != null &&
    match.stage_item_input2_score_extra_time_half != null;

  // A 0:0 half-time score can't be told apart from "not entered" (the match form
  // defaults to 0), so don't show it when the final score is also 0:0.
  const hideHalfTime =
    match.stage_item_input1_score === 0 &&
    match.stage_item_input2_score === 0 &&
    match.stage_item_input1_score_half_time === 0 &&
    match.stage_item_input2_score_half_time === 0;
  const hasHalfTime =
    !hideHalfTime &&
    match.stage_item_input1_score_half_time != null &&
    match.stage_item_input2_score_half_time != null;

  const checkpoints: [number, number][] = [];

  if (hasPenalties) {
    if (hasExtraTime) {
      checkpoints.push([
        match.stage_item_input1_score_after_extra_time as number,
        match.stage_item_input2_score_after_extra_time as number,
      ]);
      if (hasExtraTimeHalf) {
        checkpoints.push([
          match.stage_item_input1_score_extra_time_half as number,
          match.stage_item_input2_score_extra_time_half as number,
        ]);
      }
    }
    checkpoints.push([match.stage_item_input1_score, match.stage_item_input2_score]);
    if (hasHalfTime) {
      checkpoints.push([
        match.stage_item_input1_score_half_time as number,
        match.stage_item_input2_score_half_time as number,
      ]);
    }
    return {
      prefix: 'after_penalties_short',
      headline: [
        match.stage_item_input1_score_penalties as number,
        match.stage_item_input2_score_penalties as number,
      ],
      checkpoints: dedupeConsecutiveCheckpoints(checkpoints),
    };
  }

  if (hasExtraTime) {
    if (hasExtraTimeHalf) {
      checkpoints.push([
        match.stage_item_input1_score_extra_time_half as number,
        match.stage_item_input2_score_extra_time_half as number,
      ]);
    }
    checkpoints.push([match.stage_item_input1_score, match.stage_item_input2_score]);
    if (hasHalfTime) {
      checkpoints.push([
        match.stage_item_input1_score_half_time as number,
        match.stage_item_input2_score_half_time as number,
      ]);
    }
    return {
      prefix: 'after_extra_time_short',
      headline: [
        match.stage_item_input1_score_after_extra_time as number,
        match.stage_item_input2_score_after_extra_time as number,
      ],
      checkpoints: dedupeConsecutiveCheckpoints(checkpoints),
    };
  }

  if (hasHalfTime) {
    checkpoints.push([
      match.stage_item_input1_score_half_time as number,
      match.stage_item_input2_score_half_time as number,
    ]);
  }
  return {
    prefix: null,
    headline: [match.stage_item_input1_score, match.stage_item_input2_score],
    checkpoints: dedupeConsecutiveCheckpoints(checkpoints),
  };
}

// Whether a two-legged tie is still undecided after aggregate score (and, if enabled, away
// goals) given the first leg's already-played result and the second leg's own scores — the
// latter passed separately since the second leg's modal calls this with in-progress form values
// that haven't been saved yet. Mirrors the backend's `with_irrelevant_extra_time_fields_cleared_two_legged`.
export function isTwoLeggedAggregateUndecided(
  firstLeg: MatchWithDetails,
  secondLegInput1Score: number,
  secondLegInput2Score: number,
  awayGoalsRule: boolean
): boolean {
  const aggregate1 = firstLeg.stage_item_input2_score + secondLegInput1Score;
  const aggregate2 = firstLeg.stage_item_input1_score + secondLegInput2Score;
  if (aggregate1 !== aggregate2) return false;

  if (awayGoalsRule && firstLeg.stage_item_input2_score !== secondLegInput2Score) return false;

  return true;
}

// Same as isTwoLeggedAggregateUndecided, but combining the cumulative after-extra-time score.
export function isTwoLeggedAggregateAfterExtraTimeUndecided(
  firstLeg: MatchWithDetails,
  secondLegInput1ScoreAfterExtraTime: number,
  secondLegInput2ScoreAfterExtraTime: number,
  awayGoalsRule: boolean
): boolean {
  const aggregate1 = firstLeg.stage_item_input2_score + secondLegInput1ScoreAfterExtraTime;
  const aggregate2 = firstLeg.stage_item_input1_score + secondLegInput2ScoreAfterExtraTime;
  if (aggregate1 !== aggregate2) return false;

  if (awayGoalsRule && firstLeg.stage_item_input2_score !== secondLegInput2ScoreAfterExtraTime) {
    return false;
  }

  return true;
}

// Mirrors the backend's `Match.get_aggregate_winner`: `leg1` holds the canonical input1/input2
// ordering, `leg2` has them swapped. Returns which of leg1's inputs won, like `getMatchWinner`.
export function getTieAggregateWinner(
  leg1: MatchWithDetails,
  leg2: MatchWithDetails,
  awayGoalsRule: boolean
): 1 | 2 | null {
  const aggregate1 = leg1.stage_item_input1_score + leg2.stage_item_input2_score;
  const aggregate2 = leg1.stage_item_input2_score + leg2.stage_item_input1_score;
  if (aggregate1 > aggregate2) return 1;
  if (aggregate1 < aggregate2) return 2;

  if (awayGoalsRule) {
    const awayGoals1 = leg2.stage_item_input2_score;
    const awayGoals2 = leg1.stage_item_input2_score;
    if (awayGoals1 > awayGoals2) return 1;
    if (awayGoals1 < awayGoals2) return 2;
  }

  if (
    leg2.stage_item_input1_score_after_extra_time != null &&
    leg2.stage_item_input2_score_after_extra_time != null
  ) {
    // Cumulative leg2 score combined with leg1's normal-time score, not compared on its own.
    const aggregate1AfterExtraTime = leg1.stage_item_input1_score + leg2.stage_item_input2_score_after_extra_time;
    const aggregate2AfterExtraTime = leg1.stage_item_input2_score + leg2.stage_item_input1_score_after_extra_time;
    if (aggregate1AfterExtraTime > aggregate2AfterExtraTime) return 1;
    if (aggregate1AfterExtraTime < aggregate2AfterExtraTime) return 2;

    if (awayGoalsRule) {
      // Away goals accrued through extra time, not just the first 90 minutes.
      const awayGoals1AfterExtraTime = leg2.stage_item_input2_score_after_extra_time;
      const awayGoals2AfterExtraTime = leg1.stage_item_input2_score;
      if (awayGoals1AfterExtraTime > awayGoals2AfterExtraTime) return 1;
      if (awayGoals1AfterExtraTime < awayGoals2AfterExtraTime) return 2;
    }
  }

  if (
    leg2.stage_item_input1_score_penalties != null &&
    leg2.stage_item_input2_score_penalties != null
  ) {
    if (leg2.stage_item_input1_score_penalties > leg2.stage_item_input2_score_penalties) return 2;
    if (leg2.stage_item_input1_score_penalties < leg2.stage_item_input2_score_penalties) return 1;
    return null;
  }

  return null;
}

// Mirrors getTieAggregateWinner's priority order so the displayed aggregate matches the winner.
export function getTieAggregateScoreDisplay(
  leg1: MatchWithDetails,
  leg2: MatchWithDetails
): [number, number] {
  if (
    leg2.stage_item_input1_score_penalties != null &&
    leg2.stage_item_input2_score_penalties != null
  ) {
    return [leg2.stage_item_input1_score_penalties, leg2.stage_item_input2_score_penalties];
  }

  if (
    leg2.stage_item_input1_score_after_extra_time != null &&
    leg2.stage_item_input2_score_after_extra_time != null
  ) {
    return [
      leg1.stage_item_input1_score + leg2.stage_item_input2_score_after_extra_time,
      leg1.stage_item_input2_score + leg2.stage_item_input1_score_after_extra_time,
    ];
  }

  if (
    leg1.stage_item_input1_score_penalties != null &&
    leg1.stage_item_input2_score_penalties != null
  ) {
    return [leg1.stage_item_input1_score_penalties, leg1.stage_item_input2_score_penalties];
  }

  if (
    leg1.stage_item_input1_score_after_extra_time != null &&
    leg1.stage_item_input2_score_after_extra_time != null
  ) {
    return [
      leg1.stage_item_input1_score_after_extra_time + leg2.stage_item_input2_score,
      leg1.stage_item_input2_score_after_extra_time + leg2.stage_item_input1_score,
    ];
  }

  return [
    leg1.stage_item_input1_score + leg2.stage_item_input2_score,
    leg1.stage_item_input2_score + leg2.stage_item_input1_score,
  ];
}

// Looks up the name of the round robin (league) stage item in the same season as the cup that contains this team.
export function getTeamLeagueLabel(
  teamId: number | null | undefined,
  stageItemsLookup: any,
  cupStageId: number
): string | null {
  if (teamId == null) return null;
  for (const key of Object.keys(stageItemsLookup)) {
    const stageItem = stageItemsLookup[key];
    if (stageItem == null || stageItem.stage_id !== cupStageId) continue;
    if (stageItem.type !== 'ROUND_ROBIN') continue;
    const hasTeam = stageItem.inputs?.some((input: any) => input.team_id === teamId);
    if (hasTeam) return stageItem.name;
  }
  return null;
}

// "Winner of match X - Y" labels resolve recursively through the bracket, and each
// unresolved match spawns two further recursive calls into its own predecessor match
// (once for input1, once for input2) - without caching this doubles per round of
// depth. Keyed by the matchesLookup object reference (itself WeakMap-memoized on the
// SWR response's data), so a cache self-evicts once that data snapshot is gone.
const matchInput1Cache = new WeakMap<object, Map<number, string>>();
const matchInput2Cache = new WeakMap<object, Map<number, string>>();

function getOrCreateCache(cacheStore: WeakMap<object, Map<number, string>>, matchesLookup: any) {
  let cache = cacheStore.get(matchesLookup);
  if (cache == null) {
    cache = new Map();
    cacheStore.set(matchesLookup, cache);
  }
  return cache;
}

export function formatMatchInput1(
  t: Translator,
  stageItemsLookup: any,
  matchesLookup: any,
  match: MatchWithDetails
): string {
  const formatted = formatStageItemInput(match.stage_item_input1, stageItemsLookup);
  if (formatted != null) return formatted;

  if (match.stage_item_input1_winner_from_match_id == null) {
    return t('empty_slot');
  }

  const cache = getOrCreateCache(matchInput1Cache, matchesLookup);
  const cached = cache.get(match.id);
  if (cached !== undefined) return cached;

  const winner = matchesLookup[match.stage_item_input1_winner_from_match_id].match;
  const match_1 = formatMatchInput1(t, stageItemsLookup, matchesLookup, winner);
  const match_2 = formatMatchInput2(t, stageItemsLookup, matchesLookup, winner);
  const result = `Winner of match ${match_1} - ${match_2}`;
  cache.set(match.id, result);
  return result;
}

export function formatMatchInput2(
  t: Translator,
  stageItemsLookup: any,
  matchesLookup: any,
  match: MatchWithDetails
): string {
  const formatted = formatStageItemInput(match.stage_item_input2, stageItemsLookup);
  if (formatted != null) return formatted;

  if (match.stage_item_input2_winner_from_match_id == null) {
    return t('empty_slot');
  }

  const cache = getOrCreateCache(matchInput2Cache, matchesLookup);
  const cached = cache.get(match.id);
  if (cached !== undefined) return cached;

  const winner = matchesLookup[match.stage_item_input2_winner_from_match_id].match;
  const match_1 = formatMatchInput1(t, stageItemsLookup, matchesLookup, winner);
  const match_2 = formatMatchInput2(t, stageItemsLookup, matchesLookup, winner);
  const result = `Winner of match ${match_1} - ${match_2}`;
  cache.set(match.id, result);
  return result;
}
