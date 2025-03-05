/*
 * Copyright (c) 2025, Polarity.io, Inc.
 */

const polarityRequest = require('./polarity-request');
const { ApiRequestError } = require('./errors');
const { getLogger } = require('./logger');
const { get } = require('lodash/fp');
const SUCCESS_CODES = [204];

/**
 * Returns comments for the given issueId
 * @param issueId
 * @param options
 * @returns {Promise<*>}
 */
async function updateIssueTransition(issueId, transitionId, options) {
  const Logger = getLogger();

  const requestOptions = {
    uri: `${options.baseUrl}/rest/api/3/issue/${issueId}/transitions`,
    followAllRedirects: true,
    method: 'POST',
    body: {
      transition: {
        id: transitionId
      }
    }
  };

  Logger.trace({ requestOptions }, 'Post Jira Transitions Request Options');

  const apiResponse = await polarityRequest.request(requestOptions, options);

  Logger.trace({ apiResponse }, `Post Jira Issue Transitions for ${issueId}`);

  if (!SUCCESS_CODES.includes(apiResponse.statusCode)) {
    throw new ApiRequestError(
      `Unexpected status code ${apiResponse.statusCode} received when making request to update Jira Transition`,
      {
        statusCode: apiResponse.statusCode,
        requestOptions,
        responseBody: apiResponse.body
      }
    );
  }

  return apiResponse.body;
}

module.exports = {
  updateIssueTransition
};
