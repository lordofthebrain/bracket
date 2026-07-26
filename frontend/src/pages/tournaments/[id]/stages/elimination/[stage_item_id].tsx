import { Button, Center, Grid, Group, Select, SimpleGrid, Text, Title } from '@mantine/core';
import { showNotification } from '@mantine/notifications';
import { IconExternalLink } from '@tabler/icons-react';
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
      <Group justify="space-between">
        <Title>{stageItem != null ? stageItem.name : ''}</Title>
        {tournamentDataFull?.dashboard_endpoint && (
          <Button
            color="blue"
            size="sm"
            variant="outline"
            leftSection={<IconExternalLink size={24} />}
            onClick={() => {
              window.open(`/tournaments/${tournamentDataFull.dashboard_endpoint}/dashboard`, '_blank');
            }}
          >
            {t('view_dashboard_button')}
          </Button>
        )}
      </Group>
      <SimpleGrid cols={{ base: 1, sm: 2 }} mt="1rem">
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
                minHeight: 320,
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
                const hideHalfTime =
                  match.stage_item_input1_score === 0 &&
                  match.stage_item_input2_score === 0 &&
                  match.stage_item_input1_score_half_time === 0 &&
                  match.stage_item_input2_score_half_time === 0;

                return (
                  <div key={match.id} className={matchClasses.root}>
                    <div className={matchClasses.top}>
                      <Grid grow>
                        <Grid.Col span={10}>
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
                        </Grid.Col>
                        <Grid.Col span={2} style={{ display: 'flex', alignItems: 'center' }}>
                          <Group gap={4} wrap="nowrap" justify="flex-end">
                            <Text component="span">{match.stage_item_input1_score}</Text>
                            <Text component="span" size="sm" c="dimmed" style={{ minWidth: '1rem' }}>
                              {!hideHalfTime && match.stage_item_input1_score_half_time != null
                                ? `(${match.stage_item_input1_score_half_time})`
                                : ''}
                            </Text>
                          </Group>
                        </Grid.Col>
                      </Grid>
                    </div>
                    <div className={matchClasses.bottom}>
                      <Grid grow>
                        <Grid.Col span={10}>
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
                        </Grid.Col>
                        <Grid.Col span={2} style={{ display: 'flex', alignItems: 'center' }}>
                          <Group gap={4} wrap="nowrap" justify="flex-end">
                            <Text component="span">{match.stage_item_input2_score}</Text>
                            <Text component="span" size="sm" c="dimmed" style={{ minWidth: '1rem' }}>
                              {!hideHalfTime && match.stage_item_input2_score_half_time != null
                                ? `(${match.stage_item_input2_score_half_time})`
                                : ''}
                            </Text>
                          </Group>
                        </Grid.Col>
                      </Grid>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </SimpleGrid>
      <Button fullWidth mt="lg" color="green" onClick={handleSave} disabled={saving}>
        {t('validate_and_save_button')}
      </Button>
    </TournamentLayout>
  );
}
