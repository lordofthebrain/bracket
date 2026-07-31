import { Grid, Title } from '@mantine/core';
import { useTranslation } from 'react-i18next';

import TeamCreateModal from '@components/modals/team_create_modal';
import { getTableState, tableStateToPagination } from '@components/tables/table';
import TeamsTable from '@components/tables/teams';
import { capitalize, getTournamentIdFromRouter } from '@components/utils/util';
import { FullTeamWithPlayers } from '@openapi';
import TournamentLayout from '@pages/tournaments/_tournament_layout';
import { getTeamsPaginated } from '@services/adapter';

export default function TeamsPage() {
  const tableState = getTableState('name');
  const { t } = useTranslation();
  const { tournamentData } = getTournamentIdFromRouter();
  const swrTeamsResponse = getTeamsPaginated(tournamentData.id, tableStateToPagination(tableState));

  const teams: FullTeamWithPlayers[] =
    swrTeamsResponse.data != null ? swrTeamsResponse.data.data.teams : [];
  const teamCount = swrTeamsResponse.data != null ? swrTeamsResponse.data.data.count : 1;

  return (
    <TournamentLayout tournament_id={tournamentData.id}>
      <Grid justify="space-between" mb="1rem">
        <Grid.Col span="auto">
          <Title>{capitalize(t('teams_title'))}</Title>
        </Grid.Col>
        <Grid.Col span="content">
          <TeamCreateModal swrTeamsResponse={swrTeamsResponse} tournament_id={tournamentData.id} />
        </Grid.Col>
      </Grid>
      <TeamsTable
        swrTeamsResponse={swrTeamsResponse}
        tournamentData={tournamentData}
        teams={teams}
        tableState={tableState}
        teamCount={teamCount}
      />
    </TournamentLayout>
  );
}
