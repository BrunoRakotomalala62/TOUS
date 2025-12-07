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
    switchToEditorOnMobile();
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
    switchToEditorOnMobile();
  } catch (error) {
    console.error('Failed to open file:', error);
    showConsoleOutput(`Error opening file: ${error.message}`, 'error');
  }
}

function switchToEditorOnMobile() {
  if (window.innerWidth <= 768) {
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    const editorWrapper = document.querySelector('.editor-wrapper');
    const tabsContainer = document.querySelector('.tabs-container');
    const rightPanel = document.getElementById('right-panel');
    const toolsPanel = document.getElementById('tools-panel');
    
    document.querySelectorAll('.mobile-nav-item').forEach(item => {
      item.classList.remove('active');
    });
    document.querySelector('.mobile-nav-item[data-view="editor"]')?.classList.add('active');
    
    sidebar.classList.remove('mobile-open');
    sidebarOverlay.classList.remove('active');
    rightPanel.classList.remove('mobile-active');
    toolsPanel.classList.remove('active');
    
    editorWrapper.classList.add('mobile-active');
    if (tabsContainer) tabsContainer.style.display = 'block';
    
    if (editor) {
      setTimeout(() => editor.layout(), 100);
    }
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

function setupShellPanel() {
  const shellPanel = document.getElementById('shell-panel');
  const shellBack = document.getElementById('shell-back');
  const shellOutput = document.getElementById('shell-output');
  const shellClear = document.getElementById('shell-clear');
  const shellCloseTerminal = document.getElementById('shell-close-terminal');
  const shellTerminal = document.getElementById('shell-terminal');
  const shellInput = document.getElementById('shell-input');
  
  let commandHistory = [];
  let historyIndex = -1;
  let isExecuting = false;

  function openShell() {
    shellPanel.classList.add('active');
    setTimeout(() => shellInput.focus(), 100);
  }

  function closeShell() {
    shellPanel.classList.remove('active');
  }

  shellBack.addEventListener('click', closeShell);
  shellCloseTerminal.addEventListener('click', closeShell);

  shellClear.addEventListener('click', () => {
    shellOutput.innerHTML = '';
    shellInput.value = '';
  });

  shellTerminal.addEventListener('click', () => {
    shellInput.focus();
  });

  async function executeCommand() {
    const command = shellInput.value.trim();
    if (!command || isExecuting) return;

    isExecuting = true;
    commandHistory.push(command);
    historyIndex = commandHistory.length;

    const commandLine = document.createElement('div');
    commandLine.className = 'shell-command-line';
    commandLine.innerHTML = `
      <span class="shell-prompt">~/workspace$</span>
      <span class="shell-command">${escapeHtml(command)}</span>
    `;
    shellOutput.appendChild(commandLine);

    shellInput.value = '';

    try {
      const response = await fetch('/api/shell', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command, project: currentProject })
      });

      const data = await response.json();

      if (data.output) {
        const resultLine = document.createElement('div');
        resultLine.className = `shell-result ${data.type}`;
        resultLine.textContent = data.output;
        shellOutput.appendChild(resultLine);
      }
    } catch (error) {
      const errorLine = document.createElement('div');
      errorLine.className = 'shell-result error';
      errorLine.textContent = `Error: ${error.message}`;
      shellOutput.appendChild(errorLine);
    }

    isExecuting = false;
    shellTerminal.scrollTop = shellTerminal.scrollHeight;
    shellInput.focus();
  }

  shellInput.addEventListener('keydown', (e) => {
    if (isExecuting) return;

    if (e.key === 'Enter') {
      e.preventDefault();
      executeCommand();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (historyIndex > 0) {
        historyIndex--;
        shellInput.value = commandHistory[historyIndex];
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex < commandHistory.length - 1) {
        historyIndex++;
        shellInput.value = commandHistory[historyIndex];
      } else {
        historyIndex = commandHistory.length;
        shellInput.value = '';
      }
    }
    
    shellTerminal.scrollTop = shellTerminal.scrollHeight;
  });

  document.querySelectorAll('.new-tab-item').forEach(item => {
    const title = item.querySelector('.new-tab-item-title')?.textContent;
    if (title === 'Shell') {
      item.dataset.action = 'shell';
    }
  });

  window.openShell = openShell;
}

