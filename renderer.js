/* ═══════════════════════════════════════════════════════════
   SpaceSaver — Renderer Logic
   ═══════════════════════════════════════════════════════════ */

let currentFolder = null;
let scanData = null;
let currentTab = 'junk';
let modalAction = null;

const CATEGORY_ICONS = {
  images: '🖼️', videos: '🎬', audio: '🎵', documents: '📄',
  software: '⚙️', archives: '📦', code: '💻', temp: '🗑️', other: '📁'
};

const CATEGORY_LABELS = {
  images: 'Images', videos: 'Videos', audio: 'Audio', documents: 'Documents',
  software: 'Software', archives: 'Archives', code: 'Code', temp: 'Temporary', other: 'Other'
};

// ═══════ Navigation ═══════

function showPage(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(`page-${page}`).classList.add('active');
  document.querySelector(`.nav-item[data-page="${page}"]`).classList.add('active');

  if (page === 'cleanup' && currentFolder) {
    document.getElementById('cleanupFolderLabel').textContent = `Analyzing: ${currentFolder}`;
    document.getElementById('scanBtn').disabled = false;
  }
  if (page === 'organize' && currentFolder && scanData) {
    renderOrganizeView();
  }
}

// ═══════ Folder Selection ═══════

async function selectFolder() {
  const folder = await api.openFolder();
  if (folder) {
    currentFolder = folder;
    scanData = null;

    // Update display
    document.getElementById('selectedFolderDisplay').style.display = 'flex';
    document.getElementById('folderPathText').textContent = folder;

    // Update page labels
    document.getElementById('cleanupFolderLabel').textContent = `Analyzing: ${folder}`;
    document.getElementById('organizeFolderLabel').textContent = `Organizing: ${folder}`;
    document.getElementById('scanBtn').disabled = false;

    showToast('Folder selected! Navigate to Cleanup or Organize to get started.', 'info');
  }
}

// ═══════ Scan ═══════

async function startScan() {
  if (!currentFolder) {
    showToast('Please select a folder first from the Home page.', 'warning');
    return;
  }

  // Show progress
  document.getElementById('scanProgress').style.display = 'block';
  document.getElementById('scanResults').style.display = 'none';
  document.getElementById('cleanupEmpty').style.display = 'none';
  document.getElementById('scanBtn').disabled = true;
  document.getElementById('scanProgressBar').style.width = '30%';
  document.getElementById('scanProgressText').textContent = 'Scanning files...';

  // Set up progress listener
  api.onScanProgress((data) => {
    document.getElementById('scanProgressText').textContent = `Scanned ${data.count} files...`;
    // Pulse the progress bar
    const bar = document.getElementById('scanProgressBar');
    const w = Math.min(30 + (data.count / 50), 90);
    bar.style.width = w + '%';
  });

  try {
    const result = await api.scanFolder(currentFolder);
    scanData = result;

    if (result.cancelled) {
      showToast('Scan was cancelled.', 'warning');
      document.getElementById('scanProgress').style.display = 'none';
      document.getElementById('cleanupEmpty').style.display = 'flex';
      document.getElementById('scanBtn').disabled = false;
      return;
    }

    // Complete
    document.getElementById('scanProgressBar').style.width = '100%';
    document.getElementById('scanProgressText').textContent = `Scan complete — ${result.summary.totalFiles} files found`;

    setTimeout(() => {
      document.getElementById('scanProgress').style.display = 'none';
      renderScanResults(result);
    }, 500);

  } catch (err) {
    showToast('Error scanning folder: ' + err.message, 'error');
  }

  document.getElementById('scanBtn').disabled = false;
}

