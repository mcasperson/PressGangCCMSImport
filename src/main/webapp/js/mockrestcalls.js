define(
    ['zip', 'jquery', 'qna/qna', 'qna/qnazipmodel', 'qna/qnadirmodel', 'qna/qnautils', 'publicanimport', 'generaldocbookimport', 'generalexternalimport', 'constants', 'asciidocimport', 'reportsettings', 'exports'],
    function (zip, jquery, qna, qnazipmodel, qnadirmodel, qnautils, publicanimport, generaldocbookimport, generalexternalimport, constants, asciidocimport, reportsettings, exports) {
        'use strict';

        var maxRevision = 0;
        var maxImageId = 0;
        var maxTopicId = 0;
        var maxFileId = 0;
        var maxSpecId = 0;

        exports.configEntites = null;

        exports.loadEntityConfig = function (config, successCallback, errorCallback, retryCount) {
            window.setTimeout(function() {
                exports.configEntites = {"configuredParameters":null,"uiUrl":"http://topicindex-dev.ecs.eng.bne.redhat.com:8080/pressgang-ccms-ui/","docBookTemplateIds":[10,11,12,13,14,42,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,69,70],"seoCategoryIds":[2,3,15,17,22,23,24],"locales":["de","en-US","es","fr","it","ja","ko","pt-BR","ru","zh-Hans","zh-TW"],"defaultLocale":"en-US","docBuilderUrl":"http://docbuilder.usersys.redhat.com/","readOnly":false,"jmsUpdateFrequency":10,"entities":{"configuredParameters":null,"abstractTagId":692,"authorGroupTagId":664,"contentSpecTagId":268,"frozenTagId":669,"infoTagId":738,"internalOnlyTagId":315,"legalNoticeTagId":599,"obsoleteTagId":652,"reviewTagId":659,"revisionHistoryTagId":598,"taskTagId":4,"addedByPropertyTagId":14,"bugLinksLastValidatedPropertyTagId":38,"cspIdPropertyTagId":15,"emailPropertyTagId":3,"firstNamePropertyTagId":1,"fixedUrlPropertyTagId":20,"orgPropertyTagId":18,"orgDivisionPropertyTagId":19,"originalFileNamePropertyTagId":28,"pressGangWebsitePropertyTagId":37,"readOnlyPropertyTagId":25,"surnamePropertyTagId":2,"tagStylePropertyTagId":36,"typeCategoryId":4,"writerCategoryId":12,"failPenguinBlobConstantId":5,"rocBook45DTDBlobConstantId":9,"docBook50RNGBlobConstantId":11,"xmlFormattingStringConstantId":37,"docBookElementsStringConstantId":41,"topicTemplateId":59,"docBook45AbstractTopicTemplateId":76,"docBook45AuthorGroupTopicTemplateId":75,"docBook45InfoTopicTemplateId":80,"docBook45LegalNoticeTopicTemplateId":77,"docBook45RevisionHistoryTopicTemplateId":69,"docBook50AbstractTopicTemplateId":76,"docBook50AuthorGroupTopicTemplateId":79,"docBook50InfoTopicTemplateId":81,"docBook50LegalNoticeTopicTemplateId":77,"docBook50RevisionHistoryTopicTemplateId":78,"contentSpecTemplateId":71,"articleStringConstantId":36,"articleInfoStringConstantId":35,"authorGroupStringConstantId":4,"bookStringConstantId":1,"bookInfoStringConstantId":3,"pomStringConstantId":63,"prefaceStringConstantId":34,"publicanCfgStringConstantId":5,"revisionHistoryStringConstantId":15,"emptyTopicStringConstantId":31,"invalidInjectionStringConstantId":32,"invalidTopicStringConstantId":33,"unknownUserId":89,"undefinedEntities":{"expand":"undefinedEntities","startExpandIndex":0,"endExpandIndex":0,"size":0,"items":[]}},"undefinedSettings":{"expand":"undefinedSettings","startExpandIndex":0,"endExpandIndex":0,"size":0,"items":[]},"zanataSettings":{"expand":"zanataSettings","startExpandIndex":0,"endExpandIndex":1,"size":1,"items":[{"state":0,"item":{"configuredParameters":null,"id":"internal","name":"Test","url":"http://zanatatest.usersys.redhat.com/zanata/","project":"skynet-topics","projectVersion":"1"}}]}};
                successCallback();
            }, 0);
        };

        exports.createImage = function(model, trytomatch, zipfile, image, lang, config, successCallback, errorCallback, retryCount) {
            window.setTimeout(function() {
                if (trytomatch) {
                    successCallback(
                        {
                            "image": {
                                "configuredParameters": null,
                                "id": ++maxImageId,
                                "revision": ++maxRevision,
                                "expand": ["languageImages", "logDetails", "revisions"],
                                "logDetails": null,
                                "selfLink": "http://skynet-dev.usersys.redhat.com:8080/pressgang-ccms/rest/1/image/get/json/" + maxImageId,
                                "editLink": "http://skynet-dev.usersys.redhat.com:8080/pressgang-ccms/rest/1/image/update/json",
                                "deleteLink": "http://skynet-dev.usersys.redhat.com:8080/pressgang-ccms/rest/1/image/delete/json/" + maxImageId,
                                "addLink": "http://skynet-dev.usersys.redhat.com:8080/pressgang-ccms/rest/1/image/create/json",
                                "description": "screenshot.png",
                                "languageImages_OTM": null,
                                "revisions": null
                            },
                            "matchedExistingImage": true
                        }
                    );
                } else {
                    successCallback(
                        {
                            "configuredParameters": null,
                            "id": ++maxImageId,
                            "revision": ++maxRevision,
                            "expand": ["languageImages", "logDetails", "revisions"],
                            "logDetails": null,
                            "selfLink": "http://skynet-dev.usersys.redhat.com:8080/pressgang-ccms/rest/1/image/get/json/" + maxImageId,
                            "editLink": "http://skynet-dev.usersys.redhat.com:8080/pressgang-ccms/rest/1/image/update/json",
                            "deleteLink": "http://skynet-dev.usersys.redhat.com:8080/pressgang-ccms/rest/1/image/delete/json/" + maxImageId,
                            "addLink": "http://skynet-dev.usersys.redhat.com:8080/pressgang-ccms/rest/1/image/create/json",
                            "description": "screenshot.png",
                            "languageImages_OTM": null,
                            "revisions": null
                        }
                    );
                }
            }, 0);
        };

        exports.getSimilarTopics = function(xml, config, successCallback, errorCallback, retryCount) {
            window.setTimeout(function() {
                successCallback(
                    {
                        "expand":"topics",
                        "startExpandIndex":0,
                        "endExpandIndex":0,
                        "size":0,
                        "items":[]
                    }
                );
            }, 0);
        };

        exports.createTopic = function(tryToMatch, format, xml, title, tags, lang, config, successCallback, errorCallback, retryCount) {

            window.setTimeout(function() {
                successCallback(
                    {
                        "configuredParameters":null,
                        "id":++maxTopicId,
                        "revision":++maxRevision,
                        "expand":["tags","incomingRelationships","outgoingRelationships","sourceUrls_OTM","bugzillaBugs_OTM","properties","logDetails","contentSpecs_OTM","keywords","minhashes","revisions"],
                        "logDetails":null,
                        "selfLink":"http://skynet-dev.usersys.redhat.com:8080/pressgang-ccms/rest/1/topic/get/json/" + maxTopicId,
                        "editLink":"http://skynet-dev.usersys.redhat.com:8080/pressgang-ccms/rest/1/topic/update/json",
                        "deleteLink":"http://skynet-dev.usersys.redhat.com:8080/pressgang-ccms/rest/1/topic/delete/json/" + maxTopicId,
                        "addLink":"http://skynet-dev.usersys.redhat.com:8080/pressgang-ccms/rest/1/topic/create/json",
                        "properties":null,
                        "title":title,
                        "xml":xml,
                        "xmlErrors":null,
                        "locale":lang,
                        "xmlFormat":format == 4.5 ? "DOCBOOK_45" : "DOCBOOK_50",
                        "tags":null,
                        "sourceUrls_OTM":null,
                        "description":title,
                        "created":1403218635858,
                        "lastModified":1403218636011,
                        "bugzillaBugs_OTM":null,
                        "translatedTopics_OTM":null,
                        "outgoingRelationships":null,
                        "incomingRelationships":null,
                        "contentSpecs_OTM":null,
                        "keywords":null,
                        "minHashes":null,
                        "contentHash":"whatever",
                        "revisions":null
                    }
                );
            }, 0);
        };

        exports.createContentSpec = function(spec, lang, config, successCallback, errorCallback, retryCount) {

            window.setTimeout(function() {
                successCallback(
                    {
                        "configuredParameters": null,
                        "id": ++maxSpecId,
                        "revision": ++maxRevision,
                        "expand": ["logDetails", "properties", "tags", "text", "translatedContentSpecs", "processes", "revisions"],
                        "logDetails": null,
                        "selfLink": "http://skynet-dev.usersys.redhat.com:8080/pressgang-ccms/rest/1/contentspec/get/json/" + maxSpecId,
                        "editLink": "http://skynet-dev.usersys.redhat.com:8080/pressgang-ccms/rest/1/contentspec/update/json",
                        "deleteLink": "http://skynet-dev.usersys.redhat.com:8080/pressgang-ccms/rest/1/contentspec/delete/json/" + maxSpecId,
                        "addLink": "http://skynet-dev.usersys.redhat.com:8080/pressgang-ccms/rest/1/contentspec/create/json",
                        "properties": null,
                        "locale": "en-US",
                        "lastPublished": null,
                        "lastModified": 1403216925010,
                        "errors": "WARN:  No Abstract specified, so a default will be used instead.\nINFO:  The Content Specification is valid.\nINFO:  The Content Specification saved successfully.\n",
                        "failedContentSpec": null,
                        "type": "BOOK",
                        "tags": null,
                        "translatedContentSpecs": null,
                        "processes": null,
                        "title": "Title",
                        "product": "Product",
                        "version": "1",
                        "text": null,
                        "processingOptions": null,
                        "revisions": null
                    }
                );
            }, 0);
        };
    }
)