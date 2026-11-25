// A read-only projection: execution stays with the client; edoku determines scope and order.
const crypto = require('node:crypto');
const POLICY = 'autonomous_workflow_v1';
const questionTask = task => task.tool === 'edoku_ask_question' || task.code === 'ASK_TARGETED_QUESTION';
const key = target => JSON.stringify(Object.fromEntries(Object.entries(target).sort(([a], [b]) => a.localeCompare(b))));
function candidate(task) {
  if (task.code === 'REVIEW_FILE') return null;
  const targets = task.question?.targets || task.targets || (['project','device','requirement','fact','structure','material','material_source'].includes(task.target?.kind) ? [task.target] : []);
  if (!targets.length) return { taskId: task.id, prompt: task.title, needsTarget: true, topic: 'Projektumfang' };
  const signature = targets.map(key).sort().join('|');
  const first = targets[0];
  const topic = targets.every(t => t.kind === 'project') ? 'Projektangaben'
    : targets.every(t => ['device','material'].includes(t.kind)) ? 'Artikelangaben'
    : first.kind === 'fact' ? 'Einbaudaten: ' + (first.subject?.requirementId || first.requirementId || first.subject?.listId || 'Anlage')
    : first.kind === 'structure' ? 'Projektstruktur' : 'Unterlagen';
  const id = task.questionId || 'q_' + crypto.createHash('sha256').update(signature).digest('hex').slice(0,20);
  const question = task.question || { id, prompt: task.title.slice(0,1000), required: task.required !== false, stage: task.stage || 'project', context: (task.context || 'Tatsächliche fehlende Projektangabe; keine Herstellerdaten oder Ausführung erfinden.').slice(0,500), targets };
  return { taskId: task.id, topic, signature, registered: task.code === 'ANSWER_IN_CHAT', question };
}
function build({ agent, user, state, pendingFiles = 0 }) {
  const priority = task => questionTask(task) ? 99
    : task.code === 'CREATE_JOB' ? 0 : task.code === 'DEFINE_FIRESTOP_REQUIREMENTS' ? 1
    : ['STRUCTURE_EXISTING_INFORMATION','APPLY_CONFIRMED_FACT','APPLY_USER_ANSWER','APPLY_MATERIAL_ANSWER'].includes(task.code) ? 2
    : task.code === 'COMPLETE_MATERIAL_IMPORT' ? 3
    : ['IDENTIFY_MATERIAL_ROW','MAP_MATERIAL_ROW','CHECK_MATERIAL_REFERENCE'].includes(task.code) ? 4
    : task.code === 'LINK_EXISTING_DATASHEET' ? 5
    : task.code.startsWith('RESEARCH_') ? 7 : task.code.startsWith('PREPARE_') ? 8 : 6;
  agent.sort((a,b) => priority(a)-priority(b));
  const independentTasks = agent.filter(t => !questionTask(t)).length;
  const questions = [], seen = new Set();
  for (const task of [...agent.filter(questionTask), ...user.filter(t => t.channel === 'agent_chat')]) {
    const item = candidate(task); if (!item) continue;
    const signature = item.signature || item.taskId;
    if (!seen.has(signature)) { seen.add(signature); questions.push(item); }
  }
  const terminal = ['closed','technically_complete'].includes(state);
  const action = terminal ? 'complete' : independentTasks ? 'continue' : questions.length ? 'ask_batch' : state === 'inspect_scope' ? 'inspect_scope' : 'wait';
  let questionBatch = null;
  if (action === 'ask_batch') {
    const topic = questions[0].topic, items = [];
    for (const item of questions.filter(q => q.topic === topic)) {
      const { signature, topic: ignored, ...compact } = item;
      if (items.length >= 3 || Buffer.byteLength(JSON.stringify([...items, compact])) > 2400) break;
      items.push(compact);
    }
    // Large individual targets must be read through the existing detail reader.
    if (!items.length) items.push({ taskId: questions[0].taskId, needsDetail: true });
    questionBatch = { topic, items, remaining: questions.length - items.length, tool: 'edoku_ask_question', maxQuestions: 3 };
  }
  return { policy: POLICY, action, independentTasks, questions: questions.length, pendingFiles,
    questionBatch, stopReason: action === 'continue' ? null : action === 'ask_batch' ? 'user_answers' : terminal ? state : action === 'inspect_scope' ? 'scope' : pendingFiles ? 'manual_file_review' : 'external_sources',
    onUnchanged: 'do_not_repeat_without_new_evidence', budget: 'honor_user_limit_and_checkpoint_before_exhaustion' };
}
module.exports = { POLICY, build, questionTask };
