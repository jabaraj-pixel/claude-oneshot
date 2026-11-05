import React, { useState } from 'react';
import { PageId } from './types';
import { DashboardLayout } from './layouts/DashboardLayout';
import { OverviewPage } from './pages/OverviewPage';
import { CallsPage } from './pages/CallsPage';
import { JourneysPage } from './pages/JourneysPage';
import { ComplaintsPage } from './pages/ComplaintsPage';
import { MessagingPage } from './pages/MessagingPage';
import { SettingsPage } from './pages/SettingsPage';

export const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<PageId>('overview');

  const renderPage = () => {
    switch (currentPage) {
      case 'overview':
        return <OverviewPage />;
      case 'calls':
        return <CallsPage />;
      case 'journeys':
        return <JourneysPage />;
      case 'complaints':
        return <ComplaintsPage />;
      case 'messaging':
        return <MessagingPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <OverviewPage />;
    }
  };

  return (
    <DashboardLayout currentPage={currentPage} onNavigate={setCurrentPage}>
      {renderPage()}
    </DashboardLayout>
  );
};

export default App;

