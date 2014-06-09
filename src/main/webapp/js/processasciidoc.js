define(
    ['jquery', 'qna/qna', 'qna/qnautils', 'qna/qnazipmodel', 'qnastart', 'specelement', 'uri/URI', 'constants', 'constants', 'generalexternalimport', 'exports'],
    function (jquery, qna, qnautils, qnazipmodel, qnastart, specelement, URI, constants, generaldocbookimport, generalexternalimport, exports) {
        'use strict';

        exports.processAsciidocImports = function(resultCallback, errorCallback, config) {
            var inputModel = qnastart.getInputModel(config);

            var generalInclude = /include::(.*?)\[\]/;
            var includeAttributesGroup = 1;

            function resolveFileRefs(asciidocText, filename, callback) {
                var thisFile = new URI(filename);
                var filerefRe = /image::?(.*?)\[[\s\S]*\]/g;
                var filerefReHrefGroup = 1;

                var replacements = [];

                var findImageFileNames = function (callback) {
                    var match;
                    if ((match = filerefRe.exec(asciidocText)) !== null) {
                        var imageFilename = match[filerefReHrefGroup];

                        var referencedXMLFilenameRelativeWithoutBase = new URI(imageFilename);
                        var referencedXMLFilenameWithoutBase = referencedXMLFilenameRelativeWithoutBase.absoluteTo(thisFile).toString();

                        inputModel.hasFileName(
                            config.InputSource,
                            referencedXMLFilenameWithoutBase,
                            function (exists) {
                                if (exists) {
                                    replacements.push({original: imageFilename, replacement: referencedXMLFilenameWithoutBase});
                                    findImageFileNames(callback);
                                }

                                findImageFileNames(callback);
                            },
                            errorCallback,
                            true
                        );
                    } else {
                        callback();
                    }
                };

                findImageFileNames(function () {
                    jquery.each(replacements, function (index, value) {
                        asciidocText = asciidocText.replace(new RegExp("(image::?)" + value.original + "(\[[\s\S]*\])"), "$1'" + value.replacement + "$2");
                    });
                    callback(asciidocText);
                });
            }

            function resolveXIInclude(asciidocText, base, filename, visitedFiles, callback) {

                /*
                 Make sure we are not entering an infinite loop
                 */
                if (visitedFiles.indexOf(filename) === -1) {
                    visitedFiles.push(filename);
                }

                var match = generalInclude.exec(asciidocText);

                if (match !== null) {

                    var previousString = asciidocText.substr(0, match.index);
                    var lastStartComment = previousString.lastIndexOf("////");
                    var lastEndComment = previousString.lastIndexOf("////");
                    var lastSingleLineComment = previousString.lastIndexOf("//");
                    var lastLineBreak = previousString.lastIndexOf("\n");

                    var isInMultipleLineCommentBlock = lastStartComment !== -1 && (lastEndComment === -1 || lastEndComment < lastStartComment);
                    var isInSingleLineCommentBlock = lastSingleLineComment !== -1 && (lastLineBreak === -1 || lastLineBreak < lastStartComment);

                    /*
                     The include was in a comment, so ignore it
                     */
                    if (isInMultipleLineCommentBlock || isInSingleLineCommentBlock) {
                        asciidocText = asciidocText.replace(match[0], match[0].replace("include::", "includecomment::"));
                        resolveXIInclude(asciidocText, base, filename, visitedFiles.slice(0), callback);
                        return;
                    }

                    /*
                     break down the attributes looking for the href and xpointer attributes
                     */
                    var xiIncludesAttrs = match[includeAttributesGroup];
                    var attrRe = /\b(.*?)\s*=\s*('|")(.*?)('|")/g;
                    var href;
                    var xpointer;
                    var parse;
                    var attrmatch;
                    while ((attrmatch = attrRe.exec(xiIncludesAttrs)) !== null) {
                        var attributeName = attrmatch[1];
                        var attributeValue = attrmatch[3];

                        if (attributeName.trim() === "href") {
                            href = attributeValue;
                        } else if (attributeName.trim() === "xpointer") {
                            var xpointerMatch = /xpointer\((.*?)\)/.exec(attributeValue);
                            if (xpointerMatch !== null) {
                                xpointer = xpointerMatch[1];
                            } else {
                                xpointer = attributeValue;
                            }
                        } else if (attributeName.trim() === "parse") {
                            /*
                             This will determine if we replace special characters in the imported content
                             */
                            parse = attributeValue;
                        }
                    }

                    if (href !== undefined) {
                        if (constants.COMMON_CONTENT_PATH_PREFIX.test(href)) {
                            asciidocText = asciidocText.replace(match[0], "");
                            resolveXIInclude(asciidocText, base, filename, visitedFiles.slice(0), callback);
                        } else {
                            /*
                             We need to work out where the files to be included will come from. This is a
                             combination of the href, the xml:base attribute, and the location of the
                             xml file that is doing the importing.

                             TODO: this processing does not really follow the xml standards, but has been good
                             enough to import all content I have come across.
                             */
                            var fixedMatch = href.replace(/^\.\//, "");
                            var thisFile = new URI(filename);
                            var referencedXMLFilenameRelativeWithBase = new URI((base === null ? "" : base) + fixedMatch);
                            var referencedXMLFilenameWithBase = referencedXMLFilenameRelativeWithBase.absoluteTo(thisFile).toString();

                            var referencedXMLFilenameRelativeWithoutBase = new URI(fixedMatch);
                            var referencedXMLFilenameWithoutBase = referencedXMLFilenameRelativeWithoutBase.absoluteTo(thisFile).toString();

                            var processFile = function (referencedFileName) {

                                if (visitedFiles.indexOf(referencedFileName) !== -1) {
                                    errorCallback("Circular reference detected", visitedFiles.toString() + "," + referencedFileName, true);
                                    return;
                                }

                                inputModel.getTextFromFileName(
                                    config.InputSource,
                                    referencedFileName,
                                    function (referencedXmlText) {
                                        resolveFileRefs(referencedXmlText, referencedFileName, function (referencedXmlText) {
                                            resolveXIInclude(
                                                referencedXmlText,
                                                getXmlBaseAttribute(referencedXmlText),
                                                referencedFileName,
                                                visitedFiles.slice(0),
                                                function (fixedReferencedXmlText) {
                                                    if (xpointer !== undefined) {
                                                        var replacedTextResult = qnautils.replaceEntitiesInText(referencedXmlText);
                                                        var cleanedReferencedXmlText = removeXmlPreamble(replacedTextResult.xml);
                                                        var cleanedReferencedXmlDom = qnautils.stringToXML(cleanedReferencedXmlText);

                                                        if (cleanedReferencedXmlDom === null) {
                                                            errorCallback("Invalid XML", "The source material has invalid XML, and can not be imported.", true);
                                                            return;
                                                        }

                                                        var subset = qnautils.xPath(xpointer, cleanedReferencedXmlDom);

                                                        var replacement = "";
                                                        var matchedNode;
                                                        while ((matchedNode = subset.iterateNext()) !== null) {
                                                            if (replacement.length !== 0) {
                                                                replacement += "\n";
                                                            }
                                                            fixedReferencedXmlText += qnautils.reencode(qnautils.xmlToString(matchedNode), replacedTextResult.replacements);
                                                        }
                                                    }

                                                    /*
                                                     When including content with the xiinclude attribute match="text", we need to replace
                                                     any special characters.
                                                     */
                                                    if (parse === "text") {
                                                        fixedReferencedXmlText = qnautils.escapeXMLSpecialCharacters(fixedReferencedXmlText);
                                                    }

                                                    /*
                                                     The dollar sign has special meaning in the replace method.
                                                     https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/replace#Specifying_a_string_as_a_parameter
                                                     */
                                                    asciidocText = asciidocText.replace(match[0], fixedReferencedXmlText.replace(/\$/g, "$$$$"));
                                                    resolveXIInclude(asciidocText, base, filename, visitedFiles.slice(0), callback);
                                                }
                                            );
                                        });
                                    },
                                    function (error) {
                                        errorCallback("Error reading file", "There was an error reading the file " + referencedFileName, true);
                                    },
                                    true
                                );
                            };

                            inputModel.hasFileName(
                                config.InputSource,
                                referencedXMLFilenameWithoutBase,
                                function (exists) {
                                    if (exists) {
                                        processFile(referencedXMLFilenameWithoutBase);
                                    } else {
                                        inputModel.hasFileName(
                                            config.InputSource,
                                            referencedXMLFilenameWithBase,
                                            function (exists) {
                                                if (exists) {
                                                    processFile(referencedXMLFilenameWithBase);
                                                } else {
                                                    //errorCallback("Could not find file", "Could not find file " + referencedXMLFilename, true);
                                                    asciidocText = asciidocText.replace(match[0], "");
                                                    resolveXIInclude(asciidocText, base, filename, visitedFiles.slice(0), callback);
                                                }
                                            },
                                            errorCallback,
                                            true
                                        );
                                    }
                                },
                                errorCallback,
                                true
                            );
                        }
                    } else {
                        /*
                         Found an xi:include without a href? delete it an move on.
                         */
                        asciidocText = asciidocText.replace(match[0], "");
                        resolveXIInclude(asciidocText, base, filename, visitedFiles.slice(0), callback);
                    }
                } else {
                    callback(asciidocText, visitedFiles);
                }

            }

            inputModel.getTextFromFileName(
                config.InputSource,
                config.MainFile,
                function (asciidocText) {
                    resolveFileRefs(xmlText, config.MainFile, function (asciidocText) {
                        function resolveIncludeLoop(asciidocText, visitedFiles) {
                            if (generalXiInclude.test(xmlText)) {

                                resolveInclude(
                                    asciidocText,
                                    base,
                                    config.MainFile,
                                    visitedFiles,
                                    function (asciidocText, visitedFiles) {
                                        resolveIncludeLoop(asciidocText, visitedFiles);
                                    }
                                );
                            } else {
                                resultCallback(asciidocText);
                            }
                        }

                        var count = 0;
                        resolveIncludeLoop(asciidocText, [config.MainXMLFile]);
                    });
                },
                true
            );
        }

    }
)