function setupSecretsPanel() {
  const secretsPanel = document.getElementById('secrets-panel');
  const secretsBack = document.getElementById('secrets-back');
  const secretsList = document.getElementById('secrets-list');
  const newSecretBtn = document.getElementById('new-secret-btn');
  const newSecretModal = document.getElementById('new-secret-modal');
  const createSecretBtn = document.getElementById('create-secret-btn');
  
  let secrets = {};

  function openSecrets() {
    secretsPanel.classList.add('active');
    loadSecrets();
  }

  function closeSecrets() {
    secretsPanel.classList.remove('active');
  }

  secretsBack.addEventListener('click', closeSecrets);

  async function loadSecrets() {
    try {
      const response = await fetch(`/api/secrets/${currentProject}`);
      const data = await response.json();
      secrets = data.secrets || {};
      renderSecrets();
    } catch (error) {
      console.error('Failed to load secrets:', error);
    }
  }

  function renderSecrets() {
    const keys = Object.keys(secrets);
    
    if (keys.length === 0) {
      secretsList.innerHTML = `
        <div class="secrets-empty">
          <i class="fas fa-lock"></i>
          <p>No secrets yet</p>
          <p class="secrets-hint">Click "+ New Secret" to add one</p>
        </div>
      `;
      return;
    }

    secretsList.innerHTML = keys.map(key => `
      <div class="secret-item" data-key="${key}">
        <i class="fas fa-key"></i>
        <span class="secret-key">${key}</span>
        <div class="secret-value">
          <span class="secret-dots">••••••••</span>
          <button class="secret-action-btn toggle-secret" title="Show/Hide">
            <i class="fas fa-eye"></i>
          </button>
        </div>
        <div class="secret-actions">
          <button class="secret-action-btn delete-secret" title="Delete">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
    `).join('');

    secretsList.querySelectorAll('.toggle-secret').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const item = e.target.closest('.secret-item');
        const key = item.dataset.key;
        const dotsSpan = item.querySelector('.secret-dots');
        const icon = btn.querySelector('i');
        
        if (dotsSpan.textContent === '••••••••') {
          dotsSpan.textContent = secrets[key];
          icon.classList.remove('fa-eye');
          icon.classList.add('fa-eye-slash');
        } else {
          dotsSpan.textContent = '••••••••';
          icon.classList.remove('fa-eye-slash');
          icon.classList.add('fa-eye');
        }
      });
    });

    secretsList.querySelectorAll('.delete-secret').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const item = e.target.closest('.secret-item');
        const key = item.dataset.key;
        
        if (confirm(`Delete secret "${key}"?`)) {
          try {
            await fetch(`/api/secrets/${currentProject}/${key}`, { method: 'DELETE' });
            delete secrets[key];
            renderSecrets();
            showConsoleOutput(`Deleted secret: ${key}`, 'success');
          } catch (error) {
            showConsoleOutput(`Error: ${error.message}`, 'error');
          }
        }
      });
    });
  }

  newSecretBtn.addEventListener('click', () => {
    newSecretModal.classList.add('active');
    document.getElementById('secret-key').focus();
  });

  createSecretBtn.addEventListener('click', async () => {
    const key = document.getElementById('secret-key').value.trim().toUpperCase();
    const value = document.getElementById('secret-value').value;
    
    if (!key) {
      showConsoleOutput('Secret key is required', 'error');
      return;
    }

    try {
      const response = await fetch(`/api/secrets/${currentProject}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value })
      });
      
      const data = await response.json();
      if (data.success) {
        newSecretModal.classList.remove('active');
        document.getElementById('secret-key').value = '';
        document.getElementById('secret-value').value = '';
        loadSecrets();
        showConsoleOutput(`Added secret: ${key}`, 'success');
      } else {
        showConsoleOutput(`Error: ${data.error}`, 'error');
      }
    } catch (error) {
      showConsoleOutput(`Error: ${error.message}`, 'error');
    }
  });

  document.querySelectorAll('.secrets-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.secrets-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
    });
  });

  window.openSecrets = openSecrets;
}

function setupNewTabPanel() {
  const newTabPanel = document.getElementById('new-tab-panel');
  const newTabBtn = document.getElementById('new-tab-btn');
  const newTabClose = document.getElementById('new-tab-close');
  const newTabSearch = document.getElementById('new-tab-search');
  
  newTabBtn.addEventListener('click', () => {
    newTabPanel.classList.add('active');
    newTabSearch.focus();
  });
  
  newTabClose.addEventListener('click', () => {
    newTabPanel.classList.remove('active');
  });
  
  document.querySelectorAll('.new-tab-item').forEach(item => {
    item.addEventListener('click', () => {
      const action = item.dataset.action;
      newTabPanel.classList.remove('active');
      
      if (action === 'console') {
        if (window.innerWidth <= 768) {
          document.querySelector('.mobile-nav-item[data-view="console"]')?.click();
        } else {
          switchToPanel('console');
        }
      } else if (action === 'preview') {
        if (window.innerWidth <= 768) {
          document.querySelector('.mobile-nav-item[data-view="preview"]')?.click();
        } else {
          switchToPanel('preview');
        }
      } else if (action === 'shell') {
        if (window.openShell) window.openShell();
      } else if (action === 'secrets') {
        if (window.openSecrets) window.openSecrets();
      }
    });
  });
  
  newTabSearch.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    document.querySelectorAll('.new-tab-item').forEach(item => {
      const title = item.querySelector('.new-tab-item-title')?.textContent.toLowerCase() || '';
      const desc = item.querySelector('.new-tab-item-desc')?.textContent.toLowerCase() || '';
      if (title.includes(query) || desc.includes(query)) {
        item.style.display = 'flex';
      } else {
        item.style.display = 'none';
      }
    });
  });
}

function setupMobileNavigation() {
  const mobileNav = document.getElementById('mobile-nav');
  const sidebar = document.getElementById('sidebar');
  const rightPanel = document.getElementById('right-panel');
  const editorWrapper = document.querySelector('.editor-wrapper');
  const tabsContainer = document.querySelector('.tabs-container');
  const sidebarOverlay = document.getElementById('sidebar-overlay');
  const toolsPanel = document.getElementById('tools-panel');
  const toolsClose = document.getElementById('tools-close');
  
  function isMobile() {
    return window.innerWidth <= 768;
  }

  function switchMobileView(view) {
    if (!isMobile()) return;
    
    document.querySelectorAll('.mobile-nav-item').forEach(item => {
      item.classList.remove('active');
    });
    document.querySelector(`.mobile-nav-item[data-view="${view}"]`)?.classList.add('active');

    sidebar.classList.remove('mobile-open');
    sidebarOverlay.classList.remove('active');
    rightPanel.classList.remove('mobile-active');
    editorWrapper.classList.remove('mobile-active');
    toolsPanel.classList.remove('active');
    document.body.classList.remove('sidebar-open');
    if (tabsContainer) tabsContainer.style.display = 'none';

    document.querySelectorAll('.console-panel, .preview-panel').forEach(p => p.classList.remove('active'));

    switch(view) {
      case 'files':
        sidebar.classList.add('mobile-open');
        sidebarOverlay.classList.add('active');
        document.body.classList.add('sidebar-open');
        break;
      case 'editor':
        editorWrapper.classList.add('mobile-active');
        if (tabsContainer) tabsContainer.style.display = 'block';
        if (editor) editor.layout();
        break;
      case 'console':
        rightPanel.classList.add('mobile-active');
        document.getElementById('console-panel').classList.add('active');
        break;
      case 'preview':
        rightPanel.classList.add('mobile-active');
        document.getElementById('preview-panel').classList.add('active');
        break;
      case 'tools':
        toolsPanel.classList.add('active');
        editorWrapper.classList.add('mobile-active');
        if (tabsContainer) tabsContainer.style.display = 'block';
        if (editor) editor.layout();
        break;
    }
  }

  mobileNav.querySelectorAll('.mobile-nav-item').forEach(item => {
    item.addEventListener('click', () => {
      switchMobileView(item.dataset.view);
    });
  });

  toolsClose.addEventListener('click', () => {
    toolsPanel.classList.remove('active');
    switchMobileView('editor');
  });

  sidebarOverlay.addEventListener('click', () => {
    sidebar.classList.remove('mobile-open');
    sidebarOverlay.classList.remove('active');
    document.body.classList.remove('sidebar-open');
    switchMobileView('editor');
  });
  
  const closeSidebarMobile = document.getElementById('close-sidebar-mobile');
  if (closeSidebarMobile) {
    closeSidebarMobile.addEventListener('click', () => {
      sidebar.classList.remove('mobile-open');
      sidebarOverlay.classList.remove('active');
      document.body.classList.remove('sidebar-open');
      switchMobileView('editor');
    });
  }

  function handleResize() {
    if (isMobile()) {
      switchMobileView('editor');
    } else {
      sidebar.classList.remove('mobile-open');
      sidebarOverlay.classList.remove('active');
      rightPanel.classList.remove('mobile-active');
      editorWrapper.classList.remove('mobile-active');
      toolsPanel.classList.remove('active');
      if (tabsContainer) tabsContainer.style.display = '';
      document.getElementById('console-panel').classList.add('active');
      document.getElementById('preview-panel').classList.remove('active');
    }
    if (editor) editor.layout();
  }

  window.addEventListener('resize', handleResize);
  
  if (isMobile()) {
    switchMobileView('editor');
  }
}

function setupEventListeners() {
  document.getElementById('run-btn').addEventListener('click', runCode);
  document.getElementById('save-btn').addEventListener('click', saveCurrentFile);
  
  setupDropdownMenus();
  setupMobileNavigation();
  setupNewTabPanel();
  setupShellPanel();
  setupSecretsPanel();
  
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
  
  document.getElementById('upload-file-btn').addEventListener('click', () => {
    document.getElementById('file-upload-input').click();
  });
  
  document.getElementById('file-upload-input').addEventListener('change', handleFileUpload);
  
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

async function handleFileUpload(e) {
  const files = e.target.files;
  if (!files || files.length === 0) return;
  
  for (const file of files) {
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const content = event.target.result;
        
        try {
          const response = await fetch(`/api/file/${currentProject}/${file.name}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content })
          });
          
          const data = await response.json();
          if (data.success) {
            loadFiles();
            showConsoleOutput(`Uploaded: ${file.name}`, 'success');
          } else {
            showConsoleOutput(`Error uploading ${file.name}: ${data.error}`, 'error');
          }
        } catch (error) {
          showConsoleOutput(`Error uploading ${file.name}: ${error.message}`, 'error');
        }
      };
      reader.readAsText(file);
    } catch (error) {
      showConsoleOutput(`Error reading ${file.name}: ${error.message}`, 'error');
    }
  }
  
  e.target.value = '';
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