function renderScanResults(data) {
  const { summary } = data;

  // Summary cards
  const grid = document.getElementById('summaryGrid');
  grid.innerHTML = `
    <div class="summary-card accent">
      <div class="summary-value">${summary.totalFiles.toLocaleString()}</div>
      <div class="summary-label">Total Files</div>
    </div>
    <div class="summary-card cyan">
      <div class="summary-value">${summary.totalSizeFormatted}</div>
      <div class="summary-label">Total Size</div>
    </div>
    <div class="summary-card red">
      <div class="summary-value">${summary.junkFiles.length}</div>
      <div class="summary-label">Junk Files</div>
    </div>
    <div class="summary-card orange">
      <div class="summary-value">${summary.duplicates.length}</div>
      <div class="summary-label">Duplicates</div>
    </div>
    <div class="summary-card green">
      <div class="summary-value">${Object.keys(summary.categories).length}</div>
      <div class="summary-label">File Types</div>
    </div>
  `;

  document.getElementById('scanResults').style.display = 'block';
  showTab('junk');
}

// ═══════ Tabs ═══════

function showTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`.tab[data-tab="${tab}"]`).classList.add('active');

  const list = document.getElementById('cleanupFileList');
  let files = [];

  if (tab === 'junk') {
    files = scanData.summary.junkFiles;
  } else if (tab === 'large') {
    files = [...scanData.files].sort((a, b) => b.size - a.size).slice(0, 100);
  } else if (tab === 'duplicates') {
    files = scanData.summary.duplicates;
  }

  renderFileList(list, files);
  updateDeleteButton();
}

