'use strict';

function scanExprs(now)
{
    const NO_PARENS         = ['', ''];
    const ROUND_PARENS      = ['(', ')'];
    const SQUARE_PARENS     = ['[', ']'];
    const SEPARATOR         = [' ', ''];
    
    const MINUS_ZERO        = Symbol(-0);
    
    const MIN_VALUE         = 0;
    const MAX_VALUE         = 100;
    
    const biMods =
    [
        {
            sign: '+',
            precedence: 4,
            fn: (value1, value2) => value1 + value2,
            useSpacing: isOpPlusPrefixed,
        },
        {
            sign: '+',
            precedence: 4,
            fn: concatValues,
            useParens1: () => SQUARE_PARENS,
            useSpacing: isOpPlusPrefixed,
        },
        {
            sign: '+',
            precedence: 4,
            fn: concatValues,
            useParens2: () => SQUARE_PARENS,
        },
        {
            sign: '-',
            precedence: 4,
            fn: (value1, value2) => value1 - value2,
            useSpacing: isOpMinusPrefixed,
        },
        { sign: '*', fn: (value1, value2) => value1 * value2, precedence: 3 },
        {
            sign: '/',
            precedence: 3,
            fn: (value1, value2) => value1 / value2,
        },
        { sign: '%', fn: (value1, value2) => value1 % value2, precedence: 3 },
        {
            sign: '**',
            precedence: 2,
            fn: (value1, value2) => value1 ** value2,
            useParens1: op1 => op1.precedence > 0 ? ROUND_PARENS : null,
        },
        { sign: '&', fn: (value1, value2) => value1 & value2, precedence: 6 },
        { sign: '^', fn: (value1, value2) => value1 ^ value2, precedence: 7 },
        { sign: '|', fn: (value1, value2) => value1 | value2, precedence: 8 },
        { sign: '<<', fn: (value1, value2) => value1 << value2, precedence: 5 },
        { sign: '>>', fn: (value1, value2) => value1 >> value2, precedence: 5 },
        { sign: '>>>', fn: (value1, value2) => value1 >>> value2, precedence: 5 },
    ];
    
    const uniMods =
    [
        {
            sign: '+',
            precedence: 1,
            fn: value => +value,
            useSpacing: isOpPlusPrefixed,
        },
        {
            sign: '-',
            precedence: 1,
            fn: value => -value,
            useSpacing: isOpMinusPrefixed,
        },
        {
            sign: '~',
            precedence: 1,
            fn: value => ~value,
        },
    ];
    
    const preOps =
    [
        { expr: '""', value: '', precedence: 0 },
        { expr: '!""', value: true, precedence: 1 }
    ];
    
    function applyBiMod(biMod, op1, op2)
    {
        const value = biMod.fn(op1.value, op2.value);
        if (isFinite(value))
        {
            const precedence = biMod.precedence;
            const useParens1 = biMod.useParens1;
            let parens1 = useParens1 ? useParens1(op1) : null;
            if (!parens1)
                parens1 = op1.precedence <= precedence ? NO_PARENS : ROUND_PARENS;
            const useParens2 = biMod.useParens2;
            let parens2 = useParens2 ? useParens2(op2) : null;
            if (!parens2)
            {
                if (op2.precedence < precedence)
                {
                    const useSpacing = biMod.useSpacing;
                    parens2 = useSpacing && useSpacing(op2) ? SEPARATOR : NO_PARENS;
                }
                else
                    parens2 = ROUND_PARENS;
            }
            const expr =
                parenthesize(op1.expr, parens1) + biMod.sign + parenthesize(op2.expr, parens2);
            const finding = { expr, value, precedence };
            return finding;
        }
    }
    
    function applyUniMod(uniMod, op)
    {
        const value = uniMod.fn(op.value);
        if (isFinite(value))
        {
            const precedence = uniMod.precedence;
            let parens;
            if (op.precedence <= precedence)
            {
                const useSpacing = uniMod.useSpacing;
                parens = useSpacing && useSpacing(op) ? SEPARATOR : NO_PARENS;
            }
            else
                parens = ROUND_PARENS;
            const expr = uniMod.sign + parenthesize(op.expr, parens);
            const finding = { expr, value, precedence };
            return finding;
        }
    }
    
    function chooseBetterFinding(finding1, finding2)
    {
        let diff = finding1.expr.length - finding2.expr.length;
        if (!diff)
            diff = finding1.precedence - finding2.precedence;
        return diff <= 0 ? finding1 : finding2;
    }
    
    function compareOps(op1, op2)
    {
        const MAX_HANDICAP_PRECEDENCE = 2;
        const MAX_HANDICAP_PLUS_MINUS = 1;
        
        const length1 = op1.expr.length;
        const length2 = op2.expr.length;
        if (length1 <= length2 - MAX_HANDICAP_PRECEDENCE)
            return -1;
        if (length1 >= length2 + MAX_HANDICAP_PRECEDENCE)
            return 1;
        const precedenceDiff = Math.sign(op1.precedence - op2.precedence);
        if (length1 <= length2 - MAX_HANDICAP_PLUS_MINUS)
            return precedenceDiff <= 0 ? -1 : NaN;
        if (length1 >= length2 + MAX_HANDICAP_PLUS_MINUS)
            return precedenceDiff >= 0 ? 1 : NaN;
        const plusDiff = isOpPlusPrefixed(op1) - isOpPlusPrefixed(op2);
        const minusDiff = isOpMinusPrefixed(op1) - isOpMinusPrefixed(op2);
        // Ignoring length difference at this point, since it must be 0.
        const minDiff = Math.min(precedenceDiff, plusDiff, minusDiff);
        const maxDiff = Math.max(precedenceDiff, plusDiff, minusDiff);
        if (minDiff === 0 && maxDiff === 0)
            return 0;
        if (minDiff < 0 && maxDiff <= 0)
            return -1;
        if (minDiff >= 0 && maxDiff > 0)
            return 1;
        return NaN;
    }
    
    function concatValues(value1, value2)
    {
        if (typeof value1 === 'number' && typeof value2 === 'number')
            return String(value1) + String(value2);
    }
    
    function consider(valueToFindingsMap, finding, exprLength)
    {
        if (finding && finding.expr.length === exprLength)
        {
            const value = finding.value;
            const valueKey = Object.is(value, -0) ? MINUS_ZERO : value;
            const newOps = [];
            {
                let willAdd = true;
                {
                    const oldOps = valueToFindingsMap.get(valueKey);
                    if (oldOps)
                    {
                        for (const op of oldOps)
                        {
                            const comparison = compareOps(finding, op);
                            if (comparison > 0)
                                return;
                            if (comparison === 0)
                                willAdd = false;
                            if (!comparison) // 0 or NaN
                                newOps.push(op);
                        }
                    }
                }
                if (willAdd)
                    newOps.push(finding);
            }
            valueToFindingsMap.set(valueKey, newOps);
        }
    }
    
    function createValueToFindingsMap()
    {
        const valueToFindingsMap = new Map();
        for (const preOp of preOps)
            consider(valueToFindingsMap, preOp, preOp.expr.length);
        {
            let exprLength = 2;
            do
                pass(valueToFindingsMap, ++exprLength);
            while (!isValueMapFull(valueToFindingsMap));
            valueToFindingsMap.maxExprLength = exprLength;
        }
        return valueToFindingsMap;
    }
    
    function isOpMinusPrefixed(op)
    {
        return op.expr.startsWith('-');
    }
    
    function isOpPlusPrefixed(op)
    {
        return op.expr.startsWith('+');
    }
    
    function isValueMapFull(valueToFindingsMap)
    {
        for (let value = MIN_VALUE; value <= MAX_VALUE; ++value)
        {
            if (!valueToFindingsMap.has(value))
                return false;
        }
        return true;
    }
    
    function parenthesize(expr, parens)
    {
        const result = `${parens[0]}${expr}${parens[1]}`;
        return result;
    }
    
    function pass(valueToFindingsMap, exprLength)
    {
        // A single iteration on a flattened list is much faster than nested iterations.
        const ops =
            [...valueToFindingsMap.values()].reduce(
                (prevOps, newOps) => prevOps.concat(newOps),
                []
            );
        ops.forEach(
            op1 =>
            {
                const restLength1 = exprLength - op1.expr.length;
                if (restLength1 >= 1 && restLength1 <= 3)
                {
                    uniMods.forEach(
                        uniMod =>
                        {
                            const finding = applyUniMod(uniMod, op1);
                            consider(valueToFindingsMap, finding, exprLength);
                        }
                    );
                }
                if (restLength1 >= 3)
                {
                    ops.forEach(
                        op2 =>
                        {
                            const restLength2 = restLength1 - op2.expr.length;
                            if (restLength2 >= 1 && restLength2 <= 7)
                            {
                                biMods.forEach(
                                    biMod =>
                                    {
                                        const restLength3 = restLength2 - biMod.sign.length;
                                        if (restLength3 >= 0 && restLength3 <= 4)
                                        {
                                            const finding = applyBiMod(biMod, op1, op2);
                                            consider(valueToFindingsMap, finding, exprLength);
                                        }
                                    }
                                );
                            }
                        }
                    );
                }
            }
        );
    }
    
    const t0 = now();
    const valueToFindingsMap = createValueToFindingsMap();
    const optimalExprs = new Map();
    for (let value = MIN_VALUE; value <= MAX_VALUE; ++value)
    {
        const findings = valueToFindingsMap.get(value);
        const finding = findings.reduce(chooseBetterFinding);
        optimalExprs[value] = finding.expr;
    }
    const time = now() - t0;
    const result =
    {
        optimalExprs,
        time,
        valueCount: valueToFindingsMap.size,
        maxExprLength: valueToFindingsMap.maxExprLength
    };
    return result;
}

if (typeof module !== 'undefined')
{
    const padStart =
        (obj, length) =>
        {
            const str = String(obj);
            return ' '.repeat(length - str.length) + str;
        };
    const now =
        () =>
        {
            const [secs, nonosecs] = process.hrtime();
            return secs * 1000 + nonosecs / 1000000;
        };
    const { optimalExprs, time, valueCount, maxExprLength } = scanExprs(now);
    const log = console.log;
    for (const value in optimalExprs)
    {
        const expr = optimalExprs[value];
        log('%s:  %s', padStart(`${value}`, 3), expr);
    }
    log('');
    log('Time elapsed:              %d ms', Math.round(time));
    log('Unique values mapped:      %d', valueCount);
    log('Maximum expression length: %d', maxExprLength);
}
