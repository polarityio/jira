'use strict'
polarity.export = PolarityComponent.extend({
  details: Ember.computed.alias('block.data.details'),

  allIssues: Ember.computed('details.issues', function() {
    let issue = Ember.A();
    if (this.get('details.issues')) {
      issue.push("Number of Issues: " + this.get('details.issues').length);
    }
    return issue;
  }),

  singleIssues: Ember.computed('details', function() {
    let issueData = Ember.A();
    if (this.get('details.fields')) {
      issueData.push("Ticket Status: " + this.get('details.fields.status.name'));
      issueData.push("Issue Type: " + this.get('details.fields.issuetype.name'));
      issueData.push(this.get('details.fields.summary'));
      issueData.push("Assignee: " + this.get('details.fields.assignee.displayName'));
    }
    return issueData;
  }),

});
