'use strict';
const request = require('postman-request');
const _ = require('lodash');
const { get } = require('lodash/fp');
const async = require('async');
const fs = require('fs');
const config = require('./config/config');
const crypto = require('crypto');
const { getDefangedPermutations } = require('./lib/defanger');

let log = null;
let requestWithDefaults;
let requestAsync;
// Project and Task icons require authentication to display so we fetch them and store them here
// This way we only fetch the icon the first time we see it.  The cache is keyed on the URL of the
// icon and the value is the icon data base64 encoded.
const iconCache = {};

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

  log.trace({ entities }, 'doLookup');

  async.each(
    entities,
    function (entityObj, next) {
      const queryFunction =
        entityObj.type === 'custom' && entityObj.types.indexOf('custom.jira') >= 0 ? _lookupEntityIssue : _lookupEntity;

      queryFunction(entityObj, options, function (err, issue) {
        if (err) return next(err);
        lookupIssues.push(issue);
        next(null);
      });
    },
    function (err) {
      //log.trace({ lookupIssues }, 'doLookup Results');
      cb(err, lookupIssues);
    }
  );
}

function _lookupEntityIssue(entityObj, options, cb) {
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
          summary: getIssueSummaryTags(body),
          // Data that you want to pass back to the notification window details block
          details: {
            issues: [body]
          }
        }
      });
    }
  );
}

function getIssueSummaryTags(issue) {
  const tags = [];
  tags.push(`Ticket Status: ${_.get(issue, 'fields.status.name', 'Unknown')}`);
  tags.push(`Issue Type: ${_.get(issue, 'fields.issuetype.name', 'Unknown')}`);
  tags.push(_.get(issue, 'fields.summary', 'No Summary'));
  if (_.get(issue, 'fields.assignee.displayName')) {
    tags.push(`Assignee: ${_.get(issue, 'fields.assignee.displayName')}`);
  }
  return tags;
}

function createJqlQuery(entities, options){
  let jqlQuery = 'text ~ ';
  for(let i=0; i<entities.length-1; i++){
    jqlQuery += `\\"${entities[i]}\\" OR `;
  }
  jqlQuery += `\\"${entities[entities.length - 1]}\\"`;

  if(options.projectsToSearch.trim().length > 0){
    let quotedProjects = options.projectsToSearch.split(',').map((project) => `project="${project.trim()}"`);
    jqlQuery += ` AND (${quotedProjects.join(' OR ')})`;
  }

  jqlQuery += ' ORDER BY updated DESC';

  return jqlQuery;
}

function _lookupEntity(entityObj, options, cb) {
  // TODO: Investigate ways to support defanged entities.  Leaving this code as it covers some of the
  // methods we've tried so far

  // brackets are special characters so we need to escape them
  // const defangedEntities = getDefangedPermutations(entityObj.value, '.', ['.', '\\\\[.\\\\]']);
  // // Searches in Jira are case insensitive
  // //
  // // If the rawValue does not match the value (ignoring case since searches are case insensitive)
  // // then it is most likely a defanged entity so we want to search on the escaped rawValue and the fanged entity value.
  // // See: https://confluence.atlassian.com/jirasoftwareserver/advanced-searching-939938733.html
  // // under the section "Restricted words and characters" for how to escape special characters. In our case
  // // we need to escape [ ] { } ( ) (open and close brackets, braces, and parens).
  // if (entityObj.value.toLowerCase() !== entityObj.rawValue.toLowerCase()) {
  //   //let escapedDefangedValue = entityObj.rawValue.replace(/([\[\]{}()])/g, '\\\\$&');
  //   let escapedDefangedValue = entityObj.rawValue.replace(/([\[\]{}()])/g, '*');
  //   jqlQuery = `text ~ "\\"${entityObj.value}\\" OR \\"${escapedDefangedValue}\\"" ORDER BY updated DESC`;
  // } else {
  //   jqlQuery = `text ~ "\\"${entityObj.value}\\"" ORDER BY updated DESC`;
  // }

  let jqlQuery = createJqlQuery([entityObj.value], options);

  log.trace({ jqlQuery }, 'JQL Query');

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
        log.error(err, 'Error making HTTP Request');
        cb({
          detail: 'Error Making HTTP Request',
          debug: err
        });
        return;
      }

      // 400 errors can be triggered by invalid JQL
      if (response.statusCode === 400) {
        cb({
          body,
          statusCode: response.statusCode
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

      if (_.isNull(details) || _.isEmpty(details.issues)) {
        cb(null, {
          entity: entityObj,
          data: null // setting data to null indicates to the server that this entity lookup was a "miss"
        });
        return;
      }

      // Include the jql so we can provide a search link in the template
      details.jql = jqlQuery;

      // The lookup issues returned is an array of lookup objects with the following format
      cb(null, {
        // Required: This is the entity object passed into the integration doLookup method
        entity: entityObj,
        // Required: An object containing everything you want passed to the template
        data: {
          // Required: These are the tags that are displayed in your template
          summary: [`Number of Issues: ${details.total}`],
          // Data that you want to pass back to the notification window details block
          details
        }
      });
    }
  );
}

