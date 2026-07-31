from fastapi import APIRouter, Depends, HTTPException
from starlette import status

from bracket.config import config
from bracket.logic.planning.conflicts import handle_conflicts
from bracket.logic.planning.matches import (
    get_scheduled_matches,
    handle_match_reschedule,
    reorder_matches_for_court,
    schedule_all_unscheduled_matches,
)
from bracket.logic.ranking.calculation import (
    recalculate_ranking_for_stage_item,
)
from bracket.logic.ranking.elimination import (
    update_inputs_in_complete_elimination_stage_item,
    update_inputs_in_subsequent_elimination_rounds,
)
from bracket.logic.scheduling.upcoming_matches import (
    get_draft_round_in_stage_item,
    get_upcoming_matches_for_swiss,
)
from bracket.models.db.match import (
    Match,
    MatchBody,
    MatchCreateBody,
    MatchCreateBodyFrontend,
    MatchFilter,
    MatchRescheduleBody,
    MatchRoundAssignmentsBody,
    MatchWinnerSourceAssignmentsBody,
)
from bracket.models.db.stage_item import StageType
from bracket.models.db.tournament import Tournament
from bracket.models.db.user import UserPublic
from bracket.routes.auth import user_authenticated_for_tournament
from bracket.routes.models import SingleMatchResponse, SuccessResponse, UpcomingMatchesResponse
from bracket.routes.util import disallow_archived_tournament, match_dependency
from bracket.sql.courts import get_all_courts_in_tournament
from bracket.sql.matches import (
    sql_create_match,
    sql_delete_match,
    sql_swap_match_teams,
    sql_update_match,
    sql_update_match_round,
    sql_update_match_winner_sources,
)
from bracket.sql.rounds import get_round_by_id
from bracket.sql.stage_items import get_stage_item
from bracket.sql.stages import get_full_tournament_details
from bracket.sql.tournaments import sql_get_tournament
from bracket.sql.validation import check_foreign_keys_belong_to_tournament
from bracket.utils.id_types import MatchId, RoundId, StageItemId, StageItemInputId, TournamentId
from bracket.utils.types import assert_some

router = APIRouter(prefix=config.api_prefix)


@router.get(
    "/tournaments/{tournament_id}/stage_items/{stage_item_id}/upcoming_matches",
    response_model=UpcomingMatchesResponse,
)
async def get_matches_to_schedule(
    tournament_id: TournamentId,
    stage_item_id: StageItemId,
    elo_diff_threshold: int = 200,
    iterations: int = 2_000,
    only_recommended: bool = False,
    limit: int = 50,
    _: UserPublic = Depends(user_authenticated_for_tournament),
) -> UpcomingMatchesResponse:
    match_filter = MatchFilter(
        elo_diff_threshold=elo_diff_threshold,
        only_recommended=only_recommended,
        limit=limit,
        iterations=iterations,
    )

    draft_round, stage_item = await get_draft_round_in_stage_item(tournament_id, stage_item_id)
    courts = await get_all_courts_in_tournament(tournament_id)
    if len(courts) <= len(draft_round.matches):
        return UpcomingMatchesResponse(data=[])

    return UpcomingMatchesResponse(
        data=get_upcoming_matches_for_swiss(match_filter, stage_item, draft_round)
    )


@router.delete("/tournaments/{tournament_id}/matches/{match_id}", response_model=SuccessResponse)
async def delete_match(
    tournament_id: TournamentId,
    _: UserPublic = Depends(user_authenticated_for_tournament),
    __: Tournament = Depends(disallow_archived_tournament),
    match: Match = Depends(match_dependency),
) -> SuccessResponse:
    round_ = await get_round_by_id(tournament_id, match.round_id)
    stage_item = await get_stage_item(tournament_id, round_.stage_item_id)

    if not round_.is_draft or stage_item.type != StageType.SWISS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only delete matches from draft rounds in Swiss stage items",
        )

    await sql_delete_match(match.id)

    stage_item = await get_stage_item(tournament_id, round_.stage_item_id)

    await recalculate_ranking_for_stage_item(tournament_id, stage_item)
    return SuccessResponse()


@router.post("/tournaments/{tournament_id}/matches", response_model=SingleMatchResponse)
async def create_match(
    tournament_id: TournamentId,
    match_body: MatchCreateBodyFrontend,
    _: UserPublic = Depends(user_authenticated_for_tournament),
    __: Tournament = Depends(disallow_archived_tournament),
) -> SingleMatchResponse:
    await check_foreign_keys_belong_to_tournament(match_body, tournament_id)

    round_ = await get_round_by_id(tournament_id, match_body.round_id)
    stage_item = await get_stage_item(tournament_id, round_.stage_item_id)

    if not round_.is_draft or stage_item.type != StageType.SWISS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only create matches in draft rounds of Swiss stage items",
        )

    tournament = await sql_get_tournament(tournament_id)
    body_with_durations = MatchCreateBody(
        **match_body.model_dump(),
        duration_minutes=tournament.duration_minutes,
        margin_minutes=tournament.margin_minutes,
    )

    return SingleMatchResponse(data=await sql_create_match(body_with_durations))


