/*
 This program is free software: you can redistribute it and/or modify
 it under the terms of the GNU Lesser General Public License as published by
 the Free Software Foundation, either version 3 of the License, or
 (at your option) any later version.

 This program is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 GNU Lesser General Public License for more details.

 You should have received a copy of the GNU Lesser General Public License
 along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

/*
    Mock calls to the rest server. This module takes the place of restcalls when testing.
 */
define(
    ['jquery', 'exports'],
    function (jquery, exports) {
        'use strict';

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
                                "id": ++maxImageId
                            },
                            "matchedExistingImage": false
                        }
                    );
                } else {
                    successCallback(
                        {
                            "id": ++maxImageId
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
                        "id":++maxTopicId
                    }
                );
            }, 0);
        };

        exports.updateTopic = function(id, xml, title, config, successCallback, errorCallback, retryCount) {
            window.setTimeout(function() {
                successCallback(
                    {
                        "id":id
                    }
                );
            }, 0);
        };

        exports.createContentSpec = function(spec, lang, config, successCallback, errorCallback, retryCount) {

            window.setTimeout(function() {
                successCallback(
                    {
                        "id": ++maxSpecId
                    }
                );
            }, 0);
        };
    }
)