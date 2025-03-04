const polarityRequest = require('./polarity-request');
const { ApiRequestError } = require('./errors');
const { getLogger } = require('./logger');
const SUCCESS_CODES = [200];


/**
 * Returns all status values for each issue type within a given project
 * 
 * 
 * 
 * @param projectShortCode
 * @param options
 * @returns {Promise<*>}
 */
async function getStatusesForProject(projectShortCode, options) {
  const Logger = getLogger();

  const requestOptions = {
    resultId: entity,
    uri: `https://api.userstack.com/detect`,
    qs: {
      ua: entity.value,
      access_key: options.apiKey
    }
  };

  Logger.trace({ requestOptions }, 'Request Options');

  const apiResponse = await polarityRequest.request(requestOptions, options);

  Logger.trace({ apiResponse }, 'Search ISC IP API Response');

  if (!SUCCESS_CODES.includes(apiResponse.statusCode)) {
    throw new ApiRequestError(
      `Unexpected status code ${apiResponse.statusCode} received when making request to the ISC IP API`,
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
  getStatusesForProject
};
