from typing import Literal

from heliclockter import datetime_utc

from bracket.models.db.shared import BaseModelORM
from bracket.utils.id_types import StageId, TournamentId


class StageInsertable(BaseModelORM):
    tournament_id: TournamentId
    name: str
    created: datetime_utc
    is_active: bool
    is_season: bool = True


class Stage(StageInsertable):
    id: StageId


class StageUpdateBody(BaseModelORM):
    name: str
    is_season: bool = True


class StageActivateBody(BaseModelORM):
    direction: Literal["next", "previous"] = "next"
