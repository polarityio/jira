/*
 * Copyright (c) 2025, Polarity.io, Inc.
 */

const polarityRequest = require('./polarity-request');
const { ApiRequestError } = require('./errors');
const { getLogger } = require('./logger');
const SUCCESS_CODES = [200];

/**
 * Returns all status values for each issue type within a given project
 *
 * @param projectShortCode
 * @param options
 * @returns {Promise<*>}
 */
async function searchIssues(entity, options) {
  // Note that special characters are not indexed by Jira which means we cannot 
  // search for entities that are stored in Jira in their defanged form.
  // For example, if you search on the domain "google.com" but it is in a Jira comment
  // as "google[.]com", there is no way for us to search it (See INT-855)
  const Logger = getLogger();

  const jqlQuery = createJqlQuery([entity], options);

  const requestOptions = {
    resultId: entity,
    uri: `${options.baseUrl}/rest/api/3/search`,
    qs: {
      jql: jqlQuery,
      expand: 'renderedFields,transitions',
      // We fetch comments in onDetails because we need to use the comment endpoint to get
      // the renderedHTML
      fields: '-comment'
    },
    followAllRedirects: true
  };

  Logger.trace({ requestOptions }, 'searchIssues Request Options');

  const apiResponse = await polarityRequest.request(requestOptions, options);

  Logger.trace({ apiResponse }, `Search Jira Issues ${entity.value}`);

  if (!SUCCESS_CODES.includes(apiResponse.statusCode)) {
    throw new ApiRequestError(
      `Unexpected status code ${apiResponse.statusCode} received when making request to search Jira Issues`,
      {
        statusCode: apiResponse.statusCode,
        requestOptions,
        responseBody: apiResponse.body
      }
    );
  }

  if (apiResponse.statusCode === 404) {
    return null;
  } else {
    apiResponse.body.jql = jqlQuery;
    if (Array.isArray(apiResponse.body.issues)) {
      apiResponse.body.issues.forEach((issue, index) => {
        issue.__index = ++index;
      });
    }
    return apiResponse.body;
  }
}

/**
 * List of entities to search for
 * @param entities
 * @param options
 * @returns {string}
 */
function createJqlQuery(entities, options) {
  let jqlQuery = 'text ~ "';
  for (let i = 0; i < entities.length - 1; i++) {
    jqlQuery += `\\"${entities[i].value}\\" OR `;
  }
  jqlQuery += `\\"${entities[entities.length - 1].value}\\""`;

  if (options.projectsToSearch.trim().length > 0) {
    let quotedProjects = options.projectsToSearch.split(',').map((project) => `project="${project.trim()}"`);
    jqlQuery += ` AND (${quotedProjects.join(' OR ')})`;
  }

  jqlQuery += ' ORDER BY updated DESC';

  return jqlQuery;
}

module.exports = {
  searchIssues
};
