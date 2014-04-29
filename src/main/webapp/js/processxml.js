define(
    ['jquery', 'qna/qna', 'qna/qnautils', 'qna/qnazipmodel', 'qnastart', 'specelement', 'uri/URI', 'docbookconstants', 'generaldocbookimport', 'generalexternalimport', 'exports'],
    function (jquery, qna, qnautils, qnazipmodel, qnastart, specelement, URI, docbookconstants, generaldocbookimport, generalexternalimport, exports) {
        'use strict';

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

        function getSpecDocbookVersion(config) {
            return config.ImportOption === docbookconstants.DOCBOOK_50_IMPORT_OPTION ? "5.0" : "4.5";
        }

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

        exports.processZipFile = new qna.QNAStep()
            .setTitle("Processing XML")
            .setIntro("The source XML is being processed and analyzed to find metadata that will be added to the content specification.")
            .setOutputs([
                new qna.QNAVariables()
                    .setVariables([
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.CHECKBOX)
                            .setIntro("Resolving xi:includes")
                            .setName("ResolvedXIIncludes"),
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.CHECKBOX)
                            .setIntro("Finding entities in XML")
                            .setName("FoundEntities"),
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.CHECKBOX)
                            .setIntro("Finding entity definitions")
                            .setName("FoundEntityDefinitions"),
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.CHECKBOX)
                            .setIntro("Removing XML preamble")
                            .setName("RemovedXMLPreamble"),
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.CHECKBOX)
                            .setIntro("Parse as XML")
                            .setName("ParsedAsXML"),
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.CHECKBOX)
                            .setIntro("Finding book info")
                            .setName("FoundBookInfo"),
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.PROGRESS)
                            .setIntro("Progress")
                            .setName("XMLProcessingProgress")
                            // gotta set this first up because of https://github.com/angular-ui/bootstrap/issues/1547
                            .setValue([100, 0])
                    ])
            ])
            .setNextStep(function (resultCallback, errorCallback, result, config) {
                if (config.ImportOption === "DocBook5" || config.ImportOption === "DocBook45") {
                    resultCallback(generaldocbookimport.getSpecDetails);
                } else {
                    resultCallback(generalexternalimport.getSpecDetails);
                }
            })
            .setEnterStep(function (resultCallback, errorCallback, result, config) {
                /*
                 There are 6 steps, so this is how far to move the progress bar with each
                 step.
                 */
                var progressIncrement = 100 / 6;

                var inputModel = qnastart.getInputModel(config);

                var thisStep = this;

                /*
                    Start the processing
                 */
                resolveXiIncludes();

                function setProgress(progress) {
                    config.XMLProcessingProgress[1] = progress;
                    thisStep.setTitlePrefixPercentage(config.XMLProcessingProgress[1]);
                }

                /*
                 Resolve xi:includes
                 */
                function resolveXiIncludes() {
                    // Note the self closing tag is optional. clearFallbacks will remove those.
                    var generalXiInclude = /<\s*xi:include\s+(.*?)\/?>/;

                    // Start by clearing out fallbacks. There is a chance that a book being imported xi:inclides
                    // non-existant content and relies on the fallback, but we don't support that.
                    function clearFallbacks(xmlText) {
                        var xiFallbackRe = /<\s*xi:fallback.*?>[\s\S]*?<\s*\/\s*xi:fallback\s*>/g;
                        var closeXiIncludeRe = /<\s*\/xi:include\s*>/g;
                        return xmlText.replace(xiFallbackRe, "").replace(closeXiIncludeRe, "");
                    }

                    function resolveFileRefs(xmlText, filename, callback) {
                        var thisFile = new URI(filename);
                        var base = getXmlBaseAttribute(xmlText);
                        var filerefRe = /fileref\s*=\s*('|")(.*?)('|")/g;
                        var filerefReHrefGroup = 2;

                        var replacements = [];

                        var findImageFileNames = function (callback) {
                            var match;
                            if ((match = filerefRe.exec(xmlText)) !== null) {
                                if (!(docbookconstants.COMMON_CONTENT_PATH_PREFIX.test(match[filerefReHrefGroup]))) {
                                    var imageFilename = match[filerefReHrefGroup].replace(/^\.\//, "");
                                    var thisFile = new URI(imageFilename);
                                    var referencedXMLFilenameRelativeWithBase = new URI((base === null ? "" : base) + imageFilename);
                                    var referencedXMLFilenameWithBase = referencedXMLFilenameRelativeWithBase.absoluteTo(thisFile).toString();

                                    var referencedXMLFilenameRelativeWithoutBase = new URI(imageFilename);
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

                        xmlText = clearFallbacks(xmlText);

                        /*
                         Make sure we are not entering an infinite loop
                         */
                        if (visitedFiles.indexOf(filename) === -1) {
                            visitedFiles.push(filename);
                        }

                        var match = generalXiInclude.exec(xmlText);
                        var xiIncludeAttributesGroup = 1;

                        if (match !== null) {

                            var previousString = xmlText.substr(0, match.index);
                            var lastStartComment = previousString.lastIndexOf("<!--");
                            var lastEndComment = previousString.lastIndexOf("-->");

                            /*
                             The xi:include was in a comment, so ignore it
                             */
                            if (lastStartComment !== -1 &&
                                (lastEndComment === -1 || lastEndComment < lastStartComment)) {
                                xmlText = xmlText.replace(match[0], match[0].replace("xi:include", "xi:includecomment"));
                                resolveXIInclude(xmlText, base, filename, visitedFiles.slice(0), callback);
                                return;
                            }

                            /*
                             break down the attributes looking for the href and xpointer attributes
                             */
                            var xiIncludesAttrs = match[xiIncludeAttributesGroup];
                            var attrRe = /\b(.*?)\s*=\s*('|")(.*?)('|")/g;
                            var href;
                            var xpointer;
                            var attrmatch;
                            while ((attrmatch = attrRe.exec(xiIncludesAttrs)) !== null) {
                                var attributeName = attrmatch[1];
                                var attributeValue = attrmatch[3];

                                if (attributeName.trim() === "href") {
                                    href = attributeValue;
                                } else if (attributeName.trim() === "xpointer") {
                                    var xpointerMatch = /xpointer\((.*?)\)/.exec(attributeValue);
                                    if (xpointerMatch !== null) {
                                        xpointer = xpointerMatch[1];
                                    } else {
                                        xpointer = attributeValue;
                                    }
                                }
                            }

                            if (href !== undefined) {
                                if (docbookconstants.COMMON_CONTENT_PATH_PREFIX.test(href)) {
                                    xmlText = xmlText.replace(match[0], "");
                                    resolveXIInclude(xmlText, base, filename, visitedFiles.slice(0), callback);
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
                                                            if (xpointer !== undefined) {
                                                                var replacedTextResult = qnautils.replaceEntitiesInText(referencedXmlText);
                                                                var cleanedReferencedXmlText = removeXmlPreamble(replacedTextResult.xml);
                                                                var cleanedReferencedXmlDom = qnautils.stringToXML(cleanedReferencedXmlText);

                                                                if (cleanedReferencedXmlDom === null) {
                                                                    errorCallback("Invalid XML", "The source material has invalid XML, and can not be imported.", true);
                                                                    return;
                                                                }

                                                                var subset = qnautils.xPath(xpointer, cleanedReferencedXmlDom);

                                                                var replacement = "";
                                                                var matchedNode;
                                                                while ((matchedNode = subset.iterateNext()) !== null) {
                                                                    if (replacement.length !== 0) {
                                                                        replacement += "\n";
                                                                    }
                                                                    fixedReferencedXmlText += qnautils.reencode(qnautils.xmlToString(matchedNode), replacedTextResult.replacements);
                                                                }
                                                            }

                                                            /*
                                                             The dollar sign has special meaning in the replace method.
                                                             https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/replace#Specifying_a_string_as_a_parameter
                                                             */
                                                            xmlText = xmlText.replace(match[0], fixedReferencedXmlText.replace(/\$/g, "$$$$"));
                                                            resolveXIInclude(xmlText, base, filename, visitedFiles.slice(0), callback);
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
                                        referencedXMLFilenameWithoutBase,
                                        function (exists) {
                                            if (exists) {
                                                processFile(referencedXMLFilenameWithoutBase);
                                            } else {
                                                inputModel.hasFileName(
                                                    config.InputSource,
                                                    referencedXMLFilenameWithBase,
                                                    function (exists) {
                                                        if (exists) {
                                                            processFile(referencedXMLFilenameWithBase);
                                                        } else {
                                                            //errorCallback("Could not find file", "Could not find file " + referencedXMLFilename, true);
                                                            xmlText = xmlText.replace(match[0], "");
                                                            resolveXIInclude(xmlText, base, filename, visitedFiles.slice(0), callback);
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
                                xmlText = xmlText.replace(match[0], "");
                                resolveXIInclude(xmlText, base, filename, visitedFiles.slice(0), callback);
                            }
                        } else {
                            callback(xmlText, visitedFiles);
                        }

                    }

                    inputModel.getTextFromFileName(
                        config.InputSource,
                        config.MainXMLFile,
                        function (xmlText) {
                            resolveFileRefs(xmlText, config.MainXMLFile, function (xmlText) {
                                function resolveXIIncludeLoop(xmlText, visitedFiles) {
                                    if (generalXiInclude.test(xmlText)) {

                                        var base = getXmlBaseAttribute(xmlText);

                                        resolveXIInclude(
                                            xmlText,
                                            base,
                                            config.MainXMLFile,
                                            visitedFiles,
                                            function (xmlText, visitedFiles) {
                                                resolveXIIncludeLoop(xmlText, visitedFiles);
                                            }
                                        );
                                    } else {
                                        xmlText = xmlText.replace(/xi:includecomment/g, "xi:include");

                                        setProgress(progressIncrement)

                                        config.ResolvedXIIncludes = true;
                                        resultCallback();

                                        replaceEntities(xmlText);
                                    }
                                }

                                var count = 0;
                                resolveXIIncludeLoop(xmlText, [config.MainXMLFile]);
                            });
                        },
                        true
                    );
                }

                function replaceEntities(xmlText) {
                    var fixedXMLResult = qnautils.replaceEntitiesInText(xmlText);
                    config.replacements = fixedXMLResult.replacements;
                    xmlText = fixedXMLResult.xml;

                    setProgress(2 * progressIncrement);
                    config.FoundEntities = true;
                    resultCallback();

                    findEntities(xmlText);
                }

                /*
                 Find any entity definitions in the xml or ent files. Note that older publican books reference invalid
                 entity files, so we just do a brute force search.
                 */
                function findEntities(xmlText) {
                    var entities = [];

                    var relativePath = "";
                    var lastIndexOf;
                    if ((lastIndexOf = config.MainXMLFile.lastIndexOf("/")) !== -1) {
                        relativePath = config.MainXMLFile.substring(0, lastIndexOf);
                    }

                    inputModel.getCachedEntries(config.InputSource, function (entries) {

                        var processTextFile = function (index) {
                            if (index >= entries.length) {
                                setProgress(3 * progressIncrement);
                                config.FoundEntityDefinitions = true;
                                resultCallback();

                                removeXmlPreambleFromBook(xmlText, entities);
                            } else {
                                var value = entries[index];
                                var filename = qnautils.getFileName(value);
                                if (filename.indexOf(relativePath) === 0 && qnautils.isNormalFile(filename)) {
                                    inputModel.getTextFromFile(value, function (fileText) {
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

                                        processTextFile(index + 1);
                                    });
                                } else {
                                    processTextFile(index + 1);
                                }
                            }
                        };

                        processTextFile(0);
                    });
                }

                /*
                 Strip out any XML preabmle that might have been pulled in with the
                 xi:inject resolution. Once this step is done we have plain xml
                 with no entities, dtds or anything else that make life hard when
                 trying to parse XML.
                 */
                function removeXmlPreambleFromBook(xmlText, entities) {
                    xmlText = removeXmlPreamble(xmlText);

                    setProgress(4 * progressIncrement);
                    config.RemovedXMLPreamble = true;
                    resultCallback();

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
                    jquery.each(docbookconstants.IGNORED_CONTAINERS, function (index, value) {
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

                    setProgress(5 * progressIncrement);
                    config.ParsedAsXML = true;
                    resultCallback();

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
                    }

                    setProgress(6 * progressIncrement);
                    config.FoundBookInfo = true;
                    resultCallback();

                    findIndex(xmlDoc);
                }

                function findIndex (xmlDoc) {
                    var index = qnautils.xPath("//docbook:index", xmlDoc).iterateNext();
                    if (index) {
                        config.Index = "On";
                    }

                    resultCallback(true);
                }
            })
            .setShowNext(false)
            .setShowPrevious(false);
    }
)