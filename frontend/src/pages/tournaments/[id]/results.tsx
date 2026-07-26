import {
  Alert,
  Anchor,
  Card,
  Center,
  Grid,
  Group,
  Image,
  Loader,
  Select,
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
import { formatMatchInput1, formatMatchInput2 } from '@components/utils/match';
import { Translator } from '@components/utils/types';
import { getTournamentIdFromRouter, responseIsValid } from '@components/utils/util';
import { MatchWithDetails, StageWithStageItems } from '@openapi';
import TournamentLayout from '@pages/tournaments/_tournament_layout';
import { getBaseApiUrl, getCourts, getStages } from '@services/adapter';
import { getMatchLookup, getStageItemLookup } from '@services/lookups';

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

  // A 0:0 half-time score can't be told apart from "not entered" (the match
  // form defaults to 0), so don't show it when the final score is also 0:0.
  const hideHalfTime =
    data.match.stage_item_input1_score === 0 &&
    data.match.stage_item_input2_score === 0 &&
    data.match.stage_item_input1_score_half_time === 0 &&
    data.match.stage_item_input2_score_half_time === 0;

  const isSingleElimination = data.stageItem?.type === 'SINGLE_ELIMINATION';
  const input1Won =
    isSingleElimination &&
    data.match.is_played &&
    data.match.stage_item_input1_score > data.match.stage_item_input2_score;
  const input2Won =
    isSingleElimination &&
    data.match.is_played &&
    data.match.stage_item_input2_score > data.match.stage_item_input1_score;
  const isDarkMode = useColorScheme() === 'dark';
  const winnerNameStyle = isDarkMode ? { color: 'white' } : undefined;

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
              <Group gap="xs" wrap="nowrap">
                <TeamLogo input={data.match.stage_item_input1} />
                <Text fw={input1Won ? 700 : 500} style={input1Won ? winnerNameStyle : undefined}>
                  {formatMatchInput1(t, stageItemsLookup, matchesLookup, data.match)}
                </Text>
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
                  {data.match.stage_item_input1_score}
                </div>
                <Text size="md" c="dimmed" style={{ minWidth: '1.5rem' }}>
                  {!hideHalfTime && data.match.stage_item_input1_score_half_time != null
                    ? `(${data.match.stage_item_input1_score_half_time})`
                    : ''}
                </Text>
              </Group>
            </Grid.Col>
          </Grid>
          <Grid mb="0rem">
            <Grid.Col span="auto" pb="0rem">
              <Group gap="xs" wrap="nowrap">
                <TeamLogo input={data.match.stage_item_input2} />
                <Text fw={input2Won ? 700 : 500} style={input2Won ? winnerNameStyle : undefined}>
                  {formatMatchInput2(t, stageItemsLookup, matchesLookup, data.match)}
                </Text>
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
                  {data.match.stage_item_input2_score}
                </div>
                <Text size="md" c="dimmed" style={{ minWidth: '1.5rem' }}>
                  {!hideHalfTime && data.match.stage_item_input2_score_half_time != null
                    ? `(${data.match.stage_item_input2_score_half_time})`
                    : ''}
                </Text>
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
  matchesLookup,
  openMatchModal,
  jumpTo,
}: {
  t: Translator;
  stageItem: any;
  stageItemsLookup: any;
  matchesLookup: any;
  openMatchModal: CallableFunction;
  jumpTo: { targetId: string; label: string }[];
}) {
  const [roundFilter, setRoundFilter] = useState<string | null>(null);

  const roundOptionsMap = new Map<number, string>();
  Object.values(matchesLookup)
    .filter((data: any) => data.stageItem.id === stageItem.id)
    .forEach((data: any) => {
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
      Object.values(matchesLookup).some(
        (data: any) =>
          data.stageItem.id === stageItem.id && data.round.id === id && !data.match.is_played
      )
    );
    setRoundFilter(`${unplayedRoundId ?? sortedRoundIds[sortedRoundIds.length - 1]}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortedRoundIds.join(',')]);

  return (
    <div>
      <Center>
        <Group justify="space-between" align="baseline" mb="sm" style={{ width: '48rem' }}>
          <Title order={3}>{stageItem.name}</Title>
          <Group gap="md">
            {jumpTo.map((jump) => (
              <Anchor key={jump.targetId} href={`#${jump.targetId}`}>
                {jump.label}
              </Anchor>
            ))}
          </Group>
        </Group>
      </Center>
      {roundOptions.length > 0 && (
        <Center>
          <Select
            label={t('round_filter_label')}
            data={roundOptions}
            value={roundFilter}
            onChange={setRoundFilter}
            allowDeselect={false}
            style={{ width: '48rem' }}
          />
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
  const [stageFilter, setStageFilter] = useState<string | null>(null);

  const { t } = useTranslation();
  const { tournamentData } = getTournamentIdFromRouter();
  const swrStagesResponse = getStages(tournamentData.id);
  const swrCourtsResponse = getCourts(tournamentData.id);

  const stageItemsLookup: any = responseIsValid(swrStagesResponse)
    ? getStageItemLookup(swrStagesResponse)
    : [];
  const matchesLookup = responseIsValid(swrStagesResponse) ? getMatchLookup(swrStagesResponse) : [];

  const stages: StageWithStageItems[] = swrStagesResponse.data?.data ?? [];
  const stageOptions = stages.map((stage) => ({ value: `${stage.id}`, label: stage.name }));

  useEffect(() => {
    if (stageFilter != null || stages.length < 1) return;
    const activeStage = stages.find((stage) => stage.is_active);
    setStageFilter(`${activeStage?.id ?? stages[stages.length - 1].id}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stages.map((stage) => stage.id).join(',')]);

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
      {stageOptions.length > 1 && (
        <Center mt="1rem">
          <Select
            label={t('stage_filter_label')}
            data={stageOptions}
            value={stageFilter}
            onChange={setStageFilter}
            allowDeselect={false}
            style={{ width: '48rem' }}
          />
        </Center>
      )}
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
