import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { signInSchema, type SignInFormValues, zodResolver } from '../../schemas';
import { FormErrorMessage, FormField } from '../../components/forms';
import { useToast } from '../../components/feedback';
import { useAuth } from '../../context/AuthContext';
import { ApiClientError } from '../../api/types';
import { BrandBridgeLogo, Button, Card, Checkbox, Icon, type IconName, Input } from '../../design-system';

type RoleId = 'brand' | 'creator' | 'admin';

interface DemoRoleConfig {
  id: RoleId;
  label: string;
  shortLabel: string;
  icon: IconName;
  email: string;
  password: string;
  accountName: string;
  route: string;
  accentBorder: string;
  accentBg: string;
  accentText: string;
  badge: string;
  description: string;
}

const DEMO_ROLES: DemoRoleConfig[] = [
  {
    id: 'brand',
    label: 'Brand / Agency',
    shortLabel: 'Brand',
    icon: 'Briefcase',
    email: 'demo.brand@acmecorp.com',
    password: 'brand12345',
    accountName: 'Acme Tech Innovations',
    route: '/brand/overview',
    accentBorder: 'border-[#4169E1] ring-1 ring-[#4169E1]',
    accentBg: 'bg-[#F0F4FE]',
    accentText: 'text-[#4169E1]',
    badge: 'Enterprise Brand',
    description: 'Post briefs, discover creators & track ROI',
  },
  {
    id: 'creator',
    label: 'Content Creator',
    shortLabel: 'Creator',
    icon: 'Video',
    email: 'tech_marcus@creatorhub.test',
    password: 'creator12345',
    accountName: 'Marcus Chen (@tech_marcus)',
    route: '/influencer/overview',
    accentBorder: 'border-[#4F46E5] ring-1 ring-[#4F46E5]',
    accentBg: 'bg-[#EEF2FF]',
    accentText: 'text-[#4F46E5]',
    badge: 'Verified Influencer',
    description: 'Pitch brand briefs & manage partnerships',
  },
  {
    id: 'admin',
    label: 'Platform Admin',
    shortLabel: 'Admin',
    icon: 'ShieldCheck',
    email: 'admin@brandbridge.io',
    password: 'admin12345',
    accountName: 'Platform Administrator',
    route: '/admin/overview',
    accentBorder: 'border-[#B7791F] ring-1 ring-[#B7791F]',
    accentBg: 'bg-[#FEF7EC]',
    accentText: 'text-[#B7791F]',
    badge: 'Ops & Governance',
    description: 'Platform audits, disputes & safety controls',
  },
];

