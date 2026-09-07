import { useState } from 'react';
import { ArrowRight, Check, Lock, Mail, User, X } from 'lucide-react';
import { useAuth } from '@/lib/auth';

export default function AuthPage() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);

    if (mode === 'signup') {
      const result = await signUp(email, password, fullName);
      setBusy(false);
      if (result.error) {
        setError(result.error);
        return;
      }
      // Signup worked — don't rely on email confirmation, just tell them to sign in.
      setPassword('');
      setSignupSuccess(true);
      setMode('signin');
      return;
    }

    const result = await signIn(email, password);
    setBusy(false);
    if (result.error) setError(result.error);
  };

  const switchMode = (nextMode: 'signin' | 'signup') => {
    setMode(nextMode);
    setError(null);
    setSignupSuccess(false);
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <img
            src="/images/favicon.svg"
            alt="HubCredo"
            style={{ height: 100, width: 150, objectFit: 'contain', display: 'block' }}
          />
        </div>
        <h1>{mode === 'signup' ? 'Create your account' : 'Welcome back'}</h1>
        <p>{mode === 'signup' ? 'Start sourcing candidates before the job post goes live.' : 'Sign in to your dashboard.'}</p>

        {signupSuccess && mode === 'signin' && (
          <div className="auth-success"><Check size={15} /> Account created — you can sign in now.</div>
        )}

        {error && <div className="auth-error"><X size={15} /> {error}</div>}

        <form onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <label className="auth-field">
              <User size={16} />
              <input
                type="text"
                placeholder="Full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </label>
          )}
          <label className="auth-field">
            <Mail size={16} />
            <input
              type="email"
              placeholder="Work email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label className="auth-field">
            <Lock size={16} />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </label>
          <button type="submit" className="auth-submit" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Sign in'} <ArrowRight size={16} />
          </button>
        </form>

        <button className="auth-toggle" onClick={() => switchMode(mode === 'signup' ? 'signin' : 'signup')}>
          {mode === 'signup' ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
        </button>
      </div>
    </div>
  );
}