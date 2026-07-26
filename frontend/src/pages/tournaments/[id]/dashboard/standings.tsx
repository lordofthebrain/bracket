import { Container } from '@mantine/core';
import { AiOutlineHourglass } from '@react-icons/all-files/ai/AiOutlineHourglass';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { SWRResponse } from 'swr';

import { DashboardFooter } from '@components/dashboard/footer';
import { DoubleHeader, getTournamentHeadTitle } from '@components/dashboard/layout';
import { NoContent } from '@components/no_content/empty_table_info';
import { StandingsTableForStageItem } from '@components/tables/standings';
import { TableSkeletonTwoColumns } from '@components/utils/skeletons';
import { responseIsValid, setTitle } from '@components/utils/util';
import { StagesWithStageItemsResponse } from '@openapi';
import { getStagesLive } from '@services/adapter';
import { getTournamentResponseByEndpointName } from '@services/dashboard';
import { getCupWinnerTeamIds, getStageItemLookup, getStageItemTeamsLookup } from '@services/lookups';

export function StandingsContent({
  swrStagesResponse,
  fontSizeInPixels,
  maxTeamsToDisplay,
  tournamentId,
  stageId,
}: {
  swrStagesResponse: SWRResponse<StagesWithStageItemsResponse>;
  fontSizeInPixels: number;
  maxTeamsToDisplay: number;
  tournamentId: number;
  stageId?: number | null;
}) {
  const { t } = useTranslation();

  const stageItemsLookup = getStageItemLookup(swrStagesResponse);
  const stageItemTeamLookup = responseIsValid(swrStagesResponse)
    ? getStageItemTeamsLookup(swrStagesResponse)
    : {};

  const stageItemIds = Object.keys(stageItemTeamLookup)
    .filter((stageItemId) => stageItemsLookup[stageItemId] != null)
    .filter((stageItemId) => stageId == null || stageItemsLookup[stageItemId].stage_id === stageId)
    .filter((stageItemId) => stageItemsLookup[stageItemId].type !== 'SINGLE_ELIMINATION')
    .sort((si1: any, si2: any) =>
      stageItemsLookup[si1].name > stageItemsLookup[si2].name ? 1 : -1
    );

  if (stageItemIds.length < 1) {
    return (
      <NoContent
        title={t('could_not_find_any_alert', { entity: t('teams_title') })}
        description=""
        icon={<AiOutlineHourglass />}
      />
    );
  }

  const anchorId = (stageItemId: string) => `standings-stage-item-${stageItemId}`;
  const cupWinnerTeamIds = getCupWinnerTeamIds(swrStagesResponse);

  const rows = stageItemIds.map((stageItemId, index) => {
    const jumpTo = stageItemIds
      .filter((otherId) => otherId !== stageItemId)
      .map((otherId) => {
        const otherIndex = stageItemIds.indexOf(otherId);
        const arrow = otherIndex > index ? '↓' : '↑';
        return {
          targetId: anchorId(otherId),
          label: `${arrow} ${stageItemsLookup[otherId].name}`,
        };
      });

    return (
      <div
        key={stageItemId}
        id={anchorId(stageItemId)}
        style={{ marginTop: index > 0 ? '3rem' : undefined, scrollMarginTop: '4.9rem' }}
      >
        <StandingsTableForStageItem
          teams_with_inputs={stageItemTeamLookup[stageItemId]}
          stageItem={stageItemsLookup[stageItemId]}
          stageItemsLookup={stageItemsLookup}
          fontSizeInPixels={fontSizeInPixels}
          maxTeamsToDisplay={maxTeamsToDisplay}
          tournamentId={tournamentId}
          jumpTo={jumpTo}
          cupWinnerTeamIds={cupWinnerTeamIds}
        />
      </div>
    );
  });

  return rows;
}

export default function DashboardStandingsPage() {
  const tournamentDataFull = getTournamentResponseByEndpointName();
  const tournamentValid = !React.isValidElement(tournamentDataFull);

  const swrStagesResponse = getStagesLive(tournamentValid ? tournamentDataFull.id : null);

  if (!tournamentValid) {
    return tournamentDataFull;
  }

  setTitle(getTournamentHeadTitle(tournamentDataFull));

  if (swrStagesResponse.isLoading) {
    return <TableSkeletonTwoColumns />;
  }

  return (
    <>
      <DoubleHeader tournamentData={tournamentDataFull} />
      <Container mt="1rem" px="0rem">
        <Container style={{ width: '100%' }} px="sm">
          <StandingsContent
            swrStagesResponse={swrStagesResponse}
            fontSizeInPixels={16}
            maxTeamsToDisplay={100}
            tournamentId={tournamentDataFull.id}
          />
        </Container>
      </Container>
      <DashboardFooter />
    </>
  );
}
