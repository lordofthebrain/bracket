import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  CheckIcon,
  Combobox,
  Group,
  InputBase,
  Modal,
  Stack,
  Text,
  Tooltip,
  useCombobox,
  useMantineTheme,
} from '@mantine/core';
import { useColorScheme } from '@mantine/hooks';
import { AiFillWarning } from '@react-icons/all-files/ai/AiFillWarning';
import { BiCheck } from '@react-icons/all-files/bi/BiCheck';
import { IconAlertCircle, IconPencil, IconTrash } from '@tabler/icons-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BiSolidWrench } from 'react-icons/bi';
import { SWRResponse } from 'swr';

import CreateStageButton from '@components/buttons/create_stage';
import { CreateStageItemModal } from '@components/modals/create_stage_item';
import { UpdateStageModal } from '@components/modals/update_stage';
import { UpdateStageItemModal } from '@components/modals/update_stage_item';
import { assert_not_none } from '@components/utils/assert';
import RequestErrorAlert from '@components/utils/error_alert';
import PreloadLink from '@components/utils/link';
import {
  StageItemInput,
  StageItemInputChoice,
  StageItemInputOption,
  formatStageItemInputTentative,
} from '@components/utils/stage_item_input';
import {
  Ranking,
  StageItemInputOptionsResponse,
  StageItemWithRounds,
  StageRankingResponse,
  StageWithStageItems,
  StagesWithStageItemsResponse,
  Tournament,
} from '@openapi';
import { getStageItemLookup, getTeamsLookup } from '@services/lookups';
import { deleteStage } from '@services/stage';
import { deleteStageItem } from '@services/stage_item';
import { updateStageItemInput } from '@services/stage_item_input';

function StageItemInputComboBox({
  tournament,
  stageItemInput,
  current_key,
  availableInputs,
  teamIdsUsedInStageItem,
  swrAvailableInputsResponse,
  swrRankingsPerStageItemResponse,
  swrStagesResponse,
}: {
  tournament: Tournament;
  stageItemInput: StageItemInput;
  current_key: string | null;
  availableInputs: StageItemInputChoice[];
  teamIdsUsedInStageItem: Set<number>;
  swrAvailableInputsResponse: SWRResponse<StageItemInputOptionsResponse>;
  swrRankingsPerStageItemResponse: SWRResponse<StageRankingResponse>;
  swrStagesResponse: SWRResponse<StagesWithStageItemsResponse>;
}) {
  const { t } = useTranslation();
  const [selectedInput, setSelectedInput] = useState<StageItemInputChoice | null>(
    availableInputs.find((o) => o.value === current_key) || null
  );
  const [successIcon, setSuccessIcon] = useState<boolean>(false);
  const [search, setSearch] = useState('');
  const combobox = useCombobox({
    onDropdownClose: () => {
      combobox.resetSelectedOption();
      combobox.focusTarget();
      setSearch('');
    },

    onDropdownOpen: () => {
      combobox.focusSearchInput();
    },
  });

  const options = availableInputs
    // Teams may be reused across stage items but not twice within the same one (own slot's current team excepted); tentative "winner of X" placeholders keep the tournament-wide check.
    .filter((option: StageItemInputChoice) =>
      option.winner_from_stage_item_id != null
        ? !option.already_taken
        : option.team_id == null ||
          option.team_id === stageItemInput.team_id ||
          !teamIdsUsedInStageItem.has(option.team_id)
    )
    .filter((item) => (item.label || 'None').toLowerCase().includes(search.toLowerCase().trim()))
    .map((option: StageItemInputChoice, i: number) => (
      <Combobox.Option key={i} value={option.value}>
        <Group gap="xs" justify="space-between">
          {option.label || <i>None</i>}
          {option.value === selectedInput?.value && <CheckIcon size={12} />}
        </Group>
      </Combobox.Option>
    ));

  const theme = useMantineTheme();
  const dropdownBorderColor = useColorScheme() === 'dark' ? '#444' : '#ccc';

  return (
    <Combobox
      shadow="lg"
      store={combobox}
      onOptionSubmit={(val) => {
        const option = availableInputs.find((o) => o.value === val) || null;
        setSelectedInput(option);
        updateStageItemInput(
          tournament.id,
          stageItemInput.stage_item_id,
          stageItemInput.id,
          option?.team_id || null,
          option?.winner_position || null,
          option?.winner_from_stage_item_id || null
        ).then(() => {
          swrAvailableInputsResponse.mutate();
          swrStagesResponse.mutate();
          swrRankingsPerStageItemResponse.mutate();

          setSuccessIcon(true);

          setTimeout(() => {
            setSuccessIcon(false);
          }, 1500);
        });
        combobox.closeDropdown();
      }}
    >
      <Combobox.Target>
        <InputBase
          radius="0.5rem"
          component="button"
          type="button"
          rightSection={successIcon ? <BiCheck size={18} color={theme.colors.green[4]} /> : null}
          pointer
          rightSectionPointerEvents="none"
          onClick={() => combobox.toggleDropdown()}
        >
          {selectedInput?.label ? (
            selectedInput?.label
          ) : (
            <Group gap="xs">
              <AiFillWarning size={18} color={theme.colors.orange[4]} />
              <b>{selectedInput?.label || t('empty_slot').toUpperCase()}</b>
            </Group>
          )}
        </InputBase>
      </Combobox.Target>

      <Combobox.Dropdown style={{ border: `solid 0.1rem ${dropdownBorderColor}` }}>
        <Combobox.Search
          value={search}
          onChange={(event) => setSearch(event.currentTarget.value)}
          placeholder={t('search_placeholder')}
        />
        <Combobox.Options>{options}</Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>
  );
}

