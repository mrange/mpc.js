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

module mpc {

    // StringBuilder helps building strings more efficiently
    export class StringBuilder {
        data    : string[]  = []

        indent(n : number, indent : string = "\t") : StringBuilder {

            for (var iter = 0; iter < n; ++iter) {
                this.append(indent)
            }

            return this
        }

        newLine() : StringBuilder {
            return this.append("\r\n")
        }

        append(s : string) : StringBuilder {
            this.data[this.data.length] = s || ""
            return this
        }

        toString(delimiter : string = "") : string {
            return this.data.join(delimiter || "")
        }
    }

    // Holds a parser snapshot
    export class Snapshot {
        position    : number
        indent      : number
    }

    // Tests a character and position
    export interface Satisfy {
        (ch : number, pos : number) : boolean
    }

    // Combines left tree with right tree using op
    export interface Combiner<T,S> {
        (left : T, op : S, right : T) : T
    }

    // ParserState holds (surprisingly) the parser state ie
    //  The text to be parsed
    //  The position in the text
    //  The current indention level
    // Note: For efficiency reasons ParserState is mutable
    export class ParserState {
        text    : string
        position: number
        indent  : number

        constructor (s : string) {
            this.text       = s || ""
            this.position   = 0
            this.indent     = 0
        }

        // Takes a snapshot of the parser state
        snapshot() : Snapshot {
            return { position : this.position, indent : this.indent }
        }

        // Increases the current indent
        increaseIndent() : void {
            ++this.indent
        }

        // Decreases the current indent
        decreaseIndent() : boolean {
            if (this.indent < 1) {
                return false
            }

            --this.indent

            return true
        }

        // Restores the parser state from a snaphot
        restore(snapshot : Snapshot) {
            this.position   = snapshot.position
            this.indent     = snapshot.indent
        }

        // Tests if state is at end of stream (EOS)
        isEOS() : boolean {
            return this.position >= this.text.length
        }

        currentCharCode() : number {
            if (this.position >= this.text.length) {
                return undefined
            }

            return this.text.charCodeAt(this.position)
        }

        // Advances the parser state as long as the current character and local position
        //  satisfies a criteria
        // Local position starts at 0 and then increases for each call to satisfy
        // Returns the string that satisfy the critera
        advance (satisfy : Satisfy) : string {
            var begin = this.position
            var end = this.text.length

            var i = 0
            var pos = begin;

            for (; pos < end && satisfy(this.text.charCodeAt(pos), i); ++pos, ++i) {
            }

            this.position = pos

            return this.text.substring(begin, pos);
        }

        // Advances the parser state as long as the current character and local position
        //  satisfies a criteria
        // Local position starts at 0 and then increases for each call to satisfy
        // Returns how many characters match the criteria (more efficient then advance)
        skipAdvance (satisfy : Satisfy) : number {
            var begin = this.position
            var end = this.text.length

            var i = 0
            var pos = begin

            for (; pos < end && satisfy(this.text.charCodeAt(pos), i); ++pos, ++i) {
            }

            this.position = pos

            return pos - begin
        }

        // Creates a success ParseResult from current state and value
        succeed<T>(value : T) : ParseResult<T> {
            return {state : this, success : true , value : value}
        }

        // Creates a failure ParseResult from current state
        fail<T>() : ParseResult<T> {
            return {state : this, success : false , value : undefined}
        }

    }

    // Represents a parse result:
    //  The current ParserState
    //  A flag indicating if parse was successful
    //  The parsed value (only value if success flag is true)
    export class ParseResult<T> {
        state   : ParserState
        success : boolean
        value   : T
    }

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
    export class Parser<T> {
        // The parse function
        parse       :   (ps : ParserState) => ParseResult<T>

        constructor (p : (ps : ParserState) => ParseResult<T>) {
            this.parse = p
        }

        // Takes a Parser<T> and converts it into a Parser<void>
        noResult() : Parser<void> {
            return parser ((ps : ParserState) => { 
                var pResult = this.parse(ps)
                
                if (!pResult.success) {
                    return ps.fail<void>()
                }

                return ps.succeed<void>(undefined)
            })
        }

