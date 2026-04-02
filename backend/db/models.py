from __future__ import annotations

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.sql import func

from backend.db.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Session(Base):
    __tablename__ = "sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    analysis_mode = Column(String, nullable=False, default="mixed")
    trade_count = Column(Integer, nullable=False)
    overtrading_score = Column(Float, nullable=False)
    loss_aversion_score = Column(Float, nullable=False)
    revenge_score = Column(Float, nullable=False)
    calm_score = Column(Float, nullable=False)
