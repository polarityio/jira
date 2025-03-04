const polarityRequest = require('./polarity-request');
const { ApiRequestError } = require('./errors');
const { getLogger } = require('./logger');
const SUCCESS_CODES = [200];

/**
 * Fetches the icon (image) from the given URL and converts it into a base64 encoded image
 * that can be rendered in an <img> tag.
 *
 * Since icons can be different formats (PNG, SVG, GIF etc.), we use the content-type of the response header
 * to set the data type in the base64 encoded string.
 * @param iconUrl
 * @param options
 * @returns {Promise<string>}
 */
async function downloadIconByUrl(iconUrl, options) {
  const Logger = getLogger();

  const requestOptions = {
    uri: iconUrl,
    followAllRedirects: true,
    encoding: null
  };

  Logger.trace({ requestOptions }, 'Request Options');

  const apiResponse = await polarityRequest.request(requestOptions, options);

  if (!SUCCESS_CODES.includes(apiResponse.statusCode)) {
    throw new ApiRequestError(
      `Unexpected status code ${apiResponse.statusCode} received when downloading Jira Icon (${iconUrl})`,
      {
        statusCode: apiResponse.statusCode,
        requestOptions,
        responseBody: apiResponse.body
      }
    );
  }

  return `data:${apiResponse.headers['content-type']};base64,${Buffer.from(apiResponse.body, 'binary').toString(
    'base64'
  )}`;
}

module.exports = {
  downloadIconByUrl
};
