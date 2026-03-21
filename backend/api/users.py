from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.db.database import get_db
from backend.db.models import User

logger = logging.getLogger(__name__)
router = APIRouter()


class UserResponse(BaseModel):
    id: int
    username: str

    model_config = {"from_attributes": True}


class CreateUserRequest(BaseModel):
    username: str


@router.get("/users/lookup", response_model=UserResponse)
def lookup_user(username: str, db: Session = Depends(get_db)) -> UserResponse:
    user = db.query(User).filter(User.username.ilike(username)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return UserResponse.model_validate(user)


@router.post("/users", response_model=UserResponse, status_code=201)
def create_user(body: CreateUserRequest, db: Session = Depends(get_db)) -> UserResponse:
    stripped = body.username.strip()
    if not stripped:
        raise HTTPException(status_code=400, detail="Username cannot be empty")

    existing = db.query(User).filter(User.username.ilike(stripped)).first()
    if existing:
        raise HTTPException(status_code=409, detail="Username already taken. Please choose a different name.")

    user = User(username=stripped)
    db.add(user)
    db.commit()
    db.refresh(user)
    logger.info("Created user: %s (id=%d)", user.username, user.id)
    return UserResponse.model_validate(user)
