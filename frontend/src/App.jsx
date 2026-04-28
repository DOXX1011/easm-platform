import { useEffect, useState } from "react";
import { Grid, Box, KeyRound, Eye, Clock3, Shield } from "lucide-react";
import CTIPage from "@/components/cti/CTIPage";
import HistoryPage from "@/components/history/HistoryPage";
import CredentialExposurePage from "@/components/credentials/CredentialExposurePage";
import AddAssetModal from "@/components/modals/AddAssetModal";
import ConfigureChecksModal from "@/components/modals/ConfigureChecksModal";
import FindingsBySeverity from "@/components/home/FindingsBySeverity";
import RecentScanActivity from "@/components/home/RecentScanActivity";
import { computeHomeMetrics } from "@/components/home/homeHelpers";
import {
  getAssets,
  createAsset,
  deleteAsset,
  getAssetChecks,
  saveAssetChecks,
  runAssetNow,
  getAssetHistory,
  checkCredentialExposureEmail,
  checkCredentialExposurePassword,
} from "@/lib/assetsApi";

const navItems = [
  { id: "overview", label: "Home", icon: Grid },
  { id: "assets", label: "Assets", icon: Box },
  { id: "history", label: "History", icon: Clock3 },
  { id: "credentials", label: "Credential Exposure", icon: KeyRound },
  { id: "cti", label: "CTI Decision Support", icon: Shield },
];

const frequencyOptions = ["1 min", "15 min", "1 hour", "6 hours", "Daily"];

const frequencyLabelToApi = {
  "1 min": "1min",
  "15 min": "15min",
  "1 hour": "1hour",
  "6 hours": "6hours",
  Daily: "daily",
};

const frequencyApiToLabel = {
  "1min": "1 min",
  "15min": "15 min",
  "1hour": "1 hour",
  "6hours": "6 hours",
  "daily": "Daily",
};

const assetTypeOptions = [
  { value: "host", label: "Host / Server" },
  { value: "domain", label: "Domain" },
  { value: "website", label: "Website" },
];

const checkDefinitions = [
  { key: "ports", label: "Port / Service Monitoring" },
  { key: "email", label: "Email Posture" },
  { key: "tls", label: "TLS / HTTPS" },
];

const availabilityByType = {
  host: { ports: true, email: false, tls: false },
  domain: { ports: false, email: true, tls: false },
  website: { ports: false, email: false, tls: true },
};

function toApiFrequency(label) {
  return frequencyLabelToApi[label] || "daily";
}

function toUiFrequency(value) {
  return frequencyApiToLabel[value] || "Daily";
}

function getAvailability(type, allowedChecks = null) {
  const fallback = availabilityByType[type] || { ports: false, email: false, tls: false };

  if (!Array.isArray(allowedChecks) || allowedChecks.length === 0) {
    return fallback;
  }

  return {
    ports: fallback.ports && allowedChecks.includes("ports"),
    email: fallback.email && allowedChecks.includes("email"),
    tls: fallback.tls && allowedChecks.includes("tls"),
  };
}

function createChecksForType(type, allowedChecks = null) {
  const availability = getAvailability(type, allowedChecks);

  return {
    ports: {
      available: availability.ports,
      enabled: false,
      frequency: null,
    },
    email: {
      available: availability.email,
      enabled: false,
      frequency: null,
    },
    tls: {
      available: availability.tls,
      enabled: false,
      frequency: null,
    },
  };
}

function getStatusFromChecks(checks) {
  const hasEnabledScheduled = Object.values(checks).some(
    (check) => check.available && check.enabled && check.frequency
  );

  return hasEnabledScheduled ? "configured" : "not_configured";
}

function normalizeStatus(status) {
  if (!status) return null;

  if (status === "configured" || status === "monitoring_enabled") {
    return "configured";
  }

  return "not_configured";
}

function getAssetTypeLabel(type) {
  return assetTypeOptions.find((item) => item.value === type)?.label || type;
}

// Helper: format the display label for an asset in selectors and dropdowns
function formatAssetOptionLabel(asset) {
  if (!asset) return "";

  const name = asset.name || asset.target || "";
  const address = asset.target || asset.name || "";
  const rawType = String(asset.type || "").toLowerCase();
  const typeLabel = rawType === "host" ? "Server" : rawType === "website" ? "Website" : rawType === "domain" ? "Domain" : getAssetTypeLabel(rawType);

  return `${name} (${address}) - ${typeLabel}`;
}

import { formatServiceLabel, formatHistoryDate, formatHistoryDateTime, getHistoryCheckLabel } from "@/components/history/historyHelpers";

const securityHeaderLabelMap = {
  "strict-transport-security": "HSTS",
  "content-security-policy": "Content-Security-Policy",
  "x-frame-options": "X-Frame-Options",
  "x-content-type-options": "X-Content-Type-Options",
  "referrer-policy": "Referrer-Policy",
  "permissions-policy": "Permissions-Policy",
};

function formatSecurityHeaderLabel(headerName) {
  if (!headerName) return "Unknown header";

  const normalized = String(headerName).trim().toLowerCase();
  if (securityHeaderLabelMap[normalized]) {
    return securityHeaderLabelMap[normalized];
  }

  return normalized
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("-");
}

