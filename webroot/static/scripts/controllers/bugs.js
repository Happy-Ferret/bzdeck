/**
 * BzDeck Bugs Controller
 * Copyright © 2015 Kohei Yoshino. All rights reserved.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

BzDeck.controllers.bugs = {};

BzDeck.controllers.bugs.fetch_subscriptions = function () {
  let prefs = BzDeck.models.prefs.data,
      last_loaded = prefs['subscriptions.last_loaded'],
      firstrun = !last_loaded,
      params = new URLSearchParams(),
      fields = ['cc', 'reporter', 'assigned_to', 'qa_contact', 'bug_mentor', 'requestees.login_name'];

  params.append('j_top', 'OR');

  if (last_loaded) {
    let date = FlareTail.util.datetime.get_shifted_date(new Date(last_loaded), BzDeck.models.server.data.timezone);

    params.append('include_fields', 'id');
    params.append('chfieldfrom', date.toLocaleFormat('%Y-%m-%d %T'));
  } else {
    // Fetch only solved bugs at initial startup
    params.append('resolution', '---');
  }

  for (let [i, name] of fields.entries()) {
    params.append('f' + i, name);
    params.append('o' + i, 'equals');
    params.append('v' + i, BzDeck.models.account.data.name);
  }

  return new Promise((resolve, reject) => BzDeck.models.bugs.get_all().then(cached_bugs => {
    // Append starred bugs to the query
    params.append('f9', 'bug_id');
    params.append('o9', 'anywords');
    params.append('v9', [for (bug of cached_bugs) if (this.is_starred(bug)) bug.id].join());

    BzDeck.controllers.global.request('bug', params).then(result => {
      last_loaded = prefs['subscriptions.last_loaded'] = Date.now();

      if (firstrun) {
        return this.initialize_bugs(result.bugs).then(bugs => BzDeck.models.bugs.save(bugs));
      }

      if (result.bugs.length) {
        return this.fetch_bugs([for (bug of result.bugs) bug.id])
            .then(bugs => this.parse_bugs(bugs)).then(bugs => BzDeck.models.bugs.save(bugs))
            .then(bugs => FlareTail.util.event.trigger(window, 'Bugs:Updated', { 'detail': { bugs }}));
      }

      return true;
    }).then(() => resolve(), event => reject(new Error('Failed to load data.'))); // l10n
  }));
};

BzDeck.controllers.bugs.fetch_bug = function (id, include_metadata = true, include_details = true) {
  return new Promise((resolve, reject) => this.fetch_bugs([id], include_metadata, include_details)
      .then(bugs => resolve(bugs[0]), error => reject(error)));
};

BzDeck.controllers.bugs.fetch_bugs = function (ids, include_metadata = true, include_details = true) {
  // Sort the IDs to make sure the subsequent index access always works
  ids.sort();

  let fetch = (method, param_str = '') => new Promise((resolve, reject) => {
    let params = new URLSearchParams(param_str);

    ids.forEach(id => params.append('ids', id));
    BzDeck.controllers.global.request('bug/' + (method ? ids[0] + '/' + method : ''), params)
        .then(result => resolve(result.bugs), event => reject(new Error()));
  });

  let fetchers = [include_metadata ? fetch() : Promise.resolve()];

  if (include_details) {
    fetchers.push(fetch('comment'), fetch('history'), fetch('attachment', 'exclude_fields=data'));
  }

  return Promise.all(fetchers).then(values => ids.map((id, index) => {
    let bug = include_metadata ? values[0][index] : { id };

    if (include_details) {
      bug.comments = values[1][id].comments;
      bug.history = values[2][index].history || [];
      bug.attachments = values[3][id] || [];
      bug._update_needed = false;
    }

    return bug;
  })).catch(error => new Error('Failed to fetch bugs from Bugzilla.'));
};

BzDeck.controllers.bugs.initialize_bugs = function (bugs) {
  return Promise.all([for (bug of bugs) this.initialize_bug(bug)]);
};

BzDeck.controllers.bugs.initialize_bug = function (bug) {
  return new Promise(resolve => {
    bug._unread = false; // Mark all bugs read if the session is firstrun
    bug._update_needed = true; // Flag to fetch details
    resolve(bug);
  });
};

BzDeck.controllers.bugs.parse_bugs = function (bugs) {
  return Promise.all([for (bug of bugs) this.parse_bug(bug)]);
};

BzDeck.controllers.bugs.parse_bug = function (bug) {
  // Check if the bug has been cached, then identify the changes
  return new Promise(resolve => BzDeck.models.bugs.get(bug.id).then(cache => {
    if (!cache) {
      bug._unread = true;
      resolve(bug);

      return;
    }

    // Copy annotations
    for (let [key, value] of Iterator(cache)) if (key.startsWith('_')) {
      bug[key] = value;
    }

    let ignore_cc = BzDeck.models.prefs.data['notifications.ignore_cc_changes'] !== false,
        cached_time = new Date(cache.last_change_time),
        cmp_time = obj => new Date(obj.creation_time || obj.when) > cached_time,
        new_comments = new Map([for (c of bug.comments) if (cmp_time(c)) [new Date(c.creation_time), c]]),
        new_attachments = new Map([for (a of bug.attachments || []) if (cmp_time(a)) [new Date(a.creation_time), a]]),
        new_history = new Map([for (h of bug.history || []) if (cmp_time(h)) [new Date(h.when), h]]),
        timestamps = new Set([...new_comments.keys(), ...new_attachments.keys(), ...new_history.keys()].sort());

    // Mark the bug unread if the user subscribes CC changes or the bug is already unread
    if (!ignore_cc || cache._unread || !cache._last_viewed ||
        // or there are unread comments or attachments
        new_comments.size || new_attachments.size ||
        // or there are unread non-CC changes
        [for (h of new_history.values()) if ([for (c of h.changes) if (c.field_name !== 'cc') c].length) h].length) {
      bug._unread = true;
    } else {
      // Looks like there are only CC changes, so mark the bug read
      bug._unread = false;
    }

    bug._update_needed = false;
    resolve(bug);

    // Combine all changes into one Map, then notify
    for (let time of timestamps) {
      let changes = new Map(),
          comment = new_comments.get(time),
          attachment = new_attachments.get(time),
          history = new_history.get(time);

      if (comment) {
        changes.set('comment', comment);
      }

      if (attachment) {
        changes.set('attachment', attachment);
      }

      if (history) {
        changes.set('history', history);
      }

      FlareTail.util.event.trigger(window, 'Bug:Updated', { 'detail': { bug, changes }});
    }
  }));
};

BzDeck.controllers.bugs.toggle_star = function (id, starred) {
  // Save in DB
  BzDeck.models.bugs.get(id).then(bug => {
    if (bug && bug.comments) {
      if (!bug._starred_comments) {
        bug._starred_comments = new Set();
      }

      if (starred) {
        bug._starred_comments.add(bug.comments[0].id);
      } else {
        bug._starred_comments.clear();
      }

      BzDeck.models.bugs.save(bug);
      FlareTail.util.event.trigger(window, 'Bug:StarToggled', { 'detail': { bug }});
    }
  });
};

BzDeck.controllers.bugs.toggle_unread = function (id, value) {
  // Save in DB
  BzDeck.models.bugs.get(id).then(bug => {
    if (bug && bug._unread !== value) {
      bug._unread = value;
      BzDeck.models.bugs.save(bug);
      FlareTail.util.event.trigger(window, 'Bug:UnreadToggled', { 'detail': { bug }});
    }
  });
};

BzDeck.controllers.bugs.is_starred = function (bug) {
  return !!bug._starred_comments && !!bug._starred_comments.size;
};

BzDeck.controllers.bugs.get_participants = function (bug) {
  let participants = new Map([[bug.creator, bug.creator_detail]]);

  if (bug.assigned_to && !participants.has(bug.assigned_to)) {
    participants.set(bug.assigned_to, bug.assigned_to_detail);
  }

  if (bug.qa_contact && !participants.has(bug.qa_contact)) {
    participants.set(bug.qa_contact, bug.qa_contact_detail);
  }

  for (let cc of bug.cc_detail || []) if (!participants.has(cc.name)) {
    participants.set(cc.name, cc);
  }

  for (let mentor of bug.mentors_detail || []) if (!participants.has(mentor.name)) {
    participants.set(mentor.name, mentor);
  }

  for (let c of bug.comments || []) if (!participants.has(c.creator)) {
    participants.set(c.creator, { 'name': c.creator });
  }

  for (let a of bug.attachments || []) if (!participants.has(a.creator)) {
    participants.set(a.creator, { 'name': a.creator });
  }

  for (let h of bug.history || []) if (!participants.has(h.who)) {
    participants.set(h.who, { 'name': h.who });
  }

  return participants;
};
