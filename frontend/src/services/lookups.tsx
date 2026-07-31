import { SWRResponse } from 'swr';

import { assert_not_none } from '@components/utils/assert';
import { getMatchWinner } from '@components/utils/match';
import { groupBy, responseIsValid } from '@components/utils/util';
import {
  Court,
  CourtsResponse,
  FullTeamWithPlayers,
  MatchWithDetails,
  StageWithStageItems,
} from '@openapi';
import { getTeams } from './adapter';

// Builds a memoized version of a lookup function, keyed by the SWR response's
// `data` object reference. Every component consuming the same fetched data
// snapshot (e.g. one call per match in the bracket view) shares one computed
// result instead of rebuilding it from scratch on every call. A WeakMap
// self-evicts once a data snapshot is no longer referenced, so this can't
// grow unbounded across polls/mutations.
function memoizeByResponseData<R = any>(compute: (data: any) => R, makeFallback: () => R) {
  const cache = new WeakMap<object, R>();
  return (swrResponse: SWRResponse | null | undefined): R => {
    const data = swrResponse?.data;
    if (data == null) return makeFallback();

    const cached = cache.get(data);
    if (cached !== undefined) return cached;

    const result = compute(data);
    cache.set(data, result);
    return result;
  };
}

export const getTeamsLookup = (() => {
  const cache = new WeakMap<object, any>();
  return (tournamentId: number) => {
    const swrTeamsResponse: SWRResponse = getTeams(tournamentId);
    const isResponseValid = responseIsValid(swrTeamsResponse);

    if (!isResponseValid) {
      return null;
    }

    const data = swrTeamsResponse.data;
    const cached = cache.get(data);
    if (cached !== undefined) return cached;

    const result = Object.fromEntries(
      data.data.teams.map((x: FullTeamWithPlayers) => [x.id, x])
    );
    cache.set(data, result);
    return result;
  };
})();

export const getStageItemLookup = memoizeByResponseData<any>(
  (data) => {
    let result: any[] = [];
    data.data.map((stage: StageWithStageItems) =>
      stage.stage_items.forEach((stage_item) => {
        result = result.concat([[stage_item.id, stage_item]]);
      })
    );
    return Object.fromEntries(result);
  },
  () => ({})
);

// Finds the stage id of the season right before currentStageId (assumes ascending stage ids = chronological order).
export function getPreviousStageId(stageItemsLookup: any, currentStageId: number): number | null {
  const stageIds = (Object.values(stageItemsLookup) as any[])
    .map((stageItem) => stageItem.stage_id)
    .filter((id) => id != null && id < currentStageId);
  return stageIds.length > 0 ? Math.max(...stageIds) : null;
}

export const getStageItemTeamsLookup = memoizeByResponseData<any>(
  (data) => {
    let result: any[] = [];
    data.data.map((stage: StageWithStageItems) =>
      stage.stage_items
        .sort((si1, si2) => (si1.name > si2.name ? 1 : -1))
        .forEach((stageItem) => {
          const teams_with_inputs = stageItem.inputs.filter(
            (input) => 'team' in input && input.team != null
          );

          if (teams_with_inputs.length > 0) {
            result = result.concat([[stageItem.id, teams_with_inputs]]);
          }
        })
    );
    return Object.fromEntries(result);
  },
  () => ({})
);

export const getMatchLookup = memoizeByResponseData<any>(
  (data) => {
    let result: any[] = [];
    data.data.map((stage: StageWithStageItems) =>
      stage.stage_items.forEach((stageItem) => {
        stageItem.rounds.forEach((round) => {
          round.matches.forEach((match) => {
            result = result.concat([[match.id, { match, stageItem, round }]]);
          });
        });
      })
    );
    return Object.fromEntries(result);
  },
  () => ({})
);

// Same shape as getMatchLookup's values, but grouped by stage_item_id so
// per-stage-item consumers (e.g. results.tsx) don't have to filter the
// entire tournament's matches down to their own on every render.
export const getMatchesByStageItemId = memoizeByResponseData<any>(
  (data) => {
    const result: Record<number, any[]> = {};
    data.data.forEach((stage: StageWithStageItems) =>
      stage.stage_items.forEach((stageItem) => {
        stageItem.rounds.forEach((round) => {
          round.matches.forEach((match) => {
            (result[stageItem.id] ??= []).push({ match, stageItem, round });
          });
        });
      })
    );
    return result;
  },
  () => ({})
);

// Keyed by stage (season) id, so a cup win in one season doesn't mark the
// team as cup winner in a different season's standings table.
export const getCupWinnerTeamIdsByStage: (
  swrStagesResponse: SWRResponse | null | undefined
) => Map<number, Set<number>> = memoizeByResponseData(
  (data) => {
    const winnerTeamIdsByStage = new Map<number, Set<number>>();
    data.data.forEach((stage: StageWithStageItems) => {
      const winnerTeamIds = new Set<number>();
      stage.stage_items
        .filter((stageItem) => stageItem.type === 'SINGLE_ELIMINATION')
        .forEach((stageItem) => {
          const sortedRounds = [...stageItem.rounds].sort((r1, r2) => r1.id - r2.id);
          const finalRound = sortedRounds[sortedRounds.length - 1];
          const finalMatch = finalRound?.matches[0];
          if (finalMatch == null || !finalMatch.is_played) return;

          const winner = getMatchWinner(finalMatch);
          const winnerInput =
            winner === 1
              ? finalMatch.stage_item_input1
              : winner === 2
                ? finalMatch.stage_item_input2
                : null;
          if (winnerInput != null && 'team_id' in winnerInput && winnerInput.team_id != null) {
            winnerTeamIds.add(winnerInput.team_id);
          }
        });
      winnerTeamIdsByStage.set(stage.id, winnerTeamIds);
    });
    return winnerTeamIdsByStage;
  },
  () => new Map()
);

export function stringToColour(input: string) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    // eslint-disable-next-line no-bitwise
    hash = input.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    'pink',
    'violet',
    'green',
    'blue',
    'red',
    'grape',
    'indigo',
    'cyan',
    'orange',
    'yellow',
    'teal',
  ];
  return colors[Math.abs(hash) % colors.length];
}

export const getMatchLookupByCourt = memoizeByResponseData<any>(
  (data) => {
    const matches = Object.values(getMatchLookup({ data } as SWRResponse)).map((x: any) => x.match);
    return groupBy(['court_id'])(matches);
  },
  () => ({})
);

export function getScheduleData(
  swrCourtsResponse: SWRResponse<CourtsResponse>,
  matchesByCourtId: any
): { court: Court; matches: MatchWithDetails[] }[] {
  return (swrCourtsResponse.data?.data || []).map((court: Court) => ({
    matches: (matchesByCourtId[court.id] || [])
      .filter((match: MatchWithDetails) => match.start_time != null)
      .sort((m1: MatchWithDetails, m2: MatchWithDetails) => {
        return assert_not_none(m1.position_in_schedule) > assert_not_none(m2.position_in_schedule)
          ? 1
          : -1 || [];
      }),
    court,
  }));
}
