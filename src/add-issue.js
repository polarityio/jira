/*
 * Copyright (c) 2025, Polarity.io, Inc.
 */

const polarityRequest = require('./polarity-request');
const { ApiRequestError } = require('./errors');
const { getLogger } = require('./logger');
const { get } = require('lodash/fp');
const SUCCESS_CODES = [201];

/**
 * Creates a new issue
 * @param fields object containing key value pairs where the key is the field name and the value if an object
 * with the following shape:
 * {
 *   name: '<field name>',
 *   value: 'some value',
 *   type: '<field type>'
 * }
 * @param options
 * @returns {Promise<*>}
 */
async function addIssue(projectId, issueType, fields, options) {
  const Logger = getLogger();

  const enrichedFields = enrichFields(projectId, issueType, fields);

  const requestOptions = {
    uri: `${options.baseUrl}/rest/api/3/issue`,
    followAllRedirects: true,
    method: 'POST',
    qs: {
      expand: 'renderedBody'
    },
    body: {
      fields: enrichedFields
    }
  };

  Logger.trace({ requestOptions }, `Add Comment to Issue ${issueType} Request Options`);

  const apiResponse = await polarityRequest.request(requestOptions, options);

  Logger.trace({ apiResponse }, `Add Comment to Issue ${issueType} response`);

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

  // API response body as the following format
  // {
  //   "id": "17674",
  //   "key": "PC-26",
  //   "self": "https://xyz.atlassian.net/rest/api/3/issue/17674"
  // },
  return apiResponse.body;
}

/**
 * Enriches the fields object with additional data to get them in the format
 * required for creating a new issue.  As an example, it will take "textarea" type
 * fields and convert them into Atlassian Document Format.
 * @param fields
 */
function enrichFields(projectId, issueType, fields) {
  const enrichedFields = {};

  enrichedFields.issuetype = {
    id: issueType
  };

  enrichedFields.project = {
    id: projectId
  };

  fields.forEach((field) => {
    if (field.schema && field.schema.system === 'description' && field.__value) {
      enrichedFields[field.key] = {
        content: [
          {
            content: [
              {
                text: field.__value,
                type: 'text'
              }
            ],
            type: 'paragraph'
          }
        ],
        type: 'doc',
        version: 1
      };
    } else if (field.schema && field.schema.type === 'string' && field.__value) {
      enrichedFields[field.key] = field.__value;
    }
  });

  return enrichedFields;
}

module.exports = {
  addIssue
};
