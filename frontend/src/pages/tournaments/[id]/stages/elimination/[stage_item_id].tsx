import { Button, Center, Select, SimpleGrid, Title } from '@mantine/core';
import { showNotification } from '@mantine/notifications';
import { memo, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SWRResponse } from 'swr';

import matchClasses from '@components/brackets/match.module.css';
import { formatMatchInput1, formatMatchInput2 } from '@components/utils/match';
import {
  getStageItemIdFromRouter,
  getTournamentIdFromRouter,
  responseIsValid,
} from '@components/utils/util';
import { RoundWithMatches } from '@openapi';
import NotFoundTitle from '@pages/404';
import TournamentLayout from '@pages/tournaments/_tournament_layout';
import { checkForAuthError, getStages, getTournamentById } from '@services/adapter';
import { getMatchLookup, getStageItemLookup } from '@services/lookups';
import { reassignWinnerSources } from '@services/match';

type PendingSources = { input1: string | null; input2: string | null };
type SelectOption = { value: string; label: string };

function matchOptionLabel(t: any, stageItemsLookup: any, matchesLookup: any, match: any): string {
  const label1 = formatMatchInput1(t, stageItemsLookup, matchesLookup, match);
  const label2 = formatMatchInput2(t, stageItemsLookup, matchesLookup, match);
  return `${label1} vs ${label2}`;
}

function defaultSourcesForMatch(match: any): PendingSources {
  return {
    input1:
      match.stage_item_input1_winner_from_match_id != null
        ? `${match.stage_item_input1_winner_from_match_id}`
        : null,
    input2:
      match.stage_item_input2_winner_from_match_id != null
        ? `${match.stage_item_input2_winner_from_match_id}`
        : null,
  };
}

// Memoized so editing one match's pairing doesn't re-render every other match/round in the bracket.
const MatchPairingRow = memo(function MatchPairingRow({
  matchId,
  hasPreviousRound,
  options,
  team1Label,
  team2Label,
  sources,
  onChangeInput1,
  onChangeInput2,
}: {
  matchId: number;
  hasPreviousRound: boolean;
  options: SelectOption[];
  team1Label: string;
  team2Label: string;
  sources: PendingSources;
  onChangeInput1: (matchId: number, value: string | null) => void;
  onChangeInput2: (matchId: number, value: string | null) => void;
}) {
  // Mantine's Select prefills the search box with the current selection's label on open,
  // which filters the list down to just that entry - control it ourselves and clear it on open.
  const [search1, setSearch1] = useState(
    () => options.find((o) => o.value === sources.input1)?.label ?? ''
  );
  const [search2, setSearch2] = useState(
    () => options.find((o) => o.value === sources.input2)?.label ?? ''
  );

  return (
    <div className={matchClasses.root}>
      <div className={matchClasses.top}>
        {hasPreviousRound ? (
          <Select
            size="md"
            searchable
            data={options}
            value={sources.input1}
            searchValue={search1}
            onSearchChange={setSearch1}
            onDropdownOpen={() => setSearch1('')}
            onChange={(value) => onChangeInput1(matchId, value)}
          />
        ) : (
          team1Label
        )}
      </div>
      <div className={matchClasses.bottom}>
        {hasPreviousRound ? (
          <Select
            size="md"
            searchable
            data={options}
            value={sources.input2}
            searchValue={search2}
            onSearchChange={setSearch2}
            onDropdownOpen={() => setSearch2('')}
            onChange={(value) => onChangeInput2(matchId, value)}
          />
        ) : (
          team2Label
        )}
      </div>
    </div>
  );
});

