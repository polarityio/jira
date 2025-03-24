/*
 * Copyright (c) 2025, Polarity.io, Inc.
 */

const polarityRequest = require('./polarity-request');
const { ApiRequestError } = require('./errors');
const { getLogger } = require('./logger');
const { get } = require('lodash/fp');
const SUCCESS_CODES = [200];

/**
 * Returns list of permissions for the given issues
 * @param issueIds array of issue ids
 * @param options
 * @returns {Promise<*>}
 */
async function getBulkPermissions(issueIds, options) {
  const Logger = getLogger();

  const requestOptions = {
    uri: `${options.baseUrl}/rest/api/3/permissions/check`,
    followAllRedirects: true,
    method: 'POST',
    body: {
      projectPermissions: [
        {
          issues: issueIds,
          permissions: ['EDIT_ISSUES', 'TRANSITION_ISSUES', 'ADD_COMMENTS']
        }
      ]
    }
  };

  Logger.trace({ requestOptions }, 'Get Jira Transitions Request Options');

  const apiResponse = await polarityRequest.request(requestOptions, options);

  Logger.trace({ apiResponse }, `Get Jira Issue Permissions`);

  if (!SUCCESS_CODES.includes(apiResponse.statusCode)) {
    throw new ApiRequestError(
      `Unexpected status code ${apiResponse.statusCode} received when making request get Jira Transitions`,
      {
        statusCode: apiResponse.statusCode,
        requestOptions,
        responseBody: apiResponse.body
      }
    );
  }

  /**
   * apiResponse.body format is as follows:
   *
   * {
   *     "projectPermissions": [
   *         {
   *             "permission": "TRANSITION_ISSUES",
   *             "issues": [
   *                 17110
   *             ],
   *             "projects": []
   *         },
   *         {
   *             "permission": "EDIT_ISSUES",
   *             "issues": [
   *                 17110
   *             ],
   *             "projects": []
   *         },
   *         {
   *             "permission": "ADD_COMMENTS",
   *             "issues": [
   *                 17110
   *             ],
   *             "projects": []
   *         }
   *     ],
   *     "globalPermissions": []
   * }
   */
  const permissionsByIssueId = {};

  // Set default permissions to false
  issueIds.forEach((id) => {
    permissionsByIssueId[id] = {
      EDIT_ISSUES: false,
      TRANSITION_ISSUES: false,
      ADD_COMMENTS: false
    };
  });

  // change permissions to true as needed
  apiResponse.body.projectPermissions.forEach((permission) => {
    permission.issues.forEach((issueId) => {
      permissionsByIssueId[issueId][permission.permission] = true;
    });
  });

  return permissionsByIssueId;
}

module.exports = {
  getBulkPermissions
};
