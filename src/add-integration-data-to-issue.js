/*
 * Copyright (c) 2025, Polarity.io, Inc.
 */

const polarityRequest = require('./polarity-request');
const { ApiRequestError } = require('./errors');
const { getLogger } = require('./logger');
const SUCCESS_CODES = [201];

/**
 *
 * @param issueId
 * @param data - object containing the userName, userEmail, and integration data
 * @param options
 * @returns {Promise<*>}
 */
async function addIntegrationDataToIssue(issueId, entity, username, userEmail, integrationData, options) {
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
            type: 'panel',
            content: [
              {
                type: 'paragraph',
                content: [
                  {
                    type: 'text',
                    text: `Polarity Integration Data – the following information was added by ${username} (${userEmail}) via Polarity`
                  }
                ]
              }
            ],
            attrs: {
              panelType: 'info'
            }
          },
          getEntityHeading(entity),
          // For each integration, add in the integration name as a heading, followed by the summary tags, followed
          // by the expandable block with the integration data.  Finally, add a divider between each integration
          // except the last one (no trailing divider).
          ...integrationData
            .map((integration, index) => {
              const commentData = [
                getIntegrationNameHeading(integration.integrationName),
                getIntegrationSummaryTags(integration),
                getIntegrationDataExpansion(integration)
              ];

              // Add the divider but not for the last integration
              if (index !== integrationData.length - 1) {
                commentData.push({
                  type: 'rule'
                });
              }

              return commentData;
            })
            .flat()
        ],
        type: 'doc',
        version: 1
      }
    }
  };

  Logger.trace({ requestOptions }, `Add Integration Data Comment to Issue ${issueId} Request Options`);

  const apiResponse = await polarityRequest.request(requestOptions, options);

  Logger.trace({ apiResponse }, `Add Comment to Issue ${issueId} response`);

  if (!SUCCESS_CODES.includes(apiResponse.statusCode)) {
    throw new ApiRequestError(
      `Unexpected status code ${apiResponse.statusCode} received when making request to add integration data comment to Jira Issue`,
      {
        statusCode: apiResponse.statusCode,
        requestOptions,
        responseBody: apiResponse.body
      }
    );
  }

  return apiResponse.body;
}

function getIntegrationSummaryTags(integration) {
  return {
    type: 'paragraph',
    content: [
      ...integration.data.summary
        .map((tag) => {
          return [
            {
              type: 'text',
              text: tag,
              marks: [
                {
                  type: 'code'
                }
              ]
            },
            {
              type: 'text',
              text: ' '
            }
          ];
        })
        .flat()
    ]
  };
}

/**
 * Converts the flattened integration data which is in the format
 * ```
 * [
 *   { key: 'a', value: 1 },
 *   { key: 'b.c', value: 2 },
 *   { key: 'b.d.0', value: 3 },
 *   { key: 'b.d.1', value: 4 },
 *   { key: 'e.f.g', value: 5 }
 * ]
 * ```
 * into a Confluence-style expand section with the data inside of it
 * as a table.
 * @param integrationData
 */
function getIntegrationDataExpansion(integration) {
  let flattenedData;
  if (integration && integration.data && integration.data.details) {
    flattenedData = jsonToDotNotationArray(integration.data.details);
  } else {
    flattenedData = [
      {
        key: 'No Data',
        value: 'No data was returned from the integration'
      }
    ];
  }

  const tableRows = flattenedData.map((data) => {
    return {
      type: 'tableRow',
      content: [
        {
          type: 'tableCell',
          attrs: {},
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: data.key
                }
              ]
            }
          ]
        },
        {
          type: 'tableCell',
          attrs: {},
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: data.value
                }
              ]
            }
          ]
        }
      ]
    };
  });

  return {
    type: 'expand',
    content: [
      {
        type: 'table',
        attrs: {
          isNumberColumnEnabled: false,
          layout: 'align-start'
        },
        content: [getIntegrationTableHeader(), ...tableRows]
      }
    ],
    attrs: {
      title: integration.integrationName
    }
  };
}

function getIntegrationNameHeading(integrationName) {
  return {
    type: 'heading',
    attrs: {
      level: 3
    },
    content: [
      {
        type: 'text',
        text: integrationName
      }
    ]
  };
}

function getEntityHeading(entity) {
  return {
    type: 'heading',
    attrs: {
      level: 2
    },
    content: [
      {
        type: 'text',
        text: defangEntity(entity),
        marks: [
          {
            type: 'textColor',
            attrs: {
              color: '#0747a6'
            }
          }
        ]
      }
    ]
  };
}

function defangEntity(entity) {
  if (entity.isIP) {
    const lastDotIndex = entity.value.lastIndexOf('.');
    return entity.value.slice(0, lastDotIndex) + '[.]' + entity.value.slice(lastDotIndex + 1);
  } else if (entity.isDomain) {
    return entity.value.replace(/\./g, '[.]');
  } else if (entity.isUrl) {
    return entity.value.replace(/^http/, 'hxxp').replace(/\./g, '[.]');
  } else {
    return entity.value;
  }
}

function getIntegrationTableHeader() {
  return {
    type: 'tableRow',
    content: [
      {
        type: 'tableHeader',
        attrs: {},
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'Field',
                marks: [
                  {
                    type: 'strong'
                  }
                ]
              }
            ]
          }
        ]
      },
      {
        type: 'tableHeader',
        attrs: {},
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'Value',
                marks: [
                  {
                    type: 'strong'
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  };
}

/**
 * Convert a JSON object into an array of {key, value} pairs,
 * where 'key' is the dot notation path, and 'value' is the value at that path.
 *
 * @param {Object} obj - The JSON object to flatten.
 * @return {Array} An array of { key, value } pairs.
 */
function jsonToDotNotationArray(obj) {
  const result = [];

  /**
   * Recursive helper to traverse the object and collect paths/values.
   *
   * @param {any} current - The current sub‐object or value.
   * @param {string} path - The accumulated dot‐notation path so far.
   */
  function traverse(current, path) {
    // If current is an object or array, keep traversing its properties.
    if (current && typeof current === 'object') {
      for (const key in current) {
        if (Object.prototype.hasOwnProperty.call(current, key)) {
          const newPath = path ? `${path}.${key}` : key;
          traverse(current[key], newPath);
        }
      }
    } else {
      // current is a primitive value (string, number, boolean, or null)
      result.push({ key: path, value: String(current) });
    }
  }

  traverse(obj, '');
  return result;
}

module.exports = {
  addIntegrationDataToIssue
};
