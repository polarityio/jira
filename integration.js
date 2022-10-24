'use strict';
const request = require('postman-request');
const _ = require('lodash');
const { replace, filter, includes, split, join, compact, flow, get, toLower, map, nth, eq, reduce, flatten } = require('lodash/fp');
const async = require('async');
const fs = require('fs');
const config = require('./config/config');

let log = null;
let requestWithDefaults;
let requestAsync;

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
  requestAsync = (requestOptions) =>
    new Promise((resolve, reject) => {
      requestWithDefaults(requestOptions, (err, res, body) => {
        if (err) return reject(err);
        resolve({ ...res, body });
      });
    });
}

function doLookup(entities, options, cb) {
  let lookupIssues = [];

  log.trace({ entities }, 'Checking to see if data is moving');

  async.each(
    entities,
    function (entityObj, next) {
      const queryFunction =
        entityObj.type === 'custom' && entityObj.types.indexOf('custom.jira') >= 0 ? _lookupEntityIssue : _lookupEntity;

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
  const jqlQuery = `text ~ "${flow(split(/[^\w]/g), compact, join(' '))(entityObj.value)}" ORDER BY updated DESC`
  requestWithDefaults(
    {
      method: 'GET',
      uri: `${options.baseUrl}/rest/api/2/search`,
      qs: { jql: jqlQuery },
      followAllRedirects: true,
      auth: {
        username: options.userName,
        password: options.apiKey
      },
      json: true
    },
    async (err, response, body) => {
      log.trace({ jqlQuery, body, err }, 'JQL Query and Result');

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

      let details = body;
      if (options.reduceSearchFuzziness) {
        const issuesWithComments = await getCommentsAndAddToIssues(body, options);
        details = {
          ...body,
          issues: filter(
            flow(
              JSON.stringify,
              toLower,
              replace(/[^\w]/g, ''),
              includes(replace(/[^\w]/g, '', toLower(entityObj.value)))
            ),
            issuesWithComments
          )
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

const getCommentsAndAddToIssues = async (body, options) => {
  const issues = get('issues', body);
  if(!options.searchComments) return issues;

  const commentsForAllFoundIssues = flatten(
    await Promise.all(
      map(
        flow(get('id'), async (issueId) =>
          get(
            'body.comments',
            await requestAsync({
              method: 'GET',
              uri: `${options.baseUrl}/rest/api/3/issue/${issueId}/comment`,
              followAllRedirects: true,
              auth: {
                username: options.userName,
                password: options.apiKey
              },
              json: true
            })
          )
        ),
        issues
      )
    )
  );

  const issuesWithComments = map(
    (issue) => ({
      ...issue,
      comments: reduce(
        (agg, comment) =>
          /* The "self" property on the comment is a url that contains the "issueId" in 
           * the path "https://{{url}}/rest/api/3/issue/{{issueId}}/comment/{{commentId}}"
           * which is used here to correlate comments to the issue
          **/
          flow(get('self'), split('/'), nth(7), eq(issue.id))(comment) ? [...agg, get('body.content', comment)] : agg,
        [],
        commentsForAllFoundIssues
      )
    }),
    issues
  );

  return issuesWithComments;
};

function validateOptions(userOptions, cb) {
  let errors = [];
  if (
    typeof userOptions.apiKey.value !== 'string' ||
    (typeof userOptions.apiKey.value === 'string' && userOptions.apiKey.value.length === 0)
  ) {
    errors.push({
      key: 'apiKey',
      message: 'You must provide your Jira API key or Password'
    });
  }

  if (
    typeof userOptions.userName.value !== 'string' ||
    (typeof userOptions.userName.value === 'string' && userOptions.userName.value.length === 0)
  ) {
    errors.push({
      key: 'userName',
      message: 'You must provide a username'
    });
  }

  if (
    typeof userOptions.baseUrl.value !== 'string' ||
    (typeof userOptions.baseUrl.value === 'string' && userOptions.baseUrl.value.length === 0)
  ) {
    errors.push({
      key: 'baseUrl',
      message: 'You must provide a Jira base URL'
    });
  }

  cb(null, errors);
}

module.exports = {
  doLookup,
  startup,
  validateOptions
};
