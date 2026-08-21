import { Component, type ErrorInfo, type ReactNode } from 'react';

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Application view failed to render', error, info);
  }

  render() {
    if (this.state.hasError) {
      return <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4"><div className="max-w-md rounded-2xl bg-white p-8 text-center shadow-sm"><h1 className="text-xl font-bold text-gray-900">Məlumatları yükləmək mümkün olmadı.</h1><p className="mt-2 text-gray-500">Zəhmət olmasa yenidən cəhd edin.</p><button onClick={() => this.setState({ hasError: false })} className="mt-6 rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white hover:bg-emerald-700">Yenidən cəhd et</button></div></div>;
    }

    return this.props.children;
  }
}
