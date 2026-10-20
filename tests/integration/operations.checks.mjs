// ─── CGRF Header ───────────────────────────────────────────────
// File:        tests/integration/operations.checks.mjs
// Stage:       11_COMMIT
// SRS:         SRS-CN-BUILDER-INTEGRATION-001
// CAPS:        pending
// CK:          pending
// Dispatch:    DISP-BUILDER-INTEGRATION-001
// Seat:        BITS-CODEGEN
// Owner:       Citadel Nexus Inc.
// Created:     2026-10-20
// Depends:     .bits/srs/SRS-CN-BUILDER-INTEGRATION-001.md, docs/builder-integration.md
// EnumType:    Test
// EnumEdges:   DEPENDS_ON .bits/srs/SRS-CN-BUILDER-INTEGRATION-001.md; VALIDATES docs/builder-integration.md
// DAG Node:    none
// Intent:      Exercise operational recovery, attributed forwarding, learning replay and restart, evidence isolation and audit tamper rejection.
// ───────────────────────────────────────────────────────────────

import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// CI exercises tsc output. The sandbox can supply a Node-transformed runtime.
const root = process.env.BUILDER_DIST_ROOT ?? resolve('dist');
const load = (path) => import(pathToFileURL(join(root, path)).href);
const { BotRegistry } = await load('bots/registry.js');
const { tryHandleBotRoute } = await load('bots/routes.js');
const { ResearchSignalPipe } = await load('automation/research-pipe.js');
const { GuardianAuditTrail, createAuditEntry, verifyChain } = await load('agents/nexus-tamagotchi/audit.js');
const { AGSOutcomeTracker, AGSLearningLoop, SapientPacket, SapientPacketStatus } =
  await load('agents/nexus-tamagotchi/ags-cognition-engine.js');
const { MiraSTMBuffer, createMiraMemoryConfig } =
  await load('agents/nexus-tamagotchi/mira-memory-engine.js');
const quiet = { log() {}, info() {}, debug() {}, warn() {}, error() {} };
const tick = () => new Promise((resolve) => setImmediate(resolve));

class Subscription {
  queue = [];
  pending;
  closed = false;
  [Symbol.asyncIterator]() { return this; }
  next() {
    if (this.queue.length) return Promise.resolve({ value: this.queue.shift(), done: false });
    if (this.closed) return Promise.resolve({ done: true });
    return new Promise((resolve, reject) => { this.pending = { resolve, reject }; });
  }
  emit(value) {
    if (this.pending) { this.pending.resolve({value, done: false}); this.pending = undefined; }
    else this.queue.push(value);
  }
  fail(error) { this.pending?.reject(error); this.pending = undefined; }
  unsubscribe() { this.closed = true; this.pending?.resolve({done: true}); this.pending = undefined; }
}
function pipeHarness(publish = () => {}) {
  const subscriptions = [];
  const errors = [];
  const pipe = new ResearchSignalPipe({
    client: { subscribe() { const sub = new Subscription(); subscriptions.push(sub); return sub; }, publish },
    inboundSubject: 'test.source', outboundSubjectPrefix: 'test.out',
    sourceGuild: 'builder', targetGuild: 'research',
    logger: {...quiet, error: (...args) => errors.push(args)},
  });
  const emit = (value) => subscriptions.at(-1).emit({
    subject: 'test.source', data: new TextEncoder().encode(JSON.stringify(value)),
  });
  return {pipe, subscriptions, errors, emit};
}
function packet(id, success = true) {
  const p = new SapientPacket({packetId: id, status: success ? SapientPacketStatus.COMPLETED : SapientPacketStatus.FAILED});
  p.addResult({stage: 'executor', success, durationMs: 10, tokensUsed: 0, costEstimate: 0,
    metadata: {}, error: success ? undefined : 'integration unavailable'});
  return p;
}

test('operations: rejected payloads and publish failures do not stop later signals', async (t) => {
  const sent = [];
  let fail = true;
  const h = pipeHarness((subject, data) => {
    if (fail) { fail = false; throw new Error('transient publish failure'); }
    sent.push(JSON.parse(new TextDecoder().decode(data)));
  });
  await h.pipe.start(); t.after(() => h.pipe.stop());
  const identity = {
    correlation_id:'case-1', mission_id:'fixture-mission', master_id:'forge',
    delegated_actor:'fixture-worker', trace_id:'fixture-trace',
    source_commit:'fixture-source-revision', evidence_ids:['fixture-evidence'],
  };
  h.emit([]); h.emit({event_type:'first'}); h.emit({event_type:'recovered', ...identity});
  await tick();
  assert.equal(h.errors.length, 2);
  assert.equal(sent.length, 1);
  for (const [key,value] of Object.entries(identity)) assert.deepEqual(sent[0][key],value);
  assert.equal(sent[0].source_guild, 'builder');
});

test('operations: failed subscriptions are observable and can restart', async (t) => {
  const h = pipeHarness();
  await h.pipe.start(); t.after(() => h.pipe.stop());
  h.subscriptions[0].fail(new Error('connection closed'));
  await tick();
  assert.equal(h.errors.length, 1);
  await h.pipe.start();
  assert.equal(h.subscriptions.length, 2);
});

