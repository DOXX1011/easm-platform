import { useState } from "react";
import { Lock, Grid, Box, Mail, KeyRound, Eye } from "lucide-react";

const navItems = [
  { id: "overview", label: "Home", icon: Grid },
  { id: "assets", label: "Assets", icon: Box },
  { id: "email", label: "Email Posture", icon: Mail },
  { id: "tls", label: "TLS/HTTPS", icon: Lock },
  { id: "credentials", label: "Credential Exposure", icon: KeyRound },
];

const frequencyOptions = ["1 min", "15 min", "1 hour", "6 hours", "Daily"];

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

function createChecksForType(type) {
  const availability = availabilityByType[type];

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

  return hasEnabledScheduled ? "monitoring_enabled" : "not_configured";
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

  const [isAddAssetOpen, setIsAddAssetOpen] = useState(false);
  const [addForm, setAddForm] = useState({ name: "", target: "", type: "" });
  const [addErrors, setAddErrors] = useState({ target: "", type: "" });

  const [configuredAssetId, setConfiguredAssetId] = useState(null);
  const [checkDraft, setCheckDraft] = useState(null);

  const selectedAsset = assets.find((asset) => asset.id === configuredAssetId) || null;

  function handleSaveAsset() {
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

    const nextAsset = {
      id: `asset-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: addForm.name.trim(),
      target,
      type,
      status: "not_configured",
      checks: createChecksForType(type),
    };

    setAssets((prev) => [nextAsset, ...prev]);
    setAddForm({ name: "", target: "", type: "" });
    setAddErrors({ target: "", type: "" });
    setIsAddAssetOpen(false);
  }

  function handleRemoveAsset(assetId) {
    setAssets((prev) => prev.filter((asset) => asset.id !== assetId));

    if (configuredAssetId === assetId) {
      setConfiguredAssetId(null);
      setCheckDraft(null);
    }
  }

  function openConfigureChecks(asset) {
    setConfiguredAssetId(asset.id);
    setCheckDraft(structuredClone(asset.checks));
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

  function handleSaveConfiguration() {
    if (!selectedAsset || !checkDraft) {
      return;
    }

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

          {assets.length === 0 ? (
            <div className="rounded-xl border border-red-500/20 bg-zinc-950/35 p-8 text-zinc-400">
              No assets yet. Add your first asset to start monitoring.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {assets.map((asset) => {
                const enabledChecks = Object.values(asset.checks).filter(
                  (check) => check.available && check.enabled && check.frequency
                ).length;

                const statusLabel =
                  asset.status === "monitoring_enabled" ? "Monitoring enabled" : "Not configured";

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
                            asset.status === "monitoring_enabled" ? "text-emerald-300" : "text-amber-300"
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
                        disabled
                        className="cursor-not-allowed rounded-md border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-sm font-medium text-zinc-500"
                      >
                        Run Now
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

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsAddAssetOpen(false);
                  setAddErrors({ target: "", type: "" });
                }}
                className="rounded-md border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveAsset}
                className="rounded-md border border-red-500/40 bg-red-500/15 px-4 py-2 text-sm font-semibold text-red-200"
              >
                Save Asset
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

            <div className="mt-5 space-y-3">
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
                            disabled={!check.available}
                            onChange={(e) => handleToggleCheck(definition.key, e.target.checked)}
                            className="h-4 w-4 accent-red-500 disabled:accent-zinc-700"
                          />
                          Enabled
                        </label>

                        <select
                          value={check.frequency || ""}
                          disabled={!check.available || !check.enabled}
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
                className="rounded-md border border-red-500/40 bg-red-500/15 px-4 py-2 text-sm font-semibold text-red-200"
              >
                Save Configuration
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}