/**
 * BzDeck Search Page
 * Copyright © 2014 Kohei Yoshino. All rights reserved.
 */

'use strict';

let BzDeck = BzDeck || {};

BzDeck.SearchPage = function () {
  let tablist = BzDeck.toolbar.tablist,
      $template = document.querySelector('template#tabpanel-search'),
      $content = ($template.content || $template).cloneNode(true),
      id_suffix = this.id = Date.now();

  // Assign unique IDs
  for (let $element of $content.querySelectorAll('[id]')) {
    $element.id = $element.id.replace(/TID/, id_suffix);
  }

  this.view = {
    $tabpanel: $content.querySelector('[role="tabpanel"]'),
    buttons: {},
    panes: {}
  };

  this.data = new Proxy({
    bug_list: [],
    preview_id: null
  },
  {
    get: function (obj, prop) {
      if (prop === 'bug_list') {
        // Return a sorted bug list
        let bugs = {};

        for (let bug of obj[prop]) {
          bugs[bug.id] = bug;
        }

        return [bugs[row.data.id] for (row of this.view.grid.data.rows)];
      }

      return obj[prop];
    }.bind(this),
    set: function (obj, prop, newval) {
      let oldval = obj[prop];

      if (oldval === newval) {
        return;
      }

      if (prop === 'preview_id' && !FlareTail.util.device.mobile.mql.matches) {
        FlareTail.util.event.async(function () {
          this.show_preview(oldval, newval);
        }.bind(this));
      }

      obj[prop] = newval;
    }.bind(this)
  });

  let $tab = tablist.add_tab(
    'search-' + id_suffix,
    'Search', // l10n
    'Search & Browse Bugs', // l10n
    this.view.$tabpanel
  );

  this.setup_basic_search_pane();
  this.setup_result_pane();
  this.setup_preview_pane();
  this.setup_toolbar();

  tablist.view.selected = tablist.view.$focused = $tab;
  this.view.$tabpanel.focus();
};

BzDeck.SearchPage.prototype.setup_toolbar = function () {
  let buttons = this.view.buttons,
      panes = this.view.panes;

  let handler = function (event) {
    switch (event.target.dataset.command) {
      case 'show-details': {
        BzDeck.detailspage = new BzDeck.DetailsPage(this.data.preview_id, this.data.bug_list);
        break;
      }

      case 'show-basic-search-pane': {
        panes['basic-search'].setAttribute('aria-hidden', 'false');
        panes['preview'].setAttribute('aria-hidden', 'true');
        buttons['show-details'].data.disabled = true;
        buttons['show-basic-search-pane'].data.disabled = true;
        break;
      }
    }
  }.bind(this);

  for (let $button of this.view.$tabpanel.querySelectorAll('footer [role="button"]')) {
    let button = buttons[$button.dataset.command] = new FlareTail.widget.Button($button);
    button.bind('Pressed', handler);
  }
};

