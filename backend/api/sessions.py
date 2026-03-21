from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session as DBSession

from backend.db.database import get_db
from backend.db.models import Session, User

logger = logging.getLogger(__name__)
router = APIRouter()


class SaveSessionRequest(BaseModel):
    user_id: Optional[int] = None
    analysis_mode: str
    trade_count: int
    overtrading_score: float
    loss_aversion_score: float
    revenge_score: float
    calm_score: float


class SessionResponse(BaseModel):
    id: int
    user_id: Optional[int]
    created_at: str
    analysis_mode: str
    trade_count: int
    overtrading_score: float
    loss_aversion_score: float
    revenge_score: float
    calm_score: float

    model_config = {"from_attributes": True}


@router.post("/sessions", response_model=SessionResponse, status_code=201)
def save_session(body: SaveSessionRequest, db: DBSession = Depends(get_db)) -> SessionResponse:
    if body.user_id is not None:
        user = db.query(User).filter(User.id == body.user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

    session = Session(
        user_id=body.user_id,
        analysis_mode=body.analysis_mode,
        trade_count=body.trade_count,
        overtrading_score=body.overtrading_score,
        loss_aversion_score=body.loss_aversion_score,
        revenge_score=body.revenge_score,
        calm_score=body.calm_score,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    logger.info("Saved session id=%d user_id=%s", session.id, body.user_id)
    return SessionResponse(
        id=session.id,
        user_id=session.user_id,
        created_at=session.created_at.isoformat(),
        analysis_mode=session.analysis_mode,
        trade_count=session.trade_count,
        overtrading_score=session.overtrading_score,
        loss_aversion_score=session.loss_aversion_score,
        revenge_score=session.revenge_score,
        calm_score=session.calm_score,
    )


@router.get("/sessions", response_model=list[SessionResponse])
def get_sessions(user_id: int, db: DBSession = Depends(get_db)) -> list[SessionResponse]:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    sessions = (
        db.query(Session)
        .filter(Session.user_id == user_id)
        .order_by(Session.created_at.asc())
        .all()
    )
    return [
        SessionResponse(
            id=s.id,
            user_id=s.user_id,
            created_at=s.created_at.isoformat(),
            analysis_mode=s.analysis_mode,
            trade_count=s.trade_count,
            overtrading_score=s.overtrading_score,
            loss_aversion_score=s.loss_aversion_score,
            revenge_score=s.revenge_score,
            calm_score=s.calm_score,
        )
        for s in sessions
    ]
