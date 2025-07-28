import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class E2eCommitSuiteErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('E2eCommitSuiteDetailPage Error Boundary caught an error:', error, errorInfo);
    
    // Log additional context for debugging
    console.error('Error stack:', error.stack);
    console.error('Component stack:', errorInfo.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="h-full bg-vsc-editor-background text-vsc-foreground flex flex-col">
          <div className="p-3 border-b border-vsc-panel-border">
            <h1 className="text-sm font-medium text-vsc-foreground">Commit Suite Details</h1>
            <p className="text-xs text-vsc-descriptionForeground">Error loading page</p>
          </div>
          
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-md mx-auto p-4">
              <ExclamationTriangleIcon className="h-12 w-12 text-vsc-errorForeground mx-auto mb-4" />
              
              <h2 className="text-sm font-medium text-vsc-foreground mb-2">
                Something went wrong
              </h2>
              
              <p className="text-xs text-vsc-descriptionForeground mb-4 leading-relaxed">
                The commit suite detail page encountered an unexpected error. 
                This has been logged for investigation.
              </p>
              
              <div className="space-y-2">
                <button
                  onClick={this.handleRetry}
                  className="px-3 py-1.5 text-xs font-medium text-vsc-button-foreground bg-vsc-button-background rounded-sm hover:bg-vsc-button-hoverBackground transition-colors"
                >
                  Try Again
                </button>
                
                <div className="text-xs text-vsc-descriptionForeground">
                  {this.state.error?.message && (
                    <div className="mt-2 p-2 bg-vsc-input-background border border-vsc-input-border rounded-sm text-left">
                      <strong>Error:</strong> {this.state.error.message}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default E2eCommitSuiteErrorBoundary;