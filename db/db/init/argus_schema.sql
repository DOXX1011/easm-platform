CREATE TABLE IF NOT EXISTS assets (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    asset_type VARCHAR(20) NOT NULL CHECK (asset_type IN ('host', 'domain', 'website')),
    asset_value VARCHAR(255) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'not_configured',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS asset_checks (
    id SERIAL PRIMARY KEY,
    asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    check_type VARCHAR(30) NOT NULL CHECK (check_type IN ('ports', 'email', 'tls')),
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    frequency VARCHAR(20) CHECK (frequency IN ('1min', '15min', '1hour', '6hours', 'daily')),
    last_run_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(asset_id, check_type)
);

CREATE TABLE IF NOT EXISTS scan_runs (
    id SERIAL PRIMARY KEY,
    asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    check_type VARCHAR(30) NOT NULL CHECK (check_type IN ('ports', 'email', 'tls', 'credential_exposure', 'web_exposure')),
    run_type VARCHAR(20) NOT NULL CHECK (run_type IN ('scheduled', 'manual')),
    status VARCHAR(20) NOT NULL CHECK (status IN ('queued', 'running', 'completed', 'failed')),
    started_at TIMESTAMP NULL,
    finished_at TIMESTAMP NULL,
    summary TEXT NULL,
    evidence JSONB NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_assets_asset_type ON assets(asset_type);
CREATE INDEX IF NOT EXISTS idx_asset_checks_asset_id ON asset_checks(asset_id);
CREATE INDEX IF NOT EXISTS idx_scan_runs_asset_id ON scan_runs(asset_id);
CREATE INDEX IF NOT EXISTS idx_scan_runs_check_type ON scan_runs(check_type);