function normalizeList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function parseBooleanLike(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value > 0;

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (["true", "yes", "ok", "up", "reachable", "present", "valid", "enabled"].includes(normalized)) {
      return true;
    }

    if (["false", "no", "down", "unreachable", "missing", "invalid", "disabled"].includes(normalized)) {
      return false;
    }
  }

  return null;
}

function firstKnownBoolean(...values) {
  for (const value of values) {
    const parsed = parseBooleanLike(value);
    if (parsed !== null) return parsed;
  }
  return null;
}

function firstMeaningful(...values) {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    if (typeof value === "string" && !value.trim()) continue;
    return value;
  }
  return null;
}

function uniqueList(values) {
  return [...new Set(values.map((value) => String(value).trim()).filter(Boolean))];
}

function extractHeaderPosture(headersData) {
  if (!headersData || typeof headersData !== "object") {
    return { present: [], missing: [], presentRaw: [], missingRaw: [] };
  }

  const explicitMissing = normalizeList(
    headersData?.missing_headers ?? headersData?.missing ?? headersData?.absent
  );
  const explicitPresent = normalizeList(
    headersData?.present_headers ?? headersData?.present ?? headersData?.detected
  );

  const present = [...explicitPresent];
  const missing = [...explicitMissing];

  const explicitKeys = new Set([
    "present",
    "present_headers",
    "detected",
    "missing",
    "missing_headers",
    "absent",
  ]);

  Object.entries(headersData).forEach(([key, value]) => {
    if (explicitKeys.has(key)) return;

    const parsed = parseBooleanLike(value);
    if (parsed === true) {
      present.push(key);
    }
    if (parsed === false) {
      missing.push(key);
    }
  });

  const presentRaw = uniqueList(present);
  const missingRaw = uniqueList(missing);

  return {
    present: presentRaw.map(formatSecurityHeaderLabel),
    missing: missingRaw.map(formatSecurityHeaderLabel),
    presentRaw,
    missingRaw,
  };
}

function formatCertificateParty(value, { preferIssuer = false } = {}) {
  if (value === undefined || value === null) return "-";

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return "-";

    const cnMatch = trimmed.match(/(?:^|[,/])\s*CN\s*=\s*([^,/]+)/i);
    const orgMatch = trimmed.match(/(?:^|[,/])\s*O\s*=\s*([^,/]+)/i);

    if (preferIssuer && orgMatch && cnMatch) {
      return `${orgMatch[1].trim()} (${cnMatch[1].trim()})`;
    }

    if (cnMatch) {
      return cnMatch[1].trim();
    }

    return trimmed;
  }

  if (typeof value === "object") {
    const cn = firstMeaningful(value.CN, value.cn, value.common_name, value.commonName);
    const org = firstMeaningful(
      value.O,
      value.o,
      value.organization,
      value.organisation,
      value.org,
      value.company
    );

    if (preferIssuer && org && cn) {
      return `${org} (${cn})`;
    }

    if (cn) {
      return String(cn);
    }

    if (org) {
      return String(org);
    }

    const firstString = Object.values(value).find(
      (entry) => typeof entry === "string" && entry.trim()
    );

    return firstString ? String(firstString).trim() : "-";
  }

  return String(value);
}



function getScanTimeValue(run) {
  return firstMeaningful(run?.finished_at, run?.started_at, run?.created_at);
}