BzDeck.SearchPage.prototype.setup_basic_search_pane = function () {
  let $pane = this.view.panes['basic-search']
            = this.view.$tabpanel.querySelector('[id$="-basic-search-pane"]'),
      config = BzDeck.data.bugzilla_config;

  // Custom scrollbar
  for (let $outer of $pane.querySelectorAll('[id$="-list-outer"]')) {
    new FlareTail.widget.ScrollBar($outer, true);
  }

  let $classification_list = $pane.querySelector('[id$="-browse-classification-list"]'),
      $product_list = $pane.querySelector('[id$="-browse-product-list"]'),
      $component_list = $pane.querySelector('[id$="-browse-component-list"]'),
      $status_list = $pane.querySelector('[id$="-browse-status-list"]'),
      $resolution_list = $pane.querySelector('[id$="-browse-resolution-list"]');

  let classifications = Object.keys(config.classification).sort().map(function (value, index) {
    return {
      id: $classification_list.id + 'item-' + index,
      label: value
    };
  });

  let products = Object.keys(config.product).sort().map(function (value, index) {
    return {
      id: $product_list.id + 'item-' + index,
      label: value
    };
  });

  let components = [];

  for (let [key, { component: cs }] of Iterator(config.product)) {
    components.push.apply(components,
                          [c for (c of Object.keys(cs)) if (components.indexOf(c) === -1)]);
    // Fx27: components.push(...[c for (c of Object.keys(cs)) if (components.indexOf(c) === -1)]);
  }

  components = components.sort().map(function (value, index) {
    return {
      id: $component_list.id + 'item-' + index,
      label: value
    };
  });

  let statuses = config.field.status.values.map(function (value, index) {
    return {
      id: $status_list.id + 'item-' + index,
      label: value
    };
  });

  let resolutions = config.field.resolution.values.map(function (value, index) {
    return {
      id: $resolution_list.id + 'item-' + index,
      label: value || '---',
      selected: !value // Select '---' to search open bugs
    };
  });

  let ListBox = FlareTail.widget.ListBox,
      classification_list = new ListBox($classification_list, classifications),
      product_list = new ListBox($product_list, products),
      component_list = new ListBox($component_list, components),
      status_list = new ListBox($status_list, statuses),
      resolution_list = new ListBox($resolution_list, resolutions);

  classification_list.bind('Selected', function (event) {
    let products = [],
        components = [];

    for (let $option of $classification_list.querySelectorAll('[aria-selected="true"]')) {
      products.push.apply(products, config.classification[$option.textContent].products);
      // Fx27: products.push(...config.classification[$option.textContent].products);
    }

    for (let product of products) {
      components.push.apply(components, Object.keys(config.product[product].component));
      // Fx27: components.push(...Object.keys(config.product[product].component));
    }

    // Narrow down the product list
    for (let $option of $product_list.querySelectorAll('[role="option"]')) {
      $option.setAttribute('aria-selected', 'false');
      $option.setAttribute('aria-disabled',
                           products.length && products.indexOf($option.textContent) === -1);
    }

    // Narrow down the component list
    for (let $option of $component_list.querySelectorAll('[role="option"]')) {
      $option.setAttribute('aria-selected', 'false');
      $option.setAttribute('aria-disabled',
                           components.length && components.indexOf($option.textContent) === -1);
    }
  });

  product_list.bind('Selected', function (event) {
    let components = [];

    for (let $option of $product_list.querySelectorAll('[aria-selected="true"]')) {
      components.push.apply(components, Object.keys(config.product[$option.textContent].component));
      // Fx27: components.push(...Object.keys(config.product[$option.textContent].component));
    }

    // Narrow down the component list
    for (let $option of $component_list.querySelectorAll('[role="option"]')) {
      $option.setAttribute('aria-selected', 'false');
      $option.setAttribute('aria-disabled',
                           components.length && components.indexOf($option.textContent) === -1);
    }
  });

  let $textbox = $pane.querySelector('.text-box [role="textbox"]'),
      button = new FlareTail.widget.Button($pane.querySelector('.text-box [role="button"]'));

  button.bind('Pressed', function (event) {
    let query = {},
        map = {
          classification: $classification_list,
          product: $product_list,
          component: $component_list,
          status: $status_list,
          resolution: $resolution_list
        };

    for (let [name, list] of Iterator(map)) {
      let values = [$opt.textContent for ($opt of list.querySelectorAll('[aria-selected="true"]'))];

      if (values.length) {
        query[name] = values;
      }
    }

    if ($textbox.value) {
      query['summary'] = $textbox.value;
      query['summary_type'] = 'contains_all';
    }

    this.exec_search(query);
  }.bind(this));
};

BzDeck.SearchPage.prototype.setup_result_pane = function () {
  let $pane = this.view.panes['result']
            = this.view.$tabpanel.querySelector('[id$="-result-pane"]'),
      $grid = $pane.querySelector('[role="grid"]'),
      mobile_mql = FlareTail.util.device.mobile.mql,
      prefs = BzDeck.data.prefs,
      columns = prefs['search.list.columns'] || BzDeck.options.grid.default_columns,
      field = BzDeck.data.bugzilla_config.field;

  let grid = this.view.grid = new FlareTail.widget.Grid($grid, {
    rows: [],
    columns: columns.map(function (col) {
      // Add labels
      switch (col.id) {
        case '_starred': {
          col.label = 'Starred';
          break;
        }

        case '_unread': {
          col.label = 'Unread';
          break;
        }

        default: {
          col.label = field[col.id].description;
        }
      }

      return col;
    })
  },
  {
    sortable: true,
    reorderable: true,
    sort_conditions: (mobile_mql.matches) ? { key: 'last_change_time', order: 'descending' }
                                          : prefs['home.list.sort_conditions'] ||
                                            { key: 'id', order: 'ascending' }
  });

  // Force to change the sort condition when switched to the mobile layout
  mobile_mql.addListener(function (mql) {
    if (mql.matches) {
      let cond = grid.options.sort_conditions;
      cond.key = 'last_change_time';
      cond.order = 'descending';
    }
  });

  grid.bind('Sorted', function (event) {
    prefs['search.list.sort_conditions'] = event.detail.conditions;
  });

  grid.bind('ColumnModified', function (event) {
    prefs['search.list.columns'] = event.detail.columns.map(function (col) {
      return {
        id: col.id,
        type: col.type || 'string',
        hidden: col.hidden || false
      };
    });
  });

  grid.bind('Selected', function (event) {
    let ids = event.detail.ids;

    if (ids.length) {
      // Show Bug in Preview Pane
      this.data.preview_id = parseInt(ids[ids.length - 1]);

      // Mobile compact layout
      if (mobile_mql.matches) {
        new BzDeck.DetailsPage(this.data.preview_id, this.data.bug_list);
      }
    }
  }.bind(this));

  grid.bind('dblclick', function (event) {
    let $target = event.originalTarget;

    if ($target.mozMatchesSelector('[role="row"]')) {
      // Open Bug in New Tab
      BzDeck.detailspage = new BzDeck.DetailsPage(parseInt($target.dataset.id), this.data.bug_list);
    }
  }.bind(this));

  grid.bind('keydown', function (event) {
    let modifiers = event.shiftKey || event.ctrlKey || event.metaKey || event.altKey,
        data = this.view.grid.data,
        view = this.view.grid.view,
        members = view.members,
        index = members.indexOf(view.$focused);

    // [B] Select previous bug
    if (!modifiers && event.keyCode === event.DOM_VK_B && index > 0) {
      view.selected = view.$focused = members[index - 1];
    }

    // [F] Select next bug
    if (!modifiers && event.keyCode === event.DOM_VK_F && index < members.length - 1) {
      view.selected = view.$focused = members[index + 1];
    }

    // [M] toggle read
    if (!modifiers && event.keyCode === event.DOM_VK_M) {
      for (let $item of view.selected) {
        let _data = data.rows[$item.sectionRowIndex].data;
        _data._unread = _data._unread !== true;
      }
    }

    // [S] toggle star
    if (!modifiers && event.keyCode === event.DOM_VK_S) {
      for (let $item of view.selected) {
        let _data = data.rows[$item.sectionRowIndex].data;
        _data._starred = _data._starred !== true;
      }
    }
  }.bind(this), true); // use capture

  $pane.addEventListener('transitionend', function (event) {
    let selected = this.view.grid.view.selected;

    if (event.propertyName === 'bottom' && selected.length) {
      this.view.grid.ensure_row_visibility(selected[selected.length - 1]);
    }
  }.bind(this));
};

