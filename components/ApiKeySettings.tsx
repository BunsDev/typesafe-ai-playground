"use client";
import { useEffect, useRef, useState } from "react";
import { KeyRound, X } from "lucide-react";
import { API_KEY_EVENT, readApiKey, saveApiKey } from "../lib/api-key";
export function ApiKeySettings() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [saved, setSaved] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    const sync = () => setSaved(!!readApiKey());
    sync();
    window.addEventListener(API_KEY_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(API_KEY_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  function close() {
    setDraft("");
    setError("");
    dialog.current?.close();
  }
  return (
    <>
      <button
        className="icon-button"
        aria-label="API key settings"
        title={saved ? "Personal API key saved" : "API key settings"}
        onClick={() => dialog.current?.showModal()}
      >
        <KeyRound size={18} />
      </button>
      <dialog
        ref={dialog}
        className="api-key-dialog"
        aria-labelledby="api-key-title"
        onCancel={close}
        onClose={() => setDraft("")}
      >
        <div className="api-key-heading">
          <h2 id="api-key-title">Your TypeSafe API key</h2>
          <button
            className="icon-button"
            aria-label="Close API key settings"
            onClick={close}
          >
            <X size={18} />
          </button>
        </div>
        <p>
          {saved
            ? "A personal key is saved. It overrides the default for all Jev requests in this browser."
            : "Import your key to override the shared server default."}
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            try {
              saveApiKey(draft);
              close();
            } catch {
              setError(
                "Could not save. Check the key format and allow browser storage.",
              );
            }
          }}
        >
          <label htmlFor="personal-api-key">
            {saved ? "Replace API key" : "API key"}
          </label>
          <input
            id="personal-api-key"
            type="password"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            value={draft}
            placeholder={
              saved ? "Enter a replacement key" : "Paste your TypeSafe API key"
            }
            onChange={(e) => setDraft(e.target.value)}
            required
          />
          <p className="field-hint">
            Saved on this browser until removed or site data is cleared. Masked
            on screen; sent only with Jev requests through this app. The saved
            value is never displayed.
          </p>
          {error && <p role="alert">{error}</p>}
          <div className="api-key-actions">
            <button
              className="button primary"
              type="submit"
              disabled={!draft.trim()}
            >
              Save key
            </button>
            {saved && (
              <button
                className="button"
                type="button"
                onClick={() => {
                  try {
                    saveApiKey("");
                    setDraft("");
                  } catch {
                    setError("Could not remove key from browser storage.");
                  }
                }}
              >
                Remove override
              </button>
            )}
          </div>
        </form>
      </dialog>
    </>
  );
}
