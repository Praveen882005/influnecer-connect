import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Card, Icon } from '../../design-system';

export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#F7F5F0] flex items-center justify-center p-4 sm:p-6 font-sans">
      <Card orientation="vertical" padding="lg" className="max-w-md w-full text-center rounded-[16px] border border-[#E5E7EB] bg-white shadow-[0_12px_32px_rgba(23,36,58,0.06)]">
        <div className="w-16 h-16 rounded-[14px] bg-[#DCE5FA] text-[#4169E1] flex items-center justify-center mx-auto mb-4 border border-[#BFDBFE] shadow-2xs">
          <Icon name="Compass" size={32} />
        </div>

        <div className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-[#F7F5F0] text-[#17243A] uppercase tracking-wider mb-2 border border-[#E5E7EB]">
          Error 404 · Page Not Found
        </div>

        <h1 className="text-2xl font-bold font-['Manrope',sans-serif] text-[#17243A] tracking-tight">Lost in the Creator Network?</h1>
        <p className="text-xs text-[#697386] mt-2 leading-relaxed">
          The requested URL does not match any registered Brand Bridge routes or active workspace portals.
        </p>

        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button
            variant="secondary"
            fullWidth
            onClick={() => navigate(-1)}
            leftIcon="ArrowLeft"
          >
            Go Back
          </Button>
          <Link to="/" className="w-full">
            <Button variant="primary" fullWidth leftIcon="Home">
              Return Home
            </Button>
          </Link>
        </div>

        <div className="mt-6 pt-4 border-t border-[#E5E7EB] flex items-center justify-around text-xs text-[#697386]">
          <Link to="/brand/overview" className="hover:text-[#4169E1] font-semibold transition-colors">
            Brand Workspace
          </Link>
          <span className="text-[#CBD5E1]">·</span>
          <Link to="/influencer/overview" className="hover:text-[#4169E1] font-semibold transition-colors">
            Creator Studio
          </Link>
          <span className="text-[#CBD5E1]">·</span>
          <Link to="/admin/system-health" className="hover:text-[#4169E1] font-semibold transition-colors">
            System Health
          </Link>
        </div>
      </Card>
    </div>
  );
};
