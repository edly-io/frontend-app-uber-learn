import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import {
  APP_READY,
  APP_INIT_ERROR,
  initialize,
  subscribe,
  mergeConfig,
} from '@edx/frontend-platform';
import { AppProvider, ErrorPage } from '@edx/frontend-platform/react';

import { App } from './App';

subscribe(APP_READY, () => {
  const root = createRoot(document.getElementById('root'));

  root.render(
    <StrictMode>
      <AppProvider>
        <App />
      </AppProvider>
    </StrictMode>,
  );
});

subscribe(APP_INIT_ERROR, (error) => {
  const root = createRoot(document.getElementById('root'));
  root.render(
    <StrictMode>
      <ErrorPage message={error.message} />
    </StrictMode>,
  );
});

initialize({
  messages: [],
  handlers: {
    config: () => {
      mergeConfig({
        // Add any Uber Learn-specific config keys here as needed
      }, 'UberLearnAppConfig');
    },
  },
  requireAuthenticatedUser: true,
});