        // Takes a Parser<T> and converts it into a Parser<TResult>
        result<TResult>(v : TResult) : Parser<TResult> {
            return parser ((ps : ParserState) => { 
                var pResult = this.parse(ps)
                
                if (!pResult.success) {
                    return ps.fail<TResult>()
                }

                return ps.succeed(v)
            })
        }

        // Takes a Parser<T> and tests if T satisfies a predicate
        test(predicate : (v : T) => boolean) : Parser<T> {
            return parser ((ps : ParserState) => { 
                var snapshot = ps.snapshot()

                var pResult = this.parse(ps)
                
                if (!pResult.success) {
                    return ps.fail<T>()
                }

                if (!predicate(pResult.value))
                {
                    ps.restore(snapshot)
                    return ps.fail<T>()
                }

                return ps.succeed(pResult.value)
            })
        }
        
        // Tests if a parser has consumed at least i character
        consumedAtLeast(i : number) : Parser<T> {
            return parser ((ps : ParserState) => { 
                var snapshot = ps.snapshot()

                var pResult = this.parse(ps)
                
                if (!pResult.success) {
                    return ps.fail<T>()
                }

                if (ps.position < snapshot.position + i)
                {
                    ps.restore(snapshot)
                    return ps.fail<T>()
                }

                return ps.succeed(pResult.value)
            })
        }

        // Combines a parser with a begin parser and an end parser
        // Typically used to implement subexpressions that is surrounded by parantheses
        // Example: expressionParser.inBetween(skipString("("), skipString(")"))
        inBetween(pBegin : Parser<void>, pEnd : Parser<void>) : Parser<T> {
            return parser ((ps : ParserState) => { 
                var snapshot = ps.snapshot()

                var pBeginResult = pBegin.parse(ps)
                if (!pBeginResult.success) {
                    return ps.fail<T>()
                }

                var pResult = this.parse(ps)

                if (!pResult.success) {
                    ps.restore(snapshot)
                    return ps.fail<T>()
                }

                var pEndResult = pEnd.parse(ps)
                if (!pEndResult.success) {
                    ps.restore(snapshot)
                    return ps.fail<T>()
                }

                return ps.succeed(pResult.value)
            })
        }

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
        keepLeft<TOther>(pOther : Parser<TOther>) : Parser<T> {
            return parser ((ps : ParserState) => { 
                var snapshot = ps.snapshot()

                var pResult = this.parse(ps)

                if (!pResult.success) {
                    return ps.fail<T>()
                }

                var pOtherResult = pOther.parse(ps)

                if (!pOtherResult.success) {
                    ps.restore(snapshot)
                    return ps.fail<T>()
                }

                return ps.succeed(pResult.value)
            })
        }

        // Combines a parser with another parser but keeps the result 
        // of the second parser
        // This is often used when parsing tokens but the value of the token isn't interesting
        // Example: combine(identifier, skipString("=").keepRight(value))    // The result is a tuple of identifier parser and value parser
        keepRight<TOther>(pOther : Parser<TOther>) : Parser<TOther> {
            return parser ((ps : ParserState) => { 
                var snapshot = ps.snapshot()

                var pResult = this.parse(ps)

                if (!pResult.success) {
                    return ps.fail<TOther>()
                }

                var pOtherResult = pOther.parse(ps)

                if (!pOtherResult.success) {
                    ps.restore(snapshot)
                    return ps.fail<TOther>()
                }

                return ps.succeed(pOtherResult.value)
            })
        }

        // Parse only succeed the parser succeeds and the except parser fails
        // Example: manyString(anyChar().except(EOL()))
        except<TOther>(pExcept : Parser<TOther>) : Parser<T> {
            return parser ((ps : ParserState) => { 
                var snapshot = ps.snapshot()

                var pExceptResult = pExcept.parse(ps)

                if (pExceptResult.success) {
                    ps.restore(snapshot)
                    return ps.fail<T>()
                }

                var pResult = this.parse(ps)

                if (!pResult.success) {
                    return ps.fail<T>()
                }


                return ps.succeed(pResult.value)
            })
        }

        // Parse always succeed but value is null if the parser failed
        opt() : Parser<T> {
            return parser ((ps : ParserState) => { 

                var pResult = this.parse(ps)

                if (!pResult.success) {
                    return ps.succeed<T>(null)
                }

                return ps.succeed(pResult.value)
            })
        }

