/*
 * Copyright (c) 2025, Polarity.io, Inc.
 */

const polarityRequest = require('./polarity-request');
const { ApiRequestError } = require('./errors');
const { getLogger } = require('./logger');
// 404 indicates no result found
const SUCCESS_CODES = [200, 404];

/**
 * Returns the issue details for a given JIRA Issue ID
 * @param entity which represents a JIRA Issue ID
 * @param options
 * @returns {Promise<{issues: *[]}|null>}
 */
async function getIssueById(issueId, options) {
  const Logger = getLogger();

  const requestOptions = {
    uri: `${options.baseUrl}/rest/api/3/issue/${issueId}`,
    qs: {
      expand: 'renderedFields,transitions',
      // We fetch comments in onDetails because we need to use the comment endpoint to get
      // the renderedHTML
      fields: '-comment'
    },
    followAllRedirects: true
  };

  Logger.trace({ requestOptions }, 'Request Options');

  const apiResponse = await polarityRequest.request(requestOptions, options);

  Logger.trace({ apiResponse }, `Get Jira Issue ${issueId}`);

  if (!SUCCESS_CODES.includes(apiResponse.statusCode)) {
    throw new ApiRequestError(
      `Unexpected status code ${apiResponse.statusCode} received when making request get Jira Issue`,
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
    return {
      issues: [apiResponse.body]
    };
  }
}

module.exports = {
  getIssueById
};
