const storageKey = 'etrade-workspace-tour-v1';
const overview = document.querySelector('#tour-overview');
const overviewTitle = document.querySelector('#tour-overview-title');
const overviewDescription = document.querySelector('#tour-overview-description');
const startActions = document.querySelector('#tour-start-actions');
const start = document.querySelector('#tour-start');
const restart = document.querySelector('#tour-restart');
const stepFrame = document.querySelector('#tour-step-frame');
const progressPanel = document.querySelector('#tour-progress-panel');
const progress = document.querySelector('#tour-progress');
const count = document.querySelector('#tour-count');
const controls = document.querySelector('#tour-controls');
const exit = document.querySelector('#tour-exit');
const back = document.querySelector('#tour-back');
const next = document.querySelector('#tour-next');
const steps = [...document.querySelectorAll('[data-tour-step]')];
const initialTitle = overviewTitle.textContent;
const initialDescription = overviewDescription.textContent;
let savedStep;
let activeIndex = -1;

try {
  savedStep = window.localStorage.getItem(storageKey);
} catch { /* Embedded browsers may block storage. */ }

function saveStep(value) {
  savedStep = value;
  try {
    window.localStorage.setItem(storageKey, value);
  } catch { /* Progress still works while the panel is open. */ }
}

function savedIndex() {
  return steps.findIndex((step) => step.id === savedStep);
}

function showOverview(moveFocus) {
  activeIndex = -1;
  document.body.classList.remove('tour-active');
  stepFrame.hidden = true;
  steps.forEach((step) => { step.hidden = true; });

  const complete = savedStep === 'complete';
  const resumeIndex = savedIndex();
  overviewTitle.textContent = complete ? 'Tour complete' : initialTitle;
  overviewDescription.textContent = complete
    ? 'Use the handoff guide for block examples, disclosure references, and the release checklist.'
    : initialDescription;
  start.textContent = 'Start tour';
  if (complete) start.textContent = 'Take the tour again';
  else if (resumeIndex >= 0) start.textContent = 'Continue tour';
  restart.hidden = resumeIndex <= 0;
  overview.hidden = false;
  if (moveFocus) overviewTitle.focus();
}

function showStep(index) {
  const activeStep = steps[index];
  activeIndex = index;
  saveStep(activeStep.id);
  overview.hidden = true;
  stepFrame.hidden = false;
  document.body.classList.add('tour-active');
  steps.forEach((step) => { step.hidden = step !== activeStep; });
  count.textContent = `Step ${index + 1} of ${steps.length}`;
  progress.setAttribute('value', index + 1);
  back.disabled = index === 0;
  next.textContent = index === steps.length - 1 ? 'Finish' : 'Next';
  activeStep.querySelector('h2').focus();
}

start.addEventListener('click', () => showStep(Math.max(0, savedIndex())));
restart.addEventListener('click', () => showStep(0));
exit.addEventListener('click', () => showOverview(true));
back.addEventListener('click', () => {
  if (activeIndex > 0) showStep(activeIndex - 1);
});
next.addEventListener('click', () => {
  if (activeIndex < steps.length - 1) {
    showStep(activeIndex + 1);
  } else {
    saveStep('complete');
    showOverview(true);
  }
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !event.defaultPrevented && activeIndex >= 0) {
    event.preventDefault();
    showOverview(true);
  }
});

progress.setAttribute('max', steps.length);
startActions.hidden = false;
progressPanel.hidden = false;
controls.hidden = false;
showOverview(false);