test('operations: stopping discards buffered work before a new subscription starts', async (t) => {
  const sent = [];
  const h = pipeHarness((subject) => sent.push(subject));
  await h.pipe.start(); t.after(() => h.pipe.stop());
  h.emit({event_type:'queued'});
  await h.pipe.stop();
  assert.equal(sent.length, 0);
  await h.pipe.start(); h.emit({event_type:'fresh'}); await tick();
  assert.equal(sent.length, 1);
  assert.match(sent[0], /fresh$/);
});

test('operations: oversized HTTP ingestion returns 413 and service still accepts valid alerts', async (t) => {
  const registry = new BotRegistry();
  const server = createServer((req,res) => {
    if (!tryHandleBotRoute(req,res,{registry,config:{prefix:'test',patterns:[]},ingestToken:'fixture'})) {
      res.writeHead(404); res.end();
    }
  });
  await new Promise((resolve) => server.listen(0,'127.0.0.1',resolve));
  t.after(() => {server.closeAllConnections(); return new Promise((resolve) => server.close(resolve));});
  const url = `http://127.0.0.1:${server.address().port}/bots/ingest/wazuh`;
  const dashboard = await fetch(url.replace('/bots/ingest/wazuh','/bots'));
  assert.match(await dashboard.text(), /Powered by Citadel Nexus Inc\./);
  const headers = {authorization: ['Bearer','fixture'].join(' '),'content-type':'application/json'};
  const oversized = await fetch(url,{method:'POST',headers,body:'x'.repeat(256*1024+1)});
  assert.equal(oversized.status,413); await oversized.text();
  assert.equal(registry.snapshot().recent_events.length,0);
  const denied = await fetch(url,{method:'POST',body:'{}'});
  assert.equal(denied.status,401); await denied.text();
  const accepted = await fetch(url,{method:'POST',headers,body:JSON.stringify({rule:{id:'1',level:10,description:'test'},agent:{name:'test-host'}})});
  assert.equal(accepted.status,202); await accepted.text();
  assert.equal(registry.snapshot().recent_events.length,1);
});

test('audit: registry snapshots and listeners cannot rewrite retained event evidence', () => {
  const registry = new BotRegistry({maxRecentEvents:2});
  const payload = {nested:{value:'original'}};
  registry.subscribe((event) => {if (event.payload?.nested) event.payload.nested.value = 'listener';});
  const event = registry.record({bot_id:'test',subject:'test.alert',action:'alert',payload});
  event.action = 'caller'; payload.nested.value = 'input';
  const snapshot = registry.snapshot(); snapshot.recent_events[0].payload.nested.value = 'snapshot';
  assert.equal(registry.snapshot().recent_events[0].payload.nested.value,'original');
  assert.equal(registry.snapshot().recent_events[0].action,'alert');
  registry.record({bot_id:'test',subject:'test.alert',action:'second'});
  registry.record({bot_id:'test',subject:'test.alert',action:'third'});
  assert.equal(registry.snapshot().recent_events.length,2);
  assert.equal(registry.snapshot().bots[0].event_count,3);
});

test('audit: copies cannot mutate the trail and a trusted head detects truncation', () => {
  const trail = new GuardianAuditTrail();
  const first = trail.append('observed','operator','original');
  trail.append('resolved','operator','fixed');
  const head = trail.getChainHead();
  first.detail = 'mutated'; trail.getEntries()[0].actor = 'other';
  assert.equal(trail.getEntries()[0].detail,'original');
  assert.equal(trail.verifyChain(),true);
  assert.equal(verifyChain(trail.getEntries(), head), true);
  assert.equal(verifyChain(trail.getEntries().slice(0,1), head),false);
  const tampered = trail.getEntries().map((e) => ({...e})); tampered[0].detail = 'forged';
  assert.equal(verifyChain(tampered,head),false);
});

test('learning: duplicate outcomes and repeated feedback do not inflate evidence', () => {
  const tracker = new AGSOutcomeTracker();
  tracker.record(packet('same')); tracker.record(packet('same'));
  assert.equal(tracker.getStats().total,1);
  assert.equal(tracker.addFeedback('same',0.2),true);
  assert.equal(tracker.addFeedback('same',0.9),true);
  assert.equal(tracker.getStats().withFeedback,1);
  assert.equal(tracker.getStats().avgFeedback,0.9);
  assert.equal(tracker.addFeedback('same',Number.NaN),false);
  assert.equal(tracker.addFeedback('same',Infinity),false);
  assert.equal(tracker.getStats().avgFeedback,0.9);
});

test('learning: callers cannot turn failures into success or modify stored stage evidence', () => {
  const tracker = new AGSOutcomeTracker();
  const failed = tracker.record(packet('failed',false)); failed.success = true;
  tracker.record(packet('passed'));
  tracker.getOutcomes()[0].success = true;
  tracker.getOutcome('passed').stagesCompleted.push('fake');
  assert.equal(tracker.getOutcome('failed').success,false);
  assert.deepEqual(tracker.getOutcome('passed').stagesCompleted,['executor']);
  const signals = new AGSLearningLoop({outcomeTracker:tracker,logger:quiet}).analyzeOutcomes();
  assert.ok(signals.some((signal) => signal.source === 'outcome' && signal.signalType === 'negative'));
});

