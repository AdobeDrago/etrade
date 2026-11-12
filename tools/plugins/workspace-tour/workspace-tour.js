const storageKey = 'etrade-workspace-tour-v1';
const overview = document.querySelector('#tour-overview');
const chapterList = document.querySelector('#tour-chapters');
const stepFrame = document.querySelector('#tour-step-frame');
const progressPanel = document.querySelector('#tour-progress-panel');
const progressChapter = document.querySelector('#tour-progress-chapter');
const progress = document.querySelector('#tour-progress');
const count = document.querySelector('#tour-count');
const controls = document.querySelector('#tour-controls');
const exit = document.querySelector('#tour-exit');
const back = document.querySelector('#tour-back');
const next = document.querySelector('#tour-next');
const steps = [...document.querySelectorAll('[data-tour-step]')];
let activeChapter;
let activeIndex = -1;

function readProgress(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

const chapters = [...chapterList.querySelectorAll('[data-tour-chapter]')].map((card) => {
  const id = card.dataset.tourChapter;
  // The authoring chapter uses the original tour's key and step IDs.
  const key = id === 'authoring' ? storageKey : `${storageKey}-${id}`;
  return {
    key,
    name: card.querySelector('h4').textContent,
    start: card.querySelector('[data-tour-start]'),
    restart: card.querySelector('[data-tour-restart]'),
    steps: steps.filter((step) => step.dataset.tourStep === id),
    savedStep: readProgress(key),
  };
});

function saveStep(chapter, value) {
  chapter.savedStep = value;
  try {
    window.localStorage.setItem(chapter.key, value);
  } catch { /* Progress still works while the panel is open. */ }
}

function savedIndex(chapter) {
  return chapter.steps.findIndex((step) => step.id === chapter.savedStep);
}

function showOverview() {
  const previousChapter = activeChapter;
  activeChapter = undefined;
  activeIndex = -1;
  document.body.classList.remove('tour-active');
  stepFrame.hidden = true;
  steps.forEach((step) => { step.hidden = true; });

  chapters.forEach((chapter) => {
    const resumeIndex = savedIndex(chapter);
    chapter.start.textContent = 'Start chapter';
    if (chapter.savedStep === 'complete') chapter.start.textContent = 'Retake completed chapter';
    else if (resumeIndex >= 0) chapter.start.textContent = `Continue at step ${resumeIndex + 1}`;
    chapter.restart.hidden = resumeIndex <= 0;
  });
  overview.hidden = false;
  previousChapter?.start.focus();
}

function showStep(chapter, index) {
  const activeStep = chapter.steps[index];
  activeChapter = chapter;
  activeIndex = index;
  saveStep(chapter, activeStep.id);
  overview.hidden = true;
  stepFrame.hidden = false;
  document.body.classList.add('tour-active');
  steps.forEach((step) => { step.hidden = step !== activeStep; });
  progressChapter.textContent = chapter.name;
  count.textContent = `Step ${index + 1} of ${chapter.steps.length}`;
  progress.setAttribute('max', chapter.steps.length);
  progress.setAttribute('value', index + 1);
  back.disabled = index === 0;
  next.textContent = index === chapter.steps.length - 1 ? 'Finish' : 'Next';
  activeStep.querySelector('h2').focus();
}

chapters.forEach((chapter) => {
  chapter.start.addEventListener('click', () => showStep(chapter, Math.max(0, savedIndex(chapter))));
  chapter.restart.addEventListener('click', () => showStep(chapter, 0));
});
exit.addEventListener('click', showOverview);
back.addEventListener('click', () => {
  if (activeIndex > 0) showStep(activeChapter, activeIndex - 1);
});
next.addEventListener('click', () => {
  if (activeIndex < activeChapter.steps.length - 1) {
    showStep(activeChapter, activeIndex + 1);
  } else {
    saveStep(activeChapter, 'complete');
    showOverview();
  }
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !event.defaultPrevented && activeIndex >= 0) {
    event.preventDefault();
    showOverview();
  }
});

chapterList.hidden = false;
progressPanel.hidden = false;
controls.hidden = false;
showOverview();
