let editor = null;
let currentProject = 'my-project';
let currentFile = null;
let openTabs = new Map();
let modifiedFiles = new Set();

require.config({
  paths: {
    'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs'
  }
});

require(['vs/editor/editor.main'], function() {
  initEditor();
  loadProjects();
  setupEventListeners();
});

function initEditor() {
  monaco.editor.defineTheme('custom-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '6e7681', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'ff7b72' },
      { token: 'string', foreground: 'a5d6ff' },
      { token: 'number', foreground: '79c0ff' },
      { token: 'type', foreground: 'ffa657' },
      { token: 'function', foreground: 'd2a8ff' },
      { token: 'variable', foreground: 'ffa657' },
    ],
    colors: {
      'editor.background': '#0d1117',
      'editor.foreground': '#e6edf3',
      'editor.lineHighlightBackground': '#161b22',
      'editor.selectionBackground': '#264f78',
      'editorCursor.foreground': '#58a6ff',
      'editorLineNumber.foreground': '#6e7681',
      'editorLineNumber.activeForeground': '#e6edf3',
      'editor.selectionHighlightBackground': '#3fb95033',
      'editorIndentGuide.background': '#21262d',
      'editorIndentGuide.activeBackground': '#30363d',
    }
  });

  editor = monaco.editor.create(document.getElementById('editor-container'), {
    value: getWelcomeContent(),
    language: 'javascript',
    theme: 'custom-dark',
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    fontSize: 14,
    lineHeight: 24,
    minimap: { enabled: true, scale: 1 },
    scrollBeyondLastLine: false,
    automaticLayout: true,
    tabSize: 2,
    wordWrap: 'on',
    padding: { top: 16, bottom: 16 },
    smoothScrolling: true,
    cursorBlinking: 'smooth',
    cursorSmoothCaretAnimation: 'on',
    renderLineHighlight: 'all',
    bracketPairColorization: { enabled: true },
    guides: {
      bracketPairs: true,
      indentation: true
    }
  });

  editor.onDidChangeCursorPosition((e) => {
    document.getElementById('cursor-position').textContent = 
      `Ln ${e.position.lineNumber}, Col ${e.position.column}`;
  });

  editor.onDidChangeModelContent(() => {
    if (currentFile) {
      modifiedFiles.add(currentFile);
      updateTabModified(currentFile, true);
    }
  });

  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
    saveCurrentFile();
  });

  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
    runCode();
  });
}

function getWelcomeContent() {
  return `/*
 * Welcome to CodeEditor!
 * 
 * An online IDE for coding, learning, and building projects.
 * 
 * Features:
 * - Multi-language support (JavaScript, Python, HTML, CSS)
 * - File management with folder support
 * - Code execution with console output
 * - Live HTML preview
 * - Syntax highlighting and IntelliSense
 * 
 * Shortcuts:
 * - Ctrl/Cmd + S: Save file
 * - Ctrl/Cmd + Enter: Run code
 * 
 * Get started by selecting a file from the sidebar!
 */

console.log("Hello, World!");
console.log("Ready to start coding...");
`;
}

async function loadProjects() {
  try {
    const response = await fetch('/api/projects');
    const data = await response.json();
    
    const select = document.getElementById('project-select');
    select.innerHTML = data.projects.map(p => 
      `<option value="${p}" ${p === currentProject ? 'selected' : ''}>${p}</option>`
    ).join('');
    
    loadFiles();
  } catch (error) {
    console.error('Failed to load projects:', error);
  }
}

async function loadFiles() {
  const fileTree = document.getElementById('file-tree');
  fileTree.innerHTML = '<div class="loading">Loading files...</div>';
  
  try {
    const response = await fetch(`/api/files/${currentProject}`);
    const data = await response.json();
    
    fileTree.innerHTML = renderFileTree(data.files);
    setupFileTreeEvents();
  } catch (error) {
    fileTree.innerHTML = '<div class="loading">Failed to load files</div>';
    console.error('Failed to load files:', error);
  }
}

