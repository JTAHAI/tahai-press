(() => {
  const nodes = document.querySelectorAll('[data-launch-progress]');
  if (!nodes.length) return;
  let progress = { completed: [], total: 7 };
  try { progress = { ...progress, ...(JSON.parse(localStorage.getItem('tahai-press-launch-progress-v1') || '{}')) }; } catch {}
  const complete = Array.isArray(progress.completed) ? progress.completed.length : 0;
  nodes.forEach((node) => { node.textContent = `${Math.min(complete, 7)}/7`; });
})();