test('learning: bounded restart recomputes statistics and rejects corrupt persisted outcomes', (t) => {
  const dir = mkdtempSync(join(tmpdir(),'builder-learning-')); t.after(() => rmSync(dir,{recursive:true,force:true}));
  const path = join(dir,'outcomes.json');
  const tracker = new AGSOutcomeTracker({storagePath:path,maxOutcomes:2});
  tracker.record(packet('evicted',false)); tracker.record(packet('retained')); tracker.record(packet('latest'));
  tracker.addFeedback('retained',0.8); tracker.save();
  const file = JSON.parse(readFileSync(path,'utf8'));
  file.stats.total = 999; file.outcomes.push({packetId:'invalid',success:true});
  writeFileSync(path,JSON.stringify(file));
  const restarted = new AGSOutcomeTracker({storagePath:path,maxOutcomes:2,logger:quiet});
  assert.equal(restarted.getStats().total,2);
  assert.equal(restarted.getStats().successful,2);
  assert.equal(restarted.getStats().withFeedback,1);
  assert.equal(restarted.getOutcome('invalid'),undefined);
  assert.equal(restarted.getOutcome('evicted'),undefined);
  assert.deepEqual(restarted.getOutcomes({limit:0}),[]);
});

test('learning: restart rejects malformed optional evidence fields', (t) => {
  const dir = mkdtempSync(join(tmpdir(),'builder-invalid-evidence-'));
  t.after(() => rmSync(dir,{recursive:true,force:true}));
  const path = join(dir,'outcomes.json');
  const tracker = new AGSOutcomeTracker();
  const valid = tracker.record(packet('valid',false));
  const invalid = [
    {errorStage:{name:'executor'}}, {errorMessage:[]}, {feedbackText:42},
    {verdictDecision:{decision:'approve'}}, {verdictConfidence:'high'},
  ].map((fields,index) => ({...valid,packetId:`invalid-${index}`,...fields}));
  writeFileSync(path,JSON.stringify({outcomes:[valid,...invalid]}));
  const restarted = new AGSOutcomeTracker({storagePath:path,logger:quiet});
  assert.deepEqual(restarted.getOutcomes().map((outcome) => outcome.packetId),['valid']);
  assert.equal(restarted.getFailureAnalysis().mostCommonStage,'executor');
});

test('learning: duplicate persisted rows retain their last occurrence in the bounded window', (t) => {
  const dir = mkdtempSync(join(tmpdir(),'builder-replayed-evidence-'));
  t.after(() => rmSync(dir,{recursive:true,force:true}));
  const path = join(dir,'outcomes.json');
  const tracker = new AGSOutcomeTracker();
  const first = tracker.record(packet('first'));
  const second = tracker.record(packet('second'));
  const latest = tracker.record(packet('latest'));
  writeFileSync(path,JSON.stringify({outcomes:[first,second,latest,{...first,userFeedback:0.6}]}));
  const restarted = new AGSOutcomeTracker({storagePath:path,maxOutcomes:2,logger:quiet});
  assert.deepEqual(restarted.getOutcomes().map((outcome) => outcome.packetId),['latest','first']);
  assert.equal(restarted.getStats().total,2);
  assert.equal(restarted.getStats().avgFeedback,0.6);
});

test('learning: Mira retains prior evidence when a trailing JSONL write is incomplete', (t) => {
  const dir = mkdtempSync(join(tmpdir(),'builder-mira-')); t.after(() => rmSync(dir,{recursive:true,force:true}));
  const config = createMiraMemoryConfig({storageBasePath:dir,stmFilename:'stm.jsonl',embeddingDimension:16});
  const stm = new MiraSTMBuffer({config,logger:quiet});
  const entry = stm.inject('Record degraded integration health before retry',{tags:['operations']});
  const file = join(dir,'stm.jsonl');
  writeFileSync(file,readFileSync(file,'utf8')+'{"interrupted":');
  const restarted = new MiraSTMBuffer({config,logger:quiet});
  assert.ok(restarted.search('degraded integration health',5).some((result) => result.entry.entryId === entry.entryId));
});


test('audit: separators in fields cannot conceal a change of actor', () => {
  const entry = createAuditEntry('event|scope','operator','evidence','');
  assert.equal(verifyChain([entry]),true);
  assert.equal(verifyChain([{...entry,event:'event',actor:'scope|operator'}]),false);
});

test('integration: preserve boundary-aware intent and reflex matching from main', async () => {
  const { ReflexEngine } = await load('agents/nexus-tamagotchi/reflex-engine.js');
  const { NLUIntentClassifier, IntentCategory } = await load('agents/nexus-tamagotchi/nlu-engine.js');
  assert.equal(new ReflexEngine().tryReflex('this is a non-matching input').triggered,false);
  assert.equal(new NLUIntentClassifier().classify('Can you explain how this API works?').primaryIntent,IntentCategory.EXPLANATION);
});