function renderFileTree(files, level = 0) {
  return files.map(file => {
    const icon = getFileIcon(file);
    
    if (file.type === 'folder') {
      return `
        <div class="file-item folder" data-path="${file.path}" data-type="folder" style="padding-left: ${16 + level * 16}px">
          <i class="fas fa-chevron-right folder-arrow"></i>
          <i class="fas fa-folder folder-icon"></i>
          <span>${file.name}</span>
        </div>
        <div class="folder-children hidden" data-folder="${file.path}">
          ${renderFileTree(file.children || [], level + 1)}
        </div>
      `;
    }
    
    return `
      <div class="file-item" data-path="${file.path}" data-type="file" style="padding-left: ${16 + level * 16}px">
        <i class="${icon.class} file-icon ${icon.colorClass}"></i>
        <span>${file.name}</span>
      </div>
    `;
  }).join('');
}

function getFileIcon(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  const icons = {
    js: { class: 'fab fa-js-square', colorClass: 'js-icon' },
    html: { class: 'fab fa-html5', colorClass: 'html-icon' },
    css: { class: 'fab fa-css3-alt', colorClass: 'css-icon' },
    py: { class: 'fab fa-python', colorClass: 'py-icon' },
    json: { class: 'fas fa-brackets-curly', colorClass: 'json-icon' },
    md: { class: 'fab fa-markdown', colorClass: '' },
    default: { class: 'fas fa-file-code', colorClass: '' }
  };
  return icons[ext] || icons.default;
}

function setupFileTreeEvents() {
  document.querySelectorAll('.file-item').forEach(item => {
    item.addEventListener('click', (e) => {
      const path = item.dataset.path;
      const type = item.dataset.type;
      
      if (type === 'folder') {
        toggleFolder(item, path);
      } else {
        openFile(path);
      }
    });
    
    item.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      showContextMenu(e, item);
    });
  });
}

function toggleFolder(element, path) {
  const arrow = element.querySelector('.folder-arrow');
  const children = document.querySelector(`.folder-children[data-folder="${path}"]`);
  const folderIcon = element.querySelector('.folder-icon');
  
  if (children) {
    children.classList.toggle('hidden');
    arrow.classList.toggle('fa-chevron-right');
    arrow.classList.toggle('fa-chevron-down');
    folderIcon.classList.toggle('fa-folder');
    folderIcon.classList.toggle('fa-folder-open');
  }
}

async function openFile(path) {
  document.querySelectorAll('.file-item').forEach(f => f.classList.remove('active'));
  document.querySelector(`.file-item[data-path="${path}"]`)?.classList.add('active');
  
  if (openTabs.has(path)) {
    switchToTab(path);
    return;
  }
  
  try {
    const response = await fetch(`/api/file/${currentProject}/${path}`);
    const data = await response.json();
    
    openTabs.set(path, { content: data.content, originalContent: data.content });
    addTab(path);
    switchToTab(path);
    
    setEditorContent(data.content, path);
    updateStatus(path);
  } catch (error) {
    console.error('Failed to open file:', error);
    showConsoleOutput(`Error opening file: ${error.message}`, 'error');
  }
}

function addTab(path) {
  const fileName = path.split('/').pop();
  const tabs = document.getElementById('tabs');
  
  const tab = document.createElement('div');
  tab.className = 'tab';
  tab.dataset.path = path;
  tab.innerHTML = `
    <span>${fileName}</span>
    <span class="close-tab" title="Close">&times;</span>
  `;
  
  tab.addEventListener('click', (e) => {
    if (!e.target.classList.contains('close-tab')) {
      switchToTab(path);
    }
  });
  
  tab.querySelector('.close-tab').addEventListener('click', (e) => {
    e.stopPropagation();
    closeTab(path);
  });
  
  tabs.appendChild(tab);
}

function switchToTab(path) {
  currentFile = path;
  
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`.tab[data-path="${path}"]`)?.classList.add('active');
  
  document.querySelectorAll('.file-item').forEach(f => f.classList.remove('active'));
  document.querySelector(`.file-item[data-path="${path}"]`)?.classList.add('active');
  
  const tabData = openTabs.get(path);
  if (tabData) {
    setEditorContent(tabData.content, path);
    updateStatus(path);
  }
}

