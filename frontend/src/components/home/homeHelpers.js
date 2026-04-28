import { deriveFindingsFromRuns } from "@/components/cti/ctiHelpers";
export async function computeHomeMetrics(assets, getAssetHistory, getTlsDetails, parseBooleanLike) {
  const findingsCounts = { High: 0, Medium: 0, Low: 0 };

  
  const days = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    days.push(key);
  }

  const activityMap = {};
  days.forEach((d) => {
    activityMap[d] = { date: d, completed: 0, failed: 0, incomplete: 0, total: 0 };
  });

  if (!Array.isArray(assets) || assets.length === 0 || !getAssetHistory) {
    return { findingsCounts, recentActivity: Object.values(activityMap) };
  }

  
  const calls = assets.map(async (asset) => {
    try {
      const payload = await getAssetHistory(asset.backendId);
      const runs = payload?.runs || [];

        
      try {
        const findings = deriveFindingsFromRuns(runs || [], { getTlsDetails, parseBooleanLike }) || [];
        findings.forEach((f) => {
          if (!f || f.valid_for_risk === false) return;
          if (String(f.source_check || "").toLowerCase() === "credentials") return; // exclude standalone credential exposure
          const sev = String(f.severity || "").toLowerCase();
          if (sev === "high") findingsCounts.High += 1;
          else if (sev === "medium") findingsCounts.Medium += 1;
          else if (sev === "low") findingsCounts.Low += 1;
        });
      } catch (e) {
        
      }

      // Aggregate runs into recent activity
      runs.forEach((run) => {
        const time = run.finished_at || run.started_at || run.created_at;
        if (!time) return;
        const day = new Date(time).toISOString().slice(0, 10);
        if (!activityMap[day]) return;

        
        const statusRaw = String(run.status || "").toLowerCase();
        let status = "incomplete";
        if (statusRaw === "failed") status = "failed";
        else if (run.finished_at) status = "completed";

        activityMap[day][status] = (activityMap[day][status] || 0) + 1;
        activityMap[day].total = (activityMap[day].total || 0) + 1;
      });
    } catch (err) {
      
    }
  });

  await Promise.all(calls);

  const recentActivity = Object.values(activityMap);
  return { findingsCounts, recentActivity };
}
