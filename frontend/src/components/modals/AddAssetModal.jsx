import React from "react";

export default function AddAssetModal({
  addForm,
  setAddForm,
  addErrors,
  addSubmitError,
  assetTypeOptions,
  setIsAddAssetOpen,
  setAddErrors,
  setAddSubmitError,
  handleSaveAsset,
  isSavingAsset,
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="panel-surface w-full max-w-md rounded-xl p-6">
        <h3 className="text-xl font-semibold text-zinc-100">Add Asset</h3>

        <div className="mt-5 space-y-4">
          <div>
            <label className="mb-1 block text-sm text-zinc-300">Asset Name</label>
            <input
              value={addForm.name}
              onChange={(e) => setAddForm((prev) => ({ ...prev, name: e.target.value }))}
              className="input-cyber w-full rounded-md px-3 py-2"
              placeholder="Optional"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-zinc-300">Target</label>
            <input
              value={addForm.target}
              onChange={(e) => setAddForm((prev) => ({ ...prev, target: e.target.value }))}
              className="input-cyber w-full rounded-md px-3 py-2"
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
              className="input-cyber w-full rounded-md px-3 py-2"
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

        {addSubmitError ? <p className="mt-3 text-sm text-red-300">{addSubmitError}</p> : null}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              setIsAddAssetOpen(false);
              setAddErrors({ target: "", type: "" });
              setAddSubmitError("");
            }}
            className="btn-cyber-subtle rounded-md px-4 py-2 text-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSaveAsset}
            disabled={isSavingAsset}
            className="btn-cyber rounded-md px-4 py-2 text-sm font-semibold"
          >
            {isSavingAsset ? "Saving..." : "Save Asset"}
          </button>
        </div>
      </div>
    </div>
  );
}
