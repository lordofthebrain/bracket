from decimal import Decimal

from heliclockter import datetime_utc, timedelta
from pydantic import BaseModel

from bracket.models.db.court import Court
from bracket.models.db.shared import BaseModelORM
from bracket.models.db.stage_item_inputs import StageItemInput
from bracket.utils.id_types import CourtId, MatchId, RoundId, StageItemInputId
from bracket.utils.types import assert_some


class MatchBaseInsertable(BaseModelORM):
    created: datetime_utc
    start_time: datetime_utc | None = None
    duration_minutes: int
    margin_minutes: int
    custom_duration_minutes: int | None = None
    custom_margin_minutes: int | None = None
    position_in_schedule: int | None = None
    round_id: RoundId
    stage_item_input1_score: int
    stage_item_input2_score: int
    stage_item_input1_score_half_time: int | None = None
    stage_item_input2_score_half_time: int | None = None
    stage_item_input1_score_extra_time_half: int | None = None
    stage_item_input2_score_extra_time_half: int | None = None
    stage_item_input1_score_after_extra_time: int | None = None
    stage_item_input2_score_after_extra_time: int | None = None
    stage_item_input1_score_penalties: int | None = None
    stage_item_input2_score_penalties: int | None = None
    is_played: bool = False
    court_id: CourtId | None = None
    stage_item_input1_conflict: bool
    stage_item_input2_conflict: bool

    @property
    def end_time(self) -> datetime_utc:
        assert self.start_time
        return self.start_time + timedelta(minutes=self.duration_minutes + self.margin_minutes)


class MatchInsertable(MatchBaseInsertable):
    stage_item_input1_id: StageItemInputId | None = None
    stage_item_input2_id: StageItemInputId | None = None
    stage_item_input1_winner_from_match_id: MatchId | None = None
    stage_item_input2_winner_from_match_id: MatchId | None = None


class Match(MatchInsertable):
    id: MatchId
    stage_item_input1: StageItemInput | None = None
    stage_item_input2: StageItemInput | None = None

    def get_winner(self) -> StageItemInput | None:
        if (
            self.stage_item_input1_score_penalties is not None
            and self.stage_item_input2_score_penalties is not None
        ):
            if self.stage_item_input1_score_penalties > self.stage_item_input2_score_penalties:
                return self.stage_item_input1
            if self.stage_item_input1_score_penalties < self.stage_item_input2_score_penalties:
                return self.stage_item_input2
            return None

        if (
            self.stage_item_input1_score_after_extra_time is not None
            and self.stage_item_input2_score_after_extra_time is not None
        ):
            if (
                self.stage_item_input1_score_after_extra_time
                > self.stage_item_input2_score_after_extra_time
            ):
                return self.stage_item_input1
            if (
                self.stage_item_input1_score_after_extra_time
                < self.stage_item_input2_score_after_extra_time
            ):
                return self.stage_item_input2
            return None

        if self.stage_item_input1_score > self.stage_item_input2_score:
            return self.stage_item_input1
        if self.stage_item_input1_score < self.stage_item_input2_score:
            return self.stage_item_input2

        return None


class MatchWithDetails(Match):
    """
    MatchWithDetails has zero or one defined stage item inputs, but not both.
    """

    court: Court | None = None


def get_match_hash(
    stage_item_input1_id: StageItemInputId | None, stage_item_input2_id: StageItemInputId | None
) -> str:
    return f"{stage_item_input1_id}-{stage_item_input2_id}"


class MatchWithDetailsDefinitive(Match):
    stage_item_input1: StageItemInput  # pyrefly: ignore [bad-override]
    stage_item_input2: StageItemInput  # pyrefly: ignore [bad-override]
    court: Court | None = None

    @property
    def stage_item_inputs(self) -> list[StageItemInput]:
        return [self.stage_item_input1, self.stage_item_input2]

    @property
    def stage_item_input_ids(self) -> list[StageItemInputId]:
        return [assert_some(self.stage_item_input1_id), assert_some(self.stage_item_input2_id)]

    def get_input_ids_hashes(self) -> list[str]:
        return [
            get_match_hash(self.stage_item_input1_id, self.stage_item_input2_id),
            get_match_hash(self.stage_item_input2_id, self.stage_item_input1_id),
        ]