function closeTab(path) {
  if (modifiedFiles.has(path)) {
    if (!confirm('You have unsaved changes. Close anyway?')) {
      return;
    }
    modifiedFiles.delete(path);
  }
  
  openTabs.delete(path);
  const tab = document.querySelector(`.tab[data-path="${path}"]`);
  if (tab) tab.remove();
  
  if (currentFile === path) {
    const remainingTabs = Array.from(openTabs.keys());
    if (remainingTabs.length > 0) {
      switchToTab(remainingTabs[remainingTabs.length - 1]);
    } else {
      currentFile = null;
      editor.setValue(getWelcomeContent());
      updateStatus(null);
    }
  }
}

function updateTabModified(path, modified) {
  const tab = document.querySelector(`.tab[data-path="${path}"]`);
  if (tab) {
    if (modified) {
      tab.classList.add('modified');
    } else {
      tab.classList.remove('modified');
    }
  }
}

function setEditorContent(content, path) {
  const language = getLanguageFromPath(path);
  const model = monaco.editor.createModel(content, language);
  editor.setModel(model);
  
  model.onDidChangeContent(() => {
    if (currentFile) {
      const tabData = openTabs.get(currentFile);
      if (tabData) {
        tabData.content = editor.getValue();
      }
      modifiedFiles.add(currentFile);
      updateTabModified(currentFile, true);
    }
  });
}

function getLanguageFromPath(path) {
  if (!path) return 'plaintext';
  const ext = path.split('.').pop().toLowerCase();
  const languages = {
    js: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    html: 'html',
    css: 'css',
    scss: 'scss',
    json: 'json',
    py: 'python',
    md: 'markdown',
    sql: 'sql',
    yaml: 'yaml',
    yml: 'yaml',
    xml: 'xml',
    sh: 'shell',
    bash: 'shell'
  };
  return languages[ext] || 'plaintext';
}

function updateStatus(path) {
  const fileStatus = document.getElementById('file-status');
  const languageStatus = document.getElementById('language-status');
  
  if (path) {
    fileStatus.textContent = path;
    languageStatus.textContent = getLanguageFromPath(path).toUpperCase();
  } else {
    fileStatus.textContent = 'Ready';
    languageStatus.textContent = 'JAVASCRIPT';
  }
}

