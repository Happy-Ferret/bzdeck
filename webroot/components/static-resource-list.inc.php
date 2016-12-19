<?php
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

$resources = (object) [
  // Images
  'images' => [
    '/static/images/logo/icon-256-white.png',
    '/static/images/themes/dark/sprite.png',
    '/static/images/themes/light/sprite.png',
  ],
  // Fonts
  'fonts' => [
    '/vendor/Fira/fonts/FiraMono-Regular.woff2?v=3.206',
    '/vendor/Fira/fonts/FiraSans-Book.woff2?v=4.106',
    '/vendor/Fira/fonts/FiraSans-LightItalic.woff2?v=4.106',
    '/vendor/Fira/fonts/FiraSans-Medium.woff2?v=4.106',
    '/vendor/Font-Awesome/fonts/fontawesome-webfont.woff2?v=4.4.0',
  ],
  // Stylesheets
  'styles' => [
    // Vendor
    '/vendor/flaretail.js/styles/widgets.css',
    // General
    '/static/styles/base/fonts.css',
    '/static/styles/base/base.css',
    '/static/styles/base/widgets.css',
    '/static/styles/base/animations.css',
    // Views
    '/static/styles/views/app-body.css',
    '/static/styles/views/app-container.css',
    '/static/styles/views/app-landing.css',
    '/static/styles/views/attachment-page.css',
    '/static/styles/views/attachment.css',
    '/static/styles/views/bug-attachments.css',
    '/static/styles/views/bug-comment-form.css',
    '/static/styles/views/bug-container.css',
    '/static/styles/views/bug-details.css',
    '/static/styles/views/bug-flags.css',
    '/static/styles/views/bug-history.css',
    '/static/styles/views/bug-participant-list.css',
    '/static/styles/views/bug-timeline.css',
    '/static/styles/views/bug-timeline-entry.css',
    '/static/styles/views/bug.css',
    '/static/styles/views/home.css',
    '/static/styles/views/login-form.css',
    '/static/styles/views/main.css',
    '/static/styles/views/markdown-editor.css',
    '/static/styles/views/navigator.css',
    '/static/styles/views/person-finder.css',
    '/static/styles/views/profile-page.css',
    '/static/styles/views/qrcode-auth-overlay.css',
    '/static/styles/views/search-page.css',
    '/static/styles/views/settings-page.css',
    '/static/styles/views/sidebar.css',
    '/static/styles/views/sidebar-list.css',
    '/static/styles/views/thread.css',
    '/static/styles/views/tooltip.css',
    // Themes
    '/static/styles/themes/dark.css',
    '/static/styles/themes/light.css',
  ],
  // Scripts
  // For each section, base.js should go first
  'scripts' => [
    // Vendor
    '/vendor/JavaScript-MD5/scripts/md5.min.js',
    '/vendor/showdown/dist/showdown.min.js',
    '/vendor/flaretail.js/scripts/util.js',
    '/vendor/flaretail.js/scripts/widgets.js',
    '/vendor/flaretail.js/scripts/app.js',
    // Config
    '/static/scripts/config/app.js',
    // Datasources
    '/static/scripts/datasources/base.js',
    '/static/scripts/datasources/account.js',
    '/static/scripts/datasources/global.js',
    // Models
    '/static/scripts/models/base.js',
    '/static/scripts/models/account.js',
    '/static/scripts/models/attachment.js',
    '/static/scripts/models/bug.js',
    '/static/scripts/models/bugzfeed.js',
    '/static/scripts/models/host.js',
    '/static/scripts/models/user.js',
    // Collections
    '/static/scripts/collections/base.js',
    '/static/scripts/collections/accounts.js',
    '/static/scripts/collections/attachments.js',
    '/static/scripts/collections/bugs.js',
    '/static/scripts/collections/hosts.js',
    '/static/scripts/collections/prefs.js',
    '/static/scripts/collections/subscriptions.js',
    '/static/scripts/collections/users.js',
    // Views
    '/static/scripts/views/base.js',
    '/static/scripts/views/app-body.js',
    '/static/scripts/views/attachment.js',
    '/static/scripts/views/attachment-page.js',
    '/static/scripts/views/bug.js',
    '/static/scripts/views/bug-attachments.js',
    '/static/scripts/views/bug-comment-form.js',
    '/static/scripts/views/bug-container.js',
    '/static/scripts/views/bug-details.js', // extends bug.js
    '/static/scripts/views/bug-flags.js',
    '/static/scripts/views/bug-history.js',
    '/static/scripts/views/bug-participant-list.js',
    '/static/scripts/views/bug-timeline.js',
    '/static/scripts/views/bug-timeline-entry.js',
    '/static/scripts/views/details-page.js',
    '/static/scripts/views/global.js',
    '/static/scripts/views/home-page.js',
    '/static/scripts/views/login-form.js',
    '/static/scripts/views/main.js',
    '/static/scripts/views/markdown-editor.js',
    '/static/scripts/views/navigator.js',
    '/static/scripts/views/person-finder.js',
    '/static/scripts/views/profile-page.js',
    '/static/scripts/views/search-page.js',
    '/static/scripts/views/session.js',
    '/static/scripts/views/settings-page.js',
    '/static/scripts/views/sidebar.js',
    '/static/scripts/views/sidebar-list.js',
    '/static/scripts/views/statusbar.js',
    '/static/scripts/views/thread.js',
    '/static/scripts/views/tooltip.js',
    // Presenters
    '/static/scripts/presenters/base.js',
    '/static/scripts/presenters/attachment-page.js',
    '/static/scripts/presenters/attachment.js',
    '/static/scripts/presenters/bug-container.js',
    '/static/scripts/presenters/bug.js',
    '/static/scripts/presenters/details-page.js',
    '/static/scripts/presenters/global.js',
    '/static/scripts/presenters/home-page.js',
    '/static/scripts/presenters/main.js',
    '/static/scripts/presenters/navigator.js',
    '/static/scripts/presenters/profile-page.js',
    '/static/scripts/presenters/quick-search.js',
    '/static/scripts/presenters/search-page.js',
    '/static/scripts/presenters/session.js',
    '/static/scripts/presenters/settings-page.js',
    '/static/scripts/presenters/sidebar-list.js',
    '/static/scripts/presenters/statusbar.js',
    // Workers
    '/static/scripts/workers/tasks.js',
  ],
];