import { Select } from '@mantine/core';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SWRResponse } from 'swr';

import { StageWithStageItems } from '@openapi';

export function useStageFilter(swrStagesResponse: SWRResponse) {
  const [stageFilter, setStageFilter] = useState<string | null>(null);
  const stages: StageWithStageItems[] = swrStagesResponse.data?.data ?? [];
  const stageOptions = stages.map((stage) => ({ value: `${stage.id}`, label: stage.name }));

  useEffect(() => {
    if (stageFilter != null || stages.length < 1) return;
    const activeStage = stages.find((stage) => stage.is_active);
    setStageFilter(`${activeStage?.id ?? stages[stages.length - 1].id}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stages.map((stage) => stage.id).join(',')]);

  return { stageFilter, setStageFilter, stageOptions };
}

export function StageFilterSelect({
  stageFilter,
  setStageFilter,
  stageOptions,
  maxWidth = '20rem',
}: {
  stageFilter: string | null;
  setStageFilter: (value: string | null) => void;
  stageOptions: { value: string; label: string }[];
  maxWidth?: string;
}) {
  const { t } = useTranslation();

  if (stageOptions.length < 2) return null;

  return (
    <Select
      label={t('stage_filter_label')}
      data={stageOptions}
      value={stageFilter}
      onChange={setStageFilter}
      allowDeselect={false}
      mt="1rem"
      style={{ maxWidth }}
    />
  );
}
