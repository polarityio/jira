'use strict';

polarity.export = PolarityComponent.extend({
  details: Ember.computed.alias('block.data.details'),
  timezone: Ember.computed('Intl', function () {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }),
  state: Ember.computed.alias('block._state'),
  notificationsData: Ember.inject.service('notificationsData'),
  polarityx: Ember.inject.service('polarityx'),
  windowService: Ember.inject.service('window'),
  currentUser: Ember.inject.service('currentUser'),
  searchData: Ember.inject.service('searchData'),
  flashMessages: Ember.inject.service('flashMessages'),
  permissions: Ember.computed.alias('block.data.details.permissions'),
  displayIssueFields: Ember.computed(
    'state.createIssue.selectedProjectId',
    'state.createIssue.selectedIssueType',
    function () {
      let projectId = this.get('state.createIssue.selectedProjectId');
      let issueType = this.get('state.createIssue.selectedIssueType');

      // Checks that each value is not null/undefined and not an empty string.
      // 0 will pass this check (which we want to allow).
      let isValidProject = projectId != null && projectId !== '' && typeof projectId !== 'undefined';
      let isValidIssueType = issueType != null && issueType !== '' && typeof issueType !== 'undefined';

      return isValidProject && isValidIssueType;
    }
  ),
  // Session Paging Variables
  filterValue: '',
  currentPage: 1,
  pageSize: 5,
  pagingData: Ember.computed.alias('details.issues'),
  filteredPagingData: Ember.computed('pagingData.length', 'filterValue', function () {
    // reset to page 1 when filter changes
    this.set('currentPage', 1);

    // no filtering implemented for this integration
    return this.get('pagingData');
  }),
  isPrevButtonsDisabled: Ember.computed('currentPage', function () {
    return this.get('currentPage') === 1;
  }),
  isNextButtonDisabled: Ember.computed('filteredPagingData.length', 'pageSize', 'currentPage', function () {
    const totalResults = this.get('filteredPagingData.length');
    const totalPages = Math.ceil(totalResults / this.get('pageSize'));
    return this.get('currentPage') === totalPages;
  }),
  pagingStartItem: Ember.computed('currentPage', 'pageSize', function () {
    return (this.get('currentPage') - 1) * this.get('pageSize') + 1;
  }),
  pagingEndItem: Ember.computed('pagingStartItem', function () {
    return this.get('pagingStartItem') - 1 + this.get('pageSize');
  }),
  pagedPagingData: Ember.computed('filteredPagingData.length', 'pageSize', 'currentPage', function () {
    if (!this.get('filteredPagingData')) {
      return [];
    }
    const startIndex = (this.get('currentPage') - 1) * this.get('pageSize');
    const endIndex = startIndex + this.get('pageSize');

    return this.get('filteredPagingData').slice(startIndex, endIndex);
  }),
  // End of Paging Variables
  jiraFqdn: Ember.computed('block.userOptions.baseAppUrl', 'block.userOptions.baseUrl', function () {
    const baseAppUrl = this.get('block.userOptions.baseAppUrl');
    const baseUrl = this.get('block.userOptions.baseUrl');
    return baseAppUrl ? baseAppUrl : baseUrl;
  }),
  init() {
    this._super(...arguments);
    if (!this.get('state')) {
      this.set('state', {});
      this.set('state.isDetailsLoading', true);
      this.set('state.createIssue', {});
      this.set('state.createIssue.showCreateIssue', false);
      this.set('state.createIssue.selectedProject', '');
      this.set('state.createIssue.selectedIssueType', '');
      this.set('state.createIssue.loadingProjects', false);
      //this.set('state.createIssue.lastCreatedIssue', 'PC-28');
    }
  },
  onDetailsLoaded() {
    if (this.get('details.issues')) {
      this.get('details.issues').forEach((issue, index) => {
        if (!this.get(`details.issues.${index}.__state`)) {
          this.set(`details.issues.${index}.__state`, {});
        }
      });
    }

    // only called once when the details are loaded and not
    // on each init of the component (e.g., if you toggle the details
    // open and closed this is only called the first time the details is opened).
    if (!this.isDestroyed) {
      this.set('state.isDetailsLoading', false);
    }
  },
  actions: {
    // Start Paging Actions
    prevPage() {
      let currentPage = this.get('currentPage');

      if (currentPage > 1) {
        this.set('currentPage', currentPage - 1);
      }
    },
    nextPage() {
      const totalResults = this.get('filteredPagingData.length');
      const totalPages = Math.ceil(totalResults / this.get('pageSize'));
      let currentPage = this.get('currentPage');
      if (currentPage < totalPages) {
        this.set('currentPage', currentPage + 1);
      }
    },
    firstPage() {
      this.set('currentPage', 1);
    },
    lastPage() {
      const totalResults = this.get('filteredPagingData.length');
      const totalPages = Math.ceil(totalResults / this.get('pageSize'));
      this.set('currentPage', totalPages);
    },
    // End Paging Actions
    updateIssueTransition(issueIndex, issueId, transitionId) {
      const transitionName = this.get(`pagedPagingData.${issueIndex}.transitions`).find(
        (transition) => transition.id === transitionId
      ).name;
      const payload = {
        action: 'UPDATE_TRANSITION',
        issueId,
        transitionId
      };

      this.setIssueState(issueIndex, 'updating', true);
      this.sendIntegrationMessage(payload)
        .then((result) => {
          this.flashMessage(`Status updated to "${transitionName}"`, 'success');
          this.set(`pagedPagingData.${issueIndex}.fields.status`, result.status);
        })
        .catch((err) => {
          console.error(err);
          this.flashMessage(`Failed to update status`, 'error');
        })
        .finally(() => {
          this.setIssueState(issueIndex, 'updating', false);
        });
    },
    addComment(issueIndex, issueId, comment) {
      if (!comment && !this.get(`pagedPagingData.${issueIndex}.__state.showIntegrationData`)) {
        this.set(`pagedPagingData.${issueIndex}.__state.commentTextError`, `A comment is required`);
        return;
      }

      const includeIntegrationData = this.get(`pagedPagingData.${issueIndex}.__state.showIntegrationData`);
      let selectedIntegrations = [];
      let annotations;
      if (this.get(`pagedPagingData.${issueIndex}.__state.integrations`)) {
        selectedIntegrations = this.get(`pagedPagingData.${issueIndex}.__state.integrations`).filter(
          (integration) => integration.selected && !integration.isAnnotations
        );
        annotations = this.get(`pagedPagingData.${issueIndex}.__state.integrations`).find(
          (integration) => integration.selected && integration.isAnnotations
        );
      }

      if (includeIntegrationData && selectedIntegrations.length === 0 && !annotations) {
        this.set(`pagedPagingData.${issueIndex}.__state.missingIntegrations`, true);
        return;
      }

      this.setIssueState(issueIndex, 'updating', true);
      this.setIssueState(issueIndex, 'savingComment', true);
      const payload = {
        action: 'ADD_COMMENT',
        issueId,
        comment,
        includeIntegrationData,
        username: this.currentUser.user.username,
        email: this.currentUser.user.email,
        entity: this.get('block.entity')
      };

      if (payload.includeIntegrationData) {
        payload.integrationData = selectedIntegrations;
        payload.annotations = annotations;
      }

      this.sendIntegrationMessage(payload)
        .then((result) => {
          this.flashMessage(`Successfully added comment`, 'success');
          const comments = this.get(`pagedPagingData.${issueIndex}.comments`);
          const newComments = [...result.comments, ...comments];
          // New array reference here triggers a template refresh
          this.set(`pagedPagingData.${issueIndex}.comments`, newComments);
          this.setIssueState(issueIndex, 'commentText', '');
          this.setIssueState(issueIndex, 'showAddComment', false);
        })
        .catch((err) => {
          console.error(err);
          this.flashMessage(`Failed to add comment`, 'danger');
        })
        .finally(() => {
          this.setIssueState(issueIndex, 'updating', false);
          this.setIssueState(issueIndex, 'savingComment', false);
        });
    },
    cancelComment(issueIndex) {
      this.setIssueState(issueIndex, 'commentText', '');
      this.setIssueState(issueIndex, 'showAddComment', false);
    },
    clearFlashMessage(issueIndex) {
      this.setIssueState(issueIndex, 'flashMessage', '');
    },
    loadProjects() {
      this.clearErrors();

      // Only loadProjects if we haven't already loaded them
      if (this.get('state.createIssue.projects')) {
        return;
      }
      const payload = {
        action: 'GET_PROJECTS'
      };
      this.set('state.createIssue.loadingProjects', true);
      this.sendIntegrationMessage(payload)
        .then((result) => {
          this.set('state.createIssue.projects', result.projects);
          this.set('state.createIssue.selectedIssueType', '');
        })
        .catch((e) => {
          console.error('Failed to load projects', e);
          this.flashMessage(`Failed to load projects`, 'danger');
          this.set('state.createIssue.errorMessage', JSON.stringify(e, null, 2));
          this.set('state.createIssue.errorTitle', 'Failed to load projects');
        })
        .finally(() => {
          this.set('state.createIssue.loadingProjects', false);
        });
    },
    loadIssueTypes() {
      this.clearErrors();

      this.set('state.createIssue.selectedIssueType', '');
      const payload = {
        action: 'GET_ISSUE_TYPES',
        projectId: this.get('state.createIssue.selectedProjectId')
      };
      this.set('state.createIssue.loadingIssueTypes', true);
      this.sendIntegrationMessage(payload)
        .then((result) => {
          this.set('state.createIssue.issueTypes', result.issueTypes);
        })
        .catch((e) => {
          console.error('Failed to load projects', e);
          this.flashMessage(`Failed to load issue types`, 'danger');
          this.set('state.createIssue.errorMessage', JSON.stringify(e, null, 2));
          this.set('state.createIssue.errorTitle', 'Failed to load issue types');
        })
        .finally(() => {
          this.set('state.createIssue.loadingIssueTypes', false);
        });
    },
    loadIssueFields(projectId, issueType) {
      this.clearErrors();

      const payload = {
        action: 'GET_ISSUE_FIELDS',
        projectId,
        issueType
      };
      this.set('state.createIssue.loadingIssueFields', true);
      return this.sendIntegrationMessage(payload)
        .then((result) => {
          this.set('state.createIssue.issueFields', result.issueFields);
        })
        .catch((e) => {
          console.error('Failed to load issue field meta', e);
          this.flashMessage(`Failed to load issue fields`, 'danger');
          this.set('state.createIssue.errorMessage', JSON.stringify(e, null, 2));
          this.set('state.createIssue.errorTitle', 'Failed to load issue fields');
        })
        .finally(() => {
          this.set('state.createIssue.loadingIssueFields', false);
        });
    },
    createIssue() {
      this.clearErrors();

      if (!this.validateRequiredIssueFields()) {
        this.set('state.createIssue.shortErrorMessage', 'Missing required fields');
        return;
      }
      const includeIntegrationData = this.get('state.createIssue.showIntegrationData');
      let selectedIntegrations = [];
      let annotations;
      if (this.get('state.createIssue.integrations')) {
        selectedIntegrations = this.get('state.createIssue.integrations').filter(
          (integration) => integration.selected && !integration.isAnnotations
        );
        annotations = this.get('state.createIssue.integrations').find(
          (integration) => integration.selected && integration.isAnnotations
        );
      }

      if (includeIntegrationData && selectedIntegrations.length === 0 && !annotations) {
        this.set('state.createIssue.missingIntegrations', true);
        return;
      }

      this.set('state.createIssue.isCreatingIssue', true);
      const payload = {
        action: 'ADD_ISSUE',
        projectId: this.get('state.createIssue.selectedProjectId'),
        issueType: this.get('state.createIssue.selectedIssueType'),
        fields: this.get('state.createIssue.issueFields').filter((field) => field.__isRendered),
        includeIntegrationData,
        username: this.currentUser.user.username,
        email: this.currentUser.user.email,
        entity: this.get('block.entity')
      };

      if (payload.includeIntegrationData) {
        payload.integrationData = selectedIntegrations;
        payload.annotations = annotations;
      }

      this.sendIntegrationMessage(payload)
        .then((result) => {
          this.flashMessage(`Issue ${result.issue.key} created successfully`, 'success');
          this.set('state.createIssue.lastCreatedIssue', result.issue.key);
          this.set(`state.createIssue.showCreateIssue`, false);
          this.clearCreateIssueFields();
        })
        .catch((e) => {
          console.error('Failed to create issue', e);
          this.flashMessage(`Failed to create issue`, 'danger');
          this.set('state.createIssue.errorMessage', JSON.stringify(e, null, 2));
          this.set('state.createIssue.errorTitle', 'Failed to create issue');
        })
        .finally(() => {
          this.set('state.createIssue.isCreatingIssue', false);
        });
    },
    clearCreateIssueFields() {
      this.clearCreateIssueFields();
    },
    createIssueIntegrationSelected() {
      this.setNumSelectedIntegrations();
    },
    addCommentIntegrationSelected(issueIndex) {
      this.setNumSelectedIntegrations(issueIndex);
    },
    runSearchInPolarity(searchTerm) {
      //Run on demand search pivot, same as clicking the "Search Selected Node" button
      if (this.windowService.isClientWindow) {
        //Trigger Search in Polarity Desktop Client
        this.polarityx.requestOnDemandLookup(searchTerm);
      } else {
        //Trigger Search in Web UI
        this.searchData.getSearchResults(searchTerm);
      }
    },
    refreshIntegrations: function (issueIndex) {
      if (issueIndex !== undefined) {
        this.setIssueState(issueIndex, 'spinRefresh', true);
      } else {
        this.set('state.createIssue.spinRefresh', true);
      }
      this.setIntegrationSelection(issueIndex);
      setTimeout(() => {
        if (!this.isDestroyed) {
          if (issueIndex !== undefined) {
            this.setIssueState(issueIndex, 'spinRefresh', false);
          } else {
            this.set('state.createIssue.spinRefresh', false);
          }
        }
      }, 1000);
    },
    toggleAllIntegrations: function (issueIndex) {
      let integrations;
      if (issueIndex !== undefined) {
        integrations = this.get(`pagedPagingData.${issueIndex}.__state.integrations`);
      } else {
        integrations = this.get('state.createIssue.integrations');
      }

      const hasUnSelected = integrations.some((integration) => !integration.selected);
      if (hasUnSelected) {
        // toggle all integrations on if at least one integration is not selected
        integrations.forEach((integration, index) => {
          if (issueIndex !== undefined) {
            this.setIssueState(issueIndex, `integrations.${index}.selected`, true);
          } else {
            this.set(`state.createIssue.integrations.${index}.selected`, true);
          }
        });
      } else {
        // all integrations are selected so toggle them all off
        integrations.forEach((integration, index) => {
          if (issueIndex !== undefined) {
            this.setIssueState(issueIndex, `integrations.${index}.selected`, false);
          } else {
            this.set(`state.createIssue.integrations.${index}.selected`, false);
          }
        });
      }
      this.setNumSelectedIntegrations(issueIndex);
    }
  },
  setNumSelectedIntegrations(issueIndex) {
    let integrations;
    if (issueIndex !== undefined) {
      integrations = this.get(`pagedPagingData.${issueIndex}.__state.integrations`);
      let numSelected = this.getNumSelectedIntegration(integrations);
      this.setIssueState(issueIndex, 'numSelectedWriteIntegrations', numSelected);
    } else {
      integrations = this.get('state.createIssue.integrations');
      let numSelected = this.getNumSelectedIntegration(integrations);
      this.set('state.createIssue.numSelectedWriteIntegrations', numSelected);
    }
  },
  getNumSelectedIntegration(integrations) {
    let selectedCount = 0;
    if (integrations) {
      integrations.forEach((integration) => {
        if (integration.selected) {
          selectedCount++;
        }
      });
    }
    return selectedCount;
  },
  /**
   * Flash a message on the screen for a specific issue
   * @param message
   * @param type 'info', 'danger', or 'success'
   */
  flashMessage(message, type = 'info') {
    this.flashMessages.add({
      message: `${this.block.acronym}: ${message}`,
      type: `unv-${type}`,
      icon: type === 'success' ? 'check-circle' : type === 'danger' ? 'exclamation-circle' : 'info-circle',
      timeout: 3000
    });
  },
  validateRequiredIssueFields() {
    let valid = true;
    this.get('state.createIssue.issueFields').forEach((field, fieldIndex) => {
      if (field.__isRendered && field.required && !field.__value) {
        this.set(`state.createIssue.issueFields.${fieldIndex}.__error`, `${field.name} is a required field.`);
        valid = false;
      }
    });

    return valid;
  },
  clearCreateIssueFields() {
    this.get('state.createIssue.issueFields').forEach((field) => {
      if (field.__isRendered && field.__value) {
        field.__value = '';
      }
    });
  },
  clearErrors() {
    this.set('state.createIssue.missingIntegrations', false);
    this.set('state.createIssue.errorMessage', '');
    this.set('state.createIssue.errorTitle', '');
    const issueFields = this.get('state.createIssue.issueFields');
    if (issueFields) {
      issueFields.forEach((field, fieldIndex) => {
        if (field.__isRendered) {
          this.set(`state.createIssue.issueFields.${fieldIndex}.__error`, '');
        }
      });
    }
  },
  setIntegrationSelection: function (issueIndex) {
    let integrationData = this.getIntegrationData();
    let annotations = this.getAnnotations();
    if (Array.isArray(annotations) && annotations.length > 0) {
      integrationData.unshift({
        integrationName: 'Polarity Annotations',
        data: annotations,
        selected: false,
        isAnnotations: true
      });
    }
    if (issueIndex !== undefined) {
      this.setIssueState(issueIndex, 'integrations', integrationData);
      this.setNumSelectedIntegrations(issueIndex);
    } else {
      this.set('state.createIssue.integrations', integrationData);
      this.setNumSelectedIntegrations();
    }
  },
  setIssueState: function (issueIndex, key, value) {
    if (!this.get(`pagedPagingData.${issueIndex}.__state`)) {
      this.set(`pagedPagingData.${issueIndex}.__state`, {});
    }
    this.set(`pagedPagingData.${issueIndex}.__state.${key}`, value);
  },
  getIntegrationData: function () {
    const notificationList = this.notificationsData.getNotificationList();
    const integrationBlocks = notificationList.findByValue(this.get('block.entity.value').toLowerCase());
    return integrationBlocks.blocks.reduce((accum, block) => {
      if (block.integrationName !== this.get('block.integrationName') && block.type !== 'polarity') {
        accum.push({
          integrationName: block.integrationName,
          data: block.data,
          selected: false
        });
      }
      return accum;
    }, []);
  },
  getAnnotations: function () {
    const notificationList = this.notificationsData.getNotificationList();
    const integrationBlocks = notificationList.findByValue(this.get('block.entity.value').toLowerCase());
    const polarityBlock = integrationBlocks.blocks.find((block) => {
      if (block.type === 'polarity') {
        return block;
      }
    });
    if (polarityBlock) {
      let annotations = [];
      polarityBlock.tagEntityPairs.forEach((pair) => {
        annotations.push({
          tag: pair.tag.tagName,
          channel: pair.channel.channelName,
          user: pair.get('user.username'),
          applied: pair.applied
        });
      });
      return annotations;
    }
    return null;
  }
});
