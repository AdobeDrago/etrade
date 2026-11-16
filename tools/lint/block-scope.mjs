import { basename, dirname } from 'node:path';
import selectorParser from 'postcss-selector-parser';
// ESLint 8 cannot resolve Stylelint's exports-only package.
// eslint-disable-next-line import/no-unresolved
import stylelint from 'stylelint';

const ruleName = 'etrade/block-scope';
const messages = stylelint.utils.ruleMessages(ruleName, {
  rejected: (selector, block) => `Scope "${selector}" to .${block}, its wrapper or its container`,
});

// A scope inside :not() cannot constrain the elements a selector matches.
function hasScope(selector, scopes) {
  return selector.nodes.some((node, index) => {
    // A sibling of the owner escapes; siblings of its descendants stay inside it.
    const next = selector.nodes.slice(index + 1).find((part) => part.type === 'combinator');
    if (next && ['+', '~'].includes(next.value.trim())) return false;
    if (node.type === 'class') return scopes.has(node.value);
    if (node.type === 'pseudo' && [':has', ':is', ':where'].includes(node.value)) {
      const branches = node.nodes || [];
      return branches.length > 0 && branches.every((branch) => hasScope(branch, scopes));
    }
    return false;
  });
}

const rule = (enabled) => (root, result) => {
  const valid = stylelint.utils.validateOptions(result, ruleName, {
    actual: enabled, possible: [true],
  });
  if (!valid) return;
  const { file } = root.source.input;
  if (!file) return;
  const block = basename(dirname(file));
  const scopes = new Set([block, `${block}-wrapper`, `${block}-container`]);
  root.walkRules((node) => {
    if (node.parent.type === 'atrule' && /keyframes$/i.test(node.parent.name)) return;
    selectorParser((selectors) => {
      selectors.each((selector) => {
        if (hasScope(selector, scopes)) return;
        stylelint.utils.report({
          ruleName,
          result,
          node,
          message: messages.rejected(selector.toString(), block),
          word: selector.toString(),
        });
      });
    }).processSync(node.selector);
  });
};

rule.ruleName = ruleName;
rule.messages = messages;
export default stylelint.createPlugin(ruleName, rule);
