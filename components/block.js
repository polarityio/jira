'use strict';

polarity.export = PolarityComponent.extend({
  details: Ember.computed.alias('block.data.details'),
  timezone: Ember.computed('Intl', function () {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }),
  state: Ember.computed.alias('block._state'),
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
    }
  },
  onDetailsLoaded() {
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
    toggleDescription(issueIndex) {
      this.toggleProperty(`details.issues.${issueIndex}.__showDescription`);
    }
  }
});
