const polarityRequest = require('./polarity-request');
const { ApiRequestError } = require('./errors');
const { getLogger } = require('./logger');
const { get } = require('lodash/fp');
const SUCCESS_CODES = [200];

/**
 * Returns list of all projects accessible by the user via their credentials where the
 * user has permissions to create issues.
 *
 * @param issueIds array of issue ids
 * @param options
 * @returns {Promise<*>}
 */
async function getProjects(options) {
  const Logger = getLogger();
  
  const projects = await getAllProjects(options);
  const permissions = await getProjectsWithPermissions(projects, options);

  // Get the projects where we have permission to create new issues
  const createIssueProjects = permissions.projectPermissions.find(
    (permission) => permission.permission === 'CREATE_ISSUES'
  );

  const projectsWithPermissions = createIssueProjects.projects.map((projectId) => {
    // Project ids are sometimes returned as strings and sometimes numbers
    // so we convert to numbers to ensure we can compare them
    const project = projects.find((project) => +project.id === +projectId);
    return project;
  });
  
  Logger.trace({ projectsWithPermissions }, `Get Jira Projects with Permissions`);

  return projectsWithPermissions;
}

async function getAllProjects(options) {
  const Logger = getLogger();

  const requestOptions = {
    uri: `${options.baseUrl}/rest/api/3/project`,
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

  return apiResponse.body;
}

async function getProjectsWithPermissions(projects, options) {
  const Logger = getLogger();
  const requestOptions = {
    uri: `${options.baseUrl}/rest/api/3/permissions/check`,
    followAllRedirects: true,
    method: 'POST',
    body: {
      projectPermissions: [
        {
          projects: projects.map((project) => project.id),
          permissions: ['CREATE_ISSUES']
        }
      ]
    }
  };

  Logger.trace({ requestOptions }, 'Get Jira Project Permissions');

  const apiResponse = await polarityRequest.request(requestOptions, options);

  Logger.trace({ apiResponse }, `Get Jira Project Permissions`);

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

  return apiResponse.body;
}

module.exports = {
  getProjects
};
