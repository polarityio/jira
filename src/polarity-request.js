const fs = require('fs');
const { version: packageVersion } = require('../package.json');
const request = require('postman-request');
const { getLogger } = require('./logger');
const { NetworkError } = require('./errors');

const USER_AGENT = `isc-polarity-integration-v${packageVersion}`;

const {
  request: { ca, cert, key, passphrase, rejectUnauthorized, proxy }
} = require('../config/config.js');

const _configFieldIsValid = (field) => typeof field === 'string' && field.length > 0;

const defaults = {
  ...(_configFieldIsValid(ca) && { ca: fs.readFileSync(ca) }),
  ...(_configFieldIsValid(cert) && { cert: fs.readFileSync(cert) }),
  ...(_configFieldIsValid(key) && { key: fs.readFileSync }),
  ...(_configFieldIsValid(passphrase) && { passphrase }),
  ...(_configFieldIsValid(proxy) && { proxy }),
  ...(typeof rejectUnauthorized === 'boolean' && { rejectUnauthorized }),
  json: true,
  headers: {
    'User-Agent': USER_AGENT
  }
};

function unixEpochTimeInSeconds() {
  return Math.floor(Date.now() / 1000);
}

/**
 *
 */
class PolarityRequest {
  constructor() {
    this.requestWithDefaults = request.defaults(defaults);
  }

  async request(requestOptions, userOptions) {
    return new Promise(async (resolve, reject) => {
      requestOptions = {
        ...requestOptions,
        // Warning for future, this will override existing headers
        // currently we don't use any additional headers
        ...this.getAuthRequestOptions(userOptions),
        json: true
      };
      this.requestWithDefaults(requestOptions, (err, response) => {
        if (err) {
          return reject(
            new NetworkError('Unable to complete network request', {
              cause: err,
              requestOptions
            })
          );
        }
        resolve(response);
      });
    });
  }

  getAuthRequestOptions(options) {
    if (options.userName && options.apiKey) {
      // If a userName and apiKey are provided then we are authenticating to Jira Cloud
      return {
        auth: {
          username: options.userName,
          password: options.apiKey
        }
      };
    } else if (options.apiKey) {
      // if just an apiKey is provided then we are authenticating to Jira Server
      return {
        headers: {
          Authorization: `Bearer ${options.apiKey}`
        }
      };
    }
  }
}

module.exports = new PolarityRequest();
