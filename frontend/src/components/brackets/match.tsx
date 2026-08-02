import { Center, Grid, Group, Text, UnstyledButton, useMantineTheme } from '@mantine/core';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SWRResponse } from 'swr';

import MatchModal from '@components/modals/match_modal';
import { assert_not_none } from '@components/utils/assert';
import { Time } from '@components/utils/datetime';
import {
  formatMatchInput1,
  formatMatchInput2,
  getMatchResultDisplay,
  getMatchWinner,
  isMatchHappening,
} from '@components/utils/match';
import { TournamentMinimal } from '@components/utils/tournament';
import { MatchWithDetails, RoundWithMatches, StagesWithStageItemsResponse } from '@openapi';
import { getMatchLookup, getStageItemLookup } from '@services/lookups';
import classes from './match.module.css';

export const MatchBadge = React.memo(function MatchBadge({
  match,
  theme,
}: {
  match: MatchWithDetails;
  theme: any;
}) {
  const visibility = match.court ? 'visible' : 'hidden';
  return (
    <Center style={{ transform: 'translateY(0%)', visibility }}>
      <div
        style={{
          width: '75%',
          backgroundColor: isMatchHappening(match) ? theme.colors.grape[9] : theme.colors.blue[7],
          borderRadius: '8px 8px 0px 0px',
          padding: '4px 12px 4px 12px',
        }}
      >
        <Center>
          <b>
            {match.court?.name} |{' '}
            {match.start_time != null ? <Time datetime={match.start_time} /> : null}
          </b>
        </Center>
      </div>
    </Center>
  );
});

function Match({
  swrStagesResponse,
  swrUpcomingMatchesResponse,
  tournamentData,
  match,
  readOnly,
  round,
  showCourtAndTime = true,
  highlightWinner = true,
  winnerOverride,
  roundTop = true,
  roundBottom = true,
  noMarginTop = false,
}: {
  swrStagesResponse: SWRResponse<StagesWithStageItemsResponse>;
  swrUpcomingMatchesResponse: SWRResponse | null;
  tournamentData: TournamentMinimal;
  match: MatchWithDetails;
  readOnly: boolean;
  round: RoundWithMatches;
  showCourtAndTime?: boolean;
  highlightWinner?: boolean;
  // Overrides the single-match winner shown/highlighted — used for a two-legged tie's legs,
  // where the relevant winner is the aggregate one, not either leg's own score.
  winnerOverride?: 1 | 2 | null;
  // Used to stack a two-legged tie's legs into a single visual card: the leg touching the
  // other leg gets a flat seam instead of its own rounded corner and top margin.
  roundTop?: boolean;
  roundBottom?: boolean;
  noMarginTop?: boolean;
}) {
  const { t } = useTranslation();
  const theme = useMantineTheme();
  const winner_style = {
    backgroundColor: theme.colors.green[9],
  };

  const stageItemsLookup = getStageItemLookup(swrStagesResponse);
  const matchesLookup = getMatchLookup(swrStagesResponse);

  const winner = winnerOverride !== undefined ? winnerOverride : getMatchWinner(match);
  const team1_style = highlightWinner && winner === 1 ? winner_style : {};
  const team2_style = highlightWinner && winner === 2 ? winner_style : {};

  const team1_label = formatMatchInput1(t, stageItemsLookup, matchesLookup, match);
  const team2_label = formatMatchInput2(t, stageItemsLookup, matchesLookup, match);

  const [opened, setOpened] = useState(false);

  const result = getMatchResultDisplay(match);

  const bracket = (
    <>
      {showCourtAndTime && <MatchBadge match={match} theme={theme} />}
      {result.prefix != null && (
        <Center>
          <Text size="xs" c="dimmed" fw={700}>
            {t(result.prefix)}
          </Text>
        </Center>
      )}
      <div
        className={classes.top}
        style={{
          ...team1_style,
          ...(roundTop ? {} : { borderTopLeftRadius: 0, borderTopRightRadius: 0 }),
        }}
      >
        <Grid grow>
          <Grid.Col span={10}>{team1_label}</Grid.Col>
          <Grid.Col span={2}>
            <Group gap={4} wrap="nowrap" justify="flex-end">
              <Text component="span">{result.headline[0]}</Text>
              <Group gap={4} wrap="nowrap" justify="flex-end" style={{ minWidth: '1rem' }}>
                {result.checkpoints.map((checkpoint, index) => (
                  <Text component="span" size="sm" c="dimmed" key={index}>
                    ({checkpoint[0]})
                  </Text>
                ))}
              </Group>
            </Group>
          </Grid.Col>
        </Grid>
      </div>
      <div
        className={classes.bottom}
        style={{
          ...team2_style,
          ...(roundBottom ? {} : { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }),
        }}
      >
        <Grid grow>
          <Grid.Col span={10}>{team2_label}</Grid.Col>
          <Grid.Col span={2}>
            <Group gap={4} wrap="nowrap" justify="flex-end">
              <Text component="span">{result.headline[1]}</Text>
              <Group gap={4} wrap="nowrap" justify="flex-end" style={{ minWidth: '1rem' }}>
                {result.checkpoints.map((checkpoint, index) => (
                  <Text component="span" size="sm" c="dimmed" key={index}>
                    ({checkpoint[1]})
                  </Text>
                ))}
              </Group>
            </Group>
          </Grid.Col>
        </Grid>
      </div>
    </>
  );

  const rootStyle = noMarginTop ? { marginTop: 0 } : undefined;

  if (readOnly) {
    return (
      <div className={classes.root} style={rootStyle}>
        {bracket}
      </div>
    );
  }

  return (
    <>
      <UnstyledButton className={classes.root} style={rootStyle} onClick={() => setOpened(!opened)}>
        {bracket}
      </UnstyledButton>
      <MatchModal
        swrStagesResponse={assert_not_none(swrStagesResponse)}
        swrUpcomingMatchesResponse={swrUpcomingMatchesResponse}
        tournamentData={tournamentData}
        match={match}
        opened={opened}
        setOpened={setOpened}
        round={round}
      />
    </>
  );
}

export default React.memo(Match);
