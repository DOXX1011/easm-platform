import os
from datetime import datetime

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.db.database import get_db
from app.models import Asset, AssetCheck, ScanRun
from app.schemas import AssetCreate, AssetChecksSaveRequest
from scripts.port_check import run_port_check

app = FastAPI(title="Argus Backend")

cors_origins_env = os.getenv(
    "CORS_ORIGINS",
    "http://192.168.146.129:5173,http://192.168.146.129:5177,http://192.168.146.129:5178,http://localhost:5173,http://127.0.0.1:5173,http://localhost:5177,http://127.0.0.1:5177,http://localhost:5178,http://127.0.0.1:5178"
)
cors_origins = [origin.strip() for origin in cors_origins_env.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_allowed_checks(asset_type: str) -> set[str]:
    mapping = {
        "host": {"ports", "tls"},
        "domain": {"email", "tls"},
        "website": {"ports", "tls"},
    }
    return mapping.get(asset_type, set())


def normalize_status(value: str | None) -> str:
    if value in {"configured", "monitoring_enabled"}:
        return "configured"
    return "not_configured"


@app.get("/")
def root():
    return {"message": "Argus backend is running"}


@app.get("/health/db")
def db_health(db: Session = Depends(get_db)):
    db.execute(text("SELECT 1"))
    return {"status": "ok", "database": "connected"}


@app.get("/assets")
def get_assets(db: Session = Depends(get_db)):
    assets = db.query(Asset).all()
    return [
        {
            "id": asset.id,
            "name": asset.name,
            "asset_type": asset.asset_type,
            "asset_value": asset.asset_value,
            "status": normalize_status(asset.status),
        }
        for asset in assets
    ]


@app.post("/assets")
def create_asset(asset: AssetCreate, db: Session = Depends(get_db)):
    new_asset = Asset(
        name=asset.name,
        asset_type=asset.asset_type,
        asset_value=asset.asset_value,
        status="not_configured"
    )

    db.add(new_asset)
    db.commit()
    db.refresh(new_asset)

    return {
        "id": new_asset.id,
        "name": new_asset.name,
        "asset_type": new_asset.asset_type,
        "asset_value": new_asset.asset_value,
        "status": normalize_status(new_asset.status),
    }


@app.delete("/assets/{asset_id}")
def delete_asset(asset_id: int, db: Session = Depends(get_db)):
    asset = db.query(Asset).filter(Asset.id == asset_id).first()

    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    db.delete(asset)
    db.commit()

    return {"message": f"Asset {asset_id} deleted successfully"}


@app.get("/assets/{asset_id}/checks")
def get_asset_checks(asset_id: int, db: Session = Depends(get_db)):
    asset = db.query(Asset).filter(Asset.id == asset_id).first()

    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    checks = db.query(AssetCheck).filter(AssetCheck.asset_id == asset_id).all()

    return {
        "asset_id": asset_id,
        "asset_type": asset.asset_type,
        "allowed_checks": sorted(list(get_allowed_checks(asset.asset_type))),
        "checks": [
            {
                "id": check.id,
                "check_type": check.check_type,
                "enabled": check.enabled,
                "frequency": check.frequency,
            }
            for check in checks
        ]
    }


@app.post("/assets/{asset_id}/checks")
def save_asset_checks(asset_id: int, payload: AssetChecksSaveRequest, db: Session = Depends(get_db)):
    asset = db.query(Asset).filter(Asset.id == asset_id).first()

    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    allowed_checks = get_allowed_checks(asset.asset_type)

    for item in payload.checks:
        if item.check_type not in allowed_checks:
            raise HTTPException(
                status_code=400,
                detail=f"Check '{item.check_type}' is not allowed for asset type '{asset.asset_type}'"
            )

    for item in payload.checks:
        existing = (
            db.query(AssetCheck)
            .filter(
                AssetCheck.asset_id == asset_id,
                AssetCheck.check_type == item.check_type
            )
            .first()
        )

        if existing:
            existing.enabled = item.enabled
            existing.frequency = item.frequency
        else:
            new_check = AssetCheck(
                asset_id=asset_id,
                check_type=item.check_type,
                enabled=item.enabled,
                frequency=item.frequency
            )
            db.add(new_check)

    db.commit()

    enabled_scheduled_exists = (
        db.query(AssetCheck)
        .filter(
            AssetCheck.asset_id == asset_id,
            AssetCheck.enabled.is_(True),
            AssetCheck.frequency.isnot(None)
        )
        .first()
    )

    asset.status = "configured" if enabled_scheduled_exists else "not_configured"
    db.commit()

    checks = db.query(AssetCheck).filter(AssetCheck.asset_id == asset_id).all()

    return {
        "asset_id": asset_id,
        "asset_type": asset.asset_type,
        "status": normalize_status(asset.status),
        "allowed_checks": sorted(list(allowed_checks)),
        "checks": [
            {
                "id": check.id,
                "check_type": check.check_type,
                "enabled": check.enabled,
                "frequency": check.frequency,
            }
            for check in checks
        ]
    }


@app.post("/assets/{asset_id}/run-now")
def run_now(asset_id: int, db: Session = Depends(get_db)):
    asset = db.query(Asset).filter(Asset.id == asset_id).first()

    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    port_check = (
        db.query(AssetCheck)
        .filter(
            AssetCheck.asset_id == asset_id,
            AssetCheck.check_type == "ports",
            AssetCheck.enabled.is_(True)
        )
        .first()
    )

    if not port_check:
        raise HTTPException(
            status_code=400,
            detail="Run Now currently supports only enabled Port Check"
        )

    scan_run = ScanRun(
        asset_id=asset_id,
        check_type="ports",
        run_type="manual",
        status="queued",
        summary="Manual port check queued"
    )
    db.add(scan_run)
    db.commit()
    db.refresh(scan_run)

    try:
        scan_run.status = "running"
        scan_run.started_at = datetime.utcnow()
        scan_run.summary = "Manual port check running"
        db.commit()

        result = run_port_check(asset.asset_value)

        scan_run.status = "completed"
        scan_run.finished_at = datetime.utcnow()
        scan_run.summary = result["summary"]
        scan_run.evidence = result
        db.commit()
        db.refresh(scan_run)

        return {
            "run_id": scan_run.id,
            "asset_id": asset_id,
            "check_type": "ports",
            "status": scan_run.status,
            "summary": scan_run.summary,
            "evidence": scan_run.evidence,
        }

    except Exception as exc:
        scan_run.status = "failed"
        scan_run.finished_at = datetime.utcnow()
        scan_run.summary = f"Port check failed: {str(exc)}"
        scan_run.evidence = {"error": str(exc)}
        db.commit()

        raise HTTPException(status_code=500, detail="Port check execution failed")


@app.get("/assets/{asset_id}/history")
def get_asset_history(asset_id: int, db: Session = Depends(get_db)):
    asset = db.query(Asset).filter(Asset.id == asset_id).first()

    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    runs = (
        db.query(ScanRun)
        .filter(ScanRun.asset_id == asset_id)
        .order_by(ScanRun.created_at.desc())
        .all()
    )

    return {
        "asset_id": asset_id,
        "asset_name": asset.name,
        "runs": [
            {
                "id": run.id,
                "check_type": run.check_type,
                "run_type": run.run_type,
                "status": run.status,
                "summary": run.summary,
                "started_at": run.started_at.isoformat() if run.started_at else None,
                "finished_at": run.finished_at.isoformat() if run.finished_at else None,
                "created_at": run.created_at.isoformat() if run.created_at else None,
                "evidence": run.evidence,
            }
            for run in runs
        ]
    }
