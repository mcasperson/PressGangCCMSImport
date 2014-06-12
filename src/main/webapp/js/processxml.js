define(
    ['jquery', 'qna/qna', 'qna/qnautils', 'qna/qnazipmodel', 'qnastart', 'specelement', 'uri/URI', 'constants', 'constants', 'generalexternalimport', 'exports'],
    function (jquery, qna, qnautils, qnazipmodel, qnastart, specelement, URI, constants, generaldocbookimport, generalexternalimport, exports) {
        'use strict';

        var ELEMENTS_THAT_NEED_CDATA = ["userinput", "computeroutput"];

        // these are entities created by csprocessor
        var IGNORED_ENTITIES = [
            "BUILD_BZPRODUCT",
            "BUILD_BZCOMPONENT",
            "BUILD_BZVERSION",
            "BUILD_BZKEYWORDS",
            "BUILD_JIRA_PID",
            "BUILD_JIRA_CID",
            "BUILD_JIRA_VID",
            "BUILD_DATE",
            "BUILD_NAME",
            "TITLE",
            "BZPRODUCT",
            "BZCOMPONENT",
            "BZURL",
            "euro",
            "cularr",
            "curarr",
            "dArr",
            "darr2",
            "dharl",
            "dharr",
            "dlarr",
            "drarr",
            "hArr",
            "harr",
            "harrw",
            "lAarr",
            "Larr",
            "larr2",
            "larrhk",
            "larrlp",
            "larrtl",
            "lhard",
            "lharu",
            "lrarr2",
            "lrhar2",
            "lsh",
            "map",
            "mumap",
            "nearr",
            "nhArr",
            "nharr",
            "nlArr",
            "nlarr",
            "nrArr",
            "nrarr",
            "nwarr",
            "olarr",
            "orarr",
            "rAarr",
            "Rarr",
            "rarr2",
            "rarrhk",
            "rarrlp",
            "rarrtl",
            "rarrw",
            "rhard",
            "rharu",
            "rlarr2",
            "rlhar2",
            "rsh",
            "uArr",
            "uarr2",
            "uharl",
            "uharr",
            "vArr",
            "varr",
            "xhArr",
            "xharr",
            "xlArr",
            "xrArr",
            "amalg",
            "Barwed",
            "barwed",
            "Cap",
            "coprod",
            "Cup",
            "cuvee",
            "cuwed",
            "diam",
            "divonx",
            "intcal",
            "lthree",
            "ltimes",
            "minusb",
            "oast",
            "ocir",
            "odash",
            "odot",
            "ominus",
            "oplus",
            "osol",
            "otimes",
            "plusb",
            "plusdo",
            "prod",
            "rthree",
            "rtimes",
            "sdot",
            "sdotb",
            "setmn",
            "sqcap",
            "sqcup",
            "ssetmn",
            "sstarf",
            "sum",
            "timesb",
            "top",
            "uplus",
            "wreath",
            "xcirc",
            "xdtri",
            "xutri",
            "dlcorn",
            "drcorn",
            "lceil",
            "lfloor",
            "lpargt",
            "rceil",
            "rfloor",
            "rpargt",
            "ulcorn",
            "urcorn",
            "gnap",
            "gnE",
            "gne",
            "gnsim",
            "gvnE",
            "lnap",
            "lnE",
            "lne",
            "lnsim",
            "lvnE",
            "nap",
            "ncong",
            "nequiv",
            "ngE",
            "nge",
            "nges",
            "ngt",
            "nlE",
            "nle",
            "nles",
            "nlt",
            "nltri",
            "nltrie",
            "nmid",
            "npar",
            "npr",
            "npre",
            "nrtri",
            "nrtrie",
            "nsc",
            "nsce",
            "nsim",
            "nsime",
            "nsmid",
            "nspar",
            "nsub",
            "nsubE",
            "nsube",
            "nsup",
            "nsupE",
            "nsupe",
            "nVDash",
            "nVdash",
            "nvDash",
            "nvdash",
            "prnap",
            "prnE",
            "prnsim",
            "scnap",
            "scnE",
            "scnsim",
            "subnE",
            "subne",
            "supnE",
            "supne",
            "vsubnE",
            "vsubne",
            "vsupnE",
            "vsupne",
            "ang",
            "angmsd",
            "beth",
            "bprime",
            "comp",
            "daleth",
            "ell",
            "empty",
            "gimel",
            "inodot",
            "jnodot",
            "nexist",
            "oS",
            "planck",
            "real",
            "sbsol",
            "vprime",
            "weierp",
            "ape",
            "asymp",
            "bcong",
            "bepsi",
            "bowtie",
            "bsim",
            "bsime",
            "bump",
            "bumpe",
            "cire",
            "colone",
            "cuepr",
            "cuesc",
            "cupre",
            "dashv",
            "ecir",
            "ecolon",
            "eDot",
            "efDot",
            "egs",
            "els",
            "erDot",
            "esdot",
            "fork",
            "frown",
            "gap",
            "gE",
            "gEl",
            "gel",
            "ges",
            "Gg",
            "gl",
            "gsdot",
            "gsim",
            "Gt",
            "lap",
            "ldot",
            "lE",
            "lEg",
            "leg",
            "les",
            "lg",
            "Ll",
            "lsim",
            "Lt",
            "ltrie",
            "mid",
            "models",
            "pr",
            "prap",
            "pre",
            "prsim",
            "rtrie",
            "samalg",
            "sc",
            "scap",
            "sccue",
            "sce",
            "scsim",
            "sfrown",
            "smid",
            "smile",
            "spar",
            "sqsub",
            "sqsube",
            "sqsup",
            "sqsupe",
            "ssmile",
            "Sub",
            "subE",
            "Sup",
            "supE",
            "thkap",
            "thksim",
            "trie",
            "twixt",
            "Vdash",
            "vDash",
            "vdash",
            "veebar",
            "vltri",
            "vprop",
            "vrtri",
            "Vvdash",
            "boxDL",
            "boxDl",
            "boxdL",
            "boxdl",
            "boxDR",
            "boxDr",
            "boxdR",
            "boxdr",
            "boxH",
            "boxh",
            "boxHD",
            "boxHd",
            "boxhD",
            "boxhd",
            "boxHU",
            "boxHu",
            "boxhU",
            "boxhu",
            "boxUL",
            "boxUl",
            "boxuL",
            "boxul",
            "boxUR",
            "boxUr",
            "boxuR",
            "boxur",
            "boxV",
            "boxv",
            "boxVH",
            "boxVh",
            "boxvH",
            "boxvh",
            "boxVL",
            "boxVl",
            "boxvL",
            "boxvl",
            "boxVR",
            "boxVr",
            "boxvR",
            "boxvr",
            "Acy",
            "acy",
            "Bcy",
            "bcy",
            "CHcy",
            "chcy",
            "Dcy",
            "dcy",
            "Ecy",
            "ecy",
            "Fcy",
            "fcy",
            "Gcy",
            "gcy",
            "HARDcy",
            "hardcy",
            "Icy",
            "icy",
            "IEcy",
            "iecy",
            "IOcy",
            "iocy",
            "Jcy",
            "jcy",
            "Kcy",
            "kcy",
            "KHcy",
            "khcy",
            "Lcy",
            "lcy",
            "Mcy",
            "mcy",
            "Ncy",
            "ncy",
            "numero",
            "Ocy",
            "ocy",
            "Pcy",
            "pcy",
            "Rcy",
            "rcy",
            "Scy",
            "scy",
            "SHCHcy",
            "shchcy",
            "SHcy",
            "shcy",
            "SOFTcy",
            "softcy",
            "Tcy",
            "tcy",
            "TScy",
            "tscy",
            "Ucy",
            "ucy",
            "Vcy",
            "vcy",
            "YAcy",
            "yacy",
            "Ycy",
            "ycy",
            "YUcy",
            "yucy",
            "Zcy",
            "zcy",
            "ZHcy",
            "zhcy",
            "DJcy",
            "djcy",
            "DScy",
            "dscy",
            "DZcy",
            "dzcy",
            "GJcy",
            "gjcy",
            "Iukcy",
            "iukcy",
            "Jsercy",
            "jsercy",
            "Jukcy",
            "jukcy",
            "KJcy",
            "kjcy",
            "LJcy",
            "ljcy",
            "NJcy",
            "njcy",
            "TSHcy",
            "tshcy",
            "Ubrcy",
            "ubrcy",
            "YIcy",
            "yicy",
            "acute",
            "breve",
            "caron",
            "cedil",
            "circ",
            "dblac",
            "die",
            "dot",
            "grave",
            "macr",
            "ogon",
            "ring",
            "tilde",
            "uml",
            "Agr",
            "agr",
            "Bgr",
            "bgr",
            "Dgr",
            "dgr",
            "EEgr",
            "eegr",
            "Egr",
            "egr",
            "Ggr",
            "ggr",
            "Igr",
            "igr",
            "Kgr",
            "kgr",
            "KHgr",
            "khgr",
            "Lgr",
            "lgr",
            "Mgr",
            "mgr",
            "Ngr",
            "ngr",
            "Ogr",
            "ogr",
            "OHgr",
            "ohgr",
            "Pgr",
            "pgr",
            "PHgr",
            "phgr",
            "PSgr",
            "psgr",
            "Rgr",
            "rgr",
            "sfgr",
            "Sgr",
            "sgr",
            "Tgr",
            "tgr",
            "THgr",
            "thgr",
            "Ugr",
            "ugr",
            "Xgr",
            "xgr",
            "Zgr",
            "zgr",
            "Aacgr",
            "aacgr",
            "Eacgr",
            "eacgr",
            "EEacgr",
            "eeacgr",
            "Iacgr",
            "iacgr",
            "idiagr",
            "Idigr",
            "idigr",
            "Oacgr",
            "oacgr",
            "OHacgr",
            "ohacgr",
            "Uacgr",
            "uacgr",
            "udiagr",
            "Udigr",
            "udigr",
            "alpha",
            "beta",
            "chi",
            "Delta",
            "delta",
            "epsi",
            "epsis",
            "epsiv",
            "eta",
            "Gamma",
            "gamma",
            "gammad",
            "iota",
            "kappa",
            "kappav",
            "Lambda",
            "lambda",
            "mu",
            "nu",
            "Omega",
            "omega",
            "Phi",
            "phis",
            "phiv",
            "Pi",
            "pi",
            "piv",
            "Psi",
            "psi",
            "rho",
            "rhov",
            "Sigma",
            "sigma",
            "sigmav",
            "tau",
            "Theta",
            "thetas",
            "thetav",
            "Upsi",
            "upsi",
            "Xi",
            "xi",
            "zeta",
            "b.alpha",
            "b.beta",
            "b.chi",
            "b.Delta",
            "b.delta",
            "b.epsi",
            "b.epsiv",
            "b.eta",
            "b.Gamma",
            "b.gamma",
            "b.Gammad",
            "b.gammad",
            "b.iota",
            "b.kappa",
            "b.kappav",
            "b.Lambda",
            "b.lambda",
            "b.mu",
            "b.nu",
            "b.Omega",
            "b.omega",
            "b.Phi",
            "b.phi",
            "b.phiv",
            "b.Pi",
            "b.pi",
            "b.piv",
            "b.Psi",
            "b.psi",
            "b.rho",
            "b.rhov",
            "b.Sigma",
            "b.sigma",
            "b.sigmav",
            "b.tau",
            "b.Theta",
            "b.thetas",
            "b.thetav",
            "b.Upsi",
            "b.upsi",
            "b.Xi",
            "b.xi",
            "b.zeta",
            "Aacute",
            "aacute",
            "Acirc",
            "acirc",
            "AElig",
            "aelig",
            "Agrave",
            "agrave",
            "Aring",
            "aring",
            "Atilde",
            "atilde",
            "Auml",
            "auml",
            "Ccedil",
            "ccedil",
            "Eacute",
            "eacute",
            "Ecirc",
            "ecirc",
            "Egrave",
            "egrave",
            "ETH",
            "eth",
            "Euml",
            "euml",
            "Iacute",
            "iacute",
            "Icirc",
            "icirc",
            "Igrave",
            "igrave",
            "Iuml",
            "iuml",
            "Ntilde",
            "ntilde",
            "Oacute",
            "oacute",
            "Ocirc",
            "ocirc",
            "Ograve",
            "ograve",
            "Oslash",
            "oslash",
            "Otilde",
            "otilde",
            "Ouml",
            "ouml",
            "szlig",
            "THORN",
            "thorn",
            "Uacute",
            "uacute",
            "Ucirc",
            "ucirc",
            "Ugrave",
            "ugrave",
            "Uuml",
            "uuml",
            "Yacute",
            "yacute",
            "yuml",
            "Abreve",
            "abreve",
            "Amacr",
            "amacr",
            "Aogon",
            "aogon",
            "Cacute",
            "cacute",
            "Ccaron",
            "ccaron",
            "Ccirc",
            "ccirc",
            "Cdot",
            "cdot",
            "Dcaron",
            "dcaron",
            "Dstrok",
            "dstrok",
            "Ecaron",
            "ecaron",
            "Edot",
            "edot",
            "Emacr",
            "emacr",
            "ENG",
            "eng",
            "Eogon",
            "eogon",
            "gacute",
            "Gbreve",
            "gbreve",
            "Gcedil",
            "Gcirc",
            "gcirc",
            "Gdot",
            "gdot",
            "Hcirc",
            "hcirc",
            "Hstrok",
            "hstrok",
            "Idot",
            "IJlig",
            "ijlig",
            "Imacr",
            "imacr",
            "Iogon",
            "iogon",
            "Itilde",
            "itilde",
            "Jcirc",
            "jcirc",
            "Kcedil",
            "kcedil",
            "kgreen",
            "Lacute",
            "lacute",
            "Lcaron",
            "lcaron",
            "Lcedil",
            "lcedil",
            "Lmidot",
            "lmidot",
            "Lstrok",
            "lstrok",
            "Nacute",
            "nacute",
            "napos",
            "Ncaron",
            "ncaron",
            "Ncedil",
            "ncedil",
            "Odblac",
            "odblac",
            "OElig",
            "oelig",
            "Omacr",
            "omacr",
            "Racute",
            "racute",
            "Rcaron",
            "rcaron",
            "Rcedil",
            "rcedil",
            "Sacute",
            "sacute",
            "Scaron",
            "scaron",
            "Scedil",
            "scedil",
            "Scirc",
            "scirc",
            "Tcaron",
            "tcaron",
            "Tcedil",
            "tcedil",
            "Tstrok",
            "tstrok",
            "Ubreve",
            "ubreve",
            "Udblac",
            "udblac",
            "Umacr",
            "umacr",
            "Uogon",
            "uogon",
            "Uring",
            "uring",
            "Utilde",
            "utilde",
            "Wcirc",
            "wcirc",
            "Ycirc",
            "ycirc",
            "Yuml",
            "Zacute",
            "zacute",
            "Zcaron",
            "zcaron",
            "Zdot",
            "zdot",
            "amp",
            "apos",
            "ast",
            "brvbar",
            "bsol",
            "cent",
            "colon",
            "comma",
            "commat",
            "copy",
            "curren",
            "darr",
            "deg",
            "divide",
            "dollar",
            "equals",
            "excl",
            "frac12",
            "frac14",
            "frac18",
            "frac34",
            "frac38",
            "frac58",
            "frac78",
            "gt",
            "half",
            "horbar",
            "hyphen",
            "iexcl",
            "iquest",
            "laquo",
            "larr",
            "lcub",
            "ldquo",
            "lowbar",
            "lpar",
            "lsqb",
            "lsquo",
            "lt",
            "micro",
            "middot",
            "nbsp",
            "not",
            "num",
            "ohm",
            "ordf",
            "ordm",
            "para",
            "percnt",
            "period",
            "plus",
            "plusmn",
            "pound",
            "quest",
            "quot",
            "raquo",
            "rarr",
            "rcub",
            "rdquo",
            "reg",
            "rpar",
            "rsqb",
            "rsquo",
            "sect",
            "semi",
            "shy",
            "sol",
            "sung",
            "sup1",
            "sup2",
            "sup3",
            "times",
            "trade",
            "uarr",
            "verbar",
            "yen",
            "blank",
            "blk12",
            "blk14",
            "blk34",
            "block",
            "bull",
            "caret",
            "check",
            "cir",
            "clubs",
            "copysr",
            "cross",
            "Dagger",
            "dagger",
            "dash",
            "diams",
            "dlcrop",
            "drcrop",
            "dtri",
            "dtrif",
            "emsp",
            "emsp13",
            "emsp14",
            "ensp",
            "female",
            "ffilig",
            "fflig",
            "ffllig",
            "filig",
            "flat",
            "fllig",
            "frac13",
            "frac15",
            "frac16",
            "frac23",
            "frac25",
            "frac35",
            "frac45",
            "frac56",
            "hairsp",
            "hearts",
            "hellip",
            "hybull",
            "incare",
            "ldquor",
            "lhblk",
            "loz",
            "lozf",
            "lsquor",
            "ltri",
            "ltrif",
            "male",
            "malt",
            "marker",
            "mdash",
            "mldr",
            "natur",
            "ndash",
            "nldr",
            "numsp",
            "phone",
            "puncsp",
            "rdquor",
            "rect",
            "rsquor",
            "rtri",
            "rtrif",
            "rx",
            "sext",
            "sharp",
            "spades",
            "squ",
            "squf",
            "star",
            "starf",
            "target",
            "telrec",
            "thinsp",
            "uhblk",
            "ulcrop",
            "urcrop",
            "utri",
            "utrif",
            "vellip",
            "aleph",
            "and",
            "ang90",
            "angsph",
            "angst",
            "ap",
            "becaus",
            "bernou",
            "bottom",
            "cap",
            "compfn",
            "cong",
            "conint",
            "cup",
            "Dot",
            "DotDot",
            "equiv",
            "exist",
            "fnof",
            "forall",
            "ge",
            "hamilt",
            "iff",
            "infin",
            "int",
            "isin",
            "lagran",
            "lang",
            "lArr",
            "le",
            "lowast",
            "minus",
            "mnplus",
            "nabla",
            "ne",
            "ni",
            "notin",
            "or",
            "order",
            "par",
            "part",
            "permil",
            "perp",
            "phmmat",
            "Prime",
            "prime",
            "prop",
            "radic",
            "rang",
            "rArr",
            "sim",
            "sime",
            "square",
            "sub",
            "sube",
            "sup",
            "supe",
            "tdot",
            "there4",
            "tprime",
            "Verbar",
            "wedgeq"];

        /*
         See if the xiincludes have some other base dir
         */
        function getXmlBaseAttribute(xmlText) {
            var baseMatch = /xml:base=('|")(.*?)('|")/.exec(xmlText);

            if (baseMatch !== null) {
                var base = baseMatch[2];
                if (base !== "." && base !== "./") {
                    if (!/\/$/.test(base)) {
                        base += "/";
                    }

                    return base;
                }
            }

            return null;
        }

        function removeXmlPreamble (xmlText) {

            var replaceMatchesNotInCDATA = function(regex, text) {
                var retValue = "";
                var match;
                while ((match = regex.exec(text)) !== null) {
                    var previousString = text.substr(0, match.index);
                    var lastStartCDATA = previousString.lastIndexOf("<[CDATA[");
                    var lastEndCDATA = previousString.lastIndexOf("]]>");

                    /*
                     The xml preface element was in a cdata element, so ignore it
                     */
                    if (lastStartCDATA !== -1 &&
                        (lastEndCDATA === -1 || lastEndCDATA < lastStartCDATA)) {
                        retValue += text.substr(0, match.index + match[0].length);
                    } else {
                        retValue += text.substr(0, match.index);
                    }

                    text = text.substr(match.index + match[0].length);
                }

                retValue += text;

                return retValue;
            };

            xmlText = replaceMatchesNotInCDATA(/<\?xml.*?>/, xmlText);
            xmlText = replaceMatchesNotInCDATA(/<!DOCTYPE[\s\S]*?(\[[\s\S]*?\])*>/, xmlText);

            return xmlText;
        }

        /*
         Resolve xi:includes
         */
        exports.resolveXiIncludes = function(resultCallback, errorCallback, config) {
            var inputModel = qnastart.getInputModel(config);

            function resolveFileRefs(xmlText, filename, callback) {
                var thisFile = new URI(filename);
                var base = getXmlBaseAttribute(xmlText);
                var filerefRe = /fileref\s*=\s*('|")(.*?)('|")/g;
                var filerefReHrefGroup = 2;

                var replacements = [];

                var findImageFileNames = function (callback) {
                    var match;
                    if ((match = filerefRe.exec(xmlText)) !== null) {
                        if (!(constants.COMMON_CONTENT_PATH_PREFIX.test(match[filerefReHrefGroup]))) {
                            var imageFilename = match[filerefReHrefGroup];
                            var fixedImageFilename =  imageFilename.replace(/^\.\//, "");

                            var referencedXMLFilenameRelativeWithBase = new URI((base === null ? "" : base) + fixedImageFilename);
                            var referencedXMLFilenameWithBase = referencedXMLFilenameRelativeWithBase.absoluteTo(thisFile).toString();

                            var referencedXMLFilenameRelativeWithoutBase = new URI(fixedImageFilename);
                            var referencedXMLFilenameWithoutBase = referencedXMLFilenameRelativeWithoutBase.absoluteTo(thisFile).toString();

                            inputModel.hasFileName(
                                config.InputSource,
                                referencedXMLFilenameWithoutBase,
                                function (exists) {
                                    if (exists) {
                                        replacements.push({original: imageFilename, replacement: referencedXMLFilenameWithoutBase});
                                        findImageFileNames(callback);
                                    } else {
                                        inputModel.hasFileName(
                                            config.InputSource,
                                            referencedXMLFilenameWithBase,
                                            function (exists) {
                                                if (exists) {
                                                    replacements.push({original: imageFilename, replacement: referencedXMLFilenameWithBase});
                                                }

                                                findImageFileNames(callback);
                                            },
                                            errorCallback,
                                            true
                                        );
                                    }
                                },
                                errorCallback,
                                true
                            );
                        } else {
                            findImageFileNames(callback);
                        }
                    } else {
                        callback();
                    }
                };

                findImageFileNames(function () {
                    jquery.each(replacements, function (index, value) {
                        xmlText = xmlText.replace(new RegExp("fileref\\s*=\\s*('|\")" + value.original + "('|\")"), "fileref='" + value.replacement + "'");
                    });
                    callback(xmlText);
                });
            }

            function resolveXIInclude(xmlText, base, filename, visitedFiles, callback) {
                /*
                    Make sure we are not entering an infinite loop
                 */
                if (visitedFiles.indexOf(filename) === -1) {
                    visitedFiles.push(filename);
                }

                /*
                    Convert the XML we have to a DOM
                 */
                var xmlDetails = qnautils.replaceEntitiesInText(removeXmlPreamble(xmlText));
                var xmlDoc = qnautils.stringToXML(xmlDetails.xml);
                var xiInclude = qnautils.xPath("//xi:include", xmlDoc).iterateNext();
                if (xiInclude !== null) {
                    var hrefAttr = xiInclude.attributes['href'];
                    var xpointerAttr = xiInclude.attributes['xpointer'];
                    var parseAttr = xiInclude.attributes['parse'];

                    if (hrefAttr !== undefined) {

                        var href = hrefAttr.nodeValue;

                        if (constants.COMMON_CONTENT_PATH_PREFIX.test(href)) {
                            /*
                             Leave the XInclude in for common content, so we can add these links
                             to the content spec using https://bugzilla.redhat.com/show_bug.cgi?id=1065609.
                             We do this by marking it as a comment xi include, which will be reverted
                             once all the xi includes have been processed.
                             */
                            var commentNode = xmlDoc.createElement("includecomment");
                            jquery.each(xiInclude.attributes, function(index, value){
                                commentNode.setAttribute(value.nodeName, value.nodeValue);
                            });
                            xiInclude.parentNode.insertBefore(commentNode, xiInclude);
                            xiInclude.parentNode.removeChild(xiInclude);

                            resolveXIInclude(qnautils.encodedXmlToString({xml: xmlDoc, replacements: xmlDetails.replacements}), base, filename, visitedFiles.slice(0), callback);
                        } else {
                            /*
                             We need to work out where the files to be included will come from. This is a
                             combination of the href, the xml:base attribute, and the location of the
                             xml file that is doing the importing.

                             TODO: this processing does not really follow the xml standards, but has been good
                             enough to import all content I have come across.
                             */
                            var fixedMatch = href.replace(/^\.\//, "");
                            var thisFile = new URI(filename);
                            var referencedXMLFilenameRelativeWithBase = new URI((base === null ? "" : base) + fixedMatch);
                            var referencedXMLFilenameWithBase = referencedXMLFilenameRelativeWithBase.absoluteTo(thisFile).toString();

                            var referencedXMLFilenameRelativeWithoutBase = new URI(fixedMatch);
                            var referencedXMLFilenameWithoutBase = referencedXMLFilenameRelativeWithoutBase.absoluteTo(thisFile).toString();

                            var processFile = function (referencedFileName) {

                                if (visitedFiles.indexOf(referencedFileName) !== -1) {
                                    errorCallback("Circular reference detected", visitedFiles.toString() + "," + referencedFileName, true);
                                    return;
                                }

                                inputModel.getTextFromFileName(
                                    config.InputSource,
                                    referencedFileName,
                                    function (referencedXmlText) {
                                        resolveFileRefs(referencedXmlText, referencedFileName, function (referencedXmlText) {
                                            resolveXIInclude(
                                                referencedXmlText,
                                                getXmlBaseAttribute(referencedXmlText),
                                                referencedFileName,
                                                visitedFiles.slice(0),
                                                function (fixedReferencedXmlText) {
                                                    var includedXmlDetails = qnautils.replaceEntitiesInText(fixedReferencedXmlText, xmlDetails.replacements);
                                                    var includedXmlDoc = qnautils.stringToXML(includedXmlDetails.xml);

                                                    if (includedXmlDoc === null) {
                                                        errorCallback("Invalid XML", "The source material has invalid XML, and can not be imported.", true);
                                                        return;
                                                    }

                                                    if (xpointerAttr !== undefined) {
                                                        var xpointer = xpointerAttr.nodeValue;
                                                        var xpointerMatch = /xpointer\((.*?)\)/.exec(xpointer);
                                                        if (xpointerMatch !== null) {
                                                            xpointer = xpointerMatch[1];
                                                        }
                                                        var subset = qnautils.xPath(xpointer, includedXmlDoc);

                                                        var matchedNode;
                                                        while ((matchedNode = subset.iterateNext()) !== null) {
                                                            var imported = xmlDoc.importNode(matchedNode, true);
                                                            xiInclude.parentNode.insertBefore(imported, xiInclude);
                                                        }
                                                    } else if (parseAttr !== undefined && parseAttr.nodeValue === "text") {
                                                        /*
                                                         When including content with the xiinclude attribute match="text", we need to replace
                                                         any special characters.
                                                         */
                                                        var textNode = xmlDoc.createTextNode(fixedReferencedXmlText);
                                                        xiInclude.parentNode.insertBefore(textNode, xiInclude);
                                                    } else {
                                                        var importedDoc = xmlDoc.importNode(includedXmlDoc.documentElement, true);
                                                        xiInclude.parentNode.insertBefore(importedDoc, xiInclude);
                                                    }

                                                    xiInclude.parentNode.removeChild(xiInclude);

                                                    jquery.merge(xmlDetails.replacements, includedXmlDetails.replacements);

                                                    resolveXIInclude(qnautils.encodedXmlToString({xml: xmlDoc, replacements: xmlDetails.replacements}), base, filename, visitedFiles.slice(0), callback);
                                                }
                                            );
                                        });
                                    },
                                    function (error) {
                                        errorCallback("Error reading file", "There was an error reading the file " + referencedFileName, true);
                                    },
                                    true
                                );
                            };

                            inputModel.hasFileName(
                                config.InputSource,
                                referencedXMLFilenameWithBase,
                                function (exists) {
                                    if (exists) {
                                        processFile(referencedXMLFilenameWithBase);
                                    } else {
                                        inputModel.hasFileName(
                                            config.InputSource,
                                            referencedXMLFilenameWithoutBase,
                                            function (exists) {
                                                if (exists) {
                                                    processFile(referencedXMLFilenameWithoutBase);
                                                } else {
                                                    //errorCallback("Could not find file", "Could not find file " + referencedXMLFilename, true);

                                                    /*
                                                     If the file could not be found, check to see if it enclosed
                                                     a fallback, and move it as a sibling of the xi:include
                                                     */
                                                    var fallbackInclude = qnautils.xPath("./xi:fallback/xi:include", xiInclude).iterateNext();
                                                    if (fallbackInclude !== null) {
                                                        xiInclude.parentNode.insertBefore(fallbackInclude, xiInclude);
                                                    }
                                                    // remove the xi:include
                                                    xiInclude.parentNode.removeChild(xiInclude);
                                                    resolveXIInclude(qnautils.encodedXmlToString({xml: xmlDoc, replacements: xmlDetails.replacements}), base, filename, visitedFiles.slice(0), callback);
                                                }
                                            },
                                            errorCallback,
                                            true
                                        );
                                    }
                                },
                                errorCallback,
                                true
                            );
                        }
                    } else {
                        /*
                         Found an xi:include without a href? delete it an move on.
                         */
                        xiInclude.parentNode.removeChild(xiInclude);
                        resolveXIInclude(qnautils.encodedXmlToString({xml: xmlDoc, replacements: xmlDetails.replacements}), base, filename, visitedFiles.slice(0), callback);

                    }
                } else {
                    callback(qnautils.encodedXmlToString({xml: xmlDoc, replacements: xmlDetails.replacements}), visitedFiles);
                }
            }

            inputModel.getTextFromFileName(
                config.InputSource,
                config.MainFile,
                function (xmlText) {
                    resolveFileRefs(xmlText, config.MainFile, function (xmlText) {
                        function resolveXIIncludeLoop(xmlText, visitedFiles) {

                            var xmlDetails = qnautils.replaceEntitiesInText(removeXmlPreamble(xmlText));
                            var xmlDoc = qnautils.stringToXML(xmlDetails.xml);

                            if (xmlDoc === null) {
                                console.log("xml is not valid");
                            }

                            var xiInclude = qnautils.xPath("//xi:include", xmlDoc).iterateNext();

                            if (xiInclude !== null) {

                                var base = getXmlBaseAttribute(xmlText);

                                resolveXIInclude(
                                    xmlText,
                                    base,
                                    config.MainFile,
                                    visitedFiles,
                                    function (xmlText, visitedFiles) {
                                        resolveXIIncludeLoop(xmlText, visitedFiles);
                                    }
                                );
                            } else {
                                xmlText = xmlText.replace(/includecomment/g, "xi:include");
                                resultCallback(xmlText);
                            }
                        }

                        var count = 0;
                        resolveXIIncludeLoop(xmlText, [config.MainFile]);
                    });
                },
                true
            );
        }

        exports.processXMLAndExtractEntities = function(resultCallback, errorCallback, xmlText, config, extractEntities) {
            var inputModel = qnastart.getInputModel(config);

            /*
             Start the processing
             */
            replaceEntities(xmlText);

            function replaceEntities(xmlText) {
                var fixedXMLResult = qnautils.replaceEntitiesInText(xmlText);
                config.replacements = fixedXMLResult.replacements;
                xmlText = fixedXMLResult.xml;

                if (extractEntities) {
                    findEntities(xmlText);
                } else {
                    removeXmlPreambleFromBook(xmlText, []);
                }
            }

            /*
             Find any entity definitions in the xml or ent files. Note that older publican books reference invalid
             entity files, so we just do a brute force search.
             */
            function findEntities(xmlText) {
                var entities = [];

                function done() {
                    removeXmlPreambleFromBook(xmlText, entities);
                }

                function extractExtities(fileText) {
                    var entityDefDoubleQuoteRE = /<!ENTITY\s+([^\s]+)\s+".*?"\s*>/g;
                    var entityDefSingleQuoteRE = /<!ENTITY\s+([^\s]+)\s+'.*?'\s*>/g;
                    var match;
                    while ((match = entityDefDoubleQuoteRE.exec(fileText)) !== null) {
                        if (entities.indexOf(match[0]) === -1 && IGNORED_ENTITIES.indexOf(match[1]) === -1) {
                            entities.push(match[0]);
                        }
                    }

                    while ((match = entityDefSingleQuoteRE.exec(fileText)) !== null) {
                        if (entities.indexOf(match[0]) === -1 && IGNORED_ENTITIES.indexOf(match[1]) === -1) {
                            entities.push(match[0]);
                        }
                    }
                }

                if (inputModel !== null) {
                    var relativePath = "";
                    var lastIndexOf;
                    if ((lastIndexOf = config.MainFile.lastIndexOf("/")) !== -1) {
                        relativePath = config.MainFile.substring(0, lastIndexOf);
                    }

                    inputModel.getCachedEntries(config.InputSource, function (entries) {

                        var processTextFile = function (index) {
                            if (index >= entries.length) {
                                done();
                            } else {
                                var value = entries[index];
                                var filename = qnautils.getFileName(value);
                                if (filename.indexOf(relativePath) === 0 && qnautils.isNormalFile(filename)) {
                                    inputModel.getTextFromFile(value, function (fileText) {
                                        extractExtities(fileText);
                                        processTextFile(index + 1);
                                    });
                                } else {
                                    processTextFile(index + 1);
                                }
                            }
                        };

                        processTextFile(0);
                    });
                } else {
                    extractExtities(xmlText);
                    done();
                }
            }

            /*
             Strip out any XML preabmle that might have been pulled in with the
             xi:inject resolution. Once this step is done we have plain xml
             with no entities, dtds or anything else that make life hard when
             trying to parse XML.
             */
            function removeXmlPreambleFromBook(xmlText, entities) {
                xmlText = removeXmlPreamble(xmlText);
                fixXML(xmlText, entities);
            }

            /**
             * Some common errors appear in old books. This function cleans them up
             * so that the XML can be parsed.
             */
            function fixXML(xmlText, entities) {
                var commentFix = /<!--([\s\S]*?)-->/g;
                var replacements = [];
                var commentMatch;
                while ((commentMatch = commentFix.exec(xmlText)) !== null) {
                    if (commentMatch[1].indexOf("<!--") !== -1) {
                        replacements.push({original: commentMatch[0], replacement: "<!--" + commentMatch[1].replace(/<!--/g, "") + "-->"});
                    }
                }

                /*
                 Ignored containers are merged into their parents
                 */
                jquery.each(constants.IGNORED_CONTAINERS, function (index, value) {
                    xmlText = xmlText.replace(new RegExp("<\s*" + qnautils.escapeRegExp(value) + ".*?/?\s*>", "g"), "");
                    xmlText = xmlText.replace(new RegExp("<\s*/\s*" + qnautils.escapeRegExp(value) + "\s*>", "g"), "");
                    ;
                });

                jquery.each(replacements, function (index, value) {
                    xmlText = xmlText.replace(value.original, value.replacement.replace(/\$/g, "$$$$"));
                });

                parseAsXML(xmlText, entities);
            }

            /*
             Take the sanitised XML and convert it to an actual XML DOM
             */
            function parseAsXML(xmlText, entities) {
                var xmlDoc = qnautils.stringToXML(xmlText);

                if (xmlDoc === null) {
                    errorCallback("Invalid XML", "The source material has invalid XML, and can not be imported.", true);
                    return;
                }
                fixElementsThatNeedCData(xmlDoc, entities);
            }

            /**
             * Publican won't respect line breaks in elements like userinput or computeroutput
             * when they are in a <screen> unless their text is wrapped in a CDATA element.
             */
            function fixElementsThatNeedCData(xmlDoc, entities) {
                var replacements = [];
                jquery.each(ELEMENTS_THAT_NEED_CDATA, function(index, value) {
                    var cdataElements = qnautils.xPath("//docbook:" + value, xmlDoc);
                    var cdataElement = null;
                    while ((cdataElement = cdataElements.iterateNext()) !== null) {
                        var textNodes = qnautils.xPath(".//docbook:text()", cdataElement);
                        var textNode = null;
                        while ((textNode = textNodes.iterateNext()) !== null) {
                            if (textNode.parentNode.nodeType !== Node.CDATA_SECTION_NODE) {
                                replacements.push(textNode);
                            }
                        }
                    }
                });

                jquery.each(replacements, function(index, value) {
                    var cdata = xmlDoc.createCDATASection(value.textContent);
                    value.parentNode.insertBefore(cdata, value);
                    value.parentNode.removeChild(value);
                });

                removeBoilerplate(xmlDoc, entities);
            }

            /*
             Remove any content that is added automatically by the csprocessor. This means you
             can re-import content exported as a book by csprocessor.
             */
            function removeBoilerplate(xmlDoc, entities) {
                var createBugParas = qnautils.xPath("//docbook:para[@role='RoleCreateBugPara']", xmlDoc);
                var removeElements = [];
                var para;
                while ((para = createBugParas.iterateNext()) !== null) {
                    removeElements.push(para);
                }

                jquery.each(removeElements, function (index, value) {
                    value.parentNode.removeChild(value);
                });

                findBookInfo(xmlDoc, entities);

            }

            /*
             Find the book info details
             */
            function findBookInfo (xmlDoc, entities) {

                /*
                 Try looking at the root book or article element
                 */
                var root = qnautils.xPath("//docbook:book", xmlDoc).iterateNext();
                if (root === null) {
                    root = qnautils.xPath("//docbook:article", xmlDoc).iterateNext();
                }

                if (root) {
                    var rootTitle = qnautils.xPath("./docbook:title", root).iterateNext();
                    var rootSubtitle = qnautils.xPath("./docbook:subtitle", root).iterateNext();

                    if (rootTitle) {
                        config.ContentSpecTitle = qnautils.reencode(qnautils.replaceWhiteSpace(rootTitle.innerHTML), config.replacements);
                    }

                    if (rootSubtitle) {
                        config.ContentSpecSubtitle = qnautils.reencode(qnautils.replaceWhiteSpace(rootSubtitle.innerHTML), config.replacements);
                    }
                }

                /*
                 Look in the info elements for additional metadata
                 */
                var bookinfo = qnautils.xPath("//docbook:bookinfo", xmlDoc).iterateNext();
                if (bookinfo === null) {
                    bookinfo = qnautils.xPath("//docbook:articleinfo", xmlDoc).iterateNext();
                }
                if (bookinfo === null) {
                    bookinfo = qnautils.xPath("//docbook:info", xmlDoc).iterateNext();
                }

                if (bookinfo) {
                    var title = qnautils.xPath("./docbook:title", bookinfo).iterateNext();
                    var subtitle = qnautils.xPath("./docbook:subtitle", bookinfo).iterateNext();
                    var edition = qnautils.xPath("./docbook:edition", bookinfo).iterateNext();
                    var pubsnumber = qnautils.xPath("./docbook:pubsnumber", bookinfo).iterateNext();
                    var productname = qnautils.xPath("./docbook:productname", bookinfo).iterateNext();
                    var productnumber = qnautils.xPath("./docbook:productnumber", bookinfo).iterateNext();

                    if (title) {
                        config.ContentSpecTitle = qnautils.reencode(qnautils.replaceWhiteSpace(title.innerHTML), config.replacements);
                    }

                    if (subtitle) {
                        config.ContentSpecSubtitle = qnautils.reencode(qnautils.replaceWhiteSpace(subtitle.innerHTML), config.replacements);
                    }

                    if (edition) {
                        config.ContentSpecEdition = qnautils.reencode(qnautils.replaceWhiteSpace(edition.innerHTML), config.replacements);
                    }

                    if (pubsnumber) {
                        config.ContentSpecPubsnumber = qnautils.reencode(qnautils.replaceWhiteSpace(pubsnumber.innerHTML), config.replacements);
                    }

                    if (productname) {
                        config.ContentSpecProduct = qnautils.reencode(qnautils.replaceWhiteSpace(productname.innerHTML), config.replacements);
                    }

                    if (productnumber) {
                        if (productnumber.innerHTML.trim().length !== 0) {
                            config.ContentSpecVersion = qnautils.reencode(qnautils.replaceWhiteSpace(productnumber.innerHTML), config.replacements);
                        }
                    }

                    /*
                        Set some defaults if no values could be found
                     */
                    if (config.ContentSpecProduct === undefined) {
                        config.ContentSpecProduct = "Product";
                    }

                    if (config.ContentSpecVersion === undefined) {
                        config.ContentSpecVersion = "1";
                    }
                }
                findIndex(xmlDoc, entities);
            }

            function findIndex (xmlDoc, entities) {
                var index = qnautils.xPath("//docbook:index", xmlDoc).iterateNext();
                if (index) {
                    config.Index = "On";
                }

                replaceAsciiEntities(xmlDoc, entities)
            }

            /*
                Replace any ascii entity codes (like &92;) with their characters (like /)
             */
            function replaceAsciiEntities(xmlDoc, entities) {
                jQuery.each(config.replacements, function(index, value){
                    var match;
                    if ((match = /&#(\d+);/.exec(value.entity)) !== null) {
                        value.entity = String.fromCharCode(match[1]);
                    }
                    if ((match = /&#x([0-9A-Fa-f]+);/.exec(value.entity)) !== null) {
                        value.entity = String.fromCharCode(parseInt(match[1], 16));
                    }
                })

                fixProgramListingEntries(xmlDoc, entities);
            }

            function fixProgramListingEntries(xmlDoc, entities) {
                var replacements = [];
                var programListings = qnautils.xPath("//docbook:programlisting", xmlDoc);
                var programListing = null;
                while ((programListing = programListings.iterateNext()) !== null) {
                    if (programListing.hasAttribute("language")) {
                        replacements.push(programListing);
                    }
                }

                jquery.each(replacements, function(index, value) {
                    var lang = value.getAttribute("language");
                    if (lang === "ini") {
                        value.setAttribute("language", "INI Files");
                    } else if (lang === "json") {
                        value.setAttribute("language", "JavaScript");
                    }
                })

                resultCallback({xml: qnautils.xmlToString(xmlDoc), entities: entities, replacements: config.replacements});
            }
        }
    }
)