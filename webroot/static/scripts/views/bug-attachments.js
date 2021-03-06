/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the Bug Attachments View that represents the Attachment tabpanel content within a Bug Details tabpanel.
 * @extends BzDeck.BaseView
 */
BzDeck.BugAttachmentsView = class BugAttachmentsView extends BzDeck.BaseView {
  /**
   * Get a BugAttachmentsView instance.
   * @param {String} id - Unique instance identifier shared with the parent view.
   * @param {Number} bug_id - Corresponding bug ID.
   * @param {HTMLElement} $container - Container node to render the attachments.
   * @fires BugView#AttachmentSelected
   * @returns {BugAttachmentsView} New BugAttachmentsView instance.
   */
  constructor (id, bug_id, $container) {
    super(id); // Assign this.id

    const mobile = FlareTail.env.device.mobile;
    const mql = window.matchMedia('(max-width: 1023px)');

    this.bug_id = bug_id;
    this.attachments = new Map();

    this.$container = $container;
    this.$bug = this.$container.closest('[itemtype$="Bug"]');
    this.$title = this.$container.querySelector('h4');
    this.$listbox = this.$container.querySelector('[role="listbox"]');
    this.$obsolete_checkbox = this.$container.querySelector('.list [role="checkbox"]');

    for (const $attachment of this.$container.querySelectorAll('[itemprop="attachment"]')) {
      $attachment.remove();
    }

    this.$$listbox = new FlareTail.widgets.ListBox(this.$listbox, []);
    this.$$listbox.bind('click', event => this.listbox_onclick(event));
    this.$$listbox.bind('dblclick', event => this.listbox_onclick(event));

    this.$$listbox.bind('Selected', event => {
      const $target = event.detail.items[0];

      if (!$target || mobile && mql.matches) {
        return;
      }

      const attachment = this.attachments.get($target.dataset.hash || Number($target.dataset.id));
      const $attachment = this.$container.querySelector('.content');

      new FlareTail.widgets.ScrollBar($attachment);
      new BzDeck.AttachmentView(this.id, attachment.id, $attachment);

      this.trigger('BugView#AttachmentSelected', { id: attachment.id });
    });

    this.$$obsolete_checkbox = new FlareTail.widgets.CheckBox(this.$obsolete_checkbox);

    this.$$obsolete_checkbox.bind('Toggled', event => {
      const checked = event.detail.checked;

      for (const $att of this.$listbox.querySelectorAll('[role="option"]')) {
        $att.setAttribute('aria-hidden', checked ? 'false' : $att.querySelector('[itemprop="is_obsolete"]').content);
      }

      this.$$listbox.update_members();
    });

    this.init_uploader();

    // Subscribe to events
    this.subscribe('BugModel#AttachmentAdded', true);
    this.subscribe('BugModel#AttachmentRemoved', true);
    this.subscribe('BugModel#AttachmentEdited', true);
    this.subscribe('BugModel#UploadListUpdated', true);
    this.subscribe('BugPresenter#HistoryUpdated');
  }

  /**
   * Render the provided attachments.
   * @param {Array.<Proxy>} attachments - Attachment list of the bug.
   */
  async render (attachments) {
    const $listitem = this.get_template('details-attachment-listitem');

    attachments.reverse(); // The newest attachment should be on the top of the list

    const creators = await Promise.all(attachments.map(att => {
      return BzDeck.collections.users.get(att.creator, { name: att.creator });
    }));

    attachments.forEach((att, index) => {
      this.attachments.set(att.id || att.hash, att);

      this.$listbox.prepend(this.fill($listitem.cloneNode(true), {
        id: att.hash ? att.hash.substr(0, 7) : att.id,
        summary: att.summary,
        last_change_time: att.last_change_time,
        creator: creators[index].properties,
        content_type: att.content_type,
        is_patch: !!att.is_patch,
        is_obsolete: !!att.is_obsolete,
        is_unuploaded: !!att.is_unuploaded,
      }, {
        id: `bug-${this.bug_id}-attachment-${att.hash ? att.hash.substr(0, 7) : att.id}`,
        'aria-hidden': !!att.is_obsolete,
        'data-id': att.id,
        'data-hash': att.hash,
      }));
    });

    const has_obsolete = [...this.attachments.values()].some(a => !!a.is_obsolete);

    this.update_list_title();
    this.$obsolete_checkbox.setAttribute('aria-hidden', !has_obsolete);
    this.$listbox.dispatchEvent(new CustomEvent('Rendered'));
    this.$$listbox.update_members();
  }

  /**
   * Called whenever the attachment list is clicked.
   * @param {MouseEvent} event - click or dblclick.
   * @fires AnyView#OpeningAttachmentRequested
   */
  listbox_onclick (event) {
    const $selected = this.$$listbox.view.selected[0];
    const id = $selected ? $selected.dataset.hash || Number($selected.dataset.id) : undefined;
    const mobile = FlareTail.env.device.mobile;
    const narrow = window.matchMedia('(max-width: 1023px)').matches;

    if (id && ((event.type === 'click' && mobile && narrow) || event.type === 'dblclick')) {
      this.trigger('AnyView#OpeningAttachmentRequested', { id });
    }
  }

  /**
   * Initialize the attachment uploading interface. This offers Add/Remove buttons as well as the drag-and-drop support.
   * @fires BugView#AttachText
   * @fires BugView#RemoveAttachment
   */
  init_uploader () {
    // Notify BugView once files are selected
    const on_select = input => this.$bug.dispatchEvent(new CustomEvent('FilesSelected', { detail: { input }}));

    this.$drop_target = this.$container.querySelector('[aria-dropeffect]');
    this.$add_button = this.$container.querySelector('[data-command="add-attachment"]');
    this.$remove_button = this.$container.querySelector('[data-command="remove-attachment"]');
    this.$file_picker = this.$container.querySelector('input[type="file"]');

    new FlareTail.widgets.Button(this.$add_button);
    new FlareTail.widgets.Button(this.$remove_button);

    this.$drop_target.addEventListener('dragover', event => {
      this.$drop_target.setAttribute('aria-dropeffect', 'copy');
      event.dataTransfer.dropEffect = event.dataTransfer.effectAllowed = 'copy';
      event.preventDefault();
    });

    this.$drop_target.addEventListener('dragleave', event => {
      this.$drop_target.setAttribute('aria-dropeffect', 'none');
      event.preventDefault();
    });

    this.$drop_target.addEventListener('drop', event => {
      const dt = event.dataTransfer;

      if (dt.types.includes('Files')) {
        on_select(dt);
      } else if (dt.types.includes('text/plain')) {
        this.trigger('BugView#AttachText', { text: dt.getData('text/plain') });
      }

      this.$drop_target.setAttribute('aria-dropeffect', 'none');
      event.preventDefault();
    });

    this.$$listbox.bind('Selected', event => {
      const $selected = this.$$listbox.view.selected[0];
      const hash = $selected ? $selected.dataset.hash : undefined;

      this.$remove_button.setAttribute('aria-disabled', !hash);
    });

    this.$$listbox.assign_key_bindings({
      'Backspace': event => {
        const $selected = this.$$listbox.view.selected[0];
        const hash = $selected ? $selected.dataset.hash : undefined;

        if (hash) {
          this.trigger('BugView#RemoveAttachment', { hash });
          this.$remove_button.setAttribute('aria-disabled', 'true');
        }
      },
    });

    const can_choose_dir = this.$file_picker.isFilesAndDirectoriesSupported === false;

    if (can_choose_dir) {
      this.$add_button.title = 'Add attachments... (Shift+Click to choose directory)'; // l10n
    }

    this.$add_button.addEventListener('click', event => {
      can_choose_dir && event.shiftKey ? this.$file_picker.chooseDirectory() : this.$file_picker.click();
    });

    this.$remove_button.addEventListener('mousedown', event => {
      this.trigger('BugView#RemoveAttachment', { hash: this.$$listbox.view.selected[0].dataset.hash });
      this.$remove_button.setAttribute('aria-disabled', 'true');
    });

    this.$file_picker.addEventListener('change', event => {
      on_select(event.target);
    });
  }

  /**
   * Called whenever a new attachment is added by the user. Add the item to the listbox.
   * @listens BugModel#AttachmentAdded
   * @param {Number} bug_id - Corresponding bug ID.
   * @param {Number} id - Added attachment's ID.
   */
  async on_attachment_added ({ bug_id, id } = {}) {
    if (bug_id !== this.bug_id) {
      return;
    }

    const attachment = await BzDeck.collections.attachments.get(id);

    this.attachments.set(attachment.hash, attachment);
    this.render([attachment]);
  }

  /**
   * Called whenever a new attachment is removed by the user. Remove the item from the listbox.
   * @listens BugModel#AttachmentRemoved
   * @param {Number} bug_id - Changed bug ID.
   * @param {String} hash - Removed attachment's hash value in the cached list.
   */
  on_attachment_removed ({ bug_id, hash } = {}) {
    if (bug_id !== this.bug_id) {
      return;
    }

    this.attachments.delete(hash);
    this.$listbox.querySelector(`[data-hash='${hash}']`).remove();
    this.$listbox.dispatchEvent(new CustomEvent('Rendered'));
    this.$$listbox.update_members();
  }

  /**
   * Called whenever a new attachment is edited by the user. Update the item on the listbox.
   * @listens BugModel#AttachmentEdited
   * @param {Number} bug_id - Changed bug ID.
   * @param {Number} id - Numeric ID for an existing attachment or undefined for an unuploaded one.
   * @param {String} hash - Hash value for an unuploaded attachment or undefined for an existing one.
   * @param {String} prop - Edited property name.
   * @param {*} value - New value.
   */
  on_attachment_edited ({ bug_id, id, hash, prop, value } = {}) {
    if (bug_id !== this.bug_id) {
      return;
    }

    const $item = this.$listbox.querySelector(`[data-${hash ? 'hash' : 'id'}='${hash || id}']`);

    if (['summary', 'content_type'].includes(prop)) {
      $item.querySelector(`[itemprop="${prop}"]`).textContent = value;
    }

    if (['is_patch', 'is_obsolete'].includes(prop)) {
      $item.querySelector(`[itemprop="${prop}"]`).content = value;
    }
  }

  /**
   * Called whenever a new attachment is added or removed by the user. Update the list header title.
   * @listens BugModel#UploadListUpdated
   * @param {Number} bug_id - Changed bug ID.
   * @param {Array.<Proxy>} uploads - List of the new attachments in Array-like object.
   */
  on_upload_list_updated ({ bug_id, uploads } = {}) {
    if (bug_id !== this.bug_id) {
      return;
    }

    this.update_list_title();
  }

  /**
   * Update the list header title, showing the number of the attachments including unuploaded ones.
   */
  update_list_title () {
    const total = this.attachments.size;
    const uploads = [...this.attachments.values()].filter(att => att.is_unuploaded).length;
    let text = total === 1 ? '1 attachment' : `${total} attachments`; // l10n

    if (uploads > 0) {
      text += ' ' + `(${uploads} unuploaded)`; // l10n
    }

    this.$title.textContent = text;
  }

  /**
   * Called whenever the navigation history state is updated. If a valid attachment ID is specified, select that item on
   * the listbox.
   * @listens BugPresenter#HistoryUpdated
   * @param {Object} [state] - Current history state.
   * @param {String} [state.att_id] - Attachment ID or hash.
   */
  on_history_updated ({ state } = {}) {
    const target_id = state ? state.att_id : undefined;
    const $target = target_id ? this.$listbox.querySelector(`[id$='attachment-${target_id}']`) : undefined;

    if ($target && !FlareTail.env.device.mobile && !window.matchMedia('(max-width: 1023px)').matches) {
      if ($target.matches('[data-obsolete="true"]') && !this.$$obsolete_checkbox.checked) {
        this.$obsolete_checkbox.click();
      }

      this.$$listbox.view.selected = this.$$listbox.view.focused = $target;
    }
  }
}
