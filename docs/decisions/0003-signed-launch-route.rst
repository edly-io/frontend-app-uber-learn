3. Signed launch route
----------------------

Status
------

Draft. The signing scheme is a placeholder until Uber shares its final
signing rules; this decision does not depend on the scheme.

Context
-------

The Uber and Open edX integration document recommends a *signed launch*
(option 1B). Uber's edge gateway signs the launch data (an anonymous External
ID, the course, an expiry and a nonce) and the Uber app opens a signed Open edX
URL. Open edX validates the signature, finds or creates the learner from the
External ID, creates its own session, enrolls the learner and shows the course.
When the learner comes back with the same External ID, the course resumes.

The LMS half lives in the ``uber-features`` plugin (``uber_features.launch``):
``POST /api/uber/launch/v1/`` verifies the link, signs the learner in, sets the
session and JWT cookies, enrolls them when the link names a course, and answers
``{"next": "<app path>", "course_id": "<course key>" | null}``. The
LMS picks the signing scheme with ``UBER_LAUNCH_VERIFIER``; the dummy scheme
for now is an HMAC-SHA256 over the five fields.

This MFE must give that flow a page. The difficulty is that the whole app boots
with ``initialize({ requireAuthenticatedUser: true })``: frontend-platform calls
``ensureAuthenticatedUser()`` before ``APP_READY`` and sends any visitor without
a session to the LMS login before a single route renders. A learner arriving
from the Uber app has no Open edX session yet; that is the point of the launch.

Decision
--------

**1. The launch path is decided once, at boot, before** ``initialize()``.

``src/index.jsx`` checks ``window.location.pathname`` against
``${PUBLIC_PATH}launch`` (exact match, optional trailing slash). Only that path
boots with ``requireAuthenticatedUser: false``, and on that path ``APP_READY``
renders ``<LaunchPage />`` *instead of* ``<App />``. Every other path keeps
``requireAuthenticatedUser: true`` and the same login redirect as before, and
``App.tsx`` and its routes are unchanged (there is no ``/launch`` route in it).

**2. The launch string is forwarded opaquely.**

