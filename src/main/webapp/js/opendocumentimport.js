define(    
    ['jquery', 'qna/qna', 'qna/qnautils', 'qna/qnazipmodel', 'qnastart', 'specelement', 'fontrule', 'generalexternalimport', 'exports'],
    function (jquery, qna, qnautils, qnazipmodel, qnastart, specelement, fontrule, generalexternalimport, exports) {
        'use strict';
    
        /*
            STEP 1 - Get the ODT file
         */
        exports.askForOpenDocumentFile = new qna.QNAStep()
            .setTitle("Select the ODT file to import")
            .setIntro("Select the ODT file that contains the content you wish to import.")
            .setInputs(
                [
                    new qna.QNAVariables()
                        .setVariables([
                            new qna.QNAVariable()
                                .setType(qna.InputEnum.SINGLE_FILE)
                                .setIntro("OpenDocument ODT File")
                                .setName("OdtFile")
                        ])
                ]
            )
            .setProcessStep(function (resultCallback, errorCallback, result, config) {

                config.InputType = "Zip";

                if (!config.OdtFile) {
                    errorCallback("Please select a file", "You need to select an ODT file before continuing.");
                } else if (config.OdtFile.name.lastIndexOf(".odt") !== config.OdtFile.name.length - 4) {
                    errorCallback("Please select a file", "You need to select an ODT file before continuing.");
                } else {
                    qnastart.zipModel.getCachedEntries(config.OdtFile, function (entries) {
    
                        var foundContentFile = false;
                        jquery.each(entries, function (index, value) {
                            if (value.filename === "content.xml") {
                                foundContentFile = true;
                                return false;
                            }
                        });
    
                        var foundStyleFile = false;
                        jquery.each(entries, function (index, value) {
                            if (value.filename === "styles.xml") {
                                foundStyleFile = true;
                                return false;
                            }
                        });
    
                        if (!foundContentFile || !foundStyleFile) {
                            errorCallback("Error", "The ODT file did not contain either a styles.xml or content.xml file. The selected file is not a valid OpenDocument file.");
                        } else {
                            resultCallback();
                        }
                    }, function (message) {
                        errorCallback("Error", "Could not process the ODT file!");
                    });
                }
            })
            .setNextStep(function (resultCallback) {
                resultCallback(useStyleRules);
            })
            .setEnterStep(function(resultCallback){
                qnastart.zipModel.clearCache();
                resultCallback(false);
            });

        var useStyleRules = new qna.QNAStep()
            .setTitle("Do you want to define additional style rules")
            .setIntro("You have the option of wrapping paragraphs that match certain font styles in DocBook elements other than <para>s. " +
                "This is useful when the document being imported consistently applies different font to paragraphs that represent screen output or source code.")
            .setInputs([
                new qna.QNAVariables()
                    .setVariables([
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.RADIO_BUTTONS)
                            .setIntro(["Yes", "No"])
                            .setOptions(["Yes", "No"])
                            .setValue("No")
                            .setName("UseStyleRules")
                    ])
            ])
            .setNextStep(function (resultCallback, errorCallback, result, config) {
                resultCallback(config.UseStyleRules === "Yes" ? setParaRules : askForRevisionMessage);
            });
    
        function getRulesText(rulesCollection) {
            var rules = "";
    
            if (rulesCollection) {
                jquery.each(rulesCollection, function(index, fontRule) {
    
                    var rule = "";
    
                    if (fontRule.font) {
                        if (rule.length !== 0) {
                            rule += ", ";
                        }
                        rule += "Font: " + fontRule.font;
                    }
    
                    if (fontRule.size) {
                        if (rule.length !== 0) {
                            rule += ", ";
                        }
                        rule += "Size: " + fontRule.size;
                    }
    
                    if (fontRule.bold) {
                        if (rule.length !== 0) {
                            rule += ", ";
                        }
                        rule += "Bold: " + fontRule.bold;
                    }
    
                    if (fontRule.italics) {
                        if (rule.length !== 0) {
                            rule += ", ";
                        }
                        rule += "Italics: " + fontRule.italics;
                    }
    
                    if (fontRule.underline) {
                        if (rule.length !== 0) {
                            rule += ", ";
                        }
                        rule += "Italics: " + fontRule.underline;
                    }
    
                    if (fontRule.docBookElement) {
                        if (rule.length !== 0) {
                            rule += ", ";
                        }
                        rule += "DocBook Element: " + fontRule.docBookElement;
                    }
    
                    if (rules.length !== 0) {
                        rules += "<br/>";
                    }
    
                    rules += rule;
                });
            } else {
                rules = "No rules currently defined.";
            }
    
    
            return rules;
        }
    
        /*
            Step 4 - ask which server this is being uploaded to
         */
        var setParaRules = new qna.QNAStep()
            .setTitle("Define a rule for a paragraph")
            .setIntro("You can define the DocBook block element to wrap an imported paragraph in by matching font styles.")
            .setOutputs([
                new qna.QNAVariables()
                    .setVariables([
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.HTML)
                            .setIntro("Current Rules")
                            .setName("CurrentRules")
                            .setValue(function (resultCallback, errorCallback, result, config) {
    
                                var rules = "";
    
                                if (result) {
                                    var resultObject = JSON.parse(result);
                                    rules = getRulesText(resultObject.fontRules);
                                } else {
                                    rules = getRulesText();
                                }
    
                                resultCallback(rules);
                            })
                    ])
            ])
            .setInputs([
                new qna.QNAVariables()
                    .setVariables([
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.TEXTBOX)
                            .setIntro("Font Name")
                            .setName("FontName")
                            .setValue(function (resultCallback, errorCallback, result, config) {
                                resultCallback(config.FontName);
                            }),
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.TEXTBOX)
                            .setIntro("Font Size")
                            .setName("FontSize"),
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.CHECKBOX)
                            .setIntro("Bold")
                            .setName("Bold"),
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.CHECKBOX)
                            .setIntro("Italics")
                            .setName("Italics"),
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.CHECKBOX)
                            .setIntro("Underline")
                            .setName("Underline"),
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.COMBOBOX)
                            .setIntro("DocBook Element")
                            .setName("DocBookElement")
                            .setOptions(["programlisting", "screen", "literallayout", "synopsis"]), // http://docbook.org/tdg/en/html/ch02.html#ch02-logdiv
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.CHECKBOX)
                            .setIntro("Merge Consecutive Elements")
                            .setName("MergeConsecutiveElements"),
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.CHECKBOX)
                            .setIntro("Define another rule?")
                            .setName("DefineAnotherRule")
                    ])
            ])
            .setBackStep(function (resultCallback, errorCallback, result, config) {
                var resetToDefault = function () {
                    config.FontName = null;
                    config.FontSize = null;
                    config.Bold = null;
                    config.Italics = null;
                    config.Underline = null;
                    config.DocBookElement = null;
                    config.MergeConsecutiveElements = false;
                };
    
                if (result) {
                    var resultObject = JSON.parse(result);
                    if (resultObject.fontRules !== undefined) {
                        var lastRule = resultObject.fontRules[resultObject.fontRules.length - 1];
    
                        config.FontName = lastRule.font;
                        config.FontSize = lastRule.size;
                        config.Bold = lastRule.bold;
                        config.Italics = lastRule.italics;
                        config.Underline = lastRule.underline;
                        config.DocBookElement = lastRule.docBookElement;
                        config.MergeConsecutiveElements = lastRule.merge;
                    } else {
                        resetToDefault();
                    }
                } else {
                    resetToDefault();
                }
    
                config.DefineAnotherRule = true;
    
                resultCallback();
            })
            .setProcessStep(function (resultCallback, errorCallback, result, config) {
                var fontRule = new fontrule.FontRule();
    
                if (!config.DocBookElement) {
                    errorCallback("incomplete form", "Please specify the DocBook element that this rule will create.");
                    return;
                }
    
                fontRule.setDocBookElement(config.DocBookElement);
                fontRule.setMerge(config.MergeConsecutiveElements);
    
                var atLeastOneRule = false;
                if (config.FontName) {
                    atLeastOneRule = true;
                    fontRule.setFont(config.FontName);
                }
    
                if (config.FontSize) {
                    atLeastOneRule = true;
                    fontRule.setSize(config.FontSize);
                }
    
                if (config.Bold) {
                    atLeastOneRule = true;
                    fontRule.setBold(config.Bold);
                }
    
                if (config.Italics) {
                    atLeastOneRule = true;
                    fontRule.setItalics(config.Italics);
                }
    
                if (config.Underline) {
                    atLeastOneRule = true;
                    fontRule.setUnderline(config.Underline);
                }
    
                if (!atLeastOneRule) {
                    errorCallback("Incomplete form", "Please specify at least one formatting rule.");
                } else {
                    var resultObject;
                    if (result) {
                        resultObject = JSON.parse(result);
                        if (resultObject.fontRules === undefined) {
                            resultObject.fontRules = [];
                        }
                    } else {
                        resultObject = {fontRules: []};
                    }
    
                    resultObject.fontRules.push(fontRule);
    
                    config.FontName = null;
                    config.FontSize = null;
                    config.Bold = null;
                    config.Italics = null;
                    config.Underline = null;
                    config.DocBookElement = null;
                    config.MergeConsecutiveElements = false;
    
                    resultCallback(JSON.stringify(resultObject));
                }
            })
            .setNextStep(function (resultCallback, errorCallback, result, config) {
                resultCallback(config.DefineAnotherRule ? setParaRules : askForRevisionMessage);
            });

        /*
         Ask for a revision message
         */
        var askForRevisionMessage = new qna.QNAStep()
            .setTitle("Enter a message for the revision log")
            .setIntro("Each new topic, image and content specification created by this import process will have this revision message in the log.")
            .setInputs([
                new qna.QNAVariables()
                    .setVariables([
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.TEXTBOX)
                            .setIntro("Revision Log Message")
                            .setValue(function (resultCallback, errorCallback, result, config){resultCallback("Imported from " + config.OdtFile.name);})
                            .setName("RevisionMessage")
                    ])
            ])
            .setNextStep(function (resultCallback, errorCallback, result, config) {
                resultCallback(processOdt);
            })
            .setShowNext("Start Import");
    
        /*
            STEP 5 - process the ODT file
         */
        var processOdt = new qna.QNAStep()
            .setShowNext(false)
            .setShowPrevious(false)
            .setTitle("Processing the ODT file")
            .setIntro("The list below allows you to monitor the progress of the import process. Steps with an asterisk (*) can take some time to complete, so please be patient.")
            .setOutputs([
                new qna.QNAVariables()
                    .setVariables([
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.HTML)
                            .setIntro("Current Rules")
                            .setName("CurrentRules")
                            .setValue(function (resultCallback, errorCallback, result, config) {
    
                                var rules = "";
    
                                if (result) {
                                    var resultObject = JSON.parse(result);
                                    rules = getRulesText(resultObject.fontRules);
                                } else {
                                    rules = getRulesText();
                                }
    
                                resultCallback(rules);
                            }),
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.CHECKBOX)
                            .setIntro("Resolving Book Structure")
                            .setName("ResolvedBookStructure"),
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.CHECKBOX)
                            .setIntro("Uploading Images*")
                            .setName("UploadedImages"),
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.CHECKBOX)
                            .setIntro("Uploading Topics*")
                            .setName("UploadedTopics"),
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.CHECKBOX)
                            .setIntro("Uploading content specification")
                            .setName("UploadedContentSpecification"),
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.PLAIN_TEXT)
                            .setIntro("Topics Created / Topics Reused")
                            .setName("NewTopicsCreated"),
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.PLAIN_TEXT)
                            .setIntro("Images Created / Images Reused")
                            .setName("NewImagesCreated"),
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.PROGRESS)
                            .setIntro("Progress")
                            .setName("UploadProgress")
                            // gotta set this first up because of https://github.com/angular-ui/bootstrap/issues/1547
                            .setValue([100, 0])
                    ])
            ])
            .setEnterStep(function (resultCallback, errorCallback, result, config) {
    
                window.onbeforeunload=function(){
                    return "The import process is in progress. Are you sure you want to quit?";
                };
    
                var progressIncrement = 100 / 4;

                var resultObject = JSON.parse(result) || {contentSpec: []};

                resultObject.contentSpec.push("Title = " + (config.ContentSpecTitle === undefined ? "Unknown" : config.ContentSpecTitle));
                resultObject.contentSpec.push("Product = " + (config.ContentSpecProduct === undefined ? "Unknown" : config.ContentSpecProduct));
                resultObject.contentSpec.push("Version = " + (config.ContentSpecVersion === undefined ? "1" : config.ContentSpecVersion));
                resultObject.contentSpec.push("Format = DocBook 4.5");

                /*
                 These metadata elements are optional
                 */
                if (config.ContentSpecSubtitle !== undefined) {
                    resultObject.contentSpec.push("Subtitle = " + config.ContentSpecSubtitle);
                }
                if (config.ContentSpecEdition !== undefined) {
                    resultObject.contentSpec.push("Edition = " + config.ContentSpecEdition);
                }
                if (config.ContentSpecCopyrightHolder !== undefined) {
                    resultObject.contentSpec.push("Copyright Holder = " + config.ContentSpecCopyrightHolder);
                }
                if (config.ContentSpecBrand !== undefined) {
                    // this is the value specified in the ui
                    resultObject.contentSpec.push("Brand = " + config.ContentSpecBrand);
                }

                resultObject.contentSpec.push("# Imported from " + config.OdtFile.name);
    
                /*
                    Add any rules that were defined when parsing this book
                 */
                var rulesLines = getRulesText(resultObject.fontRules).split("<br/>");
                if (rulesLines.length !== 0) {
                    resultObject.contentSpec.push("# Content matching rules used while importing this document");
                    jquery.each(rulesLines, function (index, value) {
                        resultObject.contentSpec.push("# " + value);
                    });
                }
    
                /*
                 Initialize some config values
                 */
                config.UploadedTopicCount = 0;
                config.MatchedTopicCount = 0;
                config.UploadedImageCount = 0;
                config.MatchedImageCount = 0;
    
                qnastart.zipModel.getTextFromFileName(
                    config.OdtFile,
                    "content.xml",
                    function (contents) {
                        qnastart.zipModel.getTextFromFileName(
                            config.OdtFile,
                            "styles.xml",
                            function(styles) {
    
                                var topicGraph = new specelement.TopicGraph();
                                var contentsXML = jquery.parseXML(contents);
                                var stylesXML = jquery.parseXML(styles);
    
                                // http://www.nczonline.net/blog/2009/03/24/xpath-in-javascript-part-2/
                                var evaluator = new XPathEvaluator();
                                var resolver = evaluator.createNSResolver(contentsXML.documentElement);
    
                                var body = qnautils.xPath("//office:text", contentsXML).iterateNext();
                                if (body === null) {
                                    errorCallback("Invalid ODT file", "Could not find the <office:body> element!", true);
                                } else {
                                    // these nodes make up the content that we will import
                                    var topicsAdded = 0;
                                    var contentNodes = body.childNodes;
    
                                    var images = {};

                                    var processTopic = function (title, parentLevel, outlineLevel, index, content, successCallback) {

                                        if (index >= contentNodes.length) {
                                            if (content.length !== 0) {
                                                padContentSpec(outlineLevel, parentLevel, resultObject.contentSpec);

                                                var prefix = generalexternalimport.generateSpacing(outlineLevel);
                                                resultObject.contentSpec.push(prefix + qnastart.escapeSpecTitle(title));
                                                generalexternalimport.addTopicToSpec(topicGraph, content, title, resultObject.contentSpec.length - 1);
                                            }

                                            successCallback();
                                        } else {
                                            var contentNode = contentNodes[index];
                                            config.UploadProgress[1] = progressIncrement * (index / contentNodes.length);
                                            resultCallback();

                                            // headers indicate container or topic boundaries
                                            if (contentNode.nodeName === "text:h") {
                                                processHeader(content, contentNode, title, parentLevel, outlineLevel, index, successCallback);
                                                return;
                                            } else if (contentNode.nodeName === "text:p") {
                                                processPara(content, contentNode, images);
                                            } else if (contentNode.nodeName === "text:list") {
                                                processList(content, contentNode, images);
                                            } else if (contentNode.nodeName === "office:annotation") {
                                                processRemark(content, contentNode);
                                            } else if (contentNode.nodeName === "table:table") {
                                                processTable(content, contentNode, images);
                                            }
                                            setTimeout(function() {
                                                processTopic(title, parentLevel, outlineLevel, ++index, content, successCallback);
                                            }, 0);
                                        }
                                    };

                                    var processTable = function (content, contentNode) {
                                        var trs = qnautils.xPath(".//table:table-row", contentNode);
                                        var tr;
                                        var maxCols;
                                        while ((tr = trs.iterateNext()) !== null) {
                                            var tds =  qnautils.xPath(".//table:table-cell", tr);
                                            var td;
                                            var tdCount = 0;
                                            while ((td = tds.iterateNext()) !== null) {
                                                ++tdCount;
                                            }
                                            if (maxCols === undefined || tdCount > maxCols) {
                                                maxCols = tdCount;
                                            }
                                        }

                                        if (maxCols !== undefined) {
                                            content.push("<table frame='all'><title></title><tgroup cols='" + maxCols + "'>");

                                            for (var col = 1; col <= maxCols; ++col) {
                                                content.push("<colspec colname='c" + col + "'/>");
                                            }

                                            var processCellContents = function (cells) {

                                                var currentColumn = 1;

                                                var cell;
                                                while ((cell = cells.iterateNext()) !== null) {
                                                    var rowSpan = "";
                                                    var colSpan = "";

                                                    if (cell.getAttribute("table:number-rows-spanned") !== null) {
                                                        var numRowsToSpan = parseInt(cell.getAttribute("table:number-rows-spanned"));
                                                        rowSpan = " morerows='" + (numRowsToSpan - 1) + "'";
                                                    }

                                                    if (cell.getAttribute("table:number-columns-spanned") !== null) {
                                                        var numColsToSpan = parseInt(cell.getAttribute("table:number-columns-spanned"));
                                                        colSpan = " namest='c" + currentColumn + "' nameend='c" + (currentColumn + numColsToSpan - 1) + "'";
                                                        currentColumn += numColsToSpan - 1;
                                                    }

                                                    ++currentColumn;

                                                    var cellContents = convertNodeToDocbook(cell, true);
                                                    // nested tables need to be handled specially
                                                    if (cellContents.length !== 0 && /^<table/.test(cellContents[0])) {
                                                        var nestedMaxCols = /cols='(\d+)'>/.exec(cellContents[0])[1];
                                                        var fixedCellContents = ["<entrytbl cols='" + nestedMaxCols + "'>"];
                                                        // remove the table element, and the last tgroup element close
                                                        jquery.merge(fixedCellContents, cellContents.slice(1, cellContents.length - 1));
                                                        fixedCellContents.push("</entrytbl>");

                                                        jquery.merge(content, fixedCellContents);
                                                    } else {
                                                        content.push("<entry" + rowSpan + colSpan + ">");
                                                        jquery.merge(content, cellContents);
                                                        content.push("</entry>");
                                                    }
                                                }
                                            };

                                            content.push("<tbody>");

                                            var tbodyTrs = qnautils.xPath(".//table:table-row", contentNode);
                                            var tbodyTr;
                                            while ((tbodyTr = tbodyTrs.iterateNext()) !== null) {
                                                content.push("<row>");

                                                var cells = qnautils.xPath(".//table:table-cell", tbodyTr);
                                                processCellContents(cells);

                                                content.push("</row>");
                                            }

                                            content.push("</tbody>");


                                            content.push("</tgroup></table>");
                                        }
                                    };
    
                                    /*
                                     Expand the text:s elements and remarks.
                                     */
                                    var convertNodeToDocbook = function (node, emphasis) {
                                        var customContainerContent = [];
                                        for (var childIndex = 0; childIndex < node.childNodes.length; ++childIndex) {
                                            var childNode = node.childNodes[childIndex];
                                            if (childNode.nodeName === "text:s") {
                                                var spacesString = "";
                                                var spaces = 1;
                                                var spacesAttribute = childNode.getAttribute("text:c");
                                                if (spacesAttribute !== null) {
                                                    spaces = parseInt(spacesAttribute);
                                                }
                                                for (var i = 0; i < spaces; ++i) {
                                                    spacesString += " ";
                                                }

                                                customContainerContent.push(spacesString);

                                            } else if (childNode.nodeName === "office:annotation") {
                                                jquery.merge(customContainerContent, processRemark(remarks, childNode));
                                            } else if (childNode.nodeType === Node.TEXT_NODE) {
                                                if (childNode.textContent.length !== 0) {
                                                    var fontRule = getFontRuleForElement(childNode);
                                                    if (emphasis &&
                                                        childNode.textContent.trim().length !== 0 &&
                                                        (fontRule.bold || fontRule.italics || fontRule.underline)) {
                                                        customContainerContent.push("<emphasis>" + generalexternalimport.cleanTextContent(childNode.textContent) + "</emphasis>");
                                                    } else {
                                                        customContainerContent.push(generalexternalimport.cleanTextContent(childNode.textContent));
                                                    }
                                                }
                                            } else if (childNode.nodeName === "text:a") {
                                                var href = childNode.getAttribute("xlink:href");
                                                if (href !== null) {
                                                    customContainerContent.push('<ulink url="' + href + '">' + generalexternalimport.cleanTextContent(childNode.textContent) + '</ulink>');
                                                } else {
                                                    customContainerContent.push(generalexternalimport.cleanTextContent(childNode.textContent));
                                                }
                                            } else if (childNode.nodeName === "draw:image") {
                                                jquery.merge(customContainerContent, processDraw(childNode));
                                            } else {
                                                jquery.merge(customContainerContent, convertNodeToDocbook(childNode));
                                            }
                                        }
    
                                        return customContainerContent;
                                    };
    
                                    /*
                                        The fonts named in a style may actually map to another font. Here we check to
                                        see if a font has a mapping, and if so does it match the family.
                                     */
                                    var matchesFamily = function (font, family) {
                                        if (font === undefined || family === undefined) {
                                            return false;
                                        }
    
                                        var contentXmlStyle = qnautils.xPath("//style:font-face[@style:name='" + font + "']", contentsXML).iterateNext();
                                        var stylesXmlStyle = qnautils.xPath("//style:font-face[@style:name='" + font + "']", stylesXML).iterateNext();
    
                                        var style = contentXmlStyle !== null ? contentXmlStyle : stylesXmlStyle;
    
                                        if (style) {
                                            var familyMap = style.getAttribute("svg:font-family");
                                            var families = familyMap.split(",");
                                            var retValue = false;
                                            jquery.each(families, function(index, value) {
                                                if (value.replace(/'/g, "").trim() === family.trim()) {
                                                    retValue = true;
                                                    return false;
                                                }
                                            });
    
                                            return retValue;
                                        }
    
                                        return true;
                                    };
    
                                    /*
                                        See http://books.evc-cit.info/odbook/ch03.html for the list of style attributes.
                                     */
                                    var getFontRuleForStyle = function (styleAttribute, fontRule) {
                                        var contentXmlStyle = qnautils.xPath("//style:style[@style:name='" + styleAttribute + "']", contentsXML).iterateNext();
                                        var stylesXmlStyle = qnautils.xPath("//style:style[@style:name='" + styleAttribute + "']", stylesXML).iterateNext();
    
                                        var style = contentXmlStyle !== null ? contentXmlStyle : stylesXmlStyle;
    
                                        if (style) {
                                            var fontName = qnautils.xPath(".//@style:font-name", style).iterateNext();
                                            if (fontRule.font === undefined) {
                                                if (fontName !== null) {
                                                    fontRule.font = fontName.nodeValue;
                                                }
                                            }
    
                                            var fontSize = qnautils.xPath(".//@fo:font-size", style).iterateNext();
                                            if (fontRule.size === undefined) {
                                                if (fontSize !== null) {
                                                    fontRule.size = fontSize.nodeValue;
                                                }
                                            }
    
                                            var weight = qnautils.xPath(".//@fo:font-weight", style).iterateNext();
                                            if (fontRule.bold === undefined) {
                                                if (weight !== null) {
                                                    fontRule.bold = weight.nodeValue === "bold";
                                                }
                                            }
    
                                            var fontStyle = qnautils.xPath(".//@fo:font-style", style).iterateNext();
                                            if (fontRule.italics === undefined) {
                                                if (fontStyle !== null ) {
                                                    fontRule.italics = fontStyle.nodeValue === "italic";
                                                }
                                            }
    
                                            var underline = qnautils.xPath(".//@style:text-underline-style", style).iterateNext();
                                            if (fontRule.underline === undefined) {
                                                if (underline !== null) {
                                                    fontRule.underline = underline.nodeValue !== "none";
                                                }
                                            }
    
                                            var parentStyleName = style.getAttribute("style:parent-style-name");
    
                                            if (parentStyleName &&
                                                (!fontRule.font ||
                                                !fontRule.size ||
                                                !fontRule.bold ||
                                                !fontRule.italics ||
                                                !fontRule.underline)) {
                                                getFontRuleForStyle(parentStyleName, fontRule);
                                            }
                                        }
                                    };
    
                                    var getFontRuleForElement = function (element, fontRule) {
                                        if (fontRule === undefined) {
                                            fontRule = new fontrule.FontRule();
                                        }
    
                                        if (element.parentNode && element.parentNode !== contentsXML.documentElement) {
                                            var styleAttribute = element.parentNode.getAttribute("text:style-name");
    
                                            getFontRuleForStyle(styleAttribute, fontRule);
    
                                            if ((fontRule.font &&
                                                fontRule.size &&
                                                fontRule.bold &&
                                                fontRule.italics &&
                                                fontRule.underline) ||
                                                !element.parentNode) {
                                                return fontRule;
                                            } else {
                                                return getFontRuleForElement(element.parentNode, fontRule);
                                            }
                                        } else {
                                            return fontRule;
                                        }
                                    };
    
                                    var processRemark = function(content, contentNode) {
                                        var creator = qnautils.xPath("./dc:creator", contentNode).iterateNext();
                                        var date = qnautils.xPath("./dc:date", contentNode).iterateNext();
                                        var paras = qnautils.xPath("./text:p", contentNode);
    
                                        content.push("<remark>");
    
                                        var para;
                                        if (creator !== null) {
                                            content.push("<emphasis>" + generalexternalimport.cleanTextContent(creator.textContent) + " </emphasis>");
                                        }
                                        if (date !== null) {
                                            content.push("<emphasis>" + generalexternalimport.cleanTextContent(date.textContent) + " </emphasis>");
                                        }
    
                                        while((para = paras.iterateNext()) !== null) {
                                            content.push(generalexternalimport.cleanTextContent(para.textContent));
                                        }
                                        content.push("</remark>");
                                    };

                                    var processDraw = function(contentNode) {
                                        var imageXML = [];

                                        if (contentNode.getAttribute("xlink:href") !== null) {
                                            var href = contentNode.getAttribute("xlink:href").trim();
                                            var anchorType = contentNode.parentNode.getAttribute("text:anchor-type");
                                            // make a note of an image that we need to upload
                                            images[href] = null;


                                            if (anchorType !== "as-char") {
                                                imageXML.push("<mediaobject>");
                                            } else {
                                                imageXML.push("<inlinemediaobject>");
                                            }

                                            imageXML.push('<imageobject>\
                                                        <imagedata fileref="' + href + '"/>\
                                                    </imageobject>');

                                            if (anchorType !== "as-char") {
                                                imageXML.push("</mediaobject>");
                                            } else {
                                                imageXML.push("</inlinemediaobject>");
                                            }
                                        }

                                        return imageXML;
                                    };
    
                                    var processPara = function (content, contentNode) {
                                        if (contentNode.textContent.trim().length !== 0 ||
                                            qnautils.xPath(".//draw:image", contentNode).iterateNext() !== null) {
                                            /*
                                                It is common to have unnamed styles used to distinguish types of content. For
                                                example, a paragraph of bold DejaVu Sans Mono 12pt text could represent
                                                text displayed on the screen.
    
                                                Actually, a single paragraph will quite often be made up of multiple spans,
                                                with each span having it's own style name. This is not evident to the user
                                                though because the styles all have the same appearance.
    
                                                What we do here is find some base level style information (font, size, bold,
                                                underline, italics - the settings you can easily apply from the toolbar) and
                                                see if these basic settings are common to each span.
                                             */
                                            var textNodes = qnautils.xPath(".//text()", contentNode);
                                            var textNode;
                                            var fontRule;
                                            var singleRule = false;
                                            while((textNode = textNodes.iterateNext()) !== null) {
                                                if (textNode.textContent.trim().length !== 0) {
                                                    if (fontRule === undefined) {
                                                        fontRule = getFontRuleForElement(textNode);
                                                        singleRule = true;
                                                    } else {
                                                        var thisFontRule = getFontRuleForElement(textNode);
    
                                                        /*
                                                            Account for the same font having different names
                                                         */
                                                        if (matchesFamily(thisFontRule.font, fontRule.font) ||
                                                            matchesFamily(fontRule.font, thisFontRule.font)) {
                                                            thisFontRule.font = fontRule.font;
                                                        }
    
                                                        if (!thisFontRule.equals(fontRule)) {
                                                            singleRule = false;
                                                            break;
                                                        }
                                                    }
                                                }
                                            }
    
                                            /*
                                                If there is a single common style applied to the para (regardless of the
                                                actual number of styles applied in each span) we can then match this
                                                paragraph to the rules defined in the wizard.
                                             */
                                            var matchingRule;
                                            if (singleRule && resultObject.fontRules !== undefined) {
                                                jquery.each(resultObject.fontRules, function (index, definedFontRule) {
    
                                                    var fixedFontRule = new fontrule.FontRule(definedFontRule);

                                                    /*
                                                     Account for the same font having different names
                                                     */
                                                    if (matchesFamily(fontRule.font, fixedFontRule.font)) {
                                                        fixedFontRule.font = fontRule.font;
                                                    }
    
                                                    if (fixedFontRule.hasSameSettings(fontRule)) {
                                                        matchingRule = definedFontRule;
                                                        return false;
                                                    }
                                                });
    
                                                if (matchingRule !== undefined) {
                                                    /*
                                                        We have defined a container that will hold paragraphs with text all
                                                        of a matching style.
                                                     */
                                                    content.push("<" + matchingRule.docBookElement + ">");
                                                    jquery.merge(content, convertNodeToDocbook(contentNode));
                                                    content.push("</" + matchingRule.docBookElement + ">");
    
                                                    /*
                                                     For elements like screen we almost always want to merge consecutive
                                                     paragraphs into a single container.
                                                     */
                                                    if (matchingRule.merge && content.length >= 2) {
                                                        var endTagRe = new RegExp("</" + qnastart.escapeRegExp(matchingRule.docBookElement) + ">$");
                                                        var startTagRe = new RegExp("^<" + qnastart.escapeRegExp(matchingRule.docBookElement) + ">");
                                                        if (endTagRe.test(content[content.length - 2])) {
                                                            content[content.length - 2] = content[content.length - 2].replace(endTagRe, "");
                                                            content[content.length - 1] = content[content.length - 1].replace(startTagRe, "");
                                                        }
                                                    }
                                                } else {
                                                    /*
                                                        This is a plain old paragraph.
                                                     */
                                                    content.push("<para>");
                                                    jquery.merge(content, convertNodeToDocbook(contentNode));
                                                    content.push("</para>");
                                                }
                                            } else {
                                                /*
                                                    This is a paragraph made up of multiple styles of spans. There is no
                                                    reliable way to map the different styles to docbook elements. The
                                                    next best thing is to use the <emphasis> element to highlight
                                                    any span that is bold, underlined or italicised. The author can then
                                                    review any highlighted text and change the <emphasis> to a more
                                                    appropriate tag.
                                                 */
                                                content.push("<para>");
                                                jquery.merge(content, convertNodeToDocbook(contentNode, true));
                                                content.push("</para>");
                                            }
                                        }
                                    };
    
                                    var processList = function (content, contentNode, depth, style) {
    
                                        if (style === undefined) {
                                            style = contentNode.getAttribute("text:style-name");
                                        }
    
                                        if (depth === undefined) {
                                            depth = 1;
                                        }
    
                                        /*
                                            Find out if this is a numbered or bullet list
                                         */
                                        var listType = "itemizedlist";
                                        var listStyle = "";
                                        if (style !== null) {
                                            var styleNode = qnautils.xPath("//text:list-style[@style:name='" + style + "']", contentsXML).iterateNext();
                                            if (styleNode !== null) {
                                                var listStyleNumber = qnautils.xPath("./text:list-level-style-number[@text:level='" + depth + "']", styleNode).iterateNext();
                                                //var listStyleBullet = qnautils.xPath("./text:text:list-level-style-bullet", styleNode).iterateNext();
                                                listType = listStyleNumber === null ? "itemizedlist" : "orderedlist";
    
                                                if (listStyleNumber !== null) {
                                                    var numFormat = listStyleNumber.getAttribute("style:num-format");
                                                    if (numFormat === "a") {
                                                        listStyle = " numeration='loweralpha'";
                                                    } else if (numFormat === "A") {
                                                        listStyle = " numeration='upperalpha'";
                                                    }  else if (numFormat === "i") {
                                                        listStyle = " numeration='lowerroman'";
                                                    } else if (numFormat === "I") {
                                                        listStyle = " numeration='upperroman'";
                                                    } else {
                                                        listStyle = " numeration='arabic'";
                                                    }
                                                }
                                            }
                                        }
    
                                        var listItems = qnautils.xPath("./text:list-item", contentNode);
                                        var listHeaders = qnautils.xPath("./text:list-header", contentNode);
                                        var listItemsHeaderContent = [];
    
                                        var listHeader = listHeaders.iterateNext();
                                        if (listHeader !== null) {
                                            var paras = qnautils.xPath("./text:p", listHeader);
                                            var para;
                                            while ((para = paras.iterateNext()) !== null) {
                                                processPara(listItemsHeaderContent, para);
                                            }
                                        }
    
                                        var listItem;
                                        if ((listItem = listItems.iterateNext()) !== null) {
                                            content.push("<" + listType + listStyle + ">");
    
                                            jquery.each(listItemsHeaderContent, function (index, value) {
                                                content.push(value);
                                            });

                                            do {
                                                var listItemContents = [];
                                                jquery.each(listItem.childNodes, function (index, childNode) {
                                                    if (childNode.nodeName === "text:p") {
                                                        processPara(listItemContents, childNode);
                                                    } else if (childNode.nodeName === "text:list") {
                                                        processList(listItemContents, childNode, depth + 1, style);
                                                    }
                                                });
                                                if (listItemContents.length !== 0) {
                                                    content.push("<listitem>");
                                                    jquery.merge(content, listItemContents);
                                                    content.push("</listitem>");
                                                }
                                            } while ((listItem = listItems.iterateNext()) !== null);
    
                                            content.push("</" + listType + ">");
                                        } else {
                                            // we have found a list that contains only a header. this is really just a para
                                            jquery.each(listItemsHeaderContent, function (index, value) {
                                                content.push(value);
                                            });
                                        }
                                    };

                                    var padContentSpec = function(currentLevel, previousLevel, contentSpec) {
                                        /*
                                         A content spec can not skip levels in the toc. So when we skip heading levels
                                         (say a heading 3 under a heading 1) we need to pad the spec out.
                                         */
                                        if (currentLevel > previousLevel + 1) {
                                            for (var missedSteps = previousLevel + 1; missedSteps < currentLevel; ++missedSteps) {
                                                if (missedSteps === 1) {
                                                    contentSpec.push("Chapter: Missing Chapter");
                                                } else {
                                                    var myPrefix = generalexternalimport.generateSpacing(missedSteps);
                                                    contentSpec.push(myPrefix + "Section: Missing Section");
                                                }
                                            }
                                        }
                                    }

                                    var processHeader = function (content, contentNode, title, previousLevel, currentLevel, index, successCallback) {
                                        ++topicsAdded;

                                        var prefix = generalexternalimport.generateSpacing(currentLevel);

                                        /*
                                         This value represents the depth of the topic to be created using the title
                                         of the header we just found, and any sibling content nodes before the next
                                         heading.
                                         */
                                        var newOutlineLevel = parseInt(contentNode.getAttribute("text:outline-level"));

                                        /*
                                         A content spec can not skip levels in the toc. So when we skip heading levels
                                         (say a heading 3 under a heading 1) we need to pad the spec out.
                                         */
                                        padContentSpec(currentLevel, previousLevel, resultObject.contentSpec);

                                        /*
                                         Thanks to the loop above, levels never jump more than 1 place up.
                                         */
                                        previousLevel = currentLevel - 1;


                                        /*
                                         Some convenient statements about what is going on.
                                         */
                                        var thisTopicHasContent =  content.length !== 0;
                                        var thisTopicIsChildOfLastLevel = currentLevel > previousLevel;
                                        var nextTopicIsChildOfLastLevel = newOutlineLevel > previousLevel;
                                        var nextTopicIsChildOfThisTopic = newOutlineLevel > currentLevel;

                                        if (!thisTopicHasContent && nextTopicIsChildOfThisTopic) {
                                            /*
                                             Last heading had no content before this heading. We only add a container if
                                             the last heading added a level of depth to the tree, Otherwise it is just
                                             an empty container.
                                             */

                                            if (currentLevel === 1) {
                                                resultObject.contentSpec.push("Chapter: " + qnastart.escapeSpecTitle(title));
                                            } else {
                                                resultObject.contentSpec.push(prefix + "Section: " + qnastart.escapeSpecTitle(title));
                                            }
                                        } else if (thisTopicHasContent) {
                                            if (currentLevel === 1) {
                                                resultObject.contentSpec.push("Chapter: " + qnastart.escapeSpecTitle(title));
                                            } else {
                                                /*
                                                 Does the topic noe being built exist under this one? If so, this topic is
                                                 a container. If not, it is just a topic.
                                                 */
                                                if (newOutlineLevel > currentLevel) {
                                                    resultObject.contentSpec.push(prefix + "Section: " + qnastart.escapeSpecTitle(title));
                                                } else {
                                                    resultObject.contentSpec.push(prefix + qnastart.escapeSpecTitle(title));
                                                }
                                            }

                                            generalexternalimport.addTopicToSpec(topicGraph, content, title, resultObject.contentSpec.length - 1);
                                        } else {
                                            /*
                                             If the discarded topic was supposed to a child of the container
                                             above it, and the new topic being created is not, then the
                                             previous topic will need to be changed from a container to a topic.
                                             */
                                            if (thisTopicIsChildOfLastLevel && !nextTopicIsChildOfLastLevel) {
                                                resultObject.contentSpec[resultObject.contentSpec.length - 1] =
                                                    resultObject.contentSpec[resultObject.contentSpec.length - 1].replace(/^(\s*)[A-Za-z]+: /, "$1");

                                                /*
                                                 We want to unwind any containers without front matter topics that were
                                                 added to the toc to accommodate this now discarded topic.

                                                 So any line added to the spec that doesn't have an associated topic and
                                                 that is not an ancestor of the next topic will be poped off the stack.
                                                 */
                                                if (currentLevel > 1) {
                                                    while (true) {
                                                        var specElementTopic = topicGraph.getNodeFromSpecLine(resultObject.contentSpec.length - 1);
                                                        if (specElementTopic === undefined) {
                                                            var specElementLevel = /^(\s*)/.exec(resultObject.contentSpec[resultObject.contentSpec.length - 1]);
                                                            if (specElementLevel[1].length === newOutlineLevel - 2) {
                                                                break;
                                                            } else {
                                                                resultObject.contentSpec.pop();
                                                            }
                                                        } else {
                                                            break;
                                                        }
                                                    }
                                                }
                                            }

                                            /*
                                             Since this topic is being discarded, the parent outline level continues through
                                             */
                                            currentLevel = previousLevel;
                                        }

                                        var newTitleArray = convertNodeToDocbook(contentNode, false, images, false);
                                        var newTitle = "";
                                        jquery.each(newTitleArray, function(index, value){
                                            newTitle += value;
                                        });
                                        if (newTitle.length === 0) {
                                            newTitle = "Untitled";
                                        }

                                        setTimeout(function() {
                                            processTopic(newTitle, currentLevel, newOutlineLevel, index + 1, [], successCallback);
                                        }, 0);
                                    };

                                    processTopic(
                                        "Untitled",
                                        1,
                                        1,
                                        0,
                                        [],
                                        function() {
                                            config.UploadProgress[1] = progressIncrement;
                                            config.ResolvedBookStructure = true;
                                            resultCallback();

                                            uploadImagesLoop();
                                        }
                                    );

                                    var uploadImages = function (index, imagesKeys, callback) {
                                        if (index >= imagesKeys.length) {
                                            callback();
                                        } else {
                                            config.UploadProgress[1] = progressIncrement + (index / topicGraph.nodes.length * progressIncrement);
                                            resultCallback();
    
                                            var imagePath = imagesKeys[index];
    
                                            qnastart.createImage(
                                                qnastart.zipModel,
                                                config.CreateOrResuseImages === "REUSE",
                                                config.OdtFile,
                                                imagePath,
                                                config.ImportLang,
                                                config,
                                                function (data) {
                                                    var imageId = config.CreateOrResuseImages === "REUSE" ? data.image.id : data.id;

                                                    images[imagePath] = "images/" + imageId + imagePath.substr(imagePath.lastIndexOf("."));

                                                    config.UploadedImageCount += 1;

                                                    if (config.CreateOrResuseImages === "REUSE" && data.matchedExistingImage) {
                                                        config.MatchedImageCount += 1;
                                                    }
    
                                                    config.NewImagesCreated = (config.UploadedImageCount - config.MatchedImageCount) + " / " + config.MatchedImageCount;
                                                    resultCallback();
    
                                                    uploadImages(index + 1, imagesKeys, callback);
                                                },
                                                errorCallback
                                            );
                                        }
                                    };
    
                                    var uploadImagesLoop = function() {
                                        uploadImages(0, qnautils.keys(images), function(){
                                            config.UploadProgress[1] = progressIncrement * 2;
                                            config.UploadedImages = true;
                                            resultCallback();
    
                                            jquery.each(topicGraph.nodes, function (index, topic) {
                                                var filerefs = qnautils.xPath(".//@fileref", topic.xml);
                                                var replacements = [];
                                                var fileref;
                                                while ((fileref = filerefs.iterateNext()) !== null) {
                                                    replacements.push({attr: fileref, value: images[fileref.nodeValue]});
                                                }
    
                                                jquery.each(replacements, function (index, replacement) {
                                                    replacement.attr.nodeValue = replacement.value;
                                                });
                                            });
    
                                            createTopicsLoop();
                                        });
                                    };
    
                                    var createTopics = function (index, callback) {
                                        if (index >= topicGraph.nodes.length) {
                                            callback();
                                        } else {
                                            config.UploadProgress[1] = progressIncrement * 2  + (index / topicGraph.nodes.length * progressIncrement);
                                            resultCallback();
    
                                            var topic = topicGraph.nodes[index];
    
                                            qnastart.createTopic(
                                                config.CreateOrResuseTopics === "REUSE",
                                                4.5,
                                                qnautils.reencode(qnautils.xmlToString(topic.xml), topic.xmlReplacements).trim(),
                                                topic.title,
                                                null,
                                                config.ImportLang,
                                                config,
                                                function (data) {

                                                    var topicId = config.CreateOrResuseTopics === "REUSE" ? data.topic.id : data.id;
                                                    var topicXML = config.CreateOrResuseTopics === "REUSE" ? data.topic.xml : data.xml;

                                                    if (config.CreateOrResuseImages === "REUSE" && data.matchedExistingImage) {
                                                        config.MatchedImageCount += 1;
                                                    }

                                                    config.NewTopicsCreated = (config.UploadedTopicCount - config.MatchedTopicCount) + " / " + config.MatchedTopicCount;
                                                    resultCallback();
    
                                                    topic.setTopicId(topicId);
                                                    topic.setXmlReplacements(qnautils.replaceEntitiesInText(topicXML));
    
                                                    createTopics(index + 1, callback);
                                                },
                                                errorCallback
                                            );
                                        }
                                    };
    
                                    var createTopicsLoop = function() {
                                        createTopics(0, function(){
                                            config.UploadProgress[1] = progressIncrement * 3;
                                            config.UploadedTopics = true;
                                            resultCallback();
    
                                            jquery.each(topicGraph.nodes, function (index, topic) {
                                                resultObject.contentSpec[topic.specLine] += " [" + topic.topicId + "]";
    
                                            });
    
                                            var spec = "";
                                            jquery.each(resultObject.contentSpec, function(index, value) {
                                                console.log(value);
                                                spec += value + "\n";
                                            });
    
                                            qnastart.createContentSpec(
                                                spec,
                                                config.ImportLang,
                                                config,
                                                function(id) {
                                                    config.ContentSpecID = id;
    
                                                    config.UploadProgress[1] = progressIncrement * 4;
                                                    config.UploadedContentSpecification = true;
                                                    resultCallback(true);
    
                                                    console.log("Content Spec ID: " + id);
                                                },
                                                errorCallback
                                            );
                                        });
                                    };
                                }
                            },
                            errorCallback
                        );
                    },
                    errorCallback
                );
            })
            .setNextStep(function (resultCallback) {
                window.onbeforeunload = undefined;
    
                resultCallback(summary);
            });
    
    
        var summary = new qna.QNAStep()
            .setTitle("Import Summary")
            .setOutputs([
                new qna.QNAVariables()
                    .setVariables([
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.HTML)
                            .setIntro("Content Specification ID")
                            .setName("ContentSpecIDLink")
                            .setValue(function (resultCallback, errorCallback, result, config) {
                                resultCallback("<a href='http://" + config.PressGangHost + ":8080/pressgang-ccms-ui/#ContentSpecFilteredResultsAndContentSpecView;query;contentSpecIds=" + config.ContentSpecID + "'>" + config.ContentSpecID + "</a>");
                            }),
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.PLAIN_TEXT)
                            .setIntro("Imported From")
                            .setName("ImportedFrom")
                            .setValue(function (resultCallback, errorCallback, result, config) {
                                resultCallback(config.OdtFile.name);
                            }),
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.PLAIN_TEXT)
                            .setIntro("Topics Created / Topics Reused")
                            .setName("NewTopicsCreated"),
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.PLAIN_TEXT)
                            .setIntro("Images Created / Images Reused")
                            .setName("NewImagesCreated")
                    ])
            ])
            .setShowNext(false)
            .setShowPrevious(false)
            .setShowRestart(true);
    
    }
);