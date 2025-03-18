'use strict';
const _ = require('lodash');
const { get, filter, flow, split, map, trim, compact, uniq, size, some } = require('lodash/fp');
const async = require('async');
const crypto = require('crypto');
const { getStatusesForProject } = require('./src/get-statuses-for-project');
const { getIssueById } = require('./src/get-issue-by-id');
const { searchIssues } = require('./src/search-issues');
const { createResultObject } = require('./src/create-result-object');
const { getCommentsByIssueId } = require('./src/get-comments-by-issue-id');
const { downloadIconByUrl } = require('./src/download-icon-by-url');
const { updateIssueTransition } = require('./src/update-issue-transition');
const { getBulkPermissions } = require('./src/get-bulk-permissions');
const { addCommentToIssue } = require('./src/add-comment-to-issue');
const { getProjects } = require('./src/get-projects.js');
const { getIssueTypesByProject } = require('./src/get-issue-types-by-project.js');
const { addIssue } = require('./src/add-issue.js');
const { setLogger } = require('./src/logger');
const { getIssueFields } = require('./src/get-issue-fields');

let log = null;

// Project and Task icons require authentication to display so we fetch them and store them here
// This way we only fetch the icon the first time we see it.  The cache is keyed on the URL of the
// icon and the value is the icon data base64 encoded.
const iconCache = {};

function startup(logger) {
  log = logger;
  setLogger(logger);
}

const splitCommaSeparatedUserOption = (key, options) => flow(get(key), split(','), map(trim), compact, uniq)(options);

async function doLookup(entities, options, cb) {
  let lookupResults = [];
  const ignoreEntities = splitCommaSeparatedUserOption('ignoreList', options);
  const ignoreEntitiesRegex = splitCommaSeparatedUserOption('ignoreListRegex', options);
  const entitiesWithoutIgnored =
    size(ignoreEntities) || size(ignoreEntitiesRegex)
      ? filter((entity) => {
          const entityNotCaughtByRegex = !some((regexStr) => {
            try {
              return entity.value.match(new RegExp(regexStr, 'i'));
            } catch (_) {
              return false;
            }
          }, ignoreEntitiesRegex);
          return !ignoreEntities.includes(entity.value) && entityNotCaughtByRegex;
        }, entities)
      : entities;

  log.trace({ entities, entitiesWithoutIgnored }, 'doLookup');

  try {
    await async.each(entitiesWithoutIgnored, async (entityObj, next) => {
      let apiResponse;
      if (entityObj.type === 'custom' && entityObj.types.indexOf('custom.jira') >= 0) {
        apiResponse = await getIssueById(entityObj.value, options);
      } else {
        apiResponse = await searchIssues(entityObj, options);
      }

      lookupResults.push(createResultObject(entityObj, apiResponse, options));
    });
  } catch (error) {
    return cb(error);
  }

  log.trace({ lookupResults }, 'doLookup results');
  cb(null, lookupResults);
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
async function getRequiredIcons(issues, options) {
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
      iconCache[url] = await downloadIconByUrl(url, options);
    }
    requiredIcons[md5] = iconCache[url];
  }

  return requiredIcons;
}

