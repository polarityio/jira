const { getLogger } = require('./logger');
const _ = require('lodash');

/**
 *
 * @param entities
 * @param apiResponse
 * @returns {*[]}
 */
const createResultObject = (entity, apiResponse, options) => {
  if (_.isNull(apiResponse) || _.isEmpty(apiResponse.issues)) {
    return {
      entity,
      data: null
    };
  } else {
    return {
      entity,
      data: {
        summary: createSummaryTags(apiResponse, options),
        details: apiResponse
      }
    };
  }
};

function createSummaryTags(apiResponse, options) {
  if (Array.isArray(apiResponse.issues) && apiResponse.issues.length > 1) {
    const numIssues = apiResponse.issues.length;
    if (apiResponse.isLast) {
      // `isLast` indicates whether this is the last page of the paginated response.
      return [`Number of Issues: ${numIssues}`];
    } else {
      // there are more results but we're not showing them
      return [`First ${numIssues} issues returned`];
    }
  }

  const tags = [];

  if (Array.isArray(apiResponse.issues) && apiResponse.issues.length >= 1) {
    const firstIssue = apiResponse.issues[0];
    tags.push(`Ticket Status: ${_.get(firstIssue, 'fields.status.name', 'Unknown')}`);
    tags.push(`Issue Type: ${_.get(firstIssue, 'fields.issuetype.name', 'Unknown')}`);
    tags.push(_.get(firstIssue, 'fields.summary', 'No Summary'));

    if (_.get(firstIssue, 'fields.assignee.displayName')) {
      tags.push(`Assignee: ${_.get(firstIssue, 'fields.assignee.displayName')}`);
    }
  } else {
    getLogger().error({ apiResponse }, 'Unexpected Issue Format when creating Summary Tags');
    tags.push('Unexpected Issue Format');
  }

  return tags;
}

module.exports = {
  createResultObject
};