function computeAvailableInputs(
  data: StageItemInputOptionsResponse,
  teamsMap: any,
  stageItemMap: any
) {
  const getComboBoxOptionForStageItemInput = (option: StageItemInputOption) => {
    if ('winner_from_stage_item_id' in option) {
      option.winner_position = assert_not_none(option.winner_position);
      const stageItem = stageItemMap[option.winner_from_stage_item_id];

      if (stageItem == null) return null;
      return {
        value: `${option.winner_from_stage_item_id}_${option.winner_position}`,
        label: `${formatStageItemInputTentative(option, stageItemMap)}`,
        team_id: null,
        winner_from_stage_item_id: option.winner_from_stage_item_id,
        winner_position: option.winner_position,
        already_taken: option.already_taken,
      };
    }

    const team = teamsMap[option.team_id];
    if (team == null) return null;
    return {
      value: `${assert_not_none(option.team_id)}`,
      label: team.name,
      team_id: team.id,
      winner_from_stage_item_id: null,
      winner_position: null,
      already_taken: option.already_taken,
    };
  };
  return Object.keys(data.data).reduce((result: any, stage_id: string) => {
    const option = assert_not_none(data.data[stage_id]);
    result[stage_id] = option
      .map((opt: StageItemInputOption) => getComboBoxOptionForStageItemInput(opt))
      .filter((o: StageItemInputOption | null) => o != null);
    return result;
  }, {});
}

// Keyed by the SWR response's `data` reference so every StageColumn (one per
// stage) shares a single computed pass instead of each one recomputing every
// other stage's options too (O(stages^2) before this cache existed).
const availableInputsCache = new WeakMap<object, any>();
export function getAvailableInputs(
  swrAvailableInputsResponse: SWRResponse<StageItemInputOptionsResponse>,
  teamsMap: any,
  stageItemMap: any
) {
  const data = swrAvailableInputsResponse.data;
  if (data == null) return {};

  const cached = availableInputsCache.get(data);
  if (cached !== undefined) return cached;

  const result = computeAvailableInputs(data, teamsMap, stageItemMap);
  availableInputsCache.set(data, result);
  return result;
}

