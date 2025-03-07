/*
 * Copyright (c) 2025, Polarity.io, Inc.
 */

const polarityRequest = require('./polarity-request');
const { ApiRequestError } = require('./errors');
const { getLogger } = require('./logger');
const { get } = require('lodash/fp');
const SUCCESS_CODES = [201];

/**
 * Returns comments for the given issueId
 * @param issueId
 * @param options
 * @returns {Promise<*>}
 */
async function addCommentToIssue(issueId, comment, options) {
  const Logger = getLogger();

  const requestOptions = {
    uri: `${options.baseUrl}/rest/api/3/issue/${issueId}/comment`,
    followAllRedirects: true,
    method: 'POST',
    qs: {
      expand: 'renderedBody'
    },
    body: {
      body: {
        content: [
          {
            content: [
              {
                text: comment,
                type: 'text'
              }
            ],
            type: 'paragraph'
          }
        ],
        type: 'doc',
        version: 1
      }
    }
  };

  Logger.trace({ requestOptions }, `Add Comment to Issue ${issueId} Request Options`);

  const apiResponse = await polarityRequest.request(requestOptions, options);

  Logger.trace({ apiResponse }, `Add Comment to Issue ${issueId} response`);

  if (!SUCCESS_CODES.includes(apiResponse.statusCode)) {
    throw new ApiRequestError(
      `Unexpected status code ${apiResponse.statusCode} received when making request add comment to Jira Issue`,
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
  addCommentToIssue
};
