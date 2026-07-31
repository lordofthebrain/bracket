import { Button, Checkbox, Modal, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useTranslation } from 'react-i18next';
import { SWRResponse } from 'swr';

import { StageWithStageItems, StagesWithStageItemsResponse, Tournament } from '@openapi';
import { updateStage } from '@services/stage';

export function UpdateStageModal({
  tournament,
  opened,
  setOpened,
  stage,
  swrStagesResponse,
}: {
  tournament: Tournament;
  opened: boolean;
  setOpened: any;
  stage: StageWithStageItems;
  swrStagesResponse: SWRResponse<StagesWithStageItemsResponse>;
}) {
  const { t } = useTranslation();
  const form = useForm({
    initialValues: { name: stage.name, is_season: (stage as any).is_season ?? true },
    validate: {},
  });

  return (
    <Modal opened={opened} onClose={() => setOpened(false)} title={t('edit_stage_label')}>
      <form
        onSubmit={form.onSubmit(async (values) => {
          await updateStage(tournament.id, stage.id, values.name, values.is_season);
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
        <Checkbox
          mb="lg"
          label={t('is_season_checkbox_label')}
          {...form.getInputProps('is_season', { type: 'checkbox' })}
        />
        <Button fullWidth style={{ marginTop: 16 }} color="green" type="submit">
          {t('save_button')}
        </Button>
      </form>
    </Modal>
  );
}
