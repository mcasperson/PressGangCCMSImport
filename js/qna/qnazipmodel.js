(function (global) {
    'use strict';

    global.zip.workerScriptsPath = "/js/zip/";

    global.QNAZipModel = function () {

    };

    global.QNAZipModel.prototype.cache = {};

    global.QNAZipModel.prototype.getEntry = function (entry, onend) {
        entry.getData(new global.zip.BlobWriter(), onend);
    };

    global.QNAZipModel.prototype.getTextFromFile = function (entry, onend) {
        this.getEntry(entry, function (blob) {

            var reader = new global.FileReader();
            reader.addEventListener("load", function (event) {
                var textFile = event.target.result;
                onend(textFile);
            });
            reader.readAsText(blob);
        });
    };

    global.QNAZipModel.prototype.getEntries = function (file, onend, onerror) {
        global.zip.createReader(
            new global.zip.BlobReader(file),
            function (zipReader) {
                zipReader.getEntries(onend);
            },
            onerror
        );
    };

    global.QNAZipModel.prototype.getCachedEntries = function (file, onend, onerror) {
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

    global.QNAZipModel.prototype.clearCache = function () {
        this.cache = {};
    }
}(this));