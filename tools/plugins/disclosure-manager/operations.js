import { readSource, sourceUrl } from './model.js';
import { readSiteInventory } from './inventory.js';

const ROOT = '/.da/disclosure-manager/renumber-jobs';
const STATUSES = new Set(['prepared', 'writing', 'complete', 'restoring', 'restored', 'recovery-required']);

async function hash(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function recordPath(context, setPath) {
  sourceUrl(context, setPath);
  return `${ROOT}/${await hash(setPath)}.json`;
}

function validateWrites(context, value) {
  if (!Array.isArray(value.writes) || !value.writes.length || value.writes.length > 5000) {
    throw new Error('Invalid recovery write list.');
  }
  const paths = new Set();
  value.writes.forEach((write) => {
    sourceUrl(context, write.path);
    if (write.path.split('/').some((part) => part.startsWith('.')) || paths.has(write.path)
      || typeof write.original !== 'string' || typeof write.target !== 'string'
      || !['citations', 'set'].includes(write.kind)) throw new Error('Invalid recovery source path or snapshot.');
    paths.add(write.path);
  });
  if (value.writes.at(-1).path !== value.setPath || value.writes.at(-1).kind !== 'set'
    || value.writes.filter((write) => write.kind === 'set').length !== 1) {
    throw new Error('The disclosure set must be the last and only set write.');
  }
}

async function validateOperation(context, operation) {
  if (operation?.version !== 1
    || operation.org !== context.org || operation.repo !== context.repo) {
    throw new Error('This recovery operation belongs to a different site or context.');
  }
  if (typeof operation.id !== 'string' || !/^[a-f0-9-]{36}$/.test(operation.id)
    || !STATUSES.has(operation.status)) throw new Error('Invalid recovery operation.');
  validateWrites(context, operation);
  await Promise.all(operation.writes.map(async (write) => {
    if (write.originalHash !== await hash(write.original)
      || write.targetHash !== await hash(write.target)) throw new Error('Recovery snapshots failed integrity validation.');
  }));
}

/** A failed or timed-out POST is resolved by reading its actual stored result. */
async function writeExact(context, path, source, request) {
  const body = new FormData();
  const json = path.endsWith('.json');
  body.append('data', new Blob([source], { type: json ? 'application/json' : 'text/html' }), json ? 'source.json' : 'source.html');
  let failure;
  try {
    const response = await request(sourceUrl(context, path), { method: 'POST', body });
    if (!response.ok) failure = new Error(`Could not save ${path} (${response.status}).`);
  } catch (error) { failure = error; }
  try {
    if (await readSource(context, path, request) === source) return;
  } catch (error) { failure ||= error; }
  throw failure || new Error(`Could not verify the saved source ${path}.`);
}

async function persist(context, operation, request) {
  const source = `${JSON.stringify(operation, null, 2)}\n`;
  if (source.length > 20 * 1024 * 1024) throw new Error('The recovery manifest exceeds 20 MB; reduce the set scope before saving.');
  await writeExact(context, await recordPath(context, operation.setPath), source, request);
}

export async function readOperation(context, setPath, request) {
  const path = await recordPath(context, setPath);
  const response = await request(sourceUrl(context, path), { cache: 'no-store' });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Could not read the recovery manifest (${response.status}).`);
  const operation = await response.json();
  if (operation.setPath !== setPath) throw new Error('Recovery manifest does not match this set.');
  await validateOperation(context, operation);
  return operation;
}

function notify(options, path, index, total) {
  try { options.onProgress?.({ path, index, total }); } catch {
    // A view failure must not interrupt a durable source operation.
  }
}

async function currentOperation(context, operation, request) {
  await validateOperation(context, operation);
  const current = await readOperation(context, operation.setPath, request);
  if (!current || current.id !== operation.id) throw new Error('The active recovery operation changed. Reopen the manager.');
  return current;
}

async function verifyInventory(context, expected, request) {
  const current = await readSiteInventory(context, request);
  if (JSON.stringify(current) !== JSON.stringify(expected)) {
    throw new Error('The site inventory changed; review newly added or removed consumers before saving.');
  }
}

async function restore(context, operation, request, options) {
  const copy = structuredClone(operation);
  copy.status = 'restoring';
  const unresolved = [];
  const next = async (index) => {
    if (index >= copy.writes.length) return;
    const write = copy.writes[index];
    notify(options, write.path, index, copy.writes.length);
    try {
      const current = await readSource(context, write.path, request);
      if (current === write.target && current !== write.original) {
        await writeExact(context, write.path, write.original, request);
      } else if (current !== write.original) throw new Error('A collaborator changed this source.');
      write.state = 'restored';
    } catch { unresolved.push(write.path); write.state = 'conflict'; }
    try { await persist(context, copy, request); } catch {
      // Original snapshots remain in the initial manifest.
    }
    await next(index + 1);
  };
  await next(0);
  copy.status = unresolved.length ? 'recovery-required' : 'restored';
  try { await persist(context, copy, request); } catch {
    copy.status = 'recovery-required';
    unresolved.push(await recordPath(context, copy.setPath));
  }
  return { ok: !unresolved.length, operation: copy, unresolved };
}

async function execute(context, operation, request, options) {
  const copy = structuredClone(operation);
  try {
    copy.status = 'writing';
    await persist(context, copy, request);
    const next = async (index) => {
      if (index >= copy.writes.length) return;
      const write = copy.writes[index];
      notify(options, write.path, index, copy.writes.length);
      const current = await readSource(context, write.path, request);
      if (current !== write.target) {
        if (current !== write.original) throw new Error(`Source changed before saving: ${write.path}.`);
        await writeExact(context, write.path, write.target, request);
      }
      write.state = 'written';
      await persist(context, copy, request);
      await next(index + 1);
    };
    await next(0);
    await Promise.all(copy.writes.map(async (write) => {
      if (await readSource(context, write.path, request) !== write.target) {
        throw new Error(`Source changed during verification: ${write.path}.`);
      }
    }));
    copy.status = 'complete';
    await persist(context, copy, request);
    return { ok: true, operation: copy, changedPaths: copy.writes.map((write) => write.path) };
  } catch (error) {
    const restored = await restore(context, copy, request, options);
    return {
      ...restored, ok: false, message: error.message,
    };
  }
}

export async function applyOperation(context, plan, request, options = {}) {
  if (plan.issues?.length) throw new Error('Resolve every audit issue before saving.');
  validateWrites(context, plan);
  const previous = await readOperation(context, plan.setPath, request);
  if (previous && !['complete', 'restored'].includes(previous.status)) {
    throw new Error('An unfinished operation needs recovery before a new reorder.');
  }
  await verifyInventory(context, plan.inventory, request);
  await Promise.all((plan.guards || plan.writes).map(async (write) => {
    if (await readSource(context, write.path, request) !== write.original) {
      throw new Error(`Source changed since review: ${write.path}.`);
    }
  }));
  if (previous) {
    const activePath = await recordPath(context, previous.setPath);
    const archive = activePath.replace(/\.json$/, `-${previous.id}.json`);
    await writeExact(context, archive, `${JSON.stringify(previous, null, 2)}\n`, request);
  }
  const writes = await Promise.all(plan.writes.map(async (write) => ({
    ...write, state: 'pending', originalHash: await hash(write.original), targetHash: await hash(write.target),
  })));
  const operation = {
    version: 1,
    id: crypto.randomUUID(),
    org: context.org,
    repo: context.repo,
    setPath: plan.setPath,
    namespace: plan.namespace,
    mapping: plan.mapping,
    inventory: plan.inventory,
    affectedPages: plan.affectedPages,
    created: new Date().toISOString(),
    status: 'prepared',
    writes,
    guards: await Promise.all((plan.guards || []).map(async (guard) => ({
      path: guard.path, hash: await hash(guard.original),
    }))),
  };
  await persist(context, operation, request);
  return execute(context, operation, request, options);
}

export async function resumeOperation(context, operation, request, options = {}) {
  const current = await currentOperation(context, operation, request);
  if (current.status === 'restored') throw new Error('This operation was restored. Review a new reorder instead.');
  await verifyInventory(context, current.inventory, request);
  await Promise.all((current.guards || []).map(async (guard) => {
    if (current.writes.some((write) => write.path === guard.path)) return;
    if (await hash(await readSource(context, guard.path, request)) !== guard.hash) {
      throw new Error(`A consumer changed during recovery: ${guard.path}. Restore and review again.`);
    }
  }));
  return execute(context, current, request, options);
}

export async function restoreOperation(context, operation, request, options = {}) {
  const current = await currentOperation(context, operation, request);
  return restore(context, current, request, options);
}
