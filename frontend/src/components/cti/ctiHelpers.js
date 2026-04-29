export function getLatestRunByType(runs, type) {
  if (!Array.isArray(runs)) return null;
  const filtered = runs.filter(
    (r) => String(r.check_type || "").toLowerCase() === String(type).toLowerCase()
  );
  if (filtered.length === 0) return null;
  filtered.sort((a, b) => {
    const aTime = getRunTimeMs(a);
    const bTime = getRunTimeMs(b);
    return bTime - aTime;
  });
  return filtered[0];
}

function getRunTimeMs(run) {
  const value = (run && (run.finished_at || run.started_at || run.created_at)) || null;
  if (!value) return 0;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

export function deriveFindingsFromRuns(runs, { getTlsDetails, parseBooleanLike }) {
  const findings = [];
  if (!Array.isArray(runs) || runs.length === 0) return findings;

  function pushFinding({
    source_check,
    finding_key,
    severity,
    title,
    why_it_matters,
    recommended_action,
    evidence,
    valid_for_risk = true,
    priority_rank = 10,
    evidence_strength,
  }) {
    findings.push({
      source_check: source_check || null,
      finding_key: finding_key || null,
      severity: severity || "Informational",
      title: title || title === "" ? title : title || "",
      summary: title || "",
      why: why_it_matters || "",
      action: recommended_action || "",
      evidence: evidence || null,
      valid_for_risk: Boolean(valid_for_risk),
      priority_rank: Number.isFinite(priority_rank) ? priority_rank : 10,
      evidence_strength: Number.isFinite(evidence_strength) ? evidence_strength : undefined,
    });
  }

  const portsRun = getLatestRunByType(runs, "ports");
  if (portsRun) {
    const evidence = portsRun.evidence && typeof portsRun.evidence === "object" ? portsRun.evidence : null;
    const findingsList = Array.isArray(evidence?.findings) ? evidence.findings : [];

    const portPriority = {
      5432: 85,
      3306: 85,
      3389: 85,
      445: 85,
      6379: 85,
      27017: 85,
      9200: 85,
      11211: 85,
      5900: 85,
      389: 85,
      636: 85,
      1521: 85,
      1433: 85,
      5000: 85,
      5601: 85,
      2375: 85,
      2376: 85,
      6443: 85,
    };

    const highPorts = new Set(Object.keys(portPriority).map((n) => Number(n)));
    const medPorts = new Set([22, 21, 25, 53, 110, 143, 587, 993, 995, 8080, 8443, 8888, 9090]);
    const lowPorts = new Set([80, 443]);

    function normalizeFindingItem(item) {
      const port = Number(item?.port);
      const banner = item?.banner || item?.service_banner || null;
      const service = item?.service || item?.service_name || item?.name || null;
      const rawConfidence = (item?.confidence || item?.conf || item?.confidence_level || "").toString().toLowerCase();
      const confidence = rawConfidence.includes("high")
        ? "high"
        : rawConfidence.includes("low")
          ? "low"
          : rawConfidence.includes("med") || rawConfidence.includes("medium")
            ? "medium"
            : null;
      const inferred = item?.inferred === true || (!banner && !service);
      return { port, banner, service, confidence, inferred };
    }

    function evidenceStrength(item) {
      if (!item) return 1;
      if (item.confidence === "high") return 3;
      if (item.banner && String(item.banner).toLowerCase() !== "no banner") return 3;
      if (item.service && item.confidence !== "low") return 3;
      if (item.confidence === "medium") return 2;
      if (item.confidence === "low") return 1;
      if (item.inferred) return 1;
      return 1;
    }

    findingsList.forEach((raw) => {
      const info = normalizeFindingItem(raw);
      const p = info.port;
      if (!Number.isFinite(p)) return;

      const strength = evidenceStrength(info);
      const isHighPort = highPorts.has(p);
      const isMedPort = medPorts.has(p);
      const isLowPort = lowPorts.has(p);

      const conservativeTitle =
        isHighPort && strength < 3
          ? `Open service port ${p}`
          : isHighPort
            ? `Open high-risk port ${p}`
            : `Open service port ${p}`;

      if (isHighPort) {
        const sev = strength >= 3 ? "High" : "Medium";
        pushFinding({
          source_check: "ports",
          finding_key: `port-${p}`,
          severity: sev,
          title: conservativeTitle,
          why_it_matters: `Port ${p} may expose a sensitive service to the internet.`,
          recommended_action: `Restrict external access to port ${p}, apply firewall rules and verify service configuration.`,
          evidence: JSON.stringify(raw).slice(0, 200),
          valid_for_risk: true,
          priority_rank: portPriority[p] || 85,
          evidence_strength: strength,
        });
        return;
      }

      if (isMedPort) {
        pushFinding({
          source_check: "ports",
          finding_key: `port-${p}`,
          severity: "Medium",
          title: `Open service port ${p}`,
          why_it_matters: `Port ${p} may expose administrative interfaces or unpatched services.`,
          recommended_action: `Harden service on port ${p} and restrict access where possible.`,
          evidence: JSON.stringify(raw).slice(0, 200),
          valid_for_risk: true,
          priority_rank: 70,
          evidence_strength: strength,
        });
        return;
      }

      if (isLowPort) {
        pushFinding({
          source_check: "ports",
          finding_key: `port-${p}`,
          severity: "Low",
          title: `Open service port ${p}`,
          why_it_matters: `These are typical web service ports; ensure services are up-to-date and monitored.`,
          recommended_action: `Review web server configuration and monitoring.`,
          evidence: JSON.stringify(raw).slice(0, 200),
          valid_for_risk: true,
          priority_rank: 20,
          evidence_strength: strength,
        });
        return;
      }

      pushFinding({
        source_check: "ports",
        finding_key: `port-${p}`,
        severity: "Medium",
        title: `Open service port ${p}`,
        why_it_matters: `A publicly reachable service was detected on port ${p}.`,
        recommended_action: `Confirm whether port ${p} is intentionally exposed and restrict access if not required.`,
        evidence: JSON.stringify(raw).slice(0, 200),
        valid_for_risk: true,
        priority_rank: 50,
        evidence_strength: strength,
      });
    });

    const portNumbers = findingsList.map((f) => Number(f.port)).filter((p) => Number.isFinite(p));
    const lowOpen = portNumbers.filter((p) => lowPorts.has(p));
    if (portNumbers.length > 0 && lowOpen.length === portNumbers.length) {
      pushFinding({
        source_check: "ports",
        finding_key: `ports-low-${lowOpen.join(",")}`,
        severity: "Low",
        title: `Only common web ports open (${lowOpen.join(", ")})`,
        why_it_matters: `These are typical web service ports; ensure services are up-to-date and monitored.`,
        recommended_action: `Review web server configuration and monitoring.`,
        evidence: `Ports ${lowOpen.join(", ")}`,
        valid_for_risk: true,
        priority_rank: 20,
        evidence_strength: 1,
      });
    }
  }

  const tlsRun = getLatestRunByType(runs, "tls");
  if (tlsRun) {
    const tlsDetails = getTlsDetails
      ? getTlsDetails(tlsRun.evidence || {})
      : { connectivity: {}, certificate: {}, headers: { missing: [] } };

    const httpsReachable =
      tlsDetails.connectivity && typeof tlsDetails.connectivity.httpsReachable !== "undefined"
        ? tlsDetails.connectivity.httpsReachable
        : null;
    const httpReachable =
      tlsDetails.connectivity && typeof tlsDetails.connectivity.httpReachable !== "undefined"
        ? tlsDetails.connectivity.httpReachable
        : null;
    const statusCode =
      tlsDetails.connectivity && tlsDetails.connectivity.statusCode
        ? tlsDetails.connectivity.statusCode
        : null;
    const evidenceIncomplete =
      !!tlsRun.evidence?.incomplete ||
      !!tlsRun.evidence?.timeout ||
      statusCode === 503 ||
      tlsRun.status === "failed";

    if (evidenceIncomplete || httpsReachable === null) {
      pushFinding({
        source_check: "tls",
        finding_key: `tls-operational-${tlsRun.id || Date.now()}`,
        severity: "Medium",
        title: "Target unavailable or assessment incomplete",
        why_it_matters:
          "We could not complete a reliable security check for this website. Without a complete assessment, there may be unknown risks that need attention.",
        recommended_action:
          "Confirm the site is reachable, fix any availability or server errors, and run the assessment again so we can produce a full result.",
        evidence: JSON.stringify(tlsRun.evidence || {}).slice(0, 200),
        valid_for_risk: true,
        priority_rank: 70,
      });
    } else if (httpsReachable === false && httpReachable === true) {
      pushFinding({
        source_check: "tls",
        finding_key: `https-unavailable-${tlsRun.id || Date.now()}`,
        severity: "High",
        title: "HTTPS unavailable",
        why_it_matters:
          "Visitors to the site are not using a secure connection. This can expose sensitive information and reduce customer trust.",
        recommended_action:
          "Enable secure (HTTPS) access for the site by installing a valid certificate and ensuring traffic uses the secure connection.",
        evidence: "HTTPS unreachable",
        valid_for_risk: true,
        priority_rank: 88,
      });
    } else if (tlsDetails.certificate && tlsDetails.certificate.present === true && tlsDetails.certificate.valid === false) {
      pushFinding({
        source_check: "tls",
        finding_key: `cert-expired-${tlsRun.id || Date.now()}`,
        severity: "High",
        title: "Certificate expired",
        why_it_matters:
          "The site's security certificate has expired. This can break secure connections and cause browsers to warn visitors.",
        recommended_action:
          "Renew and publish an up-to-date security certificate so visitors can connect securely.",
        evidence: `Expiry: ${tlsDetails.certificate.expiry || "unknown"}`,
        valid_for_risk: true,
        priority_rank: 100,
      });
    } else {
      if (tlsDetails.connectivity && tlsDetails.connectivity.redirectToHttps === false) {
        pushFinding({
          source_check: "tls",
          finding_key: `tls-redirect-${tlsRun.id || Date.now()}`,
          severity: "Medium",
          title: "Redirect to HTTPS missing",
          why_it_matters:
            "Some users may still access the site over an insecure connection, which can expose data and reduce trust.",
          recommended_action:
            "Update the site or server settings to automatically send users to the secure (HTTPS) version of the site.",
          evidence: "No redirect",
          valid_for_risk: true,
          priority_rank: 55,
        });
      }

      if (Array.isArray(tlsDetails.headers.missing) && tlsDetails.headers.missing.length >= 3) {
        pushFinding({
          source_check: "tls",
          finding_key: `tls-headers-${tlsRun.id || Date.now()}`,
          severity: "Medium",
          title: `Missing browser security settings (${tlsDetails.headers.missing.length})`,
          why_it_matters:
            "Several browser protection settings are missing. This reduces built-in protection for visitors and makes the website less resilient to common web-based attacks.",
          recommended_action:
            "Enable the missing security settings in the website or server configuration and rerun the scan to confirm the protections are active.",
          evidence: tlsDetails.headers.missing.join(", "),
          valid_for_risk: true,
          priority_rank: 60,
        });
      } else if (Array.isArray(tlsDetails.headers.missing) && tlsDetails.headers.missing.length > 0) {
        pushFinding({
          source_check: "tls",
          finding_key: `tls-headers-minor-${tlsRun.id || Date.now()}`,
          severity: "Low",
          title: `${tlsDetails.headers.missing.length} security settings missing`,
          why_it_matters:
            "Some browser protection settings are not enabled. While not critical, enabling them improves visitor protection.",
          recommended_action:
            "Enable the missing settings and rerun the scan to confirm they are active.",
          evidence: tlsDetails.headers.missing.join(", "),
          valid_for_risk: true,
          priority_rank: 60,
        });
      }
    }
  }

  const emailRun = getLatestRunByType(runs, "email");
  if (emailRun) {
    const spf = emailRun.evidence?.spf;
    const dmarc = emailRun.evidence?.dmarc;
    const dkim = emailRun.evidence?.dkim;
    const spfPresent = parseBooleanLike ? parseBooleanLike(spf?.present) === true : false;
    const dmarcPresent = parseBooleanLike ? parseBooleanLike(dmarc?.present) === true : false;
    const dkimPresent = parseBooleanLike ? parseBooleanLike(dkim?.present) === true : false;

    if (!spfPresent) {
      pushFinding({
        source_check: "email",
        finding_key: `spf-missing-${emailRun.id || Date.now()}`,
        severity: "Medium",
        title: "SPF record missing",
        why_it_matters: "Missing SPF increases risk of spoofing.",
        recommended_action: "Publish a valid SPF record.",
        evidence: "SPF not present",
        valid_for_risk: true,
        priority_rank: 50,
      });
    }

    if (!dmarcPresent) {
      pushFinding({
        source_check: "email",
        finding_key: `dmarc-missing-${emailRun.id || Date.now()}`,
        severity: "Medium",
        title: "DMARC record missing",
        why_it_matters: "DMARC helps prevent domain abuse.",
        recommended_action: "Publish DMARC policy for your domain.",
        evidence: "DMARC not present",
        valid_for_risk: true,
        priority_rank: 48,
      });
    }

    if (!dkimPresent) {
      pushFinding({
        source_check: "email",
        finding_key: `dkim-missing-${emailRun.id || Date.now()}`,
        severity: "Low",
        title: "DKIM not confirmed",
        why_it_matters: "Missing DKIM reduces confidence in message integrity.",
        recommended_action: "Configure DKIM signing for outbound mail and verify selector records.",
        evidence: "DKIM not confirmed",
        valid_for_risk: true,
        priority_rank: 35,
      });
    }
  }

  const credRun =
    getLatestRunByType(runs, "credentials") ||
    getLatestRunByType(runs, "credential") ||
    getLatestRunByType(runs, "credential_exposure");

  if (credRun) {
    const payload = credRun.evidence || {};
    const foundEmail = parseBooleanLike
      ? parseBooleanLike(payload?.found) === true || parseBooleanLike(payload?.exposed) === true
      : false;
    const foundPassword = parseBooleanLike
      ? parseBooleanLike(payload?.exposed) === true || parseBooleanLike(payload?.breached) === true
      : false;

    if (foundEmail) {
      pushFinding({
        source_check: "credentials",
        finding_key: `cred-email-${credRun.id || Date.now()}`,
        severity: "High",
        title: "Email found in public breach data",
        why_it_matters: "Exposed identities can increase phishing and account compromise risk.",
        recommended_action: "Review affected accounts, reset reused credentials, and enable MFA.",
        evidence: JSON.stringify(payload).slice(0, 160),
        valid_for_risk: true,
        priority_rank: 95,
      });
    }

    if (foundPassword) {
      pushFinding({
        source_check: "credentials",
        finding_key: `cred-pass-${credRun.id || Date.now()}`,
        severity: "High",
        title: "Password exposed in known leaks",
        why_it_matters: "A leaked password should be treated as compromised.",
        recommended_action: "Change the password immediately and prevent reuse.",
        evidence: JSON.stringify(payload).slice(0, 160),
        valid_for_risk: true,
        priority_rank: 100,
      });
    }
  }

  return findings;
}