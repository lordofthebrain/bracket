import { Container, Title } from '@mantine/core';
import { useTranslation } from 'react-i18next';

import { StageFilterSelect, useStageFilter } from '@components/select/stage_filter_select';
import { getTournamentIdFromRouter, responseIsValid } from '@components/utils/util';
import { StandingsContent } from '@pages/tournaments/[id]/dashboard/standings';
import TournamentLayout from '@pages/tournaments/_tournament_layout';
import { getStages } from '@services/adapter';

export default function StandingsPage() {
  const { t } = useTranslation();
  const { tournamentData } = getTournamentIdFromRouter();
  const swrStagesResponse = getStages(tournamentData.id);
  const { stageFilter, setStageFilter, stageOptions } = useStageFilter(swrStagesResponse);

  if (!responseIsValid(swrStagesResponse)) return null;

  return (
    <TournamentLayout tournament_id={tournamentData.id}>
      <Container size="md" mb="1rem">
        <Title>{t('standings_title')}</Title>
        <StageFilterSelect
          stageFilter={stageFilter}
          setStageFilter={setStageFilter}
          stageOptions={stageOptions}
        />
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