async function onDetails(resultObject, options, cb) {
  try {
    resultObject.data.details.issues = await getCommentsAndAddToIssues(resultObject.data.details.issues, options);
    resultObject.data.details.icons = await getRequiredIcons(resultObject.data.details.issues, options);
    resultObject.data.details.permissions = await getBulkPermissions(
      resultObject.data.details.issues.map((issue) => issue.id),
      options
    );

    log.trace({ resultObject }, 'onDetails result');

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

async function getCommentsAndAddToIssues(issues, options) {
  await async.eachLimit(issues, 10, async (issue) => {
    const body = await getCommentsByIssueId(issue.id, options);
    issue.comments = body.comments;
  });

  log.trace({ issues }, 'Issues with comments');
  return issues;
}

async function onMessage(payload, options, cb) {
  log.trace({ payload }, 'onMessage');
  switch (payload.action) {
    case 'UPDATE_TRANSITION':
      try {
        if (!options.enableUpdatingStatus) {
          return cb({
            error: 'Updating Issue status is disabled for this integration'
          });
        }
        await updateIssueTransition(payload.issueId, payload.transitionId, options);
        const body = await getIssueById(payload.issueId, options);
        const status = body.issues[0].fields.status;
        cb(null, {
          status
        });
      } catch (e) {
        log.error(e, 'Error updating transitions');
        cb(errorToPojo(e, 'Error updating transitions'));
      }
      break;
    case 'ADD_COMMENT':
      try {
        if (!options.enableAddingComments) {
          return cb({
            error: 'Adding comments is disabled for this integration'
          });
        }
        const newComment = await addCommentToIssue(payload.issueId, payload.comment, options);
        cb(null, {
          comment: newComment
        });
      } catch (e) {
        log.error(e, 'Error adding comment');
        cb(errorToPojo(e, 'Error adding comment'));
      }
      break;
    case 'GET_PROJECTS':
      try {
        if (options.enableCreatingIssues.value === 'disabled') {
          return cb({
            error: 'Adding issues is disabled for this integration'
          });
        }
        const projects = await getProjects(options);
        cb(null, {
          projects
        });
      } catch (e) {
        log.error(e, 'Error getting Projects');
        cb(errorToPojo(e, 'Error getting Projects'));
      }
      break;
    case 'GET_ISSUE_TYPES':
      try {
        if (options.enableCreatingIssues.value === 'disabled') {
          return cb({
            error: 'Adding issues is disabled for this integration'
          });
        }
        const issueTypes = await getIssueTypesByProject(payload.projectId, options);
        cb(null, {
          issueTypes
        });
      } catch (e) {
        log.error(e, 'Error getting issue types');
        cb(errorToPojo(e, 'Error getting issue types'));
      }
      break;
    case 'ADD_ISSUE':
      try {
        if (options.enableCreatingIssues.value === 'disabled') {
          return cb({
            error: 'Adding issues is disabled for this integration'
          });
        }
        const issue = await addIssue(payload.projectId, payload.issueType, payload.fields, options);
        cb(null, {
          issue
        });
      } catch (e) {
        log.error(e, 'Error creating issue');
        cb(errorToPojo(e, 'Error creating issue'));
      }
      break;
    case 'GET_ISSUE_FIELDS':
      try {
        if (options.enableCreatingIssues.value === 'disabled') {
          return cb({
            error: 'Adding issues is disabled for this integration'
          });
        }
        const issueFields = await getIssueFields(payload.projectId, payload.issueType, options);
        cb(null, {
          issueFields
        });
      } catch (e) {
        log.error(e, 'Error getting issue field meta');
        cb(errorToPojo(e, 'Error getting issue field meta'));
      }
      break;
    default:
      cb({
        error: 'Invalid Action Provided'
      });
  }
}

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
    typeof userOptions.baseUrl.value !== 'string' ||
    (typeof userOptions.baseUrl.value === 'string' && userOptions.baseUrl.value.length === 0)
  ) {
    errors.push({
      key: 'baseUrl',
      message: 'You must provide a Jira API URL'
    });
  }

  if (typeof userOptions.baseUrl.value === 'string' && userOptions.baseUrl.value.endsWith('/')) {
    errors.push({
      key: 'baseUrl',
      message: 'Jira API URL cannot end with a trailing slash ("/")'
    });
  }

  if (typeof userOptions.baseAppUrl.value === 'string' && userOptions.baseAppUrl.value.endsWith('/')) {
    errors.push({
      key: 'baseAppUrl',
      message: 'Jira Application URL cannot end with a trailing slash ("/")'
    });
  }

  cb(null, errors);
}

module.exports = {
  doLookup,
  startup,
  validateOptions,
  onDetails,
  onMessage
};
