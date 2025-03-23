/*
 * Copyright (c) 2025, Polarity.io, Inc.
 */

const polarityRequest = require('./polarity-request');
const { ApiRequestError } = require('./errors');
const { getLogger } = require('./logger');
const { get } = require('lodash/fp');
const SUCCESS_CODES = [200];

/**
 * Returns comments for the given issueId
 * @param issueId
 * @param options
 * @returns {Promise<*>}
 */
async function getCommentsByIssueId(issueId, options) {
  const Logger = getLogger();

  const requestOptions = {
    uri: `${options.baseUrl}/rest/api/3/issue/${issueId}/comment`,
    followAllRedirects: true,
    qs: {
      expand: 'renderedBody',
      orderBy: '-created'
    }
  };

  Logger.trace({ requestOptions }, 'Get Jira Comments Request Options');

  const apiResponse = await polarityRequest.request(requestOptions, options);

  Logger.trace({ apiResponse }, `Get Jira Issue Comments for ${issueId}`);

  if (!SUCCESS_CODES.includes(apiResponse.statusCode)) {
    throw new ApiRequestError(
      `Unexpected status code ${apiResponse.statusCode} received when making request get Jira Comment`,
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
  getCommentsByIssueId
};
