import {
  Accordion,
  ActionIcon,
  Badge,
  Button,
  Center,
  Checkbox,
  ColorSwatch,
  Container,
  Group,
  Modal,
  NumberInput,
  Select,
  Text,
  TextInput,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { BiEditAlt } from '@react-icons/all-files/bi/BiEditAlt';
import { MdCheck } from '@react-icons/all-files/md/MdCheck';
import { MdDelete } from '@react-icons/all-files/md/MdDelete';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SWRResponse } from 'swr';

import DeleteButton from '@components/buttons/delete';
import { EmptyTableInfo } from '@components/no_content/empty_table_info';
import { getZoneColorCssVar } from '@components/tables/standings';
import RequestErrorAlert from '@components/utils/error_alert';
import { TableSkeletonSingleColumn } from '@components/utils/skeletons';
import { Translator } from '@components/utils/types';
import { getTournamentIdFromRouter } from '@components/utils/util';
import { Ranking, RankingsResponse, RankingZone, Tournament } from '@openapi';
import TournamentLayout from '@pages/tournaments/_tournament_layout';
import { getRankings, getTournamentById } from '@services/adapter';
import { createRanking, deleteRanking, editRanking } from '@services/ranking';

const STANDINGS_ZONE_COLOR_OPTIONS = [
  'green',
  'blue',
  'yellow',
  'orange',
  'red',
  'grape',
  'gray',
];

