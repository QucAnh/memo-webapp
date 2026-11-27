import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { X, Mail, Lock, Eye, EyeOff, AlertTriangle } from "lucide-react";
import { UnauthorizedDomainAlert } from "./UnauthorizedDomainAlert";
import { OperationNotAllowedAlert } from "./OperationNotAllowedAlert";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const {
    user,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    logout,
    error,
    errorCode,
    clearError,
  } = useAuth();

  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  const isUnauthorizedDomain =
    errorCode === "auth/unauthorized-domain" ||
    Boolean(error && error.toLowerCase().includes("unauthorized-domain"));

  const isOperationNotAllowed =
    errorCode === "auth/operation-not-allowed" ||
    Boolean(error && error.toLowerCase().includes("operation-not-allowed"));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearError();

    if (!email || !password) {
      setLocalError("Please enter both email and password.");
      return;
    }

    if (password.length < 6) {
      setLocalError("Password must be at least 6 characters.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (isSignUp) {
        await signUpWithEmail(email, password);
      } else {
        await signInWithEmail(email, password);
      }
      onClose();
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      const msg = err instanceof Error ? err.message : "Authentication failed";
      if (
        code !== "auth/unauthorized-domain" &&
        code !== "auth/operation-not-allowed"
      ) {
        setLocalError(msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLocalError(null);
    clearError();
    setIsSubmitting(true);
    try {
      await signInWithGoogle();
      onClose();
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      const msg = err instanceof Error ? err.message : "Google sign in failed";
      if (
        code !== "auth/unauthorized-domain" &&
        code !== "auth/operation-not-allowed"
      ) {
        setLocalError(msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
      onClose();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      id="auth-modal-dialog"
      aria-labelledby="auth-modal-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={handleBackdropClick}
      className="paper-dialog m-0 p-4 border-0 bg-transparent max-w-none max-h-none w-screen h-[100svh] open:flex items-center justify-center"
    >
      <div
        ref={panelRef}
        className="w-full max-w-md rounded-2xl bg-[#FAF9F6] dark:bg-[#1B1B19] text-[#1C1917] dark:text-[#EDEDEB] border border-[#E7E5E0] dark:border-[#2E2E2A] shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E7E5E0] dark:border-[#282825]">
          <div>
            <h1 id="auth-modal-title" className="text-base font-semibold">
              {user
                ? "Account"
                : isSignUp
                  ? "Create Account"
                  : "Sign In to Sync"}
            </h1>
            <p className="text-xs text-[#78716C] dark:text-[#8A8985] mt-0.5">
              {user
                ? `Signed in as ${user.email || "Account"}`
                : "Local notes move automatically to your account on sign-in."}
            </p>
          </div>
          <button
            id="close-auth-modal-btn"
            type="button"
            onClick={onClose}
            aria-label="Close account modal"
            className="p-1.5 rounded-lg text-[#78716C] dark:text-[#8A8985] hover:text-[#1C1917] dark:hover:text-[#EDEDEB] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {isUnauthorizedDomain && (
            <div className="mb-4">
              <UnauthorizedDomainAlert onDismiss={clearError} />
            </div>
          )}

          {isOperationNotAllowed && (
            <div className="mb-4">
              <OperationNotAllowedAlert onDismiss={clearError} />
            </div>
          )}

          {!isUnauthorizedDomain &&
            !isOperationNotAllowed &&
            (error || localError) && (
              <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <span>{localError || error}</span>
              </div>
            )}

          {user ? (
            <div className="space-y-4 text-center">
              <div className="w-14 h-14 mx-auto rounded-full bg-[#EFECE4] dark:bg-[#282825] flex items-center justify-center text-lg font-semibold">
                {user.email ? user.email[0].toUpperCase() : "U"}
              </div>
              <div>
                <p className="text-sm font-medium">
                  {user.email || "Authenticated User"}
                </p>
                <p className="text-xs text-[#78716C] dark:text-[#8A8985] font-mono mt-0.5">
                  UID: {user.uid.slice(0, 12)}…
                </p>
              </div>
              <button
                id="sign-out-btn"
                type="button"
                onClick={async () => {
                  await logout();
                  onClose();
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-[#EFECE4] hover:bg-[#E7E3D8] dark:bg-[#282825] dark:hover:bg-[#32322E] text-sm font-medium transition-colors cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <button
                id="google-sign-in-btn"
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-xl border border-[#E7E5E0] dark:border-[#33332F] bg-white dark:bg-[#222220] text-sm font-medium hover:bg-[#F4F2EC] dark:hover:bg-[#2A2A27] transition-colors disabled:opacity-60 cursor-pointer"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Continue with Google</span>
              </button>

              <div className="flex items-center my-2">
                <div className="flex-1 border-t border-[#E7E5E0] dark:border-[#282825]" />
                <span className="px-3 text-[11px] text-[#78716C] dark:text-[#8A8985] uppercase tracking-wider">
                  or with email
                </span>
                <div className="flex-1 border-t border-[#E7E5E0] dark:border-[#282825]" />
              </div>

              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <label
                    htmlFor="auth-email-input"
                    className="block text-xs font-medium text-[#57534E] dark:text-[#B8B6B0] mb-1"
                  >
                    Email address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-[#78716C] absolute left-3 top-2.5" />
                    <input
                      id="auth-email-input"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-[#222220] border border-[#E7E5E0] dark:border-[#33332F] rounded-lg outline-hidden focus:border-amber-500 transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="auth-password-input"
                    className="block text-xs font-medium text-[#57534E] dark:text-[#B8B6B0] mb-1"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-[#78716C] absolute left-3 top-2.5" />
                    <input
                      id="auth-password-input"
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-9 pr-9 py-2 text-sm bg-white dark:bg-[#222220] border border-[#E7E5E0] dark:border-[#33332F] rounded-lg outline-hidden focus:border-amber-500 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                      className="absolute right-2.5 top-2 p-0.5 text-[#78716C] hover:text-[#1C1917] dark:hover:text-[#EDEDEB] cursor-pointer"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <button
                  id="submit-auth-form-btn"
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 px-4 bg-[#1C1917] hover:opacity-90 dark:bg-[#EDEDEB] text-[#FAF9F6] dark:text-[#141413] font-medium text-sm rounded-xl transition-opacity disabled:opacity-60 cursor-pointer"
                >
                  {isSubmitting
                    ? "Please wait…"
                    : isSignUp
                      ? "Create Account"
                      : "Sign In"}
                </button>
              </form>

              <div className="pt-1 text-center text-xs text-[#78716C] dark:text-[#8A8985]">
                <button
                  id="toggle-signup-mode-btn"
                  type="button"
                  onClick={() => {
                    setIsSignUp((v) => !v);
                    setLocalError(null);
                    clearError();
                  }}
                  className="hover:text-[#1C1917] dark:hover:text-[#EDEDEB] hover:underline cursor-pointer"
                >
                  {isSignUp
                    ? "Already have an account? Sign in"
                    : "Don't have an account? Sign up"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </dialog>
  );
};
