/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the Bug Details View that represents the content displayed on the Bug Details page.
 * @extends BzDeck.BugView
 */
BzDeck.BugDetailsView = class BugDetailsView extends BzDeck.BugView {
  /**
   * Get a BugDetailsView instance.
   * @constructor
   * @param {String} view_id - Instance identifier. It should be the same as the BugController instance, otherwise the
   *  relevant notification events won't work.
   * @param {Proxy} bug - Proxified BugModel instance.
   * @param {HTMLElement} $bug - Outer element to display the content.
   * @returns {Object} view - New BugDetailsView instance.
   */
  constructor (view_id, bug, $bug) {
    super(view_id, bug, $bug, true);

    let mql = window.matchMedia('(max-width: 1023px)');

    this.$tablist = this.$bug.querySelector('[role="tablist"]');
    this.$att_tab = this.$tablist.querySelector('[id$="-tab-attachments"]');
    this.$$tablist = new this.widgets.TabList(this.$tablist);
    this.$outline = this.$bug.querySelector('.bug-outline');

    this.$tablist.querySelector('[id$="history"]').setAttribute('aria-disabled', !(this.bug.history || []).length);

    this.$$tablist.bind('Selected', event => {
      let $selected = event.detail.items[0];
      let $tabpanel = this.$bug.querySelector(`#${$selected.getAttribute('aria-controls')}`);

      // Scroll a tabpanel to top when the tab is selected
      $tabpanel.querySelector('.scrollable').scrollTop = 0;

      // Desktop: Show the outline pane only when the timeline tab is selected
      if (!mql.matches && this.helpers.env.device.desktop) {
        this.$outline.setAttribute('aria-hidden', !$selected.matches('[id$="tab-timeline"]'));
      }
    });

    this.subscribe('BugController:HistoryUpdated');

    // Call BzDeck.BugView.prototype.init
    this.init();

    mql.addListener(mql => this.change_layout(mql));
    this.change_layout(mql);

    if (this.helpers.env.device.mobile) {
      this.add_mobile_tweaks();
    }
  }

  /**
   * Change the page layout by moving some elements, depending on the viewport.
   * @param {MediaQueryList} mql - Detecting the current viewport.
   * @returns {undefined}
   */
  change_layout (mql) {
    let $info_tab = this.$bug.querySelector('[id$="-tab-info"]');
    let $participants_tab = this.$bug.querySelector('[id$="-tab-participants"]');
    let $timeline_tab = this.$bug.querySelector('[id$="-tab-timeline"]');
    let $bug_info = this.$bug.querySelector('.bug-info');
    let $bug_participants = this.$bug.querySelector('.bug-participants');

    if (mql.matches || this.helpers.env.device.mobile) {  // Mobile layout
      $info_tab.setAttribute('aria-hidden', 'false');
      $participants_tab.setAttribute('aria-hidden', 'false');
      this.$bug.querySelector('[id$="-tabpanel-info"]').appendChild($bug_info);
      this.$bug.querySelector('[id$="-tabpanel-participants"]').appendChild($bug_participants);
    } else {
      if ([$info_tab, $participants_tab].includes(this.$$tablist.view.selected[0])) {
        this.$$tablist.view.selected = this.$$tablist.view.$focused = $timeline_tab;
      }

      $info_tab.setAttribute('aria-hidden', 'true');
      $participants_tab.setAttribute('aria-hidden', 'true');
      this.$outline.appendChild($bug_info);
      this.$outline.appendChild($bug_participants);
      this.$tablist.removeAttribute('aria-hidden');
    }
  }

  /**
   * Add a UI gimmick for mobile that hides the tabs when scrolled down.
   * @param {undefined}
   * @returns {undefined}
   */
  add_mobile_tweaks () {
    let mql = window.matchMedia('(max-width: 1023px)');

    for (let $content of this.$bug.querySelectorAll('.scrollable')) {
      let info = $content.matches('.bug-info');
          top = 0,
          hidden = false;

      $content.addEventListener('scroll', event => {
        if (!mql.matches && info) {
          return;
        }

        let _top = event.target.scrollTop;
        let _hidden = top < _top;

        if (hidden !== _hidden) {
          hidden = _hidden;
          this.$tablist.setAttribute('aria-hidden', hidden);
        }

        top = _top;
      });
    }
  }

  /**
   * Add the number of the comments, attachments and history entries to the each relevant tab as a small badge.
   * @param {undefined}
   * @returns {undefined}
   */
  add_tab_badges () {
    for (let prop of ['comments', 'attachments', 'history']) {
      let tab_name = prop === 'comments' ? 'timeline' : prop;
      let number = (this.bug[prop] || []).length;

      this.$tablist.querySelector(`[id$="tab-${tab_name}"] label`).dataset.badge = number;
    }
  }

  /**
   * Render the Tracking Flags section on the bug info pane.
   * @param {undefined}
   * @returns {undefined}
   */
  render_tracking_flags () {
    let config = BzDeck.host.data.config;
    let $outer = this.$bug.querySelector('[data-category="tracking-flags"]');
    let $flag = this.get_template('details-tracking-flag');
    let $fragment = new DocumentFragment();

    for (let name of Object.keys(this.bug.data).sort()) {
      let field = config.field[name];
      let value = this.bug.data[name];

      // Check the flag type, 99 is for project flags or tracking flags on bugzilla.mozilla.org
      if (!name.startsWith('cf_') || !field || !field.is_active || field.type !== 99) {
        continue;
      }

      $fragment.appendChild(this.fill($flag.cloneNode(true), {
        name: field.description,
        value,
      }, {
        'aria-label': field.description,
        'data-field': name,
        'data-has-value': value !== '---',
      }));
    }

    $outer.appendChild($fragment);
  }

  /**
   * Render the Attachments tabpanel content with BugAttachmentsView.
   * @param {undefined}
   * @returns {undefined}
   */
  render_attachments () {
    let mobile = this.helpers.env.device.mobile;
    let mql = window.matchMedia('(max-width: 1023px)');
    let $field = this.$bug.querySelector('[data-field="attachments"]');

    this.$$attachments = new BzDeck.BugAttachmentsView(this.id, this.bug.id, $field);

    if ((this.bug.attachments || []).length) {
      Promise.all(this.bug.attachments.map(att => BzDeck.collections.attachments.get(att.id))).then(attachments => {
        this.$$attachments.render(attachments);
      });
    }

    // Select the first non-obsolete attachment when the Attachment tab is selected for the first time
    this.$$tablist.bind('Selected', event => {
      if (mobile || mql.matches || event.detail.items[0] !== this.$att_tab ||
          this.$$attachments.$listbox.querySelector('[role="option"][aria-selected="true"]')) { // Already selected
        return;
      }

      let $first = this.$$attachments.$listbox.querySelector('[role="option"][aria-disabled="false"]');

      if ($first) {
        this.$$attachments.$$listbox.view.selected = $first;
      }
    });
  }

  /**
   * Render the History tabpanel content with BugHistoryView.
   * @param {undefined}
   * @returns {undefined}
   */
  render_history () {
    let $tab = this.$tablist.querySelector('[id$="-tab-history"]');

    this.$$history = new BzDeck.BugHistoryView(this.id, this.$bug.querySelector('[data-field="history"]'));

    if ((this.bug.history || []).length) {
      this.$$history.render(this.bug.history);
      $tab.setAttribute('aria-disabled', 'false');
    }
  }

  /**
   * Called whenever the location fragment or history state is updated. Switch the tabs when an attachment is selected
   * on the timeline or comment form.
   * @listens BugController:HistoryUpdated
   * @param {Object} [state] - Current history state.
   * @param {String} [state.att_id] - Attachment ID or hash.
   * @returns {undefined}
   */
  on_history_updated ({ state } = {}) {
    if (data.state && data.state.att_id) {
      this.$$tablist.view.selected = this.$$tablist.view.$focused = this.$att_tab;
    }
  }
}
