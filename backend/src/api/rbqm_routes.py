from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from src.rbqm.service import RbqmError, envelope, get_store
from src.rbqm.synthetic import DISCLAIMER

router = APIRouter()


class TransitionIn(BaseModel):
    toStatus: str
    operator: str
    operatorRole: str = "central_monitor"
    rootCause: str | None = None
    assignee: str | None = None
    dueDate: str | None = None
    actionSummary: str | None = None
    effectivenessNote: str | None = None


class ThresholdRuleIn(BaseModel):
    scope: str
    ctqId: str
    metric: str
    dimension: str
    unit: str
    warningThreshold: float
    actionThreshold: float
    weight: float
    rationale: str = ""


class ThresholdVersionIn(BaseModel):
    operator: str
    operatorRole: str = "rbqm_lead"
    rules: list[ThresholdRuleIn] = Field(default_factory=list)


def _fail(error: RbqmError) -> JSONResponse:
    return JSONResponse(status_code=error.status, content={
        "ok": False,
        "code": error.code,
        "message": error.message,
        "missing": error.missing,
        "fieldErrors": error.field_errors,
        "status": error.current_status,
        "dataSourceMode": "synthetic",
        "isSynthetic": True,
        "disclaimer": DISCLAIMER,
        "fallbackActive": False,
        "configVersion": get_store().config_version,
        "inputBatchHash": get_store().input_batch_hash,
    })


@router.get("/api/rbqm/study")
def study():
    return envelope(get_store().study_view())


@router.get("/api/rbqm/risks")
def risks():
    return envelope(get_store().risks())


@router.get("/api/rbqm/risks/{risk_id}")
def risk_detail(risk_id: str):
    try:
        return envelope(get_store().risk_detail(risk_id))
    except RbqmError as error:
        return _fail(error)


@router.post("/api/rbqm/risks/{risk_id}/transitions")
def transition(risk_id: str, body: TransitionIn):
    try:
        return envelope(get_store().transition(risk_id, body.model_dump()))
    except RbqmError as error:
        return _fail(error)


@router.get("/api/rbqm/tasks")
def tasks():
    return envelope(get_store().tasks())


@router.get("/api/rbqm/actions")
def actions():
    return envelope(get_store().actions())


@router.get("/api/rbqm/capa/efficiency")
def efficiency():
    return envelope(get_store().efficiency())


@router.get("/api/rbqm/audit")
def audit():
    return envelope(get_store().audits())


@router.get("/api/rbqm/thresholds")
def thresholds():
    return envelope(get_store().thresholds())


@router.post("/api/rbqm/thresholds")
def save_thresholds(body: ThresholdVersionIn):
    try:
        saved = get_store().save_thresholds(
            body.operator,
            body.operatorRole,
            [rule.model_dump() for rule in body.rules],
        )
    except RbqmError as error:
        return _fail(error)
    return envelope(saved)


@router.get("/api/rbqm/sites/comparison")
def comparison():
    return envelope(get_store().comparison())
