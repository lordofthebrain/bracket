from bracket.models.db.match import Match
from bracket.models.db.stage_item_inputs import StageItemInput
from bracket.models.db.util import StageItemWithRounds
from bracket.sql.matches import (
    sql_set_input_ids_for_match,
)
from bracket.utils.id_types import (
    MatchId,
    RoundId,
)


def resolve_tie_winner(
    match: Match, matches_by_id: dict[MatchId, Match], away_goals_rule: bool
) -> StageItemInput | None:
    """
    `match` is always a first-leg match — only first-leg ids are ever referenced via
    `stage_item_input_winner_from_match_id`. Falls back to the plain single-match winner
    when there's no linked return leg.
    """
    if match.return_leg_match_id is None:
        return match.get_winner()

    return_leg = matches_by_id.get(match.return_leg_match_id)
    if return_leg is None or not match.is_played or not return_leg.is_played:
        # Aggregate score is only meaningful once both legs have actually been played —
        # an unplayed leg's default 0 score would otherwise look like a real result.
        return None

    return match.get_aggregate_winner(return_leg, away_goals_rule)


def _expand_with_return_legs(match_ids: set[MatchId], round_matches: list[Match]) -> set[MatchId]:
    matches_by_id = {match.id: match for match in round_matches}
    expanded = set(match_ids)
    for match_id in match_ids:
        match = matches_by_id.get(match_id)
        if match is not None and match.return_leg_match_id is not None:
            expanded.add(match.return_leg_match_id)
    return expanded


def get_inputs_to_update_in_subsequent_elimination_rounds(
    current_round_id: RoundId,
    stage_item: StageItemWithRounds,
    match_ids: set[MatchId] | None = None,
) -> dict[MatchId, Match]:
    """
    Determine the updates of stage item input IDs in the elimination tree.

    Crucial aspect is that entering a winner for a match will influence matches of subsequent
    rounds, because of the tree-like structure of elimination stage items.
    """
    current_round = next(round_ for round_ in stage_item.rounds if round_.id == current_round_id)
    # A two-legged tie's aggregate winner depends on both legs, so saving either one must pull
    # its sibling leg into `affected_matches` too, even if only one of the two was just edited.
    effective_match_ids = (
        _expand_with_return_legs(match_ids, current_round.matches)
        if match_ids is not None
        else None
    )
    affected_matches: dict[MatchId, Match] = {
        match.id: match
        for match in current_round.matches
        if effective_match_ids is None or match.id in effective_match_ids
    }
    subsequent_rounds = [round_ for round_ in stage_item.rounds if round_.id > current_round.id]
    subsequent_rounds.sort(key=lambda round_: round_.id)
    subsequent_matches = [match for round_ in subsequent_rounds for match in round_.matches]

    # Only matches that actually changed as a result of this round should be returned —
    # `affected_matches` also seeds lookups for `current_round`'s own (unchanged) matches,
    # which must never be re-written with their stale, pre-fetched state.
    changed_matches: dict[MatchId, Match] = {}

    for subsequent_match in subsequent_matches:
        updated_inputs: list[StageItemInput | None] = [
            subsequent_match.stage_item_input1,
            subsequent_match.stage_item_input2,
        ]
        original_inputs = updated_inputs.copy()

        if subsequent_match.stage_item_input1_winner_from_match_id is not None and (
            affected_match1 := affected_matches.get(
                subsequent_match.stage_item_input1_winner_from_match_id
            )
        ):
            updated_inputs[0] = resolve_tie_winner(
                affected_match1, affected_matches, stage_item.away_goals_rule
            )

        if subsequent_match.stage_item_input2_winner_from_match_id is not None and (
            affected_match2 := affected_matches.get(
                subsequent_match.stage_item_input2_winner_from_match_id
            )
        ):
            updated_inputs[1] = resolve_tie_winner(
                affected_match2, affected_matches, stage_item.away_goals_rule
            )

        if original_inputs != updated_inputs:
            input_ids = [input_.id if input_ else None for input_ in updated_inputs]

            updated_match = subsequent_match.model_copy(
                update={
                    "stage_item_input1_id": input_ids[0],
                    "stage_item_input2_id": input_ids[1],
                    "stage_item_input1": updated_inputs[0],
                    "stage_item_input2": updated_inputs[1],
                }
            )
            affected_matches[subsequent_match.id] = updated_match
            changed_matches[subsequent_match.id] = updated_match

    return changed_matches


async def update_inputs_in_subsequent_elimination_rounds(
    current_round_id: RoundId,
    stage_item: StageItemWithRounds,
    match_ids: set[MatchId] | None = None,
) -> None:
    updates = get_inputs_to_update_in_subsequent_elimination_rounds(
        current_round_id, stage_item, match_ids
    )
    for _, match in updates.items():
        await sql_set_input_ids_for_match(
            match.round_id, match.id, [match.stage_item_input1_id, match.stage_item_input2_id]
        )


async def update_inputs_in_complete_elimination_stage_item(
    stage_item: StageItemWithRounds,
) -> None:
    for round_ in stage_item.rounds:
        await update_inputs_in_subsequent_elimination_rounds(round_.id, stage_item)
