UPDATE assets
SET status = 'configured'
WHERE status = 'monitoring_enabled';

UPDATE assets
SET status = 'not_configured'
WHERE status IS NULL OR status NOT IN ('not_configured', 'configured');
