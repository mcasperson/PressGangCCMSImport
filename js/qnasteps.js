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
     */

    var REVISION_HISTORY_TAG_ID = 598;
    var AUTHOR_GROUP_TAG_ID = 664;

    // a zip model to be shared
    var zip = new global.QNAZipModel();

    // the content spec
    var contentSpec = "";

    function loadSetting(file, setting) {
        var lines = file.split("\n");
        global.jQuery.each(lines, function (index, value) {
            var keyValue = value.split(":");
            if (keyValue.length === 2) {
                if (new RegExp(global.escapeRegExp(setting)).test(keyValue[0].trim())) {
                    return keyValue[1].trim();
                }
            }
        });
    }

    function xmlToString(xmlDoc) {
        return (new global.XMLSerializer()).serializeToString(xmlDoc);
    }

    function reencode(xmlString, replacements) {
        var reversed = replacements.reverse();
        global.jQuery.each(reversed, function (index, value) {
            xmlString = xmlString.replace(new RegExp(global.escapeRegExp(value.placeholder)), "g", value.entity);
        });
        return xmlString;
    }

    function replaceSpecialChars(text) {
        return text.replace(/"/g, "\\\"")
            .replace(/\t/g, "\\t")
            .replace(/\n/g, "\\n");
    }

    function createTopic(xml, replacements, title, tags, config, successCallback, errorCallback) {

        // create the json that defines the tags to be added
        var tagsJSON = '{"items": [';

        global.jQuery.each(tags, function (index, value) {
            tagsJSON += '{"item": {"id": ' + value + '}, "state": 1}';
        });

        tagsJSON += ']}';

        var postBody = '{"title": "' + title + '", "description": "' + title + '", "xml": "' + replaceSpecialChars(reencode(xmlToString(xml), replacements)) + '", "locale": "en-US", "tags": ' + tagsJSON + ', "configuredParameters": ["title", "description", "xml", "locale", "tags"]}';

        global.jQuery.ajax({
            type: 'POST',
            url: 'http://' + config.PressGangHost + ':8080/pressgang-ccms/rest/1/topic/createormatch/json?message=Initial+Topic+Creation&flag=2&userId=89',
            data: postBody,
            contentType: "application/json",
            dataType: "json",
            success: function (data) {
                successCallback(data.topic.id, data.matchedExistingTopic);
            },
            error: function () {
                errorCallback("Connection Error", "An error occurred while uploading the revision history topic.");
            }
        });
    }

    /*
        STEP 1 - Get the ZIP file
     */
    global.QNAStart = new global.QNAStep()
        .setTitle("Select the ZIP file to import")
        .setIntro("Select the ZIP file that contains the valid Publican book that you wish to import into PressGang CCMS.")
        .setInputs(
            [
                new global.QNAVariables()
                    .setVariables([
                        new global.QNAVariable()
                            .setType(global.InputEnum.SINGLE_FILE)
                            .setIntro("Publican ZIP File")
                            .setName("ZipFile")
                    ])
            ]
        )
        .setProcessStep(function (resultCallback, errorCallback, result, config) {
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
        })
        .setNextStep(function (resultCallback) {
            resultCallback(askForMainXML);
        });

    /*
     STEP 2 - Get the main XML file
     */
    var askForMainXML = new global.QNAStep()
        .setTitle("Select the main XML file")
        .setIntro("Select the main XML file from the ZIP archive. Publican conventions mean the file should be named after the book title in the Book_Info.xml file. " +
                "This import tool will attempt to read the Book_Info.xml file to find the book title, and from that select the main XML file. " +
                "You only need to make a manual selection if the import tool could not find the main XML file, or if you want to override the default selection.")
        .setInputs([
            new global.QNAVariables()
                .setVariables([
                    new global.QNAVariable()
                        .setType(global.InputEnum.LISTBOX)
                        .setName("MainXMLFile")
                        .setOptions(function (resultCallback, errorCallback, result, config) {
                            zip.getCachedEntries(config.ZipFile, function (entries) {
                                var retValue = [];

                                global.angular.forEach(entries, function (value, key) {
                                    if (/^.*?\.xml$/.test(value.filename)) {
                                        retValue.push(value.filename);
                                    }
                                });

                                resultCallback(retValue);
                            });
                        })
                        .setValue(function (resultCallback, errorCallback, result, config) {
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
                        })
                ])
        ])
        .setNextStep(function (resultCallback) {
            resultCallback(askToCreateNewSpecOrOverwriteExistingOne);
        });

    /*
        Step 3 - Ask about creating a new spec or overwriting an old one
     */
    var askToCreateNewSpecOrOverwriteExistingOne = new global.QNAStep()
        .setTitle("Create or overwrite a content spec?")
        .setIntro("This wizard can create a new content specification, or overwrite the contents of an existing one. " +
                "You will usually want to create a new content specification, but if you are reimporting a book and want to overwrite the previously imported content spec, " +
                "select the overwrite option.")
        .setInputs([
            new global.QNAVariables()
                .setVariables([
                    new global.QNAVariable()
                        .setType(global.InputEnum.RADIO_BUTTONS)
                        .setIntro(["Create a new content spec", "Overwrite an existing content spec"])
                        .setName("CreateOrOverwrite")
                        .setOptions(["CREATE", "OVERWRITE"])
                        .setValue("CREATE")
                ])
        ])
        .setNextStep(function (resultCallback, errorCallback, result, config) {
            resultCallback(config.CreateOrOverwrite === "CREATE" ? specifyTheServer : getExistingContentSpecID);
        });

    var getExistingContentSpecID = new global.QNAStep()
        .setTitle("Create or overwrite a content spec?")
        .setIntro("This wizard can create a new content specification, or overwrite the contents of an existing one. " +
            "You will usually want to create a new content specification, but if you are reimporting a book and want to overwrite the previously imported content spec, " +
            "select the overwrite option.")
        .setInputs([
            new global.QNAVariables()
                .setVariables([
                    new global.QNAVariable()
                        .setType(global.InputEnum.TEXTBOX)
                        .setIntro("Existing content specification ID")
                        .setName("ExistingContentSpecID")
                ])
        ])
        .setNextStep(function (resultCallback) {
            resultCallback(specifyTheServer);
        });

    /*
        Step 4 - ask which server this is being uploaded to
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
            resultCallback(processZipFile);
        });

    /*
        Step 5 - Process the zip file
     */
    var processZipFile = new global.QNAStep()
        .setTitle("Importing Publican Book")
        .setOutputs([
            new global.QNAVariables()
                .setVariables([
                    new global.QNAVariable()
                        .setType(global.InputEnum.CHECKBOX)
                        .setIntro("Resolving xi:includes")
                        .setName("ResolvedXIIncludes"),
                    new global.QNAVariable()
                        .setType(global.InputEnum.CHECKBOX)
                        .setIntro("Finding entities in XML")
                        .setName("FoundEntities"),
                    new global.QNAVariable()
                        .setType(global.InputEnum.CHECKBOX)
                        .setIntro("Finding entity definitions")
                        .setName("FoundEntityDefinitions"),
                    new global.QNAVariable()
                        .setType(global.InputEnum.CHECKBOX)
                        .setIntro("Removing XML preamble")
                        .setName("RemovedXMLPreamble"),
                    new global.QNAVariable()
                        .setType(global.InputEnum.CHECKBOX)
                        .setIntro("Parse as XML")
                        .setName("ParsedAsXML"),
                    new global.QNAVariable()
                        .setType(global.InputEnum.CHECKBOX)
                        .setIntro("Finding book info")
                        .setName("FoundBookInfo"),
                    new global.QNAVariable()
                        .setType(global.InputEnum.CHECKBOX)
                        .setIntro("Finding revision history")
                        .setName("FoundRevisionHistory"),
                    new global.QNAVariable()
                        .setType(global.InputEnum.CHECKBOX)
                        .setIntro("Finding author group")
                        .setName("FoundAuthorGroup"),
                    new global.QNAVariable()
                        .setType(global.InputEnum.CHECKBOX)
                        .setIntro("Finding and uploading images")
                        .setName("FoundImages"),
                    new global.QNAVariable()
                        .setType(global.InputEnum.CHECKBOX)
                        .setIntro("Resolving book structure")
                        .setName("ResolvedBookStructure"),
                    new global.QNAVariable()
                        .setType(global.InputEnum.CHECKBOX)
                        .setIntro("Resolving xrefs")
                        .setName("ResolvedXrefs"),
                    new global.QNAVariable()
                        .setType(global.InputEnum.CHECKBOX)
                        .setIntro("Uploading content specification")
                        .setName("UploadedContentSpecification"),
                    new global.QNAVariable()
                        .setType(global.InputEnum.PROGRESS)
                        .setIntro("Progress")
                        .setName("UploadProgress")
                        // gotta set this first up because of https://github.com/angular-ui/bootstrap/issues/1547
                        .setValue([11, 0])
                ])
        ])
        .setEnterStep(function (resultCallback, errorCallback, result, config) {

            /**
             * A collection of entity definitions
             * @type {Array}
             */
            var entities = [];
            var replacements = [];

            /*
                Initialize some config values
             */
            config.UploadedTopicCount = 0;
            config.MatchedTopicCount = 0;

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

            /*
             Strip out any XML preabmle that might have been pulled in with the
             xi:inject resolution. Once this step is done we have plain xml
             with no entities, dtds or anything else that make life hard when
             trying to parse XML.
             */
            var removeXmlPreamble = function (xmlText) {
                xmlText = xmlText.replace(/<\?xml.*?>/g, "");
                xmlText = xmlText.replace(/<!DOCTYPE[\s\S]*?\[[\s\S]*?\]>/g, "");

                config.UploadProgress[1] = 4;
                config.RemovedXMLPreamble = true;
                resultCallback();

                parseAsXML(xmlText);
            };

            /*
             Take the sanitised XML and convert it to an actual XML DOM
             */
            var parseAsXML = function (xmlText) {
                var xmlDoc = global.jQuery.parseXML(xmlText);
                config.UploadProgress[1] = 5;
                config.ParsedAsXML = true;
                resultCallback();

                findBookInfo(xmlDoc);
            };

            /*
                Find the book info details
             */
            var findBookInfo = function (xmlDoc) {
                var bookinfo = xmlDoc.evaluate("/*/bookinfo", xmlDoc, null, global.XPathResult.ANY_TYPE, null).iterateNext();
                if (bookinfo) {
                    var title = xmlDoc.evaluate("title", bookinfo, null, global.XPathResult.ANY_TYPE, null).iterateNext();
                    var subtitle = xmlDoc.evaluate("subtitle", bookinfo, null, global.XPathResult.ANY_TYPE, null).iterateNext();
                    var edition = xmlDoc.evaluate("edition", bookinfo, null, global.XPathResult.ANY_TYPE, null).iterateNext();
                    var pubsnumber = xmlDoc.evaluate("pubsnumber", bookinfo, null, global.XPathResult.ANY_TYPE, null).iterateNext();
                    var productname = xmlDoc.evaluate("productname", bookinfo, null, global.XPathResult.ANY_TYPE, null).iterateNext();
                    var productnumber = xmlDoc.evaluate("productnumber", bookinfo, null, global.XPathResult.ANY_TYPE, null).iterateNext();

                    if (title) {
                        contentSpec += "Title = " + xmlToString(title) + "\n";
                    }

                    if (subtitle) {
                        contentSpec += "Subtitle = " + xmlToString(subtitle) + "\n";
                    }

                    if (edition) {
                        contentSpec += "Edition = " + xmlToString(edition) + "\n";
                    }

                    if (pubsnumber) {
                        contentSpec += "Pubsnumber = " + xmlToString(pubsnumber) + "\n";
                    }

                    if (productname) {
                        contentSpec += "Product = " + xmlToString(productname) + "\n";
                    }

                    if (productnumber) {
                        contentSpec += "Version = " + xmlToString(productnumber) + "\n";
                    }

                    contentSpec += "DTD = Docbook 4.5\n";
                    contentSpec += "Copyright Holder = Red Hat\n";

                    zip.getTextFromFileName("publican.cfg", function (text) {
                        var brand = loadSetting(text, "brand\\s*:");
                        contentSpec += "Brand = " + brand + "\n";
                        contentSpec += "publican.cfg = [\n";
                        contentSpec += text;
                        contentSpec += "\n]";
                    });

                    config.UploadProgress[1] = 7;
                    config.FoundBookInfo = true;
                    resultCallback();

                    extractRevisionHistory(xmlDoc);
                } else {
                    errorCallback("Invalid content", "The <bookinfo> element could not be found");
                }

            };

            var extractRevisionHistory = function (xmlDoc) {
                var revHistory = xmlDoc.evaluate("//revhistory", xmlDoc, null, global.XPathResult.ANY_TYPE, null).iterateNext();
                if (revHistory) {
                    createTopic(
                        revHistory,
                        replacements,
                        "Revision History",
                        [REVISION_HISTORY_TAG_ID],
                        config,
                        function (topicId, matchedExisting) {
                            config.RevisionHistoryTopicID = topicId;
                            config.UploadedTopicCount += 1;
                            if (matchedExisting) {
                                config.MatchedTopicCount += 1;
                            }

                            config.UploadProgress[1] = 6;
                            config.FoundRevisionHistory = true;
                            resultCallback();
                        },
                        errorCallback
                    );
                }
            };

            // start the process
            resolveXiIncludes();
        })
        .setNextStep(function (resultCallback, errorCallback, result, config) {
            resultCallback(the_next_step);
        });

}(this));