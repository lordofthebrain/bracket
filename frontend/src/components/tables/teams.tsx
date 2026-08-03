import { Alert, Badge, Button, Center, Group, Image, Modal, Pagination, Table } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SWRResponse } from 'swr';

import DeleteButton from '@components/buttons/delete';
import TeamUpdateModal from '@components/modals/team_update_modal';
import { NoContent } from '@components/no_content/empty_table_info';
import { getCountryDisplayName } from '@components/select/country_select';
import { DateTime } from '@components/utils/datetime';
import RequestErrorAlert from '@components/utils/error_alert';
import { TableSkeletonSingleColumn } from '@components/utils/skeletons';
import { TournamentMinimal } from '@components/utils/tournament';
import { FullTeamWithPlayers, TeamsWithPlayersResponse } from '@openapi';
import { getBaseApiUrl } from '@services/adapter';
import { deleteTeam } from '@services/team';
import TableLayout, { TableState, ThNotSortable, ThSortable, sortTableEntries } from './table';

function TeamLogo({ logoPath }: { logoPath: string | null }) {
  if (logoPath == null) return null;
  return (
    <Image
      src={`${getBaseApiUrl()}/static/team-logos/${logoPath}`}
      alt=""
      style={{ width: 30, height: 30, objectFit: 'contain', flexShrink: 0 }}
    />
  );
}

function TeamRow({
  tournamentData,
  team,
  swrTeamsResponse,
}: {
  tournamentData: TournamentMinimal;
  team: FullTeamWithPlayers;
  swrTeamsResponse: SWRResponse<TeamsWithPlayersResponse>;
}) {
  const { t, i18n } = useTranslation();
  const [deleteConfirmOpened, setDeleteConfirmOpened] = useState(false);
  const locale = i18n.language?.startsWith('de') ? 'de' : 'en';

  return (
    <Table.Tr>
      <Table.Td>
        {team.active ? (
          <Badge color="green">{t('active')}</Badge>
        ) : (
          <Badge color="red">{t('inactive')}</Badge>
        )}
      </Table.Td>
      <Table.Td>
        <Group gap="xs" wrap="nowrap">
          <TeamLogo logoPath={team.logo_path} />
          {team.name}
        </Group>
      </Table.Td>
      <Table.Td>{team.country != null ? getCountryDisplayName(team.country, locale) : '-'}</Table.Td>
      <Table.Td>
        <DateTime datetime={team.created} />
      </Table.Td>
      <Table.Td>
        <TeamUpdateModal
          tournament_id={tournamentData.id}
          team={team}
          swrTeamsResponse={swrTeamsResponse}
        />
        <DeleteButton onClick={() => setDeleteConfirmOpened(true)} title={t('delete_team_button')} />
        <Modal
          opened={deleteConfirmOpened}
          onClose={() => setDeleteConfirmOpened(false)}
          title={t('delete_modal_title', { type: t('team_title') })}
        >
          <Alert icon={<IconAlertCircle size={16} />} color="red" radius="lg">
            {t('delete_modal_description', { name: team.name })}
          </Alert>
          <Group justify="flex-end" mt="lg">
            <Button variant="default" onClick={() => setDeleteConfirmOpened(false)}>
              {t('cancel_button')}
            </Button>
            <Button
              color="red"
              onClick={async () => {
                await deleteTeam(tournamentData.id, team.id);
                await swrTeamsResponse.mutate();
                setDeleteConfirmOpened(false);
              }}
            >
              {t('delete_button')}
            </Button>
          </Group>
        </Modal>
      </Table.Td>
    </Table.Tr>
  );
}

export default function TeamsTable({
  tournamentData,
  swrTeamsResponse,
  teams,
  tableState,
  teamCount,
}: {
  tournamentData: TournamentMinimal;
  swrTeamsResponse: SWRResponse<TeamsWithPlayersResponse>;
  teams: FullTeamWithPlayers[];
  tableState: TableState;
  teamCount: number;
}) {
  const { t } = useTranslation();
  if (swrTeamsResponse.error) return <RequestErrorAlert error={swrTeamsResponse.error} />;

  if (swrTeamsResponse.isLoading) {
    return <TableSkeletonSingleColumn />;
  }

  const rows = teams
    .sort((p1: FullTeamWithPlayers, p2: FullTeamWithPlayers) =>
      sortTableEntries(p1, p2, tableState)
    )
    .map((team) => (
      <TeamRow
        key={team.id}
        tournamentData={tournamentData}
        team={team}
        swrTeamsResponse={swrTeamsResponse}
      />
    ));

  if (rows.length < 1) return <NoContent title={t('no_teams_title')} />;

  return (
    <>
      <TableLayout miw={850}>
        <Table.Thead>
          <Table.Tr>
            <ThSortable state={tableState} field="active">
              {t('status')}
            </ThSortable>
            <ThSortable state={tableState} field="name">
              {t('name_table_header')}
            </ThSortable>
            <ThNotSortable>{t('team_country_input_label')}</ThNotSortable>
            <ThSortable state={tableState} field="created">
              {t('created')}
            </ThSortable>
            <ThNotSortable>{null}</ThNotSortable>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>{rows}</Table.Tbody>
      </TableLayout>

      <Center mt="1rem">
        <Pagination
          value={tableState.page}
          onChange={tableState.setPage}
          total={1 + teamCount / tableState.pageSize}
          size="lg"
        />
      </Center>
    </>
  );
}
