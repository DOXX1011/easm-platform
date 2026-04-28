export const serviceLabelMap = {
  http: "HTTP",
  https: "HTTPS",
  "http-alt": "Web Admin",
  "https-alt": "Secure Admin",
  ssh: "SSH",
  smtp: "SMTP",
  postgresql: "PostgreSQL",
  mysql: "MySQL",
  rdp: "RDP",
  smb: "SMB",
};

export function formatServiceLabel(service) {
  if (!service) return "Unknown";
  return serviceLabelMap[service] || service.toUpperCase();
}

export function formatHistoryDate(value) {
  if (!value) return "-";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

export function formatHistoryDateTime(value) {
  if (!value) return "-";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(parsed);
}

export function getHistoryCheckLabel(checkType) {
  if (checkType === "ports") return "PORTS";
  if (checkType === "tls") return "TLS";
  return String(checkType || "unknown").toUpperCase();
}
