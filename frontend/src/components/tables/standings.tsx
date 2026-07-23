import { Badge, Group, Image, Select, Table, Text } from '@mantine/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PlayerScore } from '@components/info/player_score';
import { EmptyTableInfo } from '@components/no_content/empty_table_info';
import { formatStageItemInput } from '@components/utils/stage_item_input';
import { MatchWithDetails, RankingZone, StageItemInputFinal, StageItemWithRounds } from '@openapi';
import { getBaseApiUrl, getRankings } from '@services/adapter';
import { ThSortable, getTableState, sortTableEntries } from './table';
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

function TeamLogo({ logoPath }: { logoPath: string | null | undefined }) {
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

export function StandingsTableForStageItem({
  teams_with_inputs,
  stageItem,
  fontSizeInPixels,
  stageItemsLookup,
  maxTeamsToDisplay,
  tournamentId,
}: {
  teams_with_inputs: StageItemInputFinal[];
  stageItem: StageItemWithRounds;
  fontSizeInPixels: number;
  stageItemsLookup: any;
  maxTeamsToDisplay: number;
  tournamentId: number;
}) {
  const { t } = useTranslation();
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

  const rows = sortedTeams.slice(0, maxTeamsToDisplay).map((team_with_input, index) => {
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

    return (
      <Table.Tr
        key={team_with_input.id}
        style={
          zone != null ? { borderLeft: `4px solid ${getZoneColorCssVar(zone.color)}` } : undefined
        }
      >
        <Table.Td style={{ width: '2rem' }}>{isTiedWithPrevious ? '' : index + 1}</Table.Td>
        <Table.Td style={{ width: '20rem' }}>
          <Group gap="xs" wrap="nowrap">
            <TeamLogo logoPath={team_with_input.team?.logo_path} />
            <Text truncate="end" lineClamp={1} inherit>
              {formatStageItemInput(team_with_input, stageItemsLookup)}
            </Text>
          </Group>
        </Table.Td>
        {stageItem.type === 'SWISS' ? (
          <>
            <Table.Td visibleFrom="sm" style={{ minWidth: '8rem' }}>
              <Text truncate="end" lineClamp={1} inherit>
                {team_with_input.points}
              </Text>
            </Table.Td>
            <Table.Td style={{ minWidth: '10rem' }}>
              <PlayerScore
                score={parseFloat(team_with_input.points)}
                min_score={minPoints}
                max_score={maxPoints}
                decimals={0}
                fontSizeInPixels={fontSizeInPixels}
              />
            </Table.Td>
          </>
        ) : (
          <>
            <Table.Td style={{ width: '3rem', textAlign: 'right' }}>
              {team_with_input.wins + team_with_input.draws + team_with_input.losses}
            </Table.Td>
            <Table.Td style={{ width: '3rem', textAlign: 'right' }}>
              {team_with_input.wins}
            </Table.Td>
            <Table.Td style={{ width: '3rem', textAlign: 'right' }}>
              {team_with_input.draws}
            </Table.Td>
            <Table.Td style={{ width: '3rem', textAlign: 'right' }}>
              {team_with_input.losses}
            </Table.Td>
            <Table.Td style={{ width: '5rem', textAlign: 'right' }}>
              {team_with_input.goals_for}:{team_with_input.goals_against}
            </Table.Td>
            <Table.Td style={{ width: '3rem', textAlign: 'right' }}>
              {team_with_input.goals_for - team_with_input.goals_against}
            </Table.Td>
            <Table.Td style={{ width: '3rem', textAlign: 'right' }}>
              <b>{team_with_input.points}</b>
            </Table.Td>
          </>
        )}
      </Table.Tr>
    );
  });

  const table = (
    <TableLayoutLarge display_mode="presentation">
      <Table.Thead>
        <Table.Tr>
          <ThSortable width="2rem" state={tableState} field="rank">
            #
          </ThSortable>
          <ThSortable state={tableState} field="name">
            {t('team_title')}
          </ThSortable>
          {stageItem.type === 'SWISS' ? (
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
      <Table.Tbody>{rows}</Table.Tbody>
    </TableLayoutLarge>
  );

  return (
    <>
      {roundOptions.length > 0 && (
        <Select
          label={t('round_filter_label')}
          data={roundOptions}
          value={roundFilter}
          onChange={setRoundFilter}
          allowDeselect={false}
          mb="md"
          style={{ maxWidth: '20rem' }}
        />
      )}
      {rows.length < 1 ? (
        <EmptyTableInfo entity_name={t('teams_title')} />
      ) : (
        <>
          <StandingsZonesLegend zones={ranking?.standings_zones ?? []} />
          {table}
        </>
      )}
    </>
  );
}
