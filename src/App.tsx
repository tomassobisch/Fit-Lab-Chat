import React from 'react';
import { TJOfficeChat } from './components/TJOfficeChat';
import './index.css';

class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: any}> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#121212] text-white flex flex-col items-center justify-center p-10 font-sans">
          <h1 className="text-tj-accent text-2xl font-bold mb-4 flex items-center gap-2">
            TJ<span className="underline">OFFICE</span> | ERROR
          </h1>
          <div className="bg-tj-panel p-6 rounded-lg border border-red-500/30 max-w-2xl w-full">
            <p className="text-red-400 font-mono text-sm mb-4">Falló el renderizado de la aplicación.</p>
            <pre className="text-xs text-white/40 overflow-auto p-4 bg-black/20 rounded">
              {this.state.error?.toString()}
            </pre>
            <button 
              onClick={() => window.location.reload()}
              className="mt-6 px-4 py-2 bg-tj-accent text-tj-dark font-bold rounded hover:bg-white transition-colors"
            >
              REINTENTAR CARGA
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function App() {
  return (
    <ErrorBoundary>
      <div className="App min-h-screen bg-tj-dark">
        <TJOfficeChat />
      </div>
    </ErrorBoundary>
  );
}

export default App;
