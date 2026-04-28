import React from "react";

export default function HistoryPage({
  assets,
  historyAssetId,
  setHistoryAssetId,
  historySearch,
  setHistorySearch,
  historyRuns,
  historyLoading,
  historyError,
  expandedHistoryRunIds,
  toggleHistoryRun,
  formatAssetOptionLabel,
  getHistorySummary,
  getHistoryCheckLabel,
  getTlsDetails,
  formatHistoryDate,
  formatHistoryDateTime,
  formatServiceLabel,
  getRunTimeMs,
}) {
  const query = (historySearch || "").trim().toLowerCase();
  const sortedRuns = [...(historyRuns || [])].sort((a, b) => getRunTimeMs(b) - getRunTimeMs(a));
  const filteredRuns = query
    ? sortedRuns.filter((run) => {
        const summary = (run.summary || "").toLowerCase();
        const status = (run.status || "").toLowerCase();
        const checkType = (run.check_type || "").toLowerCase();
        const friendlySummary = (getHistorySummary && typeof getHistorySummary === "function") ? (getHistorySummary(run) || "").toLowerCase() : (run.summary || "").toLowerCase();
        return (
          summary.includes(query) ||
          status.includes(query) ||
          checkType.includes(query) ||
          friendlySummary.includes(query)
        );
      })
    : sortedRuns;

  return (
    <>
      <div className="mb-7">
        <h2 className="page-title text-3xl font-black uppercase tracking-tight text-white md:text-[2.1rem]">History</h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-400">View previous scan results for the selected asset.</p>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-2">
        <select
          value={historyAssetId}
          onChange={(e) => setHistoryAssetId(e.target.value)}
          className="input-cyber rounded-md px-3 py-2 text-sm"
          disabled={!assets || assets.length === 0}
        >
          {(!assets || assets.length === 0) ? (
            <option value="">No assets available</option>
          ) : (
            assets.map((asset) => (
              <option key={asset.id} value={asset.id}>
                {formatAssetOptionLabel ? formatAssetOptionLabel(asset) : (asset.name || asset.target)}
              </option>
            ))
          )}
        </select>

        <input
          value={historySearch}
          onChange={(e) => setHistorySearch(e.target.value)}
          placeholder="Search by summary, status, check type"
          className="input-cyber rounded-md px-3 py-2 text-sm"
        />
      </div>

      {historyError ? <p className="mb-4 text-sm text-red-300">{historyError}</p> : null}

      {!historyAssetId ? (
        <div className="panel-surface-muted rounded-xl p-8 text-sm text-zinc-300">Select an asset to view history.</div>
      ) : historyLoading ? (
        <div className="panel-surface-muted rounded-xl p-8 text-sm text-zinc-300">Loading history...</div>
      ) : filteredRuns.length === 0 ? (
        <div className="panel-surface-muted rounded-xl p-8 text-sm text-zinc-300">No history entries for this asset.</div>
      ) : (
        <div className="space-y-2.5">
          {filteredRuns.map((run) => {
            const isExpanded = expandedHistoryRunIds.has(run.id);
            const evidence = run.evidence && typeof run.evidence === "object" ? run.evidence : null;
            const findings = Array.isArray(evidence?.findings) ? evidence.findings : [];
            const tlsDetails = getTlsDetails ? getTlsDetails(evidence) : { connectivity: {}, certificate: { expiry: null, daysUntilExpiry: null }, headers: { missing: [], present: [] } };
            const emailSpf = evidence?.spf && typeof evidence.spf === "object" ? evidence.spf : null;
            const emailDmarc = evidence?.dmarc && typeof evidence.dmarc === "object" ? evidence.dmarc : null;
            const emailDkim = evidence?.dkim && typeof evidence.dkim === "object" ? evidence.dkim : null;
            const emailSpfLabel = emailSpf?.present === true ? "Present" : emailSpf?.present === false ? "Missing" : "Unknown";
            const emailDmarcLabel = emailDmarc?.present === true ? "Present" : emailDmarc?.present === false ? "Missing" : "Unknown";
            const emailDkimLabel = emailDkim?.present === true ? "Present" : emailDkim?.present === false ? "Not confirmed" : "Unknown";
            const emailDmarcPolicy = emailDmarc?.policy || null;
            const emailDkimSelector = emailDkim?.selector || null;
            const summaryText = getHistorySummary ? getHistorySummary(run) : run.summary;
            const checkTypeLabel = getHistoryCheckLabel ? getHistoryCheckLabel(run.check_type) : (run.check_type || "unknown").toUpperCase();
            const statusLabel = String(run.status || "unknown").toUpperCase();
            const hasPortsFindings = run.check_type === "ports" && findings.length > 0;
            const subjectText = tlsDetails.certificate?.subject;
            const issuerText = tlsDetails.certificate?.issuer;
            const showSubject = Boolean(subjectText && subjectText !== "-");
            const showIssuer = Boolean(issuerText && issuerText !== "-");
            const handleHistoryToggle = () => toggleHistoryRun(run.id);
            const handleHistoryToggleKeyDown = (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                toggleHistoryRun(run.id);
              }
            };

            return (
              <article
                key={run.id}
                role={!isExpanded ? "button" : undefined}
                tabIndex={!isExpanded ? 0 : undefined}
                onClick={!isExpanded ? handleHistoryToggle : undefined}
                onKeyDown={!isExpanded ? handleHistoryToggleKeyDown : undefined}
                className={`panel-surface rounded-xl p-4 ${!isExpanded ? "cursor-pointer" : ""}`}
                aria-expanded={isExpanded}
              >
                <div
                  role={isExpanded ? "button" : undefined}
                  tabIndex={isExpanded ? 0 : undefined}
                  onClick={isExpanded ? handleHistoryToggle : undefined}
                  onKeyDown={isExpanded ? handleHistoryToggleKeyDown : undefined}
                  className={isExpanded ? "cursor-pointer" : ""}
                  aria-expanded={isExpanded}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm uppercase tracking-[0.16em] text-zinc-500">{checkTypeLabel}</p>
                    <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">{statusLabel}</p>
                  </div>

                  <p className="mt-1.5 text-sm leading-relaxed text-zinc-100">{summaryText}</p>

                  <div className="mt-2.5 grid grid-cols-1 gap-1 text-xs text-zinc-500 md:grid-cols-2">
                    <p>Started: {formatHistoryDateTime ? formatHistoryDateTime(run.started_at) : (run.started_at || "-")}</p>
                    <p>Finished: {formatHistoryDateTime ? formatHistoryDateTime(run.finished_at) : (run.finished_at || "-")}</p>
                  </div>
                </div>

                {isExpanded ? (
                <div className="mt-2 space-y-2 border-t border-red-500/20 pt-2">
                  {hasPortsFindings ? (
                    <div>
                      <p className="mb-2 text-xs uppercase tracking-[0.14em] text-zinc-500">Services Detected</p>
                      <div className="overflow-x-auto rounded-md border border-zinc-800 bg-zinc-900/50">
                        <div className="grid grid-cols-[80px_120px_1fr_110px] gap-2 border-b border-zinc-800 px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-zinc-500">
                          <span>Port</span>
                          <span>Service</span>
                          <span>Banner</span>
                          <span>Confidence</span>
                        </div>
                        {findings.map((finding, index) => (
                          <div
                            key={`${run.id}-${index}`}
                            className="grid grid-cols-[80px_120px_1fr_110px] gap-2 border-b border-zinc-800 px-3 py-2 text-sm text-zinc-300 last:border-b-0"
                          >
                            <span>{finding.port ?? "-"}</span>
                            <span>{formatServiceLabel ? formatServiceLabel(finding.service) : (finding.service || "Unknown")}</span>
                            <span className="text-zinc-400">{finding.banner || "no banner"}</span>
                            <span>{finding.confidence || "-"}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {run.check_type === "tls" ? (
                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                      <section className="space-y-1 text-sm text-zinc-300">
                        <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">Web Access</p>
                        <p>HTTP reachable: {tlsDetails.connectivity.httpReachable === null ? "Unknown" : tlsDetails.connectivity.httpReachable ? "Yes" : "No"}</p>
                        <p>HTTPS reachable: {tlsDetails.connectivity.httpsReachable === null ? "Unknown" : tlsDetails.connectivity.httpsReachable ? "Yes" : "No"}</p>
                        <p>Redirect to HTTPS: {tlsDetails.connectivity.redirectToHttps === null ? "Unknown" : tlsDetails.connectivity.redirectToHttps ? "Yes" : "No"}</p>
                      </section>

                      <section className="space-y-1 text-sm text-zinc-300">
                        <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">Certificate</p>
                        {showSubject ? <p>Subject: {subjectText}</p> : null}
                        {showIssuer ? <p>Issuer: {issuerText}</p> : null}
                        <p>Expiry: {formatHistoryDate ? formatHistoryDate(tlsDetails.certificate.expiry) : (tlsDetails.certificate.expiry || "-")}</p>
                        <p>Days until expiry: {tlsDetails.certificate.daysUntilExpiry ?? "-"}</p>
                      </section>

                      <section className="text-sm text-zinc-300">
                        {tlsDetails.headers.missing.length > 0 ? (
                          <div>
                            <p className="text-xs uppercase tracking-[0.14em] text-zinc-500 mb-0">Browser Security Headers: <span className="text-xs uppercase tracking-[0.12em] text-zinc-500 whitespace-nowrap">Missing</span></p>

                            <ul className="mt-2 list-disc space-y-1 pl-5 text-zinc-300">
                              {tlsDetails.headers.missing.map((header) => (
                                <li key={`${run.id}-tech-missing-${header}`}>{header}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                      </section>
                    </div>
                  ) : null}

                  {run.check_type === "email" ? (
                    <div>
                      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3 items-start">
                        <section className="space-y-1 text-sm">
                          <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">SPF</p>
                          <p className="text-sm text-zinc-100">{emailSpfLabel}</p>
                        </section>

                        <section className="space-y-1 text-sm">
                          <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">DMARC</p>
                          <p className="text-sm text-zinc-100">{emailDmarcLabel}</p>
                          {emailDmarcPolicy ? <p className="text-sm text-zinc-100">Policy: {emailDmarcPolicy}</p> : null}
                        </section>

                        <section className="space-y-1 text-sm">
                          <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">DKIM</p>
                          <p className="text-sm text-zinc-100">{emailDkimLabel}</p>
                          {emailDkimSelector ? <p className="text-sm text-zinc-100">Selector: {emailDkimSelector}</p> : null}
                        </section>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
