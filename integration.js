'use strict';
let request = require('request');
let _ = require('lodash');
let { replace, filter, includes, split, join, compact, flow, get, toLower } = require('lodash/fp');
let async = require('async');
let config = require('./config/config');
let util = require('util');
let log = null;
let requestWithDefaults;

function startup(logger) {
  log = logger;
  let defaults = {};
  if (typeof config.request.cert === 'string' && config.request.cert.length > 0) {
    defaults.cert = fs.readFileSync(config.request.cert);
  }
  if (typeof config.request.key === 'string' && config.request.key.length > 0) {
    defaults.key = fs.readFileSync(config.request.key);
  }
  if (typeof config.request.passphrase === 'string' && config.request.passphrase.length > 0) {
    defaults.passphrase = config.request.passphrase;
  }
  if (typeof config.request.ca === 'string' && config.request.ca.length > 0) {
    defaults.ca = fs.readFileSync(config.request.ca);
  }
  if (typeof config.request.proxy === 'string' && config.request.proxy.length > 0) {
    defaults.proxy = config.request.proxy;
  }
  if (typeof config.request.rejectUnauthorized === 'boolean') {
    defaults.rejectUnauthorized = config.request.rejectUnauthorized;
  }
  requestWithDefaults = request.defaults(defaults);
}

function doLookup(entities, options, cb) {
  let lookupIssues = [];

  log.trace({ entities }, 'Checking to see if data is moving');

  async.each(
    entities,
    function (entityObj, next) {
      const queryFunction = entityObj.type === 'custom' && entityObj.types.indexOf('custom.jira') >= 0
          ? _lookupEntityIssue
          : _lookupEntity
      
      queryFunction(entityObj, options, function (err, issue) {
        if (err) return next(err);
        lookupIssues.push(issue);
        log.trace({ entityObj, issue }, 'Checking Issues');
        next(null);
      });
    },
    function (err) {
      cb(err, lookupIssues);
    }
  );
}

function _lookupEntityIssue(entityObj, options, cb) {
  log.trace(
    {
      entity: entityObj
    },
    'Checking to see if data is moving'
  );

  let uri = options.baseUrl + '/rest/api/2/issue/' + entityObj.value;
  requestWithDefaults(
    {
      uri: uri,
      method: 'GET',
      followAllRedirects: true,
      auth: {
        username: options.userName,
        password: options.apiKey
      },
      json: true
    },
    function (err, response, body) {
      // check for a request error
      if (err) {
        cb({
          detail: 'Error Making HTTP Request',
          debug: err
        });
        return;
      }

      // If we get a 404 then cache a miss
      if (response.statusCode === 404) {
        cb(null, {
          entity: entityObj,
          data: null // setting data to null indicates to the server that this entity lookup was a "miss"
        });
        return;
      }

      if (response.statusCode === 400) {
        cb(null, {
          entity: entityObj,
          data: null // setting data to null indicates to the server that this entity lookup was a "miss"
        });
        return;
      }

      if (response.statusCode !== 200) {
        cb({
          detail: 'Unexpected HTTP Status Code Received',
          debug: body
        });
        return;
      }

      log.debug({ body: body }, 'Checking Null issues for body');

      if (_.isNull(body) || _.isEmpty(body.id)) {
        cb(null, {
          entity: entityObj,
          data: null // setting data to null indicates to the server that this entity lookup was a "miss"
        });
        return;
      }

      // The lookup issues returned is an array of lookup objects with the following format
      cb(null, {
        // Required: This is the entity object passed into the integration doLookup method
        entity: entityObj,
        // Required: An object containing everything you want passed to the template
        data: {
          // Required: These are the tags that are displayed in your template
          summary: [],
          // Data that you want to pass back to the notification window details block
          details: body
        }
      });
    }
  );
}

function _lookupEntity(entityObj, options, cb) {  
  let uri = `${options.baseUrl}/rest/api/2/search?jql=text~'${flow(
    split(/[^\w]/g),
    compact,
    join(' ')
  )(entityObj.value)}' ORDER BY updated DESC`;

  requestWithDefaults(
    {
      uri: uri,
      method: 'GET',
      followAllRedirects: true,
      auth: {
        username: options.userName,
        password: options.apiKey
      },
      json: true
    },
    function (err, response, body) {
      log.trace({ jqlQuery: uri, body, err }, 'JQL Query and Result');
      
      // check for a request error
      if (err) {
        cb({
          detail: 'Error Making HTTP Request',
          debug: err
        });
        return;
      }

      // If we get a 404 then cache a miss
      if (response.statusCode === 404) {
        cb(null, {
          entity: entityObj,
          data: null // setting data to null indicates to the server that this entity lookup was a "miss"
        });
        return;
      }

      if (response.statusCode === 400) {
        cb(null, {
          entity: entityObj,
          data: null // setting data to null indicates to the server that this entity lookup was a "miss"
        });
        return;
      }

      if (response.statusCode !== 200) {
        cb({
          detail: 'Unexpected HTTP Status Code Received',
          debug: body
        });
        return;
      }

      let details = body
      if(options.reduceSearchFuzziness) {
        details = {
          ...body,
          issues: flow(
            get('issues'),
            filter(flow(JSON.stringify, toLower, replace(/[^\w]/g, ''), includes(replace(/[^\w]/g, '', toLower(entityObj.value)))))
          )(body)
        };
      }

      if (_.isNull(details) || _.isEmpty(details.issues)) {
        cb(null, {
          entity: entityObj,
          data: null // setting data to null indicates to the server that this entity lookup was a "miss"
        });
        return;
      }

      // The lookup issues returned is an array of lookup objects with the following format
      cb(null, {
        // Required: This is the entity object passed into the integration doLookup method
        entity: entityObj,
        // Required: An object containing everything you want passed to the template
        data: {
          // Required: These are the tags that are displayed in your template
          summary: [],
          // Data that you want to pass back to the notification window details block
          details
        }
      });
    }
  );
}

module.exports = {
  doLookup: doLookup,
  startup: startup
};
