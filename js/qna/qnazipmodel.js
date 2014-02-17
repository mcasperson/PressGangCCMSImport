define (['jquery', 'zip', 'exports'], function (jquery, zip, exports) {
    'use strict';

    zip.workerScriptsPath = "js/zip/";

    exports.QNAZipModel = function () {

    };

    exports.QNAZipModel.prototype.cache = {};

    exports.QNAZipModel.prototype.getEntry = function (entry, onend) {
        entry.getData(new zip.BlobWriter(), onend);
    };

    exports.QNAZipModel.prototype.getTextFromFile = function (entry, onend) {
        this.getEntry(entry, function (blob) {

            var reader = new FileReader();
            reader.addEventListener("load", function (event) {
                var textFile = event.target.result;
                onend(textFile);
            });
            reader.readAsText(blob);
        });
    };

    exports.QNAZipModel.prototype.getByteArrayFromFile = function (entry, onend) {
        this.getEntry(entry, function (blob) {

            var reader = new FileReader();
            reader.addEventListener("load", function (event) {
                var arrayBuffer = event.target.result;
                onend(arrayBuffer);
            });
            reader.readAsArrayBuffer(blob);
        });
    };

    exports.QNAZipModel.prototype.getTextFromFileName = function (file, filename, onend, onerror) {
        var me = this;
        this.getCachedEntries(file, function (entries) {
            var foundFile = false;
            jquery.each(entries, function (index, value) {
                if (value.filename === filename) {
                    me.getTextFromFile(value, onend);
                    foundFile = true;
                    return false;
                }
            });

            if (!foundFile) {
                onerror("Could not find " + filename);
            }
        }, onerror);
    };

    exports.QNAZipModel.prototype.getByteArrayFromFileName = function (file, filename, onend, onerror) {
        var me = this;
        this.getCachedEntries(file, function (entries) {
            var foundFile = false;
            jquery.each(entries, function (index, value) {
                if (value.filename === filename) {
                    me.getByteArrayFromFile(value, onend);
                    foundFile = true;
                    return false;
                }
            });

            if (!foundFile) {
                onerror("Could not find " + filename);
            }
        }, onerror);
    };

    exports.QNAZipModel.prototype.getEntries = function (file, onend, onerror) {
        zip.createReader(
            new zip.BlobReader(file),
            function (zipReader) {
                zipReader.getEntries(onend);
            },
            onerror
        );
    };

    exports.QNAZipModel.prototype.getCachedEntries = function (file, onend, onerror) {
        if (this.cache[file]) {
            onend(this.cache[file]);
        } else {
            this.getEntries(
                file,
                (function (cache) {
                    return function (entries) {
                        cache[file] = entries;
                        onend(entries);
                    };
                }(this.cache)),
                onerror
            );
        }
    };

    exports.QNAZipModel.prototype.hasFileName = function (file, filename, resultCallback, errorCallback) {
        this.getCachedEntries(
            file,
            function (entries) {
                var found = false;
                jquery.each(entries, function (index, value) {
                    if (value.filename === filename) {
                        found = true;
                        resultCallback(found);
                        return false;
                    }
                });

                if (!found) {
                    resultCallback(found);
                }
            },
            errorCallback
        );
    };


    exports.QNAZipModel.prototype.clearCache = function () {
        this.cache = {};
    };
});