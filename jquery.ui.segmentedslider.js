/* Slider with multiple slider segments */
(function($) {
  $.widget('ui.segmentedslider', {
    version: '0.1',

    options: {
      value: 0,

      segments: [ { min: 0, max: 1, step: null } ],

      minValueWidth: 20,

      /* Callbacks */
      slide: null,
      start: null,
      stop: null,

      bridgeElements: true,

      epsilon: 0.00001
    },

    _isChangingSegments : false,
    _startEventSent: false,
    _stopEventSent: false,
    _isDragging: false,

    _handle : null,

    /* X-coordinate where the user has grabbed the slider handle at */
    _dragPosition: 0,

    _documentPositionToHandlePosition: function (segment, documentPosition)
    {
      var $segment = $(segment);
      var result = documentPosition - $segment.offset().left;
      var segmentWidth = $segment.innerWidth();
      var segmentType = $segment.data('segmentedslider-type');
      var segmentOptions = $segment.data('segmentedslider-options');
      var handleWidth = this._handle.outerWidth();

      //@TODO handle em units
      if ($segment.css('left') != 'auto')
        result -= parseFloat($segment.css('left')); 
      if ($segment.css('margin-left') != 'auto')
        result -= parseFloat($segment.css('margin-left')); 
      //@TODO does padding need to be accounted for?
      if (this._isDragging)
        result -= this._dragPosition;

      if (result < 0)
        result = 0;
      if (result > segmentWidth - handleWidth)
        result = segmentWidth - handleWidth;

      //Snap to grid for stepped or discrete values.
      if (segmentType == 'stepped' || segmentType == 'discrete')
      {
        var numSteps;
        if (segmentType == 'stepped')
          //@TODO handle uneven steps
          numSteps = Math.ceil((segmentOptions.max - segmentOptions.min) / segmentOptions.step) + 1;
        else
          numSteps = segmentOptions.values.length;

        var gridLength = Math.floor((segmentWidth - handleWidth) / (numSteps - 1));

        result =  Math.round(gridLength * Math.round(result / gridLength));
      }

      return result;
    },

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
        .mousedown(function (e) {
          if (!$(e.target).is(this))
            return;
          var offset = t._documentPositionToHandlePosition(this, e.pageX);
          $(t._handle)
            .css('left', offset)
            .draggable('destroy')
            .appendTo($(this));
          t._setDraggable(t._handle);

          t.options.value = t._calculateValue();

          if (t.options.start)
          {
            t._startEventSent = true;
            t.options.start(e, { handle: t._handle, value: t.options.value});
          }

          if (t.options.slide)
          {
            t.options.slide(e, { handle: t._handle, value: t.options.value});
          }

          t._simulateMouseEvent(t._handle, e, 'mousedown');

          t._handle.addClass('ui-state-active');

          return false;
        })
        .mouseup(function (e) {
          if (!t._isDragging && t._startEventSent)
          {
            t._startEventSent = false;
            if (t.options.stop)
            {
              t.options.stop(e, { handle: t._handle, value: t.options.value});
            }
          }
          t._handle.removeClass('ui-state-active');
        });

      if (isFirst) segment.addClass('ui-segmentedslider-first');
      if (isLast) segment.addClass('ui-segmentedslider-last');

      segment.addClass('ui-slider')
             .addClass('ui-slider-horizontal')
             .addClass('ui-corner-all')
             .addClass('ui-widget-content')
             .addClass('ui-segmentedslider-segment');
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
          $segments = $(this.element).children('.ui-segmentedslider-segment'),
          
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
            var w = t.options.minValueWidth 
              * ($e.data('segmentedslider-options').values.length - 1);
            
            if (w == 0)
            {
              w = t.options.minValueWidth;
            }

            sumDiscreteWidths += w;
          }
          else
          {
            w = Math.abs($e.data('segmentedslider-options').max
                - $e.data('segmentedslider-options').min);

            if (w == 0)
            {
              w = t.options.minValueWidth;
            }

            sumRanges += w;
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

        if (width == 0)
          width = t.options.minValueWidth;

        $e.css('width', width + 'px');
      });
    },

    _createSegments: function () {
      var t = this;
      var numAdded = 0, numLeft = this.options.segments.length;
      $.each(this.options.segments, function (i, e) {
        if (numAdded > 0 && t.options.bridgeElements)
        {
          var bridge = $('<div />');
          bridge.addClass('ui-segmentedslider-bridge')
                .addClass('ui-widget-content');
          t.element.append(bridge);
        }
        --numLeft;
        t._createSegment(e, /*isFirst=*/numAdded == 0, numLeft == 0);
        ++numAdded;
      });

      this._resizeSegments();
    },

    _findSegment: function (value) {
      var t = this, 
          $segments = $(this.element).children('.ui-segmentedslider-segment'),
          result = null;
      $segments.each(function (i, e) {
        var $e = $(e),
        sliderOptions = $e.data('segmentedslider-options');
        switch ($e.data('segmentedslider-type')) {
          case 'continuous':
            ///@TODO find a way to check whether value is numeric.
            if (value !== '' && sliderOptions.min <= value && sliderOptions.max >= value)
              result = $e;
            break;
          case 'stepped':
            ///@TODO find a way to check whether value is numeric.
            if (value !== '' && sliderOptions.min <= value && sliderOptions.max >= value)
            {
              var numSteps = (value - sliderOptions.min) / sliderOptions.step;
              if (Math.abs(numSteps - Math.round(numSteps)) 
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
          return (segmentOptions.min 
            + (segmentOptions.max - segmentOptions.min) * relativePosition).toFixed(5);
        case 'stepped':
          var numSteps = 
            Math.ceil((segmentOptions.max - segmentOptions.min) / segmentOptions.step) + 1;
          var stepLength = 1.0 / (numSteps - 1.0);
          var selection = Math.round(relativePosition / stepLength);
          return (segmentOptions.min + segmentOptions.step * selection).toFixed(5);
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

    _simulateMouseEvent: function(target, sourceEvent, eventType)
    {
      var mouseEvent = document.createEvent('MouseEvents');
      mouseEvent.initMouseEvent(
        eventType,
        /*bubbles=*/true,
        /*cancelable=*/true,
        /*view=*/window,
        /*detail=*/0,
        sourceEvent.screenX,
        sourceEvent.screenY,
        sourceEvent.clientX,
        sourceEvent.clientY,
        sourceEvent.ctrlKey,
        sourceEvent.altKey,
        sourceEvent.shiftKey,
        sourceEvent.metaKey,
        sourceEvent.button,
        sourceEvent.relatedTarget);
      
      $(target).get(0).dispatchEvent(mouseEvent);
    },

    _handleSegmentSwitch: function (e) {
      var handle = $(this.element).find('.ui-segmentedslider-handle');
      var currentSegment = handle.parent();
      var dragX = e.pageX;
      var newSegment;

      this.element.children('.ui-segmentedslider-segment').each(function(i,e) {
        var $e = $(e);
        if ($e.offset().left <= dragX 
          && $e.offset().left + $e.outerWidth() > dragX)
        {
          newSegment = $e;
        }
      });

      if (newSegment && !newSegment.is(currentSegment))
      {
        var newSegmentX = this._documentPositionToHandlePosition(newSegment,
          dragX);


        //Recreate the draggable, since it is moved to a new parent.
        handle.draggable('destroy');

        handle.appendTo(newSegment).css('left', newSegmentX + 'px');
        this._setDraggable(handle);


        //Cancel the previous drag. For some reason, this must be done after
        //recreating the draggable, otherwise JQuery UI will cause an error.
        this._isChangingSegments = true;
        this._simulateMouseEvent(this._handle, e, 'mouseup');
        this._simulateMouseEvent(this._handle, e, 'mousedown');
        this._isChangingSegments = false;
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
          t._isDragging = true;
          var value = t._calculateValue();
          t._handle.addClass('ui-state-active');
          //When the slider handle moves between segments, draggable is
          //recreated and an end and a start event are generated. These are
          //disregarded.
          if (!t._isChangingSegments)
          {
            t._dragPosition = e.clientX - t._handle.offset().left;

            if (t.options.start && !t._startEventSent)
            {
              t.options.value = value;
              t.options.start(e, { handle: t._handle, value: value});
            }
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
          t._handle.removeClass('ui-state-active');
          t._isDragging = false;
          var value = t._calculateValue();
          t._startEventSent = true;
          if (!t._isChangingSegments)
          {
            if (t.options.value != value && t.options.slide)
            {
              t.options.value = value;
              t.options.slide(e, { handle: t._handle, value: value});
            }
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

    _setHandlePosition: function () {
      var segment = this._handle.parent(),
          segmentData = segment.data('segmentedslider-options'),
          segmentType = segment.data('segmentedslider-type'),
          segmentWidth = segment.innerWidth() - this._handle.outerWidth(),
          value = this.options.value,
          position;

      switch (segmentType)
      {
        case 'continuous':
        case 'stepped':
          position = (value - segmentData.min) 
            / (segmentData.max - segmentData.min);
          position *= segmentWidth;
          break;
        case 'discrete':
          position = segmentData.values.indexOf(value) 
            / segmentData.values.length;
          position *= segmentWidth;
          break;
      }

      this._handle.css('left', position);
    },

    _createHandle: function () {
      var t = this,
          handle = $('<div />');
      handle.addClass('ui-slider-handle')
            .addClass('ui-corner-all')
            .addClass('ui-state-default')
            .addClass('ui-segmentedslider-handle');

      var segment = this._findSegment(this.options.value);
      if (segment === null)
        segment = $(this.element).find(':first-child');

      segment.append(handle);
      this._handle = handle;

      this._setDraggable(handle);
      this._setHandlePosition();
    },

    _create: function ()
    {
      this.element.addClass('ui-segmentedslider')
                  .addClass('ui-slider')
                  .addClass('ui-slider-horizontal')
                  .addClass('ui-widget');

      this._createSegments();
      this._createHandle();
    },

    _destroy: function ()
    {
    }
  });
})(jQuery);
