(function (global) {
    'use strict';

    global.zip.workerScriptsPath = "/js/zip/";

    global.QNAZipModel = function () {
        this.getEntries = function (file, onend, onerror) {
            global.zip.createReader(
                new global.zip.BlobReader(file),
                function (zipReader) {
                    zipReader.getEntries(onend);
                },
                onerror
            );
        };

        this.getEntry = function (entry, onend) {
            entry.getData(new global.zip.BlobWriter(), onend);
        };

        this.getTextFromFile = function (entry, onend) {
            this.getEntry(entry, function (blob) {

                var reader = new global.FileReader();
                reader.addEventListener("load", function (event) {
                    var textFile = event.target.result;
                    onend(textFile);
                });
                reader.readAsText(blob);
            });
        }
    };
}(this));