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
async function getIssueTypesByProject(projectId, options) {
  const Logger = getLogger();

  const requestOptions = {
    uri: `${options.baseUrl}/rest/api/3/issue/createmeta/${projectId}/issuetypes`,
    followAllRedirects: true,
    method: 'GET'
  };

  Logger.trace({ requestOptions }, 'Get Jira Projects');

  const apiResponse = await polarityRequest.request(requestOptions, options);

  Logger.trace({ apiResponse }, `Get Jira Projects`);

  if (!SUCCESS_CODES.includes(apiResponse.statusCode)) {
    throw new ApiRequestError(
      `Unexpected status code ${apiResponse.statusCode} received when making request get Jira projects`,
      {
        statusCode: apiResponse.statusCode,
        requestOptions,
        responseBody: apiResponse.body
      }
    );
  }

  return apiResponse.body.issueTypes;
}

module.exports = {
  getIssueTypesByProject
};
