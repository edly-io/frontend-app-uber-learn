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
import { isLaunchPath, reloadPage, takeLaunchParams } from './lib/launch';
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

// A new launch link opened in this same tab (the Uber app reusing its WebView,
// or a pasted link) differs from the stripped launch URL only in its fragment.
// Browsers treat that as a same-document navigation: the page does not load
// again, so without this the new string would never be sent and would stay in
// the address bar. Reloading runs this boot code on the new URL, which reads,
// strips and sends it. replaceState never fires hashchange, so the stripping
// above does not trigger it; a '?' link is a full page load anyway.
if (isLaunch) {
  window.addEventListener('hashchange', () => reloadPage());
}

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
