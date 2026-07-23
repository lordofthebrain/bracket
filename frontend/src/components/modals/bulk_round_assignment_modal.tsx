import { ActionIcon, Button, Modal, Select, Table } from '@mantine/core';
import { IconSwitchHorizontal } from '@tabler/icons-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SWRResponse } from 'swr';

import { formatMatchInput1, formatMatchInput2 } from '@components/utils/match';
import { TournamentMinimal } from '@components/utils/tournament';
import { StageItemWithRounds, StagesWithStageItemsResponse } from '@openapi';
import { getMatchLookup, getStageItemLookup } from '@services/lookups';
import { reassignRounds } from '@services/match';

export default function BulkRoundAssignmentModal({
  tournamentData,
  stageItem,
  swrStagesResponse,
}: {
  tournamentData: TournamentMinimal;
  stageItem: StageItemWithRounds;
  swrStagesResponse: SWRResponse<StagesWithStageItemsResponse>;
}) {
  const { t } = useTranslation();
  const [opened, setOpened] = useState(false);
  const [assignments, setAssignments] = useState<Record<number, string>>({});
  const [swaps, setSwaps] = useState<Record<number, boolean>>({});
  const [teamFilter, setTeamFilter] = useState<string | null>(null);

  const stageItemsLookup = getStageItemLookup(swrStagesResponse);
  const matchesLookup = getMatchLookup(swrStagesResponse);

  const roundOptions = [...stageItem.rounds]
    .sort((r1, r2) => r1.id - r2.id)
    .map((r) => ({ value: `${r.id}`, label: r.name }));
  const teamFilterOptions = stageItem.inputs
    .filter(
      (input): input is typeof input & { team: { id: number; name: string } } => 'team' in input
    )
    .map((input) => ({ value: `${input.id}`, label: input.team.name }));
  const allMatches = [...stageItem.rounds]
    .sort((r1, r2) => r1.id - r2.id)
    .flatMap((r) => r.matches.map((match) => ({ match, roundId: r.id })));
  const visibleMatches =
    teamFilter == null
      ? allMatches
      : allMatches.filter(
          ({ match }) =>
            `${match.stage_item_input1_id}` === teamFilter ||
            `${match.stage_item_input2_id}` === teamFilter
        );

  const openModal = () => {
    const initialRounds: Record<number, string> = {};
    allMatches.forEach(({ match, roundId }) => {
      initialRounds[match.id] = `${roundId}`;
    });
    setAssignments(initialRounds);
    setSwaps({});
    setTeamFilter(null);
    setOpened(true);
  };

  const handleSave = async () => {
    const payload = allMatches.map(({ match }) => ({
      match_id: match.id,
      round_id: parseInt(assignments[match.id], 10),
      swap_teams: swaps[match.id] ?? false,
    }));
    const response: any = await reassignRounds(tournamentData.id, stageItem.id, payload);
    if (response != null && response.status === 200) {
      await swrStagesResponse.mutate();
      setOpened(false);
    }
  };

  const rows = visibleMatches.map(({ match }) => {
    const team1Label = formatMatchInput1(t, stageItemsLookup, matchesLookup, match);
    const team2Label = formatMatchInput2(t, stageItemsLookup, matchesLookup, match);
    const swapped = swaps[match.id] ?? false;
    const homeLabel = swapped ? team2Label : team1Label;
    const awayLabel = swapped ? team1Label : team2Label;

    return (
      <Table.Tr key={match.id}>
        <Table.Td>{homeLabel}</Table.Td>
        <Table.Td>{awayLabel}</Table.Td>
        <Table.Td>
          <ActionIcon
            variant="subtle"
            color="gray"
            title={t('swap_teams_button')}
            onClick={() => {
              setSwaps((prev) => ({ ...prev, [match.id]: !swapped }));
            }}
          >
            <IconSwitchHorizontal size={18} />
          </ActionIcon>
        </Table.Td>
        <Table.Td>
          <Select
            data={roundOptions}
            value={assignments[match.id] ?? null}
            allowDeselect={false}
            onChange={(value) => {
              if (value != null) {
                setAssignments((prev) => ({ ...prev, [match.id]: value }));
              }
            }}
          />
        </Table.Td>
      </Table.Tr>
    );
  });

  return (
    <>
      <Modal
        opened={opened}
        onClose={() => setOpened(false)}
        title={t('bulk_round_assignment_title')}
        size="50rem"
      >
        <Select
          label={t('team_filter_label')}
          placeholder={t('team_filter_placeholder')}
          data={teamFilterOptions}
          value={teamFilter}
          onChange={setTeamFilter}
          searchable
          clearable
          mb="md"
        />
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t('home_team_title')}</Table.Th>
              <Table.Th>{t('away_team_title')}</Table.Th>
              <Table.Th />
              <Table.Th>{t('round_select_label')}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>{rows}</Table.Tbody>
        </Table>
        <Button fullWidth mt="lg" color="green" onClick={handleSave}>
          {t('validate_and_save_button')}
        </Button>
      </Modal>
      <Button variant="outline" onClick={openModal}>
        {t('bulk_round_assignment_button')}
      </Button>
    </>
  );
}
