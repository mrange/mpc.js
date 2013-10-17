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

module mpc {

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

    export class Snapshot {
        position    : number
        indent      : number
    }

    export interface Satisfy {
        (ch : number, pos : number) : boolean
    }

    export interface Combiner<T,S> {
        (left : T, op : S, right : T) : T
    }

    export class ParserState {
        text    : string
        position: number
        indent  : number

        constructor (s : string) {
            this.text       = s || ""
            this.position   = 0
            this.indent     = 0
        }

        snapshot() : Snapshot {
            return { position : this.position, indent : this.indent }
        }

        increaseIndent() : void {
            ++this.indent
        }

        decreaseIndent() : boolean {
            if (this.indent < 1) {
                return false
            }

            --this.indent

            return true
        }

        restore(snapshot : Snapshot) {
            this.position   = snapshot.position
            this.indent     = snapshot.indent
        }

        isEOS() : boolean {
            return this.position >= this.text.length
        }

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

        succeed<T>(value : T) : ParseResult<T> {
            return {state : this, success : true , value : value}
        }

        fail<T>() : ParseResult<T> {
            return {state : this, success : false , value : undefined}
        }

    }

    export class ParseResult<T> {
        state   : ParserState
        success : boolean
        value   : T
    }

    export class Parser<T> {
        parse       :   (ps : ParserState) => ParseResult<T>

        constructor (p : (ps : ParserState) => ParseResult<T>) {
            this.parse = p
        }

        noResult() : Parser<void> {
            return parser ((ps : ParserState) => { 
                var pResult = this.parse(ps)
                
                if (!pResult.success) {
                    return ps.fail<void>()
                }

                return ps.succeed<void>(undefined)
            })
        }

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

        opt() : Parser<T> {
            return parser ((ps : ParserState) => { 

                var pResult = this.parse(ps)

                if (!pResult.success) {
                    return ps.succeed<T>(null)
                }

                return ps.succeed(pResult.value)
            })
        }

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

    export function parser<T> (p : (ps : ParserState) => ParseResult<T>) {
        return new Parser<T> (p)
    }

    export function parse<T>(p : Parser<T>, s : string) : ParseResult<T> {
        var ps = new ParserState(s)
        return p.parse(ps)
    }

    export function success<T>(value : T) : Parser<T> {
        return parser ((ps : ParserState) => { return ps.succeed(value) })
    }

    export function fail<T>() : Parser<T> {
        return parser ((ps : ParserState) => { return ps.fail<T>() })
    }

   
    export function indent() : Parser<void> {
        return parser ((ps : ParserState) => { 
            ps.increaseIndent()
            return ps.succeed<void>(undefined)
        })
    }

    export function dedent() : Parser<void> {
        return parser ((ps : ParserState) => { 
            if (!ps.decreaseIndent()) {
                return ps.fail<void>()
            }
            return ps.succeed<void>(undefined)
        })
    }

    export function anyChar() : Parser<number> {
        return parser ((ps : ParserState) => { 
            if (ps.isEOS()) {
                return ps.fail<number>()
            }

            var ch = ps.text.charCodeAt(ps.position)

            ++ps.position

            return ps.succeed(ch)
        })
    }

    export function anyCharOf<T>(str : string, mapper : (number) => T) : Parser<T> {
        var numbers = []

        for (var iter = 0; iter < str.length; ++iter) {
            numbers[iter] = str.charCodeAt(iter)
        }

        return parser ((ps : ParserState) => { 
            if (ps.isEOS()) {
                return ps.fail<number>()
            }

            var ch = ps.text.charCodeAt(ps.position)

            var indexOf = numbers.indexOf(ch)

            if (indexOf < 0) {
                return ps.fail<number>()
            }

            ++ps.position

            return ps.succeed(mapper(indexOf))
        })
    }

    export function anyStringOf<T>(str : string) : Parser<string> {
        var numbers = []

        for (var iter = 0; iter < str.length; ++iter) {
            numbers[iter] = str.charCodeAt(iter)
        }

        return parser ((ps : ParserState) => { 
            var ch = 0
            var data : string[] = []

            while (!ps.isEOS() && numbers.indexOf((ch = ps.text.charCodeAt(ps.position))) > -1)
            {
                data[data.length] = String.fromCharCode(ch)
                ++ps.position
            }

            return ps.succeed(data.join(""))
        })
    }

    export function EOS() : Parser<void> {
        return parser ((ps : ParserState) => { 
            if (!ps.isEOS()) {
                return ps.fail<void>()
            }

            return ps.succeed<void>(undefined)
        })
    }

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

    export function satisfyMany(satisfy : Satisfy) : Parser<string> {
        return parser ((ps : ParserState) => { return ps.succeed(ps.advance(satisfy)) })
    }

    export function skipSatisfyMany(satisfy : Satisfy) : Parser<number> {
        return parser ((ps : ParserState) => { return ps.succeed(ps.skipAdvance(satisfy)) })
    }

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

    export function satisyTab(ch : number, pos : number) {
        return ch === 0x09 // Tab
    }

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

    export function combine<T0, T1>(p0 : Parser<T0>, p1 : Parser<T1>) : Parser<{v0 : T0; v1 : T1}> {
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

    export function anyIndention() : Parser<number> {
        return skipSatisfyMany(satisyWhitespace)
    }

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

    export function circular<T>() : Parser<T> {
        return parser<T> (null)
    }
}