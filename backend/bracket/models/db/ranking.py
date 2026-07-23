from decimal import Decimal
from typing import Literal

from heliclockter import datetime_utc
from pydantic import BaseModel

from bracket.models.db.shared import BaseModelORM
from bracket.utils.id_types import RankingId, TournamentId


class RankingZone(BaseModel):
    label: str
    color: str
    direction: Literal["top", "bottom"]
    count: int


class RankingInsertable(BaseModel):
    tournament_id: TournamentId
    name: str = ""
    win_points: Decimal
    draw_points: Decimal
    loss_points: Decimal
    add_score_points: bool
    position: int
    standings_zones: list[RankingZone] = []


class Ranking(BaseModelORM, RankingInsertable):
    id: RankingId
    created: datetime_utc


class RankingBody(BaseModel):
    name: str = ""
    win_points: Decimal
    draw_points: Decimal
    loss_points: Decimal
    add_score_points: bool
    position: int
    standings_zones: list[RankingZone] = []


class RankingCreateBody(BaseModel):
    name: str = ""
    win_points: Decimal = Decimal("1.0")
    draw_points: Decimal = Decimal("0.5")
    loss_points: Decimal = Decimal("0.0")
    add_score_points: bool = False
    standings_zones: list[RankingZone] = []
