import { Anchor, Badge, Group, Image, Table, Text, Title } from '@mantine/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PlayerScore } from '@components/info/player_score';
import { EmptyTableInfo } from '@components/no_content/empty_table_info';
import { RoundFilterSelect } from '@components/select/round_filter_select';
import { formatStageItemInput } from '@components/utils/stage_item_input';
import {
  MatchWithDetails,
  Ranking,
  RankingZone,
  StageItemInputFinal,
  StageItemWithRounds,
} from '@openapi';
import { getBaseApiUrl, getRankings } from '@services/adapter';
import { getPreviousStageId } from '@services/lookups';
import { TableState, ThSortable, getTableState, sortTableEntries } from './table';
import TableLayoutLarge from './table_large';

export function getZoneColorCssVar(color: string): string {
  // Mantine's yellow-6 skews towards orange/amber, so use a lighter shade for it.
  const shade = color === 'yellow' ? 4 : 6;
  return `var(--mantine-color-${color}-${shade})`;
}

function getZoneForIndex(zones: RankingZone[], index: number, total: number): RankingZone | null {
  let topOffset = 0;
  for (const zone of zones.filter((z) => z.direction === 'top')) {
    if (index >= topOffset && index < topOffset + zone.count) return zone;
    topOffset += zone.count;
  }

  let bottomOffset = 0;
  for (const zone of zones.filter((z) => z.direction === 'bottom')) {
    if (index >= total - bottomOffset - zone.count && index < total - bottomOffset) return zone;
    bottomOffset += zone.count;
  }

  return null;
}

function getSeasonMarker(
  input: StageItemInputFinal,
  stageItem: StageItemWithRounds,
  stageItemsLookup: any,
  stagesLookup: any,
  rankings: Ranking[],
  t: (key: string) => string,
  language: string
): string | null {
  // No established convention for this in English-language tables, so only show it in German.
  if (!language.startsWith('de')) return null;

  const sourceStageItemId = input.winner_from_stage_item_id;
  if (sourceStageItemId == null) {
    // Newcomer only if the team wasn't in the immediately preceding season.
    const previousStageId = getPreviousStageId(
      stageItemsLookup,
      (stageItem as any).stage_id,
      stagesLookup
    );
    if (previousStageId == null) return null;

    const hasPlayedInPreviousStage = (Object.values(stageItemsLookup) as any[]).some(
      (otherStageItem) =>
        otherStageItem.stage_id === previousStageId &&
        otherStageItem.inputs?.some((otherInput: any) => otherInput.team_id === input.team_id)
    );
    return hasPlayedInPreviousStage ? null : t('promoted_marker');
  }

  const sourceStageItem = stageItemsLookup[sourceStageItemId];
  if (sourceStageItem == null) return null;

  if (sourceStageItem.name === stageItem.name) {
    return input.winner_position === 1 ? t('champion_marker') : null;
  }

  // Cross-league move: whether it's a promotion or relegation depends on where
  // the team finished in the *previous* stage item's own standings zones.
  const winnerPosition = input.winner_position;
  const sourceTeamCount = sourceStageItem.inputs?.length ?? 0;
  if (winnerPosition == null || sourceTeamCount < 1) return null;

  const sourceRanking = rankings.find((r) => r.id === sourceStageItem.ranking_id);
  if (sourceRanking == null) return null;

  const sourceZone = getZoneForIndex(
    sourceRanking.standings_zones,
    winnerPosition - 1,
    sourceTeamCount
  );
  if (sourceZone?.direction === 'top') return t('promoted_marker');
  if (sourceZone?.direction === 'bottom') return t('relegation_marker');
  return null;
}

function StandingsZonesLegend({ zones }: { zones: RankingZone[] }) {
  if (zones.length < 1) return null;
  return (
    <Group gap="xs" mb="sm">
      {zones.map((zone, index) => (
        // eslint-disable-next-line react/no-array-index-key
        <Badge key={index} color={zone.color} variant="light">
          {zone.label}
        </Badge>
      ))}
    </Group>
  );
}

