const express = require('express');
const cors = require('cors');
const path = require('path');
const { exec } = require('child_process');
const fs = require('fs');
const OpenAI = require('openai');
const puppeteer = require('puppeteer');

const app = express();
const PORT = 5000;

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

let browser = null;
async function getBrowser() {
  if (!browser) {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
  }
  return browser;
}

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

app.post('/api/shell', (req, res) => {
  const { command, project } = req.body;
  
  if (!command || command.trim() === '') {
    return res.json({ output: '', type: 'empty' });
  }

  const dangerousCommands = ['rm -rf /', 'mkfs', 'dd if=', ':(){:|:&};:'];
  for (const dangerous of dangerousCommands) {
    if (command.includes(dangerous)) {
      return res.json({ 
        output: 'This command is not allowed for security reasons.', 
        type: 'error' 
      });
    }
  }

  const workingDir = project ? path.join(projectsDir, project) : projectsDir;

  exec(command, { 
    timeout: 30000, 
    maxBuffer: 1024 * 1024 * 5,
    cwd: workingDir
  }, (error, stdout, stderr) => {
    if (error) {
      if (error.killed) {
        res.json({ output: 'Command timed out (30 second limit)', type: 'error' });
      } else {
        res.json({ output: stderr || error.message, type: 'error' });
      }
      return;
    }
    
    const output = stdout || stderr || '';
    res.json({ 
      output: output, 
      type: output ? 'success' : 'empty'
    });
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

const secretsDir = path.join(__dirname, '.secrets');
if (!fs.existsSync(secretsDir)) {
  fs.mkdirSync(secretsDir, { recursive: true });
}

app.get('/api/secrets/:project', (req, res) => {
  try {
    const secretsFile = path.join(secretsDir, `${req.params.project}.json`);
    if (!fs.existsSync(secretsFile)) {
      return res.json({ secrets: {} });
    }
    const secrets = JSON.parse(fs.readFileSync(secretsFile, 'utf-8'));
    res.json({ secrets });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/secrets/:project', (req, res) => {
  try {
    const { key, value } = req.body;
    const secretsFile = path.join(secretsDir, `${req.params.project}.json`);
    
    let secrets = {};
    if (fs.existsSync(secretsFile)) {
      secrets = JSON.parse(fs.readFileSync(secretsFile, 'utf-8'));
    }
    
    secrets[key] = value;
    fs.writeFileSync(secretsFile, JSON.stringify(secrets, null, 2));
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/secrets/:project/:key', (req, res) => {
  try {
    const secretsFile = path.join(secretsDir, `${req.params.project}.json`);
    
    if (!fs.existsSync(secretsFile)) {
      return res.status(404).json({ error: 'Secrets file not found' });
    }
    
    const secrets = JSON.parse(fs.readFileSync(secretsFile, 'utf-8'));
    delete secrets[req.params.key];
    fs.writeFileSync(secretsFile, JSON.stringify(secrets, null, 2));
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const agentConversations = new Map();

app.post('/api/agent/chat', async (req, res) => {
  try {
    const { message, project, files, conversationId } = req.body;
    
    if (!process.env.OPENAI_API_KEY) {
      return res.status(400).json({ 
        error: 'OpenAI API key not configured. Please add OPENAI_API_KEY to your secrets.',
        type: 'config_error'
      });
    }

    let projectFiles = {};
    if (project) {
      const projectPath = path.join(projectsDir, project);
      if (fs.existsSync(projectPath)) {
        function readProjectFiles(dir, basePath = '') {
          const items = fs.readdirSync(dir);
          for (const item of items) {
            const fullPath = path.join(dir, item);
            const relativePath = path.join(basePath, item);
            const stat = fs.statSync(fullPath);
            if (stat.isFile() && stat.size < 100000) {
              try {
                projectFiles[relativePath] = fs.readFileSync(fullPath, 'utf-8');
              } catch (e) {}
            } else if (stat.isDirectory()) {
              readProjectFiles(fullPath, relativePath);
            }
          }
        }
        readProjectFiles(projectPath);
      }
    }

    const systemPrompt = `You are an intelligent AI coding assistant similar to Replit Agent. You help developers with:
- Analyzing and understanding code
- Detecting bugs and issues
- Suggesting fixes and improvements
- Writing new code and features
- Explaining code concepts
- Refactoring and optimizing code

Current project files:
${Object.entries(projectFiles).map(([path, content]) => `--- ${path} ---\n${content.substring(0, 5000)}`).join('\n\n')}

When you suggest code changes, format them clearly with the file path and the complete modified code.
If asked to modify a file, provide the complete new content for that file.
Be helpful, concise, and provide actionable solutions.
When detecting bugs, explain what the bug is, why it's a problem, and how to fix it.`;

    let conversationHistory = agentConversations.get(conversationId) || [];
    
    conversationHistory.push({ role: 'user', content: message });

    const response = await openai.chat.completions.create({
      model: 'gpt-5',
      messages: [
        { role: 'system', content: systemPrompt },
        ...conversationHistory
      ],
      max_completion_tokens: 4096
    });

    const assistantMessage = response.choices[0].message.content;
    conversationHistory.push({ role: 'assistant', content: assistantMessage });
    
    if (conversationHistory.length > 20) {
      conversationHistory = conversationHistory.slice(-20);
    }
    agentConversations.set(conversationId, conversationHistory);

    const codeBlocks = [];
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    let match;
    while ((match = codeBlockRegex.exec(assistantMessage)) !== null) {
      codeBlocks.push({
        language: match[1] || 'text',
        code: match[2].trim()
      });
    }

    res.json({
      response: assistantMessage,
      codeBlocks,
      conversationId: conversationId || Date.now().toString()
    });
  } catch (error) {
    console.error('Agent chat error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/agent/analyze', async (req, res) => {
  try {
    const { code, language, type } = req.body;
    
    if (!process.env.OPENAI_API_KEY) {
      return res.status(400).json({ 
        error: 'OpenAI API key not configured.',
        type: 'config_error'
      });
    }

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

    const response = await openai.chat.completions.create({
      model: 'gpt-5',
      messages: [
        { role: 'system', content: 'You are an expert code analyst. Provide detailed, actionable analysis.' },
        { role: 'user', content: prompt }
      ],
      max_completion_tokens: 4096
    });

    res.json({
      analysis: response.choices[0].message.content,
      type
    });
  } catch (error) {
    console.error('Agent analyze error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/agent/generate', async (req, res) => {
  try {
    const { prompt, language, context } = req.body;
    
    if (!process.env.OPENAI_API_KEY) {
      return res.status(400).json({ 
        error: 'OpenAI API key not configured.',
        type: 'config_error'
      });
    }

    const systemPrompt = `You are an expert ${language} developer. Generate clean, well-commented, production-ready code.
${context ? `Context:\n${context}` : ''}
Provide only the code without explanations unless asked.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-5',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      max_completion_tokens: 4096
    });

    const generatedCode = response.choices[0].message.content;
    
    const codeMatch = generatedCode.match(/```\w*\n([\s\S]*?)```/);
    const cleanCode = codeMatch ? codeMatch[1].trim() : generatedCode;

    res.json({
      code: cleanCode,
      fullResponse: generatedCode
    });
  } catch (error) {
    console.error('Agent generate error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/agent/apply-fix', async (req, res) => {
  try {
    const { project, filePath, newContent } = req.body;
    
    const projectPath = path.join(projectsDir, project);
    const fullPath = sanitizePath(projectPath, filePath);
    
    if (!fullPath) {
      return res.status(403).json({ error: 'Invalid file path' });
    }

    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(fullPath, newContent);
    res.json({ success: true, message: 'Fix applied successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/agent/web-search', async (req, res) => {
  try {
    const { query, maxResults } = req.body;
    
    const browserInstance = await getBrowser();
    const page = await browserInstance.newPage();
    
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });

    const results = await page.evaluate((max) => {
      const items = [];
      const searchResults = document.querySelectorAll('div.g');
      
      for (let i = 0; i < Math.min(searchResults.length, max || 5); i++) {
        const result = searchResults[i];
        const titleEl = result.querySelector('h3');
        const linkEl = result.querySelector('a');
        const snippetEl = result.querySelector('.VwiC3b');
        
        if (titleEl && linkEl) {
          items.push({
            title: titleEl.textContent,
            url: linkEl.href,
            snippet: snippetEl ? snippetEl.textContent : ''
          });
        }
      }
      return items;
    }, maxResults || 5);

    await page.close();
    
    res.json({ results, query });
  } catch (error) {
    console.error('Web search error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/agent/fetch-page', async (req, res) => {
  try {
    const { url } = req.body;
    
    const browserInstance = await getBrowser();
    const page = await browserInstance.newPage();
    
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    const content = await page.evaluate(() => {
      const article = document.querySelector('article') || document.querySelector('main') || document.body;
      
      const scripts = article.querySelectorAll('script, style, nav, footer, header, aside');
      scripts.forEach(el => el.remove());
      
      return {
        title: document.title,
        content: article.innerText.substring(0, 10000),
        html: article.innerHTML.substring(0, 20000)
      };
    });

    await page.close();
    
    res.json({ ...content, url });
  } catch (error) {
    console.error('Fetch page error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/agent/smart-search', async (req, res) => {
  try {
    const { query, context } = req.body;
    
    if (!process.env.OPENAI_API_KEY) {
      return res.status(400).json({ 
        error: 'OpenAI API key not configured.',
        type: 'config_error'
      });
    }

    const browserInstance = await getBrowser();
    const page = await browserInstance.newPage();
    
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query + ' programming documentation')}`;
    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });

    const searchResults = await page.evaluate(() => {
      const items = [];
      const results = document.querySelectorAll('div.g');
      
      for (let i = 0; i < Math.min(results.length, 3); i++) {
        const result = results[i];
        const titleEl = result.querySelector('h3');
        const linkEl = result.querySelector('a');
        const snippetEl = result.querySelector('.VwiC3b');
        
        if (titleEl && linkEl) {
          items.push({
            title: titleEl.textContent,
            url: linkEl.href,
            snippet: snippetEl ? snippetEl.textContent : ''
          });
        }
      }
      return items;
    });

    await page.close();

    const searchContext = searchResults.map(r => `${r.title}: ${r.snippet}`).join('\n');
    
    const response = await openai.chat.completions.create({
      model: 'gpt-5',
      messages: [
        { 
          role: 'system', 
          content: 'You are a helpful coding assistant. Use the search results to provide accurate, up-to-date information.' 
        },
        { 
          role: 'user', 
          content: `User question: ${query}\n\nContext: ${context || 'None'}\n\nSearch results:\n${searchContext}\n\nProvide a helpful response based on the search results and your knowledge.` 
        }
      ],
      max_completion_tokens: 2048
    });

    res.json({
      response: response.choices[0].message.content,
      sources: searchResults
    });
  } catch (error) {
    console.error('Smart search error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Code Editor Platform running at http://0.0.0.0:${PORT}`);
  console.log('Ready to code!');
});
