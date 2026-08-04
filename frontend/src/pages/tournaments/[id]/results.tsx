import {
  Alert,
  Card,
  Center,
  Container,
  Divider,
  Group,
  Image,
  Loader,
  Stack,
  Tabs,
  Text,
  Title,
  UnstyledButton,
} from '@mantine/core';
import { useColorScheme } from '@mantine/hooks';
import { AiOutlineHourglass } from '@react-icons/all-files/ai/AiOutlineHourglass';
import { IconAlertCircle } from '@tabler/icons-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import MatchModal from '@components/modals/match_modal';
import { NoContent } from '@components/no_content/empty_table_info';
import { getCountryDisplayName } from '@components/select/country_select';
import { RoundFilterSelect } from '@components/select/round_filter_select';
import { StageFilterSelect, useStageFilter } from '@components/select/stage_filter_select';
import {
  formatMatchInput1,
  formatMatchInput2,
  getMatchResultDisplay,
  getMatchWinner,
  getTeamLeagueLabel,
  getTieAggregateScoreDisplay,
  getTieAggregateWinner,
  isInternationalCup,
} from '@components/utils/match';
import { useLazyTabs } from '@components/utils/react';
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

function LegRow({
  match,
  stageItemsLookup,
  matchesLookup,
  isSingleElimination,
  stageId,
  stageItemId,
  winner,
  isDarkMode,
  onClick,
}: {
  match: any;
  stageItemsLookup: any;
  matchesLookup: any;
  isSingleElimination: boolean;
  stageId: number;
  stageItemId: number;
  winner: 1 | 2 | null;
  isDarkMode: boolean;
  onClick: () => void;
}) {
  const { t, i18n } = useTranslation();
  const scoreColor = '#656565';

  const result = getMatchResultDisplay(match);
  const input1Won = isSingleElimination && match.is_played && winner === 1;
  const input2Won = isSingleElimination && match.is_played && winner === 2;
  const isInternational = isSingleElimination && isInternationalCup(stageItemsLookup, stageItemId);
  const locale = i18n.language?.startsWith('de') ? 'de' : 'en';
  const originLabel = (input: any) => {
    if (!isSingleElimination) return null;
    if (isInternational) {
      return input?.team?.country != null ? getCountryDisplayName(input.team.country, locale) : null;
    }
    return getTeamLeagueLabel(input?.team_id, stageItemsLookup, stageId);
  };
  const originLabel1 = originLabel(match.stage_item_input1);
  const originLabel2 = originLabel(match.stage_item_input2);
  const winnerNameStyle = isDarkMode ? { color: 'white' } : undefined;

  const checkpointStyle = {
    fontSize: 'var(--mantine-font-size-md)',
    color: 'var(--mantine-color-dimmed)',
  };

  return (
    <UnstyledButton style={{ width: '100%', display: 'block' }} onClick={onClick}>
      <Stack gap={4}>
        <Group justify="space-between" wrap="nowrap" align="center">
          <Group gap="xs" wrap="nowrap" align="center" style={{ flex: 1, minWidth: 0 }}>
            <TeamLogo input={match.stage_item_input1} />
            <Text fw={input1Won ? 700 : 500} style={input1Won ? winnerNameStyle : undefined}>
              {formatMatchInput1(t, stageItemsLookup, matchesLookup, match)}
            </Text>
            {originLabel1 != null && (
              <div style={{ fontSize: 'var(--mantine-font-size-sm)', color: 'var(--mantine-color-dimmed)' }}>
                ({originLabel1})
              </div>
            )}
          </Group>
          <Group gap="xs" wrap="nowrap" style={{ flexShrink: 0 }}>
            {result.prefix != null && (
              <Text size="sm" c="dimmed" fw={700} style={{ position: 'relative', top: '0.9rem' }}>
                {t(result.prefix)}
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
        </Group>
        <Group justify="space-between" wrap="nowrap" align="center">
          <Group gap="xs" wrap="nowrap" align="center" style={{ flex: 1, minWidth: 0 }}>
            <TeamLogo input={match.stage_item_input2} />
            <Text fw={input2Won ? 700 : 500} style={input2Won ? winnerNameStyle : undefined}>
              {formatMatchInput2(t, stageItemsLookup, matchesLookup, match)}
            </Text>
            {originLabel2 != null && (
              <div style={{ fontSize: 'var(--mantine-font-size-sm)', color: 'var(--mantine-color-dimmed)' }}>
                ({originLabel2})
              </div>
            )}
          </Group>
          <Group gap="xs" wrap="nowrap" style={{ flexShrink: 0 }}>
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
        </Group>
      </Stack>
    </UnstyledButton>
  );
}

const ScheduleRow = React.memo(function ScheduleRow({
  data,
  returnLegData,
  openMatchModal,
  stageItemsLookup,
  matchesLookup,
  isDarkMode,
}: {
  data: any;
  returnLegData?: any;
  openMatchModal: any;
  stageItemsLookup: any;
  matchesLookup: any;
  isDarkMode: boolean;
}) {
  const { t } = useTranslation();
  const isSingleElimination = data.stageItem?.type === 'SINGLE_ELIMINATION';
  const awayGoalsRule = data.stageItem?.away_goals_rule ?? false;

  const bothLegsPlayed = returnLegData != null && data.match.is_played && returnLegData.match.is_played;
  const aggregateWinner = bothLegsPlayed
    ? getTieAggregateWinner(data.match, returnLegData.match, awayGoalsRule)
    : null;
  const aggregateScore =
    returnLegData != null ? getTieAggregateScoreDisplay(data.match, returnLegData.match) : null;
  const winner1 = returnLegData != null ? aggregateWinner : getMatchWinner(data.match);
  const winner2 =
    returnLegData != null
      ? aggregateWinner === 1
        ? 2
        : aggregateWinner === 2
          ? 1
          : aggregateWinner
      : null;

  const returnLegOnClick =
    returnLegData != null
      ? () => openMatchModal(data.match.is_played ? returnLegData.match : data.match)
      : undefined;

  return (
    <Card shadow="sm" radius="md" withBorder mt="md" p={0} style={{ width: '100%' }}>
      <div style={{ padding: 'var(--mantine-spacing-md)' }}>
        <LegRow
          match={data.match}
          stageItemsLookup={stageItemsLookup}
          matchesLookup={matchesLookup}
          isSingleElimination={isSingleElimination}
          stageId={data.stageItem.stage_id}
          stageItemId={data.stageItem.id}
          winner={winner1}
          isDarkMode={isDarkMode}
          onClick={() => openMatchModal(data.match)}
        />
      </div>
      {returnLegData != null && (
        <>
          <Divider mx="md" />
          <div style={{ padding: 'var(--mantine-spacing-md)' }}>
            <LegRow
              match={returnLegData.match}
              stageItemsLookup={stageItemsLookup}
              matchesLookup={matchesLookup}
              isSingleElimination={isSingleElimination}
              stageId={data.stageItem.stage_id}
              stageItemId={data.stageItem.id}
              winner={winner2}
              isDarkMode={isDarkMode}
              onClick={returnLegOnClick as () => void}
            />
          </div>
          <Text size="xs" c="dimmed" ta="center" pb="xs">
            {t('aggregate_score_label')}: {aggregateScore![0]}
            {' : '}
            {aggregateScore![1]}
          </Text>
        </>
      )}
    </Card>
  );
});

function Schedule({
  t,
  stageItemsLookup,
  openMatchModal,
  matchesLookup,
  stageItemMatches,
  roundFilter,
  isDarkMode,
}: {
  t: Translator;
  stageItemsLookup: any;
  openMatchModal: CallableFunction;
  matchesLookup: any;
  stageItemMatches: any[];
  roundFilter: string | null;
  isDarkMode: boolean;
}) {
  const matchDataById = useMemo(
    () => new Map(stageItemMatches.map((data: any) => [data.match.id, data])),
    [stageItemMatches]
  );

  const sortedMatches = useMemo(
    () =>
      roundFilter == null
        ? []
        : stageItemMatches
            .filter((m1: any) => m1.match.start_time != null)
            .filter((m1: any) => `${m1.round.id}` === roundFilter)
            .filter((m1: any) => !m1.match.is_return_leg)
            .sort((m1: any, m2: any) => m1.round.id - m2.round.id),
    [stageItemMatches, roundFilter]
  );

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
    const returnLegData =
      data.match.return_leg_match_id != null
        ? matchDataById.get(data.match.return_leg_match_id)
        : null;
    rows.push(
      <ScheduleRow
        key={data.match.id}
        data={data}
        returnLegData={returnLegData}
        openMatchModal={openMatchModal}
        stageItemsLookup={stageItemsLookup}
        matchesLookup={matchesLookup}
        isDarkMode={isDarkMode}
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
    <div style={{ width: '100%' }}>
      {rows}
      {noItemsAlert}
    </div>
  );
}

function ResultsForStageItem({
  t,
  stageItem,
  stageItemsLookup,
  stageItemMatches,
  matchesLookup,
  openMatchModal,
  isDarkMode,
}: {
  t: Translator;
  stageItem: any;
  stageItemsLookup: any;
  stageItemMatches: any[];
  matchesLookup: any;
  openMatchModal: CallableFunction;
  isDarkMode: boolean;
}) {
  const [roundFilter, setRoundFilter] = useState<string | null>(null);

  const { sortedRoundIds, roundOptions } = useMemo(() => {
    const roundOptionsMap = new Map<number, string>();
    stageItemMatches.forEach((data: any) => {
      roundOptionsMap.set(data.round.id, data.round.name);
    });
    const ids = Array.from(roundOptionsMap.keys()).sort((id1, id2) => id1 - id2);
    return {
      sortedRoundIds: ids,
      roundOptions: ids.map((id) => ({ value: `${id}`, label: roundOptionsMap.get(id) as string })),
    };
  }, [stageItemMatches]);

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
      {roundOptions.length > 0 && (
        <Center>
          <RoundFilterSelect
            options={roundOptions}
            value={roundFilter}
            onChange={setRoundFilter}
            style={{ width: '100%' }}
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
            stageItemMatches={stageItemMatches}
            stageItemsLookup={stageItemsLookup}
            openMatchModal={openMatchModal}
            roundFilter={roundFilter}
            isDarkMode={isDarkMode}
          />
        )}
      </Center>
    </div>
  );
}

export default function ResultsPage() {
  const [modalOpened, modalSetOpened] = useState(false);
  const [match, setMatch] = useState<MatchWithDetails | null>(null);
  const isDarkMode = useColorScheme() === 'dark';

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
    .sort((si1: any, si2: any) => si1.id - si2.id)
    .map((stageItem: any) => stageItem.id);

  const {
    activeTab: activeStageItemTab,
    setActiveTab: setActiveStageItemTab,
    visitedTabs: visitedStageItemTabs,
  } = useLazyTabs(stageItemIds.map((id) => `${id}`));

  const openMatchModal = useCallback((matchToOpen: MatchWithDetails) => {
    setMatch(matchToOpen);
    modalSetOpened(true);
  }, []);

  if (!responseIsValid(swrStagesResponse)) return null;
  if (!responseIsValid(swrCourtsResponse)) return null;

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
      <Container size="48rem" px={0}>
        <Title>{t('results_title')}</Title>
        <Center mt="md">
          <StageFilterSelect
            stageFilter={stageFilter}
            setStageFilter={setStageFilter}
            stageOptions={stageOptions}
            width="100%"
            maxWidth="100%"
          />
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
          <Tabs value={activeStageItemTab} onChange={setActiveStageItemTab} variant="pills" mt="1.5rem">
            <Tabs.List>
              {stageItemIds.map((stageItemId: number) => (
                <Tabs.Tab key={stageItemId} value={`${stageItemId}`}>
                  {stageItemsLookup[stageItemId].name}
                </Tabs.Tab>
              ))}
            </Tabs.List>
            {stageItemIds.map((stageItemId: number) => (
              <Tabs.Panel
                key={stageItemId}
                value={`${stageItemId}`}
                keepMounted={visitedStageItemTabs.has(`${stageItemId}`)}
                pt="1.5rem"
              >
                <ResultsForStageItem
                  t={t}
                  stageItem={stageItemsLookup[stageItemId]}
                  stageItemsLookup={stageItemsLookup}
                  stageItemMatches={matchesByStageItemId[stageItemId] || []}
                  matchesLookup={matchesLookup}
                  openMatchModal={openMatchModal}
                  isDarkMode={isDarkMode}
                />
              </Tabs.Panel>
            ))}
          </Tabs>
        )}
      </Container>
    </TournamentLayout>
  );
}
