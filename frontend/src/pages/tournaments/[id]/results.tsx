import {
  Alert,
  Anchor,
  Card,
  Center,
  Grid,
  Group,
  Image,
  Loader,
  Stack,
  Text,
  Title,
  UnstyledButton,
} from '@mantine/core';
import { useColorScheme } from '@mantine/hooks';
import { AiOutlineHourglass } from '@react-icons/all-files/ai/AiOutlineHourglass';
import { IconAlertCircle } from '@tabler/icons-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import MatchModal from '@components/modals/match_modal';
import { NoContent } from '@components/no_content/empty_table_info';
import { RoundFilterSelect } from '@components/select/round_filter_select';
import { StageFilterSelect, useStageFilter } from '@components/select/stage_filter_select';
import {
  formatMatchInput1,
  formatMatchInput2,
  getMatchResultDisplay,
  getMatchWinner,
  getTeamLeagueLabel,
} from '@components/utils/match';
import { Translator } from '@components/utils/types';
import { getTournamentIdFromRouter, responseIsValid } from '@components/utils/util';
import { MatchWithDetails } from '@openapi';
import TournamentLayout from '@pages/tournaments/_tournament_layout';
import { getBaseApiUrl, getCourts, getStages } from '@services/adapter';
import { getMatchesByStageItemId, getMatchLookup, getStageItemLookup } from '@services/lookups';

function TeamLogo({ input }: { input: any }) {
  if (input == null || !('team' in input) || input.team.logo_path == null) return null;
  return (
    <Image
      src={`${getBaseApiUrl()}/static/team-logos/${input.team.logo_path}`}
      alt=""
      style={{ width: 24, height: 24, objectFit: 'contain', flexShrink: 0 }}
    />
  );
}

function ScheduleRow({
  data,
  openMatchModal,
  stageItemsLookup,
  matchesLookup,
}: {
  data: any;
  openMatchModal: any;
  stageItemsLookup: any;
  matchesLookup: any;
}) {
  const { t } = useTranslation();
  const scoreColor = '#656565';

  const isSingleElimination = data.stageItem?.type === 'SINGLE_ELIMINATION';
  const result = getMatchResultDisplay(data.match);
  const winner = getMatchWinner(data.match);
  const input1Won = isSingleElimination && data.match.is_played && winner === 1;
  const input2Won = isSingleElimination && data.match.is_played && winner === 2;
  const leagueLabel = (input: any) =>
    isSingleElimination
      ? getTeamLeagueLabel(input?.team_id, stageItemsLookup, data.stageItem.id)
      : null;
  const league1Label = leagueLabel(data.match.stage_item_input1);
  const league2Label = leagueLabel(data.match.stage_item_input2);
  const isDarkMode = useColorScheme() === 'dark';
  const winnerNameStyle = isDarkMode ? { color: 'white' } : undefined;

  const checkpointStyle = {
    fontSize: 'var(--mantine-font-size-md)',
    color: 'var(--mantine-color-dimmed)',
  };

  return (
    <UnstyledButton style={{ width: '48rem' }}>
      <Card
        shadow="sm"
        radius="md"
        withBorder
        mt="md"
        onClick={() => {
          openMatchModal(data.match);
        }}
      >
        <Stack>
          <Grid>
            <Grid.Col span="auto" pb="0rem">
              <Group gap="xs" wrap="nowrap" align="center">
                <TeamLogo input={data.match.stage_item_input1} />
                <Text fw={input1Won ? 700 : 500} style={input1Won ? winnerNameStyle : undefined}>
                  {formatMatchInput1(t, stageItemsLookup, matchesLookup, data.match)}
                </Text>
                {league1Label != null && (
                  <div style={{ fontSize: 'var(--mantine-font-size-sm)', color: 'var(--mantine-color-dimmed)' }}>
                    ({league1Label})
                  </div>
                )}
              </Group>
            </Grid.Col>
            <Grid.Col span="content" pb="0rem">
              <Group gap="xs" wrap="nowrap">
                {result.prefix != null && (
                  <Text
                    size="sm"
                    c="dimmed"
                    fw={700}
                    style={{ position: 'relative', top: '0.9rem' }}
                  >
                    {result.prefix}
                  </Text>
                )}
                <div
                  style={{
                    backgroundColor: scoreColor,
                    borderRadius: '0.5rem',
                    paddingLeft: '1rem',
                    paddingRight: '1rem',
                    color: 'white',
                    fontWeight: 800,
                  }}
                >
                  {result.headline[0]}
                </div>
                <Group gap="xs" wrap="nowrap" justify="flex-end" style={{ minWidth: '1.5rem' }}>
                  {result.checkpoints.map((checkpoint, index) => (
                    <div key={index} style={checkpointStyle}>
                      ({checkpoint[0]})
                    </div>
                  ))}
                </Group>
              </Group>
            </Grid.Col>
          </Grid>
          <Grid mb="0rem">
            <Grid.Col span="auto" pb="0rem">
              <Group gap="xs" wrap="nowrap" align="center">
                <TeamLogo input={data.match.stage_item_input2} />
                <Text fw={input2Won ? 700 : 500} style={input2Won ? winnerNameStyle : undefined}>
                  {formatMatchInput2(t, stageItemsLookup, matchesLookup, data.match)}
                </Text>
                {league2Label != null && (
                  <div style={{ fontSize: 'var(--mantine-font-size-sm)', color: 'var(--mantine-color-dimmed)' }}>
                    ({league2Label})
                  </div>
                )}
              </Group>
            </Grid.Col>
            <Grid.Col span="content" pb="0rem">
              <Group gap="xs" wrap="nowrap">
                <div
                  style={{
                    backgroundColor: scoreColor,
                    borderRadius: '0.5rem',
                    paddingLeft: '1rem',
                    paddingRight: '1rem',
                    color: 'white',
                    fontWeight: 800,
                  }}
                >
                  {result.headline[1]}
                </div>
                <Group gap="xs" wrap="nowrap" justify="flex-end" style={{ minWidth: '1.5rem' }}>
                  {result.checkpoints.map((checkpoint, index) => (
                    <div key={index} style={checkpointStyle}>
                      ({checkpoint[1]})
                    </div>
                  ))}
                </Group>
              </Group>
            </Grid.Col>
          </Grid>
        </Stack>
      </Card>
    </UnstyledButton>
  );
}