let agentConversationId = null;
let agentConversationHistory = [];

function setupAgentPanel() {
  const agentPanel = document.getElementById('agent-panel');
  const agentBack = document.getElementById('agent-back');
  const agentClear = document.getElementById('agent-clear');
  const agentInput = document.getElementById('agent-input');
  const agentSend = document.getElementById('agent-send');
  const agentMessages = document.getElementById('agent-messages');
  
  agentBack.addEventListener('click', closeAgent);
  
  agentClear.addEventListener('click', () => {
    agentMessages.innerHTML = `
      <div class="agent-welcome">
        <div class="agent-welcome-icon">
          <i class="fas fa-robot"></i>
        </div>
        <h3>AI Coding Assistant (Claude 3.7)</h3>
        <p>Powered by Puter.js - Free & Unlimited</p>
        <div class="agent-capabilities">
          <div class="capability">
            <i class="fas fa-bug"></i>
            <span>Detect & fix bugs</span>
          </div>
          <div class="capability">
            <i class="fas fa-code"></i>
            <span>Write & edit code</span>
          </div>
          <div class="capability">
            <i class="fas fa-file-plus"></i>
            <span>Create files & projects</span>
          </div>
          <div class="capability">
            <i class="fas fa-globe"></i>
            <span>Search the web</span>
          </div>
        </div>
      </div>
    `;
    agentConversationId = null;
    agentConversationHistory = [];
  });

  document.querySelectorAll('.agent-tool').forEach(tool => {
    tool.addEventListener('click', () => {
      document.querySelectorAll('.agent-tool').forEach(t => t.classList.remove('active'));
      tool.classList.add('active');
      
      const toolName = tool.dataset.tool;
      document.querySelectorAll('.agent-chat-view, .agent-analyze-view, .agent-generate-view, .agent-search-view')
        .forEach(v => v.classList.remove('active'));
      document.getElementById(`agent-${toolName}-view`)?.classList.add('active');
    });
  });

  agentInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendAgentMessage();
    }
  });

  agentInput.addEventListener('input', () => {
    agentInput.style.height = 'auto';
    agentInput.style.height = Math.min(agentInput.scrollHeight, 120) + 'px';
  });

  agentSend.addEventListener('click', sendAgentMessage);

  document.querySelectorAll('.quick-action').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      let message = '';
      
      switch (action) {
        case 'find-bugs':
          message = 'Please analyze the current code and find any bugs or issues.';
          break;
        case 'optimize':
          message = 'Please optimize the current code for better performance and readability.';
          break;
        case 'explain':
          message = 'Please explain what this code does in detail.';
          break;
      }
      
      agentInput.value = message;
      sendAgentMessage();
    });
  });

  document.querySelectorAll('.analyze-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      analyzeCode(btn.dataset.type);
    });
  });

  document.getElementById('generate-btn')?.addEventListener('click', generateCode);
  document.getElementById('web-search-btn')?.addEventListener('click', performWebSearch);
  
  document.getElementById('web-search-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      performWebSearch();
    }
  });

  document.querySelectorAll('.new-tab-item').forEach(item => {
    const title = item.querySelector('.new-tab-item-title')?.textContent;
    if (title === 'Agent') {
      item.addEventListener('click', openAgent);
    }
  });
}

