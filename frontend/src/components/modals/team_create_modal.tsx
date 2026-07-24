import {
  Button,
  Center,
  Checkbox,
  Fieldset,
  Group,
  Image,
  Modal,
  MultiSelect,
  Tabs,
  Text,
  TextInput,
} from '@mantine/core';
import { Dropzone, MIME_TYPES } from '@mantine/dropzone';
import { useForm } from '@mantine/form';
import {
  IconCloudUpload,
  IconDownload,
  IconUser,
  IconUsers,
  IconUsersPlus,
  IconX,
} from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SWRResponse } from 'swr';

import SaveButton from '@components/buttons/save';
import { MultiTeamsInput } from '@components/forms/player_create_csv_input';
import { Player, TeamsWithPlayersResponse } from '@openapi';
import { getPlayers, uploadTeamLogo } from '@services/adapter';
import { createTeam, createTeams } from '@services/team';

function MultiTeamTab({
  tournament_id,
  swrTeamsResponse,
  setOpened,
}: {
  tournament_id: number;
  swrTeamsResponse: SWRResponse<TeamsWithPlayersResponse>;
  setOpened: any;
}) {
  const { t } = useTranslation();
  const form = useForm({
    initialValues: {
      names: '',
      active: true,
    },

    validate: {
      names: (value) => (value.length > 0 ? null : t('at_least_one_team_validation')),
    },
  });
  return (
    <form
      onSubmit={form.onSubmit(async (values) => {
        await createTeams(tournament_id, values.names, values.active);
        await swrTeamsResponse.mutate();
        setOpened(false);
      })}
    >
      <MultiTeamsInput form={form} />

      <Checkbox
        mt="md"
        label={t('active_teams_checkbox_label')}
        {...form.getInputProps('active', { type: 'checkbox' })}
      />
      <Button fullWidth style={{ marginTop: 10 }} color="green" type="submit">
        {t('save_button')}
      </Button>
    </form>
  );
}

function SingleTeamTab({
  tournament_id,
  swrTeamsResponse,
  setOpened,
}: {
  tournament_id: number;
  swrTeamsResponse: SWRResponse<TeamsWithPlayersResponse>;
  setOpened: any;
}) {
  const { t } = useTranslation();
  const { data } = getPlayers(tournament_id, false);
  const players: Player[] = data != null ? data.data.players : [];
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (logoFile == null) {
      setLogoPreviewUrl(null);
      return undefined;
    }
    const url = URL.createObjectURL(logoFile);
    setLogoPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [logoFile]);

  const form = useForm({
    initialValues: {
      name: '',
      active: true,
      player_ids: [],
    },
    validate: {
      name: (value) => (value.length > 0 ? null : t('too_short_name_validation')),
    },
  });
  return (
    <form
      onSubmit={form.onSubmit(async (values) => {
        const result = await createTeam(
          tournament_id,
          values.name,
          values.active,
          values.player_ids
        );
        if (result != null && logoFile != null) {
          const newTeamId = result.data.data.id;
          await uploadTeamLogo(tournament_id, newTeamId, logoFile);
        }
        await swrTeamsResponse.mutate();
        setOpened(false);
      })}
    >
      <TextInput
        withAsterisk
        label={t('name_input_label')}
        placeholder={t('team_name_input_placeholder')}
        {...form.getInputProps('name')}
      />

      <Checkbox
        mt="md"
        label={t('active_teams_checkbox_label')}
        {...form.getInputProps('active', { type: 'checkbox' })}
      />

      <MultiSelect
        data={players.map((p) => ({ value: `${p.id}`, label: p.name }))}
        label={t('team_member_select_title')}
        maxDropdownHeight={160}
        searchable
        mt={12}
        limit={25}
        {...form.getInputProps('player_ids')}
      />

      <Fieldset legend={t('logo_settings_title')} mt={12} radius="md">
        <Dropzone
          onDrop={(files) => setLogoFile(files[0])}
          radius="md"
          accept={[MIME_TYPES.png, MIME_TYPES.jpeg, MIME_TYPES.svg, MIME_TYPES.webp]}
          maxSize={1 * 1024 ** 2}
        >
          <div style={{ pointerEvents: 'none' }}>
            <Group justify="center">
              <Dropzone.Accept>
                <IconDownload size={40} stroke={1.5} />
              </Dropzone.Accept>
              <Dropzone.Reject>
                <IconX size={40} stroke={1.5} />
              </Dropzone.Reject>
              <Dropzone.Idle>
                <IconCloudUpload size={40} stroke={1.5} />
              </Dropzone.Idle>
            </Group>
            <Text ta="center" fw={700} size="md" mt="md">
              {t('dropzone_idle_text')}
            </Text>
            <Text ta="center" size="sm" mt="xs" c="dimmed">
              {t('upload_placeholder_team')}
            </Text>
          </div>
        </Dropzone>
        {logoPreviewUrl != null && (
          <Center my="lg">
            <div style={{ width: '50%' }}>
              <Image radius="md" alt="Logo preview" src={logoPreviewUrl} />
            </div>
          </Center>
        )}
      </Fieldset>

      <Button fullWidth style={{ marginTop: 10 }} color="green" type="submit">
        {t('save_button')}
      </Button>
    </form>
  );
}

export default function TeamCreateModal({
  tournament_id,
  swrTeamsResponse,
}: {
  tournament_id: number;
  swrTeamsResponse: SWRResponse<TeamsWithPlayersResponse>;
}) {
  const { t } = useTranslation();
  const [opened, setOpened] = useState(false);
  return (
    <>
      <Modal opened={opened} onClose={() => setOpened(false)} title="Create Team">
        <Tabs defaultValue="single">
          <Tabs.List justify="center" grow>
            <Tabs.Tab value="single" leftSection={<IconUser size="0.8rem" />}>
              {t('single_team')}
            </Tabs.Tab>
            <Tabs.Tab value="multi" leftSection={<IconUsers size="0.8rem" />}>
              {t('multiple_teams')}
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="single" pt="xs">
            <SingleTeamTab
              swrTeamsResponse={swrTeamsResponse}
              tournament_id={tournament_id}
              setOpened={setOpened}
            />
          </Tabs.Panel>

          <Tabs.Panel value="multi" pt="xs">
            <MultiTeamTab
              swrTeamsResponse={swrTeamsResponse}
              tournament_id={tournament_id}
              setOpened={setOpened}
            />
          </Tabs.Panel>
        </Tabs>
      </Modal>

      <SaveButton
        onClick={() => setOpened(true)}
        leftSection={<IconUsersPlus size={24} />}
        title={t('add_team_button')}
        mb={0}
      />
    </>
  );
}