function computeMd5(data) {
  return crypto.createHash('md5').update(data).digest('hex');
}

/**
 * Issues have icons for their project icon and issue type icon.  These icons are not publicly accessible so if
 * we want to display them we have to retrieve them using an authenticated GET request. In order to prevent us from
 * fetching the same icon over and over (since they rarely change), we maintain a local cache of the icons keyed on
 * the MD5 of the icon URL.  The reason we use a MD5 is so that we can use the `get` helper in the template to fetch
 * the icon data.  The `get` helper does not work with `urls` as keys due to special characters in the url.
 *
 * Since the MD5 is something we generate, we need to add the MD5 value to the `issuetype` and `project` objects.
 * We call this the `__iconMd5` property.
 *
 * This method does mutate the passed in issues to add this `__iconMd5` property.
 *
 * Note that this method will only fetch icons that we haven't already fetched in previous lookups.  Icons are
 * stored in the global `iconCache` variable.
 *
 * Icons are fetched and converted into base64 strings that we can pass to the template.
 *
 * @param issues
 * @param options
 * @returns {Promise<{}>}
 */
async function getRequiredIcons(issues, options){
  // enrich with icon data as needed
  // Project Icon Path: issue.fields.project.avatarUrls.24x24
  // Issue Type Icon: issue.fields.issuetype.iconUrl
  const iconUrlMap = new Map();

  issues.forEach((issue) => {
    const projectIconUrl = _.get(issue, 'fields.project.avatarUrls.24x24', null);
    const issueIconUrl = _.get(issue, 'fields.issuetype.iconUrl', null);
    if (projectIconUrl !== null) {
      const projectIconMd5 = computeMd5(projectIconUrl);
      issue.fields.project.__iconMd5 = projectIconMd5;
      iconUrlMap.set(projectIconMd5, projectIconUrl);
    }
    if (issueIconUrl !== null) {
      const issueIconMd5 = computeMd5(issueIconUrl);
      issue.fields.issuetype.__iconMd5 = issueIconMd5;
      iconUrlMap.set(issueIconMd5, issueIconUrl);
    }
  });

  // For icons that are yet cached, fetch the icon, then add it to the list of requireIcons
  // that will be sent to the template for rendering.
  const requiredIcons = {};
  for await (let [md5, url] of iconUrlMap) {
    if (!iconCache[url]) {
      iconCache[url] = await getIcon(url, options);
    }
    requiredIcons[md5] = iconCache[url];
  }

  return requiredIcons;
}


async function onDetails(resultObject, options, cb) {
  try {
    if (options.displayComments) {
      resultObject.data.details.issues = await getCommentsAndAddToIssues(resultObject.data.details, options);
    }

    resultObject.data.details.icons = await getRequiredIcons(resultObject.data.details.issues, options);

    cb(null, resultObject.data);
  } catch (e) {
    log.error(e, 'onDetails Error');
    cb(errorToPojo(e, 'Error fetching comments'));
  }
}

function errorToPojo(err, detail) {
  return err instanceof Error
    ? {
        ...err,
        name: err.name,
        message: err.message,
        stack: err.stack,
        detail: err.message ? err.message : err.detail ? err.detail : detail
      }
    : err;
}

/**
 * Fetches the icon (image) from the given URL and converts it into a base64 encoded image
 * that can be rendered in an <img> tag.
 *
 * Since icons can be different formats (PNG, SVG, GIF etc.), we use the content-type of the response header
 * to set the data type in the base64 encoded string.
 * 
 * @param iconUrl
 * @param options
 * @returns {Promise<string>}
 */
async function getIcon(iconUrl, options) {
  const response = await requestAsync({
    method: 'GET',
    uri: iconUrl,
    followAllRedirects: true,
    auth: {
      username: options.userName,
      password: options.apiKey
    },
    encoding: null
  });
  return `data:${response.headers['content-type']};base64,${Buffer.from(response.body, 'binary').toString('base64')}`;
}

const getCommentsAndAddToIssues = async (body, options) => {
  const issues = get('issues', body);

  await async.eachLimit(issues, 10, async (issue) => {
    const result = await requestAsync({
      method: 'GET',
      uri: `${options.baseUrl}/rest/api/2/issue/${issue.id}/comment`,
      followAllRedirects: true,
      auth: {
        username: options.userName,
        password: options.apiKey
      },
      json: true
    });
    issue.comments = result.body.comments;
  });

  //log.trace({ issues }, 'Issues with comments');
  return issues;
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
  validateOptions,
  onDetails
};
