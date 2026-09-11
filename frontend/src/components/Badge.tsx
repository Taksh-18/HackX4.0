import type { ReactNode } from "react";
import type {
  ActionPriority,
  ResponderState,
  RiskLevel,
  VerificationStatus,
} from "../types/incident";

interface ToneStyle {
  bg: string;
  text: string;
  border: string;
}

const TONES: Record<string, ToneStyle> = {
  critical: { bg: "#FEF2F2", text: "#B91C1C", border: "#F87171" },
  amber: { bg: "#FFFBEB", text: "#B45309", border: "#FCD34D" },
  slate: { bg: "#F1F5F9", text: "#334155", border: "#94A3B8" },
  green: { bg: "#F0FDF4", text: "#15803D", border: "#86EFAC" },
  gray: { bg: "#F3F4F6", text: "#4B5563", border: "#D1D5DB" },
};

function Badge({
  tone,
  children,
  bold = true,
}: {
  tone: keyof typeof TONES;
  children: ReactNode;
  bold?: boolean;
}) {
  const t = TONES[tone];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-[2px] border px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${bold ? "font-bold" : "font-semibold"}`}
      style={{ backgroundColor: t.bg, color: t.text, borderColor: t.border }}
    >
      {children}
    </span>
  );
}

const PRIORITY_LABEL: Record<ActionPriority, string> = {
  CRITICAL_DISPATCH: "Critical Dispatch",
  DEPLOY_SCOUT: "Deploy Scout",
  MONITOR: "Monitor",
  SUPPRESSED: "Suppressed",
};

const PRIORITY_TONE: Record<ActionPriority, keyof typeof TONES> = {
  CRITICAL_DISPATCH: "critical",
  DEPLOY_SCOUT: "amber",
  MONITOR: "slate",
  SUPPRESSED: "gray",
};

export function PriorityBadge({ priority }: { priority: ActionPriority }) {
  return <Badge tone={PRIORITY_TONE[priority]}>{PRIORITY_LABEL[priority]}</Badge>;
}

const VERIFICATION_LABEL: Record<VerificationStatus, string> = {
  CORROBORATED: "Corroborated",
  DEVELOPING: "Developing",
  CONTRADICTED: "Contradicted",
};

const VERIFICATION_TONE: Record<VerificationStatus, keyof typeof TONES> = {
  CORROBORATED: "green",
  DEVELOPING: "amber",
  CONTRADICTED: "critical",
};

export function VerificationBadge({ status }: { status: VerificationStatus }) {
  return (
    <Badge tone={VERIFICATION_TONE[status]} bold={false}>
      {VERIFICATION_LABEL[status]}
    </Badge>
  );
}

const RESPONDER_LABEL: Record<ResponderState, string> = {
  UNACKNOWLEDGED: "Unacknowledged",
  ACKNOWLEDGED: "Acknowledged",
  DISPATCHED: "Dispatched",
  RESOLVED: "Resolved",
};

const RESPONDER_TONE: Record<ResponderState, keyof typeof TONES> = {
  UNACKNOWLEDGED: "critical",
  ACKNOWLEDGED: "slate",
  DISPATCHED: "slate",
  RESOLVED: "green",
};

export function ResponderStateBadge({ state }: { state: ResponderState }) {
  return <Badge tone={RESPONDER_TONE[state]}>{RESPONDER_LABEL[state]}</Badge>;
}

const RISK_LABEL: Record<RiskLevel, string> = {
  LOW: "Low Risk",
  MEDIUM: "Medium Risk",
  HIGH: "High Risk",
};

const RISK_TONE: Record<RiskLevel, keyof typeof TONES> = {
  LOW: "gray",
  MEDIUM: "amber",
  HIGH: "critical",
};

export function MisinformationRiskBadge({ level }: { level: RiskLevel }) {
  return <Badge tone={RISK_TONE[level]}>{RISK_LABEL[level]}</Badge>;
}
