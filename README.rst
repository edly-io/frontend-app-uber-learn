frontend-template-application
#############################

|license-badge| |status-badge| |ci-badge| |codecov-badge|


Purpose
*******

This repository is a template for Open edX micro-frontend applications. It is
flagged as a Template Repository, meaning it can be used as a basis for new
GitHub repositories by clicking the green "Use this template" button above.
The rest of this document describes how to work with your new micro-frontend
**after you've created a new repository from the template.**

Getting Started
***************

After copying the template repository, you'll want to do a find-and-replace to
replace all instances of ``frontend-template-application`` with the name of
your new repository.  Also edit index.html to replace "Application Template"
with a friendly name for this application that users will see in their browser
tab.

Prerequisites
=============

The `devstack`_ is currently recommended as a development environment for your
new MFE.  If you start it with ``make dev.up.lms`` that should give you
everything you need as a companion to this frontend.

Note that it is also possible to use `Tutor`_ to develop an MFE.  You can refer
to the `relevant tutor-mfe documentation`_ to get started using it.

.. _Devstack: https://github.com/openedx/devstack

.. _Tutor: https://github.com/overhangio/tutor

.. _relevant tutor-mfe documentation: https://github.com/overhangio/tutor-mfe#mfe-development

Cloning and Startup
===================

In the following steps, replace "[PLACEHOLDER]" with the name of the repo you
created when copying this template above.

1. Clone your new repo:

  ``git clone https://github.com/openedx/frontend-app-[PLACEHOLDER].git``

2. Use node v18.x.

   The current version of the micro-frontend build scripts support node 18.
   Using other major versions of node *may* work, but this is unsupported.  For
   convenience, this repository includes an .nvmrc file to help in setting the
   correct node version via `nvm <https://github.com/nvm-sh/nvm>`_.

3. Install npm dependencies:

  ``cd frontend-app-[PLACEHOLDER] && npm install``

4. Update the application port to use for local development:

   Default port is 8080. If this does not work for you, update the line
   `PORT=8080` to your port in all .env.* files

5. Start the dev server:

  ``npm start``

The dev server is running at `http://localhost:8080 <http://localhost:8080>`_
or whatever port you setup.

Making Your New Project's README File
=====================================

Move ``README-template-frontend-app.rst`` to your project's ``README.rst``
file. Please fill out all the sections - this helps out all developers
understand your MFE, how to install it, and how to use it.

Developing
**********

This section concerns development of ``frontend-template-application`` itself,
not the templated copy.

It should be noted that one of the goals of this repository is for it to
function correctly as an MFE (as in ``npm install && npm start``) even if no
modifications are made.  This ensures that developers get a *practical* working
example, not just a theoretical one.

This also means, of course, that any committed code should be tested and
subject to both CI and branch protection rules.

Project Structure
=================

The source for this project is organized into nested submodules according to
the `Feature-based Application Organization ADR`_.

.. _Feature-based Application Organization ADR: https://github.com/openedx/frontend-template-application/blob/master/docs/decisions/0002-feature-based-application-organization.rst

Build Process Notes
===================

**Production Build**

The production build is created with ``npm run build``.

Internationalization
====================

Please see refer to the `frontend-platform i18n howto`_ for documentation on
internationalization.

.. _frontend-platform i18n howto: https://github.com/openedx/frontend-platform/blob/master/docs/how_tos/i18n.rst

Launching from Uber
*******************

The Uber app opens a course with a *signed launch URL* (option 1B of the Uber &
Open edX integration document). The learner may have no Open edX session yet;
the LMS creates one when it accepts the link. See
`docs/decisions/0003-signed-launch-route.rst`_ for the design.

.. _docs/decisions/0003-signed-launch-route.rst: docs/decisions/0003-signed-launch-route.rst

URL format
==========

::

  https://apps.<lms-domain>/uber-learn/launch#<launch string>   (recommended)
  https://apps.<lms-domain>/uber-learn/launch?<launch string>   (accepted fallback)

  <launch string> = external_id=..&course_id=..&expires=..&nonce=..&sig=..

Values are percent-encoded (the ``+`` in a course key is ``%2B``). Uber's edge
gateway signs the string; the MFE treats it as opaque and never parses it. The
LMS (``uber-features``, ``uber_features.launch``) verifies the signature, the
expiry, the External ID, the course key and the single-use nonce. The current
scheme is a placeholder (``uber-launch-v1``, HMAC-SHA256) until Uber shares its
signing rules.

How it works
============

1. ``src/index.jsx`` sees the exact path ``/uber-learn/launch``, reads the
   string after ``#`` (or ``?``), removes it from the address bar with
   ``history.replaceState``, and only then calls ``initialize()``, with
   ``requireAuthenticatedUser: false`` for this path only. Every other path
   still requires a signed-in user. If another launch link is opened in the
   same tab, the page reloads so that the new link goes through this step too.
