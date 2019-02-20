'use strict'
polarity.export = PolarityComponent.extend({
  details: Ember.computed.alias('block.data.details'),

  showComments: Ember.computed('details.fields.comment.comments.length', function() {
    const detailsLength = this.get('details.fields.comment.comments.length');
    const viewState = Ember.A();
    for (let i = 0; i < detailsLength; i++) {
      viewState.push(false);
    }
    return viewState;
  }),
    actions: {
      toggleScanner() {
            this.toggleProperty('isShowingDiv');
        },
      toggleVisibility() {
      this.toggleProperty('showComments');
    }
    }
});