function openAgent() {
  const agentPanel = document.getElementById('agent-panel');
  agentPanel.classList.add('active');
  
  const newTabPanel = document.getElementById('new-tab-panel');
  if (newTabPanel) newTabPanel.classList.remove('active');
  
  document.getElementById('agent-input')?.focus();
}

function closeAgent() {
  const agentPanel = document.getElementById('agent-panel');
  agentPanel.classList.remove('active');
}

async function getProjectFilesContext() {
  try {
    const response = await fetch(`/api/files/${currentProject}`);
    const data = await response.json();
    
    let filesContext = '';
    async function readFiles(files) {
      for (const file of files) {
        if (file.type === 'file') {
          try {
            const fileResponse = await fetch(`/api/file/${currentProject}/${file.path}`);
            const fileData = await fileResponse.json();
            if (fileData.content && fileData.content.length < 5000) {
              filesContext += `\n--- ${file.path} ---\n${fileData.content}\n`;
            }
          } catch (e) {}
        } else if (file.children) {
          await readFiles(file.children);
        }
      }
    }
    await readFiles(data.files || []);
    return filesContext;
  } catch (error) {
    return '';
  }
}

async function sendAgentMessage() {
  const agentInput = document.getElementById('agent-input');
  const agentMessages = document.getElementById('agent-messages');
  const message = agentInput.value.trim();
  
  if (!message) return;

  const welcome = agentMessages.querySelector('.agent-welcome');
  if (welcome) welcome.remove();

  appendAgentMessage('user', message);
  agentInput.value = '';
  agentInput.style.height = 'auto';

  const loadingDiv = document.createElement('div');
  loadingDiv.className = 'agent-loading';
  loadingDiv.innerHTML = '<div class="spinner"></div><span>Claude 3.7 is thinking...</span>';
  agentMessages.appendChild(loadingDiv);
  agentMessages.scrollTop = agentMessages.scrollHeight;

  try {
    const projectFiles = await getProjectFilesContext();
    
    const systemPrompt = `You are an intelligent AI coding assistant powered by Claude 3.7 Sonnet. You help developers with:
- Analyzing and understanding code
- Detecting bugs and issues
- Suggesting fixes and improvements  
- Writing new code and features
- Explaining code concepts
- Creating new files and projects
- Searching the web for documentation

Current project: ${currentProject}
Project files:
${projectFiles}

IMPORTANT CAPABILITIES:
1. When asked to create a file, provide the file content in a code block and specify the filename.
2. When asked to modify code, provide the complete modified file content.
3. When detecting bugs, explain what the bug is, why it's a problem, and how to fix it.
4. Be helpful, concise, and provide actionable solutions.
5. Format code suggestions with the filename as a comment at the top.`;

    agentConversationHistory.push({ role: 'user', content: message });

    const messages = [
      { role: 'system', content: systemPrompt },
      ...agentConversationHistory
    ];

    let fullResponse = '';
    const response = await puter.ai.chat(messages, {
      model: 'claude-3-7-sonnet',
      stream: true
    });

    loadingDiv.innerHTML = '<div class="spinner"></div><span>Generating response...</span>';

    for await (const part of response) {
      if (part?.text) {
        fullResponse += part.text;
      }
    }

    loadingDiv.remove();

    if (!fullResponse) {
      appendAgentMessage('assistant', 'No response received. Please try again.');
      return;
    }

    agentConversationHistory.push({ role: 'assistant', content: fullResponse });
    
    if (agentConversationHistory.length > 20) {
      agentConversationHistory = agentConversationHistory.slice(-20);
    }

    const codeBlocks = [];
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    let match;
    while ((match = codeBlockRegex.exec(fullResponse)) !== null) {
      codeBlocks.push({
        language: match[1] || 'text',
        code: match[2].trim()
      });
    }

    appendAgentMessage('assistant', fullResponse, codeBlocks);
    
    await processAgentActions(fullResponse, codeBlocks);
    
  } catch (error) {
    loadingDiv.remove();
    appendAgentMessage('assistant', `Error: ${error.message}. Please make sure Puter.js is loaded and try again.`);
  }
}