function StageItemInputSection({
  tournament,
  stageItemInput,
  currentOptionValue,
  lastInList,
  availableInputs,
  teamIdsUsedInStageItem,
  swrAvailableInputsResponse,
  swrStagesResponse,
  swrRankingsPerStageItemResponse,
}: {
  tournament: Tournament;
  stageItemInput: StageItemInput;
  currentOptionValue: string | null;
  lastInList: boolean;
  availableInputs: StageItemInputChoice[];
  teamIdsUsedInStageItem: Set<number>;
  swrAvailableInputsResponse: SWRResponse<StageItemInputOptionsResponse>;
  swrStagesResponse: SWRResponse<StagesWithStageItemsResponse>;
  swrRankingsPerStageItemResponse: SWRResponse<StageRankingResponse>;
}) {
  const opts = lastInList ? { pt: 'xs', mb: '-0.5rem' } : { py: 'xs', withBorder: true };

  return (
    <Card.Section inheritPadding {...opts}>
      <StageItemInputComboBox
        tournament={tournament}
        stageItemInput={stageItemInput}
        current_key={currentOptionValue}
        availableInputs={availableInputs}
        teamIdsUsedInStageItem={teamIdsUsedInStageItem}
        swrAvailableInputsResponse={swrAvailableInputsResponse}
        swrRankingsPerStageItemResponse={swrRankingsPerStageItemResponse}
        swrStagesResponse={swrStagesResponse}
      />
    </Card.Section>
  );
}

function StageItemRow({
  tournament,
  stageItem,
  swrStagesResponse,
  availableInputs,
  rankings,
  swrAvailableInputsResponse,
  swrRankingsPerStageItemResponse,
}: {
  tournament: Tournament;
  stageItem: StageItemWithRounds;
  swrStagesResponse: SWRResponse<StagesWithStageItemsResponse>;
  availableInputs: StageItemInputChoice[];
  rankings: Ranking[];
  swrAvailableInputsResponse: SWRResponse<StageItemInputOptionsResponse>;
  swrRankingsPerStageItemResponse: SWRResponse<StageRankingResponse>;
}) {
  const { t } = useTranslation();
  const [opened, setOpened] = useState(false);
  const [deleteConfirmOpened, setDeleteConfirmOpened] = useState(false);

  const teamIdsUsedInStageItem = new Set(
    stageItem.inputs.filter((input) => input.team_id != null).map((input) => input.team_id as number)
  );

  const inputs = stageItem.inputs
    .sort((i1, i2) => (i1.slot > i2.slot ? 1 : -1))
    .map((input, i) => {
      let currentOptionValue = null;
      if (input.winner_from_stage_item_id != null) {
        currentOptionValue = `${input.winner_from_stage_item_id}_${input.winner_position}`;
      } else if (input.team_id != null) {
        currentOptionValue = `${input.team_id}`;
      }

      return (
        <StageItemInputSection
          key={i}
          tournament={tournament}
          stageItemInput={input}
          currentOptionValue={currentOptionValue}
          availableInputs={availableInputs}
          teamIdsUsedInStageItem={teamIdsUsedInStageItem}
          lastInList={i === stageItem.inputs.length - 1}
          swrAvailableInputsResponse={swrAvailableInputsResponse}
          swrStagesResponse={swrStagesResponse}
          swrRankingsPerStageItemResponse={swrRankingsPerStageItemResponse}
        />
      );
    });

  return (
    <Card withBorder shadow="sm" radius="md">
      <Card.Section withBorder inheritPadding py="xs" color="dimmed">
        <Group justify="space-between">
          <Text fw={800}>{stageItem.name}</Text>
          <UpdateStageItemModal
            swrStagesResponse={swrStagesResponse}
            stageItem={stageItem}
            tournament={tournament}
            opened={opened}
            setOpened={setOpened}
            rankings={rankings}
          />
          <Group gap="0rem">
            {stageItem.type === 'SWISS' || stageItem.type === 'ROUND_ROBIN' ? (
              <Tooltip label={t('manage_rounds_button')}>
                <ActionIcon
                  variant="transparent"
                  color="gray"
                  component={PreloadLink}
                  href={`/tournaments/${tournament.id}/stages/swiss/${stageItem.id}`}
                >
                  <BiSolidWrench size="1.25rem" />
                </ActionIcon>
              </Tooltip>
            ) : null}
            {stageItem.type === 'SINGLE_ELIMINATION' ? (
              <Tooltip label={t('manage_rounds_button')}>
                <ActionIcon
                  variant="transparent"
                  color="gray"
                  component={PreloadLink}
                  href={`/tournaments/${tournament.id}/stages/elimination/${stageItem.id}`}
                >
                  <BiSolidWrench size="1.25rem" />
                </ActionIcon>
              </Tooltip>
            ) : null}
            <Tooltip label={t('edit_stage_item_label')}>
              <ActionIcon
                variant="transparent"
                color="gray"
                onClick={() => {
                  setOpened(true);
                }}
              >
                <IconPencil size="1.25rem" />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={t('delete_button')}>
              <ActionIcon
                variant="transparent"
                color="red.6"
                onClick={() => setDeleteConfirmOpened(true)}
              >
                <IconTrash size="1.25rem" />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>
      </Card.Section>
      {inputs}
      <Modal
        opened={deleteConfirmOpened}
        onClose={() => setDeleteConfirmOpened(false)}
        title={t('delete_modal_title', { type: t('stage_item_title') })}
      >
        <Alert icon={<IconAlertCircle size={16} />} color="red" radius="lg">
          {t('delete_modal_description', { name: stageItem.name })}
        </Alert>
        <Group justify="flex-end" mt="lg">
          <Button variant="default" onClick={() => setDeleteConfirmOpened(false)}>
            {t('cancel_button')}
          </Button>
          <Button
            color="red"
            onClick={async () => {
              await deleteStageItem(tournament.id, stageItem.id);
              await swrStagesResponse.mutate();
              await swrAvailableInputsResponse.mutate();
              setDeleteConfirmOpened(false);
            }}
          >
            {t('delete_button')}
          </Button>
        </Group>
      </Modal>
    </Card>
  );
}

