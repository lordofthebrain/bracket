from bracket.logic.ranking.elimination import get_inputs_to_update_in_subsequent_elimination_rounds
from bracket.models.db.match import MatchWithDetails
from bracket.models.db.util import RoundWithMatches
from bracket.utils.dummy_records import DUMMY_MOCK_TIME
from bracket.utils.id_types import (
    MatchId,
    RoundId,
    StageItemId,
    TournamentId,
)
from tests.unit_tests.mocks import (
    get_2_definitive_and_2_tentative_matches_mock,
    get_one_round_with_two_definitive_matches,
    get_stage_item_inputs_mock,
    get_stage_item_mock,
    get_two_round_with_one_tentative_match_each,
)


def test_elimination_input_updates() -> None:
    tournament_id = TournamentId(-1)
    stage_item_inputs = get_stage_item_inputs_mock(tournament_id)
    matches = get_2_definitive_and_2_tentative_matches_mock(stage_item_inputs)
    rounds = [
        get_one_round_with_two_definitive_matches(matches[0], matches[1]),
        *get_two_round_with_one_tentative_match_each(matches[2], matches[3]),
    ]

    updates = get_inputs_to_update_in_subsequent_elimination_rounds(
        RoundId(-3),
        get_stage_item_mock(stage_item_inputs, rounds),
        {matches[0].id, matches[1].id},
    )

    assert updates == {
        matches[2].id: matches[2].model_copy(
            update={
                "stage_item_input1_id": stage_item_inputs[0].id,
                "stage_item_input2_id": stage_item_inputs[3].id,
                "stage_item_input1": stage_item_inputs[0],
                "stage_item_input2": stage_item_inputs[3],
            }
        ),
        matches[3].id: matches[3].model_copy(
            update={
                "stage_item_input1_id": stage_item_inputs[3].id,
                "stage_item_input2_id": stage_item_inputs[0].id,
                "stage_item_input1": stage_item_inputs[3],
                "stage_item_input2": stage_item_inputs[0],
            }
        ),
    }


def test_elimination_input_updates_for_two_legged_tie() -> None:
    tournament_id = TournamentId(-1)
    stage_item_inputs = get_stage_item_inputs_mock(tournament_id)

    leg1 = MatchWithDetails(
        id=MatchId(-1),
        stage_item_input1=stage_item_inputs[0],
        stage_item_input2=stage_item_inputs[1],
        stage_item_input1_id=stage_item_inputs[0].id,
        stage_item_input2_id=stage_item_inputs[1].id,
        created=DUMMY_MOCK_TIME,
        duration_minutes=90,
        margin_minutes=15,
        round_id=RoundId(-3),
        stage_item_input1_score=3,
        stage_item_input2_score=0,
        stage_item_input1_conflict=False,
        stage_item_input2_conflict=False,
        is_played=True,
        return_leg_match_id=MatchId(-2),
    )
    leg2 = MatchWithDetails(
        id=MatchId(-2),
        stage_item_input1=stage_item_inputs[1],
        stage_item_input2=stage_item_inputs[0],
        stage_item_input1_id=stage_item_inputs[1].id,
        stage_item_input2_id=stage_item_inputs[0].id,
        created=DUMMY_MOCK_TIME,
        duration_minutes=90,
        margin_minutes=15,
        round_id=RoundId(-3),
        stage_item_input1_score=1,
        stage_item_input2_score=1,
        stage_item_input1_conflict=False,
        stage_item_input2_conflict=False,
        is_played=True,
        is_return_leg=True,
        return_leg_match_id=MatchId(-1),
    )
    # Aggregate: input0 (3+1=4) vs input1 (0+1=1) -> input0 advances.
    subsequent_match = MatchWithDetails(
        id=MatchId(-3),
        created=DUMMY_MOCK_TIME,
        duration_minutes=90,
        margin_minutes=15,
        round_id=RoundId(-2),
        stage_item_input1_score=0,
        stage_item_input2_score=0,
        stage_item_input1_conflict=False,
        stage_item_input2_conflict=False,
        stage_item_input1_winner_from_match_id=leg1.id,
    )
    rounds = [
        RoundWithMatches(
            id=RoundId(-3),
            matches=[leg1, leg2],
            stage_item_id=StageItemId(-1),
            created=DUMMY_MOCK_TIME,
            is_draft=False,
            name="",
        ),
        RoundWithMatches(
            id=RoundId(-2),
            matches=[subsequent_match],
            stage_item_id=StageItemId(-1),
            created=DUMMY_MOCK_TIME,
            is_draft=False,
            name="",
        ),
    ]
    stage_item = get_stage_item_mock(stage_item_inputs, rounds).model_copy(
        update={"two_legged": True, "away_goals_rule": True}
    )

    # Passing only the return leg's id (as if the user just saved leg2) must still resolve the
    # tie via its linked first leg, not just the literally-edited match.
    updates = get_inputs_to_update_in_subsequent_elimination_rounds(
        RoundId(-3), stage_item, {leg2.id}
    )

    assert updates == {
        subsequent_match.id: subsequent_match.model_copy(
            update={
                "stage_item_input1_id": stage_item_inputs[0].id,
                "stage_item_input1": stage_item_inputs[0],
            }
        ),
    }
