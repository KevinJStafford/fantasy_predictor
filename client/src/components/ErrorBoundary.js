import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('=== ERRORBOUNDARY CAUGHT AN ERROR ===');
    console.error('Error:', error);
    console.error('ErrorInfo:', errorInfo);
    console.error('Error stack:', error.stack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: 24,
          textAlign: 'center',
          minHeight: '100vh',
          background: '#fff',
          color: '#333',
        }}>
          <h2>Something went wrong</h2>
          <p>{this.state.error?.toString()}</p>
          <button onClick={() => window.location.reload()}>Reload Page</button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
