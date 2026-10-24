import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import type { UserRole } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { login, register } = useAuth();
  const [isRegisterMode, setIsRegisterMode] = useState<boolean>(false);
  const [role, setRole] = useState<UserRole>('brand');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [fullName, setFullName] = useState<string>('');
  const [companyName, setCompanyName] = useState<string>('');
  const [industry, setIndustry] = useState<string>('Tech & AI');
  const [handle, setHandle] = useState<string>('');
  const [primaryNiche, setPrimaryNiche] = useState<string>('Tech & Gadgets');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      if (isRegisterMode) {
        await register({
          email,
          password,
          full_name: fullName,
          role,
          company_name: role === 'brand' ? companyName || fullName : undefined,
          industry: role === 'brand' ? industry : undefined,
          handle: role === 'creator' ? handle || `@${fullName.toLowerCase().replace(/\s+/g, '_')}` : undefined,
          primary_niche: role === 'creator' ? primaryNiche : undefined,
        });
      } else {
        await login({ email, password });
      }
      onClose();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg('An unexpected error occurred during authentication.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="auth-modal-title">
      <div className="modal-card">
        <div className="modal-header">
          <h2 id="auth-modal-title" className="modal-title">
            {isRegisterMode ? 'Join BRAND BRIDGE' : 'Sign in to BRAND BRIDGE'}
          </h2>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close dialog"
          >
            &times;
          </button>
        </div>

        <div className="modal-tab-selector">
          <button
            type="button"
            className={`modal-mode-tab ${!isRegisterMode ? 'active' : ''}`}
            onClick={() => {
              setIsRegisterMode(false);
              setErrorMsg(null);
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            className={`modal-mode-tab ${isRegisterMode ? 'active' : ''}`}
            onClick={() => {
              setIsRegisterMode(true);
              setErrorMsg(null);
            }}
          >
            Create Account
          </button>
        </div>

        {errorMsg && (
          <div className="alert-box error" role="alert">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          {isRegisterMode && (
            <>
              <div className="form-group">
                <label className="form-label">I am registering as:</label>
                <div className="role-selector-group">
                  <label className={`role-radio-card ${role === 'brand' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="role"
                      value="brand"
                      checked={role === 'brand'}
                      onChange={() => setRole('brand')}
                    />
                    <span className="role-title">Brand / Agency</span>
                    <span className="role-desc">Post campaigns and hire creators</span>
                  </label>
                  <label className={`role-radio-card ${role === 'creator' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="role"
                      value="creator"
                      checked={role === 'creator'}
                      onChange={() => setRole('creator')}
                    />
                    <span className="role-title">Creator / Influencer</span>
                    <span className="role-desc">Pitch briefs and deliver content</span>
                  </label>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="full-name-input">
                  {role === 'brand' ? 'Primary Contact Name' : 'Full Name / Artist Name'}
                </label>
                <input
                  id="full-name-input"
                  type="text"
                  required
                  className="form-input"
                  placeholder="e.g. Elena Rostova"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>

              {role === 'brand' && (
                <>
                  <div className="form-group">
                    <label className="form-label" htmlFor="company-name-input">Company / Brand Name</label>
                    <input
                      id="company-name-input"
                      type="text"
                      required
                      className="form-input"
                      placeholder="e.g. Lumina Audio Works"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="industry-select">Industry</label>
                    <select
                      id="industry-select"
                      className="form-input"
                      value={industry}
                      onChange={(e) => setIndustry(e.target.value)}
                    >
                      <option value="Tech & AI">Tech &amp; AI</option>
                      <option value="Fitness & Wellness">Fitness &amp; Wellness</option>
                      <option value="Sustainable Fashion">Sustainable Fashion</option>
                      <option value="Gaming & Entertainment">Gaming &amp; Entertainment</option>
                      <option value="Food & Culinary">Food &amp; Culinary</option>
                      <option value="Travel & Outdoor">Travel &amp; Outdoor</option>
                    </select>
                  </div>
                </>
              )}

              {role === 'creator' && (
                <>
                  <div className="form-group">
                    <label className="form-label" htmlFor="handle-input">Social Handle (@)</label>
                    <input
                      id="handle-input"
                      type="text"
                      required
                      className="form-input"
                      placeholder="e.g. @elena_sound"
                      value={handle}
                      onChange={(e) => setHandle(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="niche-select">Primary Content Niche</label>
                    <select
                      id="niche-select"
                      className="form-input"
                      value={primaryNiche}
                      onChange={(e) => setPrimaryNiche(e.target.value)}
                    >
                      <option value="Tech & AI">Tech &amp; AI</option>
                      <option value="Fitness & Wellness">Fitness &amp; Wellness</option>
                      <option value="Sustainable Fashion">Sustainable Fashion</option>
                      <option value="Gaming & Streaming">Gaming &amp; Streaming</option>
                      <option value="Food & Culinary">Food &amp; Culinary</option>
                      <option value="Travel & Lifestyle">Travel &amp; Lifestyle</option>
                    </select>
                  </div>
                </>
              )}
            </>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="email-input">Email Address</label>
            <input
              id="email-input"
              type="email"
              required
              className="form-input"
              placeholder="you@domain.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password-input">Password</label>
            <input
              id="password-input"
              type="password"
              required
              className="form-input"
              placeholder="Minimum 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            className="action-btn-primary full-width"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Processing...' : isRegisterMode ? 'Complete Registration' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
};
