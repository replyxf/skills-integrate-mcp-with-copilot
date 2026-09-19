import pytest
from fastapi import HTTPException

from src.app import (
    LoginRequest,
    login,
    logout,
    require_teacher,
    sessions,
    signup_for_activity,
    unregister_from_activity,
)


def login_token():
    response = login(
        LoginRequest(username="teacher", password="mergington2026")
    )
    return response["token"]


def setup_function():
    sessions.clear()


def test_login_rejects_invalid_credentials():
    with pytest.raises(HTTPException) as exception:
        login(LoginRequest(username="teacher", password="incorrect"))

    assert exception.value.status_code == 401


def test_registration_requires_teacher_login():
    with pytest.raises(HTTPException) as exception:
        require_teacher()

    assert exception.value.status_code == 401


def test_unregister_requires_teacher_login():
    with pytest.raises(HTTPException) as exception:
        require_teacher("Bearer invalid-token")

    assert exception.value.status_code == 401


def test_teacher_can_register_and_unregister_student():
    token = login_token()
    username = require_teacher(f"Bearer {token}")
    email = "authorized.student@mergington.edu"

    signup_response = signup_for_activity("Chess Club", email, username)
    unregister_response = unregister_from_activity("Chess Club", email, username)

    assert signup_response == {"message": f"Signed up {email} for Chess Club"}
    assert unregister_response == {"message": f"Unregistered {email} from Chess Club"}


def test_logout_invalidates_session():
    token = login_token()
    authorization = f"Bearer {token}"

    assert logout(authorization) == {"message": "Logged out"}
    with pytest.raises(HTTPException) as exception:
        require_teacher(authorization)

    assert exception.value.status_code == 401