        // Transforms the parsed value using a transform function
        // Example: anyStringOf("0123456789").consumedAtLeast(1).transform((c : string) => parseFloat(c))
        transform<TTo>(transform : (T) => TTo) : Parser<TTo> {
            return parser ((ps : ParserState) => { 

                var pResult = this.parse(ps)

                if (!pResult.success) {
                    return ps.fail<TTo>()
                }

                return ps.succeed(transform(pResult.value))
            })
        }

        // log parser is useful for debugging
        log(name : string) : Parser<T> {
            return parser ((ps : ParserState) => { 
                console.info ("MonadicParser: %s: begin", name);

                var pResult = this.parse(ps)

                if (pResult.success) {
                    console.info ("MonadicParser: %s: success", name);
                } else {
                    console.info ("MonadicParser: %s: failed", name);
                }

                return pResult
            })
        }
    }

    // Constructs a parser from a parse function
    export function parser<T> (p : (ps : ParserState) => ParseResult<T>) {
        return new Parser<T> (p)
    }

    // Executes a parser over an input string
    export function parse<T>(p : Parser<T>, s : string) : ParseResult<T> {
        var ps = new ParserState(s)
        return p.parse(ps)
    }

    // Returns a parser that always succeed with value
    export function success<T>(value : T) : Parser<T> {
        return parser ((ps : ParserState) => { return ps.succeed(value) })
    }

    // Returns a parser that always fails
    export function fail<T>() : Parser<T> {
        return parser ((ps : ParserState) => { return ps.fail<T>() })
    }

    // Parser increases the current indent
    export function indent() : Parser<void> {
        return parser ((ps : ParserState) => { 
            ps.increaseIndent()
            return ps.succeed<void>(undefined)
        })
    }

    // Parser decreases the current indent
    // Fails if indent couldn't be decreased
    export function dedent() : Parser<void> {
        return parser ((ps : ParserState) => { 
            if (!ps.decreaseIndent()) {
                return ps.fail<void>()
            }
            return ps.succeed<void>(undefined)
        })
    }

    // Parser parses the expected number of indent
    // Fails if not enough indent characters could be consumed
    export function indention() : Parser<number> {
        return parser ((ps : ParserState) => { 
            var snapshot = ps.snapshot()

            if (ps.indent === 0)
            {
                return ps.succeed(0)
            }

            var satisy : Satisfy = (ch, pos) => pos < ps.indent && ch === 0x09 /*tab*/
            var tabs = ps.skipAdvance(satisy)

            if (tabs !== ps.indent) {
                ps.restore(snapshot)
                return ps.fail<number>()
            }

            return ps.succeed(tabs)
        })
    }

    // Parses any number of indention characters
    export function anyIndention() : Parser<number> {
        return skipSatisfyMany(satisyTab)
    }

    // Parses any character
    // The parsed value is a unicode number character
    export function anyChar() : Parser<number> {
        return parser ((ps : ParserState) => { 
            var ch = ps.currentCharCode()

            if (ch === undefined) {
                return ps.fail<number>()
            }

            ++ps.position

            return ps.succeed(ch)
        })
    }

    // Parses any character that is a member of str and returns the index of the match
    export function anyCharOf(str : string) : Parser<number> {
        var numbers = []

        for (var iter = 0; iter < str.length; ++iter) {
            numbers[iter] = str.charCodeAt(iter)
        }

        return parser ((ps : ParserState) => { 
            var ch = ps.currentCharCode()

            if (ch === undefined) {
                return ps.fail<number>()
            }

            var indexOf = numbers.indexOf(ch)

            if (indexOf < 0) {
                return ps.fail<number>()
            }

            ++ps.position

            return ps.succeed(indexOf)
        })
    }
    export function anyCharOf2<T>(str : string, mapTo : T[]) : Parser<T> {
        var numbers = []

        for (var iter = 0; iter < str.length; ++iter) {
            numbers[iter] = str.charCodeAt(iter)
        }

        return parser ((ps : ParserState) => { 
            var ch = ps.currentCharCode()

            if (ch === undefined) {
                return ps.fail<number>()
            }

            var indexOf = numbers.indexOf(ch)

            if (indexOf < 0) {
                return ps.fail<T>()
            }

            if (indexOf >= mapTo.length) {
                return ps.fail<T>()
            }

            ++ps.position

            return ps.succeed(mapTo[indexOf])
        })
    }

