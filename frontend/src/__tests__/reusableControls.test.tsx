import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { FormField } from '../components/forms/FormField';
import { FormErrorMessage } from '../components/forms/FormErrorMessage';
import { ToastProvider, useToast } from '../components/feedback/ToastContext';
import { ConfirmationModal } from '../components/feedback/ConfirmationModal';

const TestToastComponent: React.FC = () => {
  const { success, error, dismiss, toasts } = useToast();

  return (
    <div>
      <button type="button" onClick={() => success('Success Notice', 'Everything saved')}>
        Trigger Success
      </button>
      <button type="button" onClick={() => error('Error Notice', 'Something went wrong')}>
        Trigger Error
      </button>
      <button
        type="button"
        onClick={() => {
          if (toasts[0]) dismiss(toasts[0].id);
        }}
      >
        Dismiss First
      </button>
    </div>
  );
};

describe('Reusable Form and Feedback Controls', () => {
  describe('FormField', () => {
    it('renders label and required indicator when required', () => {
      render(
        <FormField label="Full Legal Name" htmlFor="test-name" required>
          <input id="test-name" />
        </FormField>
      );

      expect(screen.getByText('Full Legal Name')).toBeInTheDocument();
      expect(screen.getByText('*')).toBeInTheDocument();
    });

    it('displays error message with role="alert" when error provided', () => {
      render(
        <FormField label="Email Address" htmlFor="test-email" error="Invalid email address">
          <input id="test-email" />
        </FormField>
      );

      const alert = screen.getByRole('alert');
      expect(alert).toHaveTextContent('Invalid email address');
    });

    it('displays helper text when no error exists', () => {
      render(
        <FormField label="Password" htmlFor="test-pwd" helperText="Must be 8+ characters">
          <input id="test-pwd" />
        </FormField>
      );

      expect(screen.getByText('Must be 8+ characters')).toBeInTheDocument();
    });
  });

  describe('FormErrorMessage', () => {
    it('renders nothing when message is empty and no fieldErrors', () => {
      const { container } = render(<FormErrorMessage />);
      expect(container.firstChild).toBeNull();
    });

    it('renders title, general error, and bulleted field errors', () => {
      render(
        <FormErrorMessage
          title="Submission Refused"
          message="Server validation failed."
          fieldErrors={{
            email: 'Already registered',
            budget: 'Must be higher than zero',
          }}
        />
      );

      expect(screen.getByText('Submission Refused')).toBeInTheDocument();
      expect(screen.getByText('Server validation failed.')).toBeInTheDocument();
      expect(screen.getByText(/Already registered/)).toBeInTheDocument();
      expect(screen.getByText(/Must be higher than zero/)).toBeInTheDocument();
    });

    it('calls onDismiss when close button clicked', () => {
      const handleDismiss = vi.fn();
      render(
        <FormErrorMessage
          message="Dismissible error message"
          onDismiss={handleDismiss}
        />
      );

      const closeBtn = screen.getByLabelText('Dismiss error message');
      fireEvent.click(closeBtn);
      expect(handleDismiss).toHaveBeenCalledTimes(1);
    });
  });

  describe('ToastContext', () => {
    it('displays toast messages and dismisses them', () => {
      render(
        <ToastProvider>
          <TestToastComponent />
        </ToastProvider>
      );

      const triggerSuccessBtn = screen.getByText('Trigger Success');
      act(() => {
        fireEvent.click(triggerSuccessBtn);
      });

      expect(screen.getByText('Success Notice')).toBeInTheDocument();
      expect(screen.getByText('Everything saved')).toBeInTheDocument();

      const dismissBtn = screen.getByText('Dismiss First');
      act(() => {
        fireEvent.click(dismissBtn);
      });

      expect(screen.queryByText('Success Notice')).toBeNull();
    });
  });

  describe('ConfirmationModal', () => {
    it('renders title and message when open and handles confirm/cancel', () => {
      const handleConfirm = vi.fn();
      const handleClose = vi.fn();

      render(
        <ConfirmationModal
          isOpen={true}
          title="Delete Brief?"
          message="Are you sure you want to permanently delete this campaign brief?"
          confirmLabel="Delete Campaign"
          isDestructive={true}
          onConfirm={handleConfirm}
          onClose={handleClose}
        />
      );

      expect(screen.getByText('Delete Brief?')).toBeInTheDocument();
      expect(screen.getByText(/permanently delete this campaign/)).toBeInTheDocument();

      const confirmBtn = screen.getByText('Delete Campaign');
      fireEvent.click(confirmBtn);
      expect(handleConfirm).toHaveBeenCalledTimes(1);

      const cancelBtn = screen.getByText('Cancel');
      fireEvent.click(cancelBtn);
      expect(handleClose).toHaveBeenCalledTimes(1);
    });
  });
});
