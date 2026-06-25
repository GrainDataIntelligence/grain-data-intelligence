import { useState } from "react";

const ACCESS_PASSWORD = "GDI2026";
const STORAGE_KEY = "gdi-access-unlocked";

export default function PasswordGate({ children }) {
  const [unlocked, setUnlocked] = useState(() => localStorage.getItem(STORAGE_KEY) === "true");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const unlock = (event) => {
    event.preventDefault();

    if (password.trim() === ACCESS_PASSWORD) {
      localStorage.setItem(STORAGE_KEY, "true");
      setUnlocked(true);
      setError("");
      return;
    }

    setError("Incorrect password");
  };

  if (unlocked) return children;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 text-slate-950">
      <div className="w-full max-w-sm rounded border border-slate-200 bg-white p-6 shadow-xl">
        <div className="mb-5">
          <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">Grain Data Intelligence</p>
          <h1 className="mt-1 text-2xl font-black text-slate-950">Access required</h1>
          <p className="mt-2 text-sm font-semibold leading-5 text-slate-600">
            Enter the shared testing password to open the GDI workspace.
          </p>
        </div>

        <form onSubmit={unlock} className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-slate-600">
              Password
            </span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-11 w-full rounded border border-slate-300 bg-white px-3 text-sm font-semibold outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
              autoFocus
            />
          </label>

          {error && <p className="text-sm font-bold text-red-600">{error}</p>}

          <button
            type="submit"
            className="h-11 w-full rounded bg-slate-950 px-4 text-sm font-extrabold text-white hover:bg-slate-800"
          >
            Unlock
          </button>
        </form>
      </div>
    </div>
  );
}
