import { Button, Center, Select, SimpleGrid, Title } from '@mantine/core';
import { showNotification } from '@mantine/notifications';
import { useState } from 'react';
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

function matchOptionLabel(t: any, stageItemsLookup: any, matchesLookup: any, match: any): string {
  const label1 = formatMatchInput1(t, stageItemsLookup, matchesLookup, match);
  const label2 = formatMatchInput2(t, stageItemsLookup, matchesLookup, match);
  return `${label1} vs ${label2}`;
}

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

  if (!swrTournamentResponse.isLoading && tournamentDataFull == null) {
    return <NotFoundTitle />;
  } else if (tournamentDataFull == null) {
    return null;
  }

  const sortedRounds: RoundWithMatches[] =
    stageItem != null ? [...stageItem.rounds].sort((r1, r2) => r1.id - r2.id) : [];

  const getPending = (matchId: number, match: any): PendingSources =>
    pending[matchId] ?? {
      input1:
        match.stage_item_input1_winner_from_match_id != null
          ? `${match.stage_item_input1_winner_from_match_id}`
          : null,
      input2:
        match.stage_item_input2_winner_from_match_id != null
          ? `${match.stage_item_input2_winner_from_match_id}`
          : null,
    };

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
          const previousRound = roundIndex > 0 ? sortedRounds[roundIndex - 1] : null;
          const options =
            previousRound != null
              ? previousRound.matches.map((m: any) => ({
                  value: `${m.id}`,
                  label: matchOptionLabel(t, stageItemsLookup, matchesLookup, m),
                }))
              : [];

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
                const team1_label = formatMatchInput1(t, stageItemsLookup, matchesLookup, match);
                const team2_label = formatMatchInput2(t, stageItemsLookup, matchesLookup, match);
                const sources = getPending(match.id, match);

                return (
                  <div key={match.id} className={matchClasses.root}>
                    <div className={matchClasses.top}>
                      {previousRound != null ? (
                        <Select
                          size="md"
                          data={options}
                          value={sources.input1}
                          onChange={(value) =>
                            setPending((prev) => ({
                              ...prev,
                              [match.id]: { ...getPending(match.id, match), input1: value },
                            }))
                          }
                        />
                      ) : (
                        team1_label
                      )}
                    </div>
                    <div className={matchClasses.bottom}>
                      {previousRound != null ? (
                        <Select
                          size="md"
                          data={options}
                          value={sources.input2}
                          onChange={(value) =>
                            setPending((prev) => ({
                              ...prev,
                              [match.id]: { ...getPending(match.id, match), input2: value },
                            }))
                          }
                        />
                      ) : (
                        team2_label
                      )}
                    </div>
                  </div>
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
