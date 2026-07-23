import { showNotification } from '@mantine/notifications';

import { MatchBody, MatchCreateBodyFrontend, MatchRescheduleBody } from '@openapi';
import { createAxios, handleRequestError } from './adapter';

export async function createMatch(tournament_id: number, match: MatchCreateBodyFrontend) {
  return createAxios()
    .post(`tournaments/${tournament_id}/matches`, match)
    .catch((response: any) => handleRequestError(response));
}

export async function deleteMatch(tournament_id: number, match_id: number) {
  return createAxios()
    .delete(`tournaments/${tournament_id}/matches/${match_id}`)
    .catch((response: any) => handleRequestError(response));
}

export async function updateMatch(tournament_id: number, match_id: number, match: MatchBody) {
  return createAxios()
    .put(`tournaments/${tournament_id}/matches/${match_id}`, match)
    .catch((response: any) => handleRequestError(response));
}

export async function rescheduleMatch(
  tournament_id: number,
  match_id: number,
  match: MatchRescheduleBody
) {
  return createAxios()
    .post(`tournaments/${tournament_id}/matches/${match_id}/reschedule`, match)
    .catch((response: any) => handleRequestError(response))
    .then((response: any) => {
      if (response != null && response.status === 200) {
        showNotification({
          color: 'green',
          title: 'Successfully rescheduled match',
          message: '',
        });
      }
    });
}

export async function scheduleMatches(tournament_id: number) {
  return createAxios()
    .post(`tournaments/${tournament_id}/schedule_matches`)
    .catch((response: any) => handleRequestError(response));
}

export interface MatchRoundAssignment {
  match_id: number;
  round_id: number;
  swap_teams: boolean;
}

export async function reassignRounds(
  tournament_id: number,
  stage_item_id: number,
  assignments: MatchRoundAssignment[]
) {
  return createAxios()
    .post(`tournaments/${tournament_id}/stage_items/${stage_item_id}/reassign_rounds`, {
      assignments,
    })
    .catch((response: any) => handleRequestError(response));
}