export function TeamLogo({ logoPath }: { logoPath: string | null | undefined }) {
  if (logoPath == null) return null;
  return (
    <Image
      src={`${getBaseApiUrl()}/static/team-logos/${logoPath}`}
      alt=""
      style={{ width: 30, height: 30, objectFit: 'contain', flexShrink: 0 }}
    />
  );
}

interface CumulativeStats {
  wins: number;
  draws: number;
  losses: number;
  goals_for: number;
  goals_against: number;
  points: number;
}

function computeStatsUpToRound(
  stageItem: StageItemWithRounds,
  cutoffRoundId: number,
  winPoints: number,
  drawPoints: number,
  lossPoints: number,
  addScorePoints: boolean
): Map<number, CumulativeStats> {
  const stats = new Map<number, CumulativeStats>();
  const includedRoundIds = new Set(
    stageItem.rounds.filter((r) => r.id <= cutoffRoundId).map((r) => r.id)
  );

  const getOrInit = (inputId: number) => {
    if (!stats.has(inputId)) {
      stats.set(inputId, {
        wins: 0,
        draws: 0,
        losses: 0,
        goals_for: 0,
        goals_against: 0,
        points: 0,
      });
    }
    return stats.get(inputId)!;
  };

  stageItem.rounds
    .filter((r) => includedRoundIds.has(r.id))
    .flatMap((r) => r.matches as MatchWithDetails[])
    .filter((match) => match.is_played)
    .forEach((match) => {
      const pairs: [number | null, number, number][] = [
        [match.stage_item_input1_id, match.stage_item_input1_score, match.stage_item_input2_score],
        [match.stage_item_input2_id, match.stage_item_input2_score, match.stage_item_input1_score],
      ];
      pairs.forEach(([inputId, teamScore, opponentScore]) => {
        if (inputId == null) return;
        const entry = getOrInit(inputId);
        entry.goals_for += teamScore;
        entry.goals_against += opponentScore;

        const wasDraw = teamScore === opponentScore;
        const hasWon = !wasDraw && teamScore > opponentScore;

        let diff = 0;
        if (hasWon) {
          entry.wins += 1;
          diff = winPoints;
        } else if (wasDraw) {
          entry.draws += 1;
          diff = drawPoints;
        } else {
          entry.losses += 1;
          diff = lossPoints;
        }
        if (addScorePoints) diff += teamScore;
        entry.points += diff;
      });
    });

  return stats;
}

export interface JumpToLink {
  targetId: string;
  label: string;
}

// Builds "jump to the other table(s)" links with an up/down arrow depending on whether the
// target sits above or below the current item, e.g. for a row of standings tables on one page.
export function getJumpToLinks<T>(
  items: T[],
  currentIndex: number,
  getAnchorId: (item: T) => string,
  getLabel: (item: T) => string
): JumpToLink[] {
  return items
    .map((item, index) => ({ item, index }))
    .filter(({ index }) => index !== currentIndex)
    .map(({ item, index }) => ({
      targetId: getAnchorId(item),
      label: `${index > currentIndex ? '↓' : '↑'} ${getLabel(item)}`,
    }));
}

export function TableTitleWithJumpLinks({
  title,
  jumpTo,
  compact = false,
}: {
  title: string;
  jumpTo: JumpToLink[];
  compact?: boolean;
}) {
  return (
    <Group
      justify={compact ? 'flex-start' : 'space-between'}
      align="baseline"
      mb="sm"
      style={compact ? undefined : { maxWidth: '20rem' }}
    >
      <Title order={3}>{title}</Title>
      <Group gap="md">
        {jumpTo.map((jump) => (
          <Anchor key={jump.targetId} href={`#${jump.targetId}`}>
            {jump.label}
          </Anchor>
        ))}
      </Group>
    </Group>
  );
}

