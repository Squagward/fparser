/**
 * JS Formula Parser
 * -------------------
 * This is taken from https://github.com/bylexus/fparse but with additions.
 * I already got permission from Alex to use this so you can use this as you wish.
 * 
 * For the module repository, visit https://github.com/Squagward/fparser
 */
export class Formula {
  static mappings = new Map();

  constructor(fStr, topFormula = null) {
    this.variables = [];
    this.topFormula = topFormula;

    this.formulaStr = fStr;
    this.formulaExpression = this.parse(fStr);

    return this;
  }

  /**
   * Add custom `Math` class mappings to names of your choosing.  
   * `Formula.addMappings({ "ln": "log" });`  
   * This allows the user to input `ln(x)`. 
   *
   * `Formula.addMappings({ "ln": "log", "func": "log10" });`  
   * Now when the user inputs `log(x)` or `ln(x)` it returns the natural log,
   * but when they input `func(x)` it now returns log base 10.
   */
  static addMappings(valueObj) {
    for ([key, val] of Object.entries(valueObj)) {
      // add the key value pairs to the Formula class
      Formula.mappings.set(key, val);
    }
  }

  /**
   * Splits the given string by ",", makes sure the "," is not within
   * a sub-expression
   * e.g.: str = "x,pow(3,4)" returns 2 elements: x and pow(3,4).
   */
  splitFunctionParams(toSplit) {
    // do not split on "," within matching brackets.
    let pCount = 0,
      paramStr = "";
    const params = [];
    for (let i = 0; i < toSplit.length; i++) {
      if (toSplit[i] === "," && pCount === 0) {
        // Found function param, save 'em
        params.push(paramStr);
        paramStr = "";
      } else if (toSplit[i] === "(") {
        pCount++;
        paramStr += toSplit[i];
      } else if (toSplit[i] === ")") {
        pCount--;
        paramStr += toSplit[i];
        if (pCount < 0) {
          throw "ERROR: Too many closing parentheses!";
        }
      } else {
        paramStr += toSplit[i];
      }
    }
    if (pCount !== 0) {
      throw "ERROR: Too many opening parentheses!";
    }
    if (paramStr.length > 0) {
      params.push(paramStr);
    }
    return params;
  }

  /**
   * Cleans the input string from unnecessary whitespace,
   * and replaces some known constants:
   */
  cleanupInputString(s) {
    const constants = ["PI", "E", "LN2", "LN10", "LOG2E", "LOG10E", "SQRT1_2", "SQRT2"];

    s = s.replace(/[\s]+/, "");
    constants.forEach(c => {
      s = s.replace(new RegExp(`([^\w]+|^)${c}([^A-Za-z]+|$)`), `$1${Math[c]}$2`);
    });
    return s;
  }

  /**
   * So... How do we parse a formula?
   * first, we have to split the items into "expressions": An expression can be:
   *   - a number, e.g. "3.45"
   *   - an unknown variable, e.g. "x"
   *   - a single char operator, such as "*","+" etc...
   *   - a named variable, in [], e.g. [myvar]
   *   - a function, such as sin(x)
   *   - a parenthessed expression, containing other expressions
   *
   * So where do we begin....? at the beginning, I would say: Parse the string from
   * left to right, using a state machine: each time a char is read, decide which
   * state we are in or into which state we have to change.
   */
  parse(str) {
    // First of all: Away with all we don't have a need for:
    // Additionally, replace some constants:
    str = this.cleanupInputString(str);

    let lastChar = str.length - 1,
      index = 0,
      state = 0,
      expressions = [],
      char = "",
      tmp = "",
      funcName = null,
      pCount = 0;

    while (index <= lastChar) {
      switch (state) {
        case 0:
          // None state, the beginning. Read a char and see what happens.
          char = str.charAt(index);
          if (char.match(/[0-9.]/)) {
            // found the beginning of a number, change state to "within-number"
            state = "within-nr";
            tmp = "";
            index--;
          } else if (this.isOperator(char)) {
            // Simple operators. Note: "-" must be treated specifically,
            // it could be part of a number.
            // it MUST be part of a number if the last found expression
            // was an operator (or the beginning):
            if (char === "-") {
              if (
                expressions.length === 0 ||
                (expressions[expressions.length - 1] && typeof expressions[expressions.length - 1] === "string")
              ) {
                state = 0;
                tmp = "";
                expressions.push(-1, "*");
                break;
              }
            }

            // Found a simple operator, store as expression:
            if (
              (index === lastChar || this.isOperator(expressions[index - 1])) &&
              !expressions[index - 1].match(/[\*\^]/)
            ) {
              state = -1; // invalid to end with an operator, or have 2 operators in conjunction
              break;
            } else {
              expressions.push(char);
              state = 0;
            }
          } else if (char === "(") {
            // add a check if an expression just finished and about to start a new one
            if (str.charAt(index - 1).match(/[a-zA-Z0-9\)\]\-]/)) {
              expressions.push("*");
            }

            // left parenthes found, seems to be the beginning of a new sub-expression:
            state = "within-parentheses";
            tmp = "";
            pCount = 0;
          } else if (char === "[") {

            // add a check if an expression just finished and about to start a new one
            if (str.charAt(index - 1).match(/[a-zA-Z0-9\)\]\-]/)) {
              expressions.push("*");
            }

