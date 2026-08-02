from fastapi import HTTPException
from starlette import status

from bracket.models.db.match import Match, MatchCreateBody
from bracket.models.db.tournament import Tournament
from bracket.models.db.util import RoundWithMatches, StageItemWithRounds
from bracket.sql.matches import sql_create_match, sql_set_return_leg_match_id
from bracket.sql.rounds import get_rounds_for_stage_item
from bracket.sql.tournaments import sql_get_tournament
from bracket.utils.id_types import TournamentId


def determine_matches_first_round(
    round_: RoundWithMatches, stage_item: StageItemWithRounds, tournament: Tournament
) -> list[MatchCreateBody]:
    suggestions: list[MatchCreateBody] = []

    for i in range(0, len(stage_item.inputs), 2):
        first_input = stage_item.inputs[i + 0]
        second_input = stage_item.inputs[i + 1]
        suggestions.append(
            MatchCreateBody(
                round_id=round_.id,
                court_id=None,
                stage_item_input1_id=first_input.id,
                stage_item_input1_winner_from_match_id=None,
                stage_item_input2_id=second_input.id,
                stage_item_input2_winner_from_match_id=None,
                duration_minutes=tournament.duration_minutes,
                margin_minutes=tournament.margin_minutes,
                custom_duration_minutes=None,
                custom_margin_minutes=None,
            )
        )

    return suggestions


def determine_matches_subsequent_round(
    prev_matches: list[Match],
    round_: RoundWithMatches,
    tournament: Tournament,
) -> list[MatchCreateBody]:
    suggestions: list[MatchCreateBody] = []

    for i in range(0, len(prev_matches), 2):
        first_match = prev_matches[i + 0]
        second_match = prev_matches[i + 1]

        suggestions.append(
            MatchCreateBody(
                round_id=round_.id,
                court_id=None,
                stage_item_input1_id=None,
                stage_item_input2_id=None,
                stage_item_input1_winner_from_match_id=first_match.id,
                stage_item_input2_winner_from_match_id=second_match.id,
                duration_minutes=tournament.duration_minutes,
                margin_minutes=tournament.margin_minutes,
                custom_duration_minutes=None,
                custom_margin_minutes=None,
            )
        )
    return suggestions


def _round_is_two_legged(stage_item: StageItemWithRounds, is_final_round: bool) -> bool:
    if not stage_item.two_legged:
        return False
    return stage_item.two_legged_final if is_final_round else True


def _build_return_leg_body(primary: Match, tournament: Tournament) -> MatchCreateBody:
    return MatchCreateBody(
        round_id=primary.round_id,
        court_id=None,
        stage_item_input1_id=primary.stage_item_input2_id,
        stage_item_input2_id=primary.stage_item_input1_id,
        stage_item_input1_winner_from_match_id=primary.stage_item_input2_winner_from_match_id,
        stage_item_input2_winner_from_match_id=primary.stage_item_input1_winner_from_match_id,
        duration_minutes=tournament.duration_minutes,
        margin_minutes=tournament.margin_minutes,
        custom_duration_minutes=None,
        custom_margin_minutes=None,
        is_return_leg=True,
        return_leg_match_id=primary.id,
    )


async def _create_round_matches(
    primary_bodies: list[MatchCreateBody], two_legged: bool, tournament: Tournament
) -> list[Match]:
    primary_matches: list[Match] = []
    for body in primary_bodies:
        primary = await sql_create_match(body)
        primary_matches.append(primary)
        if two_legged:
            return_leg = await sql_create_match(_build_return_leg_body(primary, tournament))
            await sql_set_return_leg_match_id(primary.id, return_leg.id)

    return primary_matches


async def build_single_elimination_stage_item(
    tournament_id: TournamentId, stage_item: StageItemWithRounds
) -> None:
    rounds = await get_rounds_for_stage_item(tournament_id, stage_item.id)
    tournament = await sql_get_tournament(tournament_id)

    assert len(rounds) > 0
    first_round = rounds[0]

    prev_matches = await _create_round_matches(
        determine_matches_first_round(first_round, stage_item, tournament),
        _round_is_two_legged(stage_item, is_final_round=first_round is rounds[-1]),
        tournament,
    )

    for round_ in rounds[1:]:
        prev_matches = await _create_round_matches(
            determine_matches_subsequent_round(prev_matches, round_, tournament),
            _round_is_two_legged(stage_item, is_final_round=round_ is rounds[-1]),
            tournament,
        )


def get_number_of_rounds_to_create_single_elimination(team_count: int) -> int:
    if team_count < 1:
        return 0

    game_count_lookup = {
        2: 1,
        4: 2,
        8: 3,
        16: 4,
        32: 5,
    }
    if team_count not in game_count_lookup:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Number of teams invalid, should be one of {list(game_count_lookup.keys())}",
        )

    return game_count_lookup[team_count]