BzDeck.SearchPage.prototype.setup_preview_pane = function () {
  let ScrollBar = FlareTail.widget.ScrollBar,
      $pane = this.view.panes['preview']
            = this.view.$tabpanel.querySelector('[id$="-preview-pane"]');

  // Custom scrollbar
  new ScrollBar($pane.querySelector('[id$="-bug-info"]'));
  new ScrollBar($pane.querySelector('[id$="-bug-timeline"]'));
};

BzDeck.SearchPage.prototype.show_preview = function (oldval, newval) {
  let $pane = this.view.panes['preview'],
      $template = $pane.querySelector('[id$="-preview-bug"]');

  if (!newval) {
    $template.setAttribute('aria-hidden', 'true');
    return;
  }

  BzDeck.model.get_bug_by_id(newval, function (bug) {
    if (!bug) {
      // Unknown bug
      $template.setAttribute('aria-hidden', 'true');
      return;
    }

    // Show the preview pane
    if ($pane.mozMatchesSelector('[aria-hidden="true"]')) {
      BzDeck.global.show_status('');
      this.view.panes['basic-search'].setAttribute('aria-hidden', 'true');
      $pane.setAttribute('aria-hidden', 'false');
      this.view.buttons['show-details'].data.disabled = false;
      this.view.buttons['show-basic-search-pane'].data.disabled = false;
    }

    // Fill the content
    BzDeck.global.fill_template($template, bug);
    $template.setAttribute('aria-hidden', 'false');
  }.bind(this));
};

BzDeck.SearchPage.prototype.exec_search = function (query) {
  if (!navigator.onLine) {
    BzDeck.global.show_status('You have to go online to search bugs.'); // l10n
    return;
  }

  // Specify fields
  query['include_fields'] = BzDeck.options.api.default_fields.join();
  query = FlareTail.util.request.build_query(query);

  BzDeck.global.show_status('Loading...'); // l10n

  FlareTail.util.event.async(function () {
    BzDeck.global.update_grid_data(this.view.grid, []); // Clear grid body
  }.bind(this));

  let $grid_body = this.view.panes['result'].querySelector('[class="grid-body"]')
  $grid_body.setAttribute('aria-busy', 'true');

  BzDeck.core.request('GET', 'bug' + query, function (data) {
    if (!data || !Array.isArray(data.bugs)) {
      $grid_body.removeAttribute('aria-busy');
      BzDeck.global.show_status('ERROR: Failed to load data.'); // l10n

      return;
    }

    let num = data.bugs.length,
        status = '';

    if (num > 0) {
      this.data.bug_list = data.bugs;

      // Save data
      BzDeck.model.get_all_bugs(function (bugs) {
        let saved_ids = new Set([id for ({ id } of bugs)]);
        BzDeck.model.save_bugs([bug for (bug of data.bugs) if (!saved_ids.has(bug.id))]);
      });

      // Show results
      FlareTail.util.event.async(function () {
        BzDeck.global.update_grid_data(this.view.grid, data.bugs);
      }.bind(this));

      status = (num > 1) ? '%d bugs found.'.replace('%d', num) : '1 bug found.'; // l10n
    } else {
      status = 'Zarro Boogs found.'; // l10n
    }

    $grid_body.removeAttribute('aria-busy');
    BzDeck.global.show_status(status);
  }.bind(this));
};