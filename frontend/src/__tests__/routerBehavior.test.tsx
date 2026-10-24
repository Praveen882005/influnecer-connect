import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { ToastProvider } from '../components/feedback/ToastContext';
import { NotFoundPage } from '../pages/common/NotFoundPage';
import { AppRoutes } from '../routes/AppRoutes';

describe('Router and Navigation Behavior', () => {
  describe('NotFoundPage', () => {
    it('renders 404 header and navigation return buttons', () => {
      render(
        <MemoryRouter>
          <NotFoundPage />
        </MemoryRouter>
      );

      expect(screen.getByText(/Error 404/)).toBeInTheDocument();
      expect(screen.getByText('Lost in the Creator Network?')).toBeInTheDocument();
      expect(screen.getByText('Return Home')).toBeInTheDocument();
      expect(screen.getByText('Brand Workspace')).toBeInTheDocument();
      expect(screen.getByText('Creator Studio')).toBeInTheDocument();
    });
  });

  describe('AppRoutes 404 Fallback', () => {
    it('renders NotFoundPage when an unknown route is accessed', () => {
      render(
        <MemoryRouter initialEntries={['/some-unregistered-route']}>
          <AuthProvider>
            <ToastProvider>
              <AppRoutes />
            </ToastProvider>
          </AuthProvider>
        </MemoryRouter>
      );

      expect(screen.getByText(/Error 404/)).toBeInTheDocument();
      expect(screen.getByText('Lost in the Creator Network?')).toBeInTheDocument();
    });

    it('renders Sign In screen when /auth/sign-in is accessed', () => {
      render(
        <MemoryRouter initialEntries={['/auth/sign-in']}>
          <AuthProvider>
            <ToastProvider>
              <AppRoutes />
            </ToastProvider>
          </AuthProvider>
        </MemoryRouter>
      );

      expect(screen.getByText('Sign in to your account')).toBeInTheDocument();
      expect(screen.getByText('Corporate / Work Email')).toBeInTheDocument();
    });
  });
});
