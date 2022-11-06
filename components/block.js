'use strict';

polarity.export = PolarityComponent.extend({
  details: Ember.computed.alias('block.data.details'),
  timezone: Ember.computed("Intl", function () {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }),
  actions: {
    toggleComments(issueIndex) {
      this.toggleProperty(`details.issues.${issueIndex}.__showComments`)
    },
    toggleDescription(issueIndex){
      this.toggleProperty(`details.issues.${issueIndex}.__showDescription`)
    }
  }
});