async function processAgentActions(response, codeBlocks) {
  const createFileMatch = response.match(/(?:create|créer|nouveau)\s+(?:file|fichier|un fichier)\s*[:\s]+([^\n`]+)/i);
  
  if (createFileMatch && codeBlocks.length > 0) {
    const suggestedFileName = createFileMatch[1].trim().replace(/[`"']/g, '');
    
    const actionDiv = document.createElement('div');
    actionDiv.className = 'agent-action-prompt';
    actionDiv.innerHTML = `
      <p><i class="fas fa-file-plus"></i> Create file: <strong>${suggestedFileName}</strong>?</p>
      <div class="action-buttons">
        <button class="btn btn-primary create-file-action" data-filename="${suggestedFileName}">
          <i class="fas fa-check"></i> Create
        </button>
        <button class="btn btn-secondary dismiss-action">
          <i class="fas fa-times"></i> Dismiss
        </button>
      </div>
    `;
    
    const agentMessages = document.getElementById('agent-messages');
    agentMessages.appendChild(actionDiv);
    agentMessages.scrollTop = agentMessages.scrollHeight;
    
    actionDiv.querySelector('.create-file-action').addEventListener('click', async () => {
      try {
        const content = codeBlocks[0].code;
        await fetch(`/api/file/${currentProject}/${suggestedFileName}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content })
        });
        loadFiles();
        showConsoleOutput(`Created file: ${suggestedFileName}`, 'success');
        actionDiv.remove();
      } catch (error) {
        showConsoleOutput(`Error creating file: ${error.message}`, 'error');
      }
    });
    
    actionDiv.querySelector('.dismiss-action').addEventListener('click', () => {
      actionDiv.remove();
    });
  }
}

function appendAgentMessage(role, content, codeBlocks = []) {
  const agentMessages = document.getElementById('agent-messages');
  
  const messageDiv = document.createElement('div');
  messageDiv.className = `agent-message ${role}`;
  
  let formattedContent = escapeHtml(content)
    .replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
      return `<pre><code class="language-${lang || 'text'}">${escapeHtml(code.trim())}</code></pre>`;
    })
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');

  messageDiv.innerHTML = `<div class="message-content">${formattedContent}</div>`;
  
  if (role === 'assistant' && codeBlocks.length > 0) {
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'code-block-actions';
    actionsDiv.innerHTML = `
      <button class="copy-btn" title="Copy code">
        <i class="fas fa-copy"></i> Copy
      </button>
      <button class="apply-btn" title="Apply to editor">
        <i class="fas fa-check"></i> Apply
      </button>
    `;
    
    actionsDiv.querySelector('.copy-btn').addEventListener('click', () => {
      navigator.clipboard.writeText(codeBlocks[0].code);
      showConsoleOutput('Code copied to clipboard!', 'success');
    });
    
    actionsDiv.querySelector('.apply-btn').addEventListener('click', () => {
      if (currentFile && editor) {
        editor.setValue(codeBlocks[0].code);
        showConsoleOutput('Code applied to editor!', 'success');
      } else {
        showConsoleOutput('Please open a file first', 'info');
      }
    });
    
    messageDiv.querySelector('.message-content').appendChild(actionsDiv);
  }
  
  agentMessages.appendChild(messageDiv);
  agentMessages.scrollTop = agentMessages.scrollHeight;
}

async function analyzeCode(type) {
  const analyzeResult = document.getElementById('analyze-result');
  
  if (!editor) {
    analyzeResult.innerHTML = '<p style="color: var(--accent-error);">No code to analyze. Please open a file first.</p>';
    return;
  }

  const code = editor.getValue();
  const language = getLanguageFromPath(currentFile);

  analyzeResult.innerHTML = '<div class="agent-loading"><div class="spinner"></div><span>Claude 3.7 analyzing code...</span></div>';

  try {
    let prompt;
    switch (type) {
      case 'bugs':
        prompt = `Analyze this ${language} code for bugs and issues. List each bug with:
1. Line number or location
2. Description of the bug
3. Why it's a problem
4. How to fix it

Code:
\`\`\`${language}
${code}
\`\`\``;
        break;
      case 'optimize':
        prompt = `Analyze this ${language} code and suggest optimizations for:
1. Performance improvements
2. Code readability
3. Best practices
4. Memory efficiency

Provide the optimized code with explanations.

Code:
\`\`\`${language}
${code}
\`\`\``;
        break;
      case 'explain':
        prompt = `Explain this ${language} code in detail:
1. What does it do?
2. How does it work step by step?
3. What are the key concepts used?
4. Are there any potential issues?

Code:
\`\`\`${language}
${code}
\`\`\``;
        break;
      default:
        prompt = `Analyze this ${language} code and provide insights:\n\`\`\`${language}\n${code}\n\`\`\``;
    }

    let fullResponse = '';
    const response = await puter.ai.chat(prompt, {
      model: 'claude-3-7-sonnet',
      stream: true
    });

    for await (const part of response) {
      if (part?.text) {
        fullResponse += part.text;
      }
    }

    let formattedAnalysis = escapeHtml(fullResponse)
      .replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
        return `<pre><code>${escapeHtml(code.trim())}</code></pre>`;
      })
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');

    analyzeResult.innerHTML = `<div class="analysis-content">${formattedAnalysis}</div>`;
  } catch (error) {
    analyzeResult.innerHTML = `<p style="color: var(--accent-error);">Error: ${error.message}</p>`;
  }
}

async function generateCode() {
  const generateResult = document.getElementById('generate-result');
  const prompt = document.getElementById('generate-prompt').value.trim();
  const language = document.getElementById('generate-language').value;

  if (!prompt) {
    generateResult.innerHTML = '<p style="color: var(--accent-warning);">Please describe what code you want to generate.</p>';
    return;
  }

  generateResult.innerHTML = '<div class="agent-loading"><div class="spinner"></div><span>Claude 3.7 generating code...</span></div>';

  try {
    const context = currentFile ? editor?.getValue() : null;
    const systemPrompt = `You are an expert ${language} developer. Generate clean, well-commented, production-ready code.
${context ? `Context:\n${context}` : ''}
Provide only the code without explanations unless asked. Wrap the code in a code block.`;

    let fullResponse = '';
    const response = await puter.ai.chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt }
    ], {
      model: 'claude-3-7-sonnet',
      stream: true
    });

    for await (const part of response) {
      if (part?.text) {
        fullResponse += part.text;
      }
    }
    
    const codeMatch = fullResponse.match(/```\w*\n([\s\S]*?)```/);
    const cleanCode = codeMatch ? codeMatch[1].trim() : fullResponse;

    generateResult.innerHTML = `
      <pre><code>${escapeHtml(cleanCode)}</code></pre>
      <div class="code-block-actions">
        <button class="copy-btn gen-copy-btn">
          <i class="fas fa-copy"></i> Copy
        </button>
        <button class="apply-btn gen-apply-btn">
          <i class="fas fa-check"></i> Apply to Editor
        </button>
      </div>
    `;
    
    generateResult.querySelector('.gen-copy-btn').addEventListener('click', () => {
      navigator.clipboard.writeText(cleanCode);
      showConsoleOutput('Code copied!', 'success');
    });
    
    generateResult.querySelector('.gen-apply-btn').addEventListener('click', () => {
      if (editor) {
        editor.setValue(cleanCode);
        showConsoleOutput('Code applied!', 'success');
      }
    });
  } catch (error) {
    generateResult.innerHTML = `<p style="color: var(--accent-error);">Error: ${error.message}</p>`;
  }
}

