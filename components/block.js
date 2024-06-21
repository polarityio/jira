'use strict';

polarity.export = PolarityComponent.extend({
  details: Ember.computed.alias('block.data.details'),
  timezone: Ember.computed('Intl', function () {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }),
  jiraFqdn: Ember.computed('block.userOptions.baseAppUrl', 'block.userOptions.baseUrl', function () {
    const baseAppUrl = this.get('block.userOptions.baseAppUrl');
    const baseUrl = this.get('block.userOptions.baseUrl');
    return baseAppUrl ? baseAppUrl : baseUrl;
  }),
  actions: {
    toggleComments(issueIndex) {
      this.toggleProperty(`details.issues.${issueIndex}.__showComments`);
    },
    toggleDescription(issueIndex) {
      this.toggleProperty(`details.issues.${issueIndex}.__showDescription`);
    }
  }
});
