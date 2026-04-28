import React from "react";

export default function ConfigureChecksModal({
  selectedAsset,
  checkDraft,
  configError,
  configLoading,
  isSavingConfig,
  checkDefinitions,
  handleToggleCheck,
  handleFrequencyChange,
  setConfiguredAssetId,
  setCheckDraft,
  handleSaveConfiguration,
  getAssetTypeLabel,
  frequencyOptions,
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="panel-surface w-full max-w-2xl rounded-xl p-6">
        <h3 className="text-xl font-semibold text-zinc-100">Configure Checks</h3>
        <p className="mt-1 text-sm text-zinc-400">{selectedAsset.name || selectedAsset.target} • {getAssetTypeLabel(selectedAsset.type)}</p>

        {configError ? <p className="mt-3 text-sm text-red-300">{configError}</p> : null}

        <div className="mt-5 space-y-3">
          {configLoading ? (
            <div className="panel-surface-muted rounded-lg p-4 text-zinc-300">Loading checks...</div>
          ) : null}

          {checkDefinitions
            .filter((definition) => checkDraft?.[definition.key]?.available)
            .map((definition) => {
              const check = checkDraft[definition.key];

              return (
                <div key={definition.key} className="panel-surface-muted rounded-lg p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm font-medium text-zinc-200">{definition.label}</p>
                    </div>

                    <div className="flex items-center gap-3">
                      <label className="inline-flex items-center gap-2 text-sm text-zinc-300">
                        <input
                          type="checkbox"
                          checked={check.enabled}
                          disabled={configLoading || isSavingConfig}
                          onChange={(e) => handleToggleCheck(definition.key, e.target.checked)}
                          className="h-4 w-4 accent-red-500 disabled:accent-zinc-700"
                        />
                        Enabled
                      </label>

                      <select
                        value={check.frequency || ""}
                        disabled={!check.enabled || configLoading || isSavingConfig}
                        onChange={(e) => handleFrequencyChange(definition.key, e.target.value)}
                        className="input-cyber rounded-md px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <option value="">Select frequency</option>
                        {frequencyOptions.map((option) => (
                          <option key={option} value={option}>{option}</option>
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
            className="btn-cyber-subtle rounded-md px-4 py-2 text-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSaveConfiguration}
            disabled={configLoading || isSavingConfig}
            className="btn-cyber rounded-md px-4 py-2 text-sm font-semibold"
          >
            {isSavingConfig ? "Saving..." : "Save Configuration"}
          </button>
        </div>
      </div>
    </div>
  );
}
