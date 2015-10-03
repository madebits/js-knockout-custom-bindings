define(['jquery', 'knockout'], function ($, ko) {
    "use strict";

    ko.bindingHandlers.vkCompose = (function () {

        return {
            init: function (element, valueAccessor, allBindings, viewModel, bindingContext) {
                return { controlsDescendantBindings: false };
            },

            update: function (element, valueAccessor, allBindings, viewModel, bindingContext) {
                var parameters = {};
                parameters.domElement = $(element);

                var data = ko.unwrap(valueAccessor());
                if (typeof data === 'string') {
                    parameters.url = data;
                }
                else {
                    parameters.url = ko.unwrap(data.url);
                    parameters.urlData = ko.unwrap(data.urlData);
                    parameters.onLoad = data.onLoad;
                    parameters.model = data.model;
                    parameters.extendedModel = data.extendedModel;
                }
                if (!parameters.url) {
                    parameters.domElement.empty();
                    if (parameters.onLoad) parameters.onLoad(parameters);
                    return;
                }

                var cache = !!$.ajaxSetup().cache;
                $.ajaxSetup().cache = true;
                parameters.domElement.load(parameters.url, parameters.urlData, function () {
                    var context = bindingContext;
                    if (parameters.model) {
                        context = bindingContext.createChildContext(parameters.model, null, function (ctx) {
                            if (parameters.extendedModel) {
                                ko.utils.extend(ctx, parameters.extendedModel);
                            }
                        });
                    }
                    else if (parameters.extendedModel)
                    {
                        context = bindingContext.extend(parameters.extendedModel);
                    }
                    ko.applyBindingsToDescendants(context, element);
                    if (parameters.onLoad) parameters.onLoad(parameters);
                });
                $.ajaxSetup().cache = cache;
            }
        };

    }());

});