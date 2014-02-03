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
        this.xrefsResolved = false;
        this.resolvedXRefs = [];
        return this;
    };

    global.SpecTopic.prototype.setXRefsResolved = function (xrefsResolved) {
        this.xrefsResolved = xrefsResolved;
    };

    global.SpecTopic.prototype.setXml = function (xml, xmlDoc) {
        this.xml = xml;

        // find any
        var xrefsTargets = [];
        var xrefs = xmlDoc.evaluate("xref", xml, null, global.XPathResult.ANY_TYPE, null);
        var xref;
        while (xref = xrefs.iterateNext()) {
            if (xref.hasAttribute("linkend")) {
                var linkend = xref.getAttribute("linkend");
                if (xrefsTargets.indexOf(linkend) === -1) {
                    xrefsTargets.push(linkend);
                }
            }
        }

        this.setXRefs(xrefsTargets);

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

    global.SpecTopic.prototype.setResolvedXRefs = function (resolvedXRefs) {
        this.resolvedXRefs = resolvedXRefs;
        return this;
    };

    global.SpecTopic.prototype.addResolvedXRef = function (resolvedXRef) {
        if (this.resolvedXRefs.indexOf(resolvedXRef) === -1) {
            this.resolvedXRefs.push(resolvedXRef);
        }
        return this;
    };

}(this));