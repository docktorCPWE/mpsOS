import React, { useState } from 'react';
import { Compass, Mail, Lock, User, ArrowRight, RefreshCw, CheckCircle, AlertCircle, ShieldCheck, KeyRound, ExternalLink, LogOut, ChevronRight } from 'lucide-react';
import { User as FirebaseUser } from 'firebase/auth';
import {
  registerWithEmail,
  loginWithEmail,
  logoutUser,
  resendVerificationEmail,
  sendPasswordReset,
  checkEmailVerified,
  ROOT_OWNER_EMAILS
} from '../services/firebase';

interface AuthScreenProps {
  currentUser: FirebaseUser | null;
  onAuthenticated: (user: FirebaseUser) => void;
  onBypassDemo?: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  currentUser,
  onAuthenticated,
  onBypassDemo
}) => {
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot_password'>(
    currentUser && !currentUser.emailVerified ? 'signin' : 'signin'
  );

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState(currentUser?.email || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);

  // If user is logged in but unverified, show the verification pending screen
  const isVerificationPending = Boolean(currentUser && !currentUser.emailVerified);

  const parseFirebaseError = (err: any): string => {
    const code = err?.code || '';
    if (code === 'auth/email-already-in-use') {
      return 'An account with this email already exists. Please sign in instead.';
    }
    if (code === 'auth/invalid-credential' || code === 'auth/user-not-found' || code === 'auth/wrong-password') {
      return 'Incorrect email or password. Please verify and try again.';
    }
    if (code === 'auth/weak-password') {
      return 'Password is too weak. Please use at least 6 characters.';
    }
    if (code === 'auth/invalid-email') {
      return 'Please enter a valid email address.';
    }
    if (code === 'auth/operation-not-allowed') {
      return 'Email/Password sign-in is not enabled yet in your Firebase Console. Please go to Firebase Console > Authentication > Sign-in method and enable Email/Password.';
    }
    if (code === 'auth/too-many-requests') {
      return 'Access to this account has been temporarily disabled due to many failed login attempts. Please try again later or reset your password.';
    }
    return err?.message || 'An error occurred during authentication. Please try again.';
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsLoading(true);

    try {
      const user = await loginWithEmail(email, password);
      if (!user.emailVerified) {
        setSuccessMessage('Sign in successful! Please verify your email address to continue.');
      } else {
        onAuthenticated(user);
      }
    } catch (err: any) {
      setErrorMessage(parseFirebaseError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please re-type your password.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }

    setIsLoading(true);

    try {
      const user = await registerWithEmail(email, password, fullName);
      setSuccessMessage(`Verification link sent! A confirmation link has been sent to ${user.email}.`);
    } catch (err: any) {
      setErrorMessage(parseFirebaseError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setErrorMessage('Please enter your account email address.');
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsLoading(true);

    try {
      await sendPasswordReset(email);
      setSuccessMessage(`Password reset link sent to ${email}. Please check your inbox.`);
    } catch (err: any) {
      setErrorMessage(parseFirebaseError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckVerification = async () => {
    setIsCheckingStatus(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const verified = await checkEmailVerified();
      if (verified && currentUser) {
        setSuccessMessage('Email verified successfully! Welcome to My Plan Store OS.');
        setTimeout(() => {
          onAuthenticated(currentUser);
        }, 800);
      } else {
        setErrorMessage('Your email address has not been verified yet. Please click the link in the email sent to you, then try again.');
      }
    } catch (err: any) {
      setErrorMessage(parseFirebaseError(err));
    } finally {
      setIsCheckingStatus(false);
    }
  };

  const handleResendVerification = async () => {
    setIsResending(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await resendVerificationEmail();
      setSuccessMessage(`A fresh verification link has been sent to ${currentUser?.email}. Please check your inbox and spam folder.`);
    } catch (err: any) {
      setErrorMessage(parseFirebaseError(err));
    } finally {
      setIsResending(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
      setSuccessMessage(null);
      setErrorMessage(null);
      setMode('signin');
    } catch (err: any) {
      console.error(err);
    }
  };

  const isOwnerEmail = ROOT_OWNER_EMAILS.some(e => e.toLowerCase() === (email || '').toLowerCase().trim());

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans">
      {/* Blueprint Grid Background Pattern */}
      <div 
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(to right, #38bdf8 1px, transparent 1px), linear-gradient(to bottom, #38bdf8 1px, transparent 1px)`,
          backgroundSize: '40px 40px'
        }}
      />

      {/* Ambient background glow */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-sky-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-md z-10">
        
        {/* App Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3 bg-sky-950/80 border border-sky-500/30 rounded-2xl shadow-xl shadow-sky-950/40 mb-4 backdrop-blur-sm">
            <Compass className="w-9 h-9 text-sky-400 animate-spin-slow" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center justify-center gap-2">
            My Plan Store <span className="text-sky-400 font-mono text-sm px-2 py-0.5 rounded bg-sky-950 border border-sky-800/60 uppercase">OS</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1.5">
            Architectural Drafting & Customer Workflow Portal
          </p>
        </div>

        {/* Card Body */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8 backdrop-blur-md">

          {/* ---------------------------------------------------- */}
          {/* VIEW: EMAIL VERIFICATION PENDING                     */}
          {/* ---------------------------------------------------- */}
          {isVerificationPending ? (
            <div className="space-y-6 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 mb-2">
                <Mail className="w-8 h-8 animate-bounce" />
              </div>

              <div>
                <h2 className="text-xl font-bold text-white">Verify Your Email Address</h2>
                <p className="text-sm text-slate-400 mt-2">
                  A verification link has been dispatched to:
                </p>
                <div className="mt-2 inline-block px-3 py-1 bg-slate-800 rounded-lg text-sky-400 font-mono text-sm border border-slate-700">
                  {currentUser?.email}
                </div>
              </div>

              {/* Instructions */}
              <div className="text-left bg-slate-950/70 border border-slate-800/80 rounded-xl p-4 text-xs text-slate-300 space-y-2.5">
                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-sky-900/50 text-sky-400 flex items-center justify-center font-bold shrink-0 mt-0.5">1</div>
                  <span>Open your email client and look for the verification email from <strong>Firebase / My Plan Store</strong>.</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-sky-900/50 text-sky-400 flex items-center justify-center font-bold shrink-0 mt-0.5">2</div>
                  <span>Click the secure link inside the email to confirm your account.</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-sky-900/50 text-sky-400 flex items-center justify-center font-bold shrink-0 mt-0.5">3</div>
                  <span>Return here and click <strong>"I've Verified My Email"</strong> to enter the OS.</span>
                </div>
              </div>

              {/* Status alerts */}
              {errorMessage && (
                <div className="p-3 bg-red-950/50 border border-red-800/60 rounded-xl flex items-start gap-2 text-xs text-red-300 text-left">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {successMessage && (
                <div className="p-3 bg-emerald-950/50 border border-emerald-800/60 rounded-xl flex items-start gap-2 text-xs text-emerald-300 text-left">
                  <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
                  <span>{successMessage}</span>
                </div>
              )}

              {/* Verification Actions */}
              <div className="space-y-3 pt-2">
                <button
                  type="button"
                  onClick={handleCheckVerification}
                  disabled={isCheckingStatus}
                  className="w-full py-3 px-4 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-800 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-sky-600/20"
                >
                  {isCheckingStatus ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-white" />
                      <span>Checking Status...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 text-sky-200" />
                      <span>I've Verified My Email</span>
                    </>
                  )}
                </button>

                <div className="flex items-center justify-between text-xs pt-2">
                  <button
                    type="button"
                    onClick={handleResendVerification}
                    disabled={isResending}
                    className="text-slate-400 hover:text-sky-400 transition-colors flex items-center gap-1.5"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isResending ? 'animate-spin text-sky-400' : ''}`} />
                    <span>{isResending ? 'Sending link...' : 'Resend verification link'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="text-slate-400 hover:text-red-400 transition-colors flex items-center gap-1.5"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* ---------------------------------------------------- */
            /* VIEW: SIGN IN / SIGN UP / FORGOT PASSWORD           */
            /* ---------------------------------------------------- */
            <div>
              {/* Tab Navigation */}
              {mode !== 'forgot_password' && (
                <div className="flex border-b border-slate-800 mb-6 pb-2 gap-4">
                  <button
                    type="button"
                    onClick={() => { setMode('signin'); setErrorMessage(null); setSuccessMessage(null); }}
                    className={`text-sm font-semibold pb-2 transition-all relative ${
                      mode === 'signin' ? 'text-sky-400' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Employee Sign In
                    {mode === 'signin' && (
                      <span className="absolute bottom-[-9px] left-0 right-0 h-0.5 bg-sky-400 rounded-full" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => { setMode('signup'); setErrorMessage(null); setSuccessMessage(null); }}
                    className={`text-sm font-semibold pb-2 transition-all relative ${
                      mode === 'signup' ? 'text-sky-400' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Create Account
                    {mode === 'signup' && (
                      <span className="absolute bottom-[-9px] left-0 right-0 h-0.5 bg-sky-400 rounded-full" />
                    )}
                  </button>
                </div>
              )}

              {/* Status Alerts */}
              {errorMessage && (
                <div className="mb-4 p-3 bg-red-950/50 border border-red-800/60 rounded-xl flex items-start gap-2 text-xs text-red-300">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
                  <span className="leading-relaxed">{errorMessage}</span>
                </div>
              )}

              {successMessage && (
                <div className="mb-4 p-3 bg-emerald-950/50 border border-emerald-800/60 rounded-xl flex items-start gap-2 text-xs text-emerald-300">
                  <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
                  <span className="leading-relaxed">{successMessage}</span>
                </div>
              )}

              {/* ----------------- SIGN IN FORM ----------------- */}
              {mode === 'signin' && (
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">Work Email Address</label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="e.g. jason@myplanstore.com or arkcwd@gmail.com"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-medium text-slate-300">Password</label>
                      <button
                        type="button"
                        onClick={() => { setMode('forgot_password'); setErrorMessage(null); setSuccessMessage(null); }}
                        className="text-xs text-sky-400 hover:text-sky-300 transition-colors"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                      <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full mt-2 py-3 px-4 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-800 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-sky-600/20"
                  >
                    {isLoading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-white" />
                        <span>Signing in...</span>
                      </>
                    ) : (
                      <>
                        <span>Sign In to Portal</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* ----------------- SIGN UP FORM ----------------- */}
              {mode === 'signup' && (
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">Full Name</label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                      <input
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="e.g. Drew Lupkey"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-medium text-slate-300">Email Address</label>
                      {isOwnerEmail && (
                        <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/60">
                          Root Owner
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="e.g. drew@myplanstore.com"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">Choose Password</label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                      <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="At least 6 characters"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">Confirm Password</label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                      <input
                        type="password"
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm chosen password"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
                      />
                    </div>
                  </div>

                  <div className="p-3 bg-sky-950/40 border border-sky-800/40 rounded-xl flex items-start gap-2.5 text-[11px] text-sky-300">
                    <ShieldCheck className="w-4 h-4 shrink-0 text-sky-400 mt-0.5" />
                    <span>
                      After signing up, a verification link will be sent to your email to confirm your identity before granting workspace access.
                    </span>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full mt-2 py-3 px-4 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-800 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-sky-600/20"
                  >
                    {isLoading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-white" />
                        <span>Sending verification email...</span>
                      </>
                    ) : (
                      <>
                        <span>Create Account & Send Verification Link</span>
                        <ChevronRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* ----------------- FORGOT PASSWORD FORM ----------------- */}
              {mode === 'forgot_password' && (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div className="text-center mb-4">
                    <div className="inline-flex p-2.5 rounded-full bg-sky-500/10 text-sky-400 mb-2">
                      <KeyRound className="w-6 h-6" />
                    </div>
                    <h3 className="text-base font-bold text-white">Reset Account Password</h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Enter your account email and we will send you a password reset link.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">Email Address</label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="e.g. jason@myplanstore.com"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full mt-2 py-3 px-4 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-800 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-sky-600/20"
                  >
                    {isLoading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-white" />
                        <span>Sending reset link...</span>
                      </>
                    ) : (
                      <>
                        <span>Send Password Reset Link</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>

                  <div className="text-center pt-2">
                    <button
                      type="button"
                      onClick={() => { setMode('signin'); setErrorMessage(null); setSuccessMessage(null); }}
                      className="text-xs text-slate-400 hover:text-white transition-colors"
                    >
                      ← Back to Employee Sign In
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

        </div>

        {/* Optional Quick Demo Bypass / Helper */}
        {onBypassDemo && !currentUser && (
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={onBypassDemo}
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors inline-flex items-center gap-1.5 py-1.5 px-3 rounded-lg hover:bg-slate-900/60"
            >
              <span>Inspect Workspace in Demo Mode</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        )}

      </div>
    </div>
  );
};