export interface TeamStatsRow {
  key: number;
  rankLabel: string;
  name: string;
  logoPath: string | null | undefined;
  markers?: string[];
  zoneColor?: string | null;
  wins: number;
  draws: number;
  losses: number;
  goals_for: number;
  goals_against: number;
  goal_difference: number;
  games_played: number;
  points: string | number;
}

export function TeamStatsTable({
  rows,
  stageItemType,
  tableState,
  minPoints,
  maxPoints,
  fontSizeInPixels,
}: {
  rows: TeamStatsRow[];
  stageItemType: string;
  tableState: TableState;
  minPoints?: number;
  maxPoints?: number;
  fontSizeInPixels?: number;
}) {
  const { t } = useTranslation();
  const isSwiss = stageItemType === 'SWISS';

  return (
    <TableLayoutLarge display_mode="presentation">
      <Table.Thead>
        <Table.Tr>
          <ThSortable width="2rem" state={tableState} field="rank">
            #
          </ThSortable>
          <ThSortable state={tableState} field="name">
            {t('team_title')}
          </ThSortable>
          {isSwiss ? (
            <>
              <ThSortable visibleFrom="sm" state={tableState} field="points">
                {t('elo_score')}
              </ThSortable>
              <ThSortable state={tableState} field="elo_score">
                {t('elo_score')}
              </ThSortable>
            </>
          ) : (
            <>
              <ThSortable align="right" width="3rem" state={tableState} field="games_played">
                {t('games_played_header')}
              </ThSortable>
              <ThSortable align="right" width="3rem" state={tableState} field="wins">
                {t('wins_header')}
              </ThSortable>
              <ThSortable align="right" width="3rem" state={tableState} field="draws">
                {t('draws_header')}
              </ThSortable>
              <ThSortable align="right" width="3rem" state={tableState} field="losses">
                {t('losses_header')}
              </ThSortable>
              <ThSortable align="right" width="5rem" state={tableState} field="goals_for">
                {t('goals_header')}
              </ThSortable>
              <ThSortable align="right" width="3rem" state={tableState} field="goal_difference">
                {t('goal_difference_header')}
              </ThSortable>
              <ThSortable align="right" width="3rem" state={tableState} field="points">
                {t('points_table_header')}
              </ThSortable>
            </>
          )}
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {rows.map((row) => (
          <Table.Tr
            key={row.key}
            style={
              row.zoneColor != null
                ? { borderLeft: `4px solid ${getZoneColorCssVar(row.zoneColor)}` }
                : undefined
            }
          >
            <Table.Td style={{ width: '2rem' }}>{row.rankLabel}</Table.Td>
            <Table.Td style={{ width: '20rem' }}>
              <Group gap="xs" wrap="nowrap">
                <TeamLogo logoPath={row.logoPath} />
                <Text truncate="end" lineClamp={1} inherit>
                  {row.name}
                  {row.markers != null && row.markers.length > 0
                    ? ` (${row.markers.join(', ')})`
                    : ''}
                </Text>
              </Group>
            </Table.Td>
            {isSwiss ? (
              <>
                <Table.Td visibleFrom="sm" style={{ minWidth: '8rem' }}>
                  <Text truncate="end" lineClamp={1} inherit>
                    {row.points}
                  </Text>
                </Table.Td>
                <Table.Td style={{ minWidth: '10rem' }}>
                  <PlayerScore
                    score={parseFloat(`${row.points}`)}
                    min_score={minPoints ?? 0}
                    max_score={maxPoints ?? 0}
                    decimals={0}
                    fontSizeInPixels={fontSizeInPixels ?? 16}
                  />
                </Table.Td>
              </>
            ) : (
              <>
                <Table.Td style={{ width: '3rem', textAlign: 'right' }}>
                  {row.wins + row.draws + row.losses}
                </Table.Td>
                <Table.Td style={{ width: '3rem', textAlign: 'right' }}>{row.wins}</Table.Td>
                <Table.Td style={{ width: '3rem', textAlign: 'right' }}>{row.draws}</Table.Td>
                <Table.Td style={{ width: '3rem', textAlign: 'right' }}>{row.losses}</Table.Td>
                <Table.Td style={{ width: '5rem', textAlign: 'right' }}>
                  {row.goals_for}:{row.goals_against}
                </Table.Td>
                <Table.Td style={{ width: '3rem', textAlign: 'right' }}>
                  {row.goals_for - row.goals_against}
                </Table.Td>
                <Table.Td style={{ width: '3rem', textAlign: 'right' }}>
                  <b>{row.points}</b>
                </Table.Td>
              </>
            )}
          </Table.Tr>
        ))}
      </Table.Tbody>
    </TableLayoutLarge>
  );
}

