/*
* adapt-contrib-mcq
* License - http://github.com/adaptlearning/adapt_framework/LICENSE
* Maintainers - Daryl Hedley <darylhedley@gmail.com>
*/
define(function(require) {
    var QuestionView = require('coreViews/questionView');
    var Adapt = require('coreJS/adapt');

    var Mcq = QuestionView.extend({

        events: {
            'focus .mcq-item input':'onItemFocus',
            'blur .mcq-item input':'onItemBlur',
            'change .mcq-item input':'onItemSelected',
            'keyup .mcq-item input':'onKeyPress'
        },

        resetQuestionOnRevisit: function() {
            this.setAllItemsEnabled(true);
            this.resetQuestion();
        },

        // Left blank for question setup
        setupQuestion: function() {
             _.each(this.model.get("_items"), function(item, index) {
               item._index = index;
            });

            // Set selectedItem array
            this.model.set('_selectedItems', []);

            this.restoreSelectionData();
            // Radio button or checkbox
            this.model.set("_isRadio", (this.model.get("_selectable") == 1) );

            // Check if items need to be randomised
            if (this.model.get('_isRandom') && this.model.get('_isEnabled')) {
                this.model.set("_items", _.shuffle(this.model.get("_items")));
            }
            this.storeUserAnswer();
            
        },


        restoreSelectionData: function() {
            var items = this.model.get("_items");
            var selectionData = this.model.get("_selectionData");
            if (selectionData === undefined) return;
            var selectedItems = [];
            _.each(items, function(item, index) {
                item._isSelected = selectionData[item._index];
                if (item._isSelected) {
                    selectedItems.push(item);
                }
            });
            this.model.set('_selectedItems', selectedItems);
            this.setupFeedback();
            this.isCorrect();
        },

        disableQuestion: function() {
            this.setAllItemsEnabled(false);
        },

        enableQuestion: function() {
            this.setAllItemsEnabled(true);
        },

        setAllItemsEnabled: function(isEnabled) {
            _.each(this.model.get('_items'), function(item, index){
                var $itemLabel = this.$('label').eq(index);
                var $itemInput = this.$('input').eq(index);

                if (isEnabled) {
                    $itemLabel.removeClass('disabled');
                    $itemInput.prop('disabled', false);
                } else {
                    $itemLabel.addClass('disabled');
                    $itemInput.prop('disabled', true);
                }
            }, this);
        },

        onQuestionRendered: function() {
            this.setReadyStatus();
        },

        //////
        // Place your interactive code here
        ////

        onKeyPress: function(event) {
            if (event.which === 13) {
                this.onItemSelected(event);
            }
        },

        onItemFocus: function(event) {
            $("label[for='"+$(event.currentTarget).attr('id')+"']").addClass('highlighted');
        },
        
        onItemBlur: function(event) {
            $("label[for='"+$(event.currentTarget).attr('id')+"']").removeClass('highlighted');
        },

        onItemSelected: function(event) {
            if(this.model.get('_isEnabled') && !this.model.get('_isSubmitted')){
                var selectedItemObject = this.model.get('_items')[$(event.currentTarget).parent('.component-item').index()];
                this.toggleItemSelected(selectedItemObject, event);
            }
        },

        toggleItemSelected:function(item, clickEvent) {
            var selectedItems = this.model.get('_selectedItems');
            var itemIndex = _.indexOf(this.model.get('_items'), item),
                $itemLabel = this.$('label').eq(itemIndex),
                $itemInput = this.$('input').eq(itemIndex),
                selected = !$itemLabel.hasClass('selected');
            
            if(selected) {
                if(this.model.get('_selectable') === 1){
                    this.$('label').removeClass('selected');
                    this.$('input').prop('checked', false);
                    this.deselectAllItems();
                    selectedItems[0] = item;
                } else if(selectedItems.length < this.model.get('_selectable')) {
                    selectedItems.push(item);
                } else {
                    clickEvent.preventDefault();
                    return;
                }
                $itemLabel.addClass('selected');
                $itemLabel.a11y_selected(true);
            } else {
                selectedItems.splice(_.indexOf(selectedItems, item), 1);
                $itemLabel.removeClass('selected');
                $itemLabel.a11y_selected(false);
            }
            $itemInput.prop('checked', selected);
            item._isSelected = selected;
            this.model.set('_selectedItems', selectedItems);
        },

        // Use to check if the user is allowed to submit the question
        // Maybe the user has to select an item?
        canSubmit: function() {
            var count = 0;

            _.each(this.model.get('_items'), function(item) {
                if (item._isSelected) {
                    count++;
                }
            }, this);

            return (count > 0) ? true : false;

        },

        // Blank method to add functionality for when the user cannot submit
        // Could be used for a popup or explanation dialog/hint
        onCannotSubmit: function() {},

        // This is important for returning or showing the users answer
        // This should preserve the state of the users answers
        storeUserAnswer: function() {
            var userAnswer = [];
            var items = this.model.get('_items');
            var selectionData = new Array(items.length);
            
            _.each(items, function(item, index) {
                userAnswer.push(item._isSelected);
                selectionData[item._index] = (item._isSelected === true);
            }, this);
            this.model.set('_userAnswer', userAnswer);
            this.model.set('_selectionData', selectionData)
        },

        isCorrect: function() {

            var numberOfCorrectItems = 0;
            var numberOfCorrectAnswers = 0;
            var numberOfIncorrectAnswers = 0;

            

            _.each(this.model.get('_items'), function(item, index) {

                // Set item._isSelected to either true or false
                var itemSelected = (item._isSelected || false);

                if (item._shouldBeSelected) {
                    // Adjust number of correct items
                    numberOfCorrectItems ++;

                    if (itemSelected) {
                        // If the item is selected adjust correct answer
                        numberOfCorrectAnswers ++;
                        // Set item to correct - is used for returning to this component
                        item._isCorrect = true;
                        // Set that at least one correct answer has been selected
                        // Used in isPartlyCorrect method below
                        this.model.set('_isAtLeastOneCorrectSelection', true);

                    }

                } else if (!item._shouldBeSelected && itemSelected) {
                    // If an item shouldn't be selected and is selected
                    // Adjust incorrect answers

                    numberOfIncorrectAnswers ++;

                }

                
            }, this);

            this.model.set('_numberOfCorrectAnswers', numberOfCorrectAnswers);

            // Check if correct answers matches correct items and there are no incorrect selections
            if (numberOfCorrectAnswers === numberOfCorrectItems && numberOfIncorrectAnswers === 0) {
                return true;
            } else {
                return false;
            }
            
        },

        // Sets the score based upon the questionWeight
        // Can be overwritten if the question needs to set the score in a different way
        setScore: function() {

            var questionWeight = this.model.get("_questionWeight");

            if (this.model.get('_isCorrect')) {
                this.model.set('_score', questionWeight);
                return;
            }
            
            var numberOfCorrectAnswers = this.model.get('_numberOfCorrectAnswers');
            var itemLength = this.model.get('_items').length;

            var score = questionWeight * numberOfCorrectAnswers / itemLength;

            this.model.set('_score', score);

        },

        // This is important and should give the user feedback on how they answered the question
        // Normally done through ticks and crosses by adding classes
        showMarking: function() {
            _.each(this.model.get('_items'), function(item, i) {
                var $item = this.$('.component-item').eq(i);
                $item.addClass(item._isCorrect ? 'correct' : 'incorrect');
            }, this);
        },

        isPartlyCorrect: function() {
            return this.model.get('_isAtLeastOneCorrectSelection');
        },

        resetUserAnswer: function() {
            this.model.set({_userAnswer: []});
        },

        // Used by the question view to reset the look and feel of the component.
        // This could also include resetting item data
        resetQuestion: function() {
            this.model.set('feedbackMessage', undefined);
            this.deselectAllItems();
            this.resetItems();

        },

        deselectAllItems: function() {
            this.$el.a11y_selected(false);
            _.each(this.model.get('_items'), function(item) {
                item._isSelected = false;
            }, this);
        },

        resetItems: function() { 
            this.$('.component-item label').removeClass('selected');
            this.$('.component-item').removeClass('correct incorrect');
            this.$('input').prop('checked', false);
            this.model.set({
                _selectedItems: [],
                _isAtLeastOneCorrectSelection: false
            });
        },

        showCorrectAnswer: function() {
            
            _.each(this.model.get('_items'), function(item, index) {
                this.setOptionSelected(index, item._shouldBeSelected, item._shouldBeSelected === this.model.get('_userAnswer')[index]);
            }, this);
        },

        setOptionSelected:function(index, selected, correct) {
            var $itemLabel = this.$('label').eq(index);
            var $itemInput = this.$('input').eq(index);
            if (selected) {
                $itemLabel.addClass('selected');
                $itemInput.prop('checked', true);
            } else {
                $itemLabel.removeClass('selected');
                $itemInput.prop('checked', false);
            }

        },

        hideCorrectAnswer: function() {
            
            _.each(this.model.get('_items'), function(item, index) {
                this.setOptionSelected(index, this.model.get('_userAnswer')[index], item._shouldBeSelected === this.model.get('_userAnswer')[index]);
            }, this);
        }

    });

    Adapt.register("mcq", Mcq);

    return Mcq;
});