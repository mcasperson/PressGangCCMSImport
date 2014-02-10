(function (global) {
    'use strict';

    /*
        STEP 1 - Get the ODT file
     */
    global.askForOpenDocumentFile = new global.QNAStep()
        .setTitle("Select the ODT file to import")
        .setIntro("Select the ODT file that contains the content you wish to import.")
        .setInputs(
            [
                new global.QNAVariables()
                    .setVariables([
                        new global.QNAVariable()
                            .setType(global.InputEnum.SINGLE_FILE)
                            .setIntro("OpenDocument ODT File")
                            .setName("OdtFile")
                    ])
            ]
        )
        .setProcessStep(function (resultCallback, errorCallback, result, config) {
            if (!config.OdtFile) {
                errorCallback("Please select a file", "You need to select an ODT file before continuing.");
            } else if (config.OdtFile.name.lastIndexOf(".odt") !== config.OdtFile.name.length - 4) {
                errorCallback("Please select a file", "You need to select an ODT file before continuing.");
            } else {
                global.zipModel.getCachedEntries(config.OdtFile, function (entries) {

                    var foundContentFile = false;
                    global.angular.forEach(entries, function (value, key) {
                        if (value.filename === "content.xml") {
                            foundContentFile = true;
                            return false;
                        }
                    });

                    var foundStyleFile = false;
                    global.angular.forEach(entries, function (value, key) {
                        if (value.filename === "styles.xml") {
                            foundStyleFile = true;
                            return false;
                        }
                    });

                    if (!foundContentFile || !foundStyleFile) {
                        errorCallback("Error", "The ODT file did not contain either a styles.xml or content.xml file. The selected file is not a valid OpenDocument file.");
                    } else {
                        resultCallback(null);
                    }
                }, function (message) {
                    errorCallback("Error", "Could not process the ODT file!");
                });
            }
        })
        .setNextStep(function (resultCallback) {
            resultCallback(getSpecDetails);
        });

    /*
        STEP 2 - Get content spec details
     */
    var getSpecDetails = new global.QNAStep()
        .setTitle("Enter content specification details")
        .setIntro("Enter the basic details of the content specification")
        .setInputs(
            [
                new global.QNAVariables()
                    .setVariables([
                        new global.QNAVariable()
                            .setType(global.InputEnum.TEXTBOX)
                            .setIntro("Title")
                            .setName("ContentSpecTitle")
                            .setValue("Title"),
                        new global.QNAVariable()
                            .setType(global.InputEnum.TEXTBOX)
                            .setIntro("Subtitle")
                            .setName("ContentSpecSubtitle")
                            .setValue("Subtitle"),
                        new global.QNAVariable()
                            .setType(global.InputEnum.TEXTBOX)
                            .setIntro("Product")
                            .setName("ContentSpecProduct")
                            .setValue("Product"),
                        new global.QNAVariable()
                            .setType(global.InputEnum.TEXTBOX)
                            .setIntro("Version")
                            .setName("ContentSpecVersion")
                            .setValue("1"),
                        new global.QNAVariable()
                            .setType(global.InputEnum.TEXTBOX)
                            .setIntro("Copyright Holder")
                            .setName("ContentSpecCopyrightHolder")
                            .setValue("Red Hat"),
                        new global.QNAVariable()
                            .setType(global.InputEnum.COMBOBOX)
                            .setIntro("Brand")
                            .setName("ContentSpecBrand")
                            .setValue("RedHat")
                            .setOptions(["RedHat", "JBoss", "Fedora"])
                    ])
            ]
        )
        .setProcessStep(function (resultCallback, errorCallback, result, config) {
            if (!config.ContentSpecTitle) {
                errorCallback("Please enter a title.");
            } else if (!config.ContentSpecProduct) {
                errorCallback("Please enter a product.");
            } else if (!config.ContentSpecVersion) {
                errorCallback("Please enter a version.");
            } else if (!config.ContentSpecCopyrightHolder) {
                errorCallback("Please enter a copyright holder.");
            } else {
                var contentSpec = [];
                contentSpec.push("Title = " + config.ContentSpecTitle);

                if (config.ContentSpecSubtitle !== undefined &&
                    config.ContentSpecSubtitle !== null &&
                    config.ContentSpecSubtitle.trim().length !== 0) {
                    contentSpec.push("Subtitle = " + config.ContentSpecProduct);
                }

                contentSpec.push("Product = " + config.ContentSpecProduct);
                contentSpec.push("Version = " + config.ContentSpecVersion);
                contentSpec.push("Copyright Holder = " + config.ContentSpecCopyrightHolder);
                contentSpec.push("Brand = " + config.ContentSpecBrand);
                contentSpec.push("# Imported from " + config.OdtFile.name);
                resultCallback(JSON.stringify({contentSpec: contentSpec}));
            }
        })
        .setNextStep(function (resultCallback) {
            resultCallback(specifyTheServer);
        });

    /*
        Step 3 - ask which server this is being uploaded to
     */
    var specifyTheServer = new global.QNAStep()
        .setTitle("Select the server to import in to")
        .setIntro("You can create the imported content specification on either the production or test PressGang servers. " +
            "Using the test server is recommended for the first import to check the results before adding the content to the production server.")
        .setInputs([
            new global.QNAVariables()
                .setVariables([
                    new global.QNAVariable()
                        .setType(global.InputEnum.RADIO_BUTTONS)
                        .setIntro(["Production Server", "Test Server"])
                        .setOptions(["skynet.usersys.redhat.com", "skynet-dev.usersys.redhat.com"])
                        .setValue("skynet-dev.usersys.redhat.com")
                        .setName("PressGangHost")
                ])
        ])
        .setNextStep(function (resultCallback) {
            resultCallback(useStyleRules);
        });

    var useStyleRules = new global.QNAStep()
        .setTitle("Do you want to define additional style rules")
        .setIntro("You have the option of wrapping paragraphs that match certain font styles in DocBook elements other than <para>s. " +
            "This is useful when the document being imported consistently applies different font to paragraphs that represent screen output or source code.")
        .setInputs([
            new global.QNAVariables()
                .setVariables([
                    new global.QNAVariable()
                        .setType(global.InputEnum.RADIO_BUTTONS)
                        .setIntro(["Yes", "No"])
                        .setOptions(["Yes", "No"])
                        .setValue("No")
                        .setName("UseStyleRules")
                ])
        ])
        .setNextStep(function (resultCallback, errorCallback, result, config) {
            resultCallback(config.UseStyleRules === "Yes" ? setParaRules : processOdt);
        });

    function getRulesText(rulesCollection) {
        var rules = "";

        if (rulesCollection) {
            global.jQuery.each(rulesCollection, function(index, fontRule) {

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
    var setParaRules = new global.QNAStep()
        .setTitle("Define a rule for a paragraph")
        .setIntro("You can define the DocBook block element to wrap an imported paragraph in by matching font styles.")
        .setOutputs([
            new global.QNAVariables()
                .setVariables([
                    new global.QNAVariable()
                        .setType(global.InputEnum.HTML)
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
            new global.QNAVariables()
                .setVariables([
                    new global.QNAVariable()
                        .setType(global.InputEnum.TEXTBOX)
                        .setIntro("Font Name")
                        .setName("FontName")
                        .setValue(function (resultCallback, errorCallback, result, config) {
                            resultCallback(config.FontName);
                        }),
                    new global.QNAVariable()
                        .setType(global.InputEnum.TEXTBOX)
                        .setIntro("Font Size")
                        .setName("FontSize"),
                    new global.QNAVariable()
                        .setType(global.InputEnum.CHECKBOX)
                        .setIntro("Bold")
                        .setName("Bold"),
                    new global.QNAVariable()
                        .setType(global.InputEnum.CHECKBOX)
                        .setIntro("Italics")
                        .setName("Italics"),
                    new global.QNAVariable()
                        .setType(global.InputEnum.CHECKBOX)
                        .setIntro("Underline")
                        .setName("Underline"),
                    new global.QNAVariable()
                        .setType(global.InputEnum.COMBOBOX)
                        .setIntro("DocBook Element")
                        .setName("DocBookElement")
                        .setOptions(["programlisting", "screen", "literallayout", "synopsis"]), // http://docbook.org/tdg/en/html/ch02.html#ch02-logdiv
                    new global.QNAVariable()
                        .setType(global.InputEnum.CHECKBOX)
                        .setIntro("Merge Consecutive Elements")
                        .setName("MergeConsecutiveElements"),
                    new global.QNAVariable()
                        .setType(global.InputEnum.CHECKBOX)
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
            var fontRule = new global.FontRule();

            if (!config.DocBookElement) {
                errorCallback("incomplete form", "Please specify the DocBook element that this rule will create.");
                return;
            } else {
                fontRule.setDocBookElement(config.DocBookElement);
            }

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
            resultCallback(config.DefineAnotherRule ? setParaRules : processOdt);
        });

    /*
        STEP 5 - process the ODT file
     */
    var processOdt = new global.QNAStep()
        .setShowNext(false)
        .setShowPrevious(false)
        .setTitle("Processing the ODT file")
        .setIntro("The list below allows you to monitor the progress of the import process. Steps with an asterisk (*) can take some time to complete, so please be patient.")
        .setOutputs([
            new global.QNAVariables()
                .setVariables([
                    new global.QNAVariable()
                        .setType(global.InputEnum.HTML)
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
                    new global.QNAVariable()
                        .setType(global.InputEnum.CHECKBOX)
                        .setIntro("Resolving Book Structure")
                        .setName("ResolvedBookStructure"),
                    new global.QNAVariable()
                        .setType(global.InputEnum.CHECKBOX)
                        .setIntro("Uploading Images*")
                        .setName("UploadedImages"),
                    new global.QNAVariable()
                        .setType(global.InputEnum.CHECKBOX)
                        .setIntro("Uploading Topics*")
                        .setName("UploadedTopics"),
                    new global.QNAVariable()
                        .setType(global.InputEnum.CHECKBOX)
                        .setIntro("Uploading content specification")
                        .setName("UploadedContentSpecification"),
                    new global.QNAVariable()
                        .setType(global.InputEnum.PLAIN_TEXT)
                        .setIntro("Topics Created / Topics Reused")
                        .setName("NewTopicsCreated"),
                    new global.QNAVariable()
                        .setType(global.InputEnum.PLAIN_TEXT)
                        .setIntro("Images Created / Images Reused")
                        .setName("NewImagesCreated"),
                    new global.QNAVariable()
                        .setType(global.InputEnum.PROGRESS)
                        .setIntro("Progress")
                        .setName("UploadProgress")
                        // gotta set this first up because of https://github.com/angular-ui/bootstrap/issues/1547
                        .setValue([100, 0])
                ])
        ])
        .setEnterStep(function (resultCallback, errorCallback, result, config) {

            var progressIncrement = 100 / 4;

            var resultObject = JSON.parse(result);

            /*
                Add any rules that were defined when parsing this book
             */
            var rulesLines = getRulesText(resultObject.fontRules).split("<br/>");
            global.jQuery.each(rulesLines, function (index, value) {
                resultObject.contentSpec.push("#" + value);
            });

            /*
             Initialize some config values
             */
            config.UploadedTopicCount = 0;
            config.MatchedTopicCount = 0;
            config.UploadedImageCount = 0;
            config.MatchedImageCount = 0;

            global.zipModel.getTextFromFileName(
                config.OdtFile,
                "content.xml",
                function (contents) {
                    global.zipModel.getTextFromFileName(
                        config.OdtFile,
                        "styles.xml",
                        function(styles) {

                            var topicGraph = new global.TopicGraph();
                            var contentsXML = global.jQuery.parseXML(contents);
                            var stylesXML = global.jQuery.parseXML(styles);

                            // http://www.nczonline.net/blog/2009/03/24/xpath-in-javascript-part-2/
                            var evaluator = new global.XPathEvaluator();
                            var resolver = evaluator.createNSResolver(contentsXML.documentElement);

                            var body = contentsXML.evaluate("//office:text", contentsXML, resolver, global.XPathResult.ANY_TYPE, null).iterateNext();
                            if (body === null) {
                                errorCallback("Invalid ODT file", "Could not find the <office:body> element!");
                            } else {
                                // these nodes make up the content that we will import
                                var contentNodes = contentsXML.evaluate("*", body, resolver, global.XPathResult.ANY_TYPE, null);

                                var images = {};

                                var processTopic = function (title, outlineLevel) {
                                    var content = [];
                                    var contentNode;
                                    while ((contentNode = contentNodes.iterateNext()) !== null) {
                                        // headers indicate container or topic boundaries
                                        if (contentNode.nodeName === "text:h") {
                                            processHeader(content, contentNode, title, outlineLevel);
                                            break;
                                        } else if (contentNode.nodeName === "text:p") {
                                            processPara(content, contentNode, images);
                                        } else if (contentNode.nodeName === "text:list") {
                                            processList(content, contentNode, images);
                                        }
                                    }
                                };

                                var generateSpacing = function (outlineLevel) {
                                    var prefix = "";
                                    for (var i = 0; i < outlineLevel * 2; ++i) {
                                        prefix += " ";
                                    }
                                    return prefix;
                                };

                                /*
                                    See http://books.evc-cit.info/odbook/ch03.html for the list of style attributes.
                                 */
                                var getFontRuleForStyle = function (styleAttribute, fontRule) {
                                    var contentXmlStyle = contentsXML.evaluate("//style:style[@style:name='" + styleAttribute + "']", contentsXML, resolver, global.XPathResult.ANY_TYPE, null).iterateNext();
                                    var stylesXmlStyle = stylesXML.evaluate("//style:style[@style:name='" + styleAttribute + "']", stylesXML, resolver, global.XPathResult.ANY_TYPE, null).iterateNext();

                                    var style = contentXmlStyle !== null ? contentXmlStyle : stylesXmlStyle;

                                    if (style) {
                                        var fontName = contentsXML.evaluate(".//@style:font-name", style, resolver, global.XPathResult.ANY_TYPE, null).iterateNext();
                                        if (fontRule.font === undefined) {
                                            if (fontName !== null) {
                                                fontRule.font = fontName.nodeValue;
                                            }
                                        }

                                        var fontSize = contentsXML.evaluate(".//@fo:font-size", style, resolver, global.XPathResult.ANY_TYPE, null).iterateNext();
                                        if (fontRule.size === undefined) {
                                            if (fontSize !== null) {
                                                fontRule.size = fontSize.nodeValue;
                                            }
                                        }

                                        var weight = contentsXML.evaluate(".//@fo:font-weight", style, resolver, global.XPathResult.ANY_TYPE, null).iterateNext();
                                        if (fontRule.bold === undefined) {
                                            if (weight !== null && weight.nodeValue === "bold") {
                                                fontRule.bold = true;
                                            }
                                        }

                                        var fontStyle = contentsXML.evaluate(".//@fo:font-style", style, resolver, global.XPathResult.ANY_TYPE, null).iterateNext();
                                        if (fontRule.italics === undefined) {
                                            if (fontStyle !== null && fontStyle.nodeValue === "italic") {
                                                fontRule.italics = true;
                                            }
                                        }

                                        var underline = contentsXML.evaluate(".//@style:text-underline-style", style, resolver, global.XPathResult.ANY_TYPE, null).iterateNext();
                                        if (fontRule.underline === undefined) {
                                            if (underline !== null && underline.nodeValue !== "none") {
                                                fontRule.underline = true;
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
                                }

                                var getFontRuleForElement = function (element, fontRule) {
                                    if (fontRule === undefined) {
                                        fontRule = new global.FontRule();
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

                                var processPara = function (content, contentNode, imageLinks) {
                                    var images = contentsXML.evaluate(".//draw:image", contentNode, resolver, global.XPathResult.ANY_TYPE, null);
                                    var image;
                                    while ((image = images.iterateNext()) !== null) {
                                        if (image.getAttribute("xlink:href") !== null) {
                                            var href = image.getAttribute("xlink:href").trim();
                                            // make a not of an image that we need to upload
                                            imageLinks[href] = null;
                                            content.push('<mediaobject>\
                                                            <imageobject>\
                                                                <imagedata fileref="' + href + '"/>\
                                                             </imageobject>\
                                                        </mediaobject>');
                                        }
                                    }

                                    if (contentNode.textContent.trim().length !== 0) {



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
                                        var textNodes = contentsXML.evaluate(".//text()", contentNode, resolver, global.XPathResult.ANY_TYPE, null);
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
                                            global.jQuery.each(resultObject.fontRules, function (index, definedFontRule) {
                                                if (new global.FontRule(definedFontRule).hasSameSettings(fontRule)) {
                                                    matchingRule = definedFontRule;
                                                    return false;
                                                }
                                            });

                                            if (matchingRule !== undefined) {
                                                /*
                                                    We have defined a container that will hold paragraphs with text all
                                                    of a matching style.
                                                 */
                                                content.push("<" + matchingRule.docBookElement + ">" + contentNode.textContent + "</" + matchingRule.docBookElement + ">");

                                                /*
                                                 For elements like screen we almost always want to merge consecutive
                                                 paragraphs into a single container.
                                                 */
                                                if (matchingRule.merge && content.length >= 2) {
                                                    var endTagRe = new RegExp("</" + global.escapeRegExp(matchingRule.docBookElement) + ">$");
                                                    var startTagRe = new RegExp("^<" + global.escapeRegExp(matchingRule.docBookElement) + ">");
                                                    if (endTagRe.test(content[content.length - 2])) {
                                                        content[content.length - 2] = content[content.length - 2].replace(endTagRe, "");
                                                        content[content.length - 1] = content[content.length - 1].replace(startTagRe, "");
                                                    }
                                                }
                                            } else {
                                                /*
                                                    This is a plain old paragraph.
                                                 */
                                                content.push("<para>" + contentNode.textContent + "</para>");
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
                                            var paraContent = "";
                                            textNodes = contentsXML.evaluate(".//text()", contentNode, resolver, global.XPathResult.ANY_TYPE, null);
                                            while((textNode = textNodes.iterateNext()) !== null) {
                                                if (textNode.textContent.length !== 0) {
                                                    fontRule = getFontRuleForElement(textNode);
                                                    if (textNode.textContent.trim().length !== 0 && (fontRule.bold || fontRule.italics || fontRule.underline)) {
                                                        paraContent += "<emphasis>" + textNode.textContent + "</emphasis>";
                                                    } else {
                                                        paraContent += textNode.textContent;
                                                    }
                                                }
                                            }

                                            content.push("<para>" + paraContent + "</para>");
                                        }
                                    }
                                };

                                var processList = function (content, contentNode, imageLinks) {
                                    /*
                                        Find out if this is a numbered or bullet list
                                     */
                                    var itemizedList = true;
                                    var styleName = contentNode.getAttribute("text:style-name");
                                    if (styleName !== null) {
                                        var style = contentsXML.evaluate("//text:list-style[@style:name='" + styleName + "']", contentsXML, resolver, global.XPathResult.ANY_TYPE, null).iterateNext();
                                        if (style !== null) {
                                            var listStyleNumber = contentsXML.evaluate("./text:list-level-style-number", style, resolver, global.XPathResult.ANY_TYPE, null).iterateNext();
                                            //var listStyleBullet = contentsXML.evaluate("./text:text:list-level-style-bullet", style, resolver, global.XPathResult.ANY_TYPE, null).iterateNext();
                                            itemizedList = listStyleNumber === null;
                                        }
                                    }

                                    var listItems = contentsXML.evaluate("./text:list-item", contentNode, resolver, global.XPathResult.ANY_TYPE, null);
                                    var listHeaders = contentsXML.evaluate("./text:list-header", contentNode, resolver, global.XPathResult.ANY_TYPE, null);
                                    var listItemsHeaderContent = [];

                                    var listHeader = listHeaders.iterateNext();
                                    if (listHeader !== null) {
                                        var paras = contentsXML.evaluate("./text:p", listHeader, resolver, global.XPathResult.ANY_TYPE, null);
                                        var para;
                                        while ((para = paras.iterateNext()) !== null) {
                                            processPara(listItemsHeaderContent, para, imageLinks);
                                        }
                                    }

                                    var listItem;
                                    if ((listItem = listItems.iterateNext()) !== null) {
                                        content.push(itemizedList ? "<itemizedlist>" : "<orderedlist>");

                                        global.jQuery.each(listItemsHeaderContent, function (index, value) {
                                            content.push(value);
                                        });


                                        do {
                                            content.push("<listitem>");

                                            global.jQuery.each(listItem.childNodes, function (index, childNode) {
                                                if (childNode.nodeName === "text:p") {
                                                    processPara(content, childNode, imageLinks);
                                                } else if (childNode.nodeName === "text:list") {
                                                    processList(content, childNode, imageLinks);
                                                }
                                            });

                                            content.push("</listitem>");
                                        } while ((listItem = listItems.iterateNext()) !== null);

                                        content.push(itemizedList ? "</itemizedlist>" : "</orderedlist>");
                                    } else {
                                        // we have found a list that contains only a header. this is really just a para
                                        global.jQuery.each(listItemsHeaderContent, function (index, value) {
                                            content.push(value);
                                        });
                                    }
                                };

                                var processHeader = function (content, contentNode, title, outlineLevel) {
                                    var prefix = generateSpacing(outlineLevel);

                                    var newOutlineLevel = parseInt(contentNode.getAttribute("text:outline-level")) - 1;
                                    if (newOutlineLevel > outlineLevel && Math.abs(newOutlineLevel - outlineLevel) > 1) {
                                        errorCallback("Outline levels jumped too much");
                                        return;
                                    }

                                    // Last heading had no content before this heading. We only add a container if
                                    // the last heading added a level of depth to the tree, Otherwise it is just
                                    // an empty container.
                                    if (content.length === 0 && title !== null && newOutlineLevel > outlineLevel) {
                                        if (outlineLevel === 0) {
                                            resultObject.contentSpec.push("Chapter: " + global.escapeSpecTitle(title));
                                        } else {
                                            resultObject.contentSpec.push(prefix + "Section: " + global.escapeSpecTitle(title));
                                        }
                                    } else if (content.length !== 0) {
                                        /*
                                         We have found some initial text. Put it under an introduction chapter
                                         */
                                        if (title === null) {
                                            title = "Introduction";
                                            resultObject.contentSpec.push("Chapter: " + global.escapeSpecTitle(title));
                                        } else {
                                            if (newOutlineLevel > outlineLevel) {
                                                resultObject.contentSpec.push(prefix + "Section: " + global.escapeSpecTitle(title));
                                            } else {
                                                resultObject.contentSpec.push(prefix + global.escapeSpecTitle(title));
                                            }
                                        }

                                        var xmlString = "";
                                        global.jQuery.each(content, function(index, value){
                                            xmlString += value;
                                        });

                                        var xml = global.jQuery.parseXML("<section><title>" + title + "</title>" + xmlString + "</section>");

                                        var topic = new global.TopicGraphNode(topicGraph);
                                        topic.setXml(xml, xml);
                                        topic.setSpecLine(resultObject.contentSpec.length - 1);
                                        topic.setTitle(title);
                                    }

                                    var newTitle = contentNode.textContent.trim();
                                    if (newTitle.length === 0) {
                                        newTitle = "Untitled";
                                    }

                                    newTitle = newTitle.replace(/^(\d+)(\.\d+)*\.?\s*/, "");

                                    processTopic(newTitle, newOutlineLevel);
                                };

                                processTopic(null, 0);

                                config.UploadProgress[1] = progressIncrement;
                                config.ResolvedBookStructure = true;
                                resultCallback();

                                var uploadImages = function (index, imagesKeys, callback) {
                                    if (index >= imagesKeys.length) {
                                        callback();
                                    } else {
                                        config.UploadProgress[1] = progressIncrement + (index / topicGraph.nodes.length * progressIncrement);
                                        resultCallback();

                                        var imagePath = imagesKeys[index];

                                        global.createImage(
                                            config.OdtFile,
                                            imagePath,
                                            config,
                                            function (id, matched) {
                                                images[imagePath] = "images/" + id + imagePath.substr(imagePath.lastIndexOf("."));

                                                config.UploadedImageCount += 1;
                                                if (matched) {
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
                                    uploadImages(0, global.keys(images), function(){
                                        config.UploadProgress[1] = progressIncrement * 2;
                                        config.UploadedImages = true;
                                        resultCallback();

                                        global.jQuery.each(topicGraph.nodes, function (index, topic) {
                                            var filerefs = contentsXML.evaluate(".//@fileref", topic.xml, resolver, global.XPathResult.ANY_TYPE, null);
                                            var replacements = [];
                                            var fileref;
                                            while ((fileref = filerefs.iterateNext()) !== null) {
                                                replacements.push({attr: fileref, value: images[fileref.nodeValue]});
                                            }

                                            global.jQuery.each(replacements, function (index, replacement) {
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

                                        global.createTopic(
                                            true,
                                            global.xmlToString(topic.xml),
                                            topic.title,
                                            null,
                                            config, function (data) {

                                                config.UploadedTopicCount += 1;
                                                if (data.matchedExistingTopic) {
                                                    config.MatchedTopicCount += 1;
                                                }

                                                config.NewTopicsCreated = (config.UploadedTopicCount - config.MatchedTopicCount) + " / " + config.MatchedTopicCount;
                                                resultCallback();

                                                topic.setTopicId(data.topic.id);
                                                topic.xml = global.jQuery.parseXML(data.topic.xml);

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

                                        global.jQuery.each(topicGraph.nodes, function (index, topic) {
                                            resultObject.contentSpec[topic.specLine] += " [" + topic.topicId + "]";

                                        });

                                        var spec = "";
                                        global.jQuery.each(resultObject.contentSpec, function(index, value) {
                                            console.log(value);
                                            spec += value + "\n";
                                        });

                                        global.createContentSpec(
                                            spec,
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

                                uploadImagesLoop();
                            }
                        },
                        errorCallback
                    );
                },
                errorCallback
            );
        })
        .setNextStep(function (resultCallback) {
            resultCallback(summary);
        });


    var summary = new global.QNAStep()
        .setTitle("Import Summary")
        .setOutputs([
            new global.QNAVariables()
                .setVariables([
                    new global.QNAVariable()
                        .setType(global.InputEnum.HTML)
                        .setIntro("Content Specification ID")
                        .setName("ContentSpecIDLink")
                        .setValue(function (resultCallback, errorCallback, result, config) {
                            resultCallback("<a href='http://" + config.PressGangHost + ":8080/pressgang-ccms-ui/#ContentSpecFilteredResultsAndContentSpecView;query;contentSpecIds=" + config.ContentSpecID + "'>" + config.ContentSpecID + "</a>");
                        }),
                    new global.QNAVariable()
                        .setType(global.InputEnum.PLAIN_TEXT)
                        .setIntro("Imported From")
                        .setName("ImportedFrom")
                        .setValue(function (resultCallback, errorCallback, result, config) {
                            resultCallback(config.OdtFile.name);
                        }),
                    new global.QNAVariable()
                        .setType(global.InputEnum.PLAIN_TEXT)
                        .setIntro("Topics Created / Topics Reused")
                        .setName("NewTopicsCreated"),
                    new global.QNAVariable()
                        .setType(global.InputEnum.PLAIN_TEXT)
                        .setIntro("Images Created / Images Reused")
                        .setName("NewImagesCreated")
                ])
        ])
        .setShowNext(false)
        .setShowPrevious(false)
        .setShowRestart(true);

}(this));