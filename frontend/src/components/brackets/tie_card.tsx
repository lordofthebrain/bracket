import { Text, UnstyledButton } from '@mantine/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SWRResponse } from 'swr';

import MatchModal from '@components/modals/match_modal';
import { getTieAggregateScoreDisplay, getTieAggregateWinner } from '@components/utils/match';
import { TournamentMinimal } from '@components/utils/tournament';
import { MatchWithDetails, RoundWithMatches, StagesWithStageItemsResponse } from '@openapi';
import { getMatchLookup } from '@services/lookups';
import Match from './match';

// A two-legged tie's first and second leg live in the same round; this stacks the two existing
// `Match` cards (in read-only display mode, since click/modal handling is owned here) into one
// visual card. The first leg always opens its own edit modal; the second leg opens the first
// leg's modal instead until the first leg has been played.
export default function TieCard({
  tournamentData,
  swrStagesResponse,
  swrUpcomingMatchesResponse,
  leg1,
  leg2,
  readOnly,
  round,
}: {
  tournamentData: TournamentMinimal;
  swrStagesResponse: SWRResponse<StagesWithStageItemsResponse>;
  swrUpcomingMatchesResponse: SWRResponse | null;
  leg1: MatchWithDetails;
  leg2: MatchWithDetails;
  readOnly: boolean;
  round: RoundWithMatches;
}) {
  const { t } = useTranslation();
  const [opened, setOpened] = useState(false);
  const [activeLeg, setActiveLeg] = useState<'leg1' | 'leg2'>('leg1');

  const matchesLookup = getMatchLookup(swrStagesResponse);
  const awayGoalsRule = matchesLookup[leg1.id]?.stageItem?.away_goals_rule ?? false;
  const aggregateWinner =
    leg1.is_played && leg2.is_played ? getTieAggregateWinner(leg1, leg2, awayGoalsRule) : null;
  const aggregateScore = getTieAggregateScoreDisplay(leg1, leg2);
  const activeMatch = activeLeg === 'leg1' ? leg1 : leg2;

  const legProps = {
    tournamentData,
    swrStagesResponse,
    swrUpcomingMatchesResponse,
    round,
    readOnly: true,
    showCourtAndTime: false,
  };

  const leg1Rows = (
    <Match {...legProps} match={leg1} roundBottom={false} winnerOverride={aggregateWinner} />
  );
  const leg2Rows = (
    <div
      style={{
        borderTop: '2px solid light-dark(var(--mantine-color-gray-4), var(--mantine-color-dark-4))',
      }}
    >
      <Match
        {...legProps}
        match={leg2}
        roundTop={false}
        noMarginTop
        winnerOverride={aggregateWinner === 1 ? 2 : aggregateWinner === 2 ? 1 : aggregateWinner}
      />
    </div>
  );
  const aggregateLine = (
    <Text size="xs" c="dimmed" ta="center" mt={4}>
      {t('aggregate_score_label')}: {aggregateScore[0]}
      {' : '}
      {aggregateScore[1]}
    </Text>
  );

  if (readOnly) {
    return (
      <div>
        {leg1Rows}
        {leg2Rows}
        {aggregateLine}
      </div>
    );
  }

  return (
    <>
      <UnstyledButton
        style={{ width: '100%', display: 'block' }}
        onClick={() => {
          setActiveLeg('leg1');
          setOpened(true);
        }}
      >
        {leg1Rows}
      </UnstyledButton>
      <UnstyledButton
        style={{ width: '100%', display: 'block' }}
        onClick={() => {
          setActiveLeg(leg1.is_played ? 'leg2' : 'leg1');
          setOpened(true);
        }}
      >
        {leg2Rows}
      </UnstyledButton>
      {aggregateLine}
      <MatchModal
        key={activeMatch.id}
        swrStagesResponse={swrStagesResponse}
        swrUpcomingMatchesResponse={swrUpcomingMatchesResponse}
        tournamentData={tournamentData}
        match={activeMatch}
        opened={opened}
        setOpened={setOpened}
        round={round}
        onSaved={activeLeg === 'leg1' ? () => setActiveLeg('leg2') : undefined}
      />
    </>
  );
}
