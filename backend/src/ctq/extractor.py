"""Deterministic extractor for fully synthetic protocol text.

This is not the critical-data-extractor skill. That package ships without a
license file, and the desktop CtQ Studio path sends protocol text to Claude.
Nothing in this module opens the network or reads a file path from the request.
"""

from __future__ import annotations

import hashlib
import re

DISCLAIMER = "合成研究验证数据，非真实临床试验监查证据"

RBM_CATEGORY_IDS = (
    "INFORMED CONSENT",
    "INCLUSION EXCLUSION",
    "INVESTIGATIONAL PRODUCT",
    "SAFETY REPORTING",
    "PROCEDURES TESTS",
    "VISIT SCHEDULE",
    "CCMEDS",
    "OTHER",
)

_DOMAIN = {
    "知情同意": "INFORMED CONSENT",
    "入排标准": "INCLUSION EXCLUSION",
    "试验用药": "INVESTIGATIONAL PRODUCT",
    "安全性报告": "SAFETY REPORTING",
    "访视与检查": "PROCEDURES TESTS",
    "访视计划": "VISIT SCHEDULE",
    "合并用药": "CCMEDS",
    "其他": "OTHER",
}

_TOKEN = {
    "CONSENT": "INFORMED CONSENT",
    "ELIG": "INCLUSION EXCLUSION",
    "IMP": "INVESTIGATIONAL PRODUCT",
    "SAFETY": "SAFETY REPORTING",
    "PROCEDURE": "PROCEDURES TESTS",
    "VISIT": "VISIT SCHEDULE",
    "CONMED": "CCMEDS",
    "OTHER": "OTHER",
}

_STUDY_RE = re.compile(r"^研究编号[:：]\s*(SYN-[A-Z0-9]+(?:-[A-Z0-9]+)+)\s*$")
_TITLE_RE = re.compile(r"^研究名称[:：]\s*(.+?)\s*$")
_ID_RE = re.compile(r"^[A-Z]+-\d{2,}$")
_NUM_RE = re.compile(r"^[0-9]+(?:\.[0-9]+)?$")
_FORBIDDEN = ("司美格鲁肽", "semaglutide")


class ExtractionError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


def extract_protocol(protocol_text: str) -> dict:
    text = protocol_text if isinstance(protocol_text, str) else ""
    stripped = text.strip()
    if len(stripped) < 40:
        raise ExtractionError("PROTOCOL_TOO_SHORT", "方案文本过短，未生成候选")
    lowered = text.lower()
    if any(marker.lower() in lowered for marker in _FORBIDDEN):
        raise ExtractionError(
            "FORBIDDEN_SOURCE_MARKER",
            "文本含禁止带入的真实方案标记，已拒绝提取",
        )

    study_codes: list[str] = []
    title = ""
    for line in text.splitlines():
        study_match = _STUDY_RE.match(line.strip())
        if study_match:
            study_codes.append(study_match.group(1))
        title_match = _TITLE_RE.match(line.strip())
        if title_match and not title:
            title = title_match.group(1)
    if not study_codes:
        raise ExtractionError(
            "MISSING_SYNTHETIC_STUDY_CODE",
            "缺少以 SYN- 开头的虚构研究编号，未生成候选",
        )
    if len(set(study_codes)) != 1:
        raise ExtractionError("AMBIGUOUS_STUDY_CODE", "研究编号不唯一，未生成候选")

    candidates: list[dict] = []
    seen_ids: set[str] = set()
    for line_no, raw_line in enumerate(text.splitlines(), start=1):
        line = raw_line.strip()
        if not line:
            continue
        kind = _kind_of(line)
        if kind is None:
            continue
        candidates.append(_parse_line(kind, line, line_no, seen_ids))

    if not candidates:
        raise ExtractionError("NO_CANDIDATES", "未识别到关键数据、CtQ 或 QTL/KRI 候选")

    cd_ids = {c["id"] for c in candidates if c["kind"] == "critical_data"}
    ctq_ids = {c["id"] for c in candidates if c["kind"] == "ctq"}
    for candidate in candidates:
        if candidate["kind"] == "ctq":
            missing = [item for item in candidate["linkedCd"] if item not in cd_ids]
            if missing:
                raise ExtractionError(
                    "BROKEN_LINK",
                    f"第 {candidate['line']} 行的 CtQ 引用了不存在的关键数据",
                )
        if candidate["kind"] == "kri" and ctq_ids and candidate["linkedProcess"] not in ctq_ids:
            raise ExtractionError(
                "BROKEN_LINK",
                f"第 {candidate['line']} 行的 KRI 引用了不存在的 CtQ",
            )

    linked = {item for c in candidates if c["kind"] == "ctq" for item in c["linkedCd"]}
    return {
        "studyCode": study_codes[0],
        "studyTitle": title,
        "sourceHash": hashlib.sha256(text.encode("utf-8")).hexdigest(),
        "protocolText": text,
        "candidates": candidates,
        "unlinkedCriticalData": sorted(cd_ids - linked),
        "dataSourceMode": "synthetic",
        "disclaimer": DISCLAIMER,
    }


