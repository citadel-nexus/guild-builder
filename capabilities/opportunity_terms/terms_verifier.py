#!/usr/bin/env python3
# ─── CGRF Header ───────────────────────────────────────────────
# File:        capabilities/opportunity_terms/terms_verifier.py
# Stage:       11_COMMIT
# SRS:         SRS-CN-BUILDER-INTEGRATION-001
# CAPS:        pending
# CK:          pending
# Dispatch:    DISP-BUILDER-INTEGRATION-001
# Seat:        BITS-CODEGEN
# Owner:       Citadel Nexus Inc.
# Created:     2026-10-20
# Depends:     .bits/srs/SRS-CN-BUILDER-INTEGRATION-001.md
# EnumType:    Scaffold
# EnumEdges:   DEPENDS_ON .bits/srs/SRS-CN-BUILDER-INTEGRATION-001.md
# DAG Node:    none
# Intent:      Extract exact fee and rights evidence for human review without inferring permission from unsupported legal language.
# ───────────────────────────────────────────────────────────────

"""Extract quoted fee and rights evidence from opportunity listings."""
from __future__ import annotations

import re
from typing import TypedDict


class EntryFee(TypedDict):
    found: bool
    amount: float | None
    currency: str | None
    quote: str | None


class Rights(TypedDict):
    transfer: str
    quote: str | None


class TermsResult(TypedDict):
    entry_fee: EntryFee
    rights: Rights


class InvalidTermsError(ValueError):
    """Report missing or invalid opportunity text."""


_AMOUNT = r"(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?"
_FEE = r"(?:entry|application|submission)\s+fee"
_MONEY = rf"(?:\$\s*{_AMOUNT}|\bUSD\s+{_AMOUNT}|{_AMOUNT}\s+USD\b)"
_FEE_PATTERNS = (
    re.compile(rf"(?P<money>{_MONEY})\s+{_FEE}\b", re.IGNORECASE),
    re.compile(rf"\b{_FEE}\s*(?:(?:is|of)\s+|:\s*)?(?P<money>{_MONEY})(?![\d,])", re.IGNORECASE),
)
_FREE = re.compile(rf"\bno\s+{_FEE}\b", re.IGNORECASE)
_RIGHTS = (
    ("assignment", re.compile(r"\b(?:assigns? all rights|becomes? the property of)\b", re.IGNORECASE)),
    ("license", re.compile(r"\bgrants? a non-exclusive license\b", re.IGNORECASE)),
    ("none", re.compile(r"\bretains? all rights\b", re.IGNORECASE)),
)
_NEGATION = re.compile(r"\b(?:not|never|no)\s*$", re.IGNORECASE)


def detect_terms(text: str) -> TermsResult:
    """Extract supported phrases with exact quotes for human review.

    Args:
        text: Nonempty opportunity listing text.

    Returns:
        Fee and rights evidence. Missing evidence is unknown, not a legal
        assessment. Assignment evidence takes precedence over a license.

    Raises:
        InvalidTermsError: If text is not a nonempty string.
    """
    if not isinstance(text, str) or not text.strip():
        raise InvalidTermsError("Opportunity text must be a nonempty string")

    fee: EntryFee = {"found": False, "amount": None, "currency": None, "quote": None}
    rights: Rights = {"transfer": "unknown", "quote": None}
    for pattern in _FEE_PATTERNS:
        match = pattern.search(text)
        if match:
            amount = re.search(_AMOUNT, match.group("money"))
            if amount:
                fee = {"found": True, "amount": float(amount.group().replace(",", "")),
                       "currency": "USD", "quote": match.group()}
                break
    if not fee["found"]:
        free = _FREE.search(text)
        if free:
            fee["quote"] = free.group()

    for transfer, pattern in _RIGHTS:
        match = next((candidate for candidate in pattern.finditer(text)
                      if not _NEGATION.search(text[:candidate.start()])), None)
        if match:
            rights = {"transfer": transfer, "quote": match.group()}
            break
    return {"entry_fee": fee, "rights": rights}


def _selftest() -> int:
    """Run the capability's original admission examples."""
    checks = (
        detect_terms("The application fee is $75.")["entry_fee"]["amount"] == 75,
        detect_terms("There is no entry fee.")["entry_fee"]["found"] is False,
        detect_terms("The winner grants a non-exclusive license.")["rights"]["transfer"] == "license",
        detect_terms("The winner assigns all rights.")["rights"]["transfer"] == "assignment",
        detect_terms("The winner retains all rights.")["rights"]["transfer"] == "none",
    )
    print(f"selftest: opportunity_terms_verifier — {sum(checks)}/{len(checks)} assertions passed")
    return 0 if all(checks) else 1


def selftest() -> None:
    """Raise on a failed capability admission example."""
    if _selftest():
        raise AssertionError("Opportunity terms self-test failed")


if __name__ == "__main__":
    import sys
    sys.exit(_selftest() if "--selftest" in sys.argv else 0)