@router.post("/tournaments/{tournament_id}/schedule_matches", response_model=SuccessResponse)
async def schedule_matches(
    tournament_id: TournamentId,
    _: UserPublic = Depends(user_authenticated_for_tournament),
    __: Tournament = Depends(disallow_archived_tournament),
) -> SuccessResponse:
    stages = await get_full_tournament_details(tournament_id)
    await schedule_all_unscheduled_matches(tournament_id, stages)
    return SuccessResponse()


@router.post(
    "/tournaments/{tournament_id}/matches/{match_id}/reschedule", response_model=SuccessResponse
)
async def reschedule_match(
    tournament_id: TournamentId,
    match_id: MatchId,
    body: MatchRescheduleBody,
    tournament: Tournament = Depends(disallow_archived_tournament),
    _: UserPublic = Depends(user_authenticated_for_tournament),
) -> SuccessResponse:
    await check_foreign_keys_belong_to_tournament(body, tournament_id)
    await handle_match_reschedule(tournament, body, match_id)
    await handle_conflicts(await get_full_tournament_details(tournament_id))
    return SuccessResponse()


@router.put("/tournaments/{tournament_id}/matches/{match_id}", response_model=SuccessResponse)
async def update_match_by_id(
    tournament_id: TournamentId,
    match_id: MatchId,
    match_body: MatchBody,
    _: UserPublic = Depends(user_authenticated_for_tournament),
    __: Tournament = Depends(disallow_archived_tournament),
    match: Match = Depends(match_dependency),
) -> SuccessResponse:
    await check_foreign_keys_belong_to_tournament(match_body, tournament_id)

    round_ = await get_round_by_id(tournament_id, match.round_id)
    stage_item = await get_stage_item(tournament_id, round_.stage_item_id)

    if stage_item.type == StageType.SINGLE_ELIMINATION:
        match_body = match_body.with_irrelevant_extra_time_fields_cleared()
    else:
        # Extra time/penalties only apply to single elimination matches.
        match_body = match_body.model_copy(
            update={
                "stage_item_input1_score_extra_time_half": None,
                "stage_item_input2_score_extra_time_half": None,
                "stage_item_input1_score_after_extra_time": None,
                "stage_item_input2_score_after_extra_time": None,
                "stage_item_input1_score_penalties": None,
                "stage_item_input2_score_penalties": None,
            }
        )

    tournament = await sql_get_tournament(tournament_id)

    if match_body.round_id != match.round_id:
        new_round = await get_round_by_id(tournament_id, match_body.round_id)

        if new_round.stage_item_id != round_.stage_item_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Can't move a match to a round of a different stage item",
            )

        input_ids = {match.stage_item_input1_id, match.stage_item_input2_id} - {None}
        for other_match in new_round.matches:
            if other_match.id == match_id:
                continue
            if {other_match.stage_item_input1_id, other_match.stage_item_input2_id} & input_ids:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="One of the teams already has a match in the destination round",
                )

    await sql_update_match(match_id, match_body, tournament)

    stage_item = await get_stage_item(tournament_id, round_.stage_item_id)
    await recalculate_ranking_for_stage_item(tournament_id, stage_item)

    if (
        match_body.custom_duration_minutes != match.custom_duration_minutes
        or match_body.custom_margin_minutes != match.custom_margin_minutes
    ):
        tournament = await sql_get_tournament(tournament_id)
        scheduled_matches = get_scheduled_matches(await get_full_tournament_details(tournament_id))
        await reorder_matches_for_court(tournament, scheduled_matches, assert_some(match.court_id))

    if stage_item.type == StageType.SINGLE_ELIMINATION:
        await update_inputs_in_subsequent_elimination_rounds(round_.id, stage_item, {match_id})

    return SuccessResponse()