async function saveCurrentFile() {
  if (!currentFile) {
    showConsoleOutput('No file to save', 'info');
    return;
  }
  
  const content = editor.getValue();
  
  try {
    const response = await fetch(`/api/file/${currentProject}/${currentFile}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    });
    
    const data = await response.json();
    
    if (data.success) {
      modifiedFiles.delete(currentFile);
      updateTabModified(currentFile, false);
      
      const tabData = openTabs.get(currentFile);
      if (tabData) {
        tabData.originalContent = content;
      }
      
      showConsoleOutput(`File saved: ${currentFile}`, 'success');
    } else {
      showConsoleOutput(`Failed to save: ${data.error}`, 'error');
    }
  } catch (error) {
    showConsoleOutput(`Error saving file: ${error.message}`, 'error');
  }
}

async function runCode() {
  const code = editor.getValue();
  const language = getLanguageFromPath(currentFile);
  
  showConsoleOutput('Running...', 'info');
  
  try {
    const response = await fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, language })
    });
    
    const data = await response.json();
    
    if (data.type === 'html') {
      updatePreview(data.content);
      switchToPanel('preview');
      showConsoleOutput('HTML preview updated', 'success');
    } else {
      showConsoleOutput(data.output, data.type);
    }
  } catch (error) {
    showConsoleOutput(`Error: ${error.message}`, 'error');
  }
}

function showConsoleOutput(text, type = 'success') {
  const output = document.getElementById('console-output');
  const time = new Date().toLocaleTimeString();
  
  if (output.querySelector('.console-welcome')) {
    output.innerHTML = '';
  }
  
  const line = document.createElement('div');
  line.className = `console-line ${type}`;
  line.innerHTML = `<span class="console-timestamp">[${time}]</span>${escapeHtml(text)}`;
  output.appendChild(line);
  output.scrollTop = output.scrollHeight;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function updatePreview(htmlContent) {
  const frame = document.getElementById('preview-frame');
  frame.srcdoc = htmlContent;
}

function switchToPanel(panel) {
  document.querySelectorAll('.panel-tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`.panel-tab[data-panel="${panel}"]`)?.classList.add('active');
  
  document.querySelectorAll('.console-panel, .preview-panel').forEach(p => p.classList.remove('active'));
  document.getElementById(`${panel}-panel`)?.classList.add('active');
}

function setupDropdownMenus() {
  const mainMenuBtn = document.getElementById('main-menu-btn');
  const mainMenuContent = document.getElementById('main-menu-content');
  const accountMenuBtn = document.getElementById('account-menu-btn');
  const accountMenuContent = document.getElementById('account-menu-content');

  mainMenuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    mainMenuContent.classList.toggle('active');
    accountMenuContent.classList.remove('active');
  });

  accountMenuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    accountMenuContent.classList.toggle('active');
    mainMenuContent.classList.remove('active');
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.menu-dropdown')) {
      mainMenuContent.classList.remove('active');
      accountMenuContent.classList.remove('active');
    }
  });

  const themeDark = document.getElementById('theme-dark');
  const themeLight = document.getElementById('theme-light');

  themeDark.addEventListener('click', (e) => {
    e.stopPropagation();
    themeDark.classList.add('active');
    themeLight.classList.remove('active');
  });

  themeLight.addEventListener('click', (e) => {
    e.stopPropagation();
    themeLight.classList.add('active');
    themeDark.classList.remove('active');
  });
}

function setupEventListeners() {
  document.getElementById('run-btn').addEventListener('click', runCode);
  document.getElementById('save-btn').addEventListener('click', saveCurrentFile);
  
  setupDropdownMenus();
  
  document.getElementById('project-select').addEventListener('change', (e) => {
    currentProject = e.target.value;
    openTabs.clear();
    modifiedFiles.clear();
    currentFile = null;
    document.getElementById('tabs').innerHTML = `
      <div class="tab active" data-path="welcome">
        <span>Welcome</span>
      </div>
    `;
    editor.setValue(getWelcomeContent());
    loadFiles();
  });
  
  document.getElementById('toggle-sidebar').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('collapsed');
  });
  
  document.querySelectorAll('.panel-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      switchToPanel(tab.dataset.panel);
    });
  });
  
  document.getElementById('clear-console').addEventListener('click', () => {
    document.getElementById('console-output').innerHTML = `
      <div class="console-welcome">
        <i class="fas fa-terminal"></i>
        <p>Click "Run" to execute your code</p>
      </div>
    `;
  });
  
  document.getElementById('refresh-preview').addEventListener('click', () => {
    if (currentFile && currentFile.endsWith('.html')) {
      updatePreview(editor.getValue());
    }
  });
  
  setupModalListeners();
  
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 's') {
        e.preventDefault();
        saveCurrentFile();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        runCode();
      }
    }
  });
}

function setupModalListeners() {
  document.getElementById('new-file-btn').addEventListener('click', () => {
    document.getElementById('new-file-modal').classList.add('active');
    document.getElementById('new-file-name').focus();
  });
  
  document.getElementById('new-folder-btn').addEventListener('click', () => {
    document.getElementById('new-folder-modal').classList.add('active');
    document.getElementById('new-folder-name').focus();
  });
  
  document.getElementById('new-project-btn').addEventListener('click', () => {
    document.getElementById('new-project-modal').classList.add('active');
    document.getElementById('new-project-name').focus();
  });
  
  document.querySelectorAll('.close-modal').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
    });
  });
  
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('active');
      }
    });
  });
  
  document.getElementById('create-file-btn').addEventListener('click', createNewFile);
  document.getElementById('create-folder-btn').addEventListener('click', createNewFolder);
  document.getElementById('create-project-btn').addEventListener('click', createNewProject);
  
  document.getElementById('new-file-name').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') createNewFile();
  });
  document.getElementById('new-folder-name').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') createNewFolder();
  });
  document.getElementById('new-project-name').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') createNewProject();
  });
}

async function createNewFile() {
  const name = document.getElementById('new-file-name').value.trim();
  if (!name) return;
  
  try {
    const response = await fetch(`/api/create-file/${currentProject}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, type: 'file' })
    });
    
    const data = await response.json();
    if (data.success) {
      document.getElementById('new-file-modal').classList.remove('active');
      document.getElementById('new-file-name').value = '';
      loadFiles();
      showConsoleOutput(`Created file: ${name}`, 'success');
    } else {
      showConsoleOutput(`Error: ${data.error}`, 'error');
    }
  } catch (error) {
    showConsoleOutput(`Error: ${error.message}`, 'error');
  }
}

