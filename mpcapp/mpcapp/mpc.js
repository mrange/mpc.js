// ----------------------------------------------------------------------------------------------
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
    // StringBuilder helps building strings more efficiently
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

    // Holds a parser snapshot
    var Snapshot = (function () {
        function Snapshot() {
        }
        return Snapshot;
    })();
    mpc.Snapshot = Snapshot;

    // Represents a parse result:
    //  A flag indicating if parse was successful
    //  The parsed value (only value if success flag is true)
    var ParseResult = (function () {
        function ParseResult() {
        }
        return ParseResult;
    })();
    mpc.ParseResult = ParseResult;

    // ParserState holds (surprisingly) the parser state ie
    //  The text to be parsed
    //  The position in the text
    //  The current indention level
    // Note: For efficiency reasons ParserState is mutable
    var ParserState = (function () {
        function ParserState(s) {
            this.text = s || "";
            this.position = 0;
            this.indent = 0;
        }
        // Takes a snapshot of the parser state
        ParserState.prototype.snapshot = function () {
            return { position: this.position, indent: this.indent };
        };

        // Increases the current indent
        ParserState.prototype.increaseIndent = function () {
            ++this.indent;
        };

        // Decreases the current indent
        ParserState.prototype.decreaseIndent = function () {
            if (this.indent < 1) {
                return false;
            }

            --this.indent;

            return true;
        };

        // Restores the parser state from a snaphot
        ParserState.prototype.restore = function (snapshot) {
            this.position = snapshot.position;
            this.indent = snapshot.indent;
        };

        // Tests if state is at end of stream (EOS)
        ParserState.prototype.isEOS = function () {
            return this.position >= this.text.length;
        };

        ParserState.prototype.currentCharCode = function () {
            if (this.position >= this.text.length) {
                return undefined;
            }

            return this.text.charCodeAt(this.position);
        };

        // Advances the parser state as long as the current character and local position
        //  satisfies a criteria
        // Local position starts at 0 and then increases for each call to satisfy
        // Returns the string that satisfy the critera
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

        // Advances the parser state as long as the current character and local position
        //  satisfies a criteria
        // Local position starts at 0 and then increases for each call to satisfy
        // Returns how many characters match the criteria (more efficient then advance)
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

        // Creates a success ParseResult from current state and value
        ParserState.prototype.succeed = function (value) {
            return { success: true, value: value };
        };

        // Creates a failure ParseResult from current state
        ParserState.prototype.fail = function () {
            return { success: false, value: undefined };
        };
        return ParserState;
    })();
    mpc.ParserState = ParserState;

    // The Parser monad
    //  A parser takes a parser state and produces a ParseResult
    //
    //  If the parse was successful the ParseResult shall contain the value
    //  and the parser state advanced to the next unparsed character
    //
    //  If the parse was unsuccesful the ParseResult shall contain no vlaue
    //  and the parser state should not be changed updated
    //  Note: This implies that a parser that mutates the parser state
    //  needs to restore the parser state on failure. Use snapshot/restore
    //  Note: If the parser uses other parsers and they all fail no restore
    //  is needed as Parsers are required to restore their state on failure
    var Parser = (function () {
        function Parser(p) {
            this.parse = p;
        }
        // Takes a Parser<T> and converts it into a Parser<void>
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

        // Takes a Parser<T> and converts it into a Parser<TResult>
        Parser.prototype.result = function (v) {
            var _this = this;
            return parser(function (ps) {
                var pResult = _this.parse(ps);

                if (!pResult.success) {
                    return ps.fail();
                }

                return ps.succeed(v);
            });
        };

        // Takes a Parser<T> and tests if T satisfies a predicate
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

        // Tests if a parser has consumed at least i character
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

        // Combines a parser with a begin parser and an end parser
        // Typically used to implement subexpressions that is surrounded by parantheses
        // Example: expressionParser.inBetween(skipString("("), skipString(")"))
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
        // Combines a parser with another parser but keeps the result
        // of the first parser
        // This is often used when parsing tokens but the value of the token isn't interesting
        // Example: combine(identifier.keepLeft(skipString("=")), value)    // The result is a tuple of identifier parser and value parser
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

        // Combines a parser with another parser but keeps the result
        // of the second parser
        // This is often used when parsing tokens but the value of the token isn't interesting
        // Example: combine(identifier, skipString("=").keepRight(value))    // The result is a tuple of identifier parser and value parser
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

        // Parse only succeed the parser succeeds and the except parser fails
        // Example: manyString(anyChar().except(EOL()))
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

        // Parse always succeed but value is null if the parser failed
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

        // Transforms the parsed value using a transform function
        // Example: anyStringOf("0123456789").consumedAtLeast(1).transform((c : string) => parseFloat(c))
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

    // Constructs a parser from a parse function
    function parser(p) {
        return new Parser(p);
    }
    mpc.parser = parser;

    // Executes a parser over an input string
    function parse(p, s) {
        var ps = new ParserState(s);
        return p.parse(ps);
    }
    mpc.parse = parse;

    // Returns a parser that always succeed with value
    function success(value) {
        return parser(function (ps) {
            return ps.succeed(value);
        });
    }
    mpc.success = success;

    // Returns a parser that always fails
    function fail() {
        return parser(function (ps) {
            return ps.fail();
        });
    }
    mpc.fail = fail;

    // Parser increases the current indent
    function indent() {
        return parser(function (ps) {
            ps.increaseIndent();
            return ps.succeed(undefined);
        });
    }
    mpc.indent = indent;

    // Parser decreases the current indent
    // Fails if indent couldn't be decreased
    function dedent() {
        return parser(function (ps) {
            if (!ps.decreaseIndent()) {
                return ps.fail();
            }
            return ps.succeed(undefined);
        });
    }
    mpc.dedent = dedent;

    // Parser parses the expected number of indent
    // Fails if not enough indent characters could be consumed
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

    // Parses any number of indention characters
    function anyIndention() {
        return skipSatisfyMany(satisyTab);
    }
    mpc.anyIndention = anyIndention;

    // Parses any character
    // The parsed value is a unicode number character
    function anyChar() {
        return parser(function (ps) {
            var ch = ps.currentCharCode();

            if (ch === undefined) {
                return ps.fail();
            }

            ++ps.position;

            return ps.succeed(ch);
        });
    }
    mpc.anyChar = anyChar;

    // Parses any character that is a member of str and returns the index of the match
    function anyCharOf(str) {
        var numbers = [];

        for (var iter = 0; iter < str.length; ++iter) {
            numbers[iter] = str.charCodeAt(iter);
        }

        return parser(function (ps) {
            var ch = ps.currentCharCode();

            if (ch === undefined) {
                return ps.fail();
            }

            var indexOf = numbers.indexOf(ch);

            if (indexOf < 0) {
                return ps.fail();
            }

            ++ps.position;

            return ps.succeed(indexOf);
        });
    }
    mpc.anyCharOf = anyCharOf;
    function anyCharOf2(str, mapTo) {
        var numbers = [];

        for (var iter = 0; iter < str.length; ++iter) {
            numbers[iter] = str.charCodeAt(iter);
        }

        return parser(function (ps) {
            var ch = ps.currentCharCode();

            if (ch === undefined) {
                return ps.fail();
            }

            var indexOf = numbers.indexOf(ch);

            if (indexOf < 0) {
                return ps.fail();
            }

            if (indexOf >= mapTo.length) {
                return ps.fail();
            }

            ++ps.position;

            return ps.succeed(mapTo[indexOf]);
        });
    }
    mpc.anyCharOf2 = anyCharOf2;

    // Parses a string whose characters are a member of str
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

    // Parses EOS (end of stream)
    function EOS() {
        return parser(function (ps) {
            if (!ps.isEOS()) {
                return ps.fail();
            }

            return ps.succeed(undefined);
        });
    }
    mpc.EOS = EOS;

    // Parses EOL (end of line)
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

    // Parses a character that satisfy the predicate
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

    // Parses a string that satisfy the predicate
    function satisfyMany(satisfy) {
        return parser(function (ps) {
            return ps.succeed(ps.advance(satisfy));
        });
    }
    mpc.satisfyMany = satisfyMany;

    // Skips characters that match the predicate
    function skipSatisfyMany(satisfy) {
        return parser(function (ps) {
            return ps.succeed(ps.skipAdvance(satisfy));
        });
    }
    mpc.skipSatisfyMany = skipSatisfyMany;

    // Satisfy function for whitespace
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

    // Satisfy function for tab
    function satisyTab(ch, pos) {
        return ch === 0x09;
    }
    mpc.satisyTab = satisyTab;

    // Skips a string that matches str
    //  Typically used to parse tokens in file
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

    // Applies the parser until it fails and the value is an array of all successfully parsed values
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

    // Applies the character number parser and combines the characters into a string
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

    // Combines two parser results into a tuple value of both results
    function combine2(p0, p1) {
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
    mpc.combine2 = combine2;

    // Combines three parser results into a tuple value of all results
    function combine3(p0, p1, p2) {
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

            var p2Result = p2.parse(ps);

            if (!p2Result.success) {
                ps.restore(snapshot);
                return ps.fail();
            }

            var result = { v0: p0Result.value, v1: p1Result.value, v2: p2Result.value };

            return ps.succeed(result);
        });
    }
    mpc.combine3 = combine3;

    // chainLeft is typically used to implement left associative operators
    //  The p parser parser an expression
    //  The pSeparator parser parses the operator
    //  The combiner combines the result expressions into a new expression
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

    // choice applies each input parser in order and picks the first that matches
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

    // switch peeks on the first character and uses the associated parser
    // Note: Useful if the first character can be used as a differentiator
    function switchOver(defaultTo) {
        var choices = [];
        for (var _i = 0; _i < (arguments.length - 1); _i++) {
            choices[_i] = arguments[_i + 1];
        }
        var map = [];

        for (var iter = 0; iter < choices.length; ++iter) {
            var choice = choices[iter];

            var d = choice.differentiator || "";

            for (var ita = 0; ita < d.length; ++ita) {
                map[d.charCodeAt(ita)] = choices[iter].parser;
            }
        }

        return parser(function (ps) {
            var ch = ps.currentCharCode();

            if (ch === undefined) {
                return ps.fail();
            }

            var p = map[ch];

            if (p === undefined) {
                return ps.fail();
            }

            return p.parse(ps);
        });
    }
    mpc.switchOver = switchOver;

    // Special parser used to be break circular parsers (very common)
    function circular() {
        return parser(null);
    }
    mpc.circular = circular;
})(mpc || (mpc = {}));
//# sourceMappingURL=mpc.js.map
