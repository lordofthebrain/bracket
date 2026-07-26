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
  prefix: 'n.V.' | 'n.E.' | null;
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
      prefix: 'n.E.',
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
      prefix: 'n.V.',
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
  const winner = matchesLookup[match.stage_item_input1_winner_from_match_id].match;
  const match_1 = formatMatchInput1(t, stageItemsLookup, matchesLookup, winner);
  const match_2 = formatMatchInput2(t, stageItemsLookup, matchesLookup, winner);
  return `Winner of match ${match_1} - ${match_2}`;
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
  const winner = matchesLookup[match.stage_item_input2_winner_from_match_id].match;
  const match_1 = formatMatchInput1(t, stageItemsLookup, matchesLookup, winner);
  const match_2 = formatMatchInput2(t, stageItemsLookup, matchesLookup, winner);
  return `Winner of match ${match_1} - ${match_2}`;
}
