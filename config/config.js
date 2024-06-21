module.exports = {
  /**
   * Name of the integration which is displayed in the Polarity integrations user interface
   * @type String
   * @required
   */
  name: 'Jira',

  /**
   * The acronym that appears in the notification window when information from this integration
   * is displayed.  Note that the acronym is included as part of each "tag" in the summary information
   * for the integration.  As a result, it is best to keep it to 4 or less characters.  The casing used
   * here will be carried forward into the notification window.
   *
   * @type String
   * @required
   */
  acronym: 'JIRA',

  /**
   * Description for this integration which is displayed in the Polarity integrations user interface
   *
   * @type String
   * @optional
   */
  description: 'Lookup Jira issues by key or search across Jira issues by IP, domain, email, hash, url, or CVE',
  customTypes: [
    {
      key: 'jira',
      regex: /[A-Z]{1,10}-\d{1,10}/
    }
    // {
    //   key: 'possiblyDefangedUrl',
    //   regex:
    //     /(?:\w+(?:(?:\[:\]\/\/)|(?::\/\/)|(?:\[:\/\/\])))?(?:\w+\.|(?:\w+\[\.\]))+\w+(?:\/(?:[\/=\.\[\]\w&#@$%?-])*)?/
    // }
  ],
  entityTypes: ['domain', 'email', 'IPv4', 'IPv6', 'url', 'hash', 'cve'],
  defaultColor: 'light-blue',
  logging: {
    level: 'info' //trace, debug, info, warn, error, fatal
  },
  request: {
    // Provide the path to your certFile. Leave an empty string to ignore this option.
    // Relative paths are relative to the integration's root directory
    cert: '',
    // Provide the path to your private key. Leave an empty string to ignore this option.
    // Relative paths are relative to the integration's root directory
    key: '',
    // Provide the key passphrase if required.  Leave an empty string to ignore this option.
    // Relative paths are relative to the integration's root directory
    passphrase: '',
    // Provide the Certificate Authority. Leave an empty string to ignore this option.
    // Relative paths are relative to the integration's root directory
    ca: '',
    // An HTTP proxy to be used. Supports proxy Auth with Basic Auth, identical to support for
    // the url parameter (by embedding the auth info in the uri)
    proxy: ''
  },

  /**
   * An array of style files (css or less) that will be included for your integration. Any styles specified in
   * the below files can be used in your custom template.
   *
   * @type Array
   * @optional
   */
  styles: ['./styles/styles.less'],
  /**
   * Provide custom component logic and template for rendering the integration details block.  If you do not
   * provide a custom template and/or component then the integration will display data as a table of key value
   * pairs.
   *
   * @type Object
   * @optional
   */
  block: {
    component: {
      file: './components/block.js'
    },
    template: {
      file: './templates/block.hbs'
    }
  },
  /**
   * Options that are displayed to the user/admin in the Polarity integration user-interface.  Should be structured
   * as an array of option objects.
   *
   * @type Array
   * @optional
   */
  options: [
    {
      key: 'baseUrl',
      name: 'Jira API URL',
      description:
        'URL used to access the REST API of your Jira instance. For Jira Cloud this will typically be `https://<your-jira-instance>.atlassian.net`. This option must be set to "Users can view only" or "Users can view and edit".  ',
      default: '',
      type: 'text',
      userCanEdit: false,
      adminOnly: false
    },
    {
      key: 'baseAppUrl',
      name: 'Jira Application URL',
      description:
        'URL used to access your Jira web application instance. Leave blank if your Application URL is the same as your API URL.  Jira Cloud users can leave this option blank. This option must be set to "Users can view only" or "Users can view and edit".',
      default: '',
      type: 'text',
      userCanEdit: false,
      adminOnly: false
    },
    {
      key: 'userName',
      name: 'Jira Email Address',
      description: 'Email address used for individual to access Jira.  Only required when authenticating to Jira Cloud.',
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
        'A comma delimited list of project names to search.  Project short names can be used in addition to the long names.  Project names are not case-sensitive. ' +
        'If no value is provided, all accessible projects will be searched.  This setting does not affect searches on Jira Issue Keys and is only used for searches on other entities (e.g., IP, domain, cve, etc.).',
      default: '',
      type: 'text',
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
