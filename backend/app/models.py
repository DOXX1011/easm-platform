from sqlalchemy import Column, Integer, String, Boolean, Text, ForeignKey, TIMESTAMP
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.db.database import Base


class Asset(Base):
    __tablename__ = "assets"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False)
    asset_type = Column(String(20), nullable=False)
    asset_value = Column(String(255), nullable=False)
    status = Column(String(30), nullable=False, default="not_configured")
    created_at = Column(TIMESTAMP, nullable=False, server_default=func.now())
    updated_at = Column(TIMESTAMP, nullable=False, server_default=func.now())

    checks = relationship("AssetCheck", back_populates="asset", cascade="all, delete-orphan")
    scan_runs = relationship("ScanRun", back_populates="asset", cascade="all, delete-orphan")


class AssetCheck(Base):
    __tablename__ = "asset_checks"

    id = Column(Integer, primary_key=True, index=True)
    asset_id = Column(Integer, ForeignKey("assets.id", ondelete="CASCADE"), nullable=False)
    check_type = Column(String(30), nullable=False)
    enabled = Column(Boolean, nullable=False, default=False)
    frequency = Column(String(20), nullable=True)
    last_run_at = Column(TIMESTAMP, nullable=True)
    created_at = Column(TIMESTAMP, nullable=False, server_default=func.now())
    updated_at = Column(TIMESTAMP, nullable=False, server_default=func.now())

    asset = relationship("Asset", back_populates="checks")


class ScanRun(Base):
    __tablename__ = "scan_runs"

    id = Column(Integer, primary_key=True, index=True)
    asset_id = Column(Integer, ForeignKey("assets.id", ondelete="CASCADE"), nullable=False)
    check_type = Column(String(30), nullable=False)
    run_type = Column(String(20), nullable=False)
    status = Column(String(20), nullable=False)
    started_at = Column(TIMESTAMP, nullable=True)
    finished_at = Column(TIMESTAMP, nullable=True)
    summary = Column(Text, nullable=True)
    evidence = Column(JSONB, nullable=True)
    created_at = Column(TIMESTAMP, nullable=False, server_default=func.now())

    asset = relationship("Asset", back_populates="scan_runs")
