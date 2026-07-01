#!/usr/bin/env python3
# Simple JS syntax checker for unclosed parens, braces, brackets, backticks
import re

with open('script.js', 'r', encoding='utf-8') as f:
    code = f.read()

lines = code.split('\n')

# Track brace/bracket/paren depth, considering strings/comments/template literals
stack = []
depth = {'[': 0, '{': 0, '(': 0, '`': 0}

# We'll do a character-level walk with state tracking
in_string = None  # None, "'", '"', '`', '//', '/*'
string_start_line = 0
issues = []

i = 0
while i < len(code):
    ch = code[i]
    
    if in_string in (None, '//', '/*'):
        if ch == '/' and i + 1 < len(code):
            nxt = code[i + 1]
            if nxt == '/' and in_string is None:
                in_string = '//'
                string_start_line = code[:i].count('\n') + 1
                i += 2
                continue
            elif nxt == '*' and in_string is None:
                in_string = '/*'
                string_start_line = code[:i].count('\n') + 1
                i += 2
                continue
        elif ch == '\n' and in_string == '//':
            in_string = None
            i += 1
            continue
        elif ch == '*' and in_string == '/*' and i + 1 < len(code) and code[i + 1] == '/':
            in_string = None
            i += 2
            continue
        elif ch in ('\'', '"', '`') and in_string is None:
            in_string = ch
            string_start_line = code[:i].count('\n') + 1
            i += 1
            continue
        elif ch in '([{':
            depth[ch] += 1
        elif ch in ')]}':
            if ch == ')' and depth['('] > 0:
                depth['('] -= 1
            elif ch == ']' and depth['['] > 0:
                depth['['] -= 1
            elif ch == '}' and depth['{'] > 0:
                depth['{'] -= 1
            elif ch == '}' and in_string is None:
                # Could be a stray }
                pass
        i += 1
    else:
        # Inside string or template literal
        if ch == '\\' and i + 1 < len(code):
            i += 2  # skip escaped char
            continue
        if ch == in_string:
            in_string = None
        i += 1

print('Final depths:', depth)
for k, v in depth.items():
    if v != 0:
        print(f'  {k}: {v}')

# Let's also do a simpler approach: find unclosed template literals more accurately
print('\n--- Scanning for unclosed template literals (line-by-line) ---')
in_tmpl = False
unclosed_lines = []
for lineno, line in enumerate(lines, 1):
    j = 0
    while j < len(line):
        ch = line[j]
        if ch == '`' and not in_tmpl:
            in_tmpl = True
            j += 1
            continue
        elif ch == '`' and in_tmpl:
            in_tmpl = False
        elif ch == '$' and j + 1 < len(line) and line[j + 1] == '{' and in_tmpl:
            pass  # template interpolation
        j += 1
    if in_tmpl:
        unclosed_lines.append(lineno)

print('Unclosed template literals at lines:', unclosed_lines[:20])

# Try to find lines around the end that might have issues
print('\n--- Last 10 lines ---')
for lineno, line in enumerate(lines[-10:], len(lines) - 9):
    print(f'{lineno}: {line}')