    // Parses a string whose characters are a member of str
    export function anyStringOf<T>(str : string) : Parser<string> {
        var numbers = []

        for (var iter = 0; iter < str.length; ++iter) {
            numbers[iter] = str.charCodeAt(iter)
        }

        return parser ((ps : ParserState) => { 
            var ch = 0
            var data : string[] = []

            var result = ps.advance((ch, pos) => numbers.indexOf(ch) > -1)

            return ps.succeed(result)
        })
    }

    // Parses EOS (end of stream)
    export function EOS() : Parser<void> {
        return parser ((ps : ParserState) => { 
            if (!ps.isEOS()) {
                return ps.fail<void>()
            }

            return ps.succeed<void>(undefined)
        })
    }

    // Parses EOL (end of line)
    export function EOL() : Parser<void> {
        return parser ((ps : ParserState) => { 
            if (ps.isEOS()) {
                return ps.succeed<void>(undefined)
            }

            if (ps.text[ps.position] === "\n") {
                ++ps.position

                return ps.succeed<void>(undefined)
            }

            if (ps.text[ps.position] === "\r") {
                ++ps.position

                if (!ps.isEOS() && ps.text[ps.position] === "\n") {
                    ++ps.position

                    return ps.succeed<void>(undefined)
                }

                return ps.succeed<void>(undefined)
            }

            return ps.fail<void>()
        })
    }

    // Parses a character that satisfy the predicate
    export function satisfy(satisfy : Satisfy) : Parser<number> {
        return parser ((ps : ParserState) => { 
            if (ps.isEOS()) {
                return ps.fail<number>()
            }

            var ch = ps.text.charCodeAt(ps.position)

            if (!satisfy(ch,0)) {
                return ps.fail<number>()
            }

            ++ps.position

            return ps.succeed(ch)
        })
    }

    // Parses a string that satisfy the predicate
    export function satisfyMany(satisfy : Satisfy) : Parser<string> {
        return parser ((ps : ParserState) => { return ps.succeed(ps.advance(satisfy)) })
    }

    // Skips characters that match the predicate
    export function skipSatisfyMany(satisfy : Satisfy) : Parser<number> {
        return parser ((ps : ParserState) => { return ps.succeed(ps.skipAdvance(satisfy)) })
    }

    // Satisfy function for whitespace
    export function satisyWhitespace(ch : number, pos : number) {
        switch(ch)
        {
        case 0x09:  // Tab
        case 0x0A:  // LF
        case 0x0D:  // CR
        case 0x20:  // Space
            return true
        default:
            return false
        }
    }

    // Satisfy function for tab
    export function satisyTab(ch : number, pos : number) {
        return ch === 0x09 // Tab
    }

    // Skips a string that matches str
    //  Typically used to parse tokens in file
    export function skipString(str : string) : Parser<void> {
        return parser ((ps : ParserState) => { 
            var snapshot = ps.snapshot()

            var ss = str

            var result = ps.skipAdvance((s, pos) => {
                return pos < ss.length && ss.charCodeAt(pos) === s
                })

            if (result === ss.length) {
                return ps.succeed<void>(undefined)
            } else {
                ps.restore(snapshot)
                return ps.fail<void>()
            }
        })
    }

    // Applies the parser until it fails and the value is an array of all successfully parsed values
    export function many<T>(p : Parser<T>) : Parser<T[]> {
        return parser ((ps : ParserState) => { 

            var result : T[] = []

            var pResult : ParseResult<T>

            while((pResult = p.parse(ps)).success) {
                result[result.length] = pResult.value
            }

            return ps.succeed(result)
        })
    }

    // Applies the character number parser and combines the characters into a string
    export function manyString(p : Parser<number>) : Parser<string> {
        return parser ((ps : ParserState) => { 

            var result = ""

            var pResult : ParseResult<number>

            var data : string[] = []

            while((pResult = p.parse(ps)).success) {
                data[data.length] = String.fromCharCode(pResult.value)
            }

            return ps.succeed(data.join(""))
        })
    }

