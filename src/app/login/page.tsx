"use client";

import { FormEvent, useState } from "react";
import { CarFront, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);

    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authError) throw authError;

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("account_type")
        .eq("id", data.user.id)
        .maybeSingle();

      if (profileError) throw profileError;
      if (!profile) {
        throw new Error("Votre compte n'est pas encore associé à un profil ConduiPRO.");
      }

      const defaultDestination =
        profile.account_type === "student" ? "/student" :
        profile.account_type === "school" ? "/school" : "/login";

      const requestedDestination = new URLSearchParams(window.location.search).get("next");
      const safeDestination =
        requestedDestination?.startsWith("/") && !requestedDestination.startsWith("//")
          ? requestedDestination
          : defaultDestination;

      window.location.assign(safeDestination);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Connexion impossible. Vérifiez vos identifiants."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-shell">
      <div className="login-card">
        <div className="brand login-brand">
          <div className="brand-mark"><CarFront size={22} /></div>
          <div><strong>ConduiPRO</strong><small>GESTION AUTO-ÉCOLE</small></div>
        </div>
        <div className="login-heading">
          <h1>Bienvenue !</h1>
          <p>Connectez-vous à votre espace ConduiPRO.</p>
        </div>
        <form onSubmit={submit}>
          <label htmlFor="email">Adresse courriel</label>
          <div className="login-input">
            <Mail size={17} aria-hidden="true" />
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="nom@exemple.ca"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <label htmlFor="password">Mot de passe</label>
          <div className="login-input">
            <LockKeyhole size={17} aria-hidden="true" />
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Votre mot de passe"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <button
              type="button"
              aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
              onClick={() => setShowPassword((visible) => !visible)}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {error && <div className="login-error" role="alert">{error}</div>}
          <button className="login-submit" type="submit" disabled={busy}>
            {busy ? "Connexion…" : "Se connecter"}
          </button>
        </form>
        <p className="login-support">
          Accès réservé aux comptes créés par votre établissement.
        </p>
      </div>
      <footer className="login-footer">© 2026 ConduiPRO · Québec</footer>
    </main>
  );
}
