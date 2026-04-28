import React, { useEffect, useState } from "react";
import { getLatestRunByType as _getLatestRunByType, deriveFindingsFromRuns as _deriveFindingsFromRuns } from "./ctiHelpers";
const summaryCardClass = "panel-surface rounded-xl p-4";
const sectionLabelClass = "text-xs uppercase tracking-[0.12em] text-zinc-500";
const largeValueClass = "mt-2 text-lg font-semibold";
const topPrioritySummaryClass = "mt-1 text-sm text-zinc-100 font-semibold";

function SummaryCard({ label, children }) {
  return (
    <div className={summaryCardClass}>
      <p className={sectionLabelClass}>{label}</p>
      {children}
    </div>
  );
}

function SeverityText({ severity }) {
  const cls = severity === "High" ? "text-red-300" : severity === "Medium" ? "text-amber-300" : "text-emerald-300";
  return <p className={`text-sm ${cls}`}>{severity}</p>;
}

export default function CTIPage({
  assets = [],
  getAssetHistory,
  getTlsDetails,
  parseBooleanLike,
  formatAssetOptionLabel,
  getAssetTypeLabel,
}) {
  const [ctiAssetId, setCtiAssetId] = useState("");
  const [ctiRuns, setCtiRuns] = useState([]);
  const [ctiLoading, setCtiLoading] = useState(false);
  const [ctiError, setCtiError] = useState("");

  useEffect(() => {
    if (!ctiAssetId) {
      setCtiRuns([]);
      setCtiError("");
      setCtiLoading(false);
      return;
    }

    let cancelled = false;

    async function loadCtiHistory() {
      setCtiLoading(true);
      setCtiError("");

      try {
        const asset = assets.find((a) => a.id === ctiAssetId);
        if (!asset?.backendId) {
          setCtiRuns([]);
          setCtiError("Asset not found");
          return;
        }

        const payload = await getAssetHistory(asset.backendId);
        if (cancelled) return;
        setCtiRuns(payload?.runs || []);
      } catch (error) {
        if (cancelled) return;
        setCtiRuns([]);
        setCtiError(error.message || "Failed to load CTI history");
      } finally {
        if (!cancelled) setCtiLoading(false);
      }
    }

    loadCtiHistory();

    return () => {
      cancelled = true;
    };
  }, [ctiAssetId, assets, getAssetHistory]);

  const selectedCtiAsset = assets.find((a) => a.id === ctiAssetId) || null;
  const derivedFindings = _deriveFindingsFromRuns(ctiRuns || [], { getTlsDetails, parseBooleanLike });
  let filteredFindings = derivedFindings || [];

  
  const validFindings = filteredFindings.filter((f) => f && f.valid_for_risk !== false);

  
  const isCtiAssetSelected = Boolean(selectedCtiAsset && ctiAssetId);
  let overallRisk = "Low";
  if (isCtiAssetSelected) {
    if (validFindings.some((f) => String(f.severity || "").toLowerCase() === "high")) {
      overallRisk = "High";
    } else if (validFindings.some((f) => String(f.severity || "").toLowerCase() === "medium")) {
      overallRisk = "Medium";
    } else if (validFindings.some((f) => String(f.severity || "").toLowerCase() === "low")) {
      overallRisk = "Low";
    } else {
      overallRisk = "Low";
    }
  }

  const displayFindings = filteredFindings.filter((f) => !(String(f.source_check || "").toLowerCase() === "email" && String(f.severity || "").toLowerCase() === "informational"));

  
  const priorityFindingsCount = filteredFindings.filter((f) => String(f.severity || "").toLowerCase() === "high" && f.valid_for_risk !== false).length;

  
  let topPriority = null;
  if (isCtiAssetSelected) {
    const candidates = filteredFindings.slice().filter((f) => f && f.valid_for_risk !== false);
    if (candidates.length > 0) {
      candidates.sort((a, b) => {
        const severityScore = (s) => (String(s || "").toLowerCase() === "high" ? 1000 : String(s || "").toLowerCase() === "medium" ? 500 : String(s || "").toLowerCase() === "low" ? 100 : 0);
        const sa = severityScore(a.severity);
        const sb = severityScore(b.severity);
        if (sb !== sa) return sb - sa;
        
        const aStrength = Number.isFinite(a.evidence_strength) ? a.evidence_strength : 1;
        const bStrength = Number.isFinite(b.evidence_strength) ? b.evidence_strength : 1;
        if (bStrength !== aStrength) return bStrength - aStrength;
        
        const apr = a.priority_rank || 0;
        const bpr = b.priority_rank || 0;
        return bpr - apr;
      });
      topPriority = candidates[0];
    }
  }

  
  const remediationCandidates = displayFindings.filter((f) => f && f.valid_for_risk !== false && (String(f.severity || "").toLowerCase() === "high" || String(f.severity || "").toLowerCase() === "medium"));

  
  remediationCandidates.sort((a, b) => {
    const severityScore = (s) => (String(s || "").toLowerCase() === "high" ? 1000 : String(s || "").toLowerCase() === "medium" ? 500 : String(s || "").toLowerCase() === "low" ? 100 : 0);
    const sa = severityScore(a.severity);
    const sb = severityScore(b.severity);
    if (sb !== sa) return sb - sa;
    const aStrength = Number.isFinite(a.evidence_strength) ? a.evidence_strength : 1;
    const bStrength = Number.isFinite(b.evidence_strength) ? b.evidence_strength : 1;
    if (bStrength !== aStrength) return bStrength - aStrength;
    const apr = a.priority_rank || 0;
    const bpr = b.priority_rank || 0;
    return bpr - apr;
  });

  let remediationList = remediationCandidates.slice();
  if (topPriority) {
    remediationList = remediationList.filter((f) => f.finding_key !== topPriority.finding_key);
    remediationList.unshift(topPriority);
  }


  return (
    <>
      <div className="mb-7">
        <h2 className="page-title text-3xl font-black uppercase tracking-tight text-white md:text-[2.1rem]">CTI Decision Support</h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-400">Owner-friendly prioritisation for the selected asset</p>
      </div>

      <div className="mb-5 grid w-full max-w-[980px] grid-cols-1 gap-4">
        <div className="flex gap-3">
          <select
            value={ctiAssetId}
            onChange={(e) => setCtiAssetId(e.target.value)}
            className="input-cyber rounded-md px-3 py-2 text-sm"
          >
            <option value="">Select an asset</option>
            {assets.map((asset) => (
              <option key={asset.id} value={asset.id}>
                {formatAssetOptionLabel ? formatAssetOptionLabel(asset) : (asset.name || asset.target) + " (" + asset.target + ") - " + getAssetTypeLabel(asset.type)}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <SummaryCard label="Overall Risk">
            <p className={`${largeValueClass} ${overallRisk === "High" ? "text-red-300" : overallRisk === "Medium" ? "text-amber-300" : "text-emerald-300"}`}>{isCtiAssetSelected ? overallRisk : "-"}</p>
          </SummaryCard>

          <SummaryCard label="Priority Findings">
            <p className={`${largeValueClass} text-zinc-100`}>{isCtiAssetSelected ? priorityFindingsCount : "-"}</p>
          </SummaryCard>

          <SummaryCard label="Top Priority">
            {isCtiAssetSelected ? (
              topPriority ? (
                <div className="mt-2">
                  
                  <p className={topPrioritySummaryClass}>{topPriority.title || topPriority.summary}</p>
                </div>
              ) : (
                <p className="mt-2 text-sm text-zinc-300">No priority findings</p>
              )
            ) : (
              <p className="mt-2 text-sm text-zinc-300">-</p>
            )}
          </SummaryCard>
        </div>

        <div className="mt-4">
          {ctiLoading ? (
            <div className="panel-surface-muted rounded-xl p-6">Loading CTI...</div>
          ) : ctiError ? (
            <div className="panel-surface-muted rounded-xl p-6 text-red-300">{ctiError}</div>
          ) : !ctiAssetId ? (
            <div className="panel-surface-muted rounded-xl p-6 text-zinc-300">Select an asset to view CTI findings.</div>
          ) : (
            /* Remediation section: heading + list of remediation cards (Top Priority first) */
            <section>
              <div className="panel-surface rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <p className={sectionLabelClass}>REMEDIATION ACTION</p>
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  {remediationList && remediationList.length > 0 ? (
                    remediationList.map((r) => (
                      <article key={r.finding_key} className="panel-surface rounded-lg p-4">
                        <p className="text-sm text-zinc-100 font-semibold">{r.title || r.summary}</p>
                        <div className="mt-3 space-y-2 text-sm">
                          <div>
                            <p className={sectionLabelClass}>Why it matters</p>
                            <p className="mt-1 text-sm text-zinc-300">{r.why}</p>
                          </div>

                          <div>
                            <p className={sectionLabelClass}>Recommended action</p>
                            <p className="mt-1 text-sm text-zinc-300">{r.action}</p>
                          </div>
                        </div>
                      </article>
                    ))
                  ) : (
                    <article className="panel-surface rounded-xl p-4">
                      <p className="mt-2 text-sm text-zinc-300">No remediation action required for this asset.</p>
                    </article>
                  )}
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
