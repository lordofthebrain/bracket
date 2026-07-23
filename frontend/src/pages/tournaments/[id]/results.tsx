import {
  Alert,
  Card,
  Center,
  Grid,
  Group,
  Image,
  Select,
  Stack,
  Text,
  Title,
  UnstyledButton,
} from '@mantine/core';
import { AiOutlineHourglass } from '@react-icons/all-files/ai/AiOutlineHourglass';
import { IconAlertCircle } from '@tabler/icons-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import MatchModal from '@components/modals/match_modal';
import { NoContent } from '@components/no_content/empty_table_info';
import { formatMatchInput1, formatMatchInput2 } from '@components/utils/match';
import { Translator } from '@components/utils/types';
import { getTournamentIdFromRouter, responseIsValid } from '@components/utils/util';
import { MatchWithDetails } from '@openapi';
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
                <Text fw={500}>
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
                  {data.match.stage_item_input1_score_half_time != null
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
                <Text fw={500}>
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
                  {data.match.stage_item_input2_score_half_time != null
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
  const sortedMatches = matches
    .filter((m1: any) => m1.match.start_time != null)
    .filter(
      (m1: any) => roundFilter == null || roundFilter === 'all' || `${m1.round.id}` === roundFilter
    )
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

export default function ResultsPage() {
  const [modalOpened, modalSetOpened] = useState(false);
  const [match, setMatch] = useState<MatchWithDetails | null>(null);
  const [roundFilter, setRoundFilter] = useState<string | null>('all');

  const { t } = useTranslation();
  const { tournamentData } = getTournamentIdFromRouter();
  const swrStagesResponse = getStages(tournamentData.id);
  const swrCourtsResponse = getCourts(tournamentData.id);

  const stageItemsLookup = responseIsValid(swrStagesResponse)
    ? getStageItemLookup(swrStagesResponse)
    : [];
  const matchesLookup = responseIsValid(swrStagesResponse) ? getMatchLookup(swrStagesResponse) : [];

  const roundOptionsMap = new Map<number, string>();
  Object.values(matchesLookup).forEach((data: any) => {
    roundOptionsMap.set(data.round.id, data.round.name);
  });
  const roundOptions = [
    { value: 'all', label: t('round_filter_placeholder') },
    ...Array.from(roundOptionsMap.entries())
      .sort(([id1], [id2]) => id1 - id2)
      .map(([id, name]) => ({ value: `${id}`, label: name })),
  ];

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
      <Title>{t('results_title')}</Title>
      <Center mt="1rem">
        <Select
          label={t('round_filter_label')}
          data={roundOptions}
          value={roundFilter}
          onChange={setRoundFilter}
          allowDeselect={false}
          style={{ width: '48rem' }}
        />
      </Center>
      <Center mt="1rem">
        <Schedule
          t={t}
          matchesLookup={matchesLookup}
          stageItemsLookup={stageItemsLookup}
          openMatchModal={openMatchModal}
          roundFilter={roundFilter}
        />
      </Center>
    </TournamentLayout>
  );
}
