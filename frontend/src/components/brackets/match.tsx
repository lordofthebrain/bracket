import { Center, Grid, Group, Text, UnstyledButton, useMantineTheme } from '@mantine/core';
import { useColorScheme } from '@mantine/hooks';
import { useState } from 'react';
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

export function MatchBadge({ match, theme }: { match: MatchWithDetails; theme: any }) {
  const visibility = match.court ? 'visible' : 'hidden';
  const badgeColor = useColorScheme() ? theme.colors.blue[7] : theme.colors.blue[7];
  return (
    <Center style={{ transform: 'translateY(0%)', visibility }}>
      <div
        style={{
          width: '75%',
          backgroundColor: isMatchHappening(match) ? theme.colors.grape[9] : badgeColor,
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
}

export default function Match({
  swrStagesResponse,
  swrUpcomingMatchesResponse,
  tournamentData,
  match,
  readOnly,
  round,
  showCourtAndTime = true,
  highlightWinner = true,
}: {
  swrStagesResponse: SWRResponse<StagesWithStageItemsResponse>;
  swrUpcomingMatchesResponse: SWRResponse | null;
  tournamentData: TournamentMinimal;
  match: MatchWithDetails;
  readOnly: boolean;
  round: RoundWithMatches;
  showCourtAndTime?: boolean;
  highlightWinner?: boolean;
}) {
  const { t } = useTranslation();
  const theme = useMantineTheme();
  const winner_style = {
    backgroundColor: theme.colors.green[9],
  };

  const stageItemsLookup = getStageItemLookup(swrStagesResponse);
  const matchesLookup = getMatchLookup(swrStagesResponse);

  const winner = getMatchWinner(match);
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
            {result.prefix}
          </Text>
        </Center>
      )}
      <div className={classes.top} style={team1_style}>
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
      <div className={classes.bottom} style={team2_style}>
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

  if (readOnly) {
    return <div className={classes.root}>{bracket}</div>;
  }

  return (
    <>
      <UnstyledButton className={classes.root} onClick={() => setOpened(!opened)}>
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
