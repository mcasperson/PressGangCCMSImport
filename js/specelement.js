(function (global) {
    'use strict';

    global.SpecContainer = function () {

    };

    global.SpecContainer.prototype.setId = function (id) {
        this.id = id;
        return this;
    };

    global.SpecContainer.prototype.setFirstTopic = function (firstTopic) {
        this.firstTopic = firstTopic;
        return this;
    };

    global.SpecContainer.prototype.setSpecLine = function (specLine) {
        this.specLine = specLine;
        return this;
    };

    global.SpecTopic = function () {
        this.saved = false;
        return this;
    };

    global.SpecTopic.prototype.setXml = function (xml) {
        this.xml = xml;
        return this;
    };

    global.SpecTopic.prototype.setTopicId = function (topicId) {
        this.topicId = topicId;
        return this;
    };

    global.SpecTopic.prototype.setSaved = function (saved) {
        this.saved = saved;
        return this;
    };

    global.SpecTopic.prototype.setId = function (id) {
        this.id = id;
        return this;
    };

    global.SpecTopic.prototype.setXRefs = function (xrefs) {
        this.xrefs = xrefs;
        return this;
    };

    global.SpecTopic.prototype.setSpecLine = function (specLine) {
        this.specLine = specLine;
        return this;
    };

}(this));