function renderFileList(container, files) {
  if (files.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding: 40px;">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#4a4a6a" stroke-width="1.5">
          <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
          <polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
        <p>No files found in this category — looking good! ✨</p>
      </div>
    `;
    return;
  }

  container.innerHTML = files.map((file, index) => `
    <div class="file-item" data-index="${index}" data-path="${escapeHtml(file.path)}">
      <input type="checkbox" class="cleanup-checkbox" data-path="${escapeHtml(file.path)}" onchange="updateDeleteButton()">
      <div class="file-icon ${file.category}">${file.ext.replace('.', '').substring(0, 4).toUpperCase() || '?'}</div>
      <div class="file-info">
        <div class="file-name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</div>
        <div class="file-path" title="${escapeHtml(file.relativePath)}">${escapeHtml(file.relativePath)}</div>
      </div>
      <div class="file-meta">
        <div class="file-size">${file.sizeFormatted}</div>
        <div class="file-date">${file.modifiedFormatted}</div>
      </div>
    </div>
  `).join('');
}

// ═══════ Selection ═══════

function toggleSelectAll(context) {
  const checked = document.getElementById('selectAllCleanup').checked;
  document.querySelectorAll('.cleanup-checkbox').forEach(cb => {
    cb.checked = checked;
  });
  updateDeleteButton();
}

function updateDeleteButton() {
  const checked = document.querySelectorAll('.cleanup-checkbox:checked');
  const btn = document.getElementById('deleteSelectedBtn');
  btn.disabled = checked.length === 0;
  if (checked.length > 0) {
    btn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
      Delete Selected (${checked.length})
    `;
  } else {
    btn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
      Delete Selected
    `;
  }
}

// ═══════ Delete ═══════

function deleteSelected() {
  const checkedBoxes = document.querySelectorAll('.cleanup-checkbox:checked');
  const paths = Array.from(checkedBoxes).map(cb => cb.dataset.path);

  if (paths.length === 0) return;

  // Calculate total size
  let totalSize = 0;
  for (const p of paths) {
    const file = scanData.files.find(f => f.path === p);
    if (file) totalSize += file.size;
  }
  const sizeStr = formatSizeJS(totalSize);

  showModal(
    '⚠️ Confirm Deletion',
    `You are about to move <strong>${paths.length} file(s)</strong> (${sizeStr}) to the Recycle Bin. This action can be undone from the Recycle Bin, but please review the files carefully before proceeding.`,
    `<div style="color: #FFB800; margin-bottom: 10px; font-weight: 600;">📌 Disclaimer</div>
     <p style="margin-bottom: 8px;">SpaceSaver moves files to the <strong>Recycle Bin</strong> for safety. However:</p>
     <ul style="margin-left: 16px; line-height: 1.8;">
       <li>Always verify you don't need these files before deleting</li>
       <li>Some system or application files may cause issues if removed</li>
       <li>The developer is not responsible for any data loss</li>
     </ul>
     <p style="margin-top: 10px;"><strong>Files to delete:</strong></p>
     <div style="margin-top: 6px; max-height: 80px; overflow-y: auto;">
       ${paths.map(p => `<div style="font-size: 11px; color: #6a6a82; padding: 1px 0;">• ${p}</div>`).join('')}
     </div>`,
    async () => {
      closeModal();

      // Show progress
      document.getElementById('scanProgress').style.display = 'block';
      document.getElementById('scanProgressBar').style.width = '0%';
      document.getElementById('scanProgressText').textContent = 'Deleting files...';

      api.onDeleteProgress((data) => {
        const pct = Math.round((data.deleted / paths.length) * 100);
        document.getElementById('scanProgressBar').style.width = pct + '%';
        document.getElementById('scanProgressText').textContent =
          `Deleted ${data.deleted}/${paths.length} files — Freed ${data.freedFormatted}`;
      });

      const result = await api.deleteFiles(paths);

      document.getElementById('scanProgress').style.display = 'none';

      if (result.cancelled) {
        showToast(`Stopped! Deleted ${result.deleted} files, freed ${result.freedFormatted}`, 'warning');
      } else {
        showToast(`Successfully freed ${result.freedFormatted}! (${result.deleted} files moved to Recycle Bin)`, 'success');
      }

      if (result.failed > 0) {
        showToast(`${result.failed} files could not be deleted (may be in use)`, 'error');
      }

      // Re-scan
      startScan();
    }
  );
}

// ═══════ Organize ═══════

function renderOrganizeView() {
  if (!scanData) {
    document.getElementById('organizeEmpty').style.display = 'flex';
    document.getElementById('organizeContent').style.display = 'none';
    return;
  }

  document.getElementById('organizeEmpty').style.display = 'none';
  document.getElementById('organizeContent').style.display = 'block';

  const cats = scanData.summary.categories;
  const container = document.getElementById('organizeCategories');

  const catOrder = ['images', 'videos', 'audio', 'documents', 'software', 'archives', 'code', 'temp', 'other'];

  container.innerHTML = catOrder
    .filter(cat => cats[cat])
    .map(cat => {
      const c = cats[cat];
      const preview = c.files.slice(0, 3).map(f => f.name);
      return `
        <div class="category-card" data-cat="${cat}">
          <div class="category-card-header">
            <div class="category-card-left">
              <div class="category-card-icon">
                <span style="font-size: 20px;">${CATEGORY_ICONS[cat]}</span>
              </div>
              <div>
                <h4>${CATEGORY_LABELS[cat]}</h4>
                <div class="cat-count">${c.count} files</div>
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 10px;">
              <div class="cat-size">${c.sizeFormatted}</div>
              <input type="checkbox" class="organize-checkbox" data-cat="${cat}" onchange="toggleCategoryCard(this)" checked>
            </div>
          </div>
          <div class="file-preview">
            ${preview.map(name => `<div class="file-preview-item">📄 ${escapeHtml(name)}</div>`).join('')}
            ${c.count > 3 ? `<div class="file-preview-item" style="color: var(--accent);">...and ${c.count - 3} more</div>` : ''}
          </div>
        </div>
      `;
    }).join('');

  // Check all by default
  document.querySelectorAll('.category-card').forEach(card => card.classList.add('checked'));
}

function toggleCategoryCard(checkbox) {
  const card = checkbox.closest('.category-card');
  if (checkbox.checked) card.classList.add('checked');
  else card.classList.remove('checked');
}

async function startOrganize() {
  if (!currentFolder || !scanData) {
    showToast('Please select a folder and scan it first from the Cleanup page.', 'warning');
    return;
  }

  const selectedCats = Array.from(document.querySelectorAll('.organize-checkbox:checked'))
    .map(cb => cb.dataset.cat);

  if (selectedCats.length === 0) {
    showToast('Please select at least one category to organize.', 'warning');
    return;
  }

  // Gather files to sort
  const filesToSort = [];
  for (const cat of selectedCats) {
    if (scanData.summary.categories[cat]) {
      filesToSort.push(...scanData.summary.categories[cat].files);
    }
  }

  const catLabels = selectedCats.map(c => CATEGORY_LABELS[c]).join(', ');

  showModal(
    '📂 Confirm File Organization',
    `You are about to organize <strong>${filesToSort.length} files</strong> into categorized subfolders (${catLabels}).`,
    `<div style="color: #6C63FF; margin-bottom: 10px; font-weight: 600;">📌 What will happen</div>
     <p style="margin-bottom: 8px;">Files will be <strong>moved</strong> (not copied) into new subfolders inside:</p>
     <div style="background: var(--bg-primary); padding: 8px 12px; border-radius: 6px; font-size: 12px; margin-bottom: 10px; word-break: break-all;">${escapeHtml(currentFolder)}</div>
     <p style="margin-bottom: 8px;">Subfolders that will be created:</p>
     <ul style="margin-left: 16px; line-height: 1.8;">
       ${selectedCats.map(c => `<li><strong>${CATEGORY_LABELS[c]}/</strong> — ${scanData.summary.categories[c].count} files</li>`).join('')}
     </ul>
     <div style="margin-top: 10px; color: #FFB800; font-size: 12px;">⚠️ Files already in the correct subfolder will be skipped. Name conflicts will be resolved by adding a number.</div>`,
    async () => {
      closeModal();

      document.getElementById('organizeProgress').style.display = 'block';
      document.getElementById('organizeProgressBar').style.width = '0%';
      document.getElementById('organizeProgressText').textContent = 'Organizing files...';

      api.onSortProgress((data) => {
        const pct = Math.round((data.moved / filesToSort.length) * 100);
        document.getElementById('organizeProgressBar').style.width = pct + '%';
        document.getElementById('organizeProgressText').textContent =
          `Moved ${data.moved}/${filesToSort.length} files...`;
      });

      const result = await api.sortFiles(currentFolder, filesToSort);

      document.getElementById('organizeProgress').style.display = 'none';

      if (result.cancelled) {
        showToast(`Stopped! Moved ${result.moved} files before cancellation.`, 'warning');
      } else {
        showToast(`✨ Organization complete! Moved ${result.moved} files into categorized folders.`, 'success');
      }

      if (result.failed > 0) {
        showToast(`${result.failed} files could not be moved (may be in use)`, 'error');
      }

      // Re-scan to reflect changes
      showPage('cleanup');
      startScan();
    }
  );
}

// ═══════ Cancel ═══════

function cancelCurrentOperation() {
  api.cancelOperation();
  showToast('Stopping operation...', 'warning');
}

// ═══════ Modal ═══════

function showModal(title, message, details, onConfirm) {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalMessage').innerHTML = message;
  document.getElementById('modalDetails').innerHTML = details;
  document.getElementById('modalOverlay').style.display = 'flex';
  modalAction = onConfirm;
}

function closeModal() {
  document.getElementById('modalOverlay').style.display = 'none';
  modalAction = null;
}

function confirmModalAction() {
  if (modalAction) modalAction();
}

// Close modal on overlay click
document.getElementById('modalOverlay').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeModal();
});

// Close modal on Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});

// ═══════ Toast Notifications ═══════

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const icons = {
    success: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    error: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#EF4444" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    warning: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    info: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6C63FF" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
  };

  toast.innerHTML = `${icons[type] || icons.info}<span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'toastOut 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ═══════ Utilities ═══════

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatSizeJS(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
