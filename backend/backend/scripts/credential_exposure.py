from __future__ import annotations

import hashlib
import os
from urllib.parse import quote

import requests


HIBP_BREACHED_ACCOUNT_URL = "https://haveibeenpwned.com/api/v3/breachedaccount/{account}"
HIBP_PWNED_PASSWORDS_RANGE_URL = "https://api.pwnedpasswords.com/range/{prefix}"
REQUEST_TIMEOUT_SECONDS = 10


class CredentialExposureError(Exception):
    def __init__(self, message: str, status_code: int = 500):
        super().__init__(message)
        self.status_code = status_code


def _get_hibp_user_agent() -> str:
    return (os.getenv("HIBP_USER_AGENT") or "Argus-Capstone-Project").strip()


def check_email_exposure(email: str) -> dict[str, object]:
    normalized_email = (email or "").strip().lower()
    if not normalized_email:
        raise ValueError("Email is required")

    hibp_api_key = (os.getenv("HIBP_API_KEY") or "").strip()
    if not hibp_api_key:
        raise CredentialExposureError("HIBP_API_KEY is not configured on the server", status_code=500)

    encoded_email = quote(normalized_email, safe="")
    url = HIBP_BREACHED_ACCOUNT_URL.format(account=encoded_email)

    headers = {
        "hibp-api-key": hibp_api_key,
        "user-agent": _get_hibp_user_agent(),
    }

    try:
        response = requests.get(
            url,
            headers=headers,
            params={"truncateResponse": "true"},
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
    except requests.RequestException as exc:
        raise CredentialExposureError("Failed to reach HIBP service", status_code=502) from exc

    if response.status_code == 404:
        return {
            "found": False,
            "breach_count": 0,
            "breaches": [],
        }

    if response.status_code in (401, 403):
        raise CredentialExposureError(
            "HIBP authentication failed (check API key or account permissions)",
            status_code=502,
        )

    if response.status_code != 200:
        raise CredentialExposureError(
            f"HIBP email check failed with status {response.status_code}",
            status_code=502,
        )

    try:
        payload = response.json()
    except ValueError as exc:
        raise CredentialExposureError("HIBP returned an invalid response", status_code=502) from exc

    breaches = payload if isinstance(payload, list) else []
    breach_names = []

    for item in breaches:
        if not isinstance(item, dict):
            continue
        name = item.get("Name") or item.get("Title")
        if isinstance(name, str) and name.strip():
            breach_names.append(name.strip())

    unique_names = sorted(set(breach_names))

    return {
        "found": len(unique_names) > 0,
        "breach_count": len(unique_names),
        "breaches": unique_names,
    }


def check_password_exposure(password: str) -> dict[str, object]:
    if not password:
        raise ValueError("Password is required")

    sha1_hash = hashlib.sha1(password.encode("utf-8")).hexdigest().upper()
    prefix, suffix = sha1_hash[:5], sha1_hash[5:]

    headers = {
        "Add-Padding": "true",
        "user-agent": _get_hibp_user_agent(),
    }

    url = HIBP_PWNED_PASSWORDS_RANGE_URL.format(prefix=prefix)

    try:
        response = requests.get(url, headers=headers, timeout=REQUEST_TIMEOUT_SECONDS)
    except requests.RequestException as exc:
        raise CredentialExposureError("Failed to reach HIBP service", status_code=502) from exc

    if response.status_code != 200:
        raise CredentialExposureError(
            f"HIBP password check failed with status {response.status_code}",
            status_code=502,
        )

    match_count = 0

    for line in response.text.splitlines():
        if not line or ":" not in line:
            continue

        line_suffix, line_count = line.split(":", 1)
        if line_suffix.strip().upper() != suffix:
            continue

        try:
            match_count = int(line_count.strip())
        except ValueError:
            match_count = 0
        break

    return {
        "exposed": match_count > 0,
        "count": match_count,
    }
