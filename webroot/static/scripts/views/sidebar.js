/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the Sidebar View that represents the global application sidebar.
 * @extends BzDeck.BaseView
 */
BzDeck.SidebarView = class SidebarView extends BzDeck.BaseView {
  /**
   * Get a SidebarView instance.
   * @constructor
   * @param {undefined}
   * @returns {Object} view - New SidebarView instance.
   * @fires SidebarView#FolderSelected
   * @fires SidebarView#AppMenuItemSelected
   */
  constructor () {
    super(); // Assign this.id

    let mobile = FlareTail.helpers.env.device.mobile;
    let $root = document.documentElement; // <html>
    let $sidebar = document.querySelector('#sidebar');

    $root.setAttribute('data-sidebar-hidden', mobile);
    $sidebar.setAttribute('aria-hidden', mobile);

    $sidebar.addEventListener('click', event => {
      if (mobile) {
        let hidden = $sidebar.getAttribute('aria-hidden') !== 'true';

        $root.setAttribute('data-sidebar-hidden', hidden);
        $sidebar.setAttribute('aria-hidden', hidden);
      }
    });

    new FlareTail.widgets.ScrollBar($sidebar.querySelector('div'));

    this.$folders = document.querySelector('#sidebar-folder-list');
    this.$$folders = new FlareTail.widgets.ListBox(this.$folders, BzDeck.config.folders);
    this.$$folders.view.members.forEach($option => $option.setAttribute('aria-label', $option.textContent));
    this.$$folders.bind('Selected', event => this.trigger('#FolderSelected', { id: event.detail.ids[0] }));

    this.on_safe('P#FolderOpened', data => this.open_folder(data.folder_id, data.bugs));
    this.on('P#UnreadToggled', data => this.toggle_unread(data.number));

    (new FlareTail.widgets.Button(document.querySelector('#main-menu--app--account'))).bind('Pressed', event => {
      this.trigger('#AppMenuItemSelected', { command: 'show-profile' });
    });

    this.$app_menu = document.querySelector('#main-menu--app-menu');
    this.$$app_menu = new FlareTail.widgets.Menu(this.$app_menu);

    this.$app_menu.addEventListener('MenuItemSelected', event => {
      this.trigger('#AppMenuItemSelected', { command: event.detail.command });
    });

    this.$app_menu.addEventListener('MenuClosed', event => {
      // Keep the menu open. Need a better way to handle this
      this.$app_menu.removeAttribute('aria-expanded');

      if (FlareTail.helpers.env.device.mobile) {
        // Hide the sidebar
        document.documentElement.setAttribute('data-sidebar-hidden', 'true');
        document.querySelector('#sidebar').setAttribute('aria-hidden', 'true');
      }
    });

    // Subscribe to events
    this.subscribe_safe('P#GravatarProfileFound');

    // Initiate the corresponding presenter
    this.presenter = BzDeck.presenters.sidebar = new BzDeck.SidebarPresenter(this.id);
  }

  /**
   * Open a specified folder by updating the document title and rendering the home page thread.
   * @listens SidebarPresenter#FolderOpened
   * @param {String} folder_id - One of the folder identifiers defined in the app config.
   * @param {Map.<Number, Proxy>} bugs - List of bugs to render.
   * @returns {undefined}
   */
  open_folder (folder_id, bugs) {
    let home = BzDeck.views.pages.home;
    let toolbar = BzDeck.views.banner;
    let folder_label = BzDeck.config.folders.find(f => f.data.id === folder_id).label;
    let unread = [...bugs.values()].filter(bug => bug.unread).length;

    home.update_title(folder_label + (unread > 0 ? ` (${unread})` : ''));
    home.thread.filter ? home.thread.filter(bugs) : home.thread.update(bugs);
    document.querySelector('#home-list-pane > footer').setAttribute('aria-hidden', !!bugs.size);

    // Mobile compact layout
    if (FlareTail.helpers.env.device.mobile &&
        toolbar.$$tablist.view.selected[0].id !== 'tab-home') {
      // Select the home tab
      toolbar.$$tablist.view.selected = toolbar.$$tablist.view.members[0];
    }
  }

  /**
   * Show the number of unread bugs on the Inbox option.
   * @listens SidebarPresenter#UnreadToggled
   * @param {Number} num - Number of unread bugs.
   * @returns {undefined}
   */
  toggle_unread (num) {
    let $label = document.querySelector('#sidebar-folders--inbox label');
    let $num = $label.querySelector('span');

    if (num) {
      $num = $num || $label.appendChild(document.createElement('span'));
      $num.textContent = num;
    } else if ($num) {
      $num.remove();
    }
  }

  /**
   * Set up the account label & avatar.
   * @listens SidebarPresenter#GravatarProfileFound
   * @param {Object} user - UserModel instance.
   * @returns {undefined}
   */
  on_gravatar_profile_found ({ user } = {}) {
    this.fill(document.querySelector('#main-menu--app--account label'), user);
    document.querySelector('#sidebar-account')
            .style.setProperty('background-image', user.background_image ? `url(${user.background_image})` : 'none');
  }
}