Uber puts the URL-encoded launch string after ``#`` (recommended) or ``?``
(accepted fallback; it is the document's illustrative form)::

    https://apps.<lms-domain>/uber-learn/launch#external_id=..&course_id=..&expires=..&nonce=..&sig=..

The MFE never parses, decodes, validates, stores or logs it. It reads the raw
text after ``#`` (or, when the fragment is empty, after ``?``), and sends it as
``{"launch": "<raw>"}``. Only the LMS knows the scheme, so Uber's final scheme
needs a new verifier class and a settings change on the LMS, and no MFE change.
Strings longer than 4096 characters are not sent (the LMS has the same limit).

The fragment is preferred because browsers never send it to a server or put it
in a ``Referer``: the signed data does not reach the MFE host's access logs or
any CDN. A ``?`` link does reach those logs; it is still single use and
expires within minutes.

**3. The parameters are stripped before** ``initialize()``.

The same boot code calls ``history.replaceState(state, '', pathname)`` right
after reading the string, whether or not it was usable, so the signed
parameters are gone from the address bar and from history before
frontend-platform configures logging and analytics. The string lives only in
memory, as a prop of ``LaunchPage``.

A new launch link opened in the same tab (the Uber app reusing its WebView, or
a pasted link) differs from the stripped ``/uber-learn/launch`` only in its
fragment, so browsers treat it as a same-document navigation and do not load
the page again. On the launch path the boot code therefore reloads the page on
``hashchange``: the boot code runs again on the new URL and reads, strips and
sends the new string like any first load. ``replaceState`` never fires
``hashchange``, so the stripping does not trigger it, and a ``?`` link is a
full page load anyway.

**4. One request, made by a plain component.**

``LaunchPage`` does not use the router or react-query: there is one request and
nothing to cache. It posts once from an effect, with a ``useRef`` guard so that
React StrictMode's double effect in development cannot spend the single-use
nonce twice. The request goes through ``getAuthenticatedHttpClient()`` with
``{ isPublic: true }``: the JWT refresh is skipped (there is no session yet),
and the CSRF interceptor still fetches a token from ``/csrf/api/v1/token`` and
adds ``X-CSRFToken``. Cookies are sent, so the LMS can see an existing session
(for its conflict rule) and set the new one.

**5. The page leaves with a full page load, to the path the LMS chose.**

The LMS decides where the learner lands and answers it as ``next``, an app path
relative to ``PUBLIC_PATH``:

====================== ==============================================================
``next``               Page
====================== ==============================================================
``/course/<key>``      The course overview (the link named a course).
``/``                  The app home.
``/?section=optional`` The app home, scrolled to the *Optional courses* section; the
                       home page then removes ``section`` from the URL.
====================== ==============================================================

On success the page calls ``window.location.replace(PUBLIC_PATH +
next.slice(1))`` and keeps showing its loading state ("Signing you in…", since
the destination is not always a course). A full load is required:

* the page booted without a user, and frontend-platform holds the anonymous
  user and the CSRF token (which the LMS login just rotated) in memory;
* the next page must boot through ``ensureAuthenticatedUser()`` again, reading
  the new JWT cookie (or calling ``/login_refresh`` with the new session);
* ``replace`` keeps the spent launch URL out of the back stack.

``next`` is untrusted input to a redirect, so it is followed only when it is a
safe in-app path (``appPathFor`` in ``src/lib/launch.ts``): a string of at most
512 characters that starts with a single ``/`` (not ``//``), has no backslash,
whitespace or fragment, and resolves to itself against a placeholder origin.
That last check refuses another origin, dot segments (``/../logout``,
``/%2e%2e/logout``, which would leave ``PUBLIC_PATH``) and anything a browser
would re-encode. ``/launch`` is refused too, as it would loop.

When ``next`` is missing or refused, the page falls back to the course overview
when ``course_id`` matches ``^course-v1:[A-Za-z0-9._~:+-]+$`` (an LMS that
predates ``next`` answers only ``{"course_id"}``), and otherwise to the app home.
The learner is signed in by then, so a success never ends on an error state,
and the redirect can never point at another origin or outside the app.

**6. Every failure has a learner-facing state.**

Error states are the ``ErrorView`` page itself (``role="alert"``), with every
action in its footer so it is on the first screen; loading uses
``LoadingSkeleton`` inside ``role="status"`` with ``aria-busy``, in the same
full-height frame.

========================== ======================================= ============================================
State                      Title                                   Notes
========================== ======================================= ============================================
``incomplete_link``        This link is incomplete                 No usable string; nothing is sent.
``invalid_link``           This link isn't valid                   Bad syntax, signature, TTL or course key.
``expired_link``           This link has expired
``used_link``              This link was already used              The nonce was already consumed.
``course_unavailable``     This course isn't available
``enrollment_not_allowed`` You can't start this course yet         Shows the LMS ``user_message`` if present.
``login_prevented``        You can't sign in right now             Shows the LMS ``user_message`` if present.
``account_unavailable``    Your learning account isn't available
``session_conflict``       You're signed in to a different account **Sign out**, back to the launch page.
``launch_disabled``        Course links aren't available right now The LMS has no signing secret.
``try_again``              Something went wrong                    **Try again** re-sends the same string.
========================== ======================================= ============================================

``try_again`` also covers network errors, 5xx, DRF ``{"detail"}`` errors (CSRF,
415, 405) and unknown codes. The LMS rolls
those back, so re-sending the same link is safe; the other codes are final for
that link. **Go to my courses** (a full load of ``PUBLIC_PATH``) is offered on
error states when the browser already has a signed-in user, except for
``session_conflict`` and ``account_unavailable``. It is the footer action, or
the second footer action under **Try again**.

Rejected alternatives
---------------------

**Boot every page without a user and wrap routes in** ``AuthenticatedPageRoute``.
This would change the authentication of every existing route to protect one new
one: a single missed wrapper would expose a page, the protected tree
(``QueryClientProvider``, ``App``) would mount for anonymous visitors, and the
login redirect would happen after render instead of before boot. The boot-time
check leaves every other path exactly as it was.

**A** ``/launch`` **route inside** ``App.tsx``. The route would be matched after
``initialize()`` had already required a user, so an anonymous learner would
never reach it.

**Parse or validate the parameters in the MFE.** The browser cannot verify an
HMAC without the secret, and any client-side check would duplicate (and drift
from) the LMS rules and tie the MFE to the dummy scheme.

**Use react-query for the POST.** Its retries and refetching are wrong for a
single-use request, and there is nothing to cache.

Consequences
------------

* The only page reachable without a session is the launch page, and it shows
  no learner data.
* Reloading the launch page after the parameters were stripped shows
  ``incomplete_link``; the learner opens the course again from the Uber app.
* When Uber's real scheme arrives, the MFE changes only if the URL format
  changes (for example, a different path or a body that is not a single string).
* Where a launch lands is decided by the LMS. A new destination needs an LMS
  change only, as long as it is an existing app path.
* The copy is plain English, like the rest of the app; translation is a
  follow-up for the whole MFE.

References
----------

* Uber & Open edX Integration for course launch & events (option 1B, signed
  launch).
* ``uber-features``: ``docs/decisions/launch/0001-signed-launch.rst`` and the
  API contract for ``POST /api/uber/launch/v1/``.
