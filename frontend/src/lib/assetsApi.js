const envApiBase = (import.meta.env.VITE_API_BASE_URL || "").trim();
const normalizedEnvApiBase = envApiBase.replace(/\/+$/, "");
const API_BASE = normalizedEnvApiBase || (import.meta.env.DEV ? "http://192.168.146.129:8000" : "");

async function request(path, options = {}) {
  const url = API_BASE ? `${API_BASE}${path}` : path;

  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    let message = `Request failed: ${response.status}`;

    try {
      const payload = await response.json();
      message = payload?.detail || payload?.message || message;
    } catch {
      const text = await response.text();
      if (text) message = text;
    }

    throw new Error(message);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export function getAssets() {
  return request("/assets");
}

export function createAsset(payload) {
  return request("/assets", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function deleteAsset(assetId) {
  return request(`/assets/${assetId}`, {
    method: "DELETE",
  });
}

export function getAssetChecks(assetId) {
  return request(`/assets/${assetId}/checks`);
}

export function saveAssetChecks(assetId, payload) {
  return request(`/assets/${assetId}/checks`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function runAssetNow(assetId) {
  return request(`/assets/${assetId}/run-now`, {
    method: "POST",
  });
}

export function getAssetHistory(assetId) {
  return request(`/assets/${assetId}/history`);
}

export function checkCredentialExposureEmail(email) {
  return request("/credential-exposure/email", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function checkCredentialExposurePassword(password) {
  return request("/credential-exposure/password", {
    method: "POST",
    body: JSON.stringify({ password }),
  });
}
