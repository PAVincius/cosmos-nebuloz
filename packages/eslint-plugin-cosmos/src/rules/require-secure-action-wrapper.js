// Story-032: ESLint rule — server actions in app/actions/ must use withSecureAction
// AC-001: blocks unwrapped async export functions

function functionBodyContains(node, name) {
  if (!node.body) {
    return false;
  }
  const statements = node.body.body ?? [];
  for (const stmt of statements) {
    if (
      stmt.type === "ReturnStatement" &&
      stmt.argument?.type === "CallExpression" &&
      stmt.argument.callee?.name === name
    ) {
      return true;
    }
    if (
      stmt.type === "ExpressionStatement" &&
      stmt.expression?.type === "AwaitExpression" &&
      stmt.expression.argument?.type === "CallExpression" &&
      stmt.expression.argument.callee?.name === name
    ) {
      return true;
    }
    if (
      stmt.type === "VariableDeclaration" &&
      stmt.declarations?.some(
        (d) =>
          d.init?.type === "AwaitExpression" &&
          d.init.argument?.type === "CallExpression" &&
          d.init.argument.callee?.name === name
      )
    ) {
      return true;
    }
  }
  return false;
}

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require server actions in app/actions/ to be wrapped with withSecureAction",
      recommended: true,
    },
    schema: [],
    messages: {
      requireWrapper:
        "Server action must be wrapped with withSecureAction. Use withSecureAction(...) in this function body.",
    },
  },
  create(context) {
    return {
      ExportNamedDeclaration(node) {
        const filename = context.getFilename();
        if (!filename.includes("/app/actions/")) {
          return;
        }

        const decl = node.declaration;
        if (decl?.type !== "FunctionDeclaration" || !decl.async) {
          return;
        }

        const hasWrapper = functionBodyContains(decl, "withSecureAction");
        if (!hasWrapper) {
          context.report({
            node,
            messageId: "requireWrapper",
          });
        }
      },
    };
  },
};
