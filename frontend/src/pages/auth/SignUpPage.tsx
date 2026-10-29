import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { signUpSchema, type SignUpFormValues, zodResolver } from '../../schemas';
import { FormErrorMessage, FormField } from '../../components/forms';
import { useToast } from '../../components/feedback';
import { useAuth } from '../../context/AuthContext';
import { ApiClientError } from '../../api/types';
import { BrandBridgeLogo, Button, Card, Checkbox, Icon, Input } from '../../design-system';

export const SignUpPage: React.FC = () => {
  const navigate = useNavigate();
  const { register: registerAuth } = useAuth();
  const { success, error: toastError } = useToast();
  const [apiError, setApiError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<SignUpFormValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      role: 'brand',
    },
  });

  const selectedRole = watch('role');

  const onSubmit = async (values: SignUpFormValues) => {
    setIsSubmitting(true);
    setApiError(null);
    setFieldErrors({});

    try {
      await registerAuth({
        email: values.email,
        password: values.password,
        full_name: values.name,
        role: values.role,
      });

      success('Account Created', 'Your account was successfully provisioned.');
      navigate(values.role === 'creator' ? '/influencer/overview' : '/brand/overview');
    } catch (err) {
      if (err instanceof ApiClientError) {
        setApiError(err.message);
        setFieldErrors(err.fieldErrors);
        toastError('Registration Failed', err.message);
      } else {
        const msg = err instanceof Error ? err.message : 'Unable to complete account registration.';
        setApiError(msg);
        toastError('Registration Error', msg);
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
          <BrandBridgeLogo size="md" subtitle="Platform Onboarding" />
        </div>

        <h1 className="text-xl font-bold font-['Manrope',sans-serif] text-[#17243A] tracking-tight">Create your account</h1>
        <p className="text-xs text-[#697386] mt-1 mb-5">
          Join the AI-assisted marketplace for verified creators and data-driven brands.
        </p>

        {/* Centralized API / Backend Error Message */}
        {apiError && (
          <div className="mb-4">
            <FormErrorMessage
              title="Registration Error"
              message={apiError}
              fieldErrors={fieldErrors}
              onDismiss={() => setApiError(null)}
            />
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {/* Account Role Selector */}
          <div>
            <label className="text-xs font-semibold text-[#17243A] tracking-wide select-none block mb-1.5">
              Select Workspace Profile <span className="text-[#C24141]">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div
                onClick={() => setValue('role', 'brand', { shouldValidate: true })}
                className={`p-3.5 rounded-[10px] border cursor-pointer transition-all ${
                  selectedRole === 'brand'
                    ? 'border-[#4169E1] bg-[#F0F4FE] text-[#17243A] ring-1 ring-[#4169E1]'
                    : 'border-[#E5E7EB] bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-2 font-bold font-['Manrope',sans-serif] text-xs">
                  <Icon name="Briefcase" size={16} className={selectedRole === 'brand' ? 'text-[#4169E1]' : 'text-[#697386]'} />
                  Brand or Agency
                </div>
                <p className="text-[11px] text-[#697386] mt-1">Hire creators, post briefs &amp; analyze ROI</p>
              </div>

              <div
                onClick={() => setValue('role', 'creator', { shouldValidate: true })}
                className={`p-3.5 rounded-[10px] border cursor-pointer transition-all ${
                  selectedRole === 'creator'
                    ? 'border-[#4F46E5] bg-[#EEF2FF] text-[#17243A] ring-1 ring-[#4F46E5]'
                    : 'border-[#E5E7EB] bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-2 font-bold font-['Manrope',sans-serif] text-xs">
                  <Icon name="UserCheck" size={16} className={selectedRole === 'creator' ? 'text-[#4F46E5]' : 'text-[#697386]'} />
                  Content Creator
                </div>
                <p className="text-[11px] text-[#697386] mt-1">Pitch campaigns &amp; manage sponsorships</p>
              </div>
            </div>
            {errors.role && (
              <p className="text-xs text-[#C24141] mt-1 font-medium">{errors.role.message}</p>
            )}
          </div>

          <FormField
            label={selectedRole === 'brand' ? 'Company or Brand Name' : 'Creator Display Name'}
            htmlFor="signup-name"
            required
            error={errors.name?.message}
          >
            <Input
              id="signup-name"
              placeholder={selectedRole === 'brand' ? 'Acme Software Inc.' : 'Alex Rivera'}
              leftIcon="User"
              error={errors.name?.message}
              {...register('name')}
            />
          </FormField>

          <FormField
            label="Business Email Address"
            htmlFor="signup-email"
            required
            error={errors.email?.message}
          >
            <Input
              id="signup-email"
              type="email"
              placeholder="contact@company.com"
              leftIcon="Mail"
              error={errors.email?.message}
              {...register('email')}
            />
          </FormField>

          <FormField
            label="Account Password"
            htmlFor="signup-password"
            required
            helperText="Minimum 8 characters with at least one uppercase letter and one number"
            error={errors.password?.message}
          >
            <Input
              id="signup-password"
              type="password"
              placeholder="••••••••"
              leftIcon="Lock"
              error={errors.password?.message}
              {...register('password')}
            />
          </FormField>

          <div className="pt-1">
            <Checkbox
              id="agreeToTerms"
              label="I agree to the Terms of Service and Privacy Governance Policy"
              error={errors.agreeToTerms?.message}
              {...register('agreeToTerms')}
            />
          </div>

          <Button
            variant="primary"
            type="submit"
            fullWidth
            isLoading={isSubmitting}
            className="mt-2"
          >
            Complete Registration &amp; Enter Workspace
          </Button>
        </form>

        <div className="mt-5 pt-4 border-t border-[#E5E7EB] text-center text-xs text-[#697386]">
          Already registered?{' '}
          <Link to="/auth/sign-in" className="text-[#4169E1] hover:text-[#2563EB] font-bold">
            Sign In Here
          </Link>
        </div>
      </Card>
    </div>
  );
};
