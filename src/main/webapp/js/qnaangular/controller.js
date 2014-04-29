require(
    ["angular", "angular-file-upload", "angular-sanitize", "angular-bootstrap", 'qna/qna', 'qnastart'],
    function(angular, angularFileUpload, ngSanitize, angularBootstrap, qna, qnastart) {
        'use strict';

        var app = angular.module('qna', ['ui.bootstrap', 'angularFileUpload', 'ngSanitize']);

        function OKDialogInstanceController ($scope, $modalInstance, title, content) {

            $scope.title = title;
            $scope.content = content;

            $scope.ok = function () {
                $modalInstance.close();
            };
        }

        /**
         * The glue between the UI and the QNA object that controls the wizard
         * @param $scope
         * @param $modal
         * @param $rootScope
         * @constructor
         */
        function QNAController ($scope, $modal, $rootScope) {
            /*
             A callback that displays the ok dialog box
             */
            var alert = function (title, content) {
                var modalInstance = $modal.open({
                    templateUrl: 'okDialog.html',
                    controller: OKDialogInstanceController,
                    resolve: {
                        title: function () {
                            return title;
                        },
                        content: function () {
                            return content;
                        }
                    }
                });
            };

            /**
             * Initializes the QNA object, and then initializes the current step in the QNA object.
             * @param qna
             */
            var initializeQna = function (qna) {
                $scope.disabled = true;
                qna.initialize(
                    function (qna) {
                        $scope.qna = qna;

                        if (qna.step.enterStep) {
                            $rootScope.$apply();
                            var result = qna.results[qna.results.length - 1];
                            var config = qna.config;
                            qna.step.enterStep(
                                function (move, result) {
                                    /*
                                        Undefined means just update the UI
                                        true means move to next step
                                        false means enable the ui
                                     */
                                    if (move === undefined) {
                                        $rootScope.$apply();
                                    } else {
                                        if (move) {
                                            $scope.next(result);
                                        } else {
                                            $scope.disabled = false;
                                        }
                                    }
                                },
                                function (title, message, critical) {
                                    alert(title, message);

                                    if (critical === true) {
                                        $scope.restart();
                                    }
                                },
                                result,
                                config
                            );
                        } else {
                            $scope.disabled = false;
                        }

                        $rootScope.$apply();
                    },
                    function (title, error, critical) {
                        alert(title, error);

                        if (critical === true) {
                            $scope.restart();
                        }
                    }
                );
            };

            /**
             * Used in the UI to iterate over a range of numbers
             * @param num
             * @returns {Array}
             */
            $scope.getNumber = function (num) {
                return new Array(num);
            };

            $scope.inputTypes = qna.InputEnum;
            initializeQna(new qna.QNA(qnastart.qnastart, null, null, null));

            /**
             * Used to update a property on the config object when a file is selected
             * @param name
             * @param files
             */
            $scope.onFileSelect = function (name, files) {
                if (files.length !== 0) {
                    $scope.qna.config[name] = files[0];
                } else {
                    $scope.qna.config[name] = null;
                }
            };

            /**
             * Used to update a property on the config object when a directory is selected
             * @param name
             * @param files
             */
            $scope.onDirectorySelect = function (name, files) {
                if (files.length !== 0) {
                    $scope.qna.config[name] = files;
                } else {
                    $scope.qna.config[name] = null;
                }
            };

            /**
             * Called when the wizard is moved to the next step
             */
            $scope.next = function (result) {
                $scope.qna.next(function (qna) {
                    initializeQna(qna);
                }, function (title, message) {
                    alert(title, message);
                }, result);
            };

            /**
             * Called when teh wizard is moved to the previous step
             */
            $scope.previous = function () {
                $scope.qna.previous(function (qna) {
                    initializeQna(qna);
                }, function (title, message) {
                    alert(title, message);
                });
            };

            /**
             * Called when the wizard is restarted
             */
            $scope.restart = function () {
                initializeQna(new qna.QNA(qnastart.qnastart, null, null, null));
            };
        }

        app.controller(
            "OKDialogInstanceController",
            OKDialogInstanceController
        );

        app.controller(
            "QNAController",
            QNAController
        );

        angular.bootstrap(document, ['qna']);
    }
);