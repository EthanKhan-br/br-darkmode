const buttons = document.querySelectorAll('button');

const mark = (mode) =>
  buttons.forEach((b) => b.setAttribute('aria-pressed', b.dataset.mode === mode));

chrome.storage.sync.get({ mode: 'auto' }, ({ mode }) => mark(mode));

// Write only. Every open portal tab picks this up via storage.onChanged.
buttons.forEach((b) =>
  b.addEventListener('click', () => {
    chrome.storage.sync.set({ mode: b.dataset.mode });
    mark(b.dataset.mode);
  })
);
