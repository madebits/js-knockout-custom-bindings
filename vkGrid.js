    ko.bindingHandlers.vkGrid = (function () {
        "use strict";
        function validate(ops) {
            if (!ops) throw "options";
            var options = {};
            options = $.extend(true, options, ops);

            if (!options.columns) throw "options.columns";
            options.columns = ko.unwrap(options.columns);
            if (!(options.columns instanceof Array) || options.columns.length <= 0) throw "options.columns";
            $.each(options.columns, function (i, col) {
                col.name = col.name || (i + 1).toString();
                col.name = ko.unwrap(col.name);

                if (!col.databind && !col.custombind) throw "options.columns.databind " + col.name;
                if (col.databind) col.databind = ko.unwrap(col.databind);
                if (col.custombind) col.custombind = ko.unwrap(col.custombind);

                col.cssclasshead = col.cssclasshead || ('vkGrid' + (i + 1).toString());
                col.cssclasshead = ko.unwrap(col.cssclasshead);
                col.cssclassbody = col.cssclassbody || ('vkGrid' + (i + 1).toString());
                col.cssclassbody = ko.unwrap(col.cssclassbody);
            });

            options.pagerButtons = options.pagerButtons || 10;
            options.pageInfo = validatePageInfo(options.pageInfo);
            delete options.pageInfo.refresh;

            options.pagerButtons = +ko.unwrap(options.pagerButtons);
            if (options.pagerButtons < 5) options.pagerButtons = 5;

            if (typeof options.pagerTop === 'undefined') {
                options.pagerTop = true;
            }
            options.pagerTop = ko.unwrap(options.pagerTop);

            if (typeof options.disableOnFetch === 'undefined') {
                options.disableOnFetch = false;
            }
            options.fetchMessage = options.fetchMessage || '<span class="text-warning"><span class="glyphicon glyphicon-cloud-download"></span> Fetching data ...</span>';

            options.cssclass = options.cssclass || {};
            options.cssclass = ko.unwrap(options.cssclass);
            options.cssclass.div = options.cssclass.div || 'vkGrid';
            options.cssclass.div = ko.unwrap(options.cssclass.div);
            options.cssclass.table = options.cssclass.table || 'table table-border table-hover table-condensed vkGridTable';
            options.cssclass.table = ko.unwrap(options.cssclass.table);
            options.cssclass.ul = options.cssclass.ul || 'pagination vkGridPagerUl';
            options.cssclass.ul = ko.unwrap(options.cssclass.ul);

            return options;
        }

        function validatePageInfo(pageInfo) {
            pageInfo = pageInfo || {};
            pageInfo = ko.unwrap(pageInfo);

            pageInfo.total = pageInfo.total || 0;
            pageInfo.total = +ko.unwrap(pageInfo.total);
            if (pageInfo.total < 0) pageInfo.total = 0;

            pageInfo.pageSize = pageInfo.pageSize || 25;
            pageInfo.pageSize = +ko.unwrap(pageInfo.pageSize);
            if (pageInfo.pageSize < 1) throw "options.pageInfo.pageSize";

            pageInfo.pages = Math.floor(pageInfo.total / pageInfo.pageSize);
            if (Math.floor(pageInfo.total % pageInfo.pageSize) > 0) pageInfo.pages++;
            if (pageInfo.pages < 1) {
                pageInfo.pages = 1;
            }

            pageInfo.current = pageInfo.current || 1;
            pageInfo.current = +ko.unwrap(pageInfo.current);

            if (pageInfo.current < 1) pageInfo.current = 1;
            if (pageInfo.current > pageInfo.pages) pageInfo.current = pageInfo.pages;

            return pageInfo;
        }

        function refreshPages(extendedModel, current, total) {
            if (!current) return;
            var start = current - 1;
            var end = current + 1;
            if (start < 1) start = 1;
            if (end > total) end = total;
            for (var i = 1; i <= extendedModel.options.pagerButtons; i++) {
                var len = (end - start) + 1;
                if (start != 1) len++;
                if (end != total) len++;
                if (len >= extendedModel.options.pagerButtons) break;
                if ((start - 1) > 0) start--;
                if ((end + 1) < total) end++;
            }
            var pages = [];
            if (start != 1) pages.push(1);
            for (i = start; i <= end; i++) {
                pages.push(i);
            }
            if (end != total) pages.push(total);
            extendedModel.pages.removeAll();
            ko.utils.arrayPushAll(extendedModel.pages, pages);
        }

        function readColumnsDef(domGridParent) {
            function getColText(col, element) {
                var e = col.find(element);
                if (!e) return null;
                return e.text();
            }
            function process(text) {
                var cols = [];
                var xml = $($.parseXML(text));
                xml.find('col').each(function (i, col) {
                    var c = $(col);
                    cols.push({
                        name: getColText(c, 'name'),
                        customname: getColText(c, 'customname'),
                        databind: getColText(c, 'databind'),
                        custombind: getColText(c, 'custombind'),
                        cssclasshead: getColText(c, 'cssclasshead'),
                        cssclassbody: getColText(c, 'cssclassbody')
                    });
                });
                return cols;
            }
            var cols = [];
            var tmpl = domGridParent.find('script');
            if (tmpl) {
                var src = tmpl.attr('data-src');
                if (!src) {
                    src = tmpl.attr('src');
                }
                if (src) {
                    $.ajax({
                        cache: true,
                        url: src,
                        async: false,
                        dataType: 'text'
                    }).done(function (data) {
                        cols = process(data);
                    });
                }
                else {
                    cols = process(tmpl.text());
                }
            }
            return cols;
        }

        function createModel(domGridParent, valueAccessor, bindingContext) {
            if (!valueAccessor().columns) {
                var cols = readColumnsDef(domGridParent);
                valueAccessor().columns = ko.observableArray(cols);
            }
            var unwrapped = ko.unwrap(valueAccessor());
            var options = validate(unwrapped);

            function ExtendedModel() {
                var self = this;
                self.original = valueAccessor();
                self.options = options;
                self.rows = ko.observableArray([]);
                self.pages = ko.observableArray([]);
                self.selectedPage = ko.observable('');
                self.toPage = function (page) {
                    if (!self.pagerEnabled()) return;
                    self.selectedPage(page);
                };
                self.rowIndex = function (index) {
                    return ((index() + 1) + (self.options.pageInfo.pageSize * (self.selectedPage() - 1)));
                };
                self.rowSelect = function (r, e) {
                    if (self.options.onRowSelect) {
                        return self.options.onRowSelect(r, e);
                    }
                };
                self.headerSelect = function (r, e) {
                    if (self.options.onHeaderSelect) {
                        return self.options.onHeaderSelect(r, e);
                    }
                };
                self.columnClass = function (index, column, extraClass) {
                    var cc = column.cssclasshead.split(' ');
                    var res = {};
                    res["vkGridColumn" + index] = true;
                    if (extraClass) res[extraClass] = true;
                    $.each(cc, function (i, c) {
                        res[c] = true;
                    });
                    return res;
                };
                self.getHeadColId = function (index) {
                    var rootId = self.options.name;
                    if (!rootId) rootId = domGridParent.attr('id');
                    if (!rootId) rootId = 'vkGrid';
                    return 'vkGrid' + rootId + 'HeadCellId' + index();
                };
                self.pagerVisible = ko.computed(function () {
                    return (this.pages().length > 1);
                }, self);
                self.pagerEnabled = ko.observable(false);
                self.lastPage = '';
                self.withinOnSelectedPage = false;
            }

            var extendedModel = new ExtendedModel();

            // model events

            function onModelUpdate(forcePageUpdate) {
                if (forcePageUpdate) {
                    extendedModel.lastPage = '';
                }
                extendedModel.options = validate(ko.unwrap(extendedModel.original));
                createDom(domGridParent, extendedModel, bindingContext, extendedModel.options.onCreateCallback);
                if (forcePageUpdate) {
                    var cp = extendedModel.selectedPage();
                    if (cp == extendedModel.options.pageInfo.current) extendedModel.selectedPage.valueHasMutated();
                    else extendedModel.selectedPage(extendedModel.options.pageInfo.current);
                } else {
                    extendedModel.selectedPage(extendedModel.options.pageInfo.current);
                }
                refreshPages(extendedModel, extendedModel.selectedPage(), extendedModel.options.pageInfo.pages);
            }

            function samePageInfo(pageInfo) {
                if (!pageInfo) return false;
                return ((pageInfo.current == extendedModel.selectedPage())
                    && (pageInfo.total == extendedModel.options.pageInfo.total)
                    && (pageInfo.pageSize == extendedModel.options.pageInfo.pageSize));
            }

            if (ko.isObservable(unwrapped.pageInfo)) {
                unwrapped.pageInfo.subscribe(function (val) {
                    val = validatePageInfo(val);
                    if (!(!!val.refresh) && samePageInfo(val)) {
                        return;
                    }
                    onModelUpdate(!!val.refresh);
                });
            }

            if (ko.isObservable(unwrapped.pagerTop)) {
                unwrapped.pagerTop.subscribe(function (val) {
                    onModelUpdate(false);
                });
            }

            if (ko.isObservable(unwrapped.pagerButtons)) {
                unwrapped.pagerButtons.subscribe(function (val) {
                    onModelUpdate(false);
                });
            }

            if (ko.isObservable(unwrapped.columns)) {
                unwrapped.columns.subscribe(function (val) {
                    if (!val) return;
                    var tempVal = ko.unwrap(val);
                    if (!(tempVal instanceof Array) || tempVal.length <= 0) return;
                    onModelUpdate(true);
                });
            }

            function enableGrid(on) {
                extendedModel.pagerEnabled(on);
                var domGrid = domGridParent.find('.vkGridGrid');
                if (extendedModel.options.disableOnFetch
                    && ("pointerEvents" in document.documentElement.style)) {
                    domGrid.css('pointer-events', on ? 'auto' : 'none');
                } else {
                    if (!on) extendedModel.rows.removeAll();
                }
            }

            extendedModel.selectedPage.subscribe(function (val) {
                if (extendedModel.lastPage === val) return;
                enableGrid(false);
                var existingData = getExistingData(extendedModel);
                extendedModel.lastPage = val;
                refreshPages(extendedModel, val, extendedModel.options.pageInfo.pages);
                var currentPageInfo = {
                    current: val,
                    pageSize: extendedModel.options.pageInfo.pageSize,
                    total: extendedModel.options.pageInfo.total
                };
                if (extendedModel.options.onPageSelect) {
                    try {
                        extendedModel.options.onPageSelect(
                            currentPageInfo,
                            function (data, error) {
                                extendedModel.rows.removeAll();
                                if (error) throw error;
                                if (data !== null) {
                                    ko.utils.arrayPushAll(extendedModel.rows, data);
                                }
                                enableGrid(true);
                            },
                            existingData);
                    } catch (e) {
                        enableGrid(true);
                        throw e;
                    }
                }
                else { extendedModel.pagerEnabled(true); }
                if (ko.isObservable(unwrapped.pageInfo) && !samePageInfo(extendedModel.options.pageInfo)) {
                    unwrapped.pageInfo(currentPageInfo);
                }
            });

            createDom(domGridParent, extendedModel, bindingContext, extendedModel.options.onCreateCallback);
            extendedModel.selectedPage(extendedModel.options.pageInfo.current); //.valueHasMutated();

            return extendedModel;
        }

        function getExistingData(extendedModel) {
            return {
                data: ko.unwrap(extendedModel.rows).slice(0),
                token: extendedModel.options.token,
                previousPage: extendedModel.lastPage
            };
        }

        function setupResizeHeader(domGridParent, extendedModel) {
            function canStore() {
                return (typeof (store) != "undefined") && store.enabled;
            }

            if (!extendedModel.headerResizeState) {
                extendedModel.headerResizeState = {
                    pressed: false,
                    start: undefined,
                    startX: undefined,
                    startWidth: undefined,
                    setWidth: function (pageX) {
                        var th = $(extendedModel.headerResizeState.start);
                        var previousWidth = th.width();
                        var previousHeight = Math.floor(th.height());
                        var newWidth = extendedModel.headerResizeState.startWidth + (pageX - extendedModel.headerResizeState.startX);
                        th.width(newWidth);
                        var newHeight = Math.floor(th.height());
                        if (newHeight > previousHeight) {
                            th.width(previousWidth);
                        }
                        if (canStore()) {
                            store.set(th.attr('id'), th.width());
                        }
                    },
                    reset: function () {
                        if (this.pressed) {
                            this.pressed = false;
                            this.start = undefined;
                        }
                    }
                };
            }
            extendedModel.headerResizeState.reset();
            var domGrid = domGridParent.find('.vkGridGrid');

            domGrid.find('.vkGridHeadCell').each(function (i, th) {
                var rd = $('<span class="vkGridHeaderResize text-muted" style="cursor: col-resize; width: 4px; height:2em; float: right; display:inline; margin-left: 2px;">|</span>');
                var headCell = $(this);
                var span = headCell.find('.vkGridHeaderResizePlaceHolder');
                if (span && (span.length > 0)) { span.replaceWith(rd); }
                else { headCell.append(rd); }
                //headCell.width(headCell.width() + 8);
                //headCell.css({ 'min-width': '' + Math.floor(headCell.width()) + 'px' });
                headCell.wrapInner('<div class="vkGridHeadCellContent"></div>');
                rd.mousedown(function (e) {
                    extendedModel.headerResizeState.start = headCell;
                    extendedModel.headerResizeState.pressed = true;
                    extendedModel.headerResizeState.startX = e.pageX;
                    extendedModel.headerResizeState.startWidth = headCell.width();
                });
                if (canStore()) {
                    var lastWidth = store.get(headCell.attr('id'));
                    if (lastWidth && (lastWidth > 0)) headCell.width(lastWidth);
                }
            });

            domGrid.mousemove(function (e) {
                if (extendedModel.headerResizeState.pressed) {
                    e.preventDefault();
                    extendedModel.headerResizeState.setWidth(e.pageX);
                }
            });

            domGrid.mouseup(function () {
                extendedModel.headerResizeState.reset();
            });
        }

        function useCustomHeaderTemplate(options) {
            return (ko.utils.arrayFirst(options.columns, function (col, i) {
                return (col.customname);
            }) !== null);
        }

        function useCustomRowTemplate(options) {
            return (ko.utils.arrayFirst(options.columns, function (col, i) {
                return (col.custombind || (col.databind === 'vkGridRowIndex'));
            }) !== null);
        }

        function getHeaderTemplate(options) {
            var template = '<tr class="vkGridHeadRow">';
            $.each(options.columns, function (i, col) {
                if (col.customname) {
                    template += '<th data-bind="click: function(data, event){ headerSelect(options.columns[' + i + '], event); }, css: columnClass(' + i + ', options.columns[' + i + '], \'vkGridHeadCell\'), attr: { id: getHeadColId(function () { return ' + i + '; }) }">' + col.customname + '</th>';
                }
                else {
                    template += '<th data-bind="click: function(data, event){ headerSelect(options.columns[' + i + '], event); }, html: options.columns[' + i + '].name, css: columnClass(' + i + ', options.columns[' + i + '], \'vkGridHeadCell\'), attr: { id: getHeadColId(function () { return ' + i + '; }) }"></th>';
                }
            });
            template += '</tr>';
            return template;
        }

        function getRowTemplate(options) {
            var template = '<tr data-bind="click: rowSelect" class="vkGridRow">';
            $.each(options.columns, function (i, col) {
                if (col.custombind) {
                    template += '<td class="' + col.cssclassbody + '">' + col.custombind + '</td>';
                }
                else {
                    if (col.databind === 'vkGridRowIndex') {
                        template += '<td class="' + col.cssclassbody + '" data-bind="html: rowIndex($index)"></td>';
                    }
                    else {
                        template += '<td class="' + col.cssclassbody + '" data-bind="html: $data.' + col.databind + '"></td>';
                    }
                }
            });
            template += '</tr>';
            return template;
        }

        function createTemplate(options) {
            var template = '<div class="' + options.cssclass.div + '"><!--PAGERTOP--><div class="vkGridGrid"><table class="' + options.cssclass.table + '"><thead class="vkGridTHead"><!--HEADERTPL--></thead><tbody data-bind="foreach: {data: rows, as: \'dataRow\' }" class="vkGridTBody"><!--ROWTPL--></tbody></table><p data-bind="visible: !pagerEnabled(), html: options.fetchMessage"></p></div><!--PAGERBOTTOM--></div>';

            var headerTemplate = '<tr data-bind="foreach: original.columns" class="vkGridHeadRow"><th data-bind="click: headerSelect, html: name, css: columnClass($index, $data, \'vkGridHeadCell\'), attr: { id: getHeadColId($index) }"></th></tr>';
            if (useCustomHeaderTemplate(options)) {
                headerTemplate = getHeaderTemplate(options);
            }

            var rowTemplate = '<tr data-bind="click: rowSelect, foreach: { data: original.columns, as: \'col\'}" class="vkGridRow"><td data-bind="html: dataRow[col.databind]"></td></tr>';
            if (useCustomRowTemplate(options)) {
                rowTemplate = getRowTemplate(options);
            }

            var templatePager = '<div class="vkGridPager" data-bind="visible: pagerVisible" ><ul class="' + options.cssclass.ul
            + '" data-bind="foreach: pages"><li data-bind="css: { active: selectedPage() === $data, disabled: !pagerEnabled() && !(selectedPage() === $data) }"><a href="#" data-bind="text: $data, click: toPage"></a></li></ul><div style class="vkGridPagerTotal badge small" data-bind="html: options.pageInfo.total"></div></div>';

            template = template.replace('<!--HEADERTPL-->', headerTemplate);
            template = template.replace('<!--ROWTPL-->', rowTemplate);

            if (options.pagerTop) template = template.replace('<!--PAGERTOP-->', templatePager);
            else template = template.replace('<!--PAGERBOTTOM-->', templatePager);

            return template;
        }

        function createDom(domGridParent, extendedModel, bindingContext, onCreateCallback) {
            domGridParent.empty();
            domGridParent.append(createTemplate(extendedModel.options));
            var innerBindingContext = bindingContext.extend(extendedModel);
            ko.applyBindingsToDescendants(innerBindingContext, domGridParent[0]);
            setupResizeHeader(domGridParent, extendedModel);
            if (onCreateCallback) onCreateCallback(domGridParent[0]);
        }

        return {
            init: function (element, valueAccessor, allBindings, viewModel, bindingContext) {
                var domGridParent = $(element);
                var extendedModel = createModel(domGridParent, valueAccessor, bindingContext);
                return { controlsDescendantBindings: true };
            },

            update: function (element, valueAccessor, allBindings, viewModel, bindingContext) {
            }
        };
    }());
