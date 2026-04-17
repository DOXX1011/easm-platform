from __future__ import annotations
from typing import Any, Iterable

import dns.resolver

COMMON_DKIM_SELECTORS = [
    "google",
    "selector1",
    "selector2",
    "default",
    "smtp",
    "mail",
    "k1",
]


def _join_txt_record(rdata: Any) -> str:
    try:
        return "".join(
            part.decode("utf-8", errors="ignore") if isinstance(part, bytes) else str(part)
            for part in rdata.strings
        ).strip()
    except Exception:
        return str(rdata).replace('"', "").strip()


def _query_txt(name: str, timeout: float = 3.0) -> list[str]:
    resolver = dns.resolver.Resolver()
    resolver.lifetime = timeout
    resolver.timeout = timeout

    answers = resolver.resolve(name, "TXT")
    return [_join_txt_record(r) for r in answers]


def _first_matching(records: Iterable[str], prefix: str) -> str | None:
    prefix_lower = prefix.lower()
    for record in records:
        if record.lower().startswith(prefix_lower):
            return record
    return None


def _check_spf(domain: str) -> dict[str, Any]:
    try:
        records = _query_txt(domain)
        spf_record = _first_matching(records, "v=spf1")
        return {
            "present": spf_record is not None,
            "record": spf_record,
            "error": None,
        }
    except (dns.resolver.NXDOMAIN, dns.resolver.NoAnswer, dns.resolver.NoNameservers) as exc:
        return {
            "present": False,
            "record": None,
            "error": str(exc),
        }
    except Exception as exc:
        return {
            "present": False,
            "record": None,
            "error": str(exc),
        }


def _check_dmarc(domain: str) -> dict[str, Any]:
    dmarc_name = f"_dmarc.{domain}"
    try:
        records = _query_txt(dmarc_name)
        dmarc_record = _first_matching(records, "v=dmarc1")

        policy = None
        if dmarc_record:
            parts = [part.strip() for part in dmarc_record.split(";")]
            for part in parts:
                if part.lower().startswith("p="):
                    policy = part.split("=", 1)[1].strip()
                    break

        return {
            "present": dmarc_record is not None,
            "record": dmarc_record,
            "policy": policy,
            "query_name": dmarc_name,
            "error": None,
        }
    except (dns.resolver.NXDOMAIN, dns.resolver.NoAnswer, dns.resolver.NoNameservers) as exc:
        return {
            "present": False,
            "record": None,
            "policy": None,
            "query_name": dmarc_name,
            "error": str(exc),
        }
    except Exception as exc:
        return {
            "present": False,
            "record": None,
            "policy": None,
            "query_name": dmarc_name,
            "error": str(exc),
        }


def _check_dkim(domain: str, selectors: list[str] | None = None) -> dict[str, Any]:
    selectors_to_try = selectors or COMMON_DKIM_SELECTORS
    checked: list[str] = []

    for selector in selectors_to_try:
        name = f"{selector}._domainkey.{domain}"
        checked.append(name)
        try:
            records = _query_txt(name)
            dkim_record = _first_matching(records, "v=dkim1")
            if dkim_record:
                return {
                    "present": True,
                    "selector": selector,
                    "query_name": name,
                    "record": dkim_record,
                    "checked_names": checked,
                    "error": None,
                    "method": "selector_lookup",
                }
        except (dns.resolver.NXDOMAIN, dns.resolver.NoAnswer, dns.resolver.NoNameservers):
            continue
        except Exception as exc:
            return {
                "present": False,
                "selector": None,
                "query_name": None,
                "record": None,
                "checked_names": checked,
                "error": str(exc),
                "method": "selector_lookup",
            }

    return {
        "present": False,
        "selector": None,
        "query_name": None,
        "record": None,
        "checked_names": checked,
        "error": None,
        "method": "selector_lookup",
        "note": "DKIM may still exist under a selector not tested by this script.",
    }


def _build_summary(spf: dict[str, Any], dmarc: dict[str, Any], dkim: dict[str, Any]) -> str:
    parts = []

    parts.append("SPF present" if spf["present"] else "SPF missing")
    parts.append("DMARC present" if dmarc["present"] else "DMARC missing")

    if dmarc.get("policy"):
        parts.append(f"DMARC policy={dmarc['policy']}")

    if dkim["present"]:
        selector = dkim.get("selector")
        parts.append(f"DKIM present ({selector})" if selector else "DKIM present")
    else:
        parts.append("DKIM not confirmed")

    return ", ".join(parts)


def run_email_posture_check(domain: str, dkim_selectors: list[str] | None = None) -> dict[str, Any]:
    domain = domain.strip().lower().rstrip(".")

    spf = _check_spf(domain)
    dmarc = _check_dmarc(domain)
    dkim = _check_dkim(domain, dkim_selectors)

    return {
        "target": domain,
        "spf": spf,
        "dmarc": dmarc,
        "dkim": dkim,
        "summary": _build_summary(spf, dmarc, dkim),
    }