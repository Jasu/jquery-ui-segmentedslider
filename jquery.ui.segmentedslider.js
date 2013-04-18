/* Slider with multiple slider segments */
(function($) {
  $.widget('ui.segmentedslider', {
    version: '0.1',

    options: {
      value: 0,

      segments: [ { min: 0, max: 1, step: null } ],

      minValueWidth: 20,

      segmentClasses: ['ui-slider', 
                    'ui-slider-horizontal', 
                    'ui-corner-all',
                    'ui-segmentedslider-segment',
                    'ui-state-default'
                    ],

      handleClasses: ['ui-slider-handle', 
                      'ui-corner-all',
                      'ui-state-default',
                      'ui-segmentedslider-handle'],

      /* Callbacks */
      slide: null,
      start: null,
      stop: null,

      epsilon: 0.00001
    },

    _isChangingSegments : false,

    _handle : null,

    /* X-coordinate where the user has grabbed the slider handle at */
    _dragPosition: 0,

    _createSegment: function (segmentOptions, isFirst, isLast)
    {
      var t = this;
      var type = 'continuous';
      if (('step' in segmentOptions) && segmentOptions.step > 0)
        type = 'stepped';
      else if ('values' in segmentOptions)
        type = 'discrete';

      var segment = $('<div/>')
        .data('segmentedslider-options', segmentOptions)
        .data('segmentedslider-type', type)
        .appendTo(this.element)
        .click(function (e) {
          if (!$(e.target).is(this))
            return;
          var offset = e.offsetX - t._handle.outerWidth() / 2;
          if ($(this).data('segmentedslider-type') == 'stepped'
            || $(this).data('segmentedslider-type') == 'discrete')
          {
            var numSteps, 
                segmentOptions = $(this).data('segmentedslider-options');
            if ($(this).data('segmentedslider-type') == 'stepped')
              numSteps = Math.floor((segmentOptions.max - segmentOptions.min) / segmentOptions.step) + 1;
            else
              numSteps = segmentOptions.values.length;

            var gridLength = Math.floor(($(this).innerWidth() - t._handle.outerWidth()) / (numSteps - 1));
            offset = Math.round(gridLength * Math.round(offset / gridLength));
          }
          $(t._handle)
            .css('left', offset)
            .draggable('destroy')
            .appendTo($(this));
          t._setDraggable(t._handle);

          t.options.value = t._calculateValue();

          if (t.options.start)
            t.options.start(e, { handle: t._handle, value: t.options.value});
          if (t.options.slide)
            t.options.slide(e, { handle: t._handle, value: t.options.value});
          if (t.options.stop)
            t.options.stop(e, { handle: t._handle, value: t.options.value});
        });

      if (isFirst) segment.addClass('ui-segmentedslider-first');
      if (isLast) segment.addClass('ui-segmentedslider-last');

      $.each(this.options.segmentClasses, function (i,e) { segment.addClass(e); });
    },

    _resizeSegments: function ()
    {
      var // Sum of all margins before, after and between the elements.
          sumMargins = 0,

          // Sum of outer widths of all segments.
          sumOuterWidths = 0,

          // Sum of inner widths of all segments.
          sumInnerWidths = 0,

          // Right margin of the segment handled in the previous iteration
          lastMarginRight = 0,

          // Sum of supposed widths of all 'discrete' segments.
          sumDiscreteWidths = 0,

          //Sum of numerical (absolute) lenghts of all ranges.
          sumRanges = 0,
          
          //Set of all segments.
          $segments = $(this.element).children(),
          
          t = this;

      //Calculate the "neutral" widths of all segments.
      $segments.each(function (i, e) {
          var $e = $(e);
          var marginLeft = parseInt($e.css('margin-left'), 10);
          if (lastMarginRight > marginLeft)
            sumMargins += lastMarginRight;
          else
            sumMargins += marginLeft;
          sumOuterWidths += parseInt($e.outerWidth(), 10);
          sumInnerWidths += parseInt($e.innerWidth(), 10);
          lastMarginRight += parseInt($e.css('margin-right'), 10);

          if ($e.data('segmentedslider-type') === 'discrete')
          {
            sumDiscreteWidths += t.options.minValueWidth 
              * ($e.data('segmentedslider-options').values.length - 1);
          }
          else
          {
            sumRanges += Math.abs($e.data('segmentedslider-options').max
                - $e.data('segmentedslider-options').min);
          }
        });

      sumMargins += lastMarginRight;

      var availableWidth = parseInt($(this.element).innerWidth(), 10);
      availableWidth -= sumMargins;
      availableWidth -= sumOuterWidths - sumInnerWidths;
      availableWidth -= sumDiscreteWidths;

      var widthPerRange = availableWidth / sumRanges;

      //Set widths
      $segments.each(function (i, e) {
        var $e = $(e), width = 0;
        var segmentOptions = $e.data('segmentedslider-options');
        switch ($e.data('segmentedslider-type'))
        {
          case 'discrete':
            width = t.options.minValueWidth * (segmentOptions.values.length - 1);
            break;
          case 'stepped':
          case 'continuous':
            width = widthPerRange * Math.abs(segmentOptions.max - segmentOptions.min);
            break;
        }

        $e.css('width', width + 'px');
      });
    },

    _createSegments: function () {
      var t = this;
      var numAdded = 0, numLeft = this.options.segments.length;
      $.each(this.options.segments, function (i, e) {
        --numLeft;
        t._createSegment(e, /*isFirst=*/numAdded == 0, numLeft == 0);
        ++numAdded;
      });

      this._resizeSegments();
    },

    _findSegment: function (value) {
      var t = this, 
          $segments = $(this.element).children(),
          result = null;
      $segments.each(function (i, e) {
        var $e = $(e),
            sliderOptions = $e.data('segmentedslider-options');
        switch ($e.data('segmentedslider-type')) {
          case 'continuous':
            if (sliderOptions.min <= value && sliderOptions.max >= value)
              result = $e;
            break;
          case 'stepped':
            if (sliderOptions.min <= value && sliderOptions.max >= value)
            {
              var numSteps = (value - sliderOptions.min) / sliderOptions.step;
              if (Math.abs(numSteps - parseInt(numSteps, 10)) 
                < t.options.epsilon)
              {
                result = $e;
              }
            }
            break;
          case 'discrete':
            if (sliderOptions.values.indexOf(value) > -1)
            {
              result = $e;
            }
            break;
        }
      });
      return result;
    },

    _calculateValue: function () {
      var handle = $(this.element).find('.ui-segmentedslider-handle');
      var segment = handle.parent();
      var fullWidth = segment.innerWidth() - handle.outerWidth();
      var position = handle.position().left;
      var relativePosition = position / fullWidth;
      var segmentOptions = segment.data('segmentedslider-options');
      switch (segment.data('segmentedslider-type'))
      {
        case 'continuous':
          return segmentOptions.min 
            + (segmentOptions.max - segmentOptions.min) * relativePosition;
        case 'stepped':
          var numSteps = 
            Math.ceil((segmentOptions.max - segmentOptions.min) / segmentOptions.step) + 1;
          var stepLength = 1.0 / (numSteps - 1.0);
          var selection = Math.round(relativePosition / stepLength);
          return segmentOptions.min + segmentOptions.step * selection;
        case 'discrete':
          var stepLength = 1.0 / (segmentOptions.values.length - 1.0);
          var selection = Math.round(relativePosition / stepLength)
          return segmentOptions.values[selection];
      }
    },

    _repositionHandle: function (pageX)
    {
      var handle = $(this.element).find('.ui-segmentedslider-handle');
      var segment = handle.parent();
      var fullWidth = segment.innerWidth() - handle.outerWidth();
      var offsetX = pageX - segment.offset().left 
        - parseInt(segment.css('left'), 10) 
        - parseInt(segment.css('margin-left'), 10)
        - parseInt(segment.css('padding-left', 10));
    },

    _handleSegmentSwitch: function (e) {
      var handle = $(this.element).find('.ui-segmentedslider-handle');
      var currentSegment = handle.parent();
      var dragX = e.pageX;
      var newSegment;

      this.element.children().each(function(i,e) {
        var $e = $(e);
        if ($e.offset().left <= dragX 
          && $e.offset().left + $e.outerWidth() > dragX)
        {
          newSegment = $e;
        }
      });

      if (newSegment && !newSegment.is(currentSegment))
      {
        //@TODO handle em units
        var newSegmentX = dragX;
        newSegmentX -= newSegment.offset().left;
        if (newSegment.css('left') != 'auto')
          newSegmentX -= parseInt(newSegment.css('left'), 10);
        if (newSegment.css('margin-left') != 'auto')
          newSegmentX -= parseInt(newSegment.css('margin-left'), 10);
        newSegmentX -= this._dragPosition;

        if (newSegmentX < 0 
          || newSegmentX > newSegment.innerWidth() - this._handle.outerWidth())
        {
          return true;
        }

        //Snap to grid
        if (newSegment.data('segmentedslider-type') == 'stepped'
          || newSegment.data('segmentedslider-type') == 'discrete')
        {
          var numSteps, 
              newSegmentOptions = newSegment.data('segmentedslider-options');
          if (newSegment.data('segmentedslider-type') == 'stepped')
            numSteps = Math.floor((newSegmentOptions.max - newSegmentOptions.min) / newSegmentOptions.step) + 1;
          else
            numSteps = newSegmentOptions.values.length;

          var gridLength = Math.floor((newSegment.innerWidth() - handle.outerWidth()) / (numSteps - 1));
          newSegmentX = Math.round(gridLength * Math.round(newSegmentX / gridLength));
        }

        this._isChangingSegments = true;

        //Recreate the draggable, since it is moved to a new parent.
        handle.draggable('destroy');

        handle.appendTo(newSegment).css('left', newSegmentX + 'px');
        this._setDraggable(handle);


        //Cancel the previous drag. For some reason, this must be done after
        //recreating the draggable, otherwise JQuery UI will cause an error.

        var mouseEvent = document.createEvent('MouseEvents');
        mouseEvent.initMouseEvent(
          'mouseup',
          /*bubbles=*/true,
          /*cancelable=*/true,
          /*view=*/window,
          /*detail=*/0,
          e.screenX,
          e.screenY,
          e.clientX,
          e.clientY,
          e.ctrlKey,
          e.altKey,
          e.shiftKey,
          e.metaKey,
          e.button,
          e.relatedTarget);
        
        handle.get(0).dispatchEvent(mouseEvent);

        //Start a new drag event, from where we left.
        var mouseEvent = document.createEvent('MouseEvents');
        mouseEvent.initMouseEvent(
          'mousedown',
          /*bubbles=*/true,
          /*cancelable=*/true,
          /*view=*/window,
          /*detail=*/0,
          e.screenX,
          e.screenY,
          e.clientX,
          e.clientY,
          e.ctrlKey,
          e.altKey,
          e.shiftKey,
          e.metaKey,
          e.button,
          e.relatedTarget);

        handle.get(0).dispatchEvent(mouseEvent);
        return false;
      }
      return true;
    },

    _setDraggable: function(handle) {
      var t = this;
      var segment = t._handle.parent();
      var segmentType = segment.data('segmentedslider-type');
      var segmentOptions = segment.data('segmentedslider-options');

      var draggableOptions = {
        axis: 'x',
        containment: 'parent',
        start: function (e, ui) {
          var value = t._calculateValue();
          //When the slider handle moves between segments, draggable is
          //recreated and an end and a start event are generated. These are
          //disregarded.
          if (!t._isChangingSegments)
          {
            t._dragPosition = e.clientX - t._handle.offset().left;

            if (t.options.start)
            {
              t.options.value = value;
              t.options.start(e, { handle: t._handle, value: value});
            }
          }
          else
          {
            t._isChangingSegments = false;
          }
        },
        drag: function (e, ui) {
          var result = t._handleSegmentSwitch(e);
          var value = t._calculateValue();
          if (t.options.slide)
          {
            if (t.options.value != value)
            {
              t.options.value = value;
              t.options.slide(e, { handle: t._handle, value: value});
            }
          }
          return result;
        },
        stop: function(e, ui) {
          var value = t._calculateValue();
          if (!t._isChangingSegments)
          {
            if (t.options.stop)
            {
              t.options.value = value;
              t.options.stop(e, { handle: t._handle, value: value});
            }
          }
        }
      };

      if (segmentType == 'stepped' || segmentType == 'discrete')
      {
        var numSteps;
        if (segmentType == 'stepped')
          numSteps = Math.floor((segmentOptions.max - segmentOptions.min) / segmentOptions.step) + 1;
        else if (segmentType == 'discrete')
          numSteps = segmentOptions.values.length;
        var fullWidth = segment.innerWidth() - handle.outerWidth();
        var stepLength = Math.floor(fullWidth / (numSteps - 1));
        draggableOptions.grid = [ stepLength, stepLength ];
      }


      handle.draggable(draggableOptions);
    },

    _createHandle: function () {
      var t = this,
          handle = $('<div />');
      this._handle = handle;
      $.each(this.options.handleClasses, function (i,e) { handle.addClass(e); });
      var segment = this._findSegment(this.options.value);
      if (segment === null)
        segment = $(this.element).find(':first-child');
      segment.append(handle);
      this._setDraggable(handle);
    },

    _create: function ()
    {
      this._createSegments();
      this._createHandle();
    },

    _destroy: function ()
    {
    }
  });
})(jQuery);
