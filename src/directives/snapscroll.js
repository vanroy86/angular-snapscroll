(function () {
    var scopeObject = {
        enabled: '=snapscroll',
        snapIndex: '=?',
        snapHeight: '=?',
        beforeSnap: '&',
        afterSnap: '&',
        snapAnimation: '=?'
    };

    var controller = ['$scope', function ($scope) {
        this.setSnapHeight = function (height) {
            $scope.snapHeight = height;
        };
    }];

    var snapscrollAsAnAttribute = [
        '$timeout',
        'wheelie',
        'scrollie',
        'defaultSnapscrollScrollEasing',
        'defaultSnapscrollScrollDelay',
        'defaultSnapscrollSnapDuration',
        'defaultSnapscrollBindScrollTimeout',
        function (
            $timeout,
            wheelie,
            scrollie,
            defaultSnapscrollScrollEasing,
            defaultSnapscrollScrollDelay,
            defaultSnapscrollSnapDuration,
            defaultSnapscrollBindScrollTimeout
        ) {
            return {
                restrict: 'A',
                scope: scopeObject,
                controller: controller,
                link: function (scope, element, attributes) {
                    function isNumber(value) {
                        return angular.isNumber(value) && !isNaN(value);
                    }

                    function getChildren() {
                        return element.children();
                    }

                    function getHeight(domElement) {
                        return domElement.offsetHeight;
                    }

                    function getChildHeight(snapIndex) {
                        return getHeight(getChildren()[snapIndex]);
                    }

                    function getSnapHeight() {
                        return getHeight(element[0]);
                    }

                    function getScrollHeight() {
                        return element[0].scrollHeight;
                    }

                    function rectifyScrollTop(scrollTop) {
                        var maxScrollTop = getScrollHeight() - getSnapHeight();
                        if (scrollTop > maxScrollTop) {
                            return maxScrollTop;
                        }
                        return scrollTop;
                    }

                    function getScrollTop(compositeIndex, previousCompositeIndex) {
                        var snapIndex = compositeIndex[0];
                        var innerSnapIndex = compositeIndex[1];

                        var scrollTop = 0;
                        var children = getChildren();
                        for (var i = 0; i < snapIndex; i++) {
                            scrollTop += getHeight(children[i]);
                        }

                        if (innerSnapIndex === 0) {
                            return rectifyScrollTop(scrollTop);
                        }

                        var snapHeight = getSnapHeight();
                        var childHeight = getHeight(children[snapIndex]);
                        var innerScrollTop;
                        if (angular.isDefined(previousCompositeIndex) &&
                            innerSnapIndex < previousCompositeIndex[1]) {
                            innerScrollTop = childHeight;
                            for (var j = innerSnapIndex; j >= 0; j--) {
                                innerScrollTop -= snapHeight;
                            }
                        } else {
                            innerScrollTop = 0;
                            for (var k = 0; k < innerSnapIndex; k++) {
                                innerScrollTop += snapHeight;
                            }
                            var overflow = innerScrollTop + snapHeight - childHeight;
                            if (overflow > 0) {
                                innerScrollTop -= overflow;
                            }
                        }

                        return rectifyScrollTop(scrollTop + innerScrollTop);
                    }

                    function snapTo(compositeIndex, previousCompositeIndex) {
                        var snapIndex = compositeIndex[0];
                        var isSnapIndexChanged = angular.isUndefined(previousCompositeIndex) ||
                            snapIndex !== previousCompositeIndex[0];
                        if (isSnapIndexChanged) {
                            var returnValue = scope.beforeSnap({
                                snapIndex: snapIndex
                            });
                            if (returnValue === false) {
                                if (angular.isDefined(previousCompositeIndex)) {
                                    scope.ignoreCompositeIndexChange = true;
                                    scope.compositeIndex = previousCompositeIndex;
                                }
                                return;
                            }
                            if (isNumber(returnValue)) {
                                scope.snapIndex = returnValue;
                                return;
                            }
                        }

                        return scrollTo(getScrollTop(
                            compositeIndex,
                            previousCompositeIndex
                        )).then(function () {
                            if (isSnapIndexChanged) {
                                scope.afterSnap({
                                    snapIndex: snapIndex
                                });
                            }
                        });
                    }

                    function getCurrentScrollTop() {
                        return element[0].scrollTop;
                    }

                    function scrollTo(scrollTop) {
                        var args;
                        if (!scope.snapAnimation) {
                            args = [
                                element,
                                scrollTop
                            ];
                        } else if (angular.isUndefined(scope.snapEasing)) {
                            // TODO: add tests for this. Will require refactoring
                            // the default values into an object, which is a good
                            // change anyway
                            args = [
                                element,
                                scrollTop,
                                scope.snapDuration
                            ];
                        } else {
                            args = [
                                element,
                                scrollTop,
                                scope.snapDuration,
                                scope.snapEasing
                            ];
                        }

                        var currentScrollTop = getCurrentScrollTop();
                        if (scrollTop > currentScrollTop) {
                            scope.snapDirection = 'down';
                        } else if (scrollTop < currentScrollTop) {
                            scope.snapDirection = 'up';
                        } else {
                            scope.snapDirection = 'same';
                        }

                        unbindScroll();
                        return scrollie.to.apply(scrollie, args).then(function () {
                            scope.snapDirection = undefined;
                            bindScrollAfterDelay();
                        });
                    }

                    function isScrollable() {
                        var snapHeight = getSnapHeight();
                        if (!snapHeight) {
                            return false;
                        }
                        var children = getChildren();
                        if (!children.length) {
                            return false;
                        }
                        var totalHeight = 0;
                        angular.forEach(children, function (child) {
                            totalHeight += getHeight(child);
                        });
                        if (totalHeight < snapHeight) {
                            return false;
                        }
                        return true;
                    }

                    function isSnapIndexValid(snapIndex) {
                        return snapIndex >= 0 &&
                               snapIndex <= getChildren().length - 1;
                    }

                    function snapIndexChanged(current, previous) {
                        if (!isScrollable()) {
                            return;
                        }
                        if (angular.isUndefined(current)) {
                            scope.snapIndex = 0;
                            return;
                        }
                        if (!isNumber(current)) {
                            if (isNumber(previous)) {
                                scope.snapIndex = previous;
                            } else {
                                scope.snapIndex = 0;
                            }
                            return;
                        }
                        if (current % 1 !== 0) {
                            scope.snapIndex = Math.round(current);
                            return;
                        }
                        if (scope.ignoreSnapIndexChange === true) {
                            scope.ignoreSnapIndexChange = undefined;
                            return;
                        }
                        if (!isSnapIndexValid(current)) {
                            if (!isSnapIndexValid(previous)) {
                                previous = 0;
                            }
                            scope.ignoreSnapIndexChange = true;
                            scope.snapIndex = previous;
                            return;
                        }
                        scope.compositeIndex = [current, 0];
                    }

                    function watchSnapIndex() {
                        scope.unwatchSnapIndex = scope.$watch(
                            'snapIndex',
                            snapIndexChanged
                        );
                    }

                    function unwatchSnapIndex() {
                        if (!angular.isFunction(scope.unwatchSnapIndex)) {
                            return;
                        }
                        scope.unwatchSnapIndex();
                        scope.unwatchSnapIndex = undefined;
                    }

                    function compositeIndexChanged(current, previous) {
                        if (angular.isUndefined(current)) {
                            return;
                        }
                        var snapIndex = current[0];
                        if (scope.snapIndex !== snapIndex) {
                            scope.ignoreSnapIndexChange = true;
                            scope.snapIndex = snapIndex;
                        }
                        if (scope.ignoreCompositeIndexChange === true) {
                            scope.ignoreCompositeIndexChange = undefined;
                            return;
                        }
                        snapTo(current, previous);
                    }

                    function watchCompositeIndex() {
                        scope.unwatchCompositeIndex = scope.$watchCollection(
                            'compositeIndex',
                            compositeIndexChanged
                        );
                    }

                    function unwatchCompositeIndex() {
                        if (!angular.isFunction(scope.unwatchCompositeIndex)) {
                            return;
                        }
                        scope.unwatchCompositeIndex();
                        scope.unwatchCompositeIndex = undefined;
                    }

                    function getMaxInnerSnapIndex(snapIndex) {
                        var snapHeight = getSnapHeight();
                        var childHeight = getChildHeight(snapIndex);
                        if (childHeight <= snapHeight) {
                            return 0;
                        }
                        var max = parseInt((childHeight / snapHeight), 10);
                        if (childHeight % snapHeight === 0) {
                            max -= 1;
                        }
                        return max;
                    }

                    function isCompositeIndexValid(compositeIndex) {
                        var snapIndex = compositeIndex[0];
                        var innerSnapIndex = compositeIndex[1];
                        if (innerSnapIndex < 0) {
                            return isSnapIndexValid(snapIndex - 1);
                        }
                        if (innerSnapIndex > getMaxInnerSnapIndex(snapIndex)) {
                            return isSnapIndexValid(snapIndex + 1);
                        }
                        return true;
                    }

                    function rectifyCompositeIndex(compositeIndex) {
                        var snapIndex = compositeIndex[0];
                        var innerSnapIndex = compositeIndex[1];
                        if (innerSnapIndex < 0) {
                            return [
                                snapIndex - 1,
                                getMaxInnerSnapIndex(snapIndex - 1)
                            ];
                        }
                        if (innerSnapIndex > getMaxInnerSnapIndex(snapIndex)) {
                            return [snapIndex + 1, 0];
                        }
                        return compositeIndex;
                    }

                    function snap(direction) {
                        if (!isScrollable()) {
                            return;
                        }

                        if (scope.snapDirection === direction) {
                            return true;
                        }

                        var snapIndex = scope.compositeIndex[0];
                        var innerSnapIndex = scope.compositeIndex[1];
                        var newInnerSnapIndex;
                        if (direction === 'up') {
                            newInnerSnapIndex = innerSnapIndex - 1;
                        }
                        if (direction === 'down') {
                            newInnerSnapIndex = innerSnapIndex + 1;
                        }

                        var newCompositeIndex = [snapIndex, newInnerSnapIndex];
                        if (!isCompositeIndexValid(newCompositeIndex)) {
                            return;
                        }

                        scope.$apply(function () {
                            scope.compositeIndex = rectifyCompositeIndex(
                                newCompositeIndex
                            );
                        });
                        return true;
                    }

                    function snapUp() {
                        return snap('up');
                    }

                    function snapDown() {
                        return snap('down');
                    }

                    function bindWheel() {
                        wheelie.bind(element, {
                            up: function (e) {
                                e.preventDefault();
                                if (snapUp()) {
                                    e.stopPropagation();
                                }
                            },
                            down: function (e) {
                                e.preventDefault();
                                if (snapDown()) {
                                    e.stopPropagation();
                                }
                            }
                        });
                    }

                    function unbindWheel() {
                        wheelie.unbind(element);
                    }

                    function setHeight(angularElement, height) {
                        angularElement.css('height', height + 'px');
                    }

                    function snapHeightChanged(current, previous) {
                        if (angular.isUndefined(current)) {
                            return;
                        }
                        if (!isNumber(current)) {
                            if (isNumber(previous)) {
                                scope.snapHeight = previous;
                            }
                            return;
                        }

                        setHeight(element, current);
                        angular.forEach(getChildren(), function (child) {
                            setHeight(angular.element(child), current);
                        });

                        if (angular.isDefined(scope.snapIndex)) {
                            if (angular.isUndefined(scope.compositeIndex)) {
                                scope.compositeIndex = [scope.snapIndex, 0];
                            }
                            snapTo(scope.compositeIndex);
                        }
                    }

                    function watchSnapHeight() {
                        scope.unwatchSnapHeight = scope.$watch(
                            'snapHeight',
                            snapHeightChanged
                        );
                    }

                    function unwatchSnapHeight() {
                        if (!angular.isFunction(scope.unwatchSnapHeight)) {
                            return;
                        }
                        scope.unwatchSnapHeight();
                        scope.unwatchSnapHeight = undefined;
                    }

                    function getCompositeIndex(scrollTop) {
                        var snapIndex = 0;
                        var innerSnapIndex = 0;

                        if (scrollTop > 0) {
                            snapIndex = -1;
                            var children = getChildren();
                            var childHeight;
                            while (scrollTop > 0) {
                                childHeight = getHeight(children[++snapIndex]);
                                scrollTop -= childHeight;
                            }
                            var snapHeight = getSnapHeight();
                            if (childHeight > snapHeight) {
                                scrollTop += childHeight - snapHeight;
                                if (scrollTop >= snapHeight) {
                                    innerSnapIndex++;
                                }
                                while (scrollTop > 0) {
                                    innerSnapIndex++;
                                    scrollTop -= snapHeight;
                                }
                                if ((snapHeight / 2) >= -scrollTop) {
                                    innerSnapIndex += 1;
                                }
                            } else if ((childHeight / 2) >= -scrollTop) {
                                snapIndex += 1;
                            }
                        }

                        return rectifyCompositeIndex([snapIndex, innerSnapIndex]);
                    }

                    function onScroll() {
                        function snapFromSrollTop() {
                            var compositeIndex = getCompositeIndex(
                                getCurrentScrollTop()
                            );
                            if (scope.compositeIndex[0] === compositeIndex[0] &&
                                scope.compositeIndex[1] === compositeIndex[1]) {
                                snapTo(scope.compositeIndex);
                            } else {
                                scope.$apply(function () {
                                    scope.compositeIndex = compositeIndex;
                                });
                            }
                        }

                        scrollie.stop(element);
                        if (scope.scrollDelay === false) {
                            snapFromSrollTop();
                        } else {
                            $timeout.cancel(scope.scrollPromise);
                            scope.scrollPromise = $timeout(
                                function () {
                                    snapFromSrollTop();
                                    scope.scrollPromise = undefined;
                                },
                                scope.scrollDelay
                            );
                        }
                    }

                    function bindScroll() {
                        if (scope.preventSnappingAfterManualScroll ||
                            scope.scrollBound) {
                            return;
                        }
                        if (angular.isDefined(scope.snapDirection)) { // still snapping
                            // TODO: add tests for this
                            bindScrollAfterDelay();
                            return;
                        }
                        element.on('scroll', onScroll);
                        scope.scrollBound = true;
                    }

                    function unbindScroll() {
                        if (!scope.scrollBound) {
                            return;
                        }
                        element.off('scroll', onScroll);
                        scope.scrollBound = false;
                    }

                    function bindScrollAfterDelay() {
                        if (scope.preventSnappingAfterManualScroll) {
                            return;
                        }
                        if (scope.bindScrollPromise) {
                            $timeout.cancel(scope.bindScrollPromise);
                        }
                        scope.bindScrollPromise = $timeout(
                            function () {
                                bindScroll();
                                scope.bindScrollPromise = undefined;
                            },
                            defaultSnapscrollBindScrollTimeout
                        );
                    }

                    function init() {
                        var scrollDelay = attributes.scrollDelay;
                        if (scrollDelay === 'false') {
                            scope.scrollDelay = false;
                        } else {
                            scrollDelay = parseInt(scrollDelay, 10);
                            if (isNaN(scrollDelay)) {
                                scrollDelay = defaultSnapscrollScrollDelay;
                            }
                            scope.scrollDelay = scrollDelay;
                        }

                        var snapEasing = attributes.snapEasing;
                        if (angular.isDefined(snapEasing)) {
                            scope.snapEasing = scope.$parent.$eval(snapEasing);
                        } else if (angular.isFunction(defaultSnapscrollScrollEasing)) {
                            scope.snapEasing = defaultSnapscrollScrollEasing;
                        }

                        var snapDuration = parseInt(attributes.snapDuration, 10);
                        if (isNaN(snapDuration)) {
                            snapDuration = defaultSnapscrollSnapDuration;
                        }
                        scope.snapDuration = snapDuration;

                        // TODO: perform initial snap without animation
                        if (angular.isUndefined(scope.snapAnimation)) {
                            scope.snapAnimation = true;
                        }

                        scope.preventSnappingAfterManualScroll = angular.isDefined(
                            attributes.preventSnappingAfterManualScroll
                        );

                        if (element.css('overflowY') !== 'scroll') {
                            element.css('overflowY', 'auto');
                        }

                        scope.$watch('enabled', function (current, previous) {
                            function updateCompositeIndexFromScrollTop() {
                                if (scope.preventSnappingAfterManualScroll) {
                                    return;
                                }
                                scope.compositeIndex = getCompositeIndex(
                                    getCurrentScrollTop()
                                );
                            }
                            if (current !== false) {
                                if (previous === false) {
                                    updateCompositeIndexFromScrollTop();
                                }
                                watchCompositeIndex();
                                watchSnapIndex();
                                watchSnapHeight();
                                bindScroll();
                                bindWheel();
                            } else {
                                unwatchCompositeIndex();
                                unwatchSnapIndex();
                                unwatchSnapHeight();
                                unbindScroll();
                                unbindWheel();
                            }
                        });

                        scope.$on('$destroy', function () {
                            if (scope.enabled !== false) {
                                unbindScroll();
                                unbindWheel();
                            }
                        });
                    }

                    init();
                }
            };
        }
    ];

    angular.module('snapscroll')
        .directive('snapscroll', snapscrollAsAnAttribute);
})();
