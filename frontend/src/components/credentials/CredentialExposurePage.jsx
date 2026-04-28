import React from "react";

 
const sectionClass = "panel-surface flex h-full flex-col rounded-xl p-6";
const sectionTitleClass = "text-lg font-semibold text-zinc-100";
const mutedTextClass = "mt-1 text-sm text-zinc-400";
const resultContainerClass = "panel-surface-muted mt-5 rounded-lg p-4";
const resultLabelClass = "text-zinc-500";
const resultValueClass = "text-emerald-300"; // default positive
const statusPositiveClass = "text-red-300";
const statusNegativeClass = "text-emerald-300";

function SectionTitle({ children }) {
  return <h3 className={sectionTitleClass}>{children}</h3>;
}

function MutedText({ children }) {
  return <p className={mutedTextClass}>{children}</p>;
}

function ResultRow({ label, value, valueClass }) {
  return (
    <div className="flex items-center justify-between">
      <span className={resultLabelClass}>{label}</span>
      <span className={valueClass || resultValueClass}>{value}</span>
    </div>
  );
}

export default function CredentialExposurePage({
  credentialEmail,
  setCredentialEmail,
  credentialEmailLoading,
  credentialEmailError,
  credentialEmailResult,
  credentialPassword,
  setCredentialPassword,
  credentialPasswordLoading,
  credentialPasswordError,
  credentialPasswordResult,
  handleCredentialEmailCheck,
  handleCredentialPasswordCheck,
  title,
  subtitle,
}) {
  return (
    <>
      <div className="mb-7">
        <h2 className="page-title text-3xl font-black uppercase tracking-tight text-white md:text-[2.1rem]">{title}</h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-400">{subtitle}</p>
      </div>

      <div className="grid grid-cols-1 gap-5 2xl:grid-cols-2">
        <section className={sectionClass}>
          <SectionTitle>Email Breach Check</SectionTitle>
          <MutedText>Check whether an email appears in known breach datasets.</MutedText>

          <div className="mt-4 space-y-3">
            <input
              type="email"
              value={credentialEmail}
              onChange={(event) => setCredentialEmail(event.target.value)}
              placeholder="name@company.com"
              className="input-cyber w-full rounded-md px-3 py-2"
            />

            <button
              type="button"
              onClick={handleCredentialEmailCheck}
              disabled={credentialEmailLoading}
              className="btn-cyber rounded-md px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
            >
              {credentialEmailLoading ? "Checking..." : "Check Email"}
            </button>
          </div>

          <div className={resultContainerClass}>
            <h4 className="text-xs uppercase tracking-[0.14em] text-zinc-500">Result</h4>

            {credentialEmailError ? (
              <p className="mt-2 text-sm text-red-300">{credentialEmailError}</p>
            ) : credentialEmailResult ? (
              <div className="mt-3 space-y-2 text-sm text-zinc-300">
                <ResultRow label="Status" value={credentialEmailResult.found ? "Found" : "Not found"} valueClass={credentialEmailResult.found ? statusPositiveClass : statusNegativeClass} />
                <ResultRow label="Breach count" value={credentialEmailResult.breachCount} />

                {credentialEmailResult.breachNames.length > 0 ? (
                  <div>
                    <p className="mt-2 text-zinc-500">Breaches</p>
                    <ul className="mt-1 list-inside list-disc space-y-1 text-zinc-200">
                      {credentialEmailResult.breachNames.map((name) => (
                        <li key={name}>{name}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                
                <div className="mt-3">
                  <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">Recommended Action</p>
                  {credentialEmailResult.found ? (
                    <ul className="mt-2 list-inside list-disc space-y-1 text-zinc-200 text-sm">
                      <li>Review accounts associated with this email address</li>
                      <li>Change any reused passwords</li>
                      <li>Enable multi-factor authentication where possible</li>
                      <li>Watch for phishing or suspicious sign-in activity</li>
                    </ul>
                  ) : (
                    <ul className="mt-2 list-inside list-disc space-y-1 text-zinc-200 text-sm">
                      <li>No immediate action required</li>
                      <li>Continue using unique passwords and multi-factor authentication</li>
                    </ul>
                  )}
                </div>
              </div>
            ) : (
              <p className="mt-2 text-sm text-zinc-500">No result yet.</p>
            )}
          </div>
        </section>

        <section className={sectionClass}>
          <SectionTitle>Password Exposure Check</SectionTitle>
          <MutedText>Check whether a password has appeared in known credential leaks.</MutedText>

          <div className="mt-4 space-y-3">
            <input
              type="password"
              value={credentialPassword}
              onChange={(event) => setCredentialPassword(event.target.value)}
              placeholder="Enter password"
              className="input-cyber w-full rounded-md px-3 py-2"
            />

            <button
              type="button"
              onClick={handleCredentialPasswordCheck}
              disabled={credentialPasswordLoading}
              className="btn-cyber rounded-md px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
            >
              {credentialPasswordLoading ? "Checking..." : "Check Password"}
            </button>
          </div>

          <div className={resultContainerClass}>
            <h4 className="text-xs uppercase tracking-[0.14em] text-zinc-500">Result</h4>

            {credentialPasswordError ? (
              <p className="mt-2 text-sm text-red-300">{credentialPasswordError}</p>
            ) : credentialPasswordResult ? (
              <div className="mt-3 space-y-2 text-sm text-zinc-300">
                <ResultRow label="Status" value={credentialPasswordResult.exposed ? "Exposed" : "Not exposed"} valueClass={credentialPasswordResult.exposed ? statusPositiveClass : statusNegativeClass} />

                {credentialPasswordResult.occurrenceCount !== null ? (
                  <ResultRow label="Occurrence count" value={credentialPasswordResult.occurrenceCount} />
                ) : null}

                
                <div className="mt-3">
                  <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">Recommended Action</p>
                  {credentialPasswordResult.exposed ? (
                    <ul className="mt-2 list-inside list-disc space-y-1 text-zinc-200 text-sm">
                      <li>Stop using this password immediately</li>
                      <li>Change it anywhere it is currently used</li>
                      <li>Do not reuse it on other accounts</li>
                      <li>Enable multi-factor authentication where possible</li>
                    </ul>
                  ) : (
                    <ul className="mt-2 list-inside list-disc space-y-1 text-zinc-200 text-sm">
                      <li>No immediate action required</li>
                      <li>Continue using strong, unique passwords</li>
                    </ul>
                  )}
                </div>
              </div>
            ) : (
              <p className="mt-2 text-sm text-zinc-500">No result yet.</p>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