function StageColumn({
  tournament,
  stage,
  swrStagesResponse,
  swrAvailableInputsResponse,
  swrRankingsPerStageItemResponse,
  rankings,
}: {
  tournament: Tournament;
  stage: StageWithStageItems;
  swrStagesResponse: SWRResponse<StagesWithStageItemsResponse>;
  swrAvailableInputsResponse: SWRResponse<StageItemInputOptionsResponse>;
  swrRankingsPerStageItemResponse: SWRResponse<StageRankingResponse>;
  rankings: Ranking[];
}) {
  const { t } = useTranslation();
  const [opened, setOpened] = useState(false);
  const [deleteConfirmOpened, setDeleteConfirmOpened] = useState(false);
  const teamsMap = getTeamsLookup(tournament != null ? tournament.id : -1);
  const stageItemsLookup = getStageItemLookup(swrStagesResponse);

  if (teamsMap == null) {
    return null;
  }

  const availableInputs =
    getAvailableInputs(swrAvailableInputsResponse, teamsMap, stageItemsLookup)[stage.id] || [];
  availableInputs.push({
    value: 'null',
    label: null,
    team_id: null,
    winner_from_stage_item_id: null,
    winner_position: null,
    already_taken: false,
  });

  const rows = stage.stage_items
    .sort((i1: StageItemWithRounds, i2: StageItemWithRounds) => (i1.id > i2.id ? 1 : -1))
    .sort((i1: StageItemWithRounds, i2: StageItemWithRounds) => (i1.name > i2.name ? 1 : -1))
    .map((stageItem: StageItemWithRounds) => (
      <StageItemRow
        key={stageItem.id}
        tournament={tournament}
        stageItem={stageItem}
        swrStagesResponse={swrStagesResponse}
        availableInputs={availableInputs}
        swrAvailableInputsResponse={swrAvailableInputsResponse}
        swrRankingsPerStageItemResponse={swrRankingsPerStageItemResponse}
        rankings={rankings}
      />
    ));

  return (
    <Stack miw="24rem" align="top" key={stage.id}>
      <UpdateStageModal
        swrStagesResponse={swrStagesResponse}
        stage={stage}
        tournament={tournament}
        opened={opened}
        setOpened={setOpened}
      />
      <Group justify="space-between">
        <Group>
          {stage.name}
          {stage.is_active ? <Badge color="green">{t('active_badge_label')}</Badge> : null}
        </Group>
        <Group gap="0rem">
          <Tooltip label={t('edit_stage_label')}>
            <ActionIcon
              variant="transparent"
              color="gray"
              onClick={() => {
                setOpened(true);
              }}
            >
              <IconPencil size="1.25rem" />
            </ActionIcon>
          </Tooltip>
          <Tooltip label={t('delete_button')}>
            <ActionIcon
              variant="transparent"
              color="red.6"
              onClick={() => setDeleteConfirmOpened(true)}
            >
              <IconTrash size="1.25rem" />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>
      <Modal
        opened={deleteConfirmOpened}
        onClose={() => setDeleteConfirmOpened(false)}
        title={t('delete_modal_title', { type: t('stage_singular_title') })}
      >
        <Alert icon={<IconAlertCircle size={16} />} color="red" radius="lg">
          {t('delete_modal_description', { name: stage.name })}
        </Alert>
        <Group justify="flex-end" mt="lg">
          <Button variant="default" onClick={() => setDeleteConfirmOpened(false)}>
            {t('cancel_button')}
          </Button>
          <Button
            color="red"
            onClick={async () => {
              await deleteStage(tournament.id, stage.id);
              await swrStagesResponse.mutate();
              await swrAvailableInputsResponse.mutate();
              setDeleteConfirmOpened(false);
            }}
          >
            {t('delete_button')}
          </Button>
        </Group>
      </Modal>
      {rows}
      <CreateStageItemModal
        key={-1}
        tournament={tournament}
        stage={stage}
        swrStagesResponse={swrStagesResponse}
        swrAvailableInputsResponse={swrAvailableInputsResponse}
      />
    </Stack>
  );
}