def _kind_of(line: str) -> str | None:
    if line.startswith("关键数据｜"):
        return "critical_data"
    if line.startswith("CtQ｜"):
        return "ctq"
    if line.startswith("KRI｜"):
        return "kri"
    if line.startswith("QTL｜"):
        return "qtl"
    return None


def _parse_line(kind: str, line: str, line_no: int, seen_ids: set[str]) -> dict:
    parts = [part.strip() for part in line.split("｜")]
    try:
        if kind == "critical_data":
            _need(len(parts) >= 5, line_no)
            candidate_id, domain, item, quote = parts[1], parts[2], parts[3], "｜".join(parts[4:])
            category = _category(domain, line_no)
            parsed = {
                "kind": kind,
                "id": _identifier(candidate_id, line_no, seen_ids),
                "title": item,
                "domain": domain,
                "rbmCategoryId": category,
                "quote": quote,
                "linkedCd": [],
                "linkedProcess": None,
                "suggestedWarning": None,
                "suggestedAction": None,
                "unit": None,
            }
        elif kind == "ctq":
            _need(len(parts) >= 6, line_no)
            candidate_id, token, process, links, quote = (
                parts[1], parts[2], parts[3], parts[4], "｜".join(parts[5:]),
            )
            parsed = {
                "kind": kind,
                "id": _identifier(candidate_id, line_no, seen_ids),
                "title": process,
                "domain": token,
                "rbmCategoryId": _category(token, line_no),
                "quote": quote,
                "linkedCd": _links(links),
                "linkedProcess": None,
                "suggestedWarning": None,
                "suggestedAction": None,
                "unit": None,
            }
        elif kind == "kri":
            _need(len(parts) >= 9, line_no)
            warning = _labeled_number(parts[5], "建议预警", line_no)
            action = _labeled_number(parts[6], "建议行动", line_no)
            parsed = {
                "kind": kind,
                "id": _identifier(parts[1], line_no, seen_ids),
                "title": parts[3],
                "domain": parts[8],
                "rbmCategoryId": _category(parts[8], line_no),
                "quote": parts[4],
                "linkedCd": [],
                "linkedProcess": parts[2],
                "suggestedWarning": warning,
                "suggestedAction": action,
                "unit": parts[7],
            }
        else:
            _need(len(parts) >= 6, line_no)
            cap = _labeled_number(parts[4], "建议上限", line_no)
            category = _category(parts[6], line_no) if len(parts) >= 7 and parts[6] else None
            parsed = {
                "kind": kind,
                "id": _identifier(parts[1], line_no, seen_ids),
                "title": parts[2],
                "domain": parts[6] if category else None,
                "rbmCategoryId": category,
                "quote": parts[3],
                "linkedCd": [],
                "linkedProcess": None,
                "suggestedWarning": None,
                "suggestedAction": cap,
                "unit": parts[5],
            }
    except ExtractionError:
        raise
    except (IndexError, ValueError):
        raise ExtractionError("MALFORMED_CANDIDATE", f"第 {line_no} 行候选格式不正确，未生成计划") from None

    if not parsed["quote"]:
        raise ExtractionError("MALFORMED_CANDIDATE", f"第 {line_no} 行缺少可追溯原文，未生成计划")
    if parsed["quote"] not in line:
        raise ExtractionError("MALFORMED_CANDIDATE", f"第 {line_no} 行原文摘录无法回溯，未生成计划")
    parsed.update({
        "line": line_no,
        "sourceLine": line,
        "approvalStatus": "candidate",
    })
    return parsed


def _need(ok: bool, line_no: int) -> None:
    if not ok:
        raise ExtractionError("MALFORMED_CANDIDATE", f"第 {line_no} 行候选格式不正确，未生成计划")


def _identifier(value: str, line_no: int, seen_ids: set[str]) -> str:
    if not _ID_RE.match(value):
        raise ExtractionError("MALFORMED_CANDIDATE", f"第 {line_no} 行候选编号不正确，未生成计划")
    if value in seen_ids:
        raise ExtractionError("DUPLICATE_CANDIDATE_ID", f"第 {line_no} 行候选编号重复，未生成计划")
    seen_ids.add(value)
    return value


def _category(raw: str, line_no: int) -> str:
    key = raw.strip()
    if key in RBM_CATEGORY_IDS or key in _DOMAIN or key in _TOKEN:
        return _DOMAIN.get(key) or _TOKEN.get(key) or key
    raise ExtractionError("UNKNOWN_CATEGORY", f"第 {line_no} 行无法映射到现有阈值类别，未生成计划")


def _links(raw: str) -> list[str]:
    ids = [item.strip() for item in raw.replace("保护", " ").replace("，", ",").replace("、", ",").split(",")]
    return [item for item in ids if item]


def _labeled_number(field: str, label: str, line_no: int) -> float:
    prefix = f"{label} "
    if not field.startswith(prefix) or not _NUM_RE.match(field[len(prefix):]):
        raise ExtractionError("MALFORMED_CANDIDATE", f"第 {line_no} 行的建议阈值无法解析，未生成计划")
    return float(field[len(prefix):])
