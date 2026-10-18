import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './theme.css';

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <main className="fatal-error"><h1>鉴定台暂时出了点小状况</h1><p>重新打开即可再试，本机已保存的纪录会保留。</p><button className="button-primary" onClick={() => window.location.reload()}>重新打开</button></main>;
    return this.props.children;
  }
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><ErrorBoundary><App /></ErrorBoundary></React.StrictMode>);
