﻿// ----------------------------------------------------------------------------------------------
// Copyright (c) Mårten Rånge.
// ----------------------------------------------------------------------------------------------
// This source code is subject to terms and conditions of the Microsoft Public License. A
// copy of the license can be found in the License.html file at the root of this distribution.
// If you cannot locate the  Microsoft Public License, please send an email to
// dlr@microsoft.com. By using this source code in any fashion, you are agreeing to be bound
//  by the terms of the Microsoft Public License.
// ----------------------------------------------------------------------------------------------
// You must not remove this notice, or any other, from this software.
// ----------------------------------------------------------------------------------------------
// mpc.js is a monadic parser combinator library
// See this classic article for an introduction: http://www.cs.nott.ac.uk/~gmh/monparsing.pdf
var mpc;
(function (mpc) {
    var StringBuilder = (function () {
        function StringBuilder() {
            this.data = [];
        }
        StringBuilder.prototype.indent = function (n, indent) {
            if (typeof indent === "undefined") { indent = "\t"; }
            for (var iter = 0; iter < n; ++iter) {
                this.append(indent);
            }

            return this;
        };

        StringBuilder.prototype.newLine = function () {
            return this.append("\r\n");
        };

        StringBuilder.prototype.append = function (s) {
            this.data[this.data.length] = s || "";
            return this;
        };

        StringBuilder.prototype.toString = function (delimiter) {
            if (typeof delimiter === "undefined") { delimiter = ""; }
            return this.data.join(delimiter || "");
        };
        return StringBuilder;
    })();
    mpc.StringBuilder = StringBuilder;

    var Snapshot = (function () {
        function Snapshot() {
        }
        return Snapshot;
    })();
    mpc.Snapshot = Snapshot;

    var ParserState = (function () {
        function ParserState(s) {
            this.text = s || "";
            this.position = 0;
            this.indent = 0;
        }
        ParserState.prototype.snapshot = function () {
            return { position: this.position, indent: this.indent };
        };

        ParserState.prototype.increaseIndent = function () {
            ++this.indent;
        };

        ParserState.prototype.decreaseIndent = function () {
            if (this.indent < 1) {
                return false;
            }

            --this.indent;

            return true;
        };

        ParserState.prototype.restore = function (snapshot) {
            this.position = snapshot.position;
            this.indent = snapshot.indent;
        };

        ParserState.prototype.isEOS = function () {
            return this.position >= this.text.length;
        };

        ParserState.prototype.advance = function (satisfy) {
            var begin = this.position;
            var end = this.text.length;

            var i = 0;
            var pos = begin;

            for (; pos < end && satisfy(this.text.charCodeAt(pos), i); ++pos, ++i) {
            }

            this.position = pos;

            return this.text.substring(begin, pos);
        };

        ParserState.prototype.skipAdvance = function (satisfy) {
            var begin = this.position;
            var end = this.text.length;

            var i = 0;
            var pos = begin;

            for (; pos < end && satisfy(this.text.charCodeAt(pos), i); ++pos, ++i) {
            }

            this.position = pos;

            return pos - begin;
        };

        ParserState.prototype.succeed = function (value) {
            return { state: this, success: true, value: value };
        };

        ParserState.prototype.fail = function () {
            return { state: this, success: false, value: undefined };
        };
        return ParserState;
    })();
    mpc.ParserState = ParserState;

    var ParseResult = (function () {
        function ParseResult() {
        }
        return ParseResult;
    })();
    mpc.ParseResult = ParseResult;

    var Parser = (function () {
        function Parser(p) {
            this.parse = p;
        }
        Parser.prototype.noResult = function () {
            var _this = this;
            return parser(function (ps) {
                var pResult = _this.parse(ps);

                if (!pResult.success) {
                    return ps.fail();
                }

                return ps.succeed(undefined);
            });
        };

        Parser.prototype.test = function (predicate) {
            var _this = this;
            return parser(function (ps) {
                var snapshot = ps.snapshot();

                var pResult = _this.parse(ps);

                if (!pResult.success) {
                    return ps.fail();
                }

                if (!predicate(pResult.value)) {
                    ps.restore(snapshot);
                    return ps.fail();
                }

                return ps.succeed(pResult.value);
            });
        };

        Parser.prototype.consumedAtLeast = function (i) {
            var _this = this;
            return parser(function (ps) {
                var snapshot = ps.snapshot();

                var pResult = _this.parse(ps);

                if (!pResult.success) {
                    return ps.fail();
                }

                if (ps.position < snapshot.position + i) {
                    ps.restore(snapshot);
                    return ps.fail();
                }

                return ps.succeed(pResult.value);
            });
        };

        Parser.prototype.inBetween = function (pBegin, pEnd) {
            var _this = this;
            return parser(function (ps) {
                var snapshot = ps.snapshot();

                var pBeginResult = pBegin.parse(ps);
                if (!pBeginResult.success) {
                    return ps.fail();
                }

                var pResult = _this.parse(ps);

                if (!pResult.success) {
                    ps.restore(snapshot);
                    return ps.fail();
                }

                var pEndResult = pEnd.parse(ps);
                if (!pEndResult.success) {
                    ps.restore(snapshot);
                    return ps.fail();
                }

                return ps.succeed(pResult.value);
            });
        };

        /* This for some reason struggles as a member function
        combine<TOther>(pOther : Parser<TOther>) : Parser<{v0 : T; v1 : TOther}> {
        return parser<{v0 : T; v1 : TOther}> ((ps : ParserState) => {
        var snapshot = ps.snapshot()
        
        var pResult = this.parse(ps)
        
        if (!pResult.success) {
        return ps.fail<{v0 : T; v1 : TOther}>()
        }
        
        var pOtherResult = pOther.parse(ps)
        
        if (!pOtherResult.success) {
        ps.restore(snapshot)
        return ps.fail<{v0 : T; v1 : TOther}>()
        }
        
        var result = {v0 : pResult.value, v1 : pOtherResult.value}
        
        return ps.succeed(result)
        })
        }
        */
        /* This for some reason struggles as a member function
        chainLeft<S>(pSeparator : Parser<S>, combiner : (l : T, op : S, r : T) => T) : Parser<T> {
        return parser ((ps : ParserState) => {
        var snapshot = ps.snapshot()
        
        var pResult = this.parse(ps)
        if(!pResult.success) {
        return ps.fail<T>()
        }
        
        var value = pResult.value
        
        var pSeparatorResult    : ParseResult<S>
        var pOtherResult        : ParseResult<T>
        
        while((pSeparatorResult = pSeparator.parse(ps)).success && (pOtherResult = this.parse(ps)).success) {
        snapshot = ps.snapshot()
        value = combiner(value, pSeparatorResult.value, pOtherResult.value)
        }
        
        ps.restore(snapshot)
        
        return ps.succeed(value)
        })
        }
        */
        Parser.prototype.keepLeft = function (pOther) {
            var _this = this;
            return parser(function (ps) {
                var snapshot = ps.snapshot();

                var pResult = _this.parse(ps);

                if (!pResult.success) {
                    return ps.fail();
                }

                var pOtherResult = pOther.parse(ps);

                if (!pOtherResult.success) {
                    ps.restore(snapshot);
                    return ps.fail();
                }

                return ps.succeed(pResult.value);
            });
        };

        Parser.prototype.keepRight = function (pOther) {
            var _this = this;
            return parser(function (ps) {
                var snapshot = ps.snapshot();

                var pResult = _this.parse(ps);

                if (!pResult.success) {
                    return ps.fail();
                }

                var pOtherResult = pOther.parse(ps);

                if (!pOtherResult.success) {
                    ps.restore(snapshot);
                    return ps.fail();
                }

                return ps.succeed(pOtherResult.value);
            });
        };

        Parser.prototype.except = function (pExcept) {
            var _this = this;
            return parser(function (ps) {
                var snapshot = ps.snapshot();

                var pExceptResult = pExcept.parse(ps);

                if (pExceptResult.success) {
                    ps.restore(snapshot);
                    return ps.fail();
                }

                var pResult = _this.parse(ps);

                if (!pResult.success) {
                    return ps.fail();
                }

                return ps.succeed(pResult.value);
            });
        };

        Parser.prototype.opt = function () {
            var _this = this;
            return parser(function (ps) {
                var pResult = _this.parse(ps);

                if (!pResult.success) {
                    return ps.succeed(null);
                }

                return ps.succeed(pResult.value);
            });
        };

        Parser.prototype.transform = function (transform) {
            var _this = this;
            return parser(function (ps) {
                var pResult = _this.parse(ps);

                if (!pResult.success) {
                    return ps.fail();
                }

                return ps.succeed(transform(pResult.value));
            });
        };

        // log parser is useful for debugging
        Parser.prototype.log = function (name) {
            var _this = this;
            return parser(function (ps) {
                console.info("MonadicParser: %s: begin", name);

                var pResult = _this.parse(ps);

                if (pResult.success) {
                    console.info("MonadicParser: %s: success", name);
                } else {
                    console.info("MonadicParser: %s: failed", name);
                }

                return pResult;
            });
        };
        return Parser;
    })();
    mpc.Parser = Parser;

    function parser(p) {
        return new Parser(p);
    }
    mpc.parser = parser;

    function parse(p, s) {
        var ps = new ParserState(s);
        return p.parse(ps);
    }
    mpc.parse = parse;

    function success(value) {
        return parser(function (ps) {
            return ps.succeed(value);
        });
    }
    mpc.success = success;

    function fail() {
        return parser(function (ps) {
            return ps.fail();
        });
    }
    mpc.fail = fail;

    function indent() {
        return parser(function (ps) {
            ps.increaseIndent();
            return ps.succeed(undefined);
        });
    }
    mpc.indent = indent;

    function dedent() {
        return parser(function (ps) {
            if (!ps.decreaseIndent()) {
                return ps.fail();
            }
            return ps.succeed(undefined);
        });
    }
    mpc.dedent = dedent;

    function anyChar() {
        return parser(function (ps) {
            if (ps.isEOS()) {
                return ps.fail();
            }

            var ch = ps.text.charCodeAt(ps.position);

            ++ps.position;

            return ps.succeed(ch);
        });
    }
    mpc.anyChar = anyChar;

    function anyCharOf(str, mapper) {
        var numbers = [];

        for (var iter = 0; iter < str.length; ++iter) {
            numbers[iter] = str.charCodeAt(iter);
        }

        return parser(function (ps) {
            if (ps.isEOS()) {
                return ps.fail();
            }

            var ch = ps.text.charCodeAt(ps.position);

            var indexOf = numbers.indexOf(ch);

            if (indexOf < 0) {
                return ps.fail();
            }

            ++ps.position;

            return ps.succeed(mapper(indexOf));
        });
    }
    mpc.anyCharOf = anyCharOf;

    function anyStringOf(str) {
        var numbers = [];

        for (var iter = 0; iter < str.length; ++iter) {
            numbers[iter] = str.charCodeAt(iter);
        }

        return parser(function (ps) {
            var ch = 0;
            var data = [];

            var result = ps.advance(function (ch, pos) {
                return numbers.indexOf(ch) > -1;
            });

            return ps.succeed(result);
        });
    }
    mpc.anyStringOf = anyStringOf;

    function EOS() {
        return parser(function (ps) {
            if (!ps.isEOS()) {
                return ps.fail();
            }

            return ps.succeed(undefined);
        });
    }
    mpc.EOS = EOS;

    function EOL() {
        return parser(function (ps) {
            if (ps.isEOS()) {
                return ps.succeed(undefined);
            }

            if (ps.text[ps.position] === "\n") {
                ++ps.position;

                return ps.succeed(undefined);
            }

            if (ps.text[ps.position] === "\r") {
                ++ps.position;

                if (!ps.isEOS() && ps.text[ps.position] === "\n") {
                    ++ps.position;

                    return ps.succeed(undefined);
                }

                return ps.succeed(undefined);
            }

            return ps.fail();
        });
    }
    mpc.EOL = EOL;

    function satisfy(satisfy) {
        return parser(function (ps) {
            if (ps.isEOS()) {
                return ps.fail();
            }

            var ch = ps.text.charCodeAt(ps.position);

            if (!satisfy(ch, 0)) {
                return ps.fail();
            }

            ++ps.position;

            return ps.succeed(ch);
        });
    }
    mpc.satisfy = satisfy;

    function satisfyMany(satisfy) {
        return parser(function (ps) {
            return ps.succeed(ps.advance(satisfy));
        });
    }
    mpc.satisfyMany = satisfyMany;

    function skipSatisfyMany(satisfy) {
        return parser(function (ps) {
            return ps.succeed(ps.skipAdvance(satisfy));
        });
    }
    mpc.skipSatisfyMany = skipSatisfyMany;

    function satisyWhitespace(ch, pos) {
        switch (ch) {
            case 0x09:
            case 0x0A:
            case 0x0D:
            case 0x20:
                return true;
            default:
                return false;
        }
    }
    mpc.satisyWhitespace = satisyWhitespace;

    function satisyTab(ch, pos) {
        return ch === 0x09;
    }
    mpc.satisyTab = satisyTab;

    function skipString(str) {
        return parser(function (ps) {
            var snapshot = ps.snapshot();

            var ss = str;

            var result = ps.skipAdvance(function (s, pos) {
                return pos < ss.length && ss.charCodeAt(pos) === s;
            });

            if (result === ss.length) {
                return ps.succeed(undefined);
            } else {
                ps.restore(snapshot);
                return ps.fail();
            }
        });
    }
    mpc.skipString = skipString;

    function many(p) {
        return parser(function (ps) {
            var result = [];

            var pResult;

            while ((pResult = p.parse(ps)).success) {
                result[result.length] = pResult.value;
            }

            return ps.succeed(result);
        });
    }
    mpc.many = many;

    function manyString(p) {
        return parser(function (ps) {
            var result = "";

            var pResult;

            var data = [];

            while ((pResult = p.parse(ps)).success) {
                data[data.length] = String.fromCharCode(pResult.value);
            }

            return ps.succeed(data.join(""));
        });
    }
    mpc.manyString = manyString;

    function combine(p0, p1) {
        return parser(function (ps) {
            var snapshot = ps.snapshot();

            var p0Result = p0.parse(ps);

            if (!p0Result.success) {
                return ps.fail();
            }

            var p1Result = p1.parse(ps);

            if (!p1Result.success) {
                ps.restore(snapshot);
                return ps.fail();
            }

            var result = { v0: p0Result.value, v1: p1Result.value };

            return ps.succeed(result);
        });
    }
    mpc.combine = combine;

    function chainLeft(p, pSeparator, combiner) {
        return parser(function (ps) {
            var pResult = p.parse(ps);
            if (!pResult.success) {
                return ps.fail();
            }

            var snapshot = ps.snapshot();

            var value = pResult.value;

            var pSeparatorResult;
            var pOtherResult;

            while ((pSeparatorResult = pSeparator.parse(ps)).success && (pOtherResult = p.parse(ps)).success) {
                snapshot = ps.snapshot();
                value = combiner(value, pSeparatorResult.value, pOtherResult.value);
            }

            ps.restore(snapshot);

            return ps.succeed(value);
        });
    }
    mpc.chainLeft = chainLeft;

    function choice() {
        var choices = [];
        for (var _i = 0; _i < (arguments.length - 0); _i++) {
            choices[_i] = arguments[_i + 0];
        }
        return parser(function (ps) {
            for (var iter = 0; iter < choices.length; ++iter) {
                var p = choices[iter];

                var pResult = p.parse(ps);

                if (pResult.success) {
                    return ps.succeed(pResult.value);
                }
            }

            return ps.fail();
        });
    }
    mpc.choice = choice;

    function anyIndention() {
        return skipSatisfyMany(satisyWhitespace);
    }
    mpc.anyIndention = anyIndention;

    function indention() {
        return parser(function (ps) {
            var snapshot = ps.snapshot();

            if (ps.indent === 0) {
                return ps.succeed(0);
            }

            var satisy = function (ch, pos) {
                return pos < ps.indent && ch === 0x09;
            };
            var tabs = ps.skipAdvance(satisy);

            if (tabs !== ps.indent) {
                ps.restore(snapshot);
                return ps.fail();
            }

            return ps.succeed(tabs);
        });
    }
    mpc.indention = indention;

    function circular() {
        return parser(null);
    }
    mpc.circular = circular;
})(mpc || (mpc = {}));
//# sourceMappingURL=mpc.js.map
