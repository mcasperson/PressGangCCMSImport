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
    
                var resultObject = JSON.parse(result);

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
    
                                var body = contentsXML.evaluate("//office:text", contentsXML, resolver, XPathResult.ANY_TYPE, null).iterateNext();
                                if (body === null) {
                                    errorCallback("Invalid ODT file", "Could not find the <office:body> element!", true);
                                } else {
                                    // these nodes make up the content that we will import
                                    var contentNodes = contentsXML.evaluate("*", body, resolver, XPathResult.ANY_TYPE, null);
                                    var childNodeCount = 0;
                                    var contentNode;
                                    while ((contentNode = contentNodes.iterateNext()) !== null) {
                                        ++childNodeCount;
                                    }
    
                                    contentNodes = contentsXML.evaluate("*", body, resolver, XPathResult.ANY_TYPE, null);
    
                                    var images = {};
    
                                    var currentChild = 0;
                                    var processTopic = function (title, outlineLevel, contentNodes, content, successCallback) {

                                        var contentNode = contentNodes.iterateNext();
                                        if (contentNode !== null) {
    
                                            config.UploadProgress[1] = progressIncrement * (currentChild / body.childNodes.length);
                                            resultCallback();
                                            ++currentChild;
    
                                            // headers indicate container or topic boundaries
                                            if (contentNode.nodeName === "text:h") {
                                                processHeader(content, contentNode, title, outlineLevel, contentNodes, successCallback);
                                                return;
                                            } else if (contentNode.nodeName === "text:p") {
                                                processPara(content, contentNode, images);
                                            } else if (contentNode.nodeName === "text:list") {
                                                processList(content, contentNode, images);
                                            } else if (contentNode.nodeName === "office:annotation") {
                                                processRemark(content, contentNode);
                                            }
    
                                            setTimeout(function() {
                                                processTopic(title, outlineLevel, contentNodes, content, successCallback);
                                            }, 0);
                                        } else {
    
                                            if (content.length !== 0) {
                                                var prefix = generalexternalimport.generateSpacing(outlineLevel);
                                                resultObject.contentSpec.push(prefix + qnastart.escapeSpecTitle(title));
                                                generalexternalimport.addTopicToSpec(topicGraph, content, title, resultObject.contentSpec - 1);
                                            }
    
                                            successCallback();
                                        }
                                    };


    
                                    /*
                                     Expand the text:s elements and remarks.
                                     */
                                    var convertNodeToDocbook = function (node, emphasis) {
                                        var customContainerContent = "";
                                        for (var childIndex = 0; childIndex < node.childNodes.length; ++childIndex) {
                                            var childNode = node.childNodes[childIndex];
                                            if (childNode.nodeName === "text:s") {
                                                var spaces = 1;
                                                var spacesAttribute = childNode.getAttribute("text:c");
                                                if (spacesAttribute !== null) {
                                                    spaces = parseInt(spacesAttribute);
                                                }
                                                for (var i = 0; i < spaces; ++i) {
                                                    customContainerContent += " ";
                                                }
    
                                            } else if (childNode.nodeName === "office:annotation") {
                                                var remarks = [];
                                                processRemark(remarks, childNode);
                                                jquery.each(remarks, function (index, value) {
                                                    customContainerContent += value;
                                                });
                                            } else if (childNode.nodeType === Node.TEXT_NODE) {
                                                if (childNode.textContent.length !== 0) {
                                                    var fontRule = getFontRuleForElement(childNode);
                                                    if (emphasis &&
                                                        childNode.textContent.trim().length !== 0 &&
                                                        (fontRule.bold || fontRule.italics || fontRule.underline)) {
                                                        customContainerContent += "<emphasis>" + generalexternalimport.cleanTextContent(childNode.textContent) + "</emphasis>";
                                                    } else {
                                                        customContainerContent += generalexternalimport.cleanTextContent(childNode.textContent);
                                                    }
                                                }
                                            } else if (childNode.nodeName === "text:a") {
                                                var href = childNode.getAttribute("xlink:href");
                                                if (href !== null) {
                                                    customContainerContent += '<ulink url="' + href + '">' + generalexternalimport.cleanTextContent(childNode.textContent) + '</ulink>';
                                                } else {
                                                    customContainerContent += generalexternalimport.cleanTextContent(childNode.textContent);
                                                }
                                            } else {
                                                customContainerContent += convertNodeToDocbook(childNode);
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
    
                                        var contentXmlStyle = contentsXML.evaluate("//style:font-face[@style:name='" + font + "']", contentsXML, resolver, XPathResult.ANY_TYPE, null).iterateNext();
                                        var stylesXmlStyle = stylesXML.evaluate("//style:font-face[@style:name='" + font + "']", stylesXML, resolver, XPathResult.ANY_TYPE, null).iterateNext();
    
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
                                        var contentXmlStyle = contentsXML.evaluate("//style:style[@style:name='" + styleAttribute + "']", contentsXML, resolver, XPathResult.ANY_TYPE, null).iterateNext();
                                        var stylesXmlStyle = stylesXML.evaluate("//style:style[@style:name='" + styleAttribute + "']", stylesXML, resolver, XPathResult.ANY_TYPE, null).iterateNext();
    
                                        var style = contentXmlStyle !== null ? contentXmlStyle : stylesXmlStyle;
    
                                        if (style) {
                                            var fontName = contentsXML.evaluate(".//@style:font-name", style, resolver, XPathResult.ANY_TYPE, null).iterateNext();
                                            if (fontRule.font === undefined) {
                                                if (fontName !== null) {
                                                    fontRule.font = fontName.nodeValue;
                                                }
                                            }
    
                                            var fontSize = contentsXML.evaluate(".//@fo:font-size", style, resolver, XPathResult.ANY_TYPE, null).iterateNext();
                                            if (fontRule.size === undefined) {
                                                if (fontSize !== null) {
                                                    fontRule.size = fontSize.nodeValue;
                                                }
                                            }
    
                                            var weight = contentsXML.evaluate(".//@fo:font-weight", style, resolver, XPathResult.ANY_TYPE, null).iterateNext();
                                            if (fontRule.bold === undefined) {
                                                if (weight !== null) {
                                                    fontRule.bold = weight.nodeValue === "bold";
                                                }
                                            }
    
                                            var fontStyle = contentsXML.evaluate(".//@fo:font-style", style, resolver, XPathResult.ANY_TYPE, null).iterateNext();
                                            if (fontRule.italics === undefined) {
                                                if (fontStyle !== null ) {
                                                    fontRule.italics = fontStyle.nodeValue === "italic";
                                                }
                                            }
    
                                            var underline = contentsXML.evaluate(".//@style:text-underline-style", style, resolver, XPathResult.ANY_TYPE, null).iterateNext();
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
                                        var creator = contentsXML.evaluate("./dc:creator", contentNode, resolver, XPathResult.ANY_TYPE, null).iterateNext();
                                        var date = contentsXML.evaluate("./dc:date", contentNode, resolver, XPathResult.ANY_TYPE, null).iterateNext();
                                        var paras = contentsXML.evaluate("./text:p", contentNode, resolver, XPathResult.ANY_TYPE, null);
    
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
    
                                    var processPara = function (content, contentNode, imageLinks) {
                                        var images = contentsXML.evaluate(".//draw:image", contentNode, resolver, XPathResult.ANY_TYPE, null);
                                        var image;
                                        while ((image = images.iterateNext()) !== null) {
                                            if (image.getAttribute("xlink:href") !== null) {
                                                var href = image.getAttribute("xlink:href").trim();
                                                // make a note of an image that we need to upload
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
                                            var textNodes = contentsXML.evaluate(".//text()", contentNode, resolver, XPathResult.ANY_TYPE, null);
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
                                                    content.push("<" + matchingRule.docBookElement + ">" + convertNodeToDocbook(contentNode) + "</" + matchingRule.docBookElement + ">");
    
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
                                                    content.push("<para>" + convertNodeToDocbook(contentNode) + "</para>");
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
                                                content.push("<para>" + convertNodeToDocbook(contentNode, true) + "</para>");
                                            }
                                        }
                                    };
    
                                    var processList = function (content, contentNode, imageLinks, depth, style) {
    
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
                                            var styleNode = contentsXML.evaluate("//text:list-style[@style:name='" + style + "']", contentsXML, resolver, XPathResult.ANY_TYPE, null).iterateNext();
                                            if (styleNode !== null) {
                                                var listStyleNumber = contentsXML.evaluate("./text:list-level-style-number[@text:level='" + depth + "']", styleNode, resolver, XPathResult.ANY_TYPE, null).iterateNext();
                                                //var listStyleBullet = contentsXML.evaluate("./text:text:list-level-style-bullet", styleNode, resolver, XPathResult.ANY_TYPE, null).iterateNext();
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
    
                                        var listItems = contentsXML.evaluate("./text:list-item", contentNode, resolver, XPathResult.ANY_TYPE, null);
                                        var listHeaders = contentsXML.evaluate("./text:list-header", contentNode, resolver, XPathResult.ANY_TYPE, null);
                                        var listItemsHeaderContent = [];
    
                                        var listHeader = listHeaders.iterateNext();
                                        if (listHeader !== null) {
                                            var paras = contentsXML.evaluate("./text:p", listHeader, resolver, XPathResult.ANY_TYPE, null);
                                            var para;
                                            while ((para = paras.iterateNext()) !== null) {
                                                processPara(listItemsHeaderContent, para, imageLinks);
                                            }
                                        }
    
                                        var listItem;
                                        if ((listItem = listItems.iterateNext()) !== null) {
                                            content.push("<" + listType + listStyle + ">");
    
                                            jquery.each(listItemsHeaderContent, function (index, value) {
                                                content.push(value);
                                            });
    
    
                                            do {
                                                content.push("<listitem>");
    
                                                jquery.each(listItem.childNodes, function (index, childNode) {
                                                    if (childNode.nodeName === "text:p") {
                                                        processPara(content, childNode, imageLinks);
                                                    } else if (childNode.nodeName === "text:list") {
                                                        processList(content, childNode, imageLinks, depth + 1, style);
                                                    }
                                                });
    
                                                content.push("</listitem>");
                                            } while ((listItem = listItems.iterateNext()) !== null);
    
                                            content.push("</" + listType + ">");
                                        } else {
                                            // we have found a list that contains only a header. this is really just a para
                                            jquery.each(listItemsHeaderContent, function (index, value) {
                                                content.push(value);
                                            });
                                        }
                                    };
    
                                    var processHeader = function (content, contentNode, title, outlineLevel, contentNodes, successCallback) {
                                        var prefix = generalexternalimport.generateSpacing(outlineLevel);
    
                                        var newOutlineLevel = parseInt(contentNode.getAttribute("text:outline-level"));

                                        for (var missedSteps = outlineLevel; missedSteps < newOutlineLevel - 1; ++missedSteps) {
                                            if (missedSteps === 0) {
                                                resultObject.contentSpec.push("Chapter: Missing Chapter");
                                            } else {
                                                var myPrefix = generalexternalimport.generateSpacing(missedSteps);
                                                resultObject.contentSpec.push(myPrefix + "Section: Missing Section");
                                            }
                                        }
    
                                        // Last heading had no content before this heading. We only add a container if
                                        // the last heading added a level of depth to the tree, Otherwise it is just
                                        // an empty container.
                                        if (content.length === 0 && title !== null && newOutlineLevel > outlineLevel) {
                                            if (outlineLevel === 0) {
                                                resultObject.contentSpec.push("Chapter: " + qnastart.escapeSpecTitle(title));
                                            } else {
                                                resultObject.contentSpec.push(prefix + "Section: " + qnastart.escapeSpecTitle(title));
                                            }
                                        } else if (content.length !== 0) {
                                            /*
                                                We have found some initial text. Put it under an introduction chapter
                                             */
                                            if (title === null) {
                                                title = "Introduction";
                                                resultObject.contentSpec.push("Chapter: " + qnastart.escapeSpecTitle(title));
                                            } else {
                                                if (newOutlineLevel > outlineLevel) {
                                                    resultObject.contentSpec.push(prefix + "Section: " + qnastart.escapeSpecTitle(title));
                                                } else {
                                                    resultObject.contentSpec.push(prefix + qnastart.escapeSpecTitle(title));
                                                }
                                            }
    
                                            generalexternalimport.addTopicToSpec(topicGraph, content, title, resultObject.contentSpec.length - 1);
                                        }
    
                                        var newTitle = convertNodeToDocbook(contentNode, false);
                                        if (newTitle.length === 0) {
                                            newTitle = "Untitled";
                                        }
    
                                        newTitle = newTitle.replace(/^(\d+)(\.\d+)*\.?\s*/, "");
    
                                        setTimeout(function() {
                                                processTopic(newTitle, newOutlineLevel, contentNodes, [], successCallback);
                                        }, 0);
                                    };
    
                                    processTopic(null, 0, contentNodes, [], function() {
                                        config.UploadProgress[1] = progressIncrement;
                                        config.ResolvedBookStructure = true;
                                        resultCallback();
    
                                        uploadImagesLoop();
                                    });
    
    
    
                                    var uploadImages = function (index, imagesKeys, callback) {
                                        if (index >= imagesKeys.length) {
                                            callback();
                                        } else {
                                            config.UploadProgress[1] = progressIncrement + (index / topicGraph.nodes.length * progressIncrement);
                                            resultCallback();
    
                                            var imagePath = imagesKeys[index];
    
                                            qnastart.createImage(
                                                config.CreateOrResuseImages === "REUSE",
                                                config.OdtFile,
                                                imagePath,
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
                                                var filerefs = contentsXML.evaluate(".//@fileref", topic.xml, resolver, XPathResult.ANY_TYPE, null);
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
                                                qnautils.xmlToString(topic.xml),
                                                topic.title,
                                                null,
                                                config, function (data) {

                                                    var topicId = config.CreateOrResuseTopics === "REUSE" ? data.topic.id : data.id;
                                                    var topicXML = config.CreateOrResuseTopics === "REUSE" ? data.topic.xml : data.xml;

                                                    if (config.CreateOrResuseImages === "REUSE" && data.matchedExistingImage) {
                                                        config.MatchedImageCount += 1;
                                                    }

                                                    config.NewTopicsCreated = (config.UploadedTopicCount - config.MatchedTopicCount) + " / " + config.MatchedTopicCount;
                                                    resultCallback();
    
                                                    topic.setTopicId(topicId);
                                                    topic.xml = jquery.parseXML(topicXML);
    
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