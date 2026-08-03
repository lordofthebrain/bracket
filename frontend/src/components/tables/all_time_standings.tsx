import { Tabs } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { SWRResponse } from 'swr';

import { NoContent } from '@components/no_content/empty_table_info';
import { useLazyTabs } from '@components/utils/react';
import { StagesWithStageItemsResponse } from '@openapi';
import { TeamStatsRow, TeamStatsTable } from './standings';
import { getTableState, sortTableEntries } from './table';

// Groups round-robin stage items from season stages by their ordinal position within their
// stage (1st round-robin item of every season together, 2nd together, ...) instead of by name,
// so a competition's identity survives renames. Non-season stages (e.g. a one-off group +
// knockout event) and non-round-robin stage items (e.g. a cup) are excluded entirely.
function getPositionGroups(stages: any[]): any[][] {
  const positionGroups: any[][] = [];

  [...stages]
    .sort((s1, s2) => s1.id - s2.id)
    .filter((stage) => stage.is_season !== false)
    .forEach((stage) => {
      const roundRobinItems = [...stage.stage_items]
        .filter((stageItem: any) => stageItem.type === 'ROUND_ROBIN')
        .sort((si1: any, si2: any) => si1.id - si2.id);

      roundRobinItems.forEach((stageItem: any, index: number) => {
        (positionGroups[index] ??= []).push(stageItem);
      });
    });

  return positionGroups;
}

function aggregateRows(stageItems: any[]): TeamStatsRow[] {
  const rowsByTeamId = new Map<number, TeamStatsRow>();

  stageItems.forEach((stageItem) => {
    stageItem.inputs.forEach((input: any) => {
      if (input.team_id == null) return;

      const row = rowsByTeamId.get(input.team_id) ?? {
        key: input.team_id,
        rankLabel: '',
        name: input.team.name,
        logoPath: input.team.logo_path,
        wins: 0,
        draws: 0,
        losses: 0,
        goals_for: 0,
        goals_against: 0,
        goal_difference: 0,
        games_played: 0,
        points: 0,
      };

      row.name = input.team.name;
      row.logoPath = input.team.logo_path;
      row.wins += input.wins;
      row.draws += input.draws;
      row.losses += input.losses;
      row.goals_for += input.goals_for;
      row.goals_against += input.goals_against;
      row.goal_difference = row.goals_for - row.goals_against;
      row.games_played = row.wins + row.draws + row.losses;
      row.points = parseFloat(`${row.points}`) + parseFloat(input.points);

      rowsByTeamId.set(input.team_id, row);
    });
  });

  return [...rowsByTeamId.values()];
}

function AllTimeStandingsTable({ rows }: { rows: TeamStatsRow[] }) {
  const tableState = getTableState('rank', false);

  const sorted = [...rows].sort((r1, r2) => {
    if (tableState.sortField !== 'rank') return sortTableEntries(r1, r2, tableState);

    const pointsDiff = parseFloat(`${r2.points}`) - parseFloat(`${r1.points}`);
    if (pointsDiff !== 0) return pointsDiff;
    if (r2.goal_difference !== r1.goal_difference) return r2.goal_difference - r1.goal_difference;
    return r2.goals_for - r1.goals_for;
  });

  const rankedRows = sorted.map((row, index) => ({ ...row, rankLabel: `${index + 1}` }));

  return <TeamStatsTable rows={rankedRows} stageItemType="ROUND_ROBIN" tableState={tableState} />;
}

export function AllTimeStandingsContent({
  swrStagesResponse,
}: {
  swrStagesResponse: SWRResponse<StagesWithStageItemsResponse>;
}) {
  const { t } = useTranslation();
  const stages = swrStagesResponse.data?.data ?? [];
  const positionGroups = getPositionGroups(stages).filter((group) => group.length > 0);
  const labeledGroups = positionGroups.map((group, index) => ({
    id: `${index}`,
    group,
    label: group[group.length - 1].name,
  }));
  const { activeTab, setActiveTab, visitedTabs } = useLazyTabs(labeledGroups.map((g) => g.id));

  if (labeledGroups.length < 1) {
    return <NoContent title={t('could_not_find_any_alert', { entity: t('teams_title') })} />;
  }

  return (
    <Tabs value={activeTab} onChange={setActiveTab} variant="pills">
      <Tabs.List>
        {labeledGroups.map(({ id, label }) => (
          <Tabs.Tab key={id} value={id}>
            {label}
          </Tabs.Tab>
        ))}
      </Tabs.List>
      {labeledGroups.map(({ id, group }) => (
        <Tabs.Panel key={id} value={id} keepMounted={visitedTabs.has(id)} pt="1rem">
          <AllTimeStandingsTable rows={aggregateRows(group)} />
        </Tabs.Panel>
      ))}
    </Tabs>
  );
}