async function createNewFolder() {
  const name = document.getElementById('new-folder-name').value.trim();
  if (!name) return;
  
  try {
    const response = await fetch(`/api/create-file/${currentProject}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, type: 'folder' })
    });
    
    const data = await response.json();
    if (data.success) {
      document.getElementById('new-folder-modal').classList.remove('active');
      document.getElementById('new-folder-name').value = '';
      loadFiles();
      showConsoleOutput(`Created folder: ${name}`, 'success');
    } else {
      showConsoleOutput(`Error: ${data.error}`, 'error');
    }
  } catch (error) {
    showConsoleOutput(`Error: ${error.message}`, 'error');
  }
}

async function createNewProject() {
  const name = document.getElementById('new-project-name').value.trim();
  if (!name) return;
  
  try {
    const response = await fetch('/api/create-project', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    
    const data = await response.json();
    if (data.success) {
      document.getElementById('new-project-modal').classList.remove('active');
      document.getElementById('new-project-name').value = '';
      loadProjects();
      currentProject = name;
      showConsoleOutput(`Created project: ${name}`, 'success');
    } else {
      showConsoleOutput(`Error: ${data.error}`, 'error');
    }
  } catch (error) {
    showConsoleOutput(`Error: ${error.message}`, 'error');
  }
}

function showContextMenu(e, item) {
  const existing = document.querySelector('.context-menu');
  if (existing) existing.remove();
  
  const menu = document.createElement('div');
  menu.className = 'context-menu';
  menu.style.left = `${e.pageX}px`;
  menu.style.top = `${e.pageY}px`;
  
  const path = item.dataset.path;
  const type = item.dataset.type;
  
  menu.innerHTML = `
    ${type === 'file' ? `
      <div class="context-menu-item" data-action="open">
        <i class="fas fa-file"></i>
        Open
      </div>
    ` : ''}
    <div class="context-menu-item" data-action="rename">
      <i class="fas fa-edit"></i>
      Rename
    </div>
    <div class="context-menu-divider"></div>
    <div class="context-menu-item" data-action="delete" style="color: var(--accent-error)">
      <i class="fas fa-trash"></i>
      Delete
    </div>
  `;
  
  document.body.appendChild(menu);
  
  menu.querySelectorAll('.context-menu-item').forEach(item => {
    item.addEventListener('click', () => {
      const action = item.dataset.action;
      handleContextAction(action, path, type);
      menu.remove();
    });
  });
  
  document.addEventListener('click', function removeMenu() {
    menu.remove();
    document.removeEventListener('click', removeMenu);
  });
}

async function handleContextAction(action, path, type) {
  switch (action) {
    case 'open':
      openFile(path);
      break;
    case 'delete':
      if (confirm(`Are you sure you want to delete "${path}"?`)) {
        try {
          const response = await fetch(`/api/file/${currentProject}/${path}`, {
            method: 'DELETE'
          });
          const data = await response.json();
          if (data.success) {
            if (openTabs.has(path)) {
              closeTab(path);
            }
            loadFiles();
            showConsoleOutput(`Deleted: ${path}`, 'success');
          } else {
            showConsoleOutput(`Error: ${data.error}`, 'error');
          }
        } catch (error) {
          showConsoleOutput(`Error: ${error.message}`, 'error');
        }
      }
      break;
    case 'rename':
      const newName = prompt('Enter new name:', path.split('/').pop());
      if (newName && newName !== path.split('/').pop()) {
        showConsoleOutput('Rename functionality coming soon!', 'info');
      }
      break;
  }
}
