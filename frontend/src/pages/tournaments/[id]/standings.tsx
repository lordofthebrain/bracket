import { Container, Tabs, Title } from '@mantine/core';
import { AiOutlineHourglass } from '@react-icons/all-files/ai/AiOutlineHourglass';
import { useTranslation } from 'react-i18next';
import { SWRResponse } from 'swr';

import { StageFilterSelect, useStageFilter } from '@components/select/stage_filter_select';
import { AllTimeStandingsContent } from '@components/tables/all_time_standings';
import { StandingsTableForStageItem } from '@components/tables/standings';
import { NoContent } from '@components/no_content/empty_table_info';
import { useLazyTabs } from '@components/utils/react';
import { getTournamentIdFromRouter, responseIsValid } from '@components/utils/util';
import { StagesWithStageItemsResponse } from '@openapi';
import { getPreviousStageId } from '@services/lookups';
import { useStandingsData } from '@pages/tournaments/[id]/dashboard/standings';
import TournamentLayout from '@pages/tournaments/_tournament_layout';
import { getStages } from '@services/adapter';

function CurrentSeasonStandingsTabs({
  swrStagesResponse,
  stageId,
  tournamentId,
}: {
  swrStagesResponse: SWRResponse<StagesWithStageItemsResponse>;
  stageId: number | null;
  tournamentId: number;
}) {
  const { t } = useTranslation();
  const { stageItemsLookup, stagesLookup, stageItemTeamLookup, stageItemIds, cupWinnerTeamIdsByStage } =
    useStandingsData(swrStagesResponse, stageId);
  const { activeTab, setActiveTab, visitedTabs } = useLazyTabs(stageItemIds);

  if (stageItemIds.length < 1) {
    return (
      <NoContent
        title={t('could_not_find_any_alert', { entity: t('teams_title') })}
        description=""
        icon={<AiOutlineHourglass />}
      />
    );
  }

  return (
    <Tabs value={activeTab} onChange={setActiveTab} variant="pills" mt="1rem">
      <Tabs.List>
        {stageItemIds.map((stageItemId) => (
          <Tabs.Tab key={stageItemId} value={stageItemId}>
            {stageItemsLookup[stageItemId].name}
          </Tabs.Tab>
        ))}
      </Tabs.List>
      {stageItemIds.map((stageItemId) => {
        const previousStageId = getPreviousStageId(
          stageItemsLookup,
          stageItemsLookup[stageItemId].stage_id,
          stagesLookup
        );
        const cupWinnerTeamIds =
          previousStageId != null ? cupWinnerTeamIdsByStage.get(previousStageId) : undefined;
        return (
          <Tabs.Panel
            key={stageItemId}
            value={stageItemId}
            keepMounted={visitedTabs.has(stageItemId)}
            pt="1rem"
          >
            <StandingsTableForStageItem
              teams_with_inputs={stageItemTeamLookup[stageItemId]}
              stageItem={stageItemsLookup[stageItemId]}
              stageItemsLookup={stageItemsLookup}
              stagesLookup={stagesLookup}
              fontSizeInPixels={16}
              maxTeamsToDisplay={100}
              tournamentId={tournamentId}
              jumpTo={[]}
              showTitle={false}
              cupWinnerTeamIds={cupWinnerTeamIds}
            />
          </Tabs.Panel>
        );
      })}
    </Tabs>
  );
}

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
        <Tabs defaultValue="current" mt="1rem">
          <Tabs.List>
            <Tabs.Tab value="current">{t('is_season_checkbox_label')}</Tabs.Tab>
            <Tabs.Tab value="all_time">{t('all_time_standings_tab_label')}</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="current" pt="1rem">
            <StageFilterSelect
              stageFilter={stageFilter}
              setStageFilter={setStageFilter}
              stageOptions={stageOptions}
            />
            <div style={{ marginTop: stageOptions.length > 1 ? '1rem' : '2rem' }}>
              <CurrentSeasonStandingsTabs
                swrStagesResponse={swrStagesResponse}
                stageId={stageFilter != null ? Number(stageFilter) : null}
                tournamentId={tournamentData.id}
              />
            </div>
          </Tabs.Panel>

          <Tabs.Panel value="all_time" pt="1rem">
            <AllTimeStandingsContent swrStagesResponse={swrStagesResponse} />
          </Tabs.Panel>
        </Tabs>
      </Container>
    </TournamentLayout>
  );
}