class MatchBody(BaseModelORM):
    round_id: RoundId
    stage_item_input1_score: int = 0
    stage_item_input2_score: int = 0
    stage_item_input1_score_half_time: int | None = None
    stage_item_input2_score_half_time: int | None = None
    stage_item_input1_score_extra_time_half: int | None = None
    stage_item_input2_score_extra_time_half: int | None = None
    stage_item_input1_score_after_extra_time: int | None = None
    stage_item_input2_score_after_extra_time: int | None = None
    stage_item_input1_score_penalties: int | None = None
    stage_item_input2_score_penalties: int | None = None
    is_played: bool = True
    court_id: CourtId | None = None
    custom_duration_minutes: int | None = None
    custom_margin_minutes: int | None = None

    def with_irrelevant_extra_time_fields_cleared(self) -> "MatchBody":
        """
        Extra time/penalties fields only make sense when the preceding score was tied
        (e.g. entering them for a decisive 2:1 match would wrongly look like it went to
        extra time). Clears whatever the client sent for fields that don't apply.
        """
        if self.stage_item_input1_score != self.stage_item_input2_score:
            return self.model_copy(
                update={
                    "stage_item_input1_score_extra_time_half": None,
                    "stage_item_input2_score_extra_time_half": None,
                    "stage_item_input1_score_after_extra_time": None,
                    "stage_item_input2_score_after_extra_time": None,
                    "stage_item_input1_score_penalties": None,
                    "stage_item_input2_score_penalties": None,
                }
            )

        has_extra_time = (
            self.stage_item_input1_score_after_extra_time is not None
            and self.stage_item_input2_score_after_extra_time is not None
        )
        updates: dict[str, int | None] = {}
        if not has_extra_time:
            updates["stage_item_input1_score_extra_time_half"] = None
            updates["stage_item_input2_score_extra_time_half"] = None

        extra_time_tied = has_extra_time and (
            self.stage_item_input1_score_after_extra_time
            == self.stage_item_input2_score_after_extra_time
        )
        if has_extra_time and not extra_time_tied:
            updates["stage_item_input1_score_penalties"] = None
            updates["stage_item_input2_score_penalties"] = None

        return self.model_copy(update=updates) if updates else self


class MatchCreateBodyFrontend(BaseModelORM):
    round_id: RoundId
    court_id: CourtId | None = None
    stage_item_input1_id: StageItemInputId | None = None
    stage_item_input2_id: StageItemInputId | None = None
    stage_item_input1_winner_from_match_id: MatchId | None = None
    stage_item_input2_winner_from_match_id: MatchId | None = None


class MatchCreateBody(MatchCreateBodyFrontend):
    duration_minutes: int
    margin_minutes: int
    custom_duration_minutes: int | None = None
    custom_margin_minutes: int | None = None


class MatchRescheduleBody(BaseModelORM):
    old_court_id: CourtId
    old_position: int
    new_court_id: CourtId
    new_position: int


class MatchRoundAssignment(BaseModelORM):
    match_id: MatchId
    round_id: RoundId
    swap_teams: bool = False


class MatchRoundAssignmentsBody(BaseModelORM):
    assignments: list[MatchRoundAssignment]


class MatchWinnerSourceAssignment(BaseModelORM):
    match_id: MatchId
    stage_item_input1_winner_from_match_id: MatchId | None = None
    stage_item_input2_winner_from_match_id: MatchId | None = None


class MatchWinnerSourceAssignmentsBody(BaseModelORM):
    assignments: list[MatchWinnerSourceAssignment]


class MatchFilter(BaseModel):
    elo_diff_threshold: int
    only_recommended: bool
    limit: int
    iterations: int


class SuggestedMatch(BaseModel):
    stage_item_input1: StageItemInput
    stage_item_input2: StageItemInput
    elo_diff: Decimal
    swiss_diff: Decimal
    is_recommended: bool
    times_played_sum: int
    player_behind_schedule_count: int

    @property
    def stage_item_input_ids(self) -> list[int]:
        return [self.stage_item_input1.id, self.stage_item_input2.id]