            // left named var separator char found, seems to be the beginning of a named var:
            state = "within-named-var";
            tmp = "";
          } else if (char.match(/[a-zA-Z]/)) {
            // multiple chars means it may be a function, else its a var which counts as own expression:
            if (index < lastChar && str.charAt(index + 1).match(/[a-zA-Z]/)) {
              // check for coefficient
              if (str.charAt(index - 1).match(/[0-9]/)) {
                expressions.push("*");
              }
              tmp = char;
              state = "within-func";
            } else {
              // Single variable found:
              // We need to check some special considerations:
              // - If the last char was a number (e.g. 3x), we need to create a multiplication out of it (3*x)
              if (expressions.length > 0) {
                if (typeof expressions[expressions.length - 1] === "number") {
                  expressions.push("*");
                }
              }
              expressions.push(this.createVariableEvaluator(char));
              this.registerVariable(char);
              state = 0;
              tmp = "";
            }
          }
          break;

        case "within-nr":
          char = str.charAt(index);
          if (char.match(/[0-9.]/)) {
            //Still within number, store and continue
            tmp += char;
            if (index === lastChar) {
              expressions.push(Number(tmp));
              state = 0;
            }
          } else {
            // Number finished on last round, so add as expression:
            expressions.push(Number(tmp));
            tmp = "";
            state = 0;
            index--;
          }
          break;

        case "within-func":
          char = str.charAt(index);
          if (char.match(/[a-zA-Z0-9]/)) {
            tmp += char;
          } else if (char === "(") {
            funcName = tmp;
            tmp = "";
            pCount = 0;
            state = "within-func-parentheses";
          } else {
            throw new Error(`Wrong character for function at position ${index}`);
          }
          break;

        case "within-named-var":
          char = str.charAt(index);
          if (char === "]") {
            // end of named var, create expression:
            expressions.push(this.createVariableEvaluator(tmp));
            this.registerVariable(tmp);

            // add a check if a new expression is coming up and just ended one
            if (str.charAt(index + 1).match(/[a-zA-Z0-9\(\[]/)) { // by Squagward
              expressions.push("*");
            }

            tmp = "";
            state = 0;
          } else if (char.match(/\w/)) {
            tmp += char;
          } else {
            throw new Error(`Character not allowed within named variable: ${char}`);
          }
          break;

        case "within-parentheses":
        case "within-func-parentheses":
          char = str.charAt(index);
          if (char === ")") {
            //Check if this is the matching closing parenthesis.If not, just read ahead.
            if (pCount <= 0) {
              // Yes, we found the closing parenthesis, create new sub-expression:
              if (state === "within-parentheses") {
                expressions.push(new Formula(tmp, this));
              } else if (state === "within-func-parentheses") {
                // Function found: return a function that,
                // when evaluated, evaluates first the sub-expression
                // then returns the function value of the sub-expression.
                // Access to the function is private within the closure:
                expressions.push(this.createFunctionEvaluator(tmp, funcName));
                funcName = null;
              }
              if (str.charAt(index + 1).match(/[a-zA-Z0-9]/)) {
                expressions.push("*");
              }
              state = 0;
            } else {
              pCount--;
              tmp += char;
            }
          } else if (char === "(") {
            // begin of a new sub-parenthesis, increase counter:
            pCount++;
            tmp += char;
          } else {
            // all other things are just added to the sub-expression:
            tmp += char;
          }
          break;
      }
      index++;
    }

    if (state !== 0) {
      throw new Error("Could not parse formula: Syntax error.");
    }

    return expressions;
  }

  isOperator(char) {
    return typeof char === "string" && char.match(/[\+\-\*\/\^]/);
  }

  registerVariable(varName) {
    if (this.topFormula instanceof Formula) {
      this.topFormula.registerVariable(varName);
    } else {
      if (this.variables.indexOf(varName) < 0) {
        this.variables.push(varName);
      }
    }
  }

  getVariables() {
    if (this.topFormula instanceof Formula) {
      return this.topFormula.variables;
    } else {
      return this.variables;
    }
  }

  /**
   * here we do 3 steps:
   * 1) evaluate (recursively) each element of the given array so that
   *    each expression is broken up to a simple number.
   * 2) now that we have only numbers and simple operators left,
   *    calculate the high value operator sides (*,/)
   * 3) last step, calculate the low value operators (+,-), so
   *    that in the end, the array contains one single number.
   * Return that number, aka the result.
   */
  evaluate(valueObj) {
    let i = 0,
      item = 0,
      left = null,
      right = null,
      runAgain = true;
    const results = [];

    if (valueObj instanceof Array) {
      for (i = 0; i < valueObj.length; i++) {
        results[i] = this.evaluate(valueObj[i]);
      }
      return results;
    }

    // Step 0: do a working copy of the array:
    const workArr = [];
    for (i = 0; i < this.getExpression().length; i++) {
      workArr.push(this.getExpression()[i]);
    }
    // Step 1, evaluate
    for (i = 0; i < workArr.length; i++) {
      /**
       * An element can be:
       *  - a number, so just let it alone for now
       *  - a string, which is a simple operator, so just let it alone for now
       *  - a function, which must return a number: execute it with valueObj
       *    and replace the item with the result.
       *  - another Formula object: resolve it recursively using this function and
       *    replace the item with the result
       */
      item = workArr[i];
      if (typeof item === "function") {
        workArr[i] = item(valueObj);
      } else if (item instanceof Formula) {
        workArr[i] = item.evaluate(valueObj);
      } else if (typeof item !== "number" && typeof item !== "string") {
        console.error("UNKNOWN OBJECT IN EXPRESSIONS ARRAY!", item);
        throw new Error("Unknown object in Expressions array");
      }
    }

    // Now we should have a number-only array, let's evaulate the "^" operator:
    while (runAgain) {
      runAgain = false;
      for (i = 0; i < workArr.length; i++) {
        item = workArr[i];
        if (typeof item === "string" && item === "^") {
          if (i === 0 || i === workArr.length - 1) {
            throw "Wrong operator position!";
          }
          left = Number(workArr[i - 1]);
          right = Number(workArr[i + 1]);
          workArr[i - 1] = Math.pow(left, right);
          workArr.splice(i, 2);
          runAgain = true;
          break;
        }
      }
    }

    // Now we should have a number-only array, let's evaulate the "*","/" operators:
    runAgain = true;
    while (runAgain) {
      runAgain = false;
      for (i = 0; i < workArr.length; i++) {
        item = workArr[i];
        if (typeof item === "string" && (item === "*" || item === "/")) {
          if (i === 0 || i === workArr.length - 1) {
            throw "Wrong operator position!";
          }
          left = Number(workArr[i - 1]);
          right = Number(workArr[i + 1]);
          workArr[i - 1] = item === "*" ? left * right : left / right;
          workArr.splice(i, 2);
          runAgain = true;
          break;
        }
      }
    }

    // Now we should have a number-only array, let's evaulate the "+","-" operators:
    runAgain = true;
    while (runAgain) {
      runAgain = false;
      for (i = 0; i < workArr.length; i++) {
        item = workArr[i];
        if (typeof item === "string" && (item === "+" || item === "-")) {
          if (i === 0 || i === workArr.length - 1) {
            throw new Error("Wrong operator position!");
          }
          left = Number(workArr[i - 1]);
          right = Number(workArr[i + 1]);
          workArr[i - 1] = item === "+" ? left + right : left - right;
          workArr.splice(i, 2);
          runAgain = true;
          break;
        }
      }
    }

    // In the end the original array should be reduced to a single item,
    // containing the result:
    return workArr[0];
  }

  getExpression() {
    return this.formulaExpression;
  }

  /**
   * Returns a function which acts as an expression for functions:
   * Its inner arguments are parsed, split by comma, and evaluated
   * first when then function is executed.
   *
   * Used for e.g. evaluate things like "max(x*3,20)"
   *
   * The returned function is called later by evaluate(), and takes
   * an evaluation object with the needed values.
   */
  createFunctionEvaluator(arg, fname) {
    // Functions can have multiple params, comma separated.
    // Split them:
    let args = this.splitFunctionParams(arg),
      me = this;
    for (let i = 0; i < args.length; i++) {
      args[i] = new Formula(args[i], me);
    }
    // Args now is an array of function expressions:
    return function (valueObj) {
      const innerValues = [];
      for (let i = 0; i < args.length; i++) {
        innerValues.push(args[i].evaluate(valueObj));
      }


      // If the valueObj itself has a function definition with
      // the function name, call this one:
      if (valueObj && typeof valueObj[fname] === "function") {
        return valueObj[fname].apply(me, innerValues);
      } else if (typeof me[fname] === "function") {
        // perhaps the Formula object has the function? so call it:
        return me[fname].apply(me, innerValues);
      } else if (typeof Math[Formula.mappings.get(fname)] === "function") {
        return Math[Formula.mappings.get(fname)].apply(me, innerValues);
      } else if (typeof Math[fname] === "function") {
        // Has the JS Math object a function as requested? Call it:
        return Math[fname].apply(me, innerValues);
      } else {
        throw `Function not found: ${fname}`;
      }
    };
  }

  /**
   * Returns a function which acts as an expression evaluator for variables:
   * It creates an intermediate function that is called by the evaluate() function
   * with a value object. The function then returns the value from the value
   * object, if defined.
   */
  createVariableEvaluator(varname) {
    return function (valObj = {}) {
      // valObj contains a variable / value pair: If the variable matches
      // the varname found as expression, return the value.
      // eg: valObj = {x: 5,y:3}, varname = x, return 5
      if (valObj[varname] !== undefined) {
        return valObj[varname];
      } else {
        throw new Error(`Cannot evaluate ${varname}: No value given`);
      }
    };
  }

  static calc(formula, valueObj = {}) {
    return new Formula(formula).evaluate(valueObj);
  }
}
export default Formula;

/**
 * Known issues:
 * xy doesn't equal x*y
 */