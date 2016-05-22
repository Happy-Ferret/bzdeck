/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Initialize the Host Model that represents a remote Bugzilla instance. Available through the HostCollection.
 * @extends BzDeck.BaseModel
 */
BzDeck.HostModel = class HostModel extends BzDeck.BaseModel {
  /**
   * Get an BugModel instance.
   * @constructor
   * @param {Object} data - Host data.
   * @returns {Proxy} bug - New HostModel instance.
   */
  constructor (data) {
    super(); // This does nothing but is required before using `this`

    this.datasource = BzDeck.datasources.global;
    this.store_name = 'bugzilla';
    this.data = data;
    this.name = data.host;

    let config = BzDeck.config.hosts[this.name];

    // Extract the local config for easier access
    for (let [key, value] of Object.entries(config)) {
      this[key] = value;
    }
  }

  /**
   * Send an API request to the remote Bugzilla instance. Use a Worker on a different thread.
   * @param {String} path - Location including an API method.
   * @param {URLSearchParams} [params] - Search query.
   * @param {String} [method='GET'] - Request method.
   * @param {Object} [data] - Post data.
   * @param {String} [api_key] - API key used to authenticate against the Bugzilla API.
   * @param {Object.<String, Function>} [listeners] - Event listeners. The key is an event type like 'load', the
   *  value is the handler. If the type is 'progress' and the post data is set, it will called during the upload.
   * @returns {Promise.<Object>} response - Promise to be resolved in the raw bug object retrieved from Bugzilla.
   * @see {@link http://bugzilla.readthedocs.org/en/latest/api/core/v1/}
   */
  request (path, params, { method, data, api_key, listeners = {} } = {}) {
    if (!navigator.onLine) {
      return Promise.reject(new Error('You have to go online to load data.')); // l10n
    }

    let worker = new SharedWorker('/static/scripts/workers/tasks.js');
    let url = new URL(this.origin + this.endpoints.rest + path);
    let headers = new Map();

    method = method || (data ? 'POST' : 'GET');
    data = data ? Object.assign({}, data) : undefined; // Avoid DataCloneError by postMessage

    if (params) {
      url.search = params.toString();
    }

    headers.set('Content-Type', 'application/json');
    headers.set('Accept', 'application/json');
    headers.set('X-Bugzilla-API-Key', api_key || BzDeck.account.data.api_key);

    return new Promise((resolve, reject) => {
      worker.port.addEventListener('message', event => {
        let type = event.data.type;

        if (type === 'abort') {
          reject(new Error('Connection aborted.'));
        }

        if (type === 'error') {
          reject(new Error('Connection error.'));
        }

        if (type === 'load') {
          try {
            resolve(JSON.parse(event.data.response));
          } catch (ex) {
            reject(new Error('Data not found or not valid in the response.'));
          }
        }

        if (type in listeners) {
          listeners[type](event.data);
        }
      });

      worker.port.start();
      worker.port.postMessage(['xhr', { url: url.toString(), method, headers, data }]);
    });
  }

  /**
   * Get the Bugzilla configuration from cache. If it's not cached yet or older than 24 hours, retrieve the current
   * config from the remote Bugzilla instance. The config is not yet available from the REST endpoint so use the BzAPI
   * compat layer instead.
   * @param {undefined}
   * @returns {Promise.<Object>} config - Promise to be resolved in the Bugzilla configuration data.
   * @see {@link https://wiki.mozilla.org/Bugzilla:BzAPI:Methods#Other}
   * @see {@link https://bugzilla.mozilla.org/show_bug.cgi?id=504937}
   */
  get_config () {
    if (!navigator.onLine) {
      // Offline; give up
      return Promise.reject(new Error('You have to go online to load data.')); // l10n
    }

    if (this.data.config && new Date(this.data.config_retrieved || 0) > Date.now() - 1000 * 60 * 60 * 24) {
      // The config data is still fresh, retrieved within 24 hours
      return Promise.resolve(this.data.config);
    }

    let origin = this.endpoints.bzapi.startsWith('/') ? this.origin : '';

    // Fetch the config via BzAPI
    return this.helpers.network.json(`${origin}${this.endpoints.bzapi}configuration?cached_ok=1`).then(config => {
      if (config && config.version) {
        let config_retrieved = this.data.config_retrieved = Date.now();

        this.data.config = config;
        this.datasource.get_store(this.store_name).save({ host: this.name, config, config_retrieved });

        return Promise.resolve(config);
      }

      return Promise.reject(new Error('Bugzilla configuration could not be loaded. The retrieved data is collapsed.'));
    }).catch(error => {
      return Promise.reject(new Error('Bugzilla configuration could not be loaded. The instance might be offline.'));
    });
  }
}