export default function Builder({
  tournament,
  swrStagesResponse,
  swrAvailableInputsResponse,
  swrRankingsPerStageItemResponse,
  rankings,
}: {
  tournament: Tournament;
  swrStagesResponse: SWRResponse<StagesWithStageItemsResponse>;
  swrAvailableInputsResponse: SWRResponse<StageItemInputOptionsResponse>;
  swrRankingsPerStageItemResponse: SWRResponse<StageRankingResponse>;
  rankings: Ranking[];
}) {
  const stages: StageWithStageItems[] =
    swrStagesResponse.data != null ? swrStagesResponse.data.data : [];

  if (swrStagesResponse.error) return <RequestErrorAlert error={swrStagesResponse.error} />;
  if (swrAvailableInputsResponse.error) {
    return <RequestErrorAlert error={swrAvailableInputsResponse.error} />;
  }

  const cols = stages
    .sort((s1: StageWithStageItems, s2: StageWithStageItems) => (s1.id > s2.id ? 1 : -1))
    .map((stage) => (
      <StageColumn
        key={stage.id}
        tournament={tournament}
        swrStagesResponse={swrStagesResponse}
        swrAvailableInputsResponse={swrAvailableInputsResponse}
        swrRankingsPerStageItemResponse={swrRankingsPerStageItemResponse}
        stage={stage}
        rankings={rankings}
      />
    ));

  const button = (
    <Stack miw="24rem" align="top" key={-1}>
      <h4 style={{ marginTop: '0rem' }}>
        <CreateStageButton
          tournament={tournament}
          swrStagesResponse={swrStagesResponse}
          swrAvailableInputsResponse={swrAvailableInputsResponse}
          swrRankingsPerStageItemResponse={swrRankingsPerStageItemResponse}
        />
      </h4>
    </Stack>
  );
  return cols.concat([button]);
}
