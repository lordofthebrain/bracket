import { Button, Modal, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useTranslation } from 'react-i18next';
import { SWRResponse } from 'swr';

import { RankingSelect } from '@components/select/ranking_select';
import { ROUND_NAME_PATTERN_RE } from '@components/utils/util';
import { Ranking, StageItemWithRounds, StagesWithStageItemsResponse, Tournament } from '@openapi';
import { updateStageItem } from '@services/stage_item';

export function UpdateStageItemModal({
  tournament,
  opened,
  setOpened,
  stageItem,
  swrStagesResponse,
  rankings,
}: {
  tournament: Tournament;
  opened: boolean;
  setOpened: any;
  stageItem: StageItemWithRounds;
  swrStagesResponse: SWRResponse<StagesWithStageItemsResponse>;
  rankings: Ranking[];
}) {
  const { t } = useTranslation();
  const form = useForm({
    initialValues: {
      name: stageItem.name,
      ranking_id: (
        stageItem.ranking_id ?? rankings.filter((ranking) => ranking.position === 0)[0].id
      ).toString(),
      round_name_pattern: stageItem.round_name_pattern,
    },
    validate: {
      round_name_pattern: (value) =>
        ROUND_NAME_PATTERN_RE.test(value) ? null : t('round_name_pattern_validation'),
    },
  });

  return (
    <Modal opened={opened} onClose={() => setOpened(false)} title={t('edit_stage_item_label')}>
      <form
        onSubmit={form.onSubmit(async (values) => {
          await updateStageItem(
            tournament.id,
            stageItem.id,
            values.name,
            values.ranking_id,
            values.round_name_pattern
          );
          await swrStagesResponse.mutate();
          setOpened(false);
        })}
      >
        <TextInput
          label={t('name_input_label')}
          placeholder=""
          required
          my="lg"
          type="text"
          {...form.getInputProps('name')}
        />
        <RankingSelect form={form} rankings={rankings} />
        <TextInput
          mt="1rem"
          label={t('round_name_pattern_input_label')}
          description={t('round_name_pattern_input_description')}
          {...form.getInputProps('round_name_pattern')}
        />
        <Button fullWidth style={{ marginTop: 16 }} color="green" type="submit">
          {t('save_button')}
        </Button>
      </form>
    </Modal>
  );
}
