define(
    ['jquery', 'qna/qna', 'qna/qnautils', 'qna/qnazipmodel', 'qnastart', 'specelement', 'uri/URI', 'constants', 'constants', 'generalexternalimport', 'exports'],
    function (jquery, qna, qnautils, qnazipmodel, qnastart, specelement, URI, constants, generaldocbookimport, generalexternalimport, exports) {
        'use strict';

        exports.processAsciidocImports = function(resultCallback, errorCallback, config) {
            var inputModel = qnastart.getInputModel(config);

            var generalInclude = /include::(.*?)\[\]/;
            var includeLinkGroup = 1;

            function resolveFileRefs(asciidocText, filename, callback) {
                var thisFile = new URI(filename);
                var filerefRe = /image::?(.*?)\[[\s\S]*\]/g;
                var filerefReHrefGroup = 1;

                var replacements = [];

                var findImageFileNames = function (callback) {
                    var match;
                    if ((match = filerefRe.exec(asciidocText)) !== null) {
                        var imageFilename = match[filerefReHrefGroup];

                        var referencedFilenameRelativeWithoutBase = new URI(imageFilename);
                        var referencedFilenameWithoutBase = referencedFilenameRelativeWithoutBase.absoluteTo(thisFile).toString();

                        inputModel.hasFileName(
                            config.InputSource,
                            referencedFilenameWithoutBase,
                            function (exists) {
                                if (exists) {
                                    replacements.push({original: imageFilename, replacement: referencedFilenameWithoutBase});
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
                        asciidocText = asciidocText.replace(new RegExp("(image::?)" + value.original + "(\\[[\\s\\S]*\\])"), "$1" + value.replacement + "$2");
                    });
                    callback(asciidocText);
                });
            }

            function resolveInclude(asciidocText, filename, visitedFiles, callback) {

                /*
                 Make sure we are not entering an infinite loop
                 */
                if (visitedFiles.indexOf(filename) === -1) {
                    visitedFiles.push(filename);
                }

                var match = generalInclude.exec(asciidocText);

                if (match !== null) {

                    var previousString = asciidocText.substr(0, match.index);

                    var blockCommentBoundaryCount = previousString.match(/\/\/\/\//g);
                    var lastSingleLineComment = previousString.lastIndexOf("//");
                    var lastLineBreak = previousString.lastIndexOf("\n");

                    var isInMultipleLineCommentBlock = blockCommentBoundaryCount !== null && blockCommentBoundaryCount.length % 2 === 1;
                    var isInSingleLineCommentBlock = lastSingleLineComment !== -1 && (lastLineBreak === -1 || lastLineBreak < lastSingleLineComment);

                    /*
                     The include was in a comment, so ignore it
                     */
                    if (isInMultipleLineCommentBlock || isInSingleLineCommentBlock) {
                        asciidocText = asciidocText.replace(match[0], match[0].replace("include::", "includecomment::"));
                        resolveInclude(asciidocText, filename, visitedFiles.slice(0), callback);
                        return;
                    }

                    var href = match[includeLinkGroup];

                    if (href.trim().length !== 0) {

                        /*
                         We need to work out where the files to be included will come from. This is a
                         combination of the href  and the location of the
                         xml file that is doing the importing.
                         */
                        var fixedMatch = href.replace(/^\.\//, "");
                        var thisFile = new URI(filename);

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
                                function (referencedAsciidocText) {
                                    resolveFileRefs(referencedAsciidocText, referencedFileName, function (referencedAsciidocText) {
                                        resolveInclude(
                                            referencedAsciidocText,
                                            referencedFileName,
                                            visitedFiles.slice(0),
                                            function (fixedReferencedXmlText) {
                                                /*
                                                 The dollar sign has special meaning in the replace method.
                                                 https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/replace#Specifying_a_string_as_a_parameter
                                                 */
                                                asciidocText = asciidocText.replace(match[0], fixedReferencedXmlText.replace(/\$/g, "$$$$"));
                                                resolveInclude(asciidocText, filename, visitedFiles.slice(0), callback);
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
                                    /*
                                        Could not find the referenced file
                                     */
                                    asciidocText = asciidocText.replace(match[0], "");
                                    resolveInclude(asciidocText, filename, visitedFiles.slice(0), callback);
                                }
                            },
                            errorCallback,
                            true
                        );
                    } else {
                        /*
                         Found an xi:include without a href? delete it an move on.
                         */
                        asciidocText = asciidocText.replace(match[0], "");
                        resolveInclude(asciidocText, filename, visitedFiles.slice(0), callback);
                    }
                } else {
                    callback(asciidocText, visitedFiles);
                }

            }

            inputModel.getTextFromFileName(
                config.InputSource,
                config.MainFile,
                function (asciidocText) {
                    resolveFileRefs(asciidocText, config.MainFile, function (asciidocText) {
                        function resolveIncludeLoop(asciidocText, visitedFiles) {
                            if (generalInclude.test(asciidocText)) {

                                resolveInclude(
                                    asciidocText,
                                    config.MainFile,
                                    visitedFiles,
                                    function (asciidocText, visitedFiles) {
                                        resolveIncludeLoop(asciidocText, visitedFiles);
                                    }
                                );
                            } else {
                                asciidocText = asciidocText.replace(/includecomment::/g, "include::");
                                resultCallback(asciidocText);
                            }
                        }

                        var count = 0;
                        resolveIncludeLoop(asciidocText, [config.MainFile]);
                    });
                },
                true
            );
        }

    }
)