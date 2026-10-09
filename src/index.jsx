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
import { isLaunchPath, takeLaunchParams } from './lib/launch';
import { LaunchPage } from './pages/LaunchPage';

// Signed Uber launch (/uber-learn/launch#<signed parameters>).
//
// This is decided once, at module load, before initialize(). The launch page is
// the only page that boots without a signed-in user: the learner arrives from
// the Uber app without an Open edX session, and the LMS creates one when it
// accepts the signed link. Every other path still requires a signed-in user and
// redirects to the LMS login exactly as before, and <App /> (with all its
// routes) never mounts on the launch path.
//
// takeLaunchParams() also removes the signed parameters from the address bar
// and from history before initialize() sets up logging and analytics, so
// nothing reads or reports the URL while it still carries them.
const isLaunch = isLaunchPath(window.location.pathname);
const launchParams = isLaunch ? takeLaunchParams() : null;

subscribe(APP_READY, () => {
  const root = createRoot(document.getElementById('root'));

  root.render(
    <StrictMode>
      <AppProvider>
        {isLaunch ? <LaunchPage launch={launchParams} /> : <App />}
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
  requireAuthenticatedUser: !isLaunch,
});
