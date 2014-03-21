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
                                function (result) {
                                    /*
                                        Undefined means just update the UI
                                        true means move to next step
                                        false means enable the ui
                                     */
                                    if (result === undefined) {
                                        $rootScope.$apply();
                                    } else {
                                        if (result) {
                                            $scope.next();
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

            $scope.getNumber = function (num) {
                return new Array(num);
            };

            $scope.inputTypes = qna.InputEnum;
            initializeQna(new qna.QNA(qnastart.qnastart, null, null, null));

            $scope.onFileSelect = function (name, files) {
                if (files.length !== 0) {
                    $scope.qna.config[name] = files[0];
                } else {
                    $scope.qna.config[name] = null;
                }
            };

            $scope.onDirectorySelect = function (name, files) {
                if (files.length !== 0) {
                    $scope.qna.config[name] = files;
                } else {
                    $scope.qna.config[name] = null;
                }
            };

            $scope.next = function () {
                $scope.qna.next(function (qna) {
                    initializeQna(qna);
                }, function (title, message) {
                    alert(title, message);
                });
            };

            $scope.previous = function () {
                $scope.qna.previous(function (qna) {
                    initializeQna(qna);
                }, function (title, message) {
                    alert(title, message);
                });
            };

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