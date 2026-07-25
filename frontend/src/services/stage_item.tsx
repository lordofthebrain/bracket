import { createAxios, handleRequestError } from './adapter';

export async function createStageItem(
  tournament_id: number,
  stage_id: number,
  type: string,
  team_count: number,
  double_round_robin: boolean = false,
  round_name_pattern: string = 'Round {02d}'
) {
  return createAxios()
    .post(`tournaments/${tournament_id}/stage_items`, {
      stage_id,
      type,
      team_count,
      double_round_robin,
      round_name_pattern,
    })
    .catch((response: any) => handleRequestError(response));
}

export async function updateStageItem(
  tournament_id: number,
  stage_item_id: number,
  name: string,
  ranking_id: string,
  round_name_pattern: string
) {
  return createAxios()
    .put(`tournaments/${tournament_id}/stage_items/${stage_item_id}`, {
      name,
      ranking_id,
      round_name_pattern,
    })
    .catch((response: any) => handleRequestError(response));
}

export async function deleteStageItem(tournament_id: number, stage_item_id: number) {
  return createAxios()
    .delete(`tournaments/${tournament_id}/stage_items/${stage_item_id}`)
    .catch((response: any) => handleRequestError(response));
}
