import { Container, Title } from '@mantine/core';
import { useTranslation } from 'react-i18next';

import { getTournamentIdFromRouter, responseIsValid } from '@components/utils/util';
import { StandingsContent } from '@pages/tournaments/[id]/dashboard/standings';
import TournamentLayout from '@pages/tournaments/_tournament_layout';
import { getStages } from '@services/adapter';

export default function StandingsPage() {
  const { t } = useTranslation();
  const { tournamentData } = getTournamentIdFromRouter();
  const swrStagesResponse = getStages(tournamentData.id);

  if (!responseIsValid(swrStagesResponse)) return null;

  return (
    <TournamentLayout tournament_id={tournamentData.id}>
      <Container size="md">
        <Title>{t('standings_title')}</Title>
        <div style={{ marginTop: '2rem' }}>
          <StandingsContent
            swrStagesResponse={swrStagesResponse}
            fontSizeInPixels={16}
            maxTeamsToDisplay={100}
            tournamentId={tournamentData.id}
          />
        </div>
      </Container>
    </TournamentLayout>
  );
}