function Schedule({
  t,
  stageItemsLookup,
  openMatchModal,
  matchesLookup,
  roundFilter,
}: {
  t: Translator;
  stageItemsLookup: any;
  openMatchModal: CallableFunction;
  matchesLookup: any;
  roundFilter: string | null;
}) {
  const matches: any[] = Object.values(matchesLookup);
  const sortedMatches =
    roundFilter == null
      ? []
      : matches
          .filter((m1: any) => m1.match.start_time != null)
          .filter((m1: any) => `${m1.round.id}` === roundFilter)
          .sort((m1: any, m2: any) => m1.round.id - m2.round.id);

  const rows: React.JSX.Element[] = [];
  let lastRoundId: number | null = null;
  sortedMatches.forEach((data: any) => {
    if (data.round.id !== lastRoundId) {
      rows.push(
        <Title order={3} mt="lg" key={`round-${data.round.id}`}>
          {data.round.name}
        </Title>
      );
      lastRoundId = data.round.id;
    }
    rows.push(
      <ScheduleRow
        key={data.match.id}
        data={data}
        openMatchModal={openMatchModal}
        stageItemsLookup={stageItemsLookup}
        matchesLookup={matchesLookup}
      />
    );
  });

  if (rows.length < 1) {
    return (
      <NoContent
        title={t('no_matches_title')}
        description={t('no_matches_description')}
        icon={<AiOutlineHourglass />}
      />
    );
  }

  const noItemsAlert =
    matchesLookup.length < 1 ? (
      <Alert
        icon={<IconAlertCircle size={16} />}
        title={t('no_matches_title')}
        color="gray"
        radius="md"
      >
        {t('drop_match_alert_title')}
      </Alert>
    ) : null;

  return (
    <Group wrap="nowrap" align="top">
      <div style={{ width: '48rem' }}>
        {rows}
        {noItemsAlert}
      </div>
    </Group>
  );
}

function ResultsForStageItem({
  t,
  stageItem,
  stageItemsLookup,
  stageItemMatches,
  matchesLookup,
  openMatchModal,
  jumpTo,
}: {
  t: Translator;
  stageItem: any;
  stageItemsLookup: any;
  stageItemMatches: any[];
  matchesLookup: any;
  openMatchModal: CallableFunction;
  jumpTo: { targetId: string; label: string }[];
}) {
  const [roundFilter, setRoundFilter] = useState<string | null>(null);

  const roundOptionsMap = new Map<number, string>();
  stageItemMatches.forEach((data: any) => {
    roundOptionsMap.set(data.round.id, data.round.name);
  });
  const sortedRoundIds = Array.from(roundOptionsMap.keys()).sort((id1, id2) => id1 - id2);
  const roundOptions = sortedRoundIds.map((id) => ({
    value: `${id}`,
    label: roundOptionsMap.get(id) as string,
  }));

  useEffect(() => {
    if (
      sortedRoundIds.length < 1 ||
      (roundFilter != null && sortedRoundIds.includes(Number(roundFilter)))
    ) {
      return;
    }

    const unplayedRoundId = sortedRoundIds.find((id) =>
      stageItemMatches.some((data: any) => data.round.id === id && !data.match.is_played)
    );
    setRoundFilter(`${unplayedRoundId ?? sortedRoundIds[sortedRoundIds.length - 1]}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortedRoundIds.join(',')]);

  return (
    <div>
      <Center>
        <div style={{ width: '48rem' }}>
          <Group justify="space-between" align="baseline" mb="sm" style={{ maxWidth: '20rem' }}>
            <Title order={3}>{stageItem.name}</Title>
            <Group gap="md">
              {jumpTo.map((jump) => (
                <Anchor key={jump.targetId} href={`#${jump.targetId}`}>
                  {jump.label}
                </Anchor>
              ))}
            </Group>
          </Group>
        </div>
      </Center>
      {roundOptions.length > 0 && (
        <Center>
          <div style={{ width: '48rem' }}>
            <RoundFilterSelect
              options={roundOptions}
              value={roundFilter}
              onChange={setRoundFilter}
              style={{ maxWidth: '20rem' }}
            />
          </div>
        </Center>
      )}
      <Center mt="1rem">
        {sortedRoundIds.length < 1 ? (
          <NoContent
            title={t('no_matches_title')}
            description={t('no_matches_description')}
            icon={<AiOutlineHourglass />}
          />
        ) : roundFilter == null ? (
          <Loader />
        ) : (
          <Schedule
            t={t}
            matchesLookup={matchesLookup}
            stageItemsLookup={stageItemsLookup}
            openMatchModal={openMatchModal}
            roundFilter={roundFilter}
          />
        )}
      </Center>
    </div>
  );
}

