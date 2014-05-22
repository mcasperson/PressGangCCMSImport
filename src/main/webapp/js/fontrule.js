define(['exports'], function(exports) {
    'use strict';

    exports.FontRule = function(fontRule) {
        if (fontRule !== undefined) {
            this.font = fontRule.font;
            this.size = fontRule.size;
            this.bold = fontRule.bold;
            this.strikethrough = fontRule.strikethrough;
            this.italics = fontRule.italics;
            this.underline = fontRule.underline;
            this.docBookElement = fontRule.docBookElement;
            this.merge = fontRule.merge;
        }
    };

    exports.FontRule.prototype.hasSameSettings = function (fontRule) {
        if (this.font !== undefined && this.font !== fontRule.font) {
            return false;
        }

        if (this.size !== undefined && this.size !== fontRule.size) {
            return false;
        }

        if (this.bold !== undefined && this.bold !== fontRule.bold) {
            return false;
        }

        if (this.italics !== undefined && this.italics !== fontRule.italics) {
            return false;
        }

        if (this.underline !== undefined && this.underline !== fontRule.underline) {
            return false;
        }

        if (this.strikethrough !== undefined && this.strikethrough !== fontRule.strikethrough) {

        }

        return true;
    };

    exports.FontRule.prototype.equals = function (fontRule) {
        if (!(this.font === undefined && fontRule.font === undefined) &&
            this.font && !fontRule.font) {
            return false;
        }

        if (!(this.size === undefined && fontRule.size === undefined) &&
            this.size && !fontRule.size) {
            return false;
        }

        if (!(this.bold === undefined && fontRule.bold === undefined) &&
            this.bold && !fontRule.bold) {
            return false;
        }

        if (!(this.italics === undefined && fontRule.italics === undefined) &&
            this.italics && !fontRule.italics) {
            return false;
        }

        if (!(this.underline === undefined && fontRule.underline === undefined) &&
            this.underline && !fontRule.underline) {
            return false;
        }

        if (!(this.strikethrough === undefined && fontRule.strikethrough === undefined) &&
            this.strikethrough && !fontRule.strikethrough) {
            return false;
        }

        return true;
    };


    exports.FontRule.prototype.setFont = function (font) {
        this.font = font;
        return this;
    };

    exports.FontRule.prototype.setSize = function (size) {
        this.size = size;
        return this;
    };

    exports.FontRule.prototype.setBold = function (bold) {
        this.bold = bold;
        return this;
    };

    exports.FontRule.prototype.setItalics = function (italics) {
        this.italics = italics;
        return this;
    };

    exports.FontRule.prototype.setUnderline = function (underline) {
        this.underline = underline;
        return this;
    };

    exports.FontRule.prototype.setStrikethrough = function (strikethrough) {
        this.strikethrough = strikethrough;
        return this;
    };

    exports.FontRule.prototype.setDocBookElement = function (docBookElement) {
        this.docBookElement = docBookElement;
        return this;
    };

    exports.FontRule.prototype.setMerge = function (merge) {
        this.merge = merge;
        return this;
    };

});