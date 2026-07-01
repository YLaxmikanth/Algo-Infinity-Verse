const fs = require('fs');
const c = fs.readFileSync('script.js', 'utf8');

// Count braces
const counts = {};
for (const ch of c) {
  if (ch === '{' || ch === '}' || ch === '(' || ch === ')' || ch === '[' || ch === ']') {
    counts[ch] = (counts[ch] || 0) + 1;
  }
}
console.log('Braces/brackets/parens counts:', counts);

// Find lines ending with unclosed template literal
const lines = c.split('\n');
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.includes('`')) {
    const backtickCount = (line.match(/`/g) || []).length;
    if (backtickCount % 2 !== 0) {
      console.log(`Possible unclosed template literal at line ${i + 1}: ${line}`);
    }
  }
}

// Find lines ending with unclosed string
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const singleQuotes = (line.match(/'/g) || []).length;
  const doubleQuotes = (line.match(/"/g) || []).length;
  if (singleQuotes % 2 !== 0) {
    console.log(`Possible unclosed single-quoted string at line ${i + 1}: ${line}`);
  }
  if (doubleQuotes % 2 !== 0) {
    console.log(`Possible unclosed double-quoted string at line ${i + 1}: ${line}`);
  }
}

// Check for block comments not closed
const blockCommentStart = (line.match(/\/\*/g) || []).length;
const blockCommentEnd = (line.match(/\*\//g) || []).length;
