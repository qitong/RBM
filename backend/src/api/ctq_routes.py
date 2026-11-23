from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from src.ctq.extractor import DISCLAIMER, ExtractionError, extract_protocol
from src.ctq.service import (
    PlanError,
    approve_draft,
    create_draft,
    get_active,
    list_versions,
    reject_draft,
    rollback_active,
)

router = APIRouter()


class ExtractIn(BaseModel):
    protocolText: str


class DecisionIn(BaseModel):
    candidateId: str
    accept: bool
    warningThreshold: float | None = None
    actionThreshold: float | None = None
    monitoringMethod: str | None = None


class ApproveIn(BaseModel):
    operator: str
    decisions: list[DecisionIn] = Field(default_factory=list)


class RejectIn(BaseModel):
    operator: str
    reason: str


class RollbackIn(BaseModel):
    operator: str
    reason: str
    studyCode: str | None = None


def _fail(status: int, code: str, message: str) -> JSONResponse:
    return JSONResponse(status_code=status, content={
        "ok": False,
        "code": code,
        "message": message,
        "dataSourceMode": "synthetic",
        "disclaimer": DISCLAIMER,
    })


def _from_plan_error(error: PlanError) -> JSONResponse:
    return _fail(error.status, error.code, error.message)


@router.post("/api/ctq/extract")
def extract(body: ExtractIn):
    try:
        parsed = extract_protocol(body.protocolText)
    except ExtractionError as error:
        return _fail(422, error.code, error.message)
    except Exception:
        return _fail(500, "EXTRACT_FAILED", "提取失败，未生成候选或监测计划")
    return create_draft(parsed)


@router.post("/api/ctq/drafts/{draft_id}/approve")
def approve(draft_id: str, body: ApproveIn):
    try:
        return approve_draft(
            draft_id,
            body.operator,
            [item.model_dump() for item in body.decisions],
        )
    except PlanError as error:
        return _from_plan_error(error)


@router.post("/api/ctq/drafts/{draft_id}/reject")
def reject(draft_id: str, body: RejectIn):
    try:
        return reject_draft(draft_id, body.operator, body.reason)
    except PlanError as error:
        return _from_plan_error(error)


@router.post("/api/ctq/active/rollback")
def rollback(body: RollbackIn):
    try:
        return rollback_active(body.operator, body.reason, body.studyCode)
    except PlanError as error:
        return _from_plan_error(error)


@router.get("/api/ctq/active")
def active(studyCode: str | None = None):
    try:
        return get_active(studyCode)
    except PlanError as error:
        return _from_plan_error(error)


@router.get("/api/ctq/versions")
def versions(studyCode: str | None = None):
    return list_versions(studyCode)
