(() => {
  const root = document.querySelector('[data-media-desk]');
  if (!root) return;

  const MAX_FILE_BYTES = 30 * 1024 * 1024;
  const MAX_SOURCE_PIXELS = 80_000_000;
  const MAX_SOURCE_EDGE = 16_384;
  const SETTINGS_KEY = 'tahai-press-media-desk-settings-v1';
  const PRESETS = {
    original: { label: 'Free crop · 2400 px maximum', ratio: null, width: 2400, height: 2400, aspect: 'original' },
    feature: { label: 'Feature image · 1600 × 900', ratio: 16 / 9, width: 1600, height: 900, aspect: 'landscape' },
    article: { label: 'Article landscape · 1440 × 960', ratio: 3 / 2, width: 1440, height: 960, aspect: 'landscape' },
    social: { label: 'Social card · 1200 × 630', ratio: 1200 / 630, width: 1200, height: 630, aspect: 'landscape' },
    square: { label: 'Square card · 1080 × 1080', ratio: 1, width: 1080, height: 1080, aspect: 'square' },
    portrait: { label: 'Portrait card · 1080 × 1350', ratio: 4 / 5, width: 1080, height: 1350, aspect: 'portrait' }
  };
  const EXPORT_FORMATS = [
    { value: 'image/webp', label: 'WebP', extension: 'webp', supported: true },
    { value: 'image/jpeg', label: 'JPEG', extension: 'jpg', supported: true },
    { value: 'image/png', label: 'PNG', extension: 'png', supported: true },
    { value: 'image/avif', label: 'AVIF', extension: 'avif', supported: true }
  ];

  const fileInput = root.querySelector('[data-media-file]');
  const dropZone = root.querySelector('[data-media-drop]');
  const workspace = root.querySelector('[data-media-workspace]');
  const canvas = root.querySelector('[data-media-preview]');
  const context = canvas?.getContext('2d', { alpha: false });
  const sourceName = root.querySelector('[data-source-name]');
  const sourceDetails = root.querySelector('[data-source-details]');
  const presetSelect = root.querySelector('[data-media-preset]');
  const qualityInput = root.querySelector('[data-media-quality]');
  const qualityOutput = root.querySelector('[data-media-quality-output]');
  const formatInputs = [...root.querySelectorAll('[name="media-format"]')];
  const focalX = root.querySelector('[data-focal-x]');
  const focalY = root.querySelector('[data-focal-y]');
  const focalButtons = [...root.querySelectorAll('[data-focal-point]')];
  const zoomInput = root.querySelector('[data-media-zoom]');
  const rotationInput = root.querySelector('[data-media-rotation]');
  const decorativeInput = root.querySelector('[data-media-decorative]');
  const outputDimensions = root.querySelector('[data-output-dimensions]');
  const outputEstimate = root.querySelector('[data-output-estimate]');
  const outputName = root.querySelector('[data-output-name]');
  const repositoryPath = root.querySelector('[data-repository-path]');
  const altInput = root.querySelector('[data-media-alt]');
  const captionInput = root.querySelector('[data-media-caption]');
  const creditInput = root.querySelector('[data-media-credit]');
  const rightsInput = root.querySelector('[data-media-rights]');
  const checks = root.querySelector('[data-media-checks]');
  const status = root.querySelector('[data-media-status]');
  const downloadButton = root.querySelector('[data-download-image]');
  const manifestButton = root.querySelector('[data-download-manifest]');
  const copyButton = root.querySelector('[data-copy-media-fields]');
  const resetButton = root.querySelector('[data-reset-media]');
  const undoButton = root.querySelector('[data-undo-media]');

  const sourceCanvas = document.createElement('canvas');
  sourceCanvas.width = 1;
  sourceCanvas.height = 1;
  const sourceCanvasContext = sourceCanvas.getContext?.('2d');
  const supportsCanvas = Boolean(context && sourceCanvasContext);
  const canEncode = new Map(EXPORT_FORMATS.map((format) => {
    if (!supportsCanvas) return [format.value, false];
    if (format.value === 'image/jpeg' || format.value === 'image/png' || format.value === 'image/webp') return [format.value, true];
    try {
      sourceCanvasContext.fillStyle = '#336699';
      sourceCanvasContext.fillRect(0, 0, 1, 1);
      return [format.value, sourceCanvas.toDataURL(format.value).startsWith(`data:${format.value}`)];
    } catch {
      return [format.value, false];
    }
  }));

  let source = null;
  let previewFrame = 0;
  let estimateToken = 0;
  let undoStack = [];
  let restoringHistory = false;

  if (!supportsCanvas) {
    workspace.hidden = true;
    fileInput.disabled = true;
    dropZone.setAttribute('aria-disabled', 'true');
    announce('This browser cannot draw to canvas, so Media Desk cannot encode image files here. The publication remains readable, and a desktop editor can prepare the image instead.');
  }

  if (!canEncode.get('image/avif')) {
    const avifInput = formatInputs.find((input) => input.value === 'image/avif');
    if (avifInput) avifInput.disabled = true;
    if (selectedFormat() === 'image/avif') {
      const fallback = formatInputs.find((input) => input.value === 'image/webp' && !input.disabled) || formatInputs.find((input) => !input.disabled);
      if (fallback) fallback.checked = true;
    }
  }

  function announce(message) {
    status.textContent = message;
  }

  function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
  }

  function humanBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const place = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
    const amount = bytes / (1024 ** place);
    return `${amount >= 10 || place === 0 ? amount.toFixed(0) : amount.toFixed(1)} ${units[place]}`;
  }

  function safeBaseName(value) {
    const withoutExtension = String(value || 'publication-image').replace(/\.[^.]+$/, '');
    const normalized = withoutExtension
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);
    return normalized || 'publication-image';
  }

  function selectedFormat() {
    const selected = formatInputs.find((input) => input.checked && !input.disabled)?.value;
    if (selected) return selected;
    return formatInputs.find((input) => !input.disabled)?.value || 'image/webp';
  }

  function extensionFor(type) {
    return {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/avif': 'avif'
    }[type] || 'webp';
  }

  function preset() {
    return PRESETS[presetSelect.value] || PRESETS.feature;
  }

  function currentSettings() {
    return {
      preset: presetSelect.value,
      quality: Number(qualityInput.value),
      format: selectedFormat(),
      focal_x: Number(focalX.value),
      focal_y: Number(focalY.value),
      zoom: Number(zoomInput.value),
      rotation: Number(rotationInput.value),
      decorative: Boolean(decorativeInput.checked)
    };
  }

  function persistSettings() {
    try {
      const settings = currentSettings();
      delete settings.focal_x;
      delete settings.focal_y;
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {}
  }

  function restoreSettings() {
    try {
      const settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
      if (PRESETS[settings.preset]) presetSelect.value = settings.preset;
      if (Number.isFinite(settings.quality)) qualityInput.value = String(clamp(settings.quality, 40, 95));
      if (Number.isFinite(settings.zoom)) zoomInput.value = String(clamp(settings.zoom, 100, 400));
      if (Number.isFinite(settings.rotation)) rotationInput.value = String(clamp(settings.rotation, -180, 180));
      decorativeInput.checked = Boolean(settings.decorative);
      const format = EXPORT_FORMATS.some((item) => item.value === settings.format) ? settings.format : 'image/webp';
      formatInputs.forEach((input) => { input.checked = input.value === format && !input.disabled; });
    } catch {}
  }

  function zoomFactor() {
    return clamp(Number(zoomInput.value) / 100, 1, 4);
  }

  function rotationRadians() {
    return Number(rotationInput.value) * (Math.PI / 180);
  }

  function baseOutputSize() {
    if (!source) return { width: 0, height: 0 };
    const chosen = preset();
    if (!chosen.ratio) {
      const crop = cropRectangle();
      const scale = Math.min(1, chosen.width / Math.max(crop.width, crop.height));
      return {
        width: Math.max(1, Math.round(crop.width * scale)),
        height: Math.max(1, Math.round(crop.height * scale))
      };
    }
    return { width: chosen.width, height: chosen.height };
  }

  function cropRectangle() {
    if (!source) return { x: 0, y: 0, width: 0, height: 0 };
    const chosen = preset();
    const zoom = zoomFactor();
    const maxWidth = Math.max(1, source.width / zoom);
    const maxHeight = Math.max(1, source.height / zoom);
    if (!chosen.ratio) {
      const fx = Number(focalX.value) / 100;
      const fy = Number(focalY.value) / 100;
      const x = clamp((source.width * fx) - (maxWidth / 2), 0, Math.max(0, source.width - maxWidth));
      const y = clamp((source.height * fy) - (maxHeight / 2), 0, Math.max(0, source.height - maxHeight));
      return { x, y, width: maxWidth, height: maxHeight };
    }

    const fx = Number(focalX.value) / 100;
    const fy = Number(focalY.value) / 100;
    let width = maxWidth;
    let height = width / chosen.ratio;
    if (height > maxHeight) {
      height = maxHeight;
      width = height * chosen.ratio;
    }
    const x = clamp((source.width * fx) - (width / 2), 0, Math.max(0, source.width - width));
    const y = clamp((source.height * fy) - (height / 2), 0, Math.max(0, source.height - height));
    return { x, y, width, height };
  }

  function schemaFocalPoint() {
    const x = Number(focalX.value);
    const y = Number(focalY.value);
    const candidates = [
      { value: 'center', x: 50, y: 50 },
      { value: 'top', x: 50, y: 15 },
      { value: 'bottom', x: 50, y: 85 },
      { value: 'left', x: 15, y: 50 },
      { value: 'right', x: 85, y: 50 }
    ];
    return candidates.sort((a, b) => Math.hypot(x - a.x, y - a.y) - Math.hypot(x - b.x, y - b.y))[0].value;
  }

  function syncFocalButtons() {
    const focal = schemaFocalPoint();
    focalButtons.forEach((button) => {
      const active = button.dataset.focalPoint === focal;
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function drawTo(target, width, height) {
    const targetContext = target.getContext('2d', { alpha: false });
    if (!targetContext || !source) return;
    targetContext.imageSmoothingEnabled = true;
    targetContext.imageSmoothingQuality = 'high';
    targetContext.fillStyle = '#ffffff';
    targetContext.fillRect(0, 0, width, height);
    const crop = cropRectangle();
    const base = baseOutputSize();
    const rotation = rotationRadians();

    if (Math.abs(rotation) < 0.00001) {
      targetContext.drawImage(source.image, crop.x, crop.y, crop.width, crop.height, 0, 0, width, height);
      return;
    }

    const staging = document.createElement('canvas');
    staging.width = base.width;
    staging.height = base.height;
    const stagingContext = staging.getContext('2d', { alpha: false });
    stagingContext.imageSmoothingEnabled = true;
    stagingContext.imageSmoothingQuality = 'high';
    stagingContext.fillStyle = '#ffffff';
    stagingContext.fillRect(0, 0, base.width, base.height);
    stagingContext.drawImage(source.image, crop.x, crop.y, crop.width, crop.height, 0, 0, base.width, base.height);

    targetContext.save();
    targetContext.translate(width / 2, height / 2);
    targetContext.rotate(rotation);
    targetContext.drawImage(staging, -base.width / 2, -base.height / 2);
    targetContext.restore();
  }

  function renderPreview() {
    previewFrame = 0;
    if (!source || !supportsCanvas) return;
    const output = outputSize();
    const maximumPreviewEdge = 1200;
    const scale = Math.min(1, maximumPreviewEdge / Math.max(output.width, output.height));
    const width = Math.max(1, Math.round(output.width * scale));
    const height = Math.max(1, Math.round(output.height * scale));
    canvas.width = width;
    canvas.height = height;
    drawTo(canvas, width, height);

    context.save();
    context.strokeStyle = 'rgba(255,255,255,.82)';
    context.lineWidth = Math.max(1, Math.round(width / 600));
    context.setLineDash([Math.max(4, width / 100), Math.max(4, width / 100)]);
    context.beginPath();
    context.moveTo(width / 3, 0);
    context.lineTo(width / 3, height);
    context.moveTo((width / 3) * 2, 0);
    context.lineTo((width / 3) * 2, height);
    context.moveTo(0, height / 3);
    context.lineTo(width, height / 3);
    context.moveTo(0, (height / 3) * 2);
    context.lineTo(width, (height / 3) * 2);
    context.stroke();
    context.restore();

    outputDimensions.textContent = `${output.width} × ${output.height} pixels`;
    canvas.setAttribute('aria-label', `Image crop preview at ${output.width} by ${output.height} pixels. Focal point ${Math.round(Number(focalX.value))} percent from the left and ${Math.round(Number(focalY.value))} percent from the top.`);
    syncFocalButtons();
    updateOutputNames();
    updateChecks();
    scheduleEstimate();
  }

  function requestPreview() {
    if (previewFrame) cancelAnimationFrame(previewFrame);
    previewFrame = requestAnimationFrame(renderPreview);
  }

  function outputSize() {
    if (!source) return { width: 0, height: 0 };
    const base = baseOutputSize();
    const rotation = Math.abs(rotationRadians());
    if (rotation < 0.00001) return base;
    const sin = Math.abs(Math.sin(rotation));
    const cos = Math.abs(Math.cos(rotation));
    return {
      width: Math.max(1, Math.round((base.width * cos) + (base.height * sin))),
      height: Math.max(1, Math.round((base.width * sin) + (base.height * cos)))
    };
  }

  function outputFilename() {
    const format = selectedFormat();
    const base = safeBaseName(outputName.value || source?.file?.name || 'publication-image');
    return `${base}-${presetSelect.value}.${extensionFor(format)}`;
  }

  function updateOutputNames() {
    if (!source) return;
    if (!outputName.value.trim()) outputName.value = safeBaseName(source.file.name);
    repositoryPath.value = `/uploads/images/${outputFilename()}`;
  }

  function manifest(blob = null) {
    const output = outputSize();
    const crop = cropRectangle();
    const format = selectedFormat();
    const imagePath = repositoryPath.value.trim() || `/uploads/images/${outputFilename()}`;
    return {
      schema_version: 1,
      software: 'TAHAI Press Media Desk',
      generated_at: new Date().toISOString(),
      source: {
        filename: source.file.name,
        mime_type: source.file.type,
        bytes: source.file.size,
        width: source.width,
        height: source.height
      },
      output: {
        filename: outputFilename(),
        repository_path: imagePath,
        mime_type: format,
        bytes: blob?.size || null,
        width: output.width,
        height: output.height,
        quality: Number(qualityInput.value) / 100,
        preset: presetSelect.value,
        zoom: Number(zoomInput.value) / 100,
        rotation_degrees: Number(rotationInput.value),
        source_crop: {
          x: Math.round(crop.x),
          y: Math.round(crop.y),
          width: Math.round(crop.width),
          height: Math.round(crop.height)
        }
      },
        accessibility: {
          alt: altInput.value.trim(),
          caption: captionInput.value.trim(),
          credit: creditInput.value.trim(),
          rights: rightsInput.value.trim(),
          decorative: Boolean(decorativeInput.checked)
        },
        article_fields: {
          featured_image: imagePath,
          featured_image_alt: decorativeInput.checked ? '' : altInput.value.trim(),
          featured_image_caption: captionInput.value.trim(),
          featured_image_credit: creditInput.value.trim(),
          featured_image_rights: rightsInput.value.trim(),
          featured_image_aspect: preset().aspect,
          featured_image_focal_point: schemaFocalPoint(),
          featured_image_decorative: Boolean(decorativeInput.checked)
        }
      };
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function canvasBlob(target, type, quality) {
    return new Promise((resolve, reject) => {
      target.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error(`This browser could not encode ${type === 'image/webp' ? 'WebP' : 'JPEG'}.`));
      }, type, quality);
    });
  }

  async function encodeImage() {
    const output = outputSize();
    const target = document.createElement('canvas');
    target.width = output.width;
    target.height = output.height;
    drawTo(target, output.width, output.height);
    return canvasBlob(target, selectedFormat(), Number(qualityInput.value) / 100);
  }

  function checksForCurrentState() {
    const items = [];
    if (!source) return [{ status: 'blocker', text: 'Choose a JPEG, PNG, or WebP image.' }];
    const alt = altInput.value.trim();
    if (!alt && !decorativeInput.checked) items.push({ status: 'blocker', text: 'Add an image description before export, or mark the image decorative.' });
    else if (alt.length < 12) items.push({ status: 'attention', text: 'The image description may be too short to explain the meaningful content.' });
    else if (/\.(?:jpe?g|png|webp)$/i.test(alt)) items.push({ status: 'attention', text: 'Describe the image itself instead of repeating the filename.' });
    else if (decorativeInput.checked) items.push({ status: 'ready', text: 'Decorative images may omit a description.' });
    else items.push({ status: 'ready', text: 'Image description is present.' });

    if (!creditInput.value.trim()) items.push({ status: 'attention', text: 'Add a creator or source credit when one is known.' });
    else items.push({ status: 'ready', text: 'Image credit is recorded.' });

    if (!rightsInput.value.trim()) items.push({ status: 'attention', text: 'Record rights or reuse information before publication review.' });
    else items.push({ status: 'ready', text: 'Rights or reuse information is recorded.' });

    const crop = cropRectangle();
    const output = outputSize();
    if (output.width > crop.width * 1.25 || output.height > crop.height * 1.25) {
      items.push({ status: 'attention', text: 'The selected preset enlarges this crop substantially; inspect the exported image for softness.' });
    } else items.push({ status: 'ready', text: 'The source resolution is appropriate for the selected preset.' });

    if (Number(qualityInput.value) < 60) items.push({ status: 'attention', text: 'Compression is aggressive; inspect text, faces, and fine lines for artifacts.' });
    else items.push({ status: 'ready', text: 'Compression quality is within the recommended range.' });

    if (!canEncode.get(selectedFormat())) items.push({ status: 'attention', text: 'The selected export format is unavailable in this browser and will fall back safely.' });
    return items;
  }

  function updateChecks() {
    const items = checksForCurrentState();
    checks.innerHTML = items.map((item) => `<li class="media-check-${item.status}"><strong>${item.status === 'ready' ? 'Ready' : item.status === 'attention' ? 'Review' : 'Required'}</strong><span>${item.text}</span></li>`).join('');
    const blocked = items.some((item) => item.status === 'blocker');
    downloadButton.disabled = blocked;
    manifestButton.disabled = blocked;
    copyButton.disabled = blocked;
    if (undoButton) undoButton.disabled = undoStack.length < 2;
  }

  async function scheduleEstimate() {
    const token = ++estimateToken;
    outputEstimate.textContent = 'Estimating file size…';
    try {
      if (!supportsCanvas) throw new Error('Canvas support is unavailable in this browser.');
      const blob = await encodeImage();
      if (token !== estimateToken) return;
      const format = selectedFormat();
      outputEstimate.textContent = `Estimated export: ${humanBytes(blob.size)} ${format === 'image/webp' ? 'WebP' : format === 'image/jpeg' ? 'JPEG' : format === 'image/png' ? 'PNG' : 'AVIF'}`;
    } catch (error) {
      if (token !== estimateToken) return;
      outputEstimate.textContent = error.message;
    }
  }

  async function loadImageFile(file) {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      announce('Choose a JPEG, PNG, or WebP image. SVG and animated formats are intentionally excluded from this local editor.');
      fileInput.value = '';
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      announce(`That file is ${humanBytes(file.size)}. Media Desk accepts files up to ${humanBytes(MAX_FILE_BYTES)}.`);
      fileInput.value = '';
      return;
    }

    announce('Reading the image locally…');
    if (!supportsCanvas) {
      announce('This browser cannot prepare images locally because canvas drawing is unavailable.');
      fileInput.value = '';
      return;
    }
    let image;
    let objectUrl = '';
    try {
      if ('createImageBitmap' in window) {
        try {
          image = await createImageBitmap(file, { imageOrientation: 'from-image' });
        } catch {
          image = await createImageBitmap(file);
        }
      } else {
        objectUrl = URL.createObjectURL(file);
        image = await new Promise((resolve, reject) => {
          const element = new Image();
          element.onload = () => resolve(element);
          element.onerror = () => reject(new Error('The browser could not decode this image.'));
          element.src = objectUrl;
        });
      }
      const width = image.width || image.naturalWidth;
      const height = image.height || image.naturalHeight;
      if (!width || !height) throw new Error('The image dimensions could not be read.');
      if (width > MAX_SOURCE_EDGE || height > MAX_SOURCE_EDGE || width * height > MAX_SOURCE_PIXELS) {
        if (typeof image.close === 'function') image.close();
        throw new Error(`The image is ${width} × ${height}. Use a source no larger than ${MAX_SOURCE_EDGE.toLocaleString()} pixels on an edge or ${MAX_SOURCE_PIXELS.toLocaleString()} total pixels.`);
      }
      if (source?.image && typeof source.image.close === 'function') source.image.close();
      if (source?.objectUrl) URL.revokeObjectURL(source.objectUrl);
      source = { file, image, width, height, objectUrl };
      sourceName.textContent = file.name;
      sourceDetails.textContent = `${width} × ${height} pixels · ${humanBytes(file.size)} · ${file.type.replace('image/', '').toUpperCase()}`;
      outputName.value = safeBaseName(file.name);
      focalX.value = '50';
      focalY.value = '50';
      zoomInput.value = '100';
      rotationInput.value = '0';
      decorativeInput.checked = false;
      workspace.hidden = false;
      renderPreview();
      undoStack = [currentSettings()];
      workspace.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
      announce('Image loaded. Set the crop, description, credit, and rights information before export.');
    } catch (error) {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      source = null;
      workspace.hidden = true;
      announce(error.message || 'The image could not be opened.');
      fileInput.value = '';
    }
  }

  function setFocal(name) {
    const positions = {
      center: [50, 50],
      top: [50, 15],
      bottom: [50, 85],
      left: [15, 50],
      right: [85, 50]
    };
    const position = positions[name] || positions.center;
    focalX.value = String(position[0]);
    focalY.value = String(position[1]);
    requestPreview();
    recordHistory();
  }

  function recordHistory() {
    if (restoringHistory || !source) return;
    const snapshot = currentSettings();
    const last = undoStack[undoStack.length - 1];
    if (!last || JSON.stringify(last) !== JSON.stringify(snapshot)) {
      undoStack.push(snapshot);
      if (undoStack.length > 20) undoStack.shift();
    }
    updateChecks();
  }

  function restoreHistory() {
    if (undoStack.length < 2) return;
    restoringHistory = true;
    undoStack.pop();
    const snapshot = undoStack[undoStack.length - 1];
    presetSelect.value = snapshot.preset;
    qualityInput.value = String(snapshot.quality);
    formatInputs.forEach((input) => { input.checked = input.value === snapshot.format && !input.disabled; });
    focalX.value = String(snapshot.focal_x);
    focalY.value = String(snapshot.focal_y);
    zoomInput.value = String(snapshot.zoom);
    rotationInput.value = String(snapshot.rotation);
    decorativeInput.checked = Boolean(snapshot.decorative);
    altInput.required = !decorativeInput.checked;
    altInput.placeholder = decorativeInput.checked
      ? 'Optional when the image is purely decorative.'
      : 'Describe the meaningful people, place, action, text, or visual evidence shown.';
    qualityOutput.value = `${qualityInput.value}%`;
    qualityOutput.textContent = `${qualityInput.value}%`;
    updateOutputNames();
    requestPreview();
    updateChecks();
    scheduleEstimate();
    restoringHistory = false;
  }

  async function copyText(text) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
    const field = document.createElement('textarea');
    field.value = text;
    field.setAttribute('readonly', '');
    field.style.position = 'fixed';
    field.style.opacity = '0';
    document.body.append(field);
    field.select();
    const copied = document.execCommand('copy');
    field.remove();
    if (!copied) throw new Error('Copy is unavailable in this browser.');
  }

  async function downloadImage() {
    try {
      downloadButton.disabled = true;
      announce('Encoding the publication image locally…');
      const blob = await encodeImage();
      downloadBlob(blob, outputFilename());
      outputEstimate.textContent = `Exported ${humanBytes(blob.size)} ${selectedFormat() === 'image/webp' ? 'WebP' : 'JPEG'}`;
      announce(`Downloaded ${outputFilename()}. Keep the Media Desk manifest or copied article fields with the image so its accessibility and rights context is not lost.`);
    } catch (error) {
      announce(error.message || 'The image could not be exported.');
    } finally {
      updateChecks();
    }
  }

  async function downloadManifest() {
    try {
      manifestButton.disabled = true;
      const blob = await encodeImage();
      const record = manifest(blob);
      const manifestBlob = new Blob([`${JSON.stringify(record, null, 2)}\n`], { type: 'application/json' });
      downloadBlob(manifestBlob, `${safeBaseName(outputName.value)}-media-manifest.json`);
      announce('Downloaded the media manifest with crop, output, accessibility, credit, rights, and article-field metadata.');
    } catch (error) {
      announce(error.message || 'The manifest could not be exported.');
    } finally {
      updateChecks();
    }
  }

  async function copyFields() {
    try {
      await copyText(`${JSON.stringify(manifest().article_fields, null, 2)}\n`);
      announce('Copied TAHAI Press featured-image fields. Paste them into an article record after placing the exported image at the listed repository path.');
    } catch (error) {
      announce(error.message || 'The article fields could not be copied.');
    }
  }

  function reset() {
    estimateToken += 1;
    if (source?.image && typeof source.image.close === 'function') source.image.close();
    if (source?.objectUrl) URL.revokeObjectURL(source.objectUrl);
    source = null;
    undoStack = [];
    fileInput.value = '';
    workspace.hidden = true;
    canvas.width = 1;
    canvas.height = 1;
    altInput.value = '';
    captionInput.value = '';
    creditInput.value = '';
    rightsInput.value = '';
    decorativeInput.checked = false;
    zoomInput.value = '100';
    rotationInput.value = '0';
    outputName.value = '';
    repositoryPath.value = '';
    announce('Media Desk cleared. Choose another image when ready.');
    fileInput.focus();
  }

  fileInput.addEventListener('change', () => loadImageFile(fileInput.files?.[0]));
  ['dragenter', 'dragover'].forEach((type) => dropZone.addEventListener(type, (event) => {
    event.preventDefault();
    dropZone.dataset.dragActive = 'true';
  }));
  ['dragleave', 'drop'].forEach((type) => dropZone.addEventListener(type, (event) => {
    event.preventDefault();
    delete dropZone.dataset.dragActive;
  }));
  dropZone.addEventListener('drop', (event) => loadImageFile(event.dataTransfer?.files?.[0]));

  presetSelect.addEventListener('change', () => { persistSettings(); requestPreview(); recordHistory(); });
  qualityInput.addEventListener('input', () => {
    qualityOutput.value = `${qualityInput.value}%`;
    qualityOutput.textContent = `${qualityInput.value}%`;
    persistSettings();
    updateChecks();
    scheduleEstimate();
    recordHistory();
  });
  formatInputs.forEach((input) => input.addEventListener('change', () => { persistSettings(); updateOutputNames(); updateChecks(); scheduleEstimate(); recordHistory(); }));
  [focalX, focalY].forEach((input) => input.addEventListener('input', () => { requestPreview(); recordHistory(); }));
  zoomInput.addEventListener('input', () => { requestPreview(); persistSettings(); scheduleEstimate(); recordHistory(); });
  rotationInput.addEventListener('input', () => { requestPreview(); persistSettings(); scheduleEstimate(); recordHistory(); });
  decorativeInput.addEventListener('change', () => {
    altInput.required = !decorativeInput.checked;
    if (decorativeInput.checked) altInput.placeholder = 'Optional when the image is purely decorative.';
    else altInput.placeholder = 'Describe the meaningful people, place, action, text, or visual evidence shown.';
    persistSettings();
    updateChecks();
    recordHistory();
  });
  focalButtons.forEach((button) => button.addEventListener('click', () => setFocal(button.dataset.focalPoint)));
  [altInput, captionInput, creditInput, rightsInput].forEach((input) => input.addEventListener('input', () => { updateChecks(); recordHistory(); }));
  outputName.addEventListener('input', () => { updateOutputNames(); recordHistory(); });
  canvas.addEventListener('click', (event) => {
    const rect = canvas.getBoundingClientRect();
    focalX.value = String(Math.round(clamp(((event.clientX - rect.left) / rect.width) * 100, 0, 100)));
    focalY.value = String(Math.round(clamp(((event.clientY - rect.top) / rect.height) * 100, 0, 100)));
    requestPreview();
    recordHistory();
  });
  canvas.addEventListener('keydown', (event) => {
    const step = event.shiftKey ? 10 : 2;
    if (event.key === 'ArrowLeft') focalX.value = String(clamp(Number(focalX.value) - step, 0, 100));
    else if (event.key === 'ArrowRight') focalX.value = String(clamp(Number(focalX.value) + step, 0, 100));
    else if (event.key === 'ArrowUp') focalY.value = String(clamp(Number(focalY.value) - step, 0, 100));
    else if (event.key === 'ArrowDown') focalY.value = String(clamp(Number(focalY.value) + step, 0, 100));
    else return;
    event.preventDefault();
    requestPreview();
    recordHistory();
  });
  if (undoButton) undoButton.addEventListener('click', restoreHistory);
  downloadButton.addEventListener('click', downloadImage);
  manifestButton.addEventListener('click', downloadManifest);
  copyButton.addEventListener('click', copyFields);
  resetButton.addEventListener('click', reset);

  restoreSettings();
  qualityOutput.value = `${qualityInput.value}%`;
  qualityOutput.textContent = `${qualityInput.value}%`;
  altInput.required = !decorativeInput.checked;
  if (decorativeInput.checked) altInput.placeholder = 'Optional when the image is purely decorative.';
  updateChecks();
})();
