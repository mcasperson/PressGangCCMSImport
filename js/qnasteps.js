(function (global) {
    'use strict';

    /*
        A step in the QNA system is a hierarchy of objects.

        The QNAStep represents one entire step in the wizard.
          Each QNAStep holds zero or more QNAVariables. QNAVariables are collections of QNAVariable objects.
            Each QNAVariables holds one or more QNAVariable objects. A QNAVariable is a UI element that the user is expected to supply a value for.

        You will note that each level in the hierarchy and each value for the objects in the hierarchy are calculated
        via callbacks. If each step in the wizard is known, these callbacks can just return static values. If the
        steps require some kind of processing in order to determine the correct values shown to the user, these callbacks
        can perform any kind of async operation (querying a server, reading a file etc) that they need to.

        var qnaStep = new global.QNAStep(
            function (resultCallback, errorCallback, result, config) {resultCallback("The text to be applied to the panel title"); },
            function (resultCallback, errorCallback, result, config) {resultCallback("The text to be displayed above any inputs. This is usually some introductory text"); },
            // Here we create the QNAVariables objects, which are wrappers around a collection of QNAVariable objects
            function (resultCallback, errorCallback, result, config) {
                // This result callback expects an array of QNAVariables objects
                resultCallback([
                    new global.QNAVariables(
                        // Note that you can skip the intro text by setting the function to null.
                        null,
                        function (resultCallback, errorCallback, result, config) {
                            // This result callback expects an array of QNAVariable objects
                            resultCallback([
                                new global.QNAVariable(
                                    function (resultCallback, errorCallback, result, config) {resultCallback(global.InputEnum.SINGLE_FILE); },
                                    function (resultCallback, errorCallback, result, config) {resultCallback("The text to be displayed with the input"); },
                                    function (resultCallback, errorCallback, result, config) {resultCallback("The variable name under config that the value of this variable will be assigned to"); },
                                    function (resultCallback, errorCallback, result, config) {resultCallback(["Some", "inputs", "expect", "a", "number", "of", "options"]); },
                                    function (resultCallback, errorCallback, result, config) {resultCallback("The initial value to be displayed"); }
                                )
                            ]);
                        }
                    )
                ]);
            },
            function (resultCallback, errorCallback, result, config) {resultCallback("Do any incremental processing of the results here"); },
            function (resultCallback, errorCallback, result, config) {resultCallback(the_next_step); }
        );
     */

    // a zip model to be shared
    var zip = new global.QNAZipModel();

    /*
        STEP 1 - Get the ZIP file
     */
    global.QNAStart = new global.QNAStep(
        function (resultCallback) {resultCallback("Select the ZIP file to import"); },
        function (resultCallback) {resultCallback("Select the ZIP file that contains the valid Publican book that you wish to import into PressGang CCMS."); },
        function (resultCallback) {resultCallback([
            new global.QNAVariables(
                null,
                function (resultCallback) {resultCallback([
                    new global.QNAVariable(
                        function (resultCallback) {resultCallback(global.InputEnum.SINGLE_FILE); },
                        function (resultCallback) {resultCallback("Publican ZIP File"); },
                        function (resultCallback) {resultCallback("ZipFile"); }
                    )
                ]); }
            )
        ]); },
        null,
        null,
        function (resultCallback, errorCallback, result, config) {

            if (!config.ZipFile) {
                errorCallback("Please select a file", "You need to select a file before continuing.");
            } else {
                zip.getCachedEntries(config.ZipFile, function (entries) {

                    var foundPublicanCfg = false;
                    global.angular.forEach(entries, function (value, key) {
                        if (value.filename === "publican.cfg") {
                            foundPublicanCfg = true;
                            return false;
                        }
                    });

                    if (!foundPublicanCfg) {
                        errorCallback("Error", "The ZIP file did not contain a publican.cfg file.");
                    } else {
                        resultCallback(null);
                    }
                }, function (message) {
                    errorCallback("Error", "Could not process the ZIP file!");
                });
            }
        },
        function (resultCallback, errorCallback, result, config) {
            resultCallback(askForMainXML);
        }
    );

    /*
     STEP 2 - Get the main XML file
     */
    var askForMainXML = new global.QNAStep(
        function (resultCallback) {resultCallback("Select the main XML file"); },
        function (resultCallback) {resultCallback("Select the main XML file from the ZIP archive. Publican conventions mean the file should be named after the book title in the Book_Info.xml file. " +
            "This import tool will attempt to read the Book_Info.xml file to find the book title, and from that select the main XML file. " +
            "You only need to make a manual selection if the import tool could not find the main XML file, or if you want to override the default selection."); },
        function (resultCallback) {resultCallback([
            new global.QNAVariables(
                null,
                function (resultCallback) {resultCallback(
                    [
                        new global.QNAVariable(
                            function (resultCallback) {resultCallback(global.InputEnum.LISTBOX); },
                            null,
                            function (resultCallback) {resultCallback("MainXMLFile"); },
                            function (resultCallback, errorCallback, result, config) {
                                zip.getCachedEntries(config.ZipFile, function (entries) {
                                    var retValue = [];

                                    global.angular.forEach(entries, function (value, key) {
                                        if (/^.*?\.xml$/.test(value.filename)) {
                                            retValue.push(value.filename);
                                        }
                                    });

                                    resultCallback(retValue);
                                });
                            },
                            function (resultCallback, errorCallback, result, config) {
                                zip.getCachedEntries(config.ZipFile, function (entries) {
                                    global.angular.forEach(entries, function (value, key) {
                                        if (/^en-US\/Book_Info\.xml$/.test(value.filename)) {
                                            zip.getTextFromFile(value, function (textFile) {
                                                var match = /<title>(.*?)<\/title>/.exec(textFile);
                                                if (match) {
                                                    var assumedMainXMLFile = "en-US/" + match[1].replace(/ /g, "_") + ".xml";

                                                    global.angular.forEach(entries, function (value, key) {
                                                        if (value.filename === assumedMainXMLFile) {
                                                            resultCallback(assumedMainXMLFile);
                                                            return;
                                                        }
                                                    });
                                                }
                                            });

                                            return false;
                                        }
                                    });
                                });

                                resultCallback(null);
                            }
                        )
                    ]
                ); }
            )
        ]); },
        null,
        null,
        null,
        function (resultCallback) {
            resultCallback(askToCreateNewSpecOrOverwriteExistingOne);
        }
    );

    /*
        Step 3 - Ask about creating a new spec or overwriting an old one
     */
    var askToCreateNewSpecOrOverwriteExistingOne = new global.QNAStep(
        function (resultCallback) {resultCallback("Create or overwrite a content spec?"); },
        function (resultCallback) {resultCallback("This wizard can create a new content specification, or overwrite the contents of an existing one. " +
            "You will usually want to create a new content specification, but if you are reimporting a book and want to overwrite the previously imported content spec, " +
            "select the overwrite option."); },
        // Here we create the QNAVariables objects, which are wrappers around a collection of QNAVariable objects
        function (resultCallback) {
            // This result callback expects an array of QNAVariables objects
            resultCallback([
                new global.QNAVariables(
                    // Note that you can skip the intro text by setting the function to null.
                    null,
                    function (resultCallback) {
                        // This result callback expects an array of QNAVariable objects
                        resultCallback([
                            new global.QNAVariable(
                                function (resultCallback) {resultCallback(global.InputEnum.RADIO_BUTTONS); },
                                function (resultCallback) {resultCallback(["Create a new content spec", "Overwrite an existing content spec"]); },
                                function (resultCallback) {resultCallback("CreateOrOverwrite"); },
                                function (resultCallback) {resultCallback(["CREATE", "OVERWRITE"]); },
                                function (resultCallback) {resultCallback("CREATE"); }
                            )
                        ]);
                    }
                )
            ]);
        },
        null,
        null,
        null,
        function (resultCallback, errorCallback, result, config) {
            resultCallback(config.CreateOrOverwrite === "CREATE" ? processZipFile : getExistingContentSpecID);
        }
    );

    var getExistingContentSpecID = new global.QNAStep(
        function (resultCallback) {resultCallback("Create or overwrite a content spec?"); },
        function (resultCallback) {resultCallback("This wizard can create a new content specification, or overwrite the contents of an existing one. " +
            "You will usually want to create a new content specification, but if you are reimporting a book and want to overwrite the previously imported content spec, " +
            "select the overwrite option."); },
        // Here we create the QNAVariables objects, which are wrappers around a collection of QNAVariable objects
        function (resultCallback) {
            // This result callback expects an array of QNAVariables objects
            resultCallback([
                new global.QNAVariables(
                    // Note that you can skip the intro text by setting the function to null.
                    null,
                    function (resultCallback) {
                        // This result callback expects an array of QNAVariable objects
                        resultCallback([
                            new global.QNAVariable(
                                function (resultCallback) {resultCallback(global.InputEnum.TEXTBOX); },
                                function (resultCallback) {resultCallback("Existing content specification ID"); },
                                function (resultCallback) {resultCallback("ExistingContentSpecID"); },
                                null,
                                null
                            )
                        ]);
                    }
                )
            ]);
        },
        null,
        null,
        null,
        function (resultCallback) {resultCallback(processZipFile); }
    );

    /*
        Set 4 - Process the zip file
     */

    var processZipFile = new global.QNAStep(
        function (resultCallback) {resultCallback("Importing Publican Book"); },
        null,
        null,
        // Here we create the QNAVariables objects, which are wrappers around a collection of QNAVariable objects
        function (resultCallback) {
            // This result callback expects an array of QNAVariables objects
            resultCallback([
                new global.QNAVariables(
                    // Note that you can skip the intro text by setting the function to null.
                    null,
                    function (resultCallback) {
                        // This result callback expects an array of QNAVariable objects
                        resultCallback([
                            new global.QNAVariable(
                                function (resultCallback) {resultCallback(global.InputEnum.CHECKBOX); },
                                function (resultCallback) {resultCallback("Resolving xi:includes"); },
                                function (resultCallback) {resultCallback("ResolvedXIIncludes"); },
                                null,
                                null
                            ),
                            new global.QNAVariable(
                                function (resultCallback) {resultCallback(global.InputEnum.CHECKBOX); },
                                function (resultCallback) {resultCallback("Finding entities in XML"); },
                                function (resultCallback) {resultCallback("FoundEntities"); },
                                null,
                                null
                            ),
                            new global.QNAVariable(
                                function (resultCallback) {resultCallback(global.InputEnum.CHECKBOX); },
                                function (resultCallback) {resultCallback("Finding entity definitions"); },
                                function (resultCallback) {resultCallback("FoundEntityDefinitions"); },
                                null,
                                null
                            ),
                            new global.QNAVariable(
                                function (resultCallback) {resultCallback(global.InputEnum.CHECKBOX); },
                                function (resultCallback) {resultCallback("Removing XML preamble"); },
                                function (resultCallback) {resultCallback("RemovedXMLPreamble"); },
                                null,
                                null
                            ),
                            new global.QNAVariable(
                                function (resultCallback) {resultCallback(global.InputEnum.CHECKBOX); },
                                function (resultCallback) {resultCallback("Finding revision history"); },
                                function (resultCallback) {resultCallback("FoundRevisionHistory"); },
                                null,
                                null
                            ),
                            new global.QNAVariable(
                                function (resultCallback) {resultCallback(global.InputEnum.CHECKBOX); },
                                function (resultCallback) {resultCallback("Finding author group"); },
                                function (resultCallback) {resultCallback("FoundAuthorGroup"); },
                                null,
                                null
                            ),
                            new global.QNAVariable(
                                function (resultCallback) {resultCallback(global.InputEnum.CHECKBOX); },
                                function (resultCallback) {resultCallback("Finding and uploading images"); },
                                function (resultCallback) {resultCallback("FoundImages"); },
                                null,
                                null
                            ),
                            new global.QNAVariable(
                                function (resultCallback) {resultCallback(global.InputEnum.CHECKBOX); },
                                function (resultCallback) {resultCallback("Resolving book structure"); },
                                function (resultCallback) {resultCallback("ResolvedBookStructure"); },
                                null,
                                null
                            ),
                            new global.QNAVariable(
                                function (resultCallback) {resultCallback(global.InputEnum.CHECKBOX); },
                                function (resultCallback) {resultCallback("Resolving xrefs"); },
                                function (resultCallback) {resultCallback("ResolvedXrefs"); },
                                null,
                                null
                            ),
                            new global.QNAVariable(
                                function (resultCallback) {resultCallback(global.InputEnum.CHECKBOX); },
                                function (resultCallback) {resultCallback("Uploading content specification"); },
                                function (resultCallback) {resultCallback("UploadedContentSpecification"); },
                                null,
                                null
                            ),
                            new global.QNAVariable(
                                function (resultCallback) {resultCallback(global.InputEnum.PROGRESS); },
                                function (resultCallback) {resultCallback("Progress"); },
                                function (resultCallback) {resultCallback("UploadProgress"); },
                                null,
                                // gotta set this first up because of https://github.com/angular-ui/bootstrap/issues/1547
                                function (resultCallback) {resultCallback([10, 0]); }
                            )
                        ]);
                    }
                )
            ]);
        },
        function (resultCallback, errorCallback, result, config) {

            /**
             * A collection of entity definitions
             * @type {Array}
             */
            var entities = [];

            /*
                Resolve xi:includes
             */
            var resolveXiIncludes = function () {
                var xiIncludeRe = /<\s*xi:include\s+xmlns:xi\s*=\s*("|')http:\/\/www\.w3\.org\/2001\/XInclude("|')\s+href\s*=\s*("|')(.*?\.xml)("|')\s*\/\s*>/;
                var commonContent = /^Common_Content/;

                var resolveXIInclude = function (xmlText, filename, callback) {
                    var match = xiIncludeRe.exec(xmlText);
                    if (match) {
                        var relativePath = "";
                        var lastIndexOf;
                        if ((lastIndexOf = filename.lastIndexOf("/")) !== -1) {
                            relativePath = filename.substring(0, lastIndexOf);
                        }

                        if (commonContent.test(match[4])) {
                            resolveXIInclude(xmlText.replace(match[0], ""), filename, callback);
                        } else {
                            var referencedXMLFilename = relativePath + "/" + match[4];
                            zip.getTextFromFileName(
                                config.ZipFile,
                                referencedXMLFilename,
                                function (referencedXmlText) {
                                    resolveXIInclude(referencedXmlText, referencedXMLFilename, function (fixedReferencedXmlText) {
                                        resolveXIInclude(xmlText.replace(match[0], fixedReferencedXmlText), filename, callback);
                                    });
                                },
                                function (error) {
                                    errorCallback(error);
                                }
                            );
                        }
                    } else {
                        callback(xmlText);
                    }
                };

                zip.getTextFromFileName(config.ZipFile, config.MainXMLFile, function (xmlText) {
                    resolveXIInclude(xmlText, config.MainXMLFile, function (xmlText) {
                        config.UploadProgress[1] = 1;
                        config.ResolvedXIIncludes = true;
                        resultCallback();

                        replaceEntities(xmlText);
                    });
                });
            };

            /*
                Replace entities with markers so we can process the XML without worrying about resolving entities
             */
            var replaceEntities = function (xmlText) {
                var entityRe = /&.*?;/;
                var replacements = [];

                var match;
                while (match = entityRe.exec(xmlText)) {
                    var randomReplacement;
                    while (xmlText.indexOf(randomReplacement = "#" + Math.floor((Math.random() * 1000000000) + 1) + "#") !== -1) {

                    }

                    replacements.push({placeholder: randomReplacement, entity: match[0]});

                    xmlText = xmlText.replace(new RegExp(global.escapeRegExp(match[0]), "g"), randomReplacement);
                }

                config.UploadProgress[1] = 2;
                config.FoundEntities = true;
                resultCallback();

                findEntities(xmlText);
            };

            /*
                Find any entity definitions in the xml or ent files. Note that older publican books reference invalid
                entity files, so we just do a brute force search.
             */
            var findEntities = function (xmlText) {
                var relativePath = "";
                var lastIndexOf;
                if ((lastIndexOf = config.MainXMLFile.lastIndexOf("/")) !== -1) {
                    relativePath = config.MainXMLFile.substring(0, lastIndexOf);
                }

                zip.getCachedEntries(config.ZipFile, function (entries) {

                    var processTextFile = function (index) {
                        if (index >= entries.length) {
                            config.UploadProgress[1] = 3;
                            config.FoundEntityDefinitions = true;
                            resultCallback();

                            removeXmlPreamble(xmlText);
                        } else {
                            var value = entries[index];
                            if (value.filename.indexOf(relativePath) === 0) {
                                zip.getTextFromFile(value, function (fileText) {
                                    var entityDefRE = /<!ENTITY\s+[^\s]+\s+('|").*?('|")\s*>/g;
                                    var match;
                                    while (match = entityDefRE.exec(fileText)) {
                                        if (entities.indexOf(match[0]) === -1) {
                                            entities.push(match[0]);
                                        }
                                    }

                                    processTextFile(index + 1);
                                });
                            } else {
                                processTextFile(index + 1);
                            }
                        }
                    };

                    processTextFile(0);
                });
            };

            var removeXmlPreamble = function (xmlText) {
                xmlText = xmlText.replace(/<\?xml.*?>/g, "");
                xmlText = xmlText.replace(/<!DOCTYPE[\s\S]*?>/g, "");

                console.log(xmlText);

                config.UploadProgress[1] = 4;
                config.RemovedXMLPreamble = true;
                resultCallback();
            };

            // start the process
            resolveXiIncludes();
        },
        null,
        function (resultCallback, errorCallback, result, config) {resultCallback(the_next_step); }
    );

}(this));