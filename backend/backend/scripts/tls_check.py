import socket
import ssl
from datetime import datetime, timezone
from urllib.parse import urlparse

import requests


SECURITY_HEADERS = [
    "strict-transport-security",
    "content-security-policy",
    "x-frame-options",
    "x-content-type-options",
    "referrer-policy",
    "permissions-policy",
]


def normalize_target(target: str) -> tuple[str, str]:
    target = target.strip()
    if target.startswith("http://") or target.startswith("https://"):
        parsed = urlparse(target)
        host = parsed.hostname or target
        hostname = host
    else:
        hostname = target
    return hostname, hostname


def safe_request(url: str, timeout: float = 5.0, allow_redirects: bool = False):
    try:
        response = requests.get(url, timeout=timeout, allow_redirects=allow_redirects)
        return {
            "reachable": True,
            "status_code": response.status_code,
            "headers": dict(response.headers),
            "final_url": response.url,
        }
    except Exception as exc:
        return {
            "reachable": False,
            "error": str(exc),
        }


def get_certificate_info(hostname: str, port: int = 443, timeout: float = 5.0):
    try:
        context = ssl.create_default_context()
        with socket.create_connection((hostname, port), timeout=timeout) as raw_sock:
            with context.wrap_socket(raw_sock, server_hostname=hostname) as tls_sock:
                cert = tls_sock.getpeercert()

        not_after_raw = cert.get("notAfter")
        expires_at = None
        days_until_expiry = None

        if not_after_raw:
            expires_dt = datetime.strptime(not_after_raw, "%b %d %H:%M:%S %Y %Z").replace(tzinfo=timezone.utc)
            expires_at = expires_dt.isoformat()
            days_until_expiry = (expires_dt - datetime.now(timezone.utc)).days

        return {
            "certificate_present": True,
            "subject": cert.get("subject"),
            "issuer": cert.get("issuer"),
            "expires_at": expires_at,
            "days_until_expiry": days_until_expiry,
        }
    except Exception as exc:
        return {
            "certificate_present": False,
            "error": str(exc),
        }


def build_summary(http_result, https_result, cert_info, header_findings):
    parts = []

    if https_result.get("reachable"):
        parts.append("HTTPS available")
    else:
        parts.append("HTTPS not available")

    if http_result.get("reachable"):
        if http_result.get("redirect_to_https"):
            parts.append("HTTP redirects to HTTPS")
        else:
            parts.append("HTTP does not redirect to HTTPS")

    if cert_info.get("certificate_present"):
        days = cert_info.get("days_until_expiry")
        if days is None:
            parts.append("Certificate detected")
        elif days < 0:
            parts.append("Certificate expired")
        else:
            parts.append(f"Certificate valid, {days} days until expiry")

    missing_headers = [name for name, present in header_findings.items() if not present]
    if missing_headers:
        parts.append("Some security headers missing")
    else:
        parts.append("Key security headers present")

    return ", ".join(parts)


def run_tls_check(target: str):
    hostname, display_target = normalize_target(target)

    http_url = f"http://{hostname}"
    https_url = f"https://{hostname}"

    http_result = safe_request(http_url, allow_redirects=False)
    https_result = safe_request(https_url, allow_redirects=False)

    redirect_to_https = False
    if http_result.get("reachable"):
        location = (http_result.get("headers") or {}).get("Location") or (http_result.get("headers") or {}).get("location")
        if location and location.lower().startswith("https://"):
            redirect_to_https = True

    http_result["redirect_to_https"] = redirect_to_https

    cert_info = get_certificate_info(hostname, 443)

    headers = https_result.get("headers", {}) if https_result.get("reachable") else {}
    normalized_headers = {k.lower(): v for k, v in headers.items()}

    header_findings = {
        header: header in normalized_headers
        for header in SECURITY_HEADERS
    }

    summary = build_summary(http_result, https_result, cert_info, header_findings)

    return {
        "target": display_target,
        "http": {
            "reachable": http_result.get("reachable", False),
            "status_code": http_result.get("status_code"),
            "redirect_to_https": http_result.get("redirect_to_https", False),
            "error": http_result.get("error"),
        },
        "https": {
            "reachable": https_result.get("reachable", False),
            "status_code": https_result.get("status_code"),
            "error": https_result.get("error"),
        },
        "tls": cert_info,
        "headers": header_findings,
        "summary": summary,
    }