export default function ResultsPage() {
  const [modalOpened, modalSetOpened] = useState(false);
  const [match, setMatch] = useState<MatchWithDetails | null>(null);

  const { t } = useTranslation();
  const { tournamentData } = getTournamentIdFromRouter();
  const swrStagesResponse = getStages(tournamentData.id);
  const swrCourtsResponse = getCourts(tournamentData.id);
  const { stageFilter, setStageFilter, stageOptions } = useStageFilter(swrStagesResponse);

  const stageItemsLookup: any = responseIsValid(swrStagesResponse)
    ? getStageItemLookup(swrStagesResponse)
    : [];
  const matchesLookup = responseIsValid(swrStagesResponse) ? getMatchLookup(swrStagesResponse) : [];
  const matchesByStageItemId = responseIsValid(swrStagesResponse)
    ? getMatchesByStageItemId(swrStagesResponse)
    : {};

  const stageItemIds = Object.values(stageItemsLookup)
    .filter((stageItem: any) => stageFilter == null || `${stageItem.stage_id}` === stageFilter)
    .sort((si1: any, si2: any) => (si1.name > si2.name ? 1 : -1))
    .map((stageItem: any) => stageItem.id);

  const anchorId = (stageItemId: number) => `results-stage-item-${stageItemId}`;

  if (!responseIsValid(swrStagesResponse)) return null;
  if (!responseIsValid(swrCourtsResponse)) return null;

  function openMatchModal(matchToOpen: MatchWithDetails) {
    setMatch(matchToOpen);
    modalSetOpened(true);
  }

  function modalSetOpenedAndUpdateMatch(opened: boolean) {
    if (!opened) {
      setMatch(null);
    }
    modalSetOpened(opened);
  }

  return (
    <TournamentLayout tournament_id={tournamentData.id}>
      <MatchModal
        swrStagesResponse={swrStagesResponse}
        swrUpcomingMatchesResponse={null}
        tournamentData={tournamentData}
        match={match}
        opened={modalOpened}
        setOpened={modalSetOpenedAndUpdateMatch}
        round={null}
      />
      <Center>
        <Title style={{ width: '48rem' }}>{t('results_title')}</Title>
      </Center>
      <Center>
        <div style={{ width: '48rem' }}>
          <StageFilterSelect
            stageFilter={stageFilter}
            setStageFilter={setStageFilter}
            stageOptions={stageOptions}
          />
        </div>
      </Center>
      {stageItemIds.length < 1 ? (
        <Center mt="1rem">
          <NoContent
            title={t('no_matches_title')}
            description={t('no_matches_description')}
            icon={<AiOutlineHourglass />}
          />
        </Center>
      ) : (
        stageItemIds.map((stageItemId: number, index: number) => {
          const jumpTo = stageItemIds
            .filter((otherId: number) => otherId !== stageItemId)
            .map((otherId: number) => {
              const otherIndex = stageItemIds.indexOf(otherId);
              const arrow = otherIndex > index ? '↓' : '↑';
              return {
                targetId: anchorId(otherId),
                label: `${arrow} ${stageItemsLookup[otherId].name}`,
              };
            });

          return (
            <div
              key={stageItemId}
              id={anchorId(stageItemId)}
              style={{
                marginTop: index > 0 ? '3rem' : '1rem',
                marginBottom: index === stageItemIds.length - 1 ? '3rem' : undefined,
                scrollMarginTop: '4.9rem',
              }}
            >
              <ResultsForStageItem
                t={t}
                stageItem={stageItemsLookup[stageItemId]}
                stageItemsLookup={stageItemsLookup}
                stageItemMatches={matchesByStageItemId[stageItemId] || []}
                matchesLookup={matchesLookup}
                openMatchModal={openMatchModal}
                jumpTo={jumpTo}
              />
            </div>
          );
        })
      )}
    </TournamentLayout>
  );
}
