import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button, Card, Icon } from '../../design-system';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    console.error('ErrorBoundary caught an unhandled error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public override render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[400px] flex items-center justify-center p-6 text-left">
          <Card orientation="vertical" padding="lg" className="max-w-lg w-full border-red-200">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-red-100 text-red-700 rounded-lg shrink-0">
                <Icon name="AlertTriangle" size={24} />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-slate-900">Application Error Encountered</h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  An unexpected runtime error occurred while rendering this view. Your session state remains secure.
                </p>

                {this.state.error && (
                  <div className="mt-3 p-2.5 bg-slate-900 text-red-300 rounded font-mono text-[11px] overflow-x-auto max-h-36">
                    {this.state.error.name}: {this.state.error.message}
                  </div>
                )}

                <div className="mt-4 flex items-center gap-2 pt-2 border-t border-slate-100">
                  <Button variant="primary" size="sm" onClick={this.handleReset}>
                    Try Again
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      window.location.href = '/';
                    }}
                  >
                    Return to Homepage
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
