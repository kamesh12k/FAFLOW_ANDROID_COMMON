"""
Centralized Governance Business Rules & Period Configuration Database Models
"""
from __future__ import annotations

from datetime import datetime
from sqlalchemy import (
    Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text, func
)
from sqlalchemy.orm import relationship

from app.database import Base


class PeriodConfig(Base):
    """Institutional period configuration schedule (Periods 1 to 5+ and breaks)."""
    __tablename__ = "period_configs"

    period_number = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), nullable=False)
    start_time = Column(String(8), nullable=False)  # "09:20"
    end_time = Column(String(8), nullable=False)    # "10:20"
    is_break = Column(Boolean, default=False, nullable=False)
    is_enabled = Column(Boolean, default=True, nullable=False)
    sort_order = Column(Integer, nullable=False, default=1)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class BusinessRule(Base):
    """Authoritative registry of configurable platform thresholds, timings, limits, and scoring values."""
    __tablename__ = "business_rules"

    key = Column(String(100), primary_key=True, index=True)
    category = Column(String(50), nullable=False, index=True)
    display_name = Column(String(150), nullable=False)
    description = Column(Text, nullable=False)
    value = Column(Text, nullable=False)
    data_type = Column(String(30), nullable=False)  # integer, float, boolean, string, time, json, percentage
    unit = Column(String(30), nullable=True)
    minimum = Column(Float, nullable=True)
    maximum = Column(Float, nullable=True)
    default_value = Column(Text, nullable=False)
    is_enabled = Column(Boolean, default=True, nullable=False)
    affected_modules = Column(Text, nullable=False, default="[]")  # JSON array string
    severity = Column(String(20), nullable=False, default="normal")  # low, normal, high, critical
    security_critical = Column(Boolean, default=False, nullable=False)
    requires_restart = Column(Boolean, default=False, nullable=False)
    version = Column(Integer, nullable=False, default=1)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    updated_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    updated_by = relationship("User", foreign_keys=[updated_by_id])
    history = relationship("BusinessRuleHistory", back_populates="rule", cascade="all, delete-orphan", order_by="desc(BusinessRuleHistory.changed_at)")


class BusinessRuleHistory(Base):
    """Immutable audit trail of configuration mutations with before/after diffs and justification."""
    __tablename__ = "business_rule_history"

    id = Column(Integer, primary_key=True, index=True)
    rule_key = Column(String(100), ForeignKey("business_rules.key", ondelete="CASCADE"), nullable=False, index=True)
    version = Column(Integer, nullable=False)
    old_value = Column(Text, nullable=True)
    new_value = Column(Text, nullable=False)
    reason = Column(Text, nullable=False)
    changed_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    changed_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)

    rule = relationship("BusinessRule", back_populates="history")
    changed_by = relationship("User", foreign_keys=[changed_by_id])
