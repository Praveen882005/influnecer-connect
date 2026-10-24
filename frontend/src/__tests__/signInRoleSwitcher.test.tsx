import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SignInPage } from '../pages/auth/SignInPage';
import { AuthProvider } from '../context/AuthContext';
import { ToastProvider } from '../components/feedback/ToastContext';

const renderSignInPage = () => {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <ToastProvider>
          <SignInPage />
        </ToastProvider>
      </AuthProvider>
    </MemoryRouter>
  );
};

describe('SignInPage Role Switcher', () => {
  it('renders all three role options: Brand, Creator, Admin', () => {
    renderSignInPage();

    expect(screen.getByText('Account Role / Profile Switcher')).toBeInTheDocument();
    expect(screen.getByTestId('role-tab-brand')).toBeInTheDocument();
    expect(screen.getByTestId('role-tab-creator')).toBeInTheDocument();
    expect(screen.getByTestId('role-tab-admin')).toBeInTheDocument();
  });

  it('defaults to Brand profile with demo credentials', () => {
    renderSignInPage();

    const emailInput = screen.getByLabelText(/Corporate \/ Work Email/i) as HTMLInputElement;
    expect(emailInput.value).toBe('demo.brand@acmecorp.com');
    expect(screen.getByText(/Acme Tech Innovations/i)).toBeInTheDocument();
  });

  it('switches to Creator profile when Creator button is clicked', async () => {
    renderSignInPage();

    const creatorBtn = screen.getByTestId('role-tab-creator');
    await act(async () => {
      fireEvent.click(creatorBtn);
    });

    const emailInput = screen.getByLabelText(/Corporate \/ Work Email/i) as HTMLInputElement;
    expect(emailInput.value).toBe('tech_marcus@creatorhub.test');
    expect(screen.getByText(/Marcus Chen/i)).toBeInTheDocument();
    expect(screen.getByText(/Sign In as Creator/i)).toBeInTheDocument();
  });

  it('switches to Admin profile when Admin button is clicked', async () => {
    renderSignInPage();

    const adminBtn = screen.getByTestId('role-tab-admin');
    await act(async () => {
      fireEvent.click(adminBtn);
    });

    const emailInput = screen.getByLabelText(/Corporate \/ Work Email/i) as HTMLInputElement;
    expect(emailInput.value).toBe('admin@brandbridge.io');
    expect(screen.getByText(/Platform Administrator/i)).toBeInTheDocument();
    expect(screen.getByText(/Sign In as Admin/i)).toBeInTheDocument();
  });

  it('clears form inputs when Clear / Custom is clicked', async () => {
    renderSignInPage();

    const clearBtn = screen.getByTestId('clear-role-btn');
    await act(async () => {
      fireEvent.click(clearBtn);
    });

    const emailInput = screen.getByLabelText(/Corporate \/ Work Email/i) as HTMLInputElement;
    expect(emailInput.value).toBe('');
    expect(screen.getByText(/Sign In to Workspace/i)).toBeInTheDocument();
  });
});
