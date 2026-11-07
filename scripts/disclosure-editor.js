const NUMBER_GROUP = /^[1-9]\d*(?:\s*,\s*[1-9]\d*)*$/;
const isSuperscript = (mark) => ['sup', 'superscript'].includes(mark.type.name)
  || mark.type.spec.parseDOM?.some((rule) => rule.tag === 'sup');
const usable = (view) => view && !view.isDestroyed && view.editable !== false
  && view.state?.doc && typeof view.dispatch === 'function';

/** Capture the entire selected superscript, including differently formatted text runs. */
export function superscriptSelection(view, choices) {
  if (!usable(view) || !view.state.schema.marks.link || !choices.length) return null;
  const { doc, selection } = view.state;
  const groups = [];
  doc.descendants((node, pos) => {
    if (!node.isText || !node.marks.some(isSuperscript)) return;
    const previous = groups.at(-1);
    if (previous?.to === pos) {
      previous.to += node.nodeSize;
      previous.text += node.text;
      previous.nodes.push({ node, pos });
    } else {
      groups.push({
        from: pos, to: pos + node.nodeSize, text: node.text, nodes: [{ node, pos }],
      });
    }
  });
  const matches = groups.filter((group) => selection.from >= group.from
    && selection.to <= group.to);
  if (matches.length !== 1) return null;
  const group = matches[0];
  if (!NUMBER_GROUP.test(group.text)) return null;
  const targets = new Map(choices.map((choice) => [choice.number, choice.href]));
  if (group.nodes.some(({ node }) => node.marks.some((mark) => mark.type.name === 'link'
    && ![...targets.values()].includes(mark.attrs.href)))) return null;
  const numbers = group.text.split(/\s*,\s*/);
  return {
    ...group,
    view,
    doc,
    anchor: selection.anchor,
    head: selection.head,
    numbers,
    targets,
    linkable: numbers.every((number) => targets.has(number)),
  };
}

/** Dispatch through DA's native transaction path; never mutate active editor DOM. */
export function applyDisclosureChoice(view, candidate, replacement) {
  if (!usable(view) || !candidate || candidate.view !== view || candidate.doc !== view.state.doc
    || candidate.anchor !== view.state.selection.anchor
    || candidate.head !== view.state.selection.head) return false;
  if (replacement !== undefined && !candidate.targets.has(replacement)) return false;
  if (replacement === undefined && !candidate.linkable) return false;
  const { schema } = view.state;
  const { link } = schema.marks;
  if (!link) return false;
  const { tr } = view.state;
  let { text } = candidate;
  if (replacement !== undefined) {
    text = replacement;
    const marks = candidate.nodes[0].node.marks.filter((mark) => mark.type !== link);
    tr.replaceWith(candidate.from, candidate.to, schema.text(text, marks));
  } else tr.removeMark(candidate.from, candidate.to, link);
  // Token ranges preserve all surrounding prose, superscript marks and rich formatting.
  [...text.matchAll(/[1-9]\d*/g)].forEach((match) => {
    const from = candidate.from + match.index;
    const mark = link.create({ href: candidate.targets.get(match[0]) });
    tr.addMark(from, from + match[0].length, mark);
  });
  view.dispatch(tr.scrollIntoView());
  return true;
}
