define(
    ['jquery', 'qna/qna', 'qna/qnautils', 'qna/qnazipmodel', 'qnastart', 'specelement', 'uri/URI', 'exports'],
    function (jquery, qna, qnautils, qnazipmodel, qnastart, specelement, URI, exports) {
        'use strict';

        /*
         A step in the QNA system is a hierarchy of objects.

         The QNAStep represents one entire step in the wizard.
         Each QNAStep holds zero or more QNAVariables. QNAVariables are collections of QNAVariable objects.
         Each QNAVariables holds one or more QNAVariable objects. A QNAVariable is a UI element that the user is expected to supply a value for.

         You will note that each level in the hierarchy and each value for the objects in the hierarchy are calculated
         via callbacks. If each step in the wizard is known, these callbacks can just return static values. If the
         steps require some kind of processing in order to determine the correct values shown to the user, these callbacks
         can perform any kind of async operation (querying a server, reading a file etc) that they need to.
         */

        var REVISION_HISTORY_TAG_ID;
        var AUTHOR_GROUP_TAG_ID ;
        var ABSTRACT_TAG_ID;
        var LEGAL_NOTICE_TAG_ID;
        // docbook elements whose contents have to match exactly
        var VERBATIM_ELEMENTS = ["date", "screen", "programlisting", "literallayout", "synopsis", "address", "computeroutput"];
        // These docbook elements represent containers or topics. Anything else is added as the XML of a topic.
        var CONTAINER_TYPES = ["part", "chapter", "appendix", "section", "preface", "simplesect", "sect1", "sect2", "sect3", "sect4", "sect5"];
        // these docbook elements represent topics
        var TOPIC_CONTAINER_TYPES = ["section", "simplesect", "sect1", "sect2", "sect3", "sect4", "sect5"];
        // these containers are ignored
        var IGNORED_CONTAINERS = ["partintro"];
        // these are entities created by csprocessor
        var IGNORED_ENTITIES = ["BUILD_BZPRODUCT", "BUILD_BZCOMPONENT", "BUILD_BZVERSION", "BUILD_BZKEYWORDS", "BUILD_JIRA_PID", "BUILD_JIRA_CID", "BUILD_JIRA_VID", "BUILD_DATE", "BUILD_NAME", "TITLE", "BZPRODUCT", "BZCOMPONENT", "BZURL", "euro", "cularr", "curarr", "dArr", "darr2", "dharl", "dharr", "dlarr", "drarr", "hArr", "harr", "harrw", "lAarr", "Larr", "larr2", "larrhk", "larrlp", "larrtl", "lhard", "lharu", "lrarr2", "lrhar2", "lsh", "map", "mumap", "nearr", "nhArr", "nharr", "nlArr", "nlarr", "nrArr", "nrarr", "nwarr", "olarr", "orarr", "rAarr", "Rarr", "rarr2", "rarrhk", "rarrlp", "rarrtl", "rarrw", "rhard", "rharu", "rlarr2", "rlhar2", "rsh", "uArr", "uarr2", "uharl", "uharr", "vArr", "varr", "xhArr", "xharr", "xlArr", "xrArr", "amalg", "Barwed", "barwed", "Cap", "coprod", "Cup", "cuvee", "cuwed", "diam", "divonx", "intcal", "lthree", "ltimes", "minusb", "oast", "ocir", "odash", "odot", "ominus", "oplus", "osol", "otimes", "plusb", "plusdo", "prod", "rthree", "rtimes", "sdot", "sdotb", "setmn", "sqcap", "sqcup", "ssetmn", "sstarf", "sum", "timesb", "top", "uplus", "wreath", "xcirc", "xdtri", "xutri", "dlcorn", "drcorn", "lceil", "lfloor", "lpargt", "rceil", "rfloor", "rpargt", "ulcorn", "urcorn", "gnap", "gnE", "gne", "gnsim", "gvnE", "lnap", "lnE", "lne", "lnsim", "lvnE", "nap", "ncong", "nequiv", "ngE", "nge", "nges", "ngt", "nlE", "nle", "nles", "nlt", "nltri", "nltrie", "nmid", "npar", "npr", "npre", "nrtri", "nrtrie", "nsc", "nsce", "nsim", "nsime", "nsmid", "nspar", "nsub", "nsubE", "nsube", "nsup", "nsupE", "nsupe", "nVDash", "nVdash", "nvDash", "nvdash", "prnap", "prnE", "prnsim", "scnap", "scnE", "scnsim", "subnE", "subne", "supnE", "supne", "vsubnE", "vsubne", "vsupnE", "vsupne", "ang", "angmsd", "beth", "bprime", "comp", "daleth", "ell", "empty", "gimel", "inodot", "jnodot", "nexist", "oS", "planck", "real", "sbsol", "vprime", "weierp", "ape", "asymp", "bcong", "bepsi", "bowtie", "bsim", "bsime", "bump", "bumpe", "cire", "colone", "cuepr", "cuesc", "cupre", "dashv", "ecir", "ecolon", "eDot", "efDot", "egs", "els", "erDot", "esdot", "fork", "frown", "gap", "gE", "gEl", "gel", "ges", "Gg", "gl", "gsdot", "gsim", "Gt", "lap", "ldot", "lE", "lEg", "leg", "les", "lg", "Ll", "lsim", "Lt", "ltrie", "mid", "models", "pr", "prap", "pre", "prsim", "rtrie", "samalg", "sc", "scap", "sccue", "sce", "scsim", "sfrown", "smid", "smile", "spar", "sqsub", "sqsube", "sqsup", "sqsupe", "ssmile", "Sub", "subE", "Sup", "supE", "thkap", "thksim", "trie", "twixt", "Vdash", "vDash", "vdash", "veebar", "vltri", "vprop", "vrtri", "Vvdash", "boxDL", "boxDl", "boxdL", "boxdl", "boxDR", "boxDr", "boxdR", "boxdr", "boxH", "boxh", "boxHD", "boxHd", "boxhD", "boxhd", "boxHU", "boxHu", "boxhU", "boxhu", "boxUL", "boxUl", "boxuL", "boxul", "boxUR", "boxUr", "boxuR", "boxur", "boxV", "boxv", "boxVH", "boxVh", "boxvH", "boxvh", "boxVL", "boxVl", "boxvL", "boxvl", "boxVR", "boxVr", "boxvR", "boxvr", "Acy", "acy", "Bcy", "bcy", "CHcy", "chcy", "Dcy", "dcy", "Ecy", "ecy", "Fcy", "fcy", "Gcy", "gcy", "HARDcy", "hardcy", "Icy", "icy", "IEcy", "iecy", "IOcy", "iocy", "Jcy", "jcy", "Kcy", "kcy", "KHcy", "khcy", "Lcy", "lcy", "Mcy", "mcy", "Ncy", "ncy", "numero", "Ocy", "ocy", "Pcy", "pcy", "Rcy", "rcy", "Scy", "scy", "SHCHcy", "shchcy", "SHcy", "shcy", "SOFTcy", "softcy", "Tcy", "tcy", "TScy", "tscy", "Ucy", "ucy", "Vcy", "vcy", "YAcy", "yacy", "Ycy", "ycy", "YUcy", "yucy", "Zcy", "zcy", "ZHcy", "zhcy", "DJcy", "djcy", "DScy", "dscy", "DZcy", "dzcy", "GJcy", "gjcy", "Iukcy", "iukcy", "Jsercy", "jsercy", "Jukcy", "jukcy", "KJcy", "kjcy", "LJcy", "ljcy", "NJcy", "njcy", "TSHcy", "tshcy", "Ubrcy", "ubrcy", "YIcy", "yicy", "acute", "breve", "caron", "cedil", "circ", "dblac", "die", "dot", "grave", "macr", "ogon", "ring", "tilde", "uml", "Agr", "agr", "Bgr", "bgr", "Dgr", "dgr", "EEgr", "eegr", "Egr", "egr", "Ggr", "ggr", "Igr", "igr", "Kgr", "kgr", "KHgr", "khgr", "Lgr", "lgr", "Mgr", "mgr", "Ngr", "ngr", "Ogr", "ogr", "OHgr", "ohgr", "Pgr", "pgr", "PHgr", "phgr", "PSgr", "psgr", "Rgr", "rgr", "sfgr", "Sgr", "sgr", "Tgr", "tgr", "THgr", "thgr", "Ugr", "ugr", "Xgr", "xgr", "Zgr", "zgr", "Aacgr", "aacgr", "Eacgr", "eacgr", "EEacgr", "eeacgr", "Iacgr", "iacgr", "idiagr", "Idigr", "idigr", "Oacgr", "oacgr", "OHacgr", "ohacgr", "Uacgr", "uacgr", "udiagr", "Udigr", "udigr", "alpha", "beta", "chi", "Delta", "delta", "epsi", "epsis", "epsiv", "eta", "Gamma", "gamma", "gammad", "iota", "kappa", "kappav", "Lambda", "lambda", "mu", "nu", "Omega", "omega", "Phi", "phis", "phiv", "Pi", "pi", "piv", "Psi", "psi", "rho", "rhov", "Sigma", "sigma", "sigmav", "tau", "Theta", "thetas", "thetav", "Upsi", "upsi", "Xi", "xi", "zeta", "b.alpha", "b.beta", "b.chi", "b.Delta", "b.delta", "b.epsi", "b.epsiv", "b.eta", "b.Gamma", "b.gamma", "b.Gammad", "b.gammad", "b.iota", "b.kappa", "b.kappav", "b.Lambda", "b.lambda", "b.mu", "b.nu", "b.Omega", "b.omega", "b.Phi", "b.phi", "b.phiv", "b.Pi", "b.pi", "b.piv", "b.Psi", "b.psi", "b.rho", "b.rhov", "b.Sigma", "b.sigma", "b.sigmav", "b.tau", "b.Theta", "b.thetas", "b.thetav", "b.Upsi", "b.upsi", "b.Xi", "b.xi", "b.zeta", "Aacute", "aacute", "Acirc", "acirc", "AElig", "aelig", "Agrave", "agrave", "Aring", "aring", "Atilde", "atilde", "Auml", "auml", "Ccedil", "ccedil", "Eacute", "eacute", "Ecirc", "ecirc", "Egrave", "egrave", "ETH", "eth", "Euml", "euml", "Iacute", "iacute", "Icirc", "icirc", "Igrave", "igrave", "Iuml", "iuml", "Ntilde", "ntilde", "Oacute", "oacute", "Ocirc", "ocirc", "Ograve", "ograve", "Oslash", "oslash", "Otilde", "otilde", "Ouml", "ouml", "szlig", "THORN", "thorn", "Uacute", "uacute", "Ucirc", "ucirc", "Ugrave", "ugrave", "Uuml", "uuml", "Yacute", "yacute", "yuml", "Abreve", "abreve", "Amacr", "amacr", "Aogon", "aogon", "Cacute", "cacute", "Ccaron", "ccaron", "Ccirc", "ccirc", "Cdot", "cdot", "Dcaron", "dcaron", "Dstrok", "dstrok", "Ecaron", "ecaron", "Edot", "edot", "Emacr", "emacr", "ENG", "eng", "Eogon", "eogon", "gacute", "Gbreve", "gbreve", "Gcedil", "Gcirc", "gcirc", "Gdot", "gdot", "Hcirc", "hcirc", "Hstrok", "hstrok", "Idot", "IJlig", "ijlig", "Imacr", "imacr", "Iogon", "iogon", "Itilde", "itilde", "Jcirc", "jcirc", "Kcedil", "kcedil", "kgreen", "Lacute", "lacute", "Lcaron", "lcaron", "Lcedil", "lcedil", "Lmidot", "lmidot", "Lstrok", "lstrok", "Nacute", "nacute", "napos", "Ncaron", "ncaron", "Ncedil", "ncedil", "Odblac", "odblac", "OElig", "oelig", "Omacr", "omacr", "Racute", "racute", "Rcaron", "rcaron", "Rcedil", "rcedil", "Sacute", "sacute", "Scaron", "scaron", "Scedil", "scedil", "Scirc", "scirc", "Tcaron", "tcaron", "Tcedil", "tcedil", "Tstrok", "tstrok", "Ubreve", "ubreve", "Udblac", "udblac", "Umacr", "umacr", "Uogon", "uogon", "Uring", "uring", "Utilde", "utilde", "Wcirc", "wcirc", "Ycirc", "ycirc", "Yuml", "Zacute", "zacute", "Zcaron", "zcaron", "Zdot", "zdot", "amp", "apos", "ast", "brvbar", "bsol", "cent", "colon", "comma", "commat", "copy", "curren", "darr", "deg", "divide", "dollar", "equals", "excl", "frac12", "frac14", "frac18", "frac34", "frac38", "frac58", "frac78", "gt", "half", "horbar", "hyphen", "iexcl", "iquest", "laquo", "larr", "lcub", "ldquo", "lowbar", "lpar", "lsqb", "lsquo", "lt", "micro", "middot", "nbsp", "not", "num", "ohm", "ordf", "ordm", "para", "percnt", "period", "plus", "plusmn", "pound", "quest", "quot", "raquo", "rarr", "rcub", "rdquo", "reg", "rpar", "rsqb", "rsquo", "sect", "semi", "shy", "sol", "sung", "sup1", "sup2", "sup3", "times", "trade", "uarr", "verbar", "yen", "blank", "blk12", "blk14", "blk34", "block", "bull", "caret", "check", "cir", "clubs", "copysr", "cross", "Dagger", "dagger", "dash", "diams", "dlcrop", "drcrop", "dtri", "dtrif", "emsp", "emsp13", "emsp14", "ensp", "female", "ffilig", "fflig", "ffllig", "filig", "flat", "fllig", "frac13", "frac15", "frac16", "frac23", "frac25", "frac35", "frac45", "frac56", "hairsp", "hearts", "hellip", "hybull", "incare", "ldquor", "lhblk", "loz", "lozf", "lsquor", "ltri", "ltrif", "male", "malt", "marker", "mdash", "mldr", "natur", "ndash", "nldr", "numsp", "phone", "puncsp", "rdquor", "rect", "rsquor", "rtri", "rtrif", "rx", "sext", "sharp", "spades", "squ", "squf", "star", "starf", "target", "telrec", "thinsp", "uhblk", "ulcrop", "urcrop", "utri", "utrif", "vellip", "aleph", "and", "ang90", "angsph", "angst", "ap", "becaus", "bernou", "bottom", "cap", "compfn", "cong", "conint", "cup", "Dot", "DotDot", "equiv", "exist", "fnof", "forall", "ge", "hamilt", "iff", "infin", "int", "isin", "lagran", "lang", "lArr", "le", "lowast", "minus", "mnplus", "nabla", "ne", "ni", "notin", "or", "order", "par", "part", "permil", "perp", "phmmat", "Prime", "prime", "prop", "radic", "rang", "rArr", "sim", "sime", "square", "sub", "sube", "sup", "supe", "tdot", "there4", "tprime", "Verbar", "wedgeq"];

        var INJECTION_RE = /^\s*Inject\s*:\s*T?\d+\s*$/;

        var DOCBOOK_50 = "DOCBOOK_50";
        var DOCBOOK_45 = "DOCBOOK_45";
        var DEAFULT_REV_HISTORY_TITLE = "Revision History";
        var DEAFULT_LEGAL_NOTICE_TITLE = "Legal Notice";

        function getIgnoredFiles(lang) {
            // these files are created by csprocessor
            return [lang + "/files/pressgang_website.js"];
        }

        function removeRedundantXmlnsAttribute(xmlString) {
            return xmlString.replace(/(<\s*[A-Za-z0-9]+)\s+(xmlns\s*=\s*("|')http:\/\/docbook.org\/ns\/docbook("|'))(.*?>)/g, "$1$5");
        };

        /*
         See if the xiincludes have some other base dir
         */
        function getXmlBaseAttribute(xmlText) {
            var baseMatch = /xml:base=('|")(.*?)('|")/.exec(xmlText);

            if (baseMatch !== null) {
                var base = baseMatch[2];
                if (base !== "." && base !== "./") {
                    return base;
                }
            }

            return null;
        }

        /*
            Some containers are remaped when placed in a content spec
         */
        function remapContainer(container) {
            if (container === "simplesect") {
                return "section";
            }

            if (container === "sect1") {
                return "section";
            }

            if (container === "sect2") {
                return "section";
            }

            if (container === "sect3") {
                return "section";
            }

            if (container === "sect4") {
                return "section";
            }

            if (container === "sect5") {
                return "section";
            }

            return container;
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

        function loadSetting(file, setting) {
            var retValue;
            var lines = file.split("\n");
            jquery.each(lines, function (index, value) {
                var keyValue = value.split(":");
                if (keyValue.length === 2) {
                    if (new RegExp(qnautils.escapeRegExp(setting.trim())).test(keyValue[0].trim())) {
                        retValue = keyValue[1].trim();
                        return false;
                    }
                }
            });
            return retValue;
        }



        function replaceSpecialChars(text) {
            return text.replace(/"/g, "\\\"")
                .replace(/\t/g, "\\t")
                .replace(/\n/g, "\\n");
        }

        function replaceWhiteSpace(text) {
            text = text.replace(/\n/g, " ");
            text = text.replace(/\s+/g, " ");
            return text;
        }

        function setDocumentNodeToSection (xmlText) {

            var replaceElement = function(elementName, xmlText) {
                if (xmlText.indexOf("<" + elementName) === 0) {
                    xmlText = xmlText.replace(new RegExp("^" + qnautils.escapeRegExp(elementName)), "<" + elementName);
                    xmlText = xmlText.replace(new RegExp("</" + qnautils.escapeRegExp(elementName) + ">$"), "</" + elementName + ">");
                }

                return xmlText;
            };

            xmlText = replaceElement("chapter", xmlText);
            xmlText = replaceElement("appendix", xmlText);
            xmlText = replaceElement("part", xmlText);
            xmlText = replaceElement("sect1", xmlText);
            xmlText = replaceElement("sect2", xmlText);
            xmlText = replaceElement("sect3", xmlText);
            xmlText = replaceElement("sect4", xmlText);
            xmlText = replaceElement("sect5", xmlText);
            xmlText = replaceElement("simplesect", xmlText);

            return xmlText;
        }

        /*
         Ask for a revision message
         */
        exports.askForRevisionMessage = new qna.QNAStep()
            .setTitle("Enter a message for the revision log")
            .setIntro("Each new topic, image and content specification created by this import process will have this revision message in the log.")
            .setInputs([
                new qna.QNAVariables()
                    .setVariables([
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.TEXTBOX)
                            .setIntro("Revision Log Message")
                            .setValue(function (resultCallback, errorCallback, result, config){resultCallback("Imported from " + qnautils.getInputSourceName(config.InputSource));})
                            .setName("RevisionMessage")
                    ])
            ])
            .setNextStep(function (resultCallback, errorCallback, result, config) {
                resultCallback(processZipFile);
            })
            .setShowNext("Start Import");

        /*
         Process the zip file
         */
        var processZipFile = new qna.QNAStep()
            .setTitle("Importing Publican Book")
            .setIntro("The list below allows you to monitor the progress of the import process. Steps with an asterisk (*) can take some time to complete, so please be patient.")
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
                            .setType(qna.InputEnum.CHECKBOX)
                            .setIntro("Finding revision history")
                            .setName("FoundRevisionHistory"),
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.CHECKBOX)
                            .setIntro("Finding author group")
                            .setName("FoundAuthorGroup"),
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.CHECKBOX)
                            .setIntro("Finding legal notice")
                            .setName("FoundLegalNotice"),
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.CHECKBOX)
                            .setIntro("Finding abstract")
                            .setName("FoundAbstract"),
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.CHECKBOX)
                            .setIntro("Finding and uploading files*")
                            .setName("FoundFiles"),
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.CHECKBOX)
                            .setIntro("Finding and uploading images*")
                            .setName("FoundImages"),
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.CHECKBOX)
                            .setIntro("Resolving book structure")
                            .setName("ResolvedBookStructure"),
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.CHECKBOX)
                            .setIntro("Match existing topics*")
                            .setName("MatchedExistingTopics"),
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.CHECKBOX)
                            .setIntro("Resolving xref graphs")
                            .setName("ResolvedXRefGraphs"),
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.CHECKBOX)
                            .setIntro("Uploading Topics*")
                            .setName("UploadedTopics"),
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.CHECKBOX)
                            .setIntro("Fixing xrefs*")
                            .setName("FixXRefs"),
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.CHECKBOX)
                            .setIntro("Updating Content Spec")
                            .setName("UpdatedContentSpec"),
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.CHECKBOX)
                            .setIntro("Uploading content specification")
                            .setName("UploadedContentSpecification"),
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.PLAIN_TEXT)
                            .setIntro("Topics Created / Topics Reused")
                            .setName("NewTopicsCreated"),
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.PLAIN_TEXT)
                            .setIntro("Images Created / Images Reused")
                            .setName("NewImagesCreated"),
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.PLAIN_TEXT)
                            .setIntro("Files Created / Files Reused")
                            .setName("NewFilesCreated"),
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.PROGRESS)
                            .setIntro("Progress")
                            .setName("UploadProgress")
                            // gotta set this first up because of https://github.com/angular-ui/bootstrap/issues/1547
                            .setValue([100, 0])
                    ])
            ])
            .setEnterStep(function (resultCallback, errorCallback, result, config) {

                var inputModel = config.InputType === "Zip" ? qnastart.zipModel : qnastart.dirModel;

                var thisStep = this;

                window.onbeforeunload=function(){
                    return "The import process is in progress. Are you sure you want to quit?";
                };

                /**
                 * A collection of entity definitions
                 * @type {Array}
                 */

                var replacements = [];

                /*
                 Initialize some config values
                 */
                config.UploadedTopicCount = 0;
                config.MatchedTopicCount = 0;
                config.UploadedImageCount = 0;
                config.MatchedImageCount = 0;
                config.UploadedFileCount = 0;
                config.MatchedFileCount = 0;

                /*
                 There are 17 steps, so this is how far to move the progress bar with each
                 step.
                 */
                var progressIncrement = 100 / 20;

                /*
                    Load the tag ids for various tags used during the import
                 */
                function loadTagIDs() {
                    qnastart.loadEntityID(
                        "revisionHistoryTagId",
                        config,
                        function(id) {
                            REVISION_HISTORY_TAG_ID = id;
                            qnastart.loadEntityID(
                                "authorGroupTagId",
                                config,
                                function(id) {
                                    AUTHOR_GROUP_TAG_ID = id;
                                    qnastart.loadEntityID(
                                        "abstractTagId",
                                        config,
                                        function(id) {
                                            ABSTRACT_TAG_ID = id;
                                            qnastart.loadEntityID(
                                                "legalNoticeTagId",
                                                config,
                                                function(id) {
                                                    LEGAL_NOTICE_TAG_ID = id;
                                                    resolveXiIncludes();
                                                },
                                                errorCallback
                                            );
                                        },
                                        errorCallback
                                    );
                                },
                                errorCallback
                            );
                        },
                        errorCallback
                    );
                }

                /*
                 Resolve xi:includes
                 */
                function resolveXiIncludes () {
                    // Note the self closing tag is optional. clearFallbacks will remove those.
                    var generalXiInclude = /<\s*xi:include\s+(.*?)\/?>/;
                    var commonContent = /^Common_Content/;

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
                        var filerefRe=/fileref\s*=\s*('|")(.*?)('|")/g;
                        var filerefReHrefGroup = 2;

                        var replacements = [];

                        var match;
                        while ((match = filerefRe.exec(xmlText)) !== null) {
                            if (!(commonContent.test(match[filerefReHrefGroup]))) {
                                var imageFilename = match[filerefReHrefGroup].replace(/^\.\//, "");
                                var fileref = base === null ?
                                    new URI(imageFilename) :
                                    new URI(base + imageFilename);
                                var absoluteFileRef = fileref.absoluteTo(thisFile).toString();
                                replacements.push({original: imageFilename, replacement: absoluteFileRef});
                            }
                        }

                        var retValue = xmlText;

                        var processImageFileRefs = function(index) {
                            if (index >= replacements.length) {
                                callback(retValue);
                            } else {
                                var value = replacements[index];

                                inputModel.hasFileName(
                                    config.InputSource,
                                    value.replacement,
                                    function(exists) {
                                        if (exists) {
                                            /*
                                             We replace the relative file ref with an absolute path. This is done on the xml each
                                             time a new XML file is included.
                                             */
                                            retValue = retValue.replace(new RegExp("fileref\\s*=\\s*('|\")" + value.original + "('|\")"), "fileref='" + value.replacement + "'");
                                        }

                                        processImageFileRefs(++index);
                                    },
                                    errorCallback,
                                    true
                                );
                            }
                        };

                        processImageFileRefs(0);
                    }

                    function resolveXIInclude (xmlText, base, filename, visitedFiles, callback) {

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
                                if (commonContent.test(href)) {
                                    xmlText = xmlText.replace(match[0], "");
                                    resolveXIInclude(xmlText, base, filename, visitedFiles.slice(0), callback);
                                } else {
                                    /*
                                        We need to work out where the files to be included will come from. This is a
                                        combination of the href, the xml:base attribute, and the location of the
                                        xml file that is doing the importing.
                                     */
                                    var fixedMatch = href.replace(/^\.\//, "");
                                    var thisFile = new URI(filename);
                                    var referencedXMLFilenameRelative = base !== null ?
                                        new URI(base + fixedMatch) :
                                        new URI(fixedMatch);
                                    var referencedXMLFilename = referencedXMLFilenameRelative.absoluteTo(thisFile).toString();

                                    if (visitedFiles.indexOf(referencedXMLFilename) !== -1) {
                                        errorCallback("Circular reference detected", visitedFiles.toString() + "," + referencedXMLFilename, true);
                                        return;
                                    }

                                    inputModel.hasFileName(
                                        config.InputSource,
                                        referencedXMLFilename,
                                        function(exists) {
                                            if (exists) {
                                                inputModel.getTextFromFileName(
                                                    config.InputSource,
                                                    referencedXMLFilename,
                                                    function (referencedXmlText) {
                                                        resolveFileRefs(referencedXmlText, referencedXMLFilename, function(referencedXmlText) {
                                                            resolveXIInclude(
                                                                referencedXmlText,
                                                                getXmlBaseAttribute(referencedXmlText),
                                                                referencedXMLFilename,
                                                                visitedFiles.slice(0),
                                                                function (fixedReferencedXmlText) {
                                                                    if (xpointer !== undefined) {
                                                                        var replacedTextResult = qnautils.replaceEntitiesInText(referencedXmlText);
                                                                        var cleanedReferencedXmlText = removeXmlPreamble(replacedTextResult.xml);
                                                                        var cleanedReferencedXmlDom = qnautils.stringToXML(cleanedReferencedXmlText);

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
                                                        errorCallback("Error reading file", "There was an error readiong the file " + referencedXMLFilename, true);
                                                    },
                                                    true
                                                );
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
                            resolveFileRefs(xmlText, config.MainXMLFile, function(xmlText) {
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

                                        config.UploadProgress[1] = progressIncrement;
                                        thisStep.setTitlePrefixPercentage(config.UploadProgress[1]);

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

                function replaceEntities (xmlText) {
                    var fixedXMLResult = qnautils.replaceEntitiesInText(xmlText);
                    replacements = fixedXMLResult.replacements;
                    xmlText = fixedXMLResult.xml;

                    config.UploadProgress[1] = 2 * progressIncrement;
                    thisStep.setTitlePrefixPercentage(config.UploadProgress[1]);
                    config.FoundEntities = true;
                    resultCallback();

                    findEntities(xmlText);
                }

                /*
                 Find any entity definitions in the xml or ent files. Note that older publican books reference invalid
                 entity files, so we just do a brute force search.
                 */
                function findEntities (xmlText) {
                    var entities = [];

                    var relativePath = "";
                    var lastIndexOf;
                    if ((lastIndexOf = config.MainXMLFile.lastIndexOf("/")) !== -1) {
                        relativePath = config.MainXMLFile.substring(0, lastIndexOf);
                    }

                    inputModel.getCachedEntries(config.InputSource, function (entries) {

                        var processTextFile = function (index) {
                            if (index >= entries.length) {
                                config.UploadProgress[1] = 3 * progressIncrement;
                                thisStep.setTitlePrefixPercentage(config.UploadProgress[1]);
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
                function removeXmlPreambleFromBook (xmlText, entities) {
                    xmlText = removeXmlPreamble(xmlText);

                    config.UploadProgress[1] = 4 * progressIncrement;
                    thisStep.setTitlePrefixPercentage(config.UploadProgress[1]);
                    config.RemovedXMLPreamble = true;
                    resultCallback();

                    fixXML(xmlText, entities);
                }

                /**
                 * Some common errors appear in old books. This function cleans them up
                 * so that the XML can be parsed.
                 */
                function fixXML (xmlText, entities) {
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
                    jquery.each(IGNORED_CONTAINERS, function(index, value) {
                        xmlText = xmlText.replace(new RegExp("<\s*" + qnautils.escapeRegExp(value) + ".*?/?\s*>", "g"), "");
                        xmlText = xmlText.replace(new RegExp("<\s*/\s*" + qnautils.escapeRegExp(value) + "\s*>", "g"), "");;
                    });

                    jquery.each(replacements, function (index, value) {
                        xmlText = xmlText.replace(value.original, value.replacement.replace(/\$/g, "$$$$"));
                    });

                    parseAsXML(xmlText, entities);
                }

                /*
                 Take the sanitised XML and convert it to an actual XML DOM
                 */
                function parseAsXML (xmlText, entities) {
                    var xmlDoc = qnautils.stringToXML(xmlText);

                    if (xmlDoc === null) {
                        console.log(xmlText);
                        throw "xmlText was not valid XML";
                    }

                    config.UploadProgress[1] = 5 * progressIncrement;
                    thisStep.setTitlePrefixPercentage(config.UploadProgress[1]);
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

                var removeIdAttribute = function (xml) {
                    if (xml.hasAttribute("id")) {
                        xml.removeAttribute("id");
                    }
                    return xml;
                };



                /*
                 Find the book info details
                 */
                function findBookInfo (xmlDoc, entities) {

                    var resultObject = JSON.parse(result) || {contentSpec: []};

                    // the content spec
                    var contentSpec = [];

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
                            config.ContentSpecTitle = qnautils.reencode(replaceWhiteSpace(title.innerHTML), replacements);
                        }

                        if (subtitle) {
                            config.ContentSpecSubtitle = qnautils.reencode(replaceWhiteSpace(subtitle.innerHTML), replacements);
                        }

                        if (edition) {
                            config.ContentSpecEdition = qnautils.reencode(replaceWhiteSpace(edition.innerHTML), replacements);
                        }

                        if (pubsnumber) {
                            config.ContentSpecPubsnumber = qnautils.reencode(replaceWhiteSpace(pubsnumber.innerHTML), replacements);
                        }

                        if (productname) {
                            config.ContentSpecProduct = qnautils.reencode(replaceWhiteSpace(productname.innerHTML), replacements);
                        }

                        if (productnumber) {
                            config.ContentSpecVersion = qnautils.reencode(replaceWhiteSpace(productnumber.innerHTML), replacements);
                        }
                    } else {
                        /*
                            If the book being imported does not have the bookinfo or info element, set the
                             required fields manually (assuming they were not set in a previous step of
                             the wizard).
                         */
                        var foundTitle = false;
                        var foundProduct = false;

                        jquery.each(resultObject.contentSpec, function(index, value) {
                            if (value.indexOf("Title") === 0) {
                                foundTitle = true;
                            }

                            if (value.indexOf("Product") === 0) {
                                foundProduct = true;
                            }
                        });

                        if (!foundTitle) {
                            contentSpec.push("Title = Unknown");
                        }

                        if (!foundProduct) {
                            contentSpec.push("Product = Unknown");
                        }
                    }

                    /*
                        These metadata elements are either required or will always have a value
                     */
                    contentSpec.push("Title = " + (config.ContentSpecTitle === undefined ? "Unknown" : config.ContentSpecTitle));
                    contentSpec.push("Product = " + (config.ContentSpecProduct === undefined ? "Unknown" : config.ContentSpecProduct));
                    contentSpec.push("Version = " + (config.ContentSpecVersion === undefined ? "1" : config.ContentSpecVersion));
                    contentSpec.push("Format = DocBook " + (config.ImportOption === "DocBook5" ? "5.0" : "4.5"));

                    /*
                        These metadata elements are optional
                     */
                    if (config.ContentSpecSubtitle !== undefined) {
                        contentSpec.push("Subtitle = " + config.ContentSpecSubtitle);
                    }
                    if (config.ContentSpecEdition !== undefined) {
                        contentSpec.push("Edition = " + config.ContentSpecEdition);
                    }
                    if (config.ContentSpecPubsnumber !== undefined) {
                        contentSpec.push("Pubsnumber = " + config.ContentSpecPubsnumber);
                    }

                    /*
                        If no brand was specified, let csprocessor use the default
                     */
                    if (config.ImportBrand !== undefined) {
                        // this is the value found from the publican.cfg file
                        contentSpec.push("Brand = " + config.ImportBrand);
                    }  else if (config.ContentSpecBrand !== undefined) {
                        // this is the value specified in the ui
                        contentSpec.push("Brand = " + config.ContentSpecBrand);
                    }

                    if (xmlDoc.documentElement.nodeName === "book") {
                        if (xmlDoc.documentElement.hasAttribute("status") && xmlDoc.documentElement.attributes["status"].nodeValue.trim() === "draft") {
                            contentSpec.push("Type = Book-Draft");
                        } else {
                            contentSpec.push("Type = Book");
                        }

                    } else if (xmlDoc.documentElement.nodeName === "article") {
                        if (xmlDoc.documentElement.hasAttribute("status") && xmlDoc.documentElement.attributes["status"].nodeValue.trim() === "draft") {
                            contentSpec.push("Type = Article-Draft");
                        } else {
                            contentSpec.push("Type = Article");
                        }
                    }

                    /*
                        Add the contents of the supplied content spec. This will usually be just
                        the publican.cfg file.
                     */
                    contentSpec = contentSpec.concat(resultObject.contentSpec);

                    if (config.ImportCondition !== undefined) {
                        contentSpec.push("[condition = " + config.ImportCondition + "]");
                    }

                    /*
                        Some entities need to be converted to metadata elements
                     */
                    var removedEntities = [];
                    var copyrightYear = null;
                    var copyrightHolder = null;
                    jquery.each(entities, function(index, value){
                        var entityMatch;
                        if ((entityMatch = /<!ENTITY\s+HOLDER\s+('|")(.*?)('|")>/.exec(value)) !== null) {
                            removedEntities.push(index);
                            // save the first one
                            if (!copyrightHolder) {
                                copyrightHolder = "Copyright Holder = " + entityMatch[2];
                            }
                        }

                        if ((entityMatch = /<!ENTITY\s+YEAR\s+('|")(.*?)('|")>/.exec(value)) !== null) {
                            removedEntities.push(index);
                            // save the first one
                            if (!copyrightYear) {
                                copyrightYear = "Copyright Year = " + entityMatch[2];
                            }
                        }
                    });

                    if (!copyrightHolder) {
                        contentSpec.push("Copyright Holder = Red Hat");
                    } else {
                        contentSpec.push(copyrightHolder);
                    }

                    if (copyrightYear) {
                        contentSpec.push(copyrightYear);
                    }

                    // save the remaining entities
                    if (entities.length !== 0) {
                        contentSpec.push("Entities = [");
                        jquery.each(entities, function(index, value){
                            if (removedEntities.indexOf(index) === -1) {
                                contentSpec.push(value);
                            }
                        });

                        contentSpec.push("]");
                    }

                    config.UploadProgress[1] = 6 * progressIncrement;
                    thisStep.setTitlePrefixPercentage(config.UploadProgress[1]);
                    config.FoundBookInfo = true;
                    resultCallback();

                    findIndex(xmlDoc, contentSpec);
                }

                function findIndex (xmlDoc, contentSpec) {
                    var index = qnautils.xPath("//docbook:index", xmlDoc).iterateNext();
                    if (index) {
                        contentSpec.push("Index = On");
                    }
                    extractRevisionHistory(xmlDoc, contentSpec);
                }

                function extractRevisionHistory (xmlDoc, contentSpec, topics, topicGraph) {
                    if (topics === undefined) {
                        topics = [];
                    }

                    // the graph that holds the topics
                    if (topicGraph === undefined) {
                        topicGraph = new specelement.TopicGraph();
                    }

                    var revHistory = qnautils.xPath("//docbook:revhistory", xmlDoc).iterateNext();

                    if (revHistory) {

                        var parentAppendix = revHistory;
                        while (parentAppendix.parentNode && (parentAppendix = parentAppendix.parentNode).nodeName !== "appendix") {

                        }

                        var revHistoryTitleContents;
                        var revHistoryTitle = qnautils.xPath("./docbook:title", parentAppendix).iterateNext();
                        if (revHistoryTitle !== null) {
                            var match = /<title\s*.*?>(.*?)<\/title>/.exec(qnautils.xmlToString(revHistoryTitle));
                            if (match !== null) {
                                revHistoryTitleContents = match[1];
                            } else {
                                revHistoryTitleContents = DEAFULT_REV_HISTORY_TITLE;
                            }
                        } else {
                            revHistoryTitleContents = DEAFULT_REV_HISTORY_TITLE;
                        }

                        var replacementNodeDetails = [];

                        // fix any dates. right now we just trim strings, but this could be
                        // a good opportunity to fix common date formats
                        var dates = qnautils.xPath(".//docbook:date", revHistory);
                        var date;

                        while ((date = dates.iterateNext()) !== null) {
                            var dateContents = date.textContent;
                            replacementNodeDetails.push({original: date, replacement: dateContents.trim()});
                        }

                        // fix rev numbers
                        var revnumbers = qnautils.xPath(".//docbook:revnumber", revHistory);
                        var revnumber;
                        while ((revnumber = revnumbers.iterateNext()) !== null) {
                            var revContents = revnumber.textContent;
                            var revMatch = /^(\d+)\.(\d+)$/.exec(revContents.trim());
                            if (revMatch !== null) {
                                replacementNodeDetails.push({original: revnumber, replacement: revContents.replace(/\./g, "-")});
                            }
                        }

                        jquery.each(replacementNodeDetails, function(index, value){
                            value.original.textContent = value.replacement;
                        });

                        contentSpec.push("Revision History = ");

                        var id = parentAppendix.getAttribute ? parentAppendix.getAttribute("id") : null;

                        var revHistoryXML = "<appendix><title>" + revHistoryTitleContents + "</title>";

                        if (config.ImportOption === "DocBook45") {
                            revHistoryXML += "<simpara>";
                        }

                        revHistoryXML += qnautils.xmlToString(removeIdAttribute(revHistory));

                        if (config.ImportOption === "DocBook45") {
                            revHistoryXML += "</simpara>";
                        }

                        revHistoryXML += "</appendix>";

                        var revHistoryFixedXML = qnautils.stringToXML(revHistoryXML);

                        var topic = new specelement.TopicGraphNode(topicGraph)
                            .setXml(revHistoryFixedXML)
                            .setSpecLine(contentSpec.length - 1)
                            .setTitle(revHistoryTitleContents)
                            .addTag(REVISION_HISTORY_TAG_ID);

                        if (id) {
                            topic.addXmlId(id);
                        }

                        topics.push(topic);

                    }

                    config.UploadProgress[1] = 7 * progressIncrement;
                    thisStep.setTitlePrefixPercentage(config.UploadProgress[1]);
                    config.FoundRevisionHistory = true;
                    resultCallback();
                    extractAuthorGroup(xmlDoc, contentSpec, topics, topicGraph);
                }

                function extractAuthorGroup (xmlDoc, contentSpec, topics, topicGraph) {
                    if (topics === undefined) {
                        topics = [];
                    }

                    // the graph that holds the topics
                    if (topicGraph === undefined) {
                        topicGraph = new specelement.TopicGraph();
                    }

                    var specAuthorGroup = qnautils.stringToXML("<authorgroup></authorgroup>");
                    var authorGroups = qnautils.xPath("//docbook:authorgroup", xmlDoc);
                    var authorGroupIds = [];
                    var authorGroup;
                    while ((authorGroup = authorGroups.iterateNext()) !== null) {

                        var id = authorGroup.getAttribute("id");
                        if (id !== null) {
                            authorGroupIds.push(id);
                        }

                        jquery.each(authorGroup.childNodes, function (index, value) {
                            specAuthorGroup.documentElement.appendChild(qnautils.getOwnerDoc(specAuthorGroup).importNode(value, true));
                        });
                    }

                    if (specAuthorGroup.documentElement.childNodes.length !== 0) {
                        contentSpec.push("Author Group = ");

                        var topic = new specelement.TopicGraphNode(topicGraph)
                            .setXml(removeIdAttribute(specAuthorGroup.documentElement))
                            .setSpecLine(contentSpec.length - 1)
                            .setTitle("Author Group")
                            .addTag(AUTHOR_GROUP_TAG_ID);

                        jquery.each(authorGroupIds, function (index, value) {
                            topic.addXmlId(value);
                        });

                        topics.push(topic);
                    }

                    config.UploadProgress[1] = 8 * progressIncrement;
                    thisStep.setTitlePrefixPercentage(config.UploadProgress[1]);
                    config.FoundAuthorGroup = true;
                    resultCallback();

                    extractLegalNotice(xmlDoc, contentSpec, topics, topicGraph);
                }

                function extractLegalNotice (xmlDoc, contentSpec, topics, topicGraph) {
                    if (topics === undefined) {
                        topics = [];
                    }

                    // the graph that holds the topics
                    if (topicGraph === undefined) {
                        topicGraph = new specelement.TopicGraph();
                    }

                    var legalNotice = qnautils.xPath("//docbook:legalnotice", xmlDoc).iterateNext();

                    if (legalNotice) {

                        var legalNoticeTitleContents;
                        var legalNoticeTitle = qnautils.xPath("./docbook:title", legalNotice).iterateNext();
                        if (legalNoticeTitle !== null) {
                            var match = /<title\s*.*?>(.*?)<\/title>/.exec(qnautils.xmlToString(legalNoticeTitle));
                            if (match !== null) {
                                legalNoticeTitleContents = match[1];
                            } else {
                                legalNoticeTitleContents = DEAFULT_LEGAL_NOTICE_TITLE;
                            }
                        } else {
                            legalNoticeTitleContents = DEAFULT_LEGAL_NOTICE_TITLE;
                        }

                        contentSpec.push("Legal Notice = ");

                        var id = legalNotice.getAttribute("id");

                        var topic = new specelement.TopicGraphNode(topicGraph)
                            .setXml(removeIdAttribute(legalNotice))
                            .setSpecLine(contentSpec.length - 1)
                            .setTitle(legalNoticeTitleContents)
                            .addTag(LEGAL_NOTICE_TAG_ID);

                        if (id) {
                            topic.addXmlId(id);
                        }

                        topics.push(topic);
                    }

                    config.UploadProgress[1] = 9 * progressIncrement;
                    thisStep.setTitlePrefixPercentage(config.UploadProgress[1]);
                    config.FoundLegalNotice = true;
                    resultCallback();

                    extractAbstract(xmlDoc, contentSpec, topics, topicGraph);
                }

                function extractAbstract (xmlDoc, contentSpec, topics, topicGraph) {
                    if (topics === undefined) {
                        topics = [];
                    }

                    // the graph that holds the topics
                    if (topicGraph === undefined) {
                        topicGraph = new specelement.TopicGraph();
                    }

                    var abstractContent = qnautils.xPath("//docbook:bookinfo/docbook:abstract", xmlDoc).iterateNext();

                    if (abstractContent === null) {
                        abstractContent = qnautils.xPath("//docbook:articleinfo/docbook:abstract", xmlDoc).iterateNext();
                    }

                    if (abstractContent) {
                        contentSpec.push("Abstract = ");

                        var id = abstractContent.getAttribute("id");

                        var topic = new specelement.TopicGraphNode(topicGraph)
                            .setXml(removeIdAttribute(abstractContent))
                            .setSpecLine(contentSpec.length - 1)
                            .setTitle("Abstract")
                            .addTag(ABSTRACT_TAG_ID);

                        if (id) {
                            topic.addXmlId(id);
                        }

                        topics.push(topic);
                    }

                    config.UploadProgress[1] = 10 * progressIncrement;
                    thisStep.setTitlePrefixPercentage(config.UploadProgress[1]);
                    config.FoundAbstract = true;
                    resultCallback();

                    uploadFiles(xmlDoc, contentSpec, topics, topicGraph);
                }

                /*
                    Publican books can contain a files directory. Every file in this directory
                    needs to be uploaded
                 */
                function uploadFiles (xmlDoc, contentSpec, topics, topicGraph) {
                    var fileIds = [];

                    inputModel.getCachedEntries(
                        config.InputSource,
                        function(entries) {
                            var processEntry = function(index) {
                                if (index >= entries.length) {

                                    if (fileIds.length !== 0) {
                                        contentSpec.push("Files = [" + fileIds.toString() + "]");
                                    }

                                    config.UploadProgress[1] = 11 * progressIncrement;
                                    thisStep.setTitlePrefixPercentage(config.UploadProgress[1]);
                                    config.FoundFiles = true;
                                    resultCallback();

                                    uploadImages (xmlDoc, contentSpec, topics, topicGraph);
                                } else {
                                    var entry = entries[index];
                                    var filename = qnautils.getFileName(entry);
                                    if (new RegExp("^" + qnautils.escapeRegExp(config.ImportLang) + "/files/.+").test(filename) &&
                                        qnautils.isNormalFile(filename) &&
                                        getIgnoredFiles(config.ImportLang).indexOf(filename) === -1) {
                                        qnastart.createFile(
                                            inputModel,
                                            config.CreateOrResuseFiles === "REUSE",
                                            config.InputSource,
                                            qnautils.getFileName(entry),
                                            config.ImportLang,
                                            config,
                                            function (data) {
                                                var fileId = config.CreateOrResuseFiles === "REUSE" ? data.file.id : data.id;
                                                fileIds.push(fileId);

                                                config.UploadedFileCount += 1;

                                                if (config.CreateOrResuseImages === "REUSE" && data.matchedExistingFile) {
                                                    config.MatchedFileCount += 1;
                                                }

                                                config.NewFilesCreated = (config.UploadedFileCount - config.MatchedFileCount) + " / " + config.MatchedFileCount;
                                                resultCallback();

                                                config.UploadProgress[1] = (10 * progressIncrement) + (index / entries.length * progressIncrement);
                                                thisStep.setTitlePrefixPercentage(config.UploadProgress[1]);
                                                resultCallback();

                                                processEntry(++index);
                                            },
                                            errorCallback
                                        );
                                    } else {
                                        processEntry(++index);
                                    }
                                }
                            };

                            processEntry(0);
                        },
                    errorCallback);
                }

                function uploadImages (xmlDoc, contentSpec, topics, topicGraph) {
                    // count the number of images we are uploading
                    var images = qnautils.xPath("//@fileref", xmlDoc);
                    var numImages = 0;

                    var image;
                    while ((image = images.iterateNext()) !== null) {
                        ++numImages;
                    }

                    images = qnautils.xPath("//@fileref", xmlDoc);
                    var uploadedImages = {};

                    var processImages = function (image, count) {
                        if (image) {

                            var nodeValue = image.nodeValue;

                            if (!uploadedImages[nodeValue]) {

                                inputModel.hasFileName(
                                    config.InputSource,
                                    nodeValue,
                                    function (result) {
                                        if (result) {
                                            qnastart.createImage(
                                                inputModel,
                                                config.CreateOrResuseImages === "REUSE",
                                                config.InputSource,
                                                nodeValue,
                                                config.ImportLang,
                                                config,
                                                function (data) {
                                                    var imageId = config.CreateOrResuseImages === "REUSE" ? data.image.id : data.id;

                                                    config.UploadedImageCount += 1;

                                                    if (config.CreateOrResuseImages === "REUSE" && data.matchedExistingImage) {
                                                        config.MatchedImageCount += 1;
                                                    }

                                                    config.NewImagesCreated = (config.UploadedImageCount - config.MatchedImageCount) + " / " + config.MatchedImageCount;
                                                    resultCallback();

                                                    uploadedImages[nodeValue] = imageId + nodeValue.substr(nodeValue.lastIndexOf("."));

                                                    ++count;

                                                    config.UploadProgress[1] = (11 * progressIncrement) + (count / numImages * progressIncrement);
                                                    thisStep.setTitlePrefixPercentage(config.UploadProgress[1]);
                                                    resultCallback();

                                                    processImages(images.iterateNext(), count);
                                                },
                                                errorCallback
                                            );
                                        } else {
                                            console.log("Could not find " + nodeValue);
                                            processImages(images.iterateNext(), ++count);
                                        }
                                    },
                                    errorCallback,
                                    true
                                );
                            }  else {
                                processImages(images.iterateNext(), ++count);
                            }
                        } else {
                            var filerefs = qnautils.xPath("//@fileref", xmlDoc);
                            var updatedRefs = [];
                            var fileref;
                            while ((fileref = filerefs.iterateNext()) !== null) {
                                if (uploadedImages[fileref.nodeValue]) {
                                    updatedRefs.push({node: fileref, newImageRef: "images/" + uploadedImages[fileref.nodeValue]});
                                }
                            }

                            jquery.each(updatedRefs, function(index, value){
                                value.node.nodeValue = value.newImageRef;
                            });

                            config.UploadProgress[1] = 12 * progressIncrement;
                            thisStep.setTitlePrefixPercentage(config.UploadProgress[1]);
                            config.FoundImages = true;
                            resultCallback();

                            resolveBookStructure(xmlDoc, contentSpec, topics, topicGraph);
                        }
                    };

                    processImages(images.iterateNext(), 0);
                }

                function resolveBookStructure (xmlDoc, contentSpec, topics, topicGraph) {
                    // so we can work back to the original source
                    contentSpec.push("# Imported from " + qnautils.getInputSourceName(config.InputSource));

                    var containerTargetNum = 0;

                    /*
                     Some books will assign an id to the title element of a topic. This import tool
                     redirects these links to the topic itself. But to compare the XML to an existing
                     topic, we need to remove the title id attribute.
                     */
                    function removeTitleAttributes(xml) {
                        var title =  qnautils.xPath("./docbook:title", xml).iterateNext();
                        if (title !== null) {
                            removeAttributes(title);
                        }
                    }


                    function removeAttributes(xml) {
                        while (xml.attributes.length !== 0) {
                            xml.removeAttribute(xml.attributes[0].nodeName);
                        }
                    }

                    var processXml = function (parentXML, depth) {
                        // loop over the containers under the root element
                        jquery.each(parentXML.childNodes, function (index, value) {
                            if (CONTAINER_TYPES.indexOf(value.nodeName) !== -1) {
                                // take a copy of this container
                                var clone = value.cloneNode(true);

                                // find the title
                                var title = qnautils.xPath("./docbook:title", clone).iterateNext();
                                var titleText = "";
                                if (title) {
                                    titleText = qnautils.reencode(replaceWhiteSpace(title.innerHTML), replacements).trim();

                                    // remove any redundant namespace attributes
                                    titleText = removeRedundantXmlnsAttribute(titleText);

                                    /*
                                        Title is mandatory
                                     */
                                    if (titleText.length === 0) {
                                        titleText = "Untitled";
                                    }
                                } else {
                                    titleText = "Untitled";
                                }

                                // sync the title back to the xml
                                var titleXML = "<title>" + titleText + "</title>";
                                var titleXMLDocument = qnautils.stringToXML(titleXML);
                                var importedTitle =  qnautils.getOwnerDoc(clone).importNode(titleXMLDocument.documentElement);
                                if (title) {
                                    clone.replaceChild(importedTitle, title);
                                } else if (clone.childNodes.length === 0) {
                                    clone.appendChild(importedTitle);
                                } else {
                                    clone.insertBefore(importedTitle, clone.childNodes[0]);
                                }

                                // strip away any child containers
                                var removeChildren = [];
                                jquery.each(clone.childNodes, function (index, containerChild) {
                                    if (CONTAINER_TYPES.indexOf(containerChild.nodeName) !== -1) {
                                        removeChildren.push(containerChild);
                                    }
                                });
                                jquery.each(removeChildren, function (index, containerChild) {
                                    clone.removeChild(containerChild);
                                });

                                // the id attribute assigned to this container
                                var id = qnautils.xPath("./@id", clone).iterateNext();
                                if (id === null) {
                                    // the docbook 5 version of the id attribute
                                    id = qnautils.xPath("./@xml:id", clone).iterateNext();
                                }

                                // some books have ids in the title. these are not supported, so xrefs to titles
                                // are redirected to the parent element
                                if (title !== null) {
                                    var titleId = qnautils.xPath("./@id", title).iterateNext();
                                    if (titleId === null) {
                                        // the docbook 5 version of the id attribute
                                        titleId = qnautils.xPath("./@xml:id", title).iterateNext();
                                    }
                                }

                                /*
                                 Some books will assign additional attributes to container elements like arch="".
                                 We need to remove these.
                                 */
                                removeAttributes(clone);
                                removeTitleAttributes(clone);

                                // what we have left is the contents of a initial text topic
                                var contentSpecLine = "";
                                for (var i = 0; i < depth * 2; ++i) {
                                    contentSpecLine += " ";
                                }

                                // if there were no child container elements to be removed, it
                                // means this element stands alone. It is either a topic,
                                // or a container that has only initial text
                                if (removeChildren.length === 0) {

                                    var isHistoryTopicAppendix = false;
                                    if (clone.nodeName === "appendix") {
                                        var clone2 = clone.cloneNode(true);
                                        var removeNodes = [];

                                        var titles = qnautils.xPath("./docbook:title", clone2);

                                        var titleNode;
                                        while ((titleNode = titles.iterateNext()) !== null) {
                                            removeNodes.push(titleNode);
                                        }

                                        var revHistoryNodes = qnautils.xPath(".//docbook:revhistory", clone2);

                                        var revHistoryNode;
                                        while ((revHistoryNode = revHistoryNodes.iterateNext()) !== null) {
                                            removeNodes.push(revHistoryNode);
                                        }

                                        jquery.each(removeNodes, function (index, value){
                                            value.parentNode.removeChild(value);
                                        });

                                        /*
                                         Once we take out the title and revhistory, is there any content left?
                                         */
                                        isHistoryTopicAppendix = clone2.textContent.trim().length === 0;
                                    }

                                    var isEmptyPrefaceTopic = false;
                                    if (clone.nodeName === "preface") {
                                        var clone2 = clone.cloneNode(true);
                                        var removeNodes = [];

                                        var titles = qnautils.xPath("./docbook:title", clone2);

                                        var titleNode;
                                        while ((titleNode = titles.iterateNext()) !== null) {
                                            removeNodes.push(titleNode);
                                        }

                                        jquery.each(removeNodes, function (index, value){
                                            value.parentNode.removeChild(value);
                                        });

                                        /*
                                         Once we take out the title, is there any content left?
                                         */
                                        isEmptyPrefaceTopic = clone2.textContent.trim().length === 0;
                                    }

                                    if (!isHistoryTopicAppendix && !isEmptyPrefaceTopic) {

                                        if (TOPIC_CONTAINER_TYPES.indexOf(value.nodeName) !== -1) {
                                            contentSpec.push(contentSpecLine + titleText);
                                        } else {
                                            var containerName = remapContainer(value.nodeName);
                                            contentSpec.push(
                                                contentSpecLine +
                                                    containerName.substring(0, 1).toUpperCase() +
                                                    containerName.substring(1, containerName.length) +
                                                    ": " + titleText);
                                        }

                                        var standaloneContainerTopic = new specelement.TopicGraphNode(topicGraph)
                                            .setXml(removeIdAttribute(clone))
                                            .setSpecLine(contentSpec.length - 1)
                                            .setTitle(titleText);

                                        if (id) {

                                            if (topicGraph.hasXMLId(id.nodeValue)) {
                                                throw "The XML id attribute " + id.nodeValue + " has been duplicated. The source book is not valid";
                                            }

                                            standaloneContainerTopic.addXmlId(id.nodeValue);
                                        }

                                        if (titleId) {

                                            if (topicGraph.hasXMLId(titleId.nodeValue)) {
                                                throw "The XML id attribute " + titleId.nodeValue + " has been duplicated. The source book is not valid";
                                            }

                                            standaloneContainerTopic.addXmlId(titleId.nodeValue);
                                        }

                                        topics.push(standaloneContainerTopic);
                                    }
                                } else {
                                    var containerName = remapContainer(value.nodeName);
                                    contentSpec.push(
                                        contentSpecLine +
                                            containerName.substring(0, 1).toUpperCase() +
                                            containerName.substring(1, containerName.length) +
                                            ": " + titleText);

                                    if (id) {
                                        ++containerTargetNum;
                                        contentSpec[contentSpec.length - 1] += " [T" + containerTargetNum + "]";
                                    }

                                    var hasIntroText = false;
                                    if (clone.childNodes.length !== 0) {
                                        var containerClone = clone.cloneNode(true);
                                        var containerRemoveNodes = [];

                                        var containerTitles = qnautils.xPath("./docbook:title", containerClone);

                                        var containerTitleNode;
                                        while ((containerTitleNode = containerTitles.iterateNext()) !== null) {
                                            containerRemoveNodes.push(containerTitleNode);
                                        }

                                        var containerRevHistoryNodes = qnautils.xPath(".//docbook:revhistory", containerClone);

                                        var containerRevHistoryNode;
                                        while ((containerRevHistoryNode = containerRevHistoryNodes.iterateNext()) !== null) {
                                            containerRemoveNodes.push(containerRevHistoryNode);
                                        }

                                        jquery.each(containerRemoveNodes, function (index, value){
                                            value.parentNode.removeChild(value);
                                        });

                                        /*
                                         Once we take out the title and revhistory, is there any content left?
                                         */
                                        hasIntroText = containerClone.textContent.trim().length !== 0;
                                    }

                                    /*
                                     If this container has front matter content, create a topic to represent it
                                     */
                                    if (hasIntroText) {

                                        /*
                                            We want any content under partintro to be just content in the
                                            initial text topic.
                                         */
                                        if (/^part$/i.test(containerName)) {
                                            var partintro = qnautils.xPath(".//docbook:partintro", clone).iterateNext();
                                            if (partintro !== null) {
                                                while (partintro.childNodes.length !== 0) {
                                                    clone.insertBefore(partintro.childNodes[0], partintro);
                                                }

                                                clone.removeChild(partintro);
                                            }
                                        }

                                        var initialTextTopic = new specelement.TopicGraphNode(topicGraph)
                                            .setXml(removeIdAttribute(clone))
                                            .setSpecLine(contentSpec.length - 1)
                                            .setTitle(titleText);

                                        if (id) {
                                            if (topicGraph.hasXMLId(id.nodeValue)) {
                                                throw "The XML id attribute " + id.nodeValue + " has been duplicated. The source book is not valid";
                                            }

                                            initialTextTopic.addXmlId(id.nodeValue);
                                        }

                                        if (titleId) {

                                            if (topicGraph.hasXMLId(titleId.nodeValue)) {
                                                throw "The XML id attribute " + titleId.nodeValue + " has been duplicated. The source book is not valid";
                                            }

                                            initialTextTopic.addXmlId(titleId.nodeValue);
                                        }

                                        topics.push(initialTextTopic);
                                    } else {
                                        var container = new specelement.TopicGraphContainer(topicGraph)
                                            .setSpecLine(contentSpec.length - 1)
                                            .setContainerTargetNum(containerTargetNum);

                                        if (id) {
                                            if (topicGraph.hasXMLId(id.nodeValue)) {
                                                throw "The XML id attribute " + id.nodeValue + " has been duplicated. The source book is not valid";
                                            }

                                            container.addXmlId(id.nodeValue);
                                        }

                                        if (titleId) {

                                            if (topicGraph.hasXMLId(titleId.nodeValue)) {
                                                throw "The XML id attribute " + titleId.nodeValue + " has been duplicated. The source book is not valid";
                                            }

                                            container.addXmlId(titleId.nodeValue);
                                        }
                                    }

                                    processXml(value, depth + 1);
                                }
                            }
                        });
                    };

                    processXml(xmlDoc.documentElement, 0);

                    config.UploadProgress[1] = 13 * progressIncrement;
                    thisStep.setTitlePrefixPercentage(config.UploadProgress[1]);
                    config.ResolvedBookStructure = true;
                    resultCallback();

                    matchExistingTopics(xmlDoc, contentSpec, topics, topicGraph);
                }

                /*
                 Resolve the topics either to existing topics in the database, or to new topics
                 */
                function matchExistingTopics (xmlDoc, contentSpec, topics, topicGraph) {
                    /*
                        Remove any non-injection comments
                     */
                    function normalizeComments(xml) {
                        var comments = qnautils.xPath("//docbook:comment()", xml);
                        var commentsCollection = [];
                        var comment;
                        while ((comment = comments.iterateNext()) !== null) {
                            if (!/^Inject[A-Za-z]*\s*:\s*T?\d+/.test(comment.nodeValue.trim())) {
                                commentsCollection.push(comment);
                            }
                        }

                        jquery.each(commentsCollection, function (index, value) {
                            value.parentNode.removeChild(value);
                        });

                        return xml;
                    }

                    /*
                     Take every xref that points to a topic (and not just a place in a topic), and replace it
                     with a injection placeholder. This is done on topics to be imported.
                     */
                    function normalizeXrefs (xml, topicAndContainerIDs) {
                        jquery.each(['xref', 'link'], function(index, linkElement) {
                            var xrefs = qnautils.xPath("//docbook:" + linkElement, xml);
                            var xref;
                            var xrefReplacements = [];
                            while ((xref = xrefs.iterateNext()) !== null) {
                                if (xref.hasAttribute("linkend")) {
                                    var linkend = xref.getAttribute("linkend");
                                    if (topicAndContainerIDs.indexOf(linkend) !== -1) {
                                        var xrefReplacement = xmlDoc.createComment("InjectPlaceholder: 0");
                                        var replacement = {original: xref, replacement: [xrefReplacement]};
                                        xrefReplacements.push(replacement);
                                    }
                                }
                            }

                            jquery.each(xrefReplacements, function (index, value) {
                                for (var replacementIndex = 0; replacementIndex < value.replacement.length; ++replacementIndex) {
                                    if (replacementIndex === value.replacement.length - 1) {
                                        value.original.parentNode.replaceChild(value.replacement[replacementIndex], value.original);
                                    } else {
                                        value.original.parentNode.insertBefore(value.replacement[replacementIndex], value.original);
                                    }
                                }
                            });
                        });

                        return xml;
                    }

                    /*
                     Take every injection and replace it with a placeholder. This is done on existing topics
                     from PressGang.
                     */
                    function normalizeInjections (xml) {
                        var comments = qnautils.xPath("//comment()", xml);
                        var comment;
                        var commentReplacements = [];
                        while ((comment = comments.iterateNext()) !== null) {
                            if (INJECTION_RE.test(comment.textContent)) {
                                var commentReplacement = xmlDoc.createComment("InjectPlaceholder: 0");
                                commentReplacements.push({original: comment, replacement: commentReplacement});
                            }
                        }

                        jquery.each(commentReplacements, function (index, value) {
                            value.original.parentNode.replaceChild(value.replacement, value.original);
                        });

                        return xml;
                    }

                    /*
                        This function takes the xml and strips out ignored whitespace. This allows us to compare
                        two xml documents that may have been formatted differently.

                        This is a bit of a hack. Technically, all white space is significant unless otherwise
                        specified by the DTD. We assume here that all whitespace is insignificant.

                        This will cause issues if a topic already exists in the database that has only whitespace
                        changes.

                        To fix this we run a second check against the content of any elements where whitespace is
                        significant.
                     */
                    function removeWhiteSpace(xml) {
                        xml = xml.replace(/\n/gm, " ");                     // replace all existing line breaks
                        xml = xml.replace(/\t/gm, " ");                     // replace all existing tabs
                        xml = xml.replace(/>/gm, ">\n");                    // break after a the end of an element
                        xml = xml.replace(/</gm, "\n<");                    // break before the start of an element
                        xml = xml.replace(/^\s+/gm, "");                  // remove leading whitespace
                        xml = xml.replace(/\s+$/gm, "");                  // remove trailing whitespace
                        xml = xml.replace(/(\S+)([ ]{2,})/gm, "$1 ");       // remove double spaces within text
                        return xml;
                    }


                    /*
                     The order of the attributes is changed by PressGang, so before we do a comparison
                     we order any attributes in any node.
                     */
                    function reorderAttributes(xml) {

                        if (xml.attributes !== undefined) {
                            var attributes = {};
                            jquery.each(xml.attributes, function(index, attr) {
                                attributes[attr.name] = attr.value;
                            });

                            while (xml.attributes.length !== 0) {
                                xml.removeAttribute(xml.attributes[0].name);
                            }

                            var attributeKeys = qnautils.keys(attributes);

                            jquery.each(attributeKeys, function (index, attrName) {
                                /*
                                 Don't add some common attributes. These are either added
                                 by csprocessor when it build a book, by the xml
                                 serialization process, or are not considered important
                                 when comparing XML files for equality.
                                 */
                                if (attrName.indexOf("xmlns") !== 0 &&
                                    attrName.indexOf("version") !== 0 &&
                                    attrName.indexOf("remap") !== 0 ) {
                                    xml.setAttribute(attrName, attributes[attrName]);
                                }
                            });
                        }

                        var allElements = qnautils.xPath(".//docbook:*", xml);
                        var elements = [];
                        var elementIter;
                        while ((elementIter = allElements.iterateNext()) !== null) {
                            elements.push(elementIter);
                        }

                        jquery.each(elements, function (index, element) {
                            reorderAttributes(element);
                        });
                    }

                    var topicOrContainerIDs = topicGraph.getAllTopicOrContainerIDs();

                    /*
                     Step 1: find any potential matches already in the PressGang server
                     */
                    function getPossibleMatches(index, callback) {
                        if (index >= topics.length) {
                            callback();
                        } else {
                            config.UploadProgress[1] = (14 * progressIncrement) + (index / topics.length * progressIncrement);
                            thisStep.setTitlePrefixPercentage(config.UploadProgress[1]);
                            resultCallback();

                            var topic = topics[index];
                            qnastart.getSimilarTopics(
                                qnautils.reencode(qnautils.xmlToString(topic.xml), replacements),
                                config,
                                function (data) {
                                    var format = config.ImportOption === "DocBook5" ? DOCBOOK_50 : DOCBOOK_45;

                                    /*
                                     We start by comparing the topic we are trying to import to the close match in the
                                     database. To do this we normalize whitespace, injections and xrefs. If the two
                                     topics then match we have a potential candidate to reuse.
                                     */
                                    var topicXMLCopy = topic.xml.cloneNode(true);
                                    normalizeXrefs(normalizeInjections(normalizeComments(topicXMLCopy)), topicOrContainerIDs);
                                    reorderAttributes(topicXMLCopy);

                                    var topicXMLCompare = qnautils.xmlToString(topicXMLCopy);
                                    topicXMLCompare = removeWhiteSpace(topicXMLCompare);
                                    topicXMLCompare = qnautils.reencode(topicXMLCompare, replacements);
                                    topicXMLCompare = removeRedundantXmlnsAttribute(topicXMLCompare);
                                    topicXMLCompare = setDocumentNodeToSection(topicXMLCompare);

                                    /*
                                     topicXMLCompare now has injection placeholders that will match the injection
                                     points in existing topics, has any entities put back, has whitespace removed
                                     and the main element is a section.

                                     We are now ready to compare it directly to topics pulled from PressGang and
                                     normalized.
                                     */
                                    data.items.sort(function(a,b){
                                        if (a.item.id < b.item.id) {
                                            return 1;
                                        }

                                        if (a.item.id === b.item.id) {
                                            return 0;
                                        }

                                        return -1;
                                    });
                                    jquery.each(data.items, function(index, matchingTopic) {
                                        /*
                                            The matching topic has to have the same format as the one
                                            we are trying to import.
                                         */
                                        if (matchingTopic.item.xmlFormat !== format) {
                                            return true;
                                        }

                                        /*
                                         The matching topic has to have the same locale as the one
                                         we are trying to import.
                                         */
                                        if (matchingTopic.item.locale !== config.ImportLang) {
                                            return true;
                                        }

                                        /*
                                         Strip out the entities which can cause issues with the XML Parsing
                                         */
                                        var replacedTextResult = qnautils.replaceEntitiesInText(matchingTopic.item.xml);
                                        /*
                                         Parse to XML
                                         */
                                        var matchingTopicXMLCopy = qnautils.stringToXML(replacedTextResult.xml);
                                        /*
                                            Check for invalid XML stored in the database
                                         */
                                        if (matchingTopicXMLCopy !== null) {
                                            /*
                                             Remove the comments
                                             */
                                            normalizeComments(matchingTopicXMLCopy);
                                            /*
                                             Normalize injections. We do this against a XML DOM because it is more
                                             robust than doing regexes on strings.
                                             */
                                            normalizeInjections(matchingTopicXMLCopy);
                                            /*
                                             Order the attributes in nodes in a consistent way
                                             */
                                            reorderAttributes(matchingTopicXMLCopy);
                                            /*
                                             Convert back to a string
                                             */
                                            var matchingTopicXMLCompare = qnautils.xmlToString(matchingTopicXMLCopy);
                                            /*
                                             Strip whitespace
                                             */
                                            matchingTopicXMLCompare = removeWhiteSpace(matchingTopicXMLCompare);
                                            /*
                                             Restore entities
                                             */
                                            matchingTopicXMLCompare = qnautils.reencode(matchingTopicXMLCompare, replacedTextResult.replacements);

                                            if (matchingTopicXMLCompare === topicXMLCompare) {

                                                /*
                                                    This is the second level of checking. If we reach this point we know the
                                                    two XML file have the same structure and content ignoring any whitespace.
                                                    Now we make sure that any elements where whitespace is signifiant also
                                                    match.
                                                 */
                                                var verbatimMatch = true;
                                                jquery.each(VERBATIM_ELEMENTS, function (index, elementName) {
                                                    var originalNodes = qnautils.xPath(".//docbook:" + elementName, topicXMLCopy);
                                                    var matchingNodes = qnautils.xPath(".//docbook:" + elementName, matchingTopicXMLCopy);

                                                    var originalNode;
                                                    var matchingNode;
                                                    while ((originalNode = originalNodes.iterateNext()) !== null) {
                                                        matchingNode = matchingNodes.iterateNext();

                                                        if (matchingNode === null) {
                                                            throw "There was a mismatch between verbatim elements in similar topics!";
                                                        }

                                                        var reencodedOriginal = qnautils.reencode(qnautils.xmlToString(originalNode), replacements);
                                                        var reencodedMatch = qnautils.reencode(qnautils.xmlToString(matchingNode), replacedTextResult.replacements);

                                                        // the original

                                                        if (qnautils.reencodedOriginal !==qnautils.reencodedMatch) {
                                                            verbatimMatch = false;
                                                            return false;
                                                        }
                                                    }

                                                    if ((matchingNode = matchingNodes.iterateNext()) !== null) {
                                                        throw "There was a mismatch between verbatim elements in similar topics!";
                                                    }
                                                });

                                                if (verbatimMatch) {
                                                    topic.addPGId(matchingTopic.item.id, matchingTopic.item.xml);
                                                }
                                            }
                                        } else {
                                            console.log("The XML in topic " + matchingTopic.item.id + " could not be parsed");
                                        }
                                    });

                                    if (topic.pgIds === undefined) {
                                        console.log("Topic " + topic.title + " has no matches in the database.");
                                    }

                                    getPossibleMatches(index + 1, callback);
                                },
                                errorCallback
                            );
                        }
                    }

                    if (config.CreateOrResuseTopics === "REUSE") {
                        getPossibleMatches(0, function() {
                            /*
                                get a report of potentially reused topics. This is really just a convenient
                                place to set a break point.
                             */
                            jquery.each(topics, function(index, value) {
                                if (value.pgIds === undefined) {
                                    console.log(value.title + ": none");
                                } else {
                                    var matchingIds = "";
                                    jquery.each(value.pgIds, function(key, value) {
                                        if (matchingIds.length !== 0) {
                                            matchingIds += ", ";
                                        }
                                        matchingIds += key;
                                    });
                                    console.log(value.title + ": " + matchingIds);
                                }
                            });

                            populateOutgoingLinks();
                        });
                    } else {
                        populateOutgoingLinks();
                    }

                    /*
                     Step 2: Populate outgoing links
                     */
                    function populateOutgoingLinks() {
                        jquery.each(topics, function (index, topic) {

                            // a collection of xrefs that will be replaced by injections.
                            // topic.xrefs is a collection of all xrefs, but some of these
                            // might point to positions inside a topic, and as such is not
                            // a candidate for being replaced with an injection
                            var outgoingXrefs = [];

                            jquery.each(topic.xrefs, function (index, xref) {
                                if (topicOrContainerIDs.indexOf(xref) !== -1) {
                                    outgoingXrefs.push(xref);
                                }
                            });

                            /*
                             We are only interested in mapping the relationships between topics
                             that have matching topics in PressGang.
                             */
                            if (topic.pgIds) {
                                jquery.each(topic.pgIds, function (pgid, details) {
                                    var InjectionRE = /<!--\s*Inject\s*:\s*(T?\d+)\s*-->/g;
                                    var match;
                                    var count = 0;
                                    while ((match = InjectionRE.exec(details.originalXML)) !== null) {
                                        if (count >= outgoingXrefs.length) {
                                            throw "There is a mismatch between the xrefs and the injects.";
                                        }

                                        var topicIdOrContainerTarget = match[1];
                                        var xref = outgoingXrefs[count];

                                        topic.addFixedOutgoingLink(pgid, xref, topicIdOrContainerTarget);

                                        ++count;
                                    }
                                });
                            }
                        });

                        config.UploadProgress[1] = 15 * progressIncrement;
                        thisStep.setTitlePrefixPercentage(config.UploadProgress[1]);
                        config.MatchedExistingTopics = true;
                        resultCallback();

                        resolveXrefs(xmlDoc, contentSpec, topics, topicGraph);
                    }
                }

                /*
                 This is the trickiest part of the process.

                 When reusing a topic in PressGang, we also reuse any injections it has to other topics. This
                 means that reusing a topic that has 5 injections means that we have to reuse at least 6 topics
                 (the original one with the injections and then the 5 that are pointed to). And these dependencies
                 cascade and create circular references.

                 So what we do here is:

                 1. Find all potentially matching topics from PressGang
                 2. Create a xref graph that defines the dependencies between topics if they assume one of
                 the existing topic ids
                 3. Attempt to resolve a topic to an existing topic, making sure that any cascading dependencies
                 are also resolved
                 4. Create new topics that could not be matched, and reuse those that can be matched
                 */
                function resolveXrefs (xmlDoc, contentSpec, topics, topicGraph) {
                    /*
                     Return a node without a topic ID (which means it hasn't been resolved) and
                     outgoing or incoming links (which means it is part of a xref graph).
                     */
                    function getUnresolvedNodeWithOutboundXrefs() {
                        var retValue = null;
                        jquery.each(topics, function (index, topic) {
                            if (topic.topicId === undefined &&
                                topic.pgIds !== undefined &&
                                topic.fixedOutgoingLinks !== undefined) {
                                retValue = topic;
                                return false;
                            }
                        });
                        return retValue;
                    }

                    var unresolvedNode;
                    while ((unresolvedNode = getUnresolvedNodeWithOutboundXrefs()) !== null) {
                        /*
                         Loop through each possible topic id that this topic could be
                         and see if all other nodes in the xref graph are also valid with
                         this configuration.
                         */
                        var validNodesOptions = [];
                        jquery.each(unresolvedNode.pgIds, function (pgId, details) {
                            var network = unresolvedNode.isValid(pgId);
                            if (network !== null) {
                                validNodesOptions.push(network);
                            }
                        });

                        if (validNodesOptions.length !== 0) {

                            var mostSuccess = undefined;
                            jquery.each(validNodesOptions, function(index, validNodesOption){
                                if (mostSuccess === undefined || validNodesOption.length > mostSuccess.length) {
                                    mostSuccess = validNodesOption;
                                }
                            });

                            /*
                             Every topic in this xref graph is valid with an existing topic id,
                             so set the topicId to indicate that these nodes have been resolved.
                             */
                            jquery.each(mostSuccess, function (index, topic) {
                                if (topic.node.topicId !== undefined) {
                                    throw "We should not be able to set the topic id twice";
                                }

                                topic.node.setTopicId(topic.assumedId);

                                config.UploadedTopicCount += 1;
                                config.MatchedTopicCount += 1;
                            });
                        } else {
                            /*
                             We could not find a valid xref graph with the possible existing matches,
                             so set all the topic ids to -1 to indicate that these topics have to be created
                             new.
                             */
                            var unresolvedNetwork = [];
                            unresolvedNode.getUnresolvedGraph(unresolvedNetwork);

                            jquery.each(unresolvedNetwork, function (index, topic) {
                                if (topic.topicId !== undefined) {
                                    throw "We should not be able to set the topic id twice";
                                }

                                topic.setTopicId(-1);
                                config.UploadedTopicCount += 1;
                            });
                        }

                        config.NewTopicsCreated = (config.UploadedTopicCount - config.MatchedTopicCount) + " / " + config.MatchedTopicCount;

                        resultCallback();
                    }

                    /*
                     Any that are left are stand alone topics. These can take on the first matching
                     topic id, or -1 is they are new topics.
                     */
                    jquery.each(topics, function (index, topic) {
                        if (topic.topicId === undefined) {
                            if (topic.pgIds !== undefined) {
                                topic.setTopicId(Object.keys(topic.pgIds)[0]);
                                config.UploadedTopicCount += 1;
                                config.MatchedTopicCount += 1;
                            } else {
                                topic.setTopicId(-1);
                                config.UploadedTopicCount += 1;
                            }
                        }
                    });

                    config.NewTopicsCreated = (config.UploadedTopicCount - config.MatchedTopicCount) + " / " + config.MatchedTopicCount;

                    config.UploadProgress[1] = 16 * progressIncrement;
                    thisStep.setTitlePrefixPercentage(config.UploadProgress[1]);
                    config.ResolvedXRefGraphs = true;
                    resultCallback();

                    uploadTopics(xmlDoc, contentSpec, topics, topicGraph);
                }

                function uploadTopics (xmlDoc, contentSpec, topics, topicGraph) {
                    function createTopics(index, callback) {
                        if (index >= topics.length) {
                            callback();
                        } else {
                            config.UploadProgress[1] = (17 * progressIncrement) + (index / topics.length * progressIncrement);
                            thisStep.setTitlePrefixPercentage(config.UploadProgress[1]);
                            resultCallback();

                            var topic = topics[index];
                            if (topic.topicId === -1) {
                                qnastart.createTopic(
                                    false,
                                    config.ImportOption === "DocBook5" ? 5 : 4.5,
                                    removeRedundantXmlnsAttribute(setDocumentNodeToSection(qnautils.reencode(qnautils.xmlToString(topic.xml), replacements).trim())),
                                    topic.title,
                                    topic.tags,
                                    config.ImportLang,
                                    config,
                                    function (data) {
                                        topic.setTopicId(data.id);
                                        topic.createdTopic = true;

                                        var replacedTextResult = qnautils.replaceEntitiesInText(data.xml);

                                        var entityFreeXml = qnautils.stringToXML(replacedTextResult.xml);
                                        // this might be null due to bugs like https://bugzilla.redhat.com/show_bug.cgi?id=1066169
                                        if (entityFreeXml !== null) {
                                            topic.xml = qnautils.stringToXML(replacedTextResult.xml);
                                            topic.replacements = replacedTextResult.replacements;
                                        } else {
                                            // work around this bug by allowing the existing xml to be qnautils.reencoded. The
                                            // final book would have invalid topics, but at least it will build.
                                            topic.replacements = replacements;
                                        }

                                        createTopics(index + 1, callback);
                                    },
                                    errorCallback
                                );
                            } else {
                                createTopics(index + 1, callback);
                            }
                        }
                    }

                    createTopics(0, function() {

                        config.UploadProgress[1] = 17 * progressIncrement;
                        thisStep.setTitlePrefixPercentage(config.UploadProgress[1]);
                        config.UploadedTopics = true;
                        resultCallback();

                        resolveXrefsInCreatedTopics(xmlDoc, contentSpec, topics, topicGraph);
                    });
                }

                function resolveXrefsInCreatedTopics (xmlDoc, contentSpec, topics, topicGraph) {
                    function resolve(index, callback) {
                        if (index >= topics.length) {
                            callback();
                        } else {
                            config.UploadProgress[1] = (17 * progressIncrement) + (index / topics.length * progressIncrement);
                            thisStep.setTitlePrefixPercentage(config.UploadProgress[1]);
                            resultCallback();

                            var topic = topics[index];
                            if (topic.createdTopic) {
                                var xrefReplacements = [];
                                jquery.each(['xref', 'link'], function(index, linkElement) {
                                    var xrefs = qnautils.xPath(".//docbook:" + linkElement, topic.xml);
                                    var xref;
                                    while ((xref = xrefs.iterateNext()) !== null) {
                                        if (xref.hasAttribute("linkend")) {
                                            var linkend = xref.getAttribute("linkend");
                                            // is this an xref to a topic
                                            var destinationTopic = topicGraph.getNodeFromXMLId(linkend);
                                            if (destinationTopic !== undefined) {

                                                if (destinationTopic instanceof specelement.TopicGraphNode &&
                                                    (destinationTopic.topicId === undefined || destinationTopic.topicId === -1)) {
                                                    throw "All topics should be resolved by this point";
                                                }

                                                if (destinationTopic instanceof specelement.TopicGraphNode) {
                                                    // we are pointing to a saved topic, so replace the xref with an injection
                                                    var topicInjection = xmlDoc.createComment("Inject: " + destinationTopic.topicId);
                                                    var replacement = {original: xref, replacement: [topicInjection]};
                                                    xrefReplacements.push(replacement);

                                                    if (linkElement === 'link') {
                                                        replacement.replacement.push(xmlDoc.createComment(qnautils.xmlToString(xref)));
                                                    }
                                                } else {
                                                    // we are pointing to a container, so replace the xref with a target injection
                                                    var containerInjection = xmlDoc.createComment("Inject: T" + destinationTopic.targetNum);
                                                    xrefReplacements.push({original: xref, replacement: [containerInjection]});
                                                }
                                            }
                                        }
                                    }
                                });

                                jquery.each(xrefReplacements, function (index, value) {
                                    for (var replacementIndex = 0; replacementIndex < value.replacement.length; ++replacementIndex) {
                                        if (replacementIndex === value.replacement.length - 1) {
                                            value.original.parentNode.replaceChild(value.replacement[replacementIndex], value.original);
                                        } else {
                                            value.original.parentNode.insertBefore(value.replacement[replacementIndex], value.original);
                                        }
                                    }
                                });

                                qnastart.updateTopic(
                                    topic.topicId,
                                    removeRedundantXmlnsAttribute(setDocumentNodeToSection(qnautils.reencode(qnautils.xmlToString(topic.xml), topic.replacements))),
                                    topic.title,
                                    config,
                                    function (data) {
                                        resolve(index + 1, callback);
                                    },
                                    errorCallback
                                );
                            } else {
                                resolve(index + 1, callback);
                            }
                        }
                    }

                    resolve(0, function() {

                        config.UploadProgress[1] = 18 * progressIncrement;
                        thisStep.setTitlePrefixPercentage(config.UploadProgress[1]);
                        config.FixXRefs = true;
                        resultCallback();

                        updateContentSpecWithTopicIDs(xmlDoc, contentSpec, topics, topicGraph);
                    });
                }

                function updateContentSpecWithTopicIDs (xmlDoc, contentSpec, topics, topicGraph) {
                    jquery.each(topics, function (index, topic) {
                        contentSpec[topic.specLine] += " [" + topic.topicId + "]";
                    });

                    config.UploadProgress[1] = 19 * progressIncrement;
                    thisStep.setTitlePrefixPercentage(config.UploadProgress[1]);
                    config.UpdatedContentSpec = true;
                    resultCallback();

                    uploadContentSpec(contentSpec);
                }

                function uploadContentSpec (contentSpec) {
                    var compiledContentSpec = "";
                    jquery.each(contentSpec, function(index, value) {
                        compiledContentSpec += value + "\n";
                    });

                    function contentSpecSaveSuccess(id) {
                        config.UploadProgress[1] = 100;
                        thisStep.setTitlePrefix(null);
                        config.UploadedContentSpecification = true;
                        config.ContentSpecID = id;
                        resultCallback(true);
                    }

                    if (config.ExistingContentSpecID) {
                        qnastart.updateContentSpec(
                            config.ExistingContentSpecID,
                            compiledContentSpec,
                            config,
                            contentSpecSaveSuccess,
                            errorCallback
                        );
                    } else {
                        qnastart.createContentSpec(
                            compiledContentSpec,
                            config.ImportLang,
                            config,
                            contentSpecSaveSuccess,
                            errorCallback
                        );
                    }
                }

                // start the process
                loadTagIDs();
            })
            .setNextStep(function (resultCallback) {
                window.onbeforeunload = undefined;

                resultCallback(summary);
            })
            .setShowNext(false)
            .setShowPrevious(false);

        var summary = new qna.QNAStep()
            .setTitle("Import Summary")
            .setOutputs([
                new qna.QNAVariables()
                    .setVariables([
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.HTML)
                            .setIntro("Content Specification ID")
                            .setName("ContentSpecIDLink")
                            .setValue(function (resultCallback, errorCallback, result, config) {
                                resultCallback("<a href='http://" + config.PressGangHost + ":8080/pressgang-ccms-ui/#ContentSpecFilteredResultsAndContentSpecView;query;contentSpecIds=" + config.ContentSpecID + "'>" + config.ContentSpecID + "</a>");
                            }),
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.PLAIN_TEXT)
                            .setIntro("Imported From")
                            .setName("ImportedFrom")
                            .setValue(function (resultCallback, errorCallback, result, config) {
                                resultCallback(config.InputSource.name);
                            }),
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.PLAIN_TEXT)
                            .setIntro("Topics Created / Topics Reused")
                            .setName("NewTopicsCreated"),
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.PLAIN_TEXT)
                            .setIntro("Images Created / Images Reused")
                            .setName("NewImagesCreated"),
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.PLAIN_TEXT)
                            .setIntro("Files Created / Files Reused")
                            .setName("NewFilesCreated")
                    ])
            ])
            .setShowNext(false)
            .setShowPrevious(false)
            .setShowRestart(true);
    }
);