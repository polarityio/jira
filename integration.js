'use strict';
let request = require('request');
let _ = require('lodash');
let async = require('async');
let config = require('./config/config');
let util = require('util');
let log = null
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

  log.trace({
    entity: entities
  }, "Checking to see if data is moving");

  async.each(entities, function (entityObj, next) {
    if (entityObj.isDomain || entityObj.isEmail || entityObj.isIPv4 || entityObj.isIPv6) {
      _lookupEntity(entityObj, options, function (err, issue) {
        if (err) {
          next(err);
        } else {
          lookupIssues.push(issue);

          log.trace({
            issue: issue
          }, "Checking Issues");
          next(null);
        }
      });
    } else if (entityObj.type === 'custom') {
      _lookupEntityIssue(entityObj, options, function (err, issue) {
        if (err) {
          next(err);
        } else {
          lookupIssues.push(issue);
          log.trace({
            issue: issue
          }, "Checking Issues");
          next(null);
        }
      });
    } else {
      lookupIssues.push({ entity: entityObj, data: null }); //Cache the missed results
      next(null);
    }
  }, function (err) {
    cb(err, lookupIssues);
  });
}

function _lookupEntityIssue(entityObj, options, cb) {
  log.trace({
    entity: entityObj
  }, "Checking to see if data is moving");

  let uri = options.baseUrl + "/rest/api/2/issue/" + entityObj.value;
  let url = options.baseUrl;
  requestWithDefaults({
    uri: uri,
    method: 'GET',
    auth: {
      'username': options.userName,
      'password': options.apiKey
    },
    json: true

  }, function (err, response, body) {
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

    log.debug({ body: body }, "Checking Null issues for body");

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
  });
}

function _lookupEntity(entityObj, options, cb) {
  //log.trace({
  //  entity: entityObj
  //}, "Checking to see if data is moving");

  let uri = options.baseUrl + "/rest/api/2/search?jql=text~" + JSON.stringify(entityObj.value);
  
  requestWithDefaults({
    uri: uri,
    method: 'GET',
    auth: {
      'username': options.userName,
      'password': options.apiKey
    },
    json: true

  }, function (err, response, body) {
    // check for a request error
    if (err) {
      cb({
        detail: 'Error Making HTTP Request',
        debug: err
      });
      return;
    }

    log.trace({
      body: body
    }, "Return Data occuring");

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


    if (_.isNull(body) || _.isEmpty(body.issues)) {
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
  });
}

module.exports = {
  doLookup: doLookup,
  startup: startup
};
