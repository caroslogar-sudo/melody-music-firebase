import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface State { hasError: boolean; error?: Error; }

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-screen bg-[#0a0a0a] flex items-center justify-center">
          <div className="text-center p-8 max-w-md">
            <AlertTriangle size={48} className="text-yellow-400 mx-auto mb-4" />
            <h2 className="text-white text-xl font-bold mb-2">Algo salio mal</h2>
            <p className="text-gray-400 text-sm mb-6">
              {this.state.error?.message || 'Error inesperado en la aplicacion'}
            </p>
            <button
              onClick={() => { this.setState({ hasError: false }); window.location.hash = '#/dashboard'; window.location.reload(); }}
              className="bg-gold-500 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 mx-auto hover:bg-gold-600 transition-colors">
              <RefreshCw size={18} /> Reiniciar App
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}