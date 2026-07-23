import { Alert, Button, Group, Modal, Table } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SWRResponse } from 'swr';

import DeleteButton from '@components/buttons/delete';
import ClubModal from '@components/modals/club_modal';
import { EmptyTableInfo } from '@components/no_content/empty_table_info';
import RequestErrorAlert from '@components/utils/error_alert';
import { TableSkeletonSingleColumn } from '@components/utils/skeletons';
import { Club, ClubsResponse } from '@openapi';
import { deleteClub } from '@services/club';
import TableLayout, { ThNotSortable, ThSortable, getTableState, sortTableEntries } from './table';

export default function ClubsTable({
  swrClubsResponse,
}: {
  swrClubsResponse: SWRResponse<ClubsResponse>;
}) {
  const clubs: Club[] = swrClubsResponse.data != null ? swrClubsResponse.data.data : [];
  const tableState = getTableState('name');
  const { t } = useTranslation();
  const [clubPendingDeletion, setClubPendingDeletion] = useState<Club | null>(null);

  if (swrClubsResponse.error) return <RequestErrorAlert error={swrClubsResponse.error} />;
  if (swrClubsResponse.isLoading) {
    return <TableSkeletonSingleColumn />;
  }

  const rows = clubs
    .sort((p1: Club, p2: Club) => sortTableEntries(p1, p2, tableState))
    .map((club) => (
      <Table.Tr key={club.id}>
        <Table.Td>{club.name}</Table.Td>
        <Table.Td>
          <ClubModal swrClubsResponse={swrClubsResponse} club={club} />
          <DeleteButton
            onClick={() => setClubPendingDeletion(club)}
            title={t('delete_club_button')}
          />
        </Table.Td>
      </Table.Tr>
    ));

  if (rows.length < 1) return <EmptyTableInfo entity_name={t('clubs_title')} />;

  return (
    <>
      <Modal
        opened={clubPendingDeletion != null}
        onClose={() => setClubPendingDeletion(null)}
        title={t('delete_club_modal_title')}
      >
        <Alert icon={<IconAlertCircle size={16} />} color="red" radius="lg">
          {t('delete_club_modal_description', { name: clubPendingDeletion?.name })}
        </Alert>
        <Group justify="flex-end" mt="lg">
          <Button variant="default" onClick={() => setClubPendingDeletion(null)}>
            {t('cancel_button')}
          </Button>
          <Button
            color="red"
            onClick={async () => {
              if (clubPendingDeletion != null) {
                await deleteClub(clubPendingDeletion.id);
                await swrClubsResponse.mutate();
              }
              setClubPendingDeletion(null);
            }}
          >
            {t('delete_button')}
          </Button>
        </Group>
      </Modal>

      <TableLayout>
        <Table.Thead>
          <Table.Tr>
            <ThSortable state={tableState} field="name">
              {t('title')}
            </ThSortable>
            <ThNotSortable>{null}</ThNotSortable>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>{rows}</Table.Tbody>
      </TableLayout>
    </>
  );
}