function getRunTimeMs(run) {
  const value = getScanTimeValue(run);
  if (!value) return 0;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function getTlsDetails(evidence) {
  const httpData = evidence?.http && typeof evidence.http === "object" ? evidence.http : null;
  const httpsData = evidence?.https && typeof evidence.https === "object" ? evidence.https : null;
  const tlsData = evidence?.tls && typeof evidence.tls === "object" ? evidence.tls : null;
  const headersData =
    evidence?.headers && typeof evidence.headers === "object" ? evidence.headers : null;

  const httpReachable = firstKnownBoolean(
    httpData?.reachable,
    httpData?.available,
    httpData?.ok,
    httpData?.status
  );

  const httpsReachable = firstKnownBoolean(
    httpsData?.reachable,
    httpsData?.available,
    httpsData?.ok,
    httpsData?.status,
    tlsData?.https_available
  );

  const redirectToHttps = firstKnownBoolean(
    httpData?.redirect_to_https,
    httpsData?.redirect_from_http,
    tlsData?.redirect_to_https,
    tlsData?.http_redirects_to_https
  );

  const certData =
    tlsData?.certificate && typeof tlsData.certificate === "object" ? tlsData.certificate : null;

  const certificatePresent = firstKnownBoolean(
    certData?.present,
    tlsData?.certificate_present,
    tlsData?.present
  );

  const certificateValid = firstKnownBoolean(
    certData?.valid,
    tlsData?.certificate_valid,
    tlsData?.valid
  );

  const certificateSubject = formatCertificateParty(
    firstMeaningful(certData?.subject, tlsData?.subject)
  );
  const certificateIssuer = formatCertificateParty(
    firstMeaningful(certData?.issuer, tlsData?.issuer),
    { preferIssuer: true }
  );
  const certificateExpiry = firstMeaningful(
    certData?.expiry,
    certData?.expires_at,
    tlsData?.expiry,
    tlsData?.expires_at
  );
  const daysUntilExpiry = firstMeaningful(
    certData?.days_until_expiry,
    certData?.days_left,
    tlsData?.days_until_expiry,
    tlsData?.days_left
  );

  const headerPosture = extractHeaderPosture(headersData);

  return {
    connectivity: {
      httpReachable,
      httpsReachable,
      redirectToHttps,
    },
    certificate: {
      present: certificatePresent,
      valid: certificateValid,
      subject: certificateSubject,
      issuer: certificateIssuer,
      expiry: certificateExpiry,
      daysUntilExpiry,
    },
    headers: {
      present: headerPosture.present,
      missing: headerPosture.missing,
      presentRaw: headerPosture.presentRaw,
      missingRaw: headerPosture.missingRaw,
    },
  };
}

function getTlsSummaryItems(run) {
  const evidence = run.evidence && typeof run.evidence === "object" ? run.evidence : null;
  const tlsDetails = getTlsDetails(evidence);
  const items = [];

  if (tlsDetails.connectivity.httpsReachable === true) {
    items.push("HTTPS available");
  } else if (tlsDetails.connectivity.httpsReachable === false) {
    items.push("HTTPS unavailable");
  }

  if (tlsDetails.connectivity.redirectToHttps === true) {
    items.push("redirect enabled");
  } else if (tlsDetails.connectivity.redirectToHttps === false) {
    items.push("redirect missing");
  }

  if (tlsDetails.certificate.present === true) {
    if (tlsDetails.certificate.valid === true) {
      if (tlsDetails.certificate.daysUntilExpiry !== null && tlsDetails.certificate.daysUntilExpiry !== undefined) {
        items.push(`Certificate valid (${tlsDetails.certificate.daysUntilExpiry} days left)`);
      } else {
        items.push("Certificate valid");
      }
    } else if (tlsDetails.certificate.valid === false) {
      items.push("Certificate invalid");
    } else {
      items.push("Certificate present");
    }
  } else if (tlsDetails.certificate.present === false) {
    items.push("Certificate not present");
  }

  if (tlsDetails.headers.missing.length > 0) {
    items.push(`${tlsDetails.headers.missing.length} security headers missing`);
  } else if (tlsDetails.headers.present.length > 0) {
    items.push("security headers complete");
  }

  if (items.length === 0) {
    return [run.summary || "TLS check result available"];
  }

  return items;
}

function getHistorySummary(run) {
  if (run.check_type === "tls") {
    const items = getTlsSummaryItems(run);
    return items.slice(0, 3).join(", ") || run.summary || "TLS check result available";
  }

  if (run.check_type === "email") {
    const evidence = run.evidence && typeof run.evidence === "object" ? run.evidence : null;

    const spfData = evidence?.spf && typeof evidence.spf === "object" ? evidence.spf : null;
    const dmarcData = evidence?.dmarc && typeof evidence.dmarc === "object" ? evidence.dmarc : null;
    const dkimData = evidence?.dkim && typeof evidence.dkim === "object" ? evidence.dkim : null;

    const spfPresent = parseBooleanLike(spfData?.present) === true;
    const dmarcPresent = parseBooleanLike(dmarcData?.present) === true;
    const dkimPresent = parseBooleanLike(dkimData?.present) === true;

    const presentCount = [spfPresent, dmarcPresent, dkimPresent].filter(Boolean).length;

    if (presentCount === 3) {
      return "SPF, DMARC and DKIM configured";
    }

    if (presentCount === 2) {
      if (!spfPresent) return "DMARC and DKIM configured, SPF missing";
      if (!dmarcPresent) return "SPF and DKIM configured, DMARC missing";
      return "SPF and DMARC configured, DKIM missing";
    }

    if (presentCount === 1) {
      if (spfPresent) return "Only SPF configured";
      if (dmarcPresent) return "Only DMARC configured";
      return "Only DKIM configured";
    }

    return "SPF, DMARC and DKIM missing";
  }

  if (run.check_type !== "ports") {
    return run.summary || "No summary";
  }

  const evidence = run.evidence && typeof run.evidence === "object" ? run.evidence : null;
  const findings = Array.isArray(evidence?.findings) ? evidence.findings : [];

  if (findings.length === 0) {
    return run.summary || "No summary";
  }

  const webServices = new Set(["http", "https", "http-alt", "https-alt"]);
  const allWeb = findings.every((finding) => webServices.has(finding.service));

  if (allWeb) {
    const ports = findings
      .map((finding) => finding.port)
      .filter((port) => port !== undefined && port !== null)
      .join(", ");
    return ports ? `Web services detected on ${ports}` : `${findings.length} services detected`;
  }

  return `${findings.length} services detected`;
}

function PageHeading({ title, subtitle }) {
  return (
    <div className="mb-7">
      <h2 className="page-title text-3xl font-black uppercase tracking-tight text-white md:text-[2.1rem]">
        {title}
      </h2>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-400">{subtitle}</p>
    </div>
  );
}

function toSafeNonNegativeNumber(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed < 0 ? 0 : parsed;
}

function normalizeCredentialEmailResult(payload) {
  const breachNames = uniqueList(
    [
      ...(Array.isArray(payload?.breach_names) ? payload.breach_names : []),
      ...(Array.isArray(payload?.breaches)
        ? payload.breaches.map((entry) => (typeof entry === "string" ? entry : entry?.name))
        : []),
    ].filter(Boolean)
  );

  const breachCount =
    toSafeNonNegativeNumber(
      firstMeaningful(payload?.breach_count, payload?.count, payload?.total, payload?.hits)
    ) ?? breachNames.length;

  const statusRaw = String(firstMeaningful(payload?.status, payload?.result, "") || "")
    .trim()
    .toLowerCase();

  const foundByStatus = ["found", "exposed", "breached", "hit", "positive"].includes(statusRaw);
  const found =
    typeof payload?.found === "boolean"
      ? payload.found
      : typeof payload?.exposed === "boolean"
        ? payload.exposed
        : foundByStatus || breachCount > 0;

  return {
    found,
    breachCount,
    breachNames,
  };
}

function normalizeCredentialPasswordResult(payload) {
  const occurrenceCount = toSafeNonNegativeNumber(
    firstMeaningful(payload?.occurrence_count, payload?.count, payload?.hits, payload?.total)
  );

  const statusRaw = String(firstMeaningful(payload?.status, payload?.result, "") || "")
    .trim()
    .toLowerCase();

  const exposedByStatus = ["exposed", "found", "breached", "hit", "positive"].includes(statusRaw);
  const exposed =
    typeof payload?.exposed === "boolean"
      ? payload.exposed
      : typeof payload?.found === "boolean"
        ? payload.found
        : exposedByStatus || (occurrenceCount !== null && occurrenceCount > 0);

  return {
    exposed,
    occurrenceCount,
  };
}

export default function App() {
  const [sidebarLogoError, setSidebarLogoError] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [assets, setAssets] = useState([]);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [assetsError, setAssetsError] = useState("");

  const [isAddAssetOpen, setIsAddAssetOpen] = useState(false);
  const [addForm, setAddForm] = useState({ name: "", target: "", type: "" });
  const [addErrors, setAddErrors] = useState({ target: "", type: "" });
  const [addSubmitError, setAddSubmitError] = useState("");
  const [isSavingAsset, setIsSavingAsset] = useState(false);

  const [configuredAssetId, setConfiguredAssetId] = useState(null);
  const [checkDraft, setCheckDraft] = useState(null);
  const [configLoading, setConfigLoading] = useState(false);
  const [configError, setConfigError] = useState("");
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [runNowAssetId, setRunNowAssetId] = useState(null);
  const [runNowMessage, setRunNowMessage] = useState(null);
  const [historyAssetId, setHistoryAssetId] = useState("");
  const [historySearch, setHistorySearch] = useState("");
  const [historyRuns, setHistoryRuns] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  
  const [expandedHistoryRunIds, setExpandedHistoryRunIds] = useState(() => new Set());
  const [credentialEmail, setCredentialEmail] = useState("");
  const [credentialEmailLoading, setCredentialEmailLoading] = useState(false);
  const [credentialEmailError, setCredentialEmailError] = useState("");
  const [credentialEmailResult, setCredentialEmailResult] = useState(null);
  const [credentialPassword, setCredentialPassword] = useState("");
  const [credentialPasswordLoading, setCredentialPasswordLoading] = useState(false);
  const [credentialPasswordError, setCredentialPasswordError] = useState("");
  const [credentialPasswordResult, setCredentialPasswordResult] = useState(null);
  const [homeMetrics, setHomeMetrics] = useState({ findingsCounts: { High: 0, Medium: 0, Low: 0 }, recentActivity: [] });

  const selectedAsset = assets.find((asset) => asset.id === configuredAssetId) || null;
  const selectedHistoryAsset = assets.find((asset) => asset.id === historyAssetId) || null;

  async function loadAssets() {
    setAssetsLoading(true);
    setAssetsError("");

    try {
      const list = await getAssets();

      const mapped = (list || []).map((item) => ({
        id: String(item.id),
        backendId: item.id,
        name: item.name || "",
        target: item.asset_value || "",
        type: item.asset_type,
        status: normalizeStatus(item.status),
        checks: createChecksForType(item.asset_type),
      }));

      const enriched = await Promise.all(
        mapped.map(async (asset) => {
          try {
            const payload = await getAssetChecks(asset.backendId);
            const checks = createChecksForType(asset.type, payload?.allowed_checks || []);

            (payload?.checks || []).forEach((entry) => {
              if (!checks[entry.check_type]) return;

              checks[entry.check_type] = {
                ...checks[entry.check_type],
                enabled: Boolean(entry.enabled),
                frequency: entry.frequency ? toUiFrequency(entry.frequency) : null,
              };
            });

            return {
              ...asset,
              checks,
              status: normalizeStatus(asset.status) || getStatusFromChecks(checks),
            };
          } catch {
            return {
              ...asset,
              status: normalizeStatus(asset.status) || "not_configured",
            };
          }
        })
      );

  setAssets(enriched);
      try {
        computeHomeMetrics(enriched, getAssetHistory, getTlsDetails, parseBooleanLike).then((metrics) => {
          setHomeMetrics(metrics);
        }).catch(() => {});
      } catch (e) {
        // ignore
      }
    } catch (error) {
      setAssetsError(error.message || "Failed to load assets");
    } finally {
      setAssetsLoading(false);
    }
  }

  useEffect(() => {
    loadAssets();
  }, []);

  useEffect(() => {
    if (activeTab === "history" && !historyAssetId && assets.length > 0) {
      setHistoryAssetId(assets[0].id);
    }
  }, [activeTab, assets, historyAssetId]);

  useEffect(() => {
    if (!selectedHistoryAsset?.backendId) {
      setHistoryRuns([]);
      setHistoryError("");
      setExpandedHistoryRunIds(new Set());
      return;
    }

    let cancelled = false;

    async function loadHistory() {
      setHistoryLoading(true);
      setHistoryError("");

      try {
        const payload = await getAssetHistory(selectedHistoryAsset.backendId);
        if (cancelled) return;
        setHistoryRuns(payload?.runs || []);
      } catch (error) {
        if (cancelled) return;
        setHistoryRuns([]);
        setHistoryError(error.message || "Failed to load history");
      } finally {
        if (!cancelled) {
          setHistoryLoading(false);
        }
      }
    }

    loadHistory();

    return () => {
      cancelled = true;
    };
  }, [selectedHistoryAsset?.backendId]);

  

  useEffect(() => {
    setExpandedHistoryRunIds(new Set());
  }, [historyAssetId]);

  async function handleSaveAsset() {
    const target = addForm.target.trim();
    const type = addForm.type;
    const nextErrors = {
      target: target ? "" : "Target is required",
      type: type ? "" : "Asset type is required",
    };

    setAddErrors(nextErrors);

    if (nextErrors.target || nextErrors.type) {
      return;
    }

    setAddSubmitError("");
    setIsSavingAsset(true);

    try {
      await createAsset({
        name: addForm.name.trim() || target,
        asset_type: type,
        asset_value: target,
      });

      setAddForm({ name: "", target: "", type: "" });
      setAddErrors({ target: "", type: "" });
      setIsAddAssetOpen(false);
      await loadAssets();
    } catch (error) {
      setAddSubmitError(error.message || "Failed to save asset");
    } finally {
      setIsSavingAsset(false);
    }
  }

  async function handleRemoveAsset(assetId) {
    const targetAsset = assets.find((asset) => asset.id === assetId);
    if (!targetAsset) return;

    try {
      await deleteAsset(targetAsset.backendId);
      setAssets((prev) => prev.filter((asset) => asset.id !== assetId));
    } catch (error) {
      setAssetsError(error.message || "Failed to remove asset");
    }

    if (configuredAssetId === assetId) {
      setConfiguredAssetId(null);
      setCheckDraft(null);
    }
  }

  async function openConfigureChecks(asset) {
    setConfiguredAssetId(asset.id);
    setConfigError("");
    setConfigLoading(true);

    try {
      const payload = await getAssetChecks(asset.backendId);
      const checks = createChecksForType(asset.type, payload?.allowed_checks || []);

      (payload?.checks || []).forEach((entry) => {
        if (!checks[entry.check_type]) return;

        checks[entry.check_type] = {
          ...checks[entry.check_type],
          enabled: Boolean(entry.enabled),
          frequency: entry.frequency ? toUiFrequency(entry.frequency) : null,
        };
      });

      setCheckDraft(checks);
    } catch (error) {
      setCheckDraft(structuredClone(asset.checks));
      setConfigError(error.message || "Failed to load checks");
    } finally {
      setConfigLoading(false);
    }
  }

  function handleToggleCheck(checkKey, enabled) {
    setCheckDraft((prev) => {
      if (!prev?.[checkKey]?.available) return prev;

      return {
        ...prev,
        [checkKey]: {
          ...prev[checkKey],
          enabled,
          frequency: enabled ? prev[checkKey].frequency || frequencyOptions[0] : null,
        },
      };
    });
  }

  function handleFrequencyChange(checkKey, frequency) {
    setCheckDraft((prev) => {
      if (!prev?.[checkKey]?.available || !prev[checkKey].enabled) return prev;

      return {
        ...prev,
        [checkKey]: {
          ...prev[checkKey],
          frequency,
        },
      };
    });
  }

  async function handleSaveConfiguration() {
    if (!selectedAsset || !checkDraft) {
      return;
    }

    setIsSavingConfig(true);
    setConfigError("");

    try {
      const checksPayload = checkDefinitions
        .map((definition) => ({
          check_type: definition.key,
          enabled: Boolean(checkDraft[definition.key]?.enabled),
          frequency:
            checkDraft[definition.key]?.enabled && checkDraft[definition.key]?.frequency
              ? toApiFrequency(checkDraft[definition.key].frequency)
              : null,
          available: Boolean(checkDraft[definition.key]?.available),
        }))
        .filter((item) => item.available)
        .map(({ check_type, enabled, frequency }) => ({
          check_type,
          enabled,
          frequency,
        }));

      await saveAssetChecks(selectedAsset.backendId, { checks: checksPayload });

      const status = getStatusFromChecks(checkDraft);

      setAssets((prev) =>
        prev.map((asset) =>
          asset.id === selectedAsset.id
            ? {
                ...asset,
                checks: checkDraft,
                status,
              }
            : asset
        )
      );

      setConfiguredAssetId(null);
      setCheckDraft(null);
    } catch (error) {
      setConfigError(error.message || "Failed to save configuration");
    } finally {
      setIsSavingConfig(false);
    }
  }

  function canRunNow(asset) {
    if (!asset?.checks) {
      return false;
    }

    if (asset.type === "host") {
      return Boolean(asset.checks?.ports?.enabled);
    }

    if (asset.type === "domain") {
      return Boolean(asset.checks?.email?.enabled);
    }

    if (asset.type === "website") {
      return Boolean(asset.checks?.tls?.enabled);
    }

    return false;
  }

  async function handleRunNow(asset) {
    if (!canRunNow(asset) || !asset.backendId) {
      return;
    }

    setRunNowMessage(null);
    setRunNowAssetId(asset.id);

    try {
      const response = await runAssetNow(asset.backendId);
      setRunNowMessage({
        type: "success",
        text: response?.summary || "Run started successfully",
      });
    } catch (error) {
      setRunNowMessage({
        type: "error",
        text: error.message || "Run Now failed",
      });
    } finally {
      setRunNowAssetId(null);
    }
  }

  function toggleHistoryRun(runId) {
    setExpandedHistoryRunIds((prev) => {
      const next = new Set(prev);
      if (next.has(runId)) {
        next.delete(runId);
      } else {
        next.add(runId);
      }
      return next;
    });
  }

  async function handleCredentialEmailCheck() {
    const email = credentialEmail.trim();

    if (!email) {
      setCredentialEmailError("Enter an email address to check.");
      setCredentialEmailResult(null);
      return;
    }

    setCredentialEmailLoading(true);
    setCredentialEmailError("");
    setCredentialEmailResult(null);

    try {
      const payload = await checkCredentialExposureEmail(email);
      setCredentialEmailResult(normalizeCredentialEmailResult(payload || {}));
    } catch (error) {
      setCredentialEmailError(error.message || "Failed to check email exposure");
    } finally {
      setCredentialEmailLoading(false);
    }
  }

  async function handleCredentialPasswordCheck() {
    if (!credentialPassword) {
      setCredentialPasswordError("Enter a password to check.");
      setCredentialPasswordResult(null);
      return;
    }

    setCredentialPasswordLoading(true);
    setCredentialPasswordError("");
    setCredentialPasswordResult(null);

    try {
      const payload = await checkCredentialExposurePassword(credentialPassword);
      setCredentialPasswordResult(normalizeCredentialPasswordResult(payload || {}));
    } catch (error) {
      setCredentialPasswordError(error.message || "Failed to check password exposure");
    } finally {
      setCredentialPasswordLoading(false);
    }
  }

  function renderActivePage() {
    if (activeTab === "overview") {
      const configuredAssets = assets.filter((asset) => asset.status === "configured").length;
      const unconfiguredAssets = Math.max(assets.length - configuredAssets, 0);

      return (
        <>
          <PageHeading
            title="Home"
            subtitle="Overview of your monitored external security posture."
          />

          <div className="mx-auto grid w-full max-w-[980px] grid-cols-1 gap-5 md:grid-cols-2">
            <section className="panel-surface flex min-h-[130px] flex-col justify-between rounded-xl p-6 md:p-7">
              <p className="text-[11px] uppercase tracking-[0.15em] text-zinc-500">Configured Assets</p>
              <p className="mt-2 text-3xl font-semibold leading-none text-zinc-100">{configuredAssets}</p>
            </section>

            <section className="panel-surface flex min-h-[130px] flex-col justify-between rounded-xl p-6 md:p-7">
              <p className="text-[11px] uppercase tracking-[0.15em] text-zinc-500">Pending Configuration</p>
              <p className="mt-2 text-3xl font-semibold leading-none text-zinc-100">{unconfiguredAssets}</p>
            </section>
          </div>
          <div className="mx-auto grid w-full max-w-[980px] grid-cols-1 gap-5 md:grid-cols-2 mt-6">
            <FindingsBySeverity counts={homeMetrics.findingsCounts || { High: 0, Medium: 0, Low: 0 }} />
            <RecentScanActivity activity={homeMetrics.recentActivity || []} />
          </div>
        </>
      );
    }

    if (activeTab === "assets") {
      return (
        <>
          <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
            <div>
              <PageHeading
                title="Assets"
                subtitle="Manage the assets you want to monitor and scan."
              />
            </div>

            <button
              type="button"
              onClick={() => setIsAddAssetOpen(true)}
              className="btn-cyber rounded-md px-4 py-2 text-sm font-semibold"
            >
              Add Asset
            </button>
          </div>

          {assetsError ? <p className="mb-4 text-sm text-red-300">{assetsError}</p> : null}
          {runNowMessage ? (
            <p
              className={`mb-4 text-sm ${
                runNowMessage.type === "success" ? "text-emerald-300" : "text-red-300"
              }`}
            >
              {runNowMessage.text}
            </p>
          ) : null}

          {assetsLoading ? (
            <div className="panel-surface-muted rounded-xl p-8 text-zinc-300">
              Loading assets...
            </div>
          ) : assets.length === 0 ? (
            <div className="panel-surface-muted rounded-xl p-8 text-zinc-300">
              No assets yet. Add your first asset to start monitoring.
            </div>
          ) : (
            <div className="mx-auto grid w-full max-w-[1160px] grid-cols-1 gap-6 md:grid-cols-2 2xl:grid-cols-3">
              {assets.map((asset, index) => {
                const enabledChecks = Object.values(asset.checks).filter(
                  (check) => check.available && check.enabled && check.frequency
                ).length;
                const isRunNowEligible = canRunNow(asset);
                const isRunNowLoading = runNowAssetId === asset.id;
                const isLastOddCardOnTwoCols = assets.length % 2 === 1 && index === assets.length - 1;

                const statusLabel =
                  asset.status === "configured" ? "Configured" : "Not configured";

                return (
                  <article
                    key={asset.id}
                    className={`panel-surface min-w-0 flex h-full flex-col rounded-xl p-5 ${isLastOddCardOnTwoCols ? "md:col-span-2 2xl:col-span-1" : ""}`}
                  >
                    <div className="min-w-0">
                      <h3
                        className="min-w-0 overflow-hidden text-lg font-semibold leading-tight text-zinc-100"
                        title={asset.name || asset.target}
                        style={{
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                        }}
                      >
                        {asset.name || asset.target}
                      </h3>

                      <p
                        className="mt-2 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap font-mono text-sm text-zinc-300"
                        title={asset.target}
                      >
                        {asset.target}
                      </p>
                    </div>

                    <div className="mt-5 space-y-2.5 text-xs uppercase tracking-[0.12em] text-zinc-500">
                      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                        <span className="min-w-0 truncate">Asset Type:</span>
                        <span className="max-w-[11rem] truncate text-right font-medium text-zinc-300" title={getAssetTypeLabel(asset.type)}>
                          {getAssetTypeLabel(asset.type)}
                        </span>
                      </div>
                      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                        <span className="min-w-0 truncate">Status:</span>
                        <span
                          className={`max-w-[11rem] truncate text-right ${
                            asset.status === "configured" ? "text-emerald-300" : "text-amber-300"
                          }`}
                          title={statusLabel}
                        >
                          {statusLabel}
                        </span>
                      </div>
                      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                        <span className="min-w-0 truncate">Enabled Checks:</span>
                        <span className="max-w-[11rem] truncate text-right font-medium tabular-nums text-zinc-300">
                          {enabledChecks}
                        </span>
                      </div>
                    </div>

                    <div className="flex-1" />

                    <div className="mt-6 grid grid-cols-1 gap-3">
                      <button
                        type="button"
                        onClick={() => openConfigureChecks(asset)}
                        className="btn-cyber rounded-md px-3 py-2 text-sm font-medium"
                      >
                        Configure Checks
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRunNow(asset)}
                        disabled={!isRunNowEligible || Boolean(runNowAssetId)}
                        className={`rounded-md px-3 py-2 text-sm font-medium ${
                          !isRunNowEligible || Boolean(runNowAssetId)
                            ? "cursor-not-allowed border border-zinc-700 bg-zinc-900/60 text-zinc-500"
                            : "btn-cyber"
                        }`}
                      >
                        {isRunNowLoading ? "Running..." : "Run Now"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveAsset(asset.id)}
                        className="btn-cyber-subtle rounded-md px-3 py-2 text-sm font-medium"
                      >
                        Remove
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      );
    }

    if (activeTab === "history") {
      return (
        <HistoryPage
          assets={assets}
          historyAssetId={historyAssetId}
          setHistoryAssetId={setHistoryAssetId}
          historySearch={historySearch}
          setHistorySearch={setHistorySearch}
          historyRuns={historyRuns}
          historyLoading={historyLoading}
          historyError={historyError}
          expandedHistoryRunIds={expandedHistoryRunIds}
          toggleHistoryRun={toggleHistoryRun}
          formatAssetOptionLabel={formatAssetOptionLabel}
          getHistorySummary={getHistorySummary}
          getHistoryCheckLabel={getHistoryCheckLabel}
          getTlsDetails={getTlsDetails}
          formatHistoryDate={formatHistoryDate}
          formatHistoryDateTime={formatHistoryDateTime}
          formatServiceLabel={formatServiceLabel}
          getRunTimeMs={getRunTimeMs}
        />
      );
    }

    if (activeTab === "cti") {
      return (
        <CTIPage
          assets={assets}
          getAssetHistory={getAssetHistory}
          getTlsDetails={getTlsDetails}
          parseBooleanLike={parseBooleanLike}
          formatAssetOptionLabel={formatAssetOptionLabel}
          getAssetTypeLabel={getAssetTypeLabel}
        />
      );
    }

    if (activeTab === "credentials") {
      return (
        <CredentialExposurePage
          credentialEmail={credentialEmail}
          setCredentialEmail={setCredentialEmail}
          credentialEmailLoading={credentialEmailLoading}
          credentialEmailError={credentialEmailError}
          credentialEmailResult={credentialEmailResult}
          credentialPassword={credentialPassword}
          setCredentialPassword={setCredentialPassword}
          credentialPasswordLoading={credentialPasswordLoading}
          credentialPasswordError={credentialPasswordError}
          credentialPasswordResult={credentialPasswordResult}
          handleCredentialEmailCheck={handleCredentialEmailCheck}
          handleCredentialPasswordCheck={handleCredentialPasswordCheck}
          title={"Credential Exposure"}
          subtitle={"Check whether an email or password has appeared in known leaks."}
        />
      );
    }

    return null;
  }

  return (
    <div className="argus-shell min-h-screen bg-black font-sans text-zinc-100">
  <div className="mx-auto flex min-h-screen w-full max-w-[1420px] flex-col border-x border-red-900/35 bg-[#0a0d15]/90">
        <header className="relative h-16 w-full overflow-hidden border-b border-red-500/10">
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(120,0,0,0.18)_0%,rgba(0,0,0,0)_18%,rgba(0,0,0,0)_82%,rgba(120,0,0,0.18)_100%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:36px_36px] opacity-20" />
          <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-red-500/30 to-transparent" />

          <div className="relative z-10 mx-auto flex h-full w-full max-w-[1240px] items-center px-6">
            <div className="w-[110px]" aria-hidden="true" />

            <div className="flex-1 flex items-center justify-center">
              <button
                type="button"
                onClick={() => setActiveTab("overview")}
                aria-label="Open home"
                className={`group relative flex items-center justify-center rounded-full p-2 transition-all duration-300 ${
                  activeTab === "overview" ? "scale-110" : "hover:scale-105"
                }`}
              >
                <div
                  className={`absolute inset-0 rounded-full transition-all duration-300 ${
                    activeTab === "overview"
                      ? "bg-red-500/20 blur-xl"
                      : "bg-red-500/10 blur-lg group-hover:bg-red-500/20"
                  }`}
                />
                <div
                  className={`relative rounded-full border px-3 py-2 transition-all duration-300 ${
                    activeTab === "overview"
                      ? "border-red-400/60 bg-red-500/10 shadow-[0_0_24px_rgba(239,68,68,0.22)]"
                      : "border-red-500/25 bg-black/40 group-hover:border-red-400/40"
                  }`}
                >
                  <Eye
                    className={`h-5 w-5 transition-all duration-300 ${
                      activeTab === "overview" ? "text-red-300" : "text-red-400"
                    }`}
                  />
                </div>
              </button>
            </div>

            <div className="w-[110px]" aria-hidden="true" />
          </div>
        </header>

        <div className="flex min-h-[calc(100vh-64px)] w-full">
          <aside className="sidebar-shell hidden w-[248px] shrink-0 pt-4 lg:block">
            <div className="sidebar-brand px-4 pb-4">
              <div className="sidebar-logo-slot" aria-hidden="true">
                {!sidebarLogoError ? (
                  <img
                    src="/argus-logo.png"
                    alt=""
                    className="sidebar-logo-image"
                    onError={() => setSidebarLogoError(true)}
                  />
                ) : (
                  <span className="sidebar-logo-fallback">
                    <Shield className="h-4 w-4 text-red-200" />
                    <Eye className="sidebar-logo-fallback-eye h-[11px] w-[11px] text-red-100" />
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-[1.8rem] font-black uppercase leading-none tracking-wide text-white">ARGUS</p>
                <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-zinc-500">EASM PLATFORM</p>
              </div>
            </div>

            <nav className="space-y-2 px-4 pt-3">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveTab(item.id)}
                    className={`sidebar-nav-btn flex w-full items-center gap-3 rounded-md px-4 py-2.5 text-sm font-medium ${isActive ? "sidebar-nav-btn-active" : ""}`}
                  >
                    <Icon className={`h-[18px] w-[18px] ${isActive ? "text-red-300" : "text-zinc-500"}`} />
                    <span className={isActive ? "text-red-100" : "text-zinc-300"}>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </aside>

          <main className="cyber-main-embossed relative flex-1 overflow-hidden p-6 lg:p-7">
            <div className="relative z-10 mx-auto w-full max-w-[1240px]">
              {renderActivePage()}
            </div>
          </main>
        </div>
      </div>

      {isAddAssetOpen && (
        <AddAssetModal
          addForm={addForm}
          setAddForm={setAddForm}
          addErrors={addErrors}
          addSubmitError={addSubmitError}
          assetTypeOptions={assetTypeOptions}
          setIsAddAssetOpen={setIsAddAssetOpen}
          setAddErrors={setAddErrors}
          setAddSubmitError={setAddSubmitError}
          handleSaveAsset={handleSaveAsset}
          isSavingAsset={isSavingAsset}
        />
      )}

      {selectedAsset && checkDraft && (
        <ConfigureChecksModal
          selectedAsset={selectedAsset}
          checkDraft={checkDraft}
          configError={configError}
          configLoading={configLoading}
          isSavingConfig={isSavingConfig}
          checkDefinitions={checkDefinitions}
          handleToggleCheck={handleToggleCheck}
          handleFrequencyChange={handleFrequencyChange}
          setConfiguredAssetId={setConfiguredAssetId}
          setCheckDraft={setCheckDraft}
          handleSaveConfiguration={handleSaveConfiguration}
          getAssetTypeLabel={getAssetTypeLabel}
          frequencyOptions={frequencyOptions}
        />
      )}
    </div>
  );
}