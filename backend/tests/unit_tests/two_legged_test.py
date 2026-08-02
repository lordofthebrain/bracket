from bracket.models.db.match import Match, MatchBody
from bracket.models.db.stage_item_inputs import StageItemInputFinal
from bracket.utils.dummy_records import DUMMY_MOCK_TIME
from bracket.utils.id_types import MatchId, RoundId, TournamentId
from tests.unit_tests.mocks import get_stage_item_inputs_mock

STAGE_ITEM_INPUTS = get_stage_item_inputs_mock(TournamentId(-1))


def _make_match(
    match_id: int,
    input1_score: int,
    input2_score: int,
    *,
    input1: StageItemInputFinal = STAGE_ITEM_INPUTS[0],
    input2: StageItemInputFinal = STAGE_ITEM_INPUTS[1],
    is_return_leg: bool = False,
    return_leg_match_id: int | None = None,
    is_played: bool = True,
    input1_score_after_extra_time: int | None = None,
    input2_score_after_extra_time: int | None = None,
    input1_score_penalties: int | None = None,
    input2_score_penalties: int | None = None,
) -> Match:
    return Match(
        id=MatchId(match_id),
        stage_item_input1=input1,
        stage_item_input2=input2,
        stage_item_input1_id=input1.id,
        stage_item_input2_id=input2.id,
        created=DUMMY_MOCK_TIME,
        duration_minutes=90,
        margin_minutes=15,
        round_id=RoundId(-1),
        stage_item_input1_score=input1_score,
        stage_item_input2_score=input2_score,
        stage_item_input1_score_after_extra_time=input1_score_after_extra_time,
        stage_item_input2_score_after_extra_time=input2_score_after_extra_time,
        stage_item_input1_score_penalties=input1_score_penalties,
        stage_item_input2_score_penalties=input2_score_penalties,
        stage_item_input1_conflict=False,
        stage_item_input2_conflict=False,
        is_played=is_played,
        is_return_leg=is_return_leg,
        return_leg_match_id=MatchId(return_leg_match_id) if return_leg_match_id else None,
    )


def test_get_aggregate_winner_decided_on_aggregate_score() -> None:
    leg1 = _make_match(-1, 3, 0)
    leg2 = _make_match(-2, 1, 2, is_return_leg=True)  # leg2 input1 == leg1 input2, and vice versa

    # Aggregate: leg1 input1 (3) + leg2 input2 (2) = 5 vs leg1 input2 (0) + leg2 input1 (1) = 1
    winner = leg1.get_aggregate_winner(leg2, away_goals_rule=False)
    assert winner == leg1.stage_item_input1


def test_get_aggregate_winner_tied_falls_back_to_away_goals() -> None:
    leg1 = _make_match(-1, 3, 0)
    leg2 = _make_match(-2, 4, 1)  # aggregate: 3+1=4 vs 0+4=4, tied

    without_rule = leg1.get_aggregate_winner(leg2, away_goals_rule=False)
    assert without_rule is None

    # Away goals: leg1.input2 scored 0 away in leg1, leg2.input2 (== leg1.input1) scored 1 away in leg2
    with_rule = leg1.get_aggregate_winner(leg2, away_goals_rule=True)
    assert with_rule == leg1.stage_item_input1


def test_get_aggregate_winner_tied_including_away_goals_falls_back_to_extra_time() -> None:
    leg1 = _make_match(-1, 2, 2)
    leg2 = _make_match(
        -2,
        2,
        2,
        input1_score_after_extra_time=3,
        input2_score_after_extra_time=2,
    )

    winner = leg1.get_aggregate_winner(leg2, away_goals_rule=True)
    # leg2 input1 (== leg1 input2) won extra time, so leg1.stage_item_input2 advances
    assert winner == leg1.stage_item_input2


def test_get_aggregate_winner_fully_undecided_returns_none() -> None:
    leg1 = _make_match(-1, 1, 1)
    leg2 = _make_match(-2, 1, 1)
    assert leg1.get_aggregate_winner(leg2, away_goals_rule=False) is None


def test_with_irrelevant_extra_time_fields_cleared_two_legged_first_leg_always_cleared() -> None:
    body = MatchBody(
        round_id=RoundId(-1),
        stage_item_input1_score=3,
        stage_item_input2_score=1,
        stage_item_input1_score_after_extra_time=3,
        stage_item_input2_score_after_extra_time=1,
    )
    sibling = _make_match(-2, 0, 0, is_played=False)

    cleared = body.with_irrelevant_extra_time_fields_cleared_two_legged(
        is_return_leg=False, sibling=sibling, away_goals_rule=False
    )
    assert cleared.stage_item_input1_score_after_extra_time is None
    assert cleared.stage_item_input2_score_after_extra_time is None


def test_with_irrelevant_extra_time_fields_cleared_two_legged_second_leg_decided_on_aggregate() -> (
    None
):
    sibling = _make_match(-1, 3, 0)  # first leg
    body = MatchBody(
        round_id=RoundId(-1),
        stage_item_input1_score=0,
        stage_item_input2_score=0,
        stage_item_input1_score_after_extra_time=1,
        stage_item_input2_score_after_extra_time=0,
    )

    # Aggregate: sibling.input1 (3) + body.input2 (0) = 3 vs sibling.input2 (0) + body.input1 (0) = 0
    cleared = body.with_irrelevant_extra_time_fields_cleared_two_legged(
        is_return_leg=True, sibling=sibling, away_goals_rule=False
    )
    assert cleared.stage_item_input1_score_after_extra_time is None
    assert cleared.stage_item_input2_score_after_extra_time is None


def test_with_irrelevant_extra_time_fields_cleared_two_legged_second_leg_kept_when_aggregate_tied() -> (
    None
):
    sibling = _make_match(-1, 3, 0)  # first leg
    body = MatchBody(
        round_id=RoundId(-1),
        stage_item_input1_score=4,
        stage_item_input2_score=1,
        stage_item_input1_score_after_extra_time=4,
        stage_item_input2_score_after_extra_time=1,
    )

    # Aggregate: sibling.input1 (3) + body.input2 (1) = 4 vs sibling.input2 (0) + body.input1 (4) = 4
    kept = body.with_irrelevant_extra_time_fields_cleared_two_legged(
        is_return_leg=True, sibling=sibling, away_goals_rule=False
    )
    assert kept.stage_item_input1_score_after_extra_time == 4
    assert kept.stage_item_input2_score_after_extra_time == 1


def test_with_irrelevant_extra_time_fields_cleared_two_legged_second_leg_decided_by_away_goals() -> (
    None
):
    sibling = _make_match(-1, 3, 0)  # first leg
    body = MatchBody(
        round_id=RoundId(-1),
        stage_item_input1_score=4,
        stage_item_input2_score=1,
        stage_item_input1_score_after_extra_time=4,
        stage_item_input2_score_after_extra_time=1,
    )

    # Same aggregate (4:4) as above, but away goals decide: sibling.input2 (0) != body.input2 (1)
    cleared = body.with_irrelevant_extra_time_fields_cleared_two_legged(
        is_return_leg=True, sibling=sibling, away_goals_rule=True
    )
    assert cleared.stage_item_input1_score_after_extra_time is None
    assert cleared.stage_item_input2_score_after_extra_time is None