async function performWebSearch() {
  const searchResults = document.getElementById('search-results');
  const query = document.getElementById('web-search-input').value.trim();

  if (!query) {
    searchResults.innerHTML = '<p style="color: var(--accent-warning);">Please enter a search query.</p>';
    return;
  }

  searchResults.innerHTML = '<div class="agent-loading"><div class="spinner"></div><span>Searching with AI...</span></div>';

  try {
    const context = currentFile ? editor?.getValue()?.substring(0, 2000) : null;
    
    const searchPrompt = `You are a helpful coding assistant. Answer the following programming question with detailed, accurate information. If it's about a library or framework, provide code examples.

Question: ${query}

${context ? `Current code context:\n\`\`\`\n${context}\n\`\`\`` : ''}

Provide a comprehensive answer with:
1. A clear explanation
2. Code examples if applicable
3. Best practices and tips
4. Common pitfalls to avoid`;

    let fullResponse = '';
    const response = await puter.ai.chat(searchPrompt, {
      model: 'claude-3-7-sonnet',
      stream: true
    });

    for await (const part of response) {
      if (part?.text) {
        fullResponse += part.text;
      }
    }

    let formattedResponse = escapeHtml(fullResponse)
      .replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
        return `<pre><code>${escapeHtml(code.trim())}</code></pre>`;
      })
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');

    let resultsHtml = `
      <div class="search-answer">
        <h4><i class="fas fa-robot"></i> AI Answer (Claude 3.7)</h4>
        <div class="ai-response">${formattedResponse}</div>
      </div>
    `;

    searchResults.innerHTML = resultsHtml;
  } catch (error) {
    searchResults.innerHTML = `<p style="color: var(--accent-error);">Error: ${error.message}</p>`;
  }
}

window.openAgent = openAgent;
window.closeAgent = closeAgent;

const originalSetupEventListeners = setupEventListeners;
setupEventListeners = function() {
  originalSetupEventListeners();
  setupAgentPanel();
};
