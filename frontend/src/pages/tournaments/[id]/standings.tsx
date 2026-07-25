import { Container, Select, Title } from '@mantine/core';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { getTournamentIdFromRouter, responseIsValid } from '@components/utils/util';
import { StageWithStageItems } from '@openapi';
import { StandingsContent } from '@pages/tournaments/[id]/dashboard/standings';
import TournamentLayout from '@pages/tournaments/_tournament_layout';
import { getStages } from '@services/adapter';

export default function StandingsPage() {
  const [stageFilter, setStageFilter] = useState<string | null>(null);

  const { t } = useTranslation();
  const { tournamentData } = getTournamentIdFromRouter();
  const swrStagesResponse = getStages(tournamentData.id);

  const stages: StageWithStageItems[] = swrStagesResponse.data?.data ?? [];
  const stageOptions = stages.map((stage) => ({ value: `${stage.id}`, label: stage.name }));

  useEffect(() => {
    if (stageFilter != null || stages.length < 1) return;
    const activeStage = stages.find((stage) => stage.is_active);
    setStageFilter(`${activeStage?.id ?? stages[stages.length - 1].id}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stages.map((stage) => stage.id).join(',')]);

  if (!responseIsValid(swrStagesResponse)) return null;

  return (
    <TournamentLayout tournament_id={tournamentData.id}>
      <Container size="md" mb="1rem">
        <Title>{t('standings_title')}</Title>
        {stageOptions.length > 1 && (
          <Select
            label={t('stage_filter_label')}
            data={stageOptions}
            value={stageFilter}
            onChange={setStageFilter}
            allowDeselect={false}
            mt="md"
            style={{ maxWidth: '20rem' }}
          />
        )}
        <div style={{ marginTop: stageOptions.length > 1 ? '1rem' : '2rem' }}>
          <StandingsContent
            swrStagesResponse={swrStagesResponse}
            fontSizeInPixels={16}
            maxTeamsToDisplay={100}
            tournamentId={tournamentData.id}
            stageId={stageFilter != null ? Number(stageFilter) : null}
          />
        </div>
      </Container>
    </TournamentLayout>
  );
}
