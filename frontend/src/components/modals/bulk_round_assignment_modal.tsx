import {
  ActionIcon,
  Alert,
  Button,
  Center,
  Loader,
  Modal,
  NativeSelect,
  Select,
  Table,
} from '@mantine/core';
import { IconSwitchHorizontal } from '@tabler/icons-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SWRResponse } from 'swr';

import { formatMatchInput1, formatMatchInput2 } from '@components/utils/match';
import { TournamentMinimal } from '@components/utils/tournament';
import {
  MatchRoundAssignment,
  RoundWithMatches,
  StageItemWithRounds,
  StagesWithStageItemsResponse,
} from '@openapi';
import { getMatchLookup, getStageItemLookup } from '@services/lookups';
import { reassignRounds } from '@services/match';

type MatchWithRound = { match: RoundWithMatches['matches'][number]; roundId: number };

function getReturnLegRoundMirror(
  stageItem: StageItemWithRounds
): { firstLegRounds: RoundWithMatches[]; roundMirror: Record<number, number> } | null {
  if (stageItem.type !== 'ROUND_ROBIN' || !stageItem.double_round_robin) return null;

  const sortedRounds = [...stageItem.rounds].sort((r1, r2) => r1.id - r2.id);
  const singleLegCount = Math.floor(sortedRounds.length / 2);
  if (singleLegCount < 1) return null;

  const firstLegRounds = sortedRounds.slice(0, singleLegCount);
  const secondLegRounds = sortedRounds.slice(singleLegCount);
  const roundMirror: Record<number, number> = {};
  firstLegRounds.forEach((round, i) => {
    roundMirror[round.id] = secondLegRounds[i].id;
  });

  return { firstLegRounds, roundMirror };
}

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
  const [loading, setLoading] = useState(false);
  const [assignments, setAssignments] = useState<Record<number, string>>({});
  const [swaps, setSwaps] = useState<Record<number, boolean>>({});
  const [teamFilter, setTeamFilter] = useState<string | null>(null);

  // Opening must stay O(1): no match/round data is touched here, so the
  // modal (with a spinner) can appear before any computation happens.
  // `loading` is only cleared once Mantine confirms the open transition
  // actually finished (transitionProps.onEntered below), not by guessing.
  const openModal = () => {
    setAssignments({});
    setSwaps({});
    setTeamFilter(null);
    setLoading(true);
    setOpened(true);
  };

  let modalBody = null;
  let handleSave = async () => {};

  if (opened && !loading) {
    const returnLeg = getReturnLegRoundMirror(stageItem);
    const firstLegRoundIds =
      returnLeg != null ? new Set(returnLeg.firstLegRounds.map((r) => r.id)) : null;

    const sortedRounds = [...stageItem.rounds].sort((r1, r2) => r1.id - r2.id);
    const roundOptions = (returnLeg != null ? returnLeg.firstLegRounds : sortedRounds).map(
      (r) => ({ value: `${r.id}`, label: r.name })
    );
    const teamFilterOptions = stageItem.inputs
      .filter(
        (input): input is typeof input & { team: { id: number; name: string } } => 'team' in input
      )
      .map((input) => ({ value: `${input.id}`, label: input.team.name }));

    const allMatches: MatchWithRound[] = sortedRounds.flatMap((r) =>
      r.matches.map((match) => ({ match, roundId: r.id }))
    );
    const editableMatches =
      firstLegRoundIds != null
        ? allMatches.filter(({ roundId }) => firstLegRoundIds.has(roundId))
        : allMatches;
    const visibleMatches =
      teamFilter == null
        ? editableMatches
        : editableMatches.filter(
            ({ match }) =>
              `${match.stage_item_input1_id}` === teamFilter ||
              `${match.stage_item_input2_id}` === teamFilter
          );

    const teamPairKey = (match: MatchWithRound['match']) =>
      [match.stage_item_input1_id, match.stage_item_input2_id]
        .slice()
        .sort((a, b) => (a ?? -1) - (b ?? -1))
        .join('-');

    const returnLegMatchByTeamPair = new Map<string, MatchWithRound['match']>();
    if (firstLegRoundIds != null) {
      allMatches.forEach(({ match, roundId }) => {
        if (!firstLegRoundIds.has(roundId)) {
          returnLegMatchByTeamPair.set(teamPairKey(match), match);
        }
      });
    }

    handleSave = async () => {
      const payload: MatchRoundAssignment[] = [];
      const pushedMatchIds = new Set<number>();

      editableMatches.forEach(({ match, roundId: currentRoundId }) => {
        const roundId = parseInt(assignments[match.id] ?? `${currentRoundId}`, 10);
        const swapTeams = swaps[match.id] ?? false;
        payload.push({ match_id: match.id, round_id: roundId, swap_teams: swapTeams });
        pushedMatchIds.add(match.id);

        if (returnLeg == null) return;

        const counterpart = returnLegMatchByTeamPair.get(teamPairKey(match));
        if (counterpart == null || pushedMatchIds.has(counterpart.id)) return;

        // Return leg should mirror the first leg with home/away reversed.
        const desiredReturnHome = swapTeams
          ? match.stage_item_input1_id
          : match.stage_item_input2_id;
        const desiredReturnAway = swapTeams
          ? match.stage_item_input2_id
          : match.stage_item_input1_id;
        const counterpartSwap = !(
          counterpart.stage_item_input1_id === desiredReturnHome &&
          counterpart.stage_item_input2_id === desiredReturnAway
        );

        payload.push({
          match_id: counterpart.id,
          round_id: returnLeg.roundMirror[roundId],
          swap_teams: counterpartSwap,
        });
        pushedMatchIds.add(counterpart.id);
      });

      const response: any = await reassignRounds(tournamentData.id, stageItem.id, payload);
      if (response != null && response.status === 200) {
        await swrStagesResponse.mutate();
        setOpened(false);
      }
    };

    const stageItemsLookup = getStageItemLookup(swrStagesResponse);
    const matchesLookup = getMatchLookup(swrStagesResponse);
    const rows = visibleMatches.map(({ match, roundId }) => {
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
            <NativeSelect
              data={roundOptions}
              value={assignments[match.id] ?? `${roundId}`}
              onChange={(event) => {
                const value = event.currentTarget.value;
                setAssignments((prev) => ({ ...prev, [match.id]: value }));
              }}
            />
          </Table.Td>
        </Table.Tr>
      );
    });

    modalBody = (
      <>
        {returnLeg != null && (
          <Alert color="blue" mb="md">
            {t('bulk_round_assignment_return_leg_notice')}
          </Alert>
        )}
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
      </>
    );
  } else if (opened && loading) {
    modalBody = (
      <Center mih="10rem">
        <Loader />
      </Center>
    );
  }

  return (
    <>
      <Modal
        opened={opened}
        onClose={() => setOpened(false)}
        title={t('bulk_round_assignment_title')}
        size="50rem"
        transitionProps={{ onEntered: () => setLoading(false) }}
      >
        {modalBody}
        <Button fullWidth mt="lg" color="green" onClick={handleSave} disabled={loading}>
          {t('validate_and_save_button')}
        </Button>
      </Modal>
      <Button variant="outline" onClick={openModal}>
        {t('bulk_round_assignment_button')}
      </Button>
    </>
  );
}
