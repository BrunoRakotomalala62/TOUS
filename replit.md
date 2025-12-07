# CodeEditor - Online IDE

## Overview
A dynamic code editor platform similar to Replit, built with Node.js, Express, and Monaco Editor. Features a dark theme interface with file management, code execution, live preview capabilities, and an AI coding assistant powered by Puter.js (Claude 3.7 Sonnet - free and unlimited).

## Project Structure
```
/
├── public/
│   ├── index.html      # Main HTML file with IDE layout
│   ├── styles.css      # Dark theme styling
│   ├── script.js       # Monaco editor integration & functionality
│   └── favicon.svg     # Site favicon
├── projects/           # User projects storage
│   └── my-project/     # Sample project with starter files
├── temp/               # Temporary files for code execution
├── server.js           # Express server with API endpoints
├── package.json        # Node.js dependencies
└── .gitignore          # Git ignore file
```

## Features
- **Monaco Editor**: VS Code's editor with syntax highlighting, IntelliSense, and code formatting
- **Multi-Language Support**: JavaScript, Python, HTML, CSS
- **File Management**: Create, edit, delete files and folders
- **Code Execution**: Run JavaScript and Python code with console output
- **HTML Preview**: Live preview for HTML files
- **Project Management**: Create and switch between multiple projects
- **Dark Theme**: Professional dark mode interface
- **Keyboard Shortcuts**: Ctrl/Cmd+S to save, Ctrl/Cmd+Enter to run

## API Endpoints
- `GET /api/projects` - List all projects
- `GET /api/files/:project` - Get file tree for a project
- `GET /api/file/:project/*` - Read file content
- `POST /api/file/:project/*` - Save file content
- `POST /api/create-file/:project` - Create new file or folder
- `DELETE /api/file/:project/*` - Delete file or folder
- `POST /api/run` - Execute code
- `POST /api/create-project` - Create new project

## Recent Changes
- **December 8, 2025**: Automatic File Creation
  - AI now automatically creates files in your project when it generates code
  - Files are detected by filename comments at the top of code blocks (e.g., `// app.js`)
  - Visual feedback shows which files are being created
  - File tree refreshes automatically after file creation
  
- **December 7, 2025**: Added Puter.js AI Integration
  - Integrated Puter.js for free, unlimited Claude 3.7 Sonnet AI
  - AI agent can now modify code, create files/projects, detect bugs, and answer coding questions
  - No API key required - uses Puter.js "User-Pays" model
  - Streaming responses for real-time AI feedback
  
- **December 7, 2025**: Initial build
  - Created full IDE interface with Monaco editor
  - Implemented file management system
  - Added code execution for JavaScript and Python
  - Built dark theme UI similar to Replit
  - Set up Express server with all API endpoints

## Dependencies
- express: Web server framework
- cors: Cross-origin resource sharing

## Running the Application
The application runs on port 5000 with `node server.js`.
