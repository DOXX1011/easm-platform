import { useEffect, useState } from "react";
import { Lock, Grid, Box, Mail, KeyRound, Eye, Clock3 } from "lucide-react";
import {
  getAssets,
  createAsset,
  deleteAsset,
  getAssetChecks,
  saveAssetChecks,
  runAssetNow,
  getAssetHistory,
} from "@/lib/assetsApi";

const navItems = [
  { id: "overview", label: "Home", icon: Grid },
  { id: "assets", label: "Assets", icon: Box },
  { id: "history", label: "History", icon: Clock3 },
  { id: "email", label: "Email Posture", icon: Mail },
  { id: "tls", label: "TLS/HTTPS", icon: Lock },
  { id: "credentials", label: "Credential Exposure", icon: KeyRound },
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
  host: { ports: true, email: false, tls: true },
  domain: { ports: false, email: true, tls: true },
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
    ports: allowedChecks.includes("ports"),
    email: allowedChecks.includes("email"),
    tls: allowedChecks.includes("tls"),
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

function PageHeading({ title, subtitle }) {
  return (
    <div className="mb-8">
      <h2 className="glow-text-red text-3xl font-black uppercase tracking-tighter text-white">
        {title}
      </h2>
      <p className="mt-2 text-sm text-zinc-400">{subtitle}</p>
    </div>
  );
}

function PlaceholderPanel({ text }) {
  return (
    <div className="rounded-xl border border-red-500/20 bg-zinc-950/30 p-8 shadow-[inset_0_0_20px_-10px_rgba(185,28,28,0.3)]">
      <p className="text-zinc-300">{text}</p>
    </div>
  );
}

export default function App() {
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
    return asset.type === "host" && Boolean(asset.checks?.ports?.enabled);
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

  function renderActivePage() {
    if (activeTab === "overview") {
      return (
        <>
          <PageHeading
            title="Home"
            subtitle="High-level external posture indicators for your monitored surface."
          />

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <section className="group relative overflow-hidden rounded-xl border border-red-500/20 bg-zinc-950/30 p-7 shadow-[inset_0_0_22px_-10px_rgba(185,28,28,0.35)] backdrop-blur-[1px]">
              <div className="absolute right-0 top-0 bg-red-500 p-1 text-[10px] font-bold text-black">
                ARC-01
              </div>
              <h3 className="glow-text-red mb-3 text-sm font-bold uppercase tracking-wide text-zinc-400">
                Exposed Assets
              </h3>
              <p className="glow-text-red text-5xl font-black italic tracking-tighter text-white">
                {assets.length}
              </p>
            </section>

            <section className="group relative overflow-hidden rounded-xl border border-red-500/20 bg-zinc-950/30 p-7 shadow-[inset_0_0_22px_-10px_rgba(185,28,28,0.35)] backdrop-blur-[1px]">
              <div className="absolute right-0 top-0 bg-red-500 p-1 text-[10px] font-bold text-black">
                ARC-02
              </div>
              <h3 className="glow-text-red mb-3 text-sm font-bold uppercase tracking-wide text-zinc-400">
                Critical Findings
              </h3>
              <p className="glow-text-red text-5xl font-black italic tracking-tighter text-white">
                12
              </p>
            </section>
          </div>
        </>
      );
    }

    if (activeTab === "assets") {
      return (
        <>
          <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
            <div>
              <PageHeading
                title="Assets"
                subtitle="Managed assets and discovered external surface nodes."
              />
            </div>

            <button
              type="button"
              onClick={() => setIsAddAssetOpen(true)}
              className="rounded-md border border-red-500/40 bg-red-500/15 px-4 py-2 text-sm font-semibold text-red-200 transition hover:bg-red-500/25"
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
            <div className="rounded-xl border border-red-500/20 bg-zinc-950/35 p-8 text-zinc-400">
              Loading assets...
            </div>
          ) : assets.length === 0 ? (
            <div className="rounded-xl border border-red-500/20 bg-zinc-950/35 p-8 text-zinc-400">
              No assets yet. Add your first asset to start monitoring.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {assets.map((asset) => {
                const enabledChecks = Object.values(asset.checks).filter(
                  (check) => check.available && check.enabled && check.frequency
                ).length;
                const isRunNowEligible = canRunNow(asset);
                const isRunNowLoading = runNowAssetId === asset.id;

                const statusLabel =
                  asset.status === "configured" ? "Configured" : "Not configured";

                return (
                  <article
                    key={asset.id}
                    className="rounded-xl border border-red-500/20 bg-zinc-950/35 p-5 shadow-[inset_0_0_16px_-10px_rgba(185,28,28,0.28)]"
                  >
                    <h3 className="text-lg font-semibold text-zinc-100">
                      {asset.name || asset.target}
                    </h3>
                    <p className="mt-1 font-mono text-sm text-red-300">{asset.target}</p>

                    <div className="mt-4 space-y-2 text-xs uppercase tracking-[0.14em] text-zinc-500">
                      <div className="flex items-center justify-between">
                        <span>Asset Type</span>
                        <span className="text-zinc-300">{getAssetTypeLabel(asset.type)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Status</span>
                        <span
                          className={
                            asset.status === "configured" ? "text-emerald-300" : "text-amber-300"
                          }
                        >
                          {statusLabel}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Enabled Checks</span>
                        <span className="text-zinc-300">{enabledChecks}</span>
                      </div>
                    </div>

                    <div className="mt-5 grid grid-cols-1 gap-2">
                      <button
                        type="button"
                        onClick={() => openConfigureChecks(asset)}
                        className="rounded-md border border-red-500/35 bg-red-500/15 px-3 py-2 text-sm font-medium text-red-200 transition hover:bg-red-500/25"
                      >
                        Configure Checks
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRunNow(asset)}
                        disabled={!isRunNowEligible || Boolean(runNowAssetId)}
                        className={`rounded-md border px-3 py-2 text-sm font-medium ${
                          !isRunNowEligible || Boolean(runNowAssetId)
                            ? "cursor-not-allowed border-zinc-700 bg-zinc-900/60 text-zinc-500"
                            : "border-red-500/35 bg-red-500/15 text-red-200 transition hover:bg-red-500/25"
                        }`}
                      >
                        {isRunNowLoading ? "Running..." : "Run Now"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveAsset(asset.id)}
                        className="rounded-md border border-zinc-700 bg-zinc-900/70 px-3 py-2 text-sm font-medium text-zinc-300 transition hover:border-red-400/50 hover:text-red-200"
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
      const query = historySearch.trim().toLowerCase();
      const filteredRuns = query
        ? historyRuns.filter((run) => {
            const summary = (run.summary || "").toLowerCase();
            const status = (run.status || "").toLowerCase();
            const checkType = (run.check_type || "").toLowerCase();
            return summary.includes(query) || status.includes(query) || checkType.includes(query);
          })
        : historyRuns;

      return (
        <>
          <PageHeading
            title="History"
            subtitle="Execution history by selected asset."
          />

          <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-2">
            <select
              value={historyAssetId}
              onChange={(e) => setHistoryAssetId(e.target.value)}
              className="rounded-md border border-zinc-700 bg-zinc-900/70 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-red-400/60"
              disabled={assetsLoading || assets.length === 0}
            >
              {assets.length === 0 ? (
                <option value="">No assets available</option>
              ) : (
                assets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {(asset.name || asset.target) + " • " + asset.target}
                  </option>
                ))
              )}
            </select>

            <input
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              placeholder="Search by summary, status, check type"
              className="rounded-md border border-zinc-700 bg-zinc-900/70 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-red-400/60"
            />
          </div>

          {historyError ? <p className="mb-4 text-sm text-red-300">{historyError}</p> : null}

          {!historyAssetId ? (
            <div className="rounded-xl border border-red-500/20 bg-zinc-950/35 p-8 text-zinc-400">
              Select an asset to view history.
            </div>
          ) : historyLoading ? (
            <div className="rounded-xl border border-red-500/20 bg-zinc-950/35 p-8 text-zinc-400">
              Loading history...
            </div>
          ) : filteredRuns.length === 0 ? (
            <div className="rounded-xl border border-red-500/20 bg-zinc-950/35 p-8 text-zinc-400">
              No history entries for this asset.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredRuns.map((run) => (
                <article
                  key={run.id}
                  className="rounded-xl border border-red-500/20 bg-zinc-950/35 p-5 shadow-[inset_0_0_16px_-10px_rgba(185,28,28,0.28)]"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm uppercase tracking-[0.16em] text-zinc-400">{run.check_type}</p>
                    <span className="text-xs uppercase tracking-[0.14em] text-zinc-500">{run.status}</span>
                  </div>

                  <p className="mt-2 text-sm text-zinc-200">{run.summary || "No summary"}</p>

                  <div className="mt-4 grid grid-cols-1 gap-1 text-xs text-zinc-500 md:grid-cols-3">
                    <p>Started: {run.started_at || "-"}</p>
                    <p>Finished: {run.finished_at || "-"}</p>
                    <p>Created: {run.created_at || "-"}</p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      );
    }

    if (activeTab === "email") {
      return (
        <>
          <PageHeading
            title="Email Posture"
            subtitle="Visibility into mail-related external misconfiguration and exposure."
          />
          <PlaceholderPanel text="Email posture checks will appear here" />
        </>
      );
    }

    if (activeTab === "tls") {
      return (
        <>
          <PageHeading
            title="TLS/HTTPS"
            subtitle="Certificate hygiene, protocol health, and encryption posture at a glance."
          />
          <PlaceholderPanel text="TLS/HTTPS posture checks will appear here" />
        </>
      );
    }

    return (
      <>
        <PageHeading
          title="Credential Exposure"
          subtitle="Monitoring leaked identities and externally exposed credentials."
        />
        <PlaceholderPanel text="Credential exposure checks will appear here" />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-black font-sans text-zinc-100">
      <div className="mx-auto flex min-h-screen w-full max-w-[1200px] flex-col border-x border-red-950/70 bg-[#020204]">
        <header className="relative h-16 w-full overflow-hidden border-b border-red-500/20">
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(120,0,0,0.18)_0%,rgba(0,0,0,0)_18%,rgba(0,0,0,0)_82%,rgba(120,0,0,0.18)_100%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:36px_36px] opacity-20" />
          <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-red-500/60 to-transparent" />

          <div className="relative z-10 grid h-full grid-cols-[1fr_auto_1fr] items-center px-6">
            <div className="justify-self-start text-sm font-black uppercase tracking-[0.45em] text-white">
              ARGUS
            </div>

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

            <div className="w-[110px] justify-self-end" aria-hidden="true" />
          </div>
        </header>

        <div className="flex min-h-[calc(100vh-64px)] w-full">
          <aside className="hidden w-60 shrink-0 border-r border-red-950 bg-black/80 pt-6 lg:block">
            <nav className="space-y-2 px-4">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveTab(item.id)}
                    className={`flex w-full items-center gap-3 rounded-md border px-4 py-2.5 text-sm font-medium transition-colors ${
                      isActive
                        ? "border-red-500/35 bg-red-950/25 text-red-300"
                        : "border-transparent text-zinc-500 hover:border-red-500/15 hover:bg-zinc-900/60 hover:text-zinc-200"
                    }`}
                  >
                    <Icon className={`h-[18px] w-[18px] ${isActive ? "text-red-400" : "text-zinc-500"}`} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </aside>

          <main className="cyber-main-embossed relative flex-1 overflow-hidden p-6 lg:p-8">
            <div className="relative z-10 mx-auto w-full max-w-5xl">
              {renderActivePage()}
            </div>
          </main>
        </div>
      </div>

      {isAddAssetOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-red-500/30 bg-[#0a0a0d] p-6 shadow-[0_0_28px_rgba(127,29,29,0.35)]">
            <h3 className="text-xl font-semibold text-zinc-100">Add Asset</h3>

            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-1 block text-sm text-zinc-300">Asset Name</label>
                <input
                  value={addForm.name}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-900/70 px-3 py-2 text-zinc-100 outline-none focus:border-red-400/60"
                  placeholder="Optional"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-zinc-300">Target</label>
                <input
                  value={addForm.target}
                  onChange={(e) =>
                    setAddForm((prev) => ({ ...prev, target: e.target.value }))
                  }
                  className="w-full rounded-md border border-zinc-700 bg-zinc-900/70 px-3 py-2 text-zinc-100 outline-none focus:border-red-400/60"
                  placeholder="IP, domain, or URL"
                />
                {addErrors.target ? (
                  <p className="mt-1 text-xs text-red-300">{addErrors.target}</p>
                ) : null}
              </div>

              <div>
                <label className="mb-1 block text-sm text-zinc-300">Asset Type</label>
                <select
                  value={addForm.type}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, type: e.target.value }))}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-900/70 px-3 py-2 text-zinc-100 outline-none focus:border-red-400/60"
                >
                  <option value="">Select type</option>
                  {assetTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {addErrors.type ? <p className="mt-1 text-xs text-red-300">{addErrors.type}</p> : null}
              </div>
            </div>

            {addSubmitError ? <p className="mt-3 text-sm text-red-300">{addSubmitError}</p> : null}

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsAddAssetOpen(false);
                  setAddErrors({ target: "", type: "" });
                  setAddSubmitError("");
                }}
                className="rounded-md border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveAsset}
                disabled={isSavingAsset}
                className="rounded-md border border-red-500/40 bg-red-500/15 px-4 py-2 text-sm font-semibold text-red-200"
              >
                {isSavingAsset ? "Saving..." : "Save Asset"}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedAsset && checkDraft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-xl border border-red-500/30 bg-[#0a0a0d] p-6 shadow-[0_0_28px_rgba(127,29,29,0.35)]">
            <h3 className="text-xl font-semibold text-zinc-100">Configure Checks</h3>
            <p className="mt-1 text-sm text-zinc-400">
              {selectedAsset.name || selectedAsset.target} • {getAssetTypeLabel(selectedAsset.type)}
            </p>

            {configError ? <p className="mt-3 text-sm text-red-300">{configError}</p> : null}

            <div className="mt-5 space-y-3">
              {configLoading ? (
                <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4 text-zinc-400">
                  Loading checks...
                </div>
              ) : null}

              {checkDefinitions.map((definition) => {
                const check = checkDraft[definition.key];

                return (
                  <div
                    key={definition.key}
                    className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-sm font-medium text-zinc-200">{definition.label}</p>
                        {!check.available ? (
                          <p className="mt-1 text-xs text-zinc-500">Not available for this asset type</p>
                        ) : null}
                      </div>

                      <div className="flex items-center gap-3">
                        <label className="inline-flex items-center gap-2 text-sm text-zinc-300">
                          <input
                            type="checkbox"
                            checked={check.enabled}
                            disabled={!check.available || configLoading || isSavingConfig}
                            onChange={(e) => handleToggleCheck(definition.key, e.target.checked)}
                            className="h-4 w-4 accent-red-500 disabled:accent-zinc-700"
                          />
                          Enabled
                        </label>

                        <select
                          value={check.frequency || ""}
                          disabled={!check.available || !check.enabled || configLoading || isSavingConfig}
                          onChange={(e) => handleFrequencyChange(definition.key, e.target.value)}
                          className="rounded-md border border-zinc-700 bg-zinc-900/70 px-3 py-2 text-sm text-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <option value="">Select frequency</option>
                          {frequencyOptions.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setConfiguredAssetId(null);
                  setCheckDraft(null);
                }}
                className="rounded-md border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveConfiguration}
                disabled={configLoading || isSavingConfig}
                className="rounded-md border border-red-500/40 bg-red-500/15 px-4 py-2 text-sm font-semibold text-red-200"
              >
                {isSavingConfig ? "Saving..." : "Save Configuration"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}