function ColorSelect({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  return (
    <Select
      data={STANDINGS_ZONE_COLOR_OPTIONS.map((color) => ({ value: color, label: '' }))}
      value={value}
      onChange={(color) => color != null && onChange(color)}
      allowDeselect={false}
      w="5rem"
      leftSection={<ColorSwatch color={getZoneColorCssVar(value)} size={16} />}
      renderOption={({ option, checked }) => (
        <Group gap="xs" wrap="nowrap">
          <ColorSwatch color={getZoneColorCssVar(option.value)} size={16} />
          {checked && <MdCheck size={14} style={{ marginLeft: 'auto' }} />}
        </Group>
      )}
    />
  );
}

function StandingsZonesEditor({ t, form }: { t: Translator; form: any }) {
  const zones: RankingZone[] = form.values.standings_zones ?? [];

  return (
    <>
      <Text fw={500} mt="lg">
        {t('standings_zones_title')}
      </Text>
      {zones.map((_zone: RankingZone, index: number) => (
        // eslint-disable-next-line react/no-array-index-key
        <Group key={index} mt="sm" align="flex-end" wrap="wrap">
          <TextInput
            label={t('standings_zone_label_input_label')}
            placeholder={t('standings_zone_label_input_placeholder')}
            {...form.getInputProps(`standings_zones.${index}.label`)}
          />
          <div>
            <Text size="sm" fw={500} mb={4}>
              {t('standings_zone_color_input_label')}
            </Text>
            <ColorSelect
              value={zones[index].color}
              onChange={(color) => form.setFieldValue(`standings_zones.${index}.color`, color)}
            />
          </div>
          <Select
            label={t('standings_zone_direction_input_label')}
            data={[
              { value: 'top', label: t('standings_zone_direction_top_option') },
              { value: 'bottom', label: t('standings_zone_direction_bottom_option') },
            ]}
            allowDeselect={false}
            w="10rem"
            {...form.getInputProps(`standings_zones.${index}.direction`)}
          />
          <NumberInput
            label={t('standings_zone_count_input_label')}
            min={1}
            w="8rem"
            {...form.getInputProps(`standings_zones.${index}.count`)}
          />
          <ActionIcon
            color="red"
            size="lg"
            onClick={() => form.removeListItem('standings_zones', index)}
            aria-label={t('remove_standings_zone_button')}
          >
            <MdDelete size={20} />
          </ActionIcon>
        </Group>
      ))}
      <Button
        mt="sm"
        variant="outline"
        onClick={() =>
          form.insertListItem('standings_zones', {
            label: '',
            color: 'green',
            direction: 'top',
            count: 1,
          })
        }
      >
        {t('add_standings_zone_button')}
      </Button>
    </>
  );
}

function getRankingDisplayName(t: Translator, ranking: Ranking): string {
  return ranking.name.length > 0 ? ranking.name : `${t('ranking_title')} ${ranking.position + 1}`;
}

function RankingNameModal({
  t,
  tournament,
  ranking,
  swrRankingsResponse,
}: {
  t: Translator;
  tournament: Tournament;
  ranking: Ranking;
  swrRankingsResponse: SWRResponse<RankingsResponse>;
}) {
  const [opened, setOpened] = useState(false);
  const form = useForm({
    initialValues: { name: getRankingDisplayName(t, ranking) },
    validate: {},
  });

  return (
    <>
      <Modal
        opened={opened}
        onClose={() => setOpened(false)}
        title={t('edit_ranking_name_title')}
      >
        <form
          onSubmit={(event) => {
            // Stop this submit from bubbling up to the outer ranking form: Mantine's
            // Modal renders via a React portal, so a native submit event here still
            // propagates to ancestor form handlers in the React tree even though it's
            // not a DOM descendant, which would immediately re-save the old name.
            event.stopPropagation();
            form.onSubmit(async (values) => {
              await editRanking(
                tournament.id,
                ranking.id,
                values.name,
                ranking.win_points,
                ranking.draw_points,
                ranking.loss_points,
                ranking.add_score_points,
                ranking.position,
                ranking.standings_zones
              );
              await swrRankingsResponse.mutate();
              setOpened(false);
            })(event);
          }}
        >
          <TextInput
            withAsterisk
            label={t('ranking_name_input_label')}
            placeholder={t('ranking_name_input_placeholder')}
            {...form.getInputProps('name')}
          />
          <Button fullWidth mt="md" color="green" type="submit">
            {t('save_button')}
          </Button>
        </form>
      </Modal>
      <ActionIcon
        variant="subtle"
        ml="xs"
        onClick={() => setOpened(true)}
        aria-label={t('edit_ranking_name_title')}
      >
        <BiEditAlt size={18} />
      </ActionIcon>
    </>
  );
}

function RankingDeleteButton({
  t,
  tournament,
  ranking,
  swrRankingsResponse,
}: {
  t: Translator;
  tournament: Tournament;
  ranking: Ranking;
  swrRankingsResponse: SWRResponse<RankingsResponse>;
}) {
  if (ranking.position === 0) {
    return (
      <Center ml="1rem" miw="10rem">
        <Badge color="indigo">{t('default_ranking_badge')}</Badge>
      </Center>
    );
  }
  return (
    <DeleteButton
      onClick={async () => {
        await deleteRanking(tournament.id, ranking.id);
        await swrRankingsResponse.mutate();
      }}
      title={t('delete_ranking_button')}
      ml="1rem"
      variant="outline"
      miw="10rem"
    />
  );
}

function EditRankingForm({
  t,
  tournament,
  ranking,
  swrRankingsResponse,
}: {
  t: Translator;
  tournament: Tournament;
  ranking: Ranking;
  swrRankingsResponse: SWRResponse<RankingsResponse>;
}) {
  const form = useForm({
    initialValues: {
      win_points: ranking.win_points,
      draw_points: ranking.draw_points,
      loss_points: ranking.loss_points,
      add_score_points: ranking.add_score_points,
      position: ranking.position,
      standings_zones: ranking.standings_zones,
    },
    validate: {},
  });
  const rankingTitle = getRankingDisplayName(t, ranking);

  return (
    <form
      onSubmit={form.onSubmit(async (values) => {
        await editRanking(
          tournament.id,
          ranking.id,
          ranking.name,
          values.win_points,
          values.draw_points,
          values.loss_points,
          values.add_score_points,
          values.position,
          values.standings_zones
        );
        await swrRankingsResponse.mutate();
      })}
    >
      <Accordion.Item key={ranking.id} value={`${ranking.position}`}>
        <Center>
          <Accordion.Control>{rankingTitle}</Accordion.Control>
          <RankingNameModal
            t={t}
            tournament={tournament}
            ranking={ranking}
            swrRankingsResponse={swrRankingsResponse}
          />
          <Center>
            <RankingDeleteButton
              t={t}
              tournament={tournament}
              ranking={ranking}
              swrRankingsResponse={swrRankingsResponse}
            />
          </Center>
        </Center>
        <Accordion.Panel>
          <NumberInput
            withAsterisk
            label={t('win_points_input_label')}
            {...form.getInputProps('win_points')}
          />
          <NumberInput
            mt="1rem"
            withAsterisk
            label={t('draw_points_input_label')}
            {...form.getInputProps('draw_points')}
          />
          <NumberInput
            mt="1rem"
            withAsterisk
            label={t('loss_points_input_label')}
            {...form.getInputProps('loss_points')}
          />
          <Checkbox
            mt="lg"
            label={t('add_score_points_label')}
            {...form.getInputProps('add_score_points', { type: 'checkbox' })}
          />
          <StandingsZonesEditor t={t} form={form} />
          <Button fullWidth style={{ marginTop: 16 }} color="green" type="submit">
            {`${t('save_button')} ${rankingTitle}`}
          </Button>
        </Accordion.Panel>
      </Accordion.Item>
    </form>
  );
}

function RankingForm({
  t,
  tournament,
  swrRankingsResponse,
}: {
  t: Translator;
  tournament: Tournament;
  swrRankingsResponse: SWRResponse<RankingsResponse>;
}) {
  const rankings: Ranking[] = swrRankingsResponse.data != null ? swrRankingsResponse.data.data : [];

  const rows = rankings
    .sort((s1: Ranking, s2: Ranking) => s1.position - s2.position)
    .map((ranking) => (
      <EditRankingForm
        t={t}
        tournament={tournament}
        ranking={ranking}
        swrRankingsResponse={swrRankingsResponse}
      />
    ));

  if (swrRankingsResponse.isLoading) {
    return <TableSkeletonSingleColumn />;
  }

  if (swrRankingsResponse.error) return <RequestErrorAlert error={swrRankingsResponse.error} />;

  if (rows.length < 1) return <EmptyTableInfo entity_name={t('rankings_title')} />;

  return (
    <Accordion multiple defaultValue={['0']}>
      {rows}
    </Accordion>
  );
}

export default function RankingsPage() {
  const { tournamentData } = getTournamentIdFromRouter();
  const swrRankingsResponse = getRankings(tournamentData.id);

  const swrTournamentResponse = getTournamentById(tournamentData.id);
  const tournamentDataFull = swrTournamentResponse.data?.data;
  const { t } = useTranslation();

  // TODO: show loading icon.
  if (tournamentDataFull == null) {
    return null;
  }

  return (
    <TournamentLayout tournament_id={tournamentData.id}>
      <Container maw="50rem">
        <RankingForm
          t={t}
          tournament={tournamentDataFull}
          swrRankingsResponse={swrRankingsResponse}
        />
        <Button
          fullWidth
          mt="1rem"
          color="green"
          variant="outline"
          onClick={async () => {
            await createRanking(tournamentDataFull.id);
            await swrRankingsResponse.mutate();
          }}
        >
          {t('add_ranking_button')}
        </Button>
      </Container>
    </TournamentLayout>
  );
}
