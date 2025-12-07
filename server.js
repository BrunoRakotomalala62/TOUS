const express = require('express');
const cors = require('cors');
const path = require('path');
const { exec } = require('child_process');
const fs = require('fs');

const app = express();
const PORT = 5000;

function sanitizePath(basePath, userPath) {
  const resolved = path.resolve(basePath, userPath);
  if (!resolved.startsWith(path.resolve(basePath))) {
    return null;
  }
  return resolved;
}

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

const projectsDir = path.join(__dirname, 'projects');
if (!fs.existsSync(projectsDir)) {
  fs.mkdirSync(projectsDir, { recursive: true });
}

const sampleProject = path.join(projectsDir, 'my-project');
if (!fs.existsSync(sampleProject)) {
  fs.mkdirSync(sampleProject, { recursive: true });
  fs.writeFileSync(path.join(sampleProject, 'main.js'), `// Welcome to CodeEditor!\n// Start coding here...\n\nconsole.log("Hello, World!");\n\nfunction greet(name) {\n  return \`Hello, \${name}!\`;\n}\n\nconsole.log(greet("Developer"));`);
  fs.writeFileSync(path.join(sampleProject, 'index.html'), `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>My Project</title>\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n  <h1>Hello World!</h1>\n  <p>Welcome to my project.</p>\n  <script src="main.js"></script>\n</body>\n</html>`);
  fs.writeFileSync(path.join(sampleProject, 'style.css'), `* {\n  margin: 0;\n  padding: 0;\n  box-sizing: border-box;\n}\n\nbody {\n  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;\n  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);\n  min-height: 100vh;\n  display: flex;\n  justify-content: center;\n  align-items: center;\n  color: white;\n}\n\nh1 {\n  font-size: 3rem;\n  margin-bottom: 1rem;\n}\n\np {\n  font-size: 1.2rem;\n  opacity: 0.9;\n}`);
  fs.writeFileSync(path.join(sampleProject, 'app.py'), `# Python Example\n\ndef main():\n    print("Hello from Python!")\n    \n    numbers = [1, 2, 3, 4, 5]\n    squared = [x**2 for x in numbers]\n    print(f"Squared numbers: {squared}")\n\nif __name__ == "__main__":\n    main()`);
}

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api/projects', (req, res) => {
  try {
    const projects = fs.readdirSync(projectsDir).filter(name => {
      return fs.statSync(path.join(projectsDir, name)).isDirectory();
    });
    res.json({ projects });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/files/:project', (req, res) => {
  try {
    const projectPath = path.join(projectsDir, req.params.project);
    if (!fs.existsSync(projectPath)) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    function getFiles(dir, basePath = '') {
      const items = fs.readdirSync(dir);
      let files = [];
      
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const relativePath = path.join(basePath, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          files.push({
            name: item,
            path: relativePath,
            type: 'folder',
            children: getFiles(fullPath, relativePath)
          });
        } else {
          files.push({
            name: item,
            path: relativePath,
            type: 'file'
          });
        }
      }
      return files;
    }
    
    const files = getFiles(projectPath);
    res.json({ files });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/file/:project/*', (req, res) => {
  try {
    const filePath = req.params[0];
    const projectPath = path.join(projectsDir, req.params.project);
    const fullPath = sanitizePath(projectPath, filePath);
    
    if (!fullPath) {
      return res.status(403).json({ error: 'Invalid file path' });
    }
    
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    const content = fs.readFileSync(fullPath, 'utf-8');
    res.json({ content, path: filePath });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/file/:project/*', (req, res) => {
  try {
    const filePath = req.params[0];
    const projectPath = path.join(projectsDir, req.params.project);
    const fullPath = sanitizePath(projectPath, filePath);
    
    if (!fullPath) {
      return res.status(403).json({ error: 'Invalid file path' });
    }
    
    const { content } = req.body;
    
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(fullPath, content);
    res.json({ success: true, message: 'File saved successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/create-file/:project', (req, res) => {
  try {
    const { name, type } = req.body;
    const projectPath = path.join(projectsDir, req.params.project);
    const fullPath = sanitizePath(projectPath, name);
    
    if (!fullPath) {
      return res.status(403).json({ error: 'Invalid file path' });
    }
    
    if (fs.existsSync(fullPath)) {
      return res.status(400).json({ error: 'File already exists' });
    }
    
    if (type === 'folder') {
      fs.mkdirSync(fullPath, { recursive: true });
    } else {
      const dir = path.dirname(fullPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(fullPath, '');
    }
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/file/:project/*', (req, res) => {
  try {
    const filePath = req.params[0];
    const projectPath = path.join(projectsDir, req.params.project);
    const fullPath = sanitizePath(projectPath, filePath);
    
    if (!fullPath) {
      return res.status(403).json({ error: 'Invalid file path' });
    }
    
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      fs.rmSync(fullPath, { recursive: true });
    } else {
      fs.unlinkSync(fullPath);
    }
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/run', (req, res) => {
  const { code, language } = req.body;
  
  let command;
  let filename;
  let cleanup = true;
  
  switch (language) {
    case 'javascript':
      filename = path.join(tempDir, `temp_${Date.now()}.js`);
      fs.writeFileSync(filename, code);
      command = `node "${filename}"`;
      break;
    case 'python':
      filename = path.join(tempDir, `temp_${Date.now()}.py`);
      fs.writeFileSync(filename, code);
      command = `python3 "${filename}"`;
      break;
    case 'html':
      res.json({ 
        output: 'HTML Preview available in the preview panel',
        type: 'html',
        content: code
      });
      return;
    case 'css':
      res.json({ 
        output: 'CSS is applied in the HTML preview',
        type: 'info'
      });
      return;
    default:
      res.json({ output: `Language "${language}" is not supported for execution yet.`, type: 'error' });
      return;
  }
  
  exec(command, { timeout: 10000, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
    if (cleanup && filename && fs.existsSync(filename)) {
      fs.unlinkSync(filename);
    }
    
    if (error) {
      if (error.killed) {
        res.json({ output: 'Execution timed out (10 second limit)', type: 'error' });
      } else {
        res.json({ output: stderr || error.message, type: 'error' });
      }
      return;
    }
    
    res.json({ output: stdout || stderr || 'Program executed successfully with no output.', type: 'success' });
  });
});

app.post('/api/create-project', (req, res) => {
  try {
    const { name } = req.body;
    const projectPath = path.join(projectsDir, name);
    
    if (fs.existsSync(projectPath)) {
      return res.status(400).json({ error: 'Project already exists' });
    }
    
    fs.mkdirSync(projectPath, { recursive: true });
    fs.writeFileSync(path.join(projectPath, 'main.js'), `// ${name}\n// Start coding here!\n\nconsole.log("Hello from ${name}!");`);
    
    res.json({ success: true, project: name });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Code Editor Platform running at http://0.0.0.0:${PORT}`);
  console.log('Ready to code!');
});