export function StandingsTableForStageItem({
  teams_with_inputs,
  stageItem,
  fontSizeInPixels,
  stageItemsLookup,
  stagesLookup,
  maxTeamsToDisplay,
  tournamentId,
  jumpTo,
  cupWinnerTeamIds,
  showTitle = true,
}: {
  teams_with_inputs: StageItemInputFinal[];
  stageItem: StageItemWithRounds;
  fontSizeInPixels: number;
  stageItemsLookup: any;
  stagesLookup: any;
  maxTeamsToDisplay: number;
  tournamentId: number;
  jumpTo: { targetId: string; label: string }[];
  cupWinnerTeamIds?: Set<number>;
  showTitle?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const tableState = getTableState('rank', false);

  const sortedRounds = [...stageItem.rounds].sort((r1, r2) => r1.id - r2.id);
  const lastPlayedRoundId = [...sortedRounds]
    .reverse()
    .find((r) => r.matches.some((match) => (match as MatchWithDetails).is_played))?.id;
  const firstRoundId = sortedRounds[0]?.id;

  const [roundFilter, setRoundFilter] = useState<string | null>(
    lastPlayedRoundId != null
      ? `${lastPlayedRoundId}`
      : firstRoundId != null
        ? `${firstRoundId}`
        : null
  );

  const swrRankingsResponse = getRankings(tournamentId);
  const ranking = swrRankingsResponse.data?.data.find(
    (r) => r.id === (stageItem as any).ranking_id
  );

  const roundOptions =
    stageItem.type === 'SWISS'
      ? []
      : sortedRounds.map((r) => ({ value: `${r.id}`, label: r.name }));

  const isFiltered = stageItem.type !== 'SWISS' && roundFilter != null && ranking != null;

  const cumulativeStats = isFiltered
    ? computeStatsUpToRound(
        stageItem,
        parseInt(roundFilter as string, 10),
        parseFloat(ranking!.win_points),
        parseFloat(ranking!.draw_points),
        parseFloat(ranking!.loss_points),
        ranking!.add_score_points
      )
    : null;

  const minPoints = Math.min(...teams_with_inputs.map((input) => parseFloat(input.points)));
  const maxPoints = Math.max(...teams_with_inputs.map((input) => parseFloat(input.points)));

  const zeroStats: CumulativeStats = {
    wins: 0,
    draws: 0,
    losses: 0,
    goals_for: 0,
    goals_against: 0,
    points: 0,
  };

  const sortableTeamsWithInputs = teams_with_inputs.map((input) => {
    const overrides = cumulativeStats != null ? (cumulativeStats.get(input.id) ?? zeroStats) : null;
    const wins = overrides != null ? overrides.wins : input.wins;
    const draws = overrides != null ? overrides.draws : input.draws;
    const losses = overrides != null ? overrides.losses : input.losses;
    const goals_for = overrides != null ? overrides.goals_for : input.goals_for;
    const goals_against = overrides != null ? overrides.goals_against : input.goals_against;
    const points = overrides != null ? `${overrides.points}` : input.points;

    return {
      ...input,
      wins,
      draws,
      losses,
      goals_for,
      goals_against,
      points,
      name: formatStageItemInput(input, stageItemsLookup),
      games_played: wins + draws + losses,
      goal_difference: goals_for - goals_against,
      rank: points,
    };
  });

  const compareByPointsThenGoalDifference = (p1: any, p2: any) => {
    const pointsDiff = parseFloat(p2.points) - parseFloat(p1.points);
    const goalDiffDiff = pointsDiff !== 0 ? 0 : p2.goal_difference - p1.goal_difference;
    const goalsForDiff = goalDiffDiff !== 0 ? 0 : p2.goals_for - p1.goals_for;
    const result = pointsDiff || goalDiffDiff || goalsForDiff;
    return tableState.reversed ? -result : result;
  };

  const sortedTeams = sortableTeamsWithInputs.sort((p1, p2) =>
    tableState.sortField === 'rank'
      ? compareByPointsThenGoalDifference(p1, p2)
      : sortTableEntries(p1, p2, tableState)
  );

  const rows: TeamStatsRow[] = sortedTeams.slice(0, maxTeamsToDisplay).map((team_with_input, index) => {
    const previous = index > 0 ? sortedTeams[index - 1] : null;
    const isTiedWithPrevious =
      tableState.sortField === 'rank' &&
      previous != null &&
      previous.points === team_with_input.points &&
      previous.goal_difference === team_with_input.goal_difference &&
      previous.goals_for === team_with_input.goals_for;

    const zone = ranking?.standings_zones
      ? getZoneForIndex(ranking.standings_zones, index, sortedTeams.length)
      : null;

    const seasonMarker = getSeasonMarker(
      team_with_input,
      stageItem,
      stageItemsLookup,
      stagesLookup,
      swrRankingsResponse.data?.data ?? [],
      t,
      i18n.language
    );
    const isCupWinner =
      i18n.language.startsWith('de') &&
      team_with_input.team_id != null &&
      cupWinnerTeamIds?.has(team_with_input.team_id) === true;
    const cupWinnerMarker = isCupWinner ? t('cup_winner_marker') : null;
    const markers = (
      seasonMarker === t('champion_marker')
        ? [seasonMarker, cupWinnerMarker]
        : [cupWinnerMarker, seasonMarker]
    ).filter((marker): marker is string => marker != null);

    return {
      key: team_with_input.id,
      rankLabel: isTiedWithPrevious ? '' : `${index + 1}`,
      name: formatStageItemInput(team_with_input, stageItemsLookup) ?? '',
      logoPath: team_with_input.team?.logo_path,
      markers,
      zoneColor: zone?.color,
      wins: team_with_input.wins,
      draws: team_with_input.draws,
      losses: team_with_input.losses,
      goals_for: team_with_input.goals_for,
      goals_against: team_with_input.goals_against,
      goal_difference: team_with_input.goal_difference,
      games_played: team_with_input.games_played,
      points: team_with_input.points,
    };
  });

  return (
    <>
      {showTitle && <TableTitleWithJumpLinks title={stageItem.name} jumpTo={jumpTo} />}
      <RoundFilterSelect
        options={roundOptions}
        value={roundFilter}
        onChange={setRoundFilter}
        style={{ maxWidth: '20rem', marginBottom: 'var(--mantine-spacing-md)' }}
      />
      {rows.length < 1 ? (
        <EmptyTableInfo entity_name={t('teams_title')} />
      ) : (
        <>
          <StandingsZonesLegend zones={ranking?.standings_zones ?? []} />
          <TeamStatsTable
            rows={rows}
            stageItemType={stageItem.type}
            tableState={tableState}
            minPoints={minPoints}
            maxPoints={maxPoints}
            fontSizeInPixels={fontSizeInPixels}
          />
        </>
      )}
    </>
  );
}
