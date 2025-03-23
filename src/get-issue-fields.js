const polarityRequest = require('./polarity-request');
const { ApiRequestError } = require('./errors');
const { getLogger } = require('./logger');
const { get } = require('lodash/fp');
const SUCCESS_CODES = [200];

/**
 * Returns list of all projects accessible by the user via their credentials
 * @param issueIds array of issue ids
 * @param options
 * @returns {Promise<*>}
 */
async function getIssueFields(projectId, issueId, options) {
  const Logger = getLogger();

  const requestOptions = {
    uri: `${options.baseUrl}/rest/api/3/issue/createmeta/${projectId}/issuetypes/${issueId}`,
    followAllRedirects: true,
    method: 'GET'
  };

  Logger.trace({ requestOptions }, `Get Jira Issue fields for Project ${projectId} and Issue ${issueId}`);

  const apiResponse = await polarityRequest.request(requestOptions, options);

  Logger.trace({ apiResponse }, `Get Jira Issue fields: Project ${projectId} and Issue ${issueId}`);

  if (!SUCCESS_CODES.includes(apiResponse.statusCode)) {
    throw new ApiRequestError(
      `Unexpected status code ${apiResponse.statusCode} received when making request to get Project ${projectId} and Issue ${issueId} fields`,
      {
        statusCode: apiResponse.statusCode,
        requestOptions,
        responseBody: apiResponse.body
      }
    );
  }

  // sort by required so required fields are first
  apiResponse.body.fields.sort((a, b) => {
    if (a.required && !b.required) {
      return -1;
    }
    if (!a.required && b.required) {
      return 1;
    }
    return 0;
  });

  return apiResponse.body.fields;
}

module.exports = {
  getIssueFields
};
