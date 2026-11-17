import valueParser from 'postcss-value-parser';
// ESLint 8 cannot resolve Stylelint's exports-only package.
// eslint-disable-next-line import/no-unresolved
import stylelint from 'stylelint';

const ruleName = 'etrade/unitless-line-height';
const messages = stylelint.utils.ruleMessages(ruleName, {
  rejected: 'Use a unitless line height, including in font shorthands',
});

const rule = (enabled) => (root, result) => {
  const valid = stylelint.utils.validateOptions(result, ruleName, {
    actual: enabled, possible: [true],
  });
  if (!valid) return;
  root.walkDecls(/^(font|line-height|--line-height(?:-.+)?)$/i, (decl) => {
    const parsed = valueParser(decl.value);
    let { nodes } = parsed;
    if (decl.prop.toLowerCase() === 'font') {
      const slash = nodes.findIndex((node) => node.type === 'div' && node.value === '/');
      if (slash < 0) return; // Inherited/system fonts and shorthands without explicit line height.
      const height = nodes.slice(slash + 1).find((node) => node.type !== 'space');
      nodes = height ? [height] : [];
    }
    let dimensional = false;
    valueParser.walk(nodes, (node) => {
      if (node.type !== 'word') return;
      const dimension = valueParser.unit(node.value);
      if (dimension?.unit) dimensional = true;
    });
    if (!dimensional) return;
    stylelint.utils.report({
      ruleName, result, node: decl, message: messages.rejected, word: decl.value,
    });
  });
};

rule.ruleName = ruleName;
rule.messages = messages;
export default stylelint.createPlugin(ruleName, rule);
