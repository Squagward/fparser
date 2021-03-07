# fparser

> A JavaScript Formula Parser

fparser provides a Formula class that parses strings containing mathematical formulas (e.g. `x*sin(PI*x/2)`) into an evaluationable object.
One can then provide values for all unknown variables / functions and evaluate a numeric value from the formula.

For an example application, see **coming soon**.

## Features

Parses a mathematical formula from a string. Known expressions:

- _Numbers_ in the form of digits (e.g. `-133.2945`)
- _simple operators_: '+','-','\*','/', '^' expanded in correct order
- _parentheses_ '(', ')' for grouping (e.g. `5*(3+2)`)
- all _JavaScript Math object functions_ (e.g. `sin(3.14)`)
- all _JavaScript Math constants_ like PI, E
- the use of _own functions_
- the use of single-char _variables_ (like `2x`)
- the use of named variables (like `2*[myVar]`)
- Example:  
  `-1*(sin(2^x)/(PI*x))*cos(x))`

## Usage

Import using any of these methods:

```javascript
import Formula from "fparser";
import Formula from "../fparser";
import { Formula } from "fparser";
import { Formula } from "../fparser";
```

```javascript
// 1. Create a Formula object instance by passing a formula string:
const fObj = new Formula("2^x");

// 2. evaluate the formula, delivering a value object for each unknown entity:
const result = fObj.evaluate({ x: 3 }); // result = 8

// or deliver multiple value objects to return multiple results:
const results = fObj.evaluate([{ x: 2 }, { x: 4 }, { x: 8 }]); // results = [4,16,256]

// You can also directly evaluate a value if you only need a one-shot result:
const result = Formula.calc("2^x", { x: 3 }); // result = 8
const results = Formula.calc("2^x", [{ x: 2 }, { x: 4 }, { x: 8 }]); // results = [4,16,256]
```

## Advanced Usage

### Using multiple variables

```javascript
const fObj = new Formula("a*x^2 + b*x + c");

// Just pass a value object containing a value for each unknown variable:
const result = fObj.evaluate({ a: 2, b: -1, c: 3, x: 3 }); // result = 18
```

### Using named variables

Instead of single-char variables (like `2x+y`), you can also use named variables in brackets:

```javascript
const fObj = new Formula("2*[var1] + sin([var2]+PI)");

// Just pass a value object containing a value for each named variable:
const result = fObj.evaluate({ var1: 5, var2: 0.7 });
```

### Using user-defined functions

```javascript
const fObj = new Formula('sin(inverse(x))');

//Define the function(s) on the Formula object, then use it multiple times:
// fObj.inverse = value => 1 / value; // Does not work due to rhino I think
//const results = fObj.evaluate({ x: 1, x: 2, x: 3 });


// Or pass it in the value object, and OVERRIDE an existing function:
// This way works!
const result = fObj.evaluate({
	x: 2 / Math.PI,
	inverse: value =>  -1 * value
});

If defined in the value object AND on the formula object, the Value object has the precedence
```

### Get all used variables

```javascript
// Get all used variables in the order of their appereance:
const f4 = new Formula("x*sin(PI*y) + y / (2-x*[var1]) + [var2]");
console.log(f4.getVariables()); // ['x','y','var1','var2']
```

### Adding custom Math function names

```javascript
// Rename the Math method of your choice to something else
Formula.addMappings([{ ln: "log" }, { log: "log10" }]);
console.log(Formula.calc("log(x)", { x: 10 })); // 1
// This would be 2.3025... if it was using Math.log(10)
console.log(Formula.calc("ln(x)", { x: 10 })); // 2.3025...
```

# Credit:

- This is taken from https://github.com/bylexus/fparse with changes
- I have contacted Alex (original creator) and he said it was fine for me to upload.
