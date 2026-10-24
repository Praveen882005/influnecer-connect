import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Card, Icon } from '../../design-system';

export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6 font-sans">
      <Card orientation="vertical" padding="lg" className="max-w-md w-full text-center shadow-md">
        <div className="w-16 h-16 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center mx-auto mb-4 border border-sky-100 shadow-2xs">
          <Icon name="Compass" size={32} />
        </div>

        <div className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 uppercase tracking-wider mb-2">
          Error 404 · Page Not Found
        </div>

        <h1 className="text-2xl font-bold text-slate-950 tracking-tight">Lost in the Creator Network?</h1>
        <p className="text-xs text-slate-500 mt-2 leading-relaxed">
          The requested URL does not match any registered Brand Bridge routes or active workspace portals.
        </p>

        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-2.5">
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

        <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-around text-xs text-slate-500">
          <Link to="/brand/overview" className="hover:text-sky-600 font-medium">
            Brand Workspace
          </Link>
          <span>·</span>
          <Link to="/influencer/overview" className="hover:text-sky-600 font-medium">
            Creator Studio
          </Link>
          <span>·</span>
          <Link to="/admin/system-health" className="hover:text-sky-600 font-medium">
            System Health
          </Link>
        </div>
      </Card>
    </div>
  );
};