2. ``LaunchPage`` posts ``{"launch": "<string>"}`` once to
   ``POST {LMS_BASE_URL}/api/uber/launch/v1/`` (with CSRF, cookies included).
3. The LMS signs the learner in (session and JWT cookies), enrolls them when
   the link names a course, and answers ``{"next": "<app path>", "course_id":
   "<course key>" | null}``.
4. The page does a full page load of ``/uber-learn`` + ``next``, where the
   app boots again with the new session. ``next`` is
   followed only when it is a safe in-app path; otherwise the page opens the
   course (when ``course_id`` is valid) or the app home. A returning learner
   (same External ID) gets the same account and resumes the course.

Trying it locally
=================

The LMS needs ``uber-features`` with the ``launch`` sub-app, its migration, and
a signing secret (``UBER_LAUNCH_SIGNING_SECRETS``); see the ``uber-features``
README. Then mint a link with the management command and open it in a private
window::

  tutor dev exec lms ./manage.py lms generate_uber_launch_url --course-id 'course-v1:Org+Course+Run'

The command prints ``http://apps.local.openedx.io:2011/uber-learn/launch#...``.
Useful options: ``--external-id <id>`` (the same ID returns to the same
account), ``--ttl -60`` (an expired link), ``--query`` (a ``?`` link instead
of ``#``) and ``--json`` (a request body for curl).

What the learner sees
=====================

============================================ ====================================================
Situation                                    Page
============================================ ====================================================
Waiting for the LMS                          "Signing you in…"
Success                                      The page named by ``next``
No launch string, or longer than 2048 chars  "This link is incomplete"
Bad signature, syntax, TTL or course key     "This link isn't valid"
Expired                                      "This link has expired"
Opened a second time                         "This link was already used"
Course does not exist                        "This course isn't available"
Enrollment refused (closed, full, a gate)    "You can't start this course yet" (+ LMS message)
Login filter refused                         "You can't sign in right now" (+ LMS message)
Linked account inactive or staff             "Your learning account isn't available"
Browser signed in to another account         "You're signed in to a different account" + Sign out
Feature off (no secret on the LMS)           "Course links aren't available right now"
Network, server or CSRF error                "Something went wrong" + Try again
============================================ ====================================================

Getting Help
************

If you're having trouble, we have discussion forums at
https://discuss.openedx.org where you can connect with others in the community.

Our real-time conversations are on Slack. You can request a `Slack
invitation`_, then join our `community Slack workspace`_.  Because this is a
frontend repository, the best place to discuss it would be in the `#wg-frontend
channel`_.

For anything non-trivial, the best path is to open an issue in this repository
with as many details about the issue you are facing as you can provide.

https://github.com/openedx/frontend-template-application/issues

For more information about these options, see the `Getting Help`_ page.

.. _Slack invitation: https://openedx.org/slack
.. _community Slack workspace: https://openedx.slack.com/
.. _#wg-frontend channel: https://openedx.slack.com/archives/C04BM6YC7A6
.. _Getting Help: https://openedx.org/getting-help

License
*******

The code in this repository is licensed under the AGPLv3 unless otherwise
noted.

Please see `LICENSE <LICENSE>`_ for details.

Contributing
************

Contributions are very welcome.  Please read `How To Contribute`_ for details.

.. _How To Contribute: https://openedx.org/r/how-to-contribute

This project is currently accepting all types of contributions, bug fixes,
security fixes, maintenance work, or new features.  However, please make sure
to have a discussion about your new feature idea with the maintainers prior to
beginning development to maximize the chances of your change being accepted.
You can start a conversation by creating a new issue on this repo summarizing
your idea.

The Open edX Code of Conduct
****************************

All community members are expected to follow the `Open edX Code of Conduct`_.

.. _Open edX Code of Conduct: https://openedx.org/code-of-conduct/

People
******

The assigned maintainers for this component and other project details may be
found in `Backstage`_. Backstage pulls this data from the ``catalog-info.yaml``
file in this repo.

.. _Backstage: https://open-edx-backstage.herokuapp.com/catalog/default/component/frontend-template-application

Reporting Security Issues
*************************

Please do not report security issues in public, and email security@openedx.org instead.

.. |license-badge| image:: https://img.shields.io/github/license/openedx/frontend-template-application.svg
    :target: https://github.com/openedx/frontend-template-application/blob/main/LICENSE
    :alt: License

.. |status-badge| image:: https://img.shields.io/badge/Status-Maintained-brightgreen

.. |ci-badge| image:: https://github.com/openedx/frontend-template-application/actions/workflows/ci.yml/badge.svg
    :target: https://github.com/openedx/frontend-template-application/actions/workflows/ci.yml
    :alt: Continuous Integration

.. |codecov-badge| image:: https://codecov.io/github/openedx/frontend-template-application/coverage.svg?branch=main
    :target: https://codecov.io/github/openedx/frontend-template-application?branch=main
    :alt: Codecov
