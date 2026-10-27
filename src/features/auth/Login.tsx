import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError, api } from "../../lib/api";
import { normaliseE164 } from "../../lib/hash";
import { signIn } from "../../state/live";
import { useStore } from "../../state/store";
import { Button, Field, Headline, inputClass } from "../../ui/primitives";
import { Screen } from "../../ui/shell";

export function Login() {
  const navigate = useNavigate();
  const { current, commit } = useStore();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [wait, setWait] = useState(0);
  const [busy, setBusy] = useState(false);
  const e164 = normaliseE164(phone);

  useEffect(() => {
    if (wait <= 0) return undefined;
    const timer = window.setTimeout(() => setWait((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [wait]);

  async function send() {
    setBusy(true);
    setError("");
    try {
      await api.requestOtp(e164);
      setSent(true);
      setWait(30);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send the code");
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setBusy(true);
    setError("");
    try {
      await signIn(e164, code);
      const { refresh } = await import("../../state/live");
      const next = await refresh(current());
      commit(next);
      navigate("/onboarding/basics");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not verify");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen back="/">
      <div className="space-y-6">
        <Headline text="Sign in" italic="in" />
        <p className="text-mute">India numbers start with +91. We text a 6-digit code.</p>
        <Field label="Mobile">
          <span className="flex gap-2">
            <span className="grid h-14 w-20 shrink-0 place-items-center rounded-2xl border border-line bg-card text-sm font-semibold">+91</span>
            <input className={inputClass} inputMode="numeric" autoComplete="tel" placeholder="98480 12345" value={phone} onChange={(event) => setPhone(event.target.value)} />
          </span>
        </Field>
        {sent ? (
          <Field label="Code">
            <input className={inputClass} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} />
          </Field>
        ) : null}
        {error ? <p className="text-sm text-coral">{error}</p> : null}
        {sent ? (
          <Button disabled={busy || code.length !== 6} onClick={() => void verify()}>
            Continue
          </Button>
        ) : (
          <Button disabled={busy || !e164} onClick={() => void send()}>
            Send code
          </Button>
        )}
        {sent ? (
          <Button variant="ghost" disabled={wait > 0 || busy} onClick={() => void send()}>
            {wait > 0 ? `Resend in ${wait}s` : "Resend code"}
          </Button>
        ) : null}
      </div>
    </Screen>
  );
}

export function Waiting() {
  const navigate = useNavigate();
  const { current, commit } = useStore();
  const [error, setError] = useState("");

  async function check() {
    try {
      const { refresh, accountVerified } = await import("../../state/live");
      const next = await refresh(current());
      commit({ ...next, ready: accountVerified(), preview: false });
      if (accountVerified()) navigate("/drop");
      else setError("Still waiting for verification.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not check");
    }
  }

  return (
    <Screen title="Verification">
      <h2 className="font-serif text-4xl">Waiting for verification</h2>
      <p className="mt-3 text-sm text-mute">Your selfie is with the ops desk. The Drop stays closed until they confirm it.</p>
      {error ? <p className="mt-3 text-sm text-coral">{error}</p> : null}
      <div className="mt-6">
        <Button onClick={() => void check()}>Check again</Button>
      </div>
    </Screen>
  );
}
