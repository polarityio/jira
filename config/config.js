module.exports = {
  name: 'Jira',
  acronym: 'JIRA',
  description: 'Lookup Jira issues by key or search across Jira issues by IP, domain, email, hash, url, or CVE',
  customTypes: [
    {
      key: 'jira',
      regex: '[A-Z]{1,10}-\\d{1,10}'
    }
  ],
  entityTypes: ['domain', 'email', 'IPv4', 'IPv6', 'url', 'MD5', 'SHA1', 'SHA256', 'cve'],
  defaultColor: 'light-blue',
  logging: {
    level: 'info'
  },
  request: {
    cert: '',
    key: '',
    passphrase: '',
    ca: '',
    proxy: ''
  },
  styles: ['./styles/styles.less'],
  block: {
    component: {
      file: './components/block.js'
    },
    template: {
      file: './templates/block.hbs'
    }
  },
  options: [
    {
      key: 'baseUrl',
      name: 'Jira API URL',
      description:
        'URL used to access the REST API of your Jira instance. For Jira Cloud this will typically be `https://<your-jira-instance>.atlassian.net`. This option must be set to "Lock and show option for all users" or "User provides option value".  ',
      default: '',
      type: 'text',
      userCanEdit: false,
      adminOnly: false
    },
    {
      key: 'baseAppUrl',
      name: 'Jira Application URL',
      description:
        'URL used to access your Jira web application instance. Leave blank if your Application URL is the same as your API URL.  Jira Cloud users can leave this option blank. This option must be set to "Lock and show option for all users" or "User provides option value".',
      default: '',
      type: 'text',
      userCanEdit: false,
      adminOnly: false
    },
    {
      key: 'userName',
      name: 'Jira Email Address',
      description:
        'Email address used for individual to access Jira.  Only required when authenticating to Jira Cloud.',
      default: '',
      type: 'text',
      userCanEdit: false,
      adminOnly: true
    },
    {
      key: 'apiKey',
      name: 'API Token',
      description: 'Jira API token.  Required for both Jira Cloud and Jira Server.',
      default: '',
      type: 'password',
      userCanEdit: false,
      adminOnly: true
    },
    {
      key: 'projectsToSearch',
      name: 'Projects to Search',
      description:
        'A comma delimited list of project names to search.  Project short names can be used in addition to the long names.  Project names are not case-sensitive. If no value is provided, all accessible projects will be searched.  This setting does not affect searches on Jira Issue Keys and is only used for searches on other entities (e.g., IP, domain, cve, etc.).',
      default: '',
      type: 'text',
      userCanEdit: false,
      adminOnly: false
    },
    {
      key: 'enableUpdatingStatus',
      name: 'Enable Updating Issue Status',
      description:
        'If enabled, users will be able to update the issue status of an issue.  Users will only be able to update status if they have the appropriate permissions in Jira based on the configured Jira Email Address and/or API Token.',
      default: false,
      type: 'boolean',
      userCanEdit: false,
      adminOnly: false
    },
    {
      key: 'enableAddingComments',
      name: 'Enable Adding Comments',
      description:
        'If enabled, users will be able to add comments to issues. Users will only be able to add comments if they have the appropriate permissions in Jira based on the configured Jira Email Address and/or API Token.',
      default: false,
      type: 'boolean',
      userCanEdit: false,
      adminOnly: false
    },
    {
      key: 'enableCreatingIssues',
      name: 'Enable Creating Issues',
      description:
        'If enabled, users will be able to create new Jira issues.  Users will only be able to create issues if they have the appropriate permissions in Jira based on the configured Jira Email Address and/or API Token.',
      default: {
        value: 'disabled',
        display: 'Disabled -- Users cannot create issues'
      },
      type: 'select',
      options: [
        {
          value: 'disabled',
          display: 'Disabled -- Users cannot create issues'
        },
        {
          value: 'enabledSearchOnly',
          display: 'Enabled -- Creating Jira issues is available when Jira search results exist'
        },
        {
          value: 'enabledAlways',
          display: 'Enabled - Creating Jira issues is always available'
        }
      ],
      multiple: false,
      userCanEdit: false,
      adminOnly: false
    },
    {
      key: 'ignoreList',
      name: 'Ignored Entities List',
      description: 'A comma delimited list entities you wish to ignore from search',
      default: '',
      type: 'text',
      userCanEdit: false,
      adminOnly: false
    },
    {
      key: 'ignoreListRegex',
      name: 'Ignore Regex Entities List',
      description: 'A comma delimited list regular expressions for ignoring entities from search',
      default: '',
      type: 'text',
      userCanEdit: false,
      adminOnly: false
    }
  ]
};
