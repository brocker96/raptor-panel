<?php

namespace Raptor\Services\Databases\Manager;

/**
 * Splits a SQL script into single statements, respecting quotes, comments and DELIMITER commands
 * the way the mysql client does, so dumps and stored procedures can be run statement by statement.
 */
class SqlSplitter
{
    /**
     * @return \Generator<int, string>
     */
    public static function split(string $sql): \Generator
    {
        $delimiter = ';';
        $buffer = '';
        // Whether the buffer holds more than whitespace, tracked to avoid trimming it on every character.
        $content = false;
        $length = strlen($sql);
        $i = 0;

        while ($i < $length) {
            $char = $sql[$i];
            $next = $sql[$i + 1] ?? '';

            // DELIMITER commands are only recognised at the start of a statement.
            if (!$content && preg_match('/\GDELIMITER[ \t]+(\S+)[^\n]*(\n|$)/Ai', $sql, $match, 0, $i)) {
                $delimiter = $match[1];
                $buffer = '';
                $i += strlen($match[0]);
                continue;
            }

            if (($char === '-' && $next === '-' && in_array($sql[$i + 2] ?? "\n", [' ', "\t", "\n", "\r"], true)) || $char === '#') {
                $end = strpos($sql, "\n", $i);
                $i = $end === false ? $length : $end + 1;
                $buffer .= "\n";
                continue;
            }

            if ($char === '/' && $next === '*') {
                $end = strpos($sql, '*/', $i + 2);
                $end = $end === false ? $length : $end + 2;
                // Keep executable comments such as /*!40101 SET ... */.
                if (($sql[$i + 2] ?? '') === '!') {
                    $buffer .= substr($sql, $i, $end - $i);
                    $content = true;
                }
                $i = $end;
                continue;
            }

            if ($char === "'" || $char === '"' || $char === '`') {
                $j = $i + 1;
                while ($j < $length) {
                    if ($sql[$j] === '\\' && $char !== '`') {
                        $j += 2;
                        continue;
                    }
                    if ($sql[$j] === $char) {
                        if (($sql[$j + 1] ?? '') === $char) {
                            $j += 2;
                            continue;
                        }
                        break;
                    }
                    ++$j;
                }
                $buffer .= substr($sql, $i, $j - $i + 1);
                $content = true;
                $i = $j + 1;
                continue;
            }

            if (substr_compare($sql, $delimiter, $i, strlen($delimiter)) === 0) {
                if ($content) {
                    yield trim($buffer);
                }
                $buffer = '';
                $content = false;
                $i += strlen($delimiter);
                continue;
            }

            // Copy plain text up to the next character that needs attention in one go.
            $span = $content ? max(1, strcspn($sql, "-#/'\"`" . $delimiter[0], $i)) : 1;
            $buffer .= substr($sql, $i, $span);
            $content = $content || !ctype_space($char);
            $i += $span;
        }

        if (trim($buffer) !== '') {
            yield trim($buffer);
        }
    }
}