export default function EliminationStageItemPage() {
  const { id, tournamentData } = getTournamentIdFromRouter();
  const stageItemId = getStageItemIdFromRouter();
  const { t } = useTranslation();

  const swrTournamentResponse = getTournamentById(tournamentData.id);
  checkForAuthError(swrTournamentResponse);
  const swrStagesResponse: SWRResponse = getStages(id);

  const [pending, setPending] = useState<Record<number, PendingSources>>({});
  const [saving, setSaving] = useState(false);

  const tournamentDataFull = swrTournamentResponse.data?.data;
  const stageItemsLookup: any = responseIsValid(swrStagesResponse)
    ? getStageItemLookup(swrStagesResponse)
    : {};
  const matchesLookup: any = responseIsValid(swrStagesResponse)
    ? getMatchLookup(swrStagesResponse)
    : {};
  const stageItem =
    responseIsValid(swrStagesResponse) && stageItemId != null
      ? stageItemsLookup[stageItemId]
      : null;

  const sortedRounds: RoundWithMatches[] = useMemo(
    () => (stageItem != null ? [...stageItem.rounds].sort((r1, r2) => r1.id - r2.id) : []),
    [stageItem]
  );

  // Precomputed once per data snapshot (not per keystroke/render) - options per round and
  // per-match labels/defaults, keyed by id so unrelated matches keep stable prop references.
  const optionsByRoundId = useMemo(() => {
    const result: Record<number, SelectOption[]> = {};
    sortedRounds.forEach((round, roundIndex) => {
      const previousRound = roundIndex > 0 ? sortedRounds[roundIndex - 1] : null;
      result[round.id] =
        previousRound != null
          ? previousRound.matches.map((m: any) => ({
              value: `${m.id}`,
              label: matchOptionLabel(t, stageItemsLookup, matchesLookup, m),
            }))
          : [];
    });
    return result;
  }, [sortedRounds, t, stageItemsLookup, matchesLookup]);

  const matchLabelsById = useMemo(() => {
    const result: Record<number, { team1: string; team2: string }> = {};
    sortedRounds.forEach((round) =>
      round.matches.forEach((match: any) => {
        result[match.id] = {
          team1: formatMatchInput1(t, stageItemsLookup, matchesLookup, match),
          team2: formatMatchInput2(t, stageItemsLookup, matchesLookup, match),
        };
      })
    );
    return result;
  }, [sortedRounds, t, stageItemsLookup, matchesLookup]);

  const defaultSourcesByMatchId = useMemo(() => {
    const result: Record<number, PendingSources> = {};
    sortedRounds.forEach((round) =>
      round.matches.forEach((match: any) => {
        result[match.id] = defaultSourcesForMatch(match);
      })
    );
    return result;
  }, [sortedRounds]);

  const onChangeInput1 = useCallback(
    (matchId: number, value: string | null) => {
      setPending((prev) => ({
        ...prev,
        [matchId]: { ...(prev[matchId] ?? defaultSourcesByMatchId[matchId]), input1: value },
      }));
    },
    [defaultSourcesByMatchId]
  );

  const onChangeInput2 = useCallback(
    (matchId: number, value: string | null) => {
      setPending((prev) => ({
        ...prev,
        [matchId]: { ...(prev[matchId] ?? defaultSourcesByMatchId[matchId]), input2: value },
      }));
    },
    [defaultSourcesByMatchId]
  );

  if (!swrTournamentResponse.isLoading && tournamentDataFull == null) {
    return <NotFoundTitle />;
  } else if (tournamentDataFull == null) {
    return null;
  }

  const handleSave = async () => {
    setSaving(true);
    const assignments = Object.entries(pending).map(([matchId, sources]) => ({
      match_id: parseInt(matchId, 10),
      stage_item_input1_winner_from_match_id:
        sources.input1 != null ? parseInt(sources.input1, 10) : null,
      stage_item_input2_winner_from_match_id:
        sources.input2 != null ? parseInt(sources.input2, 10) : null,
    }));

    const response: any = await reassignWinnerSources(tournamentData.id, stageItem.id, assignments);
    setSaving(false);
    if (response != null && response.status === 200) {
      await swrStagesResponse.mutate();
      setPending({});
      showNotification({ color: 'green', title: t('successfully_saved_title'), message: '' });
    }
  };

  return (
    <TournamentLayout tournament_id={tournamentData.id}>
      <Title>{stageItem != null ? stageItem.name : ''}</Title>
      <SimpleGrid cols={{ base: 1, sm: 2 }} mt="1rem" pb="5rem">
        {sortedRounds.map((round, roundIndex) => {
          const hasPreviousRound = roundIndex > 0;
          const options = optionsByRoundId[round.id] || [];

          return (
            <div
              key={round.id}
              style={{
                padding: 15,
                borderRadius: 20,
                borderStyle: 'solid',
                borderColor: 'gray',
              }}
            >
              <Center>
                <Title order={3}>{round.name}</Title>
              </Center>
              {round.matches.map((match: any) => {
                const labels = matchLabelsById[match.id];
                const sources = pending[match.id] ?? defaultSourcesByMatchId[match.id];

                return (
                  <MatchPairingRow
                    key={match.id}
                    matchId={match.id}
                    hasPreviousRound={hasPreviousRound}
                    options={options}
                    team1Label={labels.team1}
                    team2Label={labels.team2}
                    sources={sources}
                    onChangeInput1={onChangeInput1}
                    onChangeInput2={onChangeInput2}
                  />
                );
              })}
            </div>
          );
        })}
      </SimpleGrid>
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 'var(--app-shell-navbar-offset, 0rem)',
          right: 0,
          padding: '1rem',
          background: 'var(--mantine-color-body)',
          borderTop: '1px solid var(--app-shell-border-color)',
          zIndex: 100,
          display: 'flex',
          justifyContent: 'flex-end',
        }}
      >
        <Button color="green" onClick={handleSave} disabled={saving}>
          {t('validate_and_save_button')}
        </Button>
      </div>
    </TournamentLayout>
  );
}