export const SignInPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, demoLogin } = useAuth();
  const { success, error: toastError } = useToast();
  const [selectedRole, setSelectedRole] = useState<RoleId | null>('brand');
  const [apiError, setApiError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    clearErrors,
    formState: { errors },
  } = useForm<SignInFormValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: DEMO_ROLES[0]?.email ?? '',
      password: DEMO_ROLES[0]?.password ?? '',
      rememberMe: true,
    },
  });

  const activeConfig = DEMO_ROLES.find((r) => r.id === selectedRole);

  const handleSelectRole = (roleId: RoleId) => {
    setSelectedRole(roleId);
    const config = DEMO_ROLES.find((r) => r.id === roleId);
    if (config) {
      setValue('email', config.email, { shouldValidate: true });
      setValue('password', config.password, { shouldValidate: true });
      clearErrors();
      setApiError(null);
      setFieldErrors({});
    }
  };

  const handleClearRole = () => {
    setSelectedRole(null);
    setValue('email', '');
    setValue('password', '');
    clearErrors();
    setApiError(null);
    setFieldErrors({});
  };

  const handleQuickDemoLogin = async (roleId: RoleId) => {
    setIsSubmitting(true);
    setApiError(null);
    setFieldErrors({});

    try {
      await demoLogin(roleId);
      const config = DEMO_ROLES.find((r) => r.id === roleId);
      success('Signed in successfully', `Logged in as ${config?.accountName || roleId}`);

      if (roleId === 'creator') {
        navigate('/influencer/overview');
      } else if (roleId === 'admin') {
        navigate('/admin/overview');
      } else {
        navigate('/brand/overview');
      }
    } catch (err) {
      if (err instanceof ApiClientError) {
        setApiError(err.message);
        setFieldErrors(err.fieldErrors);
        toastError('Authentication Failed', err.message);
      } else {
        const msg = err instanceof Error ? err.message : 'Unable to complete demo sign-in.';
        setApiError(msg);
        toastError('Sign-in Error', msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const onSubmit = async (values: SignInFormValues) => {
    setIsSubmitting(true);
    setApiError(null);
    setFieldErrors({});

    try {
      await login({
        email: values.email,
        password: values.password,
      });

      success('Signed in successfully', `Welcome back, ${values.email}`);

      // Inspect updated user to redirect to the matching workspace
      const stored = localStorage.getItem('brand_bridge_user');
      const parsed = stored ? JSON.parse(stored) : null;
      const role = parsed?.role?.toLowerCase();

      if (role === 'creator') {
        navigate('/influencer/overview');
      } else if (role === 'admin') {
        navigate('/admin/overview');
      } else {
        navigate('/brand/overview');
      }
    } catch (err) {
      if (err instanceof ApiClientError) {
        setApiError(err.message);
        setFieldErrors(err.fieldErrors);
        toastError('Authentication Failed', err.message);
      } else {
        const msg = err instanceof Error ? err.message : 'Unable to complete sign-in request.';
        setApiError(msg);
        toastError('Sign-in Error', msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F5F0] flex items-center justify-center p-4 sm:p-6 font-sans">
      <Card orientation="vertical" padding="lg" className="max-w-lg w-full rounded-[16px] border border-[#E5E7EB] bg-white shadow-[0_12px_32px_rgba(23,36,58,0.06)] text-left">
        {/* Header branding */}
        <div className="mb-5">
          <BrandBridgeLogo size="md" subtitle="Enterprise Authentication" />
        </div>

        <h1 className="text-xl font-bold font-['Manrope',sans-serif] text-[#17243A] tracking-tight">
          Sign in to your account
        </h1>
        <p className="text-xs text-[#697386] mt-1 mb-5">
          Access your brand briefs, creator partnerships, and AI match studio.
        </p>

        {/* Role Switcher Selector */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-[#17243A] tracking-wide select-none">
              Account Role / Profile Switcher
            </span>
            {selectedRole ? (
              <button
                type="button"
                data-testid="clear-role-btn"
                onClick={handleClearRole}
                className="text-[11px] text-[#697386] hover:text-[#17243A] transition-colors cursor-pointer"
              >
                Clear / Custom
              </button>
            ) : (
              <span className="text-[11px] text-[#697386]">Custom Credentials</span>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            {DEMO_ROLES.map((role) => {
              const isSelected = selectedRole === role.id;
              return (
                <button
                  key={role.id}
                  type="button"
                  data-testid={`role-tab-${role.id}`}
                  onClick={() => handleSelectRole(role.id)}
                  className={`p-3 rounded-[10px] border text-left transition-all cursor-pointer ${
                    isSelected
                      ? `${role.accentBorder} ${role.accentBg} shadow-xs`
                      : 'border-[#E5E7EB] bg-white hover:border-slate-300 hover:bg-[#F7F5F0] text-[#17243A]'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs mb-0.5">
                    <Icon
                      name={role.icon}
                      size={14}
                      className={isSelected ? role.accentText : 'text-[#697386]'}
                    />
                    <span className={isSelected ? 'text-[#17243A]' : 'text-[#475569]'}>
                      {role.shortLabel}
                    </span>
                  </div>
                  <p className="text-[10px] text-[#697386] truncate leading-tight">
                    {role.badge}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Active Role Quick Banner */}
          {activeConfig && (
            <div className="mt-3 p-3 rounded-[10px] border border-[#E5E7EB] bg-[#F7F5F0] flex items-center justify-between gap-2.5 text-xs">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 font-medium text-[#17243A] text-[11px]">
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      activeConfig.id === 'brand'
                        ? 'bg-[#4169E1]'
                        : activeConfig.id === 'creator'
                        ? 'bg-[#4F46E5]'
                        : 'bg-[#B7791F]'
                    }`}
                  />
                  <span className="truncate font-bold font-['Manrope',sans-serif]">{activeConfig.accountName}</span>
                  <span className="text-[10px] text-[#697386] font-mono hidden sm:inline">
                    ({activeConfig.route})
                  </span>
                </div>
                <p className="text-[10.5px] text-[#697386] truncate mt-0.5">
                  {activeConfig.description}
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                type="button"
                onClick={() => handleQuickDemoLogin(activeConfig.id)}
                isLoading={isSubmitting}
                className="shrink-0 text-xs px-3 py-1.5 font-semibold flex items-center gap-1.5 cursor-pointer"
                title={`1-Click Instant Login as ${activeConfig.shortLabel}`}
              >
                <Icon name="Zap" size={13} className="text-[#B7791F]" />
                1-Click Sign In
              </Button>
            </div>
          )}
        </div>

        {/* Centralized API / Backend Error Message */}
        {apiError && (
          <div className="mb-4">
            <FormErrorMessage
              title="Sign-In Failed"
              message={apiError}
              fieldErrors={fieldErrors}
              onDismiss={() => setApiError(null)}
            />
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <FormField
            label="Corporate / Work Email"
            htmlFor="signin-email"
            required
            error={errors.email?.message}
          >
            <Input
              id="signin-email"
              type="email"
              placeholder="name@company.com"
              leftIcon="Mail"
              error={errors.email?.message}
              {...register('email')}
            />
          </FormField>

          <FormField
            label="Password"
            htmlFor="signin-password"
            required
            error={errors.password?.message}
          >
            <Input
              id="signin-password"
              type="password"
              placeholder="••••••••"
              leftIcon="Lock"
              error={errors.password?.message}
              {...register('password')}
            />
          </FormField>

          <div className="flex items-center justify-between text-xs pt-1">
            <Checkbox
              id="rememberMe"
              label="Remember for 30 days"
              {...register('rememberMe')}
            />
            <span className="text-[#697386] hover:text-[#17243A] cursor-pointer font-medium">
              Forgot password?
            </span>
          </div>

          <Button
            variant="primary"
            type="submit"
            fullWidth
            isLoading={isSubmitting}
            className="mt-3"
          >
            {activeConfig ? `Sign In as ${activeConfig.shortLabel}` : 'Sign In to Workspace'}
          </Button>
        </form>

        <div className="mt-5 pt-4 border-t border-[#E5E7EB] text-center text-xs text-[#697386]">
          Do not have an account yet?{' '}
          <Link to="/auth/sign-up" className="text-[#4169E1] hover:text-[#2563EB] font-bold">
            Create an Account
          </Link>
        </div>

        <div className="mt-4 p-3 bg-[#F7F5F0] rounded-[8px] border border-[#E5E7EB] text-[11px] text-[#697386] flex items-start gap-2.5">
          <Icon name="Info" size={15} className="text-[#4169E1] mt-0.5 shrink-0" />
          <span>
            <strong className="text-[#17243A]">Multi-Role Architecture:</strong> Choose between Brand Workspace, Creator Studio, or Admin Console to switch views instantly.
          </span>
        </div>
      </Card>
    </div>
  );
};