@router.post(
    "/tournaments/{tournament_id}/stage_items/{stage_item_id}/reassign_rounds",
    response_model=SuccessResponse,
)
async def reassign_rounds(
    tournament_id: TournamentId,
    stage_item_id: StageItemId,
    body: MatchRoundAssignmentsBody,
    _: UserPublic = Depends(user_authenticated_for_tournament),
    __: Tournament = Depends(disallow_archived_tournament),
) -> SuccessResponse:
    stage_item = await get_stage_item(tournament_id, stage_item_id)

    valid_round_ids = {round_.id for round_ in stage_item.rounds}
    match_current_round: dict[MatchId, RoundId] = {}
    match_inputs: dict[MatchId, tuple[StageItemInputId | None, StageItemInputId | None]] = {}
    for round_ in stage_item.rounds:
        for match in round_.matches:
            match_current_round[match.id] = round_.id
            match_inputs[match.id] = (match.stage_item_input1_id, match.stage_item_input2_id)

    new_round_by_match: dict[MatchId, RoundId] = dict(match_current_round)
    for assignment in body.assignments:
        if assignment.match_id not in match_current_round:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Match {assignment.match_id} doesn't belong to this stage item",
            )
        if assignment.round_id not in valid_round_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Round {assignment.round_id} doesn't belong to this stage item",
            )
        new_round_by_match[assignment.match_id] = assignment.round_id

    teams_per_round: dict[RoundId, dict[StageItemInputId, MatchId]] = {
        round_id: {} for round_id in valid_round_ids
    }
    conflicting_round_names: set[str] = set()
    round_name_by_id = {round_.id: round_.name for round_ in stage_item.rounds}
    for match_id, round_id in new_round_by_match.items():
        for input_id in match_inputs[match_id]:
            if input_id is None:
                continue
            existing_match_id = teams_per_round[round_id].get(input_id)
            if existing_match_id is not None and existing_match_id != match_id:
                conflicting_round_names.add(round_name_by_id[round_id])
            teams_per_round[round_id][input_id] = match_id

    if conflicting_round_names:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "A team would play twice in the same round: "
                f"{', '.join(sorted(conflicting_round_names))}"
            ),
        )

    for match_id, round_id in new_round_by_match.items():
        if round_id != match_current_round[match_id]:
            await sql_update_match_round(match_id, round_id)

    for assignment in body.assignments:
        if assignment.swap_teams:
            await sql_swap_match_teams(assignment.match_id)

    stage_item = await get_stage_item(tournament_id, stage_item_id)
    await recalculate_ranking_for_stage_item(tournament_id, stage_item)

    return SuccessResponse()


@router.post(
    "/tournaments/{tournament_id}/stage_items/{stage_item_id}/reassign_winner_sources",
    response_model=SuccessResponse,
)
async def reassign_winner_sources(
    tournament_id: TournamentId,
    stage_item_id: StageItemId,
    body: MatchWinnerSourceAssignmentsBody,
    _: UserPublic = Depends(user_authenticated_for_tournament),
    __: Tournament = Depends(disallow_archived_tournament),
) -> SuccessResponse:
    stage_item = await get_stage_item(tournament_id, stage_item_id)

    if stage_item.type != StageType.SINGLE_ELIMINATION:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Winner sources can only be reassigned for single elimination stage items",
        )

    sorted_rounds = sorted(stage_item.rounds, key=lambda round_: round_.id)
    round_index_by_match: dict[MatchId, int] = {}
    matches_by_id: dict[MatchId, Match] = {}
    for round_index, round_ in enumerate(sorted_rounds):
        for match in round_.matches:
            round_index_by_match[match.id] = round_index
            matches_by_id[match.id] = match

    new_sources: dict[MatchId, tuple[MatchId | None, MatchId | None]] = {
        match_id: (match.stage_item_input1_winner_from_match_id, match.stage_item_input2_winner_from_match_id)
        for match_id, match in matches_by_id.items()
    }
    for assignment in body.assignments:
        if assignment.match_id not in round_index_by_match:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Match {assignment.match_id} doesn't belong to this stage item",
            )

        current_match = matches_by_id[assignment.match_id]
        previous_round_index = round_index_by_match[assignment.match_id] - 1
        if previous_round_index < 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="The first round has no winner sources to reassign",
            )
        previous_round_match_ids = {match.id for match in sorted_rounds[previous_round_index].matches}

        for source_match_id in (
            assignment.stage_item_input1_winner_from_match_id,
            assignment.stage_item_input2_winner_from_match_id,
        ):
            if (
                source_match_id is not None
                and current_match.stage_item_input1_winner_from_match_id is not None
                and current_match.stage_item_input2_winner_from_match_id is not None
                and source_match_id not in previous_round_match_ids
            ):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Match {source_match_id} isn't in the round preceding match "
                    f"{assignment.match_id}",
                )

        new_sources[assignment.match_id] = (
            assignment.stage_item_input1_winner_from_match_id,
            assignment.stage_item_input2_winner_from_match_id,
        )

    sources_per_round: dict[int, dict[MatchId, MatchId]] = {}
    for match_id, (source1, source2) in new_sources.items():
        round_index = round_index_by_match[match_id]
        round_sources = sources_per_round.setdefault(round_index, {})
        for source_match_id in (source1, source2):
            if source_match_id is None:
                continue
            existing_match_id = round_sources.get(source_match_id)
            if existing_match_id is not None and existing_match_id != match_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Match {source_match_id}'s winner can only advance to one match",
                )
            round_sources[source_match_id] = match_id

    for assignment in body.assignments:
        await sql_update_match_winner_sources(
            assignment.match_id,
            assignment.stage_item_input1_winner_from_match_id,
            assignment.stage_item_input2_winner_from_match_id,
        )

    updated_stage_item = await get_stage_item(tournament_id, stage_item_id)
    await update_inputs_in_complete_elimination_stage_item(updated_stage_item)
    await recalculate_ranking_for_stage_item(tournament_id, updated_stage_item)

    return SuccessResponse()