    // Combines two parser results into a tuple value of both results
    export function combine2<T0, T1>(p0 : Parser<T0>, p1 : Parser<T1>) : Parser<{v0 : T0; v1 : T1}> {
        return parser ((ps : ParserState) => { 
            var snapshot = ps.snapshot()

            var p0Result = p0.parse(ps)

            if (!p0Result.success) {
                return ps.fail<{v0 : T0; v1 : T1}>()
            }

            var p1Result = p1.parse(ps)

            if (!p1Result.success) {
                ps.restore(snapshot)
                return ps.fail<{v0 : T0; v1 : T1}>()
            }

            var result = {v0 : p0Result.value, v1 : p1Result.value}

            return ps.succeed(result)
        })
    }

    // Combines three parser results into a tuple value of all results
    export function combine3<T0, T1, T2>(p0 : Parser<T0>, p1 : Parser<T1>, p2 : Parser<T2>) : Parser<{v0 : T0; v1 : T1; v2 : T2}> {
        return parser ((ps : ParserState) => { 
            var snapshot = ps.snapshot()

            var p0Result = p0.parse(ps)

            if (!p0Result.success) {
                return ps.fail<{v0 : T0; v1 : T1; v2 : T2}>()
            }

            var p1Result = p1.parse(ps)

            if (!p1Result.success) {
                ps.restore(snapshot)
                return ps.fail<{v0 : T0; v1 : T1; v2 : T2}>()
            }

            var p2Result = p2.parse(ps)

            if (!p2Result.success) {
                ps.restore(snapshot)
                return ps.fail<{v0 : T0; v1 : T1; v2 : T2}>()
            }

            var result = {v0 : p0Result.value, v1 : p1Result.value, v2 : p2Result.value}

            return ps.succeed(result)
        })
    }

    // chainLeft is typically used to implement left associative operators
    //  The p parser parser an expression
    //  The pSeparator parser parses the operator
    //  The combiner combines the result expressions into a new expression
    export function chainLeft<T,S>(p : Parser<T>, pSeparator : Parser<S>, combiner : Combiner<T,S>) : Parser<T> {
        return parser ((ps : ParserState) => { 

            var pResult = p.parse(ps)
            if(!pResult.success) {
                return ps.fail<T>()
            }

            var snapshot = ps.snapshot()

            var value = pResult.value

            var pSeparatorResult    : ParseResult<S>
            var pOtherResult        : ParseResult<T>

            while((pSeparatorResult = pSeparator.parse(ps)).success && (pOtherResult = p.parse(ps)).success) {
                snapshot = ps.snapshot()
                value = combiner(value, pSeparatorResult.value, pOtherResult.value)
            }

            ps.restore(snapshot)

            return ps.succeed(value)
        })
    }

    // choice applies each input parser in order and picks the first that matches
    export function choice<T>(... choices : Parser<T>[]) : Parser<T> {
        return parser ((ps : ParserState) => { 

            for (var iter = 0; iter < choices.length; ++iter) {
                var p = choices[iter]

                var pResult = p.parse(ps)

                if (pResult.success) {
                    return ps.succeed(pResult.value)
                }

            }

            return ps.fail<T>()
        })
    }

    // switch peeks on the first character and uses the associated parser
    // Note: Useful if the first character can be used as a differentiator
    export function switchOver<T>(defaultTo: Parser<T>, ... choices : {differentiator : string; parser : Parser<T>}[]) : Parser<T> {

        var map : Parser<T>[] = []

        for (var iter = 0; iter < choices.length; ++iter) {
            var choice = choices[iter]

            var d = choice.differentiator || ""

            for (var ita = 0; ita < d.length; ++ita) {
                map[d.charCodeAt(ita)] = choices[iter].parser
            }
        }
        
        return parser ((ps : ParserState) => { 
            var ch = ps.currentCharCode()

            if (ch === undefined) {
                return ps.fail<T>()
            }

            var p = map[ch]

            if (p === undefined) {
                return ps.fail<T>()
            }

            return p.parse(ps)
        })
    }

    // Special parser used to be break circular parsers (very common)
    export function circular<T>() : Parser<T> {
        return parser<T> (null)
    }
}
