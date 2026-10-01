import React from "react";
import { Home, RotateCw, TriangleAlert } from "lucide-react";

/**
 * If a screen crashes, show a calm message instead of a blank page. Saved bills and stock are on the
 * server, so nothing is lost; "Go to Home" and "Try again" both reload the app fresh.
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("A screen crashed", error, errorInfo);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div role="alert" className="w-full max-w-xl bg-white border border-gray-200 rounded-2xl p-6 md:p-9 flex flex-col items-center text-center gap-2">
          <span className="flex items-center justify-center w-[72px] h-[72px] rounded-full bg-amber-50 text-amber-700">
            <TriangleAlert size={36} />
          </span>
          <h1 className="text-3xl font-bold leading-tight mt-2">Something went wrong on this screen</h1>
          <p className="text-gray-600">
            Saved bills, stock and khata are safe. Try again; if it keeps happening, tell the owner what you were doing.
          </p>
          <div className="w-full max-w-sm flex flex-col gap-3 mt-5">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="flex items-center justify-center gap-2.5 h-[60px] rounded-xl bg-blue-800 hover:bg-blue-900 text-white text-xl font-bold"
            >
              <RotateCw size={22} /> Try again
            </button>
            <a
              href="/dashboard"
              className="flex items-center justify-center gap-2 h-14 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-lg font-semibold"
            >
              <Home size={20} /> Go to Home
            </a>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
