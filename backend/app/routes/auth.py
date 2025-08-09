"""
Authentication routes for user login, registration, and management.
"""

from datetime import timedelta
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..core.auth import (
    ACCESS_TOKEN_EXPIRE_MINUTES,
    create_access_token,
    get_current_active_user,
    get_password_hash,
    require_admin_role,
    verify_password,
)
from ..core.database import get_db
from ..models.user import (
    Token,
    User,
    UserCreate,
    UserResponse,
    UserRole,
    UserUpdate,
)

router = APIRouter()


@router.post("/login", response_model=Token)
async def login(user_credentials: dict, db: Session = Depends(get_db)):
    """Login endpoint."""
    user = db.query(User).filter(User.username == user_credentials["username"]).first()
    if not user or not verify_password(
        user_credentials["password"], user.hashed_password
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Inactive user"
        )

    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": UserResponse.from_orm(user),
    }


@router.post("/register", response_model=UserResponse)
async def register(user: UserCreate, db: Session = Depends(get_db)):
    """Register a new user (admin only)."""
    # Check if username already exists
    db_user = db.query(User).filter(User.username == user.username).first()
    if db_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered",
        )

    # Check if email already exists
    db_user = db.query(User).filter(User.email == user.email).first()
    if db_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered"
        )

    # Create new user
    hashed_password = get_password_hash(user.password)
    db_user = User(
        username=user.username,
        email=user.email,
        hashed_password=hashed_password,
        role=user.role,
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    return UserResponse.from_orm(db_user)


@router.get("/users", response_model=List[UserResponse])
async def get_users(
    current_user: User = Depends(require_admin_role), db: Session = Depends(get_db)
):
    """Get all users (admin only)."""
    users = db.query(User).all()
    return [UserResponse.from_orm(user) for user in users]


@router.get("/users/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int,
    current_user: User = Depends(require_admin_role),
    db: Session = Depends(get_db),
):
    """Get a specific user (admin only)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )
    return UserResponse.from_orm(user)


@router.put("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    user_update: UserUpdate,
    current_user: User = Depends(require_admin_role),
    db: Session = Depends(get_db),
):
    """Update a user (admin only)."""
    db_user = db.query(User).filter(User.id == user_id).first()
    if not db_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )

    # Update fields if provided
    if user_update.username is not None:
        # Check if new username already exists
        existing_user = (
            db.query(User)
            .filter(User.username == user_update.username, User.id != user_id)
            .first()
        )
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already exists",
            )
        db_user.username = user_update.username

    if user_update.email is not None:
        # Check if new email already exists
        existing_user = (
            db.query(User)
            .filter(User.email == user_update.email, User.id != user_id)
            .first()
        )
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Email already exists"
            )
        db_user.email = user_update.email

    if user_update.password is not None:
        db_user.hashed_password = get_password_hash(user_update.password)

    if user_update.role is not None:
        db_user.role = user_update.role

    if user_update.is_active is not None:
        db_user.is_active = user_update.is_active

    db.commit()
    db.refresh(db_user)
    return UserResponse.from_orm(db_user)


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: int,
    current_user: User = Depends(require_admin_role),
    db: Session = Depends(get_db),
):
    """Delete a user (admin only)."""
    if current_user.id == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot delete yourself"
        )

    db_user = db.query(User).filter(User.id == user_id).first()
    if not db_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )

    db.delete(db_user)
    db.commit()
    return {"message": "User deleted successfully"}


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_active_user)):
    """Get current user information."""
    return UserResponse.from_orm(current_user)


@router.put("/me/admin-state")
async def update_admin_state(
    admin_state: dict,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Update admin state for the current user."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can update admin state",
        )

    current_user.admin_state = admin_state
    db.commit()
    db.refresh(current_user)

    return {"message": "Admin state updated successfully"}


@router.get("/me/admin-state")
async def get_admin_state(current_user: User = Depends(get_current_active_user)):
    """Get admin state for the current user."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can access admin state",
        )

    return {"admin_state": current_user.admin_state or {}}
