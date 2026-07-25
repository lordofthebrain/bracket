from enum import auto
from typing import Any

from heliclockter import datetime_utc
from pydantic import Field, field_validator, model_validator

from bracket.logic.rounds import DEFAULT_ROUND_NAME_PATTERN, is_valid_round_name_pattern
from bracket.models.db.shared import BaseModelORM
from bracket.models.db.stage_item_inputs import StageItemInputCreateBody
from bracket.utils.id_types import RankingId, StageId, StageItemId
from bracket.utils.types import EnumAutoStr


def _validate_round_name_pattern(value: str) -> str:
    if not is_valid_round_name_pattern(value):
        raise ValueError(
            "round_name_pattern must contain exactly one {d} or {0Nd} placeholder "
            "and no other curly braces"
        )
    return value


class StageType(EnumAutoStr):
    ROUND_ROBIN = auto()
    SINGLE_ELIMINATION = auto()
    SWISS = auto()

    @property
    def supports_dynamic_number_of_rounds(self) -> bool:
        return self in [StageType.SWISS]


class StageItemInsertable(BaseModelORM):
    stage_id: StageId
    name: str
    created: datetime_utc
    type: StageType
    team_count: int = Field(ge=2, le=64)
    ranking_id: RankingId | None = None
    double_round_robin: bool = False
    round_name_pattern: str = DEFAULT_ROUND_NAME_PATTERN

    _validate_round_name_pattern = field_validator("round_name_pattern")(
        _validate_round_name_pattern
    )


class StageItem(StageItemInsertable):
    id: StageItemId


class StageItemUpdateBody(BaseModelORM):
    name: str
    ranking_id: RankingId
    round_name_pattern: str = DEFAULT_ROUND_NAME_PATTERN

    _validate_round_name_pattern = field_validator("round_name_pattern")(
        _validate_round_name_pattern
    )


class StageItemActivateNextBody(BaseModelORM):
    adjust_to_time: datetime_utc | None = None


class StageItemCreateBody(BaseModelORM):
    stage_id: StageId
    name: str | None = None
    type: StageType
    team_count: int = Field(ge=2, le=64)
    ranking_id: RankingId | None = None
    double_round_robin: bool = False
    round_name_pattern: str = DEFAULT_ROUND_NAME_PATTERN

    _validate_round_name_pattern = field_validator("round_name_pattern")(
        _validate_round_name_pattern
    )

    def get_name_or_default_name(self) -> str:
        return (
            self.name if self.name is not None else str(self.type.value).replace("_", " ").title()
        )


class StageItemWithInputsCreate(StageItemCreateBody):
    inputs: list[StageItemInputCreateBody]

    def get_name_or_default_name(self) -> str:
        return (
            self.name if self.name is not None else str(self.type.value).replace("_", " ").title()
        )

    @model_validator(mode="before")
    def handle_inputs_length(cls, values: Any) -> Any:
        if ("inputs" in values and "team_count" in values) and (
            len(values["inputs"]) != values["team_count"]
        ):
            raise ValueError("team_count doesn't match length of inputs")
        return values
