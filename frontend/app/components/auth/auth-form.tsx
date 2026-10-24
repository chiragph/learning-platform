"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useSyncExternalStore, type FormEvent, type PointerEvent } from "react";
import { Icon } from "../landing/landing-icon";
import { validateAuth, type AuthErrors, type AuthMode, type AuthValues, type FieldName } from "./validation";
import { AnimatedOwl, type AnimatedOwlHandle } from "./animated-owl";
import { authRequest } from "./auth-client";

const subscribe = () => () => {};
const getHydrated = () => true;
const getServerHydrated = () => false;

export function AuthForm({ mode }: { mode: AuthMode }) {
  const register = mode === "register";
  const router = useRouter();
  const hydrated = useSyncExternalStore(subscribe, getHydrated, getServerHydrated);
  const form = useRef<HTMLFormElement>(null);
  const owl = useRef<AnimatedOwlHandle>(null);
  const [focusedField, setFocusedField] = useState<FieldName | null>(null);
  const [values, setValues] = useState<AuthValues>({ name: "", email: "", password: "", confirmPassword: "" });
  const [errors, setErrors] = useState<AuthErrors>({});
  const [visible, setVisible] = useState({ password: false, confirmPassword: false });
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const submitting = useRef(false);
  const [remember, setRemember] = useState(false);

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "touch") owl.current?.followPointer(event.clientX, event.clientY);
  }

  function handlePointerLeave() {
    owl.current?.resetPointer();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    owl.current?.reactToSubmit();
    const nextErrors = validateAuth(values, mode);
    setErrors(nextErrors);
    const first = Object.keys(nextErrors)[0];
    if (first) {
      setNotice("Please check the highlighted fields.");
      form.current?.querySelector<HTMLInputElement>(`[name="${first}"]`)?.focus();
      return;
    }
    submitting.current = true;
    setPending(true);
    setNotice(register ? "Creating your account…" : "Signing in…");
    try {
      await authRequest(mode, {
        email: values.email.trim(), password: values.password,
        ...(register ? { name: values.name.trim() } : { remember }),
      });
      setValues({ name: "", email: "", password: "", confirmPassword: "" });
      setNotice(register ? "Account created successfully." : "Signed in successfully.");
      router.replace("/login/success");
      router.refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to sign in. Please try again.");
      submitting.current = false;
      setPending(false);
    }
  }

  function field(name: FieldName, label: string, type: "text" | "email" | "password", autoComplete: string) {
    const password = name === "password" || name === "confirmPassword";
    const show = password && visible[name];
    const hint = register && name === "password";
    return (
      <div className="decode-auth-field"
        onFocusCapture={() => setFocusedField(name)}
        onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocusedField(null); }}
      >
        <label htmlFor={name}>{label}</label>
        <div className="decode-auth-input-wrap">
          <input
            id={name} name={name} type={show ? "text" : type} autoComplete={autoComplete}
            required value={values[name]} aria-invalid={Boolean(errors[name])}
            aria-describedby={[hint ? "password-hint" : "", errors[name] ? `${name}-error` : ""].filter(Boolean).join(" ") || undefined}
            className={password ? "decode-auth-input decode-auth-password" : "decode-auth-input"}
            onChange={(event) => {
              const next = { ...values, [name]: event.target.value };
              setValues(next);
              setNotice("");
              // Recheck errors as they are corrected, including password confirmation.
              setErrors((current) => {
                const checked = validateAuth(next, mode);
                return Object.fromEntries(Object.keys(current).filter((key) => checked[key as FieldName]).map((key) => [key, checked[key as FieldName]]));
              });
            }}
            onBlur={() => {
              const error = validateAuth(values, mode)[name];
              setErrors((current) => ({ ...current, [name]: error }));
            }}
          />
          {password && <button type="button" className="decode-auth-visibility" aria-label={`${show ? "Hide" : "Show"} ${name === "confirmPassword" ? "confirm password" : "password"}`} aria-controls={name} aria-pressed={show} onClick={() => setVisible((current) => ({ ...current, [name]: !current[name] }))}><Icon name={show ? "eye-off" : "eye"} className="size-5" /></button>}
        </div>
        {hint && <p id="password-hint" className="decode-auth-hint">Use at least 8 characters.</p>}
        {errors[name] && <p id={`${name}-error`} className="decode-auth-error">{errors[name]}</p>}
      </div>
    );
  }

  return (
    <div className={`decode-auth-stage${register ? " decode-auth-stage-register" : ""}`}>
    <div className="decode-auth-companion" onPointerEnter={handlePointerMove} onPointerMove={handlePointerMove} onPointerLeave={handlePointerLeave} onPointerCancel={handlePointerLeave}>
    <div className="decode-auth-companion-content">
    <AnimatedOwl ref={owl} focusedField={focusedField} concealed={focusedField === "password" || focusedField === "confirmPassword" ? !visible[focusedField] : false} />
    <div className="decode-auth-welcome">
      <h2 className="decode-auth-welcome-title">Your coding journey starts here.</h2>
      <p className="decode-auth-welcome-copy">Learn. Practice. Build.</p>
    </div>
    </div>
    </div>
    <section className="decode-auth-card" aria-labelledby="auth-title">
      <p className="decode-eyebrow mb-2">LEARN. PRACTICE. BUILD.</p>
      <h1 id="auth-title" className="decode-section-title">{register ? "Start something new." : "Welcome back."}</h1>
      <p className="mt-2 text-sm leading-6 text-secondary">{register ? "Create your student account and take your first step into code." : "Sign in to continue your DECODE journey."}</p>
      <p id="auth-availability" className="decode-auth-notice mt-4">{register ? "Create your student account with your name, email, and password." : "Sign in with the email and password you used to create your account."}</p>
      <noscript><p className="mt-4 text-sm text-secondary">Enable JavaScript to create an account or sign in.</p></noscript>
      <form ref={form} onSubmit={submit} noValidate aria-describedby="auth-availability" aria-busy={pending} className="decode-auth-form mt-4">
        {/* Prevent an unhydrated/native form submission from sending credentials. */}
        <fieldset disabled={!hydrated || pending} className="decode-auth-fields">
        {register && field("name", "Full name", "text", "name")}
        {field("email", "Email", "email", "email")}
        {field("password", "Password", "password", register ? "new-password" : "current-password")}
        {register && field("confirmPassword", "Confirm password", "password", "new-password")}
        {!register && <div className="decode-auth-options">
          <label className="decode-auth-remember"><input type="checkbox" name="remember" checked={remember} onChange={(event) => setRemember(event.target.checked)} /> Remember me</label>
          <a href="#password-recovery" className="decode-auth-link" onClick={() => setNotice("Password recovery is not available yet. No reset email has been sent.")}>Forgot password?</a>
        </div>}
        <p id="password-recovery" role="status" aria-live="polite" aria-atomic="true" className="decode-auth-status">{notice}</p>
        <button type="submit" className="decode-button decode-button-primary w-full">{pending ? (register ? "Creating Account…" : "Signing In…") : (register ? "Create Account" : "Sign In")}<Icon name="arrow" /></button>
        </fieldset>
      </form>
      <div className="decode-auth-divider" aria-hidden="true"><span />or<span /></div>
      <button type="button" className="decode-button decode-button-secondary decode-auth-google w-full" disabled aria-describedby="google-unavailable"><span className="font-semibold" aria-hidden="true">G</span>{register ? "Sign up with Google" : "Continue with Google"}</button>
      <p id="google-unavailable" className="mt-2 text-center text-xs leading-5 text-secondary">Google {register ? "signup" : "sign-in"} is not available yet.</p>
      <p className="mt-4 text-center text-sm leading-6 text-secondary">{register ? "Already have an account?" : "New to DECODE?"} <Link href={register ? "/login" : "/register"} className="decode-auth-link">{register ? "Sign In" : "Create an account"}</Link></p>
      <Link href="/" className="decode-auth-link mt-2 inline-flex min-h-11 items-center gap-2 text-sm"><Icon name="arrow" className="size-4 rotate-180" />Back to home</Link>
    </section>
    </div>
  );
}
