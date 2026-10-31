import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PasswordField } from "@/components/ui/password-field";
import { customerPasswordLogin, requestCustomerOtp, verifyCustomerOtp } from "@/services/api";
import { CUSTOMER_PASSWORD_HINT, customerPasswordIssue } from "@/lib/customer-auth";

type Mode = "login" | "register" | "forgot";

export function AuthPanel({
  defaultName = "",
  onDone,
}: {
  defaultName?: string;
  onDone?: () => void;
}) {
  const [mode, setMode] = useState<Mode>("login");
  const [step, setStep] = useState<"form" | "otp">("form");
  const [username, setUsername] = useState(defaultName);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function go(next: Mode) {
    setMode(next);
    setStep("form");
    setOtp("");
    setError("");
    if (next !== "login") setPassword("");
  }

  async function login() {
    setBusy(true);
    setError("");
    try {
      await customerPasswordLogin(username, password);
      toast.success("Signed in");
      onDone?.();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function sendCode() {
    setBusy(true);
    setError("");
    try {
      const sent = await requestCustomerOtp(
        mode === "register"
          ? { username, phone, password, intent: "register" }
          : { username, intent: "reset" },
      );
      setPhone(sent.phone);
      setStep("otp");
      toast.success("Code sent");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function confirmOtp() {
    setBusy(true);
    setError("");
    try {
      await verifyCustomerOtp(phone, otp, mode === "forgot" ? password : undefined);
      toast.success(mode === "register" ? "Account ready" : "Password updated");
      onDone?.();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const passwordError =
    (mode === "register" || (mode === "forgot" && step === "otp")) && password.length > 0
      ? customerPasswordIssue(password)
      : null;

  const formReady =
    username.trim().length >= 1 &&
    (mode === "login"
      ? password.length >= 1
      : mode === "register"
        ? !customerPasswordIssue(password) && phone.length === 10
        : true);

  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (mode === "login") await login();
        else if (step === "form") await sendCode();
        else await confirmOtp();
      }}
    >
      {step === "form" ? (
        <>
          <label className="block text-sm font-semibold">
            Username
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              className="mt-1 h-11 w-full rounded-xl border-2 border-input bg-card px-3"
            />
          </label>
          {mode === "register" && (
            <label className="block text-sm font-semibold">
              Phone
              <input
                value={phone}
                inputMode="numeric"
                autoComplete="tel"
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                className="mt-1 h-11 w-full rounded-xl border-2 border-input bg-card px-3"
              />
            </label>
          )}
          {mode !== "forgot" && (
            <PasswordField
              key={mode}
              value={password}
              onChange={setPassword}
              autoComplete={mode === "register" ? "new-password" : "current-password"}
            />
          )}
          {passwordError && (
            <p className="text-xs font-semibold text-primary" role="alert">
              {CUSTOMER_PASSWORD_HINT}
            </p>
          )}
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">Enter the code sent to {phone}.</p>
          <label className="block text-sm font-semibold">
            OTP
            <input
              value={otp}
              inputMode="numeric"
              autoComplete="one-time-code"
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 4))}
              className="mt-1 h-11 w-full rounded-xl border-2 border-input bg-card px-3 tracking-[0.4em]"
            />
          </label>
          {mode === "forgot" && (
            <>
              <PasswordField
                label="New password"
                value={password}
                onChange={setPassword}
                autoComplete="new-password"
              />
              {passwordError && (
                <p className="text-xs font-semibold text-primary" role="alert">
                  {CUSTOMER_PASSWORD_HINT}
                </p>
              )}
            </>
          )}
          <button
            type="button"
            className="text-sm font-semibold text-primary"
            onClick={() => {
              setStep("form");
              setOtp("");
            }}
          >
            Back
          </button>
        </>
      )}
      {error && (
        <p className="text-sm font-semibold text-primary" role="alert">
          {error}
        </p>
      )}
      <Button
        type="submit"
        disabled={
          busy ||
          (step === "form"
            ? !formReady
            : otp.length !== 4 || (mode === "forgot" && !!customerPasswordIssue(password)))
        }
      >
        {mode === "login"
          ? "Sign in"
          : step === "form"
            ? mode === "register"
              ? "Send OTP"
              : "Send reset OTP"
            : mode === "register"
              ? "Verify and create account"
              : "Reset password and sign in"}
      </Button>
      {step === "form" && (
        <div className="space-y-1">
          {mode !== "login" ? (
            <button type="button" className="block text-sm font-semibold text-primary" onClick={() => go("login")}>
              Already have an account? Sign in
            </button>
          ) : (
            <>
              <button
                type="button"
                className="block text-sm font-semibold text-primary"
                onClick={() => go("register")}
              >
                New here? Create an account
              </button>
              <button
                type="button"
                className="block text-sm font-semibold text-primary"
                onClick={() => go("forgot")}
              >
                Forgot password?
              </button>
            </>
          )}
        </div>
      )}
    </form>
  );
}
