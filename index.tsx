
import React, { Component, ErrorInfo, ReactNode, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { AlertTriangle, RefreshCw, Loader2 } from 'lucide-react';

// Lazy load do App para garantir que erros de importação (Firebase) sejam capturados pelo ErrorBoundary
const App = React.lazy(() => import('./App'));

// --- Global Error Boundary ---
interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

// Fix: Using Component from named imports and declaring state as a class property fixes property existence errors
class GlobalErrorBoundary extends Component<Props, State> {
  // Fix: Explicitly declare props and state for robust type resolution across different TS/React environments
  public props: Props;
  public state: State = {
    hasError: false,
    error: null
  };

  constructor(props: Props) {
    super(props);
    this.props = props;
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Capitalyx Critical Error:", error, errorInfo);
  }

  render() {
    // Fix: Access state properties from 'this.state' is now safe as property is explicitly declared
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0f172a] text-white flex flex-col items-center justify-center p-6 text-center font-sans">
          <div className="bg-rose-500/10 p-4 rounded-full mb-4 border border-rose-500/20">
            <AlertTriangle size={48} className="text-rose-500" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Ops! Ocorreu um problema.</h1>
          <p className="text-slate-400 mb-6 max-w-md">
            Não foi possível carregar o sistema. Verifique sua conexão ou tente recarregar.
          </p>
          <div className="bg-slate-800 p-4 rounded-lg mb-6 text-left max-w-md w-full overflow-auto border border-slate-700 max-h-32">
             <p className="text-xs text-rose-300 font-mono break-all">
               {this.state.error?.message || "Erro desconhecido"}
             </p>
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all"
          >
            <RefreshCw size={20} />
            Tentar Novamente
          </button>
        </div>
      );
    }

    // Fix: 'props' is inherited correctly from Component
    return this.props.children;
  }
}

// --- Loading Screen ---
const LoadingScreen = () => (
  <div className="min-h-screen bg-[#0f172a] flex items-center justify-center">
    <div className="flex flex-col items-center gap-4">
      <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
      <p className="text-slate-400 font-medium animate-pulse">Iniciando Capitalyx...</p>
    </div>
  </div>
);

// --- Safe Mount System ---
const rootElement = document.getElementById('root');

if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <GlobalErrorBoundary>
        <Suspense fallback={<LoadingScreen />}>
          <App />
        </Suspense>
      </GlobalErrorBoundary>
    </React.StrictMode>
